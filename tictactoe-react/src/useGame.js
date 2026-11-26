import { useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, signOut, updateProfile,
} from 'firebase/auth';
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { ref, push, set, remove, onValue, onDisconnect, limitToLast, query as rtQuery, serverTimestamp as rtNow } from 'firebase/database';
import { auth, db, rtdb } from './firebase.js';
import { byId } from './games/index.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, easy to read aloud

const MSG = {
  'auth/email-already-in-use': 'That email already has an account',
  'auth/invalid-credential': 'Wrong email or password',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/invalid-email': 'That email does not look right',
  'auth/too-many-requests': 'Too many tries, wait a moment',
  'auth/operation-not-allowed': 'Email sign-in is not switched on in Firebase yet',
  'auth/unauthorized-domain': 'This website address is not allowed yet: add it under Firebase → Authentication → Settings → Authorized domains',
  'auth/popup-blocked': 'The browser blocked the Google popup, allow popups and try again',
  PERMISSION_DENIED: 'The chat database refused this. In Firebase → Realtime Database → Rules, paste everything from database.rules.json and click Publish',
  'permission-denied': 'Firestore refused this. Make sure the Firestore database is created and the rules from firestore.rules are published',
  unavailable: 'Cannot reach Firestore. Make sure a Firestore database is created in your Firebase project',
};
const QUIET = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']; // user just closed the Google window
const nice = (e) => MSG[e.code] || MSG[e.code?.replace('firestore/', '')]
  || (/offline/i.test(e.message) ? MSG.unavailable : e.message);

const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (n) => CODE_CHARS[n % CODE_CHARS.length]).join('');

// Everything the UI needs: who is signed in, their room, their history, and the actions.
// The browsers talk to Firestore directly; Firestore pushes every change to both players live.
export function useGame() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState(null);
  const [games, setGames] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // a live pop-up for things the other player just did
  const prevRoom = useRef(null);
  const leaving = useRef(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u && { uid: u.uid, name: u.displayName || u.email.split('@')[0] });
    setReady(true);
  }), []);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) { setRoom(null); setGames([]); return; }

    const stopRoom = onSnapshot(query(collection(db, 'rooms'), where('uids', 'array-contains', uid)), (snap) => {
      const next = snap.docs[0]?.data() || null;
      // a leftover room from before game menus existed has no game field at all: clear it instead of crashing on it
      if (next && next.game !== null && !byId[next.game]) { deleteDoc(snap.docs[0].ref); return; }
      if (!next && prevRoom.current && !leaving.current) setError('Your opponent left, so the room was closed');
      if (!next) leaving.current = false;
      // tell me what the other player just did: joined, invited me to a game, answered my invite, or started a rematch
      const prev = prevRoom.current;
      if (next && prev) {
        const other = next.players[next.players.X.uid === uid ? 'O' : 'X'];
        const sent = prev.invite && prev.invite.by.uid === uid; // I had an invite out
        let text = null, toast = true;
        if (!prev.players.O && next.players.O) text = `${next.players.O.name} joined, invite them to a game!`;
        else if (next.invite && next.invite.by.uid !== uid
          && (!prev.invite || prev.invite.game !== next.invite.game || prev.invite.by.uid !== next.invite.by.uid)) {
          text = `${next.invite.by.name} invites you to play ${byId[next.invite.game].name}`;
          toast = false; // the invite banner on screen (with its Join button) is the alert for this one
        } else if (sent && !next.invite) {
          text = next.game === prev.invite.game ? `${other.name} joined ${byId[next.game].name}, it's starting!` : `${other.name} isn't ready for ${byId[prev.invite.game].name}`;
        } else if (next.game && next.game === prev.game && next.round !== prev.round && next.startedBy && next.startedBy.uid !== uid) {
          text = `${next.startedBy.name} started a new round of ${byId[next.game].name}`;
        }
        if (text) {
          if (toast) setNotice({ id: Date.now(), text });
          // if this tab isn't in front, also use the system notification (only if the player allowed it)
          if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Pink Arcade', { body: text });
          }
        }
      }
      prevRoom.current = next;
      setRoom(next);
    }, (e) => setError(nice(e)));

    const stopGames = onSnapshot(query(collection(db, 'games'), where('uids', 'array-contains', uid)), (snap) => {
      setGames(snap.docs.map((d) => {
        const g = d.data();
        const me = g.x.uid === uid ? 'X' : 'O';
        return {
          id: d.id, date: g.date, game: g.game, me, opp: (me === 'X' ? g.o : g.x).name,
          result: g.winner === 'draw' ? 'draw' : g.winner === me ? 'win' : 'loss'
        };
      }).sort((a, b) => b.date - a.date).slice(0, 30));
    }, (e) => setError(nice(e)));

    return () => { stopRoom(); stopGames(); prevRoom.current = null; setNotice(null); };
  }, [uid]);

  // Live chat for the current room, kept in the Realtime Database only while people are connected.
  // Nothing is archived: your messages are deleted when you leave, close or refresh the page.
  const code = room?.code;
  const seat = room && (room.players.X.uid === uid ? 'X' : 'O');
  const mine = useRef([]); // ids of my messages, so they can be deleted when I leave
  useEffect(() => {
    if (!code || !seat) { setMessages([]); return; }
    let stop = () => { }, dead = false, tries = 0;
    const seatRef = ref(rtdb, `members/${code}/${seat}`);

    // Claim my seat first (the database only lets seat holders read the chat), then listen.
    const attach = () => set(seatRef, uid).then(() => {
      if (dead) return;
      onDisconnect(seatRef).remove(); // closing the page frees the seat
      stop = onValue(rtQuery(ref(rtdb, `chats/${code}`), limitToLast(100)), (snap) => {
        const list = [];
        snap.forEach((c) => { list.push({ id: c.key, ...c.val() }); });
        mine.current = list.filter((m) => m.uid === uid).map((m) => m.id);
        setMessages(list);
      }, (e) => {
        // after a refresh the old connection can free my seat a moment late, so re-claim it a few times
        stop();
        if (!dead && tries++ < 3) setTimeout(attach, 800); else if (!dead) setError(nice(e));
      });
    }).catch((e) => { if (!dead) setError(nice(e)); });
    attach();

    return () => {
      dead = true; stop();
      mine.current.forEach((id) => remove(ref(rtdb, `chats/${code}/${id}`)));
      mine.current = [];
      remove(seatRef);
      setMessages([]);
    };
  }, [code, seat, uid]);

  // run an action, showing any failure as a message instead of crashing
  const act = (fn) => async (...args) => {
    setError('');
    try { await fn(...args); } catch (e) { if (!QUIET.includes(e.code)) setError(nice(e)); }
  };

  const roomRef = (code) => doc(db, 'rooms', code);

  return {
    user, ready, room, games, messages, error, notice,
    dismissNotice: () => setNotice(null),

    chat: act(async (text) => {
      text = text.trim().slice(0, 200);
      if (!text || !room) return;
      const msg = push(ref(rtdb, `chats/${room.code}`));
      await set(msg, { uid, text, at: rtNow() });
      await onDisconnect(msg).remove(); // vanishes if I close or refresh the page (must be registered after the message exists)
    }),
    clearError: () => setError(''),

    signup: act(async (name, email, pw) => {
      name = name.trim();
      if (name.length < 2 || name.length > 16) throw new Error('Name must be 2–16 characters');
      const { user: u } = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      await updateProfile(u, { displayName: name });
      setUser({ uid: u.uid, name }); // the auth listener already fired before the name was set
    }),

    login: act((email, pw) => signInWithEmailAndPassword(auth, email.trim(), pw)),
    google: act(() => signInWithPopup(auth, new GoogleAuthProvider())),
    logout: act(() => signOut(auth)),

    // A room starts empty of games: the players pick one inside the room, and can switch whenever they like.
    create: act(async () => {
      if (room) throw new Error('Leave your current room first');
      let code = newCode();
      while ((await getDoc(roomRef(code))).exists()) code = newCode();
      await setDoc(roomRef(code), {
        code, game: null, invite: null, startedBy: null, state: null, round: 0, uids: [uid], players: { X: user, O: null }, turn: 'X', starter: 'X',
        score: { X: 0, O: 0, draws: 0 }, over: false, winner: null, createdAt: serverTimestamp(),
      });
    }),

    join: act(async (raw) => {
      if (room) throw new Error('Leave your current room first');
      const snap = await getDoc(roomRef(raw.trim().toUpperCase()));
      if (!snap.exists()) throw new Error('No room with that code');
      const r = snap.data();
      if (r.players.O) throw new Error('That room is already full');
      await updateDoc(snap.ref, { uids: [...r.uids, uid], 'players.O': user });
    }),

    // Picking a game sends the other player an invite; nothing changes for them until they accept.
    invite: act(async (gameId, level = null) => {
      if (!room?.players.O) return;
      await updateDoc(roomRef(room.code), { invite: { game: gameId, by: user, level } }); // level: difficulty, for games that have one
    }),

    // Accepting starts the invited game for both players, in the same session. Scores and seats are untouched.
    accept: act(async () => {
      const inv = room?.invite;
      if (!inv || inv.by.uid === uid) return;
      await updateDoc(roomRef(room.code), {
        ...byId[inv.game].init(inv.level), game: inv.game, invite: null, startedBy: user, round: (room.round || 0) + 1,
        turn: 'X', starter: 'X', over: false, winner: null,
      });
    }),

    // Declining, or cancelling your own invite.
    decline: act(async () => {
      if (room?.invite) await updateDoc(roomRef(room.code), { invite: null });
    }),

    // Leaving closes the room for both players.
    leave: act(async () => {
      leaving.current = true;
      await deleteDoc(roomRef(room.code));
    }),

    // Any game sends its changes through here. `patch` is the fields to change; `winner` ('X', 'O' or 'draw')
    // ends the game, adds the point, and writes the history record, all in one atomic write.
    submit: act(async (patch, winner) => {
      const r = room;
      if (!r || r.over) return;
      const update = { ...patch };
      const batch = writeBatch(db);
      if (winner) {
        const key = winner === 'draw' ? 'draws' : winner;
        Object.assign(update, { over: true, winner, score: { ...r.score, [key]: r.score[key] + 1 } });
        // only the player who finished the game writes the record, so it is stored exactly once
        batch.set(doc(collection(db, 'games')), { uids: r.uids, game: r.game, x: r.players.X, o: r.players.O, winner, date: Date.now() });
      }
      batch.update(roomRef(r.code), update);
      await batch.commit();
    }),

    rematch: act(async () => {
      if (!room?.over) return;
      const s = room.starter === 'X' ? 'O' : 'X'; // alternate who starts
      await updateDoc(roomRef(room.code), {
        ...byId[room.game].init(room.state?.level), startedBy: user, round: (room.round || 0) + 1, turn: s, starter: s, over: false, winner: null,
      });
    }),
  };
}

import { useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, signOut, updateProfile,
} from 'firebase/auth';
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, easy to read aloud
const EMPTY = Array(9).fill('');

const MSG = {
  'auth/email-already-in-use': 'That email already has an account',
  'auth/invalid-credential': 'Wrong email or password',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/invalid-email': 'That email does not look right',
  'auth/too-many-requests': 'Too many tries, wait a moment',
  'auth/operation-not-allowed': 'Email sign-in is not switched on in Firebase yet',
  'auth/unauthorized-domain': 'This website address is not allowed yet: add it under Firebase → Authentication → Settings → Authorized domains',
  'auth/popup-blocked': 'The browser blocked the Google popup, allow popups and try again',
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
      if (!next && prevRoom.current && !leaving.current) setError('Your opponent left, so the room was closed');
      if (!next) leaving.current = false;
      prevRoom.current = next;
      setRoom(next);
    }, (e) => setError(nice(e)));

    const stopGames = onSnapshot(query(collection(db, 'games'), where('uids', 'array-contains', uid)), (snap) => {
      setGames(snap.docs.map((d) => {
        const g = d.data();
        const me = g.x.uid === uid ? 'X' : 'O';
        return { id: d.id, date: g.date, me, opp: (me === 'X' ? g.o : g.x).name,
          result: g.winner === 'draw' ? 'draw' : g.winner === me ? 'win' : 'loss' };
      }).sort((a, b) => b.date - a.date).slice(0, 30));
    }, (e) => setError(nice(e)));

    return () => { stopRoom(); stopGames(); prevRoom.current = null; };
  }, [uid]);

  // Live chat for the current room. `rid` is unique per room, so a reused room code never shows old messages.
  const code = room?.code, rid = room && (room.rid || room.code); // rooms made before chat existed have no rid
  useEffect(() => {
    if (!code || !rid) { setMessages([]); return; }
    return onSnapshot(query(collection(db, 'rooms', code, 'messages'), where('rid', '==', rid)), (snap) => {
      // a message you just sent has no server time yet, so treat it as "now"
      const at = (m) => m.at?.toMillis() ?? Date.now();
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => at(a) - at(b)).slice(-100));
    }, (e) => setError(nice(e)));
  }, [code, rid]);

  // run an action, showing any failure as a message instead of crashing
  const act = (fn) => async (...args) => {
    setError('');
    try { await fn(...args); } catch (e) { if (!QUIET.includes(e.code)) setError(nice(e)); }
  };

  const roomRef = (code) => doc(db, 'rooms', code);

  return {
    user, ready, room, games, messages, error,

    chat: act(async (text) => {
      text = text.trim().slice(0, 200);
      if (!text || !room) return;
      await addDoc(collection(db, 'rooms', room.code, 'messages'), { rid: room.rid || room.code, uid, text, at: serverTimestamp() });
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

    create: act(async () => {
      if (room) throw new Error('Leave your current room first');
      let code = newCode();
      while ((await getDoc(roomRef(code))).exists()) code = newCode();
      await setDoc(roomRef(code), {
        code, rid: crypto.randomUUID(), uids: [uid], players: { X: user, O: null }, board: EMPTY, turn: 'X', starter: 'X',
        score: { X: 0, O: 0, draws: 0 }, over: false, winner: null, line: null, createdAt: serverTimestamp(),
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

    // Leaving closes the room for both players.
    leave: act(async () => {
      leaving.current = true;
      await deleteDoc(roomRef(room.code));
    }),

    move: act(async (i) => {
      const r = room;
      if (!r || r.over || !r.players.O || r.board[i] || r.players[r.turn].uid !== uid) return;
      const board = r.board.map((c, n) => (n === i ? r.turn : c));
      const line = LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
      const batch = writeBatch(db);
      if (line || board.every(Boolean)) {
        const winner = line ? r.turn : 'draw';
        batch.update(roomRef(r.code), {
          board, over: true, winner, line: line || null,
          score: { ...r.score, [line ? r.turn : 'draws']: r.score[line ? r.turn : 'draws'] + 1 },
        });
        // only the player who made the final move writes the record, so it is stored exactly once
        batch.set(doc(collection(db, 'games')), { uids: r.uids, x: r.players.X, o: r.players.O, winner, date: Date.now() });
      } else {
        batch.update(roomRef(r.code), { board, turn: r.turn === 'X' ? 'O' : 'X' });
      }
      await batch.commit();
    }),

    rematch: act(async () => {
      if (!room?.over) return;
      const s = room.starter === 'X' ? 'O' : 'X'; // alternate who starts
      await updateDoc(roomRef(room.code), { board: EMPTY, turn: s, starter: s, over: false, winner: null, line: null });
    }),
  };
}

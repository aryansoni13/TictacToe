import { useEffect, useRef, useState } from 'react';
import Auth from './Auth.jsx';
import { useGame } from './useGame.js';
import { GAMES, byId } from './games/index.js';

function History({ games }) {
  const count = (r) => games.filter((g) => g.result === r).length;
  return (
    <section className="panel history">
      <h2>Your game history</h2>
      <div className="tally">
        <span className="win">{count('win')} wins</span>
        <span className="loss">{count('loss')} losses</span>
        <span className="draw">{count('draw')} draws</span>
      </div>
      {games.length === 0 ? <p className="empty">No finished games yet.</p> : (
        <ul>
          {games.map((g) => (
            <li key={g.id}>
              <b className={g.result}>{g.result}</b>
              <span>{byId[g.game]?.emoji || '❌'} vs {g.opp}</span>
              <time>{new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The game menu. It lives inside the room, so the game is picked (and can be switched) after the room exists.
function Hub({ onPick, onCancel }) {
  return (
    <section className="hub">
      <h2>Invite your friend to a game</h2>
      <div className="hub-grid">
        {GAMES.map((g) => (
          <button key={g.id} className="game-card" onClick={() => onPick(g.id)}>
            <span className="emoji">{g.emoji}</span>
            <b>{g.name}</b>
            <small>{g.tagline}</small>
            <em>2 players · {g.how}</em>
          </button>
        ))}
      </div>
      {onCancel && <button className="link" onClick={onCancel}>← Back to the game</button>}
    </section>
  );
}

// Step 1 after signing in: make a room, or join a friend's. The game is picked inside the room.
function Lobby({ game }) {
  const [code, setCode] = useState('');
  return (
    <section className="panel lobby">
      <h2>Play with a friend</h2>
      <p className="or">Make a room, share the code, then pick any game together.</p>
      <button className="btn primary big wide" onClick={game.create}>Create a room</button>
      <p className="or">or join a friend's room</p>
      <form onSubmit={(e) => { e.preventDefault(); game.join(code); }}>
        <input className="code-input" placeholder="CODE" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
        <button className="btn">Join</button>
      </form>
      {game.error && <p className="err" role="alert">{game.error}</p>}
    </section>
  );
}

// Shown until the friend joins: games stay locked so both people are in before anything starts.
function Waiting({ code, onCopy, copied }) {
  return (
    <section className="panel waiting">
      <p className="wait-emoji">⏳</p>
      <h2>Share your room code</h2>
      <p className="or">Send them this code. The games unlock as soon as they join.</p>
      <button className="code big" onClick={onCopy} title="Copy code">{copied ? 'copied!' : code}</button>
    </section>
  );
}

// The other player invited me to a game: nothing changes for me until I press Join.
function Invite({ room, user, onAccept, onDecline }) {
  const inv = room?.invite;
  if (!inv || inv.by.uid === user.uid) return null;
  const g = byId[inv.game];
  return (
    <div className="invite" role="alert">
      <p>{g.emoji} <b>{inv.by.name}</b> invites you to play <b>{g.name}</b></p>
      <div className="invite-actions">
        <button className="btn primary small" onClick={onAccept}>Join</button>
        <button className="btn small" onClick={onDecline}>Not now</button>
      </div>
    </div>
  );
}

// A live pop-up: "Bobby joined" or "Bobby started Sudoku Race". Tap it to go to the game.
function Toast({ notice, onOpen, onClose }) {
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [notice]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!notice) return null;
  return <button key={notice.id} className="toast" role="status" onClick={onOpen}>🔔 {notice.text}</button>;
}

function Chat({ game, nameOf, active }) {
  const { messages, user, room } = game;
  const [text, setText] = useState('');
  const list = useRef(null);

  // jump to the newest message when one arrives, or when the phone's Chat tab is opened
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [messages.length, active]);

  function submit(e) {
    e.preventDefault();
    game.chat(text);
    setText('');
  }

  return (
    <section className="panel chat">
      <h2>Room chat</h2>
      <ul ref={list} aria-live="polite">
        {messages.length === 0 && <li className="empty">Say hi 👋</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.uid === user.uid ? 'mine' : 'theirs'}>
            <small>{m.uid === user.uid ? 'You' : nameOf(m.uid)}</small>
            <p>{m.text}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit}>
        <input value={text} maxLength={200} placeholder="Type a message…" onChange={(e) => setText(e.target.value)} />
        <button className="btn primary" disabled={!text.trim() || !room}>Send</button>
      </form>
      {game.error && <p className="err" role="alert">{game.error}</p>}
    </section>
  );
}

// tab: which panel a phone shows ('game' or 'chat'). Wide screens show both side by side and ignore it.
function Room({ game, tab, setTab }) {
  const { room, user, messages } = game;
  const G = room.game ? byId[room.game] : null; // null until the players pick a game
  const [picking, setPicking] = useState(false); // showing the menu to switch games
  const [copied, setCopied] = useState(false);
  const [asked, setAsked] = useState(false); // re-renders after the permission prompt
  const [seen, setSeen] = useState(0);
  const me = room.players.X.uid === user.uid ? 'X' : 'O';
  const full = !!room.players.O;
  const name = (m) => room.players[m]?.name;
  const turnGame = G?.kind === 'turn';
  const showMenu = full && (!G || picking); // games stay locked until both players are in
  const myTurn = full && !room.over && (!turnGame || room.turn === me);

  useEffect(() => { if (tab === 'chat') setSeen(messages.length); }, [tab, messages.length]);
  useEffect(() => { setPicking(false); }, [room.game, room.round]); // the menu closes when anyone starts a game
  const unread = messages.slice(seen).filter((m) => m.uid !== user.uid).length;

  const canAlert = typeof Notification !== 'undefined' && Notification.permission === 'default' && !asked;

  function pick(id) {
    if (id === room.game) { if (room.over) game.rematch(); setPicking(false); return; } // same game again = rematch
    game.invite(id); // the other player decides whether to join
    setPicking(false);
  }

  function copy() {
    navigator.clipboard?.writeText(room.code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const status = !full ? 'Waiting for your friend…'
    : showMenu ? 'Pick a game to invite them'
    : room.winner === 'draw' ? "It's a draw 💕"
      : room.winner ? (room.winner === me ? 'You win! 🎉' : `${name(room.winner)} wins!`)
        : !turnGame ? 'Race! First to finish wins'
          : myTurn ? 'Your turn' : `${name(room.turn)}'s turn…`;

  return (
    <div className="room-layout">
      <div className="play">
        <div className="roombar">
          <span>{G ? `${G.emoji} ${G.name}` : '🎮 No game yet'}</span>
          <button className="code" onClick={copy} title="Copy code">{copied ? 'copied!' : room.code}</button>
        </div>

        {room.invite?.by.uid === user.uid && (
          <p className="sent">
            ⏳ Waiting for {name(me === 'X' ? 'O' : 'X')} to join {byId[room.invite.game].name}
            <button className="link" onClick={game.decline}>Cancel</button>
          </p>
        )}

        {canAlert && (
          <button className="link alerts" onClick={() => Notification.requestPermission().then(() => setAsked(true))}>
            🔔 Alert me when I'm in another tab
          </button>
        )}

        <section className="scores">
          {['X', 'O'].map((m) => (
            <div key={m} className={`card ${turnGame && full && !room.over && room.turn === m ? 'live' : ''}`}>
              <em>{m}</em>
              <span>{name(m) ? <>{name(m)}{m === me && ' (you)'}</> : 'waiting…'}</span>
              <b>{room.score[m]}</b>
            </div>
          ))}
        </section>

        <p className={`status ${room.over ? 'done' : ''}`}>{status}</p>

        {showMenu
          ? <Hub onPick={pick} onCancel={G ? () => setPicking(false) : null} />
          /* key: a rematch is a new round, so each game starts with a fresh local board */
          : !G
            ? <Waiting code={room.code} onCopy={copy} copied={copied} />
            : <G.Play key={room.round || 0} room={room} me={me} full={full} myTurn={myTurn}
              submit={game.submit} names={{ X: name('X'), O: name('O') }} />}

        <div className="actions">
          {G && room.over && !showMenu && <button className="btn primary" onClick={game.rematch}>Rematch</button>}
          {G && !showMenu && <button className="btn" onClick={() => setPicking(true)}>Invite to another game</button>}
          <button className="btn" onClick={game.leave}>Leave room</button>
        </div>
      </div>

      {/* names come from the room, not from the message, so nobody can fake a sender */}
      <Chat game={game} active={tab === 'chat'}
        nameOf={(uid) => ['X', 'O'].map((m) => room.players[m]).find((p) => p?.uid === uid)?.name || 'Player'} />

      <nav className="room-nav" aria-label="Game or chat">
        <button className={tab === 'game' ? 'on' : ''} onClick={() => setTab('game')}>🎮 Game</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>
          💬 Chat{unread > 0 && <span className="badge">{unread}</span>}
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  const game = useGame();
  const { user, room, games, ready, notice } = game;
  const [tab, setTab] = useState('game');

  function accept() {
    if (room.game && !room.over && !window.confirm('Join the new game? Your current round will be dropped.')) return;
    game.accept();
    setTab('game');
  }

  useEffect(() => { if (!room) setTab('game'); }, [room]); // a new room always starts on the board

  return (
    <main className={`app ${room ? 'wide' : user ? 'menu' : ''}`} data-tab={room ? tab : 'game'}>
      <i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="star s1">✦</i><i className="star s2">✦</i>

      <Invite room={room} user={user} onAccept={accept} onDecline={game.decline} />
      <Toast notice={notice} onClose={game.dismissNotice} onOpen={() => { setTab('game'); game.dismissNotice(); }} />

      <header>
        <h1>Pink <span>Arcade</span></h1>
        <p className="tag">make a room · pick a game · play together</p>
        {user && (
          <p className="me">
            Signed in as <b>{user.name}</b>
            <button className="link" onClick={game.logout}>Sign out</button>
          </p>
        )}
      </header>

      {!ready ? null : !user ? <Auth game={game} />
        : room ? <Room game={game} tab={tab} setTab={setTab} />
          : <Lobby game={game} />}

      {user && <History games={games} />}
    </main>
  );
}

import { useEffect, useRef, useState } from 'react';
import Auth from './Auth.jsx';
import { useGame } from './useGame.js';

function Mark({ p }) {
  return p === 'X' ? (
    <svg viewBox="0 0 40 40" className="mark x"><path d="M8 8 L32 32 M32 8 L8 32" /></svg>
  ) : (
    <svg viewBox="0 0 40 40" className="mark o"><circle cx="20" cy="20" r="12" /></svg>
  );
}

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
              <span>vs {g.opp} · as {g.me}</span>
              <time>{new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Lobby({ game }) {
  const [code, setCode] = useState('');
  const { error } = game;
  return (
    <section className="panel lobby">
      <button className="btn primary big wide" onClick={game.create}>Create a room</button>
      <p className="or">or join a friend's room</p>
      <form onSubmit={(e) => { e.preventDefault(); game.join(code); }}>
        <input className="code-input" placeholder="CODE" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
        <button className="btn">Join</button>
      </form>
      {error && <p className="err" role="alert">{error}</p>}
    </section>
  );
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
  const [copied, setCopied] = useState(false);
  const [seen, setSeen] = useState(0);
  const me = room.players.X.uid === user.uid ? 'X' : 'O';
  const full = !!room.players.O;
  const name = (m) => room.players[m]?.name;
  const myTurn = full && !room.over && room.turn === me;

  useEffect(() => { if (tab === 'chat') setSeen(messages.length); }, [tab, messages.length]);
  const unread = messages.slice(seen).filter((m) => m.uid !== user.uid).length;

  function copy() {
    navigator.clipboard?.writeText(room.code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const status = !full ? 'Waiting for your friend…'
    : room.winner === 'draw' ? "It's a draw 💕"
      : room.winner ? (room.winner === me ? 'You win! 🎉' : `${name(room.winner)} wins!`)
        : myTurn ? 'Your turn' : `${name(room.turn)}'s turn…`;

  return (
    <div className="room-layout">
      <div className="play">
        <div className="roombar">
          <span>Room</span>
          <button className="code" onClick={copy} title="Copy code">{copied ? 'copied!' : room.code}</button>
        </div>

        <section className="scores">
          {['X', 'O'].map((m) => (
            <div key={m} className={`card ${full && !room.over && room.turn === m ? 'live' : ''}`}>
              <em>{m}</em>
              <span>{name(m) ? <>{name(m)}{m === me && ' (you)'}</> : 'waiting…'}</span>
              <b>{room.score[m]}</b>
            </div>
          ))}
        </section>

        <p className={`status ${room.over ? 'done' : ''}`}>{status}</p>

        <section className={`board ${full ? '' : 'idle'}`}>
          {room.board.map((cell, i) => (
            <button
              key={i}
              className={`cell ${room.line?.includes(i) ? 'win' : ''}`}
              onClick={() => game.move(i)}
              disabled={!myTurn || !!cell}
              aria-label={`row ${Math.floor(i / 3) + 1} column ${(i % 3) + 1}${cell ? `, ${cell}` : ''}`}
            >
              {cell && <Mark p={cell} />}
            </button>
          ))}
        </section>

        <div className="actions">
          {room.over && <button className="btn primary" onClick={game.rematch}>Rematch</button>}
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
  const { user, room, games, ready } = game;
  const [tab, setTab] = useState('game');

  useEffect(() => { if (!room) setTab('game'); }, [room]); // a new room always starts on the board

  return (
    <main className={`app ${room ? 'wide' : ''}`} data-tab={room ? tab : 'game'}>
      <i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="star s1">✦</i><i className="star s2">✦</i>

      <header>
        <h1>Tic <span>Tac</span> Toe</h1>
        <p className="tag">two players · one room · bragging rights</p>
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

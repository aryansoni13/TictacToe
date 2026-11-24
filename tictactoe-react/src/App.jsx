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

// Step 1 after signing in: pick a game.
function Hub({ onPick }) {
  return (
    <section className="hub">
      <h2>Choose a game</h2>
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
    </section>
  );
}

// Step 2: make a room for that game, or join a friend's.
function Lobby({ game, gameId, onBack }) {
  const [code, setCode] = useState('');
  const g = byId[gameId];
  return (
    <section className="panel lobby">
      <button className="link back" onClick={() => { game.clearError(); onBack(); }}>← All games</button>
      <div className="lobby-title"><span className="emoji">{g.emoji}</span><h2>{g.name}</h2></div>
      <p className="or">{g.tagline}</p>
      <button className="btn primary big wide" onClick={() => game.create(gameId)}>Create a room</button>
      <p className="or">or join a friend's room</p>
      <form onSubmit={(e) => { e.preventDefault(); game.join(code, gameId); }}>
        <input className="code-input" placeholder="CODE" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
        <button className="btn">Join</button>
      </form>
      {game.error && <p className="err" role="alert">{game.error}</p>}
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
  const G = byId[room.game];
  const [copied, setCopied] = useState(false);
  const [seen, setSeen] = useState(0);
  const me = room.players.X.uid === user.uid ? 'X' : 'O';
  const full = !!room.players.O;
  const name = (m) => room.players[m]?.name;
  const turnGame = G.kind === 'turn';
  const myTurn = full && !room.over && (!turnGame || room.turn === me);

  useEffect(() => { if (tab === 'chat') setSeen(messages.length); }, [tab, messages.length]);
  const unread = messages.slice(seen).filter((m) => m.uid !== user.uid).length;

  function copy() {
    navigator.clipboard?.writeText(room.code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const status = !full ? 'Waiting for your friend…'
    : room.winner === 'draw' ? "It's a draw 💕"
      : room.winner ? (room.winner === me ? 'You win! 🎉' : `${name(room.winner)} wins!`)
        : !turnGame ? 'Race! First to finish wins'
          : myTurn ? 'Your turn' : `${name(room.turn)}'s turn…`;

  return (
    <div className="room-layout">
      <div className="play">
        <div className="roombar">
          <span>{G.emoji} {G.name}</span>
          <button className="code" onClick={copy} title="Copy code">{copied ? 'copied!' : room.code}</button>
        </div>

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

        {/* key: a rematch is a new round, so each game starts with a fresh local board */}
        <G.Play key={room.round || 0} room={room} me={me} full={full} myTurn={myTurn}
          submit={game.submit} names={{ X: name('X'), O: name('O') }} />

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
  const [picked, setPicked] = useState(null); // the game chosen in the menu

  useEffect(() => { if (!room) setTab('game'); }, [room]); // a new room always starts on the board
  useEffect(() => { if (!user) setPicked(null); }, [user]);

  return (
    <main className={`app ${room ? 'wide' : ''}`} data-tab={room ? tab : 'game'}>
      <i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="star s1">✦</i><i className="star s2">✦</i>

      <header>
        <h1>Pink <span>Arcade</span></h1>
        <p className="tag">pick a game · make a room · play together</p>
        {user && (
          <p className="me">
            Signed in as <b>{user.name}</b>
            <button className="link" onClick={game.logout}>Sign out</button>
          </p>
        )}
      </header>

      {!ready ? null : !user ? <Auth game={game} />
        : room ? <Room game={game} tab={tab} setTab={setTab} />
          : picked ? <Lobby game={game} gameId={picked} onBack={() => setPicked(null)} />
            : <Hub onPick={setPicked} />}

      {user && <History games={games} />}
    </main>
  );
}

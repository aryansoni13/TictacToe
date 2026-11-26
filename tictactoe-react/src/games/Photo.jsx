import { useRef, useState } from 'react';
import { RaceBars } from './Race.jsx';

// n = grid size (16, 36, 64, 100 pieces: always even, so both players get an equal share); ghost = how visible the faint guide picture on the board is; snap = how close a drop must be
const LEVELS = {
  easy: { n: 4, ghost: 0.35, snap: 0.45, tip: 'Big pieces, clear guide picture' },
  medium: { n: 6, ghost: 0.18, snap: 0.35, tip: 'More pieces, faint guide' },
  hard: { n: 8, ghost: 0, snap: 0.3, tip: 'No guide picture, only hold-to-preview' },
  expert: { n: 10, ghost: 0, snap: 0.22, tip: '100 pieces, no guide, precise drops' },
};
const SIZE = 160, BOARD = 100, OFF = 30; // svg units: the picture is a BOARD square at (OFF, OFF), pieces scatter around it

// Shrink the photo to a 480px square JPEG (~50KB) so it fits in the room document both players read.
function toSquare(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const s = Math.min(im.width, im.height), c = document.createElement('canvas');
      c.width = c.height = 480;
      c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 480, 480);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    im.src = url;
  });
}

// One side of a piece from A to B: flat (s=0), or a round knob sticking out (s=1) or a matching dent (s=-1).
function side(ax, ay, bx, by, nx, ny, s, p) {
  if (!s) return ` L ${bx} ${by}`;
  const P = (u, h) => `${ax + (bx - ax) * u + nx * s * h * p} ${ay + (by - ay) * u + ny * s * h * p}`;
  return ` L ${P(0.35, 0)} C ${P(0.35, 0.1)} ${P(0.25, 0.12)} ${P(0.25, 0.22)}`
    + ` C ${P(0.25, 0.36)} ${P(0.75, 0.36)} ${P(0.75, 0.22)} C ${P(0.75, 0.12)} ${P(0.65, 0.1)} ${P(0.65, 0)} L ${bx} ${by}`;
}

// Jigsaw cuts: every inner edge is a knob on one piece and a dent on its neighbour.
function makeCuts(n) {
  const rnd = () => (Math.random() < 0.5 ? 1 : -1);
  const right = Array.from({ length: n }, () => Array.from({ length: n - 1 }, rnd));
  const down = Array.from({ length: n - 1 }, () => Array.from({ length: n }, rnd));
  const p = BOARD / n;
  return Array.from({ length: n * n }, (_, i) => {
    const r = Math.floor(i / n), c = i % n;
    const top = r ? -down[r - 1][c] : 0, rt = c < n - 1 ? right[r][c] : 0;
    const bot = r < n - 1 ? down[r][c] : 0, lf = c ? -right[r][c - 1] : 0;
    return `M 0 0${side(0, 0, p, 0, 0, -1, top, p)}${side(p, 0, p, p, 1, 0, rt, p)}${side(p, p, 0, p, 0, 1, bot, p)}${side(0, p, 0, 0, -1, 0, lf, p)} Z`;
  });
}

// Scatter the loose pieces around the board (their centres stay off the picture).
function scatter(n) {
  const p = BOARD / n;
  return Array.from({ length: n * n }, () => {
    let x, y, k = 0;
    do {
      x = Math.random() * (SIZE - p); y = Math.random() * (SIZE - p);
    } while (k++ < 40 && x + p / 2 > OFF && x + p / 2 < OFF + BOARD && y + p / 2 > OFF && y + p / 2 < OFF + BOARD);
    return { x, y };
  });
}

// A colourful built-in picture, so the puzzle can be tried without uploading anything.
function samplePicture() {
  const c = document.createElement('canvas');
  c.width = c.height = 480;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 480, 480);
  grad.addColorStop(0, '#ff9ec7'); grad.addColorStop(0.5, '#ffd36e'); grad.addColorStop(1, '#6ec6ff');
  g.fillStyle = grad; g.fillRect(0, 0, 480, 480);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `hsla(${i * 26}, 85%, 60%, .75)`;
    g.beginPath(); g.arc(40 + ((i * 97) % 400), 40 + ((i * 151) % 400), 30 + (i % 4) * 14, 0, 7); g.fill();
  }
  return c.toDataURL('image/jpeg', 0.8);
}

function Setup({ submit, state }) {
  const [err, setErr] = useState('');
  const [cuts] = useState(() => makeCuts(state.n));
  const p = BOARD / state.n;
  async function pick(e) {
    const file = e.target.files[0];
    if (!file) return;
    try { await submit({ state: { ...state, img: await toSquare(file) } }); }
    catch { setErr('Please choose an image file.'); }
  }
  return (
    <section className="photo-setup">
      <p>Level: <b>{state.level}</b> · {state.n * state.n} pieces. {LEVELS[state.level].tip}.</p>
      <svg className="jigsaw cut-preview" viewBox={`0 0 ${BOARD} ${BOARD}`} aria-label="How the picture will be cut">
        {cuts.map((d, i) => (
          <path key={i} d={d} className="jig-cut" transform={`translate(${(i % state.n) * p} ${Math.floor(i / state.n) * p})`} />
        ))}
      </svg>
      <p>Upload a picture to cut it into these pieces. Both players race to piece it together.</p>
      <label className="photo-upload">📷 Upload picture<input type="file" accept="image/*" onChange={pick} hidden /></label>
      <button className="link" onClick={() => submit({ state: { ...state, img: samplePicture() } })}>or use a sample picture</button>
      {err && <p className="error">{err}</p>}
    </section>
  );
}

function Puzzle({ room, me, full, myTurn, submit, names }) {
  const { img, n } = room.state;
  const lv = LEVELS[room.state.level] || LEVELS.easy;
  const p = BOARD / n;
  const [paths] = useState(() => makeCuts(n));
  const [pos, setPos] = useState(() => scatter(n));
  const owner = room.state.placed || {}; // piece index -> seat of whoever placed it; shared live through the room
  const placed = Array.from({ length: n * n }, (_, i) => !!owner[i]);
  const [order, setOrder] = useState(() => Array.from({ length: n * n }, (_, i) => i)); // last = on top
  const [peek, setPeek] = useState(false);
  const svg = useRef(null);
  const drag = useRef(null);

  const mine = Object.values(owner).filter((s) => s === me).length;
  const total = Object.keys(owner).length;
  const locked = !full || room.over || !myTurn; // you move only on your turn; placing a piece (or passing) hands it over
  const other = me === 'X' ? 'O' : 'X';
  // bars come straight from the shared board, so they stay right when the picture is swapped
  const seen = (m) => Object.values(owner).filter((s) => s === m).length;
  const barsRoom = { ...room, progX: seen('X'), progO: seen('O') };
  async function change(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || (total && !window.confirm('Change the picture? This restarts the puzzle for both players.'))) return;
    try { await submit({ state: { ...room.state, img: await toSquare(file), placed: {}, pic: (room.state.pic || 0) + 1 } }); }
    catch { /* not an image: keep the current one */ }
  }

  const at = (e) => {
    const pt = svg.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.current.getScreenCTM().inverse());
  };

  function down(e, i) {
    if (locked || placed[i]) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = at(e);
    drag.current = { i, dx: m.x - pos[i].x, dy: m.y - pos[i].y, from: pos[i] };
    setOrder((o) => [...o.filter((x) => x !== i), i]);
  }
  const homeOf = (i) => ({ x: OFF + (i % n) * p, y: OFF + Math.floor(i / n) * p });
  const dist = (i, q) => Math.hypot(q.x - homeOf(i).x, q.y - homeOf(i).y);

  function lock(i) { // snap the piece into place for good
    setPos((ps) => ps.map((v, k) => (k === i ? homeOf(i) : v)));
    if (owner[i]) return; // the other player got it first
    const my = mine + 1, theirs = total - mine;
    const patch = { ['state.placed.' + i]: me, ['prog' + me]: my, turn: other };
    // the last piece ends the game: whoever placed more pieces wins
    if (total + 1 === n * n) submit(patch, my === theirs ? 'draw' : my > theirs ? me : me === 'X' ? 'O' : 'X');
    else submit(patch);
  }
  function move(e) {
    const d = drag.current;
    if (!d) return;
    const m = at(e), q = { x: m.x - d.dx, y: m.y - d.dy };
    if (dist(d.i, q) < p * 0.15) { drag.current = null; lock(d.i); return; } // very close: it locks without letting go
    setPos((ps) => ps.map((v, k) => (k === d.i ? q : v)));
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (dist(d.i, pos[d.i]) < p * lv.snap) return lock(d.i); // let go close enough: it locks too
    // a miss: the piece goes back and you keep your turn until you place one (or press Pass)
    setPos((ps) => ps.map((v, k) => (k === d.i ? d.from : v)));
  }

  const loose = order.filter((i) => !placed[i]);
  return (
    <>
      <RaceBars room={barsRoom} me={me} mine={mine} total={n * n} names={names} />
      <svg
        ref={svg} className={`jigsaw ${locked ? 'idle' : ''}`} viewBox={`0 0 ${SIZE} ${SIZE}`}
        onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      >
        <rect x={OFF} y={OFF} width={BOARD} height={BOARD} className="jig-board" />
        <image href={img} x={OFF} y={OFF} width={BOARD} height={BOARD} opacity={peek ? 0.9 : lv.ghost} pointerEvents="none" />
        {[...order.filter((i) => placed[i]), ...loose].map((i) => (
          <g key={i} transform={`translate(${(placed[i] ? homeOf(i) : pos[i]).x} ${(placed[i] ? homeOf(i) : pos[i]).y})`} onPointerDown={(e) => down(e, i)}
            className={placed[i] ? `jig-set jig-${owner[i]}` : 'jig-loose'}>
            <clipPath id={`jp${i}`}><path d={paths[i]} /></clipPath>
            <image href={img} x={-(i % n) * p} y={-Math.floor(i / n) * p} width={BOARD} height={BOARD}
              clipPath={`url(#jp${i})`} preserveAspectRatio="none" />
            <path d={paths[i]} className="jig-edge" />
          </g>
        ))}
      </svg>
      <p className="subscore">
        {room.state.level || 'easy'} · you placed {mine} · {total}/{n * n} done · place one piece, then it is their turn · most pieces wins{' '}
        <button className="link" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>
          hold to preview
        </button>{' '}
        {myTurn && !room.over && <button className="link" onClick={() => submit({ turn: other })}>pass my turn</button>}{' '}
        {!room.over && (
          <label className="link">change picture<input type="file" accept="image/*" onChange={change} hidden /></label>
        )}
      </p>
    </>
  );
}

function Play(props) {
  // key: a new picture remounts the puzzle, so the pieces scatter afresh
  return props.room.state.img ? <Puzzle key={props.room.state.pic || 0} {...props} /> : <Setup submit={props.submit} state={props.room.state} />;
}

export default {
  id: 'photo', name: 'Picture Puzzle', emoji: '🖼️', tagline: 'Upload a photo and piece the jigsaw together', how: 'Take turns',
  kind: 'turn', // players take turns: one drop each, a correct drop scores
  levels: LEVELS, // the menu asks for one of these before inviting
  init: (level) => {
    const l = LEVELS[level] ? level : 'easy';
    return { state: { img: null, n: LEVELS[l].n, level: l, placed: {} }, progX: 0, progO: 0 };
  },
  Play,
};

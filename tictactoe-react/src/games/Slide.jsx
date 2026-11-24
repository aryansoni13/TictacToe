import { useState } from 'react';
import { RaceBars, useRaceReport } from './Race.jsx';

const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // 0 is the empty space

const near = (i) => {
  const r = Math.floor(i / 3), c = i % 3, out = [];
  if (r > 0) out.push(i - 3);
  if (r < 2) out.push(i + 3);
  if (c > 0) out.push(i - 1);
  if (c < 2) out.push(i + 1);
  return out;
};

// scramble by making random legal slides from the solved board, so every puzzle is solvable
function makeTiles() {
  const t = [...GOAL];
  let blank = 8, prev = -1;
  for (let n = 0; n < 120; n++) {
    const opts = near(blank).filter((x) => x !== prev);
    const m = opts[Math.floor(Math.random() * opts.length)];
    [t[blank], t[m]] = [t[m], t[blank]];
    prev = blank; blank = m;
  }
  return t.join() === GOAL.join() ? makeTiles() : t;
}

function Play({ room, me, full, submit, names }) {
  const [tiles, setTiles] = useState(() => [...room.state.tiles]);
  const [moves, setMoves] = useState(0);

  const correct = tiles.filter((v, i) => v && v === GOAL[i]).length;
  const done = correct === 8;
  const locked = !full || room.over;
  useRaceReport({ room, me, count: correct, done, submit });

  function slide(i) {
    const blank = tiles.indexOf(0);
    if (locked || !near(blank).includes(i)) return;
    setTiles(tiles.map((v, n) => (n === i ? 0 : n === blank ? tiles[i] : v)));
    setMoves(moves + 1);
  }

  return (
    <>
      <RaceBars room={room} me={me} mine={correct} total={8} names={names} />
      <section className={`board slide ${locked ? 'idle' : ''}`}>
        {tiles.map((v, i) => (
          <button
            key={i}
            className={`cell tile ${v ? '' : 'blank'} ${v && v === GOAL[i] ? 'right' : ''}`}
            onClick={() => slide(i)}
            disabled={locked || !v}
            aria-label={v ? `tile ${v}` : 'empty space'}
          >
            {v || ''}
          </button>
        ))}
      </section>
      <p className="subscore">Moves: {moves}</p>
    </>
  );
}

export default {
  id: 'slide', name: 'Sliding Puzzle', emoji: '🧩', tagline: 'Slide the tiles into order', how: 'Race',
  kind: 'race',
  init: () => ({ state: { tiles: makeTiles() }, progX: 0, progO: 0 }),
  Play,
};

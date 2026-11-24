import { useEffect, useMemo, useState } from 'react';
import { RaceBars, useRaceReport } from './Race.jsx';

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const fits = (g, i, v) => {
  const r = Math.floor(i / 9), c = i % 9, br = r - (r % 3), bc = c - (c % 3);
  for (let k = 0; k < 9; k++) if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (g[(br + a) * 9 + bc + b] === v) return false;
  return true;
};

function fill(g) {
  const i = g.indexOf(0);
  if (i < 0) return true;
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (fits(g, i, v)) { g[i] = v; if (fill(g)) return true; g[i] = 0; }
  }
  return false;
}

// shortcut: puzzles are not checked for a single unique solution, so a player's valid alternative solution
// counts too (the win check is "no rule broken and board full"), which is why uniqueness isn't needed.
function makePuzzle() {
  const g = Array(81).fill(0);
  fill(g);
  shuffle([...Array(81).keys()]).slice(0, 42).forEach((i) => { g[i] = 0; }); // 39 clues
  return g;
}

// every cell that shares a row, column or box with an equal digit
function conflicts(g) {
  const bad = new Set();
  const groups = [];
  for (let k = 0; k < 9; k++) {
    groups.push([...Array(9).keys()].map((n) => k * 9 + n));
    groups.push([...Array(9).keys()].map((n) => n * 9 + k));
    const br = Math.floor(k / 3) * 3, bc = (k % 3) * 3;
    groups.push([...Array(9).keys()].map((n) => (br + Math.floor(n / 3)) * 9 + bc + (n % 3)));
  }
  for (const grp of groups) {
    const seen = {};
    for (const i of grp) if (g[i]) (seen[g[i]] ||= []).push(i);
    for (const idx of Object.values(seen)) if (idx.length > 1) idx.forEach((i) => bad.add(i));
  }
  return bad;
}

function Play({ room, me, full, submit, names }) {
  const puzzle = room.state.puzzle;
  const [grid, setGrid] = useState(() => [...puzzle]);
  const [sel, setSel] = useState(null);
  const bad = useMemo(() => conflicts(grid), [grid]);

  const total = puzzle.filter((v) => !v).length;
  const filled = grid.filter((v, i) => !puzzle[i] && v && !bad.has(i)).length;
  const done = bad.size === 0 && grid.every(Boolean);
  const locked = !full || room.over;
  useRaceReport({ room, me, count: filled, done, submit });

  const put = (v) => {
    if (locked || sel === null || puzzle[sel]) return;
    setGrid((g) => g.map((x, i) => (i === sel ? v : x)));
  };

  // keyboard: digits, backspace, arrows (but not while typing in the chat box)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (/^[1-9]$/.test(e.key)) put(Number(e.key));
      else if (['Backspace', 'Delete', '0'].includes(e.key)) put(0);
      else if (sel !== null && e.key.startsWith('Arrow')) {
        const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
        setSel((s) => Math.max(0, Math.min(80, s + d)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <RaceBars room={room} me={me} mine={filled} total={total} names={names} />
      <section className={`sudoku ${locked ? 'idle' : ''}`}>
        {grid.map((v, i) => (
          <button
            key={i}
            className={`sd ${puzzle[i] ? 'given' : ''} ${sel === i ? 'sel' : ''} ${bad.has(i) ? 'bad' : ''} ${i % 9 === 2 || i % 9 === 5 ? 'rb' : ''} ${Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? 'bb' : ''}`}
            onClick={() => setSel(i)}
            aria-label={`row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}${v ? `, ${v}` : ', empty'}`}
          >
            {v || ''}
          </button>
        ))}
      </section>
      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} className="btn" disabled={locked} onClick={() => put(n)}>{n}</button>
        ))}
        <button className="btn" disabled={locked} onClick={() => put(0)} aria-label="erase">⌫</button>
      </div>
    </>
  );
}

export default {
  id: 'sudoku', name: 'Sudoku Race', emoji: '🔢', tagline: 'Same puzzle, first to solve it wins', how: 'Race',
  kind: 'race',
  init: () => ({ state: { puzzle: makePuzzle() }, progX: 0, progO: 0 }),
  Play,
};

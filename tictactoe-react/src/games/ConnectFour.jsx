const ROWS = 6, COLS = 7;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

// the run of same-coloured discs through cell `at`, if it is 4 or longer
export function winLine(board, at) {
  const p = board[at], r0 = Math.floor(at / COLS), c0 = at % COLS;
  for (const [dr, dc] of DIRS) {
    const cells = [at];
    for (const s of [1, -1]) {
      let r = r0 + dr * s, c = c0 + dc * s;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === p) {
        cells.push(r * COLS + c); r += dr * s; c += dc * s;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

function Play({ room, myTurn, submit }) {
  const { board, line } = room.state;

  function drop(c) {
    if (!myTurn) return;
    let r = ROWS - 1;
    while (r >= 0 && board[r * COLS + c]) r--;
    if (r < 0) return; // column is full
    const at = r * COLS + c;
    const b = board.map((x, n) => (n === at ? room.turn : x));
    const l = winLine(b, at);
    if (l) submit({ state: { board: b, line: l } }, room.turn);
    else if (b.every(Boolean)) submit({ state: { board: b, line: null } }, 'draw');
    else submit({ state: { board: b, line: null }, turn: room.turn === 'X' ? 'O' : 'X' });
  }

  return (
    <section className="board c4">
      {board.map((cell, i) => {
        const c = i % COLS;
        const full = !!board[c]; // top cell filled = column full
        return (
          <button
            key={i}
            className={`cell disc ${cell ? `disc-${cell}` : ''} ${line?.includes(i) ? 'win' : ''}`}
            onClick={() => drop(c)}
            disabled={!myTurn || full}
            aria-label={`column ${c + 1}${cell ? `, ${cell}` : ''}`}
          />
        );
      })}
    </section>
  );
}

export default {
  id: 'c4', name: 'Connect Four', emoji: '🔴', tagline: 'Drop discs, get four in a row', how: 'Take turns',
  kind: 'turn',
  init: () => ({ state: { board: Array(ROWS * COLS).fill(''), line: null } }),
  Play,
};

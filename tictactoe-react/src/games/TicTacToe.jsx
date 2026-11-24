const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function Mark({ p }) {
  return p === 'X' ? (
    <svg viewBox="0 0 40 40" className="mark x"><path d="M8 8 L32 32 M32 8 L8 32" /></svg>
  ) : (
    <svg viewBox="0 0 40 40" className="mark o"><circle cx="20" cy="20" r="12" /></svg>
  );
}

// A game module: init() gives the starting room state, Play draws the board and sends moves with submit(patch, winner?).
function Play({ room, myTurn, submit }) {
  const { board, line } = room.state;

  function click(i) {
    if (!myTurn || board[i]) return;
    const b = board.map((c, n) => (n === i ? room.turn : c));
    const l = LINES.find(([x, y, z]) => b[x] && b[x] === b[y] && b[x] === b[z]);
    if (l) submit({ state: { board: b, line: l } }, room.turn);
    else if (b.every(Boolean)) submit({ state: { board: b, line: null } }, 'draw');
    else submit({ state: { board: b, line: null }, turn: room.turn === 'X' ? 'O' : 'X' });
  }

  return (
    <section className="board">
      {board.map((cell, i) => (
        <button
          key={i}
          className={`cell ${line?.includes(i) ? 'win' : ''}`}
          onClick={() => click(i)}
          disabled={!myTurn || !!cell}
          aria-label={`row ${Math.floor(i / 3) + 1} column ${(i % 3) + 1}${cell ? `, ${cell}` : ''}`}
        >
          {cell && <Mark p={cell} />}
        </button>
      ))}
    </section>
  );
}

export default {
  id: 'ttt', name: 'Tic Tac Toe', emoji: '❌', tagline: 'Three in a row wins', how: 'Take turns',
  kind: 'turn',
  init: () => ({ state: { board: Array(9).fill(''), line: null } }),
  Play,
};

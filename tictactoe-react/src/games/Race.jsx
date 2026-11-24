import { useEffect } from 'react';

// Shared by the "race" games (Sudoku, Sliding puzzle): both players solve the same puzzle on their own
// board, and only a progress number is shared through the room. First to finish wins.

// Tells the room how far I am, and claims the win when I'm done.
export function useRaceReport({ room, me, count, done, submit }) {
  const key = 'prog' + me;
  const seated = !!room.players.O;
  useEffect(() => {
    if (!seated || room.over) return;
    if (done) { submit({ [key]: count }, me); return; }
    if (room[key] === count) return;
    const t = setTimeout(() => submit({ [key]: count }), 400); // small delay so fast typing is one write
    return () => clearTimeout(t);
  }, [count, done, room.over, seated]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function RaceBars({ room, me, mine, total, names }) {
  return (
    <div className="race">
      {['X', 'O'].map((m) => {
        const n = m === me ? mine : room['prog' + m] || 0; // my own bar uses my live count, not the delayed copy
        return (
          <div key={m} className="race-row">
            <span>{names[m] || '…'}{m === me && ' (you)'}</span>
            <div className="race-track"><i style={{ width: `${Math.min(100, (100 * n) / total)}%` }} /></div>
            <small>{n}/{total}</small>
          </div>
        );
      })}
    </div>
  );
}

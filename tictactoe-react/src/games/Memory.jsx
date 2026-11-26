import { useEffect } from 'react';

const FACES = ['🍓', '🍒', '🍑', '🍋', '🍇', '🥝', '🍉', '🍍'];

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function Play({ room, myTurn, submit }) {
  const { cards, open, matched, pairs } = room.state;

  function flip(i) {
    if (!myTurn || open.length >= 2 || open.includes(i) || matched.includes(i)) return;
    const o = [...open, i];
    if (o.length === 1 || cards[o[0]] !== cards[o[1]]) return submit({ state: { ...room.state, open: o } });

    // a pair: score it and the same player goes again
    const m = [...matched, ...o];
    const p = { ...pairs, [room.turn]: pairs[room.turn] + 1 };
    const state = { ...room.state, open: [], matched: m, pairs: p };
    if (m.length < cards.length) return submit({ state });
    submit({ state }, p.X === p.O ? 'draw' : p.X > p.O ? 'X' : 'O');
  }

  // after a miss, the player whose turn it is flips the two cards back and passes the turn
  useEffect(() => {
    if (open.length !== 2 || !myTurn) return;
    const t = setTimeout(() => submit({ state: { ...room.state, open: [] }, turn: room.turn === 'X' ? 'O' : 'X' }), 1100);
    return () => clearTimeout(t);
  }, [open.length, myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <section className="board mem">
        {cards.map((face, i) => {
          const up = open.includes(i) || matched.includes(i);
          return (
            <button
              key={i}
              className={`cell mem-card ${up ? 'up' : ''} ${matched.includes(i) ? 'win' : ''}`}
              onClick={() => flip(i)}
              disabled={!myTurn || up}
              aria-label={up ? face : 'hidden card'}
            >
              {up ? face : '?'}
            </button>
          );
        })}
      </section>
      <p className="subscore">Pairs found: X {pairs.X} · O {pairs.O}</p>
    </>
  );
}

export default {
  order: 3, id: 'memory', name: 'Memory Match', emoji: '🍓', tagline: 'Flip cards and find the pairs', how: 'Take turns',
  kind: 'turn',
  init: () => ({
    state: { cards: shuffle([...FACES, ...FACES]), open: [], matched: [], pairs: { X: 0, O: 0 } },
  }),
  Play,
};

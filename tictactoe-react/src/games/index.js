import ttt from './TicTacToe.jsx';
import c4 from './ConnectFour.jsx';
import memory from './Memory.jsx';
import sudoku from './Sudoku.jsx';
import slide from './Slide.jsx';

// To add a game: create a module like the others (id, name, kind, init, Play) and list it here.
// 'turn' games alternate moves; 'race' games let both players solve the same puzzle at once.
// The ids ttt/c4/memory (turn) and sudoku/slide (race) are also named in firestore.rules.
export const GAMES = [ttt, c4, memory, sudoku, slide];
export const byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));

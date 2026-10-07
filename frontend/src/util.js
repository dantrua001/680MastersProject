export const COLS = 'ABCDEFGHIJKLMNO';
export const cellName = (r, c) => `${COLS[c]}${r + 1}`;

// "H8" -> { row: 7, col: 7 }
export function parseCell(text) {
  const m = /^([A-Oa-o])\s*(1[0-5]|[1-9])$/.exec(text.trim());
  return m ? { row: Number(m[2]) - 1, col: COLS.indexOf(m[1].toUpperCase()) } : null;
}

export const routeFor = (game) =>
  game.status === 'waiting' ? `/room/${game.code}` : game.status === 'active' ? `/game/${game.code}` : `/results/${game.code}`;

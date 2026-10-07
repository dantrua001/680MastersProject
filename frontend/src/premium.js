// Same layout as the backend: one quarter of the board, mirrored.
const QUARTER = {
  TW: [[0, 0], [0, 7], [7, 0]],
  DW: [[1, 1], [2, 2], [3, 3], [4, 4], [7, 7]],
  TL: [[1, 5], [5, 1], [5, 5]],
  DL: [[0, 3], [2, 6], [3, 0], [3, 7], [6, 2], [6, 6], [7, 3]],
};
const MAP = {};
for (const [kind, cells] of Object.entries(QUARTER)) {
  for (const [r, c] of cells) {
    for (const [rr, cc] of [[r, c], [r, 14 - c], [14 - r, c], [14 - r, 14 - c]]) MAP[`${rr},${cc}`] = kind;
  }
}
export const premiumAt = (r, c) => MAP[`${r},${c}`] || '';

export const VALUES = {};
for (const [pts, letters] of [[1, 'AEILNORSTU'], [2, 'DG'], [3, 'BCMP'], [4, 'FHVWY'], [5, 'K'], [8, 'JX'], [10, 'QZ']]) {
  for (const ch of letters) VALUES[ch] = pts;
}

import { Fragment } from 'react';
import Tile from './Tile.jsx';
import { premiumAt } from '../premium.js';
import { COLS } from '../util.js';

const SQUARE = {
  TW: { cls: 'bg-sq-tw text-white', label: 'TW' },
  DW: { cls: 'bg-sq-dw text-felt-950', label: 'DW' },
  TL: { cls: 'bg-sq-tl text-white', label: 'TL' },
  DL: { cls: 'bg-sq-dl text-felt-950', label: 'DL' },
};

// 15x15 board with A-O / 1-15 coordinates. Font sizes scale with the board width (container units).
export default function Board({ board, pending, blocked, lastCells, onCell }) {
  const last = new Set((lastCells || []).map(([r, c]) => `${r},${c}`));
  return (
    <div style={{ containerType: 'inline-size' }} className="mx-auto w-full max-w-[700px]">
      <div className="grid gap-[2px] rounded-xl bg-felt-950 p-2" style={{ gridTemplateColumns: 'minmax(0,0.55fr) repeat(15, minmax(0,1fr))' }}>
        <div />
        {COLS.split('').map((ch) => (
          <div key={ch} className="text-center text-ink-500" style={{ fontSize: '2.2cqw' }}>{ch}</div>
        ))}
        {board.map((row, r) => (
          <Fragment key={r}>
            <div className="flex items-center justify-center text-ink-500" style={{ fontSize: '2.2cqw' }}>{r + 1}</div>
            {row.map((cell, c) => {
              const key = `${r},${c}`;
              const p = pending[key];
              const kind = premiumAt(r, c);
              const isBlocked = blocked && blocked.row === r && blocked.col === c;
              const plain = !cell && !p;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCell(r, c)}
                  aria-label={`${COLS[c]}${r + 1}${cell ? ` ${cell.l}` : ''}`}
                  className={`relative flex aspect-square items-center justify-center rounded-[3px] ${
                    plain ? (kind ? SQUARE[kind].cls : 'bg-sq-plain') : 'bg-sq-plain'
                  }`}
                >
                  {plain && kind && (
                    <span className="font-semibold opacity-90" style={{ fontSize: '2cqw' }}>
                      {r === 7 && c === 7 ? '★' : SQUARE[kind].label}
                    </span>
                  )}
                  {cell && (
                    <Tile letter={cell.l} blank={cell.b} className={`absolute inset-0 rounded-[3px] ${last.has(key) ? 'ring-2 ring-white' : ''}`} style={{ fontSize: '3.6cqw' }} />
                  )}
                  {p && <Tile letter={p.letter} blank={p.blank} pending className="absolute inset-0 rounded-[3px]" style={{ fontSize: '3.6cqw' }} />}
                  {isBlocked && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-[3px] bg-coral-500/80 font-bold text-white" style={{ fontSize: '3.2cqw' }} title="Blocked">
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

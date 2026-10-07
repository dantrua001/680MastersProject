import Tile from './Tile.jsx';

// `used` holds the rack positions currently placed on the board (shown as empty slots).
// `order`, if given, is a display-only permutation of rack indices (for the Shuffle button) -
// the underlying tile positions used by `used` and `onSelect` never change.
export default function Rack({ rack, used, selected, onSelect, order }) {
  const indices = order && order.length === rack.length ? order : rack.map((_, i) => i);
  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Your rack">
      {indices.map((i) =>
        used.has(i) ? (
          <div key={i} className="h-12 w-12 rounded-md bg-felt-950/70 sm:h-14 sm:w-14" />
        ) : (
          <Tile key={i} letter={rack[i]} selected={selected === i} onClick={() => onSelect(i)} className="h-12 w-12 text-2xl sm:h-14 sm:w-14 sm:text-3xl" title={rack[i] === '?' ? 'Blank tile' : rack[i]} />
        )
      )}
    </div>
  );
}

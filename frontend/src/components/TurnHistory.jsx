import Tile from './Tile.jsx';

function timeLabel(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Renders the structured log as turn cards (player, tiles played, score, time), the way the
// reference game's Turn History panel does. Entries with no tiles (passes, trades, chat-adjacent
// events) fall back to the plain-text message.
export default function TurnHistory({ log, players }) {
  const nameFor = (pid) => players.find((p) => p.id === pid)?.name;
  const entries = [...log].slice(-8).reverse();
  if (entries.length === 0) return <p className="text-sm text-ink-500">No moves yet.</p>;
  return (
    <ul className="space-y-2">
      {entries.map((e, i) => (
        <li key={i} className="rounded-lg bg-felt-900 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>{e.pid ? nameFor(e.pid) : 'Table'}</span>
            <span>{timeLabel(e.t)}</span>
          </div>
          {e.tiles?.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {e.tiles.map((t, j) => <Tile key={j} letter={t.letter} blank={t.blank} className="h-8 w-8 text-base" />)}
              <span className="ml-2 text-sm font-semibold text-birch-400">+{e.score}</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-300">{e.message}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

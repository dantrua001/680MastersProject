import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import useGame from '../useGame.js';
import Tile from '../components/Tile.jsx';
import TopBar from '../components/TopBar.jsx';

// Waiting room: shows the code, who has joined, and lets the host start.
export default function GameRoom() {
  const { code } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { room, state, error, connected } = useGame(code);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state?.status === 'active') nav(`/game/${code}`, { replace: true });
    if (state?.status === 'finished') nav(`/results/${code}`, { replace: true });
  }, [state?.status]);

  const link = `${location.origin}/join/${code}`;
  const isHost = room?.host_id === user.id;
  const count = room?.players.length || 0;
  const start = async () => {
    setErr('');
    try { await api(`/games/${code}/start`, { method: 'POST' }); } catch (e) { setErr(e.message); }
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {error && <p className="text-coral-500" role="alert">{error} <Link to="/lobby" className="underline">Back to the lobby</Link></p>}
        <section className="panel text-center">
          <p className="mb-3 text-ink-300">Share this code to invite players</p>
          <div className="mb-4 flex justify-center gap-2" aria-label={`Game code ${code}`}>
            {code.split('').map((l, i) => <Tile key={i} letter={l} className="h-14 w-14 text-3xl" />)}
          </div>
          <button className="btn btn-ghost" onClick={copy}>{copied ? 'Link copied' : 'Copy invite link'}</button>
        </section>

        <section className="panel">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Players ({count} of {room?.max || 4})</h2>
            <span className="text-xs text-ink-500">{connected ? 'Live' : 'Reconnecting...'}</span>
          </div>
          <ul className="space-y-2">
            {Array.from({ length: room?.max || 4 }, (_, i) => {
              const p = room?.players[i];
              return (
                <li key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${p ? 'bg-felt-700' : 'border border-dashed border-felt-600 text-ink-500'}`}>
                  <span className="tile flex h-7 w-7 items-center justify-center rounded text-sm">{i + 1}</span>
                  {p ? <span>{p.name}{p.id === user.id ? ' (you)' : ''}{p.id === room.host_id ? ', host' : ''}</span> : <span>Waiting for a player</span>}
                </li>
              );
            })}
          </ul>
        </section>

        {err && <p className="text-sm text-coral-500" role="alert">{err}</p>}
        {isHost ? (
          <button className="btn btn-primary w-full py-3 text-base" disabled={count < 2} onClick={start}>
            {count < 2 ? 'Need at least 2 players' : 'Start game'}
          </button>
        ) : (
          <p className="text-center text-ink-300">Waiting for the host to start the game.</p>
        )}
      </main>
    </>
  );
}

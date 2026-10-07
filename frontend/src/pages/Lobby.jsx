import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import TopBar from '../components/TopBar.jsx';
import { routeFor } from '../util.js';

export default function Lobby() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [games, setGames] = useState([]);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api('/games/mine').then(setGames).catch(() => {});
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  const create = async () => {
    setErr('');
    try { nav(`/room/${(await api('/games', { method: 'POST' })).code}`); } catch (e) { setErr(e.message); }
  };
  const join = async (e) => {
    e.preventDefault();
    setErr('');
    try { nav(routeFor(await api('/games/join', { method: 'POST', body: { code } }))); } catch (e2) { setErr(e2.message); }
  };
  const open = games.filter((g) => g.status !== 'finished');

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        {health && !health.dictionary_loaded && (
          <p className="rounded-lg border border-coral-500 bg-coral-500/10 p-3 text-sm">
            Word checking is off, so any word is accepted. Add a word list at backend/app/data/words.txt and restart the server (see the README).
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel">
            <h2 className="mb-1 text-xl font-bold">Start a new game</h2>
            <p className="mb-4 text-sm text-ink-300">You'll get a code to share with 1 to 3 friends.</p>
            <button className="btn btn-primary" onClick={create}>Create game</button>
          </section>
          <section className="panel">
            <h2 className="mb-1 text-xl font-bold">Join with a code</h2>
            <form onSubmit={join} className="mt-3 flex gap-2">
              <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCDE" maxLength={8} aria-label="Game code" />
              <button className="btn btn-primary" disabled={!code.trim()}>Join</button>
            </form>
          </section>
        </div>
        {err && <p className="text-sm text-coral-500" role="alert">{err}</p>}
        <section className="panel">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Pick up where you left off</h2>
            <Link to="/saved" className="text-sm text-birch-400 hover:underline">All saved games</Link>
          </div>
          {open.length === 0 ? (
            <p className="text-ink-300">No games in progress. Create one above.</p>
          ) : (
            <ul className="space-y-2">
              {open.slice(0, 3).map((g) => (
                <li key={g.code} className="flex items-center justify-between rounded-lg bg-felt-900 px-3 py-2">
                  <span>
                    <b>{g.code}</b> with {g.players.join(', ')}
                    {g.my_turn && <span className="ml-2 rounded bg-birch-400 px-2 py-0.5 text-xs font-semibold text-birch-900">Your turn</span>}
                  </span>
                  <Link className="btn btn-ghost" to={routeFor(g)}>Resume</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

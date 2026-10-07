import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import TopBar from '../components/TopBar.jsx';
import { routeFor } from '../util.js';

const LABEL = { waiting: 'Waiting to start', active: 'In progress', finished: 'Finished' };

// Every game is saved automatically after each move, so any unfinished game can be resumed here.
export default function SavedGames() {
  const [games, setGames] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/games/mine').then(setGames).catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl space-y-3 p-4">
        <h1 className="text-2xl font-bold">Saved games</h1>
        {err && <p className="text-coral-500" role="alert">{err}</p>}
        {games && games.length === 0 && (
          <div className="panel">
            <p className="mb-3 text-ink-300">You haven't played any games yet.</p>
            <Link to="/lobby" className="btn btn-primary">Start one from the lobby</Link>
          </div>
        )}
        {games?.map((g) => (
          <article key={g.code} className="panel flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">Game {g.code} <span className="ml-2 text-sm font-normal text-ink-300">{LABEL[g.status]}</span></p>
              <p className="text-sm text-ink-300">
                {g.players.join(', ')}
                {g.round ? `. Round ${g.round}` : ''}
                {g.my_score !== null ? `. Your score: ${g.my_score}` : ''}
              </p>
              <p className="text-xs text-ink-500">
                Saved {new Date(g.updated_at).toLocaleString()}
                {g.status === 'active' && (g.my_turn ? '. It is your turn.' : `. Waiting on ${g.turn}.`)}
              </p>
            </div>
            <Link className={`btn ${g.status === 'finished' ? 'btn-ghost' : 'btn-primary'}`} to={routeFor(g)}>
              {g.status === 'finished' ? 'View results' : 'Resume'}
            </Link>
          </article>
        ))}
      </main>
    </>
  );
}

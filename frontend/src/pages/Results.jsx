import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import TopBar from '../components/TopBar.jsx';

export default function Results() {
  const { code } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/games/${code}/result`).then(setRes).catch((e) => setErr(e.message));
  }, [code]);

  const playAgain = async () => {
    try { nav(`/room/${(await api('/games', { method: 'POST' })).code}`); } catch (e) { setErr(e.message); }
  };

  const winners = res ? res.players.filter((p) => res.winners.includes(p.id)) : [];
  const iWon = res?.winners.includes(user.id);
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {err && <p className="text-coral-500" role="alert">{err}</p>}
        {res && (
          <>
            <section className="panel text-center">
              <h1 className="text-3xl font-extrabold">{iWon ? 'You won!' : `${winners.map((w) => w.name).join(' and ')} won`}</h1>
              <p className="mt-2 text-ink-300">{res.reason} It lasted {res.rounds} round{res.rounds === 1 ? '' : 's'}.</p>
            </section>
            <section className="panel overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-sm text-ink-300">
                  <tr><th className="py-2">Player</th><th>Tiles played</th><th>Unplayed tiles</th><th>Went out</th><th className="text-right">Final</th></tr>
                </thead>
                <tbody>
                  {res.players.map((p) => (
                    <tr key={p.id} className={`border-t border-felt-700 ${res.winners.includes(p.id) ? 'font-bold text-birch-400' : ''}`}>
                      <td className="py-2">{p.name}{p.id === user.id ? ' (you)' : ''}</td>
                      <td>{p.base}</td>
                      <td>{p.leftover ? `-${p.leftover}` : '0'}</td>
                      <td>{p.bonus ? `+${p.bonus}` : '0'}</td>
                      <td className="text-right text-lg tabular-nums">{p.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={playAgain}>Play again</button>
              <Link className="btn btn-ghost flex-1" to="/lobby">Back to lobby</Link>
            </div>
          </>
        )}
      </main>
    </>
  );
}

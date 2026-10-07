import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Tile from '../components/Tile.jsx';

export default function Landing() {
  const { user, loading, login, signup, guest } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const dest = loc.state?.from || '/lobby';
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav(dest, { replace: true }); }, [user]);
  if (loading) return null;

  const run = async (fn) => {
    setErr('');
    setBusy(true);
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const submit = (e) => {
    e.preventDefault();
    run(() => (mode === 'login' ? login : signup)(form.username, form.password));
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 p-6 md:grid-cols-2">
      <section>
        <div className="mb-6 flex gap-2" aria-hidden="true">
          {'SQUAD'.split('').map((l, i) => (
            <Tile key={i} letter={l} className="h-14 w-14 text-3xl sm:h-16 sm:w-16 sm:text-4xl" style={{ transform: `rotate(${[-4, 3, -2, 4, -3][i]}deg)` }} />
          ))}
        </div>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Cooperative Scrabble</h1>
        <p className="mt-4 max-w-md text-lg text-ink-300">
          Play word for word with up to three friends. Every score is your own, but you can help, get in the way, or swap tiles along the way.
        </p>
      </section>

      <section className="panel">
        <div className="mb-4 flex gap-2" role="tablist">
          {[['login', 'Log in'], ['signup', 'Sign up']].map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`btn flex-1 ${mode === m ? 'btn-primary' : 'btn-ghost'}`}>{label}</button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input id="username" className="input" autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          {err && <p className="text-sm text-coral-500" role="alert">{err}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <div className="my-4 border-t border-felt-700" />
        <button className="btn btn-ghost w-full" disabled={busy} onClick={() => run(() => guest(form.username))}>Continue as guest</button>
        <p className="mt-2 text-center text-xs text-ink-500">Guests can play, but can't log back in later.</p>
      </section>
    </main>
  );
}

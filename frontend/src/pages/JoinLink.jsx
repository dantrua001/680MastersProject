import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { routeFor } from '../util.js';

// Opened from an invite link: /join/ABCDE
export default function JoinLink() {
  const { code } = useParams();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/games/join', { method: 'POST', body: { code } })
      .then((g) => nav(routeFor(g), { replace: true }))
      .catch((e) => setErr(e.message));
  }, [code]);
  return (
    <main className="p-8">
      {err ? (
        <>
          <p className="mb-4 text-coral-500" role="alert">{err}</p>
          <Link className="btn btn-ghost" to="/lobby">Back to the lobby</Link>
        </>
      ) : (
        <p className="text-ink-300">Joining game {code}...</p>
      )}
    </main>
  );
}

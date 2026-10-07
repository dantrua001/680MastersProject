import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function TopBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between p-4">
      <Link to="/lobby" className="text-lg font-bold tracking-tight">Cooperative Scrabble</Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-ink-300">{user.username}{user.is_guest ? ' (guest)' : ''}</span>
        <button className="btn btn-ghost" onClick={() => { logout(); nav('/'); }}>Log out</button>
      </div>
    </header>
  );
}

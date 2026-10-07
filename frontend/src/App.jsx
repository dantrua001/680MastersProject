import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Landing from './pages/Landing.jsx';
import Lobby from './pages/Lobby.jsx';
import GameRoom from './pages/GameRoom.jsx';
import GameBoard from './pages/GameBoard.jsx';
import Results from './pages/Results.jsx';
import SavedGames from './pages/SavedGames.jsx';
import JoinLink from './pages/JoinLink.jsx';

function Private({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p className="p-8 text-ink-300">Loading...</p>;
  return user ? children : <Navigate to="/" state={{ from: loc.pathname }} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/lobby" element={<Private><Lobby /></Private>} />
      <Route path="/saved" element={<Private><SavedGames /></Private>} />
      <Route path="/join/:code" element={<Private><JoinLink /></Private>} />
      <Route path="/room/:code" element={<Private><GameRoom /></Private>} />
      <Route path="/game/:code" element={<Private><GameBoard /></Private>} />
      <Route path="/results/:code" element={<Private><Results /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

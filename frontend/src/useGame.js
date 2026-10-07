import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from './api.js';

// The backend the WebSocket talks to directly. Bypassing Vite's dev proxy for WebSockets avoids a
// known conflict between Vite's own HMR socket and a proxied app socket on some Node versions,
// which shows up as "ws proxy socket error: EPIPE" and the connection dropping right after it opens.
// Override with a .env file (VITE_BACKEND_HOST=host:port) if the backend runs somewhere else.
const BACKEND_HOST = import.meta.env.VITE_BACKEND_HOST || `${location.hostname}:8000`;

// One WebSocket per game screen. Reconnects automatically and exposes the latest room/game state.
export default function useGame(code) {
  const [state, setState] = useState(null);
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [assistPlacements, setAssistPlacements] = useState(null);
  const socket = useRef(null);

  useEffect(() => {
    let stopped = false;
    let timer;
    const open = () => {
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${scheme}://${BACKEND_HOST}/ws/games/${code}?token=${encodeURIComponent(getToken() || '')}`);
      socket.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === 'state') setState(m.state);
        else if (m.type === 'room') setRoom(m.room);
        else if (m.type === 'error') setError(m.message);
        else if (m.type === 'preview') setPreview(m);
        else if (m.type === 'placements') setAssistPlacements(m.placements);
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (e.code === 4401 || e.code === 4403) setError("You're not part of this game.");
        else if (!stopped) timer = setTimeout(open, 1500);
      };
    };
    open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [code]);

  const send = useCallback((type, payload = {}) => {
    if (socket.current?.readyState === 1) socket.current.send(JSON.stringify({ type, ...payload }));
  }, []);

  return {
    state, room, connected, error, preview, assistPlacements, send,
    clearError: () => setError(''),
    clearAssist: () => setAssistPlacements(null),
  };
}
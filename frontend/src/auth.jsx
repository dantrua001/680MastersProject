import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const start = async (path, body) => {
    const res = await api(path, { method: 'POST', body });
    setToken(res.token);
    setUser(res.user);
  };

  const value = {
    user,
    loading,
    login: (username, password) => start('/auth/login', { username, password }),
    signup: (username, password) => start('/auth/signup', { username, password }),
    guest: (name) => start('/auth/guest', { name }),
    logout: () => {
      setToken(null);
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

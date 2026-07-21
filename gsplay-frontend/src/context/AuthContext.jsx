import { createContext, useCallback, useEffect, useState } from 'react';
import { authApi } from '../services/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { setUser((await authApi.me()).user); } catch { setUser(null); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (data) => setUser((await authApi.login(data)).user);
  const signup = async (data) => setUser((await authApi.signup(data)).user);
  const logout = async () => { await authApi.logout(); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, refresh, login, signup, logout }}>{children}</AuthContext.Provider>;
}
export { AuthContext };
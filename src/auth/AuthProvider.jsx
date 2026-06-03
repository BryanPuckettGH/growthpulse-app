import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, supabaseConfigured } from '../supabaseClient';

// Real authentication via Supabase. Provides the signed-in user and the
// signup / login / logout actions. Replaces the old demo login.
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthReady(true);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? data.session.user : null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? session.user : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signup = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  }, []);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = { user, authReady, login, signup, logout, configured: supabaseConfigured };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

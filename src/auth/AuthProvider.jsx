import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, supabaseConfigured } from '../supabaseClient';

// Real authentication via Supabase, plus a no-signup demo mode for prospects.
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const DEMO_USER = { id: 'demo', email: 'demo@growthpulse.io' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [demo, setDemo] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthReady(true);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? data.session.user : null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session ? session.user : null);
      // The user arrived from a password-reset email link: show the
      // set-a-new-password screen before anything else.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) setDemo(false);
    return error ? error.message : null;
  }, []);

  // meta carries profile details (first/last name, grower type) into
  // Supabase user metadata so the app can greet people properly.
  const signup = useCallback(async (email, password, meta = {}) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
    if (!error) setDemo(false);
    return error ? error.message : null;
  }, []);

  const logout = useCallback(async () => {
    setDemo(false);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const startDemo = useCallback(() => setDemo(true), []);

  // Sends the password-reset email. The link brings the user back here,
  // where the PASSWORD_RECOVERY event shows the new-password screen.
  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return error ? error.message : null;
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovery(false);
    return error ? error.message : null;
  }, []);

  // Demo mode presents a fixed sandbox user so prospects can explore without signing up.
  const effectiveUser = demo ? DEMO_USER : user;
  const value = {
    user: effectiveUser, isDemo: demo, authReady, login, signup, logout, startDemo,
    recovery, resetPassword, updatePassword, configured: supabaseConfigured,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

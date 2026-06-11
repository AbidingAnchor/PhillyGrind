import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabase.js';

const AuthContext = createContext(null);
const profileFields = 'id,name,email,stripe_account_id,stripe_onboarding_complete,onboarding_complete,tos_agreed_at,created_at';

function withTimeout(promise, milliseconds, timeoutValue) {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = window.setTimeout(() => resolve(timeoutValue), milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function loadProfile(user) {
      if (!user) {
        if (active) setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(profileFields)
        .eq('id', user.id)
        .single();

      if (error) {
        console.warn(error);
        if (active) setProfile({
          id: user.id,
          name: user.user_metadata?.name || 'PhillyGrind user',
          email: user.email,
          onboarding_complete: true,
        });
        return;
      }

      if (active) setProfile(data);
    }

    async function loadInitialSession() {
      try {
        const { data, error, timedOut } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          { data: { session: null }, error: null, timedOut: true },
        );
        if (!active) return;

        if (timedOut) {
          console.warn('Supabase auth getSession timed out after 5 seconds.');
        }

        if (error) {
          console.warn(error);
          setSession(null);
          setProfile(null);
          return;
        }

        const nextSession = data.session;
        setSession(nextSession);
        setLoading(false);
        loadProfile(nextSession?.user);
      } catch (error) {
        console.warn(error);
        if (active) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setLoading(false);

      setTimeout(() => {
        if (!active) return;
        loadProfile(nextSession?.user);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signUp({ name, email, password, tosAgreedAt }) {
    if (!hasSupabaseConfig) {
      throw new Error('Supabase credentials are missing.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, tos_agreed_at: tosAgreedAt },
      },
    });

    if (error) throw error;

    if (data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name,
          email,
          tos_agreed_at: tosAgreedAt,
          onboarding_complete: false,
        });
      } catch (profileError) {
        console.warn('Profile upsert failed during signup:', profileError);
      }
    }

    return data;
  }

  async function signIn({ email, password }) {
    if (!hasSupabaseConfig) {
      throw new Error('Supabase credentials are missing.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!hasSupabaseConfig) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function completeOnboarding() {
    if (!hasSupabaseConfig || !session?.user) return;

    const { data, error } = await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', session.user.id)
      .select(profileFields)
      .single();

    if (error) throw error;
    setProfile(data);
  }

  async function refreshProfile() {
    if (!hasSupabaseConfig || !session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select(profileFields)
      .eq('id', session.user.id)
      .single();

    if (error) throw error;

    setProfile(data);
    return data;
  }

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isLoggedIn: Boolean(session?.user),
    signUp,
    signIn,
    signOut,
    completeOnboarding,
    refreshProfile,
  }), [loading, profile, session]);

  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <section className="page-section"><p className="empty-state">Loading your session...</p></section>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}

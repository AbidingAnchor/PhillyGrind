import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabase.js';
import OnboardingTour from '../components/OnboardingTour.jsx';

const AuthContext = createContext(null);
const profileFields = 'id,name,email,avatar_url,resume_url,resume_path,stripe_account_id,stripe_onboarding_complete,onboarding_complete,tos_agreed_at,two_factor_enabled,identity_verified,verification_status,stripe_identity_session_id,banner_url,profile_tags,accent_color,created_at,role,is_adult_confirmed';

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
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (profile) {
      setLoading(false);
      // Show onboarding tour if not completed
      if (!profile.onboarding_complete) {
        setShowOnboarding(true);
      }
    }
  }, [profile]);

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

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setLoading(false);

      setTimeout(() => {
        if (!active) return;
        loadProfile(nextSession?.user);
      }, 0);

      // Check for suspension/ban immediately after login
      if (event === 'SIGNED_IN' && nextSession?.user) {
        try {
          const { data: suspension, error: suspensionError } = await supabase
            .from('suspended_users')
            .select('*')
            .eq('user_id', nextSession.user.id)
            .is('lifted_at', null)
            .or('expires_at.is.null,expires_at.gt.now()')
            .maybeSingle();

          if (suspension) {
            console.warn('[Auth] User is suspended/banned:', suspension);
            await supabase.auth.signOut();
            const message = suspension.suspension_type === 'ban'
              ? 'Your account has been banned. If you believe this is an error, please contact support.'
              : 'Your account has been suspended. If you believe this is an error, please contact support.';
            alert(message);
            window.location.href = '/login';
          }
        } catch (error) {
          console.error('[Auth] Suspension check failed:', error);
        }
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signUp({ name, email, password, birthdate, tosAgreedAt }) {
    if (!hasSupabaseConfig) {
      throw new Error('Supabase credentials are missing.');
    }

    // Client-side age verification
    function calculateAgeClientSide(birthdateStr) {
      const today = new Date();
      const birthDate = new Date(birthdateStr);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }

    if (birthdate) {
      const age = calculateAgeClientSide(birthdate);
      if (age < 18) {
        throw new Error('PhillyGrind requires users to be 18 or older.');
      }
    }

    // Check IP ban before signup
    const ipCheckResponse = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-ip-ban' }),
    });
    const ipCheckData = await ipCheckResponse.json();
    if (!ipCheckResponse.ok) {
      throw new Error(ipCheckData.error || 'Signup failed');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          name, 
          tos_agreed_at: tosAgreedAt,
          birthdate
        },
      },
    });

    if (error) throw error;

    // Capture IP after successful signup
    if (data.user) {
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'capture-ip', userId: data.user.id }),
        });
      } catch (ipError) {
        console.warn('Failed to capture IP:', ipError);
      }
    }

    // Profile creation is now handled by Postgres trigger on auth.users insert
    // No client-side upsert needed - trigger runs with service role privileges

    return data;
  }

  async function signIn({ email, password }) {
    if (!hasSupabaseConfig) {
      throw new Error('Supabase credentials are missing.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;

    // Capture IP after successful login
    if (data.user) {
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'capture-ip', userId: data.user.id }),
        });
      } catch (ipError) {
        console.warn('Failed to capture IP:', ipError);
      }
    }

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
    isAdmin: profile?.role === 'admin' || profile?.role === 'owner',
    isOwner: profile?.role === 'owner',
  }), [loading, profile, session]);

  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <section className="page-section"><p className="empty-state">Loading your session...</p></section>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showOnboarding && (
        <OnboardingTour
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}

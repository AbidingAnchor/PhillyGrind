import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { persistReferral, isReferralId } from '../lib/referral.js';
import { supabase } from '../lib/supabase.js';

function Join() {
  const { isLoggedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || '';
  const [inviterName, setInviterName] = useState('');

  useEffect(() => {
    persistReferral(ref);
  }, [ref]);

  useEffect(() => {
    if (!isReferralId(ref)) return undefined;
    let cancelled = false;

    supabase
      .from('profiles_public')
      .select('name')
      .eq('id', ref)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const name = String(data?.name || '').trim();
        if (name) setInviterName(name);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [ref]);

  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  const signupTo = isReferralId(ref) ? `/signup?ref=${encodeURIComponent(ref)}` : '/signup';

  return (
    <section className="auth-page">
      <div className="bg-blob"></div>
      <div className="auth-wordmark-wrap">
        <div className="auth-wordmark">Philly<span>Grind</span></div>
        <div className="auth-wordmark-shine" aria-hidden="true">Philly<span>Grind</span></div>
      </div>
      <div className="auth-tagline">
        {inviterName
          ? `${inviterName} invited you to PhillyGrind.`
          : 'A neighbor invited you to PhillyGrind.'}
      </div>
      <p className="join-page-copy">
        Philadelphia&apos;s local jobs, gigs, housing, and neighborhood community. Create an account to join.
      </p>
      <div className="auth-form">
        <Link to={signupTo} className="auth-submit-btn join-page-cta">
          Create an account
        </Link>
      </div>
      <p className="auth-switch-link">Already have an account? <Link to="/login">Login</Link></p>
    </section>
  );
}

export default Join;

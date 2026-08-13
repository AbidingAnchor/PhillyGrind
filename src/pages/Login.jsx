import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import TwoFactorVerification from '../components/TwoFactorVerification.jsx';
import { sendTwoFactorCode } from '../lib/twoFactorApi.js';

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const { signIn, refreshProfile } = useAuth();
  const navigate = useNavigate();

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      const result = await signIn(form);
      
      // Check if user has 2FA enabled
      const profile = await refreshProfile();
      
      if (profile?.two_factor_enabled) {
        setPendingUser(result.user);
        setRequiresTwoFactor(true);
        // Send 2FA code
        await sendTwoFactorCode(profile.email);
        setStatus('');
      } else {
        navigate('/', { replace: true });
      }
    } catch (error) {
      setStatus(error.message || 'Could not log in.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwoFactorVerified() {
    navigate('/', { replace: true });
  }

  function handleTwoFactorCancel() {
    setRequiresTwoFactor(false);
    setPendingUser(null);
    setStatus('Login cancelled.');
  }

  if (requiresTwoFactor && pendingUser) {
    return (
      <section className="auth-page">
        <TwoFactorVerification
          email={pendingUser.email}
          onVerified={handleTwoFactorVerified}
          onCancel={handleTwoFactorCancel}
        />
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="page-heading">
        <span className="eyebrow">Welcome back</span>
        <h1>Login</h1>
        <p>Sign in to post jobs and gigs for the PhillyGrind community.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={updateField} required />
        </label>
        <label>
          Password
          <input name="password" type="password" value={form.password} onChange={updateField} required />
        </label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Login'}
        </button>
        {status && <p className="form-status error-text">{status}</p>}
        <p className="auth-switch">New to PhillyGrind? <Link to="/signup">Create an account</Link></p>
      </form>
    </section>
  );
}

export default Login;

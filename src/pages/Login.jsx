import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import TwoFactorVerification from '../components/TwoFactorVerification.jsx';
import { sendTwoFactorCode } from '../lib/twoFactorApi.js';
import { cancelPendingDeletionRequest } from '../lib/deletionRequestsApi.js';
import { showToast } from '../lib/toast.js';

const DELETION_CANCELLED_MESSAGE = 'Your account deletion request was cancelled since you logged back in.';

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const { signIn, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function nextPath() {
    const from = location.state?.from;
    if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/';
    return from;
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function finishSuccessfulLogin() {
    navigate(nextPath(), { replace: true });

    cancelPendingDeletionRequest()
      .then((cancelled) => {
        if (cancelled) showToast(DELETION_CANCELLED_MESSAGE);
      })
      .catch((cancelError) => {
        console.warn('[Login] Could not cancel pending deletion request', cancelError);
      });
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
        await finishSuccessfulLogin();
      }
    } catch (error) {
      setStatus(error.message || 'Could not log in.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwoFactorVerified() {
    await finishSuccessfulLogin();
  }

  function handleTwoFactorCancel() {
    setRequiresTwoFactor(false);
    setPendingUser(null);
    setStatus('Login cancelled.');
  }

  if (requiresTwoFactor && pendingUser) {
    return (
      <section className="auth-page">
        <div className="bg-blob"></div>
        <div className="auth-wordmark-wrap">
          <div className="auth-wordmark">Philly<span>Grind</span></div>
          <div className="auth-wordmark-shine" aria-hidden="true">Philly<span>Grind</span></div>
        </div>
        <div className="auth-tagline">Enter your verification code</div>
        <div className="auth-form">
          <TwoFactorVerification
            email={pendingUser.email}
            onVerified={handleTwoFactorVerified}
            onCancel={handleTwoFactorCancel}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="bg-blob"></div>
      <div className="auth-wordmark-wrap">
        <div className="auth-wordmark">Philly<span>Grind</span></div>
        <div className="auth-wordmark-shine" aria-hidden="true">Philly<span>Grind</span></div>
      </div>
      <div className="auth-tagline">Sign in to connect with your Philly neighborhood.</div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input 
          className="auth-input" 
          name="email" 
          type="email" 
          value={form.email} 
          onChange={updateField} 
          placeholder="Email"
          required 
        />
        <input 
          className="auth-input" 
          name="password" 
          type="password" 
          value={form.password} 
          onChange={updateField} 
          placeholder="Password"
          required 
        />
        <button className="auth-submit-btn" type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Login'}
        </button>
        {status && <p className="form-status error-text">{status}</p>}
      </form>
      <p className="auth-switch-link">New to PhillyGrind? <Link to="/signup">Create an account</Link></p>
      <p className="auth-switch-link"><Link to="/account-recovery">Recover my account</Link></p>
    </section>
  );
}

export default Login;

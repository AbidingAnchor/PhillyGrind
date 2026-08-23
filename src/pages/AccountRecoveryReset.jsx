import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { completeAccountRecoveryReset } from '../lib/accountRecoveryApi.js';

function AccountRecoveryReset() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (password !== confirm) {
      setStatus('Those passwords do not match.');
      return;
    }
    setSubmitting(true);
    setStatus('');
    try {
      const result = await completeAccountRecoveryReset({ token, password });
      setStatus(result.message);
      setDone(true);
    } catch (error) {
      setStatus(error.message || 'Could not update your password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="bg-blob"></div>
      <div className="auth-wordmark-wrap">
        <div className="auth-wordmark">Philly<span>Grind</span></div>
        <div className="auth-wordmark-shine" aria-hidden="true">Philly<span>Grind</span></div>
      </div>
      <div className="auth-tagline">{done ? 'You are set' : 'Choose a new password'}</div>
      {done ? (
        <div className="auth-form recovery-form">
          <p className="recovery-copy">{status}</p>
          <p className="auth-switch-link"><Link to="/login">Log in</Link></p>
        </div>
      ) : (
        <form className="auth-form recovery-form" onSubmit={handleSubmit}>
          {!token && <p className="form-status error-text">This reset link is missing a token.</p>}
          <input
            className="auth-input"
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            required
          />
          <input
            className="auth-input"
            type="password"
            minLength={6}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Confirm password"
            required
          />
          <button className="auth-submit-btn" type="submit" disabled={submitting || !token}>
            {submitting ? 'Saving…' : 'Save password'}
          </button>
          {status && <p className="form-status error-text">{status}</p>}
        </form>
      )}
    </section>
  );
}

export default AccountRecoveryReset;

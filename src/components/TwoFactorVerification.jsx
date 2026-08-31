import { useState } from 'react';
import { sendTwoFactorCode, verifyTwoFactorCode } from '../lib/twoFactorApi.js';

export default function TwoFactorVerification({ email, onVerified, onCancel }) {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }

    setSending(true);
    setError('');

    try {
      await verifyTwoFactorCode(code);
      onVerified();
    } catch (err) {
      setError(err.message || 'Invalid or expired code.');
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;

    setSending(true);
    setError('');

    try {
      await sendTwoFactorCode(email);
      setResendCooldown(60);
      setError('');
      
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="two-factor-verification">
      <h1>Two-Factor Authentication</h1>
      <p className="auth-subtitle">We sent a 6-digit verification code to <strong>{email}</strong></p>
      <p className="detail-note">Enter the code below to complete your login. The code expires in 5 minutes.</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-input-group">
          <label>Verification Code</label>
          <input
            className="auth-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            autoFocus
          />
        </div>

        <button type="submit" className="auth-submit-btn" disabled={sending || code.length !== 6}>
          {sending ? 'Verifying...' : 'Verify'}
        </button>

        {error && <p className="error-text">{error}</p>}

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="auth-switch-link">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || sending}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--green)', fontWeight: '600', cursor: resendCooldown > 0 || sending ? 'not-allowed' : 'pointer' }}
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>

        <div className="auth-switch-link">
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', padding: 0, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

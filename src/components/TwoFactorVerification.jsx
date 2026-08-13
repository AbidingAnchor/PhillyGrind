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
      <h2>Two-Factor Authentication</h2>
      <p>We sent a 6-digit verification code to <strong>{email}</strong></p>
      <p className="detail-note">Enter the code below to complete your login. The code expires in 5 minutes.</p>

      <form onSubmit={handleSubmit} className="two-factor-form">
        <div className="two-factor-code-input">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            autoFocus
          />
          <button type="submit" className="primary-button" disabled={sending || code.length !== 6}>
            {sending ? 'Verifying...' : 'Verify'}
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="two-factor-resend">
          <button
            type="button"
            className="text-link"
            onClick={handleResend}
            disabled={resendCooldown > 0 || sending}
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>

        <button type="button" className="text-link" onClick={onCancel}>
          Cancel
        </button>
      </form>
    </div>
  );
}

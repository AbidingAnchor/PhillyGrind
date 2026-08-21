import { useEffect, useState } from 'react';
import { CreditCard, Shield, BadgeCheck, Palette, User, Bell, FileText } from 'lucide-react';
import { sendTwoFactorCode, toggleTwoFactorAuth, verifyTwoFactorCode } from '../lib/twoFactorApi.js';
import { createConnectAccount } from '../lib/ordersApi.js';
import { getResumeUrl, uploadResume, removeResume } from '../lib/profileApi.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import SettingsToggle from '../components/SettingsToggle.jsx';

function resumeFilename(path) {
  if (!path) return '';
  const parts = path.split('/');
  return parts[parts.length - 1] || 'resume.pdf';
}

function getProfileResumePath(profile) {
  return profile?.resume_url || profile?.resume_path || '';
}

function Settings() {
  const { user, isLoggedIn, profile: authProfile, refreshProfile } = useAuth();
  const [connectingPayouts, setConnectingPayouts] = useState(false);
  const [resumeUrl, setResumeUrl] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState('idle');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSending, setTwoFactorSending] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [isLandlord, setIsLandlord] = useState(false);
  const [housingListings, setHousingListings] = useState([]);
  const [showAvailableNow, setShowAvailableNow] = useState(false);

  const hasStripeAccount = Boolean(authProfile?.stripe_account_id);
  const payoutsConnected = Boolean(hasStripeAccount && authProfile?.stripe_onboarding_complete);

  useEffect(() => {
    if (!authProfile) return;

    setTwoFactorEnabled(authProfile.two_factor_enabled || false);
    setShowAvailableNow(authProfile.show_available_now || false);
    const resumeStoragePath = getProfileResumePath(authProfile);
    if (resumeStoragePath) {
      getResumeUrl(resumeStoragePath).then(setResumeUrl).catch(console.warn);
    }
  }, [authProfile]);

  useEffect(() => {
    async function loadHousingData() {
      try {
        const housingData = await supabase
          .from('housing_listings')
          .select('*')
          .eq('user_id', user?.id)
          .eq('status', 'active');
        setHousingListings(housingData.data || []);
        setIsLandlord((housingData.data || []).length > 0);
      } catch (err) {
        console.warn('Failed to load housing data:', err);
      }
    }

    if (user?.id) {
      loadHousingData();
    }
  }, [user?.id]);

  function resetTwoFactorFlow() {
    setTwoFactorStep('idle');
    setTwoFactorCode('');
    setTwoFactorError('');
  }

  async function handleSendTwoFactorCode() {
    setTwoFactorSending(true);
    setTwoFactorError('');

    try {
      await sendTwoFactorCode(authProfile.email);
      setTwoFactorStep('verify');
    } catch (err) {
      setTwoFactorError(err.message || 'Failed to send verification code.');
    } finally {
      setTwoFactorSending(false);
    }
  }

  async function handleVerifyTwoFactorCode() {
    setTwoFactorSending(true);
    setTwoFactorError('');

    try {
      await verifyTwoFactorCode(twoFactorCode);
      setTwoFactorStep('confirm');
    } catch (err) {
      setTwoFactorError(err.message || 'Invalid or expired code.');
    } finally {
      setTwoFactorSending(false);
    }
  }

  async function handleToggleTwoFactor() {
    setTwoFactorSending(true);
    setTwoFactorError('');

    try {
      await toggleTwoFactorAuth(!twoFactorEnabled, twoFactorCode);
      setTwoFactorEnabled(!twoFactorEnabled);
      setTwoFactorStep('idle');
      setTwoFactorCode('');
      setProfileStatus(`Two-factor authentication ${!twoFactorEnabled ? 'enabled' : 'disabled'}.`);
      await refreshProfile();
    } catch (err) {
      setTwoFactorError(err.message || 'Failed to update 2FA settings.');
    } finally {
      setTwoFactorSending(false);
    }
  }

  async function handleConnectPayouts() {
    setConnectingPayouts(true);
    setProfileStatus('');

    try {
      const { url } = await createConnectAccount();
      window.location.href = url;
    } catch (err) {
      setProfileStatus(err.message || 'Could not start Stripe onboarding.');
      setConnectingPayouts(false);
    }
  }

  async function handleResumeUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setProfileStatus('');

    try {
      const nextProfile = await uploadResume(file);
      const nextUrl = await getResumeUrl(getProfileResumePath(nextProfile));
      setResumeUrl(nextUrl);
      setProfileStatus('Resume uploaded.');
      await refreshProfile();
    } catch (err) {
      setProfileStatus(err.message || 'Could not upload resume.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleToggleAvailableNow() {
    setProfileStatus('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ show_available_now: !showAvailableNow })
        .eq('id', user.id);

      if (error) throw error;

      setShowAvailableNow(!showAvailableNow);
      setProfileStatus(`Available Now badge ${!showAvailableNow ? 'enabled' : 'disabled'}.`);
      await refreshProfile();
    } catch (err) {
      setProfileStatus(err.message || 'Could not update availability settings.');
    }
  }

  async function handleRemoveResume() {
    if (!confirm('Are you sure you want to remove your resume? This action cannot be undone.')) {
      return;
    }

    setProfileStatus('');
    try {
      await removeResume();
      setResumeUrl('');
      setProfileStatus('Resume removed successfully.');
      await refreshProfile();
    } catch (err) {
      setProfileStatus(err.message || 'Could not remove resume.');
    }
  }

  if (!isLoggedIn) {
    return <p className="empty-state">Please log in to view settings.</p>;
  }

  return (
    <section className="settings-page">
      <h1>Settings</h1>
      {profileStatus && <p className="form-status">{profileStatus}</p>}

      <section className={`settings-row-card${payoutsConnected ? ' is-connected' : ''}`}>
        <div className="settings-row-content">
          <div className="settings-row-left">
            <div className="section-icon-wrapper">
              <CreditCard size={20} />
            </div>
            <div className="settings-row-text">
              <span className="eyebrow">Stripe Express</span>
              <h2>{payoutsConnected ? 'Payouts connected' : hasStripeAccount ? 'Finish payout setup' : 'Set up payouts to receive payments'}</h2>
              <p className="settings-row-description">
                {payoutsConnected
                  ? 'You can receive secure escrow payouts for gigs and marketplace sales through Stripe Express.'
                  : hasStripeAccount
                    ? 'Finish Stripe Express onboarding so buyers and hirers can pay into escrow and PhillyGrind can release payouts to you.'
                    : 'Connect Stripe Express to accept Secure Checkout on marketplace listings and escrow payments on gigs.'}
              </p>
            </div>
          </div>
          {payoutsConnected ? (
            <span className="settings-status-chip settings-status-chip--success">Payouts connected ✓</span>
          ) : (
            <button className="primary-button" type="button" onClick={handleConnectPayouts} disabled={connectingPayouts}>
              {connectingPayouts ? 'Connecting...' : hasStripeAccount ? 'Finish Stripe' : 'Connect Stripe'}
            </button>
          )}
        </div>
      </section>

      <section className="settings-row-card">
        <div className="settings-row-content">
          <div className="settings-row-left">
            <div className="section-icon-wrapper">
              <Shield size={20} />
            </div>
            <div className="settings-row-text">
              <span className="eyebrow">Security</span>
              <h2>Two-Factor Authentication</h2>
              <p className="settings-row-description">
                {twoFactorEnabled
                  ? 'Two-factor authentication is enabled. You will need to enter a verification code sent to your email when logging in.'
                  : 'Add an extra layer of security to your account by requiring a verification code when logging in.'}
              </p>
            </div>
          </div>
          {twoFactorStep === 'idle' && (
            <SettingsToggle
              checked={twoFactorEnabled}
              disabled={twoFactorSending}
              onChange={() => (twoFactorEnabled ? handleToggleTwoFactor() : handleSendTwoFactorCode())}
              ariaLabel={twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
            />
          )}
        </div>
        {twoFactorStep !== 'idle' && (
          <div className="settings-expanded-content">
            {twoFactorStep === 'verify' && (
              <div className="two-factor-verify">
                <p>We sent a 6-digit code to <strong>{authProfile.email}</strong>. Enter it below to confirm you want to enable 2FA.</p>
                <div className="two-factor-code-input">
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                  />
                  <button className="primary-button" type="button" onClick={handleVerifyTwoFactorCode} disabled={twoFactorSending || twoFactorCode.length !== 6}>
                    {twoFactorSending ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                <button className="settings-ghost-button" type="button" onClick={resetTwoFactorFlow}>Cancel</button>
                {twoFactorError && <p className="error-text">{twoFactorError}</p>}
              </div>
            )}
            {twoFactorStep === 'confirm' && (
              <div className="two-factor-confirm">
                <p>Verification successful! Click below to complete enabling two-factor authentication.</p>
                <button className="primary-button" type="button" onClick={handleToggleTwoFactor} disabled={twoFactorSending}>
                  {twoFactorSending ? 'Enabling...' : 'Confirm Enable 2FA'}
                </button>
                <button className="settings-ghost-button" type="button" onClick={resetTwoFactorFlow}>Cancel</button>
              </div>
            )}
          </div>
        )}
        {twoFactorError && twoFactorStep === 'idle' && <p className="error-text">{twoFactorError}</p>}
      </section>

      <section className="settings-row-card">
        <div className="settings-row-content">
          <div className="settings-row-left">
            <div className="section-icon-wrapper">
              <BadgeCheck size={20} />
            </div>
            <div className="settings-row-text">
              <span className="eyebrow">Identity Verification</span>
              <h2>Verified Badge</h2>
              <p className="settings-row-description">
                {authProfile?.identity_verified
                  ? 'Your identity has been verified. Your profile and listings display a verified badge to build trust with the PhillyGrind community.'
                  : authProfile?.verification_status === 'pending'
                    ? 'Your identity verification is being processed. This typically takes a few minutes.'
                    : isLandlord
                      ? 'Get a blue verified badge on your profile and Housing listings by verifying your identity with Stripe Identity.'
                      : 'Identity verification is currently available for landlords who have posted Housing listings.'}
              </p>
            </div>
          </div>
          {authProfile?.identity_verified ? (
            <span className="settings-status-chip settings-status-chip--verified">✓ Verified</span>
          ) : authProfile?.verification_status === 'pending' ? (
            <span className="settings-status-chip settings-status-chip--pending">Pending</span>
          ) : isLandlord ? (
            <button className="primary-button" type="button" onClick={async () => {
              try {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const response = await fetch('/api/stripe?action=create-verification-checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (response.ok) {
                  window.location.href = data.url;
                } else {
                  setProfileStatus(data.error || 'Failed to start verification');
                }
              } catch (err) {
                setProfileStatus('Failed to start verification');
              }
            }}>
              Get Verified ($2)
            </button>
          ) : (
            <span className="settings-status-chip">Coming Soon</span>
          )}
        </div>
      </section>

      <section className="settings-row-card">
        <div className="settings-row-content">
          <div className="settings-row-left">
            <div className="section-icon-wrapper">
              <Palette size={20} />
            </div>
            <div className="settings-row-text">
              <span className="eyebrow">Appearance</span>
              <h2>Theme</h2>
              <p className="settings-row-description">Switch between light and dark mode to match your preference.</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="settings-row-card">
        <div className="settings-row-content">
          <div className="settings-row-left">
            <div className="section-icon-wrapper">
              <User size={20} />
            </div>
            <div className="settings-row-text">
              <span className="eyebrow">Profile</span>
              <h2>Available Now Badge</h2>
              <p className="settings-row-description">
                {showAvailableNow
                  ? 'The "Available Now" badge is shown on your profile when your availability is set to "Available Now".'
                  : 'Show the "Available Now" badge on your profile when your availability is set to "Available Now".'}
              </p>
            </div>
          </div>
          <SettingsToggle
            checked={showAvailableNow}
            onChange={handleToggleAvailableNow}
            ariaLabel={showAvailableNow ? 'Disable Badge' : 'Enable Badge'}
          />
        </div>
      </section>

      <section className="settings-row-card">
        <div className="settings-row-content">
          <div className="settings-row-left">
            <div className="section-icon-wrapper">
              <Bell size={20} />
            </div>
            <div className="settings-row-text">
              <span className="eyebrow">Notifications</span>
              <h2>Notification Bell</h2>
              <p className="settings-row-description">View your notifications for messages, reactions, and other activity using the bell icon in the top navigation.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-row-card">
        <div className="settings-row-content">
          <div className="settings-row-left">
            <div className="section-icon-wrapper">
              <FileText size={20} />
            </div>
            <div className="settings-row-text">
              <span className="eyebrow">Career</span>
              <h2>Resume</h2>
              <p className="settings-row-description">
                {getProfileResumePath(authProfile)
                  ? `Uploaded: ${resumeFilename(getProfileResumePath(authProfile))}`
                  : 'Upload a PDF or Word resume to use Quick Apply on job listings.'}
              </p>
            </div>
          </div>
          {getProfileResumePath(authProfile) ? (
            <div className="resume-upload-actions">
              {resumeUrl && (
                <a className="settings-ghost-button" href={resumeUrl} target="_blank" rel="noreferrer">
                  View
                </a>
              )}
              <label className="primary-button resume-replace-button">
                Replace
                <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} hidden />
              </label>
              <button className="settings-danger-outline" type="button" onClick={handleRemoveResume}>
                Remove
              </button>
            </div>
          ) : (
            <label className="primary-button resume-upload-button">
              Upload Resume
              <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} hidden />
            </label>
          )}
        </div>
      </section>
    </section>
  );
}

export default Settings;

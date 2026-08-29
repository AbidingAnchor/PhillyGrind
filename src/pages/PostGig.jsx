import { useState } from 'react';
import { HandHelping, Wrench } from 'lucide-react';
import ListingForm from '../components/ListingForm.jsx';
import { gigCategories } from '../data/listings.js';
import { createConnectAccount } from '../lib/ordersApi.js';
import { useAuth } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';

const gigModes = {
  offering: {
    eyebrow: 'Offer a service',
    title: "I'm offering a service",
    description: 'I want to get hired',
    labels: {
      title: 'What service are you offering?',
      titlePlaceholder: 'Furniture assembly, house cleaning, delivery help...',
      pay: 'Your rate',
      payPlaceholder: '$45/hr or $150 flat',
      description: 'Describe what you do',
      descriptionPlaceholder: 'Share your experience, availability, tools, service area, and what clients should expect.',
    },
  },
  seeking: {
    eyebrow: 'Get help',
    title: 'I need help with something',
    description: "I'm looking to hire someone",
    labels: {
      title: 'What do you need help with?',
      titlePlaceholder: 'Move a couch, deep clean, fix a sink...',
      pay: 'Your budget',
      payPlaceholder: '$80 flat or $25/hr',
      description: 'Describe what you need',
      descriptionPlaceholder: 'Explain the task, timing, location, budget, and any details workers should know.',
    },
  },
};

function tokenPreview(token) {
  if (!token) return null;
  return `${token.slice(0, 12)}...${token.slice(-8)}`;
}

const gigModeIcons = {
  offering: Wrench,
  seeking: HandHelping,
};

function PostGig() {
  const [postType, setPostType] = useState('');
  const [payoutStatus, setPayoutStatus] = useState('');
  const [connectingPayouts, setConnectingPayouts] = useState(false);
  const { profile, session } = useAuth();
  const selectedMode = gigModes[postType];
  const payoutReady = Boolean(profile?.stripe_account_id && profile?.stripe_onboarding_complete);

  async function handleSetUpPayouts() {
    setPayoutStatus('');
    setConnectingPayouts(true);

    try {
      const { data, error } = await supabase.auth.getSession();
      const freshSession = data?.session;

      console.log('Stripe payout getSession debug', {
        getSessionError: error?.message || null,
        hasContextSession: Boolean(session),
        contextUserId: session?.user?.id || null,
        hasFreshSession: Boolean(freshSession),
        freshUserId: freshSession?.user?.id || null,
        hasAccessToken: Boolean(freshSession?.access_token),
        tokenLength: freshSession?.access_token?.length || 0,
        tokenPreview: tokenPreview(freshSession?.access_token),
        expiresAt: freshSession?.expires_at || null,
      });

      if (error || !freshSession?.access_token) {
        throw new Error('Please log in before setting up payouts.');
      }

      const { url } = await createConnectAccount(freshSession.access_token);
      window.location.href = url;
    } catch (error) {
      setPayoutStatus(error.message || 'Could not start Stripe Express onboarding.');
      setConnectingPayouts(false);
    }
  }

  return (
    <section className="form-page">
      <div className="page-heading">
        <span className="eyebrow">Need help?</span>
        <h1>Post a Gig</h1>
        <p>Share one-time tasks and get matched with someone nearby who can help.</p>
      </div>
      {!postType && (
        <div className="gig-type-grid">
          {Object.entries(gigModes).map(([value, mode]) => {
            const Icon = gigModeIcons[value];

            return (
              <button key={value} className="gig-type-card" type="button" onClick={() => setPostType(value)}>
                <div className="gig-type-card-icon" aria-hidden="true">
                  <Icon size={26} strokeWidth={2} />
                </div>
                <span className="group-create-category gig-type-card-label">{mode.eyebrow}</span>
                <h2>{mode.title}</h2>
                <p>{mode.description}</p>
              </button>
            );
          })}
        </div>
      )}
      {postType && (
        <>
          <button className="text-link gig-type-back" type="button" onClick={() => setPostType('')}>
            Change gig type
          </button>
          {postType === 'offering' && (
            <div className="payment-panel payout-setup-card">
              <div>
                <span className="eyebrow">Stripe Express payouts</span>
                <h2>Get paid automatically</h2>
                <p className="detail-note">
                  Set up payouts so hirers can order your gig, pay into escrow, and Stripe can send your earnings to your bank when work is released.
                </p>
              </div>
              {payoutReady ? (
                <span className="payout-ready-badge">Payouts connected</span>
              ) : (
                <button className="primary-button" type="button" onClick={handleSetUpPayouts} disabled={connectingPayouts}>
                  {connectingPayouts ? 'Opening Stripe...' : profile?.stripe_account_id ? 'Finish payout setup' : 'Set up payouts'}
                </button>
              )}
              {payoutStatus && <p className="form-status error-text">{payoutStatus}</p>}
            </div>
          )}
          <ListingForm type="gig" categories={gigCategories} postType={postType} labels={selectedMode.labels} />
        </>
      )}
    </section>
  );
}

export default PostGig;

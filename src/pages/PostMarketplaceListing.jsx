import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MarketplacePostForm from '../components/MarketplacePostForm.jsx';
import { createConnectAccount } from '../lib/ordersApi.js';
import { useAuth } from '../lib/auth.jsx';

function PostMarketplaceListing() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [payoutStatus, setPayoutStatus] = useState('');
  const [connectingPayouts, setConnectingPayouts] = useState(false);
  const payoutReady = Boolean(profile?.stripe_account_id && profile?.stripe_onboarding_complete);

  function handlePosted(created) {
    navigate(`/marketplace/${created.id}`);
  }

  function handleClose() {
    navigate('/marketplace');
  }

  async function handleSetUpPayouts() {
    setPayoutStatus('');
    setConnectingPayouts(true);

    try {
      const { url } = await createConnectAccount();
      window.location.href = url;
    } catch (error) {
      setPayoutStatus(error.message || 'Could not start Stripe Express onboarding.');
      setConnectingPayouts(false);
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">Marketplace</span>
        <h1>Post a Listing</h1>
        <p>Sell to neighbors across Philadelphia.</p>
      </div>

      <div className="payment-panel payout-setup-card marketplace-payout-card">
        <div>
          <span className="eyebrow">Stripe Express payouts</span>
          <h2>Get paid via Secure Checkout</h2>
          <p className="detail-note">
            Connect Stripe so buyers can pay into escrow. Funds release to you when the buyer confirms receipt or after the 2-hour window.
          </p>
        </div>
        {payoutReady ? (
          <span className="payout-ready-badge">Payouts connected ✓</span>
        ) : (
          <button className="primary-button" type="button" onClick={handleSetUpPayouts} disabled={connectingPayouts}>
            {connectingPayouts ? 'Opening Stripe...' : profile?.stripe_account_id ? 'Finish Stripe Setup' : 'Connect Stripe'}
          </button>
        )}
        {payoutStatus && <p className="form-status error-text">{payoutStatus}</p>}
      </div>

      <div className="form-container">
        <MarketplacePostForm onClose={handleClose} onPosted={handlePosted} />
      </div>
    </section>
  );
}

export default PostMarketplaceListing;

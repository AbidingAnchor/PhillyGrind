import { useMemo, useState } from 'react';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { X } from 'lucide-react';
import { createPaymentIntent } from '../lib/ordersApi.js';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

function formatMoney(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function PaymentForm({ listing, initialAmount, acceptedBid, isMarketplace, onClose, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState(initialAmount || 5000);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fee = useMemo(() => Math.round(Number(amount || 0) * 0.08), [amount]);
  const workerReceives = Math.max(0, Number(amount || 0) - fee);
  const workerStripeReady = acceptedBid
    ? Boolean(acceptedBid.workerStripeAccountId && acceptedBid.workerStripeOnboardingComplete)
    : Boolean(listing.workerStripeAccountId && listing.workerStripeOnboardingComplete);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements) return;
    if (!workerStripeReady) {
      setStatus('The worker must finish Stripe Express onboarding before escrow can be funded.');
      return;
    }

    setSubmitting(true);
    setStatus('');

    try {
      const { clientSecret, order } = await createPaymentIntent({
        listingId: listing.id,
        amount: Number(amount),
        acceptedBidId: acceptedBid?.id,
      });

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setStatus('Payment authorized and held in escrow.');
      onPaid?.({ ...order, status: 'escrowed' });
      setTimeout(onClose, 900);
    } catch (error) {
      setStatus(error.message || 'Could not confirm payment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <label>
        Payment amount
        <input
          type="number"
          min="1"
          step="1"
          value={Math.round(amount / 100)}
          onChange={(event) => setAmount(Math.round(Number(event.target.value || 0) * 100))}
          disabled={Boolean(acceptedBid) || isMarketplace}
        />
      </label>
      <div className="payment-breakdown">
        <span>Total charged <strong>{formatMoney(amount)}</strong></span>
        <span>PhillyGrind fee (8%) <strong>{formatMoney(fee)}</strong></span>
        <span>{isMarketplace ? 'Seller' : 'Worker'} receives <strong>{formatMoney(workerReceives)}</strong></span>
      </div>
      <div className="card-element-wrap">
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      {!workerStripeReady && (
        <p className="form-status error-text">
          The {isMarketplace ? 'seller' : 'worker'} must finish Stripe Express onboarding before escrow can be funded.
        </p>
      )}
      {status && <p className="form-status">{status}</p>}
      <button className="primary-button" type="submit" disabled={!stripe || submitting || amount <= 0 || !workerStripeReady}>
        {submitting ? 'Authorizing...' : 'Confirm Payment Into Escrow'}
      </button>
    </form>
  );
}

function PaymentModal({ listing, initialAmount, acceptedBid, isMarketplace, onClose, onPaid }) {
  return (
    <div className="chat-backdrop" role="presentation">
      <section className="payment-modal" role="dialog" aria-modal="true" aria-label="Order this gig">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Stripe Escrow</span>
            <h2>{acceptedBid ? 'Fund Accepted Bid' : isMarketplace ? 'Purchase This Item' : 'Order This Gig'}</h2>
            <p>{acceptedBid ? `${acceptedBid.workerName} - ${listing?.title || 'Listing'}` : listing?.title || 'Listing'}</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close payment modal">
            <X size={20} />
          </button>
        </header>
        {!stripePromise && <p className="chat-status">Missing VITE_STRIPE_PUBLISHABLE_KEY.</p>}
        {stripePromise && (
          <Elements stripe={stripePromise}>
            <PaymentForm listing={listing} initialAmount={initialAmount} acceptedBid={acceptedBid} isMarketplace={isMarketplace} onClose={onClose} onPaid={onPaid} />
          </Elements>
        )}
      </section>
    </div>
  );
}

export default PaymentModal;

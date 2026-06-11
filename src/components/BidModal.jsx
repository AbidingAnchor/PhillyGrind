import { useState } from 'react';
import { X } from 'lucide-react';
import { submitBid } from '../lib/bidsApi.js';

function BidModal({ listing, onClose, onBidSubmitted }) {
  const [form, setForm] = useState({ pitch: '' });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      const bid = await submitBid({
        listingId: listing.id,
        pitch: form.pitch.trim(),
      });
      onBidSubmitted?.(bid);
      setStatus('Bid submitted.');
      setTimeout(onClose, 700);
    } catch (error) {
      setStatus(error.message || 'Could not submit your bid.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="chat-backdrop" role="presentation">
      <section className="payment-modal" role="dialog" aria-modal="true" aria-label="Submit a bid">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Gig bid</span>
            <h2>Submit a Bid</h2>
            <p>{listing.title}</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close bid modal">
            <X size={20} />
          </button>
        </header>
        <form className="payment-form" onSubmit={handleSubmit}>
          <label>
            Why are you the right person for this job?
            <textarea
              name="pitch"
              value={form.pitch}
              onChange={updateField}
              rows="6"
              placeholder="Share your experience, timing, tools, and how you'll handle the work."
              required
            />
          </label>
          {status && <p className="form-status">{status}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Bid'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default BidModal;

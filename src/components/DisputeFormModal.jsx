import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { openDispute, submitSellerEvidence, uploadDisputePhoto } from '../lib/marketplaceOrdersApi.js';

export default function DisputeFormModal({ orderId, mode = 'buyer', onClose, onComplete }) {
  const isBuyer = mode === 'buyer';
  const inputRef = useRef(null);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!description.trim()) {
      setError('Please describe the issue.');
      return;
    }
    if (!file) {
      setError('An evidence photo is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const kind = isBuyer ? 'buyer-dispute' : 'seller-evidence';
      const photoPath = await uploadDisputePhoto(orderId, file, kind);
      const result = isBuyer
        ? await openDispute(orderId, description.trim(), photoPath)
        : await submitSellerEvidence(orderId, description.trim(), photoPath);
      onComplete(result);
    } catch (err) {
      setError(err.message || 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="chat-backdrop" role="presentation">
      <section className="edit-modal dispute-modal" role="dialog" aria-modal="true" aria-label={isBuyer ? 'Open dispute' : 'Submit evidence'}>
        <header className="chat-header">
          <div>
            <span className="eyebrow">{isBuyer ? 'Open Dispute' : 'Submit Evidence'}</span>
            <h2>{isBuyer ? 'Describe the Issue' : 'Your Side of the Story'}</h2>
            <p>
              {isBuyer
                ? 'Explain what went wrong and upload photo evidence. The seller will not see your submission until admin review.'
                : 'You have 24 hours to submit your evidence. The buyer will not see your submission until admin review.'}
            </p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close" disabled={submitting}>
            <X size={20} />
          </button>
        </header>

        <form className="listing-form" onSubmit={handleSubmit}>
          <label className="full-span">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              placeholder={isBuyer ? 'What is wrong with the item or transaction?' : 'Describe your version of events...'}
            />
          </label>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {preview ? (
            <div className="handoff-preview full-span">
              <img src={preview} alt="Evidence preview" />
              <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
                Change Photo
              </button>
            </div>
          ) : (
            <button type="button" className="handoff-upload-btn full-span" onClick={() => inputRef.current?.click()}>
              <Camera size={28} />
              <span>Upload Evidence Photo</span>
              <small>Required</small>
            </button>
          )}

          {error && <p className="form-status error-text full-span">{error}</p>}

          <button className="primary-button full-span" type="submit" disabled={submitting || !file || !description.trim()}>
            {submitting ? (
              <>
                <Loader2 size={18} className="spin" />
                Submitting...
              </>
            ) : (
              isBuyer ? 'Open Dispute' : 'Submit Evidence'
            )}
          </button>
        </form>
      </section>
    </div>
  );
}

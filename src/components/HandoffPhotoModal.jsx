import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { markHandoff, uploadDisputePhoto } from '../lib/marketplaceOrdersApi.js';

export default function HandoffPhotoModal({ orderId, onClose, onComplete }) {
  const inputRef = useRef(null);
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
    if (!file) {
      setError('A handoff photo is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const photoPath = await uploadDisputePhoto(orderId, file, 'handoff');
      const { order } = await markHandoff(orderId, photoPath);
      onComplete(order);
    } catch (err) {
      setError(err.message || 'Could not mark as handed off.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="chat-backdrop" role="presentation">
      <section className="edit-modal handoff-modal" role="dialog" aria-modal="true" aria-label="Mark as handed off">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Handoff Confirmation</span>
            <h2>Mark as Handed Off</h2>
            <p>Upload a photo of the item at the meetup location. This photo is required.</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close" disabled={submitting}>
            <X size={20} />
          </button>
        </header>

        <form className="listing-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {preview ? (
            <div className="handoff-preview">
              <img src={preview} alt="Handoff preview" />
              <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
                Retake Photo
              </button>
            </div>
          ) : (
            <button type="button" className="handoff-upload-btn full-span" onClick={() => inputRef.current?.click()}>
              <Camera size={32} />
              <span>Take or Upload Handoff Photo</span>
              <small>Required — cannot skip</small>
            </button>
          )}

          {error && <p className="form-status error-text">{error}</p>}

          <button className="primary-button full-span" type="submit" disabled={submitting || !file}>
            {submitting ? (
              <>
                <Loader2 size={18} className="spin" />
                Uploading &amp; analyzing...
              </>
            ) : (
              'Confirm Handoff'
            )}
          </button>
        </form>
      </section>
    </div>
  );
}

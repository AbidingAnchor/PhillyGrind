import { Trash2, X } from 'lucide-react';

function DeleteAccountModal({ submitting, error, onCancel, onConfirm }) {
  return (
    <div className="chat-backdrop" role="presentation" onClick={submitting ? undefined : onCancel}>
      <section
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="confirm-header">
          <div>
            <span className="eyebrow">Account</span>
            <h2 id="delete-account-title">Delete your account?</h2>
          </div>
          <button type="button" className="chat-close" onClick={onCancel} aria-label="Close confirmation" disabled={submitting}>
            <X size={20} />
          </button>
        </header>
        <p>
          This submits a deletion request. We process requests within 14 days, then delete your profile, account, and personal information. Moderation logs and dispute records tied to your account may be kept for up to 90 days for legal compliance and fraud prevention. You will be signed out immediately.
        </p>
        {error && <p className="error-text">{error}</p>}
        <div className="confirm-actions">
          <button className="secondary-detail-button" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={submitting}>
            <Trash2 size={18} />
            {submitting ? 'Submitting...' : 'Delete Account'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DeleteAccountModal;

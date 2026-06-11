import { Trash2, X } from 'lucide-react';

function DeleteConfirmModal({ deleting, onCancel, onConfirm }) {
  return (
    <div className="chat-backdrop" role="presentation">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm listing deletion">
        <header className="confirm-header">
          <div>
            <span className="eyebrow">Delete listing</span>
            <h2>Are you sure?</h2>
          </div>
          <button type="button" className="chat-close" onClick={onCancel} aria-label="Close confirmation" disabled={deleting}>
            <X size={20} />
          </button>
        </header>
        <p>Are you sure you want to delete this listing? This cannot be undone.</p>
        <div className="confirm-actions">
          <button className="secondary-detail-button" type="button" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={deleting}>
            <Trash2 size={18} />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DeleteConfirmModal;

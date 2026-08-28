import { createPortal } from 'react-dom';
import { Copy, Mail, MessageCircle, Share2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { getInviteLink, getInviteShareText } from '../lib/referral.js';

function InviteNeighborSheet({ userId, onClose }) {
  const [status, setStatus] = useState('');
  const link = getInviteLink(userId);
  const shareText = getInviteShareText(userId);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Invite link copied.');
    } catch {
      setStatus('Could not copy the link.');
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: 'PhillyGrind',
        text: shareText,
        url: link,
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      await handleCopy();
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card invite-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="invite-sheet-title"
      >
        <div className="modal-header">
          <h3 id="invite-sheet-title">Invite a neighbor</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="invite-sheet-body">
          <p className="invite-sheet-copy">
            Share PhillyGrind with someone you know. When they join with your link, it stays tied to you.
          </p>
          <div className="invite-sheet-link-row">
            <input className="invite-sheet-link" value={link} readOnly aria-label="Invite link" />
            <button type="button" className="invite-sheet-copy-btn" onClick={handleCopy}>
              <Copy size={16} />
              Copy
            </button>
          </div>
          <div className="invite-sheet-actions">
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button type="button" className="invite-sheet-action" onClick={handleNativeShare}>
                <Share2 size={16} />
                Share
              </button>
            )}
            <a className="invite-sheet-action" href={`sms:?body=${encodeURIComponent(shareText)}`}>
              <MessageCircle size={16} />
              Text message
            </a>
            <a
              className="invite-sheet-action"
              href={`mailto:?subject=${encodeURIComponent('Join me on PhillyGrind')}&body=${encodeURIComponent(shareText)}`}
            >
              <Mail size={16} />
              Email
            </a>
          </div>
          {status && <p className="form-status">{status}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function InviteNeighborButton({ userId, className = '', label = 'Invite a neighbor', iconOnly = false }) {
  const [open, setOpen] = useState(false);
  if (!userId) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Invite a neighbor"
        title="Invite a neighbor"
      >
        <UserPlus size={iconOnly ? 18 : 16} />
        {!iconOnly && label}
      </button>
      {open && <InviteNeighborSheet userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}

export default InviteNeighborSheet;

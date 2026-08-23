import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  adminReportAction,
  approveAdminRecovery,
  denyAdminRecovery,
} from '../../lib/adminApi.js';
import {
  deleteContact,
  resolveContact,
  sendContactReply,
} from '../../lib/contactApi.js';
import { resolveDispute } from '../../lib/marketplaceOrdersApi.js';

const REPORT_TYPES = new Set(['listing_report', 'user_report', 'community_report']);

export default function CaseActionBar({ caseRecord, onResolved, onDeleted }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warnMessage, setWarnMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');

  const isReport = REPORT_TYPES.has(caseRecord.type);
  const isPendingReport = isReport && caseRecord.status === 'pending';
  const isPendingRecovery = caseRecord.type === 'recovery' && caseRecord.status === 'pending';
  const isOpenContact = caseRecord.type === 'contact' && caseRecord.status !== 'resolved';
  const isOpenDispute = caseRecord.type === 'dispute' && caseRecord.status === 'open';

  async function run(action, fn) {
    setBusy(action);
    setError('');
    try {
      await fn();
      await onResolved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  if (!isPendingReport && !isPendingRecovery && !isOpenContact && !isOpenDispute) {
    return (
      <footer className="admin-case-action-bar admin-case-action-bar--resolved">
        <p>This case is <strong>{caseRecord.status}</strong>. No further actions available.</p>
      </footer>
    );
  }

  return (
    <footer className="admin-case-action-bar">
      {isPendingReport && caseRecord.type === 'user_report' && (
        <label className="admin-case-warn-field">
          Warning message (optional — defaults to report reason)
          <textarea
            value={warnMessage}
            onChange={(event) => setWarnMessage(event.target.value)}
            rows={2}
            placeholder="Message sent to the reported user if you choose Warn"
          />
        </label>
      )}

      {isOpenContact && (
        <label className="admin-case-warn-field">
          Reply to submitter
          <textarea
            value={replyMessage}
            onChange={(event) => setReplyMessage(event.target.value)}
            rows={3}
            placeholder="Write a reply (sends email and marks as responded)"
          />
        </label>
      )}

      {error && <p className="form-status error-text">{error}</p>}

      <div className="admin-case-action-buttons">
        {isPendingReport && (
          <>
            <button
              type="button"
              className="admin-moderation-btn dismiss"
              disabled={!!busy}
              onClick={() => run('dismiss', () => adminReportAction(caseRecord.id, 'dismiss'))}
            >
              {busy === 'dismiss' ? <Loader2 size={14} className="spin" /> : 'Dismiss'}
            </button>
            <button
              type="button"
              className="admin-moderation-btn warn"
              disabled={!!busy}
              onClick={() => run('warn', () => adminReportAction(caseRecord.id, 'warn', warnMessage.trim() || undefined))}
            >
              {busy === 'warn' ? <Loader2 size={14} className="spin" /> : 'Warn'}
            </button>
            <button
              type="button"
              className="admin-moderation-btn delete"
              disabled={!!busy}
              onClick={() => run('remove', () => adminReportAction(caseRecord.id, 'remove'))}
            >
              {busy === 'remove' ? <Loader2 size={14} className="spin" /> : 'Remove content'}
            </button>
          </>
        )}

        {isPendingRecovery && (
          <>
            <button
              type="button"
              className="admin-moderation-btn warn"
              disabled={!!busy}
              onClick={() => run('approve', () => approveAdminRecovery(caseRecord.id))}
            >
              {busy === 'approve' ? <Loader2 size={14} className="spin" /> : 'Approve recovery'}
            </button>
            <button
              type="button"
              className="admin-moderation-btn delete"
              disabled={!!busy}
              onClick={() => run('deny', () => denyAdminRecovery(caseRecord.id))}
            >
              {busy === 'deny' ? <Loader2 size={14} className="spin" /> : 'Deny'}
            </button>
          </>
        )}

        {isOpenContact && (
          <>
            <button
              type="button"
              className="admin-moderation-btn warn"
              disabled={!!busy || !replyMessage.trim()}
              onClick={() => run('reply', () => sendContactReply(caseRecord.id, replyMessage))}
            >
              {busy === 'reply' ? <Loader2 size={14} className="spin" /> : 'Send reply'}
            </button>
            <button
              type="button"
              className="admin-moderation-btn dismiss"
              disabled={!!busy}
              onClick={() => run('resolve', () => resolveContact(caseRecord.id))}
            >
              {busy === 'resolve' ? <Loader2 size={14} className="spin" /> : 'Resolve'}
            </button>
            <button
              type="button"
              className="admin-moderation-btn delete"
              disabled={!!busy}
              onClick={async () => {
                setBusy('delete');
                setError('');
                try {
                  await deleteContact(caseRecord.id);
                  onDeleted?.();
                } catch (err) {
                  setError(err.message);
                  setBusy('');
                }
              }}
            >
              {busy === 'delete' ? <Loader2 size={14} className="spin" /> : 'Delete'}
            </button>
          </>
        )}

        {isOpenDispute && (
          <>
            <button
              type="button"
              className="admin-resolve-btn release"
              disabled={!!busy}
              onClick={() => run('released_to_seller', () => resolveDispute(caseRecord.id, 'released_to_seller'))}
            >
              {busy === 'released_to_seller' ? <Loader2 size={14} className="spin" /> : 'Release to seller'}
            </button>
            <button
              type="button"
              className="admin-resolve-btn refund"
              disabled={!!busy}
              onClick={() => run('refunded_to_buyer', () => resolveDispute(caseRecord.id, 'refunded_to_buyer'))}
            >
              {busy === 'refunded_to_buyer' ? <Loader2 size={14} className="spin" /> : 'Refund to buyer'}
            </button>
          </>
        )}
      </div>
    </footer>
  );
}

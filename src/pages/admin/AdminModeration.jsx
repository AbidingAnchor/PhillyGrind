import { useEffect, useState } from 'react';
import { ShieldAlert, Loader2, Check, X, UserX, RefreshCw } from 'lucide-react';
import { getModerationLogs, markModerationLogReviewed, clearAgeConcern, confirmMinorUser } from '../../lib/adminApi.js';

export default function AdminModeration() {
  const [logs, setLogs] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewedFilter, setReviewedFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  async function loadLogs() {
    try {
      setLoading(true);
      const { logs: data } = await getModerationLogs({ 
        category: categoryFilter, 
        status: statusFilter,
        reviewed: reviewedFilter
      });
      setLogs(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [categoryFilter, statusFilter, reviewedFilter]);

  async function handleMarkReviewed(logId) {
    setActingId(logId);
    setError('');
    try {
      await markModerationLogReviewed(logId);
      await loadLogs();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId('');
    }
  }

  async function handleClearAgeConcern(log) {
    setActingId(log.id);
    setError('');
    try {
      await clearAgeConcern(log.user_id, log.content_id, log.content_type);
      await markModerationLogReviewed(log.id);
      await loadLogs();
      setConfirmAction(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId('');
    }
  }

  async function handleConfirmMinor(log) {
    setActingId(log.id);
    setError('');
    try {
      await confirmMinorUser(log.user_id, log.content_id, log.content_type);
      await markModerationLogReviewed(log.id);
      await loadLogs();
      setConfirmAction(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId('');
    }
  }

  function requestConfirmAction(action, log) {
    setConfirmAction({ action, log });
  }

  function cancelConfirmAction() {
    setConfirmAction(null);
  }

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'housing', label: 'Housing' },
    { value: 'marketplace', label: 'Marketplace' },
    { value: 'jobs', label: 'Jobs' },
    { value: 'gigs', label: 'Gigs' },
    { value: 'community', label: 'Community' },
    { value: 'age_concern', label: 'Age Concern' },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'auto_rejected', label: 'Auto Rejected' },
    { value: 'flagged_for_review', label: 'Flagged for Review' },
  ];

  const reviewedOptions = [
    { value: 'all', label: 'All Review Status' },
    { value: 'unreviewed', label: 'Unreviewed' },
    { value: 'reviewed', label: 'Reviewed' },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <ShieldAlert size={28} />
        <div>
          <h1>Moderation Logs</h1>
          <p>AI moderation audit log and review queue</p>
        </div>
      </header>

      <div className="profile-section-card admin-filters">
        <label>
          Category
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label>
          Review Status
          <select value={reviewedFilter} onChange={(event) => setReviewedFilter(event.target.value)}>
            {reviewedOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="empty-state">Loading moderation logs...</p>}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && logs.length === 0 && (
        <p className="empty-state">No moderation logs found.</p>
      )}

      {!loading && logs.length > 0 && (
        <div className="profile-section-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Rule</th>
                <th>Status</th>
                <th>User ID</th>
                <th>Flagged Phrases</th>
                <th>Explanation</th>
                <th>Content Preview</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const busy = actingId === log.id;
                const canMarkReviewed = log.status === 'flagged_for_review' && !log.reviewed;
                const isAgeConcern = log.category === 'age_concern';
                return (
                  <tr key={log.id} className={isAgeConcern ? 'admin-age-concern-row' : ''}>
                    <td className="admin-category-cell">
                      <span className={`admin-category-badge ${isAgeConcern ? 'age-concern' : ''}`}>
                        {log.category === 'age_concern' ? 'Age Concern' : log.category}
                      </span>
                    </td>
                    <td>{log.rule_name}</td>
                    <td>
                      <span className={`admin-status-badge ${log.status === 'auto_rejected' ? 'danger' : 'warning'}`}>
                        {log.status === 'auto_rejected' ? 'Auto Rejected' : 'Flagged for Review'}
                      </span>
                    </td>
                    <td className="admin-user-cell">
                      <span className="admin-user-email">{log.user_id?.substring(0, 8)}...</span>
                    </td>
                    <td>
                      <div className="admin-phrases-list">
                        {log.flagged_phrases?.length > 0 ? (
                          log.flagged_phrases.map((phrase, idx) => (
                            <span key={idx} className="admin-phrase-tag">{phrase}</span>
                          ))
                        ) : (
                          <span className="admin-empty-text">None</span>
                        )}
                      </div>
                    </td>
                    <td className="admin-explanation-cell">{log.explanation || '-'}</td>
                    <td className="admin-preview-cell">{log.content_preview || '-'}</td>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td className="admin-table-actions">
                      {isAgeConcern && canMarkReviewed && (
                        <div className="admin-age-actions">
                          <button
                            type="button"
                            className="admin-table-btn admin-clear-btn"
                            disabled={busy}
                            onClick={() => requestConfirmAction('clear', log)}
                            title="Clear - restore content and mark as reviewed"
                          >
                            {busy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                          </button>
                          <button
                            type="button"
                            className="admin-table-btn admin-confirm-minor-btn"
                            disabled={busy}
                            onClick={() => requestConfirmAction('confirm_minor', log)}
                            title="Confirm Minor - suspend account and delete data"
                          >
                            {busy ? <Loader2 size={14} className="spin" /> : <UserX size={14} />}
                          </button>
                        </div>
                      )}
                      {!isAgeConcern && canMarkReviewed && (
                        <button
                          type="button"
                          className="admin-table-btn"
                          disabled={busy}
                          onClick={() => handleMarkReviewed(log.id)}
                          title="Mark as reviewed"
                        >
                          {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                        </button>
                      )}
                      {log.reviewed && (
                        <span className="admin-reviewed-badge">Reviewed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmAction && (
        <div className="admin-confirm-modal">
          <div className="admin-confirm-content">
            <h3>
              {confirmAction.action === 'clear' ? 'Clear Age Concern' : 'Confirm Minor User'}
            </h3>
            <p>
              {confirmAction.action === 'clear' 
                ? 'This will restore the hidden content and mark the age concern as cleared. Are you sure?'
                : 'This will suspend the account, delete all personal data (bio, photos, profile info), and log the action as a confirmed COPPA minor. This action cannot be undone. Are you sure?'
              }
            </p>
            <div className="admin-confirm-actions">
              <button
                type="button"
                className="admin-confirm-cancel"
                onClick={cancelConfirmAction}
                disabled={actingId === confirmAction.log.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`admin-confirm-confirm ${confirmAction.action === 'confirm_minor' ? 'danger' : ''}`}
                onClick={() => {
                  if (confirmAction.action === 'clear') {
                    handleClearAgeConcern(confirmAction.log);
                  } else {
                    handleConfirmMinor(confirmAction.log);
                  }
                }}
                disabled={actingId === confirmAction.log.id}
              >
                {actingId === confirmAction.log.id ? (
                  <Loader2 size={16} className="spin" />
                ) : confirmAction.action === 'clear' ? (
                  'Clear'
                ) : (
                  'Confirm Minor'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

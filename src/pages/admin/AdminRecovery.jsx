import { useEffect, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { approveAdminRecovery, denyAdminRecovery, getAdminRecoveryRequests } from '../../lib/adminApi.js';
import { useAdminCounts } from '../../components/AdminLayout.jsx';
import Skeleton from '../../components/Skeleton.jsx';

function formatValue(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') {
    if (value.month || value.year) return `${value.month || '??'}/${value.year || '????'}`;
    return JSON.stringify(value);
  }
  return String(value);
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function SnapshotList({ title, items }) {
  return (
    <div className="recovery-snapshot-block">
      <strong>{title}</strong>
      {items.length === 0 ? (
        <p className="recovery-snapshot-empty">None</p>
      ) : (
        <ul className="recovery-snapshot-list">
          {items.map((item) => (
            <li key={item.key}>
              <span className="recovery-snapshot-date">{item.date}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminRecovery() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');
  const { loadCounts } = useAdminCounts();

  async function load() {
    try {
      setLoading(true);
      const data = await getAdminRecoveryRequests();
      setRequests(data.requests ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAction(id, action) {
    setActingId(id);
    setError('');
    try {
      if (action === 'approve') await approveAdminRecovery(id);
      else await denyAdminRecovery(id);
      await load();
      await loadCounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <KeyRound size={28} />
        <div>
          <h1>Account recovery</h1>
          <p>Compare what they submitted with the frozen account snapshot. Approve emails a one-time reset to the new address only.</p>
        </div>
      </header>

      {loading && <Skeleton variant="list" />}
      {error && <p className="form-status error-text">{error}</p>}
      {!loading && requests.length === 0 && (
        <p className="empty-state">No pending recovery requests.</p>
      )}

      <div className="admin-report-list">
        {requests.map((request) => {
          const snapshot = request.snapshot || {};
          const profile = snapshot.profile || {};
          const busy = actingId === request.id;
          return (
            <article key={request.id} className="report-card recovery-admin-card">
              <div className="recovery-admin-meta">
                <strong>{profile.name || 'Unknown name'}</strong>
                <span>{profile.email || '—'}</span>
                <span>{profile.account_reference || '—'}</span>
                <span>Claimed as: {request.identifier_raw}</span>
                <span>New email: {request.new_email}</span>
                <span>Submitted {formatDate(request.created_at)} · IP {request.requester_ip || '—'}</span>
              </div>
              <div className="recovery-compare">
                <div>
                  <h3>On the account</h3>
                  <p><strong>Created:</strong> {formatDate(profile.created_at)}</p>
                  <p><strong>Neighborhoods:</strong> {formatValue(snapshot.neighborhoods)}</p>
                  <p><strong>Current name:</strong> {profile.name || '—'}</p>
                  <SnapshotList
                    title="Name history"
                    items={(snapshot.name_history || []).map((row, index) => ({
                      key: `${row.old_name}-${row.new_name}-${row.changed_at}-${index}`,
                      date: formatDate(row.changed_at),
                      text: `${row.old_name} → ${row.new_name}`,
                    }))}
                  />
                  <SnapshotList
                    title="Recent posts"
                    items={(snapshot.posts || []).map((row) => ({
                      key: row.id,
                      date: formatDate(row.created_at),
                      text: row.content || '—',
                    }))}
                  />
                  <SnapshotList
                    title="Recent comments"
                    items={(snapshot.comments || []).map((row) => ({
                      key: row.id,
                      date: formatDate(row.created_at),
                      text: row.content || '—',
                    }))}
                  />
                  <SnapshotList
                    title="Listings (job / gig / marketplace)"
                    items={(snapshot.listings || []).map((row) => ({
                      key: `${row.type}-${row.id}`,
                      date: formatDate(row.created_at),
                      text: `${row.type}: ${row.title}`,
                    }))}
                  />
                </div>
                <div>
                  <h3>They submitted</h3>
                  {(request.questions_asked || []).map((question) => (
                    <p key={question.id}>
                      <strong>{question.prompt}</strong>
                      <br />
                      {formatValue(request.answers?.[question.id])}
                    </p>
                  ))}
                </div>
              </div>
              <div className="admin-table-actions">
                <button
                  type="button"
                  className="admin-moderation-btn warn"
                  disabled={busy}
                  onClick={() => handleAction(request.id, 'approve')}
                >
                  {busy ? <Loader2 size={16} className="spin" /> : null}
                  Approve
                </button>
                <button
                  type="button"
                  className="admin-moderation-btn delete"
                  disabled={busy}
                  onClick={() => handleAction(request.id, 'deny')}
                >
                  Deny
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

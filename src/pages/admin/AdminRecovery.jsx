import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, ChevronRight, Clock } from 'lucide-react';
import { getAdminRecoveryRequests } from '../../lib/adminApi.js';
import Skeleton from '../../components/Skeleton.jsx';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminRecovery() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <KeyRound size={28} />
        <div>
          <h1>Account recovery</h1>
          <p>Pending recovery claims — open a case to compare answers against the frozen snapshot.</p>
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
          return (
            <Link
              key={request.id}
              to={`/admin/cases/recovery/${request.id}`}
              className="report-card admin-report-link recovery-admin-card"
              data-status={request.status}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="report-status-badge" data-status={request.status}>
                  {request.status}
                </span>
              </div>
              <div className="recovery-admin-meta">
                <strong>{profile.name || 'Unknown name'}</strong>
                <span>{profile.email || '—'}</span>
                <span>{profile.account_reference || '—'}</span>
                <span>Claimed as: {request.identifier_raw}</span>
                <span>New email: {request.new_email}</span>
              </div>
              <div className="report-meta">
                <div className="report-meta-item">
                  <Clock size={14} />
                  <span>{formatDate(request.created_at)} · IP {request.requester_ip || '—'}</span>
                </div>
              </div>
              <span className="admin-report-open">
                Open case <ChevronRight size={16} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

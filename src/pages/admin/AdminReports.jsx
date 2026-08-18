import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, User, Clock } from 'lucide-react';
import { adminReportAction, getAdminReports } from '../../lib/adminApi.js';
import { useAdminCounts } from '../../components/AdminLayout.jsx';

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');
  const { loadCounts } = useAdminCounts();

  async function loadReports() {
    try {
      setLoading(true);
      const { reports: data } = await getAdminReports(statusFilter);
      setReports(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  async function handleAction(reportId, action) {
    setActingId(reportId);
    setError('');
    try {
      await adminReportAction(reportId, action);
      await loadReports();
      await loadCounts(); // Refetch badge counts
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <ClipboardList size={28} />
        <div>
          <h1>Reports Queue</h1>
          <p>Flagged listings, reported users, and auto-moderation flags</p>
        </div>
      </header>

      <div className="profile-section-card admin-filters">
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="pending">Pending</option>
            <option value="dismissed">Dismissed</option>
            <option value="warned">Warned</option>
            <option value="removed">Removed</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {loading && <p className="empty-state">Loading reports...</p>}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && reports.length === 0 && (
        <p className="empty-state">No reports in this queue.</p>
      )}

      <div className="admin-report-list">
        {reports.map((report) => {
          const busy = actingId === report.id;
          return (
            <article key={report.id} className="report-card" data-status={report.status}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="report-status-badge" data-status={report.status}>
                  {report.status}
                </span>
                <span className="report-type-tag">{report.reported_type}</span>
                {report.source && (
                  <span className="report-type-tag">· {report.source}</span>
                )}
              </div>
              <div className="report-reason">{report.reason}</div>
              <div className="report-content-quote">
                {report.subjectTitle}
              </div>
              <div className="report-meta">
                <div className="report-meta-item">
                  <User size={14} />
                  <span>{report.reporterName}</span>
                </div>
                <div className="report-meta-item">
                  <Clock size={14} />
                  <span>{new Date(report.created_at).toLocaleString()}</span>
                </div>
              </div>
              {report.status === 'pending' && (
                <div className="report-actions">
                  <button
                    type="button"
                    className="btn-report-dismiss"
                    disabled={busy}
                    onClick={() => handleAction(report.id, 'dismiss')}
                  >
                    {busy ? <Loader2 size={14} className="spin" /> : 'Dismiss'}
                  </button>
                  <button
                    type="button"
                    className="btn-report-warn"
                    disabled={busy}
                    onClick={() => handleAction(report.id, 'warn')}
                  >
                    Warn
                  </button>
                  <button
                    type="button"
                    className="btn-report-remove"
                    disabled={busy}
                    onClick={() => handleAction(report.id, 'remove')}
                  >
                    Remove
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

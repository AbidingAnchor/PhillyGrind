import { useEffect, useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import { adminReportAction, getAdminReports } from '../../lib/adminApi.js';

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');

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
            <article key={report.id} className="profile-section-card admin-report-card">
              <div className="admin-report-top">
                <span className={`admin-status-badge ${report.status === 'pending' ? 'open' : 'active'}`}>
                  {report.status}
                </span>
                <span className="admin-activity-type">{report.reported_type} · {report.source}</span>
              </div>
              <h3>{report.subjectTitle}</h3>
              <p>{report.reason}</p>
              <div className="admin-report-meta">
                <span>Reporter: {report.reporterName}</span>
                <span>{new Date(report.created_at).toLocaleString()}</span>
              </div>
              {report.status === 'pending' && (
                <div className="admin-table-actions">
                  <button
                    type="button"
                    className="admin-table-btn"
                    disabled={busy}
                    onClick={() => handleAction(report.id, 'dismiss')}
                  >
                    {busy ? <Loader2 size={14} className="spin" /> : null}
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="admin-table-btn warn"
                    disabled={busy}
                    onClick={() => handleAction(report.id, 'warn')}
                  >
                    Warn
                  </button>
                  <button
                    type="button"
                    className="admin-table-btn danger"
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

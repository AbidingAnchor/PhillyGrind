import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, User, ChevronRight } from 'lucide-react';
import { getAdminReports, reportCaseType } from '../../lib/adminApi.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <ClipboardList size={28} />
        <div>
          <h1>Reports Queue</h1>
          <p>Flagged listings, reported users, and community reports — open a case to review and act.</p>
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

      {loading && <Skeleton variant="list" />}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && reports.length === 0 && (
        <p className="empty-state">No reports in this queue.</p>
      )}

      <div className="admin-report-list">
        {reports.map((report) => {
          const caseType = reportCaseType(report);
          return (
            <Link
              key={report.id}
              to={`/admin/cases/${caseType}/${report.id}`}
              className="report-card admin-report-link"
              data-status={report.status}
            >
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

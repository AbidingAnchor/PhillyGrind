import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Clock, Mail, ChevronRight } from 'lucide-react';
import { getContactSubmissions } from '../../lib/contactApi.js';
import Skeleton from '../../components/Skeleton.jsx';

const categoryLabels = {
  general: 'General',
  data_deletion: 'Data Deletion',
  fair_housing_complaint: 'Fair Housing Complaint',
  dispute_report: 'Dispute Report',
  other: 'Other',
};

const statusLabels = {
  open: 'Open',
  new: 'Open',
  responded: 'Responded',
  in_progress: 'Responded',
  resolved: 'Resolved',
};

export default function AdminContact() {
  const [submissions, setSubmissions] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadSubmissions() {
    try {
      setLoading(true);
      const { submissions: data } = await getContactSubmissions({
        category: categoryFilter,
        status: statusFilter,
      });
      setSubmissions(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubmissions();
  }, [categoryFilter, statusFilter]);

  const filteredSubmissions = submissions.filter((submission) => {
    const query = searchQuery.toLowerCase();
    return (
      submission.name?.toLowerCase().includes(query)
      || submission.email?.toLowerCase().includes(query)
      || submission.message?.toLowerCase().includes(query)
    );
  });

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General' },
    { value: 'data_deletion', label: 'Data Deletion' },
    { value: 'fair_housing_complaint', label: 'Fair Housing Complaint' },
    { value: 'dispute_report', label: 'Dispute Report' },
    { value: 'other', label: 'Other' },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'open', label: 'Open' },
    { value: 'responded', label: 'Responded' },
    { value: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <MessageSquare size={28} />
        <div>
          <h1>Contact Submissions</h1>
          <p>User inquiries and support requests — open a case to reply or resolve.</p>
        </div>
      </header>

      <div className="profile-section-card admin-filters">
        <label>
          Search submissions
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, email, or message..."
          />
        </label>
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
      </div>

      {loading && <Skeleton variant="list" />}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && submissions.length === 0 && (
        <p className="empty-state">No contact submissions found.</p>
      )}

      {!loading && submissions.length > 0 && (
        <div className="admin-report-list">
          {filteredSubmissions.map((submission) => (
            <Link
              key={submission.id}
              to={`/admin/cases/contact/${submission.id}`}
              className="report-card admin-report-link"
              data-status={submission.status}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="report-status-badge" data-status={submission.status}>
                  {statusLabels[submission.status] || submission.status}
                </span>
                <span className="report-type-tag">{categoryLabels[submission.category] || submission.category}</span>
              </div>
              <div className="report-reason">{submission.name}</div>
              <div className="report-content-quote">{submission.message}</div>
              <div className="report-meta">
                <div className="report-meta-item">
                  <Mail size={14} />
                  <span>{submission.email}</span>
                </div>
                <div className="report-meta-item">
                  <Clock size={14} />
                  <span>{new Date(submission.created_at).toLocaleString()}</span>
                </div>
              </div>
              <span className="admin-report-open">
                Open case <ChevronRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

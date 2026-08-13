import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, Check, AlertCircle } from 'lucide-react';
import { getContactSubmissions, updateContactSubmissionStatus } from '../../lib/contactApi.js';

export default function AdminContact() {
  const [submissions, setSubmissions] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');

  async function loadSubmissions() {
    try {
      setLoading(true);
      const { submissions: data } = await getContactSubmissions({ 
        category: categoryFilter, 
        status: statusFilter
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

  async function handleUpdateStatus(id, status) {
    setActingId(id);
    setError('');
    try {
      await updateContactSubmissionStatus(id, status);
      await loadSubmissions();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId('');
    }
  }

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
    { value: 'new', label: 'New' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
  ];

  const categoryLabels = {
    general: 'General',
    data_deletion: 'Data Deletion',
    fair_housing_complaint: 'Fair Housing Complaint',
    dispute_report: 'Dispute Report',
    other: 'Other',
  };

  const statusLabels = {
    new: 'New',
    in_progress: 'In Progress',
    resolved: 'Resolved',
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <MessageSquare size={28} />
        <div>
          <h1>Contact Submissions</h1>
          <p>User inquiries and support requests</p>
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
      </div>

      {loading && <p className="empty-state">Loading contact submissions...</p>}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && submissions.length === 0 && (
        <p className="empty-state">No contact submissions found.</p>
      )}

      {!loading && submissions.length > 0 && (
        <div className="profile-section-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Name</th>
                <th>Email</th>
                <th>Message</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const busy = actingId === submission.id;
                return (
                  <tr key={submission.id}>
                    <td className="admin-category-cell">
                      <span className="admin-category-badge">{categoryLabels[submission.category] || submission.category}</span>
                    </td>
                    <td>{submission.name}</td>
                    <td>
                      <a href={`mailto:${submission.email}`} className="admin-email-link">{submission.email}</a>
                    </td>
                    <td className="admin-message-cell">{submission.message}</td>
                    <td>
                      <span className={`admin-status-badge ${submission.status === 'new' ? 'danger' : submission.status === 'in_progress' ? 'warning' : 'active'}`}>
                        {statusLabels[submission.status] || submission.status}
                      </span>
                    </td>
                    <td>{new Date(submission.created_at).toLocaleString()}</td>
                    <td className="admin-table-actions">
                      {submission.status === 'new' && (
                        <button
                          type="button"
                          className="admin-table-btn"
                          disabled={busy}
                          onClick={() => handleUpdateStatus(submission.id, 'in_progress')}
                          title="Mark as In Progress"
                        >
                          {busy ? <Loader2 size={14} className="spin" /> : <AlertCircle size={14} />}
                        </button>
                      )}
                      {submission.status === 'in_progress' && (
                        <button
                          type="button"
                          className="admin-table-btn"
                          disabled={busy}
                          onClick={() => handleUpdateStatus(submission.id, 'resolved')}
                          title="Mark as Resolved"
                        >
                          {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                        </button>
                      )}
                      {submission.status === 'resolved' && (
                        <span className="admin-reviewed-badge">Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

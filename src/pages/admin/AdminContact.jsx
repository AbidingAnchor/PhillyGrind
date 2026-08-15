import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, Check, AlertCircle } from 'lucide-react';
import { getContactSubmissions, updateContactSubmissionStatus } from '../../lib/contactApi.js';
import AdminDetailModal from '../../components/AdminDetailModal.jsx';

export default function AdminContact() {
  const [submissions, setSubmissions] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);

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

  const filteredSubmissions = submissions.filter(submission => {
    const query = searchQuery.toLowerCase();
    return (
      submission.name?.toLowerCase().includes(query) ||
      submission.email?.toLowerCase().includes(query) ||
      submission.message?.toLowerCase().includes(query)
    );
  });

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
              {filteredSubmissions.map((submission) => {
                const busy = actingId === submission.id;
                return (
                  <tr 
                    key={submission.id}
                    onClick={() => setSelectedSubmission(submission)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="admin-category-cell">
                      <span className="admin-category-badge">{categoryLabels[submission.category] || submission.category}</span>
                    </td>
                    <td>{submission.name}</td>
                    <td>
                      <a href={`mailto:${submission.email}`} className="admin-email-link" onClick={(e) => e.stopPropagation()}>{submission.email}</a>
                    </td>
                    <td className="admin-message-cell">{submission.message}</td>
                    <td>
                      <span className={`admin-status-badge ${submission.status === 'new' ? 'danger' : submission.status === 'in_progress' ? 'warning' : 'active'}`}>
                        {statusLabels[submission.status] || submission.status}
                      </span>
                    </td>
                    <td>{new Date(submission.created_at).toLocaleString()}</td>
                    <td className="admin-table-actions" onClick={(e) => e.stopPropagation()}>
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

      <AdminDetailModal
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        title="Contact Submission Details"
      >
        {selectedSubmission && (
          <>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Category</span>
              <span className="admin-detail-value">{categoryLabels[selectedSubmission.category] || selectedSubmission.category}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Name</span>
              <span className="admin-detail-value">{selectedSubmission.name}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Email</span>
              <span className="admin-detail-value">
                <a href={`mailto:${selectedSubmission.email}`}>{selectedSubmission.email}</a>
              </span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Status</span>
              <span className="admin-detail-value">{statusLabels[selectedSubmission.status] || selectedSubmission.status}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Created</span>
              <span className="admin-detail-value">{new Date(selectedSubmission.created_at).toLocaleString()}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Message</span>
              <span className="admin-detail-value">{selectedSubmission.message}</span>
            </div>
          </>
        )}
      </AdminDetailModal>
    </div>
  );
}

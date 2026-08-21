import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, Check, AlertCircle, User, Clock, Mail, Reply, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { 
  getContactSubmissions, 
  sendContactReply, 
  resolveContact, 
  deleteContact,
  getContactReplies 
} from '../../lib/contactApi.js';
import { useAdminCounts } from '../../components/AdminLayout.jsx';
import Skeleton from '../../components/Skeleton.jsx';

export default function AdminContact() {
  const [submissions, setSubmissions] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [repliesMap, setRepliesMap] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedSubmissions, setExpandedSubmissions] = useState(new Set());
  const { loadCounts } = useAdminCounts();

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

  async function handleReply(submission) {
    setSelectedSubmission(submission);
    setShowReplyModal(true);
  }

  async function handleSubmitReply(e) {
    e.preventDefault();
    if (!selectedSubmission || !replyMessage.trim()) return;
    
    setSubmittingReply(true);
    try {
      await sendContactReply(selectedSubmission.id, replyMessage);
      setReplyMessage('');
      setShowReplyModal(false);
      await loadSubmissions();
      await loadCounts(); // Refetch badge counts
      
      // Reload replies for this submission
      const replies = await getContactReplies(selectedSubmission.id);
      setRepliesMap(prev => ({ ...prev, [selectedSubmission.id]: replies }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleResolve(id) {
    setActingId(id);
    setError('');
    try {
      await resolveContact(id);
      await loadSubmissions();
      await loadCounts(); // Refetch badge counts
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId('');
    }
  }

  async function handleDelete(id) {
    console.log('[ContactDelete] confirm clicked for', id);
    setActingId(id);
    setError('');
    try {
      await deleteContact(id);
      await loadSubmissions();
      await loadCounts(); // Refetch badge counts
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('[ContactDelete] failed:', err);
      setError(err.message);
    } finally {
      setActingId('');
    }
  }

  async function toggleExpand(id) {
    const newExpanded = new Set(expandedSubmissions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      // Load replies if not already loaded
      if (!repliesMap[id]) {
        const replies = await getContactReplies(id);
        setRepliesMap(prev => ({ ...prev, [id]: replies }));
      }
    }
    setExpandedSubmissions(newExpanded);
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
    { value: 'open', label: 'Open' },
    { value: 'responded', label: 'Responded' },
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
    open: 'Open',
    responded: 'Responded',
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

      {loading && <Skeleton variant="list" />}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && submissions.length === 0 && (
        <p className="empty-state">No contact submissions found.</p>
      )}

      {!loading && submissions.length > 0 && (
        <div className="admin-report-list">
          {filteredSubmissions.map((submission) => {
            const busy = actingId === submission.id;
            const isExpanded = expandedSubmissions.has(submission.id);
            const replies = repliesMap[submission.id] || [];
            return (
              <article key={submission.id} className="report-card" data-status={submission.status}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="report-status-badge" data-status={submission.status}>
                    {statusLabels[submission.status] || submission.status}
                  </span>
                  <span className="report-type-tag">{categoryLabels[submission.category] || submission.category}</span>
                </div>
                <div className="report-reason">{submission.name}</div>
                <div className="report-content-quote">
                  {submission.message}
                </div>
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
                
                {isExpanded && replies.length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                    {replies.map((reply) => (
                      <div key={reply.id} style={{ marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                          Admin · {new Date(reply.sent_at).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                          {reply.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="report-actions">
                  <button
                    type="button"
                    className="admin-moderation-btn cancel"
                    onClick={() => toggleExpand(submission.id)}
                  >
                    {isExpanded ? 'Collapse' : replies.length > 0 ? `View Replies (${replies.length})` : 'No Replies'}
                  </button>
                  <button
                    type="button"
                    className="admin-moderation-btn warn"
                    onClick={() => handleReply(submission)}
                  >
                    <Reply size={14} style={{ marginRight: '4px' }} />
                    Reply
                  </button>
                  <button
                    type="button"
                    className="admin-moderation-btn dismiss"
                    onClick={() => handleResolve(submission.id)}
                    disabled={busy}
                  >
                    {busy ? <Loader2 size={14} className="spin" /> : 'Resolve'}
                  </button>
                  <button
                    type="button"
                    className="admin-moderation-btn delete"
                    onClick={() => {
                      setSelectedSubmission(submission);
                      setShowDeleteConfirm(true);
                    }}
                    disabled={busy}
                  >
                    <Trash2 size={14} style={{ marginRight: '4px' }} />
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showReplyModal && selectedSubmission && (
        createPortal(
          <div className="modal-overlay" onClick={() => setShowReplyModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3>Reply to {selectedSubmission.name}</h3>
                <button type="button" className="modal-close" onClick={() => setShowReplyModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmitReply}>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--muted-bg)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                      Original message:
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--ink)' }}>
                      {selectedSubmission.message}
                    </div>
                  </div>
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Write your reply..."
                    rows={5}
                    style={{ width: '100%', padding: '12px', border: '1px solid var(--line)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical', marginBottom: '16px' }}
                  />
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setShowReplyModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={submittingReply || !replyMessage.trim()}
                    >
                      {submittingReply ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {showDeleteConfirm && selectedSubmission && (
        createPortal(
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h3>Confirm Delete</h3>
                <button type="button" className="modal-close" onClick={() => setShowDeleteConfirm(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '20px' }}>
                  Delete this contact submission from {selectedSubmission.name}? This action cannot be undone.
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-moderation-btn delete"
                    onClick={() => handleDelete(selectedSubmission.id)}
                    disabled={actingId === selectedSubmission.id}
                  >
                    {actingId === selectedSubmission.id ? <Loader2 size={14} className="spin" /> : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
}

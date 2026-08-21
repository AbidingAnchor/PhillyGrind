import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, Trash2, Eye, EyeOff } from 'lucide-react';
import { getAdminCommunityPosts, adminDeleteCommunityPost, adminDismissCommunityReport } from '../../lib/adminApi.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function AdminCommunity() {
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [dismissingId, setDismissingId] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const { posts: postsData, reports: reportsData } = await getAdminCommunityPosts();
      setPosts(postsData ?? []);
      setReports(reportsData ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDeletePost(post) {
    if (!window.confirm(`Delete post "${post.content.substring(0, 50)}..."? This action cannot be undone.`)) return;

    setDeletingId(post.id);
    setError('');
    try {
      await adminDeleteCommunityPost(post.id);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  }

  async function handleDismissReport(report) {
    if (!window.confirm('Dismiss this report?')) return;

    setDismissingId(report.id);
    setError('');
    try {
      await adminDismissCommunityReport(report.id);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setDismissingId('');
    }
  }

  async function handleDeleteReportedPost(report) {
    if (!window.confirm(`Delete the reported post? This will also dismiss the report.`)) return;

    setDeletingId(report.post_id);
    setError('');
    try {
      await adminDeleteCommunityPost(report.post_id);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <MessageSquare size={28} />
        <div>
          <h1>Community</h1>
          <p>Manage community posts and reports</p>
        </div>
      </header>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts ({posts.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports ({reports.length})
        </button>
      </div>

      {loading && <Skeleton variant="list" />}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && activeTab === 'posts' && (
        <div className="profile-section-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Content</th>
                <th>Neighborhood</th>
                <th>Likes</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">No community posts yet.</td>
                </tr>
              )}
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.authorName}</td>
                  <td>
                    <div className="admin-post-content">
                      {post.content.substring(0, 100)}
                      {post.content.length > 100 && '...'}
                    </div>
                  </td>
                  <td>{post.neighborhood}</td>
                  <td>{post.like_count || 0}</td>
                  <td>{new Date(post.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-moderation-btn delete"
                      disabled={deletingId === post.id}
                      onClick={() => handleDeletePost(post)}
                    >
                      {deletingId === post.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeTab === 'reports' && (
        <div className="profile-section-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reporter</th>
                <th>Category</th>
                <th>Reason</th>
                <th>Content Preview</th>
                <th>Type</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">No community reports yet.</td>
                </tr>
              )}
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reporterName}</td>
                  <td>
                    <span className="admin-report-reason">{report.reason}</span>
                  </td>
                  <td>
                    <span className="admin-report-subreason">{report.subreason || 'N/A'}</span>
                  </td>
                  <td>
                    <div className="admin-post-content">
                      {(report.postContent || report.commentContent)?.substring(0, 80)}
                      {(report.postContent || report.commentContent)?.length > 80 && '...'}
                    </div>
                  </td>
                  <td>
                    <span className={`admin-report-type ${report.post_id ? 'post' : 'comment'}`}>
                      {report.post_id ? 'Post' : 'Comment'}
                    </span>
                  </td>
                  <td>{new Date(report.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="admin-table-actions">
                      <button
                        type="button"
                        className="admin-moderation-btn dismiss"
                        disabled={dismissingId === report.id}
                        onClick={() => handleDismissReport(report)}
                      >
                        {dismissingId === report.id ? <Loader2 size={14} className="spin" /> : <EyeOff size={14} />}
                        Dismiss
                      </button>
                      {report.post_id && (
                        <button
                          type="button"
                          className="admin-moderation-btn delete"
                          disabled={deletingId === report.post_id}
                          onClick={() => handleDeleteReportedPost(report)}
                        >
                          {deletingId === report.post_id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                          Delete Post
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

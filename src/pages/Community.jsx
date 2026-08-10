import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, MoreHorizontal, Upload, X, Flag, ThumbsUp } from 'lucide-react';
import { getCommunityPosts, getCommunityComments, getUserLikeStatus, toggleCommunityPostLike, submitCommunityReport, createCommunityPost, deleteCommunityPost, deleteCommunityComment, COMMUNITY_NEIGHBORHOODS, getCommunityPhotoPublicUrl } from '../lib/communityApi.js';
import { useAuth } from '../lib/auth.jsx';

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function ReportModal({ isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState('Spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ reason, details });
      onClose();
      setReason('Spam');
      setDetails('');
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Report Post</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label>
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="Spam">Spam</option>
              <option value="Scam">Scam</option>
              <option value="Harassment">Harassment</option>
              <option value="Inappropriate">Inappropriate</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            Details (optional)
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide additional context..."
              rows={3}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button danger" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PostCard({ post, currentUser, onLike, onDelete }) {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    async function loadLikeStatus() {
      try {
        const isLiked = await getUserLikeStatus(post.id);
        setLiked(isLiked);
      } catch (error) {
        console.error('Failed to load like status:', error);
      }
    }
    loadLikeStatus();
  }, [post.id]);

  async function handleLike() {
    try {
      const newLiked = await toggleCommunityPostLike(post.id);
      setLiked(newLiked);
      onLike(post.id, newLiked);
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleToggleComments() {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const loadedComments = await getCommunityComments(post.id);
        setComments(loadedComments);
      } catch (error) {
        console.error('Failed to load comments:', error);
      } finally {
        setLoadingComments(false);
      }
    }
    setShowComments(!showComments);
  }

  async function handleSubmitComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const comment = await createCommunityComment(post.id, newComment);
      setComments([...comments, comment]);
      setNewComment('');
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await deleteCommunityComment(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleReport() {
    setShowReportModal(true);
    setShowMenu(false);
  }

  async function handleReportSubmit({ reason, details }) {
    await submitCommunityReport({ postId: post.id, reason, details });
    alert('Post reported successfully. Thank you for helping keep our community safe.');
  }

  const isOwnPost = currentUser?.id === post.authorId;

  return (
    <article className="feed-post-card">
      <div className="feed-post-header">
        <Link to={`/profile/${post.authorId}`} className="feed-post-author">
          {post.authorAvatarUrl ? (
            <img src={post.authorAvatarUrl} alt={post.authorName} className="feed-post-avatar" />
          ) : (
            <div className="feed-post-avatar-placeholder">{post.authorName.charAt(0)}</div>
          )}
          <div className="feed-post-author-info">
            <span className="feed-post-author-name">{post.authorName}</span>
            <div className="feed-post-meta">
              <span className="feed-post-neighborhood">{post.neighborhood}</span>
              <span className="feed-post-time">· {post.relativeTime}</span>
            </div>
          </div>
        </Link>
        <div className="feed-post-menu">
          <button
            type="button"
            className="feed-post-menu-btn"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Post options"
          >
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <div className="feed-post-menu-dropdown">
              <button
                type="button"
                className="feed-post-menu-item"
                onClick={handleReport}
              >
                <Flag size={14} />
                Report
              </button>
              {isOwnPost && (
                <button
                  type="button"
                  className="feed-post-menu-item danger"
                  onClick={() => {
                    onDelete(post.id);
                    setShowMenu(false);
                  }}
                >
                  <X size={14} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`feed-post-content ${post.photo_url ? 'has-photo' : ''}`}>
        <p>{post.content}</p>
      </div>
      {post.photo_url && (
        <img src={getCommunityPhotoPublicUrl(post.photo_url)} alt="Post photo" className="feed-post-photo" />
      )}
      
      {post.photo_url ? (
        <div className="feed-post-photo-actions">
          <button
            type="button"
            className={`feed-post-photo-action-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <ThumbsUp size={16} />
            <span>{post.like_count || 0}</span>
          </button>
          <button
            type="button"
            className="feed-post-photo-action-btn"
            onClick={handleToggleComments}
          >
            <MessageCircle size={16} />
            <span>{comments.length}</span>
          </button>
        </div>
      ) : (
        <>
          <div className="feed-post-divider" />
          <div className="feed-post-actions">
            <button
              type="button"
              className={`feed-post-action-btn ${liked ? 'liked' : ''}`}
              onClick={handleLike}
            >
              <ThumbsUp size={18} />
              <span>{post.like_count || 0}</span>
            </button>
            <button
              type="button"
              className="feed-post-action-btn"
              onClick={handleToggleComments}
            >
              <MessageCircle size={18} />
              <span>{comments.length}</span>
            </button>
          </div>
        </>
      )}

      {showComments && (
        <div className="feed-post-comments">
          {loadingComments ? (
            <p className="feed-comments-loading">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="feed-comments-empty">No comments yet. Be the first to comment!</p>
          ) : (
            <div className="feed-comments-list">
              {comments.map((comment) => (
                <div key={comment.id} className="feed-comment">
                  {comment.authorAvatarUrl ? (
                    <img src={comment.authorAvatarUrl} alt={comment.authorName} className="feed-comment-avatar" />
                  ) : (
                    <div className="feed-comment-avatar-placeholder">{comment.authorName.charAt(0)}</div>
                  )}
                  <div className="feed-comment-content">
                    <div className="feed-comment-header">
                      <span className="feed-comment-author">{comment.authorName}</span>
                      <span className="feed-comment-time">{comment.relativeTime}</span>
                      {currentUser?.id === comment.user_id && (
                        <button
                          type="button"
                          className="feed-comment-delete"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <p>{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmitComment} className="feed-comment-form">
            <div className="feed-comment-form-input">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={1}
                disabled={submittingComment}
              />
              <button 
                type="submit" 
                className="feed-comment-submit" 
                disabled={submittingComment || !newComment.trim()}
              >
                {submittingComment ? '...' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportSubmit}
      />
    </article>
  );
}

function Community() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [neighborhood, setNeighborhood] = useState('Any');
  const [filterTab, setFilterTab] = useState('all'); // all, recent, nearby, popular
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Post composer state
  const [showComposer, setShowComposer] = useState(false);
  const [composerContent, setComposerContent] = useState('');
  const [composerNeighborhood, setComposerNeighborhood] = useState(COMMUNITY_NEIGHBORHOODS[0]);
  const [composerPhoto, setComposerPhoto] = useState(null);
  const [composerPhotoPreview, setComposerPhotoPreview] = useState(null);
  const [submittingPost, setSubmittingPost] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError('');

      async function loadPosts() {
        try {
          const nextPosts = await withTimeout(
            getCommunityPosts({ neighborhood }),
            5000,
            'Supabase took too long to load posts. Please try again.',
          );

          if (!cancelled) setPosts(nextPosts);
        } catch (err) {
          if (!cancelled) setError(err.message || 'Could not load community posts.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadPosts();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [neighborhood]);

  function handleComposerClick() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/community' } });
      return;
    }
    setShowComposer(true);
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (file) {
      setComposerPhoto(file);
      setComposerPhotoPreview(URL.createObjectURL(file));
    }
  }

  function handleRemovePhoto() {
    setComposerPhoto(null);
    setComposerPhotoPreview(null);
  }

  async function handleSubmitPost(e) {
    e.preventDefault();
    if (!composerContent.trim()) {
      alert('Please write something to post.');
      return;
    }

    setSubmittingPost(true);
    try {
      const newPost = await createCommunityPost(
        {
          content: composerContent,
          neighborhood: composerNeighborhood,
        },
        composerPhoto
      );

      setPosts([newPost, ...posts]);
      setComposerContent('');
      setComposerNeighborhood(COMMUNITY_NEIGHBORHOODS[0]);
      handleRemovePhoto();
      setShowComposer(false);
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmittingPost(false);
    }
  }

  async function handleLike(postId, liked) {
    setPosts(posts.map((post) => 
      post.id === postId 
        ? { ...post, like_count: (post.like_count || 0) + (liked ? 1 : -1) }
        : post
    ));
  }

  async function handleDelete(postId) {
    if (!window.confirm('Delete this post?')) return;

    try {
      await deleteCommunityPost(postId);
      setPosts(posts.filter((post) => post.id !== postId));
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <>
      <section className="browse-hero community-hero">
        <span className="eyebrow">Community</span>
        <h1>Connect with your neighborhood</h1>
        <p>Share local updates, ask questions, and build community with neighbors across Philadelphia.</p>
      </section>

      <section className="page-section browse-content community-content">
        <div className="feed-layout">
          {/* Main Feed Column */}
          <div className="feed-main-column">
            {/* Filter Tabs */}
            <div className="feed-filter-tabs">
              <button
                className={`feed-filter-tab ${filterTab === 'all' ? 'active' : ''}`}
                onClick={() => setFilterTab('all')}
              >
                All Neighborhoods
              </button>
              <button
                className={`feed-filter-tab ${filterTab === 'recent' ? 'active' : ''}`}
                onClick={() => setFilterTab('recent')}
              >
                Recent
              </button>
              <button
                className={`feed-filter-tab ${filterTab === 'nearby' ? 'active' : ''}`}
                onClick={() => setFilterTab('nearby')}
              >
                Nearby
              </button>
              <button
                className={`feed-filter-tab ${filterTab === 'popular' ? 'active' : ''}`}
                onClick={() => setFilterTab('popular')}
              >
                Popular
              </button>
            </div>

            {/* Facebook-style Composer */}
            <div className="feed-composer-wrapper">
              <div className="feed-composer-compact">
                {user?.avatarUrl ? (
                  <img src={user.avatar_url} alt="Your avatar" className="feed-composer-avatar" />
                ) : (
                  <div className="feed-composer-avatar-placeholder">{user?.name?.charAt(0) || 'Y'}</div>
                )}
                
                <button 
                  type="button" 
                  className="feed-composer-trigger"
                  onClick={handleComposerClick}
                >
                  Share something with your neighbors...
                </button>
              </div>

              {showComposer && (
                <div className="feed-composer-expanded-wrapper">
                  <form onSubmit={handleSubmitPost} className="feed-composer-expanded">
                    <div className="feed-composer-header">
                      {user?.avatarUrl ? (
                        <img src={user.avatar_url} alt="Your avatar" className="feed-composer-avatar-small" />
                      ) : (
                        <div className="feed-composer-avatar-placeholder-small">{user?.name?.charAt(0) || 'Y'}</div>
                      )}
                      <span className="feed-composer-user-name">{user?.name || 'You'}</span>
                    </div>
                    
                    <textarea
                      value={composerContent}
                      onChange={(e) => setComposerContent(e.target.value)}
                      placeholder="Share something with your neighbors..."
                      rows={4}
                      autoFocus
                    />
                    
                    <div className="feed-composer-options">
                      <select
                        value={composerNeighborhood}
                        onChange={(e) => setComposerNeighborhood(e.target.value)}
                        className="feed-composer-neighborhood"
                      >
                        {COMMUNITY_NEIGHBORHOODS.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                      
                      <label className="feed-composer-photo-btn">
                        <Upload size={18} />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoChange}
                        />
                      </label>
                    </div>

                    {composerPhotoPreview && (
                      <div className="feed-composer-photo-preview">
                        <img src={composerPhotoPreview} alt="Preview" />
                        <button
                          type="button"
                          className="feed-composer-photo-remove"
                          onClick={handleRemovePhoto}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    <div className="feed-composer-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setShowComposer(false);
                          setComposerContent('');
                          handleRemovePhoto();
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={submittingPost || !composerContent.trim()}
                      >
                        {submittingPost ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {loading && <p className="empty-state">Loading community posts...</p>}
            {error && <p className="empty-state error-state">{error}</p>}

            {!loading && !error && (
              <>
                <div className="feed-posts">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={user}
                      onLike={handleLike}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
                {!posts.length && <p className="empty-state">No posts in this neighborhood yet. Be the first to share!</p>}
              </>
            )}

            {!isLoggedIn && (
              <p className="feed-login-hint">
                <Link to="/login" state={{ from: '/community' }}>Log in</Link> to post and comment in the community.
              </p>
            )}
          </div>

          {/* Sidebar */}
          <div className="feed-sidebar">
            <div className="feed-sidebar-card">
              <h3 className="feed-sidebar-title">Popular Neighborhoods</h3>
              <ul className="feed-sidebar-list">
                {COMMUNITY_NEIGHBORHOODS.slice(0, 6).map((hood) => (
                  <li key={hood} className="feed-sidebar-item">
                    <div className="feed-sidebar-item-name">{hood}</div>
                    <div className="feed-sidebar-item-count">Active community</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Community;

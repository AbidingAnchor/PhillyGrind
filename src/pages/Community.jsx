import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { MessageCircle, MoreHorizontal, Upload, X, Flag, Forward, AlertCircle, Shield, Ban, AlertTriangle, EyeOff, MessageSquareOff, ArrowLeft } from 'lucide-react';
import { getCommunityPosts, getCommunityComments, getUserReaction, toggleCommunityPostReaction, removeCommunityPostReaction, submitCommunityReport, createCommunityPost, deleteCommunityPost, deleteCommunityComment, createCommunityComment, getUserCommentReaction, toggleCommentReaction, COMMUNITY_NEIGHBORHOODS, getCommunityPhotoPublicUrl, getReactionBreakdown, getCommentReactionBreakdown } from '../lib/communityApi.js';
import { muteUser, blockUser } from '../lib/moderationApi.js';
import { useAuth } from '../lib/auth.jsx';
import { getReactionTotalCount, getUserAvatarColor } from '../lib/reactions.js';
import ReactionBreakdown from '../components/ReactionBreakdown.jsx';
import PostReactionControl from '../components/PostReactionControl.jsx';
import EmptyState from '../components/EmptyState.jsx';

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function ReportModal({ isOpen, onClose, onSubmit, reportType = 'post' }) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [subreason, setSubreason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reportCategories = {
    'Spam': { icon: AlertCircle, subs: ['Misleading information', 'Repeated posts', 'Fake account'] },
    'Harassment or bullying': { icon: Shield, subs: ['Targeted at me', 'Targeted at someone else', 'Repeated unwanted contact'] },
    'Hate speech or violence': { icon: Ban, subs: ['Hate speech', 'Violence or threats', 'Dangerous organization'] },
    'Scam or fraud': { icon: AlertTriangle, subs: ['Financial scam', 'Identity theft', 'Phishing attempt'] },
    'Inappropriate or adult content': { icon: EyeOff, subs: ['Adult content', 'Sexual violence', 'Inappropriate behavior'] },
    'Something else': { icon: MessageSquareOff, subs: ['Other issue'] }
  };

  if (!isOpen) return null;

  function handleBack() {
    if (step === 2) {
      setStep(1);
      setSubreason('');
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ reason, subreason });
      setStep(3); // Success step
    } catch (error) {
      alert(error.message);
      setSubmitting(false);
    }
  }

  function handleClose() {
    setStep(1);
    setReason('');
    setSubreason('');
    setSubmitting(false);
    onClose();
  }

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {step === 2 && (
              <button 
                type="button" 
                className="modal-back-button" 
                onClick={handleBack}
                disabled={submitting}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h3>
              {step === 1 && `Report ${reportType}`}
              {step === 2 && 'Tell us more'}
              {step === 3 && 'Report submitted'}
            </h3>
          </div>
          <button type="button" className="modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>
        
        {step === 1 && (
          <div className="modal-body">
            <p style={{ marginBottom: '24px', color: 'var(--muted)', fontSize: '0.95rem' }}>Why are you reporting this {reportType}?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(reportCategories).map(([category, { icon: Icon }]) => (
                <button
                  key={category}
                  type="button"
                  className={`report-category-button ${reason === category ? 'selected' : ''}`}
                  onClick={() => {
                    setReason(category);
                    setStep(2);
                  }}
                >
                  <Icon size={20} />
                  <span>{category}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="modal-body">
            <p style={{ marginBottom: '24px', color: 'var(--muted)', fontSize: '0.95rem' }}>What specifically is the issue?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reportCategories[reason]?.subs.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  className={`report-subreason-button ${subreason === sub ? 'selected' : ''}`}
                  onClick={() => {
                    setSubreason(sub);
                    handleSubmit();
                  }}
                  disabled={submitting}
                >
                  {sub}
                </button>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="secondary-button" onClick={handleBack} disabled={submitting}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="modal-body" style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              background: 'var(--mint)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <span style={{ fontSize: '32px' }}>✓</span>
            </div>
            <h3 style={{ marginBottom: '8px' }}>Thanks for your report</h3>
            <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
              We've received your report and will review it shortly. Thanks for helping keep our community safe.
            </p>
            <button type="button" className="primary-button" onClick={handleClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function BlockConfirmationModal({ isOpen, onClose, onConfirm, userName, isUnblock = false }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isUnblock ? `Unblock ${userName}?` : `Block ${userName}?`}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: '24px', color: 'var(--muted)' }}>
            {isUnblock 
              ? `You'll be able to see their posts and comments again. They'll also be able to message you.`
              : `They won't be able to message you, and you won't see their posts or comments. You can unblock them anytime.`
            }
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="button" 
              className={isUnblock ? "primary-button" : "primary-button danger"} 
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {isUnblock ? 'Unblock' : 'Block'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="toast-notification">
      {message}
    </div>
  );
}

function CommentItem({ comment, currentUser, onReply, onDelete, depth = 0, allCommenters = [] }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [userReaction, setUserReaction] = useState(null);
  const [reactionBreakdown, setReactionBreakdown] = useState([]);
  const [reactionsLoaded, setReactionsLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  const reactionTotal = getReactionTotalCount(reactionBreakdown);

  useEffect(() => {
    async function loadReactionStatus() {
      try {
        const reaction = await getUserCommentReaction(comment.id);
        setUserReaction(reaction);
        const breakdown = await getCommentReactionBreakdown(comment.id);
        setReactionBreakdown(breakdown);
      } catch (error) {
        console.error('Failed to load comment reaction status:', error);
      } finally {
        setReactionsLoaded(true);
      }
    }
    loadReactionStatus();
  }, [comment.id]);

  useEffect(() => {
    async function loadBlockStatus() {
      try {
        const blocked = await isUserBlocked(comment.user_id);
        setIsBlocked(blocked);
      } catch (error) {
        console.error('Failed to load block status:', error);
      }
    }
    loadBlockStatus();
  }, [comment.user_id]);

  async function handleReactionSelect(reactionType) {
    try {
      const newReaction = await toggleCommentReaction(comment.id, reactionType);
      setUserReaction(newReaction);
      const breakdown = await getCommentReactionBreakdown(comment.id);
      setReactionBreakdown(breakdown);
    } catch (error) {
      console.error('Failed to toggle comment reaction:', error);
      alert(error.message);
    }
  }

  async function handleSubmitReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSubmittingReply(true);
    try {
      await onReply(comment.id, replyText);
      setReplyText('');
      setShowReplyForm(false);
      setShowMentionDropdown(false);
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmittingReply(false);
    }
  }

  function handleReplyTextChange(e) {
    const text = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    // Find the @ symbol before cursor
    let atIndex = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (text[i] === '@') {
        atIndex = i;
        break;
      }
      // Stop if we hit a space or newline (mention must be continuous)
      if (text[i] === ' ' || text[i] === '\n') {
        break;
      }
    }

    if (atIndex !== -1) {
      const query = text.substring(atIndex + 1, cursorPosition);
      setMentionQuery(query);
      setMentionStartIndex(atIndex);
      
      // Filter commenters based on query
      const filtered = allCommenters.filter(name => 
        name.toLowerCase().includes(query.toLowerCase())
      );
      setMentionSuggestions(filtered);
      setShowMentionDropdown(filtered.length > 0);
    } else {
      setShowMentionDropdown(false);
      setMentionSuggestions([]);
      setMentionQuery('');
    }

    setReplyText(text);
  }

  function insertMention(name) {
    const before = replyText.substring(0, mentionStartIndex);
    const after = replyText.substring(mentionStartIndex + mentionQuery.length + 1);
    const newText = before + '@' + name + ' ' + after;
    setReplyText(newText);
    setShowMentionDropdown(false);
    setMentionSuggestions([]);
  }

  async function handleMuteUser() {
    if (!window.confirm(`Mute ${comment.authorName}? You won't see their posts or comments anymore.`)) return;
    
    try {
      await muteUser(comment.user_id);
      alert(`${comment.authorName} has been muted.`);
      setShowMenu(false);
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleBlockUser() {
    setShowBlockModal(true);
  }

  async function confirmBlock() {
    try {
      if (isBlocked) {
        await unblockUser(comment.user_id);
        setIsBlocked(false);
      } else {
        await blockUser(comment.user_id);
        setIsBlocked(true);
      }
      setShowMenu(false);
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleReport() {
    console.log('[CommentItem] handleReport called for comment:', comment.id, 'comment:', comment);
    setShowReportModal(true);
    setShowMenu(false);
  }

  async function handleShare() {
    const commentUrl = `${window.location.origin}/community/post/${comment.post_id}#comment-${comment.id}`;
    try {
      await navigator.clipboard.writeText(commentUrl);
      alert('Comment link copied to clipboard!');
      setShowMenu(false);
    } catch (error) {
      alert('Failed to copy link');
    }
  }

  async function handleReportSubmit({ reason, subreason }) {
    console.log('[CommentItem] handleReportSubmit called with:', { commentId: comment.id, reason, subreason });
    try {
      await submitCommunityReport({ commentId: comment.id, reason, subreason });
      console.log('[CommentItem] Report submitted successfully');
      setShowReportModal(false);
    } catch (error) {
      console.error('[CommentItem] Report submission failed:', error);
      alert(error.message);
    }
  }

  const isReply = depth > 0;
  const isOwnComment = currentUser?.id === comment.user_id;

  return (
    <div className={isReply ? 'feed-comment-reply' : 'feed-comment'}>
      {comment.authorAvatarUrl ? (
        <img 
          src={comment.authorAvatarUrl} 
          alt={comment.authorName} 
          className={isReply ? 'feed-comment-reply-avatar' : 'feed-comment-avatar'} 
        />
      ) : (
        <div 
          className={isReply ? 'feed-comment-reply-avatar-placeholder' : 'feed-comment-avatar-placeholder'}
          style={{ backgroundColor: getUserAvatarColor(comment.user_id, comment.authorName) }}
        >
          {comment.authorName?.charAt(0) || '?'}
        </div>
      )}
      <div className={isReply ? 'feed-comment-reply-content' : 'feed-comment-content'}>
        <div className={isReply ? 'feed-comment-reply-header' : 'feed-comment-header'}>
          <span className={isReply ? 'feed-comment-reply-author' : 'feed-comment-author'}>
            {comment.authorName}
          </span>
          <span className={isReply ? 'feed-comment-reply-time' : 'feed-comment-time'}>
            {comment.relativeTime}
          </span>
          <div className="feed-comment-actions">
            <button
              type="button"
              className="feed-comment-menu-button"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <div className="feed-comment-menu-dropdown">
                {!isOwnComment && (
                  <>
                    <button type="button" onClick={handleMuteUser}>
                      Mute {comment.authorName}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleBlockUser}
                      style={isBlocked ? { color: '#dc2626' } : {}}
                    >
                      {isBlocked ? `Unblock ${comment.authorName}` : `Block ${comment.authorName}`}
                    </button>
                  </>
                )}
                <button type="button" onClick={handleReport}>
                  Report
                </button>
                <button type="button" onClick={handleShare}>
                  Share
                </button>
              </div>
            )}
            {isOwnComment && (
              <button
                type="button"
                className="feed-comment-delete"
                onClick={() => onDelete(comment.id)}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <p>{comment.content}</p>
        
        {reactionsLoaded && (
          <div className="feed-comment-reactions">
            <PostReactionControl
              userReaction={userReaction}
              onReactionSelect={handleReactionSelect}
              reactionBreakdown={reactionBreakdown}
              reactionTotal={reactionTotal}
            />
          </div>
        )}
        
        <div className="feed-comment-reply-actions">
          <button
            type="button"
            className="feed-comment-reply-button"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            {showReplyForm ? 'Cancel' : 'Reply'}
          </button>
        </div>

        {showReplyForm && (
          <form onSubmit={handleSubmitReply} className="feed-comment-reply-form" style={{ position: 'relative' }}>
            <textarea
              value={replyText}
              onChange={handleReplyTextChange}
              placeholder="Write a reply..."
              rows={2}
              disabled={submittingReply}
            />
            {showMentionDropdown && mentionSuggestions.length > 0 && (
              <div className="mention-dropdown">
                {mentionSuggestions.map((name, index) => (
                  <div
                    key={index}
                    className="mention-dropdown-item"
                    onClick={() => insertMention(name)}
                  >
                    @{name}
                  </div>
                ))}
              </div>
            )}
            <button 
              type="submit" 
              className="feed-comment-reply-submit" 
              disabled={submittingReply || !replyText.trim()}
            >
              {submittingReply ? '...' : 'Reply'}
            </button>
          </form>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="feed-comment-replies">
            {showAllReplies ? (
              comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUser={currentUser}
                  onReply={onReply}
                  onDelete={onDelete}
                  depth={depth + 1}
                  allCommenters={allCommenters}
                />
              ))
            ) : (
              <button
                type="button"
                className="feed-comment-show-more-replies"
                onClick={() => setShowAllReplies(true)}
              >
                View {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        )}
      </div>

      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReportSubmit}
          reportType="comment"
        />
      )}
      {showBlockModal && (
        <BlockConfirmationModal
          isOpen={showBlockModal}
          onClose={() => setShowBlockModal(false)}
          onConfirm={confirmBlock}
          userName={comment.authorName}
          isUnblock={isBlocked}
        />
      )}
    </div>
  );
}

function ShareComposerModal({ isOpen, onClose, originalPost, currentUser, onShare }) {
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onShare(originalPost.id, caption);
      setCaption('');
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyLink() {
    const postUrl = `${window.location.origin}/community/post/${originalPost.id}`;
    try {
      await navigator.clipboard.writeText(postUrl);
      alert('Link copied to clipboard!');
    } catch (error) {
      alert('Failed to copy link');
    }
  }

  return createPortal(
    isOpen && (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
          <div className="modal-header">
            <h3>Share to Feed</h3>
            <button type="button" className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--muted-bg)', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                {originalPost.authorAvatarUrl ? (
                  <img src={originalPost.authorAvatarUrl} alt={originalPost.authorName} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: getUserAvatarColor(originalPost.authorId, originalPost.authorName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px' }}>
                    {originalPost.authorName?.charAt(0) || '?'}
                  </div>
                )}
                <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{originalPost.authorName}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {originalPost.content}
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption (optional)..."
                rows={3}
                style={{ width: '100%', padding: '12px', border: '1px solid var(--line)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical', marginBottom: '16px' }}
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCopyLink}
                >
                  Copy Link
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting ? 'Sharing...' : 'Share to Feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    ),
    document.body
  );
}

function PostCard({ post, currentUser, onLike, onDelete }) {
  const [liked, setLiked] = useState(false);
  const [userReaction, setUserReaction] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [allCommenters, setAllCommenters] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showShareComposer, setShowShareComposer] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [reactionBreakdown, setReactionBreakdown] = useState([]);
  const [reactionsLoaded, setReactionsLoaded] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const reactionTotal = getReactionTotalCount(reactionBreakdown);

  // Log when userReaction state changes
  useEffect(() => {
    console.log('[PostCard] userReaction state changed to:', userReaction);
  }, [userReaction]);

  async function refreshReactionState() {
    const breakdown = await getReactionBreakdown(post.id);
    console.log('[PostCard] reaction breakdown for post', post.id, breakdown);
    setReactionBreakdown(breakdown);
    return breakdown;
  }

  useEffect(() => {
    setReactionsLoaded(false);
    setReactionBreakdown([]);

    async function loadReactionStatus() {
      try {
        const reaction = await getUserReaction(post.id);
        setUserReaction(reaction);
        setLiked(!!reaction);
        await refreshReactionState();
      } catch (error) {
        console.error('Failed to load reaction status:', error);
        setReactionBreakdown([]);
      } finally {
        setReactionsLoaded(true);
      }
    }
    loadReactionStatus();
  }, [post.id]);

  useEffect(() => {
    async function loadBlockStatus() {
      try {
        const blocked = await isUserBlocked(post.authorId);
        setIsBlocked(blocked);
      } catch (error) {
        console.error('Failed to load block status:', error);
      }
    }
    loadBlockStatus();
  }, [post.authorId]);

  async function handleLike() {
    console.log('[Community PostCard] handleLike called', { 
      userReaction, 
      hadReaction: !!userReaction,
      action: !!userReaction ? 'REMOVE reaction entirely' : 'SET like reaction'
    });
    
    try {
      const hadReaction = !!userReaction;
      
      if (hadReaction) {
        // Explicitly remove the existing reaction
        console.log('[Community PostCard] Calling removeCommunityPostReaction to delete:', userReaction);
        await removeCommunityPostReaction(post.id);
        setUserReaction(null);
        setLiked(false);
        await refreshReactionState();
        onLike(post.id, -1);
      } else {
        // Set new like reaction
        console.log('[Community PostCard] Calling toggleCommunityPostReaction to set like');
        const toggleResult = await toggleCommunityPostReaction(post.id, 'like');
        console.log('[Community PostCard] toggleCommunityPostReaction returned:', toggleResult);
        
        const newReaction = toggleResult;
        setUserReaction(newReaction);
        setLiked(!!newReaction);
        await refreshReactionState();
        onLike(post.id, 1);
      }
    } catch (error) {
      console.error('[handleLike] Error:', error);
      alert(error.message);
    }
  }

  async function handleReactionSelect(reactionType) {
    console.log('[Community PostCard] Selected:', reactionType, 'replacing:', userReaction);
    try {
      const hadReaction = !!userReaction;
      await toggleCommunityPostReaction(post.id, reactionType);
      console.log('[Community PostCard] toggleCommunityPostReaction completed for:', reactionType);
      
      // Re-fetch the current reaction from the database to ensure we have the persisted value
      const newReaction = await getUserReaction(post.id);
      console.log('[Community PostCard] Re-fetched user reaction from DB:', newReaction);
      
      setUserReaction(newReaction);
      setLiked(!!newReaction);
      await refreshReactionState();

      const countDelta = hadReaction && !newReaction ? -1 : !hadReaction && newReaction ? 1 : 0;
      onLike(post.id, countDelta);
    } catch (error) {
      console.error('[handleReactionSelect] Error:', error);
      alert(error.message);
    }
  }

  async function handleShare() {
    setShowShareComposer(true);
  }

  async function handleSharePost(originalPostId, caption) {
    // This will be implemented with the API function
    console.log('Sharing post:', originalPostId, 'with caption:', caption);
    // For now, just close the modal
    setShowShareComposer(false);
  }

  async function handleToggleComments() {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const loadedComments = await getCommunityComments(post.id);
        setComments(loadedComments);
        
        // Extract distinct commenter names for @mention autocomplete
        const commenterNames = new Set();
        const extractCommenters = (commentList) => {
          commentList.forEach(comment => {
            if (comment.authorName) {
              commenterNames.add(comment.authorName);
            }
            if (comment.replies && comment.replies.length > 0) {
              extractCommenters(comment.replies);
            }
          });
        };
        extractCommenters(loadedComments);
        setAllCommenters(Array.from(commenterNames));
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
      // Reload comments to get the hierarchical structure
      const loadedComments = await getCommunityComments(post.id);
      setComments(loadedComments);
      setNewComment('');
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleReply(parentCommentId, replyText) {
    try {
      // Find the top-level parent if we're replying to a nested reply
      let finalParentId = parentCommentId;

      const findTopLevelParent = (commentId, commentList) => {
        for (const comment of commentList) {
          if (comment.id === commentId) {
            return comment.id; // This is already top-level
          }
          if (comment.replies) {
            for (const reply of comment.replies) {
              if (reply.id === commentId) {
                return comment.id; // Found it as a reply, return parent
              }
              // Check nested replies
              const nested = findTopLevelParent(commentId, [reply]);
              if (nested && nested !== commentId) {
                return nested;
              }
            }
          }
        }
        return parentCommentId; // Fallback
      };

      const topLevelParentId = findTopLevelParent(parentCommentId, comments);
      if (topLevelParentId !== parentCommentId) {
        finalParentId = topLevelParentId;
      }

      await createCommunityComment(post.id, replyText, finalParentId);
      // Reload comments to get the updated hierarchical structure
      const loadedComments = await getCommunityComments(post.id);
      setComments(loadedComments);
    } catch (error) {
      throw error;
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await deleteCommunityComment(commentId);
      // Reload comments to get the updated hierarchical structure
      const loadedComments = await getCommunityComments(post.id);
      setComments(loadedComments);
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleReport() {
    console.log('[PostCard] handleReport called for post:', post.id, 'post:', post);
    setShowReportModal(true);
    setShowMenu(false);
  }

  async function handleReportSubmit({ reason, subreason }) {
    console.log('[PostCard] handleReportSubmit called with:', { postId: post.id, reason, subreason });
    try {
      await submitCommunityReport({ postId: post.id, reason, subreason });
      console.log('[PostCard] Report submitted successfully');
      setShowReportModal(false);
    } catch (error) {
      console.error('[PostCard] Report submission failed:', error);
      alert(error.message);
    }
  }

  async function handleBlockUser() {
    setShowBlockModal(true);
  }

  async function confirmBlock() {
    try {
      if (isBlocked) {
        await unblockUser(post.authorId);
        setIsBlocked(false);
      } else {
        await blockUser(post.authorId);
        setIsBlocked(true);
      }
      setShowMenu(false);
    } catch (error) {
      alert(error.message);
    }
  }

  const isOwnPost = currentUser?.id === post.authorId;

  return (
    <article className="feed-post-card">
      <div className="feed-post-header">
        <Link to={`/profile/${post.authorId}`} className="feed-post-author">
              {post.authorAvatarUrl ? (
                <img src={post.authorAvatarUrl} alt={post.authorName} className="feed-post-avatar" />
              ) : (
                <div 
                  className="feed-post-avatar-placeholder" 
                  style={{ backgroundColor: getUserAvatarColor(post.authorId, post.authorName) }}
                >
                  {post.authorName?.charAt(0) || '?'}
                </div>
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
              {!isOwnPost && (
                <button
                  type="button"
                  className="feed-post-menu-item"
                  onClick={handleBlockUser}
                  style={isBlocked ? { color: '#dc2626' } : {}}
                >
                  {isBlocked ? 'Unblock' : 'Block'} {post.authorName}
                </button>
              )}
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

      {reactionsLoaded && reactionTotal > 0 && (
        <div className="feed-post-reaction-summary">
          <ReactionBreakdown breakdown={reactionBreakdown} userReaction={userReaction} />
        </div>
      )}
      
      {post.photo_url ? (
        <div className="feed-post-photo-actions">
          <PostReactionControl
            key={`reaction-control-${userReaction || 'none'}-${post.id}`}
            userReaction={userReaction}
            onLike={handleLike}
            onReactionSelect={handleReactionSelect}
            buttonClassName="feed-post-photo-action-btn"
            iconSize={20}
            totalReactions={reactionTotal}
            showLabel={false}
          />
          <button
            type="button"
            className="feed-post-photo-action-btn"
            onClick={handleToggleComments}
          >
            <MessageCircle size={16} />
            <span>{showComments ? comments.length : (post.comment_count || 0)}</span>
          </button>
          <button
            type="button"
            className="feed-post-photo-action-btn"
            onClick={handleShare}
            title="Share post"
          >
            <Forward size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="feed-post-divider" />
          <div className="feed-post-actions">
            <PostReactionControl
              key={`reaction-control-${userReaction || 'none'}-${post.id}`}
              userReaction={userReaction}
              onLike={handleLike}
              onReactionSelect={handleReactionSelect}
              buttonClassName="feed-post-action-btn"
              iconSize={18}
              showLabel
              totalReactions={reactionTotal}
            />
            <button
              type="button"
              className="feed-post-action-btn"
              onClick={handleToggleComments}
            >
              <MessageCircle size={18} />
              <span>{showComments ? comments.length : (post.comment_count || 0)}</span>
            </button>
            <button
              type="button"
              className="feed-post-action-btn"
              onClick={handleShare}
              title="Share post"
            >
              <Forward size={18} />
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
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUser={currentUser}
                  onReply={handleReply}
                  onDelete={handleDeleteComment}
                  allCommenters={allCommenters}
                />
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
        reportType="post"
      />
      <BlockConfirmationModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onConfirm={confirmBlock}
        userName={post.authorName}
        isUnblock={isBlocked}
      />
      <ShareComposerModal
        isOpen={showShareComposer}
        onClose={() => setShowShareComposer(false)}
        originalPost={post}
        currentUser={currentUser}
        onShare={handleSharePost}
      />
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </article>
  );
}

function Community() {
  const navigate = useNavigate();
  const { isLoggedIn, user, profile } = useAuth();
  const [posts, setPosts] = useState([]);
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || 'Any');
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
    e?.preventDefault();
    if (!composerContent.trim() && !composerPhoto) {
      alert('Please write something or add a photo to post.');
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

  function handleLike(postId, countDelta) {
    if (!countDelta) return;

    setPosts(posts.map((post) =>
      post.id === postId
        ? { ...post, like_count: Math.max(0, (post.like_count || 0) + countDelta) }
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
      <section className="feed-welcome-banner">
        <div className="feed-welcome-content">
          <span className="feed-welcome-eyebrow">PhillyGrind Community</span>
          <h1 className="feed-welcome-title">Connect with your neighborhood</h1>
        </div>
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
                onClick={() => {
                  setFilterTab('nearby');
                  setNeighborhood(profile?.neighborhood || 'Any');
                }}
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
              {/* Compact Inline Composer */}
              <div className="feed-composer-compact">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Your avatar" className="feed-composer-avatar" />
                ) : (
                  <div 
                    className="feed-composer-avatar-placeholder"
                    style={{ backgroundColor: getUserAvatarColor(user?.id, profile?.name || user?.name) }}
                  >
                    {(profile?.name || user?.name)?.charAt(0) || 'Y'}
                  </div>
                )}
                
                <input
                  type="text"
                  className="feed-composer-input"
                  placeholder="What's happening, neighbor?"
                  value={composerContent}
                  onChange={(e) => setComposerContent(e.target.value)}
                  onFocus={() => setShowComposer(true)}
                />
                
                <div className="feed-composer-actions-compact">
                  <label className="feed-composer-photo-btn-compact" title="Add photo">
                    <Upload size={20} />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                    />
                  </label>
                  {composerContent.trim() && (
                    <button
                      type="button"
                      className="feed-composer-post-btn-compact"
                      onClick={handleSubmitPost}
                    >
                      Post
                    </button>
                  )}
                </div>
              </div>

              {composerPhotoPreview && (
                <div className="feed-composer-photo-preview-compact">
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

              {showComposer && (
                <div className="feed-composer-expanded-wrapper">
                  <form onSubmit={handleSubmitPost} className="feed-composer-expanded">
                    <div className="feed-composer-header">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Your avatar" className="feed-composer-avatar-small" />
                      ) : (
                        <div 
                          className="feed-composer-avatar-placeholder-small"
                          style={{ backgroundColor: getUserAvatarColor(user?.id, profile?.name || user?.name) }}
                        >
                          {(profile?.name || user?.name)?.charAt(0) || 'Y'}
                        </div>
                      )}
                      <span className="feed-composer-user-name">{profile?.name || user?.name || 'You'}</span>
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
                {!posts.length && (
                  <EmptyState
                    icon="community"
                    title="No posts in this neighborhood yet"
                    message="Be the first to share with your community!"
                  />
                )}
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

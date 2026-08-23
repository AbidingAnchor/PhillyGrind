import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { MessageCircle, MoreHorizontal, X, Flag, Forward, AlertCircle, Shield, Ban, AlertTriangle, EyeOff, MessageSquareOff, ArrowLeft, Search, Image, Smile, Briefcase, MapPin } from 'lucide-react';
import FacebookShareIcon from '../components/FacebookShareIcon.jsx';
import ProfileListbox from '../components/ProfileListbox.jsx';
import {
  getCommunityPosts,
  fetchHomeNeighborhood,
  resolveHomeNeighborhood,
  getCommunityComments,
  getUserReaction,
  toggleCommunityPostReaction,
  removeCommunityPostReaction,
  submitCommunityReport,
  createCommunityPost,
  deleteCommunityPost,
  deleteCommunityComment,
  createCommunityComment,
  getUserCommentReaction,
  toggleCommentReaction,
  COMMUNITY_NEIGHBORHOODS,
  getCommunityPhotoPublicUrl,
  getReactionBreakdown,
  getCommentReactionBreakdown,
  shareCommunityPost,
  getPostReactorsList,
  REACTION_EMOJI,
  searchCommunityPosts,
} from '../lib/communityApi.js';
import { muteUser, blockUser, isUserBlocked } from '../lib/moderationApi.js';
import { useAuth } from '../lib/auth.jsx';
import { getReactionTotalCount, getUserAvatarColor } from '../lib/reactions.js';
import ReactionBreakdown from '../components/ReactionBreakdown.jsx';
import PostReactionControl from '../components/PostReactionControl.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import TrendingPostsWidget from '../components/TrendingPostsWidget.jsx';
import NeighborhoodWeatherAlert from '../components/NeighborhoodWeatherAlert.jsx';

const COMPOSER_FEELINGS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🙌', label: 'Grateful' },
  { emoji: '💼', label: 'Hustling' },
  { emoji: '☕', label: 'Chill' },
  { emoji: '🔥', label: 'Motivated' },
  { emoji: '🤝', label: 'Looking to connect' },
];

function defaultComposerNeighborhood(profileNeighborhood) {
  if (profileNeighborhood && COMMUNITY_NEIGHBORHOODS.includes(profileNeighborhood)) {
    return profileNeighborhood;
  }
  return COMMUNITY_NEIGHBORHOODS[0];
}

function CommunityLeftSidebar({ isLoggedIn, user, profile, neighborhoodName }) {
  const displayName = profile?.name || user?.name || 'Neighbor';
  const profileTo = isLoggedIn && user?.id ? `/profile/${user.id}` : '/login';
  const profileLinkState = isLoggedIn ? undefined : { from: '/community' };
  const homeNeighborhood = neighborhoodName || '';

  useEffect(() => {
    if (!isLoggedIn) return;
    console.log('[CommunitySidebar] View your profile link', {
      hrefTarget: profileTo,
      contextUserId: user?.id ?? null,
      contextEmail: user?.email ?? null,
      authProfileId: profile?.id ?? null,
      authProfileName: profile?.name ?? null,
    });
  }, [isLoggedIn, profileTo, user?.id, user?.email, profile?.id, profile?.name]);

  return (
    <aside className="feed-left-sidebar" aria-label="Your profile">
      <div className="feed-left-card feed-left-profile-card">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="feed-left-avatar" draggable={false} />
        ) : (
          <div
            className="feed-left-avatar feed-left-avatar-placeholder"
            style={{ backgroundColor: getUserAvatarColor(user?.id, displayName) }}
          >
            {displayName.charAt(0) || 'Y'}
          </div>
        )}
        <div className="feed-left-profile-copy">
          <strong className="feed-left-profile-name">{displayName}</strong>
          <Link to={profileTo} state={profileLinkState} className="feed-left-profile-link">
            View your profile
          </Link>
        </div>
      </div>

      <div className="feed-left-card feed-left-neighborhood-card">
        <MapPin size={18} />
        <div className="feed-left-neighborhood-copy">
          <span className="feed-left-neighborhood-label">Your Neighborhood</span>
          <strong className="feed-left-neighborhood-name">{homeNeighborhood || 'Not set yet'}</strong>
        </div>
      </div>

      {homeNeighborhood ? (
        <NeighborhoodWeatherAlert neighborhood={homeNeighborhood} locationLabel={homeNeighborhood} />
      ) : (
        <NeighborhoodWeatherAlert neighborhood="Center City" locationLabel="Philadelphia" />
      )}
    </aside>
  );
}

const SEARCH_EXAMPLES = ['Plumber', 'House Cleaner', 'Roof Repair', 'Contractor', 'House Painter', 'Electrician'];

function AnimatedPlaceholder() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % SEARCH_EXAMPLES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="search-placeholder-animated">
      Search for <span key={index} className="search-placeholder-word">{SEARCH_EXAMPLES[index]}</span>
    </span>
  );
}

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
      setStep(3); // Success step - only reached on confirmed insert
    } catch (error) {
      console.error('[ReportModal] Report submission failed:', error);
      alert(error.message);
      // Don't set step to 3 on error - modal stays on current step
    } finally {
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
    // Only load reaction status if comment.id exists
    if (comment.id) {
      loadReactionStatus();
    }
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
    // Only check block status if user_id exists and it's not the current user's own comment
    if (comment.user_id && currentUser?.id !== comment.user_id) {
      loadBlockStatus();
    }
  }, [comment.user_id, currentUser?.id]);

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
      // Don't close modal here - let ReportModal show success step
    } catch (error) {
      console.error('[CommentItem] Report submission failed:', error);
      throw error; // Re-throw to let ReportModal handle error
    }
  }

  const isReply = depth > 0;
  const isOwnComment = currentUser?.id === comment.user_id;

  return (
    <div className={isReply ? 'feed-comment-reply' : 'feed-comment'}>
      {comment.user_id && comment.user_id !== 'undefined' && comment.user_id !== 'null' ? (
        <Link to={`/profile/${comment.user_id}`}>
          {comment.authorAvatarUrl ? (
            <img
              src={comment.authorAvatarUrl}
              alt={comment.authorName}
              className={isReply ? 'feed-comment-reply-avatar' : 'feed-comment-avatar'}
              draggable={false}
            />
          ) : (
            <div
              className={isReply ? 'feed-comment-reply-avatar-placeholder' : 'feed-comment-avatar-placeholder'}
              style={{ backgroundColor: getUserAvatarColor(comment.user_id, comment.authorName) }}
            >
              {comment.authorName?.charAt(0) || '?'}
            </div>
          )}
        </Link>
      ) : (
        <>
          {comment.authorAvatarUrl ? (
            <img
              src={comment.authorAvatarUrl}
              alt={comment.authorName}
              className={isReply ? 'feed-comment-reply-avatar' : 'feed-comment-avatar'}
              draggable={false}
            />
          ) : (
            <div
              className={isReply ? 'feed-comment-reply-avatar-placeholder' : 'feed-comment-avatar-placeholder'}
              style={{ backgroundColor: getUserAvatarColor(comment.user_id, comment.authorName) }}
            >
              {comment.authorName?.charAt(0) || '?'}
            </div>
          )}
        </>
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
                  <img src={originalPost.authorAvatarUrl} alt={originalPost.authorName} draggable={false} style={{ width: '32px', height: '32px', borderRadius: '50%', userSelect: 'none' }} />
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

function ReactionsListModal({ postId, onClose }) {
  const [reactors, setReactors] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    getPostReactorsList(postId).then(setReactors);
  }, [postId]);

  const counts = reactors.reduce((acc, r) => {
    acc[r.reactionType] = (acc[r.reactionType] || 0) + 1;
    return acc;
  }, {});

  const filtered = activeTab === 'all' ? reactors : reactors.filter(r => r.reactionType === activeTab);

  return createPortal(
    (
      <div className="reactions-modal-overlay" onClick={onClose}>
        <div className="reactions-modal" onClick={e => e.stopPropagation()}>
          <button className="reactions-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
          <div className="reactions-modal-tabs">
            <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>
              All {reactors.length}
            </button>
            {Object.entries(counts).map(([type, count]) => (
              <button key={type} className={activeTab === type ? 'active' : ''} onClick={() => setActiveTab(type)}>
                {REACTION_EMOJI[type] || '❓'} {count}
              </button>
            ))}
          </div>
          <div className="reactions-modal-list">
            {filtered.map(r => (
              <Link key={r.userId} to={`/profile/${r.userId}`} className="reactions-modal-user" onClick={onClose}>
                {r.avatarUrl ? (
                  <img src={r.avatarUrl} className="reactions-modal-avatar" alt={r.name} draggable={false} />
                ) : (
                  <div
                    className="reactions-modal-avatar-placeholder"
                    style={{ backgroundColor: getUserAvatarColor(r.userId, r.name) }}
                  >
                    {r.name?.charAt(0) || '?'}
                  </div>
                )}
                <span>{r.name}</span>
              </Link>
            ))}
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
  const [showReactionsModal, setShowReactionsModal] = useState(false);

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
    // Only load reaction status if post.id exists
    if (post.id) {
      loadReactionStatus();
    }
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
    // Only check block status if authorId exists and it's not the current user's own post
    if (post.authorId && currentUser?.id !== post.authorId) {
      loadBlockStatus();
    }
  }, [post.authorId, currentUser?.id]);

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
    try {
      await shareCommunityPost(originalPostId, caption);
      setToastMessage('Post shared to your feed!');
      setShowShareComposer(false);
    } catch (error) {
      alert(error.message);
    }
  }

  // Count total comments including nested replies
  const totalCommentCount = comments.reduce((total, comment) => {
    return total + 1 + (comment.replies?.length || 0);
  }, 0);

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
      // Don't close modal here - let ReportModal show success step
    } catch (error) {
      console.error('[PostCard] Report submission failed:', error);
      throw error; // Re-throw to let ReportModal handle error
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

  console.log('[PostCard] isOwnPost check:', {
    currentUserId: currentUser?.id,
    postAuthorId: post.authorId,
    postUserId: post.user_id,
    isOwnPost
  });

  return (
    <article className="feed-post-card">
      <div className="feed-post-header">
        {post.authorId && post.authorId !== 'undefined' && post.authorId !== 'null' ? (
          <Link to={`/profile/${post.authorId}`} className="feed-post-author">
            {post.authorAvatarUrl ? (
              <img src={post.authorAvatarUrl} alt={post.authorName} className="feed-post-avatar" draggable={false} />
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
        ) : (
          <div className="feed-post-author">
            {post.authorAvatarUrl ? (
              <img src={post.authorAvatarUrl} alt={post.authorName} className="feed-post-avatar" draggable={false} />
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
          </div>
        )}
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
              {console.log('[Menu render] isOwnPost:', isOwnPost, 'showing Block:', !isOwnPost, 'showing Delete:', isOwnPost)}
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

      {post.original_post ? (
        <div className="shared-post-card">
          <div className="shared-post-header">
            {post.original_post.authorAvatarUrl ? (
              <img src={post.original_post.authorAvatarUrl} alt={post.original_post.authorName} className="shared-post-avatar" draggable={false} />
            ) : (
              <div 
                className="shared-post-avatar-placeholder"
                style={{ backgroundColor: getUserAvatarColor(post.original_post.authorId, post.original_post.authorName) }}
              >
                {post.original_post.authorName?.charAt(0) || '?'}
              </div>
            )}
            <div className="shared-post-author-info">
              <span className="shared-post-author">{post.original_post.authorName}</span>
              <span className="shared-post-time">{new Date(post.original_post.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="shared-post-content">
            <p>{post.original_post.content}</p>
          </div>
          {post.original_post.photo_url && (
            <img src={getCommunityPhotoPublicUrl(post.original_post.photo_url)} alt="Original post photo" className="shared-post-photo" />
          )}
        </div>
      ) : post.shared_post_id ? (
        <div className="shared-post-unavailable">
          This post is no longer available
        </div>
      ) : null}

      {post.photo_url ? (
        <>
          {(reactionTotal > 0 || (showComments ? totalCommentCount : post.comment_count) > 0 || post.share_count > 0) && (
            <div
              className="feed-post-reaction-summary"
              onClick={() => setShowReactionsModal(true)}
              style={{ cursor: 'pointer' }}
            >
              <ReactionBreakdown breakdown={reactionBreakdown} userReaction={userReaction} />
              <span className="feed-post-stats">
                {(showComments ? totalCommentCount : post.comment_count) > 0 && `${showComments ? totalCommentCount : post.comment_count} comments`}
                {(showComments ? totalCommentCount : post.comment_count) > 0 && post.share_count > 0 && ' · '}
                {post.share_count > 0 && `${post.share_count} shares`}
              </span>
            </div>
          )}
          <div className="feed-post-divider" />
          <div className="feed-post-photo-actions">
            <PostReactionControl
              key={`reaction-control-${userReaction || 'none'}-${post.id}`}
              userReaction={userReaction}
              onLike={handleLike}
              onReactionSelect={handleReactionSelect}
              buttonClassName="feed-post-photo-action-btn"
              iconSize={20}
              showLabel={false}
            />
            <button
              type="button"
              className="feed-post-photo-action-btn"
              onClick={handleToggleComments}
            >
              <MessageCircle size={20} />
              <span>Comment</span>
            </button>
            <button
              type="button"
              className="feed-post-photo-action-btn"
              onClick={handleShare}
              title="Share post"
            >
              <FacebookShareIcon size={20} />
              <span>Share</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {(reactionTotal > 0 || (showComments ? totalCommentCount : post.comment_count) > 0 || post.share_count > 0) && (
            <div
              className="feed-post-reaction-summary"
              onClick={() => setShowReactionsModal(true)}
              style={{ cursor: 'pointer' }}
            >
              <ReactionBreakdown breakdown={reactionBreakdown} userReaction={userReaction} />
              <span className="feed-post-stats">
                {(showComments ? totalCommentCount : post.comment_count) > 0 && `${showComments ? totalCommentCount : post.comment_count} comments`}
                {(showComments ? totalCommentCount : post.comment_count) > 0 && post.share_count > 0 && ' · '}
                {post.share_count > 0 && `${post.share_count} shares`}
              </span>
            </div>
          )}
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
            />
            <button
              type="button"
              className="feed-post-action-btn"
              onClick={handleToggleComments}
            >
              <MessageCircle size={18} />
              <span>Comment</span>
            </button>
            <button
              type="button"
              className="feed-post-action-btn"
              onClick={handleShare}
              title="Share post"
            >
              <FacebookShareIcon size={18} />
              <span>Share</span>
            </button>
          </div>
        </>
      )}

      {showComments && (
        <div className="feed-post-comments">
          {loadingComments ? (
            <Skeleton variant="comments" count={3} />
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
      />
      {showReactionsModal && (
        <ReactionsListModal
          postId={post.id}
          onClose={() => setShowReactionsModal(false)}
        />
      )}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </article>
  );
}

function Community() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoggedIn, user, profile } = useAuth();
  const [posts, setPosts] = useState([]);
  const [homeNeighborhood, setHomeNeighborhood] = useState(() => resolveHomeNeighborhood(profile));
  const [neighborhood, setNeighborhood] = useState(resolveHomeNeighborhood(profile) || 'Any');
  const [filterTab, setFilterTab] = useState('all'); // all, recent, nearby, popular
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchQuery = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Post composer state
  const [showComposer, setShowComposer] = useState(false);
  const [composerContent, setComposerContent] = useState('');
  const [composerNeighborhood, setComposerNeighborhood] = useState(defaultComposerNeighborhood(resolveHomeNeighborhood(profile)));
  const [composerPhoto, setComposerPhoto] = useState(null);
  const [composerPhotoPreview, setComposerPhotoPreview] = useState(null);
  const [composerFeeling, setComposerFeeling] = useState(null);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const composerPhotoInputRef = useRef(null);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeNeighborhood() {
      const next = await fetchHomeNeighborhood(isLoggedIn ? user?.id : null, profile);
      if (cancelled) return;
      setHomeNeighborhood(next);
      setNeighborhood((current) => (current === 'Any' && next ? next : current));
    }

    loadHomeNeighborhood();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id, profile?.neighborhood, profile?.neighborhoods]);

  useEffect(() => {
    if (!showComposer) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeComposer();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showComposer]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError('');

      async function loadPosts() {
        try {
          let nextPosts;
          if (searchQuery) {
            nextPosts = await withTimeout(
              searchCommunityPosts(searchQuery),
              5000,
              'Supabase took too long to load posts. Please try again.',
            );
          } else {
            nextPosts = await withTimeout(
              getCommunityPosts({ neighborhood }),
              5000,
              'Supabase took too long to load posts. Please try again.',
            );
          }

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
  }, [neighborhood, searchQuery]);

  function resetComposerFields() {
    setComposerContent('');
    setComposerNeighborhood(defaultComposerNeighborhood(homeNeighborhood));
    setComposerFeeling(null);
    setShowFeelingPicker(false);
    setComposerPhoto(null);
    setComposerPhotoPreview(null);
  }

  function closeComposer() {
    setShowComposer(false);
    setShowFeelingPicker(false);
  }

  function handleComposerClick() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/community' } });
      return;
    }
    setComposerNeighborhood(defaultComposerNeighborhood(homeNeighborhood));
    setShowComposer(true);
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setComposerPhoto(file);
      setComposerPhotoPreview(URL.createObjectURL(file));
    }
    e.target.value = '';
  }

  function handleRemovePhoto() {
    setComposerPhoto(null);
    setComposerPhotoPreview(null);
  }

  function handleCreateJobShortcut() {
    closeComposer();
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/jobs?tab=post' } });
      return;
    }
    navigate('/jobs?tab=post');
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter' && searchInput.trim()) {
      navigate(`/community?search=${encodeURIComponent(searchInput.trim())}`);
    }
    if (e.key === 'Escape') {
      setSearchInput('');
      navigate('/community');
    }
  }

  async function handleSubmitPost(e) {
    e?.preventDefault();
    if (!composerContent.trim() && !composerPhoto) {
      alert('Please write something or add a photo to post.');
      return;
    }

    setSubmittingPost(true);
    
    // Optimistic UI update - add post immediately before API call
    const tempPostId = `temp-${Date.now()}`;
    const pendingContent = composerFeeling
      ? `${composerFeeling.emoji} Feeling ${composerFeeling.label}\n\n${composerContent}`.trim()
      : composerContent;
    const tempPost = {
      id: tempPostId,
      content: pendingContent,
      neighborhood: composerNeighborhood,
      photo: composerPhoto,
      created_at: new Date().toISOString(),
      user_id: user?.id,
      profiles: profile,
      like_count: 0,
      comment_count: 0,
      reaction_breakdown: [],
      is_temp: true
    };
    
    setPosts([tempPost, ...posts]);
    const contentToPost = pendingContent;
    const neighborhoodToPost = composerNeighborhood;
    const photoToPost = composerPhoto;
    resetComposerFields();
    closeComposer();
    
    try {
      const newPost = await createCommunityPost(
        {
          content: contentToPost,
          neighborhood: neighborhoodToPost,
        },
        photoToPost
      );

      // Replace temporary post with real post from API
      setPosts(currentPosts => 
        currentPosts.map(post => 
          post.id === tempPostId ? newPost : post
        )
      );
    } catch (error) {
      // Remove temporary post on error
      setPosts(currentPosts => 
        currentPosts.filter(post => post.id !== tempPostId)
      );
      alert(error.message);
      setComposerContent(contentToPost.includes('\n\n') ? contentToPost.split('\n\n').slice(1).join('\n\n') : contentToPost);
      setComposerNeighborhood(neighborhoodToPost);
      if (photoToPost) {
        setComposerPhoto(photoToPost);
        setComposerPhotoPreview(URL.createObjectURL(photoToPost));
      }
      setShowComposer(true);
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
          <CommunityLeftSidebar isLoggedIn={isLoggedIn} user={user} profile={profile} neighborhoodName={homeNeighborhood} />

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
                  setNeighborhood(homeNeighborhood || 'Any');
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

            {/* Search Bar */}
            <div className="feed-search-bar">
              <Search size={18} className="feed-search-icon" />
              <div className="feed-search-input-wrap">
                <input
                  className="feed-search-input"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                {!searchInput && <AnimatedPlaceholder />}
              </div>
            </div>

            {/* Facebook-style Composer */}
            <div className="feed-composer-wrapper">
              <button
                type="button"
                className="feed-composer-entry"
                onClick={handleComposerClick}
                aria-label="Create a post"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="feed-composer-avatar" />
                ) : (
                  <div
                    className="feed-composer-avatar-placeholder"
                    style={{ backgroundColor: getUserAvatarColor(user?.id, profile?.name || user?.name) }}
                  >
                    {(profile?.name || user?.name)?.charAt(0) || 'Y'}
                  </div>
                )}
                <div className="feed-composer-entry-copy">
                  <span className="feed-composer-entry-name">{profile?.name || user?.name || 'Neighbor'}</span>
                  <span className="feed-composer-entry-prompt">What's on your mind, neighbor?</span>
                </div>
                <div className="feed-composer-entry-actions" aria-hidden="true">
                  <span className="feed-composer-entry-action" title="Photo/video">
                    <Image size={16} />
                  </span>
                  <span className="feed-composer-entry-action" title="Feeling/activity">
                    <Smile size={16} />
                  </span>
                </div>
              </button>
            </div>

            <NeighborhoodWeatherAlert
              variant="feed"
              neighborhood={homeNeighborhood || 'Center City'}
              locationLabel={homeNeighborhood || 'Philadelphia'}
            />

            {showComposer && createPortal(
              <div
                className="community-compose-modal-overlay"
                onClick={(event) => {
                  if (event.target === event.currentTarget) closeComposer();
                }}
              >
                <div
                  className="community-compose-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="community-compose-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="community-compose-modal-header">
                    <div className="community-compose-modal-heading">
                      <span className="eyebrow">Community</span>
                      <h2 id="community-compose-title">Create post</h2>
                    </div>
                    <button
                      type="button"
                      className="community-compose-modal-close"
                      onClick={closeComposer}
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form className="community-compose-form" onSubmit={handleSubmitPost}>
                    <div className="community-compose-author">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="feed-composer-avatar" draggable={false} />
                      ) : (
                        <div
                          className="feed-composer-avatar-placeholder"
                          style={{ backgroundColor: getUserAvatarColor(user?.id, profile?.name || user?.name) }}
                        >
                          {(profile?.name || user?.name)?.charAt(0) || 'Y'}
                        </div>
                      )}
                      <div className="community-compose-author-meta">
                        <strong>{profile?.name || user?.name || 'You'}</strong>
                        {composerFeeling && (
                          <span className="community-compose-feeling-chip">
                            {composerFeeling.emoji} Feeling {composerFeeling.label}
                            <button
                              type="button"
                              onClick={() => setComposerFeeling(null)}
                              aria-label="Remove feeling"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>

                    <ProfileListbox
                      label="Neighborhood"
                      value={composerNeighborhood}
                      options={COMMUNITY_NEIGHBORHOODS}
                      placeholder="Select neighborhood"
                      onChange={setComposerNeighborhood}
                    />

                    <textarea
                      className="community-compose-textarea"
                      value={composerContent}
                      onChange={(e) => setComposerContent(e.target.value)}
                      placeholder="What's on your mind, neighbor?"
                      rows={5}
                      autoFocus
                    />

                    {composerPhotoPreview && (
                      <div className="community-compose-photo-preview">
                        <img src={composerPhotoPreview} alt="Preview" />
                        <button
                          type="button"
                          className="feed-composer-photo-remove"
                          onClick={handleRemovePhoto}
                          aria-label="Remove photo"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    <div className="community-compose-toolbar">
                      <span className="community-compose-toolbar-label">Add to your post</span>
                      <div className="community-compose-toolbar-actions">
                        <button
                          type="button"
                          className="community-compose-tool-btn"
                          onClick={() => composerPhotoInputRef.current?.click()}
                        >
                          <Image size={18} />
                          <span>Photo/video</span>
                        </button>
                        <div className="community-compose-feeling-wrap">
                          <button
                            type="button"
                            className={`community-compose-tool-btn${showFeelingPicker ? ' is-active' : ''}`}
                            onClick={() => setShowFeelingPicker((open) => !open)}
                          >
                            <Smile size={18} />
                            <span>Feeling/activity</span>
                          </button>
                          {showFeelingPicker && (
                            <div className="community-compose-feeling-panel">
                              {COMPOSER_FEELINGS.map((feeling) => (
                                <button
                                  key={feeling.label}
                                  type="button"
                                  className={`community-compose-feeling-option${composerFeeling?.label === feeling.label ? ' is-selected' : ''}`}
                                  onClick={() => {
                                    setComposerFeeling(feeling);
                                    setShowFeelingPicker(false);
                                  }}
                                >
                                  <span>{feeling.emoji}</span>
                                  {feeling.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="community-compose-tool-btn community-compose-tool-btn--job"
                          onClick={handleCreateJobShortcut}
                        >
                          <Briefcase size={18} />
                          <span>Create Job</span>
                        </button>
                      </div>
                      <input
                        ref={composerPhotoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoChange}
                        hidden
                      />
                    </div>

                    <div className="community-compose-footer">
                      <button
                        type="submit"
                        className="primary-button community-compose-submit"
                        disabled={submittingPost || (!composerContent.trim() && !composerPhoto)}
                      >
                        {submittingPost ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>,
              document.body
            )}

            {loading && <Skeleton variant="feed" count={4} />}
            {error && <p className="empty-state error-state">{error}</p>}

            {!loading && !error && (
              <>
                {searchQuery && (
                  <div className="search-banner">
                    Showing results for <strong>"{searchQuery}"</strong>
                    <Link to="/community" className="search-clear">Clear search</Link>
                  </div>
                )}
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
            <TrendingPostsWidget />
          </div>
        </div>
      </section>
    </>
  );
}

export default Community;

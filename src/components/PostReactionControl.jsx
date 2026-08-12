import { useEffect, useRef, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { getReactionByType } from '../lib/reactions.js';
import ReactionIcon from './ReactionIcon.jsx';
import ReactionPicker from './ReactionPicker.jsx';

export default function PostReactionControl({
  liked,
  userReaction,
  onLike,
  onReactionSelect,
  buttonClassName = 'feed-post-action-btn',
  iconSize = 18,
  showLabel = false,
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const longPressTimerRef = useRef(null);
  const hoverLeaveTimerRef = useRef(null);

  const activeReaction = getReactionByType(userReaction);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    };
  }, []);

  const handleReactionGroupEnter = () => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    if (!isMobile) setShowReactionPicker(true);
  };

  const handleReactionGroupLeave = () => {
    if (!isMobile) {
      hoverLeaveTimerRef.current = setTimeout(() => {
        setShowReactionPicker(false);
      }, 200);
    }
  };

  const handleLikeMouseDown = () => {
    if (!isMobile) return;
    setHasMoved(false);
    longPressTimerRef.current = setTimeout(() => {
      setShowReactionPicker(true);
    }, 400);
  };

  const handleLikeMouseUp = () => {
    if (!isMobile) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!showReactionPicker && !hasMoved) {
      onLike();
    }
    setShowReactionPicker(false);
  };

  const handleLikeMouseMove = () => {
    if (isMobile) setHasMoved(true);
  };

  const handleLikeClick = () => {
    if (!isMobile && !showReactionPicker) onLike();
  };

  const handleReactionSelect = async (reactionType) => {
    setShowReactionPicker(false);
    await onReactionSelect(reactionType);
  };

  return (
    <div
      className="feed-post-reaction-wrapper"
      onMouseEnter={handleReactionGroupEnter}
      onMouseLeave={handleReactionGroupLeave}
    >
      <button
        type="button"
        className={`${buttonClassName} ${liked ? 'liked' : ''}`.trim()}
        data-reaction={userReaction || undefined}
        style={activeReaction ? { color: activeReaction.color } : undefined}
        onClick={(e) => {
          if (!showReactionPicker) handleLikeClick(e);
        }}
        onMouseDown={handleLikeMouseDown}
        onMouseUp={handleLikeMouseUp}
        onMouseMove={handleLikeMouseMove}
        onTouchStart={handleLikeMouseDown}
        onTouchEnd={handleLikeMouseUp}
        onTouchMove={handleLikeMouseMove}
        aria-label={activeReaction ? `You reacted with ${activeReaction.label}` : 'Like'}
      >
        {activeReaction ? (
          <ReactionIcon type={activeReaction.type} size={iconSize} className="reaction-icon-active" />
        ) : (
          <ThumbsUp size={iconSize} />
        )}
        {showLabel && <span>{activeReaction?.label ?? 'Like'}</span>}
      </button>
      {showReactionPicker && <ReactionPicker onSelect={handleReactionSelect} />}
    </div>
  );
}

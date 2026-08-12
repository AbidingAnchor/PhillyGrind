import { useEffect, useRef, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { getReactionByType } from '../lib/reactions.js';
import ReactionIcon from './ReactionIcon.jsx';
import ReactionPicker from './ReactionPicker.jsx';

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;

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
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef(null);

  const activeReaction = getReactionByType(userReaction);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearLongPressTimer();
  }, []);

  useEffect(() => {
    if (!showReactionPicker) return undefined;

    const handlePointerDownOutside = (event) => {
      if (event.target.closest('.feed-post-reaction-wrapper')) return;
      setShowReactionPicker(false);
      longPressTriggeredRef.current = false;
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [showReactionPicker]);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    longPressTriggeredRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowReactionPicker(true);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event) => {
    if (!pointerStartRef.current) return;

    const dx = event.clientX - pointerStartRef.current.x;
    const dy = event.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearLongPressTimer();
    }
  };

  const handlePointerUp = () => {
    clearLongPressTimer();
    pointerStartRef.current = null;
  };

  const handlePointerCancel = () => {
    clearLongPressTimer();
    pointerStartRef.current = null;
    longPressTriggeredRef.current = false;
  };

  const handleClick = (event) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      longPressTriggeredRef.current = false;
      return;
    }

    if (!showReactionPicker) {
      onLike();
    }
  };

  const handleReactionSelect = async (reactionType) => {
    setShowReactionPicker(false);
    longPressTriggeredRef.current = false;
    await onReactionSelect(reactionType);
  };

  return (
    <div className="feed-post-reaction-wrapper">
      <button
        type="button"
        className={`${buttonClassName} ${liked ? 'liked' : ''}`.trim()}
        data-reaction={userReaction || undefined}
        style={activeReaction ? { color: activeReaction.color } : undefined}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(event) => {
          if (longPressTriggeredRef.current) event.preventDefault();
        }}
        aria-label={activeReaction ? `You reacted with ${activeReaction.label}` : 'Like'}
        aria-haspopup="true"
        aria-expanded={showReactionPicker}
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

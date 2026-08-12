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
  totalReactions = 0,
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const pointerStartRef = useRef(null);

  const activeReaction = getReactionByType(userReaction);
  const activeReactionType = activeReaction?.type ?? null;

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
    if (longPressTriggeredRef.current || suppressNextClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      return;
    }

    if (!showReactionPicker) {
      onLike();
    }
  };

  const handleReactionSelect = async (reactionType) => {
    console.log('[PostReactionControl] handleReactionSelect called with:', reactionType);
    suppressNextClickRef.current = true;
    setShowReactionPicker(false);
    longPressTriggeredRef.current = false;

    try {
      console.log('[PostReactionControl] Calling onReactionSelect with:', reactionType);
      await onReactionSelect(reactionType);
      console.log('[PostReactionControl] onReactionSelect completed');
    } finally {
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
        console.log('[PostReactionControl] suppressNextClickRef reset');
      }, 300);
    }
  };

  return (
    <div className="feed-post-reaction-wrapper">
      <button
        type="button"
        className={`${buttonClassName} ${liked ? 'liked' : ''}`.trim()}
        data-reaction={activeReactionType || undefined}
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
        {activeReactionType ? (
          <ReactionIcon
            key={activeReactionType}
            type={activeReactionType}
            size={iconSize}
            className="reaction-icon-active"
          />
        ) : (
          <ThumbsUp size={iconSize} />
        )}
        {showLabel && <span>{activeReaction?.label ?? 'Like'}</span>}
        {!showLabel && totalReactions > 0 && <span>{totalReactions}</span>}
      </button>
      {showReactionPicker && <ReactionPicker onSelect={handleReactionSelect} />}
    </div>
  );
}

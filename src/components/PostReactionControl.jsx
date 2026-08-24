import { useEffect, useRef, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { getReactionByType } from '../lib/reactions.js';
import ReactionIcon from './ReactionIcon.jsx';
import ReactionPicker from './ReactionPicker.jsx';

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;

export default function PostReactionControl({
  userReaction,
  onLike,
  onReactionSelect,
  buttonClassName = 'feed-post-action-btn',
  iconSize = 18,
  showLabel = false,
  totalReactions = 0,
  reactionTotal,
  variant = 'default',
}) {
  const resolvedTotal = reactionTotal ?? totalReactions;
  const isCompact = variant === 'compact';
  const resolvedButtonClass = isCompact
    ? 'feed-comment-meta-like-btn'
    : buttonClassName;
  const resolvedIconSize = isCompact ? 14 : iconSize;
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef(null);

  const activeReaction = getReactionByType(userReaction);
  const activeReactionType = activeReaction?.type ?? null;
  const hasReaction = !!userReaction;

  // Log when reaction state changes to debug re-rendering
  useEffect(() => {
    console.log('[PostReactionControl] userReaction changed:', userReaction, 'activeReactionType:', activeReactionType);
  }, [userReaction, activeReactionType]);

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

  const handlePointerUp = (event) => {
    clearLongPressTimer();
    pointerStartRef.current = null;
  };

  const handlePointerCancel = () => {
    clearLongPressTimer();
    pointerStartRef.current = null;
    longPressTriggeredRef.current = false;
  };

  const handleClick = (event) => {
    console.log('[PostReactionControl] handleClick fired', { 
      hasReaction, 
      userReaction, 
      longPressTriggered: longPressTriggeredRef.current,
      showReactionPicker 
    });
    
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      return;
    }

    if (showReactionPicker) {
      return;
    }

    // Regular click behavior
    if (hasReaction) {
      console.log('[PostReactionControl] Regular click: Has reaction, calling onLike to remove:', userReaction);
      onLike(); // This will toggle off the current reaction
    } else {
      console.log('[PostReactionControl] Regular click: No reaction, setting to like');
      onReactionSelect('like');
    }
  };

  const handleReactionSelect = async (reactionType) => {
    console.log('[PostReactionControl] Selected:', reactionType);
    setShowReactionPicker(false);
    longPressTriggeredRef.current = false;

    try {
      await onReactionSelect(reactionType);
    } catch (error) {
      console.error('[PostReactionControl] Error:', error);
    }
  };

  // Force picker to completely remount each time it opens
  const [pickerKey, setPickerKey] = useState('closed');
  
  useEffect(() => {
    if (showReactionPicker) {
      setPickerKey(`open-${Date.now()}`);
    } else {
      setPickerKey('closed');
    }
  }, [showReactionPicker]);

  return (
    <div className={`feed-post-reaction-wrapper${isCompact ? ' feed-post-reaction-wrapper--compact' : ''}`}>
      <button
        type="button"
        className={`${resolvedButtonClass} ${hasReaction ? 'liked' : ''}`.trim()}
        data-reaction={activeReactionType || undefined}
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
            key={`reaction-${activeReactionType}`}
            type={activeReactionType}
            size={resolvedIconSize}
            className="reaction-icon-active"
          />
        ) : (
          <ThumbsUp key="thumbs-up-none" size={resolvedIconSize} />
        )}
        {isCompact ? (
          <>
            <span>Like</span>
            {resolvedTotal > 0 && <span className="feed-comment-meta-like-count">{resolvedTotal}</span>}
          </>
        ) : (
          <>
            {showLabel && <span>{activeReaction?.label ?? 'Like'}</span>}
            {!showLabel && resolvedTotal > 0 && <span>{resolvedTotal}</span>}
          </>
        )}
      </button>
      {showReactionPicker && <ReactionPicker key={pickerKey} onSelect={handleReactionSelect} />}
    </div>
  );
}

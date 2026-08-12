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
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef(null);

  const activeReaction = getReactionByType(userReaction);
  const activeReactionType = activeReaction?.type ?? null;
  const hasReaction = !!userReaction;

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
      console.log('[PostReactionControl] Click outside detected, closing picker');
      setShowReactionPicker(false);
      longPressTriggeredRef.current = false;
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [showReactionPicker]);

  const handlePointerDown = (event) => {
    console.log('[PostReactionControl] handlePointerDown fired', { 
      pointerType: event.pointerType, 
      button: event.button,
      currentReaction: userReaction 
    });
    
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    longPressTriggeredRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      console.log('[PostReactionControl] Long press triggered, opening picker');
      longPressTriggeredRef.current = true;
      setShowReactionPicker(true);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event) => {
    if (!pointerStartRef.current) return;

    const dx = event.clientX - pointerStartRef.current.x;
    const dy = event.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      console.log('[PostReactionControl] Movement exceeded threshold, canceling long press');
      clearLongPressTimer();
    }
  };

  const handlePointerUp = (event) => {
    console.log('[PostReactionControl] handlePointerUp fired', { 
      longPressTriggered: longPressTriggeredRef.current,
      currentReaction: userReaction 
    });
    
    clearLongPressTimer();
    pointerStartRef.current = null;
  };

  const handlePointerCancel = () => {
    console.log('[PostReactionControl] handlePointerCancel fired');
    clearLongPressTimer();
    pointerStartRef.current = null;
    longPressTriggeredRef.current = false;
  };

  const handleClick = (event) => {
    console.log('[PostReactionControl] handleClick fired', { 
      longPressTriggered: longPressTriggeredRef.current,
      currentReaction: userReaction,
      hasReaction 
    });
    
    if (longPressTriggeredRef.current) {
      console.log('[PostReactionControl] Click suppressed due to long press');
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      return;
    }

    if (showReactionPicker) {
      console.log('[PostReactionControl] Click suppressed, picker is open');
      return;
    }

    // Regular click behavior
    if (hasReaction) {
      console.log('[PostReactionControl] Regular click: User has reaction, removing it');
      onLike(); // This will toggle off the current reaction
    } else {
      console.log('[PostReactionControl] Regular click: User has no reaction, setting to like');
      onReactionSelect('like');
    }
  };

  const handleReactionSelect = async (reactionType) => {
    console.log('[PostReactionControl] handleReactionSelect called with:', reactionType, 'current reaction:', userReaction);
    setShowReactionPicker(false);
    longPressTriggeredRef.current = false;

    try {
      console.log('[PostReactionControl] Calling onReactionSelect with:', reactionType);
      await onReactionSelect(reactionType);
      console.log('[PostReactionControl] onReactionSelect completed successfully');
    } catch (error) {
      console.error('[PostReactionControl] onReactionSelect failed:', error);
    }
  };

  return (
    <div className="feed-post-reaction-wrapper">
      <button
        type="button"
        className={buttonClassName}
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

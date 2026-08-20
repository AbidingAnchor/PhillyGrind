import { useState } from 'react';
import { formatReactionCount, getReactionTotalCount, normalizeReactionBreakdown, REACTIONS } from '../lib/reactions.js';
import ReactionIcon from './ReactionIcon.jsx';

export default function ReactionBreakdown({ breakdown, maxTypes = 3, className = '', userReaction }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const items = normalizeReactionBreakdown(breakdown);
  const total = getReactionTotalCount(items);

  if (items.length === 0 || total <= 0) return null;

  const visibleTypes = items.slice(0, maxTypes);
  const userReactionData = userReaction ? REACTIONS.find(r => r.type === userReaction) : null;
  const otherCount = total - (userReactionData ? 1 : 0);

  return (
    <div 
      className={`reaction-summary ${className}`.trim()} 
      aria-label={`${total} reactions`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="reaction-display-stack" aria-hidden="true">
        {visibleTypes.map(({ type }, index) => (
          <span
            key={type}
            className="reaction-display-badge"
            data-reaction={type}
            style={{ zIndex: index + 1 }}
          >
            <ReactionIcon 
              type={type} 
              variant="badge" 
              className="reaction-display-icon" 
            />
          </span>
        ))}
      </div>
      <span className="reaction-summary-total">{formatReactionCount(total)}</span>
      
      {showTooltip && userReactionData && (
        <div className="reaction-tooltip">
          <span className="reaction-tooltip-user">
            {userReactionData.label}
          </span>
          {otherCount > 0 && (
            <span className="reaction-tooltip-others">
              and {formatReactionCount(otherCount)} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

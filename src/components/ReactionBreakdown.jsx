import { formatReactionCount, getReactionTotalCount, normalizeReactionBreakdown } from '../lib/reactions.js';
import ReactionIcon from './ReactionIcon.jsx';

export default function ReactionBreakdown({ breakdown, maxTypes = 3, className = '', userReaction }) {
  const items = normalizeReactionBreakdown(breakdown);
  const total = getReactionTotalCount(items);

  if (items.length === 0 || total <= 0) return null;

  // Show user's own reaction if they have one, otherwise show top reaction
  const topReactionType = userReaction || items[0].type;
  const visibleTypes = items.slice(0, maxTypes);

  return (
    <div className={`reaction-summary ${className}`.trim()} aria-label={`${total} reactions`}>
      <div className="reaction-summary-count">
        <span className="reaction-summary-leading">
          <ReactionIcon 
            type={topReactionType} 
            variant="leading" 
            className="reaction-summary-leading-icon" 
          />
        </span>
        <span className="reaction-summary-total">{formatReactionCount(total)}</span>
      </div>

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
    </div>
  );
}

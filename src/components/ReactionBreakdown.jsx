import { formatReactionCount, normalizeReactionBreakdown } from '../lib/reactions.js';
import ReactionIcon from './ReactionIcon.jsx';

export default function ReactionBreakdown({ breakdown, totalCount, maxTypes = 3, className = '' }) {
  const items = normalizeReactionBreakdown(breakdown);

  if (items.length === 0) return null;

  const total = totalCount ?? items.reduce((sum, { count }) => sum + count, 0);
  const topReactionType = items[0].type;
  const visibleTypes = items.slice(0, maxTypes);

  return (
    <div className={`reaction-summary ${className}`.trim()} aria-label={`${total} reactions`}>
      <div className="reaction-summary-count">
        <ReactionIcon type={topReactionType} size={18} className="reaction-summary-leading-icon" />
        <span className="reaction-summary-total">{formatReactionCount(total)}</span>
      </div>

      <div className="reaction-display-stack" aria-hidden="true">
        {visibleTypes.map(({ type }, index) => (
          <span
            key={type}
            className="reaction-display-badge"
            style={{ zIndex: index + 1 }}
          >
            <ReactionIcon type={type} size={14} className="reaction-display-icon" />
          </span>
        ))}
      </div>
    </div>
  );
}

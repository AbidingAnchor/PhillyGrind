import { normalizeReactionBreakdown } from '../lib/reactions.js';
import ReactionIcon from './ReactionIcon.jsx';

export default function ReactionBreakdown({ breakdown, totalCount, maxTypes = 3, className = '' }) {
  const items = normalizeReactionBreakdown(breakdown);

  if (items.length === 0) return null;

  const total = totalCount ?? items.reduce((sum, { count }) => sum + count, 0);

  return (
    <div className={`reaction-display ${className}`.trim()} aria-label={`${total} reactions`}>
      {items.slice(0, maxTypes).map(({ type, count }) => (
        <span key={type} className="reaction-display-item">
          <ReactionIcon type={type} size={18} className="reaction-display-icon" />
          <span className="reaction-display-count">{count}</span>
        </span>
      ))}
      {items.length > maxTypes && (
        <span className="reaction-display-more">+{items.length - maxTypes}</span>
      )}
      <span className="reaction-display-total">{total}</span>
    </div>
  );
}

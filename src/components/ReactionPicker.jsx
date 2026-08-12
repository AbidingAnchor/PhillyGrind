import { REACTIONS } from '../lib/reactions.js';
import ReactionIcon from './ReactionIcon.jsx';

export default function ReactionPicker({ onSelect, className = '' }) {
  return (
    <div
      className={`feed-post-reaction-picker ${className}`.trim()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Choose a reaction"
    >
      {REACTIONS.map((reaction, index) => (
        <button
          key={reaction.type}
          type="button"
          className="reaction-option"
          style={{ '--reaction-delay': `${index * 35}ms` }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSelect(reaction.type);
          }}
          title={reaction.label}
          aria-label={reaction.label}
        >
          <ReactionIcon type={reaction.type} variant="picker" className="reaction-icon-picker" />
        </button>
      ))}
    </div>
  );
}

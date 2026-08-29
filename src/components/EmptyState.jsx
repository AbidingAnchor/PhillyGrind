import { Link } from 'react-router-dom';
import { Package, Search, Home, Briefcase, MessageSquare } from 'lucide-react';

const ICONS = {
  default: Package,
  search: Search,
  housing: Home,
  jobs: Briefcase,
  community: MessageSquare,
};

export default function EmptyState({
  icon = 'default',
  title,
  message,
  action,
  actionLabel,
  actionHref,
  actionClassName = 'primary-button empty-state-button',
  actionIcon = null,
  onAction,
}) {
  const IconComponent = ICONS[icon] || ICONS.default;
  const showAction = Boolean(action && actionLabel && (actionHref || onAction));

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <IconComponent size={64} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
      {showAction && actionHref && (
        <Link className={actionClassName} to={actionHref}>
          {actionIcon}
          {actionLabel}
        </Link>
      )}
      {showAction && !actionHref && onAction && (
        <button className={actionClassName} type="button" onClick={onAction}>
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

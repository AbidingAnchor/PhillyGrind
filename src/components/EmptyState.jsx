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
  onAction,
}) {
  const IconComponent = ICONS[icon] || ICONS.default;

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <IconComponent size={64} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
      {action && onAction && (
        <button className="primary-button empty-state-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

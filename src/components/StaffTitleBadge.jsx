import { getStaffTitle } from '../lib/staffTitles.js';

export default function StaffTitleBadge({ title, variant = 'feed' }) {
  const meta = getStaffTitle(title);
  if (!meta) return null;

  const label = variant === 'profile' ? meta.profile : meta.badge;

  return (
    <span
      className={`staff-title-badge staff-title-badge--${meta.id}${variant === 'profile' ? ' staff-title-badge--profile' : ''}`}
      title={meta.profile}
    >
      {label}
    </span>
  );
}

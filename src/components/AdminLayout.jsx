import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  LayoutDashboard,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Users,
  BadgeCheck,
  Home,
  MessageSquare,
  Mail,
} from 'lucide-react';
import { getUnreviewedModerationCount } from '../lib/adminApi.js';
import { getNewContactCount } from '../lib/contactApi.js';

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/listings', label: 'Listings', icon: ShoppingBag },
  { to: '/admin/housing', label: 'Housing', icon: Home },
  { to: '/admin/community', label: 'Community', icon: MessageSquare },
  { to: '/admin/disputes', label: 'Disputes', icon: AlertTriangle },
  { to: '/admin/reports', label: 'Reports', icon: ClipboardList },
  { to: '/admin/verifications', label: 'Verifications', icon: BadgeCheck },
  { to: '/admin/moderation', label: 'Moderation', icon: ShieldAlert, showBadge: 'moderation' },
  { to: '/admin/contact', label: 'Contact', icon: Mail, showBadge: 'contact' },
];

export default function AdminLayout() {
  const [unreviewedCount, setUnreviewedCount] = useState(0);
  const [newContactCount, setNewContactCount] = useState(0);

  useEffect(() => {
    async function loadCounts() {
      try {
        const [modCount, contactCount] = await Promise.all([
          getUnreviewedModerationCount(),
          getNewContactCount(),
        ]);
        setUnreviewedCount(modCount);
        setNewContactCount(contactCount);
      } catch (error) {
        console.error('Failed to load admin counts:', error);
      }
    }
    loadCounts();
  }, []);

  const getBadgeCount = (badgeType) => {
    if (badgeType === 'moderation') return unreviewedCount;
    if (badgeType === 'contact') return newContactCount;
    return 0;
  };

  return (
    <section className="page-section admin-dashboard">
      <div className="admin-dashboard-shell">
        <aside className="admin-sidebar profile-section-card">
          <header className="admin-sidebar-header">
            <Shield size={22} />
            <div>
              <span className="eyebrow">PhillyGrind</span>
              <h2>Admin</h2>
            </div>
          </header>
          <nav className="admin-sidebar-nav">
            {navItems.map(({ to, label, icon: Icon, end, showBadge }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `admin-sidebar-link${isActive ? ' active' : ''}`}
              >
                <Icon size={18} />
                {label}
                {showBadge && getBadgeCount(showBadge) > 0 && (
                  <span className="admin-nav-badge">{getBadgeCount(showBadge)}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="admin-main">
          <Outlet />
        </div>
      </div>
    </section>
  );
}

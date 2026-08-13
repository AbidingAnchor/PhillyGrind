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
} from 'lucide-react';
import { getUnreviewedModerationCount } from '../lib/adminApi.js';

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/listings', label: 'Listings', icon: ShoppingBag },
  { to: '/admin/housing', label: 'Housing', icon: Home },
  { to: '/admin/community', label: 'Community', icon: MessageSquare },
  { to: '/admin/disputes', label: 'Disputes', icon: AlertTriangle },
  { to: '/admin/reports', label: 'Reports', icon: ClipboardList },
  { to: '/admin/verifications', label: 'Verifications', icon: BadgeCheck },
  { to: '/admin/moderation', label: 'Moderation', icon: ShieldAlert, showBadge: true },
];

export default function AdminLayout() {
  const [unreviewedCount, setUnreviewedCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      try {
        const count = await getUnreviewedModerationCount();
        setUnreviewedCount(count);
      } catch (error) {
        console.error('Failed to load moderation count:', error);
      }
    }
    loadCount();
  }, []);

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
                {showBadge && unreviewedCount > 0 && (
                  <span className="admin-nav-badge">{unreviewedCount}</span>
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

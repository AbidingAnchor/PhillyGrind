import { NavLink, Outlet } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  LayoutDashboard,
  Shield,
  ShoppingBag,
  Users,
  BadgeCheck,
  Home,
} from 'lucide-react';

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/listings', label: 'Listings', icon: ShoppingBag },
  { to: '/admin/housing', label: 'Housing', icon: Home },
  { to: '/admin/disputes', label: 'Disputes', icon: AlertTriangle },
  { to: '/admin/reports', label: 'Reports', icon: ClipboardList },
  { to: '/admin/verifications', label: 'Verifications', icon: BadgeCheck },
];

export default function AdminLayout() {
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
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `admin-sidebar-link${isActive ? ' active' : ''}`}
              >
                <Icon size={18} />
                {label}
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Briefcase, FileText, LayoutDashboard, ShoppingBag, Users, AlertTriangle, ClipboardList } from 'lucide-react';
import { getAdminOverview } from '../../lib/adminApi.js';

const statCards = [
  { key: 'totalUsers', label: 'Total Users', icon: Users },
  { key: 'totalJobs', label: 'Jobs Posted', icon: Briefcase },
  { key: 'totalGigs', label: 'Gigs Posted', icon: Activity },
  { key: 'totalMarketplace', label: 'Marketplace Listings', icon: ShoppingBag },
  { key: 'totalApplications', label: 'Applications', icon: FileText },
  { key: 'openDisputes', label: 'Open Disputes', icon: AlertTriangle },
  { key: 'pendingReports', label: 'Pending Reports', icon: ClipboardList },
];

function activityLink(item) {
  if (item.type === 'job') return `/jobs/${item.id}`;
  if (item.type === 'gig') return `/gigs/${item.id}`;
  if (item.type === 'marketplace') return `/marketplace/${item.id}`;
  if (item.type === 'dispute') return '/admin/disputes';
  if (item.type === 'report') return '/admin/reports';
  return null;
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await getAdminOverview();
        if (!cancelled) {
          setStats(data.stats);
          setActivity(data.activity ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <LayoutDashboard size={28} />
        <div>
          <h1>Overview</h1>
          <p>Platform stats and recent activity</p>
        </div>
      </header>

      {loading && <p className="empty-state">Loading overview...</p>}
      {error && <p className="empty-state error-state">{error}</p>}

      {stats && (
        <div className="admin-stat-grid">
          {statCards.map(({ key, label, icon: Icon }) => (
            <div key={key} className="admin-stat-card profile-section-card">
              <Icon size={20} />
              <div>
                <span className="admin-stat-value">{stats[key] ?? 0}</span>
                <span className="admin-stat-label">{label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="profile-section-card admin-activity-card">
          <h2>Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="empty-state">No recent activity.</p>
          ) : (
            <ul className="admin-activity-list">
              {activity.map((item) => {
                const href = activityLink(item);
                const content = (
                  <>
                    <span className="admin-activity-type">{item.type}</span>
                    <span className="admin-activity-title">{item.title}</span>
                    <span className="admin-activity-date">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </>
                );

                return (
                  <li key={`${item.type}-${item.id}`}>
                    {href ? <Link to={href}>{content}</Link> : <div>{content}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

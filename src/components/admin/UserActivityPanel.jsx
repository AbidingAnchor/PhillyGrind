import { useState } from 'react';

const TABS = [
  { id: 'jobs', label: 'Jobs', key: 'jobs', titleKey: 'title' },
  { id: 'gigs', label: 'Gigs', key: 'gigs', titleKey: 'title' },
  { id: 'marketplace', label: 'Marketplace', key: 'marketplace_listings', titleKey: 'title' },
  { id: 'housing', label: 'Housing', key: 'housing_listings', titleKey: 'title' },
  { id: 'orders', label: 'Orders', keys: ['gig_orders', 'marketplace_orders'], synthetic: true },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function ActivityRow({ item, titleKey = 'title' }) {
  const label = item[titleKey] || item.type || item.status || item.id;
  return (
    <li className="admin-case-activity-row">
      <span>{label}</span>
      <span className="admin-case-meta-line">{formatDate(item.created_at)}</span>
      {item.status && <span className="report-type-tag">{item.status}</span>}
      {item.role && <span className="report-type-tag">{item.role}</span>}
      {item.amount && <span className="report-type-tag">{item.amount}</span>}
    </li>
  );
}

export default function UserActivityPanel({ activity }) {
  const [activeTab, setActiveTab] = useState('jobs');

  if (!activity) {
    return (
      <section className="admin-case-panel">
        <h2>Activity</h2>
        <p className="empty-state">No activity — subject account unknown.</p>
      </section>
    );
  }

  const currentTab = TABS.find((tab) => tab.id === activeTab) || TABS[0];

  let items = [];
  if (currentTab.synthetic) {
    items = [...(activity.gig_orders || []), ...(activity.marketplace_orders || [])]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else {
    items = activity[currentTab.key] || [];
  }

  return (
    <section className="admin-case-panel">
      <h2>Activity</h2>
      <div className="admin-case-tabs" role="tablist">
        {TABS.map((tab) => {
          const count = tab.synthetic
            ? (activity.gig_orders?.length || 0) + (activity.marketplace_orders?.length || 0)
            : (activity[tab.key]?.length || 0);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>
      {items.length === 0 ? (
        <p className="empty-state">No {currentTab.label.toLowerCase()} on record.</p>
      ) : (
        <ul className="admin-case-activity-list">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} titleKey={currentTab.titleKey} />
          ))}
        </ul>
      )}
    </section>
  );
}

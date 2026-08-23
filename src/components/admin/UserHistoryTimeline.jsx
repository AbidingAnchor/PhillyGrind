function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function UserHistoryTimeline({ history }) {
  const items = history || [];

  return (
    <section className="admin-case-panel admin-case-history">
      <h2>History timeline</h2>
      {items.length === 0 ? (
        <p className="empty-state">No prior reports, tickets, or disputes for this user.</p>
      ) : (
        <ol className="admin-case-timeline">
          {items.map((item) => (
            <li key={item.id} className="admin-case-timeline-item">
              <div className="admin-case-timeline-dot" />
              <div>
                <div className="admin-case-timeline-head">
                  <strong>{item.label}</strong>
                  {item.status && (
                    <span className="report-status-badge" data-status={item.status}>
                      {item.status}
                    </span>
                  )}
                </div>
                {item.detail && <p>{item.detail}</p>}
                <time className="admin-case-meta-line">{formatDate(item.created_at)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

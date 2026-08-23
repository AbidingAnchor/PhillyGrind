function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function SnapshotList({ title, items }) {
  return (
    <div className="recovery-snapshot-block">
      <strong>{title}</strong>
      {items.length === 0 ? (
        <p className="recovery-snapshot-empty">None</p>
      ) : (
        <ul className="recovery-snapshot-list">
          {items.map((item) => (
            <li key={item.key}>
              <span className="recovery-snapshot-date">{item.date}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SnapshotBody({ snapshot }) {
  if (!snapshot) {
    return <p className="empty-state">No snapshot available.</p>;
  }

  const profile = snapshot.profile || {};

  return (
    <>
      <div className="admin-case-profile-meta">
        <p><strong>{profile.name || 'Unknown'}</strong></p>
        <p>{profile.email || '—'}</p>
        <p>{profile.account_reference || '—'}</p>
        <p>Joined {formatDate(profile.created_at)}</p>
        <p>Neighborhoods: {(snapshot.neighborhoods || []).join(', ') || '—'}</p>
      </div>
      <SnapshotList
        title="Name history"
        items={(snapshot.name_history || []).map((row, index) => ({
          key: `${row.old_name}-${row.new_name}-${row.changed_at}-${index}`,
          date: formatDate(row.changed_at),
          text: `${row.old_name} → ${row.new_name}`,
        }))}
      />
      <SnapshotList
        title="Recent posts"
        items={(snapshot.posts || []).map((row) => ({
          key: row.id,
          date: formatDate(row.created_at),
          text: row.content || '—',
        }))}
      />
      <SnapshotList
        title="Recent comments"
        items={(snapshot.comments || []).map((row) => ({
          key: row.id,
          date: formatDate(row.created_at),
          text: row.content || '—',
        }))}
      />
      <SnapshotList
        title="Listings"
        items={(snapshot.listings || []).map((row) => ({
          key: `${row.type}-${row.id}`,
          date: formatDate(row.created_at),
          text: `${row.type}: ${row.title}`,
        }))}
      />
    </>
  );
}

export default function UserSnapshotPanel({
  snapshot,
  title = 'Subject account',
  recoveryMode = false,
  frozenSnapshot,
  liveSnapshot,
  liveEnabled = false,
  onToggleLive,
  liveLoading = false,
}) {
  const displaySnapshot = recoveryMode
    ? (liveEnabled ? liveSnapshot : frozenSnapshot)
    : snapshot;

  if (!recoveryMode && !snapshot) {
    return (
      <section className="admin-case-panel">
        <h2>{title}</h2>
        <p className="empty-state">No account linked to this case.</p>
      </section>
    );
  }

  return (
    <section className="admin-case-panel">
      <div className="admin-case-panel-head">
        <h2>{recoveryMode ? 'Account snapshot' : title}</h2>
        {recoveryMode && (
          <label className="admin-case-live-toggle">
            <input
              type="checkbox"
              checked={liveEnabled}
              disabled={liveLoading}
              onChange={(event) => onToggleLive?.(event.target.checked)}
            />
            <span>Live refresh{liveLoading ? '…' : ''}</span>
          </label>
        )}
      </div>
      {recoveryMode && (
        <p className="admin-case-policy-note">
          {liveEnabled
            ? 'Showing current account state (may differ from submission time).'
            : 'Frozen snapshot from when they submitted — default for review.'}
        </p>
      )}
      <SnapshotBody snapshot={displaySnapshot} />
    </section>
  );
}

function Bone({ className = '', style }) {
  return <span className={`skeleton-bone ${className}`.trim()} style={style} aria-hidden="true" />;
}

function FeedPosts({ count = 3 }) {
  return (
    <div className="skeleton-feed">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-feed-post" key={index}>
          <div className="skeleton-feed-header">
            <Bone className="skeleton-avatar-sm" />
            <div className="skeleton-feed-meta">
              <Bone className="skeleton-line skeleton-line-sm" />
              <Bone className="skeleton-line skeleton-line-xs" />
            </div>
          </div>
          <Bone className="skeleton-line" />
          <Bone className="skeleton-line skeleton-line-wide" />
          <Bone className="skeleton-thumb" />
        </div>
      ))}
    </div>
  );
}

export function Skeleton({ variant = 'page', count }) {
  if (variant === 'profile') {
    return (
      <div className="skeleton-profile" role="status" aria-label="Loading profile">
        <div className="skeleton-profile-cover-wrap">
          <Bone className="skeleton-profile-cover" />
          <Bone className="skeleton-profile-avatar" />
        </div>
        <div className="skeleton-profile-identity">
          <Bone className="skeleton-line skeleton-line-title" />
          <Bone className="skeleton-line skeleton-line-md" />
        </div>
        <div className="skeleton-profile-tabs">
          <Bone className="skeleton-tab" />
          <Bone className="skeleton-tab" />
          <Bone className="skeleton-tab" />
          <Bone className="skeleton-tab" />
        </div>
        <div className="skeleton-profile-grid">
          <div className="skeleton-card">
            <Bone className="skeleton-line skeleton-line-sm" />
            <Bone className="skeleton-line" />
            <Bone className="skeleton-line skeleton-line-sm" />
            <Bone className="skeleton-line skeleton-line-md" />
            <Bone className="skeleton-line skeleton-line-sm" />
            <Bone className="skeleton-line skeleton-line-wide" />
          </div>
          <div className="skeleton-card">
            <FeedPosts count={2} />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'feed') {
    return (
      <div role="status" aria-label="Loading posts">
        <FeedPosts count={count || 3} />
      </div>
    );
  }

  if (variant === 'comments') {
    return (
      <div className="skeleton-comments" role="status" aria-label="Loading comments">
        {Array.from({ length: count || 3 }, (_, index) => (
          <div className="skeleton-comment" key={index}>
            <Bone className="skeleton-avatar-xs" />
            <div className="skeleton-comment-copy">
              <Bone className="skeleton-line skeleton-line-sm" />
              <Bone className="skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'messages') {
    return (
      <div className="skeleton-messages" role="status" aria-label="Loading messages">
        <Bone className="skeleton-bubble skeleton-bubble-in" />
        <Bone className="skeleton-bubble skeleton-bubble-out" />
        <Bone className="skeleton-bubble skeleton-bubble-in" />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="skeleton-list" role="status" aria-label="Loading">
        {Array.from({ length: count || 5 }, (_, index) => (
          <div className="skeleton-list-row" key={index}>
            <Bone className="skeleton-avatar-sm" />
            <div className="skeleton-list-copy">
              <Bone className="skeleton-line skeleton-line-md" />
              <Bone className="skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'settings') {
    return (
      <div className="skeleton-settings" role="status" aria-label="Loading settings">
        <Bone className="skeleton-line skeleton-line-title" />
        {Array.from({ length: count || 5 }, (_, index) => (
          <div className="skeleton-card skeleton-settings-row" key={index}>
            <Bone className="skeleton-icon" />
            <div className="skeleton-list-copy">
              <Bone className="skeleton-line skeleton-line-md" />
              <Bone className="skeleton-line skeleton-line-wide" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'groupCards') {
    return (
      <div className="skeleton-group-cards groups-browse-grid" role="status" aria-label="Loading groups">
        {Array.from({ length: count || 6 }, (_, index) => (
          <div className="skeleton-group-card" key={index}>
            <Bone className="skeleton-group-cover" />
            <Bone className="skeleton-group-avatar" />
            <div className="skeleton-group-body">
              <Bone className="skeleton-line skeleton-line-xs" />
              <Bone className="skeleton-line skeleton-line-md" />
              <Bone className="skeleton-line" />
              <Bone className="skeleton-line skeleton-line-sm" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="skeleton-cards" role="status" aria-label="Loading listings">
        {Array.from({ length: count || 6 }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <Bone className="skeleton-thumb" />
            <Bone className="skeleton-line skeleton-line-md" />
            <Bone className="skeleton-line skeleton-line-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="skeleton-detail" role="status" aria-label="Loading">
        <Bone className="skeleton-detail-hero" />
        <Bone className="skeleton-line skeleton-line-title" />
        <Bone className="skeleton-line skeleton-line-md" />
        <Bone className="skeleton-line" />
        <Bone className="skeleton-line skeleton-line-wide" />
      </div>
    );
  }

  return (
    <div className="skeleton-page" role="status" aria-label="Loading">
      <Bone className="skeleton-line skeleton-line-title" />
      <Bone className="skeleton-line skeleton-line-md" />
      <div className="skeleton-card">
        <Bone className="skeleton-line" />
        <Bone className="skeleton-line skeleton-line-wide" />
        <Bone className="skeleton-line skeleton-line-sm" />
      </div>
    </div>
  );
}

export default Skeleton;

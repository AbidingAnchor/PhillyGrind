import { Link } from 'react-router-dom';
import { ArrowRight, Gavel, MapPin } from 'lucide-react';
import StarRating from './StarRating.jsx';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeDisplayName(value, fallback = 'PhillyGrind user') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

function ListingCard({ listing }) {
  const detailPath = listing.type === 'gig' ? `/gigs/${listing.id}` : `/jobs/${listing.id}`;
  const profilePath = listing.user_id ? `/profile/${listing.user_id}` : '';
  const posterName = safeDisplayName(listing.posterName || listing.company);
  const boostBadge = listing.is_boosted
    ? listing.boost_tier === 'pro'
      ? '⭐ Pro'
      : '⭐ Featured'
    : '';
  const gigBadge = listing.type === 'gig'
    ? listing.post_type === 'offering'
      ? 'Service offered'
      : 'Help wanted'
    : '';
  const initials = posterName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <article className={`listing-card ${listing.is_boosted ? `boosted ${listing.boost_tier}` : ''}`}>
      <div className="listing-card-top">
        <span className="poster-avatar">{initials}</span>
        <div>
          <div className="listing-badge-row">
            <span className="pill">{listing.category}</span>
            {boostBadge && <span className={`boost-badge ${listing.boost_tier}`}>{boostBadge}</span>}
            {gigBadge && <span className={`post-type-badge ${listing.post_type}`}>{gigBadge}</span>}
          </div>
          <h3>{listing.title}</h3>
          <p>
            {profilePath ? (
              <Link
                className="poster-name-link"
                to={profilePath}
                onClick={() => console.log('Opening poster profile from card', { userId: listing.user_id, profilePath })}
              >
                {posterName}
              </Link>
            ) : posterName}
          </p>
          <StarRating rating={listing.posterRating?.average} count={listing.posterRating?.count} compact />
        </div>
      </div>
      <div className="listing-meta">
        <span><MapPin size={16} /> {listing.neighborhood}</span>
        {listing.type === 'gig' && listing.post_type === 'seeking' && (
          <span className="bid-count-chip"><Gavel size={16} /> {listing.bidCount || 0} {(listing.bidCount || 0) === 1 ? 'Bid' : 'Bids'}</span>
        )}
        <strong>{listing.pay}</strong>
      </div>
      <p className="listing-description">{listing.description}</p>
      <Link to={detailPath} className="text-link">
        View details <ArrowRight size={16} />
      </Link>
    </article>
  );
}

export default ListingCard;

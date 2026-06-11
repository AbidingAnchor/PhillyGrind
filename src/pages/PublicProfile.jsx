import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, Star } from 'lucide-react';
import StarRating from '../components/StarRating.jsx';
import { getPublicProfileStats } from '../lib/profileApi.js';
import { getUserReviews } from '../lib/reviewsApi.js';

function getInitials(name) {
  return (name || 'PhillyGrind user')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function PublicProfile() {
  const { userId } = useParams();
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState({ completedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError('');

    Promise.all([
      getUserReviews(userId),
      getPublicProfileStats(userId),
    ])
      .then(([nextProfileData, nextStats]) => {
        setProfileData(nextProfileData);
        setStats(nextStats);
      })
      .catch((err) => setError(err.message || 'Could not load this profile.'))
      .finally(() => setLoading(false));
  }, [userId]);

  const profile = profileData?.profile;
  const completedCount = stats.completedCount ?? 0;
  const ratingAverage = profileData?.rating.average || 0;
  const reviewCount = profileData?.rating.count || 0;

  return (
    <section className="profile-page">
      <Link className="text-link" to="/gigs"><ArrowLeft size={16} /> Back to listings</Link>
      {loading && <p className="empty-state">Loading profile...</p>}
      {error && <p className="empty-state error-state">{error}</p>}
      {!loading && !error && profileData && (
        <>
          <div className="profile-header public-profile-header">
            <span className="profile-avatar-large">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt={`${profileData.profileName} profile`} /> : getInitials(profileData.profileName)}
            </span>
            <div>
              <span className="eyebrow">Public Worker Profile</span>
              <h1>{profileData.profileName}</h1>
              <p>
                Member since{' '}
                {profileData.profileCreatedAt
                  ? new Date(profileData.profileCreatedAt).toLocaleDateString([], { month: 'long', year: 'numeric' })
                  : 'recently'}
              </p>
              <div className="public-profile-rating-line">
                <StarRating rating={ratingAverage} compact />
                <span>{reviewCount} review{reviewCount === 1 ? '' : 's'}</span>
              </div>
              {profile?.availability && <span className={`availability-badge ${profile.availability === 'Available Now' ? 'available' : profile.availability === 'Not Available' ? 'unavailable' : ''}`}>{profile.availability}</span>}
            </div>
          </div>

          <section className="profile-section-card public-profile-stats">
            <div className="public-stat-item">
              <span className="public-stat-icon"><BriefcaseBusiness size={22} /></span>
              <div>
                <span className="eyebrow">Completed Work</span>
                <strong>{completedCount > 0 ? completedCount : 'New to PhillyGrind'}</strong>
                <p>{completedCount > 0 ? 'completed gigs/jobs' : 'Building their first track record'}</p>
              </div>
            </div>
            <div className="public-stat-item">
              <span className="public-stat-icon"><Star size={22} /></span>
              <div>
                <span className="eyebrow">Reputation</span>
                <strong>{ratingAverage ? ratingAverage.toFixed(1) : 'New'}</strong>
                <p>{reviewCount} review{reviewCount === 1 ? '' : 's'} from PhillyGrind users</p>
              </div>
            </div>
          </section>

          {Boolean(profile?.bio || profile?.skills?.length > 0 || profile?.neighborhoods?.length > 0) && (
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <span className="eyebrow">About</span>
                <h2>Work Profile</h2>
              </div>
              {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
              {profile?.skills?.length > 0 && (
                <div>
                  <h3 className="profile-mini-heading">Skills</h3>
                  <div className="profile-pill-row">{profile.skills.map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}</div>
                </div>
              )}
              {profile?.neighborhoods?.length > 0 && (
                <div>
                  <h3 className="profile-mini-heading">Neighborhoods served</h3>
                  <div className="profile-pill-row">{profile.neighborhoods.map((neighborhood) => <span className="neighborhood-pill" key={neighborhood}>{neighborhood}</span>)}</div>
                </div>
              )}
            </section>
          )}

          <section className="profile-section-card">
            <div className="profile-section-heading">
              <span className="eyebrow">Reviews</span>
              <h2>What people say</h2>
            </div>
            <div className="reviews-list">
              {profileData.reviews.map((review) => (
                <article key={review.id} className="review-card public-review-card">
                  <div className="public-review-topline">
                    <div>
                      <strong>{review.reviewerName}</strong>
                      <StarRating rating={review.rating} compact />
                    </div>
                    <time>{new Date(review.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</time>
                  </div>
                  <p>{review.comment}</p>
                </article>
              ))}
              {!profileData.reviews.length && <p className="empty-state">No reviews yet.</p>}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

export default PublicProfile;

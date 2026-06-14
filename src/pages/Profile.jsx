import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ListingCard from '../components/ListingCard.jsx';
import StarRating from '../components/StarRating.jsx';
import { createBoostCheckout } from '../lib/boostsApi.js';
import { getUserListings } from '../lib/listingsApi.js';
import { checkConnectStatus, getResumeUrl, updateProfile, uploadAvatar, uploadResume } from '../lib/profileApi.js';
import { getUserReviews } from '../lib/reviewsApi.js';
import { getMyBids } from '../lib/bidsApi.js';
import { createConnectAccount } from '../lib/ordersApi.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

const availabilityOptions = ['Available Now', 'Weekends Only', 'Evenings Only', 'Not Available'];
const activeGigStatuses = new Set(['in progress', 'in_progress']);

function resumeFilename(path) {
  if (!path) return '';
  const parts = path.split('/');
  return parts[parts.length - 1] || 'resume.pdf';
}

function getProfileResumePath(profile) {
  return profile?.resume_url || profile?.resume_path || '';
}

function getInitials(name) {
  return (name || 'PhillyGrind user')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function TagEditor({ label, placeholder, tags, onChange }) {
  const [value, setValue] = useState('');

  function addTag() {
    const nextTag = value.trim();
    if (!nextTag || tags.includes(nextTag)) return;

    onChange([...tags, nextTag]);
    setValue('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    }
  }

  return (
    <label>
      {label}
      <div className="tag-editor">
        <div className="profile-pill-row">
          {tags.map((tag) => (
            <button key={tag} type="button" className="editable-pill" onClick={() => onChange(tags.filter((item) => item !== tag))}>
              {tag} x
            </button>
          ))}
        </div>
        <div className="tag-editor-input">
          <input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} />
          <button type="button" onClick={addTag}>Add</button>
        </div>
      </div>
    </label>
  );
}

function Profile() {
  const { userId } = useParams();
  const { user, isLoggedIn, profile: authProfile, refreshProfile } = useAuth();
  const viewedUserId = userId || user?.id;
  const [profileData, setProfileData] = useState(null);
  const [listings, setListings] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [marketplaceOrders, setMarketplaceOrders] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: '', skills: [], availability: '', neighborhoods: [] });
  const [resumeUrl, setResumeUrl] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [renewingBoostId, setRenewingBoostId] = useState('');
  const [connectingPayouts, setConnectingPayouts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isOwnProfile = isLoggedIn && user?.id === viewedUserId;
  const hasStripeAccount = Boolean(isOwnProfile && authProfile?.stripe_account_id);
  const payoutsConnected = Boolean(hasStripeAccount && authProfile?.stripe_onboarding_complete);
  const activeBoosts = listings.filter((listing) => (
    listing.is_boosted
    && listing.boost_tier
    && listing.boost_expires_at
    && new Date(listing.boost_expires_at) > new Date()
  ));

  useEffect(() => {
    if (!viewedUserId) return;

    setLoading(true);
    setError('');

    Promise.all([
      getUserReviews(viewedUserId),
      getUserListings(viewedUserId),
    ])
      .then(([nextProfileData, nextListings]) => {
        setProfileData(nextProfileData);
        setListings(nextListings);
        setForm({
          bio: nextProfileData.profile?.bio || '',
          skills: nextProfileData.profile?.skills || [],
          availability: nextProfileData.profile?.availability || '',
          neighborhoods: nextProfileData.profile?.neighborhoods || [],
        });
      })
      .catch((err) => setError(err.message || 'Could not load this profile.'))
      .finally(() => setLoading(false));
  }, [viewedUserId]);

  useEffect(() => {
    if (!isOwnProfile) {
      setMyBids([]);
      return;
    }

    getMyBids()
      .then(setMyBids)
      .catch((err) => console.warn(err));
  }, [isOwnProfile]);

  useEffect(() => {
    if (!viewedUserId) return;

    async function loadMarketplaceData() {
      try {
        const [listingsData, ordersData] = await Promise.all([
          supabase
            .from('marketplace_listings')
            .select('*')
            .eq('user_id', viewedUserId)
            .eq('status', 'active')
            .order('created_at', { ascending: false }),
          supabase
            .from('marketplace_orders')
            .select('*, marketplace_listings(title, price, photos, location)')
            .or(`buyer_id.eq.${viewedUserId},seller_id.eq.${viewedUserId}`)
            .in('status', ['pending', 'held', 'delivered_pending_confirmation', 'disputed'])
            .order('created_at', { ascending: false }),
        ]);

        setMarketplaceListings(listingsData.data || []);
        setMarketplaceOrders(ordersData.data || []);
      } catch (err) {
        console.warn('Error loading marketplace data:', err);
      }
    }

    loadMarketplaceData();
  }, [viewedUserId]);

  useEffect(() => {
    const resumeRef = getProfileResumePath(profileData?.profile);
    if (!isOwnProfile || !resumeRef) {
      setResumeUrl('');
      return;
    }

    getResumeUrl(resumeRef)
      .then(setResumeUrl)
      .catch((err) => console.warn(err));
  }, [isOwnProfile, profileData]);

  useEffect(() => {
    if (!isOwnProfile || !authProfile?.stripe_account_id || authProfile?.stripe_onboarding_complete) {
      return;
    }

    let active = true;
    checkConnectStatus()
      .then(async (status) => {
        if (!active) return;

        if (status.stripe_onboarding_complete) {
          await refreshProfile();
          if (active) setProfileStatus('Stripe payouts are connected.');
        }
      })
      .catch((err) => console.warn(err));

    return () => {
      active = false;
    };
  }, [authProfile?.stripe_account_id, authProfile?.stripe_onboarding_complete, isOwnProfile, refreshProfile]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setProfileStatus('');

    try {
      const nextProfile = await updateProfile(form);
      setProfileData((current) => current ? {
        ...current,
        profile: nextProfile,
      } : current);
      setEditing(false);
      setProfileStatus('Profile updated.');
    } catch (err) {
      setProfileStatus(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleResumeUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setProfileStatus('');

    try {
      const nextProfile = await uploadResume(file);
      setProfileData((current) => current ? {
        ...current,
        profile: nextProfile,
      } : current);
      const nextUrl = await getResumeUrl(getProfileResumePath(nextProfile));
      setResumeUrl(nextUrl);
      await refreshProfile();
      setProfileStatus('Resume uploaded.');
    } catch (err) {
      setProfileStatus(err.message || 'Could not upload resume.');
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setProfileStatus('');

    try {
      const nextProfile = await uploadAvatar(file);
      setProfileData((current) => current ? {
        ...current,
        profile: nextProfile,
      } : current);
      setProfileStatus('Profile photo uploaded.');
    } catch (err) {
      setProfileStatus(err.message || 'Could not upload profile photo.');
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  }

  async function handleConnectPayouts() {
    setConnectingPayouts(true);
    setProfileStatus('');

    try {
      const { url } = await createConnectAccount();
      window.location.href = url;
    } catch (err) {
      setProfileStatus(err.message || 'Could not start Stripe onboarding.');
      setConnectingPayouts(false);
    }
  }

  async function handleRenewBoost(listing) {
    setRenewingBoostId(`${listing.type}-${listing.id}`);
    setProfileStatus('');

    try {
      const { url } = await createBoostCheckout({
        listingId: listing.id,
        listingType: listing.type,
        tier: listing.boost_tier || 'basic',
      });
      window.location.href = url;
    } catch (err) {
      setProfileStatus(err.message || 'Could not start boost checkout.');
      setRenewingBoostId('');
    }
  }

  const profile = profileData?.profile;
  const resumeStoragePath = getProfileResumePath(profile);
  const resumeDisplayName = resumeFilename(resumeStoragePath);

  function isActiveAcceptedBid(bid) {
    return Boolean(
      bid.status === 'accepted'
      && bid.listing?.id
      && activeGigStatuses.has(String(bid.listing.status || '').toLowerCase()),
    );
  }

  function renderBidCard(bid) {
    const activeAcceptedBid = isActiveAcceptedBid(bid);
    const content = (
      <>
        <div className="bid-card-header">
          <div>
            <strong>{bid.listing?.title || 'Gig listing'}</strong>
            <span>{new Date(bid.created_at).toLocaleDateString()}</span>
          </div>
          <span className={`bid-status ${bid.status}`}>{bid.status}</span>
        </div>
        <p>{bid.pitch}</p>
        {bid.listing && (
          <span className="detail-note">
            {bid.listing.neighborhood} · {bid.listing.category} · {bid.listing.status}
          </span>
        )}
        {activeAcceptedBid && <span className="active-bid-open-note">Open active gig details</span>}
      </>
    );

    if (activeAcceptedBid) {
      return (
        <Link className="bid-card active-bid-card" key={bid.id} to={`/gigs/${bid.listing.id}`}>
          {content}
        </Link>
      );
    }

    return (
      <article className="bid-card" key={bid.id}>
        {content}
      </article>
    );
  }

  return (
    <section className="profile-page">
      {loading && <p className="empty-state">Loading profile...</p>}
      {error && <p className="empty-state error-state">{error}</p>}
      {!loading && !error && profileData && (
        <>
          <div className="profile-header">
            <span className="profile-avatar-large">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt={`${profileData.profileName} profile`} /> : getInitials(profileData.profileName)}
            </span>
            <div>
              <span className="eyebrow">PhillyGrind Profile</span>
              <h1>{profileData.profileName}</h1>
              <p>
                Member since{' '}
                {profileData.profileCreatedAt
                  ? new Date(profileData.profileCreatedAt).toLocaleDateString([], { month: 'long', year: 'numeric' })
                  : 'recently'}
              </p>
              <div className="profile-rating-row">
                <StarRating rating={profileData.rating.average} count={profileData.rating.count} />
                <span>{profileData.rating.count} review{profileData.rating.count === 1 ? '' : 's'}</span>
              </div>
              {profile?.availability && <span className={`availability-badge ${profile.availability === 'Available Now' ? 'available' : profile.availability === 'Not Available' ? 'unavailable' : ''}`}>{profile.availability}</span>}
            </div>
            {isOwnProfile && (
              <button className="profile-edit-button" type="button" onClick={() => setEditing((value) => !value)}>
                {editing ? 'Close Editor' : 'Edit Profile'}
              </button>
            )}
          </div>

          {isOwnProfile && (
            <section className={payoutsConnected ? 'payout-profile-card connected' : 'payout-profile-card'}>
              <div>
                <span className="eyebrow">Stripe Express</span>
                <h2>{payoutsConnected ? 'Payouts connected' : hasStripeAccount ? 'Finish payout setup' : 'Set up payouts to receive payments'}</h2>
                <p>
                  {payoutsConnected
                    ? 'You can receive secure escrow payouts for gigs and marketplace sales through Stripe Express.'
                    : hasStripeAccount
                      ? 'Finish Stripe Express onboarding so buyers and hirers can pay into escrow and PhillyGrind can release payouts to you.'
                      : 'Connect Stripe Express to accept Secure Checkout on marketplace listings and escrow payments on gigs.'}
                </p>
              </div>
              {payoutsConnected ? (
                <span className="payout-ready-badge">Payouts connected ✓</span>
              ) : (
                <button className="primary-button" type="button" onClick={handleConnectPayouts} disabled={connectingPayouts}>
                  {connectingPayouts ? 'Connecting...' : hasStripeAccount ? 'Finish Stripe' : 'Connect Stripe'}
                </button>
              )}
            </section>
          )}

          {profileStatus && <p className="form-status">{profileStatus}</p>}

          {isOwnProfile && activeBoosts.length > 0 && (
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <span className="eyebrow">Boosts</span>
                <h2>Active Boosts</h2>
              </div>
              <div className="boost-dashboard-list">
                {activeBoosts.map((listing) => (
                  <article className="boost-dashboard-card" key={`${listing.type}-${listing.id}`}>
                    <div>
                      <span className={`boost-badge ${listing.boost_tier}`}>{listing.boost_tier === 'pro' ? '⭐ Pro' : '⭐ Featured'}</span>
                      <h3>{listing.title}</h3>
                      <p>Expires {new Date(listing.boost_expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <button
                      className="secondary-detail-button"
                      type="button"
                      onClick={() => handleRenewBoost(listing)}
                      disabled={renewingBoostId === `${listing.type}-${listing.id}`}
                    >
                      {renewingBoostId === `${listing.type}-${listing.id}` ? 'Opening...' : 'Renew Boost'}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {isOwnProfile && (
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <span className="eyebrow">Career</span>
                <h2>Resume</h2>
              </div>
              {resumeStoragePath ? (
                <div className="resume-upload-card">
                  <div>
                    <strong>{resumeDisplayName || 'resume.pdf'}</strong>
                    <p className="detail-note">Private resume stored in your profile. Attached automatically when you Quick Apply.</p>
                  </div>
                  <div className="resume-upload-actions">
                    {resumeUrl && (
                      <a className="text-link" href={resumeUrl} target="_blank" rel="noreferrer">
                        View resume
                      </a>
                    )}
                    <label className="secondary-detail-button resume-replace-button">
                      Replace
                      <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} hidden />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="resume-upload-card">
                  <p className="detail-note">Upload a PDF or Word resume to use Quick Apply on job listings. PDF or Word document (.pdf, .doc, .docx), 5MB max.</p>
                  <label className="primary-button resume-upload-button">
                    Upload Resume
                    <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} hidden />
                  </label>
                </div>
              )}
            </section>
          )}

          {editing && isOwnProfile && (
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <span className="eyebrow">Profile Editor</span>
                <h2>Edit Profile</h2>
              </div>
              <form className="profile-edit-form" onSubmit={handleSaveProfile}>
                <label>
                  Profile photo
                  <input type="file" accept="image/jpeg,image/png" onChange={handleAvatarUpload} />
                  <span className="detail-note">JPG or PNG, 2MB max. Publicly visible on your profile.</span>
                </label>
                <label>
                  Bio
                  <textarea name="bio" value={form.bio} onChange={updateField} rows="5" placeholder="Tell Philly what kind of work you do best." />
                </label>
                <TagEditor label="Skills" placeholder="Moving, cleaning, bartending..." tags={form.skills} onChange={(skills) => setForm((current) => ({ ...current, skills }))} />
                <label>
                  Availability
                  <select name="availability" value={form.availability} onChange={updateField}>
                    <option value="">Select availability</option>
                    {availabilityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <TagEditor label="Neighborhoods served" placeholder="South Philly, Fishtown..." tags={form.neighborhoods} onChange={(neighborhoods) => setForm((current) => ({ ...current, neighborhoods }))} />
                <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
              </form>
            </section>
          )}

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
              <span className="eyebrow">Reputation</span>
              <h2>Reviews</h2>
            </div>
            <div className="reviews-list">
              {profileData.reviews.map((review) => (
                <article key={review.id} className="review-card">
                  <div>
                    <StarRating rating={review.rating} compact />
                    <strong>{review.reviewerName}</strong>
                  </div>
                  <p>{review.comment}</p>
                  <time>{new Date(review.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </article>
              ))}
              {!profileData.reviews.length && <p className="empty-state">No reviews yet.</p>}
            </div>
          </section>

          {isOwnProfile && (
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <span className="eyebrow">Gig bids</span>
                <h2>My Submitted Bids</h2>
              </div>
              {myBids.length > 0 ? (
                <div className="bids-list">
                  {myBids.map((bid) => renderBidCard(bid))}
                </div>
              ) : (
                <p className="empty-state">No bids submitted yet.</p>
              )}
            </section>
          )}

          {isOwnProfile && (
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <span className="eyebrow">Marketplace</span>
                <h2>My Marketplace</h2>
              </div>

              {marketplaceListings.length > 0 && (
                <>
                  <h3 className="profile-mini-heading">Active Listings</h3>
                  <div className="listing-grid profile-listings-grid">
                    {marketplaceListings.map((listing) => (
                      <Link key={listing.id} to={`/marketplace/${listing.id}`} className="listing-card marketplace-card">
                        {listing.photos && listing.photos.length > 0 ? (
                          <img src={listing.photos[0]} alt={listing.title} className="listing-photo" />
                        ) : (
                          <div className="listing-photo-placeholder">No photo</div>
                        )}
                        <div className="listing-content">
                          <h3>{listing.title}</h3>
                          <p className="listing-price">${listing.price}</p>
                          <div className="listing-meta">
                            <span className="condition-badge">{listing.condition}</span>
                            <span className="location-badge">{listing.location}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
              {marketplaceOrders.length > 0 && (
                <>
                  <h3 className="profile-mini-heading">Pending Orders</h3>
                  <div className="bids-list">
                    {marketplaceOrders.map((order) => (
                      <Link key={order.id} to={`/marketplace/${order.listing_id}`} className="bid-card">
                        <div className="bid-card-header">
                          <div>
                            <strong>{order.marketplace_listings?.title || 'Marketplace item'}</strong>
                            <span>{new Date(order.created_at).toLocaleDateString()}</span>
                          </div>
                          <span className={`bid-status ${order.status}`}>
                            {order.status === 'held' ? 'Payment held - awaiting confirmation' : order.status}
                          </span>
                        </div>
                        <p>${(order.amount / 100).toFixed(2)} · {order.marketplace_listings?.location}</p>
                        {order.buyer_id === user?.id && order.status === 'held' && (
                          <span className="detail-note">Confirm receipt when you receive the item</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              )}
              {marketplaceListings.length === 0 && marketplaceOrders.length === 0 && (
                <p className="empty-state">No marketplace activity yet. <Link to="/marketplace/post">Post a listing</Link></p>
              )}
            </section>
          )}

          <section className="profile-section-card">
            <div className="profile-section-heading">
              <span className="eyebrow">Posted Work</span>
              <h2>Active Listings</h2>
            </div>
            {listings.length > 0 ? (
              <div className="listing-grid profile-listings-grid">
                {listings.map((listing) => <ListingCard key={`${listing.type}-${listing.id}`} listing={listing} />)}
              </div>
            ) : (
              <p className="empty-state">No active listings posted yet.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default Profile;

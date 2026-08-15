import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Briefcase, MapPin, Calendar, Star, Heart, MessageCircle, Share2 } from 'lucide-react';
import ListingCard from '../components/ListingCard.jsx';
import StarRating from '../components/StarRating.jsx';
import ChatModal from '../components/ChatModal.jsx';
import { createBoostCheckout } from '../lib/boostsApi.js';
import { getUserListings } from '../lib/listingsApi.js';
import { updateProfile, uploadAvatar, uploadBanner } from '../lib/profileApi.js';
import { getUserReviews } from '../lib/reviewsApi.js';
import { getMyBids } from '../lib/bidsApi.js';
import { getHousingListings, HOUSING_NEIGHBORHOODS } from '../lib/housingApi.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { getUserAvatarColor } from '../lib/reactions.js';
import { getUserCommunityPosts, canViewActivity } from '../lib/communityApi.js';
import { getOrCreateProfileConversation, sendMessage } from '../lib/messagesApi.js';

const availabilityOptions = ['Available Now', 'Weekends Only', 'Evenings Only', 'Not Available'];
const profileTagOptions = [
  'Job Hunting',
  'Selling Stuff',
  'Hiring',
  'Meeting Neighbors',
  'Offering Services',
  'Looking for Housing',
  'Renting Out a Place',
];

const accentColorOptions = [
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
];
const activeGigStatuses = new Set(['in progress', 'in_progress']);

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
  const [form, setForm] = useState({ bio: '', skills: [], availability: '', neighborhoods: [], profile_tags: [], accent_color: '#22c55e', neighborhood: '' });
  const [profileStatus, setProfileStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [renewingBoostId, setRenewingBoostId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [housingListings, setHousingListings] = useState([]);
  const [isLandlord, setIsLandlord] = useState(false);
  const [bannerFile, setBannerFile] = useState(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityPostsPage, setCommunityPostsPage] = useState(1);
  const [hasMoreCommunityPosts, setHasMoreCommunityPosts] = useState(false);
  const [loadingCommunityPosts, setLoadingCommunityPosts] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [profileConversation, setProfileConversation] = useState(null);
  const isOwnProfile = isLoggedIn && user?.id === viewedUserId;

  // Debug logging for Message button visibility
  console.log('[Profile Debug] Message button visibility check:', {
    isLoggedIn,
    userId: user?.id,
    viewedUserId,
    isOwnProfile,
    shouldShowMessage: !isOwnProfile && isLoggedIn
  });

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
          profile_tags: nextProfileData.profile?.profile_tags || [],
          accent_color: nextProfileData.profile?.accent_color || '#22c55e',
          neighborhood: nextProfileData.profile?.neighborhood || '',
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
            .order('created_at', { ascending: false }),
          supabase
            .from('marketplace_orders')
            .select('*')
            .or(`buyer_id.eq.${viewedUserId},seller_id.eq.${viewedUserId}`)
            .order('created_at', { ascending: false }),
        ]);

        setMarketplaceListings(listingsData.data || []);
        setMarketplaceOrders(ordersData.data || []);
      } catch (err) {
        console.warn('Failed to load marketplace data:', err);
      }
    }

    loadMarketplaceData();
  }, [viewedUserId]);

  useEffect(() => {
    if (!viewedUserId) return;

    async function loadHousingData() {
      try {
        const housingData = await getHousingListings({ user_id: viewedUserId });
        setHousingListings(housingData);
        setIsLandlord(housingData.length > 0);
      } catch (err) {
        console.warn('Failed to load housing data:', err);
      }
    }

    loadHousingData();
  }, [viewedUserId]);

  useEffect(() => {
    if (!viewedUserId) return;

    async function loadCommunityPosts() {
      if (!canViewActivity(user?.id, viewedUserId)) {
        setCommunityPosts([]);
        setHasMoreCommunityPosts(false);
        return;
      }

      setLoadingCommunityPosts(true);
      try {
        const { posts, hasMore } = await getUserCommunityPosts(viewedUserId, 1);
        setCommunityPosts(posts);
        setHasMoreCommunityPosts(hasMore);
        setCommunityPostsPage(1);
      } catch (err) {
        console.warn('Failed to load community posts:', err);
        setCommunityPosts([]);
        setHasMoreCommunityPosts(false);
      } finally {
        setLoadingCommunityPosts(false);
      }
    }

    loadCommunityPosts();
  }, [viewedUserId, user?.id]);

  async function loadMoreCommunityPosts() {
    if (loadingCommunityPosts || !hasMoreCommunityPosts) return;

    setLoadingCommunityPosts(true);
    try {
      const nextPage = communityPostsPage + 1;
      const { posts, hasMore } = await getUserCommunityPosts(viewedUserId, nextPage);
      setCommunityPosts((current) => [...current, ...posts]);
      setHasMoreCommunityPosts(hasMore);
      setCommunityPostsPage(nextPage);
    } catch (err) {
      console.warn('Failed to load more community posts:', err);
    } finally {
      setLoadingCommunityPosts(false);
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setProfileStatus('');

    try {
      const nextProfile = await updateProfile({
        bio: form.bio,
        skills: form.skills,
        availability: form.availability,
        neighborhoods: form.neighborhoods,
        profile_tags: form.profile_tags,
        accent_color: form.accent_color,
        neighborhood: form.neighborhood,
      });
      setProfileData((current) => current ? {
        ...current,
        profile: nextProfile,
      } : current);
      setEditing(false);
      setProfileStatus('Profile updated.');
      await refreshProfile();
    } catch (err) {
      setProfileStatus(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
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

  async function handleBannerUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[Banner Upload] Starting upload for file:', file.name, file.size, file.type);
    setUploadingBanner(true);
    setProfileStatus('');

    try {
      console.log('[Banner Upload] Calling uploadBanner...');
      const nextProfile = await uploadBanner(file);
      console.log('[Banner Upload] uploadBanner returned:', nextProfile);
      console.log('[Banner Upload] banner_url in returned profile:', nextProfile.banner_url);
      setProfileData((current) => current ? {
        ...current,
        profile: nextProfile,
      } : current);
      console.log('[Banner Upload] Profile data updated');
      setProfileStatus('Banner uploaded.');
    } catch (err) {
      console.error('[Banner Upload] Error:', err);
      setProfileStatus(err.message || 'Could not upload banner.');
    } finally {
      setUploadingBanner(false);
      event.target.value = '';
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

  async function handleMessageClick() {
    if (!user || isOwnProfile) return;

    setLoadingConversation(true);
    setProfileStatus('');

    try {
      const result = await getOrCreateProfileConversation(user.id, viewedUserId);
      setProfileConversation({
        messages: result.messages,
        existing: result.existing,
      });
      setChatModalOpen(true);
    } catch (err) {
      setProfileStatus(err.message || 'Could not start conversation.');
    } finally {
      setLoadingConversation(false);
    }
  }

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
          <div className="profile-header" style={{ '--profile-accent': profileData.profile?.accent_color || '#22c55e' }}>
            <span 
              className="profile-avatar-large"
              style={!profileData.profile?.avatar_url ? { backgroundColor: getUserAvatarColor(viewedUserId, profileData.profileName) } : undefined}
            >
              {profileData.profile?.avatar_url ? <img src={profileData.profile.avatar_url} alt={`${profileData.profileName} profile`} /> : getInitials(profileData.profileName)}
            </span>
            <div>
              <span className="eyebrow">PhillyGrind Profile</span>
              <div className="profile-name-row">
                <h1>{profileData.profileName}</h1>
                {profileData.profile?.identity_verified && <span className="verified-badge-small">✓</span>}
              </div>
              {profileData.profile?.profile_tags && profileData.profile.profile_tags.length > 0 && (
                <div className="profile-tags-row">
                  {profileData.profile.profile_tags.map((tag) => (
                    <span className="profile-tag-pill" key={tag}>{tag}</span>
                  ))}
                </div>
              )}
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
              {profileData.profile?.availability && <span className={`availability-badge ${profileData.profile.availability === 'Available Now' ? 'available' : profileData.profile.availability === 'Not Available' ? 'unavailable' : ''}`}>{profileData.profile.availability}</span>}
              {!isOwnProfile && isLoggedIn && (
                <button 
                  className="profile-edit-button" 
                  type="button" 
                  onClick={handleMessageClick} 
                  disabled={loadingConversation}
                  style={{ marginTop: '12px' }}
                >
                  {loadingConversation ? 'Loading...' : 'Message'}
                </button>
              )}
              {isOwnProfile && (
                <button className="profile-edit-button" type="button" onClick={() => setEditing((value) => !value)} style={{ marginTop: '12px' }}>
                  {editing ? 'Close Editor' : 'Edit Profile'}
                </button>
              )}
            </div>
          </div>

          {profileStatus && <p className="form-status">{profileStatus}</p>}

          {/* Two-column layout */}
          <div className="profile-content-grid">
            {/* Left column - Intro card */}
            <aside className="profile-sidebar">
              <div className="profile-intro-card">
                <div className="profile-section-heading">
                  <span className="eyebrow">About</span>
                  <h2>Intro</h2>
                </div>
                
                {profileData.profile?.bio && (
                  <div className="profile-intro-item">
                    <Briefcase className="profile-intro-icon" />
                    <div className="profile-intro-content">
                      <div className="profile-intro-label">Bio</div>
                      <div className="profile-intro-value">{profileData.profile.bio}</div>
                    </div>
                  </div>
                )}

                {profileData.profile?.skills?.length > 0 && (
                  <div className="profile-intro-item">
                    <Briefcase className="profile-intro-icon" />
                    <div className="profile-intro-content">
                      <div className="profile-intro-label">Skills</div>
                      <div className="profile-intro-value skills-list">
                        {profileData.profile.skills.map((skill) => (
                          <span key={skill} className="profile-intro-skill">{skill}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {profileData.profile?.neighborhoods?.length > 0 && (
                  <div className="profile-intro-item">
                    <MapPin className="profile-intro-icon" />
                    <div className="profile-intro-content">
                      <div className="profile-intro-label">Neighborhoods</div>
                      <div className="profile-intro-value">{profileData.profile.neighborhoods.join(', ')}</div>
                    </div>
                  </div>
                )}

                <div className="profile-intro-item">
                  <Calendar className="profile-intro-icon" />
                  <div className="profile-intro-content">
                    <div className="profile-intro-label">Member since</div>
                    <div className="profile-intro-value">
                      {profileData.profileCreatedAt
                        ? new Date(profileData.profileCreatedAt).toLocaleDateString([], { month: 'long', year: 'numeric' })
                        : 'Recently'}
                    </div>
                  </div>
                </div>

                {profileData.rating.count > 0 && (
                  <div className="profile-intro-item">
                    <Star className="profile-intro-icon" />
                    <div className="profile-intro-content">
                      <div className="profile-intro-label">Rating</div>
                      <div className="profile-intro-value">
                        {profileData.rating.average.toFixed(1)} · {profileData.rating.count} review{profileData.rating.count === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                )}

                {profileData.profile?.availability && (
                  <div className="profile-intro-item">
                    <Briefcase className="profile-intro-icon" />
                    <div className="profile-intro-content">
                      <div className="profile-intro-label">Availability</div>
                      <div className="profile-intro-value">{profileData.profile.availability}</div>
                    </div>
                  </div>
                )}
              </div>

              {isOwnProfile && activeBoosts.length > 0 && (
                <section className="profile-section-card" style={{ marginTop: '24px' }}>
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
            </aside>

            {/* Right column - Tabs and content */}
            <main className="profile-main-content">
              {/* Tab Bar */}
              <div className="profile-tabs">
                <button 
                  className={`profile-tab ${activeTab === 'activity' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab('activity')}
                >
                  Activity
                </button>
                <button 
                  className={`profile-tab ${activeTab === 'about' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab('about')}
                >
                  About
                </button>
                <button 
                  className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                >
                  Reviews
                </button>
                <button 
                  className={`profile-tab ${activeTab === 'listings' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab('listings')}
                >
                  Listings
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'activity' && (
                <section className="profile-section-card">
                  <div className="profile-section-heading">
                    <span className="eyebrow">Community</span>
                    <h2>Recent Activity</h2>
                  </div>
                  {loadingCommunityPosts ? (
                    <p className="empty-state">Loading posts...</p>
                  ) : communityPosts.length > 0 ? (
                    <>
                      <div className="profile-community-posts">
                        {communityPosts.map((post) => (
                          <article key={post.id} className="feed-post-card profile-post-card">
                            <div className="feed-post-header">
                              <Link to={`/profile/${post.authorId}`} className="feed-post-author">
                                {post.authorAvatarUrl ? (
                                  <img src={post.authorAvatarUrl} alt={post.authorName} className="feed-post-avatar" />
                                ) : (
                                  <div 
                                    className="feed-post-avatar-placeholder" 
                                    style={{ backgroundColor: getUserAvatarColor(post.authorId, post.authorName) }}
                                  >
                                    {post.authorName.charAt(0)}
                                  </div>
                                )}
                                <div className="feed-post-author-info">
                                  <span className="feed-post-author-name">{post.authorName}</span>
                                  <div className="feed-post-meta">
                                    <span className="feed-post-neighborhood">{post.neighborhood}</span>
                                    <span className="feed-post-time">· {post.relativeTime}</span>
                                  </div>
                                </div>
                              </Link>
                            </div>
                            <div className="feed-post-content">
                              <p>{post.content}</p>
                              {post.photo_path && (
                                <img 
                                  src={post.photo_url} 
                                  alt="Post photo" 
                                  className="feed-post-photo"
                                />
                              )}
                            </div>
                            <div className="feed-post-actions">
                              <div className="feed-post-reactions">
                                <Heart size={16} className="feed-post-reaction-icon" />
                                <span className="feed-post-like-count">{post.like_count || 0}</span>
                              </div>
                              <div className="feed-post-action-bar">
                                <Link to={`/community/post/${post.id}`} className="feed-post-action-button">
                                  <Heart size={18} />
                                  <span>React</span>
                                </Link>
                                <div className="feed-post-action-divider"></div>
                                <Link to={`/community/post/${post.id}`} className="feed-post-action-button">
                                  <MessageCircle size={18} />
                                  <span>Comment</span>
                                </Link>
                                <div className="feed-post-action-divider"></div>
                                <Link to={`/community/post/${post.id}`} className="feed-post-action-button">
                                  <Share2 size={18} />
                                  <span>Share</span>
                                </Link>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                      {hasMoreCommunityPosts && (
                        <button 
                          className="secondary-button" 
                          type="button" 
                          onClick={loadMoreCommunityPosts}
                          disabled={loadingCommunityPosts}
                          style={{ marginTop: '16px' }}
                        >
                          {loadingCommunityPosts ? 'Loading...' : 'Load more posts'}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="empty-state">No posts yet.</p>
                  )}
                </section>
              )}

          {activeTab === 'about' && (
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <span className="eyebrow">About</span>
                <h2>Work Profile</h2>
              </div>
              {profileData.profile?.bio ? (
                <p className="profile-bio">{profileData.profile.bio}</p>
              ) : (
                <p className="empty-state">No bio added yet.</p>
              )}
              {profileData.profile?.skills?.length > 0 ? (
                <div>
                  <h3 className="profile-mini-heading">Skills</h3>
                  <div className="profile-pill-row">{profileData.profile.skills.map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}</div>
                </div>
              ) : (
                <div>
                  <h3 className="profile-mini-heading">Skills</h3>
                  <p className="empty-state">No skills listed yet.</p>
                </div>
              )}
              {profileData.profile?.neighborhoods?.length > 0 ? (
                <div>
                  <h3 className="profile-mini-heading">Neighborhoods served</h3>
                  <div className="profile-pill-row">{profileData.profile.neighborhoods.map((neighborhood) => <span className="neighborhood-pill" key={neighborhood}>{neighborhood}</span>)}</div>
                </div>
              ) : (
                <div>
                  <h3 className="profile-mini-heading">Neighborhoods served</h3>
                  <p className="empty-state">No neighborhoods specified yet.</p>
                </div>
              )}
            </section>
          )}

          {activeTab === 'reviews' && (
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <span className="eyebrow">Reputation</span>
                <h2>Reviews</h2>
              </div>
              <div className="reviews-list">
                {profileData.reviews.length > 0 ? (
                  profileData.reviews.map((review) => (
                    <article key={review.id} className="review-card">
                      <div>
                        <StarRating rating={review.rating} compact />
                        <strong>{review.reviewerName}</strong>
                      </div>
                      <p>{review.comment}</p>
                      <time>{new Date(review.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
                    </article>
                  ))
                ) : (
                  <p className="empty-state">No reviews yet.</p>
                )}
              </div>
            </section>
          )}

          {activeTab === 'listings' && (
            <>
              {isOwnProfile && myBids.length > 0 && (
                <section className="profile-section-card">
                  <div className="profile-section-heading">
                    <span className="eyebrow">Gig bids</span>
                    <h2>My Submitted Bids</h2>
                  </div>
                  <div className="bids-list">
                    {myBids.map((bid) => renderBidCard(bid))}
                  </div>
                </section>
              )}

              {isOwnProfile && (marketplaceListings.length > 0 || marketplaceOrders.length > 0) && (
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
                </section>
              )}

              <section className="profile-section-card">
                <div className="profile-section-heading">
                  <span className="eyebrow">Posted Work</span>
                  <h2>Job & Gig Listings</h2>
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

              {editing && isOwnProfile && (
                <section className="profile-section-card">
                  <div className="profile-section-heading">
                    <span className="eyebrow">Profile Editor</span>
                    <h2>Edit Profile</h2>
                  </div>
                  <form className="profile-edit-form" onSubmit={handleSaveProfile}>
                    {/* Banner upload temporarily hidden - will be revisited in future profile customization session */}
                    {false && (
                      <label>
                        Banner photo
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerUpload} />
                        <span className="detail-note">JPG, PNG, or WebP, 5MB max. Recommended 3:1 aspect ratio (e.g., 1200x400px).</span>
                      </label>
                    )}
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
                    <label>
                      Your Neighborhood
                      <select name="neighborhood" value={form.neighborhood} onChange={updateField}>
                        <option value="">Select your neighborhood</option>
                        {HOUSING_NEIGHBORHOODS.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                      <span className="detail-note">This helps show you nearby posts in the Community feed.</span>
                    </label>
                    <label>
                      Personality tags (select up to 3)
                      <div className="profile-tags-selector">
                        {profileTagOptions.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={`profile-tag-option ${form.profile_tags.includes(tag) ? 'selected' : ''}`}
                            onClick={() => {
                              const currentTags = form.profile_tags;
                              if (currentTags.includes(tag)) {
                                setForm((current) => ({ ...current, profile_tags: currentTags.filter((t) => t !== tag) }));
                              } else if (currentTags.length < 3) {
                                setForm((current) => ({ ...current, profile_tags: [...currentTags, tag] }));
                              }
                            }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <span className="detail-note">Choose up to 3 tags that describe what you're here for.</span>
                    </label>
                    <label>
                      Accent color
                      <div className="accent-color-selector">
                        {accentColorOptions.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={`accent-swatch ${form.accent_color === color.value ? 'selected' : ''}`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => setForm((current) => ({ ...current, accent_color: color.value }))}
                            title={color.name}
                          >
                            {form.accent_color === color.value && <span className="accent-check">✓</span>}
                          </button>
                        ))}
                      </div>
                      <span className="detail-note">Choose an accent color for your profile badges and buttons.</span>
                    </label>
                    <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
                  </form>
                </section>
              )}
            </main>
          </div>
        </>
      )}
      {chatModalOpen && profileConversation && (
        <ChatModal
          listing={{
            id: '00000000-0000-0000-0000-000000000001',
            title: `Conversation with ${profileData.profileName}`,
            user_id: viewedUserId,
            posterName: profileData.profileName,
            company: profileData.profileName,
          }}
          receiverId={viewedUserId}
          receiverLabel={profileData.profileName}
          onClose={() => setChatModalOpen(false)}
        />
      )}
    </section>
  );
}

export default Profile;

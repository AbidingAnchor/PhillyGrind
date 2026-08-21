import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Briefcase, MapPin, Calendar, MessageCircle, Pencil, Share2, MoreHorizontal, Settings, X, Camera } from 'lucide-react';
import FacebookShareIcon from '../components/FacebookShareIcon.jsx';
import PostReactionControl from '../components/PostReactionControl.jsx';
import ReactionBreakdown from '../components/ReactionBreakdown.jsx';
import ListingCard from '../components/ListingCard.jsx';
import StarRating from '../components/StarRating.jsx';
import ChatModal from '../components/ChatModal.jsx';
import ProfileListbox from '../components/ProfileListbox.jsx';
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
import { getUserReaction, toggleCommunityPostReaction, getReactionBreakdown } from '../lib/communityApi.js';

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
          <input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="profile-editor-input" />
          <button type="button" onClick={addTag}>Add</button>
        </div>
      </div>
    </label>
  );
}

function isUsableUserId(value) {
  return Boolean(value) && value !== 'undefined' && value !== 'null';
}

export function OwnProfileRedirect() {
  const { user, profile, session } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function logRedirectIdentity() {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      const liveUid = data?.user?.id ?? null;
      console.log('[ProfileRedirect] identity at redirect time', {
        href: window.location.href,
        contextUserId: user?.id ?? null,
        contextEmail: user?.email ?? null,
        sessionUserId: session?.user?.id ?? null,
        liveAuthUid: liveUid,
        liveEmail: data?.user?.email ?? null,
        getUserError: error?.message ?? null,
        authProfileId: profile?.id ?? null,
        authProfileName: profile?.name ?? null,
        idsMatch: Boolean(liveUid && user?.id && liveUid === user?.id),
        willRedirectTo: user?.id ? `/profile/${user.id}` : null,
      });
    }

    logRedirectIdentity();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, session?.user?.id, profile?.id, profile?.name]);

  if (!isUsableUserId(user?.id)) {
    return <section className="page-section"><p className="empty-state">Loading profile...</p></section>;
  }

  return <Navigate to={`/profile/${user.id}`} replace />;
}

function Profile() {
  const { userId } = useParams();
  const { user, isLoggedIn, profile: authProfile, refreshProfile } = useAuth();
  const viewedUserId = isUsableUserId(userId) ? userId : null;

  const [profileData, setProfileData] = useState(null);
  const [listings, setListings] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [marketplaceOrders, setMarketplaceOrders] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', skills: [], availability: '', neighborhoods: [], profile_tags: [], neighborhood: '' });
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
  const [postReactions, setPostReactions] = useState({});
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [profileConversation, setProfileConversation] = useState(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const isOwnProfile = isLoggedIn && user?.id === viewedUserId;

  useEffect(() => {
    let cancelled = false;

    async function logProfilePageIdentity() {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      console.log('[ProfilePage] route vs session', {
        href: window.location.href,
        pathname: window.location.pathname,
        routeUserId: userId ?? null,
        viewedUserId,
        contextUserId: user?.id ?? null,
        contextEmail: user?.email ?? null,
        liveAuthUid: data?.user?.id ?? null,
        liveEmail: data?.user?.email ?? null,
        getUserError: error?.message ?? null,
        authProfileId: authProfile?.id ?? null,
        authProfileName: authProfile?.name ?? null,
        routeMatchesLiveAuth: Boolean(data?.user?.id && userId && data.user.id === userId),
        isOwnProfile: Boolean(user?.id && user.id === viewedUserId),
      });
    }

    logProfilePageIdentity();
    return () => {
      cancelled = true;
    };
  }, [userId, viewedUserId, user?.id, user?.email, authProfile?.id, authProfile?.name]);

  useEffect(() => {
    if (!actionsMenuOpen) return undefined;

    function handleClick(event) {
      if (!event.target.closest('.profile-actions-menu')) {
        setActionsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [actionsMenuOpen]);

  useEffect(() => {
    if (!editing) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setEditing(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editing]);

  const activeBoosts = listings.filter((listing) => (
    listing.is_boosted
    && listing.boost_tier
    && listing.boost_expires_at
    && new Date(listing.boost_expires_at) > new Date()
  ));

  useEffect(() => {
    if (!isUsableUserId(viewedUserId)) return undefined;

    let cancelled = false;
    setProfileData(null);
    setListings([]);
    setLoading(true);
    setError('');

    Promise.all([
      getUserReviews(viewedUserId),
      getUserListings(viewedUserId),
    ])
      .then(([nextProfileData, nextListings]) => {
        if (cancelled) return;
        console.log('[ProfilePage] fetch result', {
          requestedId: viewedUserId,
          fetchedProfileId: nextProfileData.profile?.id ?? null,
          fetchedName: nextProfileData.profileName,
          fetchedHasAvatar: Boolean(nextProfileData.profile?.avatar_url),
          fetchedBioPreview: (nextProfileData.profile?.bio || '').slice(0, 80),
          ratingCount: nextProfileData.rating?.count ?? 0,
          idsMatch: nextProfileData.profile?.id === viewedUserId,
          profileRowMissing: !nextProfileData.profile,
        });
        setProfileData(nextProfileData);
        setListings(nextListings);
        setForm({
          name: nextProfileData.profile?.name || '',
          bio: nextProfileData.profile?.bio || '',
          skills: nextProfileData.profile?.skills || [],
          availability: nextProfileData.profile?.availability || '',
          neighborhoods: nextProfileData.profile?.neighborhoods || [],
          profile_tags: nextProfileData.profile?.profile_tags || [],
          neighborhood: nextProfileData.profile?.neighborhood || '',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load this profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
    if (!isUsableUserId(viewedUserId)) return undefined;

    let cancelled = false;

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

        if (cancelled) return;
        setMarketplaceListings(listingsData.data || []);
        setMarketplaceOrders(ordersData.data || []);
      } catch (err) {
        console.warn('Failed to load marketplace data:', err);
      }
    }

    loadMarketplaceData();
    return () => {
      cancelled = true;
    };
  }, [viewedUserId]);

  useEffect(() => {
    if (!isUsableUserId(viewedUserId)) return undefined;

    let cancelled = false;

    async function loadHousingData() {
      try {
        const housingData = await getHousingListings({ user_id: viewedUserId });
        if (cancelled) return;
        setHousingListings(housingData);
        setIsLandlord(housingData.length > 0);
      } catch (err) {
        console.warn('Failed to load housing data:', err);
      }
    }

    loadHousingData();
    return () => {
      cancelled = true;
    };
  }, [viewedUserId]);

  useEffect(() => {
    if (!isUsableUserId(viewedUserId)) return undefined;

    let cancelled = false;

    async function loadCommunityPosts() {
      if (!canViewActivity(user?.id, viewedUserId)) {
        setCommunityPosts([]);
        setHasMoreCommunityPosts(false);
        return;
      }

      setLoadingCommunityPosts(true);
      try {
        const { posts, hasMore } = await getUserCommunityPosts(viewedUserId, 1);
        if (cancelled) return;
        setCommunityPosts(posts);
        setHasMoreCommunityPosts(hasMore);
        setCommunityPostsPage(1);
        
        // Load reactions for each post
        const reactionsData = {};
        for (const post of posts) {
          try {
            const reaction = await getUserReaction(post.id);
            const breakdown = await getReactionBreakdown(post.id);
            reactionsData[post.id] = { userReaction: reaction, breakdown };
          } catch (err) {
            reactionsData[post.id] = { userReaction: null, breakdown: [] };
          }
        }
        if (cancelled) return;
        setPostReactions(reactionsData);
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load community posts:', err);
        setCommunityPosts([]);
        setHasMoreCommunityPosts(false);
      } finally {
        if (!cancelled) setLoadingCommunityPosts(false);
      }
    }

    loadCommunityPosts();
    return () => {
      cancelled = true;
    };
  }, [viewedUserId, user?.id]);

  async function loadMoreCommunityPosts() {
    if (loadingCommunityPosts || !hasMoreCommunityPosts || !isUsableUserId(viewedUserId)) return;

    setLoadingCommunityPosts(true);
    try {
      const nextPage = communityPostsPage + 1;
      const { posts, hasMore } = await getUserCommunityPosts(viewedUserId, nextPage);
      setCommunityPosts((current) => [...current, ...posts]);
      setHasMoreCommunityPosts(hasMore);
      setCommunityPostsPage(nextPage);
      
      // Load reactions for new posts
      const reactionsData = { ...postReactions };
      for (const post of posts) {
        try {
          const reaction = await getUserReaction(post.id);
          const breakdown = await getReactionBreakdown(post.id);
          reactionsData[post.id] = { userReaction: reaction, breakdown };
        } catch (err) {
          reactionsData[post.id] = { userReaction: null, breakdown: [] };
        }
      }
      setPostReactions(reactionsData);
    } catch (err) {
      console.warn('Failed to load more community posts:', err);
    } finally {
      setLoadingCommunityPosts(false);
    }
  }

  async function handlePostReactionSelect(postId, reactionType) {
    try {
      await toggleCommunityPostReaction(postId, reactionType);
      const newReaction = await getUserReaction(postId);
      const breakdown = await getReactionBreakdown(postId);
      setPostReactions(prev => ({
        ...prev,
        [postId]: { userReaction: newReaction, breakdown }
      }));
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      alert(error.message);
    }
  }

  async function handlePostLike(postId) {
    const currentReaction = postReactions[postId]?.userReaction;
    try {
      if (currentReaction) {
        await toggleCommunityPostReaction(postId, 'like');
        const newReaction = await getUserReaction(postId);
        const breakdown = await getReactionBreakdown(postId);
        setPostReactions(prev => ({
          ...prev,
          [postId]: { userReaction: newReaction, breakdown }
        }));
      } else {
        await toggleCommunityPostReaction(postId, 'like');
        const newReaction = await getUserReaction(postId);
        const breakdown = await getReactionBreakdown(postId);
        setPostReactions(prev => ({
          ...prev,
          [postId]: { userReaction: newReaction, breakdown }
        }));
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      alert(error.message);
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
        name: form.name,
        bio: form.bio,
        skills: form.skills,
        availability: form.availability,
        neighborhoods: form.neighborhoods,
        profile_tags: form.profile_tags,
        neighborhood: form.neighborhood,
      });
      setProfileData((current) => current ? {
        ...current,
        profile: nextProfile,
        profileName: nextProfile.name,
      } : current);
      setEditing(false);
      setProfileStatus('Profile updated.');
      const refreshedProfile = await refreshProfile();
      if (refreshedProfile) {
        setProfileData((current) => current ? {
          ...current,
          profile: refreshedProfile,
          profileName: refreshedProfile.name,
        } : current);
      }
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
    setProfileStatus('Uploading profile photo...');

    try {
      console.log('[Profile] Avatar upload selected:', {
        name: file.name,
        type: file.type,
        size: file.size,
      });
      const nextProfile = await uploadAvatar(file);
      setProfileData((current) => current ? {
        ...current,
        profile: {
          ...(current.profile || {}),
          ...nextProfile,
        },
        profileName: nextProfile.name || current.profileName,
      } : current);
      if (typeof refreshProfile === 'function') {
        await refreshProfile();
      }
      setProfileStatus('Profile photo uploaded.');
    } catch (err) {
      console.error('[Profile] Avatar upload failed:', err);
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
      console.error(err);
      setProfileStatus('Something went wrong starting this conversation, please try again');
    } finally {
      setLoadingConversation(false);
    }
  }

  async function handleShareProfile() {
    const shareUrl = `${window.location.origin}/profile/${viewedUserId}`;
    const shareData = {
      title: `${profileData?.profileName || 'PhillyGrind'} profile`,
      text: `Check out ${profileData?.profileName || 'this neighbor'} on PhillyGrind`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setProfileStatus('Profile link copied.');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setProfileStatus('Could not share this profile.');
    }
  }

  function truncateBio(bio, maxLength = 140) {
    const text = String(bio || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}…`;
  }

  function EmptyProfilePrompt({ children, onAction }) {
    if (isOwnProfile && onAction) {
      return (
        <button type="button" className="profile-empty-prompt" onClick={onAction}>
          {children}
        </button>
      );
    }
    return <p className="profile-empty-prompt profile-empty-prompt-static">{children}</p>;
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
          <div className="profile-cover-bleed">
            <div
              className={`profile-cover ${profileData.profile?.banner_url ? 'has-photo' : 'profile-cover-fallback'}`}
              style={profileData.profile?.banner_url ? { backgroundImage: `url(${profileData.profile.banner_url})` } : undefined}
            >
              <div className="profile-cover-overlay" />
            </div>
            <div className="profile-cover-content">
              <span
                className="profile-avatar-large profile-avatar-overlap"
                style={!profileData.profile?.avatar_url ? { backgroundColor: getUserAvatarColor(viewedUserId, profileData.profileName) } : undefined}
              >
                {profileData.profile?.avatar_url ? (
                  <img
                    key={profileData.profile.avatar_url}
                    src={profileData.profile.avatar_url}
                    alt={`${profileData.profileName} profile`}
                    draggable={false}
                  />
                ) : getInitials(profileData.profileName)}
              </span>
            </div>
          </div>

          <div className="profile-body">
            <div className="profile-identity-row">
              <div className="profile-identity-main">
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
                <div className="profile-identity-meta">
                  <StarRating rating={profileData.rating.average} count={profileData.rating.count} />
                  <span>
                    {profileData.rating.count} review{profileData.rating.count === 1 ? '' : 's'}
                  </span>
                  <span className="profile-identity-sep" aria-hidden="true">·</span>
                  <span>
                    Member since{' '}
                    {profileData.profileCreatedAt
                      ? new Date(profileData.profileCreatedAt).toLocaleDateString([], { month: 'long', year: 'numeric' })
                      : 'recently'}
                  </span>
                </div>
                {profileData.profile?.availability === 'Available Now' && profileData.profile?.show_available_now && (
                  <span className="availability-badge available">{profileData.profile.availability}</span>
                )}
                {profileData.profile?.availability && profileData.profile?.availability !== 'Available Now' && (
                  <span className={`availability-badge ${profileData.profile.availability === 'Not Available' ? 'unavailable' : ''}`}>
                    {profileData.profile.availability}
                  </span>
                )}
              </div>

              <div className="profile-action-cluster">
                {isOwnProfile ? (
                  <button
                    className="profile-icon-button"
                    type="button"
                    aria-label={editing ? 'Close profile editor' : 'Edit profile'}
                    title={editing ? 'Close editor' : 'Edit Profile'}
                    onClick={() => setEditing((value) => !value)}
                  >
                    <Pencil size={18} />
                  </button>
                ) : isLoggedIn ? (
                  <button
                    className="profile-icon-button profile-icon-button-primary"
                    type="button"
                    aria-label="Message"
                    title="Message"
                    onClick={handleMessageClick}
                    disabled={loadingConversation}
                  >
                    <MessageCircle size={18} />
                  </button>
                ) : null}
                <button
                  className="profile-icon-button"
                  type="button"
                  aria-label="Share profile"
                  title="Share Profile"
                  onClick={handleShareProfile}
                >
                  <Share2 size={18} />
                </button>
                {isOwnProfile && (
                  <div className="profile-actions-menu">
                    <button
                      className="profile-icon-button"
                      type="button"
                      aria-label="More profile actions"
                      aria-expanded={actionsMenuOpen}
                      title="More"
                      onClick={() => setActionsMenuOpen((open) => !open)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {actionsMenuOpen && (
                      <div className="profile-actions-dropdown">
                        <Link to="/settings" className="profile-actions-dropdown-item" onClick={() => setActionsMenuOpen(false)}>
                          <Settings size={16} />
                          Settings
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {profileStatus && <p className="form-status">{profileStatus}</p>}

            {/* Two-column layout */}
            <div className="profile-content-grid">
              {/* Left column - About at a glance */}
              <aside className="profile-sidebar">
                <div className="profile-intro-card">
                  <div className="profile-section-heading">
                    <span className="eyebrow">About</span>
                    <h2>At a glance</h2>
                  </div>

                  <div className="profile-intro-item">
                    <Briefcase className="profile-intro-icon" />
                    <div className="profile-intro-content">
                      <div className="profile-intro-label">Bio</div>
                      {profileData.profile?.bio ? (
                        <div className="profile-intro-value">
                          {truncateBio(profileData.profile.bio)}
                          {profileData.profile.bio.trim().length > 140 && (
                            <>
                              {' '}
                              <button type="button" className="profile-more-link" onClick={() => setActiveTab('about')}>
                                more
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <EmptyProfilePrompt onAction={() => setEditing(true)}>
                          Add a bio so neighbors know who they&apos;re working with →
                        </EmptyProfilePrompt>
                      )}
                    </div>
                  </div>

                  <div className="profile-intro-item">
                    <Briefcase className="profile-intro-icon" />
                    <div className="profile-intro-content">
                      <div className="profile-intro-label">Skills</div>
                      {profileData.profile?.skills?.length > 0 ? (
                        <div className="profile-intro-value skills-list">
                          {profileData.profile.skills.map((skill) => (
                            <span key={skill} className="profile-intro-skill">{skill}</span>
                          ))}
                        </div>
                      ) : (
                        <EmptyProfilePrompt onAction={() => setEditing(true)}>
                          Add your skills so the right gigs find you →
                        </EmptyProfilePrompt>
                      )}
                    </div>
                  </div>

                  <div className="profile-intro-item">
                    <MapPin className="profile-intro-icon" />
                    <div className="profile-intro-content">
                      <div className="profile-intro-label">Neighborhoods served</div>
                      {profileData.profile?.neighborhoods?.length > 0 ? (
                        <div className="profile-intro-value skills-list">
                          {profileData.profile.neighborhoods.map((neighborhood) => (
                            <span key={neighborhood} className="profile-intro-neighborhood">{neighborhood}</span>
                          ))}
                        </div>
                      ) : (
                        <EmptyProfilePrompt onAction={() => setEditing(true)}>
                          Add neighborhoods you work so locals can find you →
                        </EmptyProfilePrompt>
                      )}
                    </div>
                  </div>

                  {profileData.profile?.availability && (
                    <div className="profile-intro-item">
                      <Calendar className="profile-intro-icon" />
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
                                  <img src={post.authorAvatarUrl} alt={post.authorName} className="feed-post-avatar" draggable={false} />
                                ) : (
                                  <div 
                                    className="feed-post-avatar-placeholder" 
                                    style={{ backgroundColor: getUserAvatarColor(post.authorId, post.authorName) }}
                                  >
                                    {post.authorName?.charAt(0) || '?'}
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
                            {(postReactions[post.id]?.breakdown?.length > 0 || post.comment_count > 0 || post.share_count > 0) && (
                              <div className="feed-post-reaction-summary">
                                <ReactionBreakdown breakdown={postReactions[post.id]?.breakdown || []} userReaction={postReactions[post.id]?.userReaction} />
                                <span className="feed-post-stats">
                                  {post.comment_count > 0 && `${post.comment_count} comments`}
                                  {post.comment_count > 0 && post.share_count > 0 && ' · '}
                                  {post.share_count > 0 && `${post.share_count} shares`}
                                </span>
                              </div>
                            )}
                            <div className="feed-post-divider" />
                            <div className="feed-post-actions">
                              <PostReactionControl
                                key={`reaction-control-${postReactions[post.id]?.userReaction || 'none'}-${post.id}`}
                                userReaction={postReactions[post.id]?.userReaction}
                                onLike={() => handlePostLike(post.id)}
                                onReactionSelect={(reactionType) => handlePostReactionSelect(post.id, reactionType)}
                                buttonClassName="feed-post-action-btn"
                                iconSize={18}
                                showLabel
                              />
                              <button
                                type="button"
                                className="feed-post-action-btn"
                                onClick={() => window.location.href = `/community/post/${post.id}`}
                              >
                                <MessageCircle size={18} />
                                <span>Comment</span>
                              </button>
                              <button
                                type="button"
                                className="feed-post-action-btn"
                                onClick={() => window.location.href = `/community/post/${post.id}`}
                              >
                                <FacebookShareIcon size={18} />
                                <span>Share</span>
                              </button>
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
                    <EmptyProfilePrompt onAction={() => { window.location.href = '/'; }}>
                      {isOwnProfile
                        ? 'Share something with the neighborhood — your first post starts here →'
                        : 'No posts yet.'}
                    </EmptyProfilePrompt>
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
                <EmptyProfilePrompt onAction={() => setEditing(true)}>
                  {isOwnProfile
                    ? 'Add a bio so neighbors know who they\'re working with →'
                    : 'No bio added yet.'}
                </EmptyProfilePrompt>
              )}
              {profileData.profile?.skills?.length > 0 ? (
                <div>
                  <h3 className="profile-mini-heading">Skills</h3>
                  <div className="profile-pill-row">{profileData.profile.skills.map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}</div>
                </div>
              ) : (
                <div>
                  <h3 className="profile-mini-heading">Skills</h3>
                  <EmptyProfilePrompt onAction={() => setEditing(true)}>
                    {isOwnProfile
                      ? 'Add your skills so the right gigs find you →'
                      : 'No skills listed yet.'}
                  </EmptyProfilePrompt>
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
                  <EmptyProfilePrompt onAction={() => setEditing(true)}>
                    {isOwnProfile
                      ? 'Add neighborhoods you work so locals can find you →'
                      : 'No neighborhoods specified yet.'}
                  </EmptyProfilePrompt>
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
                  <EmptyProfilePrompt onAction={undefined}>
                    No reviews yet.
                  </EmptyProfilePrompt>
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
                  <EmptyProfilePrompt onAction={isOwnProfile ? () => { window.location.href = '/post-gig'; } : undefined}>
                    {isOwnProfile
                      ? 'Post a job or gig so Philly can hire you →'
                      : 'No active listings posted yet.'}
                  </EmptyProfilePrompt>
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

            </main>
          </div>
          </div>
        </>
      )}
      {editing && isOwnProfile && profileData && createPortal(
        <div
          className="profile-edit-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setEditing(false);
          }}
        >
          <div
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-edit-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-edit-modal-header">
              <div className="profile-edit-modal-heading">
                <span className="eyebrow">Profile Editor</span>
                <h2 id="profile-edit-modal-title">Edit Profile</h2>
              </div>
              <button
                type="button"
                className="profile-edit-modal-close"
                aria-label="Close edit profile"
                onClick={() => setEditing(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form className="profile-edit-form" onSubmit={handleSaveProfile}>
              <div className="profile-edit-avatar-row">
                <span
                  className="profile-edit-avatar-preview"
                  style={!profileData.profile?.avatar_url ? { backgroundColor: getUserAvatarColor(viewedUserId, profileData.profileName) } : undefined}
                >
                  {profileData.profile?.avatar_url ? (
                    <img
                      key={profileData.profile.avatar_url}
                      src={profileData.profile.avatar_url}
                      alt=""
                      draggable={false}
                    />
                  ) : getInitials(form.name || profileData.profileName)}
                </span>
                <div className="profile-edit-avatar-actions">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp"
                    onChange={handleAvatarUpload}
                    className="profile-editor-file-input"
                    id="avatar-upload"
                  />
                  <label htmlFor="avatar-upload" className="profile-photo-upload-button profile-edit-avatar-button">
                    <Camera size={16} />
                    {saving ? 'Uploading...' : 'Choose Photo'}
                  </label>
                  <span className="detail-note">JPG, PNG, or WebP. Large phone photos are compressed automatically.</span>
                </div>
              </div>

              <div className="profile-edit-section">
                <span className="profile-edit-section-kicker">About</span>
                <label>
                  Display Name
                  <input name="name" value={form.name} onChange={updateField} className="profile-editor-input" placeholder="Your public name shown on posts and listings" />
                  <span className="detail-note">This is the name shown publicly across the platform.</span>
                </label>
                <label>
                  Bio
                  <textarea name="bio" value={form.bio} onChange={updateField} className="profile-editor-textarea" placeholder="Tell Philly what kind of work you do best." />
                </label>
              </div>

              <div className="profile-edit-section">
                <span className="profile-edit-section-kicker">Work & location</span>
                <TagEditor label="Skills" placeholder="Moving, cleaning, bartending..." tags={form.skills} onChange={(skills) => setForm((current) => ({ ...current, skills }))} />
                <ProfileListbox
                  label="Availability"
                  value={form.availability}
                  placeholder="Select availability"
                  options={availabilityOptions}
                  onChange={(availability) => setForm((current) => ({ ...current, availability }))}
                />
                <TagEditor label="Neighborhoods served" placeholder="South Philly, Fishtown..." tags={form.neighborhoods} onChange={(neighborhoods) => setForm((current) => ({ ...current, neighborhoods }))} />
                <ProfileListbox
                  label="Your Neighborhood"
                  value={form.neighborhood}
                  placeholder="Select your neighborhood"
                  options={HOUSING_NEIGHBORHOODS}
                  onChange={(neighborhood) => setForm((current) => ({ ...current, neighborhood }))}
                />
                <span className="detail-note profile-listbox-note">This helps show you nearby posts in the Community feed.</span>
              </div>

              <div className="profile-edit-section">
                <span className="profile-edit-section-kicker">Personality tags</span>
                <label>
                  Select up to 3
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
                  <span className="detail-note">Choose up to 3 tags that describe what you&apos;re here for.</span>
                </label>
              </div>

              {profileStatus && <p className="form-status profile-edit-modal-status">{profileStatus}</p>}

              <div className="profile-edit-modal-footer">
                <button className="primary-button profile-edit-save-button" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
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

function ProfileRoute() {
  const { userId } = useParams();
  return <Profile key={userId} />;
}

export default ProfileRoute;

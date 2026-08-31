import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import {
  getCommunityPosts,
  getCommunityPost,
  fetchHomeNeighborhood,
  deleteCommunityPost,
  searchCommunityPosts,
} from '../lib/communityApi.js';
import { useAuth } from '../lib/auth.jsx';
import { getUserAvatarColor } from '../lib/reactions.js';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import TrendingPostsWidget from '../components/TrendingPostsWidget.jsx';
import NeighborhoodWeatherAlert from '../components/NeighborhoodWeatherAlert.jsx';
import PhillySportsWidget from '../components/PhillySportsWidget.jsx';
import PostCard from '../components/community/PostCard.jsx';
import CommunityComposer from '../components/community/CommunityComposer.jsx';
import NeighborhoodSelect from '../components/NeighborhoodSelect.jsx';
import { InviteNeighborButton } from '../components/InviteNeighborSheet.jsx';
import { ALL_NEIGHBORHOODS, resolveSavedHomeNeighborhood } from '../lib/homeNeighborhood.js';
import { FEED_LOAD_TIMEOUT_MS, withTimeoutRetry } from '../lib/loadWithTimeout.js';
import { alertUnlessLoginRequired, redirectToSignup } from '../lib/requireSignup.js';

function useMinWidth(px) {
  const [matches, setMatches] = useState(() => window.matchMedia(`(min-width: ${px}px)`).matches);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = (event) => setMatches(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [px]);

  return matches;
}

function weatherAlertProps(neighborhoodName) {
  return neighborhoodName
    ? { neighborhood: neighborhoodName, locationLabel: neighborhoodName }
    : { neighborhood: 'Center City', locationLabel: 'Philadelphia' };
}

function CommunityLeftSidebar({ isLoggedIn, user, profile, neighborhoodName }) {
  const displayName = profile?.name || user?.name || 'Neighbor';
  const profileTo = isLoggedIn && user?.id ? `/profile/${user.id}` : '/login';
  const profileLinkState = isLoggedIn ? undefined : { from: '/community' };
  const homeNeighborhood = neighborhoodName || '';

  useEffect(() => {
    if (!isLoggedIn) return;
    console.log('[CommunitySidebar] View your profile link', {
      hrefTarget: profileTo,
      contextUserId: user?.id ?? null,
      contextEmail: user?.email ?? null,
      authProfileId: profile?.id ?? null,
      authProfileName: profile?.name ?? null,
    });
  }, [isLoggedIn, profileTo, user?.id, user?.email, profile?.id, profile?.name]);

  return (
    <aside className="feed-left-sidebar" aria-label="Your profile">
      <div className="feed-left-card feed-left-profile-card">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="feed-left-avatar" draggable={false} />
        ) : (
          <div
            className="feed-left-avatar feed-left-avatar-placeholder"
            style={{ backgroundColor: getUserAvatarColor(user?.id, displayName) }}
          >
            {displayName.charAt(0) || 'Y'}
          </div>
        )}
        <div className="feed-left-profile-copy">
          <strong className="feed-left-profile-name">{displayName}</strong>
          <Link to={profileTo} state={profileLinkState} className="feed-left-profile-link">
            View your profile
          </Link>
        </div>
      </div>

      <div className="feed-left-card feed-left-neighborhood-card">
        <MapPin size={18} />
        <div className="feed-left-neighborhood-copy">
          <span className="feed-left-neighborhood-label">Your Neighborhood</span>
          <strong className="feed-left-neighborhood-name">{homeNeighborhood || 'Not set yet'}</strong>
          {isLoggedIn ? (
            <Link to="/settings" className="feed-left-profile-link">
              {homeNeighborhood ? 'Change' : 'Set your neighborhood'}
            </Link>
          ) : (
            <Link to="/login" state={{ from: '/community' }} className="feed-left-profile-link">
              Sign in to set yours
            </Link>
          )}
        </div>
      </div>

      {isLoggedIn && user?.id && (
        <div className="feed-left-card feed-left-invite-card">
          <InviteNeighborButton userId={user.id} className="feed-left-invite-button" />
        </div>
      )}

      {homeNeighborhood ? (
        <NeighborhoodWeatherAlert neighborhood={homeNeighborhood} locationLabel={homeNeighborhood} />
      ) : (
        <NeighborhoodWeatherAlert neighborhood="Center City" locationLabel="Philadelphia" />
      )}
      <PhillySportsWidget />
    </aside>
  );
}

function CommunityMobileExtras() {
  const [openPanel, setOpenPanel] = useState(null);

  function toggle(panel) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  return (
    <div className="feed-mobile-extras">
      <div className="feed-mobile-extras-toggles">
        <button
          type="button"
          className={`feed-mobile-extras-toggle${openPanel === 'sports' ? ' is-open' : ''}`}
          aria-expanded={openPanel === 'sports'}
          aria-controls="feed-mobile-extras-sports"
          onClick={() => toggle('sports')}
        >
          Sports
        </button>
        <button
          type="button"
          className={`feed-mobile-extras-toggle feed-mobile-extras-toggle--trending${openPanel === 'trending' ? ' is-open' : ''}`}
          aria-expanded={openPanel === 'trending'}
          aria-controls="feed-mobile-extras-trending"
          onClick={() => toggle('trending')}
        >
          Trending
        </button>
      </div>

      {openPanel === 'sports' && (
        <div id="feed-mobile-extras-sports" className="feed-mobile-extras-panel feed-mobile-sports">
          <PhillySportsWidget />
        </div>
      )}
      {openPanel === 'trending' && (
        <div id="feed-mobile-extras-trending" className="feed-mobile-extras-panel feed-mobile-trending">
          <TrendingPostsWidget />
        </div>
      )}
    </div>
  );
}

function CommunityMobileRail({ isLoggedIn, user, profile, neighborhoodName }) {
  const displayName = profile?.name || user?.name || 'Neighbor';
  const profileTo = isLoggedIn && user?.id ? `/profile/${user.id}` : '/login';
  const profileLinkState = isLoggedIn ? undefined : { from: '/community' };
  const homeNeighborhood = neighborhoodName || '';

  return (
    <aside className="feed-mobile-rail" aria-label="Your neighborhood and local info">
      <div className="feed-mobile-identity">
        <div className="feed-mobile-identity-row">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="feed-left-avatar" draggable={false} />
          ) : (
            <div
              className="feed-left-avatar feed-left-avatar-placeholder"
              style={{ backgroundColor: getUserAvatarColor(user?.id, displayName) }}
            >
              {displayName.charAt(0) || 'Y'}
            </div>
          )}
          <div className="feed-left-profile-copy">
            <strong className="feed-left-profile-name">{displayName}</strong>
            <Link to={profileTo} state={profileLinkState} className="feed-left-profile-link">
              View your profile
            </Link>
          </div>
        </div>

        <div className="feed-mobile-neighborhood">
          <MapPin size={18} aria-hidden="true" />
          <div className="feed-left-neighborhood-copy">
            <span className="feed-left-neighborhood-label">Your Neighborhood</span>
            <strong className="feed-left-neighborhood-name">{homeNeighborhood || 'Not set yet'}</strong>
            {isLoggedIn ? (
              <Link to="/settings" className="feed-left-profile-link">
                {homeNeighborhood ? 'Change' : 'Set your neighborhood'}
              </Link>
            ) : (
              <Link to="/login" state={{ from: '/community' }} className="feed-left-profile-link">
                Sign in to set yours
              </Link>
            )}
          </div>
        </div>

        {isLoggedIn && user?.id && (
          <InviteNeighborButton userId={user.id} className="feed-mobile-invite-button" />
        )}
      </div>
    </aside>
  );
}

const SEARCH_EXAMPLES = ['Plumber', 'House Cleaner', 'Roof Repair', 'Contractor', 'House Painter', 'Electrician'];

function AnimatedPlaceholder() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % SEARCH_EXAMPLES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="search-placeholder-animated">
      Search for <span key={index} className="search-placeholder-word">{SEARCH_EXAMPLES[index]}</span>
    </span>
  );
}

function Community() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoggedIn, user, profile } = useAuth();
  const showDesktopLeftSidebar = useMinWidth(1280);
  const showDesktopRightSidebar = useMinWidth(1025);
  const [posts, setPosts] = useState([]);
  const [homeNeighborhood, setHomeNeighborhood] = useState(() => resolveSavedHomeNeighborhood(profile));
  const [neighborhood, setNeighborhood] = useState(() => resolveSavedHomeNeighborhood(profile) || ALL_NEIGHBORHOODS);
  const [filterTab, setFilterTab] = useState(() => (resolveSavedHomeNeighborhood(profile) ? 'nearby' : 'all'));
  const browseOverrideRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchQuery = searchParams.get('search') || '';
  const highlightedPostId = searchParams.get('post') || '';
  const [searchInput, setSearchInput] = useState(searchQuery);

  const [composerSeed, setComposerSeed] = useState('');
  const scrolledPostIdRef = useRef('');

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (searchParams.get('compose') !== 'alert') return;
    const title = searchParams.get('title') || 'this alert';
    if (!isLoggedIn) {
      redirectToSignup(navigate, `/?compose=alert&title=${encodeURIComponent(title)}`);
      return;
    }
    setComposerSeed(`Neighbors — weather alert: ${title}\n\n`);
    const next = new URLSearchParams(searchParams);
    next.delete('compose');
    next.delete('title');
    setSearchParams(next, { replace: true });
  }, [homeNeighborhood, isLoggedIn, navigate, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeNeighborhood() {
      const next = await fetchHomeNeighborhood(isLoggedIn ? user?.id : null, profile);
      if (cancelled) return;
      setHomeNeighborhood(next);
      if (!browseOverrideRef.current && next) {
        setNeighborhood(next);
        setFilterTab((current) => (current === 'all' ? 'nearby' : current));
      }
    }

    loadHomeNeighborhood();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id, profile?.neighborhood]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError('');

      async function loadPosts() {
        const timeoutMessage = 'Supabase took too long to load posts. Please try again.';
        try {
          const nextPosts = searchQuery
            ? await withTimeoutRetry(
                () => searchCommunityPosts(searchQuery),
                FEED_LOAD_TIMEOUT_MS,
                timeoutMessage,
              )
            : await withTimeoutRetry(
                () => getCommunityPosts({ neighborhood }),
                FEED_LOAD_TIMEOUT_MS,
                timeoutMessage,
              );

          if (!cancelled) setPosts(nextPosts);
        } catch (err) {
          if (!cancelled) setError(err.message || 'Could not load community posts.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadPosts();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [neighborhood, searchQuery]);

  useEffect(() => {
    if (!highlightedPostId || loading) return;

    let cancelled = false;

    async function pinHighlightedPost() {
      try {
        const post = await getCommunityPost(highlightedPostId);
        if (cancelled || !post) return;
        setPosts((current) => (
          current.some((item) => item.id === post.id) ? current : [post, ...current]
        ));
      } catch (err) {
        console.warn('[Community] could not load highlighted post:', err);
      }
    }

    pinHighlightedPost();
    return () => {
      cancelled = true;
    };
  }, [highlightedPostId, loading]);

  useEffect(() => {
    if (loading || !highlightedPostId) return;
    if (scrolledPostIdRef.current === highlightedPostId) return;
    const el = document.getElementById(`community-post-${highlightedPostId}`);
    if (!el) return;
    scrolledPostIdRef.current = highlightedPostId;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [loading, highlightedPostId, posts]);

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter' && searchInput.trim()) {
      navigate(`/community?search=${encodeURIComponent(searchInput.trim())}`);
    }
    if (e.key === 'Escape') {
      setSearchInput('');
      navigate('/community');
    }
  }

  function handleLike(postId, countDelta) {
    if (!countDelta) return;

    setPosts(posts.map((post) =>
      post.id === postId
        ? { ...post, like_count: Math.max(0, (post.like_count || 0) + countDelta) }
        : post
    ));
  }

  async function handleDelete(postId) {
    if (!window.confirm('Delete this post?')) return;

    try {
      await deleteCommunityPost(postId);
      setPosts(posts.filter((post) => post.id !== postId));
    } catch (error) {
      alertUnlessLoginRequired(error, navigate);
    }
  }

  return (
    <>
      <section className="feed-welcome-banner">
        <div className="feed-welcome-content">
          <span className="feed-welcome-eyebrow">PhillyGrind Community</span>
          <h1 className="feed-welcome-title">Connect with your neighborhood</h1>
        </div>
      </section>

      <section className="page-section browse-content community-content">
        <div className="feed-layout">
          {showDesktopLeftSidebar && (
            <CommunityLeftSidebar isLoggedIn={isLoggedIn} user={user} profile={profile} neighborhoodName={homeNeighborhood} />
          )}

          {/* Main Feed Column */}
          <div className="feed-main-column">
            <CommunityMobileRail
              isLoggedIn={isLoggedIn}
              user={user}
              profile={profile}
              neighborhoodName={homeNeighborhood}
            />

            <div className="feed-mobile-weather">
              <NeighborhoodWeatherAlert {...weatherAlertProps(homeNeighborhood)} />
            </div>

            <CommunityMobileExtras />

            {/* Filter Tabs */}
            <div className="feed-filter-toolbar">
              <NeighborhoodSelect
                id="community-neighborhood"
                label="Show posts from"
                value={neighborhood}
                onChange={(next) => {
                  browseOverrideRef.current = true;
                  setNeighborhood(next);
                  setFilterTab(next === ALL_NEIGHBORHOODS ? 'all' : 'nearby');
                }}
              />
              <div className="feed-filter-tabs">
                <button
                  data-filter="all"
                  className={`feed-filter-tab ${filterTab === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    browseOverrideRef.current = true;
                    setFilterTab('all');
                    setNeighborhood(ALL_NEIGHBORHOODS);
                  }}
                >
                  All Neighborhoods
                </button>
                <button
                  data-filter="recent"
                  className={`feed-filter-tab ${filterTab === 'recent' ? 'active' : ''}`}
                  onClick={() => setFilterTab('recent')}
                >
                  Recent
                </button>
                <button
                  data-filter="nearby"
                  className={`feed-filter-tab ${filterTab === 'nearby' ? 'active' : ''}`}
                  onClick={() => {
                    browseOverrideRef.current = true;
                    setFilterTab('nearby');
                    setNeighborhood(homeNeighborhood || ALL_NEIGHBORHOODS);
                  }}
                >
                  Nearby
                </button>
                <button
                  data-filter="popular"
                  className={`feed-filter-tab ${filterTab === 'popular' ? 'active' : ''}`}
                  onClick={() => setFilterTab('popular')}
                >
                  Popular
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="feed-search-bar">
              <Search size={18} className="feed-search-icon" />
              <div className="feed-search-input-wrap">
                <input
                  className="feed-search-input"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                {!searchInput && <AnimatedPlaceholder />}
              </div>
            </div>

            <CommunityComposer
              isLoggedIn={isLoggedIn}
              user={user}
              profile={profile}
              homeNeighborhood={homeNeighborhood}
              loginFrom="/community"
              seedContent={composerSeed}
              onSeedConsumed={() => setComposerSeed('')}
              onOptimisticAdd={(tempPost) => setPosts((current) => [tempPost, ...current])}
              onCommit={(tempPostId, newPost) => {
                setPosts((current) => current.map((post) => (post.id === tempPostId ? newPost : post)));
              }}
              onFail={(tempPostId) => {
                setPosts((current) => current.filter((post) => post.id !== tempPostId));
              }}
            />

            {showDesktopLeftSidebar && (
              <NeighborhoodWeatherAlert
                variant="feed"
                neighborhood={homeNeighborhood || 'Center City'}
                locationLabel={homeNeighborhood || 'Philadelphia'}
              />
            )}

            {loading && <Skeleton variant="feed" count={4} />}
            {error && <p className="empty-state error-state">{error}</p>}

            {!loading && !error && (
              <>
                {searchQuery && (
                  <div className="search-banner">
                    Showing results for <strong>"{searchQuery}"</strong>
                    <Link to="/community" className="search-clear">Clear search</Link>
                  </div>
                )}
                <div className="feed-posts">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={user}
                      onLike={handleLike}
                      onDelete={handleDelete}
                      highlighted={post.id === highlightedPostId}
                      autoOpenComments={post.id === highlightedPostId}
                    />
                  ))}
                </div>
                {!posts.length && (
                  <EmptyState
                    icon="community"
                    title="No posts in this neighborhood yet"
                    message="Be the first to share with your community!"
                  />
                )}
              </>
            )}

            {!isLoggedIn && (
              <p className="feed-login-hint">
                <Link to="/login" state={{ from: '/community' }}>Log in</Link> to post and comment in the community.
              </p>
            )}
          </div>

          {showDesktopRightSidebar && (
            <div className="feed-sidebar">
              <TrendingPostsWidget />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default Community;

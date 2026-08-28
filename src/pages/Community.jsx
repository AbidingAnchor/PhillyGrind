import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import {
  getCommunityPosts,
  getCommunityPost,
  fetchHomeNeighborhood,
  resolveHomeNeighborhood,
  deleteCommunityPost,
  searchCommunityPosts,
} from '../lib/communityApi.js';
import { useAuth } from '../lib/auth.jsx';
import { getUserAvatarColor } from '../lib/reactions.js';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import TrendingPostsWidget from '../components/TrendingPostsWidget.jsx';
import NeighborhoodWeatherAlert from '../components/NeighborhoodWeatherAlert.jsx';
import PostCard from '../components/community/PostCard.jsx';
import CommunityComposer from '../components/community/CommunityComposer.jsx';
import { InviteNeighborButton } from '../components/InviteNeighborSheet.jsx';
import { FEED_LOAD_TIMEOUT_MS, withTimeoutRetry } from '../lib/loadWithTimeout.js';

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
  const [posts, setPosts] = useState([]);
  const [homeNeighborhood, setHomeNeighborhood] = useState(() => resolveHomeNeighborhood(profile));
  const [neighborhood, setNeighborhood] = useState(resolveHomeNeighborhood(profile) || 'Any');
  const [filterTab, setFilterTab] = useState('all'); // all, recent, nearby, popular
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
      navigate('/login', { state: { from: `/?compose=alert&title=${encodeURIComponent(title)}` } });
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
      setNeighborhood((current) => (current === 'Any' && next ? next : current));
    }

    loadHomeNeighborhood();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id, profile?.neighborhood, profile?.neighborhoods]);

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
      alert(error.message);
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
          <CommunityLeftSidebar isLoggedIn={isLoggedIn} user={user} profile={profile} neighborhoodName={homeNeighborhood} />

          {/* Main Feed Column */}
          <div className="feed-main-column">
            {/* Filter Tabs */}
            <div className="feed-filter-tabs">
              <button
                className={`feed-filter-tab ${filterTab === 'all' ? 'active' : ''}`}
                onClick={() => setFilterTab('all')}
              >
                All Neighborhoods
              </button>
              <button
                className={`feed-filter-tab ${filterTab === 'recent' ? 'active' : ''}`}
                onClick={() => setFilterTab('recent')}
              >
                Recent
              </button>
              <button
                className={`feed-filter-tab ${filterTab === 'nearby' ? 'active' : ''}`}
                onClick={() => {
                  setFilterTab('nearby');
                  setNeighborhood(homeNeighborhood || 'Any');
                }}
              >
                Nearby
              </button>
              <button
                className={`feed-filter-tab ${filterTab === 'popular' ? 'active' : ''}`}
                onClick={() => setFilterTab('popular')}
              >
                Popular
              </button>
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

            <NeighborhoodWeatherAlert
              variant="feed"
              neighborhood={homeNeighborhood || 'Center City'}
              locationLabel={homeNeighborhood || 'Philadelphia'}
            />

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

          {/* Sidebar */}
          <div className="feed-sidebar">
            <TrendingPostsWidget />
          </div>
        </div>
      </section>
    </>
  );
}

export default Community;

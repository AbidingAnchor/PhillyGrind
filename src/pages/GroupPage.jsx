import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, X } from 'lucide-react';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PostCard from '../components/community/PostCard.jsx';
import CommunityComposer from '../components/community/CommunityComposer.jsx';
import { getGroup, isGroupMember, joinGroup, leaveGroup } from '../lib/groupsApi.js';
import { getGroupPosts, deleteCommunityPost } from '../lib/communityApi.js';
import { useAuth } from '../lib/auth.jsx';
import { FEED_LOAD_TIMEOUT_MS, withTimeoutRetry } from '../lib/loadWithTimeout.js';
import { alertUnlessLoginRequired, isLoginRequiredError, redirectToSignup } from '../lib/requireSignup.js';

function LeaveGroupModal({ isOpen, groupName, busy, onClose, onConfirm }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Leave {groupName}?</h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: '24px', color: 'var(--muted)' }}>
            You&apos;ll need to join again to participate in this group.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>
              {busy ? 'Leaving…' : 'Leave Group'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, user, profile } = useAuth();
  const [group, setGroup] = useState(null);
  const [membership, setMembership] = useState({ isMember: false, role: null });
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');

  const refreshGroup = useCallback(async () => {
    const [nextGroup, nextMembership] = await Promise.all([
      getGroup(groupId),
      isGroupMember(groupId),
    ]);
    setGroup(nextGroup);
    setMembership(nextMembership);
    return { nextGroup, nextMembership };
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const { nextGroup } = await refreshGroup();
        if (!cancelled && !nextGroup) {
          setLoadError('Group not found.');
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || 'Could not load group.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshGroup]);

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;

    async function loadPosts() {
      setPostsLoading(true);
      setPostsError('');
      try {
        const nextPosts = await withTimeoutRetry(
          () => getGroupPosts(groupId),
          FEED_LOAD_TIMEOUT_MS,
          'Supabase took too long to load posts. Please try again.',
        );
        if (!cancelled) setPosts(nextPosts);
      } catch (error) {
        if (!cancelled) setPostsError(error.message || 'Could not load group posts.');
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  async function handleJoin() {
    setActionBusy('join');
    setActionError('');
    try {
      await joinGroup(groupId);
      await refreshGroup();
    } catch (error) {
      console.error('[GroupPage] join failed', error);
      if (isLoginRequiredError(error)) {
        redirectToSignup(navigate);
        return;
      }
      setActionError(error.message || 'Could not join group.');
    } finally {
      setActionBusy('');
    }
  }

  async function handleLeaveConfirm() {
    setActionBusy('leave');
    setActionError('');
    try {
      await leaveGroup(groupId);
      setShowLeaveModal(false);
      const { nextGroup } = await refreshGroup();
      if (!nextGroup) {
        navigate('/groups', { replace: true });
      }
    } catch (error) {
      console.error('[GroupPage] leave failed', error);
      setActionError(error.message || 'Could not leave group.');
      setShowLeaveModal(false);
    } finally {
      setActionBusy('');
    }
  }

  if (loading) {
    return (
      <section className="page-section group-page">
        <Skeleton variant="page" />
      </section>
    );
  }

  if (loadError || !group) {
    return (
      <section className="page-section group-page">
        <Link to="/" className="group-page-back">
          <ArrowLeft size={18} />
          Back
        </Link>
        <p className="empty-state">{loadError || 'Group not found.'}</p>
      </section>
    );
  }

  const memberLabel = `${group.member_count ?? 0} ${(group.member_count === 1) ? 'member' : 'members'}`;

  return (
    <section className="page-section group-page">
      <Link to="/" className="group-page-back">
        <ArrowLeft size={18} />
        Back
      </Link>

      <header className="group-page-hero">
        <span className="group-create-kicker">Groups</span>
        <h1>{group.name}</h1>
        <div className="group-page-hero-meta">
          {group.category && <span className="group-create-category">{group.category}</span>}
          <span className="group-page-stat">
            <Users size={15} />
            {memberLabel}
          </span>
          {group.neighborhood && (
            <span className="group-page-stat">
              <MapPin size={15} />
              {group.neighborhood}
            </span>
          )}
        </div>
        <p className="group-page-description">
          {group.description?.trim() || 'No description yet — add one so neighbors know what this space is for.'}
        </p>
      </header>

      <div className="group-page-toolbar">
        {membership.isMember && membership.role === 'admin' && (
          <span className="group-page-role-chip">Admin</span>
        )}
        {membership.isMember && membership.role !== 'admin' && (
          <span className="group-page-role-chip is-member">Member</span>
        )}
        <div className="group-page-actions">
          {membership.isMember ? (
            <button
              type="button"
              className="filter group-page-leave"
              disabled={!!actionBusy}
              onClick={() => {
                setActionError('');
                setShowLeaveModal(true);
              }}
            >
              Leave Group
            </button>
          ) : (
            <button
              type="button"
              className="filter active"
              disabled={actionBusy === 'join'}
              onClick={handleJoin}
            >
              {actionBusy === 'join' ? 'Joining…' : 'Join Group'}
            </button>
          )}
        </div>
      </div>

      {actionError && <p className="form-status error-text">{actionError}</p>}

      <div className="group-page-feed">
        <div className="group-page-feed-label">Posts</div>

        {membership.isMember && (
          <CommunityComposer
            isLoggedIn={isLoggedIn}
            user={user}
            profile={profile}
            homeNeighborhood={group.neighborhood}
            defaultNeighborhood={group.neighborhood}
            groupId={group.id}
            eyebrow="Groups"
            title={`Post in ${group.name}`}
            prompt={`Share something with ${group.name}…`}
            showJobShortcut={false}
            loginFrom={`/groups/${group.id}`}
            onOptimisticAdd={(tempPost) => setPosts((current) => [tempPost, ...current])}
            onCommit={(tempPostId, newPost) => {
              setPosts((current) => current.map((post) => (post.id === tempPostId ? newPost : post)));
            }}
            onFail={(tempPostId) => {
              setPosts((current) => current.filter((post) => post.id !== tempPostId));
            }}
          />
        )}

        {postsLoading && <Skeleton variant="feed" count={4} />}
        {postsError && <p className="empty-state error-state">{postsError}</p>}

        {!postsLoading && !postsError && (
          <>
            <div className="feed-posts">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={user}
                  onLike={(postId, countDelta) => {
                    if (!countDelta) return;
                    setPosts((current) =>
                      current.map((item) =>
                        item.id === postId
                          ? { ...item, like_count: Math.max(0, (item.like_count || 0) + countDelta) }
                          : item,
                      ),
                    );
                  }}
                  onDelete={async (postId) => {
                    if (!window.confirm('Delete this post?')) return;
                    try {
                      await deleteCommunityPost(postId);
                      setPosts((current) => current.filter((item) => item.id !== postId));
                    } catch (error) {
                      alertUnlessLoginRequired(error, navigate);
                    }
                  }}
                  readOnly={!membership.isMember}
                  allowShare={false}
                />
              ))}
            </div>
            {!posts.length && (
              <div className="group-page-empty">
                <EmptyState
                  icon="community"
                  title={`Nothing in ${group.name} yet`}
                  message={
                    membership.isMember
                      ? `Be the first to post — neighbors in ${group.name} are waiting to hear from you.`
                      : `Join ${group.name} to start the conversation. You can still read posts once they’re here.`
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      <LeaveGroupModal
        isOpen={showLeaveModal}
        groupName={group.name}
        busy={actionBusy === 'leave'}
        onClose={() => {
          if (actionBusy !== 'leave') {
            setShowLeaveModal(false);
          }
        }}
        onConfirm={handleLeaveConfirm}
      />
    </section>
  );
}

export default GroupPage;

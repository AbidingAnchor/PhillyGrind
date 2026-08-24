import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users, X } from 'lucide-react';
import Skeleton from '../components/Skeleton.jsx';
import { getGroup, isGroupMember, joinGroup, leaveGroup } from '../lib/groupsApi.js';

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
  const [group, setGroup] = useState(null);
  const [membership, setMembership] = useState({ isMember: false, role: null });
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);

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

  async function handleJoin() {
    setActionBusy('join');
    setActionError('');
    try {
      await joinGroup(groupId);
      await refreshGroup();
    } catch (error) {
      console.error('[GroupPage] join failed', error);
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
      await refreshGroup();
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

  return (
    <section className="page-section group-page">
      <Link to="/" className="group-page-back">
        <ArrowLeft size={18} />
        Back
      </Link>

      <header className="group-page-header">
        <span className="eyebrow">Group</span>
        <h1>{group.name}</h1>
        {group.category && <p className="group-page-category">{group.category}</p>}
      </header>

      <div className="group-page-meta">
        <span className="group-page-stat">
          <Users size={16} />
          {group.member_count ?? 0} {group.member_count === 1 ? 'member' : 'members'}
        </span>
        {group.neighborhood && (
          <span className="group-page-neighborhood">{group.neighborhood}</span>
        )}
      </div>

      <p className="group-page-description">
        {group.description?.trim() || 'No description yet.'}
      </p>

      {membership.isMember && membership.role === 'admin' && (
        <p className="group-page-role-note">You&apos;re an admin of this group.</p>
      )}

      <div className="group-page-actions">
        {membership.isMember ? (
          <button
            type="button"
            className="secondary-button"
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
            className="primary-button"
            disabled={actionBusy === 'join'}
            onClick={handleJoin}
          >
            {actionBusy === 'join' ? 'Joining…' : 'Join Group'}
          </button>
        )}
      </div>

      {actionError && <p className="form-status error-text">{actionError}</p>}

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

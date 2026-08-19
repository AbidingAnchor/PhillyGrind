import { useEffect, useState } from 'react';
import { Loader2, ShieldOff, ShieldBan, ShieldCheck, Users, BadgeCheck, Ban, UserX } from 'lucide-react';
import { adminVerifyLandlord, getAdminUsers, liftSuspension, suspendUser } from '../../lib/adminApi.js';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/auth.jsx';
import KebabMenu from '../../components/KebabMenu.jsx';
import AdminDetailModal from '../../components/AdminDetailModal.jsx';

export default function AdminUsers() {
  const { isAdmin, isOwner, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionUserId, setActionUserId] = useState('');
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [nameHistory, setNameHistory] = useState([]);
  const [loadingNameHistory, setLoadingNameHistory] = useState(false);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationAction, setModerationAction] = useState(null);
  const [processingModeration, setProcessingModeration] = useState(false);

  // Check if user is online (active within last 5 minutes)
  function isOnline(lastActiveAt) {
    if (!lastActiveAt) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastActiveAt) > fiveMinutesAgo;
  }

  async function loadUsers() {
    try {
      setLoading(true);
      const { users: data } = await getAdminUsers();
      setUsers(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // Load name history when a user is selected
  useEffect(() => {
    async function loadNameHistory() {
      if (!selectedUser) {
        setNameHistory([]);
        return;
      }

      setLoadingNameHistory(true);
      try {
        const { data, error } = await supabase
          .from('name_history')
          .select('*')
          .eq('user_id', selectedUser.id)
          .order('changed_at', { ascending: false });

        if (error) throw error;
        setNameHistory(data || []);
      } catch (err) {
        console.error('Failed to load name history:', err);
        setNameHistory([]);
      } finally {
        setLoadingNameHistory(false);
      }
    }

    loadNameHistory();
  }, [selectedUser]);

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  async function handleSuspend(userId, actionType) {
    if (!reason.trim()) {
      setError('Please provide a reason for this action.');
      return;
    }
    setActionUserId(userId);
    try {
      await suspendUser({ userId, actionType, reason });
      await loadUsers();
      setReason('');
      setActionUserId('');
      setSelectedUser(null);
    } catch (err) {
      setError(err.message);
      setActionUserId('');
    }
  }

  async function handleModerationAction(actionType) {
    if (!selectedUser) return;
    if (!moderationReason.trim()) {
      setError('Please provide a reason for this action.');
      return;
    }

    setProcessingModeration(true);
    try {
      const { error } = await supabase
        .from('admin_action_log')
        .insert({
          admin_id: currentUser.id,
          target_user_id: selectedUser.id,
          action_type: actionType,
          reason: moderationReason,
          metadata: { target_name: selectedUser.name },
        });

      if (error) throw error;

      // For now, just log the action. Actual suspension/banning logic would be implemented here
      setModerationAction(null);
      setModerationReason('');
      setSelectedUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to log moderation action.');
    } finally {
      setProcessingModeration(false);
    }
  }

  async function handleLift(userId) {
    setActionUserId(userId);
    setError('');
    try {
      await liftSuspension(userId);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionUserId('');
    }
  }

  async function handleVerifyLandlord(userId) {
    setActionUserId(userId);
    setError('');
    try {
      await adminVerifyLandlord(userId);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionUserId('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <Users size={28} />
        <div>
          <h1>Users</h1>
          <p>Manage accounts, suspensions, and bans</p>
        </div>
      </header>

      <div className="profile-section-card admin-filters">
        <label>
          Search users
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or email..."
          />
        </label>
        <label>
          Suspension / ban reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason shown internally and used for enforcement"
          />
        </label>
      </div>

      {loading && <p className="empty-state">Loading users...</p>}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && (
        <div className="profile-section-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Account Ref</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Listings</th>
                <th>Reports</th>
                <th>Status</th>
                <th>Online</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const busy = actionUserId === user.id;
                const suspension = user.suspension;
                const online = isOnline(user.last_active_at);
                return (
                  <tr 
                    key={user.id} 
                    onClick={() => setSelectedUser(user)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{user.name}</td>
                    <td><code className="account-ref-badge">{user.account_reference || 'N/A'}</code></td>
                    <td>{user.email}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>{user.listingCount}</td>
                    <td>{user.report_count ?? 0}</td>
                    <td>
                      {suspension ? (
                        <span className={`admin-status-badge ${suspension.action_type}`}>
                          {suspension.action_type}
                        </span>
                      ) : (
                        <span className="admin-status-badge active">active</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-status-badge ${online ? 'online' : 'offline'}`}>
                        {online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td className="admin-table-actions" onClick={(e) => e.stopPropagation()}>
                      <KebabMenu
                        items={[
                          !user.landlord_verified && {
                            label: 'Verify Landlord',
                            icon: <BadgeCheck size={14} />,
                            onClick: () => handleVerifyLandlord(user.id),
                            disabled: busy,
                          },
                          suspension
                            ? {
                                label: 'Lift Suspension',
                                icon: <ShieldCheck size={14} />,
                                onClick: () => handleLift(user.id),
                                disabled: busy,
                              }
                            : {
                                label: 'Suspend',
                                icon: <ShieldOff size={14} />,
                                onClick: () => handleSuspend(user.id, 'suspended'),
                                disabled: busy,
                                warn: true,
                              },
                          !suspension && {
                            label: 'Ban',
                            icon: <ShieldBan size={14} />,
                            onClick: () => handleSuspend(user.id, 'banned'),
                            disabled: busy,
                            danger: true,
                          },
                        ].filter(Boolean)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminDetailModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Details"
      >
        {selectedUser && (
          <>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Account Reference</span>
              <span className="admin-detail-value"><code className="account-ref-badge">{selectedUser.account_reference || 'N/A'}</code></span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Name</span>
              <span className="admin-detail-value">{selectedUser.name}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Email</span>
              <span className="admin-detail-value">
                <a href={`mailto:${selectedUser.email}`}>{selectedUser.email}</a>
              </span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Joined</span>
              <span className="admin-detail-value">{new Date(selectedUser.created_at).toLocaleString()}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Listings</span>
              <span className="admin-detail-value">{selectedUser.listingCount}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Reports</span>
              <span className="admin-detail-value">{selectedUser.report_count ?? 0}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Landlord Verified</span>
              <span className="admin-detail-value">{selectedUser.landlord_verified ? 'Yes' : 'No'}</span>
            </div>
            {selectedUser.suspension && (
              <>
                <div className="admin-detail-row">
                  <span className="admin-detail-label">Status</span>
                  <span className="admin-detail-value">{selectedUser.suspension.action_type}</span>
                </div>
                <div className="admin-detail-row">
                  <span className="admin-detail-label">Reason</span>
                  <span className="admin-detail-value">{selectedUser.suspension.reason}</span>
                </div>
                <div className="admin-detail-row">
                  <span className="admin-detail-label">Suspended Since</span>
                  <span className="admin-detail-value">{new Date(selectedUser.suspension.created_at).toLocaleString()}</span>
                </div>
              </>
            )}
            {nameHistory.length > 0 && (
              <div className="admin-detail-row">
                <span className="admin-detail-label">Previously known as</span>
                <span className="admin-detail-value">
                  {loadingNameHistory ? (
                    'Loading...'
                  ) : (
                    <ul className="name-history-list">
                      {nameHistory.map((entry) => (
                        <li key={entry.id}>
                          {entry.old_name} → {entry.new_name} ({new Date(entry.changed_at).toLocaleDateString()})
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
              </div>
            )}
            {isAdmin && (
              <div className="admin-moderation-section">
                <h3>Moderation Actions</h3>
                <div className="admin-moderation-buttons">
                  <button
                    type="button"
                    className="admin-moderation-btn suspend"
                    onClick={() => setModerationAction('suspend')}
                    disabled={processingModeration}
                  >
                    <ShieldBan size={16} />
                    Suspend
                  </button>
                  <button
                    type="button"
                    className="admin-moderation-btn ban"
                    onClick={() => setModerationAction('ban')}
                    disabled={processingModeration}
                  >
                    <Ban size={16} />
                    Ban
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      className="admin-moderation-btn ip-ban"
                      onClick={() => setModerationAction('ip_ban')}
                      disabled={processingModeration}
                    >
                      <UserX size={16} />
                      IP Ban
                    </button>
                  )}
                </div>
                {moderationAction && (
                  <div className="admin-moderation-form">
                    <textarea
                      placeholder="Reason for this action..."
                      value={moderationReason}
                      onChange={(e) => setModerationReason(e.target.value)}
                      className="admin-moderation-textarea"
                    />
                    <div className="admin-moderation-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setModerationAction(null);
                          setModerationReason('');
                        }}
                        disabled={processingModeration}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="primary-button danger"
                        onClick={() => handleModerationAction(moderationAction)}
                        disabled={processingModeration || !moderationReason.trim()}
                      >
                        {processingModeration ? 'Processing...' : `Confirm ${moderationAction.replace('_', ' ')}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </AdminDetailModal>
    </div>
  );
}

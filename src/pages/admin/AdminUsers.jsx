import { useEffect, useState } from 'react';
import { Loader2, ShieldOff, ShieldBan, ShieldCheck, Users, BadgeCheck, Ban, UserX, Unlock } from 'lucide-react';
import { adminVerifyLandlord, getAdminUsers, liftSuspension, suspendUser, banUser, ipBanUser, getUserSuspensionStatus } from '../../lib/adminApi.js';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../lib/auth.jsx';
import KebabMenu from '../../components/KebabMenu.jsx';
import AdminDetailModal from '../../components/AdminDetailModal.jsx';
import Skeleton from '../../components/Skeleton.jsx';

export default function AdminUsers() {
  const { isAdmin, isOwner, user: currentUser, profile, refreshProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionUserId, setActionUserId] = useState('');
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [nameHistory, setNameHistory] = useState([]);
  const [loadingNameHistory, setLoadingNameHistory] = useState(false);
  const [suspensionStatus, setSuspensionStatus] = useState(null);
  const [loadingSuspension, setLoadingSuspension] = useState(false);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationAction, setModerationAction] = useState(null);
  const [processingModeration, setProcessingModeration] = useState(false);

  // Refresh profile to get role if not loaded
  useEffect(() => {
    if (currentUser && !profile?.role) {
      refreshProfile();
    }
  }, [currentUser, profile, refreshProfile]);

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
        setSuspensionStatus(null);
        return;
      }

      setLoadingNameHistory(true);
      setLoadingSuspension(true);
      try {
        const [nameHistoryData, suspensionData] = await Promise.all([
          supabase
            .from('name_history')
            .select('*')
            .eq('user_id', selectedUser.id)
            .order('changed_at', { ascending: false }),
          getUserSuspensionStatus(selectedUser.id)
        ]);

        if (nameHistoryData.error) throw nameHistoryData.error;
        setNameHistory(nameHistoryData.data || []);
        setSuspensionStatus(suspensionData);
      } catch (err) {
        console.error('Failed to load user details:', err);
        setNameHistory([]);
        setSuspensionStatus(null);
      } finally {
        setLoadingNameHistory(false);
        setLoadingSuspension(false);
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
      if (actionType === 'suspended') {
        await suspendUser(userId, reason);
      } else if (actionType === 'banned') {
        await banUser(userId, reason);
      }
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
      if (actionType === 'suspend') {
        await suspendUser(selectedUser.id, moderationReason);
      } else if (actionType === 'ban') {
        await banUser(selectedUser.id, moderationReason);
      } else if (actionType === 'ip_ban') {
        await ipBanUser(selectedUser.id, moderationReason);
      }
      
      setModerationAction(null);
      setModerationReason('');
      await loadUsers();
      // Refresh suspension status for the selected user
      const newSuspensionStatus = await getUserSuspensionStatus(selectedUser.id);
      setSuspensionStatus(newSuspensionStatus);
    } catch (err) {
      setError(err.message || 'Failed to perform moderation action.');
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
      if (selectedUser?.id === userId) {
        setSuspensionStatus(null);
      }
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

      {loading && <Skeleton variant="list" />}
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
                      {user.suspension ? (
                        <span className={`admin-status-badge ${user.suspension.suspension_type}`}>
                          {user.suspension.suspension_type === 'ban' ? 'BANNED' : 'SUSPENDED'}
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
        className={suspensionStatus?.suspension_type === 'ban' ? 'modal-border-red' : suspensionStatus ? 'modal-border-amber' : ''}
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
            {loadingSuspension ? (
              <div className="admin-detail-row">
                <span className="admin-detail-label">Status</span>
                <span className="admin-detail-value">Loading...</span>
              </div>
            ) : suspensionStatus ? (
              <div className={`admin-suspension-section ${suspensionStatus.suspension_type === 'ban' ? 'suspension-ban' : 'suspension-suspend'}`}>
                <div className="admin-suspension-header">
                  <span className="admin-suspension-label">Account Status</span>
                  <span className={`admin-suspension-badge ${suspensionStatus.suspension_type === 'ban' ? 'badge-red' : 'badge-amber'}`}>
                    {suspensionStatus.suspension_type === 'ban' ? 'BANNED' : 'SUSPENDED'}
                  </span>
                </div>
                <div className="admin-suspension-details">
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Reason</span>
                    <span className="admin-detail-value">{suspensionStatus.reason}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">
                      {suspensionStatus.suspension_type === 'ban' ? 'Banned Since' : 'Suspended Since'}
                    </span>
                    <span className="admin-detail-value">
                      {new Date(suspensionStatus.created_at || suspensionStatus.suspended_at).toLocaleString()}
                    </span>
                  </div>
                  {suspensionStatus.expires_at && (
                    <div className="admin-detail-row">
                      <span className="admin-detail-label">Expires</span>
                      <span className="admin-detail-value">{new Date(suspensionStatus.expires_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="admin-detail-row">
                <span className="admin-detail-label">Status</span>
                <span className="admin-detail-value admin-status-badge active">Active</span>
              </div>
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
                  {suspensionStatus ? (
                    <button
                      type="button"
                      className="admin-moderation-btn lift"
                      onClick={() => handleLift(selectedUser.id)}
                      disabled={processingModeration}
                    >
                      <Unlock size={16} />
                      Lift Suspension
                    </button>
                  ) : (
                    <>
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
                    </>
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
            {!isAdmin && profile && (
              <div className="admin-detail-row">
                <span className="admin-detail-label">Your Role</span>
                <span className="admin-detail-value">{profile.role || 'user'} (no moderation access)</span>
              </div>
            )}
          </>
        )}
      </AdminDetailModal>
    </div>
  );
}

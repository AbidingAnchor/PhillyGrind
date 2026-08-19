import { useEffect, useState } from 'react';
import { Loader2, ShieldOff, ShieldBan, ShieldCheck, Users, BadgeCheck } from 'lucide-react';
import { adminVerifyLandlord, getAdminUsers, liftSuspension, suspendUser } from '../../lib/adminApi.js';
import KebabMenu from '../../components/KebabMenu.jsx';
import AdminDetailModal from '../../components/AdminDetailModal.jsx';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionUserId, setActionUserId] = useState('');
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

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

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  async function handleSuspend(userId, actionType) {
    if (!reason.trim()) {
      setError('Please enter a reason.');
      return;
    }
    setActionUserId(userId);
    setError('');
    try {
      await suspendUser(userId, reason.trim(), actionType);
      setReason('');
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionUserId('');
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
          </>
        )}
      </AdminDetailModal>
    </div>
  );
}

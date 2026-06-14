import { useEffect, useState } from 'react';
import { Loader2, ShieldOff, ShieldBan, ShieldCheck, Users, BadgeCheck } from 'lucide-react';
import { adminVerifyLandlord, getAdminUsers, liftSuspension, suspendUser } from '../../lib/adminApi.js';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionUserId, setActionUserId] = useState('');
  const [reason, setReason] = useState('');

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

      <div className="profile-section-card admin-action-bar">
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const busy = actionUserId === user.id;
                const suspension = user.suspension;
                return (
                  <tr key={user.id}>
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
                    <td className="admin-table-actions">
                      {!user.landlord_verified && (
                        <button
                          type="button"
                          className="admin-table-btn"
                          disabled={busy}
                          onClick={() => handleVerifyLandlord(user.id)}
                        >
                          {busy ? <Loader2 size={14} className="spin" /> : <BadgeCheck size={14} />}
                          Verify Landlord
                        </button>
                      )}
                      {suspension ? (
                        <button
                          type="button"
                          className="admin-table-btn"
                          disabled={busy}
                          onClick={() => handleLift(user.id)}
                        >
                          {busy ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                          Lift
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="admin-table-btn warn"
                            disabled={busy}
                            onClick={() => handleSuspend(user.id, 'suspended')}
                          >
                            {busy ? <Loader2 size={14} className="spin" /> : <ShieldOff size={14} />}
                            Suspend
                          </button>
                          <button
                            type="button"
                            className="admin-table-btn danger"
                            disabled={busy}
                            onClick={() => handleSuspend(user.id, 'banned')}
                          >
                            {busy ? <Loader2 size={14} className="spin" /> : <ShieldBan size={14} />}
                            Ban
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

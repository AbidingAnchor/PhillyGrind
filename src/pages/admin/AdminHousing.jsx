import { useEffect, useState } from 'react';
import { Home, Loader2, Trash2 } from 'lucide-react';
import { adminDeactivateHousing, getAdminHousing } from '../../lib/adminApi.js';

export default function AdminHousing() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');

  async function loadListings() {
    try {
      setLoading(true);
      const { listings: data } = await getAdminHousing();
      setListings(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadListings();
  }, []);

  async function handleRemove(listing) {
    if (!window.confirm(`Remove "${listing.title}"? It will be marked inactive.`)) return;

    setRemovingId(listing.id);
    setError('');
    try {
      await adminDeactivateHousing(listing.id);
      await loadListings();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <Home size={28} />
        <div>
          <h1>Housing</h1>
          <p>Manage rental listings and landlord activity</p>
        </div>
      </header>

      {loading && <p className="empty-state">Loading housing listings...</p>}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && (
        <div className="profile-section-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Landlord</th>
                <th>Rent</th>
                <th>Date</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">No housing listings yet.</td>
                </tr>
              )}
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td>{listing.title}</td>
                  <td>{listing.landlordName}</td>
                  <td>${Number(listing.monthly_rent).toLocaleString()}/mo</td>
                  <td>{new Date(listing.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`admin-status-badge ${listing.status === 'active' ? 'active' : 'open'}`}>
                      {listing.status}
                    </span>
                  </td>
                  <td>
                    {listing.status === 'active' && (
                      <button
                        type="button"
                        className="admin-table-btn danger"
                        disabled={removingId === listing.id}
                        onClick={() => handleRemove(listing)}
                      >
                        {removingId === listing.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

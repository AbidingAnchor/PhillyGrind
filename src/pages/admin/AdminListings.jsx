import { useEffect, useState } from 'react';
import { Loader2, ShoppingBag, Trash2 } from 'lucide-react';
import { adminDeleteListing, getAdminListings } from '../../lib/adminApi.js';

export default function AdminListings() {
  const [listings, setListings] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');

  async function loadListings() {
    try {
      setLoading(true);
      const { listings: data } = await getAdminListings({ type: typeFilter, status: statusFilter });
      setListings(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadListings();
  }, [typeFilter, statusFilter]);

  async function handleDelete(listing) {
    if (!window.confirm(`Remove "${listing.title}"? This cannot be undone.`)) return;

    setDeletingId(listing.id);
    setError('');
    try {
      await adminDeleteListing(listing.id, listing.listing_type);
      await loadListings();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <ShoppingBag size={28} />
        <div>
          <h1>Listings</h1>
          <p>Jobs, gigs, and marketplace listings</p>
        </div>
      </header>

      <div className="profile-section-card admin-filters">
        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            <option value="job">Jobs</option>
            <option value="gig">Gigs</option>
            <option value="marketplace">Marketplace</option>
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="removed">Removed</option>
            <option value="active">Active (marketplace)</option>
          </select>
        </label>
      </div>

      {loading && <p className="empty-state">Loading listings...</p>}
      {error && <p className="form-status error-text">{error}</p>}

      {!loading && (
        <div className="profile-section-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Poster</th>
                <th>Date</th>
                <th>Status</th>
                <th>Category</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">No listings match your filters.</td>
                </tr>
              )}
              {listings.map((listing) => (
                <tr key={`${listing.listing_type}-${listing.id}`}>
                  <td>{listing.title}</td>
                  <td>{listing.listing_type}</td>
                  <td>{listing.posterName}</td>
                  <td>{new Date(listing.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`admin-status-badge ${listing.status === 'flagged' ? 'open' : 'active'}`}>
                      {listing.status}
                    </span>
                  </td>
                  <td>{listing.category}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-table-btn danger"
                      disabled={deletingId === listing.id}
                      onClick={() => handleDelete(listing)}
                    >
                      {deletingId === listing.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                      Remove
                    </button>
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

import { useEffect, useState } from 'react';
import { Loader2, ShoppingBag, Trash2 } from 'lucide-react';
import { adminDeleteListing, getAdminListings } from '../../lib/adminApi.js';
import AdminDetailModal from '../../components/AdminDetailModal.jsx';
import Skeleton from '../../components/Skeleton.jsx';

export default function AdminListings() {
  const [listings, setListings] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [selectedListing, setSelectedListing] = useState(null);

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

  const filteredListings = listings.filter(listing => {
    const query = searchQuery.toLowerCase();
    return (
      listing.title?.toLowerCase().includes(query) ||
      listing.posterName?.toLowerCase().includes(query) ||
      listing.category?.toLowerCase().includes(query)
    );
  });

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
          Search listings
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by title, poster, or category..."
          />
        </label>
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

      {loading && <Skeleton variant="list" />}
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
              {filteredListings.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">No listings match your filters.</td>
                </tr>
              )}
              {filteredListings.map((listing) => (
                <tr 
                  key={`${listing.listing_type}-${listing.id}`}
                  onClick={() => setSelectedListing(listing)}
                  style={{ cursor: 'pointer' }}
                >
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
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="admin-moderation-btn delete"
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

      <AdminDetailModal
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        title="Listing Details"
      >
        {selectedListing && (
          <>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Title</span>
              <span className="admin-detail-value">{selectedListing.title}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Type</span>
              <span className="admin-detail-value">{selectedListing.listing_type}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Poster</span>
              <span className="admin-detail-value">{selectedListing.posterName}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Category</span>
              <span className="admin-detail-value">{selectedListing.category}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Status</span>
              <span className="admin-detail-value">{selectedListing.status}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Created</span>
              <span className="admin-detail-value">{new Date(selectedListing.created_at).toLocaleString()}</span>
            </div>
            {selectedListing.description && (
              <div className="admin-detail-row">
                <span className="admin-detail-label">Description</span>
                <span className="admin-detail-value">{selectedListing.description}</span>
              </div>
            )}
            {selectedListing.price && (
              <div className="admin-detail-row">
                <span className="admin-detail-label">Price</span>
                <span className="admin-detail-value">{selectedListing.price}</span>
              </div>
            )}
          </>
        )}
      </AdminDetailModal>
    </div>
  );
}

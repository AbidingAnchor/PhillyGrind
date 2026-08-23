import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Shield, ChevronRight } from 'lucide-react';
import { listDisputes } from '../lib/marketplaceOrdersApi.js';
import Skeleton from '../components/Skeleton.jsx';

function formatCents(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDisputes() {
    try {
      setLoading(true);
      const { disputes: data } = await listDisputes('open');
      setDisputes(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDisputes();
  }, []);

  return (
    <div className="admin-page admin-disputes-page">
      <header className="admin-page-header">
        <Shield size={28} />
        <div>
          <h1>Dispute Dashboard</h1>
          <p>Open marketplace disputes requiring admin review — open a case to view evidence and resolve.</p>
        </div>
      </header>

      {loading && <Skeleton variant="list" />}
      {error && <p className="empty-state error-state">{error}</p>}

      {!loading && !error && disputes.length === 0 && (
        <p className="empty-state">No open disputes.</p>
      )}

      <div className="admin-dispute-list">
        {disputes.map((dispute) => (
          <Link
            key={dispute.id}
            to={`/admin/cases/dispute/${dispute.id}`}
            className="admin-dispute-card admin-report-link"
          >
            <div className="admin-dispute-card-top">
              <AlertTriangle size={18} />
              <strong>{dispute.item_name}</strong>
            </div>
            <div className="admin-dispute-card-meta">
              <span>Order: {dispute.order_id?.slice(0, 8)}...</span>
              <span>{formatCents(dispute.amount)} escrow</span>
            </div>
            <div className="admin-dispute-card-parties">
              <span>Buyer: {dispute.buyer_name}</span>
              <span>Seller: {dispute.seller_name}</span>
            </div>
            <div className="admin-dispute-card-date">
              Opened {new Date(dispute.created_at).toLocaleDateString()}
              {dispute.listing_id && (
                <>
                  {' · '}
                  <Link to={`/marketplace/${dispute.listing_id}`} onClick={(e) => e.stopPropagation()}>
                    View listing
                  </Link>
                </>
              )}
            </div>
            <span className="admin-report-open">
              Open case <ChevronRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

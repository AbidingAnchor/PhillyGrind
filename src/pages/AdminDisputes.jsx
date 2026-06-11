import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle, Loader2, Shield, XCircle } from 'lucide-react';
import {
  getDisputeDetail,
  listDisputes,
  resolveDispute,
} from '../lib/marketplaceOrdersApi.js';

function formatCents(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function TamperBadge({ score }) {
  if (score == null) return null;
  const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return <span className={`tamper-badge tamper-${level}`}>Tamper score: {score}/100</span>;
}

function EvidencePanel({ title, description, photoUrl, exif, tamperScore, aiSummary }) {
  return (
    <div className="admin-evidence-panel">
      <h3>{title}</h3>
      <p className="admin-evidence-desc">{description || 'No description provided.'}</p>
      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="admin-evidence-photo">
          <img src={photoUrl} alt={`${title} evidence`} />
        </a>
      )}
      <TamperBadge score={tamperScore} />
      {aiSummary && <p className="admin-ai-summary">{aiSummary}</p>}
      {exif && (
        <details className="admin-exif-details">
          <summary>EXIF Metadata</summary>
          <pre>{JSON.stringify(exif, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

function DisputeDetail({ disputeId, onBack, onResolved }) {
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const { dispute: data } = await getDisputeDetail(disputeId);
        if (!cancelled) setDispute(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [disputeId]);

  async function handleResolve(resolution) {
    setResolving(resolution);
    setError('');
    try {
      await resolveDispute(disputeId, resolution);
      onResolved();
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving('');
    }
  }

  if (loading) {
    return <p className="empty-state">Loading dispute...</p>;
  }

  if (!dispute) {
    return <p className="empty-state error-state">{error || 'Dispute not found.'}</p>;
  }

  const photos = dispute.signed_photo_urls || {};

  return (
    <div className="admin-dispute-detail">
      <button type="button" className="admin-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to list
      </button>

      <header className="admin-detail-header">
        <div>
          <span className="eyebrow">Dispute Review</span>
          <h1>{dispute.item_name}</h1>
          <p>
            Order {dispute.order_id?.slice(0, 8)}... · {formatCents(dispute.amount)} in escrow ·
            Opened {new Date(dispute.created_at).toLocaleString()}
          </p>
        </div>
        <span className="admin-status-badge open">Open</span>
      </header>

      <div className="admin-parties">
        <div><strong>Buyer:</strong> {dispute.buyer_name}</div>
        <div><strong>Seller:</strong> {dispute.seller_name}</div>
      </div>

      <div className="admin-evidence-grid">
        <EvidencePanel
          title="Buyer Evidence"
          description={dispute.buyer_description}
          photoUrl={photos.buyer_photo_url}
          exif={dispute.buyer_exif_data}
          tamperScore={dispute.buyer_tamper_score}
          aiSummary={dispute.buyer_ai_summary}
        />
        <EvidencePanel
          title="Seller Evidence"
          description={dispute.seller_description || (dispute.seller_photo_url ? '' : 'Not yet submitted')}
          photoUrl={photos.seller_photo_url}
          exif={dispute.seller_exif_data}
          tamperScore={dispute.seller_tamper_score}
          aiSummary={dispute.seller_ai_summary}
        />
      </div>

      {error && <p className="form-status error-text">{error}</p>}

      <div className="admin-resolve-actions">
        <button
          type="button"
          className="admin-resolve-btn release"
          disabled={Boolean(resolving)}
          onClick={() => handleResolve('released_to_seller')}
        >
          {resolving === 'released_to_seller' ? <Loader2 size={18} className="spin" /> : <CheckCircle size={18} />}
          Release to Seller
        </button>
        <button
          type="button"
          className="admin-resolve-btn refund"
          disabled={Boolean(resolving)}
          onClick={() => handleResolve('refunded_to_buyer')}
        >
          {resolving === 'refunded_to_buyer' ? <Loader2 size={18} className="spin" /> : <XCircle size={18} />}
          Refund to Buyer
        </button>
      </div>
    </div>
  );
}

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

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

  if (selectedId) {
    return (
      <section className="page-section admin-disputes-page">
        <DisputeDetail
          disputeId={selectedId}
          onBack={() => setSelectedId(null)}
          onResolved={() => {
            setSelectedId(null);
            loadDisputes();
          }}
        />
      </section>
    );
  }

  return (
    <section className="page-section admin-disputes-page">
      <header className="admin-page-header">
        <Shield size={28} />
        <div>
          <h1>Dispute Dashboard</h1>
          <p>Open marketplace disputes requiring admin review</p>
        </div>
      </header>

      {loading && <p className="empty-state">Loading disputes...</p>}
      {error && <p className="empty-state error-state">{error}</p>}

      {!loading && !error && disputes.length === 0 && (
        <p className="empty-state">No open disputes. 🎉</p>
      )}

      <div className="admin-dispute-list">
        {disputes.map((dispute) => (
          <button
            key={dispute.id}
            type="button"
            className="admin-dispute-card"
            onClick={() => setSelectedId(dispute.id)}
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
          </button>
        ))}
      </div>
    </section>
  );
}

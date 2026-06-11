import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Camera, Check, CreditCard, DollarSign, MapPin, MessageCircle, Package, Pencil, Shield, Tag, Trash2, User, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import ChatModal from '../components/ChatModal.jsx';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import HandoffPhotoModal from '../components/HandoffPhotoModal.jsx';
import DisputeFormModal from '../components/DisputeFormModal.jsx';
import { useAuth } from '../lib/auth.jsx';
import { createConnectAccount, parsePayToCents } from '../lib/ordersApi.js';
import {
  confirmMarketplaceReceipt,
  formatCountdown,
  getDispute,
  getHandoffDeadline,
} from '../lib/marketplaceOrdersApi.js';
import { marketplaceCategories } from '../data/listings.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeDisplayName(value, fallback = 'PhillyGrind user') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

const conditionOptions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

const paymentOptions = [
  ['both', 'Cash or Secure Checkout'],
  ['escrow', 'Secure Checkout Only'],
  ['cash', 'Cash Only'],
];

function MarketplaceEditModal({ listing, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: listing.title || '',
    description: listing.description || '',
    price: listing.price?.toString() || '',
    category: listing.category || '',
    condition: listing.condition || 'New',
    location: listing.location || '',
    payment_type: listing.payment_type || 'both',
  });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      const payload = {
        title: (form.title || '').trim(),
        description: (form.description || '').trim(),
        price: parseFloat(form.price) || 0,
        category: form.category,
        condition: form.condition || 'New',
        location: (form.location || '').trim(),
        payment_type: form.payment_type || 'both',
      };

      if (!payload.title || !payload.description || !payload.category || !payload.location) {
        throw new Error('Please fill out all required fields.');
      }

      const { data, error } = await supabase
        .from('marketplace_listings')
        .update(payload)
        .eq('id', listing.id)
        .eq('user_id', listing.user_id)
        .select('*, profiles(name, avatar_url)')
        .single();

      if (error) throw error;

      onSaved(data);
      onClose();
    } catch (err) {
      setStatus(err.message || 'Could not update listing.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="chat-backdrop" role="presentation">
      <section className="edit-modal" role="dialog" aria-modal="true" aria-label={`Edit ${listing.title}`}>
        <header className="chat-header">
          <div>
            <span className="eyebrow">Marketplace</span>
            <h2>Edit Listing</h2>
            <p>{listing.title}</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close edit form" disabled={submitting}>
            <X size={20} />
          </button>
        </header>

        <form className="listing-form edit-listing-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input name="title" value={form.title} onChange={updateField} required />
          </label>
          <label>
            Price
            <input name="price" value={form.price} onChange={updateField} required />
          </label>
          <label>
            Category
            <select name="category" value={form.category} onChange={updateField} required>
              <option value="">Choose a category</option>
              {marketplaceCategories.filter((category) => category !== 'All').map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Condition
            <select name="condition" value={form.condition} onChange={updateField} required>
              {conditionOptions.map((condition) => (
                <option key={condition} value={condition}>{condition}</option>
              ))}
            </select>
          </label>
          <label>
            Location
            <input name="location" value={form.location} onChange={updateField} required />
          </label>
          <label>
            Payment Method
            <select name="payment_type" value={form.payment_type} onChange={updateField} required>
              {paymentOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="full-span">
            Description
            <textarea name="description" value={form.description} onChange={updateField} rows={5} required />
          </label>
          {status && <p className="form-status error-text full-span">{status}</p>}
          <button className="primary-button full-span" type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </section>
    </div>
  );
}

function MarketplaceDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatReceiverId, setChatReceiverId] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [sellerEvidenceOpen, setSellerEvidenceOpen] = useState(false);
  const [dispute, setDispute] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [connectingStripe, setConnectingStripe] = useState(false);
  const { isLoggedIn, user, profile } = useAuth();
  const isOwner = isLoggedIn && listing?.user_id === user?.id;
  const profilePath = listing?.user_id ? `/profile/${listing.user_id}` : '';
  const posterName = listing?.profiles?.name || safeDisplayName(listing?.posterName);
  const canBuy = Boolean(isLoggedIn && listing?.user_id && listing.user_id !== user?.id && listing?.status === 'active');
  const hasActiveOrder = Boolean(order && !['refunded', 'cancelled', 'completed', 'released'].includes(order.status));
  const isBuyer = Boolean(order?.buyer_id === user?.id);
  const isSeller = Boolean(order?.seller_id === user?.id);
  const awaitingConfirmation = order?.status === 'delivered_pending_confirmation';
  const isDisputed = order?.status === 'disputed';
  const handoffDeadline = awaitingConfirmation ? getHandoffDeadline(order.handoff_at) : null;
  const supportsEscrow = listing?.payment_type === 'escrow' || listing?.payment_type === 'both';
  const supportsCash = listing?.payment_type === 'cash' || listing?.payment_type === 'both';
  const sellerPayoutsReady = Boolean(
    listing?.profiles?.stripe_account_id && listing?.profiles?.stripe_onboarding_complete,
  );
  const photos = listing?.photos || [];
  const hasPhotos = photos.length > 0;

  useEffect(() => {
    const shouldOpenChat = searchParams.get('openChat') === 'true';
    const senderId = searchParams.get('senderId');

    if (shouldOpenChat && senderId) {
      setChatReceiverId(senderId);
      setChatOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadListing() {
      try {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
          .from('marketplace_listings')
          .select('*, profiles(name, avatar_url, stripe_account_id, stripe_onboarding_complete)')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;

        if (!cancelled) {
          setListing(data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load listing.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadListing();
  }, [id]);

  useEffect(() => {
    if (!isLoggedIn || !listing) return;

    let cancelled = false;

    async function loadOrder() {
      try {
        setOrderLoading(true);

        const { data, error: fetchError } = await supabase
          .from('marketplace_orders')
          .select('*')
          .eq('listing_id', id)
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!cancelled) {
          setOrder(data);
        }
      } catch (err) {
        console.warn('Error loading order:', err);
      } finally {
        if (!cancelled) setOrderLoading(false);
      }
    }

    loadOrder();
  }, [isLoggedIn, listing, id, user?.id]);

  useEffect(() => {
    if (!order || order.status !== 'disputed') {
      setDispute(null);
      return;
    }

    let cancelled = false;

    async function loadDispute() {
      try {
        const { dispute: data } = await getDispute(order.id);
        if (!cancelled) setDispute(data);
      } catch {
        if (!cancelled) setDispute(null);
      }
    }

    loadDispute();
    return () => { cancelled = true; };
  }, [order?.id, order?.status]);

  useEffect(() => {
    if (!handoffDeadline) {
      setCountdown('');
      return;
    }

    function tick() {
      setCountdown(formatCountdown(handoffDeadline));
    }

    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [handoffDeadline?.getTime()]);

  async function handleDelete() {
    try {
      console.log('handleDelete called for listing id:', id);
      setDeleting(true);
      setActionStatus('');

      const { data: deleted, error: deleteError } = await supabase
        .from('marketplace_listings')
        .delete()
        .eq('id', id)
        .select('id');

      console.log('Delete response:', { deleted, deleteError });

      if (deleteError) throw deleteError;
      if (!deleted?.length) throw new Error('Listing was not deleted. Please try again.');

      setDeleteOpen(false);
      navigate('/marketplace');
    } catch (err) {
      console.error('Delete error:', err);
      setActionStatus(err.message || 'Could not delete listing.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmReceipt() {
    try {
      setActionStatus('');
      const { order: updated } = await confirmMarketplaceReceipt(order.id);
      setOrder(updated);
      setActionStatus('Order confirmed and payment released to seller!');
    } catch (err) {
      setActionStatus(err.message || 'Could not confirm receipt.');
    }
  }

  async function handleSecureCheckout() {
    console.log('handleSecureCheckout called, listing:', listing);
    if (!listing) {
      console.error('Listing is undefined');
      setActionStatus('Listing not found. Please refresh the page.');
      return;
    }

    if (!listing.id || !listing.user_id || !listing.price) {
      console.error('Listing missing required properties:', { id: listing.id, user_id: listing.user_id, price: listing.price });
      setActionStatus('Listing data is incomplete. Please refresh the page.');
      return;
    }

    try {
      setActionStatus('');

      // Check if seller has Stripe Connect account
      if (!sellerPayoutsReady) {
        setActionStatus('Seller has not set up secure checkout yet. Please use cash payment.');
        return;
      }

      // Create order
      const amountCents = parsePayToCents(listing.price.toString());
      const feeCents = Math.round(amountCents * 0.08);
      const totalCents = amountCents + feeCents;

      const { data: newOrder, error: orderError } = await supabase
        .from('marketplace_orders')
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.user_id,
          amount: amountCents,
          fee: feeCents,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      setOrder(newOrder);
      setPaymentOpen(true);
    } catch (err) {
      console.error('Secure checkout error:', err);
      setActionStatus(err.message || 'Could not initiate checkout.');
    }
  }

  function openCashChat() {
    setChatReceiverId(listing.user_id);
    setChatOpen(true);
  }

  async function handleConnectStripe() {
    setConnectingStripe(true);
    setActionStatus('');

    try {
      const { url } = await createConnectAccount();
      window.location.href = url;
    } catch (err) {
      setActionStatus(err.message || 'Could not start Stripe onboarding.');
      setConnectingStripe(false);
    }
  }

  if (loading) {
    return (
      <section className="page-section">
        <p className="empty-state">Loading listing...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-section">
        <p className="empty-state error-state">{error}</p>
        <Link to="/marketplace" className="primary-button">
          <ArrowLeft size={18} />
          Back to Marketplace
        </Link>
      </section>
    );
  }

  if (!listing) {
    return (
      <section className="page-section">
        <p className="empty-state">Listing not found.</p>
        <Link to="/marketplace" className="primary-button">
          <ArrowLeft size={18} />
          Back to Marketplace
        </Link>
      </section>
    );
  }

  return (
    <section className="mp-detail-page">
      <Link to="/marketplace" className="mp-detail-back">
        <ArrowLeft size={16} />
        Back to Marketplace
      </Link>

      <div className="mp-detail-card">
        <div className="mp-detail-photo-section">
          {hasPhotos ? (
            <>
              <div className="mp-detail-main-photo">
                <img src={photos[selectedPhotoIndex]} alt={`${listing.title} photo ${selectedPhotoIndex + 1}`} />
              </div>
              {photos.length > 1 && (
                <div className="mp-detail-photo-strip">
                  {photos.map((photo, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`mp-detail-thumb ${selectedPhotoIndex === index ? 'mp-detail-thumb-selected' : ''}`}
                      onClick={() => setSelectedPhotoIndex(index)}
                    >
                      <img src={photo} alt={`Photo ${index + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mp-detail-no-photos">
              <Camera size={48} />
              <p>No photos available</p>
            </div>
          )}
        </div>

        <div className="mp-detail-content">
          <div className="mp-detail-left">
            <h1 className="mp-detail-title">{listing.title}</h1>
            <p className="mp-detail-price">${listing.price}</p>
            
            <div className="mp-detail-badges">
              <span className={`mp-detail-condition-badge mp-detail-condition-${listing.condition?.toLowerCase().replace(' ', '-') || 'new'}`}>
                {listing.condition}
              </span>
              <span className="mp-detail-category-badge">
                <Tag size={14} />
                {listing.category}
              </span>
              <span className="mp-detail-location-badge">
                <MapPin size={14} />
                {listing.location}
              </span>
            </div>

            <hr className="mp-detail-divider" />

            <h2 className="mp-detail-section-title">About this listing</h2>
            <p className="mp-detail-description">{listing.description}</p>
          </div>

          <div className="mp-detail-right">
            <div className="mp-detail-sidebar-card">
              <div className="mp-detail-seller">
                <div className="mp-detail-avatar">
                  {listing.profiles?.avatar_url ? (
                    <img src={listing.profiles.avatar_url} alt={posterName} />
                  ) : (
                    <span>{posterName?.charAt(0)?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="mp-detail-seller-info">
                  <h3>{posterName}</h3>
                  {listing.created_at && (
                    <p className="mp-detail-member-since">
                      Member since {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>

              <hr className="mp-detail-card-divider" />

              <div className="mp-detail-payment">
                {supportsEscrow && (
                  <div className="mp-detail-payment-option">
                    <div className="mp-detail-payment-icon-escrow">
                      <Shield size={18} />
                    </div>
                    <div className="mp-detail-payment-text">
                      <strong>Secure Checkout Available</strong>
                      <small>Funds held in escrow until you confirm receipt</small>
                    </div>
                  </div>
                )}
                {supportsCash && (
                  <div className="mp-detail-payment-option">
                    <div className="mp-detail-payment-icon-cash">
                      <DollarSign size={18} />
                    </div>
                    <div className="mp-detail-payment-text">
                      <strong>Cash Meetup Available</strong>
                      <small>Meet in person to exchange</small>
                    </div>
                  </div>
                )}
              </div>

              <hr className="mp-detail-card-divider" />

              <div className="mp-detail-actions">
                {isOwner && supportsEscrow && !sellerPayoutsReady && (
                  <div className="mp-detail-stripe-setup">
                    <p>
                      {profile?.stripe_account_id
                        ? 'Finish Stripe Express onboarding so buyers can pay via Secure Checkout.'
                        : 'Connect Stripe Express to accept Secure Checkout payments on this listing.'}
                    </p>
                    <button className="mp-detail-buy-btn" type="button" onClick={handleConnectStripe} disabled={connectingStripe}>
                      <Shield size={18} />
                      {connectingStripe ? 'Opening Stripe...' : profile?.stripe_account_id ? 'Finish Stripe Setup' : 'Connect Stripe'}
                    </button>
                  </div>
                )}

                {supportsEscrow && canBuy && sellerPayoutsReady && (
                  <button className="mp-detail-buy-btn" type="button" onClick={handleSecureCheckout}>
                    🔒 Buy Securely
                  </button>
                )}
                {supportsEscrow && canBuy && !sellerPayoutsReady && (
                  <p className="mp-detail-order-status">Secure Checkout unavailable — seller must connect Stripe first.</p>
                )}
                {!isOwner && (
                  <button className="mp-detail-message-btn" type="button" onClick={openCashChat}>
                    💬 Message Seller
                  </button>
                )}

                {hasActiveOrder && isSeller && order.status === 'held' && (
                  <button className="mp-detail-buy-btn" type="button" onClick={() => setHandoffOpen(true)}>
                    <Package size={18} />
                    Mark as Handed Off
                  </button>
                )}

                {hasActiveOrder && isBuyer && awaitingConfirmation && (
                  <>
                    <button className="mp-detail-buy-btn" type="button" onClick={handleConfirmReceipt}>
                      <Check size={18} />
                      I Received This Item
                    </button>
                    <button className="mp-detail-dispute-btn" type="button" onClick={() => setDisputeOpen(true)}>
                      <AlertTriangle size={18} />
                      Open Dispute
                    </button>
                    {countdown && (
                      <p className="mp-detail-countdown">
                        ⏱ {countdown} to confirm or dispute before auto-release
                      </p>
                    )}
                  </>
                )}

                {hasActiveOrder && isSeller && isDisputed && dispute && !dispute.seller_photo_url && (
                  <button className="mp-detail-buy-btn" type="button" onClick={() => setSellerEvidenceOpen(true)}>
                    <Shield size={18} />
                    Submit Your Evidence
                  </button>
                )}

                {hasActiveOrder && isDisputed && (
                  <p className="mp-detail-order-status disputed">
                    <AlertTriangle size={14} />
                    Dispute open — admin review in progress
                    {isSeller && dispute && !dispute.seller_photo_url && dispute.seller_evidence_deadline && (
                      <> · Evidence due by {new Date(dispute.seller_evidence_deadline).toLocaleString()}</>
                    )}
                  </p>
                )}

                {hasActiveOrder && !awaitingConfirmation && !isDisputed && (
                  <p className="mp-detail-order-status">
                    Order status: <strong>{order.status}</strong>
                    {order.status === 'held' && isSeller && ' — Mark as handed off when you deliver the item.'}
                    {order.status === 'held' && isBuyer && ' — Waiting for seller to mark item as handed off.'}
                  </p>
                )}
              </div>

              <div className="mp-detail-safety-tip">
                💡 Always meet in a public place for cash transactions. PhillyGrind is not responsible for in-person exchanges.
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="mp-detail-owner-actions">
          <button className="mp-detail-edit-btn" type="button" onClick={() => setEditOpen(true)}>
            <Pencil size={16} />
            Edit
          </button>
          <button className="mp-detail-delete-btn" type="button" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      )}

      {actionStatus && <p className="mp-detail-status">{actionStatus}</p>}

      {chatOpen && (
        <ChatModal
          listing={{ id: listing.id, title: listing.title, user_id: listing.user_id, type: 'marketplace' }}
          receiverId={chatReceiverId}
          onClose={() => {
            setChatOpen(false);
            setChatReceiverId(null);
          }}
        />
      )}

      {paymentOpen && order && (
        <PaymentModal
          listing={listing}
          order={order}
          isMarketplace={true}
          initialAmount={Math.round(Number(listing.price) * 100)}
          onClose={() => setPaymentOpen(false)}
          onPaid={(updatedOrder) => {
            setOrder(updatedOrder);
            setPaymentOpen(false);
            setActionStatus('Payment successful! Funds are being held in escrow.');
          }}
        />
      )}

      {editOpen && (
        <MarketplaceEditModal
          listing={listing}
          onClose={() => setEditOpen(false)}
          onSaved={setListing}
        />
      )}

      {deleteOpen && (
        <DeleteConfirmModal
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      {handoffOpen && order && (
        <HandoffPhotoModal
          orderId={order.id}
          onClose={() => setHandoffOpen(false)}
          onComplete={(updated) => {
            setOrder(updated);
            setHandoffOpen(false);
            setActionStatus('Item marked as handed off. Buyer has 2 hours to confirm.');
          }}
        />
      )}

      {disputeOpen && order && (
        <DisputeFormModal
          orderId={order.id}
          mode="buyer"
          onClose={() => setDisputeOpen(false)}
          onComplete={() => {
            setDisputeOpen(false);
            setOrder({ ...order, status: 'disputed' });
            setActionStatus('Dispute opened. The seller has been notified.');
          }}
        />
      )}

      {sellerEvidenceOpen && order && (
        <DisputeFormModal
          orderId={order.id}
          mode="seller"
          onClose={() => setSellerEvidenceOpen(false)}
          onComplete={({ dispute: updatedDispute }) => {
            setSellerEvidenceOpen(false);
            setDispute(updatedDispute);
            setActionStatus('Evidence submitted. Admin will review both sides.');
          }}
        />
      )}

      <style>{`
        .mp-detail-page {
          background: #f4f5f7;
          min-height: 100vh;
          padding: 2rem 1rem;
        }

        .mp-detail-back {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: #22c55e;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 1.5rem;
          transition: color 0.2s ease;
        }

        .mp-detail-back:hover {
          color: #16a34a;
        }

        .mp-detail-card {
          max-width: 1100px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .mp-detail-photo-section {
          width: 100%;
          height: 450px;
          background: #374151;
          display: flex;
          flex-direction: column;
        }

        .mp-detail-main-photo {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .mp-detail-main-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mp-detail-photo-strip {
          display: flex;
          gap: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
          background: rgba(0, 0, 0, 0.5);
        }

        .mp-detail-thumb {
          flex-shrink: 0;
          width: 80px;
          height: 60px;
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
          background: none;
        }

        .mp-detail-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mp-detail-thumb-selected {
          border-color: #22c55e;
        }

        .mp-detail-no-photos {
          width: 100%;
          height: 450px;
          background: #f3f4f6;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          color: #9ca3af;
        }

        .mp-detail-content {
          display: grid;
          grid-template-columns: 65% 35%;
          gap: 24px;
          padding: 24px;
        }

        @media (max-width: 1024px) {
          .mp-detail-content {
            grid-template-columns: 1fr;
          }
        }

        .mp-detail-left {
          min-width: 0;
        }

        .mp-detail-title {
          font-size: 32px;
          font-weight: 700;
          color: #1a2332;
          margin: 0 0 8px 0;
          line-height: 1.2;
        }

        .mp-detail-price {
          font-size: 36px;
          font-weight: 800;
          color: #22c55e;
          margin: 0 0 16px 0;
        }

        .mp-detail-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 24px;
        }

        .mp-detail-condition-badge {
          font-size: 13px;
          font-weight: 600;
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          color: white;
        }

        .mp-detail-condition-new { background: #22c55e; }
        .mp-detail-condition-like-new { background: #14b8a6; }
        .mp-detail-condition-good { background: #3b82f6; }
        .mp-detail-condition-fair { background: #f59e0b; }
        .mp-detail-condition-poor { background: #ef4444; }

        .mp-detail-category-badge {
          font-size: 13px;
          font-weight: 600;
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          background: #1a2332;
          color: white;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .mp-detail-location-badge {
          font-size: 13px;
          font-weight: 600;
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          background: white;
          color: #6b7280;
          border: 1px solid #d1d5db;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .mp-detail-divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 24px 0;
        }

        .mp-detail-section-title {
          font-size: 18px;
          font-weight: 600;
          color: #1a2332;
          margin: 0 0 0.75rem 0;
        }

        .mp-detail-description {
          font-size: 15px;
          line-height: 1.7;
          color: #4b5563;
          margin: 0;
          white-space: pre-wrap;
        }

        .mp-detail-right {
          position: sticky;
          top: 2rem;
          align-self: start;
        }

        .mp-detail-sidebar-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .mp-detail-seller {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .mp-detail-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #22c55e;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          overflow: hidden;
        }

        .mp-detail-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mp-detail-seller-info h3 {
          font-size: 16px;
          font-weight: 700;
          color: #1a2332;
          margin: 0 0 0.25rem 0;
        }

        .mp-detail-member-since {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }

        .mp-detail-card-divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 16px 0;
        }

        .mp-detail-payment {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mp-detail-payment-option {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .mp-detail-payment-icon-escrow {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #dcfce7;
          color: #22c55e;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mp-detail-payment-icon-cash {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f3f4f6;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mp-detail-payment-text strong {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #1a2332;
          margin-bottom: 0.125rem;
        }

        .mp-detail-payment-text small {
          font-size: 12px;
          color: #6b7280;
        }

        .mp-detail-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mp-detail-buy-btn {
          width: 100%;
          background: #22c55e;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: background 0.2s ease;
        }

        .mp-detail-buy-btn:hover {
          background: #16a34a;
        }

        .mp-detail-message-btn {
          width: 100%;
          background: white;
          color: #1a2332;
          border: 2px solid #1a2332;
          border-radius: 10px;
          padding: 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .mp-detail-message-btn:hover {
          background: #f9fafb;
        }

        .mp-detail-dispute-btn {
          width: 100%;
          background: white;
          color: #dc2626;
          border: 2px solid #dc2626;
          border-radius: 10px;
          padding: 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .mp-detail-dispute-btn:hover {
          background: #fef2f2;
        }

        .mp-detail-countdown {
          font-size: 13px;
          color: #b45309;
          text-align: center;
          margin: 0;
          background: #fffbeb;
          padding: 8px;
          border-radius: 8px;
        }

        .mp-detail-order-status.disputed {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          color: #dc2626;
          background: #fef2f2;
          padding: 8px;
          border-radius: 8px;
        }

        .mp-detail-stripe-setup {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
        }

        .mp-detail-stripe-setup p {
          margin: 0;
          font-size: 13px;
          color: #166534;
          line-height: 1.5;
        }

        .mp-detail-order-status {
          font-size: 13px;
          color: #6b7280;
          text-align: center;
          margin: 0;
        }

        .mp-detail-safety-tip {
          background: #fefce8;
          border: 1px solid #fde047;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          color: #854d0e;
          margin-top: 16px;
          line-height: 1.5;
        }

        .mp-detail-owner-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          margin-top: 2rem;
        }

        .mp-detail-edit-btn,
        .mp-detail-delete-btn {
          padding: 0.5rem 1rem;
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          border: none;
        }

        .mp-detail-edit-btn {
          background: #f3f4f6;
          color: #4b5563;
        }

        .mp-detail-edit-btn:hover {
          background: #e5e7eb;
        }

        .mp-detail-delete-btn {
          background: #fef2f2;
          color: #dc2626;
        }

        .mp-detail-delete-btn:hover {
          background: #fee2e2;
        }

        .mp-detail-status {
          font-size: 14px;
          color: #dc2626;
          margin-top: 1rem;
          padding: 0.75rem;
          background: #fef2f2;
          border-radius: 8px;
          text-align: center;
        }
      `}</style>
    </section>
  );
}

export default MarketplaceDetail;

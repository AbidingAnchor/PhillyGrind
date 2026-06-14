import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Gavel, MapPin, MessageCircle, Pencil, Tags, Trash2, Zap } from 'lucide-react';
import { deleteListing, getListing, setListingBoostPending } from '../lib/listingsApi.js';
import ChatModal from '../components/ChatModal.jsx';
import EditListingModal from '../components/EditListingModal.jsx';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import BidModal from '../components/BidModal.jsx';
import QuickApplyModal from '../components/QuickApplyModal.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import StarRating from '../components/StarRating.jsx';
import { useAuth } from '../lib/auth.jsx';
import {
  createConnectAccount,
  getOrderPhotoUrls,
  getOrdersForListing,
  markOrderComplete,
  parsePayToCents,
  releasePayment,
  uploadOrderPhoto,
} from '../lib/ordersApi.js';
import { createBoostCheckout } from '../lib/boostsApi.js';
import { getProfileRating } from '../lib/reviewsApi.js';
import { getBidsForListing, updateBidStatus } from '../lib/bidsApi.js';
import { getApplicationsForJob, getApplicationResumeUrl } from '../lib/applicationsApi.js';
import { gigCategories, jobCategories } from '../data/listings.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeDisplayName(value, fallback = 'PhillyGrind user') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

function ListingDetail({ type }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatReceiverId, setChatReceiverId] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [bidOpen, setBidOpen] = useState(false);
  const [quickApplyOpen, setQuickApplyOpen] = useState(false);
  const [acceptedBidForPayment, setAcceptedBidForPayment] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [bids, setBids] = useState([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [boostResolving, setBoostResolving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState('');
  const [orderPhotoUrls, setOrderPhotoUrls] = useState({ before: '', after: '' });
  const [actionStatus, setActionStatus] = useState('');
  const { isLoggedIn, user } = useAuth();
  const plural = type === 'gig' ? 'gigs' : 'jobs';
  const isOwner = isLoggedIn && listing?.user_id === user?.id;
  const categories = type === 'gig' ? gigCategories : jobCategories;
  const profilePath = listing?.user_id ? `/profile/${listing.user_id}` : '';
  const posterName = safeDisplayName(listing?.posterName || listing?.company);
  const currentOrder = orders.find((order) => (
    order.hirer_id === user?.id || order.worker_id === user?.id
  ));
  const isHirer = Boolean(currentOrder?.hirer_id === user?.id);
  const isWorker = Boolean(currentOrder?.worker_id === user?.id);
  const hasActiveOrder = Boolean(currentOrder && !['refunded'].includes(currentOrder.status));
  const listingHasBlockingOrder = orders.some((order) => order.status !== 'cancelled');
  const deleteBlockedByOrder = Boolean(isOwner && listingHasBlockingOrder);
  const isOfferingGig = type === 'gig' && listing?.post_type === 'offering';
  const isSeekingGig = type === 'gig' && listing?.post_type === 'seeking';
  const hasApplyUrl = Boolean(type === 'job' && listing?.apply_url);
  const restrictedGigStatus = type === 'gig' && listing?.status && listing.status !== 'open';
  const hasAcceptedBid = bids.some((bid) => bid.worker_id === user?.id && bid.status === 'accepted');
  const isAcceptedGigWorker = Boolean(type === 'gig' && hasAcceptedBid && listing?.user_id !== user?.id);
  const canViewRestrictedGig = Boolean(isOwner || hasAcceptedBid || currentOrder);
  const checkingRestrictedGigAccess = Boolean(restrictedGigStatus && isLoggedIn && (bidsLoading || ordersLoading));
  const activeBidCount = isSeekingGig ? (listing?.bidCount ?? bids.filter((bid) => bid.status !== 'rejected').length) : 0;
  const canSubmitBid = Boolean(isLoggedIn && isSeekingGig && listing?.user_id && listing.user_id !== user?.id && !hasActiveOrder && listing.status === 'open');
  const canQuickApply = Boolean(isLoggedIn && type === 'job' && listing?.user_id && listing.user_id !== user?.id);
  const canMessagePoster = Boolean(isLoggedIn && listing?.user_id && listing.user_id !== user?.id && !hasApplyUrl && (type !== 'gig' || isSeekingGig || isAcceptedGigWorker));
  const boostCancelled = searchParams.get('boost') === 'cancelled';
  const cancelledBoostTier = ['basic', 'pro'].includes(searchParams.get('tier')) ? searchParams.get('tier') : null;
  const showBoostCancelledPanel = Boolean(isOwner && listing?.boost_pending && boostCancelled);
  const orderNeedsAfterPhoto = Boolean(isWorker && currentOrder && ['pending', 'escrowed'].includes(currentOrder.status) && !currentOrder.after_photo_url);

  useEffect(() => {
    const shouldOpenChat = searchParams.get('openChat') === 'true';
    const senderId = searchParams.get('senderId');

    console.log('ListingDetail mounted with chat query params', {
      url: window.location.href,
      queryString: window.location.search,
      params: Object.fromEntries(searchParams.entries()),
      openChatParam: searchParams.get('openChat'),
      senderId,
      shouldOpenChat,
    });
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError('');
    getListing(type, id)
      .then((loadedListing) => {
        console.log('Loaded listing detail from Supabase', {
          listing: loadedListing,
          hasUserId: Boolean(loadedListing?.user_id),
          userId: loadedListing?.user_id,
          profilePath: loadedListing?.user_id ? `/profile/${loadedListing.user_id}` : null,
        });
        setListing(loadedListing);
      })
      .catch((err) => setError(err.message || 'Could not load this listing from Supabase.'))
      .finally(() => setLoading(false));
  }, [id, type]);

  useEffect(() => {
    if (!isLoggedIn || !id) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    getOrdersForListing(id)
      .then(setOrders)
      .catch((err) => console.warn(err))
      .finally(() => setOrdersLoading(false));
  }, [id, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || type !== 'gig' || !id) {
      setBids([]);
      setBidsLoading(false);
      return;
    }

    setBidsLoading(true);
    getBidsForListing(id)
      .then(setBids)
      .catch((err) => console.warn(err))
      .finally(() => setBidsLoading(false));
  }, [id, isLoggedIn, type]);

  useEffect(() => {
    if (!isLoggedIn || type !== 'job' || !id || !isOwner) {
      setApplications([]);
      setApplicationsLoading(false);
      return;
    }

    setApplicationsLoading(true);
    getApplicationsForJob(id)
      .then(setApplications)
      .catch((err) => console.warn(err))
      .finally(() => setApplicationsLoading(false));
  }, [id, isLoggedIn, isOwner, type]);

  useEffect(() => {
    const shouldOpenChat = searchParams.get('openChat') === 'true';
    const senderId = searchParams.get('senderId');
    const listingLoaded = Boolean(listing?.user_id);
    const isSelfSender = Boolean(senderId && senderId === user?.id);
    const canOpenChat = Boolean(shouldOpenChat && senderId && isLoggedIn && listingLoaded && !isSelfSender);

    console.log('ListingDetail chat auto-open check', {
      url: window.location.href,
      shouldOpenChat,
      senderId,
      isLoggedIn,
      currentUserId: user?.id,
      listingLoaded,
      listingId: listing?.id,
      listingUserId: listing?.user_id,
      loading,
      isSelfSender,
      canOpenChat,
    });

    if (!canOpenChat) {
      return;
    }

    console.log('Opening ChatModal from notification query params', {
      listingId: listing.id,
      receiverId: senderId,
    });
    setChatReceiverId(senderId);
    setChatOpen(true);
  }, [isLoggedIn, listing, loading, searchParams, user]);

  useEffect(() => {
    console.log('Hire & Pay visibility check', {
      isLoggedIn,
      currentUserId: user?.id,
      listingUserId: listing?.user_id,
      isOwner,
      orders,
      currentOrder,
      hasActiveOrder,
      canSubmitBid,
      paymentModalImported: Boolean(PaymentModal),
    });
  }, [canSubmitBid, currentOrder, hasActiveOrder, isLoggedIn, isOwner, listing, orders, user]);

  useEffect(() => {
    if (!currentOrder?.id || (!currentOrder.before_photo_url && !currentOrder.after_photo_url)) {
      setOrderPhotoUrls({ before: '', after: '' });
      return;
    }

    let cancelled = false;
    getOrderPhotoUrls(currentOrder)
      .then((urls) => {
        if (!cancelled) setOrderPhotoUrls(urls);
      })
      .catch((err) => {
        console.warn(err);
        if (!cancelled) setOrderPhotoUrls({ before: '', after: '' });
      });

    return () => {
      cancelled = true;
    };
  }, [currentOrder?.id, currentOrder?.before_photo_url, currentOrder?.after_photo_url]);

  async function refreshPosterRating() {
    if (!listing?.user_id) return;

    const posterRating = await getProfileRating(listing.user_id);
    setListing((current) => current ? { ...current, posterRating } : current);
  }

  if (loading) {
    return <section className="page-section"><p className="empty-state">Loading listing...</p></section>;
  }

  if (!listing) {
    return (
      <section className="page-section">
        <p className={error ? 'empty-state error-state' : 'empty-state'}>
          {error || 'That listing could not be found.'}
        </p>
        <Link className="text-link" to={`/${plural}`}><ArrowLeft size={16} /> Back to {plural}</Link>
      </section>
    );
  }

  if (checkingRestrictedGigAccess) {
    return <section className="page-section"><p className="empty-state">Checking gig access...</p></section>;
  }

  if (listing.boost_pending && !isOwner) {
    return (
      <section className="page-section">
        <p className="empty-state">This listing is not available yet.</p>
        <Link className="text-link" to={`/${plural}`}><ArrowLeft size={16} /> Back to {plural}</Link>
      </section>
    );
  }

  if (restrictedGigStatus && !canViewRestrictedGig) {
    return (
      <section className="page-section">
        <p className="empty-state">This gig is no longer available.</p>
        <Link className="text-link" to="/gigs"><ArrowLeft size={16} /> Back to gigs</Link>
      </section>
    );
  }

  async function handleDelete() {
    setDeleting(true);
    setActionStatus('');

    try {
      await deleteListing(type, listing.id);
      window.location.replace(`/${plural}`);
    } catch (error) {
      setActionStatus(error.message || `Could not delete this ${type}.`);
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleConnectStripe() {
    setActionStatus('');

    try {
      const { url } = await createConnectAccount();
      window.location.href = url;
    } catch (error) {
      setActionStatus(error.message || 'Could not start Stripe onboarding.');
    }
  }

  async function handleMarkComplete() {
    if (!currentOrder) return;
    if (!currentOrder.after_photo_url) {
      setActionStatus('Upload an after photo before marking this work complete.');
      return;
    }

    setActionStatus('');

    try {
      const nextOrder = await markOrderComplete(currentOrder.id);
      setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));
      setActionStatus('Marked complete. The hirer has been notified to release payment.');
    } catch (error) {
      setActionStatus(error.message || 'Could not mark this order complete.');
    }
  }

  async function handleReleasePayment() {
    if (!currentOrder) return;
    setActionStatus('');

    try {
      const nextOrder = await releasePayment(currentOrder.id);
      setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));
      setActionStatus('Payment released.');
    } catch (error) {
      setActionStatus(error.message || 'Could not release payment.');
    }
  }

  async function handleOrderPhotoUpload(kind, file) {
    if (!currentOrder || !file) return;

    setUploadingPhoto(kind);
    setActionStatus('');

    try {
      const nextOrder = await uploadOrderPhoto(currentOrder.id, kind, file);
      setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));
      setActionStatus(`${kind === 'before' ? 'Before' : 'After'} photo uploaded.`);
    } catch (error) {
      setActionStatus(error.message || 'Could not upload this photo.');
    } finally {
      setUploadingPhoto('');
    }
  }

  async function handleBoostNow() {
    setBoostResolving(true);
    setActionStatus('');

    try {
      const { url } = await createBoostCheckout({
        listingId: listing.id,
        listingType: type,
        tier: cancelledBoostTier || listing.pendingBoostTier || 'basic',
      });
      window.location.href = url;
    } catch (error) {
      setActionStatus(error.message || 'Could not restart boost checkout.');
      setBoostResolving(false);
    }
  }

  async function handleKeepFree() {
    setBoostResolving(true);
    setActionStatus('');

    try {
      const updatedListing = await setListingBoostPending(type, listing.id, false);
      setListing((current) => current ? {
        ...current,
        ...updatedListing,
        posterName: current.posterName,
        posterRating: current.posterRating,
        workerStripeAccountId: current.workerStripeAccountId,
        workerStripeOnboardingComplete: current.workerStripeOnboardingComplete,
        workerStripeReady: current.workerStripeReady,
      } : current);
      window.history.replaceState({}, '', `/${plural}/${listing.id}`);
      setActionStatus('Your listing is now live as a free listing.');
    } catch (error) {
      setActionStatus(error.message || 'Could not publish this listing as free.');
    } finally {
      setBoostResolving(false);
    }
  }

  async function handleViewApplicationResume(applicationId) {
    setActionStatus('');

    try {
      const signedUrl = await getApplicationResumeUrl(applicationId);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setActionStatus(error.message || 'Could not open resume.');
    }
  }

  async function handleBidStatus(bid, status) {
    setActionStatus('');

    try {
      const result = await updateBidStatus({ bidId: bid.id, status });
      const nextBids = result.bids.map((nextBid) => ({
        ...nextBid,
        workerName: bids.find((currentBid) => currentBid.id === nextBid.id)?.workerName || bid.workerName,
        workerRating: bids.find((currentBid) => currentBid.id === nextBid.id)?.workerRating || bid.workerRating,
        workerStripeAccountId: bids.find((currentBid) => currentBid.id === nextBid.id)?.workerStripeAccountId || bid.workerStripeAccountId || '',
        workerStripeOnboardingComplete: Boolean(bids.find((currentBid) => currentBid.id === nextBid.id)?.workerStripeOnboardingComplete || bid.workerStripeOnboardingComplete),
        workerStripeReady: Boolean(bids.find((currentBid) => currentBid.id === nextBid.id)?.workerStripeReady || bid.workerStripeReady),
      }));
      setBids(nextBids);
      setListing((current) => current ? {
        ...current,
        bidCount: nextBids.filter((nextBid) => nextBid.status !== 'rejected').length,
      } : current);

      if (status === 'accepted') {
        const acceptedBid = nextBids.find((nextBid) => nextBid.id === bid.id) || { ...bid, status: 'accepted' };
        setListing((current) => current ? { ...current, status: 'in progress' } : current);
        setAcceptedBidForPayment(acceptedBid);
        setPaymentOpen(true);
        setActionStatus('Bid accepted. Fund escrow to start the gig.');
      }
    } catch (error) {
      setActionStatus(error.message || 'Could not update bid.');
    }
  }

  return (
    <section className="detail-page">
      <Link className="text-link" to={`/${plural}`}><ArrowLeft size={16} /> Back to {plural}</Link>
      <article className="detail-card">
        <div className="listing-badge-row">
          <span className="pill">{listing.category}</span>
          {type === 'gig' && (
            <span className={`post-type-badge ${listing.post_type}`}>
              {listing.post_type === 'offering' ? 'Service offered' : 'Help wanted'}
            </span>
          )}
        </div>
        <h1>{listing.title}</h1>
        <p className="detail-company">
          {profilePath ? (
            <Link
              className="poster-name-link"
              to={profilePath}
              onClick={() => console.log('Opening poster profile from detail', { userId: listing.user_id, profilePath })}
            >
              {posterName}
            </Link>
          ) : posterName}
          <StarRating rating={listing.posterRating?.average} count={listing.posterRating?.count} compact />
        </p>
        {type === 'gig' && isSeekingGig && (
          <div className="detail-bid-count">
            <Gavel size={18} />
            {activeBidCount === 1 ? '1 person has bid on this gig' : `${activeBidCount} people have bid on this gig`}
          </div>
        )}
        <div className="detail-meta">
          <span><MapPin size={18} /> {listing.neighborhood}</span>
          <span><Tags size={18} /> {listing.pay}</span>
        </div>
        <div className="detail-body">
          <h2>About this {type}</h2>
          <p>{listing.description}</p>
        </div>
        <div className="detail-actions">
          {canQuickApply && (
            <button className="primary-button" type="button" onClick={() => setQuickApplyOpen(true)}>
              <Zap size={18} />
              Quick Apply
            </button>
          )}
          {hasApplyUrl && (
            <a className={canQuickApply ? 'secondary-detail-button' : 'primary-button'} href={listing.apply_url} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              Apply Externally
            </a>
          )}
          {isOfferingGig && isLoggedIn && listing.user_id !== user?.id && !hasActiveOrder && (
            <button className="primary-button" type="button" onClick={() => {
              setChatReceiverId(null);
              setChatOpen(true);
            }}>
              <MessageCircle size={18} />
              Contact / Hire
            </button>
          )}
          {canMessagePoster && (type !== 'gig' || isAcceptedGigWorker) && (
            <button className="primary-button" type="button" onClick={() => {
              setChatReceiverId(null);
              setChatOpen(true);
            }}>
              <MessageCircle size={18} />
              {isAcceptedGigWorker ? 'Message Hirer' : 'Message Poster'}
            </button>
          )}
          {canSubmitBid && (
            <button className="primary-button" type="button" onClick={() => setBidOpen(true)}>
              Place a Bid
            </button>
          )}
          {isLoggedIn && listing.user_id === user?.id && (
            <p className="detail-note">You posted this listing.</p>
          )}
          {!isLoggedIn && !hasApplyUrl && (
            <Link className="primary-button" to="/login" state={{ from: `/${plural}/${listing.id}` }}>
              <MessageCircle size={18} />
              {isOfferingGig ? 'Login to Contact / Hire' : type === 'gig' ? 'Login to Place a Bid' : type === 'job' ? 'Login to Quick Apply' : 'Login to Message Poster'}
            </Link>
          )}
          {!isLoggedIn && hasApplyUrl && type === 'job' && (
            <Link className="secondary-detail-button" to="/login" state={{ from: `/${plural}/${listing.id}` }}>
              Login to Quick Apply
            </Link>
          )}
          {isLoggedIn && !listing.user_id && (
            <p className="detail-note">Messaging is available for listings posted after messaging was enabled.</p>
          )}
        </div>
        {showBoostCancelledPanel && (
          <div className="payment-panel boost-cancel-panel">
            <div>
              <strong>Your boost wasn't completed.</strong>
              <p className="detail-note">
                Your listing has been saved as a free listing — would you like to boost it?
              </p>
            </div>
            <button className="primary-button" type="button" onClick={handleBoostNow} disabled={boostResolving}>
              {boostResolving ? 'Opening...' : 'Boost Now'}
            </button>
            <button className="secondary-detail-button" type="button" onClick={handleKeepFree} disabled={boostResolving}>
              Keep Free
            </button>
          </div>
        )}
        {isLoggedIn && isOfferingGig && listing.user_id === user?.id && !listing.workerStripeReady && (
          <div className="payment-panel">
            <p className="detail-note">
              {listing.workerStripeAccountId
                ? 'Finish Stripe Express onboarding so hirers can order this gig and pay into escrow.'
                : 'Set up Stripe Express payouts so hirers can order this gig and pay into escrow.'}
            </p>
            <button className="primary-button" type="button" onClick={handleConnectStripe}>
              {listing.workerStripeAccountId ? 'Finish payout setup' : 'Set up payouts'}
            </button>
          </div>
        )}
        {currentOrder && (
          <div className={isAcceptedGigWorker ? 'payment-panel active-worker-panel' : 'payment-panel'}>
            <strong>{isAcceptedGigWorker ? 'Active gig' : 'Payment status'}: {currentOrder.status}</strong>
            {isAcceptedGigWorker && (
              <p className="detail-note">Agreed price: {listing.pay}. Mark complete when the work is finished to notify the hirer and start the 72-hour release window.</p>
            )}
            {(isWorker || isHirer) && (
              <div className="order-photo-panel">
                <p className="detail-note">📸 Photos protect you in case of a dispute. We recommend taking both.</p>
                {isWorker && (
                  <div className="order-photo-grid">
                    <label className="order-photo-upload">
                      <span>Before starting</span>
                      <strong>Take a photo before you begin</strong>
                      {orderPhotoUrls.before && <img src={orderPhotoUrls.before} alt="Before work evidence" />}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        onChange={(event) => handleOrderPhotoUpload('before', event.target.files?.[0])}
                        disabled={Boolean(uploadingPhoto)}
                      />
                      <span className="secondary-detail-button">
                        {uploadingPhoto === 'before' ? 'Uploading...' : currentOrder.before_photo_url ? 'Replace Photo' : 'Upload Photo'}
                      </span>
                    </label>
                    <label className="order-photo-upload">
                      <span>After completing</span>
                      <strong>Take a photo when finished</strong>
                      {orderPhotoUrls.after && <img src={orderPhotoUrls.after} alt="After work evidence" />}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        onChange={(event) => handleOrderPhotoUpload('after', event.target.files?.[0])}
                        disabled={Boolean(uploadingPhoto)}
                      />
                      <span className="secondary-detail-button">
                        {uploadingPhoto === 'after' ? 'Uploading...' : currentOrder.after_photo_url ? 'Replace Photo' : 'Upload Photo'}
                      </span>
                    </label>
                  </div>
                )}
                {isHirer && (
                  <div className="order-photo-grid">
                    <div className="order-photo-view">
                      <span>Before photo</span>
                      {orderPhotoUrls.before
                        ? <img src={orderPhotoUrls.before} alt="Before work evidence" />
                        : <p>No before photo uploaded yet.</p>}
                    </div>
                    <div className="order-photo-view">
                      <span>After photo</span>
                      {orderPhotoUrls.after
                        ? <img src={orderPhotoUrls.after} alt="After work evidence" />
                        : <p>No after photo uploaded yet.</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
            {isWorker && ['pending', 'escrowed'].includes(currentOrder.status) && (
              <button className="primary-button" type="button" onClick={handleMarkComplete} disabled={orderNeedsAfterPhoto}>
                {orderNeedsAfterPhoto ? 'Upload After Photo First' : 'Mark as Complete'}
              </button>
            )}
            {isHirer && currentOrder.status === 'completed' && !currentOrder.released_at && (
              <button className="primary-button" type="button" onClick={handleReleasePayment}>
                Confirm & Release Payment
              </button>
            )}
          </div>
        )}
        {isOwner && type === 'job' && (
          <section className="bids-panel applicants-panel">
            <div className="profile-section-heading">
              <span className="eyebrow">Applications</span>
              <h2>Applicants</h2>
            </div>
            {applicationsLoading && <p className="empty-state">Loading applications...</p>}
            {!applicationsLoading && applications.length === 0 && <p className="empty-state">No applications yet.</p>}
            {!applicationsLoading && applications.length > 0 && (
              <div className="applicants-list">
                {applications.map((application) => (
                  <article className="bid-card applicant-card" key={application.id}>
                    <div className="bid-card-header">
                      <div>
                        <Link className="poster-name-link" to={`/profile/${application.applicant_id}`}>
                          {application.applicantName}
                        </Link>
                        <span>{new Date(application.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className={`bid-status ${application.status}`}>{application.status}</span>
                    </div>
                    {application.cover_note && <p>{application.cover_note}</p>}
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => handleViewApplicationResume(application.id)}
                    >
                      View resume
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {isOwner && type === 'gig' && isSeekingGig && (
          <section className="bids-panel">
            <div className="profile-section-heading">
              <span className="eyebrow">Worker bids</span>
              <h2>Bids on this gig</h2>
            </div>
            {bidsLoading && <p className="empty-state">Loading bids...</p>}
            {!bidsLoading && bids.length === 0 && <p className="empty-state">No bids yet.</p>}
            {!bidsLoading && bids.length > 0 && (
              <div className="bids-list">
                {bids.map((bid) => (
                  <article className="bid-card" key={bid.id}>
                    <div className="bid-card-header">
                      <div>
                        <Link className="poster-name-link" to={`/profile/${bid.worker_id}`}>
                          {bid.workerName}
                        </Link>
                        <StarRating rating={bid.workerRating?.average} count={bid.workerRating?.count} compact />
                      </div>
                      <span className={`bid-status ${bid.status}`}>{bid.status}</span>
                    </div>
                    <p>{bid.pitch}</p>
                    {bid.status === 'pending' && (
                      <div className="bid-actions">
                        <button className="primary-button" type="button" onClick={() => handleBidStatus(bid, 'accepted')}>
                          Accept
                        </button>
                        <button className="secondary-detail-button" type="button" onClick={() => handleBidStatus(bid, 'rejected')}>
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {isOwner && (
          <div className="owner-actions">
            <button className="secondary-detail-button" type="button" onClick={() => setEditOpen(true)}>
              <Pencil size={18} />
              Edit
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting || ordersLoading || deleteBlockedByOrder}
              title={deleteBlockedByOrder ? 'This listing cannot be deleted because it has an active or completed order.' : undefined}
            >
              <Trash2 size={18} />
              {ordersLoading ? 'Checking orders...' : 'Delete'}
            </button>
          </div>
        )}
        {deleteBlockedByOrder && (
          <p className="form-status error-text">
            This listing cannot be deleted because it has an active or completed order.
          </p>
        )}
        {actionStatus && <p className="form-status error-text">{actionStatus}</p>}
      </article>
      <ReviewForm listing={listing} onReviewed={refreshPosterRating} />
      {chatOpen && (
        <ChatModal
          listing={listing}
          receiverId={chatReceiverId || undefined}
          onClose={() => setChatOpen(false)}
        />
      )}
      {paymentOpen && (
        <PaymentModal
          listing={listing}
          initialAmount={parsePayToCents(listing.pay)}
          acceptedBid={acceptedBidForPayment}
          onClose={() => {
            setPaymentOpen(false);
            setAcceptedBidForPayment(null);
          }}
          onPaid={(order) => setOrders((current) => [order, ...current])}
        />
      )}
      {bidOpen && isSeekingGig && (
        <BidModal
          listing={listing}
          onClose={() => setBidOpen(false)}
          onBidSubmitted={(bid) => {
            setBids((current) => [{ ...bid, workerName: 'You' }, ...current.filter((item) => item.id !== bid.id)]);
            setListing((current) => current ? { ...current, bidCount: (current.bidCount || 0) + 1 } : current);
          }}
        />
      )}
      {quickApplyOpen && type === 'job' && (
        <QuickApplyModal
          job={listing}
          onClose={() => setQuickApplyOpen(false)}
          onApplicationSubmitted={(application) => {
            setApplications((current) => [{ ...application, applicantName: 'You' }, ...current.filter((item) => item.id !== application.id)]);
          }}
        />
      )}
      {editOpen && (
        <EditListingModal
          categories={categories}
          listing={listing}
          type={type}
          onClose={() => setEditOpen(false)}
          onSaved={setListing}
        />
      )}
      {deleteOpen && (
        <DeleteConfirmModal
          deleting={deleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  );
}

export default ListingDetail;

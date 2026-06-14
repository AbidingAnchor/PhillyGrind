import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bath,
  BedDouble,
  Calendar,
  Camera,
  MapPin,
  MessageCircle,
  PawPrint,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import ChatModal from '../components/ChatModal.jsx';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import { useAuth } from '../lib/auth.jsx';
import {
  deleteHousingListing,
  getHousingImagePublicUrl,
  getHousingListing,
  getLandlordReportCount,
  submitLandlordReport,
} from '../lib/housingApi.js';

const REPORT_REASONS = [
  'Scam listing',
  'Wrong info',
  'Already rented',
  'Harassment',
];

function LandlordBadge({ verified, warning, large = false }) {
  if (verified) {
    return <span className={`housing-badge verified${large ? ' large' : ''}`}>✅ Verified</span>;
  }
  if (warning) {
    return <span className={`housing-badge warning${large ? ' large' : ''}`}>⚠️ Warning</span>;
  }
  return null;
}

function formatAvailableDate(value) {
  if (!value) return 'Available now';
  return new Date(value).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMemberSince(value) {
  if (!value) return 'Recently joined';
  return new Date(value).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function HousingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportCount, setReportCount] = useState(0);

  const isOwner = isLoggedIn && listing?.user_id === user?.id;
  const images = listing?.images?.length
    ? listing.images.map(getHousingImagePublicUrl)
    : [];
  const canContact = Boolean(isLoggedIn && listing?.user_id && !isOwner);

  useEffect(() => {
    setLoading(true);
    setError('');

    getHousingListing(id)
      .then((loadedListing) => {
        if (!loadedListing) {
          setListing(null);
          return;
        }
        setListing(loadedListing);
        return getLandlordReportCount(loadedListing.id);
      })
      .then((count) => {
        if (typeof count === 'number') setReportCount(count);
      })
      .catch((err) => setError(err.message || 'Could not load this rental.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteStatus('');

    try {
      await deleteHousingListing(listing.id);
      setDeleteOpen(false);
      navigate('/housing');
    } catch (err) {
      setDeleteStatus(err.message || 'Could not delete this listing.');
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleReportSubmit(event) {
    event.preventDefault();
    setReportSubmitting(true);
    setReportStatus('');

    try {
      await submitLandlordReport({
        listingId: listing.id,
        reason: reportReason,
        details: reportDetails,
      });
      setReportCount((current) => current + 1);
      setReportStatus('Report submitted. Thank you for helping keep PhillyGrind safe.');
      setTimeout(() => {
        setReportOpen(false);
        setReportDetails('');
        setReportStatus('');
      }, 1200);
    } catch (err) {
      setReportStatus(err.message || 'Could not submit report.');
    } finally {
      setReportSubmitting(false);
    }
  }

  if (loading) {
    return <section className="page-section"><p className="empty-state">Loading rental...</p></section>;
  }

  if (!listing) {
    return (
      <section className="page-section">
        <p className={error ? 'empty-state error-state' : 'empty-state'}>
          {error || 'That rental could not be found.'}
        </p>
        <Link className="text-link" to="/housing"><ArrowLeft size={16} /> Back to housing</Link>
      </section>
    );
  }

  return (
    <section className="detail-page housing-detail-page">
      <Link className="text-link" to="/housing"><ArrowLeft size={16} /> Back to housing</Link>

      {reportCount >= 3 && (
        <div className="housing-flag-banner">
          <AlertTriangle size={18} />
          <span>⚠️ This listing has been flagged by multiple users. Proceed with caution.</span>
        </div>
      )}

      <article className="detail-card housing-detail-card">
        <div className="housing-detail-gallery">
          <div className="housing-detail-main-photo">
            {images.length ? (
              <img src={images[activeImage]} alt={listing.title} />
            ) : (
              <div className="housing-card-photo-placeholder">
                <Camera size={40} />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="housing-detail-thumbs">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  className={activeImage === index ? 'housing-thumb active' : 'housing-thumb'}
                  onClick={() => setActiveImage(index)}
                >
                  <img src={image} alt={`${listing.title} photo ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="housing-detail-header">
          <span className="pill">{listing.neighborhood}</span>
          <h1>{listing.title}</h1>
          <p className="housing-detail-price">${Number(listing.monthly_rent).toLocaleString()}/month</p>
        </div>

        <div className="detail-meta housing-detail-meta">
          <span><BedDouble size={18} /> {listing.bedrooms} bedrooms</span>
          <span><Bath size={18} /> {listing.bathrooms} bathrooms</span>
          <span><MapPin size={18} /> {listing.address}</span>
          <span><Calendar size={18} /> {formatAvailableDate(listing.available_date)}</span>
          <span><PawPrint size={18} /> {listing.pets_allowed ? 'Pets allowed' : 'No pets'}</span>
          <span><Zap size={18} /> {listing.utilities_included ? 'Utilities included' : 'Utilities not included'}</span>
        </div>

        <div className="detail-body">
          <h2>About this rental</h2>
          <p>{listing.description}</p>
        </div>

        <div className="housing-landlord-card">
          <div className="housing-landlord-avatar">
            {listing.landlordAvatarUrl ? (
              <img src={listing.landlordAvatarUrl} alt={`${listing.landlordName} avatar`} />
            ) : (
              <User size={28} />
            )}
          </div>
          <div>
            <span className="eyebrow">Landlord</span>
            <h3>
              {listing.landlordName}
              <LandlordBadge verified={listing.landlordVerified} warning={listing.landlordWarning} large />
            </h3>
            <p>Member since {formatMemberSince(listing.landlordMemberSince)}</p>
          </div>
        </div>

        <div className="detail-actions">
          {canContact && (
            <button className="primary-button" type="button" onClick={() => setChatOpen(true)}>
              <MessageCircle size={18} />
              Contact Landlord
            </button>
          )}
          {isLoggedIn && !isOwner && (
            <button className="secondary-detail-button" type="button" onClick={() => setReportOpen(true)}>
              <AlertTriangle size={18} />
              Report this Listing
            </button>
          )}
          {isOwner && (
            <>
              <p className="detail-note">You posted this rental.</p>
              <button className="danger-button" type="button" onClick={() => setDeleteOpen(true)} disabled={deleting}>
                <Trash2 size={18} />
                Delete Listing
              </button>
            </>
          )}
          {deleteStatus && <p className="form-status error-text">{deleteStatus}</p>}
          {!isLoggedIn && (
            <Link className="primary-button" to="/login" state={{ from: `/housing/${listing.id}` }}>
              <MessageCircle size={18} />
              Login to Contact Landlord
            </Link>
          )}
        </div>
      </article>

      {chatOpen && (
        <ChatModal
          listing={listing}
          receiverLabel={listing.landlordName}
          onClose={() => setChatOpen(false)}
        />
      )}

      {deleteOpen && (
        <DeleteConfirmModal
          deleting={deleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}

      {reportOpen && (
        <div className="chat-backdrop" role="presentation">
          <section className="chat-modal housing-report-modal" role="dialog" aria-modal="true" aria-label="Report listing">
            <header className="chat-header">
              <div>
                <span className="eyebrow">Safety</span>
                <h2>Report this Listing</h2>
                <p>{listing.title}</p>
              </div>
              <button type="button" className="chat-close" onClick={() => setReportOpen(false)} aria-label="Close report form">
                <X size={20} />
              </button>
            </header>

            <form className="listing-form housing-report-form" onSubmit={handleReportSubmit}>
              <label>
                Reason
                <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} required>
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </label>
              <label className="full-span">
                Details
                <textarea
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  rows={5}
                  placeholder="Share what happened or what looks wrong..."
                  required
                />
              </label>
              {reportStatus && <p className={`form-status full-span${reportStatus.includes('Thank') ? '' : ' error-text'}`}>{reportStatus}</p>}
              <button className="primary-button full-span" type="submit" disabled={reportSubmitting}>
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

export default HousingDetail;

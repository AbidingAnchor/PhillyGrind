import { useEffect, useState } from 'react';
import { createReview, getCompletedOrderReviewTargets } from '../lib/reviewsApi.js';
import { useAuth } from '../lib/auth.jsx';
import Skeleton from './Skeleton.jsx';

function ReviewForm({ listing, orderKind, refreshKey = '', onReviewed }) {
  const { user, isLoggedIn } = useAuth();
  const [targets, setTargets] = useState([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedTarget = targets.find((target) => target.orderId === selectedTargetKey) || targets[0] || null;

  useEffect(() => {
    if (!isLoggedIn || !user || !listing?.id || !orderKind) {
      setTargets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getCompletedOrderReviewTargets({
      currentUserId: user.id,
      listingId: listing.id,
      orderKind,
    })
      .then((nextTargets) => {
        setTargets(nextTargets);
        setSelectedTargetKey(nextTargets[0]?.orderId || '');
      })
      .catch((error) => setStatus(error.message || 'Could not load review options.'))
      .finally(() => setLoading(false));
  }, [isLoggedIn, listing?.id, orderKind, refreshKey, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedTarget) return;

    setSubmitting(true);
    setStatus('');

    try {
      const review = await createReview({
        listingId: listing.id,
        orderId: selectedTarget.orderId,
        listingType: selectedTarget.listingType,
        revieweeId: selectedTarget.revieweeId,
        rating,
        comment,
      });
      setTargets((current) => current.filter((target) => target.orderId !== selectedTarget.orderId));
      setComment('');
      setStatus('Review posted. Thanks for keeping PhillyGrind honest.');
      onReviewed?.(review);
    } catch (error) {
      setStatus(error.message || 'Could not post review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoggedIn || !listing?.id || !orderKind) return null;
  if (!loading && !targets.length) return null;

  return (
    <section className="review-panel">
      <h2>Leave a Review</h2>
      <p className="detail-note">Reviews are available after a completed secure checkout.</p>
      {loading && <Skeleton variant="list" count={2} />}
      {!loading && Boolean(targets.length) && (
        <form className="review-form" onSubmit={handleSubmit}>
          {targets.length > 1 && (
            <label>
              Completed order
              <select
                value={selectedTargetKey}
                onChange={(event) => setSelectedTargetKey(event.target.value)}
                required
              >
                {targets.map((target) => (
                  <option key={target.orderId} value={target.orderId}>
                    Review {target.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedTarget && targets.length === 1 && (
            <p className="detail-note">Reviewing {selectedTarget.name}</p>
          )}
          <div className="star-selector" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={star <= rating ? 'active' : ''}
                onClick={() => setRating(star)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>
          <label>
            Comment
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows="4"
              placeholder="Share what went well, what changed, and what others should know."
              required
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={submitting || !selectedTarget}
          >
            {submitting ? 'Posting...' : 'Post Review'}
          </button>
        </form>
      )}
      {status && <p className="form-status">{status}</p>}
    </section>
  );
}

export default ReviewForm;

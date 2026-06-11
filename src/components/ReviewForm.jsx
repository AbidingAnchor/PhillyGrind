import { useEffect, useState } from 'react';
import { createReview, getExistingReview, getReviewTargets } from '../lib/reviewsApi.js';
import { useAuth } from '../lib/auth.jsx';

function ReviewForm({ listing, onReviewed }) {
  const { user, isLoggedIn } = useAuth();
  const [targets, setTargets] = useState([]);
  const [revieweeId, setRevieweeId] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [existingReview, setExistingReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !user || !listing?.user_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      getExistingReview({ listingId: listing.id, reviewerId: user.id }),
      getReviewTargets({ currentUserId: user.id, listing }),
    ])
      .then(([review, nextTargets]) => {
        setExistingReview(review);
        setTargets(nextTargets);
        setRevieweeId(nextTargets[0]?.id || '');
      })
      .catch((error) => setStatus(error.message || 'Could not load review options.'))
      .finally(() => setLoading(false));
  }, [isLoggedIn, listing, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      const review = await createReview({
        listingId: listing.id,
        revieweeId,
        rating,
        comment,
      });
      setExistingReview(review);
      setComment('');
      setStatus('Review posted. Thanks for keeping PhillyGrind honest.');
      onReviewed?.(review);
    } catch (error) {
      setStatus(error.message || 'Could not post review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoggedIn || !listing?.user_id) return null;
  if (!loading && !existingReview && !targets.length) return null;

  return (
    <section className="review-panel">
      <h2>Leave a Review</h2>
      {loading && <p className="detail-note">Checking review eligibility...</p>}
      {!loading && existingReview && <p className="detail-note">You already reviewed someone for this listing.</p>}
      {!loading && !existingReview && Boolean(targets.length) && (
        <form className="review-form" onSubmit={handleSubmit}>
          {targets.length > 1 && (
            <label>
              Review
              <select value={revieweeId} onChange={(event) => setRevieweeId(event.target.value)} required>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>{target.name}</option>
                ))}
              </select>
            </label>
          )}
          {targets.length === 1 && <p className="detail-note">Reviewing {targets[0].name}</p>}
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
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="4" placeholder="Share what went well, what changed, and what others should know." required />
          </label>
          <button className="primary-button" type="submit" disabled={submitting || !revieweeId}>
            {submitting ? 'Posting...' : 'Post Review'}
          </button>
        </form>
      )}
      {status && <p className="form-status">{status}</p>}
    </section>
  );
}

export default ReviewForm;

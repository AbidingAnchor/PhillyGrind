function StarRating({ rating = 0, count, compact = false }) {
  const rounded = Math.round(Number(rating) * 10) / 10;
  const filled = Math.round(Number(rating));

  return (
    <span className={compact ? 'star-rating compact' : 'star-rating'} aria-label={`${rounded || 0} out of 5 stars`}>
      <span className="stars">{[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= filled ? 'filled' : ''}>★</span>
      ))}</span>
      <span>{rounded ? rounded.toFixed(1) : 'New'}{typeof count === 'number' ? ` (${count})` : ''}</span>
    </span>
  );
}

export default StarRating;

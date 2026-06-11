import { useEffect, useState } from 'react';
import CategoryFilters from '../components/CategoryFilters.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { gigCategories } from '../data/listings.js';
import { getListings } from '../lib/listingsApi.js';
import { attachPosterRatings } from '../lib/reviewsApi.js';

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function BrowseGigs() {
  const [gigs, setGigs] = useState([]);
  const [category, setCategory] = useState('All');
  const [postType, setPostType] = useState('All');
  const [keyword, setKeyword] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError('');

      async function loadGigs() {
        try {
          const nextGigs = await withTimeout(
            getListings('gig', { keyword, category, neighborhood, postType }).then(attachPosterRatings),
            5000,
            'Supabase took too long to load gigs. Please try again.',
          );

          if (!cancelled) setGigs(nextGigs);
        } catch (err) {
          if (!cancelled) setError(err.message || 'Could not load gigs from Supabase.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadGigs();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [category, keyword, neighborhood, postType]);

  return (
    <>
      <section className="browse-hero gigs-hero">
        <span className="eyebrow">Browse gigs</span>
        <h1>Quick tasks around Philly</h1>
        <p>Search and filter moving, cleaning, handyman, delivery, events, and pet care gigs.</p>
      </section>
      <section className="page-section browse-content">
      <div className="browse-controls">
        <label>
          Search gigs
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search title or description"
          />
        </label>
        <label>
          Neighborhood
          <input
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            placeholder="South Philly, Fishtown, Center City..."
          />
        </label>
      </div>
      <div className="gig-type-tabs" aria-label="Gig type filters">
        {[
          ['All', 'All'],
          ['offering', 'Services (Hire Someone)'],
          ['seeking', 'Help Wanted (Find Work)'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={postType === value ? 'filter active' : 'filter'}
            onClick={() => setPostType(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <CategoryFilters categories={gigCategories} activeCategory={category} onChange={setCategory} />
      {loading && <p className="empty-state">Loading gigs from Supabase...</p>}
      {error && <p className="empty-state error-state">{error}</p>}
      {!loading && !error && (
        <>
          <div className="listing-grid">
            {gigs.map((gig) => <ListingCard key={gig.id} listing={gig} />)}
          </div>
          {!gigs.length && <p className="empty-state">No gigs match those filters yet.</p>}
        </>
      )}
    </section>
    </>
  );
}

export default BrowseGigs;

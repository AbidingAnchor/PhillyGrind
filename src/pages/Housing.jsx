import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Home, MapPin, PlusCircle } from 'lucide-react';
import { getHousingListings, HOUSING_NEIGHBORHOODS } from '../lib/housingApi.js';
import { useAuth } from '../lib/auth.jsx';

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function formatAvailableDate(value) {
  if (!value) return 'Available now';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function LandlordBadge({ verified, warning, large = false }) {
  if (verified) {
    return <span className={`housing-badge verified${large ? ' large' : ''}`}>✅ Verified</span>;
  }
  if (warning) {
    return <span className={`housing-badge warning${large ? ' large' : ''}`}>⚠️ Warning</span>;
  }
  return null;
}

function Housing() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [listings, setListings] = useState([]);
  const [neighborhood, setNeighborhood] = useState('Any');
  const [bedrooms, setBedrooms] = useState('Any');
  const [maxRent, setMaxRent] = useState('Any');
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rightsOpen, setRightsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError('');

      async function loadListings() {
        try {
          const nextListings = await withTimeout(
            getHousingListings({ neighborhood, bedrooms, maxRent, petsAllowed }),
            5000,
            'Supabase took too long to load rentals. Please try again.',
          );

          if (!cancelled) setListings(nextListings);
        } catch (err) {
          if (!cancelled) setError(err.message || 'Could not load housing listings.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadListings();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [bedrooms, maxRent, neighborhood, petsAllowed]);

  function handlePostClick() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/housing/post' } });
      return;
    }
    navigate('/housing/post');
  }

  return (
    <>
      <section className="browse-hero housing-hero">
        <span className="eyebrow">Housing</span>
        <h1>Find rentals across Philly</h1>
        <p>Browse neighborhood apartments and homes from local landlords — filter by rent, bedrooms, and pet policy.</p>
      </section>

      <section className="page-section browse-content housing-content">
        <div className="housing-rights-banner">
          <button
            type="button"
            className="housing-rights-toggle"
            onClick={() => setRightsOpen((value) => !value)}
            aria-expanded={rightsOpen}
          >
            <span>🏠 Know Your Rights as a Philly Renter</span>
            {rightsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {rightsOpen && (
            <ul className="housing-rights-list">
              <li>Landlords must provide a <strong>Certificate of Rental Suitability</strong> before you move in.</li>
              <li>Security deposits are capped at <strong>2 months&apos; rent</strong>.</li>
              <li>Your landlord must provide <strong>heat, hot water, and a mold-free home</strong>.</li>
              <li>Eviction requires a <strong>30-day written notice</strong> in most cases.</li>
              <li>Report violations: <strong>215-686-2532</strong> (Licenses &amp; Inspections).</li>
            </ul>
          )}
        </div>

        <div className="housing-filter-card">
          <div className="housing-filter-top-row">
            <div className="housing-filter-inputs">
              <label>
                Neighborhood
                <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}>
                  <option value="Any">Any neighborhood</option>
                  {HOUSING_NEIGHBORHOODS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Bedrooms
                <select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
                  {['Any', '1', '2', '3', '4+'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Max rent
                <select value={maxRent} onChange={(event) => setMaxRent(event.target.value)}>
                  {['Any', 'under $1000', '$1000-$1500', '$1500-$2000', '$2000+'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="housing-toggle-label">
                <span>Pets allowed</span>
                <button
                  type="button"
                  className={petsAllowed ? 'housing-toggle active' : 'housing-toggle'}
                  onClick={() => setPetsAllowed((value) => !value)}
                  aria-pressed={petsAllowed}
                >
                  {petsAllowed ? 'On' : 'Off'}
                </button>
              </label>
            </div>
            <button className="primary-button housing-post-btn" type="button" onClick={handlePostClick}>
              <PlusCircle size={18} />
              Post a Rental
            </button>
          </div>
        </div>

        {loading && <p className="empty-state">Loading rentals from Supabase...</p>}
        {error && <p className="empty-state error-state">{error}</p>}

        {!loading && !error && (
          <>
            <div className="housing-grid">
              {listings.map((listing) => (
                <Link key={listing.id} to={`/housing/${listing.id}`} className="housing-card-link">
                  <article className="housing-card">
                    <div className="housing-card-photo">
                      {listing.images?.length ? (
                        <img src={listing.images[0]} alt={listing.title} />
                      ) : (
                        <div className="housing-card-photo-placeholder">
                          <Home size={32} />
                        </div>
                      )}
                    </div>
                    <div className="housing-card-content">
                      <p className="housing-card-price">${Number(listing.monthly_rent).toLocaleString()}/mo</p>
                      <h3>{listing.title}</h3>
                      <p className="housing-card-meta">
                        {listing.bedrooms} bed · {listing.bathrooms} bath · {listing.neighborhood}
                      </p>
                      <p className="housing-card-address">
                        <MapPin size={14} />
                        {listing.address}
                      </p>
                      <p className="housing-card-date">Available {formatAvailableDate(listing.available_date)}</p>
                      <div className="housing-card-landlord">
                        <span>{listing.landlordName}</span>
                        <LandlordBadge verified={listing.landlordVerified} warning={listing.landlordWarning} />
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
            {!listings.length && <p className="empty-state">No rentals match those filters yet.</p>}
          </>
        )}

        {!isLoggedIn && (
          <p className="housing-login-hint">
            <Link to="/login" state={{ from: '/housing' }}>Log in</Link> to post rentals and contact landlords.
          </p>
        )}
      </section>
    </>
  );
}

export default Housing;

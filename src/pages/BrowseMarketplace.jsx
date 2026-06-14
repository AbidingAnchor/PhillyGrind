import { useEffect, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { PlusCircle, Camera, MapPin, Package } from 'lucide-react';

import MarketplacePostModal from '../components/MarketplacePostModal.jsx';

import ChatModal from '../components/ChatModal.jsx';


import { getMarketplaceListing, getMarketplaceListings } from '../lib/marketplaceApi.js';

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



function BrowseMarketplace() {

  const [listings, setListings] = useState([]);

  const [category, setCategory] = useState('All');

  const [keyword, setKeyword] = useState('');

  const [neighborhood, setNeighborhood] = useState('');

  const [condition, setCondition] = useState('All');

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [postOpen, setPostOpen] = useState(false);

  const [chatListing, setChatListing] = useState(null);

  const [searchParams] = useSearchParams();

  const navigate = useNavigate();

  const { isLoggedIn } = useAuth();



  useEffect(() => {

    let cancelled = false;

    const timeoutId = setTimeout(() => {

      setLoading(true);

      setError('');



      async function loadListings() {

        try {

          const nextListings = await withTimeout(

            getMarketplaceListings({ keyword, category, condition, location: neighborhood }),

            5000,

            'Supabase took too long to load marketplace listings. Please try again.',

          );



          if (!cancelled) setListings(nextListings);

        } catch (err) {

          if (!cancelled) setError(err.message || 'Could not load marketplace listings.');

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

  }, [category, condition, keyword, neighborhood]);



  useEffect(() => {

    const shouldOpenChat = searchParams.get('openChat') === 'true';

    const listingId = searchParams.get('listingId');

    const senderId = searchParams.get('senderId');



    if (!shouldOpenChat || !listingId) return;



    getMarketplaceListing(listingId)

      .then((listing) => {

        if (listing) {

          setChatListing({ listing, senderId });

        }

      })

      .catch((err) => console.warn(err));

  }, [searchParams]);



  function handlePosted(created) {

    setListings((current) => [created, ...current]);

    setPostOpen(false);

  }



  function handlePostClick() {

    if (!isLoggedIn) {

      navigate('/login', { state: { from: '/marketplace' } });

      return;

    }



    setPostOpen(true);

  }



  function closeChat() {

    setChatListing(null);

    navigate('/marketplace', { replace: true });

  }



  return (

    <>

      <section className="browse-hero marketplace-hero">

        <span className="eyebrow">Marketplace</span>

        <h1>Buy and sell in your neighborhood</h1>

        <p>Find furniture, electronics, tools, and more from Philly neighbors — or post your own listing.</p>

      </section>

      <section className="page-section marketplace-content">

        <div className="marketplace-filter-card">
          <div className="marketplace-filter-top-row">
            <div className="marketplace-filter-inputs">
              <label>
                Search listings
                <input
                  className="marketplace-filter-input"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Search by keyword"
                />
              </label>
              <label>
                Location
                <input
                  className="marketplace-filter-input"
                  value={neighborhood}
                  onChange={(event) => setNeighborhood(event.target.value)}
                  placeholder="South Philly, Fishtown, Center City..."
                />
              </label>
            </div>
            <button className="primary-button marketplace-post-btn" type="button" onClick={handlePostClick}>
              <PlusCircle size={18} />
              Post a Listing
            </button>
          </div>

          <div className="marketplace-filter-divider" />

          <div className="marketplace-filter-bottom-row">
            <div className="marketplace-category-pills">
              {['All', 'Furniture', 'Electronics', 'Clothing', 'Tools', 'Vehicles', 'Baby & Kids', 'Sports', 'Books', 'Free Stuff', 'Other'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`marketplace-category-pill ${category === cat ? 'selected' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="marketplace-condition-select">
              <label htmlFor="marketplace-condition">Condition</label>
              <select
                id="marketplace-condition"
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
              >
                {['All', 'New', 'Like New', 'Good', 'Fair', 'Poor'].map((itemCondition) => (
                  <option key={itemCondition} value={itemCondition}>
                    {itemCondition}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {loading && <p className="empty-state">Loading marketplace listings...</p>}

        {error && <p className="empty-state error-state">{error}</p>}

        {!loading && !error && (

          <>

            <div className="marketplace-grid">
              {listings.map((listing) => (
                <Link key={listing.id} to={`/marketplace/${listing.id}`} className="marketplace-card-link">
                  <article className="marketplace-card">
                    <div className="marketplace-card-photo">
                      {listing.photos && listing.photos.length > 0 ? (
                        <img src={listing.photos[0]} alt={listing.title} />
                      ) : (
                        <div className="marketplace-card-photo-placeholder">
                          <Camera size={32} />
                        </div>
                      )}
                    </div>
                    <div className="marketplace-card-content">
                      <h3 className="marketplace-card-title">{listing.title}</h3>
                      <p className="marketplace-card-price">${listing.price}</p>
                      <div className="marketplace-card-badges">
                        <span className="marketplace-card-badge condition-badge">{listing.condition}</span>
                        <span className="marketplace-card-badge payment-badge">{listing.payment_type === 'cash' ? 'Cash Only' : listing.payment_type === 'escrow' ? 'Secure Checkout' : 'Cash or Secure'}</span>
                      </div>
                      <div className="marketplace-card-location">
                        <MapPin size={14} />
                        {listing.location}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {!listings.length && (
              <div className="marketplace-empty-state">
                <Package size={64} />
                <h3>No listings match those filters yet</h3>
                <p>Be the first to post in this category!</p>
                <button className="primary-button" type="button" onClick={handlePostClick}>
                  <PlusCircle size={18} />
                  Post a Listing
                </button>
              </div>
            )}

          </>

        )}

        {!isLoggedIn && (

          <p className="marketplace-login-hint">

            <Link to="/login" state={{ from: '/marketplace' }}>Log in</Link> to post listings and message sellers.

          </p>

        )}

      </section>

      {postOpen && (

        <MarketplacePostModal

          onClose={() => setPostOpen(false)}

          onPosted={handlePosted}

        />

      )}

      {chatListing && (

        <ChatModal

          listing={chatListing.listing}

          receiverId={chatListing.senderId || undefined}

          onClose={closeChat}

        />

      )}

      <style>{`
  .marketplace-hero {
    background: linear-gradient(135deg, #0f1923 0%, #1a2d1a 100%) !important;
  }
  .marketplace-content {
    background-color: #f4f5f7;
    padding: 2rem 1rem;
  }
  .marketplace-filter-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 20px 24px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    margin-bottom: 2rem;
  }
  .marketplace-filter-top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .marketplace-filter-inputs {
    flex: 1;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .marketplace-filter-inputs label {
    flex: 1;
    min-width: 200px;
    font-size: 13px;
    font-weight: 600;
    color: #1a2332;
  }
  .marketplace-filter-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    background: #f9fafb;
    transition: border-color 0.2s ease;
    margin-top: 4px;
  }
  .marketplace-filter-input:focus {
    outline: none;
    border-color: #1a2332;
  }
  .marketplace-post-btn {
    background-color: #22c55e !important;
    border: none !important;
    white-space: nowrap;
    padding: 10px 20px !important;
    border-radius: 10px !important;
    font-size: 14px !important;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .marketplace-post-btn:hover {
    background-color: #16a34a !important;
  }
  .marketplace-filter-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 0 -24px 1rem -24px;
  }
  .marketplace-filter-bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }
  .marketplace-category-pills {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: flex-start;
  }
  .marketplace-category-pill {
    background: white;
    border: 1px solid #d1d5db;
    color: #1a2332;
    font-size: 13px;
    padding: 6px 14px;
    border-radius: 9999px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .marketplace-category-pill:hover {
    background: #f1f5f9;
  }
  .marketplace-category-pill.selected {
    background: #1a2332;
    color: white;
    border-color: #1a2332;
  }
  .marketplace-condition-select {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .marketplace-condition-select label {
    font-weight: 600;
    color: #1a2332;
    font-size: 14px;
  }
  .marketplace-condition-select select {
    min-width: 150px;
    padding: 10px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    background: #f9fafb;
  }
  .marketplace-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 1024px) {
    .marketplace-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .marketplace-grid { grid-template-columns: 1fr; }
  }
  .marketplace-card-link { text-decoration: none; }
  .marketplace-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }
  .marketplace-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .marketplace-card-photo {
    width: 100%;
    height: 200px;
    overflow: hidden;
  }
  .marketplace-card-photo img {
    width: 100%; height: 100%; object-fit: cover;
  }
  .marketplace-card-photo-placeholder {
    width: 100%; height: 100%;
    background: #e5e7eb;
    display: flex; align-items: center; justify-content: center;
    color: #9ca3af;
  }
  .marketplace-card-content { padding: 1rem; }
  .marketplace-card-title {
    font-size: 1rem; font-weight: 700; color: #1a2332;
    margin: 0 0 0.5rem 0; line-height: 1.4;
  }
  .marketplace-card-price {
    font-size: 1.25rem; font-weight: 700; color: #22c55e;
    margin: 0 0 0.75rem 0;
  }
  .marketplace-card-badges {
    display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;
  }
  .marketplace-card-badge {
    font-size: 0.75rem; font-weight: 600; color: white;
    padding: 0.25rem 0.75rem; border-radius: 9999px;
  }
  .marketplace-card-location {
    display: flex; align-items: center; gap: 0.25rem;
    font-size: 0.875rem; color: #6b7280;
  }
  .marketplace-empty-state {
    text-align: center; padding: 4rem 2rem; color: #6b7280;
  }
  .marketplace-empty-state svg { color: #d1d5db; margin-bottom: 1.5rem; }
  .marketplace-empty-state h3 { font-size: 1.25rem; color: #1a2332; margin: 0 0 0.5rem 0; }
  .marketplace-empty-state p { margin: 0 0 1.5rem 0; }
  .marketplace-empty-state .primary-button { background-color: #22c55e; border: none; }
  .marketplace-login-hint { text-align: center; color: #6b7280; font-size: 14px; margin-top: 1rem; }
  @media (max-width: 768px) {
    .marketplace-filter-top-row { flex-direction: column; }
    .marketplace-filter-inputs { flex-direction: column; width: 100%; }
    .marketplace-filter-inputs label { min-width: 100%; }
    .marketplace-post-btn { width: 100%; }
    .marketplace-filter-bottom-row { flex-direction: column; }
    .marketplace-condition-select { width: 100%; }
    .marketplace-condition-select select { width: 100%; }
    .marketplace-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 430px) {
    .marketplace-content { padding: 1.25rem 0.875rem; }
    .marketplace-filter-card { padding: 14px 16px; }
    .marketplace-hero h1 { font-size: 1.5rem; }
  }
`}</style>
    </>

  );

}



export default BrowseMarketplace;


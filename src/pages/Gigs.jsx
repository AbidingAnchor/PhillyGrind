import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BrowseGigs from './BrowseGigs.jsx';
import PostGig from './PostGig.jsx';
import { useAuth } from '../lib/auth.jsx';

function Gigs() {
  const [searchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const initialTab = searchParams.get('tab') === 'post' ? 'post' : 'browse';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Redirect to browse if trying to access post tab while logged out
  if (!isLoggedIn && activeTab === 'post') {
    setActiveTab('browse');
  }

  return (
    <>
      <div className="page-tabs">
        <button
          className={`feed-filter-tab ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse
        </button>
        {isLoggedIn ? (
          <button
            className={`feed-filter-tab ${activeTab === 'post' ? 'active' : ''}`}
            onClick={() => setActiveTab('post')}
          >
            Post a Gig
          </button>
        ) : (
          <Link to="/signup" state={{ from: '/gigs?tab=post' }} className="feed-filter-tab">
            Post a Gig
          </Link>
        )}
      </div>
      {activeTab === 'browse' ? <BrowseGigs /> : <PostGig />}
    </>
  );
}

export default Gigs;

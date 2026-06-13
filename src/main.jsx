import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import Home from './pages/Home.jsx';
import BrowseJobs from './pages/BrowseJobs.jsx';
import BrowseGigs from './pages/BrowseGigs.jsx';
import BrowseMarketplace from './pages/BrowseMarketplace.jsx';
import MarketplaceDetail from './pages/MarketplaceDetail.jsx';
import PostJob from './pages/PostJob.jsx';
import PostGig from './pages/PostGig.jsx';
import PostMarketplaceListing from './pages/PostMarketplaceListing.jsx';
import BrowseHiringEvents from './pages/BrowseHiringEvents.jsx';
import PostHiringEvent from './pages/PostHiringEvent.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import Messages from './pages/Messages.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';
import Profile from './pages/Profile.jsx';
import PublicProfile from './pages/PublicProfile.jsx';
import AdminDisputes from './pages/AdminDisputes.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './lib/auth.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<Home />} />
            <Route path="/jobs" element={<BrowseJobs />} />
            <Route path="/gigs" element={<BrowseGigs />} />
            <Route path="/marketplace" element={<BrowseMarketplace />} />
            <Route path="/marketplace/:id" element={<MarketplaceDetail />} />
            <Route path="/hiring-events" element={<BrowseHiringEvents />} />
            <Route path="/post-hiring-event" element={<PostHiringEvent />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/post-job" element={<ProtectedRoute><PostJob /></ProtectedRoute>} />
            <Route path="/post-gig" element={<ProtectedRoute><PostGig /></ProtectedRoute>} />
            <Route path="/marketplace/post" element={<ProtectedRoute><PostMarketplaceListing /></ProtectedRoute>} />
            <Route path="/admin/disputes" element={<AdminRoute><AdminDisputes /></AdminRoute>} />
            <Route path="/jobs/:id" element={<ListingDetail type="job" />} />
            <Route path="/gigs/:id" element={<ListingDetail type="gig" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);

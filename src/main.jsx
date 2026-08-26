import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import Jobs from './pages/Jobs.jsx';
import Gigs from './pages/Gigs.jsx';
import BrowseMarketplace from './pages/BrowseMarketplace.jsx';
import MarketplaceDetail from './pages/MarketplaceDetail.jsx';
import PostJob from './pages/PostJob.jsx';
import PostGig from './pages/PostGig.jsx';
import PostMarketplaceListing from './pages/PostMarketplaceListing.jsx';
import BrowseHiringEvents from './pages/BrowseHiringEvents.jsx';
import PostHiringEvent from './pages/PostHiringEvent.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import Login from './pages/Login.jsx';
import AccountRecovery from './pages/AccountRecovery.jsx';
import AccountRecoveryReset from './pages/AccountRecoveryReset.jsx';
import SignUp from './pages/SignUp.jsx';
import Messages from './pages/Messages.jsx';
import Contact from './pages/Contact.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';
import Profile, { OwnProfileRedirect } from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import AdminDisputes from './pages/AdminDisputes.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminListings from './pages/admin/AdminListings.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminCaseView from './pages/admin/AdminCaseView.jsx';
import AdminVerifications from './pages/admin/AdminVerifications.jsx';
import AdminHousing from './pages/admin/AdminHousing.jsx';
import AdminCommunity from './pages/admin/AdminCommunity.jsx';
import AdminModeration from './pages/admin/AdminModeration.jsx';
import AdminContact from './pages/admin/AdminContact.jsx';
import AdminRecovery from './pages/admin/AdminRecovery.jsx';
import Housing from './pages/Housing.jsx';
import PostHousing from './pages/PostHousing.jsx';
import HousingDetail from './pages/HousingDetail.jsx';
import Community from './pages/Community.jsx';
import BrowseGroups from './pages/BrowseGroups.jsx';
import CreateGroup from './pages/CreateGroup.jsx';
import GroupPage from './pages/GroupPage.jsx';
import Alerts from './pages/Alerts.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<App />}>
              <Route path="/" element={<Community />} />
              <Route path="/community" element={<Navigate to="/" replace />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/gigs" element={<Gigs />} />
              <Route path="/marketplace" element={<BrowseMarketplace />} />
              <Route path="/marketplace/:id" element={<MarketplaceDetail />} />
              <Route path="/hiring-events" element={<BrowseHiringEvents />} />
              <Route path="/housing" element={<Housing />} />
              <Route path="/housing/post" element={<ProtectedRoute><PostHousing /></ProtectedRoute>} />
              <Route path="/housing/:id" element={<HousingDetail />} />
              <Route path="/post-hiring-event" element={<PostHiringEvent />} />
              <Route path="/login" element={<Login />} />
              <Route path="/account-recovery/reset" element={<AccountRecoveryReset />} />
              <Route path="/account-recovery" element={<AccountRecovery />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/groups" element={<ProtectedRoute><BrowseGroups /></ProtectedRoute>} />
              <Route path="/groups/create" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
              <Route path="/groups/:groupId" element={<ProtectedRoute><GroupPage /></ProtectedRoute>} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/profile" element={<ProtectedRoute><OwnProfileRedirect /></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/post-job" element={<Navigate to="/jobs?tab=post" replace />} />
              <Route path="/post-gig" element={<Navigate to="/gigs?tab=post" replace />} />
              <Route path="/browse-jobs" element={<Navigate to="/jobs" replace />} />
              <Route path="/browse-gigs" element={<Navigate to="/gigs" replace />} />
              <Route path="/marketplace/post" element={<ProtectedRoute><PostMarketplaceListing /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="listings" element={<AdminListings />} />
                <Route path="disputes" element={<AdminDisputes />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="cases/:caseType/:caseId" element={<AdminCaseView />} />
                <Route path="verifications" element={<AdminVerifications />} />
                <Route path="housing" element={<AdminHousing />} />
                <Route path="community" element={<AdminCommunity />} />
                <Route path="moderation" element={<AdminModeration />} />
                <Route path="contact" element={<AdminContact />} />
                <Route path="recovery" element={<AdminRecovery />} />
              </Route>
              <Route path="/jobs/:id" element={<ListingDetail type="job" />} />
              <Route path="/gigs/:id" element={<ListingDetail type="gig" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

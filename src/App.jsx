import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from './lib/auth.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import GrindBot from './components/GrindBot.jsx';

const navItems = [
  { to: '/jobs', label: 'Browse Jobs', tour: 'browse-jobs', id: 'nav-browse-jobs' },
  { to: '/gigs', label: 'Browse Gigs', tour: 'browse-gigs', id: 'nav-browse-gigs' },
  { to: '/marketplace', label: 'Marketplace', tour: 'marketplace', id: 'nav-marketplace' },
  { to: '/hiring-events', label: 'Hiring Events', tour: 'hiring-events', id: 'nav-hiring-events' },
  { to: '/post-job', label: 'Post a Job', tour: 'post-job', id: 'nav-post-job' },
  { to: '/post-gig', label: 'Post a Gig', tour: 'post-gig', id: 'nav-post-gig' },
];

function App() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isLoggedIn, profile, signOut } = useAuth();
  const location = useLocation();
  const displayName = profile?.name || 'My Profile';
  const shouldShowOnboarding = Boolean(isLoggedIn && profile && profile.onboarding_complete === false && location.pathname === '/');

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 10);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await signOut();
    setOpen(false);
  }

  return (
    <div className="app-shell">
      <header className={scrolled ? 'site-header scrolled' : 'site-header'}>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span style={{
            fontSize: '22px',
            fontWeight: '800',
            letterSpacing: '-0.5px',
            fontFamily: 'Inter, sans-serif',
          }}
          >
            <span style={{ color: '#ffffff' }}>Philly</span>
            <span style={{ color: '#00c896' }}>Grind</span>
          </span>
        </Link>

        <button
          className="menu-button"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <Menu size={22} />
        </button>

        <nav className={open ? 'site-nav open' : 'site-nav'}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} id={item.id} data-tour={item.tour} onClick={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          {isLoggedIn && (
            <NavLink to="/messages" id="nav-messages" data-tour="messages" onClick={() => setOpen(false)}>
              Messages
            </NavLink>
          )}
          <Link className="nav-cta" id="nav-post-now" to="/post-gig" onClick={() => setOpen(false)}>
            <PlusCircle size={18} />
            Post Now
          </Link>
          {isLoggedIn && (
            <div className="nav-user">
              <NotificationBell />
              <Link className="nav-profile-link" to="/profile" id="nav-profile" data-tour="profile" onClick={() => setOpen(false)}>
                {displayName}
              </Link>
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
          )}
          {!isLoggedIn && (
            <div className="auth-links">
              <NavLink to="/login" onClick={() => setOpen(false)}>Login</NavLink>
              <Link className="nav-cta auth-cta" to="/signup" onClick={() => setOpen(false)}>Sign Up</Link>
            </div>
          )}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      {shouldShowOnboarding && <OnboardingModal />}
      {isLoggedIn && <GrindBot />}

      <footer className="site-footer">
        <div>
          <strong>PhillyGrind</strong>
          <p>Local work, neighborhood hustle, real opportunities across Philadelphia.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link to="/jobs">Browse Jobs</Link>
          <Link to="/gigs">Browse Gigs</Link>
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/post-job">Post a Job</Link>
          <Link to="/post-gig">Post a Gig</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
}

export default App;

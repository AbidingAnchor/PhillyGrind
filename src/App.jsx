import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from './lib/auth.jsx';
import { isAdminUser } from './lib/adminApi.js';
import { supabase } from './lib/supabase.js';
import OnboardingModal from './components/OnboardingModal.jsx';
import NotificationBell from './components/NotificationBell.jsx';

const navItems = [
  { to: '/', label: 'Community', tour: 'community', id: 'nav-community' },
  { to: '/jobs', label: 'Jobs', tour: 'jobs', id: 'nav-jobs' },
  { to: '/gigs', label: 'Gigs', tour: 'gigs', id: 'nav-gigs' },
  { to: '/marketplace', label: 'Marketplace', tour: 'marketplace', id: 'nav-marketplace' },
  { to: '/housing', label: 'Housing', tour: 'housing', id: 'nav-housing' },
];

function App() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isLoggedIn, profile, signOut, user } = useAuth();
  const location = useLocation();
  const displayName = profile?.name || 'My Profile';
  const showAdminLink = isAdminUser(user);
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

  // Diagnostic to log computed styles of menu element on state change
  useEffect(() => {
    const menuEl = document.querySelector('.site-nav');
    if (menuEl) {
      const styles = window.getComputedStyle(menuEl);
      const appShell = document.querySelector('.app-shell');
      const appShellStyles = appShell ? window.getComputedStyle(appShell) : null;
      
      console.log('[MENU DEBUG] isMenuOpen:', open, {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        transform: styles.transform,
        height: styles.height,
        maxHeight: styles.maxHeight,
        zIndex: styles.zIndex,
        position: styles.position,
        top: styles.top,
        left: styles.left,
        right: styles.right,
        bottom: styles.bottom,
        className: menuEl.className,
        parentAppShell: appShellStyles ? {
          overflowX: appShellStyles.overflowX,
          overflowY: appShellStyles.overflowY,
          overflow: appShellStyles.overflow,
          position: appShellStyles.position
        } : 'not found'
      });
    }
  }, [open]);

  // Update last_active_at timestamp when logged-in user navigates
  useEffect(() => {
    if (isLoggedIn && user) {
      supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('Failed to update last_active_at:', error);
        });
    }
  }, [location.pathname, isLoggedIn, user]);

  async function handleLogout() {
    await signOut();
    setOpen(false);
  }

  return (
    <div className="app-shell">
      <header className={scrolled ? 'site-header scrolled' : 'site-header'}>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-text">
            <span className="brand-philly">Philly</span>
            <span className="brand-grind">Grind</span>
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
          {isLoggedIn && (
            <div className="nav-user">
              {showAdminLink && (
                <NavLink to="/admin" id="nav-admin" onClick={() => setOpen(false)}>
                  <Shield size={16} />
                  Admin
                </NavLink>
              )}
              <Link className="nav-profile-link" to="/profile" id="nav-profile" data-tour="profile" onClick={() => setOpen(false)}>
                {displayName}
              </Link>
              <NotificationBell />
              <Link className="nav-profile-link" to="/settings" id="nav-settings" onClick={() => setOpen(false)}>
                Settings
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

      <footer className="site-footer">
        <div>
          <strong>PhillyGrind</strong>
          <p>Local work, neighborhood hustle, real opportunities across Philadelphia.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link to="/">Community</Link>
          <Link to="/jobs">Jobs</Link>
          <Link to="/gigs">Gigs</Link>
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/housing">Housing</Link>
          <Link to="/contact">Need Help? Chat with GrindBot</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
}

export default App;

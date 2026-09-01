import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Menu, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './lib/auth.jsx';
import { persistReferral } from './lib/referral.js';
import { isAdminUser } from './lib/adminApi.js';
import { touchOwnLastActive } from './lib/profileApi.js';
import { subscribeToToasts } from './lib/toast.js';
import MascotOnboarding from './components/MascotOnboarding.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import Toast from './components/Toast.jsx';
import {
  hasCompletedMascotOnboarding,
  shouldHideMascotOnboarding,
} from './lib/mascotOnboardingStorage.js';

const navItems = [
  { to: '/', label: 'Community', tour: 'community', id: 'nav-community' },
  { to: '/groups', label: 'Groups', id: 'nav-groups' },
  { to: '/alerts', label: 'Alerts', tour: 'alerts', id: 'nav-alerts' },
  { to: '/jobs', label: 'Jobs', tour: 'jobs', id: 'nav-jobs' },
  { to: '/gigs', label: 'Gigs', tour: 'gigs', id: 'nav-gigs' },
  { to: '/marketplace', label: 'Marketplace', tour: 'marketplace', id: 'nav-marketplace' },
  { to: '/housing', label: 'Housing', tour: 'housing', id: 'nav-housing' },
];

function App() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef(null);
  const mobileNavRef = useRef(null);
  const [toastMessage, setToastMessage] = useState('');
  const [mascotDismissed, setMascotDismissed] = useState(false);
  const { isLoggedIn, profile, signOut, user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const displayName = profile?.name || 'My Profile';
  const showAdminLink = isAdminUser(user);
  const previewMascot = searchParams.get('mascot') === 'preview';
  const installParam = searchParams.get('install');
  const previewInstall = installParam === 'preview' || installParam === 'ios' || installParam === 'native';

  // Trace mascot onboarding state
  const localStorageMascotValue = typeof window !== 'undefined' ? window.localStorage.getItem('phillygrind-mascot-onboarding-v1') : 'window undefined';
  const mascotFinished = Boolean(
    mascotDismissed || hasCompletedMascotOnboarding(user?.id),
  );
  const needsFirstRunOnboarding = Boolean(
    isLoggedIn && profile && profile.onboarding_complete === false,
  );
  const shouldShowMascotOnboarding = Boolean(
    !mascotDismissed
    && !previewInstall
    && !shouldHideMascotOnboarding(location.pathname)
    && (previewMascot || (needsFirstRunOnboarding && !hasCompletedMascotOnboarding(user?.id))),
  );

  console.log('[MASCOT ONBOARDING DEBUG]', {
    localStorageMascotValue,
    mascotDismissed,
    hasCompletedMascotOnboarding: hasCompletedMascotOnboarding(user?.id),
    mascotFinished,
    isLoggedIn,
    profileOnboardingComplete: profile?.onboarding_complete,
    needsFirstRunOnboarding,
    previewMascot,
    previewInstall,
    shouldHideMascotOnboarding: shouldHideMascotOnboarding(location.pathname),
    shouldShowMascotOnboarding,
    userId: user?.id,
    pathname: location.pathname,
  });

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

  useEffect(() => {
    if (!open) return;

    function isInsideMenu(target) {
      return Boolean(
        menuButtonRef.current?.contains(target)
        || mobileNavRef.current?.contains(target),
      );
    }

    function handlePointerDown(event) {
      if (isInsideMenu(event.target)) return;
      setOpen(false);
    }

    function handleScrollClose() {
      setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScrollClose, { passive: true, capture: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScrollClose, { capture: true });
    };
  }, [open]);

  useEffect(() => {
    persistReferral(searchParams.get('ref'));
  }, [searchParams]);

  useEffect(() => subscribeToToasts(setToastMessage), []);

  // Diagnostic to log computed styles of menu element on page load
  useEffect(() => {
    const menuEl = document.querySelector('.site-nav');
    if (menuEl) {
      const styles = window.getComputedStyle(menuEl);
      const rect = menuEl.getBoundingClientRect();
      console.log('[NAV DEBUG] Page load computed styles:', {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        position: styles.position,
        zIndex: styles.zIndex,
        className: menuEl.className,
        rect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom
        },
        parent: menuEl.parentElement?.tagName,
        childCount: menuEl.children.length
      });
    }
  }, []);

  // Diagnostic to log computed styles of menu element on state change
  useEffect(() => {
    const menuEl = document.querySelector('.site-nav');
    if (menuEl) {
      const styles = window.getComputedStyle(menuEl);
      const appShell = document.querySelector('.app-shell');
      const appShellStyles = appShell ? window.getComputedStyle(appShell) : null;
      
      // Check data-theme attribute
      const dataTheme = document.documentElement.getAttribute('data-theme');
      
      console.log('[MENU DEBUG] isMenuOpen:', open, {
        dataTheme,
        backgroundColor: styles.backgroundColor,
        className: menuEl.className
      });
    }
  }, [open]);

  // Update last_active_at timestamp when logged-in user navigates
  useEffect(() => {
    if (isLoggedIn && user) {
      touchOwnLastActive().catch((error) => {
        console.error('Failed to update last_active_at:', error);
      });
    }
  }, [location.pathname, isLoggedIn, user]);

  async function handleLogout() {
    await signOut();
    setOpen(false);
  }

  const willShowPwaGuide = Boolean(
    isLoggedIn && profile && !profile.onboarding_complete && mascotFinished
  );

  console.log(`[FLOW DECISION] mascotFinished=${mascotFinished}, willShowMascot=${shouldShowMascotOnboarding}, willShowPwaGuide=${willShowPwaGuide}, localStorage_raw='${localStorageMascotValue}'`);

  return (
    <div className="app-shell">
      <header className={scrolled ? 'site-header scrolled' : 'site-header'}>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-text">
            <span className="brand-philly">Philly</span>
            <span className="brand-grind">Grind</span>
          </span>
        </Link>

        {/* Desktop nav - always visible on desktop */}
        <nav className="site-nav desktop-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} id={item.id} data-tour={item.tour}>
              {item.label}
            </NavLink>
          ))}
          {isLoggedIn && (
            <NavLink to="/messages" id="nav-messages" data-tour="messages">
              Messages
            </NavLink>
          )}
          {isLoggedIn && (
            <div className="nav-user">
              {showAdminLink && (
                <NavLink to="/admin" id="nav-admin">
                  <Shield size={16} />
                  Admin
                </NavLink>
              )}
              <Link className="nav-profile-link" to={user?.id ? `/profile/${user.id}` : '/profile'} id="nav-profile" data-tour="profile">
                {displayName}
              </Link>
              <NotificationBell />
              <Link className="nav-profile-link" to="/settings" id="nav-settings">
                Settings
              </Link>
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
          )}
          {!isLoggedIn && (
            <div className="auth-links">
              <NavLink to="/login">Login</NavLink>
              <Link className="nav-cta auth-cta" to="/signup">Sign Up</Link>
            </div>
          )}
        </nav>

        {/* Mobile hamburger button */}
        <button
          ref={menuButtonRef}
          className="menu-button"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile nav - Portal-rendered for mobile only */}
      {createPortal(
        <nav ref={mobileNavRef} className={open ? 'site-nav mobile-nav open' : 'site-nav mobile-nav'}>
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
              <Link className="nav-profile-link" to={user?.id ? `/profile/${user.id}` : '/profile'} id="nav-profile" data-tour="profile" onClick={() => setOpen(false)}>
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
        </nav>,
        document.body
      )}

      <main>
        <Outlet />
      </main>

      {shouldShowMascotOnboarding && (
        <MascotOnboarding
          userId={user?.id}
          persist={!previewMascot}
          onComplete={() => setMascotDismissed(true)}
        />
      )}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      )}

      <footer className="site-footer">
        <div>
          <strong>PhillyGrind</strong>
          <p>Local work, neighborhood hustle, real opportunities across Philadelphia.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link to="/">Community</Link>
          <Link to="/groups">Groups</Link>
          <Link to="/alerts">Alerts</Link>
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

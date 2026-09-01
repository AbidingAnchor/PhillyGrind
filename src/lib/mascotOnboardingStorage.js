const STORAGE_KEY = 'phillygrind-mascot-onboarding-v1';

export const MASCOT_STEPS = [
  {
    id: 'jobs',
    image: '/mascot/mascot-jobs.png',
    headline: 'Jobs',
    description: 'Find real work posted by neighbors across Philly. Apply, bid, and get paid without the usual runaround.',
  },
  {
    id: 'gigs',
    image: '/mascot/mascot-gigs.png',
    headline: 'Gigs',
    description: 'Short-form hustles you can pick up or post in minutes — a hand with a move, a weekend shift, a one-off job on your block.',
  },
  {
    id: 'housing',
    image: '/mascot/mascot-housing.png',
    headline: 'Housing',
    description: 'Rooms, sublets, and listings from people in the neighborhood — not a feed of out-of-town noise.',
  },
  {
    id: 'community',
    image: '/mascot/mascot-community.png',
    headline: 'Community',
    description: 'The feed is where the block talks. Posts, groups, and what’s happening around you, in one place.',
  },
  {
    id: 'sports',
    image: '/mascot/mascot-sports.png',
    headline: 'Sports',
    description: 'Philly scores, plays, and the city’s teams live right on the Community feed so you never have to bounce out of the app.',
  },
  {
    id: 'boost',
    image: '/mascot/mascot-boost.png',
    headline: 'Boost',
    description: 'Need more eyes on a listing? Boost it and put your job, gig, or post in front of more neighbors when it matters.',
  },
  {
    id: 'support',
    image: '/mascot/mascot-support.png',
    headline: 'Support',
    description: 'Questions, how the app works, or a hand with an account issue — GrindBot is right here when you need it.',
  },
];

let mascotPreloadPromise;

function loadMascotImage(src) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const image = new Image();
    const succeed = () => {
      if (typeof image.decode === 'function') {
        image.decode().then(() => finish(true)).catch(() => finish(true));
        return;
      }
      finish(true);
    };

    image.onload = succeed;
    image.onerror = () => finish(false);
    image.src = src;

    if (image.complete && image.naturalWidth > 0) succeed();
  });
}

export function preloadMascotImages() {
  if (!mascotPreloadPromise) {
    mascotPreloadPromise = Promise.all(
      MASCOT_STEPS.map(async (step) => ({
        id: step.id,
        ok: await loadMascotImage(step.image),
      })),
    );
  }
  return mascotPreloadPromise;
}

if (typeof window !== 'undefined') {
  try {
    if (new URLSearchParams(window.location.search).get('mascot') === 'preview') {
      preloadMascotImages();
    }
  } catch {
    // Ignore preview preload failures.
  }
}

const AUTH_PREFIXES = ['/login', '/signup', '/join', '/account-recovery'];

export function shouldHideMascotOnboarding(pathname) {
  if (!pathname) return false;
  if (pathname.startsWith('/admin')) return true;
  if (pathname === '/terms' || pathname === '/privacy') return true;
  return AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function readFlag(key) {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Private mode or blocked storage — treat as session-only skip.
  }
}

export function hasCompletedMascotOnboarding(userId) {
  const globalFlag = readFlag(STORAGE_KEY);
  const userFlag = userId ? readFlag(`${STORAGE_KEY}:${userId}`) : false;
  const result = userFlag || globalFlag;
  console.log('[MASCOT STORAGE CHECK] hasCompletedMascotOnboarding:', {
    userId,
    globalFlag,
    userFlag,
    result,
    storageKey: STORAGE_KEY,
  });
  if (userId && readFlag(`${STORAGE_KEY}:${userId}`)) return true;
  return readFlag(STORAGE_KEY);
}

export function markMascotOnboardingComplete(userId) {
  writeFlag(STORAGE_KEY);
  if (userId) writeFlag(`${STORAGE_KEY}:${userId}`);
}

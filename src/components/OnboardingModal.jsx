import { useRef, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Star, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';

const introSteps = [
  {
    icon: CheckCircle2,
    eyebrow: 'Welcome',
    title: 'Welcome to PhillyGrind',
    body: "Philadelphia's local job and gig platform, built for neighbors hiring neighbors.",
  },
  {
    icon: ArrowRight,
    eyebrow: 'How it works',
    title: 'Your neighborhood first',
    body: 'Browse work, post help wanted, offer your skills, and keep everything moving through PhillyGrind.',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Secure escrow',
    title: 'Payments stay protected',
    body: 'Stripe escrow helps protect both sides. Hirers fund upfront, workers complete the work, and payment releases when the job is confirmed.',
  },
  {
    icon: Star,
    eyebrow: 'Trust',
    title: 'Build your reputation',
    body: 'Reviews and completed work help Philly neighbors know who they can trust.',
  },
  {
    icon: CheckCircle2,
    eyebrow: 'Ready',
    title: "You're all set",
    body: 'Start with a quick tour of the tools you will use most.',
  },
];

const tourSteps = [
  {
    element: '#nav-browse-jobs',
    popover: {
      title: '🔍 Browse Jobs',
      description: 'Find work posted by neighbors near you.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#nav-browse-gigs',
    popover: {
      title: '💼 Browse Gigs',
      description: 'Find workers available for hire right now.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#nav-post-job',
    popover: {
      title: '📋 Post a Job',
      description: 'Need help? Post it and get bids from local workers.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#nav-post-gig',
    popover: {
      title: '🛠️ Post a Gig',
      description: 'Offer your skills. Set your price and get hired.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#nav-post-now',
    popover: {
      title: '⚡ Post Now',
      description: 'Quick post shortcut right here.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#nav-messages',
    popover: {
      title: '💬 Messages',
      description: 'Chat with hirers and workers directly.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#nav-profile',
    popover: {
      title: '⭐ Profile',
      description: 'Your reputation, reviews, and Stripe payouts live here.',
      side: 'bottom',
      align: 'end',
    },
  },
];

function OnboardingModal() {
  const [index, setIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const { completeOnboarding } = useAuth();
  const completedRef = useRef(false);
  const driverRef = useRef(null);
  const step = introSteps[index];
  const Icon = step.icon;
  const isLast = index === introSteps.length - 1;

  async function markComplete() {
    if (completedRef.current) return;
    completedRef.current = true;
    setSaving(true);
    setStatus('');

    try {
      await completeOnboarding();
    } catch (error) {
      completedRef.current = false;
      setStatus(error.message || 'Could not save onboarding status.');
    } finally {
      setSaving(false);
    }
  }

  function launchTour() {
    setShowIntro(false);

    window.setTimeout(() => {
      const tour = driver({
        animate: true,
        allowClose: false,
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Finish Tour',
        progressText: '{{current}} of {{total}}',
        popoverClass: 'phillygrind-tour-popover',
        overlayOpacity: 0.75,
        smoothScroll: true,
        disableActiveInteraction: true,
        stagePadding: 8,
        stageRadius: 16,
        onDestroyed: markComplete,
        onPopoverRender: (popover) => {
          const existingSkip = popover.footerButtons.querySelector('.tour-skip-tour');
          if (existingSkip) return;

          const skipButton = document.createElement('button');
          skipButton.type = 'button';
          skipButton.className = 'tour-skip-tour';
          skipButton.textContent = 'Skip Tour';
          skipButton.addEventListener('click', () => {
            driverRef.current?.destroy();
          });
          popover.footerButtons.appendChild(skipButton);
        },
        steps: tourSteps,
      });

      driverRef.current = tour;
      tour.drive();
    }, 200);
  }

  if (!showIntro) return null;

  return (
    <div className="chat-backdrop onboarding-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-label="Welcome to PhillyGrind">
        <button className="onboarding-skip" type="button" onClick={launchTour} disabled={saving} aria-label="Skip intro and start tour">
          <X size={18} />
          Skip intro
        </button>
        <div className="onboarding-icon">
          <Icon size={26} />
        </div>
        <span className="eyebrow">{step.eyebrow}</span>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="onboarding-progress" aria-label={`Step ${index + 1} of ${introSteps.length}`}>
          {introSteps.map((item, stepIndex) => (
            <span key={item.eyebrow} className={stepIndex <= index ? 'active' : ''} />
          ))}
        </div>
        {status && <p className="form-status error-text">{status}</p>}
        <div className="onboarding-actions">
          {index > 0 && (
            <button className="secondary-detail-button" type="button" onClick={() => setIndex((value) => value - 1)} disabled={saving}>
              <ArrowLeft size={17} />
              Back
            </button>
          )}
          {!isLast && (
            <button className="primary-button" type="button" onClick={() => setIndex((value) => value + 1)}>
              Next
              <ArrowRight size={17} />
            </button>
          )}
          {isLast && (
            <>
              <button className="secondary-detail-button" type="button" onClick={launchTour} disabled={saving}>
                Browse Listings
              </button>
              <button className="primary-button" type="button" onClick={launchTour} disabled={saving}>
                Post Now
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default OnboardingModal;

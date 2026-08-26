import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, MessageSquare, Briefcase, Hammer, ShoppingBag, Home, Sparkles, Smartphone } from 'lucide-react';
import { completeOwnOnboarding } from '../lib/profileApi.js';

function getPwaInstallContext() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop';
  }

  const ua = navigator.userAgent || '';
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) return 'installed';

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';

  if (/Android/i.test(ua)) return 'android';

  return 'desktop';
}

function getInstallCopy(context) {
  switch (context) {
    case 'installed':
      return {
        description: "You're already running PhillyGrind like an app — nice.",
        hint: null,
      };
    case 'ios':
      return {
        description: 'Faster access, feels like a real app — no App Store needed.',
        hint: "Tap the Share button, then 'Add to Home Screen'.",
      };
    case 'android':
      return {
        description: 'Faster access, feels like a real app — no App Store needed.',
        hint: "Tap the menu (⋮), then 'Add to Home Screen' or 'Install app'.",
      };
    default:
      return {
        description: 'Faster access, feels like a real app — no App Store needed.',
        hint: "Look for the install icon in your browser's address bar.",
      };
  }
}

export default function OnboardingTour({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [installContext] = useState(() => getPwaInstallContext());
  const spotlightRef = useRef(null);

  const tourSteps = [
    {
      type: 'welcome',
      title: 'Welcome to the neighborhood',
      subtitle: "Let's take a quick tour around",
    },
    {
      type: 'spotlight',
      target: 'community',
      icon: <MessageSquare size={24} />,
      title: 'Community',
      description: 'Connect with neighbors, share updates, and stay in the loop.',
      position: 'top',
    },
    {
      type: 'spotlight',
      target: 'jobs',
      icon: <Briefcase size={24} />,
      title: 'Jobs',
      description: 'Find local work or post your own opportunities.',
      position: 'top',
    },
    {
      type: 'spotlight',
      target: 'gigs',
      icon: <Hammer size={24} />,
      title: 'Gigs',
      description: 'Quick one-off tasks — perfect for earning extra cash.',
      position: 'top',
    },
    {
      type: 'spotlight',
      target: 'marketplace',
      icon: <ShoppingBag size={24} />,
      title: 'Marketplace',
      description: 'Buy, sell, or trade with people nearby.',
      position: 'top',
    },
    {
      type: 'spotlight',
      target: 'housing',
      icon: <Home size={24} />,
      title: 'Housing',
      description: 'Find apartments, roommates, or sublets in the area.',
      position: 'top',
    },
    {
      type: 'spotlight',
      target: 'grindbot',
      icon: <Sparkles size={24} />,
      title: 'Stuck? Confused?',
      description: "GrindBot's here 24/7, and so are we. Just ask.",
      position: 'bottom',
    },
    {
      type: 'install',
      icon: <Smartphone size={24} />,
      title: 'Get PhillyGrind on your home screen',
    },
    {
      type: 'complete',
      title: "You're all set",
      subtitle: "Let's get started",
    },
  ];

  const currentStep = tourSteps[step];
  const installCopy = currentStep?.type === 'install' ? getInstallCopy(installContext) : null;
  const isCardStep = currentStep?.type === 'spotlight' || currentStep?.type === 'install';

  const nextStep = () => {
    if (step < tourSteps.length - 1) {
      setDirection(1);
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await completeOwnOnboarding();
      onComplete();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      onComplete();
    }
  };

  const handleSkip = async () => {
    try {
      await completeOwnOnboarding();
      onSkip();
    } catch (err) {
      console.error('Failed to skip onboarding:', err);
      onSkip();
    }
  };

  const getTargetElement = () => {
    if (currentStep.type !== 'spotlight') return null;
    const targetMap = {
      community: 'a[href="/community"]',
      jobs: 'a[href="/jobs"]',
      gigs: 'a[href="/gigs"]',
      marketplace: 'a[href="/marketplace"]',
      housing: 'a[href="/housing"]',
      grindbot: 'button[aria-label*="GrindBot"], button:has(.grindbot-icon)',
    };
    const selector = targetMap[currentStep.target];
    return selector ? document.querySelector(selector) : null;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight') nextStep();
      if (e.key === 'ArrowLeft') prevStep();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step]);

  if (!currentStep) return null;

  return createPortal(
    <div className="onboarding-tour-overlay">
      {currentStep.type === 'welcome' && (
        <div className="onboarding-welcome">
          <div className="onboarding-welcome-content">
            <div className="onboarding-wordmark">PhillyGrind</div>
            <h1 className="onboarding-welcome-title">{currentStep.title}</h1>
            <p className="onboarding-welcome-subtitle">{currentStep.subtitle}</p>
            <button
              className="onboarding-primary-button"
              onClick={nextStep}
            >
              Let's go <ArrowRight size={18} />
            </button>
            <button
              className="onboarding-skip-link"
              onClick={handleSkip}
            >
              Skip tour
            </button>
          </div>
        </div>
      )}

      {isCardStep && (
        <>
          <div className="onboarding-backdrop" />
          <div className="onboarding-spotlight-card" style={{ animationDirection: direction > 0 ? 'normal' : 'reverse' }}>
            <div className="onboarding-spotlight-icon">{currentStep.icon}</div>
            <h3 className="onboarding-spotlight-title">{currentStep.title}</h3>
            <p className="onboarding-spotlight-description">
              {currentStep.type === 'install' ? installCopy.description : currentStep.description}
            </p>
            {currentStep.type === 'install' && installCopy.hint && (
              <p className="onboarding-spotlight-hint">{installCopy.hint}</p>
            )}
            <div className="onboarding-spotlight-progress">
              {step} / {tourSteps.length - 2}
            </div>
            <div className="onboarding-spotlight-actions">
              {step > 1 && (
                <button className="onboarding-secondary-button" onClick={prevStep}>
                  Back
                </button>
              )}
              <button className="onboarding-primary-button" onClick={nextStep}>
                {step === tourSteps.length - 2 ? "Let's go" : 'Next'} <ArrowRight size={18} />
              </button>
            </div>
            <button className="onboarding-skip-link" onClick={handleSkip}>
              Skip tour
            </button>
          </div>
        </>
      )}

      {currentStep.type === 'complete' && (
        <div className="onboarding-complete">
          <div className="onboarding-complete-content">
            <div className="onboarding-complete-icon">
              <Sparkles size={48} />
            </div>
            <h1 className="onboarding-complete-title">{currentStep.title}</h1>
            <p className="onboarding-complete-subtitle">{currentStep.subtitle}</p>
            <button
              className="onboarding-primary-button"
              onClick={handleComplete}
            >
              Get started <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      <button className="onboarding-close-button" onClick={handleSkip}>
        <X size={20} />
      </button>
    </div>,
    document.body
  );
}

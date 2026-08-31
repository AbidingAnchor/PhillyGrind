import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Bell, Check, ChevronLeft, ChevronRight, Smartphone, Zap } from 'lucide-react';
import {
  capturePwaInstallPrompt,
  getPwaInstallContext,
  hasNativeInstallPrompt,
  promptNativeInstall,
  subscribeToPwaInstall,
} from '../lib/pwaInstall.js';

const IOS_STEPS = [
  { id: 'share', label: 'Tap Share' },
  { id: 'add', label: 'Add to Home Screen' },
  { id: 'done', label: 'Launch from Home Screen' },
];

const STEP_MS = 3400;

function IosShareIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5v11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M8.2 7.2 12 3.5l3.8 3.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 11.5V18a2.2 2.2 0 0 0 2.2 2.2h6.6A2.2 2.2 0 0 0 17.5 18v-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AddHomeIcon() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <rect x="3" y="3" width="22" height="22" rx="5.5" fill="currentColor" opacity="0.14" />
      <rect x="3.6" y="3.6" width="20.8" height="20.8" rx="5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 9.2v9.6M9.2 14h9.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SafariMock({ step }) {
  const showSheet = step >= 1;
  const showHome = step === 2;

  return (
    <div className="pwa-phone" data-step={IOS_STEPS[step]?.id} aria-hidden="true">
      <div className="pwa-phone-bezel">
        <div className="pwa-phone-screen">
          <div className={`pwa-safari${showHome ? ' is-exiting' : ''}`}>
            <div className="pwa-safari-status">
              <span>9:41</span>
              <span className="pwa-safari-notch" />
              <span className="pwa-safari-status-end">
                <span />
                <span />
                <span />
              </span>
            </div>
            <div className="pwa-safari-omnibox">
              <span className="pwa-safari-lock" />
              <span>phillygrind.work</span>
            </div>
            <div className="pwa-safari-page">
              <div className="pwa-mini-header">
                <strong>PhillyGrind</strong>
                <span>Community</span>
              </div>
              <div className="pwa-mini-card" />
              <div className="pwa-mini-card is-short" />
              <div className="pwa-mini-card" />
            </div>
            <div className="pwa-safari-toolbar">
              <span className="pwa-tool-chevron" />
              <span className="pwa-tool-chevron is-right" />
              <span className={`pwa-tool-share${step === 0 ? ' is-target' : ''}`}>
                <span className="pwa-share-glow" />
                <IosShareIcon className="pwa-share-glyph" />
                {step === 0 && (
                  <span className="pwa-share-arrow">
                    <span />
                  </span>
                )}
              </span>
              <span className="pwa-tool-book" />
              <span className="pwa-tool-tabs" />
            </div>
            {showSheet && (
              <div className="pwa-share-sheet">
                <span className="pwa-share-handle" />
                <div className="pwa-share-apps">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="pwa-share-actions">
                  <div className="pwa-share-row">Copy</div>
                  <div className={`pwa-share-row is-highlight${step === 1 ? ' is-glowing' : ''}`}>
                    <AddHomeIcon />
                    Add to Home Screen
                  </div>
                  <div className="pwa-share-row">Find on Page</div>
                </div>
              </div>
            )}
          </div>

          <div className={`pwa-homescreen${showHome ? ' is-active' : ''}`}>
            <div className="pwa-home-status">
              <span>9:41</span>
              <span>5G</span>
            </div>
            <div className="pwa-home-grid">
              <span />
              <span />
              <span />
              <span />
              <span />
              <div className="pwa-home-app">
                <span className="pwa-home-icon-wrap">
                  <img
                    src="/apple-touch-icon.png?v=3"
                    alt=""
                    className="pwa-home-icon"
                  />
                  <span className="pwa-home-check">
                    <Check size={12} strokeWidth={3} />
                  </span>
                </span>
                <em>PhillyGrind</em>
              </div>
              <span />
              <span />
            </div>
            <div className="pwa-home-dock">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PwaInstallGuide({
  overlay = false,
  forceContext,
  onContinue,
  onDismiss,
  continueLabel = 'Continue',
}) {
  const titleId = useId();
  const [demoStep, setDemoStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [nativeReady, setNativeReady] = useState(() => hasNativeInstallPrompt());
  const [detected, setDetected] = useState(() => getPwaInstallContext());

  useEffect(() => {
    capturePwaInstallPrompt();
    const sync = () => {
      setNativeReady(hasNativeInstallPrompt());
      setDetected(getPwaInstallContext());
    };
    sync();
    return subscribeToPwaInstall(sync);
  }, []);

  const context = forceContext || detected;
  const alreadyInstalled = context === 'installed' && !forceContext;
  const useIosGuide = !alreadyInstalled && (context === 'ios' || forceContext === 'ios');

  useEffect(() => {
    if (!overlay) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [overlay]);

  useEffect(() => {
    if (!useIosGuide || paused || alreadyInstalled) return undefined;
    const timer = window.setInterval(() => {
      setDemoStep((value) => (value + 1) % IOS_STEPS.length);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [useIosGuide, paused, alreadyInstalled]);

  async function handleNativeInstall() {
    setInstalling(true);
    const result = await promptNativeInstall();
    setInstalling(false);
    if (result.outcome === 'accepted') onContinue?.();
  }

  const body = (
    <div className={`pwa-install${overlay ? ' is-overlay' : ''}`}>
      {overlay && <div className="pwa-install-scrim" />}
      <div
        className="pwa-install-sheet"
        role={overlay ? 'dialog' : undefined}
        aria-modal={overlay ? 'true' : undefined}
        aria-labelledby={titleId}
      >
        {overlay && onDismiss && (
          <button type="button" className="pwa-install-skip" onClick={onDismiss}>
            Skip
          </button>
        )}

        <h2 id={titleId} className="pwa-install-headline">
          {alreadyInstalled ? 'PhillyGrind is on your Home Screen' : 'Get PhillyGrind on your Home Screen'}
        </h2>
        <p className="pwa-install-lede">
          {alreadyInstalled
            ? 'You are already running it like a real app — faster access, alerts, no browser bar.'
            : 'Faster access, neighborhood alerts, and no browser bar — it feels like a real app.'}
        </p>

        {alreadyInstalled ? (
          <div className="pwa-install-done">
            <span className="pwa-install-done-mark">
              <Check size={28} strokeWidth={2.6} />
            </span>
            <img src="/apple-touch-icon.png?v=3" alt="" className="pwa-install-done-icon" />
          </div>
        ) : useIosGuide ? (
          <>
            <SafariMock step={demoStep} />
            <div className="pwa-step-nav-row">
              <button
                type="button"
                className="pwa-step-chevron"
                aria-label="Previous install step"
                onClick={() => {
                  setPaused(true);
                  setDemoStep((value) => (value + IOS_STEPS.length - 1) % IOS_STEPS.length);
                }}
              >
                <ChevronLeft size={22} strokeWidth={2.4} />
              </button>
              <p className="pwa-install-caption" aria-live="polite">
                <span>{demoStep + 1}</span>
                {IOS_STEPS[demoStep].label}
              </p>
              <button
                type="button"
                className="pwa-step-chevron"
                aria-label="Next install step"
                onClick={() => {
                  setPaused(true);
                  setDemoStep((value) => (value + 1) % IOS_STEPS.length);
                }}
              >
                <ChevronRight size={22} strokeWidth={2.4} />
              </button>
            </div>
            <div className="pwa-install-dots" role="tablist" aria-label="Install steps">
              {IOS_STEPS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={index === demoStep}
                  aria-label={item.label}
                  className={`pwa-install-dot${index === demoStep ? ' is-active' : ''}${index < demoStep ? ' is-done' : ''}`}
                  onClick={() => {
                    setPaused(true);
                    setDemoStep(index);
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="pwa-install-native">
            <div className="pwa-install-native-icon">
              <img src="/apple-touch-icon.png?v=3" alt="" />
            </div>
            <ul className="pwa-install-benefits">
              <li>
                <Zap size={16} />
                Faster access
              </li>
              <li>
                <Bell size={16} />
                Neighborhood alerts
              </li>
              <li>
                <Smartphone size={16} />
                No browser bar
              </li>
            </ul>
            <button
              type="button"
              className="pwa-install-cta"
              onClick={handleNativeInstall}
              disabled={installing}
            >
              {installing ? 'Opening install…' : 'Install App'}
            </button>
            {!nativeReady && (
              <p className="pwa-install-fallback">
                Your browser will open its install dialog. If you do not see it yet, look for the install icon in the address bar.
              </p>
            )}
          </div>
        )}

        {onContinue && (
          <div className="pwa-install-actions">
            {onDismiss && !overlay && (
              <button type="button" className="pwa-install-back" onClick={onDismiss}>
                Skip
              </button>
            )}
            <button type="button" className="pwa-install-next" onClick={onContinue}>
              {continueLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (overlay) return createPortal(body, document.body);
  return body;
}

export function PwaInstallPreview() {
  const [searchParams] = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const installParam = searchParams.get('install');
  const preview = installParam === 'preview' || installParam === 'ios' || installParam === 'native';

  if (!preview || dismissed) return null;

  return (
    <PwaInstallGuide
      overlay
      forceContext={installParam === 'native' ? 'native' : 'ios'}
      onContinue={() => setDismissed(true)}
      onDismiss={() => setDismissed(true)}
      continueLabel="Got it"
    />
  );
}

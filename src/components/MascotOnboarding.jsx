import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { MASCOT_STEPS, markMascotOnboardingComplete } from '../lib/mascotOnboardingStorage.js';

export default function MascotOnboarding({ userId, persist = true, onComplete }) {
  const [step, setStep] = useState(0);
  const [failedImages, setFailedImages] = useState({});
  const [loadedImages, setLoadedImages] = useState({});
  const titleId = useId();
  const descId = useId();
  const total = MASCOT_STEPS.length;
  const current = MASCOT_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === total - 1;

  useEffect(() => {
    MASCOT_STEPS.forEach((item) => {
      const preload = new Image();
      preload.src = item.image;
    });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const finish = useCallback(() => {
    if (persist) markMascotOnboardingComplete(userId);
    window.dispatchEvent(new Event('phillygrind:mascot-onboarding-complete'));
    onComplete?.();
  }, [persist, userId, onComplete]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (isLast) finish();
        else setStep((value) => Math.min(total - 1, value + 1));
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStep((value) => Math.max(0, value - 1));
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, isLast, total]);

  function handleImageError(id) {
    setFailedImages((currentFailed) => (
      currentFailed[id] ? currentFailed : { ...currentFailed, [id]: true }
    ));
  }

  function handleImageLoad(id) {
    setLoadedImages((currentLoaded) => (
      currentLoaded[id] ? currentLoaded : { ...currentLoaded, [id]: true }
    ));
  }

  const currentImageReady = Boolean(loadedImages[current.id] && !failedImages[current.id]);

  return createPortal(
    <div
      className="mascot-onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="mascot-onboarding-scrim" />
      <div className="mascot-onboarding-sheet">
        <button type="button" className="mascot-onboarding-skip" onClick={finish}>
          Skip
        </button>

        <p className="mascot-onboarding-counter" aria-live="polite">
          {step + 1} / {total}
        </p>

        <div className="mascot-onboarding-stage" data-step={current.id}>
          <div className="mascot-onboarding-bob">
            <div className="mascot-onboarding-stack">
              <svg
                className={`mascot-onboarding-fallback${currentImageReady ? ' is-hidden' : ''}`}
                viewBox="0 0 200 240"
                aria-hidden="true"
              >
                <ellipse cx="100" cy="226" rx="46" ry="8" fill="rgba(0,0,0,0.28)" />
                <rect x="58" y="112" width="84" height="96" rx="24" />
                <circle cx="100" cy="78" r="50" />
                <ellipse className="mascot-onboarding-fallback-eye" cx="82" cy="76" rx="11" ry="15" />
                <ellipse className="mascot-onboarding-fallback-eye" cx="118" cy="76" rx="11" ry="15" />
              </svg>
              {MASCOT_STEPS.map((item, index) => (
                <img
                  key={item.id}
                  src={item.image}
                  alt=""
                  draggable="false"
                  className={`mascot-onboarding-img${index === step ? ' is-active' : ''}${failedImages[item.id] ? ' is-failed' : ''}`}
                  onError={() => handleImageError(item.id)}
                  onLoad={() => handleImageLoad(item.id)}
                />
              ))}
              <span className="mascot-onboarding-eye-glow" aria-hidden="true" />
            </div>
          </div>
        </div>

        <h2 id={titleId} className="mascot-onboarding-headline">{current.headline}</h2>
        <p id={descId} className="mascot-onboarding-copy">{current.description}</p>

        <div className="mascot-onboarding-dots" role="tablist" aria-label="Onboarding steps">
          {MASCOT_STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === step}
              aria-label={`${item.headline}, step ${index + 1} of ${total}`}
              className={`mascot-onboarding-dot${index === step ? ' is-active' : ''}${index < step ? ' is-done' : ''}`}
              onClick={() => setStep(index)}
            />
          ))}
        </div>

        <div className="mascot-onboarding-actions">
          <button
            type="button"
            className="mascot-onboarding-back"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={isFirst}
          >
            Back
          </button>
          <button
            type="button"
            className="mascot-onboarding-next"
            onClick={() => {
              if (isLast) finish();
              else setStep((value) => Math.min(total - 1, value + 1));
            }}
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

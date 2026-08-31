const NEIGHBORHOOD_STEP_KEY = 'phillygrind-neighborhood-step-v1';
export const NEIGHBORHOOD_STEP_EVENT = 'phillygrind:neighborhood-onboarding-complete';

export function hasFinishedNeighborhoodStep(profile) {
  if (profile?.neighborhood) return true;
  try {
    return window.sessionStorage.getItem(NEIGHBORHOOD_STEP_KEY) === '1';
  } catch {
    return false;
  }
}

export function markNeighborhoodStepComplete() {
  try {
    window.sessionStorage.setItem(NEIGHBORHOOD_STEP_KEY, '1');
  } catch {
    // Private mode or blocked storage — treat as session-only skip.
  }
  window.dispatchEvent(new Event(NEIGHBORHOOD_STEP_EVENT));
}

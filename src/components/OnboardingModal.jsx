import { useState } from 'react';
import { MapPin, X, ArrowRight, Navigation } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { saveHomeNeighborhood } from '../lib/profileApi.js';
import { markNeighborhoodStepComplete } from '../lib/onboardingSequence.js';
import { HOME_NEIGHBORHOODS, snapToHomeNeighborhood } from '../lib/homeNeighborhood.js';

function OnboardingModal({ onComplete }) {
  const [neighborhood, setNeighborhood] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const [suggestedNeighborhood, setSuggestedNeighborhood] = useState(null);
  const { refreshProfile } = useAuth();

  const filteredNeighborhoods = HOME_NEIGHBORHOODS.filter((n) =>
    n.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleUseLocation() {
    setLocating(true);
    setStatus('');

    try {
      if (!navigator.geolocation) {
        setStatus('Location is not supported by your browser.');
        setLocating(false);
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const matchedNeighborhood = snapToHomeNeighborhood({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });

      if (matchedNeighborhood) {
        setSuggestedNeighborhood(matchedNeighborhood);
        setStatus('');
      } else {
        setStatus('Could not match your location to a PhillyGrind neighborhood. Please search manually.');
        setSearchQuery('');
      }
    } catch (error) {
      if (error.code === 1) {
        // Permission denied
        setStatus('Location permission denied. Please search manually.');
      } else {
        setStatus('Could not get your location. Please search manually.');
      }
    } finally {
      setLocating(false);
    }
  }

  function confirmSuggestedNeighborhood() {
    setNeighborhood(suggestedNeighborhood);
    setSuggestedNeighborhood(null);
  }

  function rejectSuggestedNeighborhood() {
    setSuggestedNeighborhood(null);
  }

  async function handleSave() {
    if (!neighborhood) {
      setStatus('Please select a neighborhood.');
      return;
    }

    setSaving(true);
    setStatus('');

    try {
      const data = await saveHomeNeighborhood(neighborhood);
      if (data) await refreshProfile();
      markNeighborhoodStepComplete();
      onComplete?.();
    } catch (error) {
      setStatus(error.message || 'Could not save neighborhood.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    try {
      markNeighborhoodStepComplete();
      onComplete?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-tour-overlay">
      <div className="onboarding-welcome">
        <div className="onboarding-welcome-content">
          <div className="onboarding-spotlight-icon" style={{ margin: '0 auto 24px' }}>
            <MapPin size={32} />
          </div>
          <h1 className="onboarding-welcome-title">What neighborhood are you in?</h1>
          <p className="onboarding-welcome-subtitle" style={{ marginBottom: '24px' }}>
            Select your Philadelphia neighborhood to see nearby posts and opportunities.
          </p>

          <button
            className="onboarding-location-button"
            onClick={handleUseLocation}
            disabled={locating}
            style={{ marginBottom: '16px' }}
          >
            <Navigation size={18} />
            {locating ? 'Finding your location...' : 'Use my location'}
          </button>

          {suggestedNeighborhood && (
            <div className="onboarding-suggestion-card" style={{ marginBottom: '16px' }}>
              <p>Looks like you're in <strong>{suggestedNeighborhood}</strong> — is that right?</p>
              <div className="onboarding-suggestion-actions">
                <button
                  className="onboarding-secondary-button"
                  onClick={rejectSuggestedNeighborhood}
                >
                  No
                </button>
                <button
                  className="onboarding-primary-button"
                  onClick={confirmSuggestedNeighborhood}
                >
                  Yes, that's right
                </button>
              </div>
            </div>
          )}

          <div className="onboarding-neighborhood-search">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search neighborhoods..."
              className="onboarding-neighborhood-input"
            />
          </div>

          <div className="onboarding-neighborhood-list">
            {filteredNeighborhoods.length === 0 ? (
              <p className="onboarding-no-results">No neighborhoods found</p>
            ) : (
              filteredNeighborhoods.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`onboarding-neighborhood-option ${neighborhood === n ? 'selected' : ''}`}
                  onClick={() => setNeighborhood(n)}
                >
                  {n}
                </button>
              ))
            )}
          </div>

          {status && <p className="onboarding-status error-text">{status}</p>}

          <button
            className="onboarding-primary-button"
            onClick={handleSave}
            disabled={saving || !neighborhood}
            style={{ marginTop: '24px' }}
          >
            {saving ? 'Saving...' : 'Continue'} <ArrowRight size={18} />
          </button>

          <button
            className="onboarding-skip-link"
            onClick={handleSkip}
            disabled={saving}
          >
            Skip for now
          </button>
        </div>
      </div>

      <button className="onboarding-close-button" onClick={handleSkip} disabled={saving}>
        <X size={20} />
      </button>
    </div>
  );
}

export default OnboardingModal;

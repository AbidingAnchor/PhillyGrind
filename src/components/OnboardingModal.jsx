import { useState } from 'react';
import { MapPin, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { HOUSING_NEIGHBORHOODS } from '../lib/housingApi.js';
import { supabase } from '../lib/supabase.js';

function OnboardingModal() {
  const [neighborhood, setNeighborhood] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const { profile, completeOnboarding, refreshProfile } = useAuth();

  const filteredNeighborhoods = HOUSING_NEIGHBORHOODS.filter((n) =>
    n.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleSave() {
    if (!neighborhood) {
      setStatus('Please select a neighborhood.');
      return;
    }

    setSaving(true);
    setStatus('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ neighborhood, onboarding_complete: true })
        .eq('id', profile?.id);

      if (error) throw error;

      await completeOnboarding();
      await refreshProfile();
    } catch (error) {
      setStatus(error.message || 'Could not save neighborhood.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    try {
      await completeOnboarding();
    } catch (error) {
      setStatus(error.message || 'Could not skip onboarding.');
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

import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
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
    <div className="chat-backdrop onboarding-backdrop" role="presentation">
      <section className="onboarding-modal neighborhood-modal" role="dialog" aria-modal="true" aria-label="Select your neighborhood">
        <button className="onboarding-skip" type="button" onClick={handleSkip} disabled={saving} aria-label="Skip neighborhood selection">
          <X size={18} />
          Skip for now
        </button>
        <div className="onboarding-icon">
          <MapPin size={32} />
        </div>
        <span className="eyebrow">Welcome to PhillyGrind</span>
        <h2>What neighborhood are you in?</h2>
        <p>Select your Philadelphia neighborhood to see nearby posts and opportunities.</p>

        <div className="neighborhood-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search neighborhoods..."
            className="neighborhood-search-input"
          />
        </div>

        <div className="neighborhood-list">
          {filteredNeighborhoods.length === 0 ? (
            <p className="no-results">No neighborhoods found</p>
          ) : (
            filteredNeighborhoods.map((n) => (
              <button
                key={n}
                type="button"
                className={`neighborhood-option ${neighborhood === n ? 'selected' : ''}`}
                onClick={() => setNeighborhood(n)}
              >
                {n}
              </button>
            ))
          )}
        </div>

        {status && <p className="form-status error-text">{status}</p>}

        <div className="onboarding-actions">
          <button className="primary-button" type="button" onClick={handleSave} disabled={saving || !neighborhood}>
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default OnboardingModal;

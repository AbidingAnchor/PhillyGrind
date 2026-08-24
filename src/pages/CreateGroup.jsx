import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users } from 'lucide-react';
import { COMMUNITY_NEIGHBORHOODS } from '../lib/communityApi.js';
import { createGroup, GROUP_CATEGORIES } from '../lib/groupsApi.js';

function CreateGroup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(GROUP_CATEGORIES[0]);
  const [neighborhood, setNeighborhood] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Group name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const group = await createGroup({
        name: trimmedName,
        description,
        category,
        neighborhood: neighborhood || null,
      });
      navigate(`/groups/${group.id}`);
    } catch (err) {
      console.error('[CreateGroup] submit failed', err);
      setError(err.message || 'Could not create group.');
    } finally {
      setSubmitting(false);
    }
  }

  const previewName = name.trim() || 'Your group name';
  const previewDescription = description.trim() || 'Tell neighbors what this group is about.';
  const previewPlace = neighborhood || 'Philadelphia';
  const previewInitial = (name.trim() || 'G').charAt(0).toUpperCase();

  return (
    <section className="form-page group-create-page">
      <header className="group-create-hero">
        <span className="group-create-kicker">Groups</span>
        <h1>
          Create a <span>Group</span>
        </h1>
        <p>A public space for neighbors with the same hobby, block, or hustle.</p>
      </header>

      <div className="group-create-layout">
        <form className="listing-form group-create-form" onSubmit={handleSubmit}>
          <label className="full-span">
            Group name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Fishtown Run Club"
              required
              maxLength={120}
            />
          </label>

          <label className="full-span">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this group about?"
              rows={4}
            />
          </label>

          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {GROUP_CATEGORIES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            Neighborhood (optional)
            <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}>
              <option value="">None</option>
              {COMMUNITY_NEIGHBORHOODS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          {error && <p className="form-status error-text full-span">{error}</p>}

          <button type="submit" className="filter active group-create-submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Group'}
          </button>
        </form>

        <aside className="group-create-postcard" aria-live="polite">
          <div className="group-create-postcard-cover" aria-hidden="true">
            <span>{previewPlace}</span>
          </div>
          <div className="group-create-postcard-avatar" aria-hidden="true">
            {previewInitial}
          </div>
          <div className="group-create-postcard-body">
            <span className="group-create-category">{category}</span>
            <h3>{previewName}</h3>
            <p>{previewDescription}</p>
            <div className="listing-meta">
              <span>
                <MapPin size={16} />
                {previewPlace}
              </span>
              <span>
                <Users size={16} />
                Public · 0 members
              </span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default CreateGroup;

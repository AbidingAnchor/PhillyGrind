import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  return (
    <section className="form-page group-create-page">
      <div className="page-heading">
        <span className="eyebrow">Groups</span>
        <h1>Create a Group</h1>
        <p>Start a public group for neighbors with shared interests.</p>
      </div>

      <form className="listing-form group-create-form" onSubmit={handleSubmit}>
        <label>
          Group name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Fishtown Run Club"
            required
            maxLength={120}
          />
        </label>

        <label>
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

        {error && <p className="form-status error-text">{error}</p>}

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Group'}
        </button>
      </form>
    </section>
  );
}

export default CreateGroup;

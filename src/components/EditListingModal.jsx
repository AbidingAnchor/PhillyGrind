import { useState } from 'react';
import { X } from 'lucide-react';
import { updateListing } from '../lib/listingsApi.js';

function EditListingModal({ categories, listing, type, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: listing.title || '',
    category: listing.category || '',
    neighborhood: listing.neighborhood || '',
    pay: listing.pay || '',
    company: listing.company || '',
    contact: listing.contact || '',
    description: listing.description || '',
    apply_url: listing.apply_url || '',
  });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      const updated = await updateListing(type, listing.id, form);
      onSaved(updated);
      onClose();
    } catch (error) {
      setStatus(error.message || `Could not update this ${type}.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="chat-backdrop" role="presentation">
      <section className="edit-modal" role="dialog" aria-modal="true" aria-label={`Edit ${listing.title}`}>
        <header className="chat-header">
          <div>
            <span className="eyebrow">Owner tools</span>
            <h2>Edit {type === 'gig' ? 'Gig' : 'Job'}</h2>
            <p>{listing.title}</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close edit form">
            <X size={20} />
          </button>
        </header>

        <form className="listing-form edit-listing-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input name="title" value={form.title} onChange={updateField} required />
          </label>
          <label>
            Category
            <select name="category" value={form.category} onChange={updateField} required>
              <option value="">Choose a category</option>
              {categories.filter((category) => category !== 'All').map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Neighborhood
            <input name="neighborhood" value={form.neighborhood} onChange={updateField} required />
          </label>
          <label>
            Pay
            <input name="pay" value={form.pay} onChange={updateField} required />
          </label>
          <label>
            {type === 'gig' ? 'Posted by' : 'Company'}
            <input name="company" value={form.company} onChange={updateField} required />
          </label>
          {type === 'job' && (
            <label>
              Application Link (optional)
              <input name="apply_url" type="url" value={form.apply_url} onChange={updateField} placeholder="https://company.com/apply" />
            </label>
          )}
          <label className="full-span">
            Description
            <textarea name="description" value={form.description} onChange={updateField} rows="6" required />
          </label>
          <button className="primary-button full-span" type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          {status && <p className="form-status error-text full-span">{status}</p>}
        </form>
      </section>
    </div>
  );
}

export default EditListingModal;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBoostCheckout } from '../lib/boostsApi.js';
import { createListing } from '../lib/listingsApi.js';
import { hasSupabaseConfig } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

const initialState = {
  title: '',
  category: '',
  neighborhood: '',
  pay: '',
  company: '',
  contact: '',
  description: '',
  apply_url: '',
};

function ListingForm({ type, categories, postType, labels = {} }) {
  const [form, setForm] = useState(initialState);
  const [boostTier, setBoostTier] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { isLoggedIn, profile, user } = useAuth();
  const navigate = useNavigate();
  const noun = type === 'gig' ? 'gig' : 'job';

  useEffect(() => {
    if (!isLoggedIn) return;

    setForm((current) => ({
      ...current,
      company: current.company || (type === 'gig' ? profile?.name || '' : current.company),
      contact: current.contact || user?.email || '',
    }));
  }, [isLoggedIn, profile?.name, type, user?.email]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      if (!isLoggedIn) {
        throw new Error('Please log in before posting.');
      }

      const payload = type === 'gig' && postType ? { ...form, post_type: postType } : form;
      const created = await createListing(type, payload, { boostTier });
      setStatus(hasSupabaseConfig
        ? (boostTier ? `Saving ${noun} and opening boost checkout...` : `${noun} posted.`)
        : `Demo ${noun} created locally. Add Supabase keys to persist listings.`);

      if (boostTier && hasSupabaseConfig) {
        const { url } = await createBoostCheckout({
          listingId: created.id,
          listingType: type,
          tier: boostTier,
        });
        window.location.href = url;
        return;
      }

      setForm(initialState);
      setBoostTier('');
      setTimeout(() => navigate(type === 'gig' ? `/gigs/${created.id}` : `/jobs/${created.id}`), 500);
    } catch (error) {
      setStatus(error.message || `Could not post ${noun}.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <label>
        {labels.title || 'Title'}
        <input name="title" value={form.title} onChange={updateField} placeholder={labels.titlePlaceholder || (type === 'gig' ? 'Furniture assembly' : 'Prep Cook')} required />
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
        <input name="neighborhood" value={form.neighborhood} onChange={updateField} placeholder="South Philly" required />
      </label>
      <label>
        {labels.pay || 'Pay'}
        <input name="pay" value={form.pay} onChange={updateField} placeholder={labels.payPlaceholder || '$22/hr or $150 flat'} required />
      </label>
      <label>
        {type === 'gig' ? 'Posted by' : 'Company'}
        <input name="company" value={form.company} onChange={updateField} placeholder={type === 'gig' ? 'Your name' : 'Business name'} required />
      </label>
      {type === 'job' && (
        <label>
          Application Link (optional)
          <input name="apply_url" type="url" value={form.apply_url} onChange={updateField} placeholder="https://company.com/apply" />
        </label>
      )}
      <label className="full-span">
        {labels.description || 'Description'}
        <textarea name="description" value={form.description} onChange={updateField} rows="6" placeholder={labels.descriptionPlaceholder || 'Add schedule, requirements, timing, and anything applicants should know.'} required />
      </label>
      <fieldset className="boost-options full-span">
        <legend>Boost this listing</legend>
        <label className={boostTier === 'basic' ? 'boost-option active' : 'boost-option'}>
          <input type="radio" name="boostTier" value="basic" checked={boostTier === 'basic'} onChange={(event) => setBoostTier(event.target.value)} />
          <span>
            <strong>Basic Boost — $19.99/month</strong>
            Top of listings + ⭐ Featured badge
          </span>
        </label>
        <label className={boostTier === 'pro' ? 'boost-option active' : 'boost-option'}>
          <input type="radio" name="boostTier" value="pro" checked={boostTier === 'pro'} onChange={(event) => setBoostTier(event.target.value)} />
          <span>
            <strong>Pro Boost — $39.99/month</strong>
            Top of listings + ⭐ Featured badge + gold highlighted card + homepage Featured Workers
          </span>
        </label>
        <button className="boost-clear" type="button" onClick={() => setBoostTier('')} disabled={!boostTier}>
          No boost
        </button>
      </fieldset>
      <button className="primary-button full-span" type="submit" disabled={submitting}>
        {submitting ? 'Posting...' : boostTier ? `Post ${type === 'gig' ? 'Gig' : 'Job'} & Boost` : `Post ${type === 'gig' ? 'Gig' : 'Job'}`}
      </button>
      {status && <p className="form-status full-span">{status}</p>}
    </form>
  );
}

export default ListingForm;

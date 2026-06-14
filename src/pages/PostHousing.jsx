import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, X } from 'lucide-react';
import { createHousingListing, HOUSING_NEIGHBORHOODS } from '../lib/housingApi.js';
import { hasSupabaseConfig } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

const initialState = {
  title: '',
  description: '',
  monthly_rent: '',
  bedrooms: '',
  bathrooms: '',
  address: '',
  neighborhood: '',
  available_date: '',
  pets_allowed: false,
  utilities_included: false,
};

function PostHousing() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [form, setForm] = useState(initialState);
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function handlePhotoChange(event) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;

    const nextPhotos = [...photos, ...files].slice(0, 5);
    setPhotos(nextPhotos);
    setPreviews(nextPhotos.map((file) => URL.createObjectURL(file)));
    event.target.value = '';
  }

  function removePhoto(index) {
    setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setPreviews((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      if (!isLoggedIn) {
        throw new Error('Please log in before posting a rental.');
      }

      if (!form.title.trim() || !form.description.trim() || !form.address.trim() || !form.neighborhood) {
        throw new Error('Please fill out all required fields.');
      }

      await createHousingListing(form, photos);
      setStatus('Rental posted successfully.');
      setTimeout(() => navigate('/housing'), 400);
    } catch (error) {
      setStatus(error.message || 'Could not post rental.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="form-page">
      <div className="page-heading">
        <span className="eyebrow">Housing</span>
        <h1>Post a Rental</h1>
        <p>List your apartment or home for Philly renters.</p>
      </div>

      <form className="listing-form housing-post-form" onSubmit={handleSubmit}>
        <label>
          Title
          <input name="title" value={form.title} onChange={updateField} placeholder="Bright 2BR in Fishtown" required />
        </label>
        <label>
          Monthly Rent ($)
          <input name="monthly_rent" type="number" min="0" step="1" value={form.monthly_rent} onChange={updateField} placeholder="1500" required />
        </label>
        <label>
          Bedrooms
          <input name="bedrooms" type="number" min="0" step="1" value={form.bedrooms} onChange={updateField} placeholder="2" required />
        </label>
        <label>
          Bathrooms
          <input name="bathrooms" type="number" min="0" step="0.5" value={form.bathrooms} onChange={updateField} placeholder="1" required />
        </label>
        <label>
          Address
          <input name="address" value={form.address} onChange={updateField} placeholder="1234 E Girard Ave" required />
        </label>
        <label>
          Neighborhood
          <select name="neighborhood" value={form.neighborhood} onChange={updateField} required>
            <option value="">Choose a neighborhood</option>
            {HOUSING_NEIGHBORHOODS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Available Date
          <input name="available_date" type="date" value={form.available_date} onChange={updateField} required />
        </label>
        <label className="housing-toggle-field">
          <span>Pets allowed</span>
          <input name="pets_allowed" type="checkbox" checked={form.pets_allowed} onChange={updateField} />
        </label>
        <label className="housing-toggle-field">
          <span>Utilities included</span>
          <input name="utilities_included" type="checkbox" checked={form.utilities_included} onChange={updateField} />
        </label>
        <label className="full-span">
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={updateField}
            rows={6}
            placeholder="Describe the unit, lease terms, amenities, and anything renters should know."
            required
          />
        </label>

        <div className="full-span housing-photo-upload">
          <span className="housing-photo-label">Photos (up to 5)</span>
          <div className="housing-photo-grid">
            {previews.map((preview, index) => (
              <div className="housing-photo-preview" key={preview}>
                <img src={preview} alt={`Upload preview ${index + 1}`} />
                <button type="button" className="housing-photo-remove" onClick={() => removePhoto(index)} aria-label="Remove photo">
                  <X size={16} />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <label className="housing-photo-add">
                <ImagePlus size={24} />
                <span>Add photo</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
              </label>
            )}
          </div>
        </div>

        {status && <p className={`form-status full-span${status.includes('success') ? '' : ' error-text'}`}>{status}</p>}
        <button className="primary-button full-span" type="submit" disabled={submitting || !hasSupabaseConfig}>
          {submitting ? 'Posting...' : 'Post Rental'}
        </button>
      </form>
    </section>
  );
}

export default PostHousing;

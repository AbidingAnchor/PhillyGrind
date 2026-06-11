import { useState } from 'react';

import { ImagePlus, X } from 'lucide-react';

import { marketplaceCategories } from '../data/listings.js';

import { createMarketplaceListing } from '../lib/marketplaceApi.js';

import { hasSupabaseConfig } from '../lib/supabase.js';

import { useAuth } from '../lib/auth.jsx';



const paymentMethods = [
  {
    value: 'both',
    title: 'Cash or Secure Checkout',
    subtitle: 'Buyer can choose either option',
  },
  {
    value: 'escrow',
    title: 'Secure Checkout',
    subtitle: "Funds held until buyer confirms receipt - you're protected",
    recommended: true,
  },
  {
    value: 'cash',
    title: 'Cash Only',
    subtitle: 'Meet in person to exchange',
  },
];



function MarketplacePostForm({ onClose, onPosted }) {

  const { isLoggedIn } = useAuth();

  const [form, setForm] = useState({

    title: '',

    description: '',

    price: '',

    category: '',

    neighborhood: '',

    condition: 'New',

    payment_type: 'escrow',

  });

  const [photos, setPhotos] = useState([]);

  const [previews, setPreviews] = useState([]);

  const [status, setStatus] = useState('');

  const [submitting, setSubmitting] = useState(false);



  function updateField(event) {

    const { name, value, type, checked } = event.target;

    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));

  }



  function selectPaymentType(paymentType) {

    setForm((current) => ({ ...current, payment_type: paymentType }));

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

        throw new Error('Please log in before posting a listing.');

      }



      if (!photos.length) {

        throw new Error('At least one photo is required.');

      }



      if (!(form.price || '').trim()) {

        throw new Error('Enter a price.');

      }



      const created = await createMarketplaceListing({
        ...form,
        location: (form.neighborhood || '').trim(),
        title: (form.title || '').trim(),
        description: (form.description || '').trim(),
        price: parseFloat(form.price.replace(/[^0-9.]/g, '')) || 0,
        condition: form.condition || 'New',
        payment_type: form.payment_type || 'escrow',
      }, photos);

      setStatus(hasSupabaseConfig

        ? 'Listing posted to the marketplace.'

        : 'Demo listing created locally. Add Supabase keys to persist listings.');

      onPosted?.(created);

      setTimeout(() => onClose?.(), 700);

    } catch (error) {

      setStatus(error.message || 'Could not post listing.');

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <form className="listing-form marketplace-post-form" onSubmit={handleSubmit}>

      <label>

        Title

        <input name="title" value={form.title} onChange={updateField} placeholder="What are you selling?" required />

      </label>

      <label>

        Description

        <textarea name="description" value={form.description} onChange={updateField} rows={4} placeholder="Describe the item, condition, and pickup details." required />

      </label>

      <div className="marketplace-price-row">

        <label>

          Price

          <input

            name="price"

            value={form.price}

            onChange={updateField}

            placeholder="$50"

            required

          />

        </label>

      </div>

      <label>

        Category

        <select name="category" value={form.category} onChange={updateField} required>

          <option value="">Choose a category</option>

          {marketplaceCategories.filter((category) => category !== 'All').map((category) => (

            <option key={category} value={category}>{category}</option>

          ))}

        </select>

      </label>

      <label>

        Neighborhood / location

        <input name="neighborhood" value={form.neighborhood} onChange={updateField} placeholder="South Philly, Fishtown..." required />

      </label>

      <label>

        Condition

        <select name="condition" value={form.condition} onChange={updateField} required>

          {['New', 'Like New', 'Good', 'Fair', 'Poor'].map((condition) => (

            <option key={condition} value={condition}>{condition}</option>

          ))}

        </select>

      </label>

      <div className="marketplace-photo-upload">

        <span className="field-label">Photos (at least 1 required)</span>

        <div className="marketplace-photo-grid">

          {previews.map((preview, index) => (

            <div className="marketplace-photo-preview" key={preview}>

              <img
                src={preview}
                alt={`Upload preview ${index + 1}`}
                style={{
                  maxHeight: '120px',
                  maxWidth: '120px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                }}
              />

              <button type="button" className="marketplace-photo-remove" onClick={() => removePhoto(index)} aria-label="Remove photo">

                <X size={14} />

              </button>

            </div>

          ))}

          {previews.length < 5 && (

            <label className="marketplace-photo-add">

              <ImagePlus size={24} />

              <span>Add photo</span>

              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoChange} />

            </label>

          )}

        </div>

      </div>

      <div className="marketplace-payment-selector">

        <span className="field-label">Payment Method</span>

        <div
          className="marketplace-payment-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '12px',
          }}
        >

          {paymentMethods.map((method) => {

            const selected = form.payment_type === method.value;

            return (

              <button
                key={method.value}
                type="button"
                className={`marketplace-payment-card ${selected ? 'selected' : ''}`}
                onClick={() => selectPaymentType(method.value)}
                aria-pressed={selected}
                style={{
                  alignItems: 'flex-start',
                  background: selected ? '#f0fdf4' : '#ffffff',
                  border: `2px solid ${selected ? '#22c55e' : '#d1d5db'}`,
                  borderRadius: '10px',
                  color: '#1a2332',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minHeight: '132px',
                  opacity: 1,
                  padding: '14px',
                  textAlign: 'left',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
              >

                {method.recommended && (

                  <span
                    style={{
                      alignSelf: 'flex-start',
                      background: '#22c55e',
                      borderRadius: '9999px',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                    }}
                  >
                    Recommended
                  </span>

                )}

                <strong>{method.title}</strong>

                <small>{method.subtitle}</small>

              </button>

            );

          })}

        </div>

      </div>
      {status && <p className="form-status">{status}</p>}

      <div className="marketplace-form-actions">

        <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>Cancel</button>

        <button className="primary-button" type="submit" disabled={submitting}>

          {submitting ? 'Posting...' : 'Post Listing'}

        </button>

      </div>

    </form>

  );

}



export default MarketplacePostForm;


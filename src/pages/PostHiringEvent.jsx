import { useRef, useState } from 'react';
import { formatEventDateTime, parsePositionsInput } from '../data/hiringEvents.js';

const initialForm = {
  companyName: '',
  contactEmail: '',
  eventTitle: '',
  dateTime: '',
  location: '',
  positionsAvailable: '',
  description: '',
};

function PostHiringEvent() {
  const logoInputRef = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const payload = {
      ...form,
      positions: parsePositionsInput(form.positionsAvailable),
      dateTimeFormatted: formatEventDateTime(form.dateTime),
      logoFileName: logoFile?.name || null,
    };

    console.info('[Hiring Event Submission]', payload);
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <section className="form-page hiring-event-form-page">
        <div className="page-heading">
          <span className="eyebrow">Thank you</span>
          <h1>Event submitted</h1>
        </div>
        <div className="hiring-event-confirmation">
          <p>Your event has been submitted! We&apos;ll review and post it within 24 hours.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="form-page hiring-event-form-page">
      <div className="page-heading">
        <span className="eyebrow">Businesses</span>
        <h1>Post a Hiring Event</h1>
        <p>Share your open house, job fair, or on-the-spot interview day with Philly job seekers.</p>
      </div>

      <form className="listing-form hiring-event-form" onSubmit={handleSubmit}>
        <label>
          Company name
          <input
            name="companyName"
            value={form.companyName}
            onChange={updateField}
            required
            placeholder="Kitchen + Kocktails Philly"
          />
        </label>

        <label>
          Contact email
          <input
            type="email"
            name="contactEmail"
            value={form.contactEmail}
            onChange={updateField}
            required
            placeholder="hiring@yourcompany.com"
          />
        </label>

        <label>
          Event title
          <input
            name="eventTitle"
            value={form.eventTitle}
            onChange={updateField}
            required
            placeholder="Open Interviews"
          />
        </label>

        <label>
          Date &amp; time
          <input
            type="datetime-local"
            name="dateTime"
            value={form.dateTime}
            onChange={updateField}
            required
          />
        </label>

        <label>
          Location
          <input
            name="location"
            value={form.location}
            onChange={updateField}
            required
            placeholder="1234 Market St, Philadelphia, PA"
          />
        </label>

        <label className="full-span">
          Positions available
          <textarea
            name="positionsAvailable"
            value={form.positionsAvailable}
            onChange={updateField}
            required
            rows={3}
            placeholder="Managers, Servers, Bartenders, Line Cooks"
          />
        </label>

        <label className="full-span">
          Event description
          <textarea
            name="description"
            value={form.description}
            onChange={updateField}
            required
            rows={5}
            placeholder="Tell candidates what to expect, what to bring, and who you're looking to hire."
          />
        </label>

        <div className="full-span hiring-event-logo-field">
          <span>Company logo upload</span>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleLogoChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="secondary-button hiring-event-logo-btn"
            onClick={() => logoInputRef.current?.click()}
          >
            {logoFile ? 'Change logo' : 'Upload logo'}
          </button>
          {logoPreview && (
            <div className="hiring-event-logo-preview">
              <img src={logoPreview} alt="Company logo preview" />
            </div>
          )}
        </div>

        <button className="primary-button full-span" type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Event'}
        </button>
      </form>
    </section>
  );
}

export default PostHiringEvent;

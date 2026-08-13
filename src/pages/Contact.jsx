import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendContactSubmission } from '../lib/contactApi.js';

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'general',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await sendContactSubmission(formData);
      setSubmitted(true);
      setFormData({ name: '', email: '', category: 'general', message: '' });
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (submitted) {
    return (
      <section className="contact-page">
        <div className="page-heading">
          <span className="eyebrow">Contact</span>
          <h1>Message Sent</h1>
        </div>
        <div className="contact-success">
          <h2>Thank you for reaching out!</h2>
          <p>We've received your message and will get back to you soon.</p>
          <Link to="/" className="primary-button">Return to Home</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="contact-page">
      <div className="page-heading">
        <span className="eyebrow">Contact</span>
        <h1>Contact Us</h1>
        <p>Have a question, concern, or feedback? We'd love to hear from you.</p>
      </div>

      <div className="contact-card">
        <form onSubmit={handleSubmit} className="contact-form">
          {error && <div className="error-message">{error}</div>}

          <label>
            Name
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Your name"
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </label>

          <label>
            Category
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="general">General Inquiry</option>
              <option value="data_deletion">Data Deletion Request</option>
              <option value="fair_housing_complaint">Fair Housing Complaint</option>
              <option value="dispute_report">Dispute Report</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            Message
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={6}
              placeholder="How can we help you?"
            />
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Contact;

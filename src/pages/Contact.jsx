import { useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { Send } from 'lucide-react';
import GrindBotAvatar from '../components/GrindBotAvatar.jsx';
import { useAuth } from '../lib/auth.jsx';
import { sendContactSubmission } from '../lib/contactApi.js';
import { PERSONAS } from '../lib/grindbotPersonas.js';

const categoryOptions = [
  { label: 'General Inquiry', value: 'general' },
  { label: 'Data Deletion Request', value: 'data_deletion' },
  { label: 'Fair Housing Complaint', value: 'fair_housing_complaint' },
  { label: 'Dispute Report', value: 'dispute_report' },
  { label: 'Other', value: 'other' },
];

function Contact() {
  const { user, profile } = useAuth();
  const { openChat } = useOutletContext() || {};
  const [showTicket, setShowTicket] = useState(false);
  const [ticketData, setTicketData] = useState({ category: 'general', description: '' });
  const [status, setStatus] = useState('');

  if (!user) {
    return <Navigate to="/login" state={{ from: '/contact' }} replace />;
  }

  async function submitTicket(event) {
    event.preventDefault();
    const description = ticketData.description.trim();
    if (!description) return;

    setStatus('Sending...');

    try {
      await sendContactSubmission({
        name: profile?.name || user?.name || 'User',
        email: user?.email || '',
        category: ticketData.category,
        message: description,
        user_id: user.id,
      });

      setStatus('Ticket sent. Our team will email you back.');
      setTicketData({ category: 'general', description: '' });
      setShowTicket(false);
    } catch (error) {
      setStatus(error.message || 'Could not submit your ticket. Please try again.');
    }
  }

  return (
    <section className="contact-page">
      <div className="page-heading">
        <span className="eyebrow">Contact</span>
        <h1>Need help?</h1>
        <p>Pick a specialist to chat, or submit a support ticket.</p>
      </div>

      <div className="contact-persona-grid">
        {Object.values(PERSONAS).map((persona) => (
          <button
            key={persona.id}
            type="button"
            className={`contact-persona-card contact-persona-card--${persona.id}`}
            onClick={() => openChat?.(persona.id)}
            style={{ borderColor: persona.color }}
          >
            <span className="contact-persona-avatar">
              <GrindBotAvatar persona={persona.id} size={48} />
            </span>
            <h2 style={{ color: persona.color }}>{persona.name}</h2>
            <p>{persona.description}</p>
          </button>
        ))}
      </div>

      <div className="contact-ticket-section">
        {showTicket && (
          <form className="contact-ticket-form" onSubmit={submitTicket}>
            <label className="contact-ticket-field">
              Category
              <select
                value={ticketData.category}
                onChange={(e) => setTicketData((current) => ({ ...current, category: e.target.value }))}
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="contact-ticket-field">
              What's going on?
              <textarea
                value={ticketData.description}
                onChange={(e) => setTicketData((current) => ({ ...current, description: e.target.value }))}
                placeholder="Describe your issue..."
                rows={4}
                required
              />
            </label>
            <button type="submit" className="primary-button contact-ticket-submit">
              <Send size={18} /> Submit ticket
            </button>
          </form>
        )}

        <button
          type="button"
          className="contact-ticket-toggle"
          onClick={() => setShowTicket((v) => !v)}
        >
          {showTicket ? 'Cancel ticket' : 'Need human support? Submit a ticket'}
        </button>

        {status && <p className="contact-status">{status}</p>}
      </div>
    </section>
  );
}

export default Contact;

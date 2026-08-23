import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Send, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../lib/auth.jsx';
import { sendContactSubmission } from '../lib/contactApi.js';

const welcomeMessage = {
  role: 'assistant',
  content: "Hey! I'm GrindBot. How can I help you today? Ask me anything about PhillyGrind, or let me know if you need to submit a support ticket.",
};

const categoryOptions = [
  { label: 'General Inquiry', value: 'general' },
  { label: 'Data Deletion Request', value: 'data_deletion' },
  { label: 'Fair Housing Complaint', value: 'fair_housing_complaint' },
  { label: 'Dispute Report', value: 'dispute_report' },
  { label: 'Other', value: 'other' },
];

function userAskedForHumanSupport(text) {
  const value = String(text || '').toLowerCase();
  const phrases = [
    'submit a ticket',
    'support ticket',
    'file a ticket',
    'open a ticket',
    'start a ticket',
    'talk to a human',
    'speak to a human',
    'real person',
    'actual person',
    'human support',
    'speak to someone',
    'talk to someone',
    'contact support',
    'get a human',
    'file a complaint',
    'i want a ticket',
    'talk to support',
    'speak to support',
  ];
  return phrases.some((phrase) => value.includes(phrase));
}

function Contact() {
  const { user, profile, session } = useAuth();
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [ticketFlow, setTicketFlow] = useState(false);
  const [ticketStep, setTicketStep] = useState('idle');
  const [ticketData, setTicketData] = useState({ category: 'general', description: '' });
  const threadRef = useRef(null);

  // Redirect if not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: '/contact' }} replace />;
  }

  function scrollThread() {
    window.setTimeout(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }

  function addAssistantMessage(content, extra = {}) {
    setMessages((current) => [...current, { role: 'assistant', content, ...extra }]);
    scrollThread();
  }

  function addUserMessage(content) {
    setMessages((current) => [...current, { role: 'user', content }]);
    scrollThread();
  }

  function startTicketFlow() {
    setTicketFlow(true);
    setTicketStep('category');
    setTicketData({ category: 'general', description: '' });
    addAssistantMessage("Got it. Let's get some details for your support ticket. What category best describes your issue?", {
      kind: 'choices',
      choices: categoryOptions,
    });
  }

  function chooseCategory(option) {
    addUserMessage(option.label);
    setTicketData((current) => ({ ...current, category: option.value }));
    setTicketStep('description');
    addAssistantMessage("Got it. Please describe your issue in detail so our team can help you effectively.", {
      kind: 'description',
    });
  }

  async function submitTicketDescription(event) {
    event.preventDefault();
    const description = ticketData.description.trim();
    if (!description) return;

    addUserMessage(description);
    setTicketData((current) => ({ ...current, description }));
    setTicketStep('submitting');
    addAssistantMessage('Submitting your ticket...');

    try {
      await sendContactSubmission({
        name: profile?.name || user?.name || 'User',
        email: user?.email || '',
        category: ticketData.category,
        message: description,
        user_id: user.id,
      });

      addAssistantMessage("Your support ticket has been submitted successfully! Our team will review it and get back to you via email. Is there anything else I can help you with?");
      setTicketFlow(false);
      setTicketStep('idle');
      setTicketData({ category: 'general', description: '' });
    } catch (error) {
      addAssistantMessage(error.message || 'Failed to submit your ticket. Please try again.');
      setTicketStep('description');
    }
  }

  async function handleSubmit(event) {
    console.log('[DEBUG] Contact handleSubmit CALLED');
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    // Guard against session not being ready yet
    if (!session?.access_token) {
      console.log('[DEBUG] Session not ready, returning early');
      setStatus('Not logged in. Please refresh and try again.');
      return;
    }

    console.log('[DEBUG] messages state at submit:', messages);
    console.log('[DEBUG] input value:', trimmed);

    const newUserMessage = { role: 'user', content: trimmed };
    const nextMessages = [...messages, newUserMessage];
    const payloadMessages = nextMessages.filter((message) => message.role !== 'system');
    
    console.log('[DEBUG] payloadMessages:', payloadMessages);

    addUserMessage(trimmed);
    setInput('');
    setStatus('');
    setSending(true);
    scrollThread();

    try {
      const response = await fetch('/api/grindbotai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: payloadMessages,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'GrindBot could not answer right now.');
      }

      addAssistantMessage(payload.reply);

      // Only auto-offer a ticket on explicit human-help intent — not every "problem"/"issue".
      // The Contact header button still starts a ticket anytime.
      if (userAskedForHumanSupport(trimmed) && !ticketFlow) {
        addAssistantMessage("Want me to get this in front of a real person? I can start a support ticket.", {
          kind: 'ticket_offer',
        });
      }
    } catch (error) {
      addAssistantMessage(error.message || 'GrindBot is taking five. Try again in a minute.');
    } finally {
      setSending(false);
    }
  }

  function handleTicketOfferResponse(accepted) {
    if (accepted) {
      addUserMessage('Yes, please help me submit a ticket');
      startTicketFlow();
    } else {
      addUserMessage('No thanks');
      addAssistantMessage("No problem! Feel free to ask me anything else about PhillyGrind.");
    }
  }

  return (
    <section className="contact-page">
      <div className="page-heading">
        <span className="eyebrow">Contact</span>
        <h1>Chat with GrindBot</h1>
        <p>Get help with PhillyGrind or submit a support ticket.</p>
      </div>

      <div className="contact-chat-container">
        <div className="contact-chat-header">
          <div className="contact-chat-bot-info">
            <Bot size={24} />
            <div>
              <span className="eyebrow">PhillyGrind Support</span>
              <h2>GrindBot</h2>
            </div>
          </div>
          <button
            className="contact-ticket-button"
            type="button"
            onClick={startTicketFlow}
            disabled={ticketFlow}
          >
            Submit a Ticket Instead
          </button>
        </div>

        <div className="contact-chat-thread" ref={threadRef}>
          {messages.map((message, index) => {
            const isUser = message.role === 'user';

            return (
              <article key={`${message.role}-${index}`} className={isUser ? 'message-bubble mine' : 'message-bubble'}>
                <span>{isUser ? 'You' : 'GrindBot'}</span>
                {isUser ? (
                  <p>{message.content}</p>
                ) : (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                )}
                {message.kind === 'choices' && (
                  <div className="contact-choice-grid">
                    {message.choices.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        disabled={ticketStep !== 'category'}
                        onClick={() => chooseCategory(choice)}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                )}
                {message.kind === 'description' && ticketStep === 'description' && (
                  <form className="contact-inline-form" onSubmit={submitTicketDescription}>
                    <textarea
                      value={ticketData.description}
                      onChange={(e) => setTicketData((current) => ({ ...current, description: e.target.value }))}
                      placeholder="Describe your issue..."
                      rows={4}
                    />
                    <button type="submit" disabled={ticketStep !== 'description' || !ticketData.description.trim()}>
                      Submit Ticket
                    </button>
                  </form>
                )}
                {message.kind === 'ticket_offer' && (
                  <div className="contact-ticket-offer">
                    <button type="button" onClick={() => handleTicketOfferResponse(true)}>
                      Yes, submit a ticket
                    </button>
                    <button type="button" onClick={() => handleTicketOfferResponse(false)}>
                      No thanks
                    </button>
                  </div>
                )}
              </article>
            );
          })}
          {sending && (
            <article className="message-bubble">
              <span>GrindBot</span>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </article>
          )}
        </div>

        {status && <p className="contact-status">{status}</p>}

        <form className="contact-chat-form" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about PhillyGrind or describe your issue..."
            aria-label="Message to GrindBot"
            disabled={sending || ticketFlow}
          />
          <button type="submit" className="primary-button" disabled={sending || !input.trim() || ticketFlow}>
            <Send size={18} />
            {sending ? 'Sending' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Contact;


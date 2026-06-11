import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { getMessages, getProfilesByIds, sendMessage, subscribeToMessages } from '../lib/messagesApi.js';
import { useAuth } from '../lib/auth.jsx';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeDisplayName(value, fallback = 'the poster') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

function ChatModal({ listing, onClose, receiverId: receiverIdOverride, receiverLabel }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [participantNames, setParticipantNames] = useState({});
  const messagesEndRef = useRef(null);
  const receiverId = receiverIdOverride || listing.user_id;

  const posterLabel = useMemo(() => (
    safeDisplayName(participantNames[receiverId] || receiverLabel || listing.posterName || listing.company)
  ), [listing.company, listing.posterName, participantNames, receiverId, receiverLabel]);

  useEffect(() => {
    if (!user || !receiverId) return undefined;

    setLoading(true);
    setStatus('');

    getProfilesByIds([user.id, receiverId])
      .then((profilesById) => {
        setParticipantNames(Object.fromEntries(profilesById));
      })
      .catch((error) => console.warn(error));

    getMessages({ listingId: listing.id, receiverId, userId: user.id })
      .then((loadedMessages) => {
        setMessages(loadedMessages);
        setParticipantNames((current) => ({
          ...current,
          ...Object.fromEntries(
            loadedMessages.flatMap((message) => [
              [message.sender_id, message.senderName],
              [message.receiver_id, message.receiverName],
            ]),
          ),
        }));
      })
      .catch((error) => setStatus(error.message || 'Could not load messages.'))
      .finally(() => setLoading(false));

    return subscribeToMessages({
      listingId: listing.id,
      receiverId,
      userId: user.id,
      onMessage: (message) => {
        getProfilesByIds([message.sender_id, message.receiver_id])
          .then((profilesById) => {
            const namedMessage = {
              ...message,
              senderName: profilesById.get(message.sender_id) || 'PhillyGrind user',
              receiverName: profilesById.get(message.receiver_id) || 'PhillyGrind user',
            };

            setParticipantNames((current) => ({ ...current, ...Object.fromEntries(profilesById) }));
            setMessages((current) => (
              current.some((item) => item.id === message.id) ? current : [...current, namedMessage]
            ));
          })
          .catch(() => {
            setMessages((current) => (
              current.some((item) => item.id === message.id) ? current : [...current, message]
            ));
          });
      },
    });
  }, [listing.id, receiverId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);
    setStatus('');

    try {
      const message = await sendMessage({
        listingId: listing.id,
        receiverId,
        content: trimmed,
      });

      setMessages((current) => (
        current.some((item) => item.id === message.id)
          ? current
          : [
              ...current,
              {
                ...message,
                senderName: profile?.name || 'You',
                receiverName: posterLabel,
              },
            ]
      ));
      setContent('');
    } catch (error) {
      setStatus(error.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-backdrop" role="presentation">
      <section className="chat-modal" role="dialog" aria-modal="true" aria-label={`Message ${posterLabel}`}>
        <header className="chat-header">
          <div>
            <span className="eyebrow">PhillyGrind Messages</span>
            <h2>Message {posterLabel}</h2>
            <p>{listing.title}</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat">
            <X size={20} />
          </button>
        </header>

        <div className="chat-thread">
          {loading && <p className="empty-state">Loading messages...</p>}
          {!loading && !messages.length && !status && (
            <p className="empty-state">Start the conversation with a quick note about this listing.</p>
          )}
          {messages.map((message) => {
            const isMine = message.sender_id === user?.id;

            return (
              <article key={message.id} className={isMine ? 'message-bubble mine' : 'message-bubble'}>
                <span>{message.senderName || (isMine ? profile?.name || 'You' : posterLabel)}</span>
                <p>{message.content}</p>
                <time>{new Date(message.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</time>
              </article>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {status && <p className="chat-status">{status}</p>}

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a message..."
            aria-label="Message content"
            disabled={sending}
          />
          <button type="submit" className="primary-button" disabled={sending || !content.trim()}>
            <Send size={18} />
            {sending ? 'Sending' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default ChatModal;

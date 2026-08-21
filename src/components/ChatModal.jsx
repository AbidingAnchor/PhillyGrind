import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import {
  getMessages,
  getParticipantProfiles,
  getProfilesByIds,
  markThreadMessagesRead,
  sendMessage,
  subscribeToMessages,
} from '../lib/messagesApi.js';
import { useAuth } from '../lib/auth.jsx';
import { getUserAvatarColor } from '../lib/reactions.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeDisplayName(value, fallback = 'the poster') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

function listingSubtitle(listing, posterLabel) {
  const title = String(listing?.title || '').trim();
  if (!title || title === 'Listing unavailable' || title === `Conversation with ${posterLabel}`) {
    return listing?.type && listing.type !== 'listing' && listing.type !== 'profile'
      ? listing.type
      : '';
  }
  return title;
}

function ChatModal({ listing, onClose, receiverId: receiverIdOverride, receiverLabel }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [participantNames, setParticipantNames] = useState({});
  const [receiverAvatarUrl, setReceiverAvatarUrl] = useState('');
  const messagesEndRef = useRef(null);
  const receiverId = receiverIdOverride || listing.user_id;

  const posterLabel = useMemo(() => (
    safeDisplayName(participantNames[receiverId] || receiverLabel || listing.posterName || listing.company)
  ), [listing.company, listing.posterName, participantNames, receiverId, receiverLabel]);

  const subtitle = listingSubtitle(listing, posterLabel);

  const latestOwnMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].sender_id === user?.id) return messages[index].id;
    }
    return null;
  }, [messages, user?.id]);

  useEffect(() => {
    if (!user || !receiverId) return undefined;

    setLoading(true);
    setStatus('');

    getParticipantProfiles([user.id, receiverId])
      .then((profilesById) => {
        const receiver = profilesById.get(receiverId);
        setReceiverAvatarUrl(receiver?.avatar_url || '');
        setParticipantNames(Object.fromEntries(
          [...profilesById.entries()].map(([id, participant]) => [id, participant.name]),
        ));
      })
      .catch((error) => console.warn(error));

    getMessages({ listingId: listing.id, receiverId, userId: user.id })
      .then(async (loadedMessages) => {
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

        try {
          const updated = await markThreadMessagesRead({
            otherUserId: receiverId,
            userId: user.id,
          });
          if (updated.length) {
            const readAtById = new Map(updated.map((row) => [row.id, row.read_at]));
            setMessages((current) => current.map((message) => (
              readAtById.has(message.id) ? { ...message, read_at: readAtById.get(message.id) } : message
            )));
          }
        } catch (error) {
          console.warn(error);
        }
      })
      .catch((error) => {
        console.error(error);
        setStatus('Something went wrong loading messages, please try again');
      })
      .finally(() => setLoading(false));

    return subscribeToMessages({
      listingId: listing.id,
      receiverId,
      userId: user.id,
      onMessage: (message) => {
        if (message.sender_id !== user.id && message.receiver_id !== user.id) return;
        if (message.sender_id !== receiverId && message.receiver_id !== receiverId) return;

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

        if (message.receiver_id === user.id && message.sender_id === receiverId) {
          markThreadMessagesRead({
            otherUserId: receiverId,
            userId: user.id,
          }).catch((error) => console.warn(error));
        }
      },
      onUpdate: (message) => {
        setMessages((current) => current.map((item) => (
          item.id === message.id ? { ...item, ...message } : item
        )));
      },
    });
  }, [listing.id, receiverId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

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
      console.error(error);
      setStatus('Something went wrong sending your message, please try again');
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div
      className="chat-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="chat-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Message ${posterLabel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="chat-header">
          <div className="chat-header-person">
            {receiverAvatarUrl ? (
              <img
                src={receiverAvatarUrl}
                alt=""
                className="chat-header-avatar"
                draggable={false}
              />
            ) : (
              <div
                className="chat-header-avatar chat-header-avatar-placeholder"
                style={{ backgroundColor: getUserAvatarColor(receiverId, posterLabel) }}
              >
                {posterLabel.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div className="chat-header-copy">
              <h2>{posterLabel}</h2>
              {subtitle ? <p>{subtitle}</p> : <p>Direct message</p>}
            </div>
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
            const showReceipt = isMine && message.id === latestOwnMessageId;

            return (
              <article key={message.id} className={isMine ? 'message-bubble mine' : 'message-bubble'}>
                <span>{message.senderName || (isMine ? profile?.name || 'You' : posterLabel)}</span>
                <p>{message.content}</p>
                <time>{new Date(message.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</time>
                {showReceipt && (
                  <em className="message-receipt">{message.read_at ? 'Seen' : 'Delivered'}</em>
                )}
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
    </div>,
    document.body,
  );
}

export default ChatModal;

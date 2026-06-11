import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ChatModal from '../components/ChatModal.jsx';
import { getConversations } from '../lib/messagesApi.js';
import { useAuth } from '../lib/auth.jsx';

function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError('');

    getConversations(user.id)
      .then(setConversations)
      .catch((err) => setError(err.message || 'Could not load conversations.'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">Inbox</span>
        <h1>Messages</h1>
        <p>Keep track of conversations about jobs and gigs you have posted or replied to.</p>
      </div>

      {loading && <p className="empty-state">Loading conversations...</p>}
      {error && <p className="empty-state error-state">{error}</p>}
      {!loading && !error && !conversations.length && (
        <p className="empty-state">No conversations yet. Message a poster from a job or gig detail page to start one.</p>
      )}
      {!loading && !error && Boolean(conversations.length) && (
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className="conversation-card"
              onClick={() => setActiveConversation(conversation)}
            >
              <span className="conversation-icon"><MessageCircle size={20} /></span>
              <span className="conversation-content">
                <strong>{conversation.listing.title}</strong>
                <span>{conversation.listing.type === 'gig' ? 'Gig' : 'Job'} conversation with {conversation.otherUserName}</span>
                <p>{conversation.lastMessage.content}</p>
              </span>
              <time>{new Date(conversation.lastMessage.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</time>
            </button>
          ))}
        </div>
      )}

      {activeConversation && (
        <ChatModal
          listing={activeConversation.listing}
          receiverId={activeConversation.otherUserId}
          receiverLabel={activeConversation.otherUserName}
          onClose={() => setActiveConversation(null)}
        />
      )}
    </section>
  );
}

export default Messages;

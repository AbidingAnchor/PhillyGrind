import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { getPostReactorsList, REACTION_EMOJI } from '../../lib/communityApi.js';
import { getUserAvatarColor } from '../../lib/reactions.js';

export default function ReactionsListModal({ postId, onClose }) {
  const [reactors, setReactors] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    getPostReactorsList(postId).then(setReactors);
  }, [postId]);

  const counts = reactors.reduce((acc, r) => {
    acc[r.reactionType] = (acc[r.reactionType] || 0) + 1;
    return acc;
  }, {});

  const filtered = activeTab === 'all' ? reactors : reactors.filter((r) => r.reactionType === activeTab);

  return createPortal(
    (
      <div className="reactions-modal-overlay" onClick={onClose}>
        <div className="reactions-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="reactions-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
          <div className="reactions-modal-tabs">
            <button type="button" className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>
              All {reactors.length}
            </button>
            {Object.entries(counts).map(([type, count]) => (
              <button
                key={type}
                type="button"
                className={activeTab === type ? 'active' : ''}
                onClick={() => setActiveTab(type)}
              >
                {REACTION_EMOJI[type] || '❓'} {count}
              </button>
            ))}
          </div>
          <div className="reactions-modal-list">
            {filtered.map((r) => (
              <Link key={r.userId} to={`/profile/${r.userId}`} className="reactions-modal-user" onClick={onClose}>
                {r.avatarUrl ? (
                  <img src={r.avatarUrl} className="reactions-modal-avatar" alt={r.name} draggable={false} />
                ) : (
                  <div
                    className="reactions-modal-avatar-placeholder"
                    style={{ backgroundColor: getUserAvatarColor(r.userId, r.name) }}
                  >
                    {r.name?.charAt(0) || '?'}
                  </div>
                )}
                <span>{r.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    ),
    document.body,
  );
}

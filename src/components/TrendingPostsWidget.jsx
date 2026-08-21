import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { getTrendingPosts } from '../lib/communityApi';
import { getUserAvatarColor } from '../lib/reactions.js';

const TRENDING_TARGET_COUNT = 5;

function TrendingPostsWidget() {
  const [trending, setTrending] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getTrendingPosts(TRENDING_TARGET_COUNT).then(setTrending).catch(err => console.error('[Trending] failed:', err));
  }, []);

  const getInitial = (name) => {
    if (!name) return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';
    return trimmed.charAt(0).toUpperCase();
  };

  const showGrowthPrompt = trending.length < TRENDING_TARGET_COUNT;

  return (
    <div className="trending-widget">
      <span className="trending-widget-title">Trending This Week</span>

      {trending.length === 0 ? (
        <p className="trending-empty">No trending posts yet — be the first to get some love!</p>
      ) : (
        trending.map(post => (
          <div key={post.id} className="trending-post-item" onClick={() => navigate(`/community?post=${post.id}`)}>
            <div className="trending-post-author">
              <span
                className="trending-post-avatar"
                style={!post.authorAvatarUrl ? { backgroundColor: getUserAvatarColor(post.authorId, post.authorName) } : undefined}
              >
                {post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt={`${post.authorName} profile`} draggable={false} /> : getInitial(post.authorName)}
              </span>
              <span>{post.authorName}</span>
            </div>
            <p className="trending-post-snippet">{post.content.slice(0, 70)}{post.content.length > 70 ? '...' : ''}</p>
            <div className="trending-post-reactions">
              <Heart size={13} /> {post.reactionCount}
            </div>
          </div>
        ))
      )}

      {showGrowthPrompt && (
        <p className="trending-growth-prompt">
          More trending posts will appear here as the community grows
        </p>
      )}
    </div>
  );
}

export default TrendingPostsWidget;

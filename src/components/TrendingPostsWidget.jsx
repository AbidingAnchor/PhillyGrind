import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { getTrendingPosts } from '../lib/communityApi';

function TrendingPostsWidget() {
  const [trending, setTrending] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getTrendingPosts(5).then(setTrending).catch(err => console.error('[Trending] failed:', err));
  }, []);

  console.log('[Trending] posts found:', trending.length);

  if (trending.length === 0) {
    return (
      <div className="trending-widget">
        <h3 className="trending-widget-title">Trending This Week</h3>
        <p className="trending-empty">No trending posts yet — be the first to get some love!</p>
      </div>
    );
  }

  return (
    <div className="trending-widget">
      <h3 className="trending-widget-title">Trending This Week</h3>
      {trending.map(post => (
        <div key={post.id} className="trending-post-item" onClick={() => navigate(`/community?post=${post.id}`)}>
          <div className="trending-post-author">
            <img src={post.authorAvatarUrl || '/default-avatar.png'} className="trending-post-avatar" />
            <span>{post.authorName}</span>
          </div>
          <p className="trending-post-snippet">{post.content.slice(0, 70)}{post.content.length > 70 ? '...' : ''}</p>
          <div className="trending-post-reactions">
            <Heart size={13} /> {post.reactionCount}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TrendingPostsWidget;

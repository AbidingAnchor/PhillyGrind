import { X } from 'lucide-react';
import MarketplacePostForm from './MarketplacePostForm.jsx';

function MarketplacePostModal({ onClose, onPosted }) {
  return (
    <div className="chat-backdrop" role="presentation">
      <section className="marketplace-post-modal" role="dialog" aria-modal="true" aria-label="Post a listing">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Marketplace</span>
            <h2>Post a Listing</h2>
            <p>Sell to neighbors across Philadelphia.</p>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close post form">
            <X size={20} />
          </button>
        </header>
        <MarketplacePostForm onClose={onClose} onPosted={onPosted} />
      </section>
    </div>
  );
}

export default MarketplacePostModal;

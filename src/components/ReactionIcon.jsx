import { getReactionAssetUrlByType, getReactionByType } from '../lib/reactions.js';

export default function ReactionIcon({ type, size = 24, className = '', title }) {
  const reaction = getReactionByType(type);
  const src = getReactionAssetUrlByType(type);

  if (!reaction || !src) return null;

  return (
    <img
      src={src}
      alt={reaction.label}
      title={title ?? reaction.label}
      className={`reaction-icon ${className}`.trim()}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
    />
  );
}

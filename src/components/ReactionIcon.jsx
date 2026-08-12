import { getReactionAssetUrlByType, getReactionByType } from '../lib/reactions.js';

export default function ReactionIcon({
  type,
  size = 24,
  className = '',
  title,
  variant = 'inline',
  scale,
}) {
  const reaction = getReactionByType(type);
  const src = getReactionAssetUrlByType(type);

  if (!reaction || !src) return null;

  const resolvedScale = scale ?? (
    variant === 'badge'
      ? reaction.badgeScale ?? 0.82
      : variant === 'leading'
        ? reaction.leadingScale ?? 0.9
        : variant === 'picker'
          ? reaction.pickerScale ?? 0.88
          : 1
  );

  const isContained = variant === 'badge' || variant === 'leading' || variant === 'picker';

  return (
    <img
      src={src}
      alt={reaction.label}
      title={title ?? reaction.label}
      className={`reaction-icon reaction-icon--${variant} ${className}`.trim()}
      data-reaction={type}
      width={isContained ? undefined : size}
      height={isContained ? undefined : size}
      style={isContained ? { '--reaction-icon-scale': resolvedScale } : undefined}
      loading="lazy"
      draggable={false}
    />
  );
}

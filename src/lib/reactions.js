const FLUENT_EMOJI_CDN =
  'https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Animated-Fluent-Emojis@master/Emojis';

export const REACTIONS = [
  {
    type: 'like',
    label: 'Like',
    emoji: '👍',
    folder: 'Hand gestures',
    file: 'Thumbs Up.png',
    color: '#1877f2',
  },
  {
    type: 'love',
    label: 'Love',
    emoji: '❤️',
    folder: 'Smilies',
    file: 'Red Heart.png',
    color: '#e0245e',
  },
  {
    type: 'haha',
    label: 'Haha',
    emoji: '😂',
    folder: 'Smilies',
    file: 'Face with Tears of Joy.png',
    color: '#f7b928',
  },
  {
    type: 'wow',
    label: 'Wow',
    emoji: '😮',
    folder: 'Smilies',
    file: 'Face with Open Mouth.png',
    color: '#f7b928',
  },
  {
    type: 'sad',
    label: 'Sad',
    emoji: '😢',
    folder: 'Smilies',
    file: 'Crying Face.png',
    color: '#f7b928',
  },
  {
    type: 'angry',
    label: 'Angry',
    emoji: '😡',
    folder: 'Smilies',
    file: 'Enraged Face.png',
    color: '#e9710f',
  },
];

export function getReactionByType(type) {
  return REACTIONS.find((reaction) => reaction.type === type) ?? null;
}

export function getReactionAssetUrl(reaction) {
  if (!reaction) return null;
  return `${FLUENT_EMOJI_CDN}/${encodeURIComponent(reaction.folder)}/${encodeURIComponent(reaction.file)}`;
}

export function getReactionAssetUrlByType(type) {
  return getReactionAssetUrl(getReactionByType(type));
}

export function normalizeReactionBreakdown(breakdown) {
  if (!Array.isArray(breakdown)) return [];
  return breakdown.filter(
    (item) => item && typeof item.type === 'string' && typeof item.count === 'number' && item.count > 0,
  );
}

export function getReactionTotalCount(breakdown, fallbackTotal = 0) {
  const items = normalizeReactionBreakdown(breakdown);
  if (items.length === 0) return fallbackTotal;
  return items.reduce((sum, { count }) => sum + count, 0);
}

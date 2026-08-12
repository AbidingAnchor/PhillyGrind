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
    badgeScale: 0.68,
    leadingScale: 0.82,
    pickerScale: 0.7,
  },
  {
    type: 'love',
    label: 'Love',
    emoji: '❤️',
    folder: 'Smilies',
    file: 'Red Heart.png',
    color: '#e0245e',
    badgeScale: 0.8,
    leadingScale: 0.88,
    pickerScale: 0.88,
  },
  {
    type: 'haha',
    label: 'Haha',
    emoji: '😂',
    folder: 'Smilies',
    file: 'Face with Tears of Joy.png',
    color: '#f7b928',
    badgeScale: 0.82,
    leadingScale: 0.9,
    pickerScale: 0.9,
  },
  {
    type: 'wow',
    label: 'Wow',
    emoji: '😮',
    folder: 'Smilies',
    file: 'Face with Open Mouth.png',
    color: '#f7b928',
    badgeScale: 0.82,
    leadingScale: 0.9,
    pickerScale: 0.9,
  },
  {
    type: 'sad',
    label: 'Sad',
    emoji: '😢',
    folder: 'Smilies',
    file: 'Crying Face.png',
    color: '#f7b928',
    badgeScale: 0.82,
    leadingScale: 0.9,
    pickerScale: 0.9,
  },
  {
    type: 'angry',
    label: 'Angry',
    emoji: '😡',
    folder: 'Smilies',
    file: 'Enraged Face.png',
    color: '#e9710f',
    badgeScale: 0.82,
    leadingScale: 0.9,
    pickerScale: 0.9,
  },
];

export function normalizeReactionType(type) {
  console.log('[normalizeReactionType] Input:', type, 'Type:', typeof type);
  if (typeof type !== 'string') {
    console.log('[normalizeReactionType] Invalid type, returning null');
    return null;
  }
  const normalized = type.trim().toLowerCase();
  console.log('[normalizeReactionType] Normalized:', normalized);
  const isValid = REACTIONS.some((reaction) => reaction.type === normalized);
  console.log('[normalizeReactionType] Is valid:', isValid);
  const result = isValid ? normalized : null;
  console.log('[normalizeReactionType] Returning:', result);
  return result;
}

export function getReactionByType(type) {
  const normalized = normalizeReactionType(type);
  if (!normalized) return null;
  return REACTIONS.find((reaction) => reaction.type === normalized) ?? null;
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

export function formatReactionCount(count) {
  const value = Number(count) || 0;
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const formatted = (value / 1000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}K`;
  }
  const formatted = (value / 1_000_000).toFixed(1).replace(/\.0$/, '');
  return `${formatted}M`;
}

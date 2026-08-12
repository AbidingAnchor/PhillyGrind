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
  if (typeof type !== 'string') return null;
  const normalized = type.trim().toLowerCase();
  return REACTIONS.some((reaction) => reaction.type === normalized) ? normalized : null;
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

// Avatar color palette for consistent user identification
const AVATAR_COLORS = [
  '#061724', // Navy (PhillyGrind brand)
  '#00c896', // Teal (PhillyGrind brand green)
  '#2d6a4f', // Forest green
  '#e76f51', // Warm orange
  '#3a506b', // Slate blue
  '#6b4c9a', // Plum
  '#e85d04', // Vibrant orange
  '#0077b6', // Ocean blue
];

// Simple hash function for consistent color assignment
function stringToHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function getUserAvatarColor(userId, userName) {
  // Use userId if available, otherwise fall back to userName
  const identifier = userId || userName || 'default';
  const hash = stringToHash(String(identifier));
  const colorIndex = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[colorIndex];
}

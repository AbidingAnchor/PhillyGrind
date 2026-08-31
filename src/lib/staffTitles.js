export const STAFF_TITLES = [
  { id: 'founder', badge: 'Founder', profile: 'Founder' },
  { id: 'cto', badge: 'CTO', profile: 'CTO / Head of Product' },
  { id: 'head_moderator', badge: 'Head Moderator', profile: 'Head Moderator / Trust & Safety Lead' },
  { id: 'operations', badge: 'Operations Manager', profile: 'Operations Manager' },
  { id: 'community_manager', badge: 'Community Manager', profile: 'Community Manager' },
  { id: 'moderator', badge: 'Moderator', profile: 'Moderator' },
];

export const STAFF_TITLE_IDS = STAFF_TITLES.map((title) => title.id);

export function normalizeStaffTitle(value) {
  const id = String(value || '').trim();
  return STAFF_TITLE_IDS.includes(id) ? id : null;
}

export function getStaffTitle(value) {
  const id = normalizeStaffTitle(value);
  return id ? STAFF_TITLES.find((title) => title.id === id) : null;
}

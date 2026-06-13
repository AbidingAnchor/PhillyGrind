export const hiringEvents = [];

export function getFeaturedHiringEvents() {
  return hiringEvents.filter((event) => event.featured);
}

export function getHomeHiringEvents(limit = 3) {
  return hiringEvents.slice(0, limit);
}

export function parsePositionsInput(value) {
  return String(value || '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatEventDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const hiringEvents = [
  {
    id: 'kitchen-kocktails',
    companyName: 'Kitchen + Kocktails Philly',
    title: 'Open Interviews',
    dateTime: 'Saturday, June 14, 2026 · 10:00 AM – 2:00 PM',
    location: '1234 Market St, Center City, Philadelphia',
    positions: ['Managers', 'Servers', 'Bartenders', 'Line Cooks'],
    description: 'Walk in ready to interview on the spot. Bring a résumé and dress to impress — we\'re hiring front-of-house and kitchen staff for our Center City location.',
    featured: true,
  },
  {
    id: 'liberty-brew-co',
    companyName: 'Liberty Brew Co.',
    title: 'Hiring Day — Brewery & Taproom',
    dateTime: 'Wednesday, June 18, 2026 · 4:00 PM – 7:00 PM',
    location: '456 Spring Garden St, Northern Liberties',
    positions: ['Taproom Staff', 'Line Cooks', 'Dishwashers'],
    description: 'Join our growing Philly craft brewery team. On-the-spot interviews for taproom and kitchen roles. Free pint for candidates who interview.',
    featured: true,
  },
  {
    id: 'south-philly-warehouse',
    companyName: 'South Philly Logistics Hub',
    title: 'Warehouse & Driver Open House',
    dateTime: 'Tuesday, June 24, 2026 · 9:00 AM – 12:00 PM',
    location: '2800 S Columbus Blvd, South Philadelphia',
    positions: ['Forklift Operators', 'Package Handlers', 'Delivery Drivers'],
    description: 'Same-day hiring for warehouse and last-mile delivery roles. Valid driver\'s license required for driver positions. Competitive hourly pay and benefits.',
    featured: false,
  },
];

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

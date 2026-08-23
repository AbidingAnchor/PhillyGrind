import { sendJson } from './_utils.js';

const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;
const SEVERITY_RANK = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 0,
};

const NEIGHBORHOOD_COORDS = {
  Fishtown: { lat: 39.9709, lon: -75.1347 },
  Kensington: { lat: 39.9906, lon: -75.1214 },
  'South Philly': { lat: 39.9209, lon: -75.1598 },
  'North Philly': { lat: 39.9926, lon: -75.1513 },
  'West Philly': { lat: 39.96, lon: -75.218 },
  'Northeast Philly': { lat: 40.0681, lon: -75.0107 },
  'Center City': { lat: 39.9526, lon: -75.1652 },
  Germantown: { lat: 40.0379, lon: -75.1745 },
  Manayunk: { lat: 40.0279, lon: -75.2245 },
  Other: { lat: 39.9526, lon: -75.1636 },
  'Delaware County - Chester': { lat: 39.8498, lon: -75.3557 },
  'Delaware County - Media': { lat: 39.9168, lon: -75.3877 },
  'Delaware County - Upper Darby': { lat: 39.9615, lon: -75.2707 },
  'Delaware County - Springfield': { lat: 39.9309, lon: -75.3202 },
  'Delaware County - Ridley': { lat: 39.889, lon: -75.3255 },
  'Delaware County - Havertown': { lat: 39.9809, lon: -75.3107 },
  'Montgomery County - Norristown': { lat: 40.1215, lon: -75.3399 },
  'Montgomery County - King of Prussia': { lat: 40.089, lon: -75.3849 },
  'Montgomery County - Lansdale': { lat: 40.2415, lon: -75.2838 },
  'Montgomery County - Abington': { lat: 40.1204, lon: -75.1174 },
  'Montgomery County - Pottstown': { lat: 40.2454, lon: -75.6496 },
  'Bucks County - Doylestown': { lat: 40.3101, lon: -75.1299 },
  'Bucks County - Bensalem': { lat: 40.1046, lon: -74.9513 },
  'Bucks County - Levittown': { lat: 40.1551, lon: -74.8288 },
  'Bucks County - Newtown': { lat: 40.2293, lon: -74.9368 },
  'Chester County - West Chester': { lat: 39.9607, lon: -75.6055 },
  'Chester County - Coatesville': { lat: 39.9832, lon: -75.8238 },
  'Chester County - Downingtown': { lat: 40.0065, lon: -75.7033 },
};

function coordsForNeighborhood(name) {
  return NEIGHBORHOOD_COORDS[String(name || '').trim()] || null;
}

function clipDescription(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= 160) return cleaned;
  return `${cleaned.slice(0, 157).trim()}…`;
}

function formatUntil(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay = date.toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    === now.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

  const time = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay) return time;

  const weekday = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  });
  return `${weekday} ${time}`;
}

function pickAlert(features) {
  const ranked = (features || [])
    .map((feature) => feature?.properties)
    .filter(Boolean)
    .sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));

  const props = ranked[0];
  if (!props) return null;

  const until = formatUntil(props.ends || props.expires);
  const event = props.event || 'Weather Alert';
  const severity = SEVERITY_RANK[props.severity] ? props.severity : 'Unknown';

  return {
    event,
    headline: props.headline || event,
    description: clipDescription(props.description || props.instruction),
    severity,
    until,
    title: until ? `${event} until ${until}` : event,
  };
}

export async function handleWeatherAlerts(req, res) {
  const neighborhood = String(req.query.neighborhood || '').trim();
  const coords = coordsForNeighborhood(neighborhood);
  if (!coords) {
    sendJson(res, 200, { alert: null });
    return;
  }

  const cacheKey = `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    sendJson(res, 200, { alert: cached.alert });
    return;
  }

  try {
    const url = `https://api.weather.gov/alerts/active?point=${coords.lat},${coords.lon}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': 'PhillyGrind/1.0 (https://phillygrind.work; drewnegron95@gmail.com)',
      },
    });

    if (!response.ok) {
      sendJson(res, 200, { alert: null });
      return;
    }

    const payload = await response.json();
    const alert = pickAlert(payload.features);
    cache.set(cacheKey, { at: Date.now(), alert });
    sendJson(res, 200, { alert });
  } catch (error) {
    console.warn('[weather-alerts]', error.message);
    sendJson(res, 200, { alert: null });
  }
}

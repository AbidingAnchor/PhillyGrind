import { sendJson } from './_utils.js';

const cache = new Map();
const CACHE_MS = 15 * 60 * 1000;
const NWS_HEADERS = {
  Accept: 'application/geo+json',
  'User-Agent': 'PhillyGrind/1.0 (https://phillygrind.work; drewnegron95@gmail.com)',
};
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
  const key = String(name || '').trim();
  return NEIGHBORHOOD_COORDS[key] || NEIGHBORHOOD_COORDS['Center City'];
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

function weatherIcon(shortForecast, isDaytime) {
  const text = String(shortForecast || '').toLowerCase();
  if (/(thunder|t-storm|lightning)/.test(text)) return 'storm';
  if (/(snow|sleet|ice|blizzard|flurries)/.test(text)) return 'snow';
  if (/(rain|shower|drizzle)/.test(text)) return 'rain';
  if (/(fog|haze|mist)/.test(text)) return 'fog';
  if (/(wind)/.test(text)) return 'wind';
  if (/(overcast|cloudy)/.test(text) && !/(partly|mostly sunny|mostly clear)/.test(text)) return 'cloud';
  if (/(partly|mostly cloudy|mostly sunny|mostly clear)/.test(text)) return isDaytime ? 'partly' : 'cloud';
  if (/(sunny|clear)/.test(text)) return isDaytime ? 'sun' : 'moon';
  return isDaytime ? 'partly' : 'cloud';
}

function dayLabel(name) {
  const raw = String(name || '').replace(/\s+Night$/i, '').trim();
  if (/^(today|this afternoon|this morning)$/i.test(raw)) return 'Today';
  if (/^tonight$/i.test(raw)) return 'Tonight';
  return raw.slice(0, 3);
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

function milesBetween(from, to) {
  if (!from || !to) return null;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  const miles = 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number.isFinite(miles) ? miles : null;
}

function pinCoords(point, fallback) {
  const miles = milesBetween(fallback, point);
  if (miles == null || miles > 40) return fallback;
  return point;
}

function geometryCentroid(geometry) {
  const points = [];

  function walk(node, depth) {
    if (!Array.isArray(node) || !node.length) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      points.push([node[0], node[1]]);
      return;
    }
    if (depth > 6) return;
    node.forEach((child) => walk(child, depth + 1));
  }

  walk(geometry?.coordinates, 0);
  if (!points.length) return null;

  const sum = points.reduce(
    (acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }),
    { lon: 0, lat: 0 },
  );
  return { lon: sum.lon / points.length, lat: sum.lat / points.length };
}

function mapAlerts(features, fallbackCoords, neighborhood) {
  return (features || [])
    .map((feature) => {
      const props = feature?.properties;
      if (!props) return null;
      const point = pinCoords(geometryCentroid(feature.geometry) || fallbackCoords, fallbackCoords);
      const until = formatUntil(props.ends || props.expires);
      const event = props.event || 'Weather Alert';
      const severity = SEVERITY_RANK[props.severity] ? props.severity : 'Unknown';
      const issuedAt = props.onset || props.effective || props.sent || null;
      return {
        id: String(props.id || feature.id || `${event}-${issuedAt || until}`),
        category: 'weather',
        event,
        title: until ? `${event} until ${until}` : event,
        headline: props.headline || event,
        description: clipDescription(props.description || props.instruction),
        severity,
        status: 'Live',
        issuedAt,
        until,
        lat: point.lat,
        lon: point.lon,
        neighborhood,
      };
    })
    .filter(Boolean);
}

function buildForecast(periods) {
  const list = periods || [];
  if (!list.length) return null;

  const current = list[0];
  const days = [];

  for (let index = 0; index < list.length; index += 1) {
    const period = list[index];
    if (!period?.isDaytime) continue;
    const night = list[index + 1] && !list[index + 1].isDaytime ? list[index + 1] : null;
    days.push({
      name: dayLabel(period.name),
      high: period.temperature,
      low: night?.temperature ?? null,
      condition: period.shortForecast,
      icon: weatherIcon(period.shortForecast, true),
    });
    if (days.length >= 7) break;
  }

  if (!days.length && current) {
    days.push({
      name: dayLabel(current.name),
      high: current.isDaytime ? current.temperature : null,
      low: current.isDaytime ? null : current.temperature,
      condition: current.shortForecast,
      icon: weatherIcon(current.shortForecast, current.isDaytime),
    });
  }

  return {
    current: {
      temp: current.temperature,
      unit: current.temperatureUnit || 'F',
      condition: current.shortForecast,
      isDaytime: Boolean(current.isDaytime),
      icon: weatherIcon(current.shortForecast, current.isDaytime),
      name: current.name,
    },
    days,
  };
}

async function nwsJson(url) {
  const response = await fetch(url, { headers: NWS_HEADERS });
  if (!response.ok) throw new Error(`NWS ${response.status}`);
  return response.json();
}

export async function handleWeatherAlerts(req, res) {
  const neighborhood = String(req.query.neighborhood || '').trim() || 'Center City';
  const coords = coordsForNeighborhood(neighborhood);
  const cacheKey = `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    sendJson(res, 200, cached.payload);
    return;
  }

  try {
    const [point, alertsPayload] = await Promise.all([
      nwsJson(`https://api.weather.gov/points/${coords.lat},${coords.lon}`),
      nwsJson(`https://api.weather.gov/alerts/active?point=${coords.lat},${coords.lon}`).catch(() => ({ features: [] })),
    ]);

    const forecastUrl = point?.properties?.forecast;
    const forecastPayload = forecastUrl
      ? await nwsJson(forecastUrl)
      : { properties: { periods: [] } };

    const location = { lat: coords.lat, lon: coords.lon };
    const alerts = mapAlerts(alertsPayload?.features, location, neighborhood);
    const payload = {
      neighborhood,
      coords: location,
      forecast: buildForecast(forecastPayload?.properties?.periods),
      alert: pickAlert(alertsPayload?.features),
      alerts,
    };

    cache.set(cacheKey, { at: Date.now(), payload });
    sendJson(res, 200, payload);
  } catch (error) {
    console.warn('[weather-alerts]', error.message);
    sendJson(res, 200, { neighborhood, forecast: null, alert: null, alerts: [], coords: coordsForNeighborhood(neighborhood) });
  }
}

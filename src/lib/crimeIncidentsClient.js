import { coordsForNeighborhood, isInsidePhiladelphia } from './neighborhoodCoords.js';

const CARTO_SQL = 'https://phl.carto.com/api/v2/sql';
const LOOKBACK_DAYS = 30;
const RADIUS_MILES = 1.5;
const MAX_RESULTS = 40;
const CACHE_MS = 15 * 60 * 1000;
export const CRIME_REFRESH_MS = 24 * 60 * 60 * 1000;
const requestCache = new Map();

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

function lookbackDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - LOOKBACK_DAYS);
  return date.toISOString().slice(0, 10);
}

function bboxAround(coords, radiusMiles = RADIUS_MILES) {
  const latDelta = radiusMiles / 69;
  const lonDelta = radiusMiles / (69 * Math.max(0.2, Math.cos((coords.lat * Math.PI) / 180)));
  return {
    minLat: coords.lat - latDelta,
    maxLat: coords.lat + latDelta,
    minLon: coords.lon - lonDelta,
    maxLon: coords.lon + lonDelta,
  };
}

function categoryForIncident(code) {
  const text = String(code || '').toLowerCase();
  if (/\barson\b/.test(text)) return 'fires';
  return 'safety';
}

function titleForIncident(code) {
  return String(code || '').trim() || 'Police-reported incident';
}

export async function loadCrimeIncidents(neighborhood, options = {}) {
  const citywide = !neighborhood || neighborhood === 'Any';
  const name = citywide ? 'Philadelphia' : String(neighborhood).trim();
  const force = Boolean(options.force);
  const cached = requestCache.get(name);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.promise;

  const promise = (async () => {
    const coords = coordsForNeighborhood(citywide ? 'Center City' : name);
    const radiusMiles = citywide ? 6 : RADIUS_MILES;
    if (!citywide && !isInsidePhiladelphia(coords)) {
      return { incidents: [], coords, coverage: 'outside-philadelphia', fetchedAt: null };
    }

    const since = lookbackDate();
    const box = bboxAround(coords, radiusMiles);
    const query = [
      'SELECT cartodb_id, dc_key, text_general_code, dispatch_date, dispatch_date_time,',
      'location_block, point_x, point_y',
      'FROM incidents_part1_part2',
      `WHERE dispatch_date >= '${since}'`,
      `AND point_x BETWEEN ${box.minLon.toFixed(5)} AND ${box.maxLon.toFixed(5)}`,
      `AND point_y BETWEEN ${box.minLat.toFixed(5)} AND ${box.maxLat.toFixed(5)}`,
      'ORDER BY dispatch_date DESC, dispatch_date_time DESC',
      'LIMIT 200',
    ].join(' ');

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${CARTO_SQL}?${new URLSearchParams({ q: query })}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) return { incidents: [], coords, coverage: 'unavailable', fetchedAt: null };
      const payload = await response.json();
      const incidents = (payload.rows || [])
        .map((row) => {
          const lat = Number(row.point_y);
          const lon = Number(row.point_x);
          const distanceMiles = milesBetween(coords, { lat, lon });
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          if (distanceMiles != null && distanceMiles > radiusMiles) return null;
          const title = titleForIncident(row.text_general_code);
          const location = String(row.location_block || '').trim();
          const issuedAt = row.dispatch_date_time || row.dispatch_date || null;
          return {
            id: `crime-${row.cartodb_id || row.dc_key}`,
            category: categoryForIncident(row.text_general_code),
            source: 'ppd',
            event: title,
            title,
            headline: title,
            description: [
              location ? `Reported on the ${location}.` : 'Location generalized to the hundred block.',
              'This is a police-reported incident from the past 30 days, updated daily by the Philadelphia Police Department — not a live dispatch.',
            ].join(' '),
            summary: location
              ? `Reported on the ${location}. Updated daily — not live.`
              : 'Police-reported incident from the past 30 days. Updated daily — not live.',
            instruction: '',
            areaDesc: location,
            effective: issuedAt,
            expires: null,
            severity: '',
            status: 'Reported',
            issuedAt,
            until: null,
            lat,
            lon,
            neighborhood: name,
            distanceMiles,
          };
        })
        .filter(Boolean)
        .sort((a, b) => String(b.issuedAt || '').localeCompare(String(a.issuedAt || '')))
        .slice(0, MAX_RESULTS);

      return { incidents, coords, coverage: 'philadelphia', fetchedAt: new Date().toISOString() };
    } catch {
      return { incidents: [], coords, coverage: 'unavailable', fetchedAt: null };
    } finally {
      window.clearTimeout(timer);
    }
  })();

  requestCache.set(name, { at: Date.now(), promise });
  return promise;
}

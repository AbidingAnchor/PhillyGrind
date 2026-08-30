import { HOUSING_NEIGHBORHOODS } from './housingApi.js';
import { NEIGHBORHOOD_COORDS } from './neighborhoodCoords.js';

export const HOME_NEIGHBORHOODS = HOUSING_NEIGHBORHOODS;
export const ALL_NEIGHBORHOODS = 'Any';

function usableNeighborhood(value) {
  const name = String(value ?? '').trim();
  if (!name || name === ALL_NEIGHBORHOODS) return '';
  return name;
}

export function resolveSavedHomeNeighborhood(profile) {
  return usableNeighborhood(profile?.neighborhood);
}

export async function fetchSavedHomeNeighborhood(userId, profile) {
  const fromProfile = resolveSavedHomeNeighborhood(profile);
  if (fromProfile) return fromProfile;

  const { hasSupabaseConfig, supabase } = await import('./supabase.js');
  if (!hasSupabaseConfig || !userId) return '';

  const { data } = await supabase
    .from('profiles_public')
    .select('neighborhood')
    .eq('id', userId)
    .maybeSingle();

  return usableNeighborhood(data?.neighborhood);
}

function milesBetween(from, to) {
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function snapToHomeNeighborhood(coords, maxMiles = 25) {
  const lat = Number(coords?.lat);
  const lon = Number(coords?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';

  const here = { lat, lon };
  let bestName = '';
  let bestMiles = Infinity;
  for (const name of HOME_NEIGHBORHOODS) {
    if (name === 'Other') continue;
    const point = NEIGHBORHOOD_COORDS[name];
    if (!point) continue;
    const miles = milesBetween(here, point);
    if (miles < bestMiles) {
      bestMiles = miles;
      bestName = name;
    }
  }

  if (!bestName || bestMiles > maxMiles) return '';
  return bestName;
}

export async function suggestNeighborhoodFromIp() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch('https://ipwho.is/?fields=success,latitude,longitude,city', {
      signal: controller.signal,
    });
    if (!response.ok) return '';
    const data = await response.json();
    if (!data?.success || !Number.isFinite(Number(data.latitude)) || !Number.isFinite(Number(data.longitude))) {
      return '';
    }
    return snapToHomeNeighborhood({ lat: Number(data.latitude), lon: Number(data.longitude) });
  } catch {
    return '';
  } finally {
    window.clearTimeout(timer);
  }
}

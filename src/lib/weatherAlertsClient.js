const weatherRequestCache = new Map();
const WEATHER_CACHE_MS = 60_000;

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function loadWeatherAlerts(neighborhood) {
  const cached = weatherRequestCache.get(neighborhood);
  if (cached && Date.now() - cached.at < WEATHER_CACHE_MS) {
    return cached.promise;
  }

  const query = new URLSearchParams({
    action: 'weather-alerts',
    neighborhood,
  });

  const promise = (async () => {
    const local = await fetchJson(`/api/listing-actions?${query}`, import.meta.env.DEV ? 1800 : 8000);
    if (local) return local;
    if (import.meta.env.DEV) {
      const live = await fetchJson(`https://www.phillygrind.work/api/listing-actions?${query}`, 8000);
      if (live) return live;
    }
    return { forecast: null, alert: null, alerts: [] };
  })();

  weatherRequestCache.set(neighborhood, { at: Date.now(), promise });
  return promise;
}

import { useEffect, useState } from 'react';
import { CloudLightning } from 'lucide-react';
import { loadWeatherAlerts } from '../lib/weatherAlertsClient.js';

function WeatherGlyph({ name, size = 18 }) {
  const kind = name && GLYPHS[name] ? name : 'partly';
  return (
    <svg
      className={`feed-weather-glyph feed-weather-glyph--${kind}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#94a3b8"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[kind]}
    </svg>
  );
}

const GLYPHS = {
  sun: (
    <>
      <circle className="wx-sun" cx="12" cy="12" r="4" stroke="#f59e0b" />
      <path className="wx-sun" stroke="#f59e0b" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: (
    <path className="wx-moon" stroke="#94a3b8" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  ),
  cloud: (
    <path className="wx-cloud" stroke="#94a3b8" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  ),
  fog: (
    <>
      <path className="wx-cloud" stroke="#94a3b8" d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2" />
      <path className="wx-fog" stroke="#94a3b8" d="M16 17H7M17 21H9" />
    </>
  ),
  partly: (
    <>
      <path className="wx-sun" stroke="#f59e0b" d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M4.93 19.07l1.41-1.41" />
      <circle className="wx-sun" cx="12" cy="12" r="4" stroke="#f59e0b" />
      <path className="wx-cloud" stroke="#94a3b8" d="M20 17.5a4.5 4.5 0 0 0-1.79-8.5h-.21A7 7 0 0 0 9 19h8.5" />
    </>
  ),
  rain: (
    <>
      <path className="wx-cloud" stroke="#94a3b8" d="M17.5 18H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path className="wx-rain" stroke="#2563eb" d="M8 22v1M12 21v2M16 22v1" />
    </>
  ),
  storm: (
    <>
      <path className="wx-cloud-storm" stroke="#64748b" d="M17.5 16H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path className="wx-bolt" stroke="#fbbf24" fill="#facc15" d="m13 12-3 5h3.2l-1.7 4 5.5-6.2h-3.2l1.7-2.8z" />
    </>
  ),
  snow: (
    <>
      <path className="wx-cloud" stroke="#94a3b8" d="M17.5 18H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path className="wx-snow" stroke="#38bdf8" d="M8 21h.01M12 22h.01M16 21h.01" />
    </>
  ),
  wind: (
    <path className="wx-wind" stroke="#94a3b8" d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2" />
  ),
};


function WeatherAlertBody({ alert, severity }) {
  return (
    <div className={`feed-weather-alert-banner feed-weather-alert--${severity}`}>
      <div className="feed-weather-alert-top">
        <span className="feed-weather-alert-icon" aria-hidden="true">
          <CloudLightning size={16} />
        </span>
        <span className="feed-weather-alert-kicker">Weather alert</span>
        <span className="feed-weather-alert-severity">{alert.severity}</span>
      </div>
      <strong className="feed-weather-alert-title">{alert.title || alert.event}</strong>
      {alert.description && (
        <p className="feed-weather-alert-copy">{alert.description}</p>
      )}
    </div>
  );
}

export default function NeighborhoodWeatherAlert({
  neighborhood,
  locationLabel,
  variant = 'sidebar',
}) {
  const [forecast, setForecast] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const place = locationLabel || neighborhood || 'Philadelphia';

  useEffect(() => {
    let cancelled = false;
    const queryNeighborhood = neighborhood && neighborhood !== 'Any'
      ? neighborhood
      : 'Center City';

    loadWeatherAlerts(queryNeighborhood)
      .then((payload) => {
        if (cancelled) return;
        setForecast(payload.forecast || null);
        setAlert(payload.alert || null);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setForecast(null);
        setAlert(null);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [neighborhood]);

  const current = forecast?.current;
  const days = forecast?.days || [];
  const severity = (alert?.severity || 'Unknown').toLowerCase();

  if (variant === 'feed') {
    if (!loaded || !alert) return null;
    return (
      <article
        className="feed-post-card feed-weather-inline-card"
        aria-label={`${place} weather alert`}
      >
        <WeatherAlertBody alert={alert} severity={severity} />
      </article>
    );
  }

  return (
    <article className="feed-left-card feed-weather-card" aria-label={`${place} weather`}>
      {alert && <WeatherAlertBody alert={alert} severity={severity} />}

      <div className="feed-weather-forecast">
        <span className="feed-weather-kicker">Weather</span>
        {current ? (
          <div className="feed-weather-now">
            <span className={`feed-weather-now-icon feed-weather-fx--${current.icon || 'partly'}`} aria-hidden="true">
              <WeatherGlyph name={current.icon} size={28} />
            </span>
            <div className="feed-weather-now-copy">
              <strong className="feed-weather-now-temp">
                {current.temp}°{current.unit === 'F' ? '' : current.unit}
              </strong>
              <span className="feed-weather-now-condition">{current.condition}</span>
              <span className="feed-weather-now-place">{place}</span>
            </div>
          </div>
        ) : (
          <p className="feed-weather-empty">
            {loaded ? 'Forecast unavailable right now.' : 'Checking the forecast…'}
          </p>
        )}

        {days.length > 0 && (
          <ul className="feed-weather-week">
            {days.map((day, index) => (
              <li key={`${day.name}-${index}`} className="feed-weather-day">
                <span className="feed-weather-day-name">{day.name}</span>
                <span className="feed-weather-day-icon" title={day.condition} aria-label={day.condition}>
                  <WeatherGlyph name={day.icon} size={15} />
                </span>
                <span className="feed-weather-day-temps">
                  <strong>{day.high ?? '–'}°</strong>
                  <span>{day.low != null ? `${day.low}°` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

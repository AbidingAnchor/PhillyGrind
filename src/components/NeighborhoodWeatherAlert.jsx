import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
      strokeWidth="1.6"
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
      <circle className="wx-sun" cx="12" cy="12" r="4.25" fill="#f59e0b" fillOpacity="0.28" stroke="#f59e0b" />
      <path className="wx-sun" stroke="#f59e0b" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: (
    <path className="wx-moon" fill="#94a3b8" fillOpacity="0.18" stroke="#94a3b8" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  ),
  cloud: (
    <path className="wx-cloud" fill="#94a3b8" fillOpacity="0.16" stroke="#94a3b8" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  ),
  fog: (
    <>
      <path className="wx-cloud" fill="#94a3b8" fillOpacity="0.12" stroke="#94a3b8" d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2" />
      <path className="wx-fog" stroke="#94a3b8" d="M16 17H7M17 21H9" />
    </>
  ),
  partly: (
    <>
      <path className="wx-sun" stroke="#f59e0b" d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M4.93 19.07l1.41-1.41" />
      <circle className="wx-sun" cx="12" cy="12" r="4" fill="#f59e0b" fillOpacity="0.22" stroke="#f59e0b" />
      <path className="wx-cloud" fill="#94a3b8" fillOpacity="0.16" stroke="#94a3b8" d="M20 17.5a4.5 4.5 0 0 0-1.79-8.5h-.21A7 7 0 0 0 9 19h8.5" />
    </>
  ),
  rain: (
    <>
      <path className="wx-cloud" fill="#94a3b8" fillOpacity="0.16" stroke="#94a3b8" d="M17.5 18H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path className="wx-rain" stroke="#2563eb" d="M8 22v1.5M12 21v2M16 22v1.5" />
    </>
  ),
  storm: (
    <>
      <path className="wx-cloud-storm" fill="#64748b" fillOpacity="0.2" stroke="#64748b" d="M17.5 16H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path className="wx-bolt" stroke="#fbbf24" fill="#facc15" d="m13 12-3 5h3.2l-1.7 4 5.5-6.2h-3.2l1.7-2.8z" />
    </>
  ),
  snow: (
    <>
      <path className="wx-cloud" fill="#94a3b8" fillOpacity="0.14" stroke="#94a3b8" d="M17.5 18H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path className="wx-snow" stroke="#38bdf8" d="M8 21h.01M12 22h.01M16 21h.01" />
    </>
  ),
  wind: (
    <path className="wx-wind" stroke="#94a3b8" d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2" />
  ),
};

function nowAtmosphere(icon, temp) {
  const kind = icon && GLYPHS[icon] ? icon : 'partly';
  if (kind === 'snow') return 'cold';
  if (kind === 'moon') return 'night';
  if (typeof temp === 'number') {
    if (temp >= 82) return 'warm';
    if (temp <= 38) return 'cold';
  }
  if (kind === 'storm') return 'storm';
  if (kind === 'rain') return 'cool';
  if (kind === 'sun') return 'warm';
  if (kind === 'cloud' || kind === 'fog' || kind === 'wind') return 'cool';
  return 'mild';
}

function sparklinePath(values, width = 100, height = 20, pad = 3) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return [x, y];
  });

  if (pts.length === 2) {
    return `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} L ${pts[1][0].toFixed(2)} ${pts[1][1].toFixed(2)}`;
  }

  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function WeatherSparkline({ days }) {
  const reactId = useId().replace(/:/g, '');
  const values = days
    .map((day) => (day.high != null ? day.high : day.low))
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  if (values.length < 2) return null;

  const line = sparklinePath(values);
  const area = `${line} L 100 20 L 0 20 Z`;

  return (
    <div className="feed-weather-sparkline" aria-hidden="true">
      <svg viewBox="0 0 100 20" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`wx-spark-line-${reactId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id={`wx-spark-fill-${reactId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#wx-spark-fill-${reactId})`} />
        <path
          d={line}
          fill="none"
          stroke={`url(#wx-spark-line-${reactId})`}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}


function WeatherAlertBody({ alert, severity }) {
  return (
    <Link to="/alerts" className={`feed-weather-alert-banner feed-weather-alert--${severity}`}>
      <div className="feed-weather-alert-top">
        <span className="feed-weather-alert-icon" aria-hidden="true">
          <CloudLightning size={16} />
        </span>
        <span className="feed-weather-alert-kicker">Weather alert</span>
        <span className="feed-weather-alert-severity">{alert.severity}</span>
      </div>
      <strong className="feed-weather-alert-title">{alert.title || alert.event}</strong>
      {alert.summary || alert.description ? (
        <p className="feed-weather-alert-copy">{alert.summary || alert.description}</p>
      ) : null}
    </Link>
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
  const [openDate, setOpenDate] = useState('');
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
  const hourly = forecast?.hourly || [];
  const severity = (alert?.severity || 'Unknown').toLowerCase();
  const openHours = useMemo(
    () => (openDate ? hourly.filter((hour) => hour.date === openDate) : []),
    [hourly, openDate],
  );

  function toggleDay(day) {
    const key = day.date || day.name;
    setOpenDate((currentDate) => (currentDate === key ? '' : key));
  }

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
          <div className={`feed-weather-now feed-weather-now--${nowAtmosphere(current.icon, current.temp)}`}>
            <span className={`feed-weather-now-icon feed-weather-fx--${current.icon || 'partly'}`} aria-hidden="true">
              <WeatherGlyph name={current.icon} size={32} />
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
          <>
            <WeatherSparkline days={days} />
            <ul className="feed-weather-week">
              {days.map((day, index) => {
                const key = day.date || day.name;
                const isOpen = openDate === key;
                return (
                  <li key={`${day.name}-${index}`}>
                    <button
                      type="button"
                      className={`feed-weather-day${isOpen ? ' is-open' : ''}`}
                      onClick={() => toggleDay(day)}
                      aria-expanded={isOpen}
                    >
                      <span className="feed-weather-day-name">{day.name}</span>
                      <span className="feed-weather-day-icon" title={day.condition} aria-label={day.condition}>
                        <WeatherGlyph name={day.icon} size={17} />
                      </span>
                      <span className="feed-weather-day-temps">
                        <strong>{day.high ?? '–'}°</strong>
                        <span>{day.low != null ? `${day.low}°` : ''}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {openDate && (
              <div className="feed-weather-hourly" role="region" aria-label="Hourly forecast">
                {openHours.length ? openHours.map((hour) => (
                  <div key={hour.start} className="feed-weather-hour">
                    <span className="feed-weather-hour-time">{hour.hour}</span>
                    <span className={`feed-weather-hour-icon feed-weather-fx--${hour.icon || 'partly'}`} title={hour.condition}>
                      <WeatherGlyph name={hour.icon} size={16} />
                    </span>
                    <strong className="feed-weather-hour-temp">{hour.temp}°</strong>
                    <span className="feed-weather-hour-precip">
                      {hour.precip != null ? `${hour.precip}%` : '—'}
                    </span>
                  </div>
                )) : (
                  <p className="feed-weather-hourly-empty">Hourly forecast isn’t available for this day yet.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

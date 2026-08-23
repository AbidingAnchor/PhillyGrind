import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Wind,
} from 'lucide-react';

const ICONS = {
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  partly: CloudSun,
  rain: CloudRain,
  storm: CloudLightning,
  snow: CloudSnow,
  fog: CloudFog,
  wind: Wind,
};

function WeatherGlyph({ name, size = 18 }) {
  const Icon = ICONS[name] || CloudSun;
  return <Icon size={size} strokeWidth={1.75} />;
}

export default function NeighborhoodWeatherAlert({ neighborhood, locationLabel }) {
  const [forecast, setForecast] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const place = locationLabel || neighborhood || 'Philadelphia';

  useEffect(() => {
    let cancelled = false;
    const queryNeighborhood = neighborhood && neighborhood !== 'Any'
      ? neighborhood
      : 'Center City';

    async function loadWeather() {
      try {
        const params = new URLSearchParams({
          action: 'weather-alerts',
          neighborhood: queryNeighborhood,
        });
        const response = await fetch(`/api/listing-actions?${params}`);
        if (!response.ok) {
          if (!cancelled) {
            setForecast(null);
            setAlert(null);
            setLoaded(true);
          }
          return;
        }
        const payload = await response.json();
        if (cancelled) return;
        setForecast(payload.forecast || null);
        setAlert(payload.alert || null);
        setLoaded(true);
      } catch {
        if (!cancelled) {
          setForecast(null);
          setAlert(null);
          setLoaded(true);
        }
      }
    }

    loadWeather();
    return () => {
      cancelled = true;
    };
  }, [neighborhood]);

  const current = forecast?.current;
  const days = forecast?.days || [];
  const severity = (alert?.severity || 'Unknown').toLowerCase();

  return (
    <article className="feed-left-card feed-weather-card" aria-label={`${place} weather`}>
      {alert && (
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
      )}

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

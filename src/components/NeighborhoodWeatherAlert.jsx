import { useEffect, useState } from 'react';
import { CloudLightning } from 'lucide-react';

export default function NeighborhoodWeatherAlert({ neighborhood }) {
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (!neighborhood || neighborhood === 'Any') {
      setAlert(null);
      return undefined;
    }

    let cancelled = false;

    async function loadAlert() {
      try {
        const params = new URLSearchParams({ neighborhood });
        const response = await fetch(`/api/weather-alerts?${params}`);
        if (!response.ok) {
          if (!cancelled) setAlert(null);
          return;
        }
        const payload = await response.json();
        if (!cancelled) setAlert(payload.alert || null);
      } catch {
        if (!cancelled) setAlert(null);
      }
    }

    loadAlert();
    return () => {
      cancelled = true;
    };
  }, [neighborhood]);

  if (!alert) return null;

  const severity = (alert.severity || 'Unknown').toLowerCase();

  return (
    <article
      className={`feed-left-card feed-weather-alert feed-weather-alert--${severity}`}
      aria-live="polite"
    >
      <div className="feed-weather-alert-top">
        <span className="feed-weather-alert-icon" aria-hidden="true">
          <CloudLightning size={16} />
        </span>
        <span className="feed-weather-alert-kicker">Weather alert</span>
        <span className="feed-weather-alert-severity">{alert.severity}</span>
      </div>
      <strong className="feed-weather-alert-title">{alert.title || alert.event}</strong>
      {alert.headline && alert.headline !== alert.event && (
        <p className="feed-weather-alert-headline">{alert.headline}</p>
      )}
      {alert.description && (
        <p className="feed-weather-alert-copy">{alert.description}</p>
      )}
    </article>
  );
}

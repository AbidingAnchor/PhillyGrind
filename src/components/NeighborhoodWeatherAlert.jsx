import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudLightning } from 'lucide-react';
import { loadWeatherAlerts } from '../lib/weatherAlertsClient.js';
import WeatherIcon, { resolveWeatherKind } from './WeatherIcon.jsx';

function nowAtmosphere(icon, temp) {
  const kind = resolveWeatherKind(icon);
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

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

const TEMP_COLOR_STOPS = [
  { at: 20, color: '#38bdf8' },
  { at: 42, color: '#22d3ee' },
  { at: 58, color: '#4ade80' },
  { at: 70, color: '#a3e635' },
  { at: 80, color: '#fbbf24' },
  { at: 92, color: '#f97316' },
];

function toFahrenheit(temp, unit) {
  return unit === 'C' ? (temp * 9) / 5 + 32 : temp;
}

function tempToColor(temp, unit) {
  const f = toFahrenheit(temp, unit);
  if (f <= TEMP_COLOR_STOPS[0].at) return TEMP_COLOR_STOPS[0].color;
  const last = TEMP_COLOR_STOPS[TEMP_COLOR_STOPS.length - 1];
  if (f >= last.at) return last.color;

  for (let index = 1; index < TEMP_COLOR_STOPS.length; index += 1) {
    const next = TEMP_COLOR_STOPS[index];
    const prev = TEMP_COLOR_STOPS[index - 1];
    if (f <= next.at) {
      const t = (f - prev.at) / (next.at - prev.at);
      const a = hexToRgb(prev.color);
      const b = hexToRgb(next.color);
      return rgbToHex([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ]);
    }
  }
  return last.color;
}

function sparklinePath(points) {
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function buildChartModel(days, unit) {
  const samples = days.map((day, index) => {
    const value = day.high != null ? day.high : day.low;
    return {
      index,
      value: typeof value === 'number' && Number.isFinite(value) ? value : null,
      key: day.date || day.name,
      day,
    };
  });
  const valued = samples.filter((sample) => sample.value != null);

  if (valued.length < 2) return null;

  const values = valued.map((sample) => sample.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minSpan = unit === 'C' ? 12 : 22;
  const span = Math.max(max - min, minSpan);
  const mid = (max + min) / 2;
  const domainMin = mid - span / 2;
  const width = days.length;
  const height = 100;
  const pad = 16;

  const points = valued.map((sample) => ({
    ...sample,
    x: sample.index + 0.5,
    y: pad + (1 - (sample.value - domainMin) / span) * (height - pad * 2),
    color: tempToColor(sample.value, unit),
  }));

  return { points, width, height, span, min, max };
}

function WeatherSparkline({ model, activeKey, onHover, onSelect }) {
  const reactId = useId().replace(/:/g, '');
  if (!model) return null;

  const { points, width, height } = model;
  const line = sparklinePath(points);
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="feed-weather-sparkline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="feed-weather-sparkline-svg"
      >
        <defs>
          <linearGradient id={`wx-spark-line-${reactId}`} x1="0" y1="0" x2="1" y2="0">
            {points.map((point) => (
              <stop
                key={point.key}
                offset={`${(point.x / width) * 100}%`}
                stopColor={point.color}
              />
            ))}
          </linearGradient>
          <linearGradient id={`wx-spark-fill-${reactId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={points[Math.floor(points.length / 2)].color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={points[Math.floor(points.length / 2)].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#wx-spark-fill-${reactId})`} />
        <path
          d={line}
          fill="none"
          stroke={`url(#wx-spark-line-${reactId})`}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="feed-weather-spark-points">
        {Array.from({ length: width }, (_, index) => {
          const point = points.find((item) => item.index === index);
          if (!point) return <span key={`empty-${index}`} />;
          const isActive = activeKey === point.key;
          return (
            <button
              key={point.key}
              type="button"
              className={`feed-weather-spark-hit${isActive ? ' is-active' : ''}`}
              style={{
                '--wx-y': `${point.y}%`,
                '--wx-color': point.color,
              }}
              tabIndex={-1}
              onMouseEnter={() => onHover(point.key)}
              onFocus={() => onHover(point.key)}
              onClick={() => onSelect(point.day)}
              aria-label={`${point.day.name} high ${point.value}°`}
            >
              <span className="feed-weather-spark-dot" />
              {isActive ? <span className="feed-weather-spark-tip">{point.value}°</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useHourlyDragScroll(ref, ready) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let pointerId = null;
    let originX = 0;
    let originScroll = 0;

    function onPointerDown(event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      event.preventDefault();
      pointerId = event.pointerId;
      originX = event.clientX;
      originScroll = node.scrollLeft;
      node.classList.add('is-dragging');
      node.setPointerCapture(event.pointerId);
    }

    function onDragStart(event) {
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (event.pointerId !== pointerId) return;
      node.scrollLeft = originScroll - (event.clientX - originX);
    }

    function endDrag(event) {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      node.classList.remove('is-dragging');
      try {
        node.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    }

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', endDrag);
    node.addEventListener('pointercancel', endDrag);
    node.addEventListener('dragstart', onDragStart);
    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', endDrag);
      node.removeEventListener('pointercancel', endDrag);
      node.removeEventListener('dragstart', onDragStart);
    };
  }, [ready]);
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
  const [hoverKey, setHoverKey] = useState('');
  const hourlyRef = useRef(null);
  const place = locationLabel || neighborhood || 'Philadelphia';
  useHourlyDragScroll(hourlyRef, openDate);

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
  const chartModel = useMemo(
    () => buildChartModel(days, current?.unit),
    [days, current?.unit],
  );
  const activeKey = hoverKey || openDate;

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
            <span className="feed-weather-now-icon" aria-hidden="true">
              <WeatherIcon name={current.icon} size={48} />
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
            <div
              className="feed-weather-week-chart"
              style={{ '--wx-days': days.length }}
              onMouseLeave={() => setHoverKey('')}
            >
              <WeatherSparkline
                model={chartModel}
                activeKey={activeKey}
                onHover={setHoverKey}
                onSelect={toggleDay}
              />
              <ul className="feed-weather-week">
                {days.map((day, index) => {
                  const key = day.date || day.name;
                  const isOpen = openDate === key;
                  const isActive = activeKey === key;
                  return (
                    <li key={`${day.name}-${index}`}>
                      <button
                        type="button"
                        className={`feed-weather-day${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}
                        onClick={() => toggleDay(day)}
                        onMouseEnter={() => setHoverKey(key)}
                        onFocus={() => setHoverKey(key)}
                        aria-expanded={isOpen}
                      >
                        <span className="feed-weather-day-name">{day.name}</span>
                        <span className="feed-weather-day-icon" title={day.condition} aria-label={day.condition}>
                          <WeatherIcon name={day.icon} size={32} label={day.condition} />
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
            </div>
            {openDate && (
              <div ref={hourlyRef} className="feed-weather-hourly" role="region" aria-label="Hourly forecast">
                {openHours.length ? openHours.map((hour) => (
                  <div key={hour.start} className="feed-weather-hour">
                    <span className="feed-weather-hour-time">{hour.hour}</span>
                    <span className="feed-weather-hour-icon" title={hour.condition}>
                      <WeatherIcon name={hour.icon} size={24} label={hour.condition} />
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

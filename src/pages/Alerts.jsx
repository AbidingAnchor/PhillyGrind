import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  CloudLightning,
  Flame,
  MessageSquarePlus,
  Radio,
  Share2,
  ShieldAlert,
  Siren,
  TrafficCone,
  Zap,
} from 'lucide-react';
import AlertsMap from '../components/AlertsMap.jsx';
import NeighborhoodSelect from '../components/NeighborhoodSelect.jsx';
import { useAuth } from '../lib/auth.jsx';
import { redirectToSignup } from '../lib/requireSignup.js';
import { fetchHomeNeighborhood } from '../lib/communityApi.js';
import { CRIME_REFRESH_MS, loadCrimeIncidents } from '../lib/crimeIncidentsClient.js';
import { ALL_NEIGHBORHOODS, resolveSavedHomeNeighborhood, suggestNeighborhoodFromIp } from '../lib/homeNeighborhood.js';
import { PHILLY_CENTER } from '../lib/neighborhoodCoords.js';
import { loadWeatherAlerts } from '../lib/weatherAlertsClient.js';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'safety', label: 'Safety' },
  { id: 'fires', label: 'Fires' },
  { id: 'outages', label: 'Outages' },
  { id: 'weather', label: 'Weather' },
  { id: 'traffic', label: 'Traffic' },
];

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

function formatDistance(miles) {
  if (miles == null) return null;
  if (miles < 0.2) return 'Nearby';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function formatTimeAgo(iso) {
  if (!iso) return 'Updated just now';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Updated just now';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function AlertGlyph({ category }) {
  if (category === 'weather') return <CloudLightning size={18} />;
  if (category === 'outages') return <Zap size={18} />;
  if (category === 'traffic') return <TrafficCone size={18} />;
  if (category === 'fires') return <Flame size={18} />;
  if (category === 'safety') return <Siren size={18} />;
  return <ShieldAlert size={18} />;
}

function formatAlertTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLastPulled(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatAlertDate(iso) {
  if (!iso) return '';
  const date = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function previewText(alert) {
  return String(alert?.summary || alert?.description || '').trim();
}

function fullAlertText(alert) {
  return String(alert?.description || alert?.summary || '').trim();
}

function emptyCopyForTab(tab, coverage) {
  if (tab === 'safety' || tab === 'fires') {
    if (coverage === 'outside-philadelphia') {
      return 'Crime incident data is from the Philadelphia Police Department and covers Philadelphia only.';
    }
    if (coverage === 'unavailable') {
      return 'Police incident data is unavailable right now. Try again in a few minutes.';
    }
    return tab === 'fires'
      ? 'No police-reported fire or arson incidents near this neighborhood in the past 30 days.'
      : 'No police-reported incidents near this neighborhood in the past 30 days.';
  }
  if (tab === 'all') {
    return coverage === 'outside-philadelphia'
      ? 'There are no live NWS alerts right now. Crime incident data covers Philadelphia only.'
      : 'There are no live NWS alerts and no nearby police-reported incidents from the past 30 days.';
  }
  if (tab === 'weather') {
    return 'There are no live NWS alerts for this neighborhood right now.';
  }
  return `${TABS.find((item) => item.id === tab)?.label} alerts are not connected yet. We’ll show them here once that feed is live.`;
}

function canExpandAlert(alert) {
  if (!alert) return false;
  if (alert.instruction || alert.areaDesc) return true;
  const full = fullAlertText(alert);
  if (full.length > 160) return true;
  const preview = previewText(alert).replace(/…$/, '').trim();
  return full.length > preview.length + 8;
}

function fallbackFromSingular(payload) {
  const alert = payload?.alert;
  if (!alert) return [];
  return [{
    id: alert.title || alert.event || 'weather-alert',
    category: 'weather',
    event: alert.event,
    title: alert.title || alert.event,
    headline: alert.headline || alert.event,
    description: alert.description,
    summary: alert.summary || alert.description,
    instruction: alert.instruction || '',
    areaDesc: alert.areaDesc || '',
    effective: alert.effective || null,
    expires: alert.expires || null,
    severity: alert.severity,
    status: 'Live',
    issuedAt: null,
    until: alert.until,
    lat: payload.coords?.lat ?? PHILLY_CENTER.lat,
    lon: payload.coords?.lon ?? PHILLY_CENTER.lon,
    neighborhood: payload.neighborhood,
  }];
}

export default function Alerts() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isLoggedIn, user, profile } = useAuth();
  const [homeNeighborhood, setHomeNeighborhood] = useState(() => resolveSavedHomeNeighborhood(profile));
  const [neighborhood, setNeighborhood] = useState(() => resolveSavedHomeNeighborhood(profile) || '');
  const browseOverrideRef = useRef(false);
  const [tab, setTab] = useState('all');
  const [alerts, setAlerts] = useState([]);
  const [coords, setCoords] = useState(PHILLY_CENTER);
  const [crimeCoverage, setCrimeCoverage] = useState('philadelphia');
  const [crimeFetchedAt, setCrimeFetchedAt] = useState(null);
  const crimeFetchedAtRef = useRef(null);
  const [selectedId, setSelectedId] = useState(params.get('id') || '');
  const [expandedId, setExpandedId] = useState(params.get('id') || '');
  const [loading, setLoading] = useState(true);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchHomeNeighborhood(isLoggedIn ? user?.id : null, profile)
      .then(async (name) => {
        if (cancelled) return;
        setHomeNeighborhood(name);
        if (browseOverrideRef.current) return;
        if (name) {
          setNeighborhood(name);
          return;
        }
        const guess = await suggestNeighborhoodFromIp();
        if (!cancelled && !browseOverrideRef.current) {
          setNeighborhood(guess || 'Center City');
        }
      })
      .catch(() => {
        if (!cancelled && !browseOverrideRef.current) {
          setNeighborhood((current) => current || 'Center City');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, profile?.neighborhood, user?.id]);

  useEffect(() => {
    if (!neighborhood) return undefined;
    let cancelled = false;
    crimeFetchedAtRef.current = null;
    setCrimeFetchedAt(null);
    setLoading(true);
    Promise.all([
      loadWeatherAlerts(neighborhood === ALL_NEIGHBORHOODS ? 'Center City' : neighborhood).catch(() => ({ alerts: [], coords: null })),
      loadCrimeIncidents(neighborhood).catch(() => ({ incidents: [], coords: null, coverage: 'unavailable' })),
    ])
      .then(([weatherPayload, crimePayload]) => {
        if (cancelled) return;
        const nextCoords = weatherPayload.coords || crimePayload.coords || PHILLY_CENTER;
        const weatherAlerts = (weatherPayload.alerts?.length
          ? weatherPayload.alerts
          : fallbackFromSingular(weatherPayload)
        ).map((alert) => ({
          ...alert,
          source: alert.source || 'nws',
          distanceMiles: milesBetween(nextCoords, { lat: alert.lat, lon: alert.lon }),
        }));
        const nextAlerts = [...weatherAlerts, ...(crimePayload.incidents || [])];
        setCoords(nextCoords);
        setCrimeCoverage(crimePayload.coverage || 'philadelphia');
        crimeFetchedAtRef.current = crimePayload.fetchedAt || null;
        setCrimeFetchedAt(crimePayload.fetchedAt || null);
        setAlerts(nextAlerts);
        setSelectedId((current) => current || nextAlerts[0]?.id || '');
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [neighborhood]);

  useEffect(() => {
    if (!neighborhood) return undefined;

    function crimeIsStale() {
      const last = crimeFetchedAtRef.current;
      if (!last) return true;
      return Date.now() - new Date(last).getTime() >= CRIME_REFRESH_MS;
    }

    function refreshCrimeIfStale() {
      if (!crimeIsStale()) return;
      loadCrimeIncidents(neighborhood, { force: true })
        .then((crimePayload) => {
          if (!crimePayload?.fetchedAt) return;
          crimeFetchedAtRef.current = crimePayload.fetchedAt;
          setCrimeFetchedAt(crimePayload.fetchedAt);
          setCrimeCoverage(crimePayload.coverage || 'philadelphia');
          setAlerts((current) => {
            const weather = current.filter((alert) => alert.source !== 'ppd');
            return [...weather, ...(crimePayload.incidents || [])];
          });
        })
        .catch(() => {});
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') refreshCrimeIfStale();
    }

    const timer = window.setInterval(refreshCrimeIfStale, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [neighborhood]);

  const visibleAlerts = useMemo(() => {
    if (tab === 'all') return alerts;
    return alerts.filter((alert) => alert.category === tab);
  }, [alerts, tab]);

  const selected = visibleAlerts.find((alert) => alert.id === selectedId) || visibleAlerts[0] || null;
  const liveCount = alerts.filter((alert) => alert.status === 'Live').length;

  function selectAlert(id) {
    setSelectedId(id);
    setExpandedId(id);
    const next = new URLSearchParams(params);
    next.set('id', id);
    setParams(next, { replace: true });
  }

  function toggleExpanded(event, id) {
    event.stopPropagation();
    setExpandedId((current) => (current === id ? '' : id));
    setSelectedId(id);
    const next = new URLSearchParams(params);
    next.set('id', id);
    setParams(next, { replace: true });
  }

  function writeAbout(alert) {
    const title = alert?.title || 'this alert';
    const target = `/?compose=alert&title=${encodeURIComponent(title)}`;
    if (!isLoggedIn) {
      redirectToSignup(navigate, target);
      return;
    }
    navigate(target);
  }

  async function shareAlert(alert) {
    const url = `${window.location.origin}/alerts?id=${encodeURIComponent(alert.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: alert.title, text: fullAlertText(alert) || alert.summary, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote('Link copied');
      window.setTimeout(() => setShareNote(''), 1800);
    } catch {
      setShareNote('');
    }
  }

  return (
    <section className="alerts-page">
      <header className="alerts-header">
        <div>
          <span className="eyebrow">Neighborhood</span>
          <h1>
            Alerts in {neighborhood === ALL_NEIGHBORHOODS || !neighborhood ? 'Philadelphia' : neighborhood}
            {liveCount > 0 && <span className="alerts-count-badge">{liveCount} new</span>}
          </h1>
          <p>
            Live weather warnings plus police-reported incidents from the past 30 days.
            Crime data is updated daily by PPD — not live or real-time.
          </p>
          {!homeNeighborhood && (
            <p className="alerts-neighborhood-prompt">
              {isLoggedIn ? (
                <Link to="/settings">Set your neighborhood</Link>
              ) : (
                <Link to="/login" state={{ from: '/alerts' }}>Sign in to save your neighborhood</Link>
              )}
              {' '}to make this the default. You can still browse other areas anytime.
            </p>
          )}
        </div>
        <NeighborhoodSelect
          id="alerts-neighborhood"
          label="Show alerts for"
          value={neighborhood || ALL_NEIGHBORHOODS}
          onChange={(next) => {
            browseOverrideRef.current = true;
            setNeighborhood(next);
          }}
        />
      </header>

      <div className="alerts-tabs" role="tablist" aria-label="Alert categories">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`alerts-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="alerts-shell">
        <div className="alerts-list-panel">
          {crimeFetchedAt && (
            <p className="alerts-updated">
              Last updated{' '}
              <time dateTime={crimeFetchedAt}>{formatLastPulled(crimeFetchedAt)}</time>
              {' · '}
              Pulled from OpenDataPhilly. PPD publishes this dataset daily — not live.
            </p>
          )}
          {loading && <p className="alerts-empty">Checking for alerts…</p>}
          {!loading && !visibleAlerts.length && (
            <div className="alerts-empty-card">
              <Radio size={22} />
              <strong>No active alerts in this category</strong>
              <p>
                {emptyCopyForTab(tab, crimeCoverage)}
              </p>
            </div>
          )}

          {visibleAlerts.map((alert) => {
            const expanded = expandedId === alert.id;
            const preview = previewText(alert);
            const fullText = fullAlertText(alert);
            const expandable = canExpandAlert(alert);
            const effectiveLabel = formatAlertTime(alert.effective);
            const expiresLabel = formatAlertTime(alert.expires) || alert.until;

            return (
              <article
                key={alert.id}
                className={`alerts-card${selected?.id === alert.id ? ' is-selected' : ''}${expanded ? ' is-expanded' : ''}`}
                onClick={() => selectAlert(alert.id)}
                aria-expanded={expandable ? expanded : undefined}
              >
                <div className={`alerts-card-icon alerts-card-icon--${alert.category}`}>
                  <AlertGlyph category={alert.category} />
                </div>
                <div className="alerts-card-body">
                  <div className="alerts-card-top">
                    <h2>{alert.title}</h2>
                    <span className={`alerts-status alerts-status--${String(alert.status || 'Live').toLowerCase()}`}>
                      {alert.status || 'Live'}
                    </span>
                  </div>
                  <p className="alerts-card-meta">
                    {formatDistance(alert.distanceMiles) || alert.neighborhood || neighborhood}
                    <span aria-hidden="true"> · </span>
                    {alert.source === 'ppd' && formatAlertDate(alert.issuedAt)
                      ? formatAlertDate(alert.issuedAt)
                      : formatTimeAgo(alert.issuedAt)}
                  </p>
                  {!expanded && preview && <p className="alerts-card-copy">{preview}</p>}
                  {expanded && (
                    <div className="alerts-card-details">
                      {fullText && <p className="alerts-card-full">{fullText}</p>}
                      {alert.instruction && (
                        <div className="alerts-card-detail-block">
                          <strong>What to do</strong>
                          <p>{alert.instruction}</p>
                        </div>
                      )}
                      {alert.areaDesc && (
                        <div className="alerts-card-detail-block">
                          <strong>Affected areas</strong>
                          <p>{alert.areaDesc}</p>
                        </div>
                      )}
                      {(effectiveLabel || expiresLabel) && (
                        <dl className="alerts-card-times">
                          {effectiveLabel && (
                            <>
                              <dt>Effective</dt>
                              <dd>{effectiveLabel}</dd>
                            </>
                          )}
                          {expiresLabel && (
                            <>
                              <dt>Until</dt>
                              <dd>{expiresLabel}</dd>
                            </>
                          )}
                        </dl>
                      )}
                    </div>
                  )}
                  <div className="alerts-card-actions">
                    {expandable && (
                      <button type="button" onClick={(event) => toggleExpanded(event, alert.id)}>
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        {expanded ? 'Show less' : 'Read full alert'}
                      </button>
                    )}
                    <button type="button" onClick={(event) => { event.stopPropagation(); writeAbout(alert); }}>
                      <MessageSquarePlus size={15} />
                      Write about this alert
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); shareAlert(alert); }}>
                      <Share2 size={15} />
                      Share
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {shareNote && <p className="alerts-share-note">{shareNote}</p>}
          <p className="alerts-footnote">
            Weather alerts come from the National Weather Service. Crime incidents are police-reported
            data from the Philadelphia Police Department via OpenDataPhilly, covering the past 30 days
            and updated daily — not live. <Link to="/">Back to Community</Link>
          </p>
        </div>

        <aside className="alerts-map-panel">
          <AlertsMap
            center={coords}
            alerts={visibleAlerts}
            selectedId={selected?.id}
            onSelect={selectAlert}
            updatedAt={crimeFetchedAt}
          />
        </aside>
      </div>
    </section>
  );
}

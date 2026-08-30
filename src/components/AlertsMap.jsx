import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const TILE_SIZE = 256;
const MIN_ZOOM = 10;
const MAX_ZOOM = 16;
const DEFAULT_ZOOM = 12;
const WHEEL_ZOOM_RATE = 1 / 420;
const ZOOM_EASE = 0.24;
const ZOOM_SNAP = 0.0025;

function wrapTile(value, max) {
  return ((value % max) + max) % max;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function project(lat, lon, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((Number(lon) + 180) / 360) * scale;
  const latRad = clamp(Number(lat), -85.0511, 85.0511) * Math.PI / 180;
  const y = (
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
  ) * scale;
  return { x, y };
}

function unproject(x, y, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lon };
}

function tileUrl(x, y, z) {
  return `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/${z}/${x}/${y}@2x.png`;
}

function formatMapPulled(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function applyZoom(currentZoom, currentView, nextZoom, size, anchor) {
  const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  if (clamped === currentZoom) {
    return { zoom: currentZoom, view: currentView };
  }

  const { width, height } = size;
  const origin = project(currentView.lat, currentView.lon, currentZoom);
  const focusX = anchor ? origin.x - width / 2 + anchor.x : origin.x;
  const focusY = anchor ? origin.y - height / 2 + anchor.y : origin.y;
  const ratio = 2 ** (clamped - currentZoom);
  const nextOriginX = focusX * ratio - (anchor ? anchor.x - width / 2 : 0);
  const nextOriginY = focusY * ratio - (anchor ? anchor.y - height / 2 : 0);

  return {
    zoom: clamped,
    view: unproject(nextOriginX, nextOriginY, clamped),
  };
}

function normalizeWheelDelta(event, pageHeight) {
  let dy = event.deltaY;
  if (event.deltaMode === 1) dy *= 16;
  if (event.deltaMode === 2) dy *= pageHeight || 800;
  return dy;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function AlertsMap({
  center,
  alerts,
  selectedId,
  onSelect,
  updatedAt,
}) {
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const sizeRef = useRef({ width: 640, height: 520 });
  const zoomRef = useRef(DEFAULT_ZOOM);
  const viewRef = useRef({
    lat: Number(center?.lat) || 39.9526,
    lon: Number(center?.lon) || -75.1652,
  });
  const targetZoomRef = useRef(DEFAULT_ZOOM);
  const anchorRef = useRef(null);
  const rafRef = useRef(0);

  const [size, setSize] = useState({ width: 640, height: 520 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [view, setView] = useState(() => viewRef.current);
  const [dragging, setDragging] = useState(false);

  function commitCamera(next) {
    zoomRef.current = next.zoom;
    viewRef.current = next.view;
    setZoom(next.zoom);
    setView(next.view);
  }

  function stepZoomTowardTarget() {
    const currentZoom = zoomRef.current;
    const target = targetZoomRef.current;
    const diff = target - currentZoom;
    const ease = prefersReducedMotion() ? 1 : ZOOM_EASE;
    const nextZoom = Math.abs(diff) <= ZOOM_SNAP
      ? target
      : currentZoom + diff * ease;
    const next = applyZoom(
      currentZoom,
      viewRef.current,
      nextZoom,
      sizeRef.current,
      anchorRef.current,
    );
    commitCamera(next);

    if (next.zoom !== targetZoomRef.current) {
      rafRef.current = window.requestAnimationFrame(stepZoomTowardTarget);
      return;
    }
    rafRef.current = 0;
  }

  function requestZoom(nextTarget, anchor) {
    targetZoomRef.current = clamp(nextTarget, MIN_ZOOM, MAX_ZOOM);
    anchorRef.current = anchor || null;
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(stepZoomTowardTarget);
  }

  useEffect(() => {
    const nextView = {
      lat: Number(center?.lat) || 39.9526,
      lon: Number(center?.lon) || -75.1652,
    };
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    zoomRef.current = DEFAULT_ZOOM;
    targetZoomRef.current = DEFAULT_ZOOM;
    viewRef.current = nextView;
    setView(nextView);
    setZoom(DEFAULT_ZOOM);
  }, [center?.lat, center?.lon]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;

    function measure() {
      const next = {
        width: node.clientWidth || 640,
        height: node.clientHeight || 520,
      };
      sizeRef.current = next;
      setSize(next);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;

    function onWheel(event) {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const delta = normalizeWheelDelta(event, sizeRef.current.height);
      requestZoom(
        targetZoomRef.current - delta * WHEEL_ZOOM_RATE,
        {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
      );
    }

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function onPointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest('.alerts-map-pin, .alerts-map-zoom, .alerts-map-credit')) return;
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    targetZoomRef.current = zoomRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      lat: viewRef.current.lat,
      lon: viewRef.current.lon,
    };
    setDragging(true);
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const origin = project(drag.lat, drag.lon, zoomRef.current);
    const next = unproject(
      origin.x - (event.clientX - drag.x),
      origin.y - (event.clientY - drag.y),
      zoomRef.current,
    );
    viewRef.current = next;
    setView(next);
  }

  function onPointerUp(event) {
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const layout = useMemo(() => {
    const { width, height } = size;
    const origin = project(view.lat, view.lon, zoom);
    const tileZoom = clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM);
    const tileSize = TILE_SIZE * 2 ** (zoom - tileZoom);
    const maxTile = 2 ** tileZoom;
    const tiles = [];
    const startX = Math.floor((origin.x - width / 2) / tileSize) - 1;
    const endX = Math.floor((origin.x + width / 2) / tileSize) + 1;
    const startY = Math.floor((origin.y - height / 2) / tileSize) - 1;
    const endY = Math.floor((origin.y + height / 2) / tileSize) + 1;

    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= maxTile) continue;
        tiles.push({
          key: `${tileZoom}-${x}-${y}`,
          left: x * tileSize - origin.x + width / 2,
          top: y * tileSize - origin.y + height / 2,
          size: tileSize,
          url: tileUrl(wrapTile(x, maxTile), y, tileZoom),
        });
      }
    }

    const pins = (alerts || [])
      .filter((alert) => Number.isFinite(Number(alert.lat)) && Number.isFinite(Number(alert.lon)))
      .map((alert) => {
        const point = project(alert.lat, alert.lon, zoom);
        return {
          ...alert,
          left: point.x - origin.x + width / 2,
          top: point.y - origin.y + height / 2,
        };
      });

    return { tiles, pins };
  }, [alerts, size, view.lat, view.lon, zoom]);

  return (
    <div
      className={`alerts-map${dragging ? ' is-dragging' : ''}`}
      ref={wrapRef}
      aria-label="Alert map"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="alerts-map-tiles">
        {layout.tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            className="alerts-map-tile"
            style={{
              width: tile.size,
              height: tile.size,
              transform: `translate3d(${tile.left}px, ${tile.top}px, 0)`,
            }}
            draggable={false}
          />
        ))}
      </div>
      {layout.pins.map((pin) => (
        <button
          key={pin.id}
          type="button"
          className={`alerts-map-pin alerts-map-pin--${pin.category || 'safety'}${selectedId === pin.id ? ' is-selected' : ''}`}
          style={{ left: pin.left, top: pin.top }}
          onClick={() => onSelect?.(pin.id)}
          aria-label={pin.title}
        >
          <span />
        </button>
      ))}
      <div className="alerts-map-zoom" role="group" aria-label="Map zoom">
        <button type="button" aria-label="Zoom in" onClick={() => requestZoom(targetZoomRef.current + 1)}>
          <Plus size={16} />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => requestZoom(targetZoomRef.current - 1)}>
          <Minus size={16} />
        </button>
      </div>
      <div className="alerts-map-credit">
        <div>
          ©{' '}
          <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a>
          {' '}©{' '}
          <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>
          {' '}©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
        </div>
        <div>
          Data:{' '}
          <a href="https://opendataphilly.org/datasets/crime-incidents/" target="_blank" rel="noreferrer">
            Philadelphia Police Department via OpenDataPhilly
          </a>
          {' '}· past 30 days, published daily by PPD
          {updatedAt ? ` · last pulled ${formatMapPulled(updatedAt)}` : ''}
        </div>
      </div>
    </div>
  );
}

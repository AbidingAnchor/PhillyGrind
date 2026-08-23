import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const TILE_SIZE = 256;
const MIN_ZOOM = 10;
const MAX_ZOOM = 16;
const DEFAULT_ZOOM = 12;

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
  return `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`;
}

export default function AlertsMap({
  center,
  alerts,
  selectedId,
  onSelect,
}) {
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 640, height: 520 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [view, setView] = useState(() => ({
    lat: Number(center?.lat) || 39.9526,
    lon: Number(center?.lon) || -75.1652,
  }));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setView({
      lat: Number(center?.lat) || 39.9526,
      lon: Number(center?.lon) || -75.1652,
    });
    setZoom(DEFAULT_ZOOM);
  }, [center?.lat, center?.lon]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;

    function measure() {
      setSize({
        width: node.clientWidth || 640,
        height: node.clientHeight || 520,
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const zoomAt = useCallback((nextZoom, anchor) => {
    setZoom((currentZoom) => {
      const clamped = clamp(
        typeof nextZoom === 'function' ? nextZoom(currentZoom) : nextZoom,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      if (clamped === currentZoom) return currentZoom;
      setView((currentView) => {
        const { width, height } = size;
        const origin = project(currentView.lat, currentView.lon, currentZoom);
        const focusX = anchor ? origin.x - width / 2 + anchor.x : origin.x;
        const focusY = anchor ? origin.y - height / 2 + anchor.y : origin.y;
        const ratio = 2 ** (clamped - currentZoom);
        const nextOriginX = focusX * ratio - (anchor ? anchor.x - width / 2 : 0);
        const nextOriginY = focusY * ratio - (anchor ? anchor.y - height / 2 : 0);
        return unproject(nextOriginX, nextOriginY, clamped);
      });
      return clamped;
    });
  }, [size]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;

    function onWheel(event) {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const direction = event.deltaY > 0 ? -1 : 1;
      zoomAt((current) => current + direction, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  function onPointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest('.alerts-map-pin, .alerts-map-zoom, .alerts-map-credit')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      lat: view.lat,
      lon: view.lon,
    };
    setDragging(true);
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const origin = project(drag.lat, drag.lon, zoom);
    const next = unproject(
      origin.x - (event.clientX - drag.x),
      origin.y - (event.clientY - drag.y),
      zoom,
    );
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
    const maxTile = 2 ** zoom;
    const tiles = [];
    const startX = Math.floor((origin.x - width / 2) / TILE_SIZE) - 1;
    const endX = Math.floor((origin.x + width / 2) / TILE_SIZE) + 1;
    const startY = Math.floor((origin.y - height / 2) / TILE_SIZE) - 1;
    const endY = Math.floor((origin.y + height / 2) / TILE_SIZE) + 1;

    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= maxTile) continue;
        tiles.push({
          key: `${zoom}-${x}-${y}`,
          left: x * TILE_SIZE - origin.x + width / 2,
          top: y * TILE_SIZE - origin.y + height / 2,
          url: tileUrl(wrapTile(x, maxTile), y, zoom),
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
            style={{ transform: `translate(${tile.left}px, ${tile.top}px)` }}
            draggable={false}
          />
        ))}
      </div>
      {layout.pins.map((pin) => (
        <button
          key={pin.id}
          type="button"
          className={`alerts-map-pin${selectedId === pin.id ? ' is-selected' : ''}`}
          style={{ left: pin.left, top: pin.top }}
          onClick={() => onSelect?.(pin.id)}
          aria-label={pin.title}
        >
          <span />
        </button>
      ))}
      <div className="alerts-map-zoom" role="group" aria-label="Map zoom">
        <button type="button" aria-label="Zoom in" onClick={() => zoomAt((current) => current + 1)}>
          <Plus size={16} />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomAt((current) => current - 1)}>
          <Minus size={16} />
        </button>
      </div>
      <div className="alerts-map-credit">Map data © OpenStreetMap, © CARTO</div>
    </div>
  );
}

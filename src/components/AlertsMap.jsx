import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../lib/theme.jsx';

const TILE_SIZE = 256;
const ZOOM = 11;

function wrapTile(value, max) {
  return ((value % max) + max) % max;
}

function project(lat, lon, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((Number(lon) + 180) / 360) * scale;
  const latRad = (Number(lat) * Math.PI) / 180;
  const y = (
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
  ) * scale;
  return { x, y };
}

function tileUrl(x, y, z, dark) {
  const style = dark ? 'dark_all' : 'rastertiles/voyager';
  return `https://basemaps.cartocdn.com/${style}/${z}/${x}/${y}@2x.png`;
}

export default function AlertsMap({
  center,
  alerts,
  selectedId,
  onSelect,
}) {
  const themeContext = useTheme();
  const dark = themeContext?.theme === 'dark';
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 640, height: 520 });

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

  const layout = useMemo(() => {
    const { width, height } = size;
    const origin = project(center.lat, center.lon, ZOOM);
    const maxTile = 2 ** ZOOM;
    const tiles = [];
    const startX = Math.floor((origin.x - width / 2) / TILE_SIZE) - 1;
    const endX = Math.floor((origin.x + width / 2) / TILE_SIZE) + 1;
    const startY = Math.floor((origin.y - height / 2) / TILE_SIZE) - 1;
    const endY = Math.floor((origin.y + height / 2) / TILE_SIZE) + 1;

    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= maxTile) continue;
        tiles.push({
          key: `${x}-${y}`,
          left: x * TILE_SIZE - origin.x + width / 2,
          top: y * TILE_SIZE - origin.y + height / 2,
          url: tileUrl(wrapTile(x, maxTile), y, ZOOM, dark),
        });
      }
    }

    const pins = (alerts || [])
      .filter((alert) => Number.isFinite(Number(alert.lat)) && Number.isFinite(Number(alert.lon)))
      .map((alert) => {
        const point = project(alert.lat, alert.lon, ZOOM);
        return {
          ...alert,
          left: point.x - origin.x + width / 2,
          top: point.y - origin.y + height / 2,
        };
      });

    return { tiles, pins };
  }, [alerts, center.lat, center.lon, dark, size]);

  return (
    <div className="alerts-map" ref={wrapRef} aria-label="Alert map">
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
      <div className="alerts-map-credit">Map data © OpenStreetMap, © CARTO</div>
    </div>
  );
}

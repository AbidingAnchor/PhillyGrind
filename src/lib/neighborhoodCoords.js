export const PHILLY_CENTER = { lat: 39.9526, lon: -75.1652 };

export const NEIGHBORHOOD_COORDS = {
  Fishtown: { lat: 39.9709, lon: -75.1347 },
  Kensington: { lat: 39.9906, lon: -75.1214 },
  'South Philly': { lat: 39.9209, lon: -75.1598 },
  'North Philly': { lat: 39.9926, lon: -75.1513 },
  'West Philly': { lat: 39.96, lon: -75.218 },
  'Northeast Philly': { lat: 40.0681, lon: -75.0107 },
  'Center City': PHILLY_CENTER,
  Germantown: { lat: 40.0379, lon: -75.1745 },
  Manayunk: { lat: 40.0279, lon: -75.2245 },
  Other: { lat: 39.9526, lon: -75.1636 },
  'Delaware County - Chester': { lat: 39.8498, lon: -75.3557 },
  'Delaware County - Media': { lat: 39.9168, lon: -75.3877 },
  'Delaware County - Upper Darby': { lat: 39.9615, lon: -75.2707 },
  'Delaware County - Springfield': { lat: 39.9309, lon: -75.3202 },
  'Delaware County - Ridley': { lat: 39.889, lon: -75.3255 },
  'Delaware County - Havertown': { lat: 39.9809, lon: -75.3107 },
  'Montgomery County - Norristown': { lat: 40.1215, lon: -75.3399 },
  'Montgomery County - King of Prussia': { lat: 40.089, lon: -75.3849 },
  'Montgomery County - Lansdale': { lat: 40.2415, lon: -75.2838 },
  'Montgomery County - Abington': { lat: 40.1204, lon: -75.1174 },
  'Montgomery County - Pottstown': { lat: 40.2454, lon: -75.6496 },
  'Bucks County - Doylestown': { lat: 40.3101, lon: -75.1299 },
  'Bucks County - Bensalem': { lat: 40.1046, lon: -74.9513 },
  'Bucks County - Levittown': { lat: 40.1551, lon: -74.8288 },
  'Bucks County - Newtown': { lat: 40.2293, lon: -74.9368 },
  'Chester County - West Chester': { lat: 39.9607, lon: -75.6055 },
  'Chester County - Coatesville': { lat: 39.9832, lon: -75.8238 },
  'Chester County - Downingtown': { lat: 40.0065, lon: -75.7033 },
};

const PHILLY_BOUNDS = {
  minLat: 39.867,
  maxLat: 40.145,
  minLon: -75.28,
  maxLon: -74.955,
};

export function coordsForNeighborhood(name) {
  const key = String(name || '').trim();
  return NEIGHBORHOOD_COORDS[key] || PHILLY_CENTER;
}

export function isInsidePhiladelphia(coords) {
  if (!coords) return false;
  return coords.lat >= PHILLY_BOUNDS.minLat
    && coords.lat <= PHILLY_BOUNDS.maxLat
    && coords.lon >= PHILLY_BOUNDS.minLon
    && coords.lon <= PHILLY_BOUNDS.maxLon;
}

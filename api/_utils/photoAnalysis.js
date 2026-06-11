import exifr from 'exifr';

const PHILLY_LAT = 39.9526;
const PHILLY_LNG = -75.1652;
const PHILLY_RADIUS_KM = 80;

const EDITING_SOFTWARE = [
  'photoshop',
  'lightroom',
  'gimp',
  'snapseed',
  'canva',
  'midjourney',
  'dall-e',
  'dalle',
  'stable diffusion',
  'firefly',
  'generative',
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pickExifFields(parsed) {
  if (!parsed) return {};

  return {
    timestamp: parsed.DateTimeOriginal || parsed.CreateDate || parsed.ModifyDate || null,
    latitude: parsed.latitude ?? parsed.GPSLatitude ?? null,
    longitude: parsed.longitude ?? parsed.GPSLongitude ?? null,
    deviceMake: parsed.Make || null,
    deviceModel: parsed.Model || null,
    software: parsed.Software || parsed.ProcessingSoftware || null,
    orientation: parsed.Orientation || null,
  };
}

export function computeTamperScore(exif) {
  const flags = [];
  let score = 0;

  const timestamp = exif.timestamp ? new Date(exif.timestamp) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) {
    score += 30;
    flags.push('No valid EXIF timestamp found.');
  } else {
    const ageHours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) {
      score += 25;
      flags.push(`Photo timestamp is ${Math.round(ageHours)} hours old (expected within 24 hours).`);
    }
  }

  const lat = Number(exif.latitude);
  const lng = Number(exif.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    score += 25;
    flags.push('No GPS coordinates found in EXIF data.');
  } else {
    const distance = haversineKm(lat, lng, PHILLY_LAT, PHILLY_LNG);
    if (distance > PHILLY_RADIUS_KM) {
      score += 30;
      flags.push(`GPS location is ~${Math.round(distance)} km from Philadelphia.`);
    }
  }

  const software = String(exif.software || '').toLowerCase();
  if (software) {
    const matched = EDITING_SOFTWARE.find((tool) => software.includes(tool));
    if (matched) {
      score += 40;
      flags.push(`Editing software detected in EXIF: "${exif.software}".`);
    }
  }

  return {
    tamperScore: Math.min(100, Math.max(1, score || 1)),
    flags,
  };
}

export async function analyzePhotoBuffer(buffer) {
  let parsed = null;
  try {
    parsed = await exifr.parse(buffer, { gps: true, reviveValues: true });
  } catch (error) {
    console.warn('EXIF parse failed:', error.message);
  }

  const exif = pickExifFields(parsed);
  const { tamperScore, flags } = computeTamperScore(exif);
  const aiSummary = await generateAiSummary(exif, tamperScore, flags);

  return { exif, tamperScore, aiSummary, flags };
}

async function generateAiSummary(exif, tamperScore, flags) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return flags.length
      ? flags.join(' ')
      : 'No suspicious EXIF flags detected.';
  }

  const prompt = `You are reviewing photo metadata for a Philadelphia marketplace transaction dispute system.
Analyze this EXIF data and tamper score, then write a plain-English summary (2-4 sentences) of any red flags for an admin reviewer.

EXIF: ${JSON.stringify(exif, null, 2)}
Tamper score: ${tamperScore}/100 (higher = more suspicious)
Automated flags: ${flags.length ? flags.join('; ') : 'None'}

Be concise and factual. Do not speculate beyond the metadata.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn('Groq API error:', body);
      return flags.length ? flags.join(' ') : 'Photo metadata appears normal.';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'Analysis unavailable.';
  } catch (error) {
    console.warn('Groq request failed:', error.message);
    return flags.length ? flags.join(' ') : 'Photo metadata appears normal.';
  }
}

import { CACHE_TTL_MS } from './constants.js';

const cache = new Map();

function parseTleText(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const satellites = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    satellites.push({
      name: lines[i],
      tleLine1: lines[i + 1],
      tleLine2: lines[i + 2],
    });
  }
  return satellites;
}

function parseNoradId(tleLine1) {
  return tleLine1.substring(2, 7).trim();
}

function parseIntlDesignator(tleLine1) {
  return tleLine1.substring(9, 17).trim();
}

function parseEpoch(tleLine1) {
  const yearStr = tleLine1.substring(18, 20).trim();
  const dayStr = tleLine1.substring(20, 32).trim();
  const year = parseInt(yearStr, 10);
  return {
    epochYear: year < 57 ? 2000 + year : 1900 + year,
    epochDay: parseFloat(dayStr),
  };
}

async function fetchTle(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CelesTrak returned ${res.status}`);
  }
  return res.text();
}

export async function getTleByGroup(groupName) {
  const cacheKey = `group:${groupName}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${groupName}&FORMAT=tle`;
    const text = await fetchTle(url);
    const data = parseTleText(text);
    cache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (err) {
    if (cached) return cached.data; // return stale cache
    throw err;
  }
}

export async function getTleByCatalogNumber(noradId) {
  const cacheKey = `catnr:${noradId}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=tle`;
    const text = await fetchTle(url);
    const data = parseTleText(text);
    if (data.length === 0) {
      cache.set(cacheKey, { data: null, timestamp: now });
      return null;
    }
    const sat = data[0];
    cache.set(cacheKey, { data: sat, timestamp: now });
    return sat;
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}

export { parseNoradId, parseIntlDesignator, parseEpoch };

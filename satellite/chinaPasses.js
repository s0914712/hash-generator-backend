import {
  TAIWAN,
  TAIWAN_UTC_OFFSET_MINUTES,
  MIN_ELEVATION_DEG,
  CHINA_SERIES,
  CHINA_PASSES_MAX_SATELLITES,
  SATELLITE_SERIES,
} from './constants.js';
import { getTleByName, parseNoradId } from './tleCache.js';
import { getPassWindows, getMeanMotion } from './propagator.js';

const TW_OFFSET_MS = TAIWAN_UTC_OFFSET_MINUTES * 60 * 1000;
const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Satellites slower than this are geostationary/IGSO: they sit over the region
// instead of passing, so they get their own bucket rather than a time window.
const GEO_MEAN_MOTION = 1.2;

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Taiwan is UTC+8 year-round, so shifting the instant and reading UTC fields
// gives local calendar values without pulling in a timezone database.
function taipei(ms) {
  return new Date(ms + TW_OFFSET_MS);
}

function localDate(ms) {
  return taipei(ms).toISOString().slice(0, 10);
}

function localTime(ms) {
  const d = taipei(ms);
  return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
}

function localCompact(ms) {
  return localTime(ms).replace(':', '');
}

// Local midnight (as a UTC timestamp) of the day containing refMs
function taipeiDayStart(refMs) {
  const d = taipei(refMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - TW_OFFSET_MS;
}

function hourLabel(hour) {
  return pad2(hour) + '00-' + pad2(hour + 1) + '00';
}

function compass(azimuth) {
  if (azimuth == null) return null;
  const normalized = ((azimuth % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 22.5) % 16];
}

function emptyHours() {
  const hours = [];
  for (let h = 0; h < 24; h++) {
    hours.push({ hour: h, label: hourLabel(h), passes: 0, coverageMinutes: 0, satellites: [] });
  }
  return hours;
}

// Round-robin across the series so a huge series (YAOGAN) cannot crowd out the rest.
function selectSatellites(fetched, limit) {
  const picked = [];
  const seen = new Set();
  let index = 0;
  let anyAtIndex = true;

  while (picked.length < limit && anyAtIndex) {
    anyAtIndex = false;
    for (const entry of fetched) {
      const sat = entry.satellites[index];
      if (!sat) continue;
      anyAtIndex = true;
      const noradId = parseNoradId(sat.tleLine1);
      if (seen.has(noradId)) continue;
      seen.add(noradId);
      picked.push({
        name: sat.name,
        tleLine1: sat.tleLine1,
        tleLine2: sat.tleLine2,
        series: entry.series,
        noradId,
      });
      if (picked.length >= limit) break;
    }
    index++;
  }
  return picked;
}

function describePass(sat, window) {
  const startAz = compass(window.startAzimuth);
  const endAz = compass(window.endAzimuth);
  const startHour = taipei(window.startMs).getUTCHours();
  const endHour = taipei(window.endMs).getUTCHours();

  return {
    name: sat.name,
    noradId: sat.noradId,
    series: sat.series,
    start: new Date(window.startMs).toISOString(),
    end: new Date(window.endMs).toISOString(),
    startLocal: localTime(window.startMs),
    endLocal: localTime(window.endMs),
    // "0812-0824" — the exact window, and the whole-hour band it falls in
    window: localCompact(window.startMs) + '-' + localCompact(window.endMs),
    hourWindow: pad2(startHour) + '00-' + pad2(endHour + 1) + '00',
    durationSeconds: window.durationSeconds,
    maxElevation: window.maxElevation,
    maxElevationLocal: localTime(window.maxElevationMs),
    startAzimuth: window.startAzimuth,
    endAzimuth: window.endAzimuth,
    direction: startAz && endAz ? startAz + ' → ' + endAz : null,
    truncatedEnd: window.truncatedEnd || undefined,
  };
}

// Spread a pass across the hour buckets of its day.
function addToHours(hours, dayStartMs, pass, windowStartMs, windowEndMs) {
  const from = Math.max(windowStartMs, dayStartMs);
  const to = Math.min(windowEndMs, dayStartMs + DAY_MS);
  if (to <= from) return;

  const firstHour = Math.floor((from - dayStartMs) / HOUR_MS);
  const lastHour = Math.min(23, Math.floor((to - dayStartMs - 1) / HOUR_MS));

  for (let h = firstHour; h <= lastHour; h++) {
    const bucketStart = dayStartMs + h * HOUR_MS;
    const overlap = Math.min(to, bucketStart + HOUR_MS) - Math.max(from, bucketStart);
    if (overlap <= 0) continue;
    const bucket = hours[h];
    bucket.passes++;
    bucket.coverageMinutes += overlap / 60000;
    if (bucket.satellites.indexOf(pass.name) === -1) bucket.satellites.push(pass.name);
    bucket.satelliteCount = bucket.satellites.length;
  }
}

function summarize(day) {
  let busiest = null;
  for (const bucket of day.hours) {
    bucket.coverageMinutes = parseFloat(bucket.coverageMinutes.toFixed(1));
    if (!busiest || bucket.passes > busiest.passes) busiest = bucket;
  }
  day.passCount = day.passes.length;
  day.satelliteCount = new Set(day.passes.map(p => p.noradId)).size;
  day.coverageMinutes = parseFloat(
    day.passes.reduce((sum, p) => sum + p.durationSeconds / 60, 0).toFixed(1)
  );
  day.busiestHour = busiest && busiest.passes > 0
    ? { hour: busiest.hour, label: busiest.label, passes: busiest.passes }
    : null;
  return day;
}

/**
 * Build the "when do Chinese satellites cross Taiwan today and tomorrow"
 * report: concrete rise/set windows in Taipei local time, plus per-hour
 * aggregates for a timeline view.
 */
export async function buildChinaPassReport(options = {}) {
  const minElevation = options.minElevation != null ? options.minElevation : MIN_ELEVATION_DEG;
  const limit = options.limit || CHINA_PASSES_MAX_SATELLITES;
  const seriesList = options.series ? [options.series] : CHINA_SERIES;

  const fetched = await Promise.all(
    seriesList.map(series =>
      getTleByName(series)
        .then(satellites => ({ series, satellites: satellites || [] }))
        .catch(() => ({ series, satellites: [], failed: true }))
    )
  );

  const available = fetched.reduce((sum, entry) => sum + entry.satellites.length, 0);
  const failedSeries = fetched.filter(e => e.failed).map(e => e.series);
  const satellites = selectSatellites(fetched, limit);

  const todayStart = taipeiDayStart(Date.now());
  const tomorrowStart = todayStart + DAY_MS;
  const scanEnd = tomorrowStart + DAY_MS;

  const days = [
    { label: 'today', date: localDate(todayStart), startMs: todayStart, passes: [], hours: emptyHours() },
    { label: 'tomorrow', date: localDate(tomorrowStart), startMs: tomorrowStart, passes: [], hours: emptyHours() },
  ];
  const alwaysVisible = [];

  for (const sat of satellites) {
    const meanMotion = getMeanMotion(sat.tleLine2);
    if (!meanMotion) continue;

    const periodMinutes = 1440 / meanMotion;
    // A pass can never be shorter than a fraction of the orbital period, so
    // scaling the scan step to the period keeps fast LEO accurate and slow
    // orbits cheap.
    const coarseStepSeconds = Math.max(20, Math.min(600, Math.round(periodMinutes * 0.35)));

    const windows = getPassWindows(sat.tleLine1, sat.tleLine2, todayStart, scanEnd, {
      minElevation,
      coarseStepSeconds,
    });

    // Geostationary/IGSO craft that never drop below the cutoff are parked
    // over the region rather than passing; a 48 h "window" would be noise.
    if (meanMotion < GEO_MEAN_MOTION && windows.length === 1 &&
        windows[0].startMs <= todayStart && windows[0].truncatedEnd) {
      alwaysVisible.push({
        name: sat.name,
        noradId: sat.noradId,
        series: sat.series,
        seriesLabel: SATELLITE_SERIES[sat.series] || sat.series,
        meanMotion,
        maxElevation: windows[0].maxElevation,
      });
      continue;
    }

    for (const window of windows) {
      const pass = describePass(sat, window);
      const day = window.startMs < tomorrowStart ? days[0] : days[1];
      pass.crossesMidnight = window.endMs >= day.startMs + DAY_MS || undefined;
      day.passes.push(pass);
      addToHours(day.hours, day.startMs, pass, window.startMs, window.endMs);
      // A pass that starts before midnight also occupies the next day's hours.
      if (day === days[0] && window.endMs > tomorrowStart) {
        addToHours(days[1].hours, days[1].startMs, pass, window.startMs, window.endMs);
      }
    }
  }

  for (const day of days) {
    day.passes.sort((a, b) => new Date(a.start) - new Date(b.start));
    summarize(day);
    delete day.startMs;
  }

  alwaysVisible.sort((a, b) => b.maxElevation - a.maxElevation);

  return {
    observer: { latitude: TAIWAN.latitude, longitude: TAIWAN.longitude, location: 'Taiwan' },
    timezone: { name: 'Asia/Taipei', label: 'UTC+8', utcOffsetMinutes: TAIWAN_UTC_OFFSET_MINUTES },
    minElevation,
    seriesLabels: seriesList.reduce((map, name) => {
      map[name] = SATELLITE_SERIES[name] || name;
      return map;
    }, {}),
    source: {
      country: 'China',
      series: seriesList,
      failedSeries,
      satellitesAvailable: available,
      satellitesTracked: satellites.length,
      truncated: satellites.length < available,
    },
    days,
    alwaysVisible,
    generatedAt: new Date().toISOString(),
  };
}

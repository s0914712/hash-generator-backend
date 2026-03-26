import { Router } from 'express';
import { SATELLITE_GROUPS, DEFAULT_GROUP, TAIWAN, SATELLITE_SERIES } from './constants.js';
import { getTleByGroup, getTleByCatalogNumber, getTleByName, parseNoradId, parseIntlDesignator, parseEpoch } from './tleCache.js';
import { getPosition, getOrbitPath, getPasses, countPasses } from './propagator.js';

const router = Router();

// GET /satellites - List satellites in a group
router.get('/', async (req, res) => {
  try {
    const group = req.query.group || DEFAULT_GROUP;
    const search = req.query.search;
    const series = req.query.series;

    let satellites;
    let sourceLabel;
    if (series) {
      if (!SATELLITE_SERIES[series]) {
        return res.status(400).json({
          error: 'Unknown satellite series',
          validSeries: SATELLITE_SERIES,
        });
      }
      satellites = await getTleByName(series);
      sourceLabel = series + ' - ' + SATELLITE_SERIES[series];
    } else {
      if (!SATELLITE_GROUPS[group]) {
        return res.status(400).json({
          error: 'Unknown satellite group',
          validGroups: Object.keys(SATELLITE_GROUPS),
        });
      }
      satellites = await getTleByGroup(group);
      sourceLabel = group;
    }
    let results = satellites.map(sat => {
      const { epochYear, epochDay } = parseEpoch(sat.tleLine1);
      return {
        name: sat.name,
        noradId: parseNoradId(sat.tleLine1),
        intlDesignator: parseIntlDesignator(sat.tleLine1),
        epochYear,
        epochDay,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(s => s.name.toLowerCase().includes(q));
    }

    res.json({ group: sourceLabel, count: results.length, satellites: results });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch TLE data from CelesTrak' });
  }
});

// Country classification by satellite name patterns
const COUNTRY_PATTERNS = [
  { label: 'USA', patterns: ['GPS', 'GOES', 'NOAA', 'TDRS', 'LANDSAT', 'STARLINK', 'IRIDIUM', 'ORBCOMM', 'GLOBALSTAR'] },
  { label: 'China', patterns: ['YAOGAN', 'GAOFEN', 'BEIDOU', 'FENGYUN', 'TIANGONG', 'SHENZHOU', 'TIANZHOU', 'ZHONGXING', 'SHIYAN', 'SHIJIAN', 'CZ-'] },
  { label: 'EU', patterns: ['GALILEO', 'METEOSAT', 'SENTINEL', 'ENVISAT', 'AEOLUS', 'SWARM'] },
  { label: 'Japan', patterns: ['HIMAWARI', 'MICHIBIKI', 'ALOS', 'QZS-'] },
  { label: 'Russia', patterns: ['COSMOS', 'GLONASS', 'METEOR', 'RESURS'] },
  { label: 'India', patterns: ['CARTOSAT', 'INSAT', 'IRNSS', 'RESOURCESAT'] },
];

function classifyCountry(name) {
  var upper = name.toUpperCase();
  for (var i = 0; i < COUNTRY_PATTERNS.length; i++) {
    for (var j = 0; j < COUNTRY_PATTERNS[i].patterns.length; j++) {
      if (upper.indexOf(COUNTRY_PATTERNS[i].patterns[j]) >= 0) return COUNTRY_PATTERNS[i].label;
    }
  }
  return 'Other';
}

// Summary cache (heavy computation, cache for 3 hours)
let summaryCache = null;
let summaryCacheTime = 0;
const SUMMARY_TTL = 3 * 60 * 60 * 1000;

// GET /satellites/pass-summary - Daily pass summary over Taiwan
router.get('/pass-summary', async (req, res) => {
  const now = Date.now();
  if (summaryCache && (now - summaryCacheTime) < SUMMARY_TTL) {
    return res.json(summaryCache);
  }

  try {
    // Use 'active' group for broad coverage
    // Also fetch Chinese satellites specifically to ensure China coverage
    const [activeSats, chinaSats] = await Promise.all([
      getTleByGroup('active'),
      getTleByName('YAOGAN').catch(() => []),
    ]);

    // Evenly sample from active group (spread across the full list for country diversity)
    const maxActive = 120;
    const step = Math.max(1, Math.floor(activeSats.length / maxActive));
    const sampled = [];
    const seenNames = new Set();
    for (let i = 0; i < activeSats.length && sampled.length < maxActive; i += step) {
      sampled.push(activeSats[i]);
      seenNames.add(activeSats[i].name);
    }
    // Add Chinese satellites not already in sample (up to 30)
    let chinaAdded = 0;
    for (const cs of chinaSats) {
      if (chinaAdded >= 30) break;
      if (!seenNames.has(cs.name)) { sampled.push(cs); seenNames.add(cs.name); chinaAdded++; }
    }
    const sample = sampled;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000);

    const today = { total: 0, byCountry: {} };
    const tomorrow = { total: 0, byCountry: {} };

    for (const sat of sample) {
      const country = classifyCountry(sat.name);
      const todayPasses = countPasses(sat.tleLine1, sat.tleLine2, todayStart, 24);
      const tomorrowPasses = countPasses(sat.tleLine1, sat.tleLine2, tomorrowStart, 24);

      if (todayPasses > 0) {
        today.total++;
        today.byCountry[country] = (today.byCountry[country] || 0) + 1;
      }
      if (tomorrowPasses > 0) {
        tomorrow.total++;
        tomorrow.byCountry[country] = (tomorrow.byCountry[country] || 0) + 1;
      }
    }

    const result = {
      observer: { latitude: TAIWAN.latitude, longitude: TAIWAN.longitude, location: 'Taiwan' },
      sampleSize: sample.length,
      today: { date: todayStart.toISOString().slice(0, 10), satellitesWithPasses: today.total, byCountry: today.byCountry },
      tomorrow: { date: tomorrowStart.toISOString().slice(0, 10), satellitesWithPasses: tomorrow.total, byCountry: tomorrow.byCountry },
      cachedAt: new Date().toISOString(),
    };

    summaryCache = result;
    summaryCacheTime = now;
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Failed to compute pass summary' });
  }
});

// GET /satellites/series - List available satellite series
router.get('/series', (req, res) => {
  res.json({ series: SATELLITE_SERIES });
});

// GET /satellites/:id/position - Current position
router.get('/:id/position', async (req, res) => {
  try {
    const sat = await getTleByCatalogNumber(req.params.id);
    if (!sat) {
      return res.status(404).json({ error: 'Satellite not found', noradId: req.params.id });
    }

    const date = req.query.at ? new Date(req.query.at) : new Date();
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date format for "at" parameter' });
    }

    const position = getPosition(sat.tleLine1, sat.tleLine2, date);
    if (!position) {
      return res.status(422).json({ error: 'Propagation failed - TLE data may be too old' });
    }

    res.json({
      noradId: req.params.id,
      name: sat.name,
      position,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch TLE data from CelesTrak' });
  }
});

// GET /satellites/:id/passes - Predict passes over Taiwan
router.get('/:id/passes', async (req, res) => {
  try {
    const sat = await getTleByCatalogNumber(req.params.id);
    if (!sat) {
      return res.status(404).json({ error: 'Satellite not found', noradId: req.params.id });
    }

    const hours = Math.min(parseInt(req.query.hours, 10) || 24, 72);
    const minElevation = parseFloat(req.query.minElevation) || 10;
    const startDate = new Date();

    const passes = getPasses(sat.tleLine1, sat.tleLine2, startDate, hours, 30, minElevation);

    res.json({
      noradId: req.params.id,
      name: sat.name,
      observer: {
        latitude: TAIWAN.latitude,
        longitude: TAIWAN.longitude,
        location: 'Taiwan',
      },
      passes,
      predictionWindow: {
        start: startDate.toISOString(),
        end: new Date(startDate.getTime() + hours * 3600 * 1000).toISOString(),
      },
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch TLE data from CelesTrak' });
  }
});

// GET /satellites/:id/orbit - Orbit path points
router.get('/:id/orbit', async (req, res) => {
  try {
    const sat = await getTleByCatalogNumber(req.params.id);
    if (!sat) {
      return res.status(404).json({ error: 'Satellite not found', noradId: req.params.id });
    }

    const duration = Math.min(parseInt(req.query.duration, 10) || 90, 360);
    const step = Math.max(parseInt(req.query.step, 10) || 1, 1);

    const path = getOrbitPath(sat.tleLine1, sat.tleLine2, duration, step);
    if (path.length === 0) {
      return res.status(422).json({ error: 'Propagation failed - TLE data may be too old' });
    }

    res.json({
      noradId: req.params.id,
      name: sat.name,
      duration,
      step,
      path,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch TLE data from CelesTrak' });
  }
});

export default router;

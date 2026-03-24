import { Router } from 'express';
import { SATELLITE_GROUPS, DEFAULT_GROUP, TAIWAN, SATELLITE_SERIES } from './constants.js';
import { getTleByGroup, getTleByCatalogNumber, getTleByName, parseNoradId, parseIntlDesignator, parseEpoch } from './tleCache.js';
import { getPosition, getOrbitPath, getPasses } from './propagator.js';

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

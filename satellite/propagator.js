import {
  twoline2satrec,
  propagate,
  eciToGeodetic,
  eciToEcf,
  ecfToLookAngles,
  gstime,
  degreesLat,
  degreesLong,
} from 'satellite.js';
import { TAIWAN, MIN_ELEVATION_DEG } from './constants.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function getPosition(tleLine1, tleLine2, date = new Date()) {
  const satrec = twoline2satrec(tleLine1, tleLine2);
  const pv = propagate(satrec, date);
  if (!pv.position || typeof pv.position === 'boolean') return null;

  const gmst = gstime(date);
  const geo = eciToGeodetic(pv.position, gmst);

  return {
    latitude: degreesLat(geo.latitude),
    longitude: degreesLong(geo.longitude),
    altitude: geo.height,
    velocity: Math.sqrt(
      pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2
    ),
    timestamp: date.toISOString(),
  };
}

export function getOrbitPath(tleLine1, tleLine2, durationMinutes = 90, stepMinutes = 1) {
  const points = [];
  const start = new Date();
  const steps = Math.floor(durationMinutes / stepMinutes);

  for (let i = 0; i <= steps; i++) {
    const date = new Date(start.getTime() + i * stepMinutes * 60 * 1000);
    const pos = getPosition(tleLine1, tleLine2, date);
    if (pos) {
      points.push({
        latitude: pos.latitude,
        longitude: pos.longitude,
        altitude: pos.altitude,
        timestamp: pos.timestamp,
      });
    }
  }
  return points;
}

export function getPasses(tleLine1, tleLine2, startDate = new Date(), durationHours = 24, stepSeconds = 30, minElevation = MIN_ELEVATION_DEG) {
  const satrec = twoline2satrec(tleLine1, tleLine2);
  const observerGd = {
    latitude: TAIWAN.latitudeRad,
    longitude: TAIWAN.longitudeRad,
    height: TAIWAN.height,
  };

  const endTime = startDate.getTime() + durationHours * 3600 * 1000;
  const passes = [];
  let inPass = false;
  let currentPass = null;

  for (let t = startDate.getTime(); t <= endTime; t += stepSeconds * 1000) {
    const date = new Date(t);
    const pv = propagate(satrec, date);
    if (!pv.position || typeof pv.position === 'boolean') continue;

    const gmst = gstime(date);
    const ecf = eciToEcf(pv.position, gmst);
    const lookAngles = ecfToLookAngles(observerGd, ecf);
    const elevationDeg = lookAngles.elevation * RAD2DEG;
    const azimuthDeg = lookAngles.azimuth * RAD2DEG;

    if (elevationDeg >= minElevation) {
      if (!inPass) {
        inPass = true;
        currentPass = {
          startTime: date.toISOString(),
          startAzimuth: parseFloat(azimuthDeg.toFixed(1)),
          maxElevation: elevationDeg,
          maxElevationTime: date.toISOString(),
          endTime: null,
          endAzimuth: null,
          durationSeconds: 0,
        };
      }
      if (elevationDeg > currentPass.maxElevation) {
        currentPass.maxElevation = elevationDeg;
        currentPass.maxElevationTime = date.toISOString();
      }
      currentPass.endTime = date.toISOString();
      currentPass.endAzimuth = parseFloat(azimuthDeg.toFixed(1));
    } else if (inPass) {
      currentPass.maxElevation = parseFloat(currentPass.maxElevation.toFixed(1));
      currentPass.durationSeconds = Math.round(
        (new Date(currentPass.endTime).getTime() - new Date(currentPass.startTime).getTime()) / 1000
      );
      passes.push(currentPass);
      inPass = false;
      currentPass = null;
    }
  }

  // Close any pass still in progress at the end
  if (inPass && currentPass) {
    currentPass.maxElevation = parseFloat(currentPass.maxElevation.toFixed(1));
    currentPass.durationSeconds = Math.round(
      (new Date(currentPass.endTime).getTime() - new Date(currentPass.startTime).getTime()) / 1000
    );
    passes.push(currentPass);
  }

  return passes;
}

// Quick pass count — uses larger step (5 min) for speed
export function countPasses(tleLine1, tleLine2, startDate, durationHours = 24, minElevation = MIN_ELEVATION_DEG) {
  try {
    const satrec = twoline2satrec(tleLine1, tleLine2);
    const observerGd = {
      latitude: TAIWAN.latitudeRad,
      longitude: TAIWAN.longitudeRad,
      height: TAIWAN.height,
    };

    const endTime = startDate.getTime() + durationHours * 3600 * 1000;
    let passCount = 0;
    let inPass = false;

    for (let t = startDate.getTime(); t <= endTime; t += 300 * 1000) {
      const date = new Date(t);
      const pv = propagate(satrec, date);
      if (!pv.position || typeof pv.position === 'boolean') continue;

      const gmst = gstime(date);
      const ecf = eciToEcf(pv.position, gmst);
      const lookAngles = ecfToLookAngles(observerGd, ecf);
      const elevationDeg = lookAngles.elevation * RAD2DEG;

      if (elevationDeg >= minElevation) {
        if (!inPass) { inPass = true; passCount++; }
      } else {
        inPass = false;
      }
    }
    return passCount;
  } catch (e) {
    return 0;
  }
}

// --- Pass windows with refined rise/set times -------------------------------

const OBSERVER_GD = {
  latitude: TAIWAN.latitudeRad,
  longitude: TAIWAN.longitudeRad,
  height: TAIWAN.height,
};

// Mean motion in revolutions per day (TLE line 2, columns 53-63)
export function getMeanMotion(tleLine2) {
  const value = parseFloat(tleLine2.substring(52, 63));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function lookAnglesAt(satrec, timeMs) {
  const date = new Date(timeMs);
  const pv = propagate(satrec, date);
  if (!pv.position || typeof pv.position === 'boolean') return null;
  const ecf = eciToEcf(pv.position, gstime(date));
  const la = ecfToLookAngles(OBSERVER_GD, ecf);
  return {
    elevation: la.elevation * RAD2DEG,
    azimuth: la.azimuth * RAD2DEG,
  };
}

// Bisect between a time below the horizon threshold and one above it.
// Returns the boundary time at which elevation reaches minElevation.
function bisectCrossing(satrec, belowMs, aboveMs, minElevation, toleranceMs = 2000) {
  let low = belowMs;
  let high = aboveMs;
  while (Math.abs(high - low) > toleranceMs) {
    const mid = (low + high) / 2;
    const la = lookAnglesAt(satrec, mid);
    if (!la) break;
    if (la.elevation >= minElevation) high = mid;
    else low = mid;
  }
  return high;
}

/**
 * Scan a time range and return every window where the satellite stays above
 * minElevation, with rise/set times refined by bisection.
 *
 * The coarse step only has to be small enough not to step over a whole pass;
 * boundaries are then sharpened to ~2 s, so the reported window is accurate
 * even though most of the scan is cheap.
 */
export function getPassWindows(tleLine1, tleLine2, startMs, endMs, options = {}) {
  const minElevation = options.minElevation != null ? options.minElevation : MIN_ELEVATION_DEG;
  const coarseStepSeconds = options.coarseStepSeconds || 60;
  const coarseStepMs = coarseStepSeconds * 1000;

  let satrec;
  try {
    satrec = twoline2satrec(tleLine1, tleLine2);
  } catch (e) {
    return [];
  }
  if (!satrec || satrec.error) return [];

  const windows = [];
  let prevMs = null;
  let prevAbove = false;
  let riseMs = null;

  const closeWindow = (setMs, truncatedEnd) => {
    // Sample the window to find the culmination point and boundary azimuths.
    // A fixed number of samples keeps short LEO passes precise without making
    // a geostationary window that spans the whole scan expensive.
    const sampleStepMs = Math.max(2000, Math.min(60000, (setMs - riseMs) / 120));
    let maxElevation = -90;
    let maxElevationMs = riseMs;
    for (let t = riseMs; t <= setMs; t += sampleStepMs) {
      const la = lookAnglesAt(satrec, t);
      if (la && la.elevation > maxElevation) {
        maxElevation = la.elevation;
        maxElevationMs = t;
      }
    }
    const riseLook = lookAnglesAt(satrec, riseMs);
    const setLook = lookAnglesAt(satrec, setMs);
    windows.push({
      startMs: riseMs,
      endMs: setMs,
      durationSeconds: Math.round((setMs - riseMs) / 1000),
      maxElevation: parseFloat(Math.max(maxElevation, minElevation).toFixed(1)),
      maxElevationMs,
      startAzimuth: riseLook ? parseFloat(riseLook.azimuth.toFixed(1)) : null,
      endAzimuth: setLook ? parseFloat(setLook.azimuth.toFixed(1)) : null,
      truncatedStart: riseMs <= startMs,
      truncatedEnd: !!truncatedEnd,
    });
  };

  for (let t = startMs; t <= endMs; t += coarseStepMs) {
    const la = lookAnglesAt(satrec, t);
    if (!la) { prevMs = t; continue; }
    const above = la.elevation >= minElevation;

    if (above && !prevAbove) {
      riseMs = prevMs == null ? t : bisectCrossing(satrec, prevMs, t, minElevation);
    } else if (!above && prevAbove && riseMs != null) {
      closeWindow(bisectCrossing(satrec, t, prevMs, minElevation), false);
      riseMs = null;
    }

    prevAbove = above;
    prevMs = t;
  }

  // A pass still in progress when the scan ends is reported as truncated.
  if (prevAbove && riseMs != null && prevMs != null) {
    closeWindow(prevMs, true);
  }

  return windows;
}

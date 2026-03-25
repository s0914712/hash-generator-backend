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

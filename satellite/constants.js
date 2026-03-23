// Taiwan observer location
export const TAIWAN = {
  latitude: 23.5,
  longitude: 121.0,
  latitudeRad: 23.5 * Math.PI / 180,
  longitudeRad: 121.0 * Math.PI / 180,
  height: 0.0, // km above sea level
};

// Minimum elevation angle (degrees) for a satellite to be considered visible
export const MIN_ELEVATION_DEG = 10;

// TLE cache TTL: 2 hours in milliseconds
export const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// CelesTrak satellite groups
export const SATELLITE_GROUPS = {
  stations: 'stations',
  weather: 'weather',
  starlink: 'starlink',
  'gps-ops': 'gps-ops',
  galileo: 'galileo',
  active: 'active',
};

export const DEFAULT_GROUP = 'stations';

// Country codes supported by CelesTrak
export const COUNTRY_CODES = {
  'US': 'United States',
  'PRC': 'China',
  'CIS': 'Russia/CIS',
  'JPN': 'Japan',
  'IND': 'India',
  'ESA': 'ESA',
  'IT': 'Italy',
  'FR': 'France',
  'DE': 'Germany',
  'UK': 'United Kingdom',
  'CA': 'Canada',
  'KR': 'South Korea',
  'TW': 'Taiwan',
  'IL': 'Israel',
  'BR': 'Brazil',
  'AU': 'Australia',
};

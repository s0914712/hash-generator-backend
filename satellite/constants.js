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

// Satellite series searchable via CelesTrak NAME parameter
export const SATELLITE_SERIES = {
  // China
  'YAOGAN': '遥感 (Remote Sensing)',
  'GAOFEN': '高分 (High Resolution)',
  'BEIDOU': '北斗 (Navigation)',
  'FENGYUN': '风云 (Weather)',
  'TIANGONG': '天宫 (Space Station)',
  'SHENZHOU': '神舟 (Crewed)',
  'TIANZHOU': '天舟 (Cargo)',
  'ZHONGXING': '中星 (Communications)',
  'SHIYAN': '实验 (Experimental)',
  'SHIJIAN': '实践 (Practice)',
  'JILIN': '吉林 (Commercial Remote Sensing)',
  'YUNHAI': '云海 (Weather/Environment)',
  'HAIYANG': '海洋 (Ocean Monitoring)',
  'TIANHUI': '天绘 (Mapping)',
  'HUANJING': '环境 (Environment/Disaster)',
  'ZIYUAN': '资源 (Land Resources)',
  'TIANTONG': '天通 (Mobile Comms)',
  'CHUANGXIN': '创新 (Innovation/Tech Demo)',
  // Japan
  'HIMAWARI': 'ひまわり (Weather)',
  'MICHIBIKI': 'みちびき (Navigation)',
  'ALOS': 'ALOS (Earth Obs)',
  // USA
  'GOES': 'GOES (Weather)',
  'LANDSAT': 'Landsat (Earth Obs)',
  'NOAA': 'NOAA (Weather)',
  'TDRS': 'TDRS (Relay)',
  // India
  'CARTOSAT': 'Cartosat (Earth Obs)',
  'INSAT': 'INSAT (Communications)',
  // International
  'STARLINK': 'Starlink (Internet)',
  'ONEWEB': 'OneWeb (Internet)',
  'IRIDIUM': 'Iridium (Communications)',
  'COSMOS': 'Cosmos (Russia)',
};

// src/data/nasa/lightTime.js
// Earth-Mars distance and one-way radio delay (light time) for any date.
//
// Method: NASA/JPL "Approximate Positions of the Planets", Keplerian elements
// and rates, Table 1 (mean ecliptic and equinox of J2000, valid 1800-2050 AD).
// Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html
// Data label: approximation (computed from NASA/JPL elements). For Mars, JPL
// gives nominal distance errors of about 25,000 km in this interval, which is
// about 0.1 s of light time: far below what the game displays.
//
// Pure functions, no dependencies, safe in Node and the browser.

export const AU_KM = 149597870.7;
export const C_KM_S = 299792.458;
export const AU_LIGHT_SECONDS = AU_KM / C_KM_S; // ~499.005 s
export const MARS_SOL_SECONDS = 88775.244;      // 24 h 39 min 35.244 s
const J2000_JD = 2451545.0;
const DEG = Math.PI / 180;

// [a (au), e, I (deg), L (deg), long.peri (deg), long.node (deg)] at J2000,
// then the same six rates per Julian century.
const ELEMENTS = {
  earthMoonBary: {
    base: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]
  },
  mars: {
    base: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]
  }
};

export function dateToJulianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function solveKepler(M, e) {
  // M in radians; returns eccentric anomaly E in radians.
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 20; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// Heliocentric ecliptic J2000 position in au: { x, y, z }.
export function heliocentricPosition(body, date) {
  const el = ELEMENTS[body];
  if (!el) throw new Error(`Unknown body: ${body}`);
  const T = (dateToJulianDay(date) - J2000_JD) / 36525;
  const [a, e, I, L, peri, node] = el.base.map((v, i) => v + el.rate[i] * T);

  const omega = peri - node;                        // argument of perihelion
  let M = (L - peri) % 360;                         // mean anomaly, -180..180
  if (M > 180) M -= 360;
  if (M < -180) M += 360;

  const E = solveKepler(M * DEG, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const cw = Math.cos(omega * DEG), sw = Math.sin(omega * DEG);
  const cO = Math.cos(node * DEG), sO = Math.sin(node * DEG);
  const cI = Math.cos(I * DEG), sI = Math.sin(I * DEG);

  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: (sw * sI) * xp + (cw * sI) * yp
  };
}

// Main entry point.
// Returns { distanceAu, distanceKm, oneWaySeconds, oneWayMinutes, roundTripMinutes, sunAngleDeg }.
// sunAngleDeg: angle between the Sun and Mars as seen from Earth (solar elongation).
// Near 0 deg the Sun sits between the planets (solar conjunction); not used by gameplay yet.
export function earthMarsLink(date) {
  const earth = heliocentricPosition('earthMoonBary', date);
  const mars = heliocentricPosition('mars', date);
  const dx = mars.x - earth.x, dy = mars.y - earth.y, dz = mars.z - earth.z;
  const distanceAu = Math.hypot(dx, dy, dz);
  const oneWaySeconds = distanceAu * AU_LIGHT_SECONDS;

  const earthSunDist = Math.hypot(earth.x, earth.y, earth.z);
  const cosAngle = -(earth.x * dx + earth.y * dy + earth.z * dz) / (earthSunDist * distanceAu);
  const sunAngleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) / DEG;

  return {
    distanceAu,
    distanceKm: distanceAu * AU_KM,
    oneWaySeconds,
    oneWayMinutes: oneWaySeconds / 60,
    roundTripMinutes: (2 * oneWaySeconds) / 60,
    sunAngleDeg
  };
}

// Game helpers -------------------------------------------------------------

// Story start (gameplay value): Sol 1 dawn on 15 June 2042, a few months after
// the Feb 2042 Mars opposition, when a crew launched in the 2041 window would arrive.
// The delay then grows from about 13.2 min (Sol 1) to 14.1 min (Sol 15, Lab online)
// and 14.5 min (Sol 20), matching the "14 minutes" in the SCENARIO texts.
export const CAMPAIGN_START_UTC = '2042-06-15T00:00:00Z';

// sol may be fractional (e.g. 3.5 = midday of Sol 3). Sol 1 starts at the campaign start.
export function solToDate(sol, campaignStartUtc = CAMPAIGN_START_UTC) {
  const start = new Date(campaignStartUtc).getTime();
  return new Date(start + (sol - 1) * MARS_SOL_SECONDS * 1000);
}

export function earthMarsLinkForSol(sol, campaignStartUtc = CAMPAIGN_START_UTC) {
  return earthMarsLink(solToDate(sol, campaignStartUtc));
}

// "13 min 40 s" for HUD/ASTRA. Rounds to the nearest 10 s so the number
// doesn't flicker every frame.
export function formatDelay(oneWaySeconds) {
  const s = Math.round(oneWaySeconds / 10) * 10;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} s`;
}

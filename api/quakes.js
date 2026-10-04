// GET /api/quakes: the earthquakes of the past week of magnitude 2.5 and over, worldwide, from the USGS (public domain: "Earthquakes: USGS"),
// compacted to arrays [time (s since 1970), latitude, longitude, depth (km), magnitude, place], newest first. The page draws them as rings
// on the real Earth (0.15). The feed is updated every minute; here it is cached at the edge for 5 minutes. Outside the United States
// the USGS lists mostly the quakes of magnitude 4 and over, so a quiet map somewhere is not proof of a quiet crust.
// No input is taken from the request (query strings are refused: see _lib/guard.js).
import { cachedHandler } from './_lib/guard.js';
const SRC = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
const MAX = 1500;   // (a busy week with an aftershock sequence: keep the biggest)
const r = (v, k) => Math.round(v*k)/k;
export default cachedHandler({ what:'earthquake data', minAge:4*60e3, sMaxAge:300, swr:3600, load:async () => {
  const res = await fetch(SRC, { headers:{ 'User-Agent':'gcdatlas (https://gcdatlas.com; github eshin087/gcdatlas)' }, signal:AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('USGS answered ' + res.status);
  const j = await res.json();
  if (!j || !Array.isArray(j.features)) throw new Error('no features');
  let quakes = [];
  for (const f of j.features){
    const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
    if (p.type && p.type !== 'earthquake') continue;   // (quarry blasts, explosions)
    const [lon, lat, depth] = c;
    if (!isFinite(p.time) || !isFinite(p.mag) || !isFinite(lat) || !isFinite(lon)) continue;
    quakes.push([Math.round(p.time/1000), r(lat, 100), r(lon, 100), r(isFinite(depth) ? Math.max(depth, 0) : 0, 10), r(p.mag, 10), String(p.place || '').slice(0, 64)]);
  }
  if (!quakes.length) throw new Error('no earthquakes');
  quakes.sort((a, b) => b[0] - a[0]);
  if (quakes.length > MAX) quakes = quakes.sort((a, b) => b[4] - a[4]).slice(0, MAX).sort((a, b) => b[0] - a[0]);
  // (the feed's own clock is "now" for the page's replay: from a week before it to it)
  const gen = j.metadata && isFinite(j.metadata.generated) ? Math.round(j.metadata.generated/1000) : Math.round(Date.now()/1000);
  return JSON.stringify({ updated:new Date().toISOString(), generated:gen, from:gen - 7*86400, minMag:2.5, n:quakes.length, quakes });
} });

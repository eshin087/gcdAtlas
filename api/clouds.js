// GET /api/clouds: the clouds over the whole Earth for the last complete day, as one equirectangular JPEG (2048 x 1024, longitude -180 to 180
// left to right, latitude 90 to -90 top to bottom), passed through from NASA GIBS (free: "NASA should be acknowledged as the source"). It is
// the true-colour daily composite of the VIIRS cameras on NOAA-20 and NOAA-21: each place as seen on one pass, about 1:30 pm local solar time,
// so it is a snapshot of that day, not a live view. Black pixels have no data (the polar night, and the end of the day's last orbits while
// NASA is still adding them). The page turns it into cloud cover: cloud is the white, the land and sea under it are not.
// The day is sent in the X-Clouds-Date header (UTC, YYYY-MM-DD) and the sensor in X-Clouds-Layer. GIBS adds the last orbits of a day a few
// hours after it ends, so the day used is the one that ended at least 9 hours ago. Of the two sensors the bigger file (more of the globe
// filled) is sent. Cached at the edge for 6 hours. Query strings are refused (see _lib/guard.js).
import { cachedHandler } from './_lib/guard.js';
const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const LAYERS = ['VIIRS_NOAA21_CorrectedReflectance_TrueColor', 'VIIRS_NOAA20_CorrectedReflectance_TrueColor'];
const W = 2048, H = 1024, MIN = 250e3, MAX = 3.5e6;   // (a full picture is about 600 KB; under 250 KB most of it is empty; Vercel's limit is 4.5 MB)
const UA = 'gcdatlas (https://gcdatlas.com; github eshin087/gcdatlas)';
const dayOf = back => new Date(Date.now() - (33 + 24*back)*3600e3).toISOString().slice(0, 10);   // (33 h ago: the day that ended 9 h ago or earlier)
const url = (layer, day) => WMS + '?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=' + layer + '&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=' + W + '&HEIGHT=' + H + '&FORMAT=image/jpeg&TIME=' + day;
async function grab(layer, day, ms){
  const r = await fetch(url(layer, day), { headers:{ 'User-Agent':UA }, signal:AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(layer + ' answered ' + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  if (!/^image\/jpeg/.test(r.headers.get('content-type') || '') || b[0] !== 0xff || b[1] !== 0xd8) throw new Error(layer + ' gave no picture');
  if (b.length < MIN || b.length > MAX) throw new Error(layer + ' gave ' + b.length + ' bytes');
  return { layer, b };
}
export default cachedHandler({ what:'cloud image', type:'image/jpeg', minAge:3*3600e3, sMaxAge:21600, swr:86400, load:async () => {
  const t0 = Date.now();
  for (const back of [0, 1]){   // (if that day is not ready, the one before)
    const left = 9000 - (Date.now() - t0);
    if (left < 2000) break;
    const day = dayOf(back);
    const got = (await Promise.allSettled(LAYERS.map(l => grab(l, day, left)))).filter(s => s.status === 'fulfilled').map(s => s.value);
    if (!got.length) continue;
    const best = got.reduce((a, b) => b.b.length > a.b.length ? b : a);
    return { body:best.b, headers:{ 'X-Clouds-Date':day, 'X-Clouds-Layer':best.layer } };
  }
  throw new Error('GIBS gave no picture');
} });

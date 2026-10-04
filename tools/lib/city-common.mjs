// Shared pieces of tools/earth-cities.mjs: the cache, polite downloads, the layer projection (copied from tools/earth-detail.mjs, which stays
// as it is), the Overpass client, the photo sources (Sentinel-2, NAIP, IGN BD ORTHO, GSI seamless photos) and the terrain.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { fromUrl } from 'geotiff';
sharp.concurrency(2);

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE = path.join(ROOT, 'tools', 'cache', 'earth-cities');
export const OUT = path.join(ROOT, 'assets', 'earth', 'cities');
fs.mkdirSync(CACHE, { recursive:true }); fs.mkdirSync(OUT, { recursive:true });
export const RE = 6371000, D2R = Math.PI/180;
export const clampN = (x, a, b) => Math.min(b, Math.max(a, x));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const sha = s => crypto.createHash('sha1').update(s).digest('hex');
export const UA = { 'User-Agent':'gcdatlas (https://gcdatlas.com; github eshin087/gcdatlas)' };

// ---------------------------------------------------------------- geometry: the layers' own projection
// (orthographic onto the plane that touches a 6,371 km sphere at the layer's centre; x east, y north, metres)
export const unit = (la, lo) => [Math.cos(la*D2R)*Math.cos(lo*D2R), Math.cos(la*D2R)*Math.sin(lo*D2R), Math.sin(la*D2R)];
export function frameAt(la, lo){
  const u = unit(la, lo), e = [-Math.sin(lo*D2R), Math.cos(lo*D2R), 0], n = [-Math.sin(la*D2R)*Math.cos(lo*D2R), -Math.sin(la*D2R)*Math.sin(lo*D2R), Math.cos(la*D2R)];
  return { u, e, n, la, lo };
}
export function planeToLL(F, x, y){ const z = Math.sqrt(Math.max(RE*RE - x*x - y*y, 0)); const p = [0, 1, 2].map(k => F.e[k]*x + F.n[k]*y + F.u[k]*z); return [Math.asin(p[2]/RE)/D2R, Math.atan2(p[1], p[0])/D2R]; }
export function llToPlane(F, la, lo){
  const ca = Math.cos(la*D2R), px = ca*Math.cos(lo*D2R)*RE, py = ca*Math.sin(lo*D2R)*RE, pz = Math.sin(la*D2R)*RE;
  return [px*F.e[0] + py*F.e[1] + pz*F.e[2], px*F.n[0] + py*F.n[1] + pz*F.n[2]];
}
export const merc = (la, lo) => [lo*D2R*6378137, Math.log(Math.tan(Math.PI/4 + la*D2R/2))*6378137];
export function toUTM(la, lo, zone){
  const a = 6378137, f = 1/298.257223563, k0 = 0.9996, n = f/(2 - f), A = a/(1 + n)*(1 + n*n/4 + n**4/64);
  const al = [n/2 - 2*n*n/3 + 5*n**3/16, 13*n*n/48 - 3*n**3/5, 61*n**3/240];
  const lam0 = ((zone - 1)*6 - 180 + 3)*D2R, phi = la*D2R, lam = lo*D2R - lam0, e = Math.sqrt(f*(2 - f));
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e*Math.atanh(e*Math.sin(phi))), xi = Math.atan2(t, Math.cos(lam)), eta = Math.atanh(Math.sin(lam)/Math.sqrt(1 + t*t));
  let E = eta, N = xi; for (let j=1;j<=3;j++){ E += al[j - 1]*Math.cos(2*j*xi)*Math.sinh(2*j*eta); N += al[j - 1]*Math.sin(2*j*xi)*Math.cosh(2*j*eta); }
  return [500000 + k0*A*E, (la < 0 ? 10000000 : 0) + k0*A*N];
}
// the lat/lon box round a layer (west, south, east, north)
export function bboxLL(L, pad = 0){
  const F = frameAt(L.la, L.lo), h = L.size/2 + pad; let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
  for (const [x, y] of [[-h, -h], [h, -h], [-h, h], [h, h], [0, h], [0, -h], [h, 0], [-h, 0]]){ const [la, lo] = planeToLL(F, x, y); la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
  return [lo0, la0, lo1, la1];
}
export function haversine(la0, lo0, la1, lo1){
  const p = la0*D2R, q = la1*D2R, dp = q - p, dl = (lo1 - lo0)*D2R, a = Math.sin(dp/2)**2 + Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;
  return 2*RE*Math.asin(Math.min(1, Math.sqrt(a)));
}
// initial bearing from point 0 to point 1, degrees from north
export function bearing(la0, lo0, la1, lo1){
  const p = la0*D2R, q = la1*D2R, dl = (lo1 - lo0)*D2R;
  return (Math.atan2(Math.sin(dl)*Math.cos(q), Math.cos(p)*Math.sin(q) - Math.sin(p)*Math.cos(q)*Math.cos(dl))/D2R + 360) % 360;
}

// ---------------------------------------------------------------- downloads, with a cache
export const cacheFile = key => path.join(CACHE, key.replace(/[^a-z0-9._-]/gi, '_'));
export async function cached(key, fetcher){
  const f = cacheFile(key);
  if (fs.existsSync(f)) return fs.readFileSync(f);
  for (let k=0;k<8;k++){ try { const b = await fetcher(); fs.writeFileSync(f, b); return b; } catch (e) { if (k === 7) throw e; await sleep(3000*(k + 1)); } }
}
export async function get(url, opt = {}){
  const r = await fetch(url, { headers:UA, signal:AbortSignal.timeout(opt.timeout || 120000), ...opt });
  if (!r.ok) throw new Error(url.slice(0, 120) + ' -> ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
// JSON kept gzipped in the cache (the Overpass answers are big)
export function readGz(key){ const f = cacheFile(key); return fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')) : null; }
export function writeGz(key, obj){ fs.writeFileSync(cacheFile(key), zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level:6 })); }

// ---------------------------------------------------------------- Overpass: one query at a time, a pause between them, back off on 429 / 504
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter'];
let lastQuery = 0, inst = 0;
export async function overpass(ql, tag = 'q', tries = 14){
  const key = `op_${tag}_${sha(ql).slice(0, 10)}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const full = `[out:json][timeout:240][maxsize:2000000000];` + ql;
  let err = '';
  for (let a=0;a<tries;a++){
    if (a > 0) console.log(`\n  Overpass retry ${a} (${tag}): ${err}`);
    const wait = lastQuery + 3000 - Date.now(); if (wait > 0) await sleep(wait);
    const url = OVERPASS[inst % OVERPASS.length];
    if (a > 0 || process.env.OP_VERBOSE) console.log(`  [${new Date().toISOString().slice(11, 19)}] ${tag} try ${a + 1} on ${url.split('/')[2]}`);
    try {
      const r = await fetch(url, { method:'POST', headers:{ ...UA, 'Content-Type':'application/x-www-form-urlencoded' }, body:'data=' + encodeURIComponent(full), signal:AbortSignal.timeout(300000) });
      lastQuery = Date.now();
      if (r.ok){
        const t = Buffer.from(await r.arrayBuffer());
        if (t[0] === 123){
          const j = JSON.parse(t.toString('utf8'));
          if (j.remark && /error|timed out|out of memory/i.test(j.remark)){ err = url + ' ' + j.remark; inst++; await sleep(15000); continue; }
          writeGz(key, j); return j;
        }
        err = url + ' answered something that is not JSON: ' + t.slice(0, 120).toString('utf8').replace(/\s+/g, ' ');
        inst++; await sleep(10000); continue;
      }
      err = url + ' ' + r.status;
      if (r.status === 429){ await sleep(45000*(1 + a%3)); if (a % 3 === 2) inst++; }
      else { await sleep(30000); inst++; }
    } catch (e) { lastQuery = Date.now(); err = url + ' ' + e.message; inst++; await sleep(20000); }
  }
  throw new Error('Overpass gave up on ' + tag + ': ' + err);
}
// tiles on a fixed grid of degrees, so a query is reused by every layer that needs it: [{ key, bb:[south, west, north, east] }]
export function gridTiles(box /* [west, south, east, north] */, kmStep, refLa){
  const dLa = Math.round(kmStep/111.32*1000)/1000, dLo = Math.round(kmStep/(111.32*Math.cos(refLa*D2R))*1000)/1000, out = [];
  for (let iy = Math.floor(box[1]/dLa); iy*dLa < box[3]; iy++) for (let ix = Math.floor(box[0]/dLo); ix*dLo < box[2]; ix++)
    out.push({ key:`${kmStep}_${ix}_${iy}`, bb:[+(iy*dLa).toFixed(4), +(ix*dLo).toFixed(4), +((iy + 1)*dLa).toFixed(4), +((ix + 1)*dLo).toFixed(4)] });
  return out;
}

// ---------------------------------------------------------------- image helpers
export const bilinear = (img, fx, fy) => {
  const { w, h, d, c } = img; if (fx < 0 || fy < 0 || fx > w - 1 || fy > h - 1) return null;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), tx = fx - x0, ty = fy - y0, out = [0, 0, 0, 0];
  for (let k=0;k<c;k++){ const a = d[(y0*w + x0)*c + k], b = d[(y0*w + x1)*c + k], e = d[(y1*w + x0)*c + k], g = d[(y1*w + x1)*c + k]; out[k] = (a*(1 - tx) + b*tx)*(1 - ty) + (e*(1 - tx) + g*tx)*ty; }
  return out;
};

// ---------------------------------------------------------------- aerial photos: ArcGIS image services (NAIP), WMS (IGN), XYZ tiles (GSI)
export const PHOTO = {
  fpac:{ kind:'arcgis', url:'https://apps.geo.fpac.usda.gov/geo-imagery/rest/services/naip/conus_naip/ImageServer/exportImage', extra:'&bandIds=0,1,2' },
  usgs:{ kind:'arcgis', url:'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage', extra:'' },
  ign:{ kind:'wms', url:'https://data.geopf.fr/wms-r/wms', layer:'ORTHOIMAGERY.ORTHOPHOTOS' },
  gsi:{ kind:'xyz', url:'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', minZ:14, maxZ:18 },
};
// an image fetched in pieces of at most 1,000 px (the services answer 502 to big exports) and stitched, in Web Mercator, sampled by lat, lon
async function stitched(L, key, pieceUrl, ratio){
  const [lo0, la0, lo1, la1] = bboxLL(L, 60), [x0, y0] = merc(la0, lo0), [x1, y1] = merc(la1, lo1);
  const mpp = L.size/L.px/ratio/Math.cos(L.la*D2R), W = Math.ceil((x1 - x0)/mpp), H = Math.ceil((y1 - y0)/mpp), PC = 1000, nx = Math.ceil(W/PC), ny = Math.ceil(H/PC);
  const d = Buffer.alloc(W*H*3);
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++){
    const w = Math.min(PC, W - i*PC), h = Math.min(PC, H - j*PC), bx0 = x0 + i*PC*mpp, bx1 = bx0 + w*mpp, by1 = y1 - j*PC*mpp, by0 = by1 - h*mpp;
    const buf = await cached(`${key}_${Math.round(bx0)}_${Math.round(by0)}_${Math.round(mpp*100)}_${w}x${h}.jpg`, () => get(pieceUrl(bx0, by0, bx1, by1, w, h)));
    const { data, info } = await sharp(buf).removeAlpha().resize(w, h, { fit:'fill' }).raw().toBuffer({ resolveWithObject:true });
    for (let yy=0;yy<h;yy++) data.copy(d, ((j*PC + yy)*W + i*PC)*3, yy*w*info.channels, (yy + 1)*w*info.channels);
    process.stdout.write('n');
  }
  const img = { w:W, h:H, c:3, d };
  return (la, lo) => { const [x, y] = merc(la, lo), v = bilinear(img, (x - x0)/mpp - 0.5, (y1 - y)/mpp - 0.5); return v && v[0] + v[1] + v[2] > 12 ? v : null; };
}
async function xyzSource(L, key){
  const P = PHOTO[key], [lo0, la0, lo1, la1] = bboxLL(L, 60), mpp = L.size/L.px;
  let z = Math.round(Math.log2(156543*Math.cos(L.la*D2R)/Math.max(mpp*0.7, 0.3))); z = Math.max(P.minZ, Math.min(z, P.maxZ));
  const n = 2**z, tx = lo => (lo + 180)/360*n, ty = la => (1 - Math.log(Math.tan(la*D2R) + 1/Math.cos(la*D2R))/Math.PI)/2*n;
  const X0 = Math.floor(tx(lo0)), X1 = Math.floor(tx(lo1)), Y0 = Math.floor(ty(la1)), Y1 = Math.floor(ty(la0)), tiles = {};
  for (let x=X0;x<=X1;x++) for (let y=Y0;y<=Y1;y++){
    const b = await cached(`${key}_${z}_${x}_${y}.jpg`, async () => { const r = await fetch(P.url.replace('{z}', z).replace('{x}', x).replace('{y}', y), { headers:UA, signal:AbortSignal.timeout(60000) });
      if (r.status === 404) return Buffer.alloc(0); if (!r.ok) throw new Error(key + ' tile ' + r.status); const buf = Buffer.from(await r.arrayBuffer()); return buf[0] === 0xff ? buf : Buffer.alloc(0); });
    if (!b.length) continue;
    const { data, info } = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject:true });
    tiles[x + ',' + y] = { w:info.width, h:info.height, c:3, d:data };
    process.stdout.write('x');
  }
  return (la, lo) => { const fx = tx(lo), fy = ty(la), X = Math.floor(fx), Y = Math.floor(fy), t = tiles[X + ',' + Y]; if (!t) return null;
    const v = bilinear(t, Math.min((fx - X)*t.w, t.w - 1.001), Math.min((fy - Y)*t.h, t.h - 1.001)); return v && v[0] + v[1] + v[2] > 12 ? v : null; };
}
export async function photoSource(L, key){
  const P = PHOTO[key];
  if (P.kind === 'xyz') return xyzSource(L, key);
  if (P.kind === 'arcgis') return stitched(L, key, (bx0, by0, bx1, by1, w, h) => `${P.url}?bbox=${bx0},${by0},${bx1},${by1}&bboxSR=3857&imageSR=3857&size=${w},${h}${P.extra}&format=jpg&f=image`, 1.25);
  return stitched(L, key, (bx0, by0, bx1, by1, w, h) => `${P.url}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${P.layer}&STYLES=&CRS=EPSG:3857&BBOX=${bx0},${by0},${bx1},${by1}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/jpeg`, 1.25);
}

// ---------------------------------------------------------------- Sentinel-2 L2A true colour (Copernicus), the clearest recent scenes, tile by tile (as tools/earth-detail.mjs)
export async function s2Source(L){
  const bb = bboxLL(L), feats = [];
  let body = { collections:['sentinel-2-l2a'], bbox:bb, datetime:'2025-03-01T00:00:00Z/2026-09-28T00:00:00Z', query:{ 'eo:cloud_cover':{ lt:10 } }, limit:100 };
  for (let page=0; page<8 && body; page++){
    const j = JSON.parse(await cached(`stac_${bb.map(v => v.toFixed(3)).join('_')}_p${page}.json`, () => get('https://earth-search.aws.element84.com/v1/search', { method:'POST', headers:{ ...UA, 'Content-Type':'application/json' }, body:JSON.stringify(body) })));
    feats.push(...(j.features || []));
    const nx = (j.links || []).find(l => l.rel === 'next');
    body = nx && nx.body && (j.features || []).length === 100 ? Object.assign({}, body, nx.body) : null;
  }
  const items = feats.filter(f => f.assets && f.assets.visual && (f.properties['s2:nodata_pixel_percentage'] ?? 0) < 97);
  const byTile = {}; for (const f of items){ const t = f.properties['grid:code'] || f.id.split('_')[1]; (byTile[t] = byTile[t] || []).push(f); }
  const dates = {}; for (const f of items){ const d = f.properties.datetime.slice(0, 10); dates[d] = (dates[d] || 0) + 1; }
  const pick = [];
  const score = f => (f.properties['eo:cloud_cover'] < 2 ? 0 : 1)*3 + (f.properties['s2:nodata_pixel_percentage'] > 40 ? 2 : 0);
  for (const t in byTile){ const c = byTile[t].sort((a, b) => score(a) - score(b) || (dates[b.properties.datetime.slice(0, 10)] - dates[a.properties.datetime.slice(0, 10)]) || (a.properties['eo:cloud_cover'] - b.properties['eo:cloud_cover']) || (b.properties.datetime < a.properties.datetime ? -1 : 1)); pick.push(...c.slice(0, 4)); }
  const want = L.size/L.px, srcs = [];
  for (const f of pick){
    const epsg = f.properties['proj:epsg'] || +String(f.properties['proj:code'] || '').split(':')[1], zone = epsg % 100, south = epsg > 32700;
    if (south) continue;
    const cs = [[bb[1], bb[0]], [bb[1], bb[2]], [bb[3], bb[0]], [bb[3], bb[2]]].map(([la, lo]) => toUTM(la, lo, zone));
    let e0 = Math.min(...cs.map(c => c[0])), e1 = Math.max(...cs.map(c => c[0])), n0 = Math.min(...cs.map(c => c[1])), n1 = Math.max(...cs.map(c => c[1]));
    const va = f.assets.visual, tf = va['proj:transform'] || f.properties['proj:transform'], shp = va['proj:shape'] || f.properties['proj:shape'];
    let ext = tf && shp ? [tf[2], tf[5] - shp[0]*Math.abs(tf[4]), tf[2] + shp[1]*tf[0], tf[5]] : null;
    if (!ext){ ext = JSON.parse(await cached(`s2box_${f.id}.json`, async () => Buffer.from(JSON.stringify((await (await fromUrl(va.href)).getImage(0)).getBoundingBox())))); }
    e0 = Math.max(e0, ext[0] + 20); n0 = Math.max(n0, ext[1] + 20); e1 = Math.min(e1, ext[2] - 20); n1 = Math.min(n1, ext[3] - 20);
    if (e1 - e0 < 100 || n1 - n0 < 100) continue;
    const res = Math.max(want*0.7, 10), W = Math.min(Math.ceil((e1 - e0)/res), 4096), H = Math.min(Math.ceil((n1 - n0)/res), 4096);
    const key = `s2c_${f.id}_${Math.round(e0)}_${Math.round(n0)}_${Math.round(e1)}_${Math.round(n1)}_${W}x${H}.bin`;
    const buf = await cached(key, async () => { const t = await fromUrl(f.assets.visual.href); const r = await t.readRasters({ bbox:[e0, n0, e1, n1], width:W, height:H, interleave:true }); return Buffer.from(r.buffer, r.byteOffset, r.byteLength); });
    srcs.push({ id:f.id, date:f.properties.datetime.slice(0, 10), zone, e0, n0, e1, n1, img:{ w:W, h:H, c:3, d:buf } });
    process.stdout.write('.');
  }
  const dateList = [...new Set(srcs.map(s => s.date))].sort();
  const lift = v => v.map((c, k) => k < 3 ? 255*Math.pow(Math.max(c, 0)/255, 0.72) : c);
  const sample = (la, lo) => { for (const s of srcs){ const [e, n] = toUTM(la, lo, s.zone); if (e < s.e0 || e > s.e1 || n < s.n0 || n > s.n1) continue;
    const v = bilinear(s.img, (e - s.e0)/(s.e1 - s.e0)*(s.img.w - 1), (s.n1 - n)/(s.n1 - s.n0)*(s.img.h - 1)); if (v && v[0] + v[1] + v[2] > 6) return lift(v); } return null; };
  sample.dates = dateList;
  return sample;
}

// ---------------------------------------------------------------- terrain: AWS Terrain Tiles (terrarium PNG), metres above sea level
export async function terrainSource(L){
  const [lo0, la0, lo1, la1] = bboxLL(L, 60), mpp = L.size/L.px;
  let z = Math.round(Math.log2(156543*Math.cos(L.la*D2R)/Math.max(mpp, 4))); z = Math.max(4, Math.min(z, 14));
  const n = 2**z, tx = lo => (lo + 180)/360*n, ty = la => (1 - Math.log(Math.tan(la*D2R) + 1/Math.cos(la*D2R))/Math.PI)/2*n;
  const X0 = Math.floor(tx(lo0)), X1 = Math.floor(tx(lo1)), Y0 = Math.floor(ty(la1)), Y1 = Math.floor(ty(la0)), tiles = {};
  for (let x=X0;x<=X1;x++) for (let y=Y0;y<=Y1;y++){
    const b = await cached(`terr_${z}_${x}_${y}.png`, () => get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`));
    const { data, info } = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject:true });
    tiles[x + ',' + y] = { w:info.width, h:info.height, c:3, d:data };
  }
  return (la, lo) => { const fx = tx(lo), fy = ty(la), X = Math.floor(fx), Y = Math.floor(fy), t = tiles[X + ',' + Y]; if (!t) return 0;
    const v = bilinear(t, Math.min((fx - X)*t.w, t.w - 1), Math.min((fy - Y)*t.h, t.h - 1)); return v ? v[0]*256 + v[1] + v[2]/256 - 32768 : 0; };
}

// ---------------------------------------------------------------- polygons: scanline fill, even-odd over all the rings of one feature
// rings: arrays of [x, y] in pixels. fn(y, xa, xb) is called for each filled run (pixel indices, inclusive)
export function fillRings(rings, N, fn){
  let ymin = Infinity, ymax = -Infinity;
  for (const r of rings) for (const p of r){ if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(N - 1, Math.ceil(ymax));
  let any = false;
  for (let y=y0;y<=y1;y++){
    const yc = y + 0.5, xs = [];
    for (const r of rings) for (let i=0, j=r.length - 1; i<r.length; j=i++){ const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > yc) !== (yj > yc)) xs.push(xi + (yc - yi)/(yj - yi)*(xj - xi)); }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k=0;k + 1<xs.length;k+=2){ const a = Math.max(0, Math.ceil(xs[k] - 0.5)), c = Math.min(N - 1, Math.floor(xs[k + 1] - 0.5)); if (c >= a){ fn(y, a, c); any = true; } }
  }
  return any;
}
// joins open ways (arrays of [lat, lon]) that share end points into closed rings, the way an OpenStreetMap multipolygon is read; open leftovers are dropped
export function assembleRings(ways){
  const key = p => p[0].toFixed(7) + ',' + p[1].toFixed(7), rings = [], pool = ways.filter(w => w.length > 1).map(w => w.slice());
  for (const w of pool.slice()) if (key(w[0]) === key(w[w.length - 1]) && w.length > 3){ rings.push(w); pool.splice(pool.indexOf(w), 1); }
  const ends = new Map(); const add = (k, w) => { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(w); };
  const live = new Set(pool); for (const w of pool){ add(key(w[0]), w); add(key(w[w.length - 1]), w); }
  const pop = (k, not) => { const l = ends.get(k); if (!l) return null; for (const w of l) if (live.has(w) && w !== not) return w; return null; };
  while (live.size){
    let cur = live.values().next().value; live.delete(cur);
    let ring = cur.slice(), guard = 0;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < 5000){
      const k = key(ring[ring.length - 1]), nx = pop(k, cur);
      if (!nx) break;
      live.delete(nx);
      const seg = key(nx[0]) === k ? nx : nx.slice().reverse();
      ring = ring.concat(seg.slice(1)); cur = nx;
    }
    if (ring.length > 3 && key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

// ---------------------------------------------------------------- Douglas-Peucker on [x, y] points (iterative)
export function simplify(pts, tol){
  const n = pts.length; if (n < 3) return pts.slice();
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length){
    const [a, b] = stack.pop(); let dmax = 0, im = -1; const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L2 = dx*dx + dy*dy;
    for (let i=a + 1;i<b;i++){
      const [px, py] = pts[i]; let d;
      if (L2 === 0) d = Math.hypot(px - ax, py - ay); else { const t = clampN(((px - ax)*dx + (py - ay)*dy)/L2, 0, 1); d = Math.hypot(px - (ax + t*dx), py - (ay + t*dy)); }
      if (d > dmax){ dmax = d; im = i; }
    }
    if (dmax > tol && im > 0){ keep[im] = 1; stack.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// ---------------------------------------------------------------- the line binary "GCL1" (documented in docs for the page's loader; see the manifest's header comment)
//   offset 0   char[4]  'GCL1'
//   4          uint32   nLines
//   8          uint32   nPts
//   12         float32  unit: metres per Int16 unit (2)
//   16         uint32[nLines + 1]  start: index of each line's first point (line i has points start[i] .. start[i+1] - 1)
//   then       int16[2*nPts]       x, y pairs: metres east and north of the city centre, divided by `unit`
//   then       uint8[nLines]       cls
//   then       uint8[nLines]       a    (roads: lanes; sea: 0)
//   then       uint8[nLines]       flags (bit 0 closed ring, bit 1 one-way (traffic runs in point order), bit 2 bridge, bit 3 tunnel, bit 4 link / ramp, bit 5 roundabout)
//   then       uint8[nLines]       grp  (airport lines: index into the manifest's airports; sea: index into the manifest's sea.names, 0 none)
export function packLines(lines, unitM = 2){
  const nL = lines.length; let nP = 0; for (const l of lines) nP += l.pts.length;
  const size = 16 + 4*(nL + 1) + 4*nP + 4*nL, b = Buffer.alloc(size);
  b.write('GCL1', 0, 'latin1'); b.writeUInt32LE(nL, 4); b.writeUInt32LE(nP, 8); b.writeFloatLE(unitM, 12);
  let o = 16, pi = 0;
  for (const l of lines){ b.writeUInt32LE(pi, o); o += 4; pi += l.pts.length; } b.writeUInt32LE(pi, o); o += 4;
  for (const l of lines) for (const p of l.pts){ b.writeInt16LE(clampN(Math.round(p[0]/unitM), -32767, 32767), o); b.writeInt16LE(clampN(Math.round(p[1]/unitM), -32767, 32767), o + 2); o += 4; }
  for (const f of ['cls', 'a', 'flags', 'grp']) for (const l of lines){ b[o++] = (l[f] || 0) & 255; }
  return b;
}
// reads a line binary back the way the page's loader will (typed arrays over the file's buffer): { unit, lines:[{ pts:[[x, y]...] (metres), cls, a, flags, grp }] }
export function unpackLines(buf){
  if (buf.toString('latin1', 0, 4) !== 'GCL1') throw new Error('not a GCL1 file');
  const nL = buf.readUInt32LE(4), nP = buf.readUInt32LE(8), unitM = buf.readFloatLE(12), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const start = new Uint32Array(ab, 16, nL + 1), xy = new Int16Array(ab, 16 + 4*(nL + 1), 2*nP), o = 16 + 4*(nL + 1) + 4*nP;
  const cls = new Uint8Array(ab, o, nL), a = new Uint8Array(ab, o + nL, nL), flags = new Uint8Array(ab, o + 2*nL, nL), grp = new Uint8Array(ab, o + 3*nL, nL), lines = [];
  for (let i=0;i<nL;i++){ const pts = []; for (let k=start[i];k<start[i + 1];k++) pts.push([xy[2*k]*unitM, xy[2*k + 1]*unitM]); lines.push({ pts, cls:cls[i], a:a[i], flags:flags[i], grp:grp[i] }); }
  return { unit:unitM, lines };
}
export function writeHashed(dir, base, ext, buf){
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8), file = `${base}-${hash}.${ext}`;
  for (const f of fs.readdirSync(dir)) if (f.startsWith(base + '-') && f.endsWith('.' + ext) && f !== file && /^[0-9a-f]{8}$/.test(f.slice(base.length + 1, -ext.length - 1))) fs.unlinkSync(path.join(dir, f));
  fs.writeFileSync(path.join(dir, file), buf);
  return file;
}

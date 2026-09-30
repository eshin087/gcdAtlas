// Builds the Earth detail round the launch sites: for each site a few square layers, each a WebP image, from a region 410 km across down to
// 1.6 km round a pad, in the same projection the page draws them with (orthographic onto the plane that touches a sphere of 6,371 km at the
// layer's centre: x east, y north, in metres). RGB is the ground as seen from above; alpha is 0 for water, else 1 + the height of the ground
// and whatever stands on it above the layer's base, in the layer's steps: alpha 1 is water, 2 + (height - base)/step land (base and step
// are in the manifest).
//   Sources (see docs/ACCURACY.md):
//   - Sentinel-2 L2A true colour (10 m), Copernicus, from Earth Search on AWS (the clearest recent date, tile by tile): the regions, and where
//     there are no aerial photos (Mexico, the sea, Vandenberg, which is masked in NAIP). "Contains modified Copernicus Sentinel data <year>".
//   - USGS NAIP aerial photos (0.3 to 0.6 m, public domain), from the USGS National Map image service: the layers round the pads.
//   - Terrain: the AWS Terrain Tiles (Mapzen terrarium; USGS 3DEP in the United States).
//   - Buildings: OpenStreetMap (ODbL, "© OpenStreetMap contributors"), heights from their tags, else a guess by kind; our own pad models
//     (towers, mounts) replace what OpenStreetMap has within 150 m of each pad.
// Writes assets/earth/<site>-<layer>-<hash>.webp and src/objects/e2-earth-detail-data.js (the manifest). Needs tools/ dependencies (npm install
// in tools/: sharp, geotiff). Takes a few minutes; everything is cached in tools/cache/earth so a rerun only redoes what changed.
//   node tools/earth-detail.mjs [site ...]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { fromUrl } from 'geotiff';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'earth'), CACHE = path.join(ROOT, 'tools', 'cache', 'earth');
fs.mkdirSync(OUT, { recursive:true }); fs.mkdirSync(CACHE, { recursive:true });
const RE = 6371000, D2R = Math.PI/180, clampN = (x, a, b) => Math.min(b, Math.max(a, x));
const UA = { 'User-Agent':'gcdatlas-earth-detail (https://gcdatlas.vercel.app; github eshin087/gcdatlas)' };

// ---------------------------------------------------------------- the sites and their layers (centre lat, lon; size m; pixels; source)
// pads: where our own models stand (OpenStreetMap buildings within 150 m of them are left out)
const PADS = { starbase:[25.99677, -97.15799], lc39a:[28.60822, -80.60428], slc40:[28.56194, -80.57735], slc4e:[34.63208, -120.61074], lz:[28.48575, -80.54385] };
const SITES = [
  { key:'starbase', name:'Starbase, Texas', pads:['starbase'], layers:[
    { id:'r410', la:25.9968, lo:-97.1580, size:409600, px:1024, src:'s2' },
    { id:'r51', la:25.9968, lo:-97.1580, size:51200, px:1024, src:'s2' },
    { id:'l6', la:25.9968, lo:-97.1580, size:6400, px:1024, src:'naip', bld:true },
    { id:'l1', la:25.99677, lo:-97.15799, size:1600, px:1024, src:'naip', bld:true } ] },
  { key:'cape', name:'Cape Canaveral, Florida', pads:['lc39a', 'slc40', 'lz'], layers:[
    { id:'r410', la:28.55, lo:-80.60, size:409600, px:1024, src:'s2' },
    { id:'r51', la:28.55, lo:-80.60, size:51200, px:1024, src:'s2' },
    { id:'l16', la:28.548, lo:-80.598, size:16384, px:2048, src:'naip', bld:true },
    { id:'p39a', la:28.60822, lo:-80.60428, size:1600, px:1024, src:'naip', bld:true },
    { id:'p40', la:28.56194, lo:-80.57735, size:1600, px:1024, src:'naip', bld:true },
    { id:'plz', la:28.48575, lo:-80.54385, size:1600, px:1024, src:'naip', bld:true } ] },
  { key:'vandenberg', name:'Vandenberg, California', pads:['slc4e'], layers:[
    { id:'r410', la:34.632, lo:-120.611, size:409600, px:1024, src:'s2' },
    { id:'r51', la:34.632, lo:-120.611, size:51200, px:1024, src:'s2' },
    { id:'l6', la:34.63208, lo:-120.61074, size:6400, px:1024, src:'s2', bld:true },
    { id:'l1', la:34.63208, lo:-120.61074, size:1600, px:1024, src:'s2', bld:true } ] },
];

// ---------------------------------------------------------------- geometry
const unit = (la, lo) => [Math.cos(la*D2R)*Math.cos(lo*D2R), Math.cos(la*D2R)*Math.sin(lo*D2R), Math.sin(la*D2R)];   // (Earth-centred, z north: only inside this tool)
function frameAt(la, lo){ const u = unit(la, lo), e = [-Math.sin(lo*D2R), Math.cos(lo*D2R), 0], n = [-Math.sin(la*D2R)*Math.cos(lo*D2R), -Math.sin(la*D2R)*Math.sin(lo*D2R), Math.cos(la*D2R)]; return { u, e, n }; }
// a point of the layer's plane (x east, y north, m) -> lat, lon (orthographic: straight down onto the sphere)
function planeToLL(F, x, y){ const z = Math.sqrt(Math.max(RE*RE - x*x - y*y, 0)); const p = [0, 1, 2].map(k => F.e[k]*x + F.n[k]*y + F.u[k]*z); return [Math.asin(p[2]/RE)/D2R, Math.atan2(p[1], p[0])/D2R]; }
function llToPlane(F, la, lo){ const p = unit(la, lo).map(v => v*RE); return [p[0]*F.e[0] + p[1]*F.e[1] + p[2]*F.e[2], p[0]*F.n[0] + p[1]*F.n[1] + p[2]*F.n[2]]; }
const merc = (la, lo) => [lo*D2R*6378137, Math.log(Math.tan(Math.PI/4 + la*D2R/2))*6378137];
// WGS84 lat, lon -> UTM zone easting, northing (Krüger series, good to well under a metre)
function toUTM(la, lo, zone){
  const a = 6378137, f = 1/298.257223563, k0 = 0.9996, n = f/(2 - f), A = a/(1 + n)*(1 + n*n/4 + n**4/64);
  const al = [n/2 - 2*n*n/3 + 5*n**3/16, 13*n*n/48 - 3*n**3/5, 61*n**3/240];
  const lam0 = ((zone - 1)*6 - 180 + 3)*D2R, phi = la*D2R, lam = lo*D2R - lam0, e = Math.sqrt(f*(2 - f));
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e*Math.atanh(e*Math.sin(phi))), xi = Math.atan2(t, Math.cos(lam)), eta = Math.atanh(Math.sin(lam)/Math.sqrt(1 + t*t));
  let E = eta, N = xi; for (let j=1;j<=3;j++){ E += al[j - 1]*Math.cos(2*j*xi)*Math.sinh(2*j*eta); N += al[j - 1]*Math.sin(2*j*xi)*Math.cosh(2*j*eta); }
  return [500000 + k0*A*E, (la < 0 ? 10000000 : 0) + k0*A*N];
}
function bboxLL(L){ const F = frameAt(L.la, L.lo), h = L.size/2; let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
  for (const [x, y] of [[-h, -h], [h, -h], [-h, h], [h, h], [0, h], [0, -h], [h, 0], [-h, 0]]){ const [la, lo] = planeToLL(F, x, y); la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
  return [lo0, la0, lo1, la1]; }

// ---------------------------------------------------------------- fetching, with a cache
async function cached(key, fetcher){
  const f = path.join(CACHE, key.replace(/[^a-z0-9._-]/gi, '_'));
  if (fs.existsSync(f)) return fs.readFileSync(f);
  // (the image service sometimes answers 502 for a while: wait longer each time)
  for (let k=0;k<8;k++){ try { const b = await fetcher(); fs.writeFileSync(f, b); return b; } catch (e) { if (k === 7) throw e; await new Promise(r => setTimeout(r, 3000*(k + 1))); } }
}
async function get(url, opt = {}){ const r = await fetch(url, { headers:UA, signal:AbortSignal.timeout(120000), ...opt }); if (!r.ok) throw new Error(url + ' -> ' + r.status); return Buffer.from(await r.arrayBuffer()); }
// an image source sampled by lat, lon (bilinear); valid(r, g, b) says whether a pixel has data
const bilinear = (img, fx, fy) => {
  const { w, h, d, c } = img; if (fx < 0 || fy < 0 || fx > w - 1 || fy > h - 1) return null;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), tx = fx - x0, ty = fy - y0, out = [0, 0, 0, 0];
  for (let k=0;k<c;k++){ const a = d[(y0*w + x0)*c + k], b = d[(y0*w + x1)*c + k], e = d[(y1*w + x0)*c + k], g = d[(y1*w + x1)*c + k]; out[k] = (a*(1 - tx) + b*tx)*(1 - ty) + (e*(1 - tx) + g*tx)*ty; }
  return out;
};

// ---------------------------------------------------------------- USGS NAIP (public domain), Web Mercator export, sampled by lat, lon
async function naipSource(L){
  const [lo0, la0, lo1, la1] = bboxLL(L), [x0, y0] = merc(la0, lo0), [x1, y1] = merc(la1, lo1);
  // (the service can answer 502 to a big export: the area is fetched in pieces of at most 1,000 px and stitched)
  const mpp = L.size/L.px/1.6, W = Math.ceil((x1 - x0)/mpp), H = Math.ceil((y1 - y0)/mpp), PC = 1000, nx = Math.ceil(W/PC), ny = Math.ceil(H/PC);
  const d = Buffer.alloc(W*H*3);
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++){
    const w = Math.min(PC, W - i*PC), h = Math.min(PC, H - j*PC), bx0 = x0 + i*PC*mpp, bx1 = bx0 + w*mpp, by1 = y1 - j*PC*mpp, by0 = by1 - h*mpp;
    const url = `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage?bbox=${bx0},${by0},${bx1},${by1}&bboxSR=3857&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
    const buf = await cached(`naip_${Math.round(bx0)}_${Math.round(by0)}_${Math.round(mpp*100)}_${w}x${h}.jpg`, () => get(url));
    const { data, info } = await sharp(buf).removeAlpha().resize(w, h, { fit:'fill' }).raw().toBuffer({ resolveWithObject:true });
    for (let yy=0;yy<h;yy++) data.copy(d, ((j*PC + yy)*W + i*PC)*3, yy*w*info.channels, (yy + 1)*w*info.channels);
    process.stdout.write('n');
  }
  const img = { w:W, h:H, c:3, d };
  return (la, lo) => { const [x, y] = merc(la, lo), v = bilinear(img, (x - x0)/mpp - 0.5, (y1 - y)/mpp - 0.5); return v && v[0] + v[1] + v[2] > 12 ? v : null; };
}
// ---------------------------------------------------------------- Sentinel-2 L2A true colour (Copernicus), the clearest recent scenes, tile by tile
async function s2Source(L){
  const bb = bboxLL(L);
  // (the catalogue, 100 scenes a page, following its next links)
  const feats = [];
  let body = { collections:['sentinel-2-l2a'], bbox:bb, datetime:'2025-03-01T00:00:00Z/2026-09-28T00:00:00Z', query:{ 'eo:cloud_cover':{ lt:10 } }, limit:100 };
  for (let page=0; page<8 && body; page++){
    const j = JSON.parse(await cached(`stac_${bb.map(v => v.toFixed(3)).join('_')}_p${page}.json`, () => get('https://earth-search.aws.element84.com/v1/search', { method:'POST', headers:{ ...UA, 'Content-Type':'application/json' }, body:JSON.stringify(body) })));
    feats.push(...(j.features || []));
    const nx = (j.links || []).find(l => l.rel === 'next');
    body = nx && nx.body && (j.features || []).length === 100 ? Object.assign({}, body, nx.body) : null;
  }
  const j = { features:feats };
  const items = (j.features || []).filter(f => f.assets && f.assets.visual && (f.properties['s2:nodata_pixel_percentage'] ?? 0) < 97);
  // one scene per tile: prefer the date that covers most tiles clear (one satellite pass, no seams), then the clearest, then the newest
  const byTile = {}; for (const f of items){ const t = f.properties['grid:code'] || f.id.split('_')[1]; (byTile[t] = byTile[t] || []).push(f); }
  const dates = {}; for (const f of items){ const d = f.properties.datetime.slice(0, 10); dates[d] = (dates[d] || 0) + 1; }
  const pick = [];
  // (per tile: the clear, well-covered scenes first; up to four, so a scene cut by the edge of its pass is filled from another)
  const score = f => (f.properties['eo:cloud_cover'] < 2 ? 0 : 1)*3 + (f.properties['s2:nodata_pixel_percentage'] > 40 ? 2 : 0);
  for (const t in byTile){ const c = byTile[t].sort((a, b) => score(a) - score(b) || (dates[b.properties.datetime.slice(0, 10)] - dates[a.properties.datetime.slice(0, 10)]) || (a.properties['eo:cloud_cover'] - b.properties['eo:cloud_cover']) || (b.properties.datetime < a.properties.datetime ? -1 : 1)); pick.push(...c.slice(0, 4)); }
  const want = L.size/L.px;   // metres per output pixel
  const srcs = [];
  for (const f of pick){
    const epsg = f.properties['proj:epsg'] || +String(f.properties['proj:code'] || '').split(':')[1], zone = epsg % 100, south = epsg > 32700;
    if (south) continue;
    // the part of this tile the layer needs, in its UTM metres, read at about the output's resolution (geotiff picks the overview)
    const cs = [[bb[1], bb[0]], [bb[1], bb[2]], [bb[3], bb[0]], [bb[3], bb[2]]].map(([la, lo]) => toUTM(la, lo, zone));
    let e0 = Math.min(...cs.map(c => c[0])), e1 = Math.max(...cs.map(c => c[0])), n0 = Math.min(...cs.map(c => c[1])), n1 = Math.max(...cs.map(c => c[1]));
    // (a read that runs past the edge of the scene repeats its edge pixels: clip to the scene's own box, 109.8 km square)
    const va = f.assets.visual, tf = va['proj:transform'] || f.properties['proj:transform'], shp = va['proj:shape'] || f.properties['proj:shape'];
    let ext = tf && shp ? [tf[2], tf[5] - shp[0]*Math.abs(tf[4]), tf[2] + shp[1]*tf[0], tf[5]] : null;
    if (!ext){ const bx = JSON.parse(await cached(`s2box_${f.id}.json`, async () => Buffer.from(JSON.stringify((await (await fromUrl(va.href)).getImage(0)).getBoundingBox())))); ext = bx; }
    e0 = Math.max(e0, ext[0] + 20); n0 = Math.max(n0, ext[1] + 20); e1 = Math.min(e1, ext[2] - 20); n1 = Math.min(n1, ext[3] - 20);
    if (e1 - e0 < 100 || n1 - n0 < 100) continue;
    const res = Math.max(want*0.7, 10), W = Math.min(Math.ceil((e1 - e0)/res), 4096), H = Math.min(Math.ceil((n1 - n0)/res), 4096);
    const key = `s2c_${f.id}_${Math.round(e0)}_${Math.round(n0)}_${Math.round(e1)}_${Math.round(n1)}_${W}x${H}.bin`;
    const buf = await cached(key, async () => { const t = await fromUrl(f.assets.visual.href); const r = await t.readRasters({ bbox:[e0, n0, e1, n1], width:W, height:H, interleave:true }); return Buffer.from(r.buffer, r.byteOffset, r.byteLength); });
    srcs.push({ id:f.id, date:f.properties.datetime.slice(0, 10), zone, e0, n0, e1, n1, img:{ w:W, h:H, c:3, d:buf } });
    process.stdout.write('.');
  }
  const dateList = [...new Set(srcs.map(s => s.date))].sort();
  // (the true-colour product is dark: land a sixth of the way up the scale, forests nearly black. A gamma of 0.72 lifts the dark tones to about
  // where an aerial photo has them and leaves the bright ones)
  const lift = v => v.map((c, k) => k < 3 ? 255*Math.pow(Math.max(c, 0)/255, 0.72) : c);
  const sample = (la, lo) => { for (const s of srcs){ const [e, n] = toUTM(la, lo, s.zone); if (e < s.e0 || e > s.e1 || n < s.n0 || n > s.n1) continue;
    const v = bilinear(s.img, (e - s.e0)/(s.e1 - s.e0)*(s.img.w - 1), (s.n1 - n)/(s.n1 - s.n0)*(s.img.h - 1)); if (v && v[0] + v[1] + v[2] > 6) return lift(v); } return null; };
  sample.dates = dateList;
  return sample;
}
// ---------------------------------------------------------------- terrain: AWS Terrain Tiles (terrarium PNG), metres above sea level
async function terrainSource(L){
  const [lo0, la0, lo1, la1] = bboxLL(L), mpp = L.size/L.px;
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
// ---------------------------------------------------------------- buildings: OpenStreetMap footprints with heights
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
async function osmBuildings(L){
  const [lo0, la0, lo1, la1] = bboxLL(L), b = `${la0},${lo0},${la1},${lo1}`;
  const ql = `[out:json][timeout:120];(way["building"](${b});way["man_made"~"^(tower|storage_tank|silo|water_tower|chimney|mast)$"](${b});relation["building"](${b}););out geom;`;
  const key = `osm_${b.replace(/,/g, '_')}.json`;
  const buf = await cached(key, async () => { let err; for (const u of OVERPASS){ try { const r = await fetch(u, { method:'POST', headers:{ ...UA, 'Content-Type':'application/x-www-form-urlencoded' }, body:'data=' + encodeURIComponent(ql), signal:AbortSignal.timeout(180000) }); if (r.ok){ const t = Buffer.from(await r.arrayBuffer()); if (t[0] === 123) return t; } err = u + ' ' + r.status; } catch (e) { err = e.message; } } throw new Error('Overpass: ' + err); });
  const j = JSON.parse(buf), out = [];
  for (const el of j.elements || []){
    const t = el.tags || {}, rings = [];
    if (el.type === 'way' && el.geometry) rings.push(el.geometry);
    else if (el.type === 'relation') for (const m of el.members || []) if (m.role === 'outer' && m.geometry) rings.push(m.geometry);
    if (!rings.length) continue;
    let h = parseFloat(t.height || t['building:height']); const lv = parseFloat(t['building:levels']);
    const kind = t.man_made || t.building;
    // (heights over 200 m that are not the landmarks known to be that tall are typing mistakes in the data: a civic centre listed at 430 m)
    if (!(h > 0) || (h > 200 && !/vehicle assembly/i.test(t.name || ''))) h = lv > 0 ? lv*3.4 + 1 : ({ hangar:14, industrial:12, warehouse:11, storage_tank:14, tank:14, silo:20, water_tower:35, tower:30, chimney:30, mast:25, hotel:18, office:12, apartments:12, commercial:8, church:10, retail:7, garage:4, shed:3, roof:5, carport:3 }[kind] || 6);
    out.push({ h, name:t.name || '', rings, kind });
  }
  return out;
}
function rasterize(F, L, blds, pads){
  const N = L.px, h = new Float32Array(N*N), m = L.size/N, padXY = pads.map(k => llToPlane(F, ...PADS[k]));
  for (const b of blds){
    for (const ring of b.rings){
      const pts = ring.map(g => llToPlane(F, g.lat, g.lon)).map(([x, y]) => [(x + L.size/2)/m, (L.size/2 - y)/m]);
      const cx = pts.reduce((a, p) => a + p[0], 0)/pts.length, cy = pts.reduce((a, p) => a + p[1], 0)/pts.length;
      const X = cx*m - L.size/2, Y = L.size/2 - cy*m;
      if (padXY.some(([px, py]) => Math.hypot(px - X, py - Y) < 150)) continue;   // (our own pad models stand there)
      let y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1])))), y1 = Math.min(N - 1, Math.ceil(Math.max(...pts.map(p => p[1]))));
      for (let y=y0;y<=y1;y++){
        const yc = y + 0.5, xs = [];
        for (let i=0, j=pts.length - 1; i<pts.length; j=i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > yc) !== (yj > yc)) xs.push(xi + (yc - yi)/(yj - yi)*(xj - xi)); }
        xs.sort((a, b) => a - b);
        for (let k=0;k + 1<xs.length;k+=2){ const a = Math.max(0, Math.ceil(xs[k] - 0.5)), c = Math.min(N - 1, Math.floor(xs[k + 1] - 0.5)); for (let x=a;x<=c;x++) h[y*N + x] = Math.max(h[y*N + x], b.h); }
      }
    }
  }
  return h;
}
// ---------------------------------------------------------------- one layer
async function buildLayer(S, L, s2cache){
  const F = frameAt(L.la, L.lo), N = L.px, m = L.size/N;
  process.stdout.write(`${S.key}-${L.id} (${(L.size/1000).toFixed(1)} km, ${m.toFixed(2)} m/px): `);
  const s2 = s2cache[S.key + L.size] || (s2cache[S.key + L.size] = await s2Source(L));
  const naip = L.src === 'naip' ? await naipSource(L) : null;
  const terr = await terrainSource(L);
  const blds = L.bld ? await osmBuildings(L) : [];
  const bh = L.bld ? rasterize(F, L, blds, S.pads) : null;
  const rgb = new Uint8Array(N*N*3), elev = new Float32Array(N*N), water = new Uint8Array(N*N);
  let naipN = 0, s2N = 0;
  const gain = s2cache['gain-' + S.key];
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const px = (x + 0.5)*m - L.size/2, py = L.size/2 - (y + 0.5)*m, [la, lo] = planeToLL(F, px, py), i = y*N + x;
    let v = naip ? naip(la, lo) : null; if (v) naipN++; else { v = s2(la, lo); if (v){ s2N++; if (gain) v = gain(v); } }
    const t = terr(la, lo);
    water[i] = t <= 0.2 ? 1 : 0;
    if (!v) v = water[i] ? [14, 36, 58] : [96, 92, 78];   // (no image: the sea, or plain ground)
    rgb.set([clampN(Math.round(v[0]), 0, 255), clampN(Math.round(v[1]), 0, 255), clampN(Math.round(v[2]), 0, 255)], i*3);
    elev[i] = Math.max(t, 0) + (bh ? bh[i] : 0);
  }
  // alpha: 0 water, else 1 + (elevation - base)/step, rounded
  let lo = Infinity, hi = -Infinity; for (let i=0;i<N*N;i++) if (!water[i]){ lo = Math.min(lo, elev[i]); hi = Math.max(hi, elev[i]); }
  if (!isFinite(lo)){ lo = 0; hi = 0; }
  const base = Math.floor(lo), step = Math.max(1, Math.ceil((hi - base)/253));
  // (never fully transparent: WebP rewrites the colour under alpha 0 to save space, which smeared the sea into streaks)
  const rgba = Buffer.alloc(N*N*4);
  for (let i=0;i<N*N;i++){ rgba[i*4] = rgb[i*3]; rgba[i*4 + 1] = rgb[i*3 + 1]; rgba[i*4 + 2] = rgb[i*3 + 2]; rgba[i*4 + 3] = water[i] ? 1 : Math.min(255, 2 + Math.round((elev[i] - base)/step)); }
  const webp = await sharp(rgba, { raw:{ width:N, height:N, channels:4 } }).webp({ quality:72, alphaQuality:100, effort:6, smartSubsample:true }).toBuffer();
  const hash = crypto.createHash('sha1').update(webp).digest('hex').slice(0, 8), file = `${S.key}-${L.id}-${hash}.webp`;
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(`${S.key}-${L.id}-`) && f !== file) fs.unlinkSync(path.join(OUT, f));
  fs.writeFileSync(path.join(OUT, file), webp);
  const srcs = [naipN ? 'naip' : null, s2N ? 's2' : null].filter(Boolean);
  console.log(` ${(webp.length/1024).toFixed(0)} KB, ${Math.round(100*naipN/(N*N))}% aerial photo, ${Math.round(100*s2N/(N*N))}% Sentinel-2${blds.length ? `, ${blds.length} buildings` : ''}, ground ${base} to ${hi.toFixed(0)} m in ${step} m steps`);
  return { id:L.id, file, la:L.la, lo:L.lo, size:L.size, px:N, base, step, top:Math.ceil(hi), src:srcs, s2dates:s2N ? s2.dates : [], naip:naipN > 0, bld:blds.length };
}
// (the aerial photos, as they are, set the site's colours: the satellite images round them are brightened to match, channel by channel, by
// the ratio of the two over the same land in the site's widest layer of photos, with a soft shoulder so bright ground does not clip. Matching
// the photos to the satellite images instead, layer by layer, made the 16 km layer at the Cape much darker than the 1.6 km one inside it)
async function siteGain(S, s2cache){
  const L = S.layers.find(l => l.src === 'naip'); if (!L) return null;
  const F = frameAt(L.la, L.lo), N = L.px, m = L.size/N;
  const s2 = s2cache[S.key + L.size] || (s2cache[S.key + L.size] = await s2Source(L)), naip = await naipSource(L), terr = await terrainSource(L);
  const A = [0, 0, 0], B = [0, 0, 0]; let n = 0;
  for (let y=0;y<N;y+=8) for (let x=0;x<N;x+=8){ const [la, lo] = planeToLL(F, (x + 0.5)*m - L.size/2, L.size/2 - (y + 0.5)*m), a = naip(la, lo), b = s2(la, lo);
    if (a && b && terr(la, lo) > 0.3){ for (let k=0;k<3;k++){ A[k] += a[k]; B[k] += b[k]; } n++; } }
  if (n < 200) return null;
  const g = [0, 1, 2].map(k => clampN(A[k]/Math.max(B[k], 1), 0.6, 1.9));
  console.log(`${S.key}: satellite images x ${g.map(v => v.toFixed(2)).join(', ')} to match the aerial photos`);
  const knee = c => c < 200 ? c : 200 + 55*(1 - Math.exp(-(c - 200)/55));
  return v => v.map((c, k) => k < 3 ? knee(c*g[k]) : c);
}
// ---------------------------------------------------------------- main
const only = process.argv.slice(2), s2cache = {}, man = { made:new Date().toISOString().slice(0, 10), sites:[] };
const old = (() => { try { return JSON.parse(fs.readFileSync(path.join(CACHE, 'manifest.json'), 'utf8')); } catch (e) { return null; } })();
for (const S of SITES){
  if (only.length && !only.includes(S.key)){ const o = old && old.sites.find(s => s.key === S.key); if (o) man.sites.push(o); continue; }
  s2cache['gain-' + S.key] = await siteGain(S, s2cache);
  const layers = []; for (const L of S.layers) layers.push(await buildLayer(S, L, s2cache));
  const pad = PADS[S.pads[0]], tfine = await terrainSource({ la:pad[0], lo:pad[1], size:1600, px:1024 });
  // (top: the highest ground or roof within about 25 km, where the page ray-marches the heights: its march starts at that height)
  man.sites.push({ key:S.key, name:S.name, la:pad[0], lo:pad[1], pads:Object.fromEntries(S.pads.map(k => [k, [...PADS[k], Math.max(0, Math.round(tfine(...PADS[k])*10)/10)]])), top:Math.max(...layers.filter(l => l.size <= 51200).map(l => l.top)), layers });
}
fs.writeFileSync(path.join(CACHE, 'manifest.json'), JSON.stringify(man));
const js = `// generated by tools/earth-detail.mjs on ${man.made}: do not edit by hand. The Earth detail round the launch sites (e2-earth-detail.js draws it):
// each layer is assets/earth/<file> (served as earth/<file>), a square <size> m across centred on <la, lo> in the orthographic projection of a
// 6,371 km sphere; RGB is the ground, alpha 1 water, else 2 + (height above sea level - base)/step (terrain plus buildings).
const EARTH_DETAIL = ${JSON.stringify(man)};
`;
fs.writeFileSync(path.join(ROOT, 'src', 'objects', 'e2-earth-detail-data.js'), js);
console.log('manifest: src/objects/e2-earth-detail-data.js');

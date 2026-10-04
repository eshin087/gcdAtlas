// The parts of tools/earth-detail.mjs (the launch sites' tool) that tools/earth-places.mjs reuses, copied and generalised. earth-detail.mjs itself is
// untouched. A layer is a square WebP, orthographic about its centre onto a 6,371 km sphere (x east, y north, metres): RGB is the ground seen from
// above, alpha 1 water, else 2 + (height above sea level - base)/step. What is here:
//   - geometry (the layer's plane <-> lat, lon, Web Mercator, UTM north or south), a cached and retrying fetch, bilinear sampling
//   - Sentinel-2 L2A true colour from Earth Search (Copernicus), now a per-pixel cloud-free composite: every candidate scene's SCL (scene
//     classification) says where the clouds, their shadows and the no-data edges are; the clearest scenes of a tile fill each other's gaps and
//     neighbouring scenes are feathered together. `mask:'none'` keeps every pixel (snow and ice, which SCL takes for cloud)
//   - heights: the Copernicus DEM GLO-30 (AWS open data, 1 degree COG tiles with overviews) or the AWS Terrain Tiles (terrarium)
//   - NAIP aerial photos from the USGS image service (United States only)
//   - OpenStreetMap through Overpass (one query at a time, with pauses), rasterising polygons and lines
//   - the final encoding (WebP with alpha as height) and the review previews (colour blended with a hillshade)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { fromUrl } from 'geotiff';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = path.join(ROOT, 'assets', 'earth', 'places'), CACHE = path.join(ROOT, 'tools', 'cache', 'earth-places'), PREVIEW = path.join(CACHE, 'preview');
for (const d of [OUT, CACHE, PREVIEW]) fs.mkdirSync(d, { recursive:true });
sharp.concurrency(2);
export const RE = 6371000, D2R = Math.PI/180, clampN = (x, a, b) => Math.min(b, Math.max(a, x));
export const UA = { 'User-Agent':'gcdatlas (https://gcdatlas.com; github eshin087/gcdatlas)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => process.stdout.write(s);

// ---------------------------------------------------------------- geometry
export const unit = (la, lo) => [Math.cos(la*D2R)*Math.cos(lo*D2R), Math.cos(la*D2R)*Math.sin(lo*D2R), Math.sin(la*D2R)];   // (Earth-centred, z north: only inside this tool)
export function frameAt(la, lo){ const u = unit(la, lo), e = [-Math.sin(lo*D2R), Math.cos(lo*D2R), 0], n = [-Math.sin(la*D2R)*Math.cos(lo*D2R), -Math.sin(la*D2R)*Math.sin(lo*D2R), Math.cos(la*D2R)]; return { u, e, n }; }
// a point of the layer's plane (x east, y north, m) -> lat, lon (orthographic: straight down onto the sphere)
export function planeToLL(F, x, y){ const z = Math.sqrt(Math.max(RE*RE - x*x - y*y, 0)); const p = [0, 1, 2].map(k => F.e[k]*x + F.n[k]*y + F.u[k]*z); return [Math.asin(clampN(p[2]/RE, -1, 1))/D2R, Math.atan2(p[1], p[0])/D2R]; }
export function llToPlane(F, la, lo){ const p = unit(la, lo).map(v => v*RE); return [p[0]*F.e[0] + p[1]*F.e[1] + p[2]*F.e[2], p[0]*F.n[0] + p[1]*F.n[1] + p[2]*F.n[2]]; }
export const merc = (la, lo) => [lo*D2R*6378137, Math.log(Math.tan(Math.PI/4 + la*D2R/2))*6378137];
// WGS84 lat, lon -> UTM easting, northing in a given zone (Krueger series, good to well under a metre); south adds the 10,000 km false northing
export function toUTM(la, lo, zone, south){
  const a = 6378137, f = 1/298.257223563, k0 = 0.9996, n = f/(2 - f), A = a/(1 + n)*(1 + n*n/4 + n**4/64);
  const al = [n/2 - 2*n*n/3 + 5*n**3/16, 13*n*n/48 - 3*n**3/5, 61*n**3/240];
  const lam0 = ((zone - 1)*6 - 180 + 3)*D2R, phi = la*D2R, lam = lo*D2R - lam0, e = Math.sqrt(f*(2 - f));
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e*Math.atanh(e*Math.sin(phi))), xi = Math.atan2(t, Math.cos(lam)), eta = Math.atanh(Math.sin(lam)/Math.sqrt(1 + t*t));
  let E = eta, N = xi; for (let j=1;j<=3;j++){ E += al[j - 1]*Math.cos(2*j*xi)*Math.sinh(2*j*eta); N += al[j - 1]*Math.sin(2*j*xi)*Math.cosh(2*j*eta); }
  return [500000 + k0*A*E, (south ? 10000000 : 0) + k0*A*N];
}
export function bboxLL(L, pad = 0){ const F = frameAt(L.la, L.lo), h = L.size/2 + pad; let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
  for (const [x, y] of [[-h, -h], [h, -h], [-h, h], [h, h], [0, h], [0, -h], [h, 0], [-h, 0]]){ const [la, lo] = planeToLL(F, x, y); la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
  return [lo0, la0, lo1, la1]; }

// ---------------------------------------------------------------- fetching, with a cache; a polite client
// Every download goes to CACHE first (a rerun fetches nothing); a failing one is retried with a longer wait each time.
export async function cached(key, fetcher){
  const f = path.join(CACHE, key.replace(/[^a-z0-9._-]/gi, '_'));
  if (fs.existsSync(f)) return fs.readFileSync(f);
  for (let k=0;k<7;k++){ try { const b = await fetcher(); fs.writeFileSync(f, b); return b; } catch (e) { if (k === 6) throw e; await sleep(2500*(k + 1)); } }
}
export async function get(url, opt = {}){ const r = await fetch(url, { headers:UA, signal:AbortSignal.timeout(120000), ...opt }); if (!r.ok) throw new Error(url + ' -> ' + r.status); return Buffer.from(await r.arrayBuffer()); }
// a few at a time (the terrain tiles are small; S3 does not mind four)
export async function pool(items, n, fn){ const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length:Math.min(n, items.length) }, async () => { while (i < items.length){ const k = i++; out[k] = await fn(items[k], k); } })); return out; }
// an image sampled by fractional pixel (bilinear); c channels of d (w x h x c)
export const bilinear = (img, fx, fy) => {
  const { w, h, d, c } = img; if (fx < -0.5 || fy < -0.5 || fx > w - 0.5 || fy > h - 0.5) return null;
  fx = clampN(fx, 0, w - 1); fy = clampN(fy, 0, h - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), tx = fx - x0, ty = fy - y0, out = new Array(c);
  for (let k=0;k<c;k++){ const a = d[(y0*w + x0)*c + k], b = d[(y0*w + x1)*c + k], e = d[(y1*w + x0)*c + k], g = d[(y1*w + x1)*c + k]; out[k] = (a*(1 - tx) + b*tx)*(1 - ty) + (e*(1 - tx) + g*tx)*ty; }
  return out;
};
const bilin1 = (d, w, h, fx, fy) => { fx = clampN(fx, 0, w - 1); fy = clampN(fy, 0, h - 1); const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), tx = fx - x0, ty = fy - y0;
  return (d[y0*w + x0]*(1 - tx) + d[y0*w + x1]*tx)*(1 - ty) + (d[y1*w + x0]*(1 - tx) + d[y1*w + x1]*tx)*ty; };

// ---------------------------------------------------------------- Sentinel-2 L2A (Copernicus), a cloud-free composite per layer
// opt: wins (datetime ranges 'YYYY-MM-DD/YYYY-MM-DD', the seasons wanted), cloud (scenes over this share of cloud are not tried, default 60), maxPer
// (scenes kept per tile, default 4), tries (candidates whose SCL is read per tile, default 6), mask ('scl' | 'none'), feather (m, default 4000), tiles (restrict
// to these MGRS codes), gamma (default 0.72: the true-colour product is dark; this lifts the dark tones to about where an aerial photo has them)
const SCL_BAD = new Set([0, 8, 9, 10]);   // no data, clouds (medium, high, thin cirrus); 3 (cloud shadow) counts only near a cloud, 1 (saturated) is kept (snow)
// the catalogue (Earth Search, STAC): one search, following its next links; cached by its own text
async function stacRun(body, pages){
  const feats = [], key = crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 16);
  for (let page=0; page<pages && body; page++){
    const j = JSON.parse(await cached(`stac_${key}_p${page}.json`, () => get('https://earth-search.aws.element84.com/v1/search', { method:'POST', headers:{ ...UA, 'Content-Type':'application/json' }, body:JSON.stringify(body) })));
    feats.push(...(j.features || []));
    const nx = (j.links || []).find(l => l.rel === 'next');
    body = nx && nx.body && (j.features || []).length === body.limit ? Object.assign({}, body, nx.body) : null;
  }
  return feats;
}
const dt = w => w.replace('/', 'T00:00:00Z/') + 'T23:59:59Z';
// the MGRS tiles over a box: one stretch of twelve days with no cloud filter has a scene of every tile
async function stacTiles(bb, win){
  const a = new Date(win.split('/')[0] + 'T00:00:00Z'), b = new Date(+a + 12*864e5), f = await stacRun({ collections:['sentinel-2-l2a'], bbox:bb, datetime:a.toISOString().slice(0, 10) + 'T00:00:00Z/' + b.toISOString().slice(0, 10) + 'T23:59:59Z', limit:100 }, 6);
  return [...new Set(f.map(x => x.properties['grid:code']).filter(Boolean))].sort();
}
// the clearest scenes of one tile in a season
// (scenes cut by the edge of their satellite pass, with most of the tile no data, are left out: they would come first on cloud cover alone)
const stacTile = (bb, tile, win, cloud, n, nodata = 50) => stacRun({ collections:['sentinel-2-l2a'], bbox:bb, query:{ 'grid:code':{ eq:tile }, 'eo:cloud_cover':{ lt:cloud }, 's2:nodata_pixel_percentage':{ lt:nodata } }, datetime:dt(win), limit:n, sortby:[{ field:'properties.eo:cloud_cover', direction:'asc' }] }, 1);
// box dilation of a 0/1 mask by r pixels (separable running sums)
function dilate(m, W, H, r){
  if (r <= 0) return m;
  const t = new Uint8Array(W*H), o = new Uint8Array(W*H);
  for (let y=0;y<H;y++){ let s = 0; for (let x=0;x<Math.min(r, W);x++) s += m[y*W + x]; for (let x=0;x<W;x++){ if (x + r < W) s += m[y*W + x + r]; if (x - r - 1 >= 0) s -= m[y*W + x - r - 1]; t[y*W + x] = s > 0 ? 1 : 0; } }
  for (let x=0;x<W;x++){ let s = 0; for (let y=0;y<Math.min(r, H);y++) s += t[y*W + x]; for (let y=0;y<H;y++){ if (y + r < H) s += t[(y + r)*W + x]; if (y - r - 1 >= 0) s -= t[(y - r - 1)*W + x]; o[y*W + x] = s > 0 ? 1 : 0; } }
  return o;
}
function boxBlur(a, W, H, r){   // (a Float32 array, mean over a (2r+1) square, twice for a soft edge)
  if (r <= 0) return a;
  for (let pass=0;pass<2;pass++){
    const t = new Float32Array(W*H), o = new Float32Array(W*H);
    for (let y=0;y<H;y++){ let s = 0, n = 0; for (let x=0;x<=Math.min(r, W - 1);x++){ s += a[y*W + x]; n++; } for (let x=0;x<W;x++){ t[y*W + x] = s/n; if (x + r + 1 < W){ s += a[y*W + x + r + 1]; n++; } if (x - r >= 0){ s -= a[y*W + x - r]; n--; } } }
    for (let x=0;x<W;x++){ let s = 0, n = 0; for (let y=0;y<=Math.min(r, H - 1);y++){ s += t[y*W + x]; n++; } for (let y=0;y<H;y++){ o[y*W + x] = s/n; if (y + r + 1 < H){ s += t[(y + r + 1)*W + x]; n++; } if (y - r >= 0){ s -= t[(y - r)*W + x]; n--; } } }
    a = o;
  }
  return a;
}
export async function s2Source(L, opt = {}){
  const bb = bboxLL(L, 0), want = L.size/L.px, cloudMax = opt.cloud ?? 60, maxPer = opt.maxPer ?? 4, tries = opt.tries ?? 6, feather = opt.feather ?? 4000, mask = opt.mask ?? 'scl';
  const wins = opt.wins || ['2025-01-01/2026-09-28'];
  // (the catalogue: the tiles over the layer, then each tile's clearest scenes in each season)
  const tileCodes = (opt.tiles || await stacTiles(bb, wins[0])), byTile = {}, all = new Map();
  for (const t of tileCodes) for (const w of wins) for (const f of await stacTile(bb, t, w, cloudMax, tries)) all.set(f.id, f);
  const items = [...all.values()].filter(f => f.assets && f.assets.visual && f.assets.scl && (f.properties['s2:nodata_pixel_percentage'] ?? 0) < 97);
  for (const f of items){ const t = f.properties['grid:code'] || f.id.split('_')[1]; (byTile[t] = byTile[t] || []).push(f); }
  // dates that many tiles share are one satellite pass: scenes from them match their neighbours' colours
  const dates = {}; for (const f of items){ const d = f.properties.datetime.slice(0, 10); dates[d] = (dates[d] || 0) + 1; }
  const res = Math.max(want*0.7, 10), srcs = [], wide = opt.wide || '2024-01-01/2026-09-28';
  // the validity of every pixel of a candidate: no clouds (and their shadows, near a cloud), no no-data; softened at the edges
  const rc = Math.max(1, Math.round(200/res)), rs = Math.max(2, Math.round(1500/res)), rb = Math.max(1, Math.round(Math.min(600, L.size*0.04)/res)), rn = Math.max(1, Math.round(Math.min(2500, L.size*0.1)/res)), readCache = {};
  async function readScene(f){
    if (readCache[f.id]) return readCache[f.id];
    const epsg = f.properties['proj:epsg'] || +String(f.properties['proj:code'] || '').split(':')[1], zone = epsg % 100, south = epsg > 32700;
    // the part of this tile the layer needs, in its UTM metres, at about the output's resolution (geotiff picks the overview)
    const cs = [[bb[1], bb[0]], [bb[1], bb[2]], [bb[3], bb[0]], [bb[3], bb[2]], [(bb[1] + bb[3])/2, bb[0]], [(bb[1] + bb[3])/2, bb[2]], [bb[1], (bb[0] + bb[2])/2], [bb[3], (bb[0] + bb[2])/2]].map(([la, lo]) => toUTM(la, lo, zone, south));
    let e0 = Math.min(...cs.map(c => c[0])), e1 = Math.max(...cs.map(c => c[0])), n0 = Math.min(...cs.map(c => c[1])), n1 = Math.max(...cs.map(c => c[1]));
    // (a read that runs past the edge of the scene repeats its edge pixels: clip to the scene's own box, 109.8 km square)
    const va = f.assets.visual, tf = va['proj:transform'] || f.properties['proj:transform'], shp = va['proj:shape'] || f.properties['proj:shape'];
    let ext = tf && shp ? [tf[2], tf[5] - shp[0]*Math.abs(tf[4]), tf[2] + shp[1]*tf[0], tf[5]] : null;
    if (!ext) ext = JSON.parse(await cached(`s2box_${f.id}.json`, async () => Buffer.from(JSON.stringify((await (await fromUrl(va.href)).getImage(0)).getBoundingBox()))));
    e0 = Math.max(e0, ext[0] + 20); n0 = Math.max(n0, ext[1] + 20); e1 = Math.min(e1, ext[2] - 20); n1 = Math.min(n1, ext[3] - 20);
    if (e1 - e0 < 100 || n1 - n0 < 100) return (readCache[f.id] = null);
    const W = Math.min(Math.ceil((e1 - e0)/res), 4096), H = Math.min(Math.ceil((n1 - n0)/res), 4096), id = `${f.id}_${Math.round(e0)}_${Math.round(n0)}_${Math.round(e1)}_${Math.round(n1)}_${W}x${H}`;
    const rd = (asset, ch, name) => cached(`s2${name}_${id}.bin`, async () => { const t = await fromUrl(f.assets[asset].href); const r = await t.readRasters({ bbox:[e0, n0, e1, n1], width:W, height:H, interleave:ch === 3 }); const a = ch === 3 ? r : r[0]; return Buffer.from(a.buffer, a.byteOffset, a.byteLength); });
    // (snow and ice: the true-colour product stops at a reflectance of 0.25 (Earth Search has already taken out the processing offset: a pixel is its
    // reflectance x 10,000), so sunlit and shaded snow are both pure white. From the three 10 m bands a curve keeps its tones: as the product up
    // to 0.6 of its scale, then a soft shoulder up to the full reflectance of snow)
    const rdHdr = () => cached(`s2hdr_${id}.bin`, async () => {
      const out = Buffer.alloc(W*H*3);
      for (const [k, nm] of [[0, 'red'], [1, 'green'], [2, 'blue']]){
        const as = f.assets[nm], sc = (as['raster:bands'] && as['raster:bands'][0].scale) || 0.0001;
        const t = await fromUrl(as.href), r = await t.readRasters({ bbox:[e0, n0, e1, n1], width:W, height:H }), a = r[0];
        for (let i=0;i<W*H;i++){ const dn = a[i]; if (!dn) continue; const x = Math.max(dn*sc, 0)/0.25, g = x <= 0.6 ? x : 0.6 + 0.4*(1 - Math.exp(-(x - 0.6)/1.0)); out[i*3 + k] = Math.max(3, Math.min(255, Math.round(255*g))); }
      }
      return out;
    });
    const scl = new Uint8Array(await rd('scl', 1, 'scl')), n = W*H, cl = new Uint8Array(n), sh = new Uint8Array(n), nd = new Uint8Array(n);
    for (let i=0;i<n;i++){ const c = scl[i]; if (c === 0) nd[i] = 1; else if (c === 8 || c === 9 || c === 10) cl[i] = 1; else if (c === 3) sh[i] = 1; }
    if (mask === 'none'){ cl.fill(0); sh.fill(0); }
    // (where a scene's data ends, at the edge of its satellite pass, its weight ramps up over a few km; where cloud was, over a few hundred metres, so a patch
    // taken from another date does not show as a hard edge)
    const near = dilate(cl, W, H, rs), hard = dilate(cl, W, H, rc), vc = new Float32Array(n), vn = new Float32Array(n), okm = new Uint8Array(n), ndD = dilate(nd, W, H, rn); let ok = 0;
    for (let i=0;i<n;i++){ vc[i] = (hard[i] || (sh[i] && near[i])) ? 0 : 1; vn[i] = ndD[i] ? 0 : 1; const v = vc[i] && !nd[i] ? 1 : 0; okm[i] = v; ok += v; }
    const wc = boxBlur(vc, W, H, rb), wn = boxBlur(vn, W, H, rn), w = new Float32Array(n); for (let i=0;i<n;i++) w[i] = wc[i]*wn[i];
    log('s');
    return (readCache[f.id] = { f, zone, south, ext, e0, n0, e1, n1, W, H, id, rd, rdHdr, scl, nd, w, ok:okm, valid:ok/n, date:f.properties.datetime.slice(0, 10), cc:f.properties['eo:cloud_cover'] });
  }
  // a tile's scenes: the most valid one first (in 5% steps; then the pass shared by most tiles, then the clearest), then up to maxPer - 1 that fill what is still missing
  async function pickTile(cand){
    const reads = []; for (const f of cand){ const r = await readScene(f); if (r) reads.push(r); }
    const left = reads.slice(), chosen = [], cover = new Uint8Array(Math.max(0, ...reads.map(r => r.W*r.H)));
    let miss = 1;
    while (left.length && chosen.length < maxPer){
      let best = null, bs = -1;
      for (const r of left){ let gain; if (!chosen.length) gain = Math.floor(r.valid*20)/20 + (dates[r.date] || 0)*1e-4 - r.cc*1e-6; else { if (r.W*r.H !== chosen[0].W*chosen[0].H) continue; let g = 0; const n = r.W*r.H; for (let i=0;i<n;i++) if (r.ok[i] && !cover[i]) g++; gain = g/n; if (gain < 0.01) continue; }
        if (gain > bs){ bs = gain; best = r; } }
      if (!best) break;
      left.splice(left.indexOf(best), 1);
      chosen.push(best); const n = best.W*best.H; for (let i=0;i<n;i++) if (best.ok[i]) cover[i] = 1;
      let m = 0; for (let i=0;i<n;i++) if (!cover[i]) m++; miss = m/n; if (miss < 0.02) break;
    }
    chosen.cov = 1 - miss; return chosen;
  }
  for (const t of tileCodes.slice().sort()){
    const cand = (byTile[t] || []).sort((a, b) => a.properties['eo:cloud_cover'] - b.properties['eo:cloud_cover'] || (dates[b.properties.datetime.slice(0, 10)] - dates[a.properties.datetime.slice(0, 10)])).slice(0, tries);
    let chosen = await pickTile(cand);
    // (a tile still missing a part of its ground: look further back in time, with more cloud allowed)
    if (!chosen.length || chosen.cov < 0.97){
      const have = new Set(cand.map(f => f.id)), more = (await stacTile(bb, t, wide, Math.min(cloudMax + 20, 90), tries*2, 70)).filter(f => !have.has(f.id) && f.assets && f.assets.visual && f.assets.scl);
      if (more.length) chosen = await pickTile(cand.concat(more));
    }
    for (let rank=0;rank<chosen.length;rank++){
      const r = chosen[rank], d = new Uint8Array(await (opt.tone === 'hdr' ? r.rdHdr() : r.rd('visual', 3, 'rgb'))), n = r.W*r.H;
      const w = Float32Array.from(r.w), nd = Uint8Array.from(r.nd); for (let i=0;i<n;i++) if (d[i*3] + d[i*3 + 1] + d[i*3 + 2] < 6){ w[i] = 0; nd[i] = 1; }
      srcs.push(Object.assign({}, r, { w, nd, rank, tile:t, img:{ w:r.W, h:r.H, c:3, d } })); log('.');
    }
    for (const k of Object.keys(readCache)) delete readCache[k];
  }
  const dateList = [...new Set(srcs.map(s => s.date))].sort(), gamma = opt.gamma ?? 0.72, zones = [...new Set(srcs.map(s => s.zone + (s.south ? 'S' : 'N')))];
  const maxRank = Math.max(...srcs.map(s => s.rank), 0), byRank = Array.from({ length:maxRank + 1 }, (_, r) => srcs.filter(s => s.rank === r));
  const lift = c => 255*Math.pow(Math.max(c, 0)/255, gamma);
  const sample = (la, lo) => {
    const ut = {}; for (const z of zones){ const zn = parseInt(z), south = z.endsWith('S'); ut[z] = toUTM(la, lo, zn, south); }
    let out0 = 0, out1 = 0, out2 = 0, wat = 0, rem = 1;
    for (const list of byRank){
      let a0 = 0, a1 = 0, a2 = 0, aw = 0, W = 0;
      for (const s of list){
        const [e, n] = ut[s.zone + (s.south ? 'S' : 'N')]; if (e < s.e0 || e > s.e1 || n < s.n0 || n > s.n1) continue;
        const fx = (e - s.e0)/(s.e1 - s.e0)*s.W - 0.5, fy = (s.n1 - n)/(s.n1 - s.n0)*s.H - 0.5, wt0 = bilin1(s.w, s.W, s.H, fx, fy); if (wt0 <= 0.01) continue;
        // (feathered where the scene's own edge is near, so neighbouring scenes blend)
        const de = Math.min(e - s.ext[0], s.ext[2] - e, n - s.ext[1], s.ext[3] - n), wt = wt0*clampN(de/feather, 0, 1); if (wt <= 0.01) continue;
        const v = bilinear(s.img, fx, fy); if (!v) continue;
        a0 += wt*v[0]; a1 += wt*v[1]; a2 += wt*v[2]; W += wt; if (s.scl[clampN(Math.round(fy), 0, s.H - 1)*s.W + clampN(Math.round(fx), 0, s.W - 1)] === 6) aw += wt;
      }
      if (W > 0){ const a = Math.min(1, W); out0 += rem*a*a0/W; out1 += rem*a*a1/W; out2 += rem*a*a2/W; wat += rem*a*aw/W; rem *= 1 - a; if (rem < 0.01) break; }
    }
    if (rem > 0.97){
      // (no clear pixel anywhere: the clearest scene's pixel is better than a hole)
      for (const list of byRank) for (const s of list){ const [e, n] = ut[s.zone + (s.south ? 'S' : 'N')]; if (e < s.e0 || e > s.e1 || n < s.n0 || n > s.n1) continue;
        const fx = (e - s.e0)/(s.e1 - s.e0)*s.W - 0.5, fy = (s.n1 - n)/(s.n1 - s.n0)*s.H - 0.5; if (s.nd[clampN(Math.round(fy), 0, s.H - 1)*s.W + clampN(Math.round(fx), 0, s.W - 1)]) continue;
        const v = bilinear(s.img, fx, fy); if (v) return [lift(v[0]), lift(v[1]), lift(v[2]), 0]; }
      return null;
    }
    const k = 1/(1 - rem); return [lift(out0*k), lift(out1*k), lift(out2*k), wat*k];
  };
  sample.dates = dateList; sample.tiles = Object.keys(byTile).length; sample.scenes = srcs.length;
  return sample;
}

// ---------------------------------------------------------------- heights: Copernicus DEM GLO-30 (metres above sea level, 1 degree COG tiles)
// Credit: "Copernicus DEM GLO-30 (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA".
// Sea is 0; a tile with no land does not exist (the sample is 0 there). Read at about the layer's own resolution (the file's overviews are used).
export async function copSource(L){
  const [lo0, la0, lo1, la1] = bboxLL(L, L.size*0.01), want = L.size/L.px, res = Math.max(want*0.7, 30), tiles = [];
  for (let la=Math.floor(la0); la<=Math.floor(la1); la++) for (let lo=Math.floor(lo0); lo<=Math.floor(lo1); lo++){
    const la2 = String(Math.abs(la)).padStart(2, '0'), lo3 = String(Math.abs(lo)).padStart(3, '0'), nm = `Copernicus_DSM_COG_10_${la < 0 ? 'S' : 'N'}${la2}_00_${lo < 0 ? 'W' : 'E'}${lo3}_00_DEM`;
    // the part of this 1 degree tile the layer needs
    const a0 = Math.max(la, la0), a1 = Math.min(la + 1, la1), b0 = Math.max(lo, lo0), b1 = Math.min(lo + 1, lo1); if (a1 <= a0 || b1 <= b0) continue;
    const H = Math.max(2, Math.ceil((a1 - a0)*111320/res)), W = Math.max(2, Math.ceil((b1 - b0)*111320*Math.cos((a0 + a1)/2*D2R)/res));
    const key = `cop_${nm}_${a0.toFixed(4)}_${b0.toFixed(4)}_${a1.toFixed(4)}_${b1.toFixed(4)}_${W}x${H}.bin.gz`;
    tiles.push({ nm, a0, a1, b0, b1, W, H, key });
  }
  await pool(tiles, 2, async t => {
    const buf = await cached(t.key, async () => {
      const r = await fetch(`https://copernicus-dem-30m.s3.amazonaws.com/${t.nm}/${t.nm}.tif`, { method:'HEAD', headers:UA, signal:AbortSignal.timeout(60000) });
      if (r.status === 404 || r.status === 403) return zlib.gzipSync(Buffer.alloc(0));   // (open sea: no tile)
      if (!r.ok) throw new Error(t.nm + ' ' + r.status);
      const tf = await fromUrl(`https://copernicus-dem-30m.s3.amazonaws.com/${t.nm}/${t.nm}.tif`);
      const ras = await tf.readRasters({ bbox:[t.b0, t.a0, t.b1, t.a1], width:t.W, height:t.H, resampleMethod:'bilinear' });
      const a = ras[0]; return zlib.gzipSync(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
    });
    const raw = zlib.gunzipSync(buf); t.d = raw.length ? new Float32Array(raw.buffer, raw.byteOffset, raw.length/4) : null; log('c');
  });
  const sample = (la, lo) => {
    for (const t of tiles){ if (la < t.a0 || la > t.a1 || lo < t.b0 || lo > t.b1) continue; if (!t.d) return 0;
      const fx = (lo - t.b0)/(t.b1 - t.b0)*t.W - 0.5, fy = (t.a1 - la)/(t.a1 - t.a0)*t.H - 0.5; return bilin1(t.d, t.W, t.H, fx, fy); }
    return 0;
  };
  sample.src = 'cop'; return sample;
}
// ---------------------------------------------------------------- heights: USGS 3DEP (public domain; the best available, 1 to 10 m, lidar where it has been flown; United States only),
// from the National Map image service as a float TIFF, in pieces of at most 1,400 px; the sea and anything outside it is 0
export async function depSource(L){
  const [lo0, la0, lo1, la1] = bboxLL(L, L.size*0.01), want = L.size/L.px, res = Math.max(want*0.8, 10), pieces = [];
  const Wt = Math.ceil((lo1 - lo0)*111320*Math.cos(L.la*D2R)/res), Ht = Math.ceil((la1 - la0)*111320/res), PC = 1400, nx = Math.ceil(Wt/PC), ny = Math.ceil(Ht/PC);
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++){
    const b0 = lo0 + (lo1 - lo0)*i/nx, b1 = lo0 + (lo1 - lo0)*(i + 1)/nx, a1 = la1 - (la1 - la0)*j/ny, a0 = la1 - (la1 - la0)*(j + 1)/ny, W = Math.ceil(Wt/nx), H = Math.ceil(Ht/ny);
    const url = `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox=${b0},${a0},${b1},${a1}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=tiff&pixelType=F32&noData=-9999&interpolation=RSP_BilinearInterpolation&f=image`;
    const buf = await cached(`dep_${b0.toFixed(5)}_${a0.toFixed(5)}_${b1.toFixed(5)}_${a1.toFixed(5)}_${W}x${H}.tif`, async () => { const t = await get(url); if (t[0] !== 0x49 && t[0] !== 0x4d) throw new Error('3DEP: not a TIFF'); return t; });
    const tf = await (await import('geotiff')).fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), ras = await (await tf.getImage()).readRasters(), d = Float32Array.from(ras[0]);
    for (let k=0;k<d.length;k++) if (!(d[k] > -1000)) d[k] = 0;
    pieces.push({ a0, a1, b0, b1, W, H, d }); log('d');
  }
  const sample = (la, lo) => { for (const t of pieces){ if (la < t.a0 || la > t.a1 || lo < t.b0 || lo > t.b1) continue; return bilin1(t.d, t.W, t.H, (lo - t.b0)/(t.b1 - t.b0)*t.W - 0.5, (t.a1 - la)/(t.a1 - t.a0)*t.H - 0.5); } return 0; };
  sample.src = '3dep'; return sample;
}
// ---------------------------------------------------------------- heights: the AWS Terrain Tiles (terrarium PNG: SRTM, 3DEP, ArcticDEM, REMA, ETOPO1), metres above sea level, stitched
export async function terrainSource(L){
  const [lo0, la0, lo1, la1] = bboxLL(L, L.size*0.01), mpp = L.size/L.px;
  let z = Math.round(Math.log2(156543*Math.cos(L.la*D2R)/Math.max(mpp, 4))); z = Math.max(4, Math.min(z, 14)); if (L.z) z = L.z;
  const n = 2**z, tx = lo => (lo + 180)/360*n, ty = la => (1 - Math.log(Math.tan(la*D2R) + 1/Math.cos(la*D2R))/Math.PI)/2*n;
  const X0 = Math.floor(tx(lo0)), X1 = Math.floor(tx(lo1)), Y0 = Math.max(0, Math.floor(ty(la1))), Y1 = Math.min(n - 1, Math.floor(ty(la0))), tiles = {}, list = [];
  for (let x=X0;x<=X1;x++) for (let y=Y0;y<=Y1;y++) list.push([x, y]);
  await pool(list, 4, async ([x, y]) => {
    const b = await cached(`terr_${z}_${x}_${y}.png`, () => get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`));
    const { data, info } = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject:true }), h = new Float32Array(info.width*info.height);
    for (let i=0;i<h.length;i++) h[i] = data[i*3]*256 + data[i*3 + 1] + data[i*3 + 2]/256 - 32768;
    tiles[x + ',' + y] = { w:info.width, h:info.height, d:h };
  });
  // (the stitched mosaic, so a point near a tile's edge is interpolated across it)
  const T = 256, MW = (X1 - X0 + 1)*T, MH = (Y1 - Y0 + 1)*T, mos = new Float32Array(MW*MH);
  for (const [x, y] of list){ const t = tiles[x + ',' + y]; for (let j=0;j<T;j++) mos.set(t.d.subarray(j*T, j*T + T), ((y - Y0)*T + j)*MW + (x - X0)*T); }
  const sample = (la, lo) => { const fx = (tx(lo) - X0)*T - 0.5, fy = (ty(la) - Y0)*T - 0.5; if (fx < -1 || fy < -1 || fx > MW || fy > MH) return 0; return bilin1(mos, MW, MH, fx, fy); };
  sample.src = 'terrarium'; sample.z = z; return sample;
}

// ---------------------------------------------------------------- NAIP (public domain) from the USGS National Map image service, Web Mercator export, sampled by lat, lon
export async function naipSource(L){
  const [lo0, la0, lo1, la1] = bboxLL(L), [x0, y0] = merc(la0, lo0), [x1, y1] = merc(la1, lo1);
  // (the service can answer 502 to a big export: the area is fetched in pieces of at most 1,000 px and stitched)
  const mpp = Math.max(L.size/L.px/1.6, 0.6), W = Math.ceil((x1 - x0)/mpp), H = Math.ceil((y1 - y0)/mpp), PC = 1000, nx = Math.ceil(W/PC), ny = Math.ceil(H/PC);
  const d = Buffer.alloc(W*H*3);
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++){
    const w = Math.min(PC, W - i*PC), h = Math.min(PC, H - j*PC), bx0 = x0 + i*PC*mpp, bx1 = bx0 + w*mpp, by1 = y1 - j*PC*mpp, by0 = by1 - h*mpp;
    const url = `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage?bbox=${bx0},${by0},${bx1},${by1}&bboxSR=3857&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
    const buf = await cached(`naip_${Math.round(bx0)}_${Math.round(by0)}_${Math.round(mpp*100)}_${w}x${h}.jpg`, () => get(url));
    const { data, info } = await sharp(buf).removeAlpha().resize(w, h, { fit:'fill' }).raw().toBuffer({ resolveWithObject:true });
    for (let yy=0;yy<h;yy++) data.copy(d, ((j*PC + yy)*W + i*PC)*3, yy*w*info.channels, (yy + 1)*w*info.channels);
    log('n');
  }
  const img = { w:W, h:H, c:3, d };
  return (la, lo) => { const [x, y] = merc(la, lo), v = bilinear(img, (x - x0)/mpp - 0.5, (y1 - y)/mpp - 0.5); return v && v[0] + v[1] + v[2] > 12 ? v : null; };
}

// ---------------------------------------------------------------- OpenStreetMap through Overpass (ODbL, "(c) OpenStreetMap contributors"): one query at a time, with a pause
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
let lastOverpass = 0;
export async function overpass(ql, key){
  return JSON.parse(await cached('osm_' + key + '.json', async () => {
    let err;
    for (let round=0;round<3;round++) for (const u of OVERPASS){
      const wait = lastOverpass + 6000 - Date.now(); if (wait > 0) await sleep(wait);
      try { const r = await fetch(u, { method:'POST', headers:{ ...UA, 'Content-Type':'application/x-www-form-urlencoded' }, body:'data=' + encodeURIComponent(ql), signal:AbortSignal.timeout(240000) }); lastOverpass = Date.now();
        if (r.ok){ const t = Buffer.from(await r.arrayBuffer()); if (t[0] === 123) return t; } err = u + ' ' + r.status; } catch (e) { lastOverpass = Date.now(); err = u + ' ' + e.message; }
      await sleep(10000*(round + 1));
    }
    throw new Error('Overpass: ' + err);
  }));
}
// footprints (polygons: rings of {lat, lon}) with a height each -> a height raster (m above the ground) for a layer
export function rasterPolys(F, L, polys){
  const N = L.px, h = new Float32Array(N*N), m = L.size/N;
  for (const b of polys) for (const ring of b.rings){
    const pts = ring.map(g => llToPlane(F, g.lat, g.lon)).map(([x, y]) => [(x + L.size/2)/m, (L.size/2 - y)/m]);
    let y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1])))), y1 = Math.min(N - 1, Math.ceil(Math.max(...pts.map(p => p[1]))));
    for (let y=y0;y<=y1;y++){
      const yc = y + 0.5, xs = [];
      for (let i=0, j=pts.length - 1; i<pts.length; j=i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > yc) !== (yj > yc)) xs.push(xi + (yc - yi)/(yj - yi)*(xj - xi)); }
      xs.sort((a, b) => a - b);
      for (let k=0;k + 1<xs.length;k+=2){ const a = Math.max(0, Math.ceil(xs[k] - 0.5)), c = Math.min(N - 1, Math.floor(xs[k + 1] - 0.5)); for (let x=a;x<=c;x++) h[y*N + x] = Math.max(h[y*N + x], b.h); }
    }
  }
  return h;
}
// polylines ({lat, lon} points) with a width in metres: a mask raster (1 where a line passes within half its width, at least a pixel across)
export function rasterLines(F, L, lines, width){
  const N = L.px, mk = new Uint8Array(N*N), m = L.size/N, r = Math.max(width/2, m*0.75)/m;
  for (const ln of lines){
    const pts = ln.map(g => llToPlane(F, g.lat, g.lon)).map(([x, y]) => [(x + L.size/2)/m, (L.size/2 - y)/m]);
    for (let i=0;i + 1<pts.length;i++){
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(len*2));
      if (Math.max(ax, bx) < -r || Math.min(ax, bx) > N + r || Math.max(ay, by) < -r || Math.min(ay, by) > N + r) continue;
      for (let s=0;s<=steps;s++){ const cx = ax + (bx - ax)*s/steps, cy = ay + (by - ay)*s/steps;
        for (let yy=Math.max(0, Math.floor(cy - r));yy<=Math.min(N - 1, Math.ceil(cy + r));yy++) for (let xx=Math.max(0, Math.floor(cx - r));xx<=Math.min(N - 1, Math.ceil(cx + r));xx++) if (Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) <= r) mk[yy*N + xx] = 1; }
    }
  }
  return mk;
}

// ---------------------------------------------------------------- encoding and previews
// rgb (N*N*3 bytes), elev (m, N*N), water (N*N, 1 = water) -> the WebP, its hash, the manifest numbers
export async function encodeLayer(placeKey, L, rgb, elev, water, extra = {}){
  const N = L.px;
  let lo = Infinity, hi = -Infinity; for (let i=0;i<N*N;i++) if (!water[i]){ lo = Math.min(lo, elev[i]); hi = Math.max(hi, elev[i]); }
  if (!isFinite(lo)){ lo = 0; hi = 0; }
  const base = Math.floor(lo), step = Math.max(1, Math.ceil((hi - base)/253));
  // (never fully transparent: WebP rewrites the colour under alpha 0 to save space, which smeared the sea into streaks)
  const rgba = Buffer.alloc(N*N*4);
  for (let i=0;i<N*N;i++){ rgba[i*4] = rgb[i*3]; rgba[i*4 + 1] = rgb[i*3 + 1]; rgba[i*4 + 2] = rgb[i*3 + 2]; rgba[i*4 + 3] = water[i] ? 1 : Math.min(255, 2 + Math.round((elev[i] - base)/step)); }
  const webp = await sharp(rgba, { raw:{ width:N, height:N, channels:4 } }).webp({ quality:extra.quality ?? 72, alphaQuality:100, effort:6, smartSubsample:true }).toBuffer();
  const hash = crypto.createHash('sha1').update(webp).digest('hex').slice(0, 8), file = `${placeKey}-${L.id}-${hash}.webp`;
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(`${placeKey}-${L.id}-`) && f !== file) fs.unlinkSync(path.join(OUT, f));
  fs.writeFileSync(path.join(OUT, file), webp);
  return { file, bytes:webp.length, base, step, top:Math.ceil(hi), rgba };
}
// a preview of one layer from the 8-bit RGBA it was encoded as (so it shows what the page will read): colour x hillshade of the heights
export async function previewLayer(L, enc, size = 512){
  const N = L.px, { rgba, base, step } = enc, m = L.size/N, out = Buffer.alloc(N*N*3), A = i => rgba[i*4 + 3];
  const hgt = i => A(i) < 2 ? 0 : base + (A(i) - 2)*step;
  const lx = -0.55, ly = 0.65, lz = 0.52, zf = Math.min(3.5, Math.max(1, 2.2));   // light from the north-west, relief exaggerated a little
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const i = y*N + x, xa = Math.max(0, x - 1), xb = Math.min(N - 1, x + 1), ya = Math.max(0, y - 1), yb = Math.min(N - 1, y + 1);
    const dx = (hgt(y*N + xb) - hgt(y*N + xa))/((xb - xa)*m), dy = (hgt(yb*N + x) - hgt(ya*N + x))/((yb - ya)*m);   // (dy: toward the south)
    const nx = -dx*zf, ny = dy*zf, nz = 1, nl = Math.hypot(nx, ny, nz), sh = A(i) < 2 ? 0.8 : clampN((nx*lx + ny*ly + nz*lz)/nl/lz, 0.25, 1.6)*0.78 + 0.22;
    out[i*3] = clampN(rgba[i*4]*sh, 0, 255); out[i*3 + 1] = clampN(rgba[i*4 + 1]*sh, 0, 255); out[i*3 + 2] = clampN(rgba[i*4 + 2]*sh, 0, 255);
  }
  const flat = Buffer.alloc(N*N*3); for (let i=0;i<N*N;i++){ flat[i*3] = rgba[i*4]; flat[i*3 + 1] = rgba[i*4 + 1]; flat[i*3 + 2] = rgba[i*4 + 2]; }
  const a = await sharp(flat, { raw:{ width:N, height:N, channels:3 } }).resize(size, size).png().toBuffer(), b = await sharp(out, { raw:{ width:N, height:N, channels:3 } }).resize(size, size).png().toBuffer();
  return [a, b];
}
// one picture per place: a column per layer, colour above, shaded relief below
export async function previewSheet(placeKey, parts, size = 480){
  const W = parts.length*size, comp = [];
  parts.forEach(([a, b], k) => { comp.push({ input:a, left:k*size, top:0 }); comp.push({ input:b, left:k*size, top:size }); });
  await sharp({ create:{ width:W, height:size*2, channels:3, background:{ r:20, g:20, b:20 } } }).composite(comp).png().toFile(path.join(PREVIEW, placeKey + '.png'));
}

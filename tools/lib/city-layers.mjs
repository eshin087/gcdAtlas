// One ground layer of a city, in the launch sites' format (tools/earth-detail.mjs): a square WebP, RGB the ground seen from above, alpha 1 water, else
// 2 + (height above sea level - base)/step, terrain plus buildings. Differences from the launch sites: the water comes from OpenStreetMap (the coastline, so
// reclaimed land such as Dubai's islands is land, and river and lake polygons, so the Seine and the Thames are water) besides the terrain model; the buildings
// are OpenStreetMap's (New York: the city's own footprints inside the five boroughs); `step` is a decimal, to use the 8 bits well (Dubai's finest layer spans 0 to 830 m).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { OUT, CACHE, cached, get, UA, readGz, writeGz, frameAt, planeToLL, llToPlane, bboxLL, gridTiles, clampN, fillRings, assembleRings, photoSource, s2Source, terrainSource, writeHashed, PHOTO } from './city-common.mjs';
import { buildingsTile, waterTile } from './city-osm.mjs';

export const CREDIT = {
  osm:'© OpenStreetMap contributors (ODbL)',
  s2:'Contains modified Copernicus Sentinel data',
  fpac:'USDA NAIP aerial photos',
  gsi:'GSI Japan (国土地理院) seamless aerial photographs, edited',
  ign:'IGN BD ORTHO (Licence Ouverte 2.0)',
  nyc:'NYC Open Data, Building Footprints (NYC Office of Technology and Innovation)',
  terrain:'Terrain: Mapzen Terrain Tiles on AWS (SRTM, USGS 3DEP and other sources)',
};

// ---------------------------------------------------------------- New York's own building footprints (Socrata, NYC Open Data): heights above the ground in feet
const SOC = 'https://data.cityofnewyork.us/resource/5zhs-2jue.json';
async function socrata(url){ return JSON.parse(await cached('soc_' + url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(-180) + '_' + url.length + '.json', () => get(url, { timeout:300000 }))); }
export async function nycTile(tile){
  const key = `nycf_${tile.key}_${tile.bb.join('_')}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const pad = 0.0006, [s, w, n, e] = tile.bb, out = [];
  for (let off=0; ; off+=40000){
    const q = `${SOC}?$select=the_geom,height_roof,bin&$where=${encodeURIComponent(`within_box(the_geom,${n + pad},${w - pad},${s - pad},${e + pad})`)}&$order=bin&$limit=40000&$offset=${off}`;
    const rows = await socrata(q);
    for (const r of rows){
      const g = r.the_geom; if (!g || !g.coordinates) continue;
      const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates], hr = parseFloat(r.height_roof);
      const h = hr > 0 ? Math.max(hr*0.3048, 3) : 6;
      polys.forEach((rings, pi) => out.push({ i:'n' + r.bin + '_' + pi, h:Math.round(h*10)/10, k:'nyc', r:rings.map(ring => ring.flatMap(([lo, la]) => [la, lo])) }));
    }
    if (rows.length < 40000) break;
  }
  writeGz(key, out); return out;
}
export async function nycBoroughs(){
  const key = 'nyc_boroughs.json.gz', hit = readGz(key);
  if (hit) return hit;
  const j = JSON.parse(await cached('nyc_boroughs_raw.json', () => get('https://data.cityofnewyork.us/resource/gthc-hcne.json?$limit=10', { timeout:300000 })));
  const out = [];
  for (const r of j){ const g = r.the_geom; if (!g) continue; for (const poly of (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates])) out.push(poly.map(ring => ring.flatMap(([lo, la]) => [la, lo]))); }
  writeGz(key, out); return out;
}

// ---------------------------------------------------------------- rasterising
function ringsToPixels(flat, F, half, m){
  const pts = []; for (let k=0;k<flat.length;k+=2){ const [x, y] = llToPlane(F, flat[k], flat[k + 1]); pts.push([(x + half)/m, (half - y)/m]); } return pts;
}
// features [{ i, h, r:[flat rings] }] into a height grid (max where they overlap). Returns the count drawn.
function rasterFeatures(feats, seen, F, N, half, m, h){
  let n = 0;
  for (const f of feats){
    if (seen.has(f.i)) continue; seen.add(f.i);
    const rings = f.r.map(fl => ringsToPixels(fl, F, half, m));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const r of rings) for (const p of r){ if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    if (x1 < 0 || y1 < 0 || x0 >= N || y0 >= N) continue;
    const any = fillRings(rings, N, (y, a, c) => { const o = y*N; for (let x=a;x<=c;x++) if (h[o + x] < f.h) h[o + x] = f.h; });
    if (!any){ const cx = Math.floor((x0 + x1)/2), cy = Math.floor((y0 + y1)/2); if (cx >= 0 && cy >= 0 && cx < N && cy < N && h[cy*N + cx] < f.h) h[cy*N + cx] = f.h; }   // (smaller than a pixel: one pixel)
    n++;
  }
  return n;
}
export async function rasterBuildings(city, L, F){
  const N = L.px, half = L.size/2, m = L.size/N, h = new Float32Array(N*N), tiles = gridTiles(bboxLL(L, 150), 3.2, city.la), seen = new Set();
  let n = 0;
  if (city.nyc){
    // inside the five boroughs: the city's own footprints; outside (New Jersey): OpenStreetMap
    const hn = new Float32Array(N*N), ho = new Float32Array(N*N), cover = new Uint8Array(N*N), seenN = new Set();
    for (const t of tiles){ n += rasterFeatures(await nycTile(t), seenN, F, N, half, m, hn); process.stdout.write('c'); }
    for (const t of tiles){ rasterFeatures(await buildingsTile(t), seen, F, N, half, m, ho); process.stdout.write('o'); }
    for (const poly of await nycBoroughs()){ const rings = poly.map(fl => ringsToPixels(fl, F, half, m)); fillRings(rings, N, (y, a, c) => cover.fill(1, y*N + a, y*N + c + 1)); }
    for (let i=0;i<N*N;i++) h[i] = cover[i] ? hn[i] : ho[i];
  } else for (const t of tiles){ n += rasterFeatures(await buildingsTile(t), seen, F, N, half, m, h); process.stdout.write('b'); }
  return { h, n };
}
// water: OpenStreetMap river and lake polygons (water), and the coast (sea: 1 sea, 0 land, -1 a row the coast does not cross)
export async function rasterWater(city, L, F){
  const N = L.px, half = L.size/2, m = L.size/N, water = new Uint8Array(N*N), sea = new Int8Array(N*N).fill(-1), tiles = gridTiles(bboxLL(L, 400), 12.8, city.la), seenP = new Set(), seenC = new Set();
  const cross = Array.from({ length:N }, () => []);
  let nc = 0;
  for (const t of tiles){
    const w = await waterTile(t);
    for (const f of w.poly){
      if (seenP.has(f.i)) continue; seenP.add(f.i);
      const llr = f.r ? f.r : [...assembleRings(f.outerWays || []), ...assembleRings(f.innerWays || [])];
      if (!llr.length) continue;
      const rings = llr.map(r => ringsToPixels(r.flat(), F, half, m));
      fillRings(rings, N, (y, a, c) => water.fill(1, y*N + a, y*N + c + 1));
    }
    for (const c of w.coast){
      if (seenC.has(c.i)) continue; seenC.add(c.i); nc++;
      const p = ringsToPixels(c.p.flat(), F, half, m);
      for (let k=0;k + 1<p.length;k++){
        const [ax, ay] = p[k], [bx, by] = p[k + 1];
        const ya = Math.max(0, Math.ceil(Math.min(ay, by) - 0.5)), yb = Math.min(N - 1, Math.floor(Math.max(ay, by) - 0.5));
        for (let y=ya;y<=yb;y++){ const yc = y + 0.5; if ((ay > yc) === (by > yc)) continue; cross[y].push([ax + (yc - ay)/(by - ay)*(bx - ax), by < ay ? 1 : 0]); }   // (1: the segment runs north, the sea is on its east)
      }
    }
    process.stdout.write('w');
  }
  for (let y=0;y<N;y++){
    const c = cross[y]; if (!c.length) continue;
    c.sort((a, b) => a[0] - b[0]);
    let x = 0;
    const fill = (xa, xb, v) => { const a = Math.max(0, Math.ceil(xa - 0.5)), b = Math.min(N - 1, Math.floor(xb - 0.5)); if (b >= a) sea.fill(v, y*N + a, y*N + b + 1); };
    fill(-1e9, c[0][0], c[0][1] ? 0 : 1);   // (west of the first crossing: land if it runs north, else sea)
    for (let k=0;k<c.length;k++) fill(c[k][0], k + 1 < c.length ? c[k + 1][0] : 1e9, c[k][1] ? 1 : 0);
    void x;
  }
  return { water, sea, coasts:nc };
}

// ---------------------------------------------------------------- colours: the aerial photos set the look; the satellite images are brightened to match (as tools/earth-detail.mjs)
export async function cityGain(city, ctx){
  if (city.photo === 's2') return null;
  const L = city.layers.find(l => l.id === 'r12'), F = frameAt(L.la, L.lo), N = L.px, m = L.size/N;
  const s2 = await ctx.s2For(L), photo = await ctx.photoFor(L, city.photo), terr = await terrainSource(L);
  const A = [0, 0, 0], B = [0, 0, 0]; let n = 0;
  for (let y=0;y<N;y+=8) for (let x=0;x<N;x+=8){ const [la, lo] = planeToLL(F, (x + 0.5)*m - L.size/2, L.size/2 - (y + 0.5)*m), a = photo(la, lo), b = s2(la, lo);
    if (a && b && terr(la, lo) > 0.3){ for (let k=0;k<3;k++){ A[k] += a[k]; B[k] += b[k]; } n++; } }
  if (n < 200) return null;
  const g = [0, 1, 2].map(k => clampN(A[k]/Math.max(B[k], 1), 0.6, 1.9));
  console.log(`${city.key}: satellite images x ${g.map(v => v.toFixed(2)).join(', ')} to match the aerial photos`);
  const knee = c => c < 200 ? c : 200 + 55*(1 - Math.exp(-(c - 200)/55));
  return v => v.map((c, k) => k < 3 ? knee(c*g[k]) : c);
}

// ---------------------------------------------------------------- one layer
export async function buildLayer(city, L, ctx){
  const cityF = frameAt(city.la, city.lo), F = frameAt(L.la, L.lo), N = L.px, m = L.size/N;
  process.stdout.write(`${city.key}-${L.id} (${(L.size/1000).toFixed(1)} km, ${m.toFixed(2)} m/px, ${L.photo}): `);
  const useAerial = L.photo !== 's2';
  const s2 = await ctx.s2For(L), photo = useAerial ? await ctx.photoFor(L, L.photo) : null, terr = await terrainSource(L);
  const bld = L.bld ? await rasterBuildings(city, L, F) : null;
  const wat = await rasterWater(city, L, F);
  const gain = ctx.gain[city.key];
  const rgb = new Uint8Array(N*N*3), elev = new Float32Array(N*N), isWater = new Uint8Array(N*N);
  let photoN = 0, s2N = 0, wN = 0;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const px = (x + 0.5)*m - L.size/2, py = L.size/2 - (y + 0.5)*m, [la, lo] = planeToLL(F, px, py), i = y*N + x;
    const t = terr(la, lo), b = bld ? bld.h[i] : 0, sv = wat.sea[i];
    let w = wat.water[i] === 1 || sv === 1 || (sv === -1 && t <= 0.2);
    if (b > 0.5) w = false;
    isWater[i] = w ? 1 : 0; if (w) wN++;
    let v = photo ? photo(la, lo) : null;
    if (v) photoN++; else { v = s2(la, lo); if (v){ s2N++; if (gain && useAerial) v = gain(v); } }
    if (!v) v = w ? [14, 36, 58] : [96, 92, 78];
    rgb[i*3] = clampN(Math.round(v[0]), 0, 255); rgb[i*3 + 1] = clampN(Math.round(v[1]), 0, 255); rgb[i*3 + 2] = clampN(Math.round(v[2]), 0, 255);
    elev[i] = Math.max(t, 0) + b;
  }
  let lo = Infinity, hi = -Infinity; for (let i=0;i<N*N;i++) if (!isWater[i]){ lo = Math.min(lo, elev[i]); hi = Math.max(hi, elev[i]); }
  if (!isFinite(lo)){ lo = 0; hi = 1; }
  const base = Math.floor(lo), step = Math.max(0.1, Math.ceil((hi - base)/253*10)/10);
  const rgba = Buffer.alloc(N*N*4);
  for (let i=0;i<N*N;i++){ rgba[i*4] = rgb[i*3]; rgba[i*4 + 1] = rgb[i*3 + 1]; rgba[i*4 + 2] = rgb[i*3 + 2]; rgba[i*4 + 3] = isWater[i] ? 1 : Math.min(255, 2 + Math.round((elev[i] - base)/step)); }
  const webp = await sharp(rgba, { raw:{ width:N, height:N, channels:4 } }).webp({ quality:ctx.quality || 70, alphaQuality:100, effort:6, smartSubsample:true }).toBuffer();
  const file = writeHashed(OUT, `${city.key}-${L.id}`, 'webp', webp);
  const [dx, dy] = llToPlane(cityF, L.la, L.lo);
  console.log(` ${(webp.length/1024).toFixed(0)} KB, ${Math.round(100*photoN/(N*N))}% aerial, ${Math.round(100*s2N/(N*N))}% Sentinel-2, ${Math.round(100*wN/(N*N))}% water${bld ? `, ${bld.n} buildings` : ''}, ground ${base} to ${hi.toFixed(0)} m in ${step} m steps`);
  const meta = { id:L.id, name:L.name, file, la:L.la, lo:L.lo, size:L.size, px:N, dx:Math.round(dx), dy:Math.round(dy), base, step, top:Math.ceil(hi), src:[photoN ? L.photo : null, s2N ? 's2' : null].filter(Boolean), s2dates:s2N ? s2.dates : [], bld:bld ? bld.n : 0, bytes:webp.length };
  if (L.airport) meta.airport = L.airport;
  return meta;
}
export function makeCtx(){
  let s2c = {}, pc = {};
  return {
    gain:{}, quality:70,
    free(){ s2c = {}; pc = {}; },   // (the images of one layer are big: let go of them before the next)
    s2For: async L => { const k = `${L.la},${L.lo},${L.size}`; return s2c[k] || (s2c[k] = await s2Source(L)); },
    photoFor: async (L, key) => { const k = `${key},${L.la},${L.lo},${L.size},${L.px}`; return pc[k] || (pc[k] = await photoSource(L, key)); },
  };
}
void fs; void path; void CACHE; void UA; void PHOTO; void writeGz;

// Builds the names the search finds on Earth (phase 2 of docs/EARTH_PLAN.md): one compact list, fetched by the page the first time a search
// is typed (e7s-earth-search.js), never inside the page:
//   - cities: GeoNames' cities of 15,000 people or more (CC BY 4.0, "GeoNames, geonames.org"), with their country and population;
//   - mountains and spot heights: Natural Earth's 10 m elevation points (public domain), with their height;
//   - regions (deserts, ranges, plateaus, deltas, islands...) and waters (oceans, seas, gulfs, bays, straits): Natural Earth's 10 m
//     geography polygons and points, placed at the middle of their shape, with their size.
// Written to assets/earth/names-<hash>.json with its name in src/objects/e6n-earth-names-data.js (EARTH_NAMES). The list's rows:
//   [name, kind, lat, lon, n, country code, what]   kind: c city (n people), C capital, m mountain or spot height (n m above the sea),
//   r region, i island, w water (n: its size, km across); what: the kind of region or water in words ("desert", "gulf"), else ''
// Sources are cached in tools/cache/earth-names/ (not committed). Usage, from tools/: node earth-names.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const CACHE = path.join(HERE, 'cache', 'earth-names'), OUT = path.join(ROOT, 'assets', 'earth');
fs.mkdirSync(CACHE, { recursive:true });
const UA = { 'User-Agent':'gcdatlas-earth-names (https://gcdatlas.com; github eshin087/gcdatlas)' };
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
async function get(f, url){
  const p = path.join(CACHE, f); if (fs.existsSync(p) && fs.statSync(p).size > 100) return fs.readFileSync(p);
  const r = await fetch(url, { headers:UA }); if (!r.ok) throw new Error(url + ' ' + r.status);
  const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(p, b); return b;
}
// the one file in a zip (GeoNames' are single-entry): its local header, then the deflated data
function unzip1(b){
  const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), cd = b.readUInt32LE(eocd + 16);
  const method = b.readUInt16LE(cd + 10), csize = b.readUInt32LE(cd + 20), off = b.readUInt32LE(cd + 42);
  const n = b.readUInt16LE(off + 26), m = b.readUInt16LE(off + 28), data = b.subarray(off + 30 + n + m, off + 30 + n + m + csize);
  return method === 8 ? zlib.inflateRawSync(data) : data;
}
const D = Math.PI/180, r3 = x => Math.round(x*1000)/1000;
// the middle of a shape (the mean of its outline's points as directions, so a shape across 180 degrees comes out right) and its size (km
// across: twice the farthest outline point)
function middle(geom){
  const rings = geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.type === 'MultiPolygon' ? geom.coordinates.map(p => p[0]) : [[geom.coordinates]];
  let s = [0, 0, 0]; const pts = [];
  for (const ring of rings) for (const [lo, la] of ring){ const v = [Math.cos(la*D)*Math.cos(lo*D), Math.cos(la*D)*Math.sin(lo*D), Math.sin(la*D)]; pts.push(v); s = s.map((x, k) => x + v[k]); }
  const l = Math.hypot(...s) || 1, c = s.map(x => x/l);
  let far = 0; for (const v of pts) far = Math.max(far, Math.acos(Math.min(1, v[0]*c[0] + v[1]*c[1] + v[2]*c[2])));
  return { la:Math.asin(c[2])/D, lo:Math.atan2(c[1], c[0])/D, km:Math.round(2*far*6371) };
}
const rows = [], cc = {};
// countries: ISO code -> name
for (const line of (await get('countryInfo.txt', 'https://download.geonames.org/export/dump/countryInfo.txt')).toString('utf8').split('\n')){
  if (!line || line[0] === '#') continue; const f = line.split('\t'); if (f[0] && f[4]) cc[f[0]] = f[4]; }
// cities (GeoNames: id, name, asciiname, alternatenames, lat, lon, class, code, country, cc2, admin1-4, population, elevation, dem, timezone, date)
const cities = unzip1(await get('cities15000.zip', 'https://download.geonames.org/export/dump/cities15000.zip')).toString('utf8');
// (a part named after its city and a number: "Paris 15 Vaugirard", "Marseille 08"; "Mile 91" is a town of its own)
const cityNames = new Set(cities.split('\n').map(l => l.split('\t')[1]));
const partOf = n => { const m = /^(.+?) \d{1,2}\b/.exec(n); return !!m && cityNames.has(m[1]); };
for (const line of cities.split('\n')){
  const f = line.split('\t'); if (f.length < 15) continue;
  // (not the parts of a city, nor places gone: sections (PPLX), parts named after their city, historical, destroyed and abandoned places)
  const pop = +f[14]; if (!(pop >= 15000) || /^PPL[XHWQ]$/.test(f[7]) || partOf(f[1])) continue;
  rows.push([f[1], f[7] === 'PPLC' ? 'C' : 'c', r3(+f[4]), r3(+f[5]), pop, f[8], '']);
}
const nc = rows.length;
// mountains and spot heights
const ep = JSON.parse(await get('elev.geojson', NE + 'ne_10m_geography_regions_elevation_points.geojson'));
for (const ft of ep.features){ const p = ft.properties, [lo, la] = ft.geometry.coordinates, name = p.name_en || p.name;
  if (!name || !/mountain|spot elevation|plateau|pass/.test(p.featurecla) || !(p.elevation > 0)) continue;
  rows.push([name, 'm', r3(la), r3(lo), Math.round(p.elevation), '', p.featurecla === 'mountain' || p.featurecla === 'spot elevation' ? '' : p.featurecla]); }
const nm = rows.length - nc;
// regions and waters (their classes in words)
const WORD = { 'Range/mtn':'mountain range', 'Pen/cape':'peninsula', 'Island group':'island group', Geoarea:'region', Coast:'coast', Wetlands:'wetlands' };
const rp = JSON.parse(await get('regions.geojson', NE + 'ne_10m_geography_regions_polys.geojson'));
for (const ft of rp.features){ const p = ft.properties, name = p.NAME_EN || p.NAME, cl = p.FEATURECLA;
  if (!name || !cl || /Continent|Dragons/.test(cl)) continue;
  const m = middle(ft.geometry); rows.push([name, /Island/.test(cl) ? 'i' : 'r', r3(m.la), r3(m.lo), Math.max(m.km, 20), '', WORD[cl] || cl.toLowerCase()]); }
const pp = JSON.parse(await get('points.geojson', NE + 'ne_10m_geography_regions_points.geojson'));
for (const ft of pp.features){ const p = ft.properties, name = p.name_en || p.name, [lo, la] = ft.geometry.coordinates;
  if (!name || /pole/.test(p.featurecla)) continue;
  rows.push([name, /island/.test(p.featurecla) ? 'i' : 'r', r3(la), r3(lo), 30, '', p.featurecla]); }
const mp = JSON.parse(await get('marine.geojson', NE + 'ne_10m_geography_marine_polys.geojson'));
for (const ft of mp.features){ const p = ft.properties, name = p.name_en || p.name;
  if (!name || p.featurecla === 'generic') continue;
  const m = middle(ft.geometry); rows.push([name, 'w', r3(m.la), r3(m.lo), Math.max(m.km, 20), '', p.featurecla]); }
// (the countries named by the rows only)
const used = {}; for (const r of rows) if (r[5] && cc[r[5]]) used[r[5]] = cc[r[5]];
// (empty fields at the end of a row are left out)
const json = JSON.stringify({ v:1, cc:used, p:rows.map(r => { const a = r.slice(); while (a.length > 5 && a[a.length - 1] === '') a.pop(); return a; }) });
const hash = crypto.createHash('sha1').update(json).digest('hex').slice(0, 8), file = `names-${hash}.json`;
for (const f of fs.readdirSync(OUT)) if (/^names-[0-9a-f]{8}\.json$/.test(f) && f !== file) fs.unlinkSync(path.join(OUT, f));
fs.writeFileSync(path.join(OUT, file), json);
fs.writeFileSync(path.join(ROOT, 'src', 'objects', 'e6n-earth-names-data.js'),
  `// generated by tools/earth-names.mjs: the names the search finds on Earth, served as earth/<file> (e7s-earth-search.js fetches it on the first search)\nconst EARTH_NAMES = ${JSON.stringify({ file, n:rows.length })};\n`);
console.log(`${file}: ${rows.length} names (${nc} cities, ${nm} heights, ${rows.length - nc - nm} regions and waters), ${(json.length/1024).toFixed(0)} KB, gzip ${(zlib.gzipSync(json).length/1024).toFixed(0)} KB`);

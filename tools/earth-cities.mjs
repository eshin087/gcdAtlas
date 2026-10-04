// Builds the data for the five cities of the real Earth's phase 4 (cities alive): New York, Tokyo, Dubai, London, Paris.
// For each city (see tools/lib/city-config.mjs for the layers, tools/lib/city-facts.mjs for the facts and framings):
//   - ground layers in the launch sites' format (square WebP: RGB the ground, alpha 1 water else 2 + (height - base)/step; terrain plus buildings):
//     about 51 km (Sentinel-2), 12.8 km and 3.2 km round the centre (aerial photos where open ones exist), and an own layer for each airport;
//   - roads for traffic (motorway to secondary across the region, tertiary in the inner 13 km) as a line binary;
//   - airports (runways in the manifest, taxiways and aprons as a line binary), ships (ferry routes, ports, marinas as a line binary, terminals and
//     anchorages in the manifest), the tallest buildings and towers;
//   - the city's facts and suggested camera framings.
// Writes assets/earth/cities/<city>-<what>-<hash>.{webp,bin} and src/objects/e9-earth-cities-data.js (const EARTH_CITIES = {...}).
// Sources: OpenStreetMap (ODbL), Sentinel-2 (Copernicus), USDA NAIP, IGN BD ORTHO, GSI Japan seamless photos, NYC Open Data, AWS Terrain Tiles.
// Needs tools/ dependencies (npm install in tools/: sharp, geotiff). Everything downloaded is cached in tools/cache/earth-cities (git-ignored), so a rerun
// fetches nothing; the Overpass queries run one at a time with a pause. Takes an hour or two for all five cities the first time.
//   node tools/earth-cities.mjs [city ...] [--stages=air,roads,sea,towers,layers,facts,preview] [--quality=70]
// (the previews, PNGs of each layer with its lines drawn over it, are written to tools/cache/earth-cities/preview/; with no --stages everything but the previews runs)
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, OUT, ROOT, frameAt, llToPlane, unpackLines, terrainSource } from './lib/city-common.mjs';
import { CITIES } from './lib/city-config.mjs';
import { buildLayer, makeCtx, cityGain, CREDIT } from './lib/city-layers.mjs';
import { buildRoads, buildAirports, buildSea } from './lib/city-build.mjs';
import { buildTowers } from './lib/city-towers.mjs';
import { FACTS, SOURCES } from './lib/city-facts.mjs';
import { previewLayer } from './lib/city-preview.mjs';
import { renderView } from './lib/city-view.mjs';

const args = process.argv.slice(2), only = args.filter(a => !a.startsWith('--')), flag = n => (args.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const stages = (flag('stages') || 'air,roads,sea,towers,layers,facts').split(','), quality = +flag('quality') || 70;
const manFile = k => path.join(CACHE, `manifest-${k}.json`), readMan = k => { try { return JSON.parse(fs.readFileSync(manFile(k), 'utf8')); } catch (e) { return {}; } };

// ---------------------------------------------------------------- previews: each layer's photo and hillshade with its roads, runways, ferries and ports drawn over it
async function previews(city, man){
  const cityF = frameAt(city.la, city.lo), rd = f => unpackLines(fs.readFileSync(path.join(OUT, f))).lines;
  const roads = man.roads ? rd(man.roads.file) : [], air = man.air ? rd(man.air.file) : [], sea = man.sea ? rd(man.sea.file) : [];
  const RC = [[255, 150, 40], [255, 190, 60], [255, 235, 90], [250, 250, 250], [190, 220, 255]];
  for (const L of man.layers){
    const wide = L.size > 20000, mid = L.size > 6000, w = wide ? 0 : mid ? 0 : 1, ov = [];
    ov.push({ lines:roads.filter(l => !(l.flags & 8)).map(l => ({ pts:l.pts, col:RC[l.cls], w:l.cls <= 1 && !wide ? w + 1 : w })), w });
    ov.push({ lines:air.map(l => ({ pts:l.pts, col:l.cls === 2 ? [120, 140, 200] : [200, 200, 200], closed:!!(l.flags & 1), w:0 })) });
    ov.push({ lines:sea.map(l => ({ pts:l.pts, col:l.cls === 0 ? [255, 60, 220] : l.cls === 1 ? [60, 255, 255] : [60, 255, 120], closed:!!(l.flags & 1), w:l.cls === 0 ? 1 : 0 })) });
    ov.push({ lines:(man.airports || []).map(a => a.runways.map(r => ({ pts:[llToPlane(cityF, r.a[1], r.a[2]), llToPlane(cityF, r.b[1], r.b[2])], col:[255, 255, 255], w:Math.max(1, Math.round(r.w/(L.size/L.px)/2)) }))).flat() });
    ov.push({ lines:(man.towers || []).map(t => { const p = llToPlane(cityF, t.la, t.lo); return { pts:[[p[0] - 25, p[1]], [p[0] + 25, p[1]]], col:[255, 0, 0], w:wide ? 1 : 2 }; }) });
    const f = await previewLayer(L, ov, `${city.key}-${L.id}`, 1500);
    console.log('  preview ' + path.relative(ROOT, f));
  }
}

for (const city of CITIES){
  if (only.length && !only.includes(city.key)) continue;
  console.log('\n=== ' + city.key);
  const man = readMan(city.key), photoOf = L => L.id === 'r51' ? 's2' : city.photo;
  const layers = city.layers.map(L => ({ ...L, photo:photoOf(L) }));
  if (stages.includes('air')){ const a = await buildAirports(city, layers); man.air = { file:a.file, bytes:a.bytes }; man.airports = a.airports; }
  if (stages.includes('roads')){ const r = await buildRoads(city, layers); man.roads = { file:r.file, bytes:r.bytes, unit:r.unit, lines:r.lines, points:r.pts, km:r.km }; }
  if (stages.includes('sea')){ const s = await buildSea(city, layers); man.sea = { file:s.file, bytes:s.bytes, ferryRoutes:s.nFerry, names:s.names, terminals:s.terminals, anchorages:s.anchorages }; }
  if (stages.includes('towers')) man.towers = await buildTowers(city, layers);
  if (stages.includes('layers')){
    const ctx = makeCtx(); ctx.quality = quality;
    if (city.photo !== 's2') ctx.gain[city.key] = await cityGain(city, ctx);
    const all = [...layers];
    for (const a of man.airports || []) all.push({ id:'ap-' + a.iata.toLowerCase(), name:a.name, la:a.centre[0], lo:a.centre[1], size:a.size, px:1024, bld:true, photo:city.photo, airport:a.iata });
    // (--layers=r51,cite builds only those and keeps the others from the last run)
    const want = flag('layers') ? flag('layers').split(',') : null, done = [];
    for (const L of all){
      if (want && !want.includes(L.id)){ const o = (man.layers || []).find(l => l.id === L.id); if (o) done.push(o); continue; }
      done.push(await buildLayer(city, L, ctx)); ctx.free();
    }
    man.layers = done;
  }
  if (stages.includes('facts')) man.facts = FACTS[city.key];
  // the ground height at the centre (the sea level where it is flat) and the highest ground or roof of any layer: the page's ray march starts from `top`
  if (stages.includes('layers')){ const t = await terrainSource({ la:city.la, lo:city.lo, size:1600, px:1024 }); man.ele = Math.round(Math.max(0, t(city.la, city.lo))*10)/10; man.top = Math.max(...man.layers.map(l => l.top)); }
  Object.assign(man, { key:city.key, name:city.name, la:city.la, lo:city.lo, drive:city.drive, tz:FACTS[city.key].tz, country:FACTS[city.key].country });
  fs.writeFileSync(manFile(city.key), JSON.stringify(man));
  if (stages.includes('preview') && man.layers) await previews(city, man);
  if (stages.includes('view') && man.layers) for (const [i, v] of (man.facts?.views || []).entries()) console.log('  view ' + path.relative(ROOT, await renderView(man, v, `${city.key}-view${i}`, 800, 450)));
}

// ---------------------------------------------------------------- the manifest (every city with a cached manifest)
const cities = [], bytes = c => [...(c.layers || []).map(l => l.bytes), c.roads?.bytes, c.air?.bytes, c.sea?.bytes].reduce((s, v) => s + (v || 0), 0);
for (const c of CITIES){ const m = readMan(c.key); if (m.layers) cities.push(m); }
const manifest = { made:new Date().toISOString().slice(0, 10), sources:SOURCES, credit:CREDIT, cities };
const js = `// generated by tools/earth-cities.mjs on ${manifest.made}: do not edit by hand. The five cities of the real Earth's phase 4 (cities alive).
// The files are in assets/earth/cities/ (served as earth/cities/<file>). A city:
//   key, name, country, tz (IANA), la, lo (its centre: the origin of the line files' metres, and where its sun, clock and weather are taken), drive 'left' | 'right', ele (ground m at the centre),
//   top (highest ground or roof of any layer, m), facts { population { n, year, of, source }, facts [sentences], aka 'search words', views [{ look [la, lo, m], az, tilt, dist, why }] }
//   layers [{ id, name, file, la, lo, size (m), px, dx, dy, base, step, top, src, s2dates, bld, bytes, painted?, airport? }]
//     a square WebP <size> m across, centred on <la, lo> in the orthographic projection of a 6,371 km sphere (as the launch sites' layers: x east, y north, row 0 the north edge);
//     RGB the ground seen from above, alpha 1 water, else 2 + (height above sea level - base)/step (terrain plus buildings; step is a decimal);
//     dx, dy: the layer's centre in metres east and north of the city's centre; painted: the colours are Sentinel-2 painted over with OpenStreetMap's roads and buildings;
//     airport: the IATA code of the airport the layer is for
//   roads { file, bytes, unit, lines, points, km [motorway, trunk, primary, secondary, tertiary] }, air { file, bytes }, sea { file, bytes, ferryRoutes, names [], terminals [{ name, kind, la, lo }], anchorages [{ name, la, lo }] }
//     line binaries "GCL1", little endian:
//       0  char[4] 'GCL1'   4  uint32 nLines   8  uint32 nPts   12  float32 unit (m per int16 unit, 2)
//       16 uint32[nLines + 1] start (line i is points start[i] .. start[i + 1] - 1)
//       then int16[2 * nPts] x, y (x unit m east, y unit m north of the city's centre), then uint8[nLines] each of: cls, a, flags, grp
//     roads: cls 0 motorway, 1 trunk, 2 primary, 3 secondary, 4 tertiary; a = lanes in all (the OpenStreetMap tag, else a guess: 2 one-way / 4 two-way on motorways and trunks, 1 / 2 on the rest);
//       flags bit 1 one-way (traffic runs in point order), bit 2 bridge, bit 3 tunnel, bit 4 link or ramp, bit 5 roundabout; grp 0
//     air (taxiways and aprons): cls 0 taxiway, 1 taxilane, 2 apron outline; flags bit 0 closed ring; grp = 1 + index into airports
//     sea: cls 0 ferry route (a 1 when cars go too), 1 port or harbour area, 2 marina, 3 dock; flags bit 0 closed ring (areas); grp = index into sea.names (0 none)
//   airports [{ iata, icao, name, la, lo, ele, eleSrc, centre [la, lo], size, runways [{ ref, a [designator, la, lo], b [designator, la, lo], len, w, surface }] }]
//     a and b are the two ends (the designator of each end is the heading, tens of degrees, an aircraft lands on there); len, w in m; ele in m above the sea
//   towers [{ name, la, lo, h (m), kind 'building' | 'tower' | 'mast' | 'chimney', thin, src }] the tallest first
// Credits: see sources and credit below; every layer that shows OpenStreetMap data needs "© OpenStreetMap contributors (ODbL)".
const EARTH_CITIES = ${JSON.stringify(manifest)};
`;
fs.writeFileSync(path.join(ROOT, 'src', 'objects', 'e9-earth-cities-data.js'), js);
console.log('\nmanifest: src/objects/e9-earth-cities-data.js; ' + (cities.map(c => `${c.key} ${(bytes(c)/1048576).toFixed(1)} MB`).join(', ') || 'no city with layers yet'));

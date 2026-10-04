// OpenStreetMap through Overpass, read into small things: building footprints with heights, water and coast, roads, airports, ferries and ports, tall buildings.
// Everything here is cached by tools/lib/city-common.mjs (the raw answers gzipped, the readings of the building tiles too), so a rerun asks for nothing.
import { overpass, readGz, writeGz, gridTiles, haversine, bearing, D2R } from './city-common.mjs';

// ---------------------------------------------------------------- tags
// a height tag in metres, feet ("1776'", "12 ft") or with a unit ("45 m"); null when it is not a number
export function parseHeight(s){
  if (s == null) return null;
  const t = String(s).trim().toLowerCase().replace(',', '.');
  let m = t.match(/^(-?\d+(?:\.\d+)?)\s*(?:m|meter|metre|meters|metres)?$/); if (m) return +m[1];
  m = t.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|')$/); if (m) return +m[1]*0.3048;
  m = t.match(/^(\d+)'\s*(\d+(?:\.\d+)?)?"?$/); if (m) return +m[1]*0.3048 + (+m[2] || 0)*0.0254;
  return null;
}
// a guess for a building with no height and no levels, by kind (metres)
const KIND_H = { hangar:14, industrial:11, warehouse:10, factory:12, storage_tank:12, tank:12, silo:20, water_tower:30, hotel:22, office:20, commercial:16, apartments:16, residential:10, dormitory:14,
  house:7, detached:7, semidetached_house:8, terrace:9, bungalow:4, church:14, cathedral:25, chapel:8, mosque:12, temple:10, shrine:6, retail:8, supermarket:7, garage:3, garages:3, parking:9,
  shed:3, roof:5, carport:3, kiosk:3, hut:3, cabin:4, service:5, train_station:12, transportation:10, hospital:20, university:14, school:12, college:14, public:12, civic:12, government:16,
  stadium:25, sports_hall:12, museum:14, theatre:14, fire_station:8, greenhouse:4, barn:7, farm_auxiliary:5, stable:5, terminal:15, yes:7 };
export function guessHeight(kind, levels){ return levels > 0 ? levels*3.3 + 1.5 : (KIND_H[kind] || 7); }

// ---------------------------------------------------------------- buildings: footprints with heights, one tile at a time
// returns [{ i, h, k, r:[[lat, lon, lat, lon, ...], ...] }]: i the OSM id, h the height above the ground (m), r the rings (all of a multipolygon's outer and inner rings: even-odd)
function buildingFeatures(j){
  const out = [];
  for (const el of j.elements || []){
    const t = el.tags || {}, rings = [];
    if (+t.layer < 0 || /underground/.test(t.location || '') || t.building === 'construction' || t.building === 'proposed' || t['construction:aeroway']) continue;
    // (lattice towers and masts become solid blocks in a height map: the towers' own list has them)
    if (/^(tower|mast|communications_tower|chimney)$/.test(t.man_made || '')) continue;
    if (el.type === 'way' && el.geometry) rings.push(el.geometry.map(g => [g.lat, g.lon]));
    else if (el.type === 'relation'){ if (t.type !== 'multipolygon') continue; for (const m of el.members || []) if ((m.role === 'outer' || m.role === 'inner') && m.geometry) rings.push(m.geometry.map(g => [g.lat, g.lon])); }
    if (!rings.length) continue;
    const kind = t.building && t.building !== 'yes' ? t.building : t['building:part'] && t['building:part'] !== 'yes' ? t['building:part'] : 'yes';
    let h = parseHeight(t.height ?? t['building:height']); const lv = parseFloat(t['building:levels']), mh = parseHeight(t.min_height) || 0;
    // (heights over 120 m must be a named landmark or have the levels to match: others are typing mistakes in the data)
    if (h != null && (h < 1 || h > 120 && !(t.name || t.wikidata || lv >= h/6) || h > 900)) h = null;
    if (h == null) h = guessHeight(kind, lv);
    if (t['building:part'] && mh > 0.5*h) continue;   // (a part floating high above the ground would be a pillar in a height map)
    out.push({ i:el.type[0] + el.id, h:Math.round(h*10)/10, k:kind, r:rings.map(r => r.flat()) });
  }
  return out;
}
export async function buildingsTile(tile, depth = 0){
  const key = `bldf_${tile.key}_${tile.bb.join('_')}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const b = tile.bb.join(',');
  let f;
  try {
    const j = await overpass(`(way["building"](${b});way["building:part"](${b});relation["building"]["type"="multipolygon"](${b});relation["building:part"]["type"="multipolygon"](${b}););out geom;`, 'bld', depth ? 4 : 3);
    f = buildingFeatures(j);
  } catch (e) {
    // (a dense tile that the server cannot answer in time: ask for its four quarters instead)
    if (depth >= 2) throw e;
    console.log(`\n  tile ${tile.key} too heavy (${e.message.slice(0, 80)}): in four`);
    const [s, w, n, ea] = tile.bb, ms = (s + n)/2, mw = (w + ea)/2, seen = new Set(); f = [];
    for (const [i, bb] of [[s, w, ms, mw], [s, mw, ms, ea], [ms, w, n, mw], [ms, mw, n, ea]].entries())
      for (const x of await buildingsTile({ key:tile.key + 'q' + i, bb:bb.map(v => +v.toFixed(5)) }, depth + 1)) if (!seen.has(x.i)){ seen.add(x.i); f.push(x); }
  }
  writeGz(key, f); return f;
}

// ---------------------------------------------------------------- water and coast
// returns { poly:[[ring of [lat, lon]]...] (one entry per feature, its rings), coast:[[ [lat, lon]... ]] }
function waterFeatures(j){
  const poly = [], coast = [];
  for (const el of j.elements || []){
    const t = el.tags || {};
    if (t.natural === 'coastline'){ if (el.geometry) coast.push({ i:el.id, p:el.geometry.map(g => [g.lat, g.lon]) }); continue; }
    if (t.water === 'fountain' || t.water === 'swimming_pool' || t.intermittent === 'yes' && !t.name) continue;
    if (el.type === 'way' && el.geometry){ const r = el.geometry.map(g => [g.lat, g.lon]); if (r.length > 3) poly.push({ i:'w' + el.id, r:[r] }); }
    else if (el.type === 'relation'){
      const outer = [], inner = [];
      for (const m of el.members || []) if (m.geometry) (m.role === 'inner' ? inner : m.role === 'outer' ? outer : []).push(m.geometry.map(g => [g.lat, g.lon]));
      poly.push({ i:'r' + el.id, outerWays:outer, innerWays:inner });
    }
  }
  return { poly, coast };
}
export async function waterTile(tile, depth = 0){
  const key = `watf_${tile.key}_${tile.bb.join('_')}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const b = tile.bb.join(',');
  let f;
  try { f = waterFeatures(await overpass(`(way["natural"="water"](${b});relation["natural"="water"](${b});way["waterway"="riverbank"](${b});relation["waterway"="riverbank"](${b});way["landuse"="reservoir"](${b});relation["landuse"="reservoir"](${b});way["natural"="coastline"](${b}););out geom;`, 'wat', depth ? 4 : 3)); }
  catch (e) {
    if (depth >= 2) throw e;
    console.log(`\n  water tile ${tile.key} too heavy: in four`);
    const seenP = new Set(), seenC = new Set(); f = { poly:[], coast:[] };
    for (const q of quarters(tile)){ const w = await waterTile(q, depth + 1); for (const p of w.poly) if (!seenP.has(p.i)){ seenP.add(p.i); f.poly.push(p); } for (const c of w.coast) if (!seenC.has(c.i)){ seenC.add(c.i); f.coast.push(c); } }
  }
  writeGz(key, f); return f;
}

// ---------------------------------------------------------------- roads
export const ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
function roadWays(j){
  const out = [];
  for (const el of j.elements || []){
    if (el.type !== 'way' || !el.geometry) continue;
    const t = el.tags || {}, hw = t.highway || '', base = hw.replace(/_link$/, ''), cls = ROAD_CLASSES.indexOf(base);
    if (cls < 0) continue;
    if (t.area === 'yes' || t.access === 'no' && !t.service) continue;
    const link = /_link$/.test(hw) ? 1 : 0, round = t.junction === 'roundabout' || t.junction === 'circular' ? 1 : 0;
    let ow = t.oneway; let oneway = 0, rev = false;
    if (ow === 'yes' || ow === 'true' || ow === '1') oneway = 1; else if (ow === '-1' || ow === 'reverse'){ oneway = 1; rev = true; }
    else if (!ow && (base === 'motorway' || round)) oneway = 1;
    if (t.highway === 'motorway' && ow === 'no') oneway = 0;
    let lanes = parseInt(t.lanes); if (!(lanes > 0)) lanes = 0;
    const bridge = t.bridge && t.bridge !== 'no' ? 1 : 0, tunnel = t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage' ? 1 : 0;
    let p = el.geometry.map(g => [g.lat, g.lon]); if (rev) p.reverse();
    out.push({ i:el.id, cls, link, round, oneway, lanes, bridge, tunnel, p, name:t.name || '' });
  }
  return out;
}
const quarters = tile => { const [s, w, n, ea] = tile.bb, ms = (s + n)/2, mw = (w + ea)/2; return [[s, w, ms, mw], [s, mw, ms, ea], [ms, w, n, mw], [ms, mw, n, ea]].map((bb, i) => ({ key:tile.key + 'q' + i, bb:bb.map(v => +v.toFixed(5)) })); };
export async function roadsTile(tile, tertiary, depth = 0){
  const key = `roadf_${tile.key}_${tertiary ? 't' : 'm'}_${tile.bb.join('_')}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const b = tile.bb.join(','), cl = tertiary ? 'motorway|trunk|primary|secondary|tertiary' : 'motorway|trunk|primary|secondary';
  let f;
  try { f = roadWays(await overpass(`way["highway"~"^(${cl})(_link)?$"](${b});out geom tags;`, 'road', depth ? 4 : 3)); }
  catch (e) {
    // (a tile the server cannot answer in time: its four quarters, which share their ways: the ways are kept once)
    if (depth >= 2) throw e;
    console.log(`\n  road tile ${tile.key} too heavy: in four`);
    const seen = new Set(); f = [];
    for (const q of quarters(tile)) for (const w of await roadsTile(q, tertiary, depth + 1)) if (!seen.has(w.i)){ seen.add(w.i); f.push(w); }
  }
  writeGz(key, f); return f;
}

// ---------------------------------------------------------------- airports
export async function airportInfo(iata, cityBox){
  const key = `air_${iata}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const b = `${cityBox[1]},${cityBox[0]},${cityBox[3]},${cityBox[2]}`;
  const j = await overpass(`nwr["aeroway"="aerodrome"]["iata"="${iata}"](${b});out tags center;`, 'aero');
  const els = j.elements || [];
  // (the one with a name, and the biggest if several: a few airports are mapped twice, as an area and a node)
  const el = els.sort((a, b) => (b.tags.name ? 1 : 0) - (a.tags.name ? 1 : 0))[0];
  if (!el) throw new Error('no aerodrome ' + iata);
  const c = el.center || { lat:el.lat, lon:el.lon }, out = { iata, name:el.tags.name || '', la:c.lat, lo:c.lon, ele:parseHeight(el.tags.ele), icao:el.tags.icao || '', tags:el.tags };
  writeGz(key, out); return out;
}
// runways, taxiways and aprons within a box round an airport
export async function airportDetail(iata, c, half){
  const key = `airf_${iata}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const dLa = half/111320, dLo = half/(111320*Math.cos(c.la*D2R)), b = [c.la - dLa, c.lo - dLo, c.la + dLa, c.lo + dLo].map(v => v.toFixed(5)).join(',');
  const j = await overpass(`(way["aeroway"~"^(runway|taxiway|taxilane|apron)$"](${b});relation["aeroway"="apron"](${b}););out geom tags;`, 'airdet');
  const out = { runways:[], taxi:[], apron:[] };
  for (const el of j.elements || []){
    const t = el.tags || {}, a = t.aeroway;
    if (t.abandoned === 'yes' || t.disused === 'yes' || t.construction) continue;
    if (a === 'runway'){ if (el.geometry) out.runways.push({ ref:t.ref || '', width:parseHeight(t.width), surface:t.surface || '', length:parseHeight(t.length), p:el.geometry.map(g => [g.lat, g.lon]) }); }
    else if (a === 'taxiway' || a === 'taxilane'){ if (el.geometry) out.taxi.push({ ref:t.ref || '', lane:a === 'taxilane' ? 1 : 0, p:el.geometry.map(g => [g.lat, g.lon]) }); }
    else if (a === 'apron'){
      if (el.type === 'way' && el.geometry) out.apron.push({ p:el.geometry.map(g => [g.lat, g.lon]) });
      else if (el.type === 'relation') for (const m of el.members || []) if (m.role === 'outer' && m.geometry) out.apron.push({ p:m.geometry.map(g => [g.lat, g.lon]) });
    }
  }
  writeGz(key, out); return out;
}
// runway ends from the ways of one runway (the pair of mapped nodes farthest apart), named from the ref and the bearing
export function runwayEnds(group){
  const pts = group.flatMap(g => g.p); let best = null;
  const cand = group.flatMap(g => [g.p[0], g.p[g.p.length - 1]]);
  for (let i=0;i<cand.length;i++) for (let j=i + 1;j<cand.length;j++){ const d = haversine(cand[i][0], cand[i][1], cand[j][0], cand[j][1]); if (!best || d > best.d) best = { d, a:cand[i], b:cand[j] }; }
  void pts; return best;
}
export function nameEnds(ref, a, b){
  const brg = bearing(a[0], a[1], b[0], b[1]), num = n => Math.round(n/10) || 36, pad = n => String(n).padStart(2, '0');
  let names = String(ref || '').split(/[\/;-]/).map(s => s.trim()).filter(s => /^\d{1,2}[LRC]?$/.test(s));
  if (names.length === 2){
    const n0 = parseInt(names[0]), d0 = Math.abs(((brg - n0*10 + 540) % 360) - 180);   // (the end whose number is the heading of the run to the other end)
    names = names.map(s => s.replace(/^\d$/, x => '0' + x));
    return d0 < 90 ? names : [names[1], names[0]];
  }
  const n = num(brg), m = (n + 18 - 1) % 36 + 1;
  return [pad(n), pad(m)];
}

// ---------------------------------------------------------------- ships: ferry routes, port and harbour areas, marinas, anchorages, terminals
export async function seaFeatures(city, box){
  const key = `seaf_${city}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const b = `${box[1]},${box[0]},${box[3]},${box[2]}`;
  const j = await overpass(`(way["route"="ferry"](${b});nwr["amenity"="ferry_terminal"](${b});nwr["leisure"="marina"](${b});nwr["seamark:type"="anchorage"](${b});nwr["landuse"="port"](${b});nwr["industrial"="port"](${b});nwr["harbour"="yes"](${b});nwr["seamark:type"="harbour"](${b});way["waterway"="dock"](${b}););out geom tags;`, 'sea');
  const out = { ferry:[], areas:[], points:[] };
  for (const el of j.elements || []){
    const t = el.tags || {}, name = t.name || t['name:en'] || '';
    if (el.type === 'way' && t.route === 'ferry' && el.geometry){ out.ferry.push({ name, ref:t.ref || '', op:t.operator || '', car:t.motor_vehicle === 'yes' || t.vehicle === 'yes' ? 1 : 0, p:el.geometry.map(g => [g.lat, g.lon]) }); continue; }
    const kind = t.amenity === 'ferry_terminal' ? 'ferry' : t.leisure === 'marina' ? 'marina' : t['seamark:type'] === 'anchorage' ? 'anchorage' : t.waterway === 'dock' ? 'dock' : 'port';
    // (a point, or an area: its outer ways)
    if (el.type === 'node'){ out.points.push({ kind, name, la:el.lat, lo:el.lon }); continue; }
    const rings = [];
    if (el.type === 'way' && el.geometry) rings.push(el.geometry.map(g => [g.lat, g.lon]));
    else if (el.type === 'relation') for (const m of el.members || []) if (m.role === 'outer' && m.geometry) rings.push(m.geometry.map(g => [g.lat, g.lon]));
    if (rings.length) out.areas.push({ kind, name, rings, id:el.type[0] + el.id });
  }
  writeGz(key, out); return out;
}

// ---------------------------------------------------------------- tall buildings and towers
export async function towerCandidates(city, box){
  const key = `towf_${city}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const b = `${box[1]},${box[0]},${box[3]},${box[2]}`, hh = `"height"~"^[1-9][0-9]{2}(\\\\.[0-9]+)?( ?m)?$"`;
  const j = await overpass(`(nwr["building"][${hh}](${b});nwr["building:part"][${hh}](${b});nwr["man_made"~"^(tower|mast|communications_tower|chimney)$"][${hh}](${b});nwr["building"]["building:levels"~"^(3[5-9]|[4-9][0-9]|[1-9][0-9]{2})$"](${b}););out tags center;`, 'tower');
  const out = [];
  for (const el of j.elements || []){
    const t = el.tags || {}, c = el.center || { lat:el.lat, lon:el.lon }; if (c.lat == null) continue;
    out.push({ id:el.type[0] + el.id, name:t.name || t['name:en'] || '', en:t['name:en'] || '', h:parseHeight(t.height), lv:parseFloat(t['building:levels']) || 0, la:c.lat, lo:c.lon, man:t.man_made || '', ty:t.tower_type || t['tower:type'] || '', wd:t.wikidata || '', ele:t.ele || '' });
  }
  writeGz(key, out); return out;
}

export { gridTiles };

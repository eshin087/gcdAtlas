// Roads, airports, ships and towers of a city, from the cached OpenStreetMap readings (tools/lib/city-osm.mjs), into the line binaries and the manifest's pieces.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, frameAt, llToPlane, bboxLL, gridTiles, haversine, bearing, simplify, packLines, writeHashed, terrainSource, clampN } from './city-common.mjs';
import { roadsTile, airportInfo, airportDetail, runwayEnds, nameEnds, seaFeatures, towerCandidates } from './city-osm.mjs';
import { ELE_CHECK } from './city-config.mjs';

// ---------------------------------------------------------------- joining ways end to end
// items: [{ pts:[[x, y]...], dir:bool (one-way: traffic runs in point order), ...attrs }] of one kind; returns longer items
const ek = p => Math.round(p[0]*4) + ',' + Math.round(p[1]*4);   // (an end point to 0.25 m: ways share their nodes exactly)
export function joinItems(items){
  const n = items.length, ends = new Map();
  const add = (k, w, atStart) => { let l = ends.get(k); if (!l) ends.set(k, l = []); l.push({ w, atStart }); };
  items.forEach((it, w) => { add(ek(it.pts[0]), w, true); add(ek(it.pts[it.pts.length - 1]), w, false); });
  // links: prev[w] / next[w] = { w, rev } : the neighbour at the start / end of w, and whether it must be walked backwards
  const next = new Array(n).fill(null), prev = new Array(n).fill(null);
  // (where two ways meet they are joined; where more meet, the pairs that run most nearly straight on, if they turn by less than 60 degrees)
  const away = e => { const p = items[e.w].pts, k = p.length, a = e.atStart ? p[0] : p[k - 1], b = e.atStart ? p[1] : p[k - 2], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0])/d, (b[1] - a[1])/d]; };
  const link = (a, b) => {
    if (items[a.w].dir){
      // one-way: only an end meeting a start
      const from = a.atStart ? b : a, to = a.atStart ? a : b; next[from.w] = { w:to.w, rev:false }; prev[to.w] = { w:from.w, rev:false };
    } else {
      // two-way: any end to any end
      const set = (x, y) => { const lk = { w:y.w, rev:x.atStart === y.atStart ? true : false }; if (x.atStart) prev[x.w] = lk; else next[x.w] = lk; };
      set(a, b); set(b, a);
    }
  };
  for (const [, l] of ends){
    if (l.length < 2) continue;
    const cands = [];
    for (let i=0;i<l.length;i++) for (let j=i + 1;j<l.length;j++){
      const a = l[i], b = l[j]; if (a.w === b.w) continue;
      if (items[a.w].dir && a.atStart === b.atStart) continue;   // (one-way: an end meeting a start)
      const da = away(a), db = away(b), c = da[0]*db[0] + da[1]*db[1];
      if (l.length === 2 || c < -0.5) cands.push({ a, b, c });
    }
    cands.sort((x, y) => x.c - y.c);
    const used = new Set();
    for (const { a, b } of cands){ if (used.has(a) || used.has(b)) continue; used.add(a); used.add(b); link(a, b); }
  }
  const seen = new Uint8Array(n), out = [];
  // from any way, walk on in both directions (a two-way item may be walked backwards: `rev` follows the flips), then lay the chain out
  const go = (s, rev0) => { const res = []; let cur = s, rev = rev0; for (;;){ const lk = rev ? prev[cur] : next[cur]; if (!lk || seen[lk.w]) break; rev = lk.rev ? !rev : rev; cur = lk.w; seen[cur] = 1; res.push({ w:cur, rev }); } return res; };
  for (let s=0;s<n;s++){
    if (seen[s]) continue;
    seen[s] = 1;
    const fwd = go(s, false), back = go(s, true).map(c => ({ w:c.w, rev:!c.rev })).reverse();
    const chain = [...back, { w:s, rev:false }, ...fwd];
    let pts = [];
    for (const c of chain){ const p = c.rev ? items[c.w].pts.slice().reverse() : items[c.w].pts; pts = pts.length ? pts.concat(p.slice(1)) : p.slice(); }
    out.push({ ...items[s], pts });
  }
  return out;
}

// ---------------------------------------------------------------- roads
// the cached road ways (as read from OpenStreetMap) of the tiles round a layer: the same tile queries buildRoads uses, so nothing new is fetched
export async function roadWaysIn(city, L, pad = 100){
  const r12 = city.layers.find(l => l.id === 'r12'), box12 = bboxLL(r12, 0), seen = new Set(), out = [];
  for (const t of gridTiles(bboxLL(L, pad), 12.8, city.la)){
    const inner = t.bb[2] > box12[1] && t.bb[0] < box12[3] && t.bb[3] > box12[0] && t.bb[1] < box12[2];
    for (const w of await roadsTile(t, inner)){ if (seen.has(w.i)) continue; seen.add(w.i); out.push(w); }
  }
  return out;
}
const LANES_DEFAULT = { 0:[2, 4], 1:[2, 4], 2:[1, 2], 3:[1, 2], 4:[1, 2] };   // [one-way, two-way] total lanes when the way has no `lanes` tag
export async function buildRoads(city, layers){
  const cityF = frameAt(city.la, city.lo), r51 = layers.find(l => l.id === 'r51'), r12 = layers.find(l => l.id === 'r12');
  const box51 = bboxLL(r51, 0), box12 = bboxLL(r12, 0), seen = new Set(), ways = [];
  const [cx51, cy51] = llToPlane(cityF, r51.la, r51.lo), [cx12, cy12] = llToPlane(cityF, r12.la, r12.lo);
  const half51 = r51.size/2 + 300, half12 = r12.size/2 + 300;
  for (const t of gridTiles(box51, 12.8, city.la)){
    const inner = t.bb[2] > box12[1] && t.bb[0] < box12[3] && t.bb[3] > box12[0] && t.bb[1] < box12[2];
    for (const w of await roadsTile(t, inner)){ if (seen.has(w.i)) continue; seen.add(w.i); ways.push(w); }
  }
  // project, drop what is outside, simplify what is long enough
  const groups = new Map();
  let nWays = 0;
  for (const w of ways){
    let pts = w.p.map(([la, lo]) => llToPlane(cityF, la, lo));
    if (w.cls === 4 && !pts.some(([x, y]) => Math.abs(x - cx12) < half12 && Math.abs(y - cy12) < half12)) continue;
    // cut to the big layer's square, with a margin: keep runs of points (and the one before and after) that are inside
    const inside = pts.map(([x, y]) => Math.abs(x - cx51) < half51 && Math.abs(y - cy51) < half51);
    const runs = []; let cur = null;
    for (let i=0;i<pts.length;i++){
      const near = inside[i] || (i > 0 && inside[i - 1]) || (i + 1 < pts.length && inside[i + 1]);
      if (near){ if (!cur) runs.push(cur = []); cur.push(pts[i]); } else cur = null;
    }
    for (const run of runs){
      if (run.length < 2) continue;
      const lanes = w.lanes || LANES_DEFAULT[w.cls][w.oneway ? 0 : 1];
      const flags = (w.oneway ? 2 : 0) | (w.bridge ? 4 : 0) | (w.tunnel ? 8 : 0) | (w.link ? 16 : 0) | (w.round ? 32 : 0);
      const k = `${w.cls}|${Math.min(lanes, 12)}|${flags}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ pts:run, dir:!!w.oneway, cls:w.cls, a:Math.min(lanes, 12), flags });
      nWays++;
    }
  }
  let lines = [];
  for (const [, items] of groups) lines.push(...joinItems(items));
  const tol = city.roadTol || 3;
  lines = lines.map(l => ({ ...l, pts:simplify(l.pts, l.flags & 16 || l.flags & 32 ? tol*0.7 : tol) })).filter(l => l.pts.length >= 2);
  // (shorter than 20 m in all: nothing to drive on)
  const len = pts => { let s = 0; for (let i=1;i<pts.length;i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  lines = lines.filter(l => len(l.pts) >= 20);
  lines.sort((a, b) => a.cls - b.cls || b.pts.length - a.pts.length);
  const buf = packLines(lines, 2), file = writeHashed(OUT, `${city.key}-roads`, 'bin', buf);
  const byCls = [0, 1, 2, 3, 4].map(c => { const L = lines.filter(l => l.cls === c); return { lines:L.length, pts:L.reduce((s, l) => s + l.pts.length, 0), km:Math.round(L.reduce((s, l) => s + len(l.pts), 0)/1000) }; });
  console.log(`${city.key} roads: ${ways.length} ways -> ${lines.length} lines, ${lines.reduce((s, l) => s + l.pts.length, 0)} points, ${(buf.length/1024).toFixed(0)} KB; by class (motorway..tertiary): ${byCls.map(c => c.km + ' km').join(', ')}`);
  return { file, bytes:buf.length, lines:lines.length, pts:lines.reduce((s, l) => s + l.pts.length, 0), km:byCls.map(c => c.km), unit:2, lines_:lines };
}

// ---------------------------------------------------------------- airports
const r5 = v => Math.round(v*1e5)/1e5;
export async function buildAirports(city, layers){
  const cityF = frameAt(city.la, city.lo), r51 = layers.find(l => l.id === 'r51'), box51 = bboxLL(r51, 0);
  const wide = [box51[0] - 1.2, box51[1] - 1, box51[2] + 1.2, box51[3] + 1], airports = [], lines = [];
  for (const [ai, a] of city.airports.entries()){
    const info = await airportInfo(a.iata, wide), det = await airportDetail(a.iata, info, a.iata === 'CDG' ? 6500 : 4500);
    // runways: the ways with one ref are one runway
    const byRef = new Map(), loose = [];
    for (const w of det.runways){ if (w.ref){ if (!byRef.has(w.ref)) byRef.set(w.ref, []); byRef.get(w.ref).push(w); } else loose.push(w); }
    // (runway ways with no ref: the paved ones that continue a named runway, in line with it and within 100 m of one of its ends, are part of it, as at Paris-Charles de Gaulle;
    // the others, grass strips and the like, are left out)
    for (const w of loose){
      if (/grass|dirt|unpaved|gravel|ground|earth|sand|clay|compacted/.test(w.surface)) continue;
      const wb = bearing(w.p[0][0], w.p[0][1], w.p[w.p.length - 1][0], w.p[w.p.length - 1][1]);
      for (const [, group] of byRef){
        const e = runwayEnds(group); if (!e) continue;
        const gb = bearing(e.a[0], e.a[1], e.b[0], e.b[1]), dd = Math.abs(((wb - gb + 540) % 360) - 180), diff = Math.min(dd, 180 - dd);
        const ends = group.flatMap(g => [g.p[0], g.p[g.p.length - 1]]), mine = [w.p[0], w.p[w.p.length - 1]];
        if (diff < 15 && ends.some(p => mine.some(q => haversine(p[0], p[1], q[0], q[1]) < 100))){ group.push(w); break; }
      }
    }
    const runways = [];
    for (const [ref, group] of byRef){
      const e = runwayEnds(group); if (!e || e.d < 300) continue;
      const names = nameEnds(ref, e.a, e.b), width = group.find(g => g.width)?.width || (e.d >= 3000 ? 60 : e.d >= 2000 ? 45 : 30);
      // (the ref in the usual order, the lower number first; a and b carry the designator of their own end)
      const canon = names.slice().sort((x, y) => parseInt(x) - parseInt(y) || x.localeCompare(y)).join('/');
      runways.push({ ref:canon, a:[names[0], r5(e.a[0]), r5(e.a[1])], b:[names[1], r5(e.b[0]), r5(e.b[1])], len:Math.round(e.d/5)*5, w:Math.round(width), surface:group.find(g => g.surface)?.surface || '' });
    }
    runways.sort((x, y) => x.ref.localeCompare(y.ref));
    // the centre of the airport: the middle of its runways (the airport's own layer is centred there)
    const pts = runways.flatMap(r => [r.a, r.b]), la = (Math.min(...pts.map(p => p[1])) + Math.max(...pts.map(p => p[1])))/2, lo = (Math.min(...pts.map(p => p[2])) + Math.max(...pts.map(p => p[2])))/2;
    let ele = info.ele, eleSrc = 'OpenStreetMap';
    if (ele == null){ const t = await terrainSource({ la:info.la, lo:info.lo, size:1600, px:1024 }); ele = Math.round(t(info.la, info.lo)); eleSrc = 'terrain model'; }
    if (ELE_CHECK[a.iata] != null && Math.abs(ELE_CHECK[a.iata] - ele) > 4) console.log(`  CHECK ${a.iata}: elevation ${ele} m, expected about ${ELE_CHECK[a.iata]} m`);
    // taxiways and aprons as lines
    const keepLine = (pl, cls, closed) => { let p = simplify(pl.map(([x, y]) => llToPlane(cityF, x, y)), 3); if (p.length < 2) return; lines.push({ pts:p, cls, a:0, flags:closed ? 1 : 0, grp:ai + 1 }); };
    for (const t of det.taxi) keepLine(t.p, t.lane ? 1 : 0, false);
    for (const ap of det.apron){ if (ap.p.length > 3) keepLine(ap.p, 2, true); }
    airports.push({ iata:a.iata, icao:info.icao, name:info.name, la:r5(info.la), lo:r5(info.lo), ele:Math.round(ele), eleSrc, centre:[r5(la), r5(lo)], size:a.size, runways });
    console.log(`  ${a.iata} ${info.name}: ${runways.map(r => `${r.ref} ${r.len} m x ${r.w} m`).join(', ')}; ele ${ele} m`);
  }
  const buf = packLines(lines, 2), file = writeHashed(OUT, `${city.key}-air`, 'bin', buf);
  console.log(`${city.key} airport lines: ${lines.length}, ${(buf.length/1024).toFixed(0)} KB`);
  return { airports, file, bytes:buf.length, lines_:lines };
}

// ---------------------------------------------------------------- ships
const polyArea = pts => { let s = 0; for (let i=0, j=pts.length - 1;i<pts.length;j=i++) s += (pts[j][0] + pts[i][0])*(pts[j][1] - pts[i][1]); return Math.abs(s/2); };
export async function buildSea(city, layers){
  const cityF = frameAt(city.la, city.lo), r51 = layers.find(l => l.id === 'r51'), box51 = bboxLL(r51, 0), s = await seaFeatures(city.key, box51);
  const names = ['']; const nameId = n => { if (!n) return 0; let i = names.indexOf(n); if (i < 0){ if (names.length >= 255) return 0; names.push(n); i = names.length - 1; } return i; };
  const lines = [], terminals = [], points = [];
  const proj = p => p.map(([la, lo]) => llToPlane(cityF, la, lo));
  // ferry routes: ways of one name joined end to end
  const ferry = s.ferry.map(f => ({ pts:proj(f.p), dir:false, name:f.name || f.ref, car:f.car }));
  const byName = new Map(); for (const f of ferry){ const k = (f.name || '') + '|' + f.car; if (!byName.has(k)) byName.set(k, []); byName.get(k).push(f); }
  let nFerry = 0;
  for (const [, items] of byName) for (const j of joinItems(items)){ const p = simplify(j.pts, 8); if (p.length < 2) continue; lines.push({ pts:p, cls:0, a:j.car ? 1 : 0, flags:0, grp:nameId(j.name) }); nFerry++; }
  // areas: ports (1), marinas (2), docks (3); the big named ports are terminals
  const kindCls = { port:1, marina:2, dock:3 }, doneIds = new Set();
  for (const ar of s.areas){
    if (doneIds.has(ar.id)) continue; doneIds.add(ar.id);
    const cls = kindCls[ar.kind]; if (!cls) { if (ar.kind === 'ferry' && ar.name){ const p = ar.rings[0]; terminals.push({ name:ar.name, kind:'ferry', la:p.reduce((a, q) => a + q[0], 0)/p.length, lo:p.reduce((a, q) => a + q[1], 0)/p.length, area:0 }); } continue; }
    let big = 0, ctr = null;
    for (const r of ar.rings){
      const p = proj(r); if (p.length < 4) continue;
      const area = polyArea(p); if (cls !== 1 && area < 800) continue;
      if (area > big){ big = area; ctr = r; }
      lines.push({ pts:simplify(p, 6), cls, a:0, flags:1, grp:nameId(ar.name) });
    }
    if (ar.name && ctr && cls === 1 && big > 30000) terminals.push({ name:ar.name, kind:'port', la:ctr.reduce((a, q) => a + q[0], 0)/ctr.length, lo:ctr.reduce((a, q) => a + q[1], 0)/ctr.length, area:Math.round(big) });
  }
  for (const p of s.points){
    if (p.kind === 'anchorage') points.push({ kind:'anchorage', name:p.name, la:p.la, lo:p.lo });
    else if (p.kind === 'ferry' && p.name) terminals.push({ name:p.name, kind:'ferry', la:p.la, lo:p.lo, area:0 });
    else if (p.kind === 'port' && p.name) terminals.push({ name:p.name, kind:'port', la:p.la, lo:p.lo, area:0 });
  }
  // (named terminals: ports by area first, then ferry terminals; one entry a name)
  const seenN = new Set(), term = [];
  for (const t of terminals.sort((a, b) => b.area - a.area || a.name.localeCompare(b.name))){ if (seenN.has(t.name) || /^[a-zà-ÿ]/.test(t.name)) continue; /* (a name that starts in lower case is a description, "bac traversier", not a name) */ seenN.add(t.name); term.push({ name:t.name, kind:t.kind, la:Math.round(t.la*1e5)/1e5, lo:Math.round(t.lo*1e5)/1e5 }); }
  const buf = packLines(lines, 2), file = writeHashed(OUT, `${city.key}-sea`, 'bin', buf);
  console.log(`${city.key} sea: ${nFerry} ferry routes, ${lines.length - nFerry} areas, ${points.length} anchorages, ${term.length} named terminals, ${(buf.length/1024).toFixed(0)} KB`);
  return { file, bytes:buf.length, names, terminals:term.filter(t => t.kind === 'port').slice(0, 14).concat(term.filter(t => t.kind === 'ferry').slice(0, 18)), anchorages:points.slice(0, 40).map(p => ({ name:p.name, la:Math.round(p.la*1e5)/1e5, lo:Math.round(p.lo*1e5)/1e5 })), lines_:lines, nFerry };
}

void fs; void path; void clampN; void haversine; void towerCandidates;

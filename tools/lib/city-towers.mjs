// The tallest buildings and towers of a city: from OpenStreetMap (height tags), merged where several mapped parts of one tower are within 90 m, the best name.
// Names are checked against Wikidata (CC0) wherever OpenStreetMap links the tower to it (a `wikidata` tag): a tower with no name takes its Wikidata label, and a height that
// differs from Wikidata's (P2048) by more than 8% is reported for a person to look at. Then the corrections of tools/lib/city-facts.mjs (TOWER_FIX, TOWER_SKIP, TOWER_ADD).
// The page uses the list for the blinking aviation lights and for labels.
import fs from 'node:fs';
import { bboxLL, haversine, cacheFile, get, UA, frameAt, llToPlane } from './city-common.mjs';
import { readLayer } from './city-preview.mjs';
import { towerCandidates } from './city-osm.mjs';
import { TOWER_FIX, TOWER_ADD, TOWER_SKIP } from './city-facts.mjs';

const KIND = { tower:'tower', mast:'mast', communications_tower:'tower', chimney:'chimney' };
const UNIT = { Q11573:1, Q3710:0.3048 };   // metre, foot

// Wikidata labels and heights, 50 items to a request, each cached
async function wikidata(ids){
  const out = {}, need = [];
  for (const id of ids){ const f = cacheFile(`wd_${id}.json`); if (fs.existsSync(f)) out[id] = JSON.parse(fs.readFileSync(f, 'utf8')); else need.push(id); }
  for (let i=0;i<need.length;i+=50){
    const batch = need.slice(i, i + 50), url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=labels|claims&languages=en&format=json`;
    const j = JSON.parse((await get(url, { headers:UA })).toString());
    for (const id of batch){
      const e = j.entities && j.entities[id], r = { label:'', h:null };
      if (e && !e.missing){
        r.label = e.labels?.en?.value || '';
        const c = (e.claims?.P2048 || []).filter(x => x.rank !== 'deprecated').sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred'))[0];
        const v = c?.mainsnak?.datavalue?.value, k = v && UNIT[String(v.unit).split('/').pop()];
        if (v && k) r.h = Math.round(parseFloat(v.amount)*k*10)/10;
      }
      out[id] = r;
      fs.writeFileSync(cacheFile(`wd_${id}.json`), JSON.stringify(r));
    }
  }
  return out;
}

// what the layers have at each tower: `mapTop`, the highest point of the finest layer within 40 m (m above the sea), and `ground`, the lower tenth of the heights within 150 m
// (about the ground there). The page draws the part of a tower that the layers do not have when `ground + h` is above `mapTop`.
export async function addMapInfo(man){
  const cityF = frameAt(man.la, man.lo), layers = [...man.layers].sort((a, b) => a.size - b.size), cache = new Map();
  for (const t of man.towers || []){
    const [x, y] = llToPlane(cityF, t.la, t.lo);
    const L = layers.find(l => Math.abs(x - l.dx) < l.size/2 - 200 && Math.abs(y - l.dy) < l.size/2 - 200);
    if (!L){ delete t.mapTop; delete t.ground; continue; }
    if (!cache.has(L.id)) cache.set(L.id, await readLayer(L));
    const data = cache.get(L.id), m = L.size/L.px, u0 = (x - L.dx + L.size/2)/m, v0 = (L.size/2 - (y - L.dy))/m;
    const hgt = (u, v) => { const a = data[(v*L.px + u)*4 + 3]; return a < 2 ? null : L.base + (a - 2)*L.step; };
    const rt = Math.max(1, Math.round(40/m)), rg = Math.max(3, Math.round(150/m)); let top = -1, all = [];
    for (let v=Math.max(0, Math.round(v0) - rg);v<=Math.min(L.px - 1, Math.round(v0) + rg);v++) for (let u=Math.max(0, Math.round(u0) - rg);u<=Math.min(L.px - 1, Math.round(u0) + rg);u++){
      const h = hgt(u, v); if (h == null) continue; all.push(h); if (Math.hypot(u - u0, v - v0) <= rt && h > top) top = h; }
    all.sort((a, b) => a - b);
    t.mapTop = top < 0 ? null : Math.round(top); t.ground = all.length ? Math.round(all[Math.floor(all.length*0.1)]) : null;
  }
}

export async function buildTowers(city, layers){
  const r51 = layers.find(l => l.id === 'r51'), cand = await towerCandidates(city.key, bboxLL(r51, 0)), groups = [];
  for (const c of cand.sort((a, b) => (b.h || b.lv*3.5) - (a.h || a.lv*3.5))){
    const h = c.h || c.lv*3.5;
    const near = groups.find(x => haversine(x.la, x.lo, c.la, c.lo) < 90);
    if (near){ if (!near.name && c.name) near.name = c.name; if (!near.wd && c.wd) near.wd = c.wd; near.n++; continue; }
    groups.push({ ...c, h, n:1 });
  }
  // (a tall building's candidates are many: only the tallest 120 are looked up)
  const top = groups.slice(0, 120), wd = await wikidata([...new Set(top.map(g => g.wd).filter(Boolean))]);
  let list = top.map(g => {
    const w = g.wd && wd[g.wd], o = { name:g.name || (w && w.label) || '', la:g.la, lo:g.lo, h:g.h, kind:KIND[g.man] || 'building', src:'OpenStreetMap', id:g.id };
    // (a Wikidata height that differs from OpenStreetMap's by more than 8% is only reported: either can be the wrong one, and the corrections are made by hand, in TOWER_FIX)
    if (w && w.h && o.name && Math.abs(w.h - g.h)/g.h > 0.08 && w.h > 60) console.log(`  CHECK ${o.name}: OpenStreetMap ${g.h} m, Wikidata ${w.h} m`);
    return o;
  });
  list = list.filter(t => t.name && !(TOWER_SKIP[city.key] || []).some(re => re.test(t.name)));
  for (const fx of TOWER_FIX[city.key] || []){
    const t = list.find(x => fx.re.test(x.name));
    if (!t){ console.log('  tower fix without a tower: ' + fx.re); continue; }
    if (fx.h != null) t.h = fx.h; if (fx.name) t.name = fx.name; if (fx.kind) t.kind = fx.kind; if (fx.thin) t.thin = true; if (fx.src) t.src = fx.src;
    if (fx.la != null){ t.la = fx.la; t.lo = fx.lo; }
  }
  for (const a of TOWER_ADD[city.key] || []) if (!list.some(x => haversine(x.la, x.lo, a.la, a.lo) < 120 || x.name === a.name)) list.push({ ...a });
  list.sort((a, b) => b.h - a.h);
  // (heights over 900 m are typing mistakes; five decimals of a degree are plenty: 1 m)
  const out = list.filter(t => t.h > 0 && t.h < 900).slice(0, 40).map(t => ({ name:t.name, la:Math.round(t.la*1e5)/1e5, lo:Math.round(t.lo*1e5)/1e5, h:Math.round(t.h), kind:t.kind, thin:!!(t.thin || t.kind !== 'building'), src:t.src }));
  console.log(`${city.key} towers: ${out.length} (tallest ${out[0].name} ${out[0].h} m)`);
  return out;
}

// The tallest buildings and towers of a city: from OpenStreetMap (height tags), merged where several mapped parts of one tower are within 90 m, the best name,
// with corrections from the table below where OpenStreetMap's height is known to differ from the building's official one (Wikipedia / the Council on Tall Buildings and Urban Habitat)
// and a few landmarks added that OpenStreetMap does not tag with a height. The page uses them for the blinking aviation lights and for labels.
import { bboxLL, haversine } from './city-common.mjs';
import { towerCandidates } from './city-osm.mjs';
import { TOWER_FIX, TOWER_ADD, TOWER_SKIP } from './city-facts.mjs';

const KIND = { tower:'tower', mast:'mast', communications_tower:'tower', chimney:'chimney' };
export async function buildTowers(city, layers){
  const r51 = layers.find(l => l.id === 'r51'), cand = await towerCandidates(city.key, bboxLL(r51, 0)), groups = [];
  for (const c of cand.sort((a, b) => (b.h || b.lv*3.5) - (a.h || a.lv*3.5))){
    const h = c.h || c.lv*3.5;
    const near = groups.find(x => haversine(x.la, x.lo, c.la, c.lo) < 90);
    if (near){ if (!near.name && c.name) { near.name = c.name; near.id = c.id; } near.n++; continue; }
    groups.push({ ...c, h, n:1 });
  }
  let list = groups.map(g => ({ name:g.name, la:g.la, lo:g.lo, h:g.h, kind:KIND[g.man] || 'building', lattice:/lattice/.test(g.ty) || undefined, src:'OpenStreetMap', id:g.id }));
  list = list.filter(t => t.name && !(TOWER_SKIP[city.key] || []).some(re => re.test(t.name)));
  for (const fx of TOWER_FIX[city.key] || []){
    const t = list.find(x => fx.re.test(x.name));
    if (!t){ console.log('  tower fix without a tower: ' + fx.re); continue; }
    if (fx.h != null) t.h = fx.h; if (fx.name) t.name = fx.name; if (fx.kind) t.kind = fx.kind; if (fx.lattice) t.lattice = true; if (fx.src) t.src = fx.src;
    if (fx.la != null){ t.la = fx.la; t.lo = fx.lo; }
  }
  for (const a of TOWER_ADD[city.key] || []) if (!list.some(x => haversine(x.la, x.lo, a.la, a.lo) < 120 || x.name === a.name)) list.push({ ...a });
  list.sort((a, b) => b.h - a.h);
  // (heights over 900 m are typing mistakes; two decimals of a degree are plenty: 1 m)
  const out = list.filter(t => t.h > 0 && t.h < 900).slice(0, 40).map(t => { const o = { name:t.name, la:Math.round(t.la*1e5)/1e5, lo:Math.round(t.lo*1e5)/1e5, h:Math.round(t.h), kind:t.kind, src:t.src }; if (t.lattice) o.lattice = true; return o; });
  console.log(`${city.key} towers: ${out.length} (tallest ${out[0].name} ${out[0].h} m)`);
  return out;
}

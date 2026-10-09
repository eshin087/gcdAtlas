// Restyles the five cities' layers in the architectural-model style (tools/lib/city-style.mjs, 0.17.0) without building them again: each layer
// with buildings is read back (the first time it is also kept, unstyled, in tools/cache/earth-cities/unstyled/, and every run starts from that
// copy, so running this twice gives the same files), its buildings are rasterised again from the cached footprints, its roofs painted, and it is
// written under a new name; the city's cached manifest and src/objects/e9-earth-cities-data.js are updated (through tools/earth-cities.mjs's
// manifest step). The heights (alpha) are kept bit for bit: the run checks it.
//   node tools/city-style.mjs [city ...]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { CACHE, OUT, ROOT, frameAt, writeHashed } from './lib/city-common.mjs';
import { CITIES } from './lib/city-config.mjs';
import { rasterBuildings } from './lib/city-layers.mjs';
import { styleRoofs } from './lib/city-style.mjs';
import { fixHeights } from './lib/city-terrain-fix.mjs';

const only = process.argv.slice(2).filter(a => !a.startsWith('--')), UNS = path.join(CACHE, 'unstyled');
fs.mkdirSync(UNS, { recursive:true });
const manFile = k => path.join(CACHE, `manifest-${k}.json`);
for (const city of CITIES){
  if (only.length && !only.includes(city.key)) continue;
  const man = JSON.parse(fs.readFileSync(manFile(city.key), 'utf8'));
  for (const L of man.layers){
    const roofs = L.bld && L.size <= 13000;   // (the 51 km layer has no buildings; its pixels are 50 m: only its heights' fixes)
    // the unstyled original: kept the first time, read from then on
    const key = `${city.key}-${L.id}.webp`, kept = path.join(UNS, key);
    if (!fs.existsSync(kept)) fs.copyFileSync(path.join(OUT, L.file), kept);
    const { data, info } = await sharp(fs.readFileSync(kept)).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
    if (info.width !== L.px || info.height !== L.px) throw new Error(`${key}: ${info.width} x ${info.height}, not ${L.px}`);
    // (the heights: the kept layer's, encoded with the kept layer's base and step; fixed, which may change them)
    if (L.base0 == null){ L.base0 = L.base; L.step0 = L.step; L.top0 = L.top; }
    const Lh = Object.assign({}, L, { base:L.base0, step:L.step0, top:L.top0 }), nf = fixHeights(city, Lh, data);
    if (!roofs && !nf){ delete L.base0; delete L.step0; delete L.top0; continue; }
    const alpha = Buffer.alloc(L.px*L.px); for (let i=0;i<L.px*L.px;i++) alpha[i] = data[i*4 + 3];
    process.stdout.write(`${city.key}-${L.id} (${(L.size/1000).toFixed(1)} km): ${nf ? nf + ' heights fixed, ' : ''}`);
    const bld = roofs ? await rasterBuildings(city, { ...L, id:L.id }, frameAt(L.la, L.lo), true) : null;
    const n = roofs ? styleRoofs(city.key, L.px, data, bld, L.size/L.px) : 0;
    L.base = Lh.base; L.step = Lh.step; L.top = Lh.top;
    const webp = await sharp(data, { raw:{ width:L.px, height:L.px, channels:4 } }).webp({ quality:80, alphaQuality:100, effort:6, smartSubsample:true }).toBuffer();
    // (the heights must come back exactly)
    const back = await sharp(webp).ensureAlpha().raw().toBuffer();
    for (let i=0;i<L.px*L.px;i++) if (back[i*4 + 3] !== alpha[i]) throw new Error(`${key}: the heights changed at pixel ${i} (${alpha[i]} -> ${back[i*4 + 3]})`);
    const file = writeHashed(OUT, `${city.key}-${L.id}`, 'webp', webp);
    console.log(` ${n} buildings painted, ${(webp.length/1024).toFixed(0)} KB (was ${(L.bytes/1024).toFixed(0)} KB) -> ${file}`);
    L.file = file; L.bytes = webp.length; if (roofs) L.styled = 'model';
  }
  // (the city's highest ground or roof, from its layers' tops as they are now: a height fix can lower it)
  if (man.layers && man.layers.length) man.top = Math.max(...man.layers.map(l => l.top));
  fs.writeFileSync(manFile(city.key), JSON.stringify(man));
}
// the page's manifest, from every city's cached manifest
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'earth-cities.mjs'), '--stages=manifest'], { stdio:'inherit' });

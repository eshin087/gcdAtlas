// Builds the whole Earth seen from space (phase 1 of docs/EARTH_PLAN.md): for each size (4096 x 2048 for a desk, 2048 x 1024 for a phone)
//   - 12 colour maps, one a month: NASA Blue Marble Next Generation 2004 with topography and bathymetry (public domain, NASA Earth
//     Observatory, Reto Stockli), equirectangular;
//   - one data map: R the height of the land (GEBCO 2008 via NASA, its own encoding: about 8848 m x (v/255)^2), G the city lights at
//     night (NASA Black Marble 2016, separated from the dark ground as tools/earth-lights.mjs does), B the depth of the sea (GEBCO
//     2008: 255 - its value, 0 on land), A 255 on land and 64 at sea (Natural Earth's 10 m land, less GEBCO's lakes; never 0: WebP
//     rewrites the colour under a transparent pixel).
// Written to assets/earth/global-<name>-<hash>.webp (copied to dist/earth/ by build.mjs, which copies that folder flat) with the list in
// src/objects/e4-earth-global-data.js (EARTH_GLOBAL). The page fetches them only when the camera nears Earth (e4-earth-global.js).
// The sources are downloaded once into tools/cache/earth-global/ (not committed). Usage, from tools/: node earth-global.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { geoEquirectangular, geoPath } from 'd3-geo';
import * as topo from 'topojson-client';
sharp.cache(false);
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const CACHE = path.join(HERE, 'cache', 'earth-global'), OUT = path.join(ROOT, 'assets', 'earth');
fs.mkdirSync(CACHE, { recursive:true }); fs.mkdirSync(OUT, { recursive:true });
const UA = { 'User-Agent':'gcdatlas-earth-global (https://gcdatlas.com; github eshin087/gcdatlas)' };
// Blue Marble NG with topography and bathymetry, 5400 x 2700, one record a month (the plain ones lack June)
const BMNG = [73580, 73605, 73630, 73655, 73701, 73726, 73751, 73776, 73801, 73826, 73884, 73909];
const SRC = {
  elev:['gebco-elev.png', 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png'],
  bath:['gebco-bath.png', 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73963/gebco_08_rev_bath_21600x10800.png'],
  night:['blackmarble-3km.jpg', 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg'],
};
BMNG.forEach((id, i) => { const m = String(i + 1).padStart(2, '0'); SRC['m' + m] = [`bmng-${m}.jpg`, `https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/${id}/world.topo.bathy.2004${m}.3x5400x2700.jpg`]; });
async function fetchSrc(k){
  const [f, url] = SRC[k], p = path.join(CACHE, f);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) return p;
  process.stdout.write('download ' + f + ' ');
  const r = await fetch(url, { headers:UA, signal:AbortSignal.timeout(900000) }); if (!r.ok) throw new Error(f + ': ' + r.status);
  fs.writeFileSync(p, Buffer.from(await r.arrayBuffer())); console.log('ok'); return p;
}
const hash = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 8);
function write(name, buf){
  // (the old versions of this file go: the page asks for the one the manifest names)
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(name + '-') && f.endsWith('.webp')) fs.unlinkSync(path.join(OUT, f));
  const file = `${name}-${hash(buf)}.webp`; fs.writeFileSync(path.join(OUT, file), buf); return file;
}
// one channel of a source at W x H (area-averaged by the resize)
async function channel(p, W, H){ return sharp(p, { limitInputPixels:false }).resize(W, H, { kernel:'lanczos3', fit:'fill' }).removeAlpha().raw().toBuffer(); }
async function landMask(W, H){
  const j = JSON.parse(fs.readFileSync(path.join(HERE, 'node_modules', 'world-atlas', 'land-10m.json'))), land = topo.feature(j, j.objects.land);
  const proj = geoEquirectangular().scale(W/(2*Math.PI)).translate([W/2, H/2]).precision(0.02);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/><path d="${geoPath(proj)(land)}" fill="white"/></svg>`;
  return sharp(Buffer.from(svg), { limitInputPixels:false }).greyscale().raw().toBuffer();
}
const manifest = { sizes:{} };
for (const W of [4096, 2048]){
  const H = W/2, files = { color:[], data:null };
  for (let m=1;m<=12;m++){
    const p = await fetchSrc('m' + String(m).padStart(2, '0'));
    const buf = await sharp(p).resize(W, H, { kernel:'lanczos3', fit:'fill' }).webp({ quality:84, effort:6 }).toBuffer();
    files.color.push(write(`global-color-${String(m).padStart(2, '0')}-${W}`, buf));
    process.stdout.write('.');
  }
  const [elev, bath, night, mask] = [await channel(await fetchSrc('elev'), W, H), await channel(await fetchSrc('bath'), W, H), await channel(await fetchSrc('night'), W, H), await landMask(W, H)];
  const rgba = Buffer.alloc(W*H*4);
  for (let i=0;i<W*H;i++){
    const e = elev[i*3], b = bath[i*3], r = night[i*3], g = night[i*3 + 1], bl = night[i*3 + 2];
    const lv = Math.max(0, Math.min((Math.min(r, g) - 0.55*bl - 4)/115, 1));
    const land = mask[i] > 127 && b >= 250;   // (Natural Earth's land less GEBCO's lakes: the Caspian, the Great Lakes)
    rgba[i*4] = land ? e : 0; rgba[i*4 + 1] = Math.round(255*Math.pow(lv, 0.72)); rgba[i*4 + 2] = land ? 0 : 255 - b; rgba[i*4 + 3] = land ? 255 : 64;
  }
  const dbuf = await sharp(rgba, { raw:{ width:W, height:H, channels:4 } }).webp({ quality:90, alphaQuality:100, effort:6 }).toBuffer();
  files.data = write(`global-data-${W}`, dbuf);
  const kb = f => Math.round(fs.statSync(path.join(OUT, f)).size/1024);
  console.log(`\n${W} x ${H}: colour ${files.color.map(kb).join(' ')} KB, data ${kb(files.data)} KB`);
  manifest.sizes[W] = files;
}
const js = `// generated by tools/earth-global.mjs: the whole Earth seen from space, served as earth/<file> (e5-earth-global.js loads them)
const EARTH_GLOBAL = ${JSON.stringify(manifest)};
`;
fs.writeFileSync(path.join(ROOT, 'src', 'objects', 'e4-earth-global-data.js'), js);
console.log('manifest: src/objects/e4-earth-global-data.js');

// Builds the Earth's finer tiles (phase 2 of docs/EARTH_PLAN.md): the whole land at 16384 x 8192 (about 2.4 km a pixel at the equator),
// equirectangular, cut into 512 x 512 tiles, 32 across and 16 down. Only tiles with land are kept (the global maps of tools/earth-global.mjs
// draw the open sea). Per tile:
//   - d-x-y.webp: the data, as the global data map (R the land's height, about 8848 m x (v/255)^2; G the night lights; B the sea's depth,
//     255 - GEBCO's value; A 255 on land, 64 at sea), from GEBCO 2008 (21600 x 10800), NASA Black Marble 2016 and Natural Earth's 10 m land;
//   - cMM-x-y.webp (MM 01 and 07): the detail of NASA's Blue Marble NG of January and July 2004 at 500 m a pixel, as the ratio of that image
//     to the 4096-pixel map of the same month (global-color-MM-4096): each channel 0.5 + log2((fine + E)/(coarse + E))/4, E = 2/255, so 128
//     is "as the global map", 0 a quarter and 255 four times. The page multiplies the global map of the month the atlas clock shows by the
//     detail of the season (January's blended into July's), so seen from far away the tiles are exactly the global map and fade in without
//     a seam, while the snow and the green of the month still come from the month's own map.
// Written to assets/earth/tiles-<hash>/ (a new folder whenever anything changes, so the year-long cache never serves an old tile; the old
// folder is removed), with the manifest src/objects/e6-earth-tiles-data.js (EARTH_TILES). If the global maps are made again, make these too.
// Sources (public domain): Blue Marble NG 500 m, records 73580 (January) and 73751 (July) on NASA's Earth Observatory, 8 tiles of 21600 x
// 21600 a month (about 400 MB a month; tools/cache/earth-tiles/dl.sh downloads them). The rest is tools/earth-global.mjs's cache.
// Usage, from tools/: node earth-tiles.mjs (takes several minutes and about 2 GB of memory)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { geoEquirectangular, geoPath } from 'd3-geo';
import * as topo from 'topojson-client';
sharp.cache(false); sharp.concurrency(4);
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const CT = path.join(HERE, 'cache', 'earth-tiles'), CG = path.join(HERE, 'cache', 'earth-global'), OUT = path.join(ROOT, 'assets', 'earth');
const W = 16384, H = 8192, TS = 512, NX = W/TS, NY = H/TS, MONTHS = ['01', '07'], E = 2/255;
const need = f => { if (!fs.existsSync(f)) { console.error('missing ' + f + ' (run tools/earth-global.mjs and tools/cache/earth-tiles/dl.sh first)'); process.exit(1); } return f; };
// one channel of a source at W x H
async function channel(p){ return sharp(need(p), { limitInputPixels:false }).resize(W, H, { kernel:'lanczos3', fit:'fill' }).removeAlpha().extractChannel(0).raw().toBuffer(); }
// Natural Earth's 10 m land at W x H, drawn in four strips (one picture of the whole would need 0.5 GB at once)
async function landMask(){
  const j = JSON.parse(fs.readFileSync(path.join(HERE, 'node_modules', 'world-atlas', 'land-10m.json'))), land = topo.feature(j, j.objects.land);
  const out = Buffer.alloc(W*H), SH = H/4;
  for (let s=0;s<4;s++){
    const proj = geoEquirectangular().scale(W/(2*Math.PI)).translate([W/2, H/2 - s*SH]).precision(0.02);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SH}"><rect width="100%" height="100%" fill="black"/><path d="${geoPath(proj)(land)}" fill="white"/></svg>`;
    const b = await sharp(Buffer.from(svg), { limitInputPixels:false }).greyscale().raw().toBuffer();
    b.copy(out, s*SH*W); process.stdout.write('m');
  }
  return out;
}
const hash = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 8);
const files = new Map();   // name -> buffer

console.log('land mask, heights, depths, lights at ' + W + ' x ' + H);
const mask = await landMask();
const elev = await channel(path.join(CG, 'gebco-elev.png')), bath = await channel(path.join(CG, 'gebco-bath.png')), night = await (async () => {
  const { data } = await sharp(need(path.join(CG, 'blackmarble-3km.jpg')), { limitInputPixels:false }).resize(W, H, { kernel:'lanczos3', fit:'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject:true });
  return data; })();
// the tiles kept: any land in them (0.05% of the tile or more)
const has = new Uint8Array(NX*NY);
for (let ty=0;ty<NY;ty++) for (let tx=0;tx<NX;tx++){ let n = 0;
  for (let y=ty*TS;y<(ty + 1)*TS;y+=2) for (let x=tx*TS;x<(tx + 1)*TS;x+=2) if (mask[y*W + x] > 127) n++;
  has[ty*NX + tx] = n > TS*TS/4*0.0005 ? 1 : 0; }
console.log(`\n${has.reduce((a, b) => a + b, 0)} of ${NX*NY} tiles have land`);
// the data tiles
for (let ty=0;ty<NY;ty++) for (let tx=0;tx<NX;tx++){
  if (!has[ty*NX + tx]) continue;
  const rgba = Buffer.alloc(TS*TS*4);
  for (let y=0;y<TS;y++) for (let x=0;x<TS;x++){
    const i = (ty*TS + y)*W + tx*TS + x, o = (y*TS + x)*4, e = elev[i], b = bath[i], r = night[i*3], g = night[i*3 + 1], bl = night[i*3 + 2];
    const lv = Math.max(0, Math.min((Math.min(r, g) - 0.55*bl - 4)/115, 1)), land = mask[i] > 127 && b >= 250;
    rgba[o] = land ? e : 0; rgba[o + 1] = Math.round(255*Math.pow(lv, 0.72)); rgba[o + 2] = land ? 0 : 255 - b; rgba[o + 3] = land ? 255 : 64;
  }
  files.set(`d-${tx}-${ty}.webp`, await sharp(rgba, { raw:{ width:TS, height:TS, channels:4 } }).webp({ quality:90, alphaQuality:100, effort:6 }).toBuffer());
  process.stdout.write('d');
}
// the detail: Blue Marble's 8 tiles a month (A to D west to east, 1 north and 2 south, 90 degrees each), each 4096 px here, against the
// global map of the month, scaled up 4 times as the GPU does (linear)
const QX = { A:0, B:1, C:2, D:3 }, Q = 4096;
for (const m of MONTHS){
  const gf = fs.readdirSync(OUT).find(f => f.startsWith(`global-color-${m}-4096-`) && f.endsWith('.webp'));
  if (!gf){ console.error('no global-color-' + m + '-4096 in assets/earth'); process.exit(1); }
  console.log(`\n${m}: against ${gf}`);
  for (const q of ['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2']){
    const qx = QX[q[0]], qy = +q[1] - 1;
    if (![...Array(8)].some((_, j) => [...Array(8)].some((_, i) => has[(qy*8 + j)*NX + qx*8 + i]))) continue;
    const fine = await sharp(need(path.join(CT, `bmng500-${m}-${q}.jpg`)), { limitInputPixels:false }).resize(Q, Q, { kernel:'lanczos3', fit:'fill' }).removeAlpha().raw().toBuffer();
    // (the global map's quarter, 1024 x 1024, with a texel of margin so the edge texels blend as on the GPU, then scaled up and cut back)
    const x0 = qx*1024, y0 = qy*1024, mx0 = Math.max(x0 - 1, 0), my0 = Math.max(y0 - 1, 0), mx1 = Math.min(x0 + 1025, 4096), my1 = Math.min(y0 + 1025, 2048);
    const big = await sharp(path.join(OUT, gf)).removeAlpha().extract({ left:mx0, top:my0, width:mx1 - mx0, height:my1 - my0 })
      .resize((mx1 - mx0)*4, (my1 - my0)*4, { kernel:'linear', fit:'fill' }).raw().toBuffer({ resolveWithObject:true });
    const bw = big.info.width, ox = (x0 - mx0)*4, oy = (y0 - my0)*4, coarse = big.data;
    for (let j=0;j<8;j++) for (let i=0;i<8;i++){
      const tx = qx*8 + i, ty = qy*8 + j; if (!has[ty*NX + tx]) continue;
      const rgb = Buffer.alloc(TS*TS*3);
      for (let y=0;y<TS;y++) for (let x=0;x<TS;x++){
        const fi = ((j*TS + y)*Q + i*TS + x)*3, ci = ((oy + j*TS + y)*bw + ox + i*TS + x)*3, o = (y*TS + x)*3;
        for (let c=0;c<3;c++){ const r = (fine[fi + c]/255 + E)/(coarse[ci + c]/255 + E); rgb[o + c] = Math.max(0, Math.min(255, Math.round(255*(0.5 + Math.log2(r)/4)))); }
      }
      files.set(`c${m}-${tx}-${ty}.webp`, await sharp(rgb, { raw:{ width:TS, height:TS, channels:3 } }).webp({ quality:82, effort:6 }).toBuffer());
      process.stdout.write('c');
    }
  }
}
// written as a set: a new folder named after all of it, the old one removed
const set = hash(Buffer.concat([...files.keys()].sort().map(k => Buffer.concat([Buffer.from(k), files.get(k)])))), dir = 'tiles-' + set;
for (const f of fs.readdirSync(OUT)) if (f.startsWith('tiles-') && f !== dir) fs.rmSync(path.join(OUT, f), { recursive:true, force:true });
fs.mkdirSync(path.join(OUT, dir), { recursive:true });
for (const [k, b] of files) fs.writeFileSync(path.join(OUT, dir, k), b);
const sum = k => [...files].filter(([n]) => n.startsWith(k)).reduce((a, [, b]) => a + b.length, 0)/1048576;
console.log(`\n${dir}: ${files.size} files, data ${sum('d-').toFixed(1)} MB, ${MONTHS.map(m => m + ' ' + sum('c' + m).toFixed(1) + ' MB').join(', ')}`);
// the tiles kept, as a hex string of 32 x 16 bits, row by row from the north
let hex = ''; for (let k=0;k<NX*NY;k+=4) hex += ((has[k] << 3) | (has[k + 1] << 2) | (has[k + 2] << 1) | has[k + 3]).toString(16);
const ref = Object.fromEntries(MONTHS.map(m => [m, fs.readdirSync(OUT).find(f => f.startsWith(`global-color-${m}-4096-`))]));
const js = `// generated by tools/earth-tiles.mjs: the Earth's finer tiles, served as earth/<dir>/<file> (e7-earth-tiles.js streams them). n: tiles across
// and down (equirectangular, from 180 degrees west and the north pole), px: a tile's side, has: which tiles exist (hex, 4 tiles a digit, row
// by row), months: the detail images (January's and July's), ref: the global maps the detail was measured against
const EARTH_TILES = ${JSON.stringify({ dir, n:[NX, NY], px:TS, months:MONTHS, has:hex, ref })};
`;
fs.writeFileSync(path.join(ROOT, 'src', 'objects', 'e6-earth-tiles-data.js'), js);
console.log('manifest: src/objects/e6-earth-tiles-data.js');

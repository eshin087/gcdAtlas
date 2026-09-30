// The link preview (og:image): what a shared link to gcdatlas shows in a chat or a post, 1200 x 630.
//   node tools/og-image.mjs [--at=sgra:1,helix:0] candidates into tests/out/og/ (+ a contact sheet)
//   node tools/og-image.mjs --pick=sgra:0        render one and write assets/og.jpg (build.mjs copies it to dist/og.jpg)
//   --wait=6000                                  how long to let a view settle before the still
// Drawn on the real GPU (--use-angle=d3d11, as tools/lab-shots.mjs), with the interface hidden and the name and address set
// in the page's own type over a dark band at the bottom.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'file://' + path.join(ROOT, 'dist', 'index.html'), OUT = path.join(ROOT, 'tests', 'out', 'og');
const arg = (k, d) => { const a = process.argv.find(a => a.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const pick = arg('pick', null), wait = +arg('wait', 6000);
const list = (pick || arg('at', null) || 'sgra:0,m87bh:0,saturn:0,helix:0,milkyway:0,andromeda:1').split(',').map(s => s.split(':'));
const W = 1200, H = 630;
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('build first: node build.mjs');
fs.mkdirSync(OUT, { recursive:true });

const browser = await chromium.launch({ args:['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport:{ width:W, height:H } })).newPage();
await page.addInitScript(() => { window.__noAdapt = true; window.__syncCompile = true;
  try { localStorage.setItem('gcdatlas.dailySeen', JSON.stringify(new Date().toISOString().slice(0, 10))); localStorage.setItem('gcdatlas.settings', JSON.stringify({ fadeUI:'off' })); } catch (e) {} });
await page.goto(PAGE);
await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ, null, { timeout:60000 });
// only the characters: photo mode hides the interface, and its own bar goes too
await page.evaluate(() => { window.__cosmos.startPhoto(); const s = document.createElement('style'); s.textContent = '#photoBar,.toast,.hint{display:none!important}'; document.head.appendChild(s); });

const band = name => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04050a" stop-opacity="0"/><stop offset="1" stop-color="#04050a" stop-opacity="0.92"/></linearGradient></defs>
  <rect x="0" y="${H - 190}" width="${W}" height="190" fill="url(#g)"/>
  <text x="56" y="${H - 86}" font-family="IBM Plex Mono, Consolas, monospace" font-size="54" font-weight="600" fill="#e2e8f5">gcdatlas</text>
  <text x="58" y="${H - 44}" font-family="IBM Plex Mono, Consolas, monospace" font-size="26" fill="#c3cbe0">the real universe, drawn in ASCII${name ? ' · ' + name : ''}</text>
  <text x="${W - 56}" y="${H - 44}" text-anchor="end" font-family="IBM Plex Mono, Consolas, monospace" font-size="26" fill="#ffb35c">gcdatlas.com</text>
</svg>`);

const files = [];
for (const [k, v = '0'] of list){
  const name = await page.evaluate(([k, v]) => { const c = window.__cosmos; c.setTour(false); c.view(k, +v); return (c.OBJ.find(o => o.key === k) || {}).name || k; }, [k, v]);
  await page.waitForTimeout(wait);
  const raw = await page.screenshot();
  const img = sharp(raw).composite([{ input:band(pick ? '' : name) }]);
  const f = path.join(OUT, `${k}_${v}.jpg`); await img.jpeg({ quality:86, mozjpeg:true }).toFile(f); files.push(f);
  console.log(`${k}:${v} -> ${path.relative(ROOT, f)}`);
}
await browser.close();

if (pick){
  const dst = path.join(ROOT, 'assets', 'og.jpg'); fs.copyFileSync(files[0], dst);
  console.log(`wrote assets/og.jpg (${(fs.statSync(dst).size/1024).toFixed(0)} KB)`);
} else {
  const cw = 600, ch = 315, cols = 2, rows = Math.ceil(files.length/cols);
  const tiles = await Promise.all(files.map(async (f, i) => ({ input:await sharp(f).resize(cw, ch).toBuffer(), left:(i % cols)*cw, top:Math.floor(i/cols)*ch })));
  await sharp({ create:{ width:cw*cols, height:ch*rows, channels:3, background:'#000' } }).composite(tiles).jpeg({ quality:85 }).toFile(path.join(OUT, 'sheet.jpg'));
  console.log('contact sheet: tests/out/og/sheet.jpg');
}

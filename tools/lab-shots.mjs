// Stills from the lab (dist/lab.html, src/09l-lab.js) on the real GPU, and a contact sheet of them: the quick way to look at a change to the
// Halo's looks without waiting for the ship on the site.
//   npm run lab -- --do=cam:chase+act:fold --at=3,7,9.5,10.5    teleport, seen from the chase camera, stills 3, 7, 9.5 and 10.5 s after
//   npm run lab -- --do=place:sgra+cam:side --at=2,4             the shield by Sgr A*
// --do: lab buttons pressed in turn (place:saturn|jupiter|earth|mars|sgra|crab, cam:side|top|aim|chase|bridge|orbit, speed:0.25|pause|step,
// act:fold|probe|scan|weapons, load:auto). --at: seconds after the last press (real time: each still takes about a tenth of a second).
// --load=0.8: the shield's load, as its slider sets it. --phone: a phone held upright. --out=dir: where they go (tests/out/lab).
import { chromium } from 'playwright';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const OUT = arg('out', 'tests/out/lab'), PHONE = process.argv.includes('--phone'), acts = arg('do', ''), at = arg('at', '0').split(',').map(Number);
fs.mkdirSync(OUT, { recursive:true });
for (const f of fs.readdirSync(OUT)) if (/^at.*\.png$/.test(f)) fs.rmSync(path.join(OUT, f));
// (Direct3D through ANGLE: the GPU, as a visitor's Chrome on Windows; SwiftShader is far slower and compiles shaders differently)
const browser = await chromium.launch({ args:['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext(PHONE ? { viewport:{ width:390, height:844 }, deviceScaleFactor:2, isMobile:true, hasTouch:true } : { viewport:{ width:1280, height:720 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await page.addInitScript(() => { try { localStorage.setItem('gcdatlas.dailySeen', JSON.stringify(new Date().toISOString().slice(0, 10))); localStorage.setItem('gcdatlas.settings', JSON.stringify({ fadeUI:'off', sound:false })); } catch (e) {} });
await page.goto('file://' + path.resolve('dist/lab.html')); await page.waitForTimeout(4000);
if (acts) for (const a of acts.split('+')){ const [kind, v] = a.split(':'); await page.click(`.lab-panel button[data-${kind}="${v}"]`); await page.waitForTimeout(300); }
const load = arg('load', '');
if (load) await page.$eval('.lab-panel input[type=range]', (el, v) => { el.value = Math.round(v*100); el.dispatchEvent(new Event('input')); }, +load);
const t0 = Date.now(), files = [];
for (const t of at){ const w = t*1000 - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); const f = path.join(OUT, `at${t.toFixed(2).padStart(6, '0')}.png`); await page.screenshot({ path:f }); files.push(f); }
await browser.close();
// the contact sheet: up to three across
const W = PHONE ? 260 : 640, H = PHONE ? 563 : 360, cols = Math.min(3, files.length), comp = [];
for (let i=0;i<files.length;i++) comp.push({ input:await sharp(files[i]).resize(W, H).toBuffer(), left:(i % cols)*W, top:Math.floor(i/cols)*H });
await sharp({ create:{ width:cols*W, height:Math.ceil(files.length/cols)*H, channels:3, background:'#000' } }).composite(comp).png().toFile(path.join(OUT, 'sheet.png'));
console.log(`${files.length} stills and sheet.png in ${OUT}` + (errors.length ? '\nerrors:\n' + errors.join('\n') : ''));

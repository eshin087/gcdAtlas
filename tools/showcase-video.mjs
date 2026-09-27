// Records the Halo showcase (the page opened with ?showcase=halo, or the looks review with ?showcase=review) to a WebM video, for reviewing the ship
// without opening the site.
// Frame by frame and deterministic (the page's own clock is stepped 1/fps at a time), drawn on the GPU where Chromium can use it.
// Encodes with the ffmpeg that Playwright installs next to its browsers (VP8 in WebM).
// Usage: npm run showcase:video [-- out.webm --dur=167 --w=1280 --h=720 --fps=30 --kbps=2400 --url="shield=b&fold=c"]
// --url adds to the page's address, or replaces what is there: --url="showcase=review&shield=b" records the looks review with shield B.
// One full loop of ?showcase=halo is about 167 s, of the looks review (?showcase=review) about 85 s; --dur defaults to one loop.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PAGE = 'file://' + path.join(ROOT, 'dist', 'index.html');
const args = process.argv.slice(2), str = k => { const a = args.find(a => a.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : undefined; }, opt = (k, d) => str(k) === undefined ? d : +str(k);
const query = new URLSearchParams('showcase=halo'); for (const [k, v] of new URLSearchParams(str('url') || '')) query.set(k, v);
const review = query.get('showcase') === 'review';
const out = args.find(a => !a.startsWith('--')) || path.join(ROOT, 'tests', 'out', review ? 'review-showcase.webm' : 'halo-showcase.webm');
const dur = opt('dur', review ? 86 : 167), W = opt('w', 1280), H = opt('h', 720), FPS = opt('fps', 30), KBPS = opt('kbps', 2400);
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('build first: node build.mjs');
// Playwright's ffmpeg: %LOCALAPPDATA%\ms-playwright (Windows), ~/Library/Caches/ms-playwright (macOS), ~/.cache/ms-playwright (Linux)
const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright')
  : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright') : path.join(os.homedir(), '.cache', 'ms-playwright'));
const ffdir = fs.existsSync(cache) ? fs.readdirSync(cache).find(d => d.startsWith('ffmpeg')) : null;
const ffexe = ffdir && fs.readdirSync(path.join(cache, ffdir)).find(f => f.startsWith('ffmpeg'));
if (!ffexe) throw new Error('no ffmpeg found in ' + cache + ' (npx playwright install ffmpeg)');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive:true });
const ff = spawn(path.join(cache, ffdir, ffexe), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(FPS), '-i', 'pipe:0',
  '-c:v', 'libvpx', '-crf', '12', '-b:v', KBPS + 'k', '-qmin', '4', '-qmax', '42', '-deadline', 'good', '-cpu-used', '1', '-g', String(FPS*4), '-pix_fmt', 'yuv420p', out], { stdio:['pipe', 'inherit', 'inherit'] });
const gpu = process.platform === 'win32' ? ['--use-angle=d3d11'] : [];
const browser = await chromium.launch({ args:[...gpu, '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport:{ width:W, height:H } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
// full quality, shaders compiled up front, the page's own frame loop stopped (this script steps it), no daily card, the interface never fades, sound off
await page.addInitScript(() => { window.__noAdapt = true; window.__syncCompile = true; window.__freeze = true;
  try { localStorage.setItem('gcdatlas.dailySeen', JSON.stringify(new Date().toISOString().slice(0, 10))); localStorage.setItem('gcdatlas.settings', JSON.stringify({ fadeUI:'off', sound:false })); } catch (e) {} });
await page.goto(PAGE + '?' + query.toString());
await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ, null, { timeout:60000 });
const N = Math.round(dur*FPS), t0 = Date.now();
for (let i=0;i<N;i++){
  await page.evaluate(dt => { const C = __cosmos; C.tick(dt); C.render(); C.hud(); C.caption(dt); }, 1/FPS);
  const buf = await page.screenshot({ type:'jpeg', quality:92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % (FPS*20) === 0) console.log(`${(i/FPS).toFixed(0)} s of ${dur} s · ${((Date.now() - t0)/1000).toFixed(0)} s so far`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
if (errors.length){ console.error('FAIL showcase-video\n' + errors.slice(0, 10).join('\n')); process.exitCode = 1; }
else console.log(`ok showcase-video · ${out} · ${(fs.statSync(out).size/1e6).toFixed(1)} MB`);

// Wallpaper mode (?wallpaper=1, the KDE Plasma wallpaper): the screensaver starts by itself, shows no interface, makes no sound
// and no network calls, and no input reaches the camera. Also checks that the normal screensaver (Z) still comes and goes.
import { openPage, report, PAGE } from './lib.mjs';

const bad = [];
const { browser, page, errors } = await openPage({ query:'?wallpaper=1&travel=quick', fade:true });
// every request must stay on the device (fonts are the one exception the page allows)
const requests = [];
page.on('request', r => { const u = r.url(); if (!/^(file|data|blob):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) requests.push(u); });
await page.waitForFunction(() => window.__cosmos.saver.on, null, { timeout:30000 });

const state = () => page.evaluate(() => { const c = window.__cosmos, b = document.body.classList;
  return { wallpaper:document.documentElement.classList.contains('wallpaper'), saver:b.contains('saver'), embedded:c.saver.embedded, tourOn:c.tour.on, tourId:c.tourId, obj:c.tour.obj,
    travel:c.SET.travel, sound:c.SET.sound, glow:c.SET.glow, labels:c.SET.labels, musicOn:c.music.on, musicCtx:!!c.music._dbg.ctx,
    shown:[...document.body.children].filter(e => !['view', 'foldFlash', 'nogl'].includes(e.id) && getComputedStyle(e).display !== 'none' && !e.hidden).map(e => e.id || e.className) }; });
let s = await state();
if (!s.wallpaper || !s.saver || !s.embedded) bad.push('wallpaper mode did not start the embedded screensaver: ' + JSON.stringify(s));
if (!s.tourOn || s.tourId !== 'saver') bad.push('the shuffled tour is not playing: ' + JSON.stringify(s));
if (s.travel !== 'quick') bad.push('&travel=quick was not applied: ' + s.travel);
if (s.sound || s.musicOn || s.musicCtx) bad.push('wallpaper mode must make no sound');
if (s.shown.length) bad.push('interface visible in wallpaper mode: ' + s.shown.join(', '));

// input: drag, wheel, clicks and keys must change nothing (keys include the ones that toggle glow and labels, open help and search, or end the saver)
const before = s;
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(900, 500, { steps:5 }); await page.mouse.up();
await page.mouse.wheel(0, 400); await page.mouse.click(300, 300);
for (const k of ['ArrowRight', 'Space', 'Escape', 'z', 'g', 'l', 'b', 'h', '/', ']']) await page.keyboard.press(k);
await page.waitForTimeout(300);
s = await state();
if (!s.saver || !s.embedded || !s.tourOn || s.tourId !== 'saver') bad.push('input stopped the wallpaper: ' + JSON.stringify(s));
if (s.glow !== before.glow || s.labels !== before.labels) bad.push('keys reached the settings in wallpaper mode');
if (s.shown.length) bad.push('input brought up the interface: ' + s.shown.join(', '));

// dynamic wallpaper FPS update (via window.setWallpaperFps and window.WALLPAPER_FPS)
const fpsCheck = await page.evaluate(() => {
  window.setWallpaperFps(20);
  const a = window.__cosmos.wallpaperFps;
  window.WALLPAPER_FPS = 15;
  const b = window.__cosmos.wallpaperFps;
  return { a, b, prop:window.WALLPAPER_FPS };
});
if (fpsCheck.a !== 20 || fpsCheck.b !== 15 || fpsCheck.prop !== 15) bad.push('dynamic wallpaper FPS was not updated: ' + JSON.stringify(fpsCheck));

// wallpaper title positions
const titleCheck = await page.evaluate(() => {
  const el = document.getElementById("wallpaperTitle");
  const initialHidden = el.hidden;
  window.setWallpaperTitlePos("top-center");
  window.setWallpaperTextSize("xsmall");
  const shown = !el.hidden && el.classList.contains("pos-top-center") && el.classList.contains("size-xsmall") && el.textContent.length > 0;
  window.setWallpaperTitlePos("none");
  const hiddenAgain = el.hidden;
  return { initialHidden, shown, hiddenAgain };
});
if (!titleCheck.initialHidden || !titleCheck.shown || !titleCheck.hiddenAgain) {
  bad.push("wallpaper title position/size was not applied correctly: " + JSON.stringify(titleCheck));
}

// freeze / unfreeze control halts and resumes rendering
const freezeCheck = await page.evaluate(async () => {
  window.setFreeze(true);
  const f1 = window.__freeze;
  await new Promise(r => setTimeout(r, 60));
  window.setFreeze(false);
  const f2 = window.__freeze;
  return { f1, f2 };
});
if (!freezeCheck.f1 || freezeCheck.f2) bad.push('setFreeze did not update freeze state correctly');

// laps: on the last stop the next lap is shuffled and starts right there, so nothing shows twice in a row
const lap = await page.evaluate(async () => { const c = window.__cosmos, n = c.TOUR.length, last = c.TOUR[n - 1], order = c.TOUR.join();
  c.tourGo(last, true); await new Promise(r => setTimeout(r, 1500));
  return { n, len:c.TOUR.length, first:c.TOUR[0], last, same:c.TOUR.join() === order, unique:new Set(c.TOUR).size }; });
if (lap.first !== lap.last || lap.len !== lap.n || lap.unique !== lap.n || lap.same) bad.push('the next lap was not reshuffled from the last stop: ' + JSON.stringify(lap));
// the tour moves on by itself
const t0 = await page.evaluate(() => window.__cosmos.tour.obj);
const t1 = await page.evaluate(() => { const c = window.__cosmos; for (let k = 0; k < 20 && c.tour.obj === c.TOUR[0]; k++) c.simulate(30); return c.tour.obj; });
if (t0 === t1) bad.push('the tour did not move on to another stop');
if (requests.length) bad.push('network requests in wallpaper mode: ' + requests.slice(0, 5).join(', '));

// saved settings are ignored and left alone: a visitor's warp and sound stay theirs
const { browser: b2, page: p2 } = await openPage({ query:'?wallpaper=1', fade:true });
await p2.evaluate(() => { try { localStorage.setItem('gcdatlas.settings', JSON.stringify({ travel:'warp', sound:true, fadeUI:'off' })); } catch (e) {} });
await p2.goto(PAGE + '?wallpaper=1');
await p2.waitForFunction(() => window.__cosmos && window.__cosmos.saver && window.__cosmos.saver.on, null, { timeout:30000 });
const saved = await p2.evaluate(() => {
  const c = window.__cosmos;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('gcdatlas.settings') || 'null'); } catch (e) {}
  return { travel:c.SET.travel, sound:c.SET.sound, stored };
});
if (saved.travel !== 'cinematic' || saved.sound) bad.push('saved settings leaked into wallpaper mode: ' + JSON.stringify(saved));
if (!saved.stored || saved.stored.travel !== 'warp' || saved.stored.sound !== true) bad.push('wallpaper mode changed the saved settings: ' + JSON.stringify(saved.stored));
await b2.close();

// the normal screensaver: Z starts it with its HUD, moving the mouse brings the atlas back
const { browser: b3, page: p3 } = await openPage({ fade:true });
await p3.mouse.move(100, 100); await p3.keyboard.press('z');
const on = await p3.evaluate(() => ({ saver:window.__cosmos.saver.on, embedded:window.__cosmos.saver.embedded, hud:!document.querySelector('#saverHud').hidden, tourId:window.__cosmos.tourId, wallpaper:document.documentElement.classList.contains('wallpaper') }));
if (!on.saver || on.embedded || !on.hud || on.tourId !== 'saver' || on.wallpaper) bad.push('Z did not start the normal screensaver: ' + JSON.stringify(on));
await p3.waitForTimeout(1400);
await p3.mouse.move(600, 500, { steps:4 });
const off = await p3.evaluate(() => ({ saver:window.__cosmos.saver.on, saverClass:document.body.classList.contains('saver'), hud:!document.querySelector('#saverHud').hidden, tourId:window.__cosmos.tourId }));
if (off.saver || off.saverClass || off.hud || off.tourId !== 'grand') bad.push('moving the mouse did not end the screensaver: ' + JSON.stringify(off));

errors.push(...bad);
report('wallpaper', errors, `${lap.n} stops a lap`);
await b3.close();
await browser.close();

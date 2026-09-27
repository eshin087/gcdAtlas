// Smoke test: the page loads, every object renders a frame from its first view, panels open, no errors or NaNs.
import { openPage, report, PAGE } from './lib.mjs';
const { browser, page, errors } = await openPage();
const keys = await page.evaluate(() => window.__cosmos.OBJ.filter(o => !o.marker && o.views && o.views.length).map(o => o.key));
const bad = [];
for (let i = 0; i < keys.length; i += 8){
  const chunk = keys.slice(i, i + 8);
  const r = await page.evaluate(ks => { const c = window.__cosmos, out = [];
    for (const k of ks){ c.setTour(false); c.view(k, 0); c.tick(1/30); c.render();
      if (!isFinite(c.cam.rel[0]) || !isFinite(c.orbit.dist)) out.push(k + ': NaN camera');
      // every object that could be on screen must have a real size and visibility (a field named like an engine property, e.g. `mag`, once made the Crab vanish)
      for (const o of c.OBJ) if ((o.vis !== undefined && !isFinite(o.vis)) || (o.mag !== undefined && typeof o.mag !== 'number')) out.push(`${o.key}: bad vis/mag while viewing ${k}`); }
    return out; }, chunk);
  bad.push(...r);
}
// the glyph table: faint levels keep their own glyph; the run of heavy glyphs at the top uses at most three of & 8 @, each with clearly more ink than the one before
bad.push(...await page.evaluate(() => { const a = window.__cosmos.dbg.atlas, d = a.lutData, HEAVY = '%#&8@$W', out = [], used = [];
  if (!d || d.length !== a.levels*a.sub*4) return ['glyph table missing'];
  let h0 = a.levels; while (h0 > 0 && HEAVY.includes(a.chars[h0])) h0--;
  for (let b = 0; b < d.length/4; b++){ const g = d[b*4], ch = a.chars[g], was = Math.floor(b/a.sub) + 1;
    if (!(d[b*4 + 1] > 0 && d[b*4 + 2] > 0 && d[b*4 + 3] > 0 && isFinite(d[b*4 + 1]))) out.push('bad glyph table entry ' + b);
    if (was <= h0){ if (g !== was) out.push(`faint glyph changed at entry ${b}: ${a.chars[was]} -> ${ch}`); continue; }
    if (!'&8@'.includes(ch)) out.push(`bright end uses ${ch} at entry ${b}`);
    if (used[used.length - 1] !== g){ const prev = used.length ? a.ink[used[used.length - 1]] : a.ink[h0];
      if (used.includes(g)) out.push('bright end goes back to ' + ch); else if (!(a.ink[g] > prev)) out.push(`ink does not rise at ${ch}`); used.push(g); } }
  if (used.length > 3) out.push('bright end uses ' + used.map(g => a.chars[g]).join(''));
  return out; }));
// volumes: a sphere beside the camera (reaching behind it) is not drawn; one partly in view gets only its part of the screen; no visible point is ever left out
bad.push(...await page.evaluate(() => { const c = window.__cosmos, cam = c.cam, sr = c.dbg.sphereRect, out = [];
  const at = (x, y, z) => cam.right.map((r, i) => r*x + cam.up[i]*y + cam.fwd[i]*z);
  if (sr(at(10, 0, 0.5), 1)) out.push('sphereRect: a sphere off to the side is drawn');
  const r = sr(at(2, 0, 0.5), 1); if (!r || !(r[0] > -0.9) || r[2] !== 1) out.push('sphereRect: a sphere at the edge gets ' + JSON.stringify(r));
  let seed = 3; const rnd = () => { seed = (seed*1664525 + 1013904223) >>> 0; return seed/4294967296; };
  const [tanX, tanY] = c.dbg.tan;
  for (let t = 0; t < 600 && out.length < 3; t++){
    const d = 1.06 + rnd()*rnd()*20, u = [rnd()*2 - 1, rnd()*2 - 1, rnd()*2 - 1], ul = Math.hypot(...u), C = u.map(x => x/ul*d), rect = sr(at(...C), 1);
    for (let s = 0; s < 300; s++){ const w = [rnd()*2 - 1, rnd()*2 - 1, rnd()*2 - 1], wl = Math.hypot(...w); if (wl > 1 || wl < 1e-6) continue;
      const p = C.map((x, i) => x + w[i]/wl); if (p[2] <= 1e-6) continue;
      const x = p[0]/(p[2]*tanX), y = p[1]/(p[2]*tanY); if (Math.abs(x) > 0.98 || Math.abs(y) > 0.98) continue;
      if (!rect || x < rect[0] || x > rect[2] || y < rect[1] || y > rect[3]){ out.push('sphereRect leaves out a visible point of a sphere at ' + C.map(v => v.toFixed(2))); break; } }
  }
  return out; }));
// the Large Magellanic Cloud is out of sight from the Sun's first view, so it is not ray-marched there (its sphere reaches behind the camera, which used to mean the whole screen)
bad.push(...await page.evaluate(() => { const c = window.__cosmos; c.setTour(false); c.view('sun', 0); c.tick(1/30); c.render();
  return c.BYKEY.lmc.onScreen ? ['the Large Magellanic Cloud is drawn in the Sun view, out of sight'] : []; }));
for (const id of ['#btnAtlas', '#btnTours', '#btnTime', '#btnSettings']){ await page.click(id); await page.waitForTimeout(150); await page.click(id); }
const ui = await page.evaluate(() => ({ rows:document.querySelectorAll('.arow').length, readout:document.querySelector('#readout').textContent.length }));
if (ui.rows < 50) bad.push('atlas has only ' + ui.rows + ' rows');
// a planet whose angle follows its orbit (track): a flight to its day side lands on the day side, not where it was at take-off
bad.push(...await page.evaluate(() => { const c = window.__cosmos, out = [], n = v => { const l = Math.hypot(...v); return v.map(x => x/l); };
  for (const k of ['peg51b', 'hd189733b']){
    c.setTour(false); c.view('earth', 0); c.tick(1/30);
    const o = c.BYKEY[k]; c.lockOn(o.index, 0); c.land(0);
    const a = n(c.cam.rel), b = n(o.host.pos.map((x, i) => x - o.pos[i])), dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    if (!(dot > 0.5)) out.push(`${k}: landed on the night side (camera toward the star ${dot.toFixed(2)})`);
  }
  return out; }));
errors.push(...bad);
// crafted share links must not stop the page from starting (they used to: #o=constructor, a non-numeric date)
for (const h of ['#o=constructor', '#o=__proto__', '#o=earth&jd=abc&deep=x&c=1,NaN,-5']){
  await page.goto('about:blank'); await page.goto(PAGE + h);   // (a real load: changing only the hash would not restart the page)
  const ok = await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ && isFinite(window.__cosmos.cam.rel[0]) && window.__cosmos.BYKEY.earth.pos.every(isFinite), null, { timeout:60000 }).then(() => true, () => false);
  if (!ok) errors.push('share link ' + h + ' broke the page');
}
report('smoke', errors, `${keys.length} objects rendered, ${ui.rows} atlas rows`);
await browser.close();

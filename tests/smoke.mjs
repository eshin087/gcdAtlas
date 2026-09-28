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
// atlas categories: every chip has places; the made-up Halo is not human-made, every real craft is
bad.push(...await page.evaluate(() => { const c = window.__cosmos, d = c.dbg, out = [];
  const listed = c.OBJ.filter(o => o.atlas !== false && !o.marker && d.GROUPS.some(([g]) => g === o.group));
  for (const [id] of d.CATS) if (id !== 'all' && !listed.some(o => d.catsOf(o).includes(id))) out.push('atlas chip ' + id + ' has no places');
  if (d.catsOf(c.BYKEY.halo).includes('human')) out.push('the Halo is in the human-made chip');
  for (const o of listed) if (o.group === 'travel' && o.key !== 'halo' && !d.catsOf(o).includes('human')) out.push(o.key + ' is not in the human-made chip');
  return out; }));
// the shared random seed once every object exists: packs that draw from rnd() put it back, so the Halo's route stays the same (value of 0.8.6)
const seedObjects = await page.evaluate(() => window.__cosmos.dbg.seedObjects);
if (seedObjects !== 3186211718) bad.push('the random seed after the objects changed (' + seedObjects + '): a pack that uses rnd() must put seed back');
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
// the atlas controls on a desk (1280 x 800): every choice on screen and inside the panel, nothing wider than its box at any menu text size
// (nothing scrolls sideways), targets of 28 px or more, room for about ten rows. Grouped, the Solar System and the comets measure from the Sun
// and climb, with the Moon under Earth; one list by distance puts the places you are inside first; a search looks through every kind;
// the arrow keys move through the kinds; a badge shows what is left for it; Esc closes the badge tray before the atlas
const atl = await page.evaluate(() => {
  const C = window.__cosmos, $ = s => document.querySelector(s), out = [], r = {}, esc = () => dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  const fit = () => { const a = $('#atlas'), ar = a.getBoundingClientRect(), bad = [];
    for (const e of a.querySelectorAll('*')) if (e.clientWidth > 0 && !e.closest('.atlas-list') && !e.classList.contains('sr') && e.scrollWidth > e.clientWidth + 1) bad.push('overflows: ' + (e.id || e.className));
    for (const b of a.querySelectorAll('#atlasTools button, #seenBtn, #atlasClose')){ const q = b.getBoundingClientRect(), id = b.id || b.dataset.cat || b.dataset.sort;
      if (q.left < ar.left - 1 || q.right > ar.right + 1 || q.top < ar.top - 1 || q.bottom > ar.bottom + 1) bad.push('outside the panel: ' + id); if (q.height < 28) bad.push('under 28 px: ' + id); }
    return bad; };
  if ($('#atlas').hidden) $('#btnAtlas').click();
  for (const ms of [0.9, 1.15, 1.3, 1.6]){ C.setOpt('menuSize', ms, true); out.push(...fit().map(m => `menu text ${Math.round(ms*100)}%: ${m}`)); }
  C.setOpt('menuSize', 1.15, true);
  r.cells = document.querySelectorAll('#atlasCats .cell').length;
  r.rows = +($('#atlasList').clientHeight/$('.arow').getBoundingClientRect().height).toFixed(1);
  r.dflt = { sort:$('#atlasSort [aria-checked="true"]').dataset.sort, all:$('#atlasAll').getAttribute('aria-pressed'), result:!$('#atlasResult').hidden, dir:$('#atlasDir').textContent };
  // grouped: what each heading measures, and the numbers climb
  const group = g => { const h = [...document.querySelectorAll('#atlasList .agroup')].find(x => x.firstChild.textContent === g), rows = [];
    for (let x = h && h.nextElementSibling; x && !x.classList.contains('agroup'); x = x.nextElementSibling) if (x.classList.contains('arow') && !x.hidden) rows.push({ name:x.querySelector('.an').textContent, d:x.querySelector('.ad').textContent, child:x.classList.contains('child') });
    return { note:h && h.lastChild.textContent, rows }; };
  const au = t => { const m = /([\d,.]+) AU$/.exec(t); return m ? +m[1].replace(/,/g, '') : null; };
  for (const g of ['Solar System', 'Comets & meteors']){ const G = group(g); if (G.note !== 'from the Sun') out.push(`the ${g} heading measures "${G.note}"`);
    const v = G.rows.filter(x => !x.child).map(x => au(x.d)).filter(x => x != null); if (v.some((x, i) => i && x < v[i - 1])) out.push(`${g}: the distances from the Sun do not climb (${v.join(', ')})`); }
  if (group('Stars & stellar remnants').note !== 'from Earth') out.push('the stars heading does not say "from Earth"');
  const ss = group('Solar System').rows, iE = ss.findIndex(x => x.name === 'Earth'), moon = ss[iE + 1];
  r.solar = ss.slice(0, 6).map(x => x.name + ' ' + x.d).join(' · ');
  if (ss[0].name !== 'the Solar System' || ss[1].name !== 'the Sun' || ss[ss.length - 1].name !== 'the Oort cloud') out.push('Solar System heading order: ' + ss.map(x => x.name).join(', '));
  if (!moon || moon.name !== 'the Moon' || !moon.child || !/ km from Earth$/.test(moon.d) || !/^home · 1\.0\d AU$/.test(ss[iE].d)) out.push('Earth and the Moon under it: ' + JSON.stringify(ss.slice(iE, iE + 2)));
  // one list by distance: the places you are inside first, under their own heading, then near to far, said in the results line
  $('#atlasSort [data-sort="distance"]').click();
  r.flat = [...$('#atlasList').children].filter(e => !e.hidden).slice(0, 7).map(e => e.classList.contains('agroup') ? '#' + e.firstChild.textContent : e.querySelector('.an').textContent).join(', ');
  r.flatSays = [($('#atlasResultTxt').textContent + ' / ' + $('#atlasResultNote').textContent).replace(/[\s]+/g, ' '), $('#atlasDir').textContent, !$('#atlasResult').hidden];
  $('#atlasSort [data-sort="size"]').click(); r.size = [$('#atlasDir').textContent, $('.arow:not([hidden]) .an').textContent];
  $('#atlasSort [data-sort="kind"]').click();
  // a search looks through every kind (black holes chosen, Jupiter still found); "clear" empties it and keeps the kind
  $('#atlasCats [data-cat="bh"]').click();
  const s = $('#atlasSearch'); s.value = 'jupiter'; s.dispatchEvent(new Event('input', { bubbles:true }));
  r.search = { jupiter:[...document.querySelectorAll('.arow')].some(b => !b.hidden && b.querySelector('.an').textContent === 'Jupiter'),
    found:$('#atlasResultTxt').textContent, btn:$('#atlasReset').textContent, dim:$('#atlasTools').classList.contains('searching') };
  $('#atlasReset').click(); r.cleared = { box:s.value, cat:C.dbg.ATL.cat, n:document.querySelectorAll('.arow:not([hidden])').length };
  // arrow keys: black holes → galaxies (right) → human-made (down); the camera does not get the keys
  const cell = $('#atlasCats [data-cat="bh"]'); cell.focus();
  cell.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowRight', bubbles:true, cancelable:true })); r.kRight = C.dbg.ATL.cat;
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true, cancelable:true })); r.kDown = [C.dbg.ATL.cat, document.activeElement.dataset.cat];
  // the badge tray: a badge on the way shows what is left for it; Esc closes the tray first, then the atlas
  $('#seenBtn').click(); r.tray = [!$('#badgeTray').hidden, $('#seenBtn').getAttribute('aria-expanded'), document.querySelectorAll('#badges .brow').length];
  [...document.querySelectorAll('#badges button.brow')].find(b => /black hole hunter/.test(b.textContent)).click();
  r.badgeGo = [C.dbg.ATL.cat, C.dbg.ATL.unseen, !$('#badgeTray').hidden, $('#atlasResultTxt').textContent];
  $('#seenBtn').click(); esc(); r.escTray = [!$('#badgeTray').hidden, !$('#atlas').hidden]; esc(); r.escAtlas = !$('#atlas').hidden;
  $('#btnAtlas').click(); $('#atlasReset').click(); r.reset = [!$('#atlasResult').hidden, JSON.stringify(C.dbg.ATL)]; $('#atlasClose').click();
  r.out = out; return r;
});
errors.push(...atl.out);
if (atl.cells !== 12) errors.push('the atlas has ' + atl.cells + ' kinds (12 expected)');
if (!(atl.rows >= 10)) errors.push('the atlas list has room for only ' + atl.rows + ' rows at 1280 x 800');
if (atl.dflt.sort !== 'kind' || atl.dflt.all !== 'true' || atl.dflt.result || atl.dflt.dir !== '⇅near → far') errors.push('the atlas default view: ' + JSON.stringify(atl.dflt));
if (atl.flat !== '#all around you, the Solar System, the Oort cloud, the cosmic web, the observable universe, #near → far, Earth') errors.push('one list by distance starts: ' + atl.flat);
if (atl.flatSays.join('|') !== '137 places · near → far / from Earth|⇅near → far|true') errors.push('the results line for one list by distance: ' + JSON.stringify(atl.flatSays));
if (atl.size[0] !== '⇅big → small' || atl.size[1] !== 'the observable universe') errors.push('size does not start with the biggest: ' + JSON.stringify(atl.size));
if (!atl.search.jupiter || !/^\d+ found · searching all 137$/.test(atl.search.found) || atl.search.btn !== 'clear' || !atl.search.dim) errors.push('a search with black holes chosen: ' + JSON.stringify(atl.search));
if (atl.cleared.box || atl.cleared.cat !== 'bh' || atl.cleared.n !== 8) errors.push('clearing the search: ' + JSON.stringify(atl.cleared));
if (atl.kRight !== 'galaxies' || atl.kDown.join() !== 'human,human') errors.push('arrow keys in the kinds: ' + JSON.stringify([atl.kRight, atl.kDown]));
if (!atl.tray[0] || atl.tray[1] !== 'true' || atl.tray[2] !== 9) errors.push('the badge tray: ' + JSON.stringify(atl.tray));
if (atl.badgeGo[0] !== 'bh' || !atl.badgeGo[1] || atl.badgeGo[2] || !/^8 black holes not seen yet/.test(atl.badgeGo[3])) errors.push('black hole hunter does not show the black holes left: ' + JSON.stringify(atl.badgeGo));
if (atl.escTray.join() !== 'false,true' || atl.escAtlas) errors.push('Esc does not close the badge tray, then the atlas: ' + JSON.stringify([atl.escTray, atl.escAtlas]));
if (atl.reset[0] || atl.reset[1] !== '{"sort":"kind","dir":1,"cat":"all","unseen":false}') errors.push('reset: ' + JSON.stringify(atl.reset));
// saved choices keep working: 'travel' (the old spacecraft chip) opens human-made; the old "not seen yet" chip becomes all with the box ticked
// (sorted as it was); the old default ("distance, nearest first" over the headings) stays grouped; a saved flat list stays flat.
// With every black hole seen, "not seen yet" says so and its button shows them all again.
const bhKeys = await page.evaluate(() => { const c = window.__cosmos, d = c.dbg; return c.OBJ.filter(o => o.atlas !== false && !o.marker && d.GROUPS.some(([g]) => g === o.group) && d.catsOf(o).includes('bh')).map(o => o.key); });
const reload = async (saved, seen) => {
  await page.evaluate(([a, s]) => { localStorage.setItem('gcdatlas.atlas', JSON.stringify(a)); if (s) localStorage.setItem('gcdatlas.seen', JSON.stringify(s)); }, [saved, seen]);
  await page.goto('about:blank'); await page.goto(PAGE);
  await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ, null, { timeout:60000 });
  return page.evaluate(() => { const A = window.__cosmos.dbg.ATL, b = document.querySelector('#atlasCats [aria-checked="true"]');
    return [A.sort, A.dir, b ? b.dataset.cat : 'all', document.querySelector('#atlasUnseen').getAttribute('aria-checked')].join(' '); });
};
for (const [saved, want] of [[{ cat:'travel' }, 'kind 1 human false'], [{ sort:'distance', dir:1, cat:'unseen' }, 'distance 1 all true'],
  [{ sort:'distance', dir:1, cat:'all' }, 'kind 1 all false'], [{ sort:'size', dir:-1, cat:'nebulae' }, 'size -1 nebulae false'], [{ v:2, sort:'distance', dir:1, cat:'all', unseen:false }, 'distance 1 all false']]){
  const got = await reload(saved);
  if (got !== want) errors.push(`a saved atlas ${JSON.stringify(saved)} opens as "${got}", not "${want}"`);
}
await reload({ v:2, sort:'kind', dir:1, cat:'bh', unseen:true }, bhKeys);
const allSeen = await page.evaluate(() => { const $ = s => document.querySelector(s); $('#btnAtlas').click();
  const e = $('.atlas-empty'), r = { empty:!e.hidden && e.textContent, done:$('#atlasCats [data-cat="bh"]').classList.contains('done'), n:$('#atlasCats [data-cat="bh"] .n').textContent };
  e.querySelector('button').click(); r.after = [window.__cosmos.dbg.ATL.unseen, document.querySelectorAll('.arow:not([hidden])').length]; return r; });
if (allSeen.empty !== 'you have seen all 8 black holes ✓show them all' || !allSeen.done || allSeen.n !== '✓' || allSeen.after.join() !== 'false,8') errors.push('every black hole seen, with "not seen yet": ' + JSON.stringify(allSeen));
await page.evaluate(() => { localStorage.removeItem('gcdatlas.atlas'); localStorage.removeItem('gcdatlas.seen'); });
// crafted share links must not stop the page from starting (they used to: #o=constructor, a non-numeric date)
for (const h of ['#o=constructor', '#o=__proto__', '#o=earth&jd=abc&deep=x&c=1,NaN,-5']){
  await page.goto('about:blank'); await page.goto(PAGE + h);   // (a real load: changing only the hash would not restart the page)
  const ok = await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ && isFinite(window.__cosmos.cam.rel[0]) && window.__cosmos.BYKEY.earth.pos.every(isFinite), null, { timeout:60000 }).then(() => true, () => false);
  if (!ok) errors.push('share link ' + h + ' broke the page');
}
report('smoke', errors, `${keys.length} objects rendered, ${ui.rows} atlas rows · atlas controls fit at 90 to 160% menu text, room for ${atl.rows} rows at 1280 x 800 · ${atl.solar}`);
await browser.close();

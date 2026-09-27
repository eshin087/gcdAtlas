// Phone layout regression: the dock fits, the info card sits above it and can be expanded, collapsed and hidden,
// the scale chip opens the ladder, the interface fades when idle and a first tap on the sky only brings it back
// (a first tap on a faded button works), the card's green "next stop" button, the tour name and the angle arrows, and the random tour in the list of tours.
// Screenshots of every state go to tests/out/mobile/. Usage: node tests/mobile.mjs
import { openPage, report, OUT } from './lib.mjs';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.join(OUT, 'mobile'); fs.mkdirSync(dir, { recursive:true });
const { browser, page, errors } = await openPage({ phone:true, fade:true });
const shot = n => page.screenshot({ path:path.join(dir, n + '.png') });
const fail = m => errors.push('check: ' + m);
const rect = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, w:r.width, h:r.height, shown:r.height > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).opacity !== '0' }; }, sel);
const has = cls => page.evaluate(c => document.body.classList.contains(c), cls);
const wake = () => page.evaluate(() => dispatchEvent(new PointerEvent('pointermove', { pointerType:'touch', bubbles:true })));

// fading is tested on its own below; keep the interface put while the buttons are checked
const fade = v => page.evaluate(v => __cosmos.setOpt('fadeUI', v, true), v);
await fade('off');
await page.waitForTimeout(1500);
await wake();
await shot('1-start');

// the dock: every button on screen, nothing wraps or overflows
const dock = await page.evaluate(() => {
  const c = document.querySelector('.controls'), r = c.getBoundingClientRect();
  const btns = [...c.querySelectorAll('.btn')].filter(b => getComputedStyle(b).display !== 'none');
  return { top:r.top, over:c.scrollWidth - c.clientWidth, n:btns.length, off:btns.filter(b => { const q = b.getBoundingClientRect(); return q.left < 0 || q.right > innerWidth || q.top < r.top - 1; }).map(b => b.id) };
});
if (dock.over > 1 || dock.off.length) fail('dock overflows: ' + JSON.stringify(dock));
if (dock.n < 5) fail('dock has only ' + dock.n + ' buttons');
const first = await page.evaluate(() => { const b = [...document.querySelectorAll('.controls .btn')].filter(b => getComputedStyle(b).display !== 'none').sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0]; return b && b.id + ' ' + b.textContent; });
if (first !== 'btnHome home') fail('home is not the first button in the dock: ' + first);
const card = await rect('#info');
if (!card || card.bottom > dock.top + 1) fail('info card overlaps the dock: ' + JSON.stringify(card));
if (card && card.h > 200) fail('compact info card is too tall: ' + card.h + 'px');
const lad = await rect('#ladder');
if (lad && lad.shown) fail('the ladder should fold away on phones');

// more / less / hide
await page.tap('#infoMore'); await page.waitForTimeout(400); await shot('2-card-full');
const full = await rect('#info');
if (!(full.h > card.h + 40)) fail('"more" did not expand the card');
await page.tap('#infoMore'); await page.waitForTimeout(300);
await page.tap('#infoHide'); await page.waitForTimeout(400); await shot('3-card-hidden');
if (!(await has('info-hidden')) || !(await rect('#infoPill')).shown) fail('hide did not leave the pill');
await page.tap('#infoPill'); await page.waitForTimeout(300);
if (await has('info-hidden')) fail('the pill did not bring the card back');

// the scale chip opens the ladder; a tap elsewhere closes it without flying anywhere
await page.tap('#ladChip'); await page.waitForTimeout(400); await shot('4-ladder-open');
if (!(await rect('#ladder')).shown) fail('the chip did not open the ladder');
const lockBefore = await page.evaluate(() => __cosmos.orbit.lock);
await page.touchscreen.tap(60, 420); await page.waitForTimeout(400);
if (await has('lad-open')) fail('a tap outside did not close the ladder');

// the atlas opens above the dock and the object is re-framed into the space left
await page.tap('#btnAtlas'); await page.waitForTimeout(1200); await shot('5-atlas');
const atl = await rect('#atlas');
if (!atl || atl.bottom > dock.top + 1) fail('atlas overlaps the dock');
await page.tap('#atlasClose'); await page.waitForTimeout(300);

// idle: on a tour the interface fades after a few seconds; the first tap only brings it back and the tour keeps going
await page.evaluate(() => { __cosmos.startTour('grand'); });
await fade('quick'); await page.waitForTimeout(500); await wake();
await page.waitForFunction(() => document.body.classList.contains('ui-idle'), null, { timeout:15000 }).catch(() => fail('the interface did not fade on a tour'));
await page.waitForTimeout(1300); await shot('6-tour-idle');
await page.touchscreen.tap(195, 400); await page.waitForTimeout(500);
if (await has('ui-idle')) fail('a tap did not bring the interface back');
if (!(await page.evaluate(() => __cosmos.tour.on))) fail('the wake-up tap stopped the tour');
await shot('7-tour-awake');
void lockBefore;

// a wake-up tap that lands on an object's label does not fly there either
await page.waitForFunction(() => document.body.classList.contains('ui-idle'), null, { timeout:15000 }).catch(() => fail('the interface did not fade again'));
const lab = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#labels .lab:not(.star)')].find(el => { const r = el.getBoundingClientRect(); return el.classList.contains('on') && r.width > 0 && r.top > 60 && r.bottom < innerHeight - 220; });
  if (!b) return null; const r = b.getBoundingClientRect(); return { x:r.left + r.width/2, y:r.top + r.height/2, t:b.textContent };
});
if (lab){
  await page.touchscreen.tap(lab.x, lab.y); await page.waitForTimeout(600);
  if (!(await page.evaluate(() => __cosmos.tour.on))) fail(`a wake-up tap on the label "${lab.t}" flew there and stopped the tour`);
  if (await has('ui-idle')) fail('a tap on a label did not bring the interface back');
}
// a faded button works on the first tap (it used to only bring the interface back): the green "next stop" button flies on
await page.evaluate(() => { const C = __cosmos; C.land(0.1); C.hud(); });
await page.waitForFunction(() => document.body.classList.contains('ui-idle'), null, { timeout:15000 }).catch(() => fail('the interface did not fade before the button tap'));
await page.waitForTimeout(1300);   // (the fade takes a second)
const gn = await page.evaluate(() => { const C = __cosmos, b = document.querySelector('#goNext'), r = b.getBoundingClientRect(), k = C.TOUR.indexOf(C.tour.obj);
  return { x:r.left + r.width/2, y:r.top + r.height/2, txt:b.textContent, next:C.OBJ[C.TOUR[(k + 1) % C.TOUR.length]].key, op:getComputedStyle(b).opacity }; });
await page.touchscreen.tap(gn.x, gn.y); await page.waitForTimeout(400);
const gnAfter = await page.evaluate(() => ({ to:__cosmos.stepTarget, tour:__cosmos.tour.on, obj:__cosmos.OBJ[__cosmos.tour.obj].key }));
if (!/^next stop · .+›$|^start again›$/.test(gn.txt)) fail('the green button does not say where it goes: "' + gn.txt + '"');
if (gn.op !== '0') fail('the green button did not fade with the interface (opacity ' + gn.op + ')');
if (!gnAfter.tour || gnAfter.obj !== gn.next) fail(`the first tap on the faded "${gn.txt}" did not fly on to ${gn.next}: ` + JSON.stringify(gnAfter));
if (await has('ui-idle')) fail('a tap on a faded button did not bring the interface back');
await page.evaluate(() => { __cosmos.land(0.1); __cosmos.hud(); });
await shot('7a-next-stop');
await fade('off');

// the card: "stop 3 / 31" and the tour's name, which opens the list of tours; the angle arrows sit on the angle line
const cardTxt = await page.evaluate(() => { const C = __cosmos; C.hud(); const k = C.TOUR.indexOf(C.tour.obj), p = document.querySelector('#progress');
  return { stop:document.querySelector('#stopInfo').textContent, want:'stop ' + (k + 1) + ' / ' + C.TOUR.length, name:document.querySelector('#modeTour').textContent, arrows:!!p.querySelector('#prevObj') && !!p.querySelector('#nextObj') && p.classList.contains('angles') }; });
if (cardTxt.stop !== cardTxt.want) fail('the card does not say which stop this is: "' + cardTxt.stop + '"');
if (cardTxt.name !== 'grand tour ▾') fail('the tour name is not "grand tour ▾": ' + cardTxt.name);
if (!cardTxt.arrows || !(await rect('#nextObj')).shown) fail('the angle arrows are not on the angle line');
await page.tap('#modeTour'); await page.waitForTimeout(400);
if (!(await rect('#tours')).shown) fail('the tour name did not open the list of tours');
await shot('7c-tours-from-name');
await page.tap('#toursClose'); await page.waitForTimeout(300);

// the random tour: second in the list of tours from the dock, in full view; a tap closes the list and starts it ("stop 1 / 12")
// (rowInView: the whole row, or on a phone on its side at least its name (the panel is short there and scrolls), lies inside the panel
// and on screen, and nothing covers it)
const rowInView = whole => page.evaluate(whole => { const b = document.querySelectorAll('#tourList .trow')[1], r = (whole ? b : b.querySelector('b')).getBoundingClientRect(), p = document.querySelector('#tours').getBoundingClientRect();
  const e = document.elementFromPoint((r.left + r.right)/2, (r.top + r.bottom)/2);
  return { name:b.querySelector('b').textContent, shown:r.top >= p.top - 1 && r.bottom <= Math.min(p.bottom, innerHeight) + 1 && r.left >= p.left - 1 && r.right <= p.right + 1 && !!e && e.closest('.trow') === b }; }, whole);
await page.evaluate(() => __cosmos.randomSeed(1));
await page.tap('#btnTours'); await page.waitForTimeout(500); await shot('7d-tours-random');
const rrow = await rowInView(true);
if (rrow.name !== 'random tour' || !rrow.shown) fail('the random tour is not second in view in the list of tours: ' + JSON.stringify(rrow));
else {
  await page.tap('#tourList .trow:nth-child(2)'); await page.waitForTimeout(500);
  const rs = await page.evaluate(() => { const C = __cosmos; C.land(0.1); C.hud(); const i = document.querySelector('#info').getBoundingClientRect(), g = document.querySelector('#goNext').getBoundingClientRect();
    return { open:!document.querySelector('#tours').hidden, id:C.tourId, name:document.querySelector('#modeTour').textContent, stop:document.querySelector('#stopInfo').textContent, go:document.querySelector('#goNext').textContent, goIn:g.width > 0 && g.left >= i.left - 1 && g.right <= i.right + 1 }; });
  await page.waitForTimeout(300); await shot('7e-random-tour');
  if (rs.open || rs.id !== 'random' || rs.name !== 'random tour ▾' || rs.stop !== 'stop 1 / 12' || !/^next stop · .+›$/.test(rs.go) || !rs.goIn) fail('tapping the random tour did not start it: ' + JSON.stringify(rs));
}

// dragging breaks the tour (here the random tour, at its first stop): still on the same stop, the green button goes on to the next stop, and picks the tour up again
await page.evaluate(() => { __cosmos.land(0.1); });
await page.mouse.move(120, 300); await page.mouse.down(); await page.mouse.move(210, 310, { steps:8 }); await page.mouse.up();
await page.waitForTimeout(500); await page.evaluate(() => __cosmos.hud()); await shot('7b-free-camera');
if (await page.evaluate(() => __cosmos.tour.on)) fail('dragging did not break the tour');
const dg = await page.evaluate(() => { const C = __cosmos, k = C.TOUR.indexOf(C.tour.last), n = C.OBJ[C.TOUR[(k + 1) % C.TOUR.length]]; return { txt:document.querySelector('#goNext').textContent, want:k === C.TOUR.length - 1 ? 'start again›' : 'next stop · ' + (n.label || n.name) + '›', next:n.key }; });
if (!(await rect('#goNext')).shown || dg.txt !== dg.want) fail(`after breaking the tour the green button reads "${dg.txt}", not "${dg.want}"`);
else { await page.tap('#goNext'); await page.waitForTimeout(400); const r = await page.evaluate(() => ({ tour:__cosmos.tour.on, obj:__cosmos.OBJ[__cosmos.tour.obj].key })); if (!r.tour || r.obj !== dg.next) fail(`"${dg.txt}" in the card did not go on with the tour: ` + JSON.stringify(r)); }

// two fingers (real touch events): a pinch zooms exactly as far as the fingers spread and stays on the object; moving both fingers together
// slides the object on a leash (still locked on, still on screen, clear of the card); lifting one finger does not turn the gesture into an
// orbit; a double-tap on the sky and play both bring the object back to the middle; while paused the card shows the gesture hint
const cdp = await page.context().newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints:pts.map(([x, y, id]) => ({ x, y, id })) });
const cam = () => page.evaluate(() => { const C = __cosmos, p = C.proj('earth'), i = document.querySelector('#info').getBoundingClientRect();
  return { lock:C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null, distT:C.orbit.distT, yaw:C.orbit.yaw, pitch:C.orbit.pitch, leash:Math.abs(C.leash.x) + Math.abs(C.leash.y), x:p ? p.x : -1e9, y:p ? p.y : -1e9, cardTop:i.top,
    playing:!document.querySelector('#btnPlayM').classList.contains('paused'), hint:document.querySelector('#progLabel').textContent, hintShown:getComputedStyle(document.querySelector('#progress')).display !== 'none' }; });
await page.evaluate(() => { const C = __cosmos; C.setOpt('labels', false, true); C.setTour(false); C.view('earth', 0); C.tick(1/60); });
const g0 = await cam();
await touch('touchStart', [[145, 330, 0], [245, 330, 1]]);
for (let i = 1; i <= 10; i++) await touch('touchMove', [[145 - i*10, 330, 0], [245 + i*10, 330, 1]]);
await touch('touchEnd', []);
const g1 = await cam(), ratio = g0.distT/g1.distT;
if (Math.abs(ratio - 3) > 0.09) fail(`a pinch from 100 to 300 px apart zoomed x${ratio.toFixed(2)}, not x3`);
if (g1.lock !== 'earth') fail('a pinch let go of Earth');
await touch('touchStart', [[150, 300, 0], [240, 300, 1]]);
for (let i = 1; i <= 20; i++) await touch('touchMove', [[150 + i*30, 300 + i*35, 0], [240 + i*30, 300 + i*35, 1]]);
await touch('touchEnd', []);
await page.evaluate(() => { __cosmos.tick(1/60); __cosmos.hud(); });
const g2 = await cam(); await shot('10-two-finger-slide');
if (g2.lock !== 'earth') fail('a two-finger slide let go of Earth');
if (!(g2.leash > 0.1)) fail('a two-finger slide did not move Earth across the screen');
if (!(g2.x > 0 && g2.x < 390 && g2.y > 44 && g2.y < g2.cardTop)) fail(`a two-finger slide pushed Earth's centre off the free screen: ${Math.round(g2.x)}, ${Math.round(g2.y)} (card at ${Math.round(g2.cardTop)})`);
if (g2.hint !== 'drag to turn · pinch to zoom · double-tap to centre' || !g2.hintShown) fail('no gesture hint in the card while paused: "' + g2.hint + '"');
await touch('touchStart', [[150, 300, 0], [240, 300, 1]]);
await touch('touchMove', [[146, 300, 0], [244, 300, 1]]);
const g3 = await cam();
await touch('touchEnd', [[244, 300, 1]]);   // one finger lifts, the other carries on
for (let i = 1; i <= 8; i++) await touch('touchMove', [[146 + i*20, 300 + i*8, 0]]);
await touch('touchEnd', []);
const g4 = await cam();
if (Math.abs(g4.yaw - g3.yaw) + Math.abs(g4.pitch - g3.pitch) > 1e-6 || g4.distT !== g3.distT) fail('the view moved when one finger of two lifted');
// a double-tap somewhere on the sky with nothing to pick
const spot = await page.evaluate(() => { const C = __cosmos, top = document.querySelector('#info').getBoundingClientRect().top - 30, tanY = Math.tan(C.cam.fovY/2), pts = [];
  for (const o of C.OBJ){ if (o.noPick || o.marker || o.hidden) continue; const p = C.proj(o); if (!p) continue;
    const r = o.rad*(o.mag || 1)/(p.z*tanY)*innerHeight/2; if (r > innerHeight*0.8 || (o.layer < 3 && r > 60)) continue;   // (what a tap cannot pick, as in pick())
    pts.push([p.x, p.y, Math.max(r*0.8 + 20, 60)]); }
  for (let y = 90; y < top; y += 20) for (let x = 30; x < 360; x += 20) if (pts.every(([px, py, r]) => Math.hypot(x - px, y - py) > r)) return [x, y];
  return null; });
if (!spot) fail('no free patch of sky to double-tap');
else {
  await page.touchscreen.tap(spot[0], spot[1]); await page.waitForTimeout(90); await page.touchscreen.tap(spot[0] + 2, spot[1] + 1);
  await page.evaluate(() => { for (let i=0;i<150;i++) __cosmos.tick(1/60); });
  const g5 = await cam();
  if (g5.leash > 0.01 || g5.lock !== 'earth') fail('a double-tap on the sky did not bring Earth back to the middle: ' + JSON.stringify(g5));
}
await touch('touchStart', [[150, 300, 0], [240, 300, 1]]);
for (let i = 1; i <= 10; i++) await touch('touchMove', [[150 + i*12, 300 - i*8, 0], [240 + i*12, 300 - i*8, 1]]);
await touch('touchEnd', []);
// (a click, not a tap: in headless Chromium the first tap after a synthetic two-finger gesture never becomes a click, with or without this release)
await page.evaluate(() => { document.querySelector('#btnPlayM').click(); for (let i=0;i<150;i++) __cosmos.tick(1/60); });
const g6 = await cam();
if (!g6.playing || g6.leash > 0.01) fail('play did not bring Earth back to the middle: ' + JSON.stringify(g6));

// a pinch that starts on the card does not zoom the whole page (it used to, up to 5x), and one finger still scrolls the card
await page.evaluate(() => { __cosmos.setOpt('textSize', 1.6, true); const b = document.body.classList; if (b.contains('info-hidden')) document.querySelector('#infoPill').click(); if (b.contains('info-compact')) document.querySelector('#infoMore').click(); document.querySelector('#info').scrollTop = 0; });
await page.waitForTimeout(300);
const cr = await rect('#info'), cy = Math.round((cr.top + cr.bottom)/2);
await touch('touchStart', [[170, cy, 0], [220, cy + 10, 1]]);
for (let i = 1; i <= 12; i++) await touch('touchMove', [[170 - i*10, cy - i*6, 0], [220 + i*10, cy + 10 + i*6, 1]]);
await touch('touchEnd', []);
await touch('touchStart', [[195, cy + 60, 0]]);
for (let i = 1; i <= 10; i++) await touch('touchMove', [[195, cy + 60 - i*12, 0]]);
await touch('touchEnd', []);
await page.waitForTimeout(500);
const pz = await page.evaluate(() => ({ scale:visualViewport.scale, scroll:document.querySelector('#info').scrollTop, room:document.querySelector('#info').scrollHeight - document.querySelector('#info').clientHeight }));
if (pz.scale !== 1) fail('a pinch on the card zoomed the whole page x' + pz.scale);
if (pz.room > 2 && pz.scroll < 2) fail('one finger no longer scrolls the card: ' + JSON.stringify(pz));
await page.evaluate(() => { __cosmos.setOpt('textSize', 1, true); document.querySelector('#infoMore').click(); });

// home: from a tour stop far away, the home button flies to Earth and pauses the tour, and the card offers to resume it
const hmAt = await page.evaluate(() => { const C = __cosmos; C.startTour('grand'); C.land(0.1); C.tourGo(C.BYKEY.crab.index, true); C.tick(1/60); return C.flight ? 'flying' : C.OBJ[C.orbit.lock].key; });
await page.evaluate(() => document.querySelector('#btnHome').click());
const hm = await page.evaluate(at => { const C = __cosmos; const r = { at, tour:C.tour.on, to:C.stepTarget }; C.land(0.3); r.lock = C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null; return r; }, hmAt);
await page.waitForTimeout(400); await shot('11-home');
if (hm.at !== 'crab' || hm.tour || hm.to !== 'earth' || hm.lock !== 'earth') fail('home did not fly to Earth and pause the tour: ' + JSON.stringify(hm));
const hmBtn = await page.evaluate(() => { __cosmos.hud(); const b = document.querySelector('#goNext'); return { txt:b.textContent, back:b.classList.contains('back'), stop:document.querySelector('#stopInfo').textContent }; });
if (!(await rect('#goNext')).shown || hmBtn.txt !== 'back to the tour · Crab Nebula›' || !hmBtn.back) fail('no "back to the tour · Crab Nebula" in the card after going home: ' + JSON.stringify(hmBtn));
if (hmBtn.stop !== 'rocky planet') fail('off the tour the card does not say what Earth is: "' + hmBtn.stop + '"');
await page.evaluate(() => __cosmos.setOpt('labels', true, true));

// on its side
await page.setViewportSize({ width:844, height:390 });
await page.waitForTimeout(1200); await wake(); await shot('8-landscape');
const ld = await page.evaluate(() => { const c = document.querySelector('.controls'), i = document.querySelector('#info'); const a = c.getBoundingClientRect(), b = i.getBoundingClientRect(); return { over:c.scrollWidth - c.clientWidth, dockTop:a.top, cardBottom:b.bottom, cardRight:b.right }; });
if (ld.over > 1) fail('landscape dock overflows');
if (ld.cardBottom > ld.dockTop + 1) fail('landscape card overlaps the dock');
// the green button and the angle arrows stay inside the card, however long the name
const inCard = await page.evaluate(() => { const i = document.querySelector('#info').getBoundingClientRect(), out = [];
  for (const id of ['#goNext', '#prevObj', '#nextObj', '#modeTour', '#infoHide']){ const e = document.querySelector(id), r = e.getBoundingClientRect(); if (r.width && (r.left < i.left - 1 || r.right > i.right + 1)) out.push(id); }
  return out; });
if (inCard.length) fail('on its side these stick out of the card: ' + inCard.join(', '));
// (by clicks: the first tap after the synthetic two-finger gestures above never becomes a click, see the play button)
await page.evaluate(() => document.querySelector('#btnTours').click()); await page.waitForTimeout(500); await shot('8b-landscape-tours');
const lrow = await rowInView(false);
if (lrow.name !== 'random tour' || !lrow.shown) fail('on its side the random tour is not in view in the list of tours: ' + JSON.stringify(lrow));
await page.evaluate(() => document.querySelector('#toursClose').click()); await page.waitForTimeout(300);
await page.tap('#btnAtlas'); await page.waitForTimeout(800); await shot('9-landscape-atlas');
// on its side the card sits beside the object: a two-finger slide toward it stops with the object's centre on screen and off the card
await page.evaluate(() => { document.querySelector('#atlasClose').click(); const C = __cosmos; C.setTour(false); C.view('earth', 0); C.tick(1/60); });
await page.waitForTimeout(800);
await touch('touchStart', [[500, 200, 0], [590, 200, 1]]);
for (let i = 1; i <= 15; i++) await touch('touchMove', [[500 - i*40, 200 + i*30, 0], [590 - i*40, 200 + i*30, 1]]);
await touch('touchEnd', []);
const ls = await page.evaluate(() => { const C = __cosmos; C.tick(1/60); const p = C.proj('earth'), b = document.querySelector('#info').getBoundingClientRect();
  return { lock:C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null, x:Math.round(p.x), y:Math.round(p.y), card:[b.left, b.top, b.right, b.bottom].map(Math.round) }; });
await shot('12-landscape-slide');
if (ls.lock !== 'earth' || !(ls.x > 0 && ls.x < 844 && ls.y > 0 && ls.y < 390) || (ls.x > ls.card[0] + 1 && ls.x < ls.card[2] - 1 && ls.y > ls.card[1] + 1 && ls.y < ls.card[3] - 1))
  fail('on its side a two-finger slide put Earth off screen or under the card: ' + JSON.stringify(ls));

report('mobile', errors, 'screenshots in tests/out/mobile' + (lab ? ` · wake-up tap on "${lab.t}" checked` : '') + ` · pinch x${ratio.toFixed(2)} for fingers 3x apart · two-finger slide stays locked, Earth at ${Math.round(g2.x)}, ${Math.round(g2.y)} · home first in the dock · first tap on the faded "${gn.txt}" flew on to ${gn.next}`);
await browser.close();

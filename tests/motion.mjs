// Camera motion regression: the angle loop after picking an object, play / pause (button and space), flights that land
// exactly on a moving destination (no jump on arrival), ladder picks that keep moving, riding along with the Halo, tour trips without zoom dips,
// the Halo at work (always travelling, light speed and folds, its jobs, scan beams on the surface), and the controls that say where they go
// (next stop, angle arrows that count every tap, Esc closing panels first, the tour's angles at Earth), and the random tour. Deterministic: steps the simulation with __cosmos.tick.
// Usage: node tests/motion.mjs
import { openPage, report } from './lib.mjs';

const { browser, page, errors } = await openPage({ width:1200, height:750 });
const fail = m => errors.push('check: ' + m);

// 1. picking an object flies there, then loops through its tour angles
const loop = await page.evaluate(() => {
  const C = __cosmos, sat = C.BYKEY.saturn; C.setTour(false);
  C.lockOn(sat.index);
  C.land(0.2);
  const afterFlight = { lock:C.orbit.lock === sat.index, playing:!document.getElementById('btnPlay').classList.contains('paused') };
  const yaw0 = C.orbit.yaw;
  for (let i=0;i<60*40;i++) C.tick(1/60);   // long enough to swing to another angle
  return { afterFlight, moved:Math.abs(C.orbit.yaw - yaw0) > 0.05, views:sat.views.length };
});
if (!loop.afterFlight.lock) fail('lock-on did not land on Saturn');
if (!loop.afterFlight.playing) fail('the angle loop did not start after landing');
if (!loop.moved) fail('the camera did not move through the angles');

// 2. pause and play: the button and the space bar
const pp = await page.evaluate(() => {
  const C = __cosmos, st = () => ({ paused:document.getElementById('btnPlay').classList.contains('paused'), yaw:C.orbit.yaw, tour:C.tour.on });
  document.getElementById('btnPlay').click(); C.tick(1/60); const a = st();
  for (let i=0;i<60*5;i++) C.tick(1/60); const b = st();
  document.getElementById('btnPlay').click(); for (let i=0;i<60*3;i++) C.tick(1/60); const c = st();
  dispatchEvent(new KeyboardEvent('keydown', { key:' ', bubbles:true })); C.tick(1/60); const d = st();
  return { a, b, c, d };
});
if (!pp.a.paused) fail('pause did not pause');
if (Math.abs(pp.b.yaw - pp.a.yaw) > 1e-6) fail('the camera kept moving while paused');
if (pp.c.paused) fail('play did not resume the loop');
if (!pp.d.paused) fail('space did not pause');

// 3. from the edge of the observable universe to Earth: Earth grows smoothly and the flight lands exactly on the final framing
const fl = await page.evaluate(() => {
  const C = __cosmos, e = C.BYKEY.earth; C.setTour(false);
  C.view('universe', 0); C.tick(1/60);
  C.lockOn(e.index);
  const dur = C.flightDur(), tanY = Math.tan(C.cam.fovY/2), px = () => e.rad/e.dist/tanY*innerHeight/2;
  let prev = px(), worst = 1, t = 0;
  while ((C.flight || t < dur) && t < 200){ C.tick(1/60); t += 1/60; const p = px(); if (prev > 20) worst = Math.max(worst, p/prev, prev/p); prev = p; }
  return { worstFrameToFrameScale:+worst.toFixed(3), lock:C.orbit.lock === e.index };
});
if (!fl.lock) fail('the flight did not land on Earth');
if (fl.worstFrameToFrameScale > 1.12) fail('Earth jumped in size between two frames (x' + fl.worstFrameToFrameScale + ')');

// 4. a scale picked on the ladder keeps the camera moving on arrival (a slow circle), and shared links start playing too
const lad = await page.evaluate(() => {
  const C = __cosmos, m = C.LADDER.find(m => m.key === 'jupiter') || C.LADDER[0];
  C.goLadder(m); C.land(0.2);
  const y0 = C.orbit.yaw; for (let i=0;i<120;i++) C.tick(1/60);
  return { name:m.name, show:C.show.on, playing:!document.getElementById('btnPlay').classList.contains('paused'), moved:Math.abs(C.orbit.yaw - y0) > 1e-3 };
});
if (!lad.show || !lad.playing || !lad.moved) fail('a ladder pick arrived paused: ' + JSON.stringify(lad));

// 5. the Halo: its indicator is off until the ship button is pressed; riding along lands behind it, stays with it through a fold and a
// light-speed jump, and a drag lets go
const ride = await page.evaluate(() => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, vis = () => !document.getElementById('shipMark').hidden || !document.getElementById('shipArrow').hidden;
  const r = { markOff:!vis() };
  document.getElementById('btnShip').click(); C.tick(1/60); C.hud(); r.markOn = C.SET.haloMark;
  document.getElementById('btnShip').click();
  C.startShipCam('chase'); C.land(0.3);
  r.riding = C.shipCam.on; r.dist = Math.hypot(...h.rel)/h.rad;
  // the next hop is a fold, the one after it a light-speed jump; the camera must stay on the ship all the way
  let i = 0; while (h.S.phase !== 'pass' && i++ < 60*30) C.tick(1/60);
  D.force({ travel:'fold' }); D.replan();
  const k0 = h.S.target.key; let far = 0, farLs = 0, legs = 0; i = 0;
  while (h.S.target.key === k0 && i < 60*60){ C.tick(1/60); i++; }
  for (let j=0;j<60;j++){ C.tick(1/60); far = Math.max(far, Math.hypot(...h.rel)/h.rad); }
  r.folded = h.S.target.key !== k0; r.farAfterFold = +far.toFixed(2); r.stillRiding = C.shipCam.on;
  i = 0; while (h.S.phase !== 'pass' && i++ < 60*30) C.tick(1/60);
  D.force({ travel:'light' }); D.replan();
  const k1 = h.S.target.key; i = 0;
  while ((h.S.target.key === k1 || h.S.phase !== 'pass') && i < 60*70){ C.tick(1/60); i++; if (h.S.phase === 'light') legs++; farLs = Math.max(farLs, Math.hypot(...h.rel)/h.rad); }
  r.jumped = h.S.target.key !== k1 && legs > 60; r.farInLightSpeed = +farLs.toFixed(2); r.ridingAfterJump = C.shipCam.on;
  C.setShipCamMode('cockpit'); for (let j=0;j<60;j++) C.tick(1/60); r.cockpit = Math.hypot(...h.rel)/h.rad < 1;
  C.togglePlay(); r.paused = !C.shipCam.on; C.togglePlay(); r.resumed = C.shipCam.on;
  C.setShipCamMode('chase'); C.stopShipCam();
  return r;
});
if (!ride.markOff) fail('the Halo indicator shows before the ship button is pressed');
if (!ride.markOn) fail('the ship button did not switch the Halo indicator on');
if (!ride.riding || ride.dist > 6) fail('riding along did not land behind the ship: ' + JSON.stringify(ride));
if (!ride.folded || !ride.stillRiding || ride.farAfterFold > 6) fail('the camera lost the ship when it folded space: ' + JSON.stringify(ride));
if (!ride.jumped || !ride.ridingAfterJump || ride.farInLightSpeed > 6) fail('the camera lost the ship at light speed: ' + JSON.stringify(ride));
if (!ride.cockpit) fail('the cockpit view is not on the ship');
if (!ride.paused || !ride.resumed) fail('pause / play did not stop and resume riding along');

// 6. arrows: from the Moon, "next" goes up the scale bar to Earth; the arrows beside the name step angles and the loop carries on;
//    changing the travel speed mid-flight re-times the rest of the trip
const nav = await page.evaluate(() => {
  const C = __cosmos, land = () => { C.land(0.3); };
  C.setTour(false); C.lockOn(C.BYKEY.moon.index); land();
  C.stepObject(1); const next = C.stepTarget; land();
  C.stepObject(1); const next2 = C.stepTarget; land();
  const v0 = C.show.view; document.getElementById('nextObj').click(); for (let i=0;i<60*4;i++) C.tick(1/60);
  const angle = { from:v0, to:C.show.view, looping:C.show.on };
  // fast taps while the camera is still swinging: each one counts (three taps, three angles on), and the angle line shows where it is going
  const v1 = C.show.view, nv = C.OBJ[C.orbit.lock].views.length, b = document.getElementById('nextObj');
  b.click(); for (let i=0;i<6;i++) C.tick(1/60); b.click(); for (let i=0;i<6;i++) C.tick(1/60); b.click(); C.hud();
  angle.fast = { want:(v1 + 3) % nv, label:document.getElementById('progLabel').textContent }; for (let i=0;i<60*4;i++) C.tick(1/60); angle.fast.got = C.show.view;
  angle.fast.arrowsOnLine = document.getElementById('progress').contains(b) && document.getElementById('progress').classList.contains('angles');
  C.setOpt('travel', 'cinematic', true); C.lockOn(C.BYKEY.sun.index); for (let i=0;i<30;i++) C.tick(1/60);
  const slow = C.flightDur(); C.setOpt('travel', 'warp', true); const fast = C.flightDur(); C.setOpt('travel', 'quick', true); land();
  return { next, next2, angle, slow:+slow.toFixed(2), fast:+fast.toFixed(2) };
});
if (nav.next !== 'earth' || nav.next2 !== 'jupiter') fail('next did not follow the scale bar from the Moon: ' + JSON.stringify(nav));
if (nav.angle.to === nav.angle.from || !nav.angle.looping) fail('the angle arrows did not step the loop: ' + JSON.stringify(nav.angle));
if (nav.angle.fast.got !== nav.angle.fast.want || !nav.angle.fast.label.startsWith(`angle ${nav.angle.fast.want + 1}/`) || !nav.angle.fast.arrowsOnLine) fail('three fast taps on the angle arrow did not move three angles: ' + JSON.stringify(nav.angle.fast));
if (!(nav.fast < nav.slow)) fail('changing the speed mid-flight did not re-time it: ' + JSON.stringify(nav));

// 7. every grand tour trip is one smooth flight: the zoom never dips and comes back out on the way (that read as locking on to
// something in the way), and the camera never flies through an object that is not one end of the trip (or around it)
const trips = await page.evaluate(() => {
  const C = __cosmos, T = C.TOUR, bad = []; let passes = 0;
  C.setOpt('travel', 'cinematic', true);
  for (let i=0;i<T.length - 1;i++){
    const a = C.OBJ[T[i]], b = C.OBJ[T[i + 1]];
    C.tourGo(T[i], true); C.tick(1/30); C.tourGo(T[i + 1]);
    if (C.via) passes++;
    const ws = [], inside = new Set(); let n = 0;
    const around = o => [a, b].some(e => Math.hypot(o.pos[0] - e.pos[0], o.pos[1] - e.pos[1], o.pos[2] - e.pos[2]) < o.rad);
    while (C.stepTarget && n++ < 3000){
      C.tick(1/30); ws.push(C.orbit.dist);
      for (const o of C.OBJ) if (o !== a && o !== b && !o.parent && o.prog && o.layer >= 2 && !o.marker && o.dist < o.rad && !around(o)) inside.add(o.key);
    }
    let dips = 0; for (let j=2;j<ws.length - 2;j++) if (ws[j] < ws[j - 1]*0.999 && ws[j] < ws[j + 1]*0.999 && ws[j] < ws[j - 2] && ws[j] < ws[j + 2]) dips++;
    if (dips || inside.size) bad.push(`${a.key} -> ${b.key}: ${dips} zoom dips, inside ${[...inside].join(',') || '-'}`);
  }
  C.setOpt('travel', 'quick', true);
  return { n:T.length - 1, bad, passes };
});
if (trips.bad.length) fail('tour trips that dip or fly through something: ' + trips.bad.join('; '));

// 8. the Halo at work: it is always travelling (never stopped, never turning on the spot, never circling), it travels both by light
// speed and by folds, it does different jobs, scan beams end exactly where they first meet the surface, and a weapons test leaves nothing behind
const halo = await page.evaluate(() => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, S = h.S, dt = 1/30;
  C.setTour(false); if (C.shipCam.on) C.stopShipCam(); C.view('earth', 0);
  const r = { modes:{}, acts:{}, minTurnRadius:1e9, maxTurn20s:0, stopped:0, steps:0 };
  const head = () => [h.R0[3], h.R0[4], h.R0[5]];
  let H0 = head(), P0 = h.pos.slice(), ph0 = S.phase, win = [];
  D.force({ travel:'light' });   // (the next hop by light speed and a later one by a fold, whatever the dice say)
  for (let i=0;i<30*420;i++){
    if (i === 30*150) D.force({ travel:'fold' });
    C.tick(dt);
    const H = head(), ph = S.phase, same = ph === ph0 && !(ph0 === 'fold' || ph === 'fold');
    r.modes[ph] = 1; if (D.act) r.acts[D.act] = 1;
    const ang = Math.acos(Math.min(1, Math.max(-1, H[0]*H0[0] + H[1]*H0[1] + H[2]*H0[2]))), mv = Math.hypot(h.pos[0] - P0[0], h.pos[1] - P0[1], h.pos[2] - P0[2])/h.rad;
    if (same){ r.steps++; if (!(mv > 0)) r.stopped++; if (ang > 1e-4) r.minTurnRadius = Math.min(r.minTurnRadius, mv/ang); }
    win.push(same ? ang : 0); if (win.length > 20*30) win.shift();
    r.maxTurn20s = Math.max(r.maxTurn20s, win.reduce((a, b) => a + b, 0)*57.3);
    H0 = H; P0 = h.pos.slice(); ph0 = ph;
  }
  r.minTurnRadius = +r.minTurnRadius.toFixed(0); r.maxTurn20s = +r.maxTurn20s.toFixed(0);
  // scan beams on Jupiter, seen from a camera locked on the ship: every beam ends on the drawn surface, at the first point its line meets it
  let n = 0; while (S.phase !== 'pass' && n++ < 30*40) C.tick(dt);
  if (S.target.key === 'jupiter'){ D.force({ target:'saturn', act:'scan', travel:'fold' }); D.replan(); D.skip(); n = 0; while (!(S.phase === 'pass' && S.target.key === 'saturn') && n++ < 30*60) C.tick(dt); }
  D.force({ target:'jupiter', act:'scan', travel:'fold' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'jupiter') && n++ < 30*60) C.tick(dt);
  C.view('halo', 0);
  let beams = 0, worst = 0;
  for (const tau of [1.2, 2.5, 4.3, 6, 8.1, 9.5]){
    n = 0; while (D.tau < tau && n++ < 30*60) C.tick(dt);
    C.render();
    for (const b of D.beams){
      beams++;
      const d = b.end.map((x, k) => x - b.E[k]), L = Math.hypot(...d), u = d.map(x => x/L), oc = b.E.map((x, k) => x - b.C[k]);
      const bb = oc[0]*u[0] + oc[1]*u[1] + oc[2]*u[2], hh = bb*bb - (oc[0]*oc[0] + oc[1]*oc[1] + oc[2]*oc[2]) + b.R*b.R, t = -bb - Math.sqrt(Math.max(hh, 0));
      const onSurface = Math.abs(Math.hypot(...b.end.map((x, k) => x - b.C[k]))/b.R - 1), firstHit = hh >= 0 ? Math.abs(t - L)/b.R : 1;
      worst = Math.max(worst, onSurface, firstHit);
    }
  }
  r.beams = beams; r.beamWorst = worst;
  // a weapons test: blasts happen, and some seconds after the job every trace of them is gone
  // (only what the job made counts: the streak the ship leaves when it jumps away from the Moon later is also tied to the Moon)
  D.force({ target:'moon', act:'weapons', travel:'light' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'moon') && n++ < 30*60) C.tick(dt);
  const made = new Set(); let blasts = 0; n = 0; while (D.act === 'weapons' && n++ < 30*40){ C.tick(dt); const b = D.FX.filter(e => e.anc === C.BYKEY.moon); b.forEach(e => made.add(e)); blasts = Math.max(blasts, b.length); }
  for (let i=0;i<30*6;i++) C.tick(dt);
  r.blasts = blasts; r.leftAfter = D.FX.filter(e => made.has(e)).length;
  return r;
});
if (halo.stopped) fail('the Halo stood still for ' + halo.stopped + ' steps');
if (halo.minTurnRadius < 20) fail('the Halo turned on the spot (turn radius ' + halo.minTurnRadius + ' ship lengths)');
if (halo.maxTurn20s > 300) fail('the Halo turned ' + halo.maxTurn20s + ' degrees within 20 s (circling)');
if (!halo.modes.light || !halo.modes.fold) fail('the Halo did not use both light speed and folds: ' + JSON.stringify(halo.modes));
if (Object.keys(halo.acts).length < 4) fail('the Halo did fewer than 4 kinds of job: ' + JSON.stringify(halo.acts));
if (halo.beams < 20 || halo.beamWorst > 1e-3) fail('scan beams do not end on the surface: ' + JSON.stringify({ beams:halo.beams, worst:halo.beamWorst }));
if (!halo.blasts || halo.leftAfter) fail('the weapons test did not blast, or left something behind: ' + JSON.stringify({ blasts:halo.blasts, left:halo.leftAfter }));

// 9. staying with it: H goes home to Earth's opening view and pauses a running tour ("resume tour" stays); a camera that lets go of
// Earth keeps moving with it (the Solar System clock does not carry it away) and says so; play and the "back to" pill fly back;
// letting go of Jupiter does not blow it up around the camera (the overview still enlarges it); W A S D stays within reach of something
const stay = await page.evaluate(() => {
  const C = __cosmos, E = C.BYKEY.earth, J = C.BYKEY.jupiter, cam = C.cam, r = {}, key = (k, type = 'keydown') => dispatchEvent(new KeyboardEvent(type, { key:k, bubbles:true }));
  const txt = s => document.querySelector(s).textContent, off = o => { const v = o.rel, l = Math.hypot(...v); return Math.acos(Math.min(1, (v[0]*cam.fwd[0] + v[1]*cam.fwd[1] + v[2]*cam.fwd[2])/l))*180/Math.PI; };
  C.startTour('grand'); C.land(0.1); C.tourGo(C.BYKEY.crab.index, true); C.tick(1/60);   // (really at the Crab: the flight to the first stop has landed)
  const at = C.flight ? 'flying' : C.OBJ[C.orbit.lock].key;
  key('h'); r.home = { at, tour:C.tour.on, last:C.tour.last != null ? C.OBJ[C.tour.last].key : null, to:C.stepTarget };
  C.land(0.3); C.hud(); r.home.lock = C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null; r.home.view = C.show.view; r.home.resume = !document.getElementById('goNext').hidden && document.getElementById('goNext').textContent === 'back to the tour · Crab Nebula›';
  C.setTour(false); C.view('earth', 0); C.hud(); r.here = txt('#objDist');
  key('Escape'); for (let i=0;i<60*5;i++) C.tick(1/60); C.hud();
  r.drift = { off:+off(E).toFixed(2), focus:C.OBJ[cam.focus].key, free:C.orbit.lock < 0, where:txt('#objDist'), play:document.getElementById('btnPlay').getAttribute('aria-label') };
  key(' '); r.back = C.stepTarget; C.land(0.3); r.backLock = C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null;
  C.unlock(); C.orbit.target = C.orbit.target.map((v, i) => v + cam.right[i]*E.rad*12); for (let i=0;i<60;i++){ C.tick(1/60); C.hud(); }
  const pill = document.getElementById('backPill'); r.pill = pill.hidden ? null : pill.textContent; pill.click(); r.pillTo = C.stepTarget; C.land(0.3);
  C.view('jupiter', 0); for (let i=0;i<60;i++) C.tick(1/60); C.unlock(); for (let i=0;i<60*5;i++) C.tick(1/60); r.jupiterFree = +(J.mag || 1).toFixed(2);
  C.view('solarsystem', 0); C.unlock(); for (let i=0;i<60*5;i++) C.tick(1/60); r.overviewFree = +(J.mag || 1).toFixed(1);
  C.view('earth', 0); C.unlock(); for (let i=0;i<30;i++) C.tick(1/60);
  key('s'); let worst = 0; for (let i=0;i<60*30;i++){ C.tick(1/60); let g = Infinity; for (const o of C.OBJ) if (o.layer >= 2 && !o.noPick && !o.marker && !o.hidden && o.key !== 'halo' && o.dist > o.rad) g = Math.min(g, o.dist - o.rad*(o.solid || 1)); worst = Math.max(worst, g/C.orbit.dist); }
  key('s', 'keyup'); r.reach = +worst.toFixed(2);
  return r;
});
if (stay.home.at !== 'crab' || stay.home.tour || stay.home.last !== 'crab' || stay.home.to !== 'earth' || stay.home.lock !== 'earth' || stay.home.view !== 0 || !stay.home.resume) fail('H did not fly home to Earth and pause the tour: ' + JSON.stringify(stay.home));
if (stay.here !== 'you are here') fail('Earth\'s card does not say "you are here": ' + stay.here);
if (!(stay.drift.off <= 2) || stay.drift.focus !== 'earth' || !stay.drift.free) fail('the free camera did not keep moving with Earth: ' + JSON.stringify(stay.drift));
if (stay.drift.where !== 'free camera · H for home') fail('the card still says "' + stay.drift.where + '" in free camera');
if (stay.drift.play !== 'Back to Earth (space)' || stay.back !== 'earth' || stay.backLock !== 'earth') fail('play in free camera did not fly back to Earth: ' + JSON.stringify(stay));
if (!stay.pill || !/^.back to Earth · [\d,]+ km$/.test(stay.pill) || stay.pillTo !== 'earth') fail('no "back to Earth" pill, or it did not fly back: ' + JSON.stringify({ pill:stay.pill, to:stay.pillTo }));
if (stay.jupiterFree > 1.5) fail('Jupiter swelled x' + stay.jupiterFree + ' around a camera that had just let go of it');
if (!(stay.overviewFree > 5)) fail('the Solar System overview no longer enlarges Jupiter in free camera (x' + stay.overviewFree + ')');
if (stay.reach > 8.2) fail('W A S D took the camera ' + stay.reach + ' view distances from anything');

// 10. saying where it goes: the green button beside the name ("next stop · Moon", "start again" on the last stop, "back to the tour" after
// leaving it, hidden with no tour); the tour's name opens the tours; the ‹ › around "tours" and the second resume button are gone;
// [ ] step tour stops on a tour; Esc closes an open panel or the search before it lets go; the scale bar hides while the atlas is open,
// and a pick empties the search box; on the tour Earth plays three angles, about 30 s
const say = await page.evaluate(() => {
  const C = __cosmos, g = document.getElementById('goNext'), key = k => dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true })), r = {};
  const btn = () => g.hidden ? null : g.textContent, lock = () => C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null;
  C.startTour('grand'); C.land(0.1); C.hud(); r.first = btn(); r.stop = document.getElementById('stopInfo').textContent;
  g.click(); r.clickTo = C.stepTarget; C.land(0.1);
  key(']'); r.keyNext = C.stepTarget; C.land(0.1); key('['); r.keyPrev = C.stepTarget; C.land(0.1);
  C.tourGo(C.TOUR[C.TOUR.length - 1], true); C.tick(1/60); C.hud(); r.last = btn(); g.click(); r.againTo = C.stepTarget; C.land(0.1);
  C.lockOn(C.BYKEY.mars.index); C.land(0.1); C.hud(); r.left = btn(); r.leftBack = g.classList.contains('back'); g.click(); r.backTo = C.stepTarget; r.backTour = C.tour.on; C.land(0.1);
  C.setTour(false); C.tour.last = null; C.lockOn(C.BYKEY.mars.index); C.land(0.1); C.hud(); r.none = btn();
  r.gone = ['tourPrev', 'tourNext', 'btnResume', 'btnResumeI'].filter(id => document.getElementById(id));
  document.getElementById('btnSettings').click(); key('Escape'); r.escSettings = { open:!document.getElementById('settings').hidden, lock:lock() };
  // (also with the focus on one of its sliders)
  document.getElementById('btnSettings').click(); const ts = document.getElementById('textSize'); ts.focus(); ts.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  r.escSlider = { open:!document.getElementById('settings').hidden, lock:lock() };
  document.getElementById('btnAtlas').click(); r.ladderInAtlas = getComputedStyle(document.getElementById('ladder')).display; key('Escape'); r.escAtlas = { open:!document.getElementById('atlas').hidden, lock:lock() };
  const s = document.getElementById('search'); s.focus(); s.value = 'jupiter'; s.dispatchEvent(new Event('input', { bubbles:true }));
  s.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); r.pick = { to:C.stepTarget, box:s.value, box2:document.getElementById('atlasSearch').value }; C.land(0.1);
  s.focus(); s.value = 'sat'; s.dispatchEvent(new Event('input', { bubbles:true })); s.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  r.escSearch = { atlas:!document.getElementById('atlas').hidden, box:s.value, lock:lock() };
  key('Escape'); r.escNothing = lock();
  // Earth on the tour: three angles, about 30 s (it was five, a minute)
  C.setOpt('travel', 'cinematic', true); C.startTour('grand'); C.land(0.1); C.tourGo(C.BYKEY.earth.index, true);
  let t = 0; const seen = []; while (C.tour.obj === C.BYKEY.earth.index && t < 120){ C.tick(1/30); t += 1/30; if (C.tour.obj === C.BYKEY.earth.index && seen[seen.length - 1] !== C.tour.view) seen.push(C.tour.view); }
  r.earth = { t:+t.toFixed(1), views:seen }; C.setOpt('travel', 'quick', true); C.setTour(false);
  return r;
});
if (say.first !== 'next stop · Moon›' || say.stop !== 'stop 1 / 31' || say.clickTo !== 'moon') fail('the green button on the tour: ' + JSON.stringify(say));
if (say.keyNext !== 'sun' || say.keyPrev !== 'moon') fail('[ ] did not step the tour stops: ' + JSON.stringify({ next:say.keyNext, prev:say.keyPrev }));
if (say.last !== 'start again›' || say.againTo !== 'earth') fail('the last stop does not offer "start again": ' + JSON.stringify({ last:say.last, to:say.againTo }));
if (say.left !== 'back to the tour · Earth›' || !say.leftBack || say.backTo !== 'earth' || !say.backTour) fail('leaving the tour does not offer the way back: ' + JSON.stringify({ left:say.left, to:say.backTo, tour:say.backTour }));
if (say.none !== null) fail('the green button shows with no tour involved: ' + say.none);
if (say.gone.length) fail('these should be gone: ' + say.gone.join(', '));
if (say.escSettings.open || say.escSettings.lock !== 'mars') fail('Esc did not close settings first: ' + JSON.stringify(say.escSettings));
if (say.escSlider.open || say.escSlider.lock !== 'mars') fail('Esc on a settings slider did not close settings (or let go): ' + JSON.stringify(say.escSlider));
if (say.ladderInAtlas !== 'none') fail('the scale bar shows while the atlas is open');
if (say.escAtlas.open || say.escAtlas.lock !== 'mars') fail('Esc did not close the atlas first: ' + JSON.stringify(say.escAtlas));
if (say.pick.to !== 'jupiter' || say.pick.box || say.pick.box2) fail('a pick from the search did not empty the box: ' + JSON.stringify(say.pick));
if (say.escSearch.atlas || say.escSearch.box || !say.escSearch.lock) fail('Esc in the search did not close it (or let go): ' + JSON.stringify(say.escSearch));
if (say.escNothing !== null) fail('Esc with nothing open did not let go of the object');
if (say.earth.views.join() !== '0,2,1' || say.earth.t < 26 || say.earth.t > 36) fail('the tour does not play three Earth angles in about 30 s: ' + JSON.stringify(say.earth));

// 11. the random tour (second in the list of tours): 12 places from the whole atlas, a new mix on every start. No place twice (a place and
// what belongs to it count as one), never the Halo, at most 3 of one kind, never where it sets off from, and the first stop is not even the
// same place (from Earth the Moon may come later, not first); places not seen yet come first (a seen place only when no unseen one could
// be dealt, or when every trip to one would be much rougher than to a seen place); with only 6 places left unseen the trips stay smooth;
// the tour track on the scale bar shows each new deal's names; on the last stop the green button (also when paused there), ] and the end
// of the last angle deal 12 new places from there, none of the 12 just played (dealt ahead while that stop plays or waits paused); with the
// list of tours open a first random tour is dealt ahead too; a shared link starts a new random tour at the linked place (a link to 'your
// sky' opens the sky); the same seed deals the same tour (visitors get their seed from Math.random); and the tour played as a visitor
// sees it (every angle, then the trip into the next deal) never dips or flies through a third object.
// (Deterministic: the page is frozen, so no live frame marks places seen between the steps; it starts with nothing seen, whatever the
// sections above did, and with the Solar System clock on a fixed date, so the planets stand in the same places on any day. What it has
// seen and the clock are put back at the end)
const rt = await page.evaluate(() => {
  const C = __cosmos, g = document.getElementById('goNext'), key = k => dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true })), r = {};
  window.__freeze = true; const wasSeen = [...C.SEEN]; C.SEEN.clear();
  location.hash = '#o=earth&jd=2461310.5'; C.applyHash(); history.replaceState(null, '', location.pathname);   // (2026-09-27 0:00 UTC)
  const keys = () => C.TOUR.map(i => C.OBJ[i].key), btn = () => g.hidden ? null : g.textContent, catOf = o => (o.isBH || o.prog === C.BYKEY.sgra.prog) ? 'bh' : o.group;
  const overlap = T => C.TOUR.filter(i => T.includes(i)).length;
  const check = (T, from) => { const os = T.map(i => C.OBJ[i]), bad = [], per = {};
    if (T.length !== 12 || new Set(T).size !== 12) bad.push(T.length + ' stops');
    os.forEach((o, i) => { if (!C.tourable(o)) bad.push(o.key + ' may not be toured'); if (from && (o === from || (i === 0 && C.samePlace(from, o)))) bad.push(o.key + ' is where it set off'); per[catOf(o)] = (per[catOf(o)] || 0) + 1; });
    os.forEach((a, i) => os.slice(i + 1).forEach(b => { if (C.samePlace(a, b)) bad.push(a.key + ' and ' + b.key + ' are one place'); }));
    for (const c in per) if (per[c] > 3) bad.push(per[c] + ' stops of ' + c);
    return bad; };
  C.setOpt('dwell', 'normal', true); C.setTour(false); C.randomSeed(1); C.lockOn(C.BYKEY.earth.index); C.land(0.1);
  const row = document.querySelectorAll('#tourList .trow')[1]; row.click(); C.hud();
  r.first = { id:C.tourId, n:C.TOUR.length, bad:check(C.TOUR, C.BYKEY.earth), halo:keys().includes('halo'), row:row.querySelector('b').textContent, current:row.getAttribute('aria-current'),
    head:document.getElementById('modeTourName').textContent, stop:document.getElementById('stopInfo').textContent, to:C.stepTarget, want:keys()[0] };
  const T1 = C.TOUR.slice(); C.land(0.1);
  C.startTour('random'); C.hud();
  r.second = { overlap:overlap(T1), bad:check(C.TOUR, C.OBJ[T1[0]]), track:[...document.querySelectorAll('.tour-track .tt')].map(b => b.textContent).join('|'), names:C.TOUR.map(i => C.OBJ[i].label || C.OBJ[i].name).join('|') };
  C.land(0.1);
  const T2 = C.TOUR.slice(), gen = C.tourGen; C.tourGo(T2[11], true); C.tick(1/60); C.hud();
  r.last = { btn:btn(), title:g.title }; g.click();
  r.deal = { on:C.tour.on, gen:C.tourGen > gen, overlap:overlap(T2), to:C.stepTarget, first:keys()[0], bad:check(C.TOUR, C.OBJ[T2[11]]) }; C.land(0.1);
  const T3 = C.TOUR.slice(); C.tourGo(T3[11], true); C.tick(1/60); key(']');
  r.key = { overlap:overlap(T3), to:C.stepTarget, first:keys()[0] }; C.land(0.1);
  // (paused there, the next 12 are dealt ahead too)
  const T4 = C.TOUR.slice(); C.tourGo(T4[11], true); C.tick(1/60); document.getElementById('btnPlay').click(); C.tick(1/60); C.hud();
  r.paused = { on:C.tour.on, btn:btn() }; let n4 = 0; while (!(C.nextDeal && C.nextDeal.stops) && n4++ < 900) C.tick(1/30);
  const pre4 = C.nextDeal && C.nextDeal.stops ? C.nextDeal.stops.map(([k]) => k).join() : null; g.click();
  Object.assign(r.paused, { after:C.tour.on, overlap:overlap(T4), to:C.stepTarget, first:keys()[0], ahead:pre4 === keys().join(), steps:n4 }); C.land(0.1);
  C.setOpt('dwell', 'short', true);
  const T5 = C.TOUR.slice(); C.tourGo(T5[11], true); let t = 0, ahead = null;
  while (C.tour.obj === T5[11] && t < 120){ const d = C.nextDeal; if (d && d.stops) ahead = d.stops.map(([k]) => k).join(); C.tick(1/30); t += 1/30; }
  r.auto = { overlap:overlap(T5), obj:C.OBJ[C.tour.obj].key, first:keys()[0], t:+t.toFixed(1), ahead:ahead === keys().join(), bad:check(C.TOUR, C.OBJ[T5[11]]) }; C.setOpt('dwell', 'normal', true); C.land(0.1);
  C.setTour(false); location.hash = '#o=crab&tour=random'; const linked = C.applyHash();
  r.link = { linked, on:C.tour.on, id:C.tourId, first:keys()[0], n:C.TOUR.length, lock:C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null, bad:check(C.TOUR, null), hash:C.viewHash() };
  // (not a place: 'your sky' is a backdrop, so a random tour link to it opens the sky without starting the tour)
  C.setTour(false); location.hash = '#o=backyard&tour=random'; C.applyHash();
  r.link.backyard = { first:keys()[0], lock:C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null, on:C.tour.on };
  history.replaceState(null, '', location.pathname);
  // (with the list of tours open, a first random tour is dealt ahead from where you are, and its row starts that one)
  C.setTour(false); C.lockOn(C.BYKEY.saturn.index); C.land(0.1); document.getElementById('btnTours').click();
  let n5 = 0; while (!(C.nextDeal && C.nextDeal.stops) && n5++ < 900) C.tick(1/30);
  const pre5 = C.nextDeal && C.nextDeal.stops ? C.nextDeal.stops.map(([k]) => k).join() : null;
  document.querySelectorAll('#tourList .trow')[1].click();
  r.panel = { ahead:pre5 === keys().join(), steps:n5, on:C.tour.on, bad:check(C.TOUR, C.BYKEY.saturn) };
  if (!document.getElementById('tours').hidden) document.getElementById('toursClose').click(); C.land(0.1);
  const deal = s => { C.randomSeed(s); return C.dealRandom(C.BYKEY.earth, null, new Set()).join(); };
  r.seeded = { same:deal(7) === deal(7), differ:deal(7) !== deal(8) };
  // (from Earth, what belongs to Earth may come later in the tour)
  r.near = 0; for (let s = 1; s <= 30; s++){ C.randomSeed(s); if (C.dealRandom(C.BYKEY.earth, null, new Set()).some(([k]) => ['moon', 'iss', 'hubble', 'jwst'].includes(k))) r.near++; }
  // unseen first: with all but 10 places seen, a seen place is only dealt when none of the unseen ones could have been, or when the trip to
  // every one that could would weigh at most RANDOM_W.defer of the best trip to a seen place (it waits for a later stop, not dealt
  // through a zoom out to the whole universe and back)
  const W = C.RANDOM_W, E = C.BYKEY.earth, pool = C.tourPool(), unseen = new Set(pool.filter((o, i) => i % 12 === 2).slice(0, 10).map(o => o.key)), was = [...C.SEEN];
  C.SEEN.clear(); for (const o of pool) if (!unseen.has(o.key)) C.SEEN.add(o.key);
  r.tiers = { unseen:unseen.size, seen:0, waited:0, bad:[] };
  for (const s of [3, 4, 5]){
    C.randomSeed(s); const d = C.dealRandom(E, null, new Set()).map(([k]) => C.BYKEY[k]);
    d.forEach((o, i) => {
      if (!C.SEEN.has(o.key)) return; r.tiers.seen++;
      const before = d.slice(0, i), p = i ? d[i - 1] : E, per = {}; before.forEach(q => { per[catOf(q)] = (per[catOf(q)] || 0) + 1; });
      const run = i >= W.run && before.slice(i - W.run).every(q => catOf(q) === catOf(before[i - 1])) ? catOf(before[i - 1]) : null;
      const wOf = c => C.tripW(p, c)*(catOf(c) === run ? W.sameCat : 1);
      const ok = c => c !== E && !(i === 0 && C.samePlace(E, c)) && !before.some(q => C.samePlace(q, c)) && (per[catOf(c)] || 0) < 3;
      const best = Math.max(0, ...pool.filter(c => C.SEEN.has(c.key) && ok(c)).map(wOf)), open = pool.filter(c => !C.SEEN.has(c.key) && ok(c));
      const could = open.filter(c => wOf(c) > best*W.defer && C.tripClear(p, c));
      if (could.length) r.tiers.bad.push(`seed ${s}: ${o.key} (seen) at stop ${i + 1} while ${could.map(c => c.key).join(',')} were not`);
      else if (open.length) r.tiers.waited++;
    });
  }
  // only 6 places left unseen: the trips stay smooth. Each trip as it is flown, from the first tour angle of one stop to the next: how
  // much wider the widest view on the way is than the wider end
  const back = (a, b) => { C.view(a.key, (a.tourViews || [0])[0]); C.tourGo(b.index); const f = C.flight; C.tour.on = false; if (!f) return 1;
    let wm = 0; for (let i = 0; i <= 48; i++) wm = Math.max(wm, f.path.w(f.path.S*i/48)); return wm/Math.max(f.path.w(0), f.path.w(f.path.S)); };
  const fewSeen = s => { const keep = new Set(pool.slice().sort((x, y) => ((x.index*7919 + s*104729) % 1000) - ((y.index*7919 + s*104729) % 1000)).slice(0, 6).map(o => o.key));
    C.SEEN.clear(); for (const o of pool) if (!keep.has(o.key)) C.SEEN.add(o.key); return keep; };
  r.few = { n:0, b3:0, b5:0, unseen:0 };
  for (let s = 1; s <= 8; s++){
    const keep = fewSeen(s); C.randomSeed(s); let a = E;
    for (const [k] of C.dealRandom(E, null, new Set())){ const b = C.BYKEY[k], x = back(a, b); r.few.n++; if (x > 1e3) r.few.b3++; if (x > 1e5) r.few.b5++; if (keep.has(k)) r.few.unseen++; a = b; }
  }
  C.setTour(false); C.SEEN.clear(); for (const k of was) C.SEEN.add(k);
  // (trips as in 7; the star a planet at either end circles counts as part of that end: a trip to Kepler-16b may pass its suns. The third
  // tour is played with only 6 places left unseen)
  C.setOpt('travel', 'cinematic', true); C.setOpt('dwell', 'short', true); r.trips = { n:0, bad:[], deals:0 };
  for (const seed of [1, 2, 3]){
    if (seed === 3) fewSeen(seed);
    C.setTour(false); C.randomSeed(seed); C.view('earth', 0); C.startTour('random');
    const gen0 = C.tourGen; let a = C.BYKEY.earth, trip = null, n = 0;
    while (n++ < 30*1500){
      C.tick(1/30);
      if (C.flight){
        if (!trip){ const b = C.flight.dest || C.flight.obj; trip = { a, b, ws:[], inside:new Set(), around:o => [a, b].some(e => e.parent === o || Math.hypot(o.pos[0] - e.pos[0], o.pos[1] - e.pos[1], o.pos[2] - e.pos[2]) < o.rad) }; }
        trip.ws.push(C.orbit.dist);
        for (const o of C.OBJ) if (o !== trip.a && o !== trip.b && !o.parent && o.prog && o.layer >= 2 && !o.marker && o.dist < o.rad && !trip.around(o)) trip.inside.add(o.key);
      } else if (trip){
        const ws = trip.ws; let dips = 0; for (let j=2;j<ws.length - 2;j++) if (ws[j] < ws[j - 1]*0.999 && ws[j] < ws[j + 1]*0.999 && ws[j] < ws[j - 2] && ws[j] < ws[j + 2]) dips++;
        if (dips || trip.inside.size) r.trips.bad.push(`seed ${seed}, ${trip.a.key} -> ${trip.b.key}: ${dips} zoom dips, inside ${[...trip.inside].join(',') || '-'}`);
        r.trips.n++; a = trip.b; trip = null;
        if (C.tourGen > gen0){ r.trips.deals++; break; }   // (the trip into the next deal was the last one)
      }
    }
  }
  C.setOpt('travel', 'quick', true); C.setOpt('dwell', 'normal', true); C.setTour(false);
  C.SEEN.clear(); for (const k of wasSeen) C.SEEN.add(k); C.setDays(0); window.__freeze = false;
  return r;
});
if (rt.first.id !== 'random' || rt.first.n !== 12 || rt.first.bad.length || rt.first.halo || rt.first.to !== rt.first.want) fail('the random tour did not deal 12 good places: ' + JSON.stringify(rt.first));
if (rt.first.row !== 'random tour' || rt.first.current !== 'true' || rt.first.head !== 'random tour' || rt.first.stop !== 'stop 1 / 12') fail('the random tour row, name or stop line: ' + JSON.stringify(rt.first));
if (rt.second.overlap || rt.second.bad.length) fail('starting the random tour again did not deal 12 new places: ' + JSON.stringify(rt.second));
if (rt.second.track !== rt.second.names) fail('the tour track kept the old names after a new deal: ' + rt.second.track + ' / ' + rt.second.names);
if (rt.last.btn !== 'new random tour›' || !/^12 new places/.test(rt.last.title)) fail('the last stop of the random tour does not offer a new one: ' + JSON.stringify(rt.last));
if (!rt.deal.on || !rt.deal.gen || rt.deal.overlap || rt.deal.to !== rt.deal.first || rt.deal.bad.length) fail('"new random tour" did not deal 12 new places and fly to the first: ' + JSON.stringify(rt.deal));
if (rt.key.overlap || rt.key.to !== rt.key.first) fail('] on the last stop did not deal a new random tour: ' + JSON.stringify(rt.key));
if (rt.paused.on || rt.paused.btn !== 'new random tour›' || !rt.paused.after || rt.paused.overlap || rt.paused.to !== rt.paused.first) fail('paused on the last stop, the green button did not deal a new random tour: ' + JSON.stringify(rt.paused));
if (rt.auto.overlap || rt.auto.obj !== rt.auto.first || rt.auto.bad.length) fail('the end of the last angle did not go on to a new random tour: ' + JSON.stringify(rt.auto));
if (!rt.auto.ahead) fail('the next random tour was not dealt ahead while the last stop played: ' + JSON.stringify(rt.auto));
if (!rt.paused.ahead) fail('paused on the last stop, the next random tour was not dealt ahead: ' + JSON.stringify(rt.paused));
if (!rt.panel.ahead || !rt.panel.on || rt.panel.bad.length) fail('with the list of tours open, a first random tour was not dealt ahead and started: ' + JSON.stringify(rt.panel));
if (!rt.link.linked || !rt.link.on || rt.link.id !== 'random' || rt.link.first !== 'crab' || rt.link.lock !== 'crab' || rt.link.n !== 12 || rt.link.bad.length || !/tour=random/.test(rt.link.hash)) fail('a shared random tour link did not start one at the Crab: ' + JSON.stringify(rt.link));
if (rt.link.backyard.first === 'backyard' || rt.link.backyard.lock !== 'backyard' || rt.link.backyard.on) fail('a random tour link to "your sky" did not open the sky without the tour: ' + JSON.stringify(rt.link.backyard));
if (!rt.seeded.same || !rt.seeded.differ) fail('the random tour does not follow its seed: ' + JSON.stringify(rt.seeded));
if (!rt.near) fail('no random tour from Earth in 30 visits the Moon, the ISS, Hubble or JWST');
if (rt.tiers.bad.length || rt.tiers.unseen !== 10 || rt.tiers.seen < 6) fail('the random tour dealt a place already seen before an unseen one: ' + JSON.stringify(rt.tiers));
if (rt.few.b5 > 0.06*rt.few.n || rt.few.b3 > 0.18*rt.few.n || rt.few.unseen < 4*8) fail('with 6 places left unseen, the random tour trips are not smooth (or skip the unseen places): ' + JSON.stringify(rt.few));
if (rt.trips.deals !== 3) fail('playing the random tour did not reach the next deal: ' + JSON.stringify(rt.trips));
if (rt.trips.bad.length) fail('random tour trips that dip or fly through something: ' + rt.trips.bad.join('; '));

report('motion', errors, `random tour: 12 places, unseen first (${rt.tiers.seen} seen places in 3 deals with 10 unseen, none too early, ${rt.tiers.waited} while the unseen ones were rough trips), with 6 unseen left ${rt.few.unseen}/${8*6} of them dealt in 8 deals and ${rt.few.b3} of ${rt.few.n} trips pull back over 1,000x (${rt.few.b5} over 100,000x), new names on the track, dealt ahead (last stop, paused, list open) and again at the end, ${rt.trips.n} trips played without dips · next stop, start again and back to the tour · three fast angle taps, three angles · Esc closes panels first · Earth on the tour: angles ${say.earth.views.join(', ')} in ${say.earth.t} s · home from the Crab pauses the tour · free camera stays with Earth (${stay.drift.off.toFixed(1)}° off centre after 5 s), back by play and by the pill ("${(stay.pill || '').replace(/^\W/, '› ')}") · Jupiter x${stay.jupiterFree} after letting go, x${stay.overviewFree} in the overview · W A S D within ${stay.reach} view distances · Saturn loops through ${loop.views} angles · pause, play and space work · universe to Earth, largest frame-to-frame change x${fl.worstFrameToFrameScale} · ladder picks keep moving · riding the Halo through a fold and a light-speed jump (camera within ${ride.farAfterFold} / ${ride.farInLightSpeed} ship radii) · the Halo always moving (tightest turn ${halo.minTurnRadius} ship lengths, at most ${halo.maxTurn20s} degrees in 20 s), ${Object.keys(halo.acts).length} kinds of job, ${halo.beams} scan beams on the surface (error ${halo.beamWorst.toExponential(1)}) · Moon → ${nav.next} → ${nav.next2} · mid-flight speed change ${nav.slow}s → ${nav.fast}s · ${trips.n} tour trips without dips (${trips.passes} pass-bys)`);
await browser.close();

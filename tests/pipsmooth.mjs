// Pip's smoothness (owner's review of 0.9.7, 2026-09-30: "no abrupt teleportation or transitions"). Deterministic like tests/motion.mjs: the page's clock
// is fixed and its own loop frozen, the Halo's route fixed by dbg.reset, the ride camera's dice by ride.seed. Every tick it records Pip by the
// ship (ship axes) and on the screen, and the camera, then flags:
//   teleport  Pip in the picture two ticks running whose place on the screen jumps, or whose place by the ship moves faster than it can fly
//   jerk      a sudden change of Pip's velocity (by the ship or on the screen) in one tick, or its body swinging round too fast
//   cut       the camera's view turning or its turn changing abruptly, or the ship jumping on the screen
// over each of Pip's bits, the jobs it helps with, its launches and ways home, a hurry, riding along, locked on the ship and on the Halo tour,
// on a desk and a phone. Usage: node tests/pipsmooth.mjs [--only=name,name] [--verbose] [--dump=t0-t1]; PIP_SEED=n node tests/pipsmooth.mjs
// flies other routes (every run's seed plus n), the same on every run
import { openPage } from './lib.mjs';

const NOW = Date.UTC(2026, 8, 26, 12), SEED = +(process.env.PIP_SEED || 0);
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean), VERBOSE = process.argv.includes('--verbose');
// (--dump=t0-t1: every tick between those times of each run, for a closer look)
const DUMP = (process.argv.find(a => a.startsWith('--dump=')) || '').slice(7).split('-').map(Number);

// ---------------------------------------------------------------- the recorder, in the page
async function install(page){
  await page.evaluate(({ DUMPING, SEED }) => {
    const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, Q = D.drone, R = C.ride.RIDE, r4 = x => Math.round(x*1e4)/1e4, v4 = v => v && v.map(r4);
    const snap = dt => { const s = Q.trk, c = C.cam, p = C.proj('halo-drone'), ps = C.proj('halo');
      return { dt, st:s.st, form:s.form, bit:s.bit, k:s.k, fly:s.fly, idle:s.idle, say:s.say, face:s.face, bk:s.bk, home:s.home, hurry:s.hurry, vis:s.shows,
        anc:v4(s.anc), L:v4(s.L), body:v4(s.body), eye:v4(s.eye), sx:p && p.z > 0 ? r4(p.x) : null, sy:p && p.z > 0 ? r4(p.y) : null, hx:ps && ps.z > 0 ? r4(ps.x) : null, hy:ps && ps.z > 0 ? r4(ps.y) : null,
        f:v4(c.fwd), u:v4(c.up), shot:C.ride.shot, pk:r4(R.pk), pip:!!R.pip, wc:r4(R.wc), act:D.act, ph:h.S.phase, riding:C.shipCam.on, onShip:C.cam.focus === h.index, W:innerWidth, H:innerHeight,
        launch:s.launch, ret:s.ret, sv:C.show.on ? C.show.view : -1, fl:!!C.flight, cd:r4(Math.hypot(...C.cam.rel)/h.rad), tour:C.tour.on, hh:v4(h.S.h), raw:v4(s.raw), pushed:v4(s.pushed), live:s.live, prepMs:s.prepMs, rt:r4(R.t), rtr:r4(R.tr), rtrT:r4(R.trT), wcV:r4(R.wcV || 0), jmp:r4((h.S.jumpAt || 0) - h.S.t) }; };
    window.__pq = {
      // run for sec seconds at dt a tick, recording each; stop early once until() is true
      // (each flight's pieces on its first tick, for --dump)
      run(sec, dt, until){ const out = []; const n = Math.round(sec/dt); let lk = -1;
        for (let i=0;i<n;i++){ C.tick(dt); const s = snap(dt); if (s.fly && s.k !== lk && DUMPING) s.flight = Q.fl; lk = s.k; out.push(s); if (until && until(out)) break; } return out; },
      // a stay that never ends and has no jobs of its own (as the lab's keep): Pip's bits come one after another
      keep(){ const st = D.stay; if (st){ st.dur = 1e9; st.jobs.length = 0; } },
      tick(sec, dt = 1/60){ for (let i=0;i<Math.round(sec/dt);i++) C.tick(dt); },
      // a fresh start at a place: the camera riding along (ride), locked on the ship with its angles playing (lock), or put on the ship at once
      // with Pip still aboard (rideNow, lockNow: for its launch)
      setup(key, seed, cam, keep = true){
        // (the same start whatever ran before: the camera at Saturn, the clock back, the route and the ride camera's dice afresh)
        C.stopShipCam(); C.setTour(false); if (C.HT.on) C.haloTourEnd(true); C.view('saturn', 0); for (const o of C.OBJ) o.t = 0;
        seed += SEED; C.setDays(0); C.tick(0); D.reset(seed, key); C.ride.seed(seed); C.setOpt('rideCam', 'moving', true);
        if (keep) this.keep();
        // (Pip comes out 4 s after the stay starts: the camera settles on the ship first)
        if (cam === 'rideNow' || cam === 'lockNow'){ C.view('halo', 0); if (cam === 'rideNow') C.startShipCam('chase'); else { C.lockOn(h.index); C.land(0); } this.tick(1.5); return; }
        this.tick(3);
        if (cam === 'ride'){ C.startShipCam('chase'); C.land(0.2); } else if (cam === 'lock'){ C.lockOn(h.index); C.land(0.2); }
        if (keep) this.keep();
      },
      untilIdle(){ let seen = false, t = 0; return rows => { const s = rows[rows.length - 1]; if (s.st === 'out' && !s.idle) seen = true; if (seen && s.idle) t += s.dt; return t > 1.5; }; },
    };
  }, { DUMPING:DUMP.length === 2, SEED });
}

// ---------------------------------------------------------------- the checks
// (numbers for a 1280 x 800 desk, about 70 degrees across, so 18 px a degree; Pip is 20 to 60 px across a ship radius or two from the camera,
// about 460 px to a ship radius at 1.5 ship radii. On a phone the screen's numbers scale with its height)
const TH = {
  // a teleport on the screen: Pip moves more than about its own width in one 1/60 s frame. The eye sees that as a jump, not as motion
  // (before the fixes of the 0.9.7 review it jumped up to 480 px; now the most is about 15)
  tp:40,
  // a teleport by the ship: faster than Pip ever flies (its quickest zip tops out at 1.1 ship radii a second, flourishes add a little)
  vmax:2.2,
  // a jerk by the ship: its acceleration, ship radii a second per second. 20 is a change of 0.33 ship radii a second within one 1/60 s frame,
  // about 2.5 px a frame of sudden change at 1.5 ship radii: the smallest kick one notices. The sharpest moves made on purpose stay under it:
  // the engine's puff shoves it at about 9, the skim's buffeting about 12, hops and waves about 4
  acc:20,
  // a jerk on the screen: its velocity there changing by more than 700 px/s (12 px a frame) within one frame, camera moves included
  jpx:700,
  // a body swinging round faster than 900 degrees a second (half a turn in a fifth of a second: a snap, not a turn)
  body:900,
  // the camera: turning faster than 110 degrees a second is a whip pan (the view sweeps its own width in about half a second); from 75 it is
  // only noted (pan). Its turn changing by more than 600 degrees a second in a second (10 degrees a second, about 3 px a frame at the edge
  // of the view, within one frame) is a cut
  wmax:110, pan:75, amax:600,
  // the ship on the screen: its velocity changing by more than 900 px/s within one 1/60 s frame (15 px a frame)
  jship:900,
};
const len = v => Math.hypot(...v), sub = (a, b) => a.map((x, i) => x - b[i]), cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0]*b[0] + a[1]*b[1] + a[2]*b[2])/(len(a)*len(b) || 1))))*180/Math.PI;
const where = r => { const pu = r.raw && r.pushed ? len(sub(r.pushed, r.raw)) : 0;
  return `${r.bit || r.st}${r.fly ? ' (flight)' : ''} · "${r.say}" · shot ${r.shot || '-'}${r.pk > 0 ? ' pk ' + r.pk.toFixed(2) : ''} · ${r.ph}${r.act ? ' ' + r.act : ''}${pu > 0.002 ? ` · pushed off the hull by ${pu.toFixed(3)}` : ''}`; };
// (Pip's own checks skip its break-ups into embers (tests of their own in tests/motion.mjs) and the weapons test, which turns it into the fold
// cannon, from the job's start until Pip's first idle stretch after it (wp): that is being rewritten with a test of its own. Its checks by the
// ship skip the moves that ride along with the camera (live): there it moves by the ship as fast as the camera does, and the screen decides)
const pipOk = r => r.st === 'out' && !r.bk && r.form === 'pod' && !r.wp;
const camOk = r => (r.riding || r.onShip) && (r.ph === 'pass' || r.ph === 'loop' || r.ph === 'align');
function analyse(name, rows){
  const ev = [], stat = { tp:0, v:0, acc:0, jpx:0, body:0, w:0, a:0, js:0, prep:0 }, dt = rows[0] ? rows[0].dt : 1/60, k60 = (1/60)/dt, sc = rows[0] ? 800/rows[0].H : 1;
  const add = (kind, i, msg) => ev.push({ kind, t:+(i*dt).toFixed(2), msg, at:where(rows[i]) });
  let wp = /weapons/.test(name) ? 2 : 0;
  for (const r of rows){ if (wp < 2) wp = r.act === 'weapons' ? 1 : wp && !(r.idle && !r.fly) ? 1 : 0; r.wp = !!wp; stat.prep = Math.max(stat.prep, r.prepMs || 0); }
  for (let i=1;i<rows.length;i++){
    const a = rows[i - 1], b = rows[i], z = i > 1 ? rows[i - 2] : null;
    // Pip on the screen and by the ship
    if (a.vis && b.vis && a.sx != null && b.sx != null && pipOk(a) && pipOk(b)){
      const d = Math.hypot(b.sx - a.sx, b.sy - a.sy)*k60*sc; stat.tp = Math.max(stat.tp, d);
      if (d > TH.tp) add('teleport', i, `jumped ${d.toFixed(0)} px on the screen in one frame`);
      if (z && z.vis && z.sx != null && pipOk(z)){ const j = Math.hypot(b.sx - 2*a.sx + z.sx, b.sy - 2*a.sy + z.sy)/dt*k60*sc; stat.jpx = Math.max(stat.jpx, j);
        if (j > TH.jpx) add('jerk', i, `its velocity on the screen changed by ${j.toFixed(0)} px/s in one frame`); }
    }
    if (pipOk(a) && pipOk(b) && a.L && b.L){
      if (a.body && b.body){ const w = ang(a.body, b.body)/dt; stat.body = Math.max(stat.body, w); if (w > TH.body) add('jerk', i, `its body swung round at ${w.toFixed(0)} deg/s`); }
      if (!a.live && !b.live){
        const v = len(sub(b.L, a.L))/dt; stat.v = Math.max(stat.v, v);
        if (v > TH.vmax) add('teleport', i, `moved at ${v.toFixed(2)} ship radii/s by the ship`);
        if (z && pipOk(z) && z.L && !z.live){ const j = len(b.L.map((x, k) => x - 2*a.L[k] + z.L[k]))/(dt*dt); stat.acc = Math.max(stat.acc, j);
          if (j > TH.acc) add('jerk', i, `its acceleration by the ship was ${j.toFixed(1)} ship radii/s²`); }
      }
    }
    // the camera: its turn (from the change of its axes) and how fast that changes
    if (!camOk(a) || !camOk(b)) continue;
    const w = cross(a.f, b.f).map((x, k) => (x + cross(a.u, b.u)[k])*0.5/dt), wd = len(w)*180/Math.PI; stat.w = Math.max(stat.w, wd);
    if (wd > TH.wmax) add('cut', i, `the camera turned at ${wd.toFixed(0)} deg/s`); else if (wd > TH.pan) add('pan', i, `the camera turned at ${wd.toFixed(0)} deg/s`);
    if (z && camOk(z)){ const w0 = cross(z.f, a.f).map((x, k) => (x + cross(z.u, a.u)[k])*0.5/dt), al = len(sub(w, w0))/dt*180/Math.PI; stat.a = Math.max(stat.a, al);
      if (al > TH.amax) add('cut', i, `the camera's turn changed by ${al.toFixed(0)} deg/s² (from ${(len(w0)*180/Math.PI).toFixed(0)} to ${wd.toFixed(0)} deg/s)`);
      if (a.hx != null && b.hx != null && z.hx != null){ const j = Math.hypot(b.hx - 2*a.hx + z.hx, b.hy - 2*a.hy + z.hy)/dt*k60*sc; stat.js = Math.max(stat.js, j);
        if (j > TH.jship) add('cut', i, `the ship's velocity on the screen changed by ${j.toFixed(0)} px/s in one frame`); } }
  }
  // (one line per run of the same kind of event within 0.3 s)
  const out = []; for (const e of ev){ const l = out[out.length - 1]; if (l && l.kind === e.kind && e.msg.split(' ')[0] === l.msg.split(' ')[0] && e.t - l.t1 < 0.3){ l.t1 = e.t; l.n++; continue; } out.push({ ...e, t1:e.t, n:1 }); }
  const pipT = rows.filter(pipOk).length;
  return { name, ev:out, stat, n:rows.length, secs:+(rows.length*dt).toFixed(1), shown:rows.filter(r => r.vis).length, out:pipT };
}

// ---------------------------------------------------------------- the scenarios
const results = [];
const want = n => !ONLY.length || ONLY.some(o => n.includes(o));
const push = (name, rows) => { results.push(analyse(name, rows));
  if (DUMP.length === 2) for (let i=0;i<rows.length;i++){ const t = i*rows[i].dt; if (t >= DUMP[0] && t <= DUMP[1]){ const { W, H, dt, ...r } = rows[i], p = rows[i - 1];
    if (p){ r.camW = +(ang(p.f, r.f)/dt).toFixed(2); r.hW = +(ang(p.hh, r.hh)/dt).toFixed(2); const w = cross(p.f, r.f).map((x, k) => (x + cross(p.u, r.u)[k])*0.5/dt);
      r.rollW = +((w[0]*r.f[0] + w[1]*r.f[1] + w[2]*r.f[2])*180/Math.PI).toFixed(2); } console.log(name, t.toFixed(3), JSON.stringify(r)); } } };
async function scenarios(page, tag, phone){
  await install(page);
  const bits = await page.evaluate(() => __cosmos.BYKEY.halo.dbg.drone.PIP_BITS.filter((b, i, a) => a.indexOf(b) === i));
  // each bit, from Pip's first idle stretch, riding along and locked on the ship (each from a fresh start, so it plays the same alone)
  for (const cam of ['ride', 'lock']) for (const b of bits){
    const n = `${tag} ${cam}: ${b}`; if (!want(n)) continue;
    push(n, await page.evaluate(({ b, cam }) => { __pq.setup('saturn', 3, cam); __pq.run(12, 1/60, __pq.untilIdle()); __pq.run(1, 1/60); __cosmos.BYKEY.halo.dbg.drone.bit(b);
      let seen = false, t = 0; return __pq.run(40, 1/60, rows => { const s = rows[rows.length - 1]; if (s.bit === b && !s.idle) seen = true; if (seen && s.idle) t += s.dt; return t > 1.5 || (seen && s.bit !== b); }); }, { b, cam }));
  }
  // its launches and ways home: out of the bay with the camera already on the ship, a while by the ship, then the stay ends and it goes home,
  // at one place after another until every launch and way home has been seen (near a black hole it glides home)
  if (want(`${tag} launch`) || want(`${tag} home`)){
    const seen = new Set();
    for (const key of ['saturn', 'jupiter', 'mars', 'earth', 'moon', 'neptune', 'uranus', 'venus', 'mercury', 'sgra']){
      for (const cam of phone ? ['rideNow'] : ['rideNow', 'lockNow']){
        const r = await page.evaluate(({ key, cam }) => { __pq.setup(key, 5, cam);
          const L = __pq.run(14, 1/60, rows => { const s = rows[rows.length - 1]; return s.st === 'out' && s.idle && s.bit === 'launch' && rows.filter(x => x.idle).length > 60; });
          __pq.run(2, 1/60); __cosmos.BYKEY.halo.dbg.replan();
          const H = __pq.run(30, 1/60, rows => rows[rows.length - 1].st === 'stowed');
          return { L, H, launch:L[L.length - 1].launch, ret:H[0].ret }; }, { key, cam });
        const c = cam.replace('Now', '');
        if (!seen.has('L' + c + r.launch) && want(`${tag} launch`)){ seen.add('L' + c + r.launch); push(`${tag} launch ${r.launch} (${c}, ${key})`, r.L); }
        if (!seen.has('H' + c + r.ret) && want(`${tag} home`)){ seen.add('H' + c + r.ret); push(`${tag} home ${r.ret} (${c}, ${key})`, r.H); }
      }
      if (seen.size >= (phone ? 1 : 2)*7) break;
    }
  }
  // called home early (a ship that has to leave now) in the middle of a flight and of a bit
  for (const [b, at] of [['photo', 1.2], ['play', 4], ['peek', 2.2]]){
    const n = `${tag} hurry in ${b}`; if (!want(n)) continue;
    push(n, await page.evaluate(({ b, at }) => { __pq.setup('saturn', 3, 'ride'); __pq.run(12, 1/60, __pq.untilIdle()); __cosmos.BYKEY.halo.dbg.drone.bit(b);
      const A = __pq.run(8, 1/60, rows => rows[rows.length - 1].bit === b && rows.filter(x => x.bit === b).length > at*60); __cosmos.BYKEY.halo.dbg.drone.hurry();
      return A.concat(__pq.run(6, 1/60, rows => rows[rows.length - 1].st === 'stowed')); }, { b, at }));
  }
  // the jobs Pip helps with (the weapons test: the camera only)
  for (const [job, key] of [['scan', 'jupiter'], ['probe', 'mars'], ['skim', 'jupiter'], ['weapons', 'moon']]){
    for (const cam of ['ride', 'lock']){
      const n = `${tag} ${cam}: job ${job}`; if (!want(n)) continue;
      push(n, await page.evaluate(({ job, key, cam }) => { __pq.setup(key, 4, cam); __pq.run(12, 1/60, __pq.untilIdle()); const D = __cosmos.BYKEY.halo.dbg; __cosmos.BYKEY.halo.demo.jobNow(job, true);
        let t = 0; return __pq.run(100, 1/60, rows => { const s = rows[rows.length - 1]; if (!s.act && s.idle) t += s.dt; return t > 2; }); }, { job, key, cam }));
    }
  }
  // whole stays, as a visitor sees them: riding along at Jupiter and locked on the ship at Saturn, jobs and all, to the jump away
  for (const [cam, key, sec] of [['ride', 'jupiter', 160], ['lock', 'saturn', 140]]){
    const n = `${tag} ${cam}: a whole stay at ${key}`; if (!want(n)) continue;
    push(n, await page.evaluate(({ key, cam, sec }) => { __pq.setup(key, 6, cam, false); return __pq.run(sec, 1/30); }, { key, cam, sec }));
  }
  // the Halo tour: from Saturn, three stops or so
  const n = `${tag} halo tour`;
  if (want(n)) push(n, await page.evaluate(s => { const C = __cosmos; __pq.setup('saturn', 2, 'none', false); C.ride.seed(2 + s); C.haloTourStart('grand'); C.land(0.2); return __pq.run(240, 1/30); }, SEED));
}

const t0 = Date.now();
for (const phone of [false, true]){
  const tag = phone ? 'phone' : 'desk'; if (ONLY.length && !ONLY.some(o => o.startsWith(tag) || !/^(desk|phone)/.test(o))) continue;
  const { browser, page, errors } = await openPage({ width:1280, height:800, phone, now:NOW, freeze:true });
  await scenarios(page, tag, phone);
  await browser.close();
  if (errors.length){ console.log(errors.join('\n')); process.exitCode = 1; }
}

// ---------------------------------------------------------------- the report
// (teleports, jerks and cuts fail the test; fast pans are only noted)
let bad = 0, pans = 0;
for (const r of results){
  const s = r.stat, fails = r.ev.filter(e => e.kind !== 'pan'), head = `${r.name} · ${r.secs} s, Pip out ${(r.out/r.n*100).toFixed(0)}%, in the picture ${(r.shown/r.n*100).toFixed(0)}% · max: step ${s.tp.toFixed(0)} px, ${s.v.toFixed(2)} r/s, ${s.acc.toFixed(1)} r/s², ${s.jpx.toFixed(0)} px/s, body ${s.body.toFixed(0)} deg/s · camera ${s.w.toFixed(0)} deg/s, ${s.a.toFixed(0)} deg/s², ship ${s.js.toFixed(0)} px/s · flight plan ${s.prep.toFixed(1)} ms`;
  console.log((fails.length ? 'FLAG ' : r.ev.length ? 'note ' : 'ok   ') + head);
  for (const e of r.ev.slice(0, VERBOSE ? 99 : 6)) console.log(`       ${e.kind} at ${e.t}${e.t1 > e.t ? '-' + e.t1 : ''} s${e.n > 1 ? ' (' + e.n + ' ticks)' : ''}: ${e.msg} · ${e.at}`);
  if (r.ev.length > 6 && !VERBOSE) console.log(`       ... ${r.ev.length - 6} more`);
  bad += fails.length; pans += r.ev.length - fails.length;
}
console.log(`${results.length} runs in ${((Date.now() - t0)/1000).toFixed(0)} s: ${bad} teleports, jerks and cuts; ${pans} fast pans (${TH.pan} to ${TH.wmax} degrees a second, noted only)`);
if (bad) process.exitCode = 1;

// ================================================================ SpaceX launches (3): the director (clocks, real launches, replays, the caption) and the launch camera
// LENS.k narrows the field of view (a telephoto lens for the tracking shots); 09-render.js applies it to tanX / tanY every tick.
const LENS = { k:1, want:1 };
const LCAM = { on:false, run:null, shot:-1, eo:null, lo:null, focus:null, lens:1, endT:0 };
// the part a shot looks at (the camera's focus), and the Earth-fixed point of a shot's eye or look spec
const center = o => V.add(o.sx.st.base, V.mul(o.sx.st.axis, o.sx.def.len*0.5e-3));
function specPart(run, spec){ return spec && (spec[0] === 'part' || spec[0] === 'traj') ? famPart(run.mis.fam, spec[1]) : null; }
function specPoint(run, spec){
  const k = spec[0];
  if (k === 'site'){ const S = siteOf(spec[1], run); return V.add(S.p, V.mul(M3.apply(S.F.M, spec[2]), 1e-3)); }
  if (k === 'traj'){ const o = famPart(run.mis.fam, spec[1]), st = o.sx.st, [l, u, f] = spec[2]; return V.add(center(o), V.add(V.mul(st.left, l*1e-3), V.add(V.mul(st.up, u*1e-3), V.mul(st.fwd, f*1e-3)))); }
  if (k === 'part'){ const st = famPart(run.mis.fam, spec[1]).sx.st; return V.add(st.base, V.mul(st.axis, spec[2]*1e-3)); }
  if (k === 'iss'){ const I = issFrame(); return V.add(I.c, V.mul(M3.apply(I.M, spec[1]), 1e-3)); }
  if (k === 'mid'){ const I = issFrame(), d = SX.parts.dragon.sx.st; return V.mul(V.add(V.add(I.c, V.mul(M3.apply(I.M, [ISS_PORT, 0, 0]), 1e-3)), V.add(d.base, V.mul(d.axis, 4e-3))), 0.5); }
  return [0, 0, 0];
}
const shotIndex = run => { const S = run.mis.shots; let i = 0; for (let j=0;j<S.length;j++) if (run.mt >= S[j].t) i = j; return i; };
function shotFocus(run, sh){ if (sh.focus) return famPart(run.mis.fam, sh.focus); return specPart(run, sh.look) || specPart(run, sh.eye) || (run.mis.fam === 'f9' && run.key === 'dragon' ? SX.parts.dragon : SX.parts[FAM[run.mis.fam].parts[0].key]); }
const watchPart = run => shotFocus(run, run.mis.shots[shotIndex(run)]);
function startLaunchCam(run){
  LCAM.on = true; LCAM.run = run; LCAM.shot = -1; LCAM.endT = 0; run.hold = false; run.seen = true; motion.last = 'launch';
  stopTour(false); pauseShow(); tween = null; flyMove = null; shipCam.on = shipCam.pending = false;
  if (run.mode === 'real') ssDays = realJD() - JD_NOW;   // (a live launch is lit by the real Sun: the atlas clock goes to now)
  updateLaunchCam(0); updateModeUI();
}
// (flying off elsewhere only switches it off: the flight has already set the camera, the lock and the info panel)
function stopLaunchCam(quiet, flying){
  if (!LCAM.on) return false;
  LCAM.on = false; LENS.want = 1;
  if (flying){ updateModeUI(); return true; }
  const F = LCAM.focus; motion.last = 'launch';
  if (F && !F.hidden){ orbit.lock = F.index; orbit.frame = camFrameOf(F); orbit.target = [0, 0, 0]; orbit.off = [0, 0, 0]; orbit.offFn = null; cam.focus = F.index; syncOrbitFromCam(); setInfo(F.index); }
  LENS.want = 1; updateModeUI();
  return true;
}
function updateLaunchCam(dt){
  const run = LCAM.run; if (!run || !SX.runs.includes(run)){ stopLaunchCam(true); return; }
  const i = shotIndex(run), sh = run.mis.shots[i], F = shotFocus(run, sh);
  if (!F || !F.sx.st){ return; }
  const cut = i !== LCAM.shot || F !== LCAM.focus;
  const Fc = center(F), eye = specPoint(run, sh.eye), look = specPoint(run, sh.look);
  let eo = V.sub(eye, Fc), lo = V.sub(look, Fc);
  if (!cut && dt > 0){
    // ground cameras stay put exactly; cameras riding beside a stage follow it with a little lag; the aim pans smoothly
    const k = 1 - Math.exp(-dt*(sh.eye[0] === 'site' || sh.eye[0] === 'iss' ? 1e9 : 3/(sh.lag || 1))), kl = 1 - Math.exp(-dt*5);
    eo = V.lerp(LCAM.eo, eo, k); lo = V.lerp(LCAM.lo, lo, kl);
  }
  if (cut && infoObj !== F.index) setInfo(F.index);
  LCAM.eo = eo; LCAM.lo = lo; LCAM.shot = i; LCAM.focus = F;
  const dist = Math.max(V.len(V.sub(lo, eo))*1000, 1);
  let lens = typeof sh.lens === 'number' ? sh.lens : Array.isArray(sh.lens) ? sh.lens[2]*2*Math.tan(cam.fovY/2)*dist/sh.lens[1] : 1;
  lens = clamp(lens, 1, 16);
  LENS.want = lens; if (cut) LENS.k = lens;
  cam.focus = F.index;
  cam.rel = V.mul(M3.apply(earth.rot, eo), KM);
  const eyeW = V.add(Fc, eo);
  setBasis(M3.apply(earth.rot, V.norm(V.sub(lo, eo))), M3.apply(earth.rot, V.norm(eyeW)));
  orbit.lock = F.index; orbit.frame = camFrameOf(F); orbit.off = [0, 0, 0]; orbit.offFn = null; orbit.target = [0, 0, 0];
  orbit.dist = orbit.distT = Math.max(V.len(cam.rel), F.rad*0.3);
}
// ---------------------------------------------------------------- picking a rocket: fly to it, then watch (a stage that is not flying starts a countdown on its pad)
{ const prev = lockOn; lockOn = function(i, vi = 0, loop = true){
  const o = OBJ[i];
  if (!o || !o.sx || !FLAGS.spacex) return prev(i, vi, loop);
  let run = famRun(o.sx.fam);
  if (!run || run.ended){
    if (run) endRun(run);
    run = newRun(o.sx.fam === 'star' ? 'starship' : o.sx.fam === 'fh' ? 'falconheavy' : o.key === 'dragon' ? 'dragon' : 'falcon9', 'click');
    buildClusters();
  }
  const t = watchPart(run) || o;
  SX.pend = { run, part:t, at:GT };
  for (const pr of [P.sxStar, P.sxFal, P.sxEnv]) progReady(pr);   // (start compiling now, in the background, so the pad is ready when the camera lands)
  prev(t.index, 0, false);
  motion.last = 'launch';
}; }
function sxWatch(run){ if (!run) return; hideHint(); goTo(watchPart(run).index); }
// play after a pause: follow the flight again, or fly it again once it is over
function sxResume(){
  const o = OBJ[orbit.lock]; if (!o || !o.sx) return false;
  const run = famRun(o.sx.fam);
  if (run && !run.ended){ startLaunchCam(run); return true; }
  lockOn(o.index); return true;
}
// ---------------------------------------------------------------- real launches: SpaceX flights from the launch feed, at their scheduled time
function realMission(l){
  if (!/spacex/i.test(l.provider || '') && !/falcon|starship/i.test(l.rocket || '')) return null;
  const r = (l.rocket || '') + ' ' + (l.name || '');
  const key = /starship/i.test(r) ? 'starship' : /falcon heavy/i.test(r) ? 'falconheavy' : /falcon 9/i.test(r) ? (/crew|dragon|crs-|ax-|polaris|fram/i.test(l.name || '') ? 'dragon' : 'falcon9') : null;
  if (!key) return null;
  let site = null, bd = 40;
  for (const k of ['starbase', 'lc39a', 'slc40', 'slc4e']){ const S = SXS[k], d = V.len(V.sub(V.mul(llUnit(l.lat, l.lon), RE_KM), S.p)); if (d < bd){ bd = d; site = k; } }
  if (!site || (key === 'starship') !== (site === 'starbase')) return null;
  const az = key === 'falconheavy' ? 90 : site === 'slc4e' ? 165 : key === 'dragon' ? 44 : MIS[key].az;
  return { key, site, az, t0:Date.parse(l.net), label:(l.name || '').split('|').pop().trim() };
}
function realLaunches(){
  if (typeof earthLive === 'undefined' || !earthLive.launches) return [];
  const now = Date.now(), out = [];
  for (const l of earthLive.launches.concat(SX.fake || [])){
    if (/hold|fail|tbd/i.test(l.status || '')) continue;
    const m = realMission(l); if (!m || !isFinite(m.t0)) continue;
    const end = MIS[m.key].realEnd || MIS[m.key].end;
    if (now > m.t0 - 20*60e3 && now < m.t0 + end*1e3) out.push(m);
  }
  return out;
}
// ---------------------------------------------------------------- the director, once a tick (after Earth has turned, before the camera)
const SXD = addObj({ key:'sx-director', name:'launch director', type:'', group:'travel', parent:earth, offset:[0, 0, 0], rad:1*MET, hidden:true, noPick:true, atlas:false, noLabel:true, noTour:true, noImpostor:true,
  update(dt){ if (FLAGS.spacex) sxTick(dt); } });
let SX_T = 0, sxRatePrev = null;
function sxTick(dt){
  SX_T += dt;
  const now = Date.now();
  // the pads and droneships turn with the Earth (their objects' places are only used to sort them for drawing and to aim flights)
  for (const S of SITE_LIST()){ S.o.offset = V.mul(M3.apply(earth.rot, V.add(S.p, V.mul(S.up, 0.05))), KM); S.o.pos = V.add(earth.pos, S.o.offset); }
  // real launches: start (or join in progress) a flight for each one in its window, unless a flight you are watching holds that rocket
  for (const m of realLaunches()){
    const id = m.key + m.t0; let run = famRun(MIS[m.key].fam);
    if (run && run.mode === 'real' && run.id === id) continue;
    if (run && LCAM.on && LCAM.run === run) continue;
    run = newRun(m.key, 'real', { site:m.site, az:m.az, t0:m.t0, label:m.label, mt:(now - m.t0)/1000 }); run.id = id;
  }
  for (const run of SX.runs.slice()){
    const mis = run.mis, end = run.mode === 'real' ? (mis.realEnd || mis.end) : mis.end;
    if (run.mode === 'real') run.mt = (now - run.t0)/1000;
    else if (!run.hold && !run.ended){
      run.mt += dt*stepRate(mis.rate, run.mt);
      if (mis.jump && run.mt >= mis.jump[0] && run.mt < mis.jump[1]){ run.mt = mis.jump[1]; if (run.key === 'dragon') dockInDaylight(); }
    }
    if (run.mt >= end && !run.ended){ run.ended = true; run.mt = end; run.endAt = SX_T; if (run.mode === 'real' && !(LCAM.on && LCAM.run === run)) { endRun(run); continue; } }
    // an ended flight stays as it finished until the camera has left it; one never watched just ends
    const mine = o => o && o.sx && o.sx.fam === mis.fam;
    const here = mine(OBJ[cam.focus]) || mine(OBJ[orbit.lock]) || (SX.pend && SX.pend.run === run);
    if (run.ended && !(LCAM.on && LCAM.run === run) && !here) { endRun(run); continue; }
    if (run.hold && !here && SX_T - (run.bornT || (run.bornT = SX_T)) > 60) { endRun(run); continue; }
    if (run.mode === 'replay' && !run.seen && run.ended) { endRun(run); continue; }
    sxEval(run);
  }
  sxEval(null);
  // the camera arrived at the rocket it flew to: start watching
  if (SX.pend){ const p = SX.pend;
    if (!SX.runs.includes(p.run)) SX.pend = null;
    else if (!flight && orbit.lock === p.part.index){ SX.pend = null; startLaunchCam(p.run); }
    else if (!flight && GT - p.at > 1.5 && orbit.lock !== p.part.index) SX.pend = null; }
  // a flight you watch ends: a moment on the last shot, then the camera is yours
  if (LCAM.on && LCAM.run.ended){ LCAM.endT += dt; if (LCAM.endT > 5){ stopLaunchCam(true); toast('the flight is over · drag to look round · press play to watch it again'); } }
  // replays now and then while you look at Earth
  const atEarth = (orbit.lock === earth.index || (tour.on && tour.obj === earth.index)) && orbit.dist < earth.rad*14 && !SKYV.on && !flight;
  if (atEarth && SX_T > SX.nextReplay && !LCAM.on && !SX.runs.some(r => r.mode !== 'real' || r.mt < 600)){
    // (only from a pad on the side of Earth you are looking at, so the launch can be seen)
    const cf = V.norm(camFixed()), seen = k => V.dot(SXS[k].up, cf) > 0.3;
    const opts = [['starship', {}, 0.34], ['falcon9', {}, 0.2], ['falcon9', { site:'slc4e', az:165 }, 0.1], ['dragon', {}, 0.18], ['falconheavy', {}, 0.18]].filter(([k, o]) => seen(o.site || MIS[k].site) && !famRun(MIS[k].fam));
    if (opts.length){ let x = Math.random()*opts.reduce((a, o) => a + o[2], 0), pick = opts[0]; for (const o of opts){ x -= o[2]; if (x <= 0){ pick = o; break; } }
      const r = newRun(pick[0], 'replay', pick[1]); r.mt = -8; SX.nextReplay = SX_T + 150 + Math.random()*110; }
    else SX.nextReplay = SX_T + 15;
  }
  if (!atEarth && SX.nextReplay < SX_T + 20) SX.nextReplay = SX_T + 20;
  // the caption: what is flying, with a button to watch it
  LCAP.txt = ''; LCAP.btn = ''; LCAP.go = null; LCAP.live = false;
  if (LCAM.on){ const r = LCAM.run; LCAP.txt = `${r.mis.name} · ${r.mode === 'real' ? 'live' : 'replay'}${eventNow(r) ? ' · ' + eventNow(r) : ''} · ${clk(r.mt)}`; }
  else {
    const live = SX.runs.find(r => r.mode === 'real' && !r.ended) || null, rep = SX.runs.find(r => r.mode === 'replay' && !r.ended && r.mt > -8 && atEarth);
    const r = live || rep;
    if (r && !(SX.pend && SX.pend.run === r)){
      const where = SXS[r.site].short;
      LCAP.txt = r.mode === 'real' ? `live · ${r.mis.name}${r.label ? ' · ' + r.label : ''} from ${where} · ${clk(r.mt)}` : `illustrative replay · ${r.mis.name} from ${where}${eventNow(r) ? ' · ' + eventNow(r) : ''} · ${clk(r.mt)}`;
      LCAP.btn = 'watch'; LCAP.go = () => sxWatch(r); LCAP.live = r.mode === 'real' && r.mt > -600;
    }
  }
  // near the ground (or watching) the Solar System clock runs in real time, so the Sun stays put and the pad does not spin round
  const want = LCAM.on || (SX.pend && flight) || (SXENV.on && SXENV.alt < 40);
  if (want && sxRatePrev == null){ sxRatePrev = ssRate; ssRate = 1/86400; }
  else if (!want && sxRatePrev != null){ if (ssRate === 1/86400) ssRate = sxRatePrev; sxRatePrev = null; }
  const lk = 1 - Math.exp(-dt*(LCAM.on ? 3 : 2)); LENS.k = Math.exp(Math.log(LENS.k) + (Math.log(LCAM.on ? LENS.want : 1) - Math.log(LENS.k))*lk);
  buildClusters(); updateTrail();
  for (const k in SX.parts) SX.parts[k].noLabel = LCAM.on;   // (a clean picture while the launch camera plays)
  // locked on a rocket or a pad, the camera turns with the Earth under it (their frames turn with it)
  if (!LCAM.on && !flight && OBJ[orbit.lock] && (OBJ[orbit.lock].sx || OBJ[orbit.lock].sxSite)) orbit.frame = camFrameOf(OBJ[orbit.lock]);
  // a shared link straight to a rocket starts its countdown
  if (!SX.hashDone && GT > 0.3){ SX.hashDone = true; const o = OBJ[orbit.lock]; if (o && o.sx && /[#&]o=/.test(location.hash) && !famRun(o.sx.fam)) lockOn(o.index); }
}
// Dragon docks "about a day later": the Solar System clock moves on a day, then on to a moment when the station is in sunlight for the
// next few minutes, so the docking can be seen (it is dark for about 35 of every 93 minutes)
function dockInDaylight(){
  const iss = BYKEY.iss; if (!iss) return;
  ssDays += 1;
  for (let k=0;k<100;k++){
    let lit = true;
    for (const dtm of [0, 2, 4]){ const d0 = ssDays; ssDays += dtm/1440; earth.update(0); iss.update(0); const p = M3.applyT(earth.rot, V.mul(iss.offset, 1/KM)), s = sunFixed();
      if (V.dot(p, s) < 0 && V.len(V.sub(p, V.mul(s, V.dot(p, s)))) < RE_KM) lit = false; ssDays = d0; }
    if (lit) break;
    ssDays += 1/1440;
  }
  earth.update(0); iss.update(0);
}
// playback speed at mission time t: the rate of the last step at or before t
function stepRate(R, t){ let v = R[0][1]; for (const [a, b] of R) if (t >= a) v = b; return v; }
function eventNow(run){ let e = ''; for (const [t, s] of run.mis.events) if (run.mt >= t && run.mt - t < (run.mode === 'real' ? 40 : 30)) e = s; return e; }
// ---------------------------------------------------------------- the numbers in the info panel
const SX_IDLE = {
  star:'standing on the launch mount at Starbase, Texas · about 120 m tall with Super Heavy\npick it to launch: the countdown starts when the camera arrives',
  f9:'standing on its pad at Cape Canaveral · 70 m tall\npick it to launch: the countdown starts when the camera arrives',
  fh:'standing on Launch Complex 39A at Kennedy · 70 m tall, 12 m wide\npick it to launch: the countdown starts when the camera arrives',
};
function sxReadout(o){
  const st = o.sx.st, run = famRun(o.sx.fam);
  if (o.key === 'dragon' && (!run || run.key !== 'dragon' || run.mt < -9)) return st && st.atISS && (!run || run.key !== 'dragon') ? 'docked at the station\'s forward port (illustrative: a Dragon is often there)\npick it to fly a whole mission: launch from Cape Canaveral, then docking' : 'pick it to fly a whole mission: launch, then docking at the ISS';
  if (!run || !st) return SX_IDLE[o.sx.fam] || '';
  const mt = run.mt, ev = eventNow(run);
  const hon = run.mode === 'real' ? 'live: SpaceX\'s launch at its scheduled time (Launch Library 2), drawn by the atlas; the real one can slip' : 'illustrative: the path and timings are modelled on real flights, sped up in the quiet parts';
  if (mt < 0) return `${clk(mt)}${ev ? ' · ' + ev : ''} · ${SXS[run.site].name}\n${hon}`;
  if (st.atISS) return `${clk(mt)}${ev ? ' · ' + ev : ''}\n${st.dist > 1 ? Math.round(st.dist) + ' m from the docking port' : 'docked'} · the station orbits 420 km up at 28,000 km/h\n${hon}`;
  const alt = st.alt, sp = st.speed*3600;
  const altS = alt < 1 ? Math.round(alt*1000) + ' m' : (alt < 10 ? alt.toFixed(1) : Math.round(alt)) + ' km';
  return `${clk(mt)}${ev ? ' · ' + ev : ''}\naltitude ${altS} · ${Math.round(sp).toLocaleString('en-US')} km/h · ${Math.round(Math.max(st.s || 0, 0)).toLocaleString('en-US')} km downrange\n${hon}`;
}
const SXDBG = { SX, MIS, LCAM, LENS, famRun, newRun, endRun, sxEval, buildClusters, watch:sxWatch, rd:roadsterEq,
  // (tests: move the Solar System clock until the Sun stands at elevation el degrees over a site, rising (am) or setting)
  sunAt(site, el, am = true){ const S = SXS[site] || SX_DS[site]; let best = 0, bd = 1e9; for (let h=0;h<24*4;h++){ ssDays = realJD() - JD_NOW + h/96; earth.update(0); const e = Math.asin(V.dot(sunFixed(), S.up))/DEG, e2 = (ssDays += 0.01, earth.update(0), Math.asin(V.dot(sunFixed(), S.up))/DEG); ssDays -= 0.01; const d = Math.abs(e - el) + ((e2 > e) === am ? 0 : 100); if (d < bd){ bd = d; best = ssDays; } } ssDays = best; earth.update(0); return +(Math.asin(V.dot(sunFixed(), S.up))/DEG).toFixed(1); },
  start(key, mode = 'replay', mt = 0, opt = {}){ const r = newRun(key, mode, Object.assign({ mt }, opt)); r.hold = false; buildClusters(); return r; },
  setMt(key, mt){ const r = famRun(MIS[key].fam); if (r){ const j = r.mis.jump; if (j && r.mt < j[1] && mt >= j[1] && r.key === 'dragon') dockInDaylight(); r.mt = mt; r.hold = false; r.ended = false; sxEval(r); buildClusters(); } return !!r; },
  camNow(key){ const r = famRun(MIS[key].fam); if (r) startLaunchCam(r); return !!r; },
  // (tests: replace a mission's camera by one shot from now on, or put its own shots back)
  // (tests: look at Earth from k Earth radii straight above a site)
  orbitOver(site, k = 3){ const S = SXS[site]; lockOn(earth.index); flight = null; show.on = show.pending = false; orbit.lock = earth.index; cam.focus = earth.index; orbit.frame = camFrameOf(earth); const d = M3.applyT(orbit.frame, M3.apply(earth.rot, S.up)); orbit.yaw = Math.atan2(d[0], d[2]); orbit.pitch = Math.asin(d[1]); orbit.dist = orbit.distT = earth.rad*k; orbit.off = [0, 0, 0]; orbit.target = [0, 0, 0]; applyOrbit(); return 1; },
  shot(key, sh){ const m = MIS[key]; if (!m._shots) m._shots = m.shots; m.shots = sh ? [Object.assign({ t:-1e9 }, sh)] : m._shots; LCAM.shot = -1; return m.shots.length; } };

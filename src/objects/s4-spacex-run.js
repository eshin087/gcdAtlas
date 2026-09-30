// ================================================================ SpaceX launches (3): the director (clocks, real launches, replays, the caption) and the launch camera
// LENS.k narrows the field of view (a telephoto lens for the tracking shots); 09-render.js applies it to tanX / tanY every tick.
// The launch camera (LCAM) never cuts (owner, 0.9.8: the cuts were abrupt). Each shot gives a pose (eye, aim, up, lens) in Earth-fixed km;
// when the shot changes, the camera blends from the pose it had (which keeps moving with the stage it was on) into the new one over about
// 3 s of real time: the aim slides, the direction swings round it, the distance and the lens ease in log space, and when the two subjects are
// far apart the camera pulls back on the way so both stay in view. Picking a rocket flies the camera straight into the first shot's pose
// (shotVP), and the launch camera takes over from exactly there with a slow zoom.
const LENS = { k:1, want:1 };
const LCAM = { on:false, run:null, shot:-1, focus:null, eo:null, lo:null, from:null, bt:0, bT:3, endT:0, st:0 };
// the part a shot looks at (the camera's focus), and the Earth-fixed point of a shot's eye or look spec
const center = o => V.add(o.sx.st.base, V.mul(o.sx.st.axis, o.sx.def.len*0.5e-3));
function specPart(run, spec){ return spec && (spec[0] === 'part' || spec[0] === 'traj' || spec[0] === 'body') ? famPart(run.mis.fam, spec[1]) : null; }
function specPoint(run, spec){
  const k = spec[0];
  if (k === 'site'){ const S = siteOf(spec[1], run), m = typeof spec[2] === 'string' ? S.air[spec[2]] : spec[2]; return V.add(S.p, V.mul(M3.apply(S.F.M, m), 1e-3)); }
  if (k === 'traj'){ const o = famPart(run.mis.fam, spec[1]), st = o.sx.st, [l, u, f] = spec[2]; return V.add(center(o), V.add(V.mul(st.left, l*1e-3), V.add(V.mul(st.up, u*1e-3), V.mul(st.fwd, f*1e-3)))); }
  if (k === 'part'){ const st = famPart(run.mis.fam, spec[1]).sx.st; return V.add(st.base, V.mul(st.axis, spec[2]*1e-3)); }
  // (a camera fixed to a stage's hull: out from its axis, along the axis above its middle, and across, m, so it stays put as the stage pitches over)
  if (k === 'body'){ const o = famPart(run.mis.fam, spec[1]), st = o.sx.st, B = bodyAxes(o, spec[3]), [l, a, x] = spec[2]; return V.add(center(o), V.add(V.mul(B.L, l*1e-3), V.add(V.mul(st.axis, a*1e-3), V.mul(B.X, x*1e-3)))); }
  if (k === 'iss'){ const I = issFrame(); return V.add(I.c, V.mul(M3.apply(I.M, spec[1]), 1e-3)); }
  if (k === 'mid'){ const I = issFrame(), d = SX.parts.dragon.sx.st; return V.mul(V.add(V.add(I.c, V.mul(M3.apply(I.M, [ISS_PORT, 0, 0]), 1e-3)), V.add(d.base, V.mul(d.axis, 4e-3))), 0.5); }
  return [0, 0, 0];
}
// the axes of a camera fixed to a hull: L out from the axis toward the camera (the stage's left), X across. With 'sun' the camera sits on the
// sunlit side, a third of a right angle round from the Sun so the hull shows its shading, whatever the hour and wherever the stage points
// (on the shaded side the hull read as a flat field of dots); 'sunL' keeps it on the stage's left half (a side booster's outer side)
function bodyAxes(o, sun){
  const st = o.sx.st; let L = st.left;
  if (sun){ const s = sunFixed(), p = V.sub(s, V.mul(st.axis, V.dot(s, st.axis)));
    if (V.len(p) > 0.15){ const n = V.norm(p); L = V.add(V.mul(n, Math.cos(0.55)), V.mul(V.cross(st.axis, n), Math.sin(0.55))); }
    if (sun === 'sunL'){ const d = V.dot(L, st.left); if (d < 0.5){ const t = V.sub(L, V.mul(st.left, d)), tl = V.len(t);
      L = V.add(V.mul(st.left, 0.5), V.mul(tl > 1e-6 ? V.mul(t, 1/tl) : V.cross(st.axis, st.left), Math.sqrt(0.75))); } } }
  return { L, X:V.cross(st.axis, L) };
}
const shotIndex = run => { const S = run.mis.shots; let i = 0; for (let j=0;j<S.length;j++) if (run.mt >= S[j].t) i = j; return i; };
function shotFocus(run, sh){ if (sh.focus) return famPart(run.mis.fam, sh.focus); return specPart(run, sh.look) || specPart(run, sh.eye) || (run.mis.fam === 'f9' && run.key === 'dragon' ? SX.parts.dragon : SX.parts[FAM[run.mis.fam].parts[0].key]); }
const watchPart = run => shotFocus(run, run.mis.shots[shotIndex(run)]);
// a shot's pose now: eye, aim (Earth-fixed km), up and lens. Up is the local vertical at the eye, or for a camera on a hull looking down
// along it (up 'side') across the hull, so the hull runs down the right of the picture, clear of the info panel
function launchPose(run, sh){
  const eye = specPoint(run, sh.eye), look = specPoint(run, sh.look), dist = Math.max(V.len(V.sub(look, eye))*1000, 1);
  const lens = clamp(typeof sh.lens === 'number' ? sh.lens : Array.isArray(sh.lens) ? sh.lens[2]*2*Math.tan(cam.fovY/2)*dist/sh.lens[1] : 1, 1, 16);
  const up = sh.up === 'side' ? V.mul(bodyAxes(shotFocus(run, sh), sh.eye[3]).X, -1) : V.norm(eye);
  return { eye, look, up, lens };
}
// a shot that moves (the aerial view of the countdown): from its own pose to its 'to' pose over 'move' seconds of real time, easing in and
// out, then circling its aim slowly ('drift', radians a second) for as long as it lasts (a live launch can hold it for many minutes)
function movePose(run, sh, t){
  let q = launchPose(run, sh);
  if (!sh.to) return q;
  const mv = sh.move || 10;
  q = blendPose(q, launchPose(run, Object.assign({}, sh, sh.to)), smoother(clamp(t/mv, 0, 1)));
  if (sh.drift && t > mv){ const a = sh.drift*(t - mv), u = V.norm(q.look), v = V.sub(q.eye, q.look), c = Math.cos(a), s = Math.sin(a);
    q.eye = V.add(q.look, V.add(V.add(V.mul(v, c), V.mul(V.cross(u, v), s)), V.mul(u, V.dot(u, v)*(1 - c)))); }
  return q;
}
// the camera as it is now, in the same terms (for a blend that starts from wherever the camera happens to be)
function camPose(){
  const toF = w => V.mul(M3.applyT(earth.rot, w), 1/KM), e = V.sub(cam.rel, frel(earth)), d = Math.max(V.len(V.sub(orbit.target || [0, 0, 0], cam.rel)), MET*50);
  const eye = toF(e);
  return { eye, look:V.add(eye, V.mul(M3.applyT(earth.rot, cam.fwd), d/KM)), up:V.norm(M3.applyT(earth.rot, cam.up)), lens:LENS.k };
}
const slerpN = (a, b, e) => { const d = clamp(V.dot(a, b), -1, 1), w = Math.acos(d); if (w < 1e-4) return V.norm(V.lerp(a, b, e)); const s = Math.sin(w); return V.norm(V.add(V.mul(a, Math.sin((1 - e)*w)/s), V.mul(b, Math.sin(e*w)/s))); };
const smoother = x => x*x*x*(x*(x*6 - 15) + 10);
function blendPose(A, B, e){
  const dA = V.sub(A.eye, A.look), dB = V.sub(B.eye, B.look), la = Math.max(V.len(dA), 1e-6), lb = Math.max(V.len(dB), 1e-6);
  const look = V.lerp(A.look, B.look, e), gap = V.len(V.sub(A.look, B.look)), hA = V.len(A.eye) - RE_KM, hB = V.len(B.eye) - RE_KM;
  let eye;
  // two cameras on the ground: the camera travels along the ground from one to the other (swinging round the subject, it went underground)
  if (hA < 0.15 && hB < 0.15) eye = V.lerp(A.eye, B.eye, e);
  else {
    // (between far-apart subjects the camera widens on the way, so neither leaves the picture)
    const dist = Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la))*e) + gap*0.7*Math.sin(Math.PI*e);
    eye = V.add(look, V.mul(slerpN(V.mul(dA, 1/la), V.mul(dB, 1/lb), e), dist));
  }
  // (and never lower than the lower of the two)
  const r = V.len(eye), rMin = RE_KM + Math.min(hA, hB);
  if (r < rMin) eye = V.mul(eye, rMin/r);
  return { eye, look, up:V.norm(V.lerp(A.up, B.up, e)), lens:Math.exp(Math.log(A.lens) + (Math.log(B.lens) - Math.log(A.lens))*e) };
}
// into or out of a camera fixed to a hull the camera swings round the stage's axis instead: round it, along it and in or out from it (in log
// steps), reaching the hull's height before it closes in and leaving it only once clear, so it never passes through the stage or its plume
function blendRound(A, B, e, c, ax){
  const u = V.norm(V.cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = V.cross(ax, u);
  const cyl = P => { const w = V.sub(P, c), z = V.dot(w, ax), q = V.sub(w, V.mul(ax, z)); return { z, r:Math.max(V.len(q), 1e-6), t:Math.atan2(V.dot(q, v), V.dot(q, u)) }; };
  const a = cyl(A.eye), b = cyl(B.eye), inward = b.r < a.r;
  let dt = b.t - a.t; dt -= Math.round(dt/(2*Math.PI))*2*Math.PI;
  const er = inward ? e*e : 1 - (1 - e)*(1 - e), ez = inward ? 1 - (1 - e)*(1 - e) : e*e;
  const z = a.z + (b.z - a.z)*ez, r = Math.exp(Math.log(a.r) + (Math.log(b.r) - Math.log(a.r))*er), t = a.t + dt*e;
  const eye = V.add(c, V.add(V.mul(ax, z), V.mul(V.add(V.mul(u, Math.cos(t)), V.mul(v, Math.sin(t))), r)));
  return { eye, look:V.lerp(A.look, B.look, e), up:V.norm(V.lerp(A.up, B.up, e)), lens:Math.exp(Math.log(A.lens) + (Math.log(B.lens) - Math.log(A.lens))*e) };
}
function startLaunchCam(run){
  LCAM.from = { F:watchPart(run), rel:null }; LCAM.from.pose = camPose();   // (the blend in starts from the camera as it is)
  LCAM.from.eo = V.sub(LCAM.from.pose.eye, center(LCAM.from.F)); LCAM.from.lo = V.sub(LCAM.from.pose.look, center(LCAM.from.F));
  LCAM.bt = 0; LCAM.bT = 3.2;
  LCAM.on = true; LCAM.run = run; LCAM.shot = shotIndex(run); LCAM.focus = null; LCAM.eo = LCAM.lo = null; LCAM.endT = 0; LCAM.st = 0; run.hold = false; run.seen = true; motion.last = 'launch';
  stopTour(false); pauseShow(); tween = null; flyMove = null; shipCam.on = shipCam.pending = false;
  if (run.mode === 'real') dayTo(realJD() - JD_NOW, 2.5);   // (a live launch is lit by the real Sun: the atlas clock goes to now)
  updateLaunchCam(0); updateModeUI();
}
// (flying off elsewhere only switches it off: the flight has already set the camera, the lock and the info panel)
function stopLaunchCam(quiet, flying){
  if (!LCAM.on) return false;
  LCAM.on = false; LENS.want = 1;
  if (flying){ updateModeUI(); return true; }
  const F = LCAM.focus; motion.last = 'launch';
  // (the camera stays exactly where it is, aimed where it was aimed; the lens eases back to normal)
  if (F && !F.hidden){ orbit.lock = F.index; orbit.frame = camFrameOf(F); orbit.off = LCAM.pose ? V.mul(M3.apply(earth.rot, V.sub(LCAM.pose.look, center(F))), KM) : [0, 0, 0]; orbit.target = orbit.off.slice(); orbit.offFn = null; cam.focus = F.index; syncOrbitFromCam(); setInfo(F.index); }
  updateModeUI();
  return true;
}
function updateLaunchCam(dt){
  const run = LCAM.run; if (!run || !SX.runs.includes(run)){ stopLaunchCam(true); return; }
  const i = shotIndex(run), sh = run.mis.shots[i], F = shotFocus(run, sh);
  if (!F || !F.sx.st) return;
  // (the time since this shot began, for shots that move)
  if (i !== LCAM.shot) LCAM.st = 0; else LCAM.st += dt;
  const Fc = center(F), raw = movePose(run, sh, LCAM.st);
  // a new shot: blend from the camera's last pose, carried along with the stage it was framing
  if (i !== LCAM.shot && LCAM.focus){
    // (a camera standing on the ground or on the station stays where it stands; one flying beside a stage goes on with it)
    const pf = LCAM.focus, pc = center(pf), q = LCAM.pose, ps = run.mis.shots[LCAM.shot], stays = ps && (ps.eye[0] === 'site' || ps.eye[0] === 'iss');
    LCAM.from = { F:pf, eo:V.sub(q.eye, pc), lo:V.sub(q.look, pc), pose:q, stays, body:ps && ps.eye[0] === 'body' }; LCAM.bt = 0; LCAM.bT = sh.blend || 3;
    if (sh.cut){ LCAM.from = null; foldFlash('blink'); }
    LCAM.eo = LCAM.lo = null;
  }
  LCAM.shot = i;
  // within a shot: ground cameras stay put, cameras fixed to a hull move with it, cameras riding beside a stage follow it with a little lag; the aim eases
  let eo = V.sub(raw.eye, Fc), lo = V.sub(raw.look, Fc);
  if (LCAM.eo && LCAM.focus === F && dt > 0){
    const k = sh.eye[0] === 'site' || sh.eye[0] === 'iss' || sh.eye[0] === 'body' ? 1 : 1 - Math.exp(-dt*3/(sh.lag || 1)), kl = 1 - Math.exp(-dt*5);
    eo = V.lerp(LCAM.eo, eo, k); lo = V.lerp(LCAM.lo, lo, kl);
  }
  LCAM.eo = eo; LCAM.lo = lo;
  let pose = { eye:V.add(Fc, eo), look:V.add(Fc, lo), up:raw.up, lens:raw.lens };
  if (LCAM.from){
    LCAM.bt += dt;
    const f = LCAM.from, fc = f.F && f.F.sx && f.F.sx.st ? center(f.F) : null, A = fc && f.eo ? { eye:f.stays ? f.pose.eye : V.add(fc, f.eo), look:V.add(fc, f.lo), up:f.pose ? f.pose.up : raw.up, lens:f.pose ? f.pose.lens : 1 } : f.pose;
    const e = smoother(clamp(LCAM.bt/LCAM.bT, 0, 1)), R = sh.eye[0] === 'body' ? F : f.body ? f.F : null;
    if (A && e < 1) pose = R && R.sx.st ? blendRound(A, pose, e, center(R), R.sx.st.axis) : blendPose(A, pose, e); else LCAM.from = null;
  }
  LCAM.pose = pose;
  if (F !== LCAM.focus && infoObj !== F.index) setInfo(F.index);
  LCAM.focus = F;
  LENS.k = LENS.want = pose.lens;
  cam.focus = F.index;
  cam.rel = V.mul(M3.apply(earth.rot, V.sub(pose.eye, Fc)), KM);
  setBasis(M3.apply(earth.rot, V.norm(V.sub(pose.look, pose.eye))), M3.apply(earth.rot, pose.up));
  orbit.lock = F.index; orbit.frame = camFrameOf(F); orbit.off = V.mul(M3.apply(earth.rot, V.sub(pose.look, Fc)), KM); orbit.offFn = null; orbit.target = orbit.off.slice();
  orbit.dist = orbit.distT = Math.max(V.len(V.sub(cam.rel, orbit.target)), F.rad*0.3);
}
// the flight to a rocket lands on its first shot: the pose a flight needs (yaw, pitch, distance and aim in the stage's frame, the up at the eye),
// worked out again every frame of the flight, as the Earth turns
function shotVP(run){
  const F = watchPart(run), toW = x => V.mul(M3.apply(earth.rot, x), KM);
  const now = () => movePose(run, run.mis.shots[shotIndex(run)], 0);
  const yp = () => { const q = now(), d = M3.applyT(camFrameOf(F), V.norm(toW(V.sub(q.eye, q.look)))); return [Math.atan2(d[0], d[2]), Math.asin(clamp(d[1], -0.999, 0.999))]; };
  const q = now(), [yaw, pitch] = yp(), off = () => toW(V.sub(now().look, center(F)));
  return { F, vp:{ yaw, pitch, dist:V.len(V.sub(q.eye, q.look))*KM, off:off(), offFn:off, up:toW(q.up), upFn:() => V.norm(toW(now().up)), track:yp } };
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
    dayTo(afternoonAt(SXS[run.site]), 4);   // (clicked flights are flown by day, owner 0.9.8: the clock eases to the nearest afternoon at the pad)
  }
  for (const pr of [P.sxStar, P.sxFal, P.sxEnv]) progReady(pr);   // (start compiling now, in the background, so the pad is ready when the camera lands)
  { const D = EDT.siteOfPad(run.site); if (D) EDT.want(D.key); }   // (and fetch the images of the ground there)
  sxFly(run);
}; }
// the flight itself: what lockOn does, but landing on the shot's pose, and the launch camera takes over when it lands
function sxFly(run){
  const { F, vp } = shotVP(run);
  stopTour(false); orbit.offFn = null; show.on = show.pending = false;
  setInfo(F.index);
  SX.pend = { run, part:F, at:GT };
  flyTo(F, vp, () => { if (SX.pend && SX.pend.run === run){ SX.pend = null; startLaunchCam(run); } });
  motion.last = 'launch';
  updateModeUI();
}
function sxWatch(run){ if (!run) return; hideHint(); if (cmp) endCompare(false); sxFly(run); }
// play after a pause: follow the flight again, or fly it again once it is over
function sxResume(){
  const o = OBJ[orbit.lock]; if (!o || !o.sx) return false;
  const run = famRun(o.sx.fam);
  if (run && !run.ended){ startLaunchCam(run); return true; }
  lockOn(o.index); return true;
}
// ---------------------------------------------------------------- daylight: the atlas clock eases to a moment (days from the page's start), over a few seconds
const DAY = { from:0, to:0, t:0, T:0 };
function dayTo(target, T){ DAY.from = ssDays; DAY.to = target; DAY.t = 0; DAY.T = Math.max(T, 0.01); }
function sunUpAt(S, days){ const d0 = ssDays; ssDays = days; earth.update(0); const e = V.dot(sunFixed(), S.up); ssDays = d0; earth.update(0); return e; }
// the moment nearest the atlas clock's (within half a day either way) when the Sun stands about 35 degrees up in the afternoon at a site
function afternoonAt(S){
  let best = ssDays, bd = 1e9;
  for (let k=-48;k<=48;k++){ const t = ssDays + k/96, e = sunUpAt(S, t), e2 = sunUpAt(S, t + 0.004);
    const d = Math.abs(Math.asin(e)/DEG - 35) + (e2 < e ? 0 : 60) + Math.abs(k)*0.02; if (d < bd){ bd = d; best = t; } }
  return best;
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
// ---------------------------------------------------------------- the atmosphere: near the ground the sky hides what lies beyond the Solar System (ATM.k: 1 on the ground, 0 above
// about 90 km), read by render() and updateLabels() in 09-render.js; the planetarium ("your sky") keeps the whole sky
const ATM = { k:0 };
// ---------------------------------------------------------------- the director, once a tick (after Earth has turned, before the camera)
const SXD = addObj({ key:'sx-director', name:'launch director', type:'', group:'travel', parent:earth, offset:[0, 0, 0], rad:1*MET, hidden:true, noPick:true, atlas:false, noLabel:true, noTour:true, noImpostor:true,
  update(dt){ if (FLAGS.spacex) sxTick(dt); } });
let SX_T = 0, sxRatePrev = null;
// playback speed: the mission's highlights (sped up in the quiet parts), or real time (the real-speed button, SET.launchReal)
const runRate = run => run.mode === 'real' || (SET.launchReal && LCAM.on && LCAM.run === run) ? 1 : stepRate(run.mis.rate, run.mt);
function sxTick(dt){
  SX_T += dt;
  const now = Date.now();
  EDT.tick();
  // the atlas clock easing to a daytime moment
  if (DAY.T > 0){ DAY.t += dt; const e = smoother(clamp(DAY.t/DAY.T, 0, 1)); ssDays = DAY.from + (DAY.to - DAY.from)*e; if (e >= 1) DAY.T = 0; earth.update(0); }
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
      run.mt += dt*runRate(run);
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
  // the flight to a rocket was interrupted (another flight, a drag): nothing to wait for
  if (SX.pend && (!SX.runs.includes(SX.pend.run) || (!flight && GT - SX.pend.at > 1.5))) SX.pend = null;
  // a flight you watch ends: a moment on the last shot, then the camera is yours
  if (LCAM.on && LCAM.run.ended){ LCAM.endT += dt; if (LCAM.endT > 5){ stopLaunchCam(true); toast('the flight is over · drag to look round · press play to watch it again'); } }
  // replays now and then while you look at Earth: from a pad on the side you see, in daylight
  const atEarth = (orbit.lock === earth.index || (tour.on && tour.obj === earth.index)) && orbit.dist < earth.rad*14 && !SKYV.on && !flight;
  if (atEarth && SX_T > SX.nextReplay && !LCAM.on && !SX.runs.some(r => r.mode !== 'real' || r.mt < 600)){
    const cf = V.norm(camFixed()), sun = sunFixed(), seen = k => V.dot(SXS[k].up, cf) > 0.3 && V.dot(SXS[k].up, sun) > 0.25;
    const opts = [['starship', {}, 0.34], ['falcon9', {}, 0.2], ['falcon9', { site:'slc4e', az:165 }, 0.1], ['dragon', {}, 0.18], ['falconheavy', {}, 0.18]].filter(([k, o]) => seen(o.site || MIS[k].site) && !famRun(MIS[k].fam));
    if (opts.length){ let x = Math.random()*opts.reduce((a, o) => a + o[2], 0), pick = opts[0]; for (const o of opts){ x -= o[2]; if (x <= 0){ pick = o; break; } }
      const r = newRun(pick[0], 'replay', pick[1]); r.mt = -8; SX.nextReplay = SX_T + 150 + Math.random()*110; }
    else SX.nextReplay = SX_T + 15;
  }
  if (!atEarth && SX.nextReplay < SX_T + 20) SX.nextReplay = SX_T + 20;
  // the caption: what is flying, with a button to watch it (while you watch: the button switches between highlights and real speed)
  LCAP.txt = ''; LCAP.btn = ''; LCAP.go = null; LCAP.live = false;
  if (LCAM.on){ const r = LCAM.run, real = r.mode !== 'real' && SET.launchReal;
    LCAP.txt = `${r.mis.name} · ${r.mode === 'real' ? 'live' : real ? 'replay at real speed' : 'replay'}${eventNow(r) ? ' · ' + eventNow(r) : ''} · ${clk(r.mt)}`;
    if (r.mode !== 'real'){ LCAP.btn = SET.launchReal ? 'highlights' : 'real speed'; LCAP.go = () => { setOpt('launchReal', !SET.launchReal, true); toast(SET.launchReal ? 'real speed: every second as it happens (a Starship flight takes about 9 minutes)' : 'highlights: the quiet parts sped up'); }; } }
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
  if (!LCAM.on){ const lk = 1 - Math.exp(-dt*2); LENS.k = Math.exp(Math.log(LENS.k)*(1 - lk)); }
  // the atmosphere over the camera
  { const cf = camFixed(), alt = V.len(cf) - RE_KM; ATM.k = SKYV.on || !(alt < 120) ? 0 : 1 - smooth(25, 90, alt); }
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
  DAY.T = 0; ssDays += 1;
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
function eventNow(run){ let e = ''; for (const [t, s] of run.mis.events) if (run.mt >= t && run.mt - t < (run.mode === 'real' ? 40 : 30)) e = s; return e === '@site' ? SXS[run.site].name : e; }
// ---------------------------------------------------------------- the numbers in the info panel
const SX_IDLE = {
  star:'standing on the launch mount at Starbase, Texas · about 120 m tall with Super Heavy\npick it to launch: the countdown starts when the camera arrives',
  f9:'standing on its pad at Cape Canaveral · 70 m tall\npick it to launch: the countdown starts when the camera arrives',
  fh:'standing on Launch Complex 39A at Kennedy · 70 m tall, 12 m wide\npick it to launch: the countdown starts when the camera arrives',
};
function sxReadout(o){ const t = sxReadout0(o), c = EDT.creditNow(); return c ? t + '\n' + c : t; }
function sxReadout0(o){
  const st = o.sx.st, run = famRun(o.sx.fam);
  if (o.key === 'dragon' && (!run || run.key !== 'dragon' || run.mt < -9)) return st && st.atISS && (!run || run.key !== 'dragon') ? 'docked at the station\'s forward port (illustrative: a Dragon is often there)\npick it to fly a whole mission: launch from Cape Canaveral, then docking' : 'pick it to fly a whole mission: launch, then docking at the ISS';
  if (!run || !st) return SX_IDLE[o.sx.fam] || '';
  const mt = run.mt, ev = eventNow(run);
  const hon = run.mode === 'real' ? 'live: SpaceX\'s launch at its scheduled time (Launch Library 2), drawn by the atlas; the real one can slip' : SET.launchReal && LCAM.on ? 'illustrative: the path and timings are modelled on real flights, played at real speed' : 'illustrative: the path and timings are modelled on real flights, sped up in the quiet parts';
  if (mt < 0) return `${clk(mt)}${ev && ev !== SXS[run.site].name ? ' · ' + ev : ''} · ${SXS[run.site].name}\n${hon}`;
  if (st.atISS) return `${clk(mt)}${ev ? ' · ' + ev : ''}\n${st.dist > 1 ? Math.round(st.dist) + ' m from the docking port' : 'docked'} · the station orbits 420 km up at 28,000 km/h\n${hon}`;
  const alt = st.alt, sp = st.speed*3600;
  const altS = alt < 1 ? Math.round(alt*1000) + ' m' : (alt < 10 ? alt.toFixed(1) : Math.round(alt)) + ' km';
  return `${clk(mt)}${ev ? ' · ' + ev : ''}\naltitude ${altS} · ${Math.round(sp).toLocaleString('en-US')} km/h · ${Math.round(Math.max(st.s || 0, 0)).toLocaleString('en-US')} km downrange\n${hon}`;
}
const SXDBG = { SX, MIS, LCAM, LENS, ATM, DAY, EDT, shotVP, launchPose, camPose, famRun, newRun, endRun, sxEval, buildClusters, plumeOf, watch:sxWatch, rd:roadsterEq, afternoonAt:k => afternoonAt(SXS[k]),
  // (tests: move the Solar System clock until the Sun stands at elevation el degrees over a site, rising (am) or setting)
  sunAt(site, el, am = true){ DAY.T = 0; const S = SXS[site] || SX_DS[site]; let best = 0, bd = 1e9; for (let h=0;h<24*4;h++){ ssDays = realJD() - JD_NOW + h/96; earth.update(0); const e = Math.asin(V.dot(sunFixed(), S.up))/DEG, e2 = (ssDays += 0.01, earth.update(0), Math.asin(V.dot(sunFixed(), S.up))/DEG); ssDays -= 0.01; const d = Math.abs(e - el) + ((e2 > e) === am ? 0 : 100); if (d < bd){ bd = d; best = ssDays; } } ssDays = best; earth.update(0); return +(Math.asin(V.dot(sunFixed(), S.up))/DEG).toFixed(1); },
  start(key, mode = 'replay', mt = 0, opt = {}){ const r = newRun(key, mode, Object.assign({ mt }, opt)); r.hold = false; buildClusters(); return r; },
  setMt(key, mt){ const r = famRun(MIS[key].fam); if (r){ const j = r.mis.jump; if (j && r.mt < j[1] && mt >= j[1] && r.key === 'dragon') dockInDaylight(); r.mt = mt; r.hold = false; r.ended = false; sxEval(r); buildClusters(); } return !!r; },
  camNow(key){ const r = famRun(MIS[key].fam); if (r){ startLaunchCam(r); LCAM.from = null; updateLaunchCam(0); } return !!r; },
  // (tests: how long a mission plays, in seconds, at its highlights speed)
  playLength(key){ const m = MIS[key]; let t = -20.5, s = 0; while (t < m.end){ if (m.jump && t >= m.jump[0] && t < m.jump[1]) t = m.jump[1]; const r = stepRate(m.rate, t); t += r/60; s += 1/60; } return Math.round(s); },
  // (tests: look at Earth from k Earth radii straight above a site)
  orbitOver(site, k = 3){ const S = SXS[site]; lockOn(earth.index); flight = null; show.on = show.pending = false; orbit.lock = earth.index; cam.focus = earth.index; orbit.frame = camFrameOf(earth); const d = M3.applyT(orbit.frame, M3.apply(earth.rot, S.up)); orbit.yaw = Math.atan2(d[0], d[2]); orbit.pitch = Math.asin(d[1]); orbit.dist = orbit.distT = earth.rad*k; orbit.off = [0, 0, 0]; orbit.target = [0, 0, 0]; applyOrbit(); return 1; },
  // (tests: replace a mission's camera by one shot from now on, or put its own shots back)
  shot(key, sh){ const m = MIS[key]; if (!m._shots) m._shots = m.shots; m.shots = sh ? [Object.assign({ t:-1e9 }, sh)] : m._shots; LCAM.shot = -1; return m.shots.length; } };

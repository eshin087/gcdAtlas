
// ================================================================ the Halo at work (0.8.0). All of it is fictional, and its readout says so.
// Travel: a short hop (around a planet, across the Solar System, to a neighbouring star) is a light-speed cruise: the stars stretch into
// streaks and the ship shoots off along a straight line. A long hop is a fold through space: the drive spools up, space swirls in, the ship
// collapses into a point and bursts out at the other end.
// Visits: each one is a single smooth pass. The ship flies in, does one job on the way past (a sensor scan, a photo trip by Pip, its drone, a weapons test,
// a skim through a gas giant or a star, a tractor beam and drill on a passing rock), turns toward its next stop while still moving, and goes.
// It never stops and never turns on the spot.
// Precision: at the scale of a galaxy a float64 offset from the target is only good to ~100 km, so anything that must sit near the 2.5 km
// ship (beams leaving it, Pip at launch and docking, the rock, sparks) is kept relative to the ship; things near the target (hits,
// explosions) relative to the target.
const HALO = { LS_NEAR:100, LS_FAR:3e4, LS_P:0.35, MAXBEND:1.4, TURN:0.42, T_FAST:10, FOLD_SPOOL:2.8, LS_SPOOL:1.7, FOLD_T:0.4, EMERGE:0.5 };
// per job: how long it lasts (s), how much the ship slows for it, where on the pass it happens (share of the path); and the framing while it
// works: how much of it applies (view), how far the ship banks (bank), how far the trailing camera turns toward the body (turn), and where
// the lock-on and chase cameras aim (aim, chaseAim: ship axes in ship radii, x below the belly, y ahead, z to the side it banks toward)
const ACTS = { scan:{ T:11, rho:0.3, fc:0.47, view:1, bank:1, turn:1, aim:[0.6, 0, 0], chaseAim:[0.9, -1.2, 0] },
  probe:{ T:12.5, rho:0.28, fc:0.45, view:0.85, bank:1, turn:1, aim:[0.6, 0, 0], chaseAim:[0.9, -1.2, 0] },
  weapons:{ T:11.5, rho:0.3, fc:0.42, view:1, bank:1, turn:1, aim:[0.6, 0, 0], chaseAim:[0.9, -1.2, 0] },
  skim:{ T:9, rho:0.5, fc:0.5, view:0.4, bank:0.5, turn:1, aim:[0.3, 0, 0], chaseAim:[0.3, 0, 0] },
  tractor:{ T:14, rho:0.25, fc:0.45, view:0.9, bank:0.3, turn:0, aim:[0.2, 0.3, 0.8], chaseAim:[0.3, -0.9, 1.0] } };
const SKIM = new Set(['jupiter', 'sun', 'betelgeuse', 'antares', 'alphacen', 'proxima', 'sirius', 'trappist1']);   // gas giants and stars (Saturn's rings are in the way)
const SURF_K = { halley:0.62 };   // bodies drawn without a solid radius of their own: the solid share of the bounding sphere
const CYAN = [0.45, 0.9, 1], TEAL = [0.45, 1, 0.75], WHITE = [1, 1, 1];
// points on the hull (the ship's own frame, in ship radii: +y forward, -x dorsal, +x the belly), matching FS_SHIP in 07-extras.js:
// the working gear on the belly pod under the bow, the gun at the needle's tip and a turret under the bow, the heart, the left engine's nozzle
const HULL = { scan:[0.066, 0.2, 0], tractor:[0.07, -0.02, 0], drill:[0.07, 0.08, 0.02], bay:[0.064, -0.1, 0], dock:[0.06, -0.1, 0],
  gun:[0, 0.85, 0], turret:[0.04, 0.38, 0], core:[0, -0.3, 0], nozzle:[-0.04, -0.84, 0.287] };

// ---------------------------------------------------------------- small geometry
const angleOf = (a, b) => Math.acos(clamp(V.dot(a, b), -1, 1));
function anyPerp(a){ const t = Math.abs(a[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0]; return V.norm(V.cross(a, t)); }
function rotToward(a, b, ang){ let ax = V.cross(a, b); ax = V.len(ax) > 1e-9 ? V.norm(ax) : anyPerp(a); return V.add(V.mul(a, Math.cos(ang)), V.mul(V.cross(ax, a), Math.sin(ang))); }
const perpTo = (v, h) => V.sub(v, V.mul(h, V.dot(v, h)));
function lcg(seed){ let s = (seed*2654435761) >>> 0; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; }
function rdir(r){ const z = r()*2 - 1, a = r()*6.2831853, q = Math.sqrt(1 - z*z); return [q*Math.cos(a), z, q*Math.sin(a)]; }
function bz(P, s){ const u = 1 - s, a = u*u*u, b = 3*u*u*s, c = 3*u*s*s, d = s*s*s;
  return [a*P[0][0] + b*P[1][0] + c*P[2][0] + d*P[3][0], a*P[0][1] + b*P[1][1] + c*P[2][1] + d*P[3][1], a*P[0][2] + b*P[1][2] + c*P[2][2] + d*P[3][2]]; }
function bzd(P, s){ const u = 1 - s, a = -3*u*u, b = 3*u*u - 6*u*s, c = 6*u*s - 3*s*s, d = 3*s*s;
  return [a*P[0][0] + b*P[1][0] + c*P[2][0] + d*P[3][0], a*P[0][1] + b*P[1][1] + c*P[2][1] + d*P[3][1], a*P[0][2] + b*P[1][2] + c*P[2][2] + d*P[3][2]]; }
// first hit of a ray (origin o, unit direction d) on a sphere (centre c, radius r); -1 when it misses or starts inside
function raySphere(o, d, c, r){ const oc = V.sub(o, c), b = V.dot(oc, d), h = b*b - V.dot(oc, oc) + r*r; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; }
// hidden behind a sphere (centre c, radius r, camera-relative) as seen from the camera
function behindSphere(p, c, r){
  const pl = V.len(p); if (!(pl > 0) || !(r > 0)) return false;
  const b = V.dot(p, c)/pl, h = b*b - V.dot(c, c) + r*r; if (h <= 0) return false;
  const t0 = b - Math.sqrt(h); return t0 > 0 && t0 < pl - r*0.004;
}
// in the picture: in front of the camera and inside the view (1 = the edge), and on a phone above the card that covers the bottom of the screen
function onScreen(p, m = 0.95){ const z = V.dot(p, cam.fwd); if (!(z > 0)) return false; const y = V.dot(p, cam.up)/(z*tanY); return Math.abs(V.dot(p, cam.right)/(z*tanX)) < m && y < m && y > (isCompact() ? -0.45 : -m); }
// the outline of one arm (ship radii; y along the ship, w = |z|): the same crescent as armPlan in the ship's shader
function inArm(y, w){
  const vy = y + 0.567, vw = w + 0.33, u = (Math.atan2(vw, vy) - 0.698)/1.1; if (u < 0 || u > 1) return false;
  const r = Math.hypot(vy, vw), Ro = 0.68 + 0.012*Math.exp(-(u - 0.3)*(u - 0.3)*25), cf = Math.max(1 - (0.508 - u)/0.1, 0), cr = Math.max(1 - (u - 0.508)/0.2, 0);
  return r < Ro && r > Ro - 0.089*smooth(0, 0.45, u)*(1 - smooth(0.68, 1, u)) - 0.063*(u < 0.508 ? cf*Math.sqrt(cf) : cr*cr);
}
// hidden behind the ship's own hull, as seen from the camera: the bow (an ellipsoid round it), the arms (where the line crosses their nearly
// flat plane, inside the crescent) and the heart
function behindHull(p){
  if (!(ship.rpx > 10) || ship.S.scale < 0.5) return false;
  const s = ship.rad*ship.S.scale, R = ship.R0, o = M3.applyT(R, V.mul(ship.rel, -1/s)), q = M3.applyT(R, V.mul(V.sub(p, ship.rel), 1/s)), d = V.sub(q, o);
  const E = [0.055, 0.54, 0.1], oe = [o[0]/E[0], (o[1] - 0.32)/E[1], o[2]/E[2]], de = [d[0]/E[0], d[1]/E[1], d[2]/E[2]];
  const a = V.dot(de, de), b = V.dot(oe, de), c = V.dot(oe, oe) - 1, h = b*b - a*c;
  // (in a fold only the cells still there hide anything)
  if (h > 0){ const t = (-b - Math.sqrt(h))/a; if (t > 0 && t < 0.995 && liveCell(o[1] + d[1]*t, o[2] + d[2]*t)) return true; }
  if (Math.abs(d[0]) > 1e-12){ const t = (-0.02 - o[0])/d[0]; if (t > 0 && t < 0.995 && inArm(o[1] + d[1]*t, Math.abs(o[2] + d[2]*t)) && liveCell(o[1] + d[1]*t, o[2] + d[2]*t)) return true; }
  const oc = V.sub(o, HULL.core), dd = V.dot(d, d), bc = V.dot(oc, d), hc = bc*bc - dd*(V.dot(oc, oc) - 0.0016);
  if (hc > 0){ const t = (-bc - Math.sqrt(hc))/dd; if (t > 0 && t < 0.995) return true; }
  return false;
}

// ---------------------------------------------------------------- what the ship can touch
// the radius of the surface: a planet's or star's, a black hole's shadow; 0 for a cloud (nebula, cluster, galaxy)
const surfOf = tg => tg.holeR || (tg.solid ? tg.rad*tg.solid : SURF_K[tg.key] ? tg.rad*SURF_K[tg.key] : 0);
// the same as drawn right now (planets are enlarged in the Solar System overview)
const surfDrawn = tg => tg.holeR || surfOf(tg)*magOf(tg);
// a cloud has no surface: beams, shots and the probe aim at its heart
const heartOf = tg => tg.rad*(tg.layer < 3 ? 0.06 : 0.1)*magOf(tg);
// the sphere to aim at (drawn size), and whether it is a surface
const aimSphere = tg => { const s = surfDrawn(tg); return s > 0 ? { r:s, solid:!tg.holeR, hole:!!tg.holeR } : { r:heartOf(tg), solid:false, hole:false, cloud:true }; };
function passR(tg, act){
  const s = surfOf(tg);
  if (act === 'skim') return s*1.07;   // just above the cloud tops or the photosphere
  const k = act === 'weapons' ? 1.15 : act === 'scan' ? 1 : 1.08;
  if (tg.layer < 3) return tg.rad*1.05*k;   // a galaxy: along its edge
  return Math.max(s*2.3, tg.rad*1.35)*k;
}

// ---------------------------------------------------------------- where next, and how
// (the dice for its choices: where next, how, which job, which side it banks to. On the site they are the shared rnd(); a test gives them
// a sequence of their own with dbg.reset, so the ship flies the same route on every run)
let hrnd = rnd;
function travelMode(A, B){
  if (S_.force.travel){ const m = S_.force.travel; S_.force.travel = null; return m; }
  const D = V.len(V.sub(B.pos, A.pos));
  if (D < HALO.LS_NEAR || D < 1.2*Math.max(A.rad, B.rad)) return 'light';
  if (D < HALO.LS_FAR && V.len(A.pos) < 6e4 && V.len(B.pos) < 6e4 && hrnd() < HALO.LS_P) return 'light';
  return 'fold';
}
function pickNext(from){
  if (S_.force.target){ const t = BYKEY[S_.force.target]; S_.force.target = null; if (t && t !== from) return t; }
  const c = OBJ[tour.on ? tour.obj : (orbit.lock >= 0 ? orbit.lock : cam.focus)];
  if (c && c !== ship && c !== from && SHIP_TARGETS.includes(c.key) && hrnd() < 0.45) return c;
  const all = SHIP_TARGETS.map(k => BYKEY[k]).filter(o => o && o !== from);
  const near = all.filter(o => V.len(V.sub(o.pos, from.pos)) < HALO.LS_NEAR);
  if (near.length && hrnd() < 0.5) return near[Math.floor(hrnd()*near.length)];
  return all[Math.floor(hrnd()*all.length)];
}
const actBag = [];
function chooseAct(tg){
  if (S_.force.act){ const a = S_.force.act; S_.force.act = null; return a; }
  if (SKIM.has(tg.key) && S_.visits - S_.lastSkim > 2 && hrnd() < 0.6){ S_.lastSkim = S_.visits; return 'skim'; }
  if (!actBag.length){ const b = ['scan', 'probe', 'weapons', 'tractor']; for (let i=b.length - 1;i>0;i--){ const j = Math.floor(hrnd()*(i + 1)); [b[i], b[j]] = [b[j], b[i]]; } actBag.push(...b); }
  let a = actBag.shift();
  if (a === S_.lastAct && actBag.length){ actBag.push(a); a = actBag.shift(); }
  return a;
}

// ---------------------------------------------------------------- one pass: a cubic Bezier that comes in along dIn, bends round the target and leaves along dOut,
// its closest approach exactly Rc from the centre. A bend sharper than MAXBEND is finished after the pass, on a wide arc.
function minR(P){
  let best = 1e300, bs = 0;
  for (let i=0;i<=48;i++){ const r = V.len(bz(P, i/48)); if (r < best){ best = r; bs = i/48; } }
  let lo = Math.max(bs - 1/48, 0), hi = Math.min(bs + 1/48, 1);
  for (let k=0;k<16;k++){ const m1 = lo + (hi - lo)/3, m2 = hi - (hi - lo)/3; if (V.len(bz(P, m1)) < V.len(bz(P, m2))) hi = m2; else lo = m1; }
  const s = (lo + hi)/2; return { r:V.len(bz(P, s)), s };
}
function bend(di, dout, Rc, L1, L2, mPref){
  let phi = angleOf(di, dout), clamped = false;
  if (phi > HALO.MAXBEND){ dout = rotToward(di, dout, HALO.MAXBEND); phi = HALO.MAXBEND; clamped = true; }
  let h = V.add(di, dout); h = V.len(h) > 1e-6 ? V.norm(h) : anyPerp(di);
  let n;
  if (phi < 0.3){ const m = perpTo(mPref, h); n = V.len(m) > 1e-6 ? V.mul(V.norm(m), -1) : anyPerp(h); }   // nearly straight: pass on the preferred side
  else { n = perpTo(V.sub(dout, di), h); n = V.len(n) > 1e-9 ? V.norm(n) : anyPerp(h); }
  let Rq = Rc, P = null, m = null;
  for (let it=0;it<7;it++){
    const Q = V.mul(n, -(Rq + Math.sin(phi/2)*(L1 - 0.75*L2)));
    const P0 = V.sub(Q, V.mul(di, L1)), P3 = V.add(Q, V.mul(dout, L1));
    P = [P0, V.add(P0, V.mul(di, L2)), V.sub(P3, V.mul(dout, L2)), P3];
    m = minR(P); if (Math.abs(m.r - Rc) < Rc*0.002) break;
    Rq = Math.max(Rq + Rc - m.r, Rc*0.2);
  }
  return { P, dout, phi, clamped };
}
function planVisit(tg, arrival, dIn, next, act, seed){
  const A = ACTS[act], r = lcg(seed);
  const Rc = passR(tg, act), L1 = act === 'skim' ? Math.max(Rc*3.5, tg.rad*1.2) : Rc*4, L2 = L1*0.55;
  // bodies in the Solar System are lit by the Sun: do the job over their day side. Leaving by light speed, the pass should end
  // heading roughly toward the next stop (the rest of the turn is done on a wide arc after it).
  const sunD = tg !== sun && V.len(tg.pos) < 0.01 ? V.norm(V.mul(tg.pos, -1)) : null;
  const dNext = next && next.mode === 'light' ? V.norm(V.sub(next.tg.pos, tg.pos)) : null;
  // candidates are built round the point of closest approach m (on the day side when there is one): a pass bending by 2*sg comes in
  // along di = cos(sg) h + sin(sg) m and leaves along dout = cos(sg) h - sin(sg) m, for some h at right angles to m
  let best = null, bs = -1e9;
  for (let k=0;k<20;k++){
    const sg = 0.25 + 0.4*r(), ss = Math.sin(sg), cs = Math.cos(sg), mPref = sunD ? V.norm(V.add(sunD, V.mul(rdir(r), 0.5))) : rdir(r);
    const side = a => { const w = perpTo(mPref, a); return V.len(w) > 1e-6 ? V.norm(w) : anyPerp(a); };
    let di, dout;
    if (dIn){ di = dIn; const m = V.add(V.mul(di, ss), V.mul(side(di), cs)); dout = V.sub(di, V.mul(m, 2*ss)); }
    else if (dNext && k % 2 === 0){ dout = dNext; const m = V.add(V.mul(dout, -ss), V.mul(side(dout), cs)); di = V.add(dout, V.mul(m, 2*ss)); }
    else { const h0 = V.norm(perpTo(rdir(r), mPref)); di = V.add(V.mul(h0, cs), V.mul(mPref, ss)); dout = V.sub(V.mul(h0, cs), V.mul(mPref, ss)); }
    const b = bend(di, dout, Rc, L1, L2, mPref);
    let day = 0; if (sunD) for (let j=0;j<5;j++) day += V.dot(V.norm(bz(b.P, 0.3 + 0.1*j)), sunD)/5;
    const sc = -Math.abs(b.phi - 0.9) - (b.clamped ? 0.3 : 0) + 2*day - (dNext ? 0.9*angleOf(b.dout, dNext) : 0);
    if (sc > bs){ bs = sc; best = Object.assign(b, { di }); }
  }
  const P = best.P, N = 96, arcL = new Float64Array(N + 1);
  let prev = bz(P, 0), acc = 0;
  for (let i=1;i<=N;i++){ const q = bz(P, i/N); acc += V.len(V.sub(q, prev)); arcL[i] = acc; prev = q; }
  // speed: cruising in and out, slowed down for the job (centred on a share fc of the path), easing up from a fold
  const Tf = HALO.T_FAST, rho = A.rho, Ta = A.T;
  const Tapp = Math.max(A.fc*(Tf + rho*Ta) - rho*Ta/2, 2.5), Tdep = Math.max(Tf - Tapp, 2.5), T = Tapp + Ta + Tdep, tau = 1.3;
  const shape = t => (1 - (1 - rho)*smooth(Tapp - tau, Tapp + tau, t)*(1 - smooth(Tapp + Ta - tau, Tapp + Ta + tau, t)))*(arrival === 'fold' ? 0.35 + 0.65*smooth(0, 2.5, t) : 1);
  const M = 200, D = new Float64Array(M + 1);
  for (let i=1;i<=M;i++){ const t0 = (i - 1)/M*T, t1 = i/M*T; D[i] = D[i - 1] + 0.5*(shape(t0) + shape(t1))*(t1 - t0); }
  const vf = acc/D[M];
  return { tg, act, arrival, P, N, arcL, L:acc, Rc, dIn:best.di, dOut:best.dout, T, tA:Tapp, tB:Tapp + Ta, M, D, vf, shape, v0:vf*shape(0), v1:vf*shape(T), seed };
}
function passAt(pl, t){
  t = clamp(t, 0, pl.T);
  const x = t/pl.T*pl.M, i = Math.min(Math.floor(x), pl.M - 1), f = x - i;
  const d = (pl.D[i] + (pl.D[i + 1] - pl.D[i])*f)*pl.vf, A = pl.arcL;
  let lo = 0, hi = pl.N; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (A[m] < d) lo = m; else hi = m; }
  const s = clamp((lo + (d - A[lo])/Math.max(A[hi] - A[lo], 1e-300))/pl.N, 0, 1);
  return { p:bz(pl.P, s), h:V.norm(bzd(pl.P, s)), v:pl.vf*pl.shape(t), s };
}

// ---------------------------------------------------------------- after the pass: a wide turn toward the next stop (while cruising on), then the jump
function makeAlign(p0, h0, v, h1, Rc){
  const th = angleOf(h0, h1), al = { p0, h0, h1, v, th, om:HALO.TURN, nrm:null, Tt:0 };
  if (th > 0.01){
    al.nrm = V.norm(perpTo(h1, h0));
    // keep the arc well clear of the body: widen it until it is
    for (let k=0;k<5;k++){
      al.Tt = th/al.om; const r = v/al.om; let mn = 1e300;
      for (let i=0;i<=16;i++){ const w = al.om*al.Tt*i/16; mn = Math.min(mn, V.len(V.add(p0, V.mul(V.add(V.mul(h0, Math.sin(w)), V.mul(al.nrm, 1 - Math.cos(w))), r)))); }
      if (mn > Rc*0.85) break; al.om *= 0.65;
    }
    al.Tt = th/al.om;
  }
  return al;
}
function alignAt(al, t){
  if (al.t0) t -= al.t0;   // (a turn that carries on from an earlier one: its clock starts there)
  if (!al.nrm) return { p:V.add(al.p0, V.mul(al.h0, al.v*t)), h:al.h0, v:al.v };
  const r = al.v/al.om, w = al.om*Math.min(t, al.Tt);
  const p = V.add(al.p0, V.mul(V.add(V.mul(al.h0, Math.sin(w)), V.mul(al.nrm, 1 - Math.cos(w))), r)), h = V.add(V.mul(al.h0, Math.cos(w)), V.mul(al.nrm, Math.sin(w)));
  return t <= al.Tt ? { p, h, v:al.v } : { p:V.add(p, V.mul(h, al.v*(t - al.Tt))), h, v:al.v };
}
// the turn before a light-speed jump, aimed at a point T (both relative to the body it is leaving): along a circle of radius v/om to one side,
// until the heading points straight at T (the tangent from the circle to T), then straight on. It turns at its usual rate (HALO.TURN) or
// wider, to stay clear of the body, on whichever side needs less turning. When that is more than half a circle (T close by, inside the circle
// on the near side, as Europa is from a pass at Jupiter) a tighter turn, up to three times as fast, does it in less. Null if nothing fits.
function aimAlign(p0, h0, v, T, Rc){
  const w = V.sub(T, p0), L = V.len(w), n0 = perpTo(w, h0), n1 = V.len(n0) > 1e-9*L ? V.norm(n0) : anyPerp(h0);
  const turn = om => {
    const r = v/om; let best = null;
    for (const n of [n1, V.mul(n1, -1)]){
      // in the plane of h0 and n, with the circle's centre at (0, r): the tangent point is where sin(th - atan2(qy, qx)) = r/|q|
      const qx = V.dot(w, h0), qy = V.dot(w, n) - r, rho = Math.hypot(qx, qy);
      if (!(rho > r*1.0001)) continue;
      const th = ((Math.atan2(qy, qx) + Math.asin(r/rho)) % 6.2831853 + 6.2831853) % 6.2831853;
      const al = { p0, h0, v, om, nrm:n, th, Tt:th/om, h1:V.add(V.mul(h0, Math.cos(th)), V.mul(n, Math.sin(th))) };
      let mn = 1e300; for (let i=0;i<=16;i++) mn = Math.min(mn, V.len(alignAt(al, al.Tt*i/16).p));
      if (mn > Rc*0.85 && (!best || th < best.th)) best = al;
    }
    return best;
  };
  let best = null;
  for (let om = HALO.TURN, k = 0; k < 6 && !best; k++, om *= 0.65) best = turn(om);
  // (the gentlest tighter turn that stays within half a circle; failing that, whichever turns least)
  if (!best || best.th > Math.PI) for (const f of [1.5, 2, 3]){ const t = turn(HALO.TURN*f); if (t && (!best || t.th < best.th)) best = t; if (best.th <= Math.PI) break; }
  return best;
}
// light speed: the ship leaves at its cruising speed and speeds up exponentially, then slows the same way into the next pass
// (speed = k x distance from the nearer end, so what it leaves shrinks away smoothly and what it reaches grows smoothly)
function solveLeg(D, v0, v1, T){
  const tot = k => { const l0 = v0/k, l1 = v1/k, M = (D + l0 + l1)/2; return (Math.log(M/l0) + Math.log(M/l1))/k; };
  if (D/Math.max(v0, v1) < T*1.05) return null;   // too close for a proper jump: a plain glide
  let lo = 1e-6, hi = 1e6;
  for (let i=0;i<80;i++){ const m = Math.sqrt(lo*hi); if (tot(m) > T) lo = m; else hi = m; }
  const k = Math.sqrt(lo*hi), l0 = v0/k, l1 = v1/k, M = (D + l0 + l1)/2;
  return { k, l0, l1, tm:Math.log(M/l0)/k, T:tot(k) };
}
function legAt(L, t){
  let x, y, v;
  if (L.ex){ const e = L.ex; if (t < e.tm){ x = e.l0*(Math.exp(e.k*t) - 1); y = L.D - x; v = e.k*(x + e.l0); } else { y = e.l1*(Math.exp(e.k*Math.max(L.T - t, 0)) - 1); x = L.D - y; v = e.k*(y + e.l1); } }
  else { const u = clamp(t/L.T, 0, 1), h10 = u*u*u - 2*u*u + u, h01 = -2*u*u*u + 3*u*u, h11 = u*u*u - u*u; x = clamp(h10*L.T*L.v0 + h01*L.D + h11*L.T*L.v1, 0, L.D); y = L.D - x;
    v = Math.max(((3*u*u - 4*u + 1)*L.T*L.v0 + (6*u - 6*u*u)*L.D + (3*u*u - 2*u)*L.T*L.v1)/L.T, 0); }
  // relative to where it left in the first half and to where it arrives in the second (precise near both ends: x, the distance gone, is exact near
  // the start and y, the distance still to go, near the end; D - x is not, on a leg of millions of light-years); B's own drift since take-off is blended in
  const w = smooth(0.25, 0.75, x/L.D), drift = V.sub(V.sub(V.add(L.B.pos, L.b0), V.add(L.A.pos, L.a0)), V.mul(L.d, L.D));
  if (x < L.D/2) return { par:L.A, p:V.add(V.add(L.a0, V.mul(L.d, x)), V.mul(drift, w)), h:L.d, v, x };
  return { par:L.B, p:V.sub(V.sub(L.b0, V.mul(L.d, y)), V.mul(drift, 1 - w)), h:L.d, v, x };
}

// ---------------------------------------------------------------- state
const S_ = ship.S;
Object.assign(S_, { force:{}, lastSkim:-9, lastAct:null, plan:null, next:null, align:null, leg:null, fold:null, act:null, h:[0, 1, 0], belly:null, vel:[0, 0, 0], speed:0,
  viewA:0, side:1, hFrom:null, jumpAt:0, stretch:0, lsRun:0, emerge:1, seedN:1, vesc:0, gTg:null, climbK:0, fk:-9, asm:9, eat:0, csL:false, wz:1 });
const riding = () => shipCam.on || (!tour.on && orbit.lock === ship.index && cam.focus === ship.index);
const camNear = () => cam.focus === ship.index && V.len(cam.rel) < ship.rad*80;
// the camera is not riding but was left looking at the ship: keep it where it is (on the body the ship is leaving) rather than dragging it along
function keepCamera(A){ if (!riding() && cam.focus === ship.index){ const D = frel(A); cam.rel = V.sub(cam.rel, D); orbit.target = V.sub(orbit.target, D); cam.focus = A.index; } }
const localPt = l => M3.apply(ship.R0, V.mul(l, ship.rad));            // a point on the ship (ship-relative, world axes)
const shipPt = l => V.add(ship.rel, localPt(l));                         // the same, camera-relative
// a visit after a fold: where it goes next is chosen now, so the pass can already bend toward it
function foldVisit(tg, nx){
  // (a light-speed hop that became a fold keeps the stop after it and the job it had already chosen)
  if (nx && nx.after){ beginVisit(tg, planVisit(tg, 'fold', null, nx.after, nx.actK, nx.seed), nx.after, 'fold'); return; }
  const C = pickNext(tg), after = { tg:C, mode:travelMode(tg, C) };
  beginVisit(tg, planVisit(tg, 'fold', null, after, chooseAct(tg), S_.seedN++), after, 'fold');
}
function beginVisit(tg, plan, next, how){
  S_.plan = plan; S_.next = next;
  S_.target = tg; S_.phase = 'pass'; S_.t = 0; S_.visits++; S_.lastAct = plan.act; S_.side = hrnd() < 0.5 ? -1 : 1;
  ship.labelRange = Math.max(tg.rad*40, ship.rad*1e4);
  S_.act = ACT[plan.act](plan);
  if (riding() && S_.visits > 1) toast((how === 'fold' ? 'the Halo folds space · ' : '') + 'at ' + tg.name + ': ' + ACT_TOAST[plan.act]);
}
const ACT_TOAST = { scan:'a sensor sweep', probe:'Pip, its little drone, goes out to take pictures', weapons:'a weapons test (fictional, nothing is harmed)', skim:'skimming it to refuel', tractor:'catching a passing rock to drill a sample' };
function startAlign(){
  const pl = S_.plan, e = passAt(pl, pl.T), nx = S_.next;
  if (S_.act && S_.act.end) S_.act.end();
  S_.act = null;
  let al = null;
  if (nx.mode === 'light'){
    // plan the next visit now, so the ship can already turn toward where it will drop out of light speed: aimAlign works out the turn after
    // which it points straight at where that pass starts (on a short hop the turn itself carries it a good part of the way there)
    const C = pickNext(nx.tg); nx.after = { tg:C, mode:travelMode(nx.tg, C) }; nx.actK = chooseAct(nx.tg); nx.seed = S_.seedN++;
    const A = S_.target; let d = V.norm(V.sub(nx.tg.pos, V.add(A.pos, e.p)));
    // (where that pass starts depends on the way the ship comes in, and the way in on where the turn ends: a few rounds settle both)
    for (let k=0;k<4;k++){
      nx.plan = planVisit(nx.tg, 'light', d, nx.after, nx.actK, nx.seed);
      al = aimAlign(e.p, e.h, e.v, V.sub(V.add(nx.tg.pos, nx.plan.P[0]), A.pos), pl.Rc);
      if (!al) break;
      d = al.h1;
    }
    // already inside where that pass starts (Earth and the Milky Way): the leg would fly out past it and turn back, so it folds instead
    if (!al || angleOf(d, nx.plan.dIn) > 0.5) nx.mode = 'fold';
  }
  S_.align = nx.mode === 'light' ? al : makeAlign(e.p, e.h, e.v, e.h, pl.Rc); S_.reaim = 0;   // (a fold goes straight on)
  const spool = nx.mode === 'fold' ? HALO.FOLD_SPOOL : HALO.LS_SPOOL;
  S_.jumpAt = Math.max(S_.align.Tt + 0.4, spool);
  S_.phase = 'align'; S_.t = 0;
}
function startJump(){
  const nx = S_.next, A = S_.target, e = alignAt(S_.align, S_.t);
  // the stop has moved on while the ship turned (Europa round Jupiter): a little more turning puts it back on the nose (twice at most, less
  // than a radian each, or the ship would chase it round and round); if it is still off by more than a few degrees, it folds there instead
  const off = nx.mode === 'light' ? angleOf(e.h, V.norm(V.sub(V.add(nx.tg.pos, nx.plan.P[0]), V.add(A.pos, e.p)))) : 0;
  if (off > 0.02){
    const al = S_.reaim < 2 ? aimAlign(e.p, e.h, e.v, V.sub(V.add(nx.tg.pos, nx.plan.P[0]), A.pos), S_.plan.Rc) : null;
    if (al && al.th < 1){ S_.reaim++; al.t0 = S_.t; S_.align = al; S_.jumpAt = S_.t + al.Tt + 0.1; return; }
    if (off > 0.1){ nx.mode = 'fold'; const st = makeAlign(e.p, e.h, e.v, e.h, S_.plan.Rc); st.t0 = S_.t; S_.align = st; S_.jumpAt = S_.t + HALO.FOLD_SPOOL; return; }
  }
  keepCamera(A);
  if (nx.mode === 'light'){
    const B = nx.tg, from = V.add(A.pos, e.p); let pl = nx.plan;
    // and the pass there is planned again for the way the ship really comes in, so the leg runs straight into it
    let dd = V.norm(V.sub(V.add(B.pos, pl.P[0]), from));
    for (let k=0;k<2;k++){ pl = nx.plan = planVisit(B, 'light', dd, nx.after, nx.actK, nx.seed); dd = V.norm(V.sub(V.add(B.pos, pl.P[0]), from)); }
    const to = V.add(B.pos, pl.P[0]), D = Math.max(V.len(V.sub(to, from)), 1e-30), d = V.mul(V.sub(to, from), 1/D);
    const T = clamp(2.8 + 0.45*Math.log10(Math.max(D/pl.Rc, 1)), 3.2, 5.5), ex = solveLeg(D, e.v, pl.v0, T);
    // (too close for a proper jump: a glide whose speed runs evenly from one pass's to the next's, which takes 2D/(v0 + v1); a fixed time
    // made the curve overshoot, and the ship stood still at the end)
    S_.leg = { A, B, a0:e.p, b0:pl.P[0], d, D, T:ex ? ex.T : 2*D/(e.v + pl.v0), ex, v0:e.v, v1:pl.v0 };
    S_.phase = 'light'; S_.t = 0;
    if (angleOf(e.h, d) > 0.005) S_.hFrom = { h:e.h, t:0, T:0.25 };
    fxLightOut(A, e.p, d);
    if (riding()){ toast('light speed · to ' + B.name); foldFlash('blink'); music.whoosh(S_.leg.T + 0.5); }
  } else {
    S_.fold = { A, p:e.p, h:e.h, v:e.v };
    S_.phase = 'fold'; S_.t = 0;
    fxFoldOut(A, e.p, e.h);
  }
}
function endLight(){
  const L = S_.leg, nx = S_.next, pl = nx.plan;
  S_.leg = null;
  const hIn = passAt(pl, 0).h;
  beginVisit(L.B, pl, nx.after);
  if (angleOf(L.d, hIn) > 0.005) S_.hFrom = { h:L.d, t:0, T:1.6 };
  fxLightIn();
}
function endFold(){
  const B = S_.next.tg;
  S_.belly = null; S_.viewA = 0; S_.fold = null;
  if (riding()){ foldFlash('blink'); music.whoosh(1.2); }
  // (riding along, the camera folds with the ship: it keeps its place behind it, rather than swinging round to where the ship now heads)
  if (shipCam.on && shipCam.eye){ const R = ship.R0; S_.reseat = [M3.applyT(R, shipCam.eye), M3.applyT(R, shipCam.fwd), M3.applyT(R, shipCam.up)]; }
  foldVisit(B, S_.next);
  S_.emerge = 0; S_.asm = 0; S_.csL = false;   // (the hull forms again: foldUpdate)
  fxFoldIn();
}

// ---------------------------------------------------------------- the ship's own motion, each tick
function placeShip(dt){
  let r;
  if (S_.phase === 'pass'){ r = passAt(S_.plan, S_.t); r.par = S_.target; }
  else if (S_.phase === 'align'){ r = alignAt(S_.align, S_.t); r.par = S_.target; }
  else if (S_.phase === 'light'){ r = legAt(S_.leg, S_.t); S_.target = r.par; }
  else { const f = S_.fold; r = { par:f.A, p:V.add(f.p, V.mul(f.h, f.v*S_.t)), h:f.h, v:f.v }; }
  let h = r.h;
  if (S_.hFrom){ S_.hFrom.t += dt; const u = smooth(0, S_.hFrom.T, S_.hFrom.t); h = slerpDir(S_.hFrom.h, r.h, u); if (u >= 1) S_.hFrom = null; }
  ship.parent = r.par; ship.offset = r.p; ship.pos = V.add(r.par.pos, r.p);
  S_.h = h; S_.vel = V.mul(r.h, r.v); S_.speed = r.v;
  // how much it is busy with a job (eased in and out): it banks, and the cameras turn toward the work
  const A = S_.act, J = ACTS[A ? A.kind : S_.plan.act], want2 = A ? A.env()*J.view : 0;
  S_.viewA += (Math.min(want2, 1) - S_.viewA)*(1 - Math.exp(-dt*0.9));
  const k = smooth(0, 1, S_.viewA), work = S_.phase === 'pass' || S_.phase === 'align';
  // the belly faces the body it visits; while it works it banks, turning its side to the body (eased, so the ship rolls smoothly);
  // between stars it keeps its roll
  const u = work ? V.norm(V.mul(r.p, -1)) : null;
  let want = work ? u : (S_.belly || anyPerp(h));
  want = perpTo(want, h); if (V.len(want) < 1e-9) want = S_.belly ? perpTo(S_.belly, h) : anyPerp(h); if (V.len(want) < 1e-9) want = anyPerp(h);
  want = V.norm(want);
  if (work && k > 0){ const a = J.bank*k*S_.side, sd = V.cross(h, want); want = V.add(V.mul(want, Math.cos(a)), V.mul(sd, Math.sin(a))); }
  S_.belly = S_.belly ? V.norm(perpTo(V.lerp(S_.belly, want, 1 - Math.exp(-dt*2.5)), h)) : want;
  if (!isFinite(S_.belly[0]) || V.len(S_.belly) < 0.5) S_.belly = want;
  ship.R0 = frameY(h, S_.belly); ship.rot = ship.R0;
  // framing while it works: the job happens on a body that passes from ahead to below. A camera trailing from behind would soon lose
  // it, so the trailing frame turns from the heading toward the body only as far as it takes to keep the body within ~34 degrees of
  // the view, with "down" toward the body (the ship banks in the picture), turned a little to one side for a three-quarter view, and
  // aimed a little below the ship. From the bridge the pilot looks toward the body, over the side of the hull.
  if (work && k > 1e-3){
    const psi = angleOf(h, u), f = rotToward(h, u, clamp(psi - 0.6, 0, 1.3)*k*J.turn), g = rotToward(h, u, clamp(psi - 0.3, 0, 1.0)*k*J.turn);
    ship.viewR = M3.mul(frameY(f, V.lerp(S_.belly, u, k)), M3.rotX((tanX < tanY ? 0.12 : 0.4)*k*S_.side));   // (less of a swing on a tall, narrow phone screen)
    ship.gazeR = frameY(g, S_.belly);
  } else ship.viewR = ship.gazeR = ship.R0;
  ship.viewOff = [J.aim[0]*k, J.aim[1]*k, J.aim[2]*k*S_.side]; ship.chaseOff = [J.chaseAim[0]*k, J.chaseAim[1]*k, J.chaseAim[2]*k*S_.side];
}
// ---------------------------------------------------------------- the shield (made up, like the ship) and the real gravity it works against
// Its load follows the real escape speed where the ship is: sqrt(r_s/r) of light speed near a black hole or a neutron star, and a body's
// surface escape speed x sqrt(R/r) elsewhere. Planets barely register, the Sun's surface is about a quarter, a black-hole pass runs from about
// half at its start to full at its closest point. (The ship passes 27 to 31 times r_s out: moving that fast it is not caught, so the readout
// says it holds course in the hole's gravity or climbs out of it, never that it is pulled in.)
const C_KMS = 299792.458;
// surface escape speeds (km/s): NASA's planetary and Sun fact sheets; the stars from their mass and radius (sqrt(2GM/R)), the two red
// supergiants roughly (their masses and sizes are uncertain)
const VESC = { sun:617.6, earth:11.19, moon:2.38, mars:5.03, jupiter:59.5, saturn:35.5, titan:2.64, io:2.56, europa:2.03, ceres:0.51,
  alphacen:581, proxima:550, sirius:678, trappist1:537, betelgeuse:95, antares:82 };
// neutron stars: r_s in km. SGR 1806-20's mass is not measured; 1.4 Suns, a typical neutron star, gives 4.1 km
const RS_KM = { magnetar:4.1 };
// (one test for "is it a black hole", for the shield, and later the shots and the sounds)
const isHoleTarget = tg => !!(tg && tg.holeR > 0);
function escapeAt(tg, r){
  if (!tg || !(r > 0)) return 0;
  if (isHoleTarget(tg)) return Math.sqrt(Math.min(tg.holeR/2.6/r, 1));
  if (RS_KM[tg.key]) return Math.sqrt(Math.min(RS_KM[tg.key]*KM/r, 1));
  const v = VESC[tg.key], R = surfOf(tg); return v && R ? v/C_KMS*Math.sqrt(R/Math.max(r, R)) : 0;
}
// the load from the escape speed (x = log10 of it as a share of light speed): a quarter at the Sun's surface, the rest from about 6% of light speed up
const loadOf = x => 0.25*smooth(-4.2, -2.6, x) + 0.75*smooth(-1.25, -0.7, x);
function shieldUpdate(dt){
  const tg = ship.parent, off = ship.offset, r = off ? V.len(off) : 0, v = escapeAt(tg, r);
  S_.vesc = v; S_.gTg = v > 0 ? tg : null;
  if (r > 0) S_.gDir = V.mul(off, -1/r);
  // (it works hardest on the way out)
  S_.climbK += ((r > 0 && V.dot(S_.vel, off) > 0 ? 1 : 0) - S_.climbK)*(1 - Math.exp(-dt*2));
  const want = v > 0 ? Math.min(1, loadOf(Math.log10(v))*(0.85 + 0.15*S_.climbK)) : 0;
  S_.load += (want - S_.load)*(1 - Math.exp(-dt*(want > S_.load ? 1.5 : 0.7)));
  // the rings turn faster as the fold drive spools up and as the shield works (their phase is kept here: 20 pi brings both dotted rings back
  // to the same pattern), and the heart beats faster, at most 0.6 beats a second with reduced motion
  S_.ringPh = (S_.ringPh + dt*(0.1 + 1.2*S_.spool + 0.9*S_.load)) % (20*Math.PI);
  S_.beat = (S_.beat + dt*Math.min(0.3 + 1.7*S_.load, reduceMotion ? 0.6 : 9)) % 1;
}
ship.update = function(dt){
  if (!S_.plan){ S_.visits = 0; foldVisit(BYKEY.saturn); S_.t = 3; }
  if (S_.hold){ shieldUpdate(dt); foldUpdate(dt); drone.ctl(dt); return; }   // (the showcase holds it still while the camera circles it, the hull still forming if it just folded in; on the site it never stops)
  // (a camera flying up to the ship: the ship carries on, but it will not jump until the camera has landed)
  const flying = !!(flight && flight.obj === ship);
  S_.t += dt;
  if (S_.phase === 'pass' && S_.t >= S_.plan.T){ const over = S_.t - S_.plan.T; startAlign(); S_.t = over; }
  if (S_.phase === 'align'){ if (flying) S_.jumpAt = Math.max(S_.jumpAt, S_.t + (S_.next.mode === 'fold' ? HALO.FOLD_SPOOL : HALO.LS_SPOOL)); if (S_.t >= S_.jumpAt) startJump(); }
  if (S_.phase === 'light' && S_.t >= S_.leg.T) endLight();
  if (S_.phase === 'fold' && S_.t >= HALO.FOLD_T) endFold();
  placeShip(dt);
  if (S_.reseat){ const R = ship.R0, q = S_.reseat; S_.reseat = null; if (shipCam.on && shipCam.eye){ shipCam.eye = M3.apply(R, q[0]); shipCam.fwd = M3.apply(R, q[1]); shipCam.up = M3.apply(R, q[2]); } }
  shieldUpdate(dt);
  foldUpdate(dt);
  // the look of the drive: spool (reactor surge before a fold), light-speed sheen, scale (collapse and emergence)
  const al = S_.phase === 'align', sp = al ? smooth(S_.jumpAt - (S_.next.mode === 'fold' ? HALO.FOLD_SPOOL : HALO.LS_SPOOL), S_.jumpAt, S_.t) : 0;
  S_.spool = al && S_.next.mode === 'fold' ? sp : Math.max(0, S_.spool - dt*2);
  S_.emerge = Math.min(1, S_.emerge + dt/HALO.EMERGE);
  if (S_.phase === 'fold'){ const u = smooth(0, HALO.FOLD_T, S_.t); S_.scale = 1 - u*u*0.99; }
  else S_.scale = 0.02 + 0.98*smooth(0, 1, S_.emerge);
  // the light-speed sheen on the hull's edges: it rises as the ship jumps, settles during the leg, peaks again as it drops out and fades over
  // 0.4 s after (a fold has its own look: foldUpdate)
  const lsg = S_.phase === 'light' ? Math.max(1 - 0.4*smooth(0, 0.6, S_.t), 0.6 + 0.4*smooth(S_.leg.T - 0.5, S_.leg.T, S_.t)) : (al && S_.next.mode === 'light' ? smooth(S_.jumpAt - 0.6, S_.jumpAt, S_.t) : 0);
  S_.ls = Math.max(lsg, S_.ls - dt/0.4, 0);
  // the star streaks: stretch before the jump, full during it, shrinking back as the ship drops out
  S_.stretch = S_.phase === 'light' ? (S_.t < 0.3 ? 0.55 + 0.45*smooth(0, 0.3, S_.t) : 1 - smooth(S_.leg.T - 0.45, S_.leg.T, S_.t)) : (al && S_.next.mode === 'light' ? 0.55*smooth(S_.jumpAt - 0.7, S_.jumpAt, S_.t) : Math.max(0, S_.stretch - dt*3));
  S_.lsRun = S_.phase === 'light' ? S_.lsRun + dt*(0.5 + 1.6*S_.stretch) : S_.lsRun;
  S_.em = [0, 0, 0, 0]; S_.scoop = 0;
  if (S_.act) S_.act.update(dt, S_.t - S_.plan.tA);
  drone.ctl(dt);   // (Pip, the drone: here and nowhere else, or it would move twice a tick)
  fxUpdate(dt);
};

// ================================================================ the jobs. Each one: update(dt, tau) with tau the time since the job started (negative before),
// draw(), line() for the readout, env() (how busy it is now, 0 to 1: the ship banks and the cameras turn toward the work), end().
const env = (tau, T) => smooth(-1.5, 0.3, tau)*(1 - smooth(T - 0.8, T + 1.2, tau));
const ACT = {};
// -- a sensor scan: fans of beams sweep across the body, each beam ending exactly where it first meets the surface; the rim glows faintly
ACT.scan = pl => {
  const tg = pl.tg, T = ACTS.scan.T, SW = 3.2, NB = 7, dirs = [1, -1, 1];
  const A = { kind:'scan', tau:-9, beams:[] };
  A.update = (dt, tau) => { A.tau = tau; const on = tau > 0.4 && tau < 0.6 + 3*SW; if (on) S_.em[0] = 0.6 + 0.4*Math.sin(tau*23); if (tau > 0 && tau < 0.5) S_.em[0] = tau*2; };
  A.env = () => env(A.tau, T);
  A.line = () => A.tau < 0 ? 'approaching ' + tg.name + ' · sensors warming up' : A.tau < 0.6 ? 'scanning ' + tg.name + ' · ping' : A.tau < 0.6 + 3*SW ? `scanning ${tg.name} · sensor sweep ${Math.min(3, 1 + Math.floor((A.tau - 0.6)/SW))} of 3` : 'scan of ' + tg.name + ' complete';
  A.draw = () => {
    A.beams = [];
    const tau = A.tau; if (tau < 0 || tau > T + 0.5) return;
    const sp = aimSphere(tg), C = tg.rel, R = sp.r, E = shipPt(HULL.scan);
    const EC = V.sub(E, C), dEC = V.len(EC); if (!(dEC > R*1.002)) return;
    const e = V.mul(EC, 1/dEC), thMax = Math.acos(R/dEC);
    // the ping: a faint ring spreading out from the ship before the sweeps
    if (tau < 0.8){ const u = tau/0.8; ringCam(E, dEC*0.9*u + ship.rad, CYAN, 0.35*(1 - u)*(1 - u), 48); }
    const k = Math.floor((tau - 0.6)/SW), u = (tau - 0.6 - k*SW)/SW;
    if (k < 0 || k > 2) return;
    // beams only from a ship you can see: with it out of the picture or behind the body they would seem to come from nowhere
    const showB = camNear() || (onScreen(E) && !behindSphere(E, C, R*0.998));
    // sweep frame: the fan lies across the ship's track and sweeps along it (like a push-broom scanner), back and forth
    let a = perpTo(S_.h, e); a = V.len(a) > 1e-6 ? V.norm(a) : anyPerp(e); const b = V.cross(e, a);
    const amp = Math.pow(Math.sin(Math.PI*clamp(u, 0, 1)), 0.6), th = thMax*0.78, x = (2*u - 1)*th*dirs[k];
    const pt = (xa, yb, r) => V.add(C, V.mul(V.norm(V.add(e, V.add(V.mul(a, Math.tan(xa)), V.mul(b, Math.tan(yb))))), r));
    const occ = p => behindSphere(p, C, R*0.998) || behindHull(p);
    const flick = 0.75 + 0.25*Math.sin(tau*29);
    for (let i=0;i<NB;i++){
      const y = (i/(NB - 1)*2 - 1)*th*0.85, P0 = pt(x, y, R), dir = V.norm(V.sub(P0, E)), t = raySphere(E, dir, C, R);
      if (t < 0) continue;
      const end = V.add(E, V.mul(dir, t));
      A.beams.push({ E, end, C, R });
      const bb = amp*flick*(0.85 + 0.15*Math.sin(i*1.7 + tau*11));
      if (showB) beamLine(E, end, [0.4, 0.8, 1], 0.55*bb, occ, [0.6, 1, 1], 0.95*bb, 12, ship.rad*0.25);
      if (sp.solid && !occ(end)) P_(end, [0.75, 1, 1], 1.8*bb, -3);
      if (sp.cloud && !occ(end)) P_(end, CYAN, 0.5*amp, -4);
    }
    // the scan line the fan paints on the surface, and its fading afterglow (a band sweeping across)
    if (sp.solid){
      for (let j=0;j<6;j++){
        const xj = x - dirs[k]*j*th*0.07; if (Math.abs(xj) > th) continue;
        const br = 0.5*amp*Math.exp(-j*0.55);
        let prev = null, pv = false;
        for (let q=0;q<=20;q++){ const p = pt(xj, (q/20*2 - 1)*th*0.9, R*1.003), v = !occ(p); if (prev && pv && v) L_(prev, p, CYAN, br); prev = p; pv = v; }
      }
    }
    // a faint rim of scan light round the body's edge, pulsing at the start of each sweep
    if (!sp.cloud){ const tt = u*SW, pulse = smooth(0, 0.25, tt)*Math.exp(-Math.max(tt - 0.25, 0)/0.8); if (pulse > 0.01) limbRim(C, R, CYAN, 0.26*pulse, tau); }
  };
  return A;
};
// -- a probe: Pip, the ship's little drone (07i-drone.js), pops out of the belly bay, says hello, flies to the body, hovers there taking
// pictures while it looks at it, flies home and docks (it launches 0.3 s into the job and is back aboard 11.9 s later). The drone moves and
// draws itself (drone.ctl from ship.update, pipDraw from haloDraw); the job only keeps the time and says what is happening.
ACT.probe = pl => {
  const T = ACTS.probe.T, A = { kind:'probe', tau:-9, tg:pl.tg, pl, t0:pl.tA + 0.3 };
  A.update = (dt, tau) => { A.tau = tau; };
  A.env = () => env(A.tau, T);
  A.line = () => pipLine(A);
  A.draw = () => {};
  A.end = () => {};
  return A;
};
// -- a weapons test (fictional): three shots at the body, one of each kind in turn; blasts that swell, cool from white to orange to dark and fade
const WEAPONS = ['rail', 'plasma', 'antimatter'];
let weapK = 0;
ACT.weapons = pl => {
  const tg = pl.tg, T = ACTS.weapons.T, r = lcg(pl.seed*31 + 7), kinds = [0, 1, 2].map(i => WEAPONS[(weapK + i) % 3]), at = [0.6, 4.2, 8.0];
  weapK++;
  const A = { kind:'weapons', tau:-9, n:0, shots:[], cur:null };
  const NAME = { rail:'rail gun', plasma:'plasma lance', antimatter:'antimatter pulse' };
  function fire(kind){
    const sp = aimSphere(tg), R = sp.hole ? tg.holeR*1.6 : sp.r;
    // aim somewhere on the part of the body the gun can see, then find where the shot really lands (first hit of the line of fire)
    const fwd = V.dot(V.norm(V.mul(ship.offset, -1)), S_.h) > 0.25;   // (the bow gun when the body is ahead, the belly turret otherwise)
    const ml = fwd ? HULL.gun : HULL.turret, m = localPt(ml), M0 = V.add(ship.offset, m);   // (target-relative muzzle, for aiming only)
    const e = V.norm(V.mul(M0, -1)), th = Math.acos(clamp(R/Math.max(V.len(M0), R*1.0001), 0, 1))*(0.2 + 0.3*r());
    // (toward the part of the body ahead of the ship, which is the part the trailing cameras see best)
    let a = perpTo(S_.h, e); a = V.len(a) > 1e-6 ? V.norm(a) : anyPerp(e); const ra = (r() - 0.5)*1.4; a = V.norm(V.add(V.mul(a, Math.cos(ra)), V.mul(V.cross(e, a), Math.sin(ra))));
    const aimP = V.mul(V.norm(V.add(V.mul(V.mul(e, -1), Math.cos(th)), V.mul(a, Math.sin(th)))), R);   // (point on the near side, target-relative)
    const dir = V.norm(V.sub(aimP, M0)); let t = raySphere(M0, dir, [0, 0, 0], R); if (t < 0) t = V.len(V.sub(aimP, M0));
    const hitT = V.add(M0, V.mul(dir, t)), nrm = sp.cloud ? V.norm(V.sub(M0, hitT)) : V.norm(hitT);
    const E = (sp.cloud ? tg.rad*0.5*magOf(tg) : sp.hole ? tg.holeR*1.2 : sp.r)*(kind === 'antimatter' ? 0.18 : kind === 'rail' ? 0.1 : 0.09);
    const s = { kind, t:0, ml, base:m, hitT, nrm, E, drift:[0, 0, 0], dirW:dir, T:kind === 'rail' ? 0.34 : kind === 'plasma' ? 1.4 : 1.2, done:false };
    s.i0 = V.sub(hitT, ship.offset);   // the impact point relative to the ship at the moment of firing
    A.shots.push(s); A.cur = s;
    fxMuzzle(ml, kind);
  }
  A.update = (dt, tau) => {
    A.tau = tau;
    while (A.n < 3 && tau >= at[A.n]){ fire(kinds[A.n]); A.n++; }
    for (const s of A.shots){
      if (s.done) continue;
      s.t += dt; s.drift = V.add(s.drift, V.mul(S_.vel, dt));
      if (s.kind === 'plasma'){ S_.em[2] = Math.max(S_.em[2], 0.8 + 0.2*Math.sin(s.t*40)); if (r() < dt*30) fxSparks(tg, s.hitT, s.nrm, s.E*0.5, 3, [1, 0.6, 0.9]); }
      if (s.t >= s.T){ s.done = true; fxBoom(tg, s.hitT, s.nrm, s.E, s.kind, aimSphere(tg).cloud); }
    }
    if (A.cur && A.cur.t < 0.12) S_.em[2] = Math.max(S_.em[2], 1 - A.cur.t/0.12);
  };
  A.env = () => env(A.tau, T);
  A.line = () => A.tau < 0 ? 'approaching ' + tg.name + ' · weapons test ahead (fictional)' : `weapons test (fictional) · ${NAME[(A.cur || { kind:kinds[0] }).kind]} on ${tg.name}\nnothing real is harmed: the blast fades and leaves no mark`;
  A.draw = () => {
    for (const s of A.shots){
      if (s.done) continue;
      const muzzleNow = shipPt(s.ml), hitRel = V.add(tg.rel, s.hitT);
      // (the shot flies from where the muzzle was when it fired; positions relative to the ship, minus how far the ship has moved since)
      const at = u => V.sub(V.add(ship.rel, V.add(s.base, V.mul(V.sub(s.i0, s.base), u))), s.drift);
      const occ = p => behindSphere(p, tg.rel, aimSphere(tg).r*0.998) || behindHull(p);
      if (s.kind === 'rail'){
        const u = clamp(s.t/s.T, 0, 1), p = at(u), q = at(Math.max(u - 0.28, 0));
        beamLine(q, p, [1, 0.45, 0.15], 0.05, occ, [1, 0.95, 0.8], 1.4, 10, ship.rad*0.25);
        if (!occ(p)) P_(p, [1, 0.95, 0.8], 2.4, -4);
      } else if (s.kind === 'plasma'){
        const on = smooth(0, 0.08, s.t)*(1 - smooth(s.T - 0.15, s.T, s.t)), L = V.sub(hitRel, muzzleNow), len = V.len(L), ax = V.mul(L, 1/Math.max(len, 1e-300));
        const p1 = anyPerp(ax), p2 = V.cross(ax, p1);
        const showB = camNear() || (onScreen(muzzleNow) && !behindSphere(muzzleNow, tg.rel, aimSphere(tg).r*0.998));
        for (let k=0;k<(showB ? 3 : 0);k++){
          // a white-hot core and two violet strands twisting round it
          const at = u => { const w = Math.sin(Math.PI*u)*len*0.006*(k === 0 ? 0.3 : 1), ph = s.t*28 + u*19 + k*2.1; return V.add(V.add(muzzleNow, V.mul(L, u)), V.add(V.mul(p1, w*Math.sin(ph)), V.mul(p2, w*Math.cos(ph*1.3)))); };
          pathLine(at, len, k === 0 ? [1, 0.85, 1] : [0.85, 0.35, 1], on*(k === 0 ? 1.3 : 0.7), occ, k === 0 ? [1, 0.9, 1] : [0.9, 0.45, 1], on*(k === 0 ? 1.5 : 0.8), 18, ship.rad*0.25);
        }
        for (let j=0;j<6;j++){ const u = (s.t*1.6 + j/6) % 1, p = V.add(muzzleNow, V.mul(L, u)); if (!occ(p)) P_(p, [1, 0.7, 1], on*0.8, -3); }
        if (!occ(hitRel)) { P_(hitRel, [1, 0.85, 1], on*(1.5 + 0.5*Math.sin(s.t*50)), -8); P_(hitRel, [1, 0.5, 0.9], on*0.8, s.E*0.8); }
      } else {
        const u = Math.pow(clamp(s.t/s.T, 0, 1), 1.6), p = at(u);
        for (let j=1;j<10;j++){ const uj = Math.max(u - j*0.018, 0), q = at(uj), sw = V.add(q, V.mul(anyPerp(s.dirW), Math.sin(s.t*20 - j)*s.E*0.02)); if (!occ(sw)) P_(sw, [0.7, 0.5, 1], 0.4*(1 - j/10), -2); }
        if (!occ(p)){ P_(p, [0.95, 0.9, 1], 2, -5); P_(p, [0.7, 0.5, 1], 0.6, -13); }
      }
    }
  };
  A.end = () => {};
  return A;
};
// -- a skim: a dive to just above the cloud tops or the photosphere, gas streaming into the bow scoop and a glowing trail behind, then a climb away
ACT.skim = pl => {
  const tg = pl.tg, T = ACTS.skim.T, fc = tg.farColor || [1, 0.7, 0.4], mx = Math.max(fc[0], fc[1], fc[2], 1e-3), col = [fc[0]/mx, 0.25 + 0.7*fc[1]/mx, 0.1 + 0.6*fc[2]/mx];
  const A = { kind:'skim', tau:-9, fuel:18 + Math.floor(rnd()*20), trail:[], acc:0, low:0 };
  A.update = (dt, tau) => {
    A.tau = tau;
    const alt = V.len(ship.offset)/surfOf(tg) - 1; A.low = 1 - smooth(0.1, 0.5, alt);
    S_.scoop = A.low; S_.scoopC = col;
    A.fuel = Math.min(100, A.fuel + dt*A.low*11);
    for (const q of A.trail) q.age += dt;
    while (A.trail.length && A.trail[0].age > 2.6) A.trail.shift();
    A.acc += dt;
    if (A.low > 0.02 && A.acc > 1/45){ A.acc = 0; if (A.trail.length > 230) A.trail.shift(); const n = HULL.nozzle, sd = rnd() < 0.5 ? -1 : 1; A.trail.push({ q:V.add(ship.offset, localPt([n[0] + 0.02*(rnd() - 0.5), n[1] - 0.04*rnd(), sd*(n[2] + 0.02*(rnd() - 0.5))])), age:0, b:A.low }); }
  };
  A.env = () => env(A.tau, T);
  A.line = () => A.low > 0.05 ? `skimming ${tg.name}${tg === sun || tg.group === 'stars' ? "'s surface" : "'s cloud tops"} · refuelling ${Math.round(A.fuel)}%` : A.tau < 0 ? 'diving toward ' + tg.name + ' to refuel' : 'climbing away from ' + tg.name + ' · tanks at ' + Math.round(A.fuel) + '%';
  A.draw = () => {
    const C = tg.rel, R = surfDrawn(tg), occ = p => behindSphere(p, C, R*0.998) || behindHull(p);
    // the trail it leaves in space: a glowing ribbon that spreads and fades
    let prev = null, pv = false;
    for (const q of A.trail){ const p = V.add(C, q.q), f = 1 - q.age/2.6, v = !occ(p), br = f*f*q.b;
      if (v) P_(p, col, 0.55*br, ship.rad*(1.2 + q.age*6)); if (prev && v && pv) L_(prev, p, col, 0.35*br); prev = p; pv = v; }
    // gas streaming into the scoop at the bow
    if (A.low > 0.02) for (let i=0;i<48;i++){ const u = (GT*1.4 + i*0.618) % 1, a = i*2.4 + GT*2, k = 1 - u;
      const l = [k*0.9 + Math.cos(a)*k*0.5, HULL.gun[1] + 0.01 + k*5.5, Math.sin(a)*k*0.6], p = shipPt(l); if (!occ(p)) P_(p, col, A.low*0.5*u, -2); }
  };
  A.end = () => {};
  return A;
};
// -- a tractor beam and drill: a passing rock is caught and pulled in beside the ship, a core is drilled out (sparks), the sample is stowed, the rock let go
let rockShape = 0;
const haloRock = addObj({ key:'halo-rock', name:'a passing rock', label:'', type:'', group:'travel', layer:3, parent:ship, offset:[0, 0, 0], pos:[0, 0, 0], rad:0.42*ship.rad,
  prog:P.rock, selfPos:true, hidden:true, noPick:true, noLabel:true, noImpostor:true, atlas:false, noWaypoint:true, pxMin:2, visFn:rpx => smooth(1, 4, rpx),
  // (lit partly by the nearest star and mostly by the ship's own floodlights, so it never turns into a black hole in the picture)
  setU(pr){ const lt = S_.target && (S_.target.group === 'stars' || S_.target === sun) ? S_.target : sun, L = V.norm(V.add(V.add(V.mul(V.norm(V.sub(lt.rel, this.rel)), 0.45), V.mul(V.norm(V.mul(this.rel, -1)), 0.6)), V.mul(V.norm(V.sub(ship.rel, this.rel)), 0.35)));
    gl.uniform4f(pr.u.uP0, this.shape || 0, 0, 0, 0); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0); } });
ACT.tractor = pl => {
  const tg = pl.tg, T = ACTS.tractor.T, rk = haloRock, rr = rk.rad;
  const A = { kind:'tractor', tau:-9, sparks:[], spin:0.5, ang:0, rel0:null, vrel:null };
  rk.shape = rockShape++ % 3; rk.R0 = R0of(rnd()*6, rnd()*6, rnd()*6);
  const sd = S_.side, H = [0.55, 0.45, 1.75*sd];   // where the beam holds it: off the side it banks toward, a little below and ahead (ship radii, ship axes)
  const approach = tau => { const a = smooth(-2.5, 3.5, tau), k = 1 - a; return [0.55 + 0.9*k, 0.45 + 17*k*k, (1.75 + 1.2*k)*sd]; };
  A.pos = tau => {
    if (tau < 3.5) return localPt(approach(tau));
    if (tau < 11){ const u = smooth(3.5, 5.6, tau); return localPt(V.lerp(approach(3.5), H, u)); }
    return V.add(A.rel0, V.mul(A.vrel, tau - 11));
  };
  A.update = (dt, tau) => {
    A.tau = tau;
    const vis = tau > -2.5 && tau < T + 4;
    if (tau >= 11 && !A.rel0){ A.rel0 = localPt(H); A.vrel = V.add(V.mul(S_.h, -ship.rad*1.4), V.mul(S_.belly, ship.rad*0.5)); }
    A.spin = tau < 3.5 ? 0.5 : tau < 11 ? 0.5 - 0.42*smooth(3.5, 5.5, tau) : 0.3;
    A.ang += A.spin*dt;
    rk.hidden = !vis || !!(A.rel0 && V.len(A.pos(tau)) > ship.rad*40);
    if (!rk.hidden){ rk.offset = A.pos(tau); rk.pos = V.add(ship.pos, rk.offset); rk.rot = M3.mul(rk.R0, M3.mul(M3.rotY(A.ang), M3.rotX(A.ang*0.37))); }
    const beam = smooth(2.2, 2.8, tau)*(1 - smooth(10.8, 11.4, tau));
    S_.em[1] = beam*(0.8 + 0.2*Math.sin(tau*9));
    const drill = smooth(5.8, 6.1, tau)*(1 - smooth(9.8, 10, tau));
    if (drill > 0.05) S_.em[2] = Math.max(S_.em[2], drill*(0.7 + 0.3*Math.sin(tau*37)));
    // sparks from the drill head (kept relative to the ship: the rock is held right beside it)
    for (const s of A.sparks){ s.age += dt; s.r = V.add(s.r, V.mul(s.v, dt)); s.v = V.mul(s.v, 1 - dt*1.5); }
    while (A.sparks.length && A.sparks[0].age > A.sparks[0].life) A.sparks.shift();
    if (drill > 0.3 && !rk.hidden){ const c = A.contact(), n = V.norm(V.sub(localPt(HULL.drill), rk.offset));
      for (let k=0;k<3;k++){ const v = V.mul(V.norm(V.add(V.mul(n, 0.4), V.mul(randDir(), 1))), ship.rad*(0.8 + 1.6*rnd())); A.sparks.push({ r:c.slice(), v, age:0, life:0.35 + 0.5*rnd() }); } }
  };
  A.contact = () => { const d = V.norm(V.sub(localPt(HULL.drill), rk.offset)); return V.add(rk.offset, V.mul(d, rr*0.62)); };
  A.env = () => env(A.tau, T + 1);
  A.line = () => { const t = A.tau; if (t < 2.2) return 'a passing rock ahead · locking the tractor beam'; if (t < 5.8) return 'tractor beam holding a ~1 km rock'; if (t < 10) return 'drilling a core sample from the rock';
    if (t < 11) return 'core sample stowed'; return 'rock released · it drifts on toward ' + tg.name; };
  A.draw = () => {
    if (rk.hidden) return;
    const tau = A.tau, R = rk.rel, occR = p => behindSphere(p, R, rr*0.55), occ = p => occR(p) || behindHull(p) || behindSphere(p, tg.rel, aimSphere(tg).r*0.998);
    const beam = smooth(2.2, 2.8, tau)*(1 - smooth(10.8, 11.4, tau));
    if (beam > 0.01){
      // the beam: a faint cone from the emitter to the rock's outline, with rings of light running up it
      const E = shipPt(HULL.tractor), ax = V.sub(R, E), L = V.len(ax), u = V.mul(ax, 1/L), p1 = anyPerp(u), p2 = V.cross(u, p1);
      for (let k=0;k<8;k++){ const a = k/8*6.2832 + tau*0.4, rim = V.add(R, V.mul(V.add(V.mul(p1, Math.cos(a)), V.mul(p2, Math.sin(a))), rr*1.05)); beamLine(E, rim, TEAL, 0.2*beam, occ, TEAL, 0.07*beam, 10, ship.rad*0.1); }
      for (let j=0;j<3;j++){ const f = 1 - ((tau*0.6 + j/3) % 1), c = V.add(E, V.mul(ax, f)), rad = rr*(0.12 + 0.95*f);
        let prev = null, pv = false; for (let k=0;k<=16;k++){ const a = k/16*6.2832, p = V.add(c, V.mul(V.add(V.mul(p1, Math.cos(a)), V.mul(p2, Math.sin(a))), rad)), v = !occ(p); if (prev && pv && v) L_(prev, p, TEAL, 0.3*beam*Math.sin(Math.PI*f)); prev = p; pv = v; } }
    }
    const drill = smooth(5.8, 6.1, tau)*(1 - smooth(9.8, 10, tau));
    if (drill > 0.01){
      const D0 = shipPt(HULL.drill), c = V.add(ship.rel, A.contact());
      beamLine(D0, c, [1, 0.85, 0.6], 1.1*drill, p => behindHull(p), [1, 0.95, 0.85], 1.3*drill);
      if (!occR(c)){ P_(c, [1, 0.6, 0.25], drill*(1.6 + 0.6*Math.sin(tau*43)), -6); P_(c, [1, 0.45, 0.15], drill*0.6, rr*0.35); }
    }
    for (const s of A.sparks){ const p = V.add(ship.rel, s.r), f = 1 - s.age/s.life, q = V.sub(p, V.mul(s.v, 0.05)); if (!occ(p)) L_(q, p, [1, 0.5, 0.15], 0.2*f, [1, 0.85, 0.5], 0.9*f); }
    // the sample: a small bright core rising into the belly bay
    if (tau > 10 && tau < 10.9){ const u = smooth(10, 10.9, tau), p = V.lerp(V.add(ship.rel, A.contact()), shipPt(HULL.dock), u); if (!behindHull(p)) P_(p, [0.8, 1, 0.85], 1.5, -4); }
  };
  A.end = () => { rk.hidden = true; };
  return A;
};

// ================================================================ effects: glowing points, lines and smoke, all camera-relative (float32 is plenty once the camera is subtracted)
const VS_FX = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC;
uniform mat3 uCamRot; uniform vec2 uTan; uniform float uPixAng; uniform float uOut; uniform float uSB; uniform vec4 uHole;
out vec3 vC;
void main(){
  vec3 w = aP.xyz, v = w*uCamRot; float br = aP.w;
  // (nothing shows through a black hole's shadow)
  if(uHole.w > 0.){ float lw = length(w); if(lw > length(uHole.xyz) - uHole.w && dot(w, uHole.xyz) > 0. && length(cross(uHole.xyz, w))/lw < uHole.w) br = 0.; }
  gl_Position = vec4(v.x/uTan.x, v.y/uTan.y, 0., v.z);
  if(v.z <= 0.){ gl_PointSize = 1.; vC = vec3(0.); return; }
  // aC.w > 0: the point's radius in world units (it grows as you come closer); aC.w < 0: a fixed size in pixels
  gl_PointSize = aC.w > 0. ? clamp(aC.w/(v.z*uPixAng), 1.5, 28.) : -aC.w;
  vC = aC.rgb*max(br, 0.)*uSB*uOut;
}`;
// smoke darkens what is behind it (opacity in the red channel)
const FS_SMOKE = `#version 300 es
precision mediump float;
in vec3 vC; out vec4 o;
void main(){ vec2 q = gl_PointCoord*2. - 1.; float r2 = dot(q, q); if(r2 > 1.) discard; float a = clamp(vC.r, 0., 0.9)*exp(-r2*2.5); o = vec4(vec3(0.05, 0.04, 0.035)*a, a); }`;
P.fxPt = program(VS_FX, FS_POINT); P.fxLn = program(VS_FX, FS_LINE); P.fxSm = program(VS_FX, FS_SMOKE);
const FXB = { pt:makePS(3200), ln:makePS(4400), sm:makePS(240), np:0, nl:0, ns:0 };
function P_(p, c, br, size){ if (FXB.np >= FXB.pt.n || !(br > 0.004)) return; const a = FXB.pt.a, k = FXB.pt.c, i = FXB.np++*4; a[i] = p[0]; a[i + 1] = p[1]; a[i + 2] = p[2]; a[i + 3] = br; k[i] = c[0]; k[i + 1] = c[1]; k[i + 2] = c[2]; k[i + 3] = size; }
// (a line is one scene pixel wide, so it needs several times the light of a point to read as characters: LK)
const LK = 4;
function L_(p, q, c, br, c2 = c, br2 = br){ if (FXB.nl + 2 > FXB.ln.n || !(br > 0.004 || br2 > 0.004)) return; const a = FXB.ln.a, k = FXB.ln.c; let i = FXB.nl*4; br *= LK; br2 *= LK;
  a[i] = p[0]; a[i + 1] = p[1]; a[i + 2] = p[2]; a[i + 3] = br; k[i] = c[0]; k[i + 1] = c[1]; k[i + 2] = c[2]; k[i + 3] = 0; i += 4;
  a[i] = q[0]; a[i + 1] = q[1]; a[i + 2] = q[2]; a[i + 3] = br2; k[i] = c2[0]; k[i + 1] = c2[1]; k[i + 2] = c2[2]; k[i + 3] = 0; FXB.nl += 2; }
function SM_(p, op, size){ if (FXB.ns >= FXB.sm.n || !(op > 0.004)) return; const a = FXB.sm.a, k = FXB.sm.c, i = FXB.ns++*4; a[i] = p[0]; a[i + 1] = p[1]; a[i + 2] = p[2]; a[i + 3] = 1; k[i] = op/OUT; k[i + 1] = 0; k[i + 2] = 0; k[i + 3] = size; }
// a line in pieces, shown only where nothing solid stands in front of it; where it goes behind something the cut is found exactly (bisection).
// near > 0: extra pieces close to the start, spaced from `near` doubling outward (a beam leaving the ship is hidden by the hull only at first)
const US = [];
function beamLine(a, b, c, br, occ, c2 = c, br2 = br, n = 10, near = 0){ pathLine(u => V.lerp(a, b, u), V.len(V.sub(b, a)), c, br, occ, c2, br2, n, near); }
function pathLine(at, L, c, br, occ, c2 = c, br2 = br, n = 10, near = 0){
  if (!(L > 0)) return;
  US.length = 0; US.push(0);
  if (near > 0) for (let d = near; d < L*0.1; d *= 2) US.push(d/L);
  const u0 = US[US.length - 1]; for (let i=1;i<=n;i++) US.push(u0 + (1 - u0)*i/n);
  const seg = (u1, u2) => L_(at(u1), at(u2), V.lerp(c, c2, u1), br + (br2 - br)*u1, V.lerp(c, c2, u2), br + (br2 - br)*u2);
  let pu = 0, pv = !occ(at(0));
  for (let k=1;k<US.length;k++){
    const u = US[k], v = !occ(at(u));
    if (pv && v) seg(pu, u);
    else if (pv !== v){ let lo = pu, hi = u; for (let j=0;j<9;j++){ const m = (lo + hi)/2; if (!occ(at(m)) === pv) lo = m; else hi = m; } if (pv) seg(pu, lo); else seg(hi, u); }
    pu = u; pv = v;
  }
}
// a ring facing the camera (centre p, radius r)
function ringCam(p, r, c, br, n = 48){
  const f = V.norm(p), x = V.norm(V.cross(f, cam.up)), y = V.cross(x, f);
  let prev = null; for (let k=0;k<=n;k++){ const a = k/n*6.2832, q = V.add(p, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), r)); if (prev) L_(prev, q, c, br); prev = q; }
}
// a ring in a plane (normal nrm)
function ringIn(p, nrm, r, c, br, n = 48){
  const x = anyPerp(nrm), y = V.cross(nrm, x);
  let prev = null; for (let k=0;k<=n;k++){ const a = k/n*6.2832, q = V.add(p, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), r)); if (prev) L_(prev, q, c, br); prev = q; }
}
// the rim of a sphere as the camera sees it (the limb), traced with light: a faint ring with two brighter arcs running round it
function limbRim(C, R, c, br, tau){
  const d = V.len(C); if (!(d > R*1.02)) return;
  const u = V.mul(C, 1/d), ctr = V.sub(C, V.mul(u, R*R/d)), rho = R*Math.sqrt(1 - R*R/(d*d))*1.012, x = V.norm(V.cross(u, cam.up)), y = V.cross(x, u);
  let prev = null;
  for (let k=0;k<=128;k++){ const a = k/128*6.2832, q = V.add(ctr, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), rho));
    const arc = Math.pow(0.5 + 0.5*Math.cos(a - tau*2.2), 10) + Math.pow(0.5 + 0.5*Math.cos(a + tau*1.7 + 2), 10);
    if (prev) L_(prev, q, c, br*(0.35 + 1.2*arc)); prev = q; }
}

// ---------------------------------------------------------------- short-lived effects that outlive the job that made them
const FX = [];
function fxAdd(e){ e.t = 0; FX.push(e); return e; }
function fxUpdate(dt){
  for (let i=FX.length - 1;i>=0;i--){ const e = FX[i]; e.t += dt; if (e.drift) e.drift = V.add(e.drift, V.mul(S_.vel, dt)); if (e.step) e.step(dt); if (e.t > e.T) FX.splice(i, 1); }
}
// muzzle flash at the gun
function fxMuzzle(l, kind){
  const c = kind === 'plasma' ? [1, 0.6, 1] : kind === 'antimatter' ? [0.8, 0.6, 1] : [1, 0.85, 0.55];
  fxAdd({ T:0.18, draw(e){ const f = 1 - e.t/e.T, p = shipPt(l); P_(p, c, 2.5*f*f, -10); P_(p, WHITE, 1.2*f, ship.rad*0.25); } });
}
// sparks flying off a point on the body (target-relative q, normal n, size E)
function fxSparks(anc, q, n, E, count, c){
  const sp = []; for (let i=0;i<count;i++){ const d = V.norm(V.add(V.mul(n, 0.5), V.mul(randDir(), 1))); sp.push({ d:V.dot(d, n) < 0.05 ? V.norm(V.add(d, n)) : d, s:E*(2 + 5*rnd()), life:0.3 + 0.5*rnd() }); }
  fxAdd({ T:0.9, anc, q, draw(e){ const C = e.anc.rel, R = aimSphere(e.anc).r*0.998; for (const s of sp){ const f = 1 - e.t/s.life; if (f <= 0) continue; const k = 1.4, x = s.s*(1 - Math.exp(-k*e.t))/k, v = s.s*Math.exp(-k*e.t);
    const p = V.add(V.add(C, e.q), V.mul(s.d, x)), p2 = V.sub(p, V.mul(s.d, v*0.06)); if (!behindSphere(p, C, R)) L_(p2, p, c, 0.2*f, [1, 0.9, 0.7], 0.9*f); } } });
}
// fire colour as it cools (f: 0 white-hot, 1 orange, 2 deep red, 3 dark)
function fireCol(f){
  if (f < 0.35) return V.lerp([1, 0.98, 0.9], [1, 0.85, 0.45], f/0.35);
  if (f < 1) return V.lerp([1, 0.85, 0.45], [1, 0.45, 0.12], (f - 0.35)/0.65);
  if (f < 2) return V.lerp([1, 0.45, 0.12], [0.55, 0.12, 0.04], f - 1);
  return V.lerp([0.55, 0.12, 0.04], [0.12, 0.05, 0.03], Math.min(f - 2, 1));
}
// an explosion on (or in) a body: a flash, a fireball that swells and cools, sparks and debris flying out, a quick shock ring, a little smoke.
// Purely visual: nothing about the body changes, and it all fades.
function fxBoom(anc, q, n, E, kind, cloud){
  const am = kind === 'antimatter', N = am ? 190 : 140, balls = [], sparks = [], smoke = [];
  const out = d => cloud ? d : (V.dot(d, n) < 0.1 ? V.norm(V.add(d, V.mul(n, 1.2))) : d);
  for (let i=0;i<N;i++){ const d = out(V.norm(V.add(V.mul(n, cloud ? 0 : 0.7), randDir()))); balls.push({ d, r:Math.pow(rnd(), 0.6), heat:rnd(), s:0.6 + 0.8*rnd(), rise:rnd() }); }
  for (let i=0;i<(am ? 110 : 70);i++){ const d = out(V.norm(V.add(V.mul(n, cloud ? 0 : 0.45), randDir()))); sparks.push({ d, s:E*(3 + 7*rnd())*(am ? 1.4 : 1), life:0.7 + 1.1*rnd(), hot:rnd() }); }
  for (let i=0;i<(am ? 26 : 18);i++){ const d = out(V.norm(V.add(V.mul(n, cloud ? 0 : 1), V.mul(randDir(), 0.8)))); smoke.push({ d, r:0.3 + 0.7*rnd(), at:0.5 + 0.6*rnd() }); }
  const shell = am ? Array.from({ length:160 }, () => out(randDir())) : null;
  fxAdd({ T:am ? 4.5 : 3.6, anc, q, draw(e){
    const t = e.t, C = e.anc.rel, R = aimSphere(e.anc).r*0.998, O = V.add(C, e.q), hid = p => !cloud && behindSphere(p, C, R);
    // flash
    const fl = Math.exp(-t/0.07); if (fl > 0.01 && !hid(O)){ P_(O, WHITE, (am ? 6 : 4.5)*fl, am ? -60 : -40); P_(O, [1, 0.95, 0.85], 2*Math.exp(-t/0.3), E*(am ? 2.2 : 1.6)); }
    // fireball: points swell out fast then slow, rise off the surface a little, and cool from white to orange to red to dark
    const grow = 1 - Math.exp(-t*(am ? 4.5 : 5.5));
    for (const b of balls){
      const f = t/(0.35 + 0.8*b.heat)*(am ? 0.8 : 1), col = fireCol(f*1.1), br = (f < 2.6 ? (1 - smooth(1.6, 2.6, f)) : 0)*(1.3 - 0.35*Math.min(f, 2));
      if (br < 0.01) continue;
      const p = V.add(V.add(O, V.mul(b.d, E*(0.12 + 0.95*b.r)*grow*(am ? 1.3 : 1))), V.mul(n, E*0.5*b.rise*t*(cloud ? 0 : 1)));
      if (!hid(p)) P_(p, col, br*2, E*(0.16 + 0.22*grow)*b.s);
    }
    // debris and sparks: fast streaks that slow, cool and fade
    for (const s of sparks){ const f = 1 - t/s.life; if (f <= 0) continue; const k = 1.6, x = s.s*(1 - Math.exp(-k*t))/k, v = s.s*Math.exp(-k*t);
      const p = V.add(O, V.mul(s.d, x)), p2 = V.sub(p, V.mul(s.d, v*0.07)); if (!hid(p)) L_(p2, p, fireCol(1.4 + (1 - f)), 0.25*f, fireCol(0.5 + (1 - f)*1.5), (0.7 + 0.5*s.hot)*f); }
    // antimatter: a bright shell of debris racing out in every direction
    if (shell){ const r = E*(0.3 + 3.2*(1 - Math.exp(-t*2.2))), f = Math.exp(-t/0.9); for (const d of shell){ const p = V.add(O, V.mul(d, r)); if (!hid(p)) P_(p, t < 0.4 ? [0.95, 0.9, 1] : [0.8, 0.6, 1], 0.9*f, -2); } }
    // the shock ring: brief, spreading along the surface
    for (let k=0;k<(am ? 2 : 1);k++){ const tk = t - k*0.12, u = tk/0.75; if (u <= 0 || u >= 1) continue; const r = E*(0.5 + (am ? 5 : 3.6)*(1 - Math.exp(-tk*3.5)));
      if (cloud) ringCam(O, r, [0.75, 0.85, 1], 0.7*(1 - u)*(1 - u), 64); else { const x = anyPerp(n), y = V.cross(n, x); let prev = null, pv = false;
        for (let j=0;j<=64;j++){ const a = j/64*6.2832, p = V.add(O, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), r)), v = !hid(p); if (prev && pv && v) L_(prev, p, [0.75, 0.85, 1], 0.75*(1 - u)*(1 - u)); prev = p; pv = v; } } }
    // smoke: dark puffs rising and spreading, then thinning out
    for (const m of smoke){ const tt = t - m.at; if (tt <= 0) continue; const f = Math.min(tt/0.6, 1)*(1 - smooth(1.2, 3, tt)); if (f <= 0) continue;
      const p = V.add(O, V.mul(m.d, E*(0.5 + 0.9*m.r)*(1 + tt*0.35))); if (!hid(p)) SM_(p, 0.6*f, E*(0.35 + 0.25*tt)); }
    // the glow left on the ground fades completely: nothing permanent
    const ember = smooth(0.2, 0.6, t)*(1 - smooth(1.5, e.T, t)); if (ember > 0.01 && !hid(O)) P_(O, [1, 0.35, 0.1], 0.5*ember, E*0.6);
  } });
}
// light speed, seen from outside: the ship stretches into a streak of light shooting off toward its next stop, with a flash where it was
function fxLightOut(A, q, d){
  fxAdd({ T:0.7, anc:A, q, draw(e){ if (camNear()) return; const O = V.add(e.anc.rel, e.q), f = 1 - e.t/e.T, head = ship.rel;
    L_(O, head, [0.6, 0.8, 1], 0.2*f, WHITE, 1.4*f); if (e.t < 0.25) P_(O, WHITE, 2.5*(1 - e.t/0.25), -16); } });
}
// (dropping out: a small flash at the needle's tip and a thin ring spreading from it in the ship's plane)
function fxLightIn(){
  fxAdd({ T:0.45, draw(e){ const u = e.t/e.T, f = 1 - u, tip = shipPt(HULL.gun);
    P_(tip, [0.85, 0.95, 1], 1.6*f*f, -6); ringIn(tip, V.norm(localPt([1, 0, 0])), ship.rad*(0.3 + 3.7*(1 - Math.exp(-u*3))), [0.6, 0.85, 1], 0.3*f*f, 48); } });
}
// fold: the moment it goes (the hull is gone by then: the look of the fold itself is foldDraw and the ship's shader) and the moment it arrives.
// A: the heart winks out with a small flash and a thin ring; B: the dark heart pinches shut, a flash and a shock ring; C: nothing at the ship
// (the thread's head flashes far ahead). Arriving: A a small flash as the heart opens, B a burst, C the thread's head coming back in.
function fxFoldOut(A, q, h){
  if (foldLook === 3) return;
  const B = foldLook === 2;
  fxAdd({ T:0.9, anc:A, q, h, draw(e){ const O = V.add(e.anc.rel, e.q), t = e.t;
    if (t < 0.4) P_(O, [0.85, 0.95, 1], (B ? 2.2 : 1.4)*Math.exp(-t/0.1), B ? -18 : -12);
    const u = t/0.9; if (u < 1) ringIn(O, e.h, ship.rad*(0.3 + (B ? 3.5 : 2.2)*(1 - Math.exp(-t*3.5))), [0.55, 0.85, 1], (B ? 0.55 : 0.3)*(1 - u)*(1 - u), 64); } });
}
function fxFoldIn(){
  if (foldLook === 3) return;
  const B = foldLook === 2;
  fxAdd({ T:0.9, draw(e){ const t = e.t, O = shipPt(HULL.core);
    P_(O, [0.85, 0.95, 1], (B ? 2.6 : 1.2)*Math.exp(-t/(B ? 0.16 : 0.12)), B ? -22 : -10);
    const u = t/0.7; if (B && u < 1) ringIn(O, V.norm(localPt([1, 0, 0])), ship.rad*(0.1 + 1.3*(1 - Math.exp(-t*4))), [0.55, 0.9, 1], 0.5*(1 - u)*(1 - u), 64); } });
}

// ================================================================ the fold's look (made up, like the ship; ?fold=a|b|c, see foldLook in 07-extras.js)
// A ember wind: the hull burns away cell by cell from the needle's tip, its embers and ash blow off to one side in a stream, then the heart pulls
// them back in and winks out; on arrival the stream flows back and the hull forms from the heart outward, the needle last. B singularity: the heart turns dark and
// swallows the ship from its outer tips in, a flat whirl of light round it, then pinches shut; on arrival it bursts and the pieces spiral back
// out to their places. C streak-out: from the engines forward each cell shoots ahead as a dash, so the ship pours itself into a thread of
// light that snaps away; on arrival the thread pours back into it, the needle first.
// Its own clocks, so the route's timing is untouched: fk counts to the jump (negative before it, 0 to FOLD_T in the fold; it runs back, and
// the hull forms again, if the jump is put off), asm from the arrival. The shield folds into the heart first and forms again last.
const FLK = { SH0:-2.6, SH1:-2.1, D0:[0, -2.1, -2.1, -1.6][foldLook], D1:-0.5, P:[0, 1, 1, 1.25][foldLook], A0:[0, 0.15, 0.15, 0.4][foldLook], A1:[0, 1.7, 1.55, 1.4][foldLook], SHR:0.7, RIMW:0.1 };
const FLK_END = FLK.A1 + FLK.SHR + 0.1;
// the ship's outline in its plane (y, w = |z|): the same shapes as bowPlan, armPlan and the nacelles in the shader
const KS_ = [-0.041, 0.108], KN_ = [-0.187, 0], N1_ = [0.1225, 0.9925], N2_ = [-0.5947, 0.8039];
const bowPlanJS = (y, w) => Math.max((y - KS_[0])*N1_[0] + (w - KS_[1])*N1_[1], (y - KN_[0])*N2_[0] + (w - KN_[1])*N2_[1]);
function armPlanJS(y, w){
  const vy = y + 0.567, vw = w + 0.33, r = Math.hypot(vy, vw), u = (Math.atan2(vw, vy) - 0.698)/1.1;
  const Ro = 0.68 + 0.012*Math.exp(-(u - 0.3)*(u - 0.3)*25), cf = Math.max(1 - (0.508 - u)/0.1, 0), cr = Math.max(1 - (u - 0.508)/0.2, 0), cl = u < 0.508 ? cf*Math.sqrt(cf) : cr*cr;
  const wd = 0.089*smooth(0, 0.45, u)*(1 - smooth(0.68, 1, u)) + 0.063*cl, d = Math.max(Math.max(r - Ro, Ro - wd - r), Math.max(-u, u - 1)*r*1.1);
  return d*(0.92 - 0.26*Math.min(cl*1.5, 1));
}
function nacPlanJS(y, w){ const ay = -0.832, aw = 0.287, by = -0.63, bw = 0.305, h = clamp(((y - ay)*(by - ay) + (w - aw)*(bw - aw))/((by - ay)**2 + (bw - aw)**2), 0, 1);
  return Math.min(Math.hypot(y - ay - (by - ay)*h, w - aw - (bw - aw)*h) - 0.017, Math.max(Math.abs(y + 0.775) - 0.006, Math.abs(w - 0.289) - 0.029)); }
const liftJS = w => { const u = Math.max(w - 0.1, 0)/0.26; return -0.075*u*u; };
const planD = (y, w) => Math.min(bowPlanJS(y, w), armPlanJS(y, w), nacPlanJS(y, w));
// the cells of the hull for the cell size cs (about one character on screen, chosen as a break-up starts): where each is (y, z, the middle and
// half the thickness of its plate), when it goes as the ship leaves (fo, and the fold clock at which it goes, rel) and when it lands as the
// ship arrives (fi, and the arrival clock at which it lands, land), and five dice. g runs from gLo (every cell there and cool) to gHi (all gone).
const CEL = { cs:0, n:0, a:null, gLo:[0, 0], gHi:[0, 0] };
const CW = 14;   // (numbers per cell: y z xc xh fo fi rel land k0..k4 th0, its angle round the heart)
function buildCells(cs){
  if (CEL.cs === cs) return;
  const L = [], r = lcg(90210), iy0 = Math.floor(-0.92/cs), iy1 = Math.floor(0.87/cs), iz0 = Math.floor(-0.46/cs), iz1 = Math.floor(0.46/cs);
  let lo0 = 9, hi0 = -9, lo1 = 9, hi1 = -9;
  for (let iy=iy0;iy<=iy1;iy++) for (let iz=iz0;iz<=iz1;iz++){
    const y = (iy + 0.5)*cs, z = (iz + 0.5)*cs, w = Math.abs(z), db = bowPlanJS(y, w), da = armPlanJS(y, w), dn = nacPlanJS(y, w), m = Math.min(db, da, dn);
    if (m > 0.35*cs) continue;
    let xc = 0, xh;
    if (m === db) xh = Math.min(0.6*Math.max(-db, 0), 0.054 - 0.034*smooth(0, 0.83, y)); else if (m === da){ xc = liftJS(w); xh = Math.min(0.45*Math.max(-da, 0), 0.026); } else { xc = liftJS(0.29); xh = 0.017; }
    const fo = foldCellThr(iy, iz, 1, cs), fi = foldCellThr(iy, iz, -1, cs);
    lo0 = Math.min(lo0, fo); hi0 = Math.max(hi0, fo); lo1 = Math.min(lo1, fi); hi1 = Math.max(hi1, fi);
    L.push([y, z, xc, Math.max(xh, 0.004), fo, fi, 0, 0, r(), r(), r(), r(), r(), 0]);
  }
  CEL.gLo = [lo0 - FLK.RIMW - 0.03, lo1 - FLK.RIMW - 0.03]; CEL.gHi = [hi0 + 0.05, hi1 + 0.05];
  const a = new Float64Array(L.length*CW);
  L.forEach((c, i) => {
    // (the fold clock at which g reaches fo, and the arrival clock at which it comes back down to fi)
    c[6] = FLK.D0 + (FLK.D1 - FLK.D0)*Math.pow(clamp((c[4] - CEL.gLo[0])/(CEL.gHi[0] - CEL.gLo[0]), 0, 1), 1/FLK.P);
    c[7] = FLK.A0 + (FLK.A1 - FLK.A0)*clamp((CEL.gHi[1] - c[5])/(CEL.gHi[1] - CEL.gLo[1]), 0, 1);
    for (let k=0;k<13;k++) a[i*CW + k] = c[k];
    a[i*CW + 13] = Math.atan2(c[1], c[0] + 0.3);
  });
  CEL.a = a; CEL.n = L.length; CEL.cs = cs;
}
// (a cell about one character across, from the ship's size on screen: its radius in scene pixels, two of them to a character)
const foldCs = () => Math.round(clamp(2/Math.max(ship.rpx || 60, 1), 0.014, 0.045)*1000)/1000;
// in a fold only the cells still there hide anything behind them
const liveCell = (y, z) => S_.dm === 0 || foldCellThr(Math.floor(y/S_.cs), Math.floor(z/S_.cs), S_.dm, S_.cs) > S_.dg;
// an ember hidden by what is left of the hull (ship coordinates, from the camera o to the ember q): where the line crosses the plates' middle
// (x = 0 on the bow, the arms' lift on the arms), inside the outline and on a cell still there; or behind the heart
function emberHidden(ox, oy, oz, qx, qy, qz){
  if (ship.S.scale < 0.5) return false;
  let xp = 0, t = 0, y = 0, z = 0;
  for (let k=0;k<2;k++){ const dx = qx - ox; if (Math.abs(dx) < 1e-9) break; t = (xp - ox)/dx; y = oy + (qy - oy)*t; z = oz + (qz - oz)*t;
    const w = Math.abs(z); if (bowPlanJS(y, w) < 0) break; xp = liftJS(nacPlanJS(y, w) < 0 ? 0.29 : w); }
  if (t > 0 && t < 0.985 && planD(y, Math.abs(z)) < 0 && liveCell(y, z)) return true;
  const cy = -0.3*S_.scale, rh = 0.04*(foldLook === 2 ? 1 + 2*S_.sy : 1), dx = qx - ox, dy = qy - oy, dz = qz - oz, L2 = dx*dx + dy*dy + dz*dz;
  const u = clamp(((0 - ox)*dx + (cy - oy)*dy + (0 - oz)*dz)/L2, 0, 1), ex = ox + dx*u, ey = oy + dy*u - cy, ez = oz + dz*u;
  return u > 0 && u < 0.985 && ex*ex + ey*ey + ez*ez < rh*rh;
}
// the shield's outline in the ship's plane, as segments (y, z, y, z): a little outside the hull (A, C), or the bubble's rim (B). It folds into
// the heart as the fold begins and grows back out of it at the end.
const SHOL = (() => {
  const seg = [], h = 0.02, f = (y, z) => planD(y, Math.abs(z)) - 0.05;
  for (let y=-0.98;y<0.94;y+=h) for (let z=-0.5;z<0.5;z+=h){
    const v = [f(y, z), f(y + h, z), f(y + h, z + h), f(y, z + h)], P4 = [[y, z], [y + h, z], [y + h, z + h], [y, z + h]], pts = [];
    for (let e=0;e<4;e++){ const a = v[e], b = v[(e + 1) % 4]; if ((a < 0) !== (b < 0)){ const t = a/(a - b), p = P4[e], q = P4[(e + 1) % 4]; pts.push(p[0] + (q[0] - p[0])*t, p[1] + (q[1] - p[1])*t); } }
    if (pts.length >= 4) seg.push(pts[0], pts[1], pts[2], pts[3]);
    if (pts.length === 8) seg.push(pts[4], pts[5], pts[6], pts[7]);
  }
  const egg = []; for (let k=0;k<72;k++){ const a = k/72*6.2832, b = (k + 1)/72*6.2832; egg.push(-0.02 + 1.1*Math.cos(a), 0.62*Math.sin(a), -0.02 + 1.1*Math.cos(b), 0.62*Math.sin(b)); }
  return { hull:new Float32Array(seg), egg:new Float32Array(egg) };
})();
// each tick: the clocks, and what the shader and the embers need from them
function foldUpdate(dt){
  const S = S_, leaving = (S.phase === 'align' && S.next && S.next.mode === 'fold') || S.phase === 'fold';
  if (leaving){ const want = S.phase === 'fold' ? S.t : S.t - S.jumpAt; S.fk = S.fk < -8 ? want : want >= S.fk ? want : Math.max(want, S.fk - dt*1.5); }
  else S.fk = -9;
  let g = 0, dm = 0, hfl = 0, shK = 1, sx = 0, sy = 0, cc = 0;
  if (S.fk > -8){
    const fk = S.fk;
    if (!S.csL && fk > FLK.D0 - 0.6){ S.csL = true; S.cs = foldCs(); buildCells(S.cs); S.wz = lcg(S.visits*977 + 13)() < 0.5 ? -1 : 1; }
    shK = 1 - smooth(FLK.SH0, FLK.SH1, fk);
    hfl = 0.55*Math.exp(-(((fk - FLK.SH1 - 0.05)/0.14)**2));   // (a flash as the shield reaches the heart)
    if (S.csL && fk > FLK.D0 - 0.05){ dm = 1; g = CEL.gLo[0] + (CEL.gHi[0] - CEL.gLo[0])*Math.pow(clamp((fk - FLK.D0)/(FLK.D1 - FLK.D0), 0, 1), FLK.P); }
    cc = Math.max(fk - FLK.D1, 0);
    if (foldLook === 1) hfl += 1.1*smooth(0, 0.3, cc)*(1 - smooth(0.55, 0.9, cc));
    else if (foldLook === 2){
      // (the dark heart grows as it eats, then in the last half second before the jump it pinches in, its ring spinning faster and burning brighter)
      sx = smooth(FLK.D0 - 0.3, FLK.D0 + 0.3, fk); sy = smooth(FLK.D0, FLK.D1, fk)*(1 - 0.7*smooth(0.05, 0.5, cc));
      // (it flares as each piece falls in)
      let n = 0; if (dm && CEL.n) for (let i=0;i<CEL.n;i++){ const c = i*CW, e = CEL.a[c + 6] + 0.3 + 0.75*Math.hypot(CEL.a[c] + 0.3, CEL.a[c + 1]); if (e > fk - dt && e <= fk) n++; }
      S.eat = S.eat*Math.exp(-dt/0.15) + n*0.03;
      hfl += Math.min(S.eat, 0.9) + 0.5*smooth(0.05, 0.5, cc) + 1.4*smooth(-0.15, 0.05, fk)*(1 - smooth(0.2, 0.4, fk));
      S.ringPh += dt*(reduceMotion ? 1.5 : 6 + 30*cc)*sx;
    } else { sx = smooth(-0.45, 0.2, fk); hfl += 0.5*smooth(-0.6, 0, fk); }
  } else if (S.asm < FLK_END){
    const a = S.asm += dt;
    if (!S.csL){ S.csL = true; S.cs = foldCs(); buildCells(S.cs); S.wz = lcg(S.visits*977 + 29)() < 0.5 ? -1 : 1; }
    if (a < FLK.A1 + 0.25){ dm = -1; g = CEL.gHi[1] - (CEL.gHi[1] - CEL.gLo[1])*clamp((a - FLK.A0)/(FLK.A1 - FLK.A0), 0, 1); }
    shK = smooth(FLK.A1 + 0.3, FLK.A1 + FLK.SHR, a);
    hfl = foldLook === 2 ? 1.2*Math.exp(-a/0.15) + 0.3*(1 - smooth(0.2, 1.2, a)) : foldLook === 3 ? 0.6*(1 - smooth(0, 0.35, a)) : 0.9*(1 - smooth(0, 0.5, a));
  } else S.csL = false;
  S.dg = g; S.dm = dm; S.hfl = hfl; S.shK = shieldLook ? shK : 1; S.sx = sx; S.sy = sy; S.cc = cc;
  // (from afar the engine glint goes with the hull)
  ship.farLum = 0.7*(dm > 0 ? 1 - smooth(FLK.D0, FLK.D1, S.fk) : dm < 0 ? smooth(FLK.A0, FLK.A1, S.asm) : 1);
}
// the embers, and the shield folding into the heart and out of it. Drawn relative to the ship (they ride with it), one point or short streak each,
// only as many as about one per character of the ship on screen (fewer on a small screen, never a white blob)
const EP = [0, 0, 0], EQ = [0, 0, 0], ECOL = [0, 0, 0], ICE_ = [0.55, 0.85, 1], DEEP_ = [0.42, 0.55, 1], ASH_ = [0.62, 0.64, 0.7], SHC_ = [0.55, 0.8, 1];
const BLUE_ = [0.4, 0.6, 1], TAILB_ = [0.3, 0.45, 1], TAILC_ = [0.3, 0.55, 1], CYAN_ = [0.5, 0.85, 1], HALO_ = [0.6, 0.85, 1];
function toShip(out, lx, ly, lz){ const R = ship.R0, s = ship.rad, r = ship.rel; out[0] = r[0] + (R[0]*lx + R[3]*ly + R[6]*lz)*s; out[1] = r[1] + (R[1]*lx + R[4]*ly + R[7]*lz)*s; out[2] = r[2] + (R[2]*lx + R[5]*ly + R[8]*lz)*s; return out; }
function mix3(out, a, b, t){ out[0] = a[0] + (b[0] - a[0])*t; out[1] = a[1] + (b[1] - a[1])*t; out[2] = a[2] + (b[2] - a[2])*t; return out; }
// where ember c (its offset in CEL.a) is, in ship radii and ship axes, at fold clock fk (leaving) or arrival clock t (arriving); false if not out
function emberAt(out, c, fk, t, leaving, sd){
  const A = CEL.a, y0 = A[c], z0 = A[c + 1], xs = A[c + 2] + sd*A[c + 3], k0 = A[c + 8], k1 = A[c + 9], k2 = A[c + 10], k3 = A[c + 11], cy = -0.3*S_.scale;
  const r0 = Math.hypot(y0 + 0.3, z0), th0 = A[c + 13], still = reduceMotion ? 0 : 1;
  if (foldLook === 1){
    // a wind carries it off to one side (S_.wz, new for each fold), lifting it toward the camera's side of the plate and a little aft, with
    // eddies; arriving, the same stream runs backwards and settles each grain on its own spot
    const a = leaving ? fk - A[c + 6] : A[c + 7] - t; if (a < 0 && (leaving || t > A[c + 7] + 0.1)) return false;
    // (it rises off the plate as it drifts: dust lifting away, not rain; each grain turns in a small eddy of its own, so the stream curls)
    const aa = Math.max(a, 0), e0 = 1 - Math.exp(-aa/0.2), wz = leaving ? S_.wz : -S_.wz, gust = 0.6 + 0.8*k0;
    let x = xs + sd*(0.05*e0 + (0.12 + 0.3*k1)*aa*aa), y = y0 - (0.12*aa + 0.3*aa*aa)*(0.5 + k2), z = z0 + wz*(0.3*aa + 0.75*aa*aa)*gust;
    const er = still*(0.05 + 0.12*k3)*Math.min(aa*2.2, 1)*(1 + aa), ea = aa*(3.2 + 3*k2)*(k0 < 0.5 ? 1 : -1) + 6.283*k3;
    x += sd*er*(Math.cos(ea) - Math.cos(6.283*k3)); z += er*(Math.sin(ea) - Math.sin(6.283*k3));
    let w = 0;
    if (leaving){
      // (in the last half second the heart pulls it all back in)
      const cc = fk - FLK.D1; w = cc > 0 ? smooth(0.05*k3, 0.3 + 0.3*k3, cc)**2 : 0;
      if (w > 0.995) return false;
      if (w > 0){ const ang = still*1.5*w*wz, ca = Math.cos(ang), sa = Math.sin(ang), vy = y - cy, vz = z; y = cy + (vy*ca - vz*sa)*(1 - w); z = (vy*sa + vz*ca)*(1 - w); x *= 1 - w; }
    } else if (aa > 1.4) return false;
    out[0] = x; out[1] = y; out[2] = z; out[3] = aa; out[4] = w; return true;
  }
  if (foldLook === 2){
    let u;
    if (leaving){ const a = fk - A[c + 6]; if (a < 0) return false; const cc = Math.max(fk - FLK.D1, 0); u = (a + 2.2*cc*cc)/(0.3 + 0.75*r0); if (u >= 1) return false; }
    else { const L = A[c + 7], T = 0.25 + 0.5*r0; u = 1 - (t - (L - T))/T; if (u > 1 || t > L + 0.1) return false; u = Math.max(u, 0); }
    const r = r0*Math.pow(1 - u, 0.75), th = th0 + still*(2.2*u + 4.5*u*u*u);
    if (r < 0.04*(1 + 2*S_.sy) && leaving) return false;   // (swallowed)
    out[0] = xs*(1 - u)*(1 - u); out[1] = -0.3 + r*Math.cos(th); out[2] = r*Math.sin(th); out[3] = u; out[4] = 0; return true;
  }
  // C: a dash shooting ahead, gathering onto the ship's axis (arriving: the same, backwards in time)
  const a = leaving ? fk - A[c + 6] : A[c + 7] - t; if (a < 0 && (leaving || t > A[c + 7] + 0.1)) return false;
  const aa = Math.max(a, 0), snap = leaving && fk > 0 ? 70*fk*fk : 0, y = y0 + 0.5*aa + 2.6*aa*aa*aa + snap, cv = Math.exp(-aa/0.4)*(1 + 0.25*Math.sin(Math.min(aa, 0.5)*6.283));
  if (y > 22) return false;
  out[0] = xs*cv; out[1] = y; out[2] = z0*cv; out[3] = aa; out[4] = snap; return true;
}
function foldDraw(){
  const S = S_, leaving = S.fk > -8, arriving = !leaving && S.asm < FLK_END;
  if ((!leaving && !arriving) || !(ship.dist < ship.labelRange) || !(ship.rpx > 6) || V.dot(ship.rel, cam.fwd) < -ship.rad*3) return;
  const R = ship.R0, rel = ship.rel, dist = Math.max(V.len(rel), 1e-30);
  // (the side of the plate the camera sees, and how many cells make one character there: a plate seen edge-on packs more into each)
  const sd = -(R[0]*rel[0] + R[1]*rel[1] + R[2]*rel[2]) > 0 ? 1 : -1, fsh = Math.max(Math.abs(R[0]*rel[0] + R[1]*rel[1] + R[2]*rel[2])/dist, 0.2);
  const cw = CEL.cs*ship.rpx/2, keep = clamp(cw*cw*0.55*fsh*5, 0.05, 1)*(reduceMotion ? 0.5 : 1), ir = 1/ship.rad;
  const ox = -(R[0]*rel[0] + R[1]*rel[1] + R[2]*rel[2])*ir, oy = -(R[3]*rel[0] + R[4]*rel[1] + R[5]*rel[2])*ir, oz = -(R[6]*rel[0] + R[7]*rel[1] + R[8]*rel[2])*ir;
  // the shield folding into the heart (leaving) or growing out of it (arriving)
  if (shieldLook){
    const ol = shieldLook === 2 ? SHOL.egg : SHOL.hull;
    let s = -1, b = 0;
    if (leaving && S.fk > FLK.SH0 && S.fk < FLK.SH1 + 0.05){ s = 1 - smooth(FLK.SH0, FLK.SH1, S.fk); b = 0.9*Math.sqrt(1 - s)*smooth(0.02, 0.12, s); }
    if (arriving && S.asm > FLK.A1 && S.asm < FLK.A1 + FLK.SHR){ s = 0.04 + 0.96*smooth(FLK.A1, FLK.A1 + 0.5, S.asm); b = (0.3 + 0.8*(1 - s))*(1 - smooth(FLK.A1 + 0.35, FLK.A1 + FLK.SHR, S.asm))*smooth(0, 0.08, S.asm - FLK.A1); }
    if (s > 0 && b > 0.01) for (let i=0;i<ol.length;i+=4){
      const y1 = -0.3 + (ol[i] + 0.3)*s, z1 = ol[i + 1]*s, y2 = -0.3 + (ol[i + 2] + 0.3)*s, z2 = ol[i + 3]*s;
      L_(toShip(EP, (liftJS(Math.abs(ol[i + 1])) + sd*0.06)*s, y1, z1), toShip(EQ, (liftJS(Math.abs(ol[i + 3])) + sd*0.06)*s, y2, z2), SHC_, b*1.3);
    }
  }
  if (!CEL.n || !S.csL) return;
  const fk = S.fk, t = S.asm, A = CEL.a, E = [0, 0, 0, 0, 0], E2 = [0, 0, 0, 0, 0]; let nE = 0, yMax = 1;
  for (let i=0;i<CEL.n;i++){
    // (B, arriving: fewer, since they all start from one spot)
    const c = i*CW; if (A[c + 12] > keep*(foldLook === 2 && !leaving ? 0.45 : 1)) continue;
    if (!emberAt(E, c, fk, t, leaving, sd)) continue;
    const k0 = A[c + 8], k1 = A[c + 9], k2 = A[c + 10];
    if (emberHidden(ox, oy, oz, E[0], E[1], E[2])) continue;
    toShip(EP, E[0], E[1], E[2]); nE++;
    if (foldLook === 1){
      if (leaving){
        // (a glowing ember: white as it leaves, cooling to ice blue and then deep blue, with a short tail showing where the wind takes it;
        // about one in five is a flake of grey ash, tumbling)
        const a = E[3], w = E[4], ash = k1 < 0.22;
        let b = ash ? 0.85*(0.6 + 0.4*Math.sin(a*11 + k2*30)) : 2.2*Math.exp(-a/0.12) + 1.7*Math.exp(-a/(1 + 0.9*k0));
        b *= (ash ? 1 : 0.85 + 0.15*Math.sin(fk*23 + k2*40))*(1 + 0.8*w)*(1 - smooth(0.85, 1, w));
        if (ash) ECOL[0] = ASH_[0], ECOL[1] = ASH_[1], ECOL[2] = ASH_[2]; else if (a < 0.2) mix3(ECOL, WHITE, ICE_, a/0.2); else mix3(ECOL, ICE_, DEEP_, Math.min((a - 0.2)/1.4, 1));
        P_(EP, ECOL, b, ash ? -3 : -2);
        if (!ash && !reduceMotion && emberAt(E2, c, fk - (w > 0.1 ? 0.025 : 0.03), t, true, sd)){ toShip(EQ, E2[0], E2[1], E2[2]); L_(EQ, EP, DEEP_, b*0.05, ECOL, b*0.3); }
      } else {
        // (arriving: a grain drifting back in, warming as it nears its spot, a spark as it lands)
        const a = E[3];
        if (a <= 0){ P_(EP, WHITE, 1.8*(1 - (t - A[c + 7])/0.1), -2); continue; }
        const b = (0.75 + 1.6*Math.exp(-a/0.22))*smooth(1.4, 0.95, a); mix3(ECOL, DEEP_, WHITE, Math.exp(-a/0.3));
        P_(EP, ECOL, b, k1 < 0.22 ? -3 : -2);
        if (!reduceMotion && emberAt(E2, c, fk, t - 0.03, false, sd)){ toShip(EQ, E2[0], E2[1], E2[2]); L_(EQ, EP, DEEP_, b*0.05, ECOL, b*0.3); }
      }
    } else if (foldLook === 2){
      const u = E[3];
      if (!leaving && u <= 0){ P_(EP, WHITE, 1.4*(1 - (t - A[c + 7])/0.1), -2); continue; }
      // (arriving they leave the heart dim, so the burst never piles up into a white ball, and brighten on the way out)
      const heat = leaving ? u : 1 - u, b = leaving ? 0.5 + 1.6*heat*heat : (0.25 + 0.7*Math.sin(Math.PI*Math.min(heat*1.3, 1)))*smooth(0.05, 0.25, Math.hypot(E[1] + 0.3, E[2])); mix3(ECOL, BLUE_, WHITE, heat*heat);
      const back = leaving ? emberAt(E2, c, fk - 0.08, t, true, sd) : emberAt(E2, c, fk, t - 0.08, false, sd);
      if (!reduceMotion && back){ toShip(EQ, E2[0], E2[1], E2[2]); L_(EQ, EP, TAILB_, b*0.03, ECOL, b*0.22); }
      else P_(EP, ECOL, b, -2);
    } else {
      // (a dash of light, white as it leaves its cell, stretching as it speeds up)
      const a = E[3], y = E[1], fade = 1 - smooth(12, 22, y); if (y < 12 && y > yMax) yMax = y;
      const b = (0.8 + 1.4*Math.exp(-a/0.2))*fade*(leaving && fk > 0 ? 1 - fk/0.4 : 1);
      mix3(ECOL, WHITE, CYAN_, Math.min(a/0.6, 1));
      if (!leaving && a <= 0){ P_(EP, WHITE, 1.8*(1 - (t - A[c + 7])/0.1), -2); continue; }
      const back = leaving ? emberAt(E2, c, fk - 0.07, t, true, sd) : emberAt(E2, c, fk, t + 0.07, false, sd);
      P_(EP, ECOL, b*0.8, -2);
      if (!reduceMotion && back){ toShip(EQ, E2[0], E2[1], E2[2]); L_(EQ, EP, TAILC_, b*0.08, ECOL, b*0.4); }
    }
  }
  S.embN = nE;
  // C: the thread itself, a line of light from the needle's tip out along the heading as far as the dashes have run (so the ship reads as
  // pouring out of its own tip; once the needle is gone, not before, so it never lies over the hull, it reaches back to the heart, which
  // stretches into it), and its head, racing off as it snaps: the thread's end runs after the head and the two meet and go out.
  // Arriving, the head races back in and the thread shortens into the needle as the dashes pour back into their cells.
  if (foldLook === 3){
    // (the head's spark and its halo follow the ship's size on screen, so on a phone it is a spark, not a glowing ball)
    const hs = clamp(ship.rpx*0.25, 6, 12), hh = clamp((ship.rpx - 15)*1.1, 12, 40);
    if (leaving){
      const u = Math.max(fk + 0.3, 0), yh = Math.max(1 + 30*u*u, yMax), snap = fk > 0 ? 70*fk*fk : 0, yt = Math.min(0.86 - 1.1*smooth(FLK.D1 - 0.05, FLK.D1 + 0.35, fk) + snap*1.6, yh), k = smooth(FLK.D0 + 0.3, FLK.D0 + 0.9, fk)*(1 - smooth(0.25, 0.4, fk));
      if (k > 0.01 && yh - yt > 0.05){ toShip(EP, 0, yt, 0); toShip(EQ, 0, yh, 0); L_(EP, EQ, WHITE, 0.55*k, CYAN_, 0.25*k); }
      if (fk > -0.3){ const kh = smooth(-0.3, -0.1, fk)*(1 - smooth(0.25, 0.4, fk)); toShip(EP, 0, yh, 0); P_(EP, WHITE, 2.2*kh, -hs); P_(EP, HALO_, 0.6*kh, -hh); }
    }
    if (arriving && t < FLK.A1){
      const yh = 12*(1 - smooth(0, 0.35, t)) + 0.9, k = 1 - smooth(0.2, 0.35, t), kt = 1 - smooth(0.3, FLK.A1*0.8, t);
      if (kt > 0.01){ toShip(EP, 0, 0.86, 0); toShip(EQ, 0, Math.max(yh, 0.9 + 3*kt*kt), 0); L_(EP, EQ, WHITE, 0.55*kt, CYAN_, 0.25*kt); }
      if (k > 0.01){ toShip(EP, 0, yh, 0); P_(EP, WHITE, 2.2*k, -hs); P_(EP, HALO_, 0.6*k, -hh); }
    }
  }
}

// ---------------------------------------------------------------- drawing, after everything else
const STREAKS = Array.from({ length:IS_SMALL ? 180 : 280 }, () => ({ a:rnd()*6.2832, r:4 + 80*Math.pow(rnd(), 0.8), z:rnd(), len:0.4 + 0.6*rnd(), c:rnd() }));
const Z3 = [0, 0, 0];
function fxUpload(ps, n){ if (!n) return; gl.bindBuffer(gl.ARRAY_BUFFER, ps.b0); gl.bufferSubData(gl.ARRAY_BUFFER, 0, ps.a, 0, n*4); gl.bindBuffer(gl.ARRAY_BUFFER, ps.b1); gl.bufferSubData(gl.ARRAY_BUFFER, 0, ps.c, 0, n*4); }
function haloDraw(){
  const S = S_; if (!S.target) return;
  const near = ship.dist < ship.labelRange, inFront = V.dot(ship.rel, cam.fwd) > 0;
  // the ship's beacon when it is too small to see
  if (near && inFront && ship.rpx < 3 && S.scale > 0.3) P_(ship.rel, [0.6, 0.95, 1], (0.7 + 0.3*Math.sin(ship.t*5))*ship.farLum/0.7, -2.4);
  if (near && S.act && S.phase === 'pass') S.act.draw();
  for (const e of FX) if (!e.anc || e.anc.dist < Math.max(e.anc.rad*60, ship.labelRange)) e.draw(e);
  if (near) pipDraw();   // (Pip, the drone: its glint far away, its trail, the spot its lamp lights)
  const hx = localPt([1, 0, 0]), hz = localPt([0, 0, 1]), bx = V.mul(hx, 1/ship.rad), bz_ = V.mul(hz, 1/ship.rad), h = S.h, R = ship.rad;
  // light speed, riding along: star streaks rushing out of a vanishing point ahead
  if (S.stretch > 0.01 && camNear()){
    const st = S.stretch, run = S.lsRun, Zf = 900, Zb = -160;
    for (const s of STREAKS){
      const z = ((s.z - run) % 1 + 1) % 1, ax = Zb + (Zf - Zb)*z, fade = smooth(0, 0.12, z)*(1 - smooth(0.8, 1, z)), br = (0.35 + 0.45*s.c)*fade*st*(reduceMotion ? 0.5 : 1);
      if (br < 0.01) continue;
      const off = V.add(V.mul(bx, Math.cos(s.a)*s.r*R), V.mul(bz_, Math.sin(s.a)*s.r*R)), head = V.add(ship.rel, V.add(off, V.mul(h, ax*R))), len = st*st*s.len*(60 + 200*z)*R;
      const tail = V.sub(head, V.mul(h, len)), c = V.lerp([0.85, 0.93, 1], [0.45, 0.62, 1], s.c);
      L_(tail, head, c, br*0.15, WHITE, br);
    }
    if (S.phase === 'light') P_(V.add(ship.rel, V.mul(h, 2000*R)), [0.75, 0.88, 1], 0.9*st, -6);   // (where it is heading: a pinpoint, not a glow over the needle)
  }
  // the fold: embers, the shield folding into the heart (no arcs: the owner found them boring)
  if (near) foldDraw();
  // the upload and three draws: smoke first (it darkens), then glowing points, then lines
  fxUpload(FXB.sm, FXB.ns); fxUpload(FXB.pt, FXB.np); fxUpload(FXB.ln, FXB.nl);
  if (FXB.ns) drawParticles(null, { ps:FXB.sm, prog:'fxSm', mode:3, sb:1, size:1, rad:1, rel:() => Z3, rot:() => I3, count:() => FXB.ns });
  if (FXB.np) drawParticles(null, { ps:FXB.pt, prog:'fxPt', mode:3, sb:1, size:1, rad:1, rel:() => Z3, rot:() => I3, count:() => FXB.np });
  if (FXB.nl) drawParticles(null, { ps:FXB.ln, prog:'fxLn', lines:true, mode:3, sb:1, size:1, rad:1, rel:() => Z3, rot:() => I3, count:() => FXB.nl });
}
EXTRAS.push(() => { FXB.np = FXB.nl = FXB.ns = 0; haloDraw(); });

// ---------------------------------------------------------------- what the readout says
// (what a fold looks like, in words: while the hull breaks up and while it forms again; null otherwise. Also the showcase's caption.)
const FOLD_LINE = ['', 'the hull burns away for the fold', 'the heart swallows the ship', 'the ship pours itself into light'];
const FOLD_BACK = ['', 'the hull forms again', 'the heart gives the ship back', 'the ship pours back out of the light'];
function foldLine(){
  const S = S_;
  if (S.phase === 'align' && S.next.mode === 'fold' && S.fk >= FLK.D0 - 0.1) return FOLD_LINE[foldLook] + ' · next stop: ' + S.next.tg.name;
  if (S.phase === 'pass' && S.visits > 1 && S.asm < FLK.A1 + 0.3) return 'out of the fold at ' + S.target.name + ' · ' + FOLD_BACK[foldLook];
  return null;
}
function haloReadout(){
  const S = S_, tg = S.target; if (!tg) return 'between the stars';
  let l = foldLine();   // (a fold in progress says what it looks like)
  if (!l){ if (S.phase === 'pass') l = S.act ? S.act.line() : 'flying past ' + tg.name;
  else if (S.phase === 'align') l = S.next.mode === 'fold' ? (S.spool > 0.05 ? 'fold drive spooling up · next stop: ' + S.next.tg.name : 'setting course for ' + S.next.tg.name) : (S.stretch > 0.05 ? 'jumping to light speed' : 'setting course for ' + S.next.tg.name + ' · light speed');
  else if (S.phase === 'light') l = 'light speed · to ' + S.leg.B.name + (S.t > S.leg.T - 0.6 ? ' · dropping out' : '');
  else l = 'folding space · to ' + S.next.tg.name; }
  // at most three lines. Under a strong pull the shield's power and the pull take the second line (the shield is made up, the pull is real),
  // and with no job line showing, the real escape speed there takes the third
  const L = l.split('\n'), made = `the Halo is made up · ~4.2 km from needle to engines · visit ${S.visits}`;
  if (!(S.load > 0.12 && S.gTg && shieldLook > 0)) return [L[0], L[1], made].filter(Boolean).join('\n');   // (shieldLook 0: the review's look with no shield)
  const g = S.gTg, nm = g.label && g.label.length < g.name.length && !/^the /.test(g.name) ? g.label : g.name, job = S.phase === 'pass' && !!S.act;
  const v = S.vesc, esc = v >= 0.01 ? Math.round(v*100) + '% of light speed' : Math.round(v*C_KMS).toLocaleString('en') + ' km/s';
  return [L[0], `shield power ${Math.round(S.load*100)}% · ${S.climbK > 0.5 ? 'climbing out of' : 'holding course in'} ${nm}'s gravity`,
    job ? `the Halo and its shield are made up · visit ${S.visits}` : `escape speed here: ${esc} (real) · the Halo is made up`].join('\n');
}

// ---------------------------------------------------------------- test hooks (tests/motion.mjs): start over on a route of its own; force the next target, job or way of travel;
// skip ahead; read the last beams
ship.dbg = {
  // start over as on page load (a fold visit to `key`, 3 s in, nothing left of earlier jobs), its choices drawn from lcg(seed) from now on:
  // with the same seed, clock and camera the ship flies the same route every time
  reset(seed, key = 'saturn'){
    if (S_.act && S_.act.end) S_.act.end();
    hrnd = lcg(seed); actBag.length = 0; FX.length = 0; weapK = 0; rockShape = 0; drone.reset();
    Object.assign(S_, { phase:'pass', t:0, target:null, spool:0, ls:0, scale:1, scoop:0, em:[0, 0, 0, 0], visits:0, force:{}, lastSkim:-9, lastAct:null, plan:null, next:null,
      align:null, leg:null, fold:null, act:null, h:[0, 1, 0], belly:null, vel:[0, 0, 0], speed:0, viewA:0, side:1, hFrom:null, jumpAt:0, stretch:0, lsRun:0, emerge:1, seedN:1, reaim:0,
      ringPh:0, beat:0, load:0, gDir:[0, 1, 0], vesc:0, gTg:null, climbK:0, fk:-9, asm:9, eat:0, csL:false, wz:1, reseat:null, dg:0, dm:0, hfl:0, shK:1, sx:0, sy:0, cc:0 });
    foldVisit(BYKEY[key]); S_.t = 3;
  },
  force(o){ Object.assign(S_.force, o); },
  escapeAt, isHoleTarget, setShield:v => ship.setShield(v),
  replan(){ if (S_.phase !== 'pass') return; const C = pickNext(S_.target); S_.next = { tg:C, mode:travelMode(S_.target, C) }; },
  skip(){ if (S_.phase === 'pass') S_.t = S_.plan.T; else if (S_.phase === 'align') S_.t = S_.jumpAt; },
  get beams(){ return S_.act && S_.act.beams ? S_.act.beams : []; },
  get act(){ return S_.act ? S_.act.kind : null; }, get tau(){ return S_.act ? S_.act.tau : null; }, HALO,
  FX, get plan(){ return S_.plan; }, get next(){ return S_.next; },
  // (the fold's look: its cells, and one draw of its embers and outlines, returning how many points and line ends it made)
  fold:{ get cells(){ return CEL; }, look:foldLook, draw(){ FXB.np = FXB.nl = FXB.ns = 0; foldDraw(); return [FXB.np, FXB.nl]; } },
};

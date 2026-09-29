
// ================================================================ the Halo's weapons test: the fold cannon (0.9.4, the owner's pick of three; made up, like the ship, and its
// readout says so). A ring gun builds itself from embers in front of the needle, like the fold's ember wind: cells about a character on screen
// stream off the bow white-hot and lock into place, cooling to ice blue. Its three rings spin up and space creases round it (ripples in its
// plane, a lensing shimmer round it). Then three shots, one of each: a fold lance (a jagged white-blue crack torn through space to the target,
// light bleeding out of it, sealing behind), a singularity round (a pinpoint black ball in a thin bright photon ring flies to the target, pulls
// light and debris in, then blooms out) and a time echo (a gold bolt that leaves ghost echoes along its path; its blast plays, stops, plays
// backward until the surface is whole again, and the bolt flies back into the gun). Then the gun breaks up into embers that stream back into
// the bow. Nothing about the target changes and every trace fades.
// Everything is drawn through the Halo's point, line and smoke buffers (P_, L_, SM_): the gun relative to the ship, each blast relative to the
// target (the precision rule in 07h-halo.js); hidden behind the hull and the body, and anywhere in a black hole's shadow (owner: no shot may
// show inside it). The gun and each shot are effects of their own (FX), on their own clocks, so a job cut short still ends cleanly (the gun
// breaks up at once). Dice: lcg, never hrnd, so the Halo's route stays the same. This file loads after 07h-halo.js and 07j-scan.js (ACT,
// ACTS, S_, FX and the effect helpers; inShadow).

// the timeline on the gun's clock (s from the start of the job): its cells land from 0.25 to 1.65 s; it spins up over SPIN; each shot
// charges from c and fires at f; it breaks up from B0 (its last ember is back in the hull by B1)
const FCN = { F1:1.7, SPIN:0.7, B0:11.0, B1:12.4, shots:[{ kind:'lance', c:1.95, f:2.4 }, { kind:'sing', c:4.0, f:4.6 }, { kind:'echo', c:7.0, f:7.5 }] };
// the gun in the ship's frame (ship radii, +y forward, the needle's tip at 0.834): its middle, GUN_K along its axis from GUN_C (so ahead of the
// needle and a little toward what it aims at); three rings along its axis (radius, place along the axis, turning rate at full spin in rad/s),
// widest at the back; the muzzle, GUN_MZ ahead of the middle
const GUN_C = [0, 1.12, 0], GUN_K = 0.12, GUN_MZ = 0.2, GUN_RING = [{ r:0.26, a:-0.11, w:1.2 }, { r:0.195, a:0, w:-1.8 }, { r:0.135, a:0.1, w:2.6 }];
// each shot's size as a share of the target's (baseE: its drawn radius; a black hole's shadow x 2.6; half a cloud's bounding radius)
const FC_E = { lance:0.14, sing:0.17, echo:0.15 };
const HOT_ = [1, 0.97, 0.9], VIO_ = [0.8, 0.68, 1], VIOD_ = [0.42, 0.28, 0.9], GOLD_ = [1, 0.8, 0.42], GOLDW_ = [1, 0.95, 0.78], REW_ = [0.5, 0.92, 1];
const FC_TINT = { lance:ICE_, sing:VIO_, echo:GOLD_ };
// one character on screen at camera-relative p, in world units (two scene pixels)
const chW = p => V.len(p)*4*tanY/Math.max(sceneH, 2);
// a hash in [0, 1) of two integers (the fold's, 07-extras.js)
const h01 = (a, b) => foldHash(a | 0, b | 0);
// a ring facing the camera (centre c, radius r), its brightness per piece br(angle): pieces whose ends are hidden are left out
function camRing(c, r, n, col, br, occ, col2 = col){
  const f = V.norm(c), x = V.norm(V.cross(f, cam.up)), y = V.cross(x, f);
  let prev = null, pv = false;
  for (let k=0;k<=n;k++){ const a = k/n*6.2832, q = V.add(c, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), r)), v = !occ(q);
    if (prev && pv && v){ const b = br(a); if (b > 0.004) L_(prev, q, col, b, col2, b); } prev = q; pv = v; }
}
// a ring round c in the plane square to n (world axes); every other piece left out when dashed
function planeRing(c, n, r, m, col, br, occ, dashed){
  const x = anyPerp(n), y = V.cross(n, x); let prev = null, pv = false;
  for (let k=0;k<=m;k++){ const a = k/m*6.2832, q = V.add(c, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), r)), v = !occ(q);
    if (prev && pv && v && (!dashed || k % 2)) L_(prev, q, col, br); prev = q; pv = v; }
}
// a round patch of what is behind darkened (centre O, radius R, world units; op its darkness), with the smoke points, each at most about 13
// characters across: one, or a few rings of them
function shade(O, R, op, hid){
  if (op < 0.01 || hid(O)) return;
  const z = V.dot(O, cam.fwd); if (!(z > 0)) return;
  const dmax = 26*z*2*tanY/Math.max(sceneH, 2);
  if (2*R <= dmax){ SM_(O, op, 2*R); return; }
  const f = V.norm(O), x = V.norm(V.cross(f, cam.up)), y = V.cross(x, f), a = 1 - Math.pow(1 - op, 0.45);
  SM_(O, a, dmax);
  for (let k=1, rr = 0.42*dmax; rr < R && k < 4; k++, rr += 0.42*dmax){ const n = Math.min(Math.ceil(6.2832*rr/(0.45*dmax)), 14);
    for (let i=0;i<n;i++){ const an = (i + 0.5*k)/n*6.2832; SM_(V.add(O, V.add(V.mul(x, Math.cos(an)*rr), V.mul(y, Math.sin(an)*rr))), a*(1 - 0.5*smooth(0.6*R, R, rr)), dmax); } }
}
// a point d nearer the camera than O on the same line of sight: marks that face the camera round a spot on a surface (a dial, a ring, a
// starburst) are drawn there, so that seen at a slant half of them do not sink behind the body
// (never more than a fifth of the way to the camera: close to a planet the camera can be nearer the spot than d)
const fore = (O, d) => { const l = V.len(O); return l > 0 ? V.mul(O, 1 - Math.min(d, 0.2*l)/l) : O; };
// what hides a shot's light: the hull, the body's disc (a planet, a star), or a black hole's whole shadow, in front of it or behind (owner)
// (near: the gun by the ship, which is in front of a black hole and never in its shadow)
function occFor(tg, near){
  const sp = aimSphere(tg);
  if (sp.hole) return near ? p => behindHull(p) : p => inShadow(p, tg.rel, tg.holeR) || behindHull(p);
  if (sp.solid){ const R = sp.r*0.998; return p => behindSphere(p, tg.rel, R) || behindHull(p); }
  return p => behindHull(p);
}
// the size a blast is measured by: the drawn radius, a black hole's shadow x 2.6, half a cloud's bounding radius
const baseE = (tg, sp) => sp.cloud ? tg.rad*0.5*magOf(tg) : sp.hole ? tg.holeR*2.6 : sp.r;
// where a shot lands (target-relative, world axes; its normal): on the part of the body ahead of the ship, which the trailing cameras see
// best; a cloud's heart; beside a black hole's shadow as seen from the ship, 2.8 to 3.4 times its radius from the middle, so the shot shows.
// d: the shot's two dice
function pickHit(tg, d){
  const sp = aimSphere(tg), M0 = V.add(ship.offset, localPt(GUN_C)), L0 = V.len(M0); if (!(L0 > 0)) return null;
  const e = V.mul(M0, -1/L0);
  let a = perpTo(S_.h, e); a = V.len(a) > 1e-6 ? V.norm(a) : anyPerp(e);
  const ra = (d[1] - 0.5)*1.4; a = V.norm(V.add(V.mul(a, Math.cos(ra)), V.mul(V.cross(e, a), Math.sin(ra))));
  if (sp.hole){ const hitT = V.mul(a, tg.holeR*(2.8 + 0.6*d[0])); return { hitT, nrm:V.norm(V.sub(M0, hitT)), sp }; }
  const R = sp.r, th = Math.acos(clamp(R/Math.max(L0, R*1.0001), 0, 1))*(0.2 + 0.3*d[0]);
  const aimP = V.mul(V.norm(V.add(V.mul(e, -Math.cos(th)), V.mul(a, Math.sin(th)))), R);
  const dir = V.norm(V.sub(aimP, M0)); let t = raySphere(M0, dir, [0, 0, 0], R); if (t < 0) t = V.len(V.sub(aimP, M0));
  const hitT = V.add(M0, V.mul(dir, t));
  return { hitT, nrm:sp.cloud ? V.norm(V.sub(M0, hitT)) : V.norm(hitT), sp };
}

// ---------------------------------------------------------------- the job
ACT.weapons = pl => {
  const tg = pl.tg, T = ACTS.weapons.T, A = { kind:'weapons', tau:-9, tg, gun:null, seed:(pl.seed*31 + 7) >>> 0 };
  A.update = (dt, tau) => { A.tau = tau; if (!A.gun && tau >= 0) A.gun = gunStart(A, tau); };
  A.env = () => env(A.tau, T);
  A.line = () => weapLine(A);
  A.cap = () => weapCap(A);
  A.draw = () => {};
  A.end = () => { if (A.gun) gunCut(A.gun); };
  return A;
};
// what it is doing, by the gun's clock: 0 forming, 1 to 3 the shots, 4 breaking up
function weapStage(g){ const t = g.t; return g.cut >= 0 || t >= FCN.B0 ? 4 : t < FCN.shots[0].c ? 0 : t < FCN.shots[1].c ? 1 : t < FCN.shots[2].c ? 2 : 3; }
function weapLine(A){
  const tg = A.tg, g = A.gun; if (A.tau < 0 || !g) return 'approaching ' + tg.name + ' · weapons test ahead (fictional)';
  const surf = !!surfOf(tg) && !isHoleTarget(tg), st = weapStage(g);
  const a = ['the fold cannon forms at the bow', 'fold lance on ' + tg.name, 'singularity round on ' + tg.name, 'time echo on ' + tg.name, 'the fold cannon breaks up into the hull'][st];
  const b = ['every shot fades and leaves no mark', 'the crack in space seals and the blast fades', 'the blast fades and leaves no mark',
    surf ? 'the blast runs backward and the surface heals' : 'the blast runs backward and is gone', 'every blast faded and left no mark'][st];
  return `weapons test (fictional) · ${a}\nnothing real is harmed: ${b}`;
}
// (the showcase's caption: what each part is)
function weapCap(A){
  const g = A.gun, st = g ? weapStage(g) : 0;
  return ['the fold cannon builds itself from embers at the bow', 'a fold lance tears a crack through space, which seals behind it', 'a singularity round pulls light in, then blooms out',
    'a time echo: the blast plays, then runs backward and heals', 'the cannon breaks up into embers and streams back into the hull'][st];
}

// ---------------------------------------------------------------- the gun: its cells (one ember each), about a character on screen, built as it starts to form
function gunCells(r){
  const rpx = clamp(ship.rpx || 30, 8, 400), cells = [];
  GUN_RING.forEach((g, j) => {
    const n = Math.round(clamp(Math.PI*g.r*rpx, 12, 44)), off = r();
    for (let i=0;i<n;i++){
      const k0 = r(), k1 = r(), k2 = r(), fr = (i/n + off) % 1;
      // (it lands at L, after a flight of D s from a point on the needle's edge, sy and sz; it breaks away at B, the last formed first, and is
      // back in the hull Db s later)
      const L = clamp(0.3 + 0.24*j + 0.85*fr + 0.14*(k0 - 0.5), 0.25, 1.62), y = 0.36 + 0.46*k2, w = Math.max(0.108 - 0.1234*(y + 0.041), 0.004)*0.85;
      cells.push({ j, i, n, th:6.2832*i/n, L, D:0.42 + 0.34*k1, B:FCN.B0 + 0.5*(1 - (L - 0.25)/1.37) + 0.08*k0, Db:0.45 + 0.3*k2, sy:y, sz:w*(k1 < 0.5 ? -1 : 1), sw:k0*2 - 1, skip:false });
    }
  });
  return cells;
}
function gunStart(A, tau){
  const r = lcg(A.seed), g = fxAdd({ kind:'gun', tg:A.tg, A, T:FCN.B1 + 0.3, seed:A.seed, ax:[0.6, 0.8, 0], ph:[0, 0, 0], rec:0, nf:0, fireT:-9, cut:-1, rip:[], ripN:FCN.F1 + 0.3,
    dice:[[r(), r()], [r(), r()], [r(), r()]], cur:null });
  g.t = tau; g.cells = gunCells(lcg(A.seed + 99));
  const a = gunAim(g); if (a) g.ax = a[1] < 0.15 ? V.norm([a[0], 0.15, a[2]]) : a;
  g.step = dt => gunStep(g, dt); g.draw = () => gunDraw(g);
  return g;
}
// cut short (the job ended early, or the ship left): it stops firing and breaks up at once, faster; cells still on their way in go out
function gunCut(g){
  if (g.cut >= 0 || g.t >= FCN.B0) return;
  g.cut = g.t;
  for (const c of g.cells){ if (c.L > g.t){ c.skip = true; continue; } c.B = g.t + 0.1 + (c.B - FCN.B0)*0.5; c.Db *= 0.7; }
  g.T = g.t + 1.2;
}
const gunBreak = g => g.cut >= 0 ? g.cut : FCN.B0;
// how far it has spun up (0 to 1), and the charge before a shot: which shot, how far (0 to 1)
const gunSpin = (g, t) => smooth(FCN.F1, FCN.F1 + FCN.SPIN, t)*(1 - smooth(gunBreak(g), gunBreak(g) + 0.5, t));
function gunCharge(g, t){ if (g.cut < 0) for (let k=0;k<3;k++){ const s = FCN.shots[k]; if (t >= s.c && t < s.f) return { k, v:smooth(s.c, s.f, t) }; } return { k:-1, v:0 }; }
// the way its axis wants to point (ship axes): at the shot in flight or held open, otherwise the next one's mark
function gunAim(g){
  if (ship.parent !== g.tg) return null;
  const s = g.cur, live = s && s.t < s.hold && FX.includes(s);
  let hitT = live ? s.q : null;
  if (!hitT){ if (g.nf >= 3){ if (!s) return null; hitT = s.q; } else { const h = pickHit(g.tg, g.dice[g.nf]); if (!h) return null; hitT = h.hitT; } }
  return V.norm(M3.applyT(ship.R0, V.sub(hitT, V.add(ship.offset, localPt(GUN_C)))));
}
function gunFrame(g){ const a = g.ax, u = V.norm(V.cross(a, Math.abs(a[2]) < 0.8 ? [0, 0, 1] : [1, 0, 0])); return { a, u, v:V.cross(a, u) }; }
// a point of ring j at angle th (ship axes, ship radii)
function gunRingPt(g, F, j, th, rs = 1){ const R = GUN_RING[j], k = GUN_K + R.a + g.rec, rr = R.r*rs, c = Math.cos(th)*rr, s = Math.sin(th)*rr;
  return [GUN_C[0] + F.a[0]*k + F.u[0]*c + F.v[0]*s, GUN_C[1] + F.a[1]*k + F.u[1]*c + F.v[1]*s, GUN_C[2] + F.a[2]*k + F.u[2]*c + F.v[2]*s]; }
const gunMid = g => V.add(GUN_C, V.mul(g.ax, GUN_K)), gunMzL = g => V.add(GUN_C, V.mul(g.ax, GUN_K + GUN_MZ + g.rec));
const gunLive = g => g.t < gunBreak(g) + 0.3 && FX.includes(g);
function gunStep(g, dt){
  const t = g.t;
  if (g.cut < 0 && t < FCN.B0 && (S_.act !== g.A || ship.parent !== g.tg || S_.phase === 'light' || S_.phase === 'fold')) gunCut(g);
  const ch = gunCharge(g, t), sp = gunSpin(g, t);
  for (let j=0;j<3;j++) g.ph[j] += dt*GUN_RING[j].w*sp*(1 + 2.2*ch.v)*(reduceMotion ? 0.4 : 1);
  let want = gunAim(g); if (want){ if (want[1] < 0.15) want = V.norm([want[0], 0.15, want[2]]); g.ax = V.norm(V.lerp(g.ax, want, 1 - Math.exp(-dt*4))); }
  while (g.cut < 0 && g.nf < 3 && t >= FCN.shots[g.nf].f){ fireShot(g, FCN.shots[g.nf].kind, g.dice[g.nf]); g.nf++; g.fireT = t; g.rip.push({ t0:t, k:1 }); }
  // (space creases round it while it is spun up: a faint ripple now and then, a strong one with each shot)
  if (sp > 0.5 && g.cut < 0 && t < FCN.B0 && t >= g.ripN){ g.rip.push({ t0:t, k:0.35 }); g.ripN = t + 1.6; }
  while (g.rip.length && t - g.rip[0].t0 > 1.6) g.rip.shift();
  // (it kicks back a little as it fires)
  const f = t - g.fireT; g.rec = f >= 0 && f < 0.6 ? -0.035*Math.exp(-f/0.09)*Math.cos(f*18) : 0;
  // the needle's tip glows as the gun draws power (the bow gun's light in the ship's shader): while it forms, while it charges, and as it fires
  const form = smooth(0, 0.3, t)*(1 - smooth(FCN.F1 - 0.3, FCN.F1, t)) + smooth(gunBreak(g), gunBreak(g) + 0.3, t)*(1 - smooth(FCN.B1 - 0.5, FCN.B1, t));
  S_.em[2] = Math.max(S_.em[2], 0.4*form + 0.8*ch.v + (f >= 0 ? Math.exp(-f/0.08) : 0));
}
// (scratch)
const GP = [0, 0, 0], GQ = [0, 0, 0];
const bez2 = (a, b, c, s) => { const m = 1 - s; return [m*m*a[0] + 2*m*s*b[0] + s*s*c[0], m*m*a[1] + 2*m*s*b[1] + s*s*c[1], m*m*a[2] + 2*m*s*b[2] + s*s*c[2]]; };
function gunDraw(g){
  const t = g.t, S = S_;
  if (!(ship.dist < ship.labelRange) || !(ship.rpx > 3) || S.scale < 0.5 || V.dot(ship.rel, cam.fwd) < -ship.rad*3) return;
  const F = gunFrame(g), tg = g.tg, occ = occFor(tg, true), ks = smooth(3, 16, ship.rpx), bs = gunBreak(g), R = ship.R0, rel = ship.rel;
  const vis = p => V.dot(p, cam.fwd) > ship.rad*0.05 && !occ(p), hide = p => !vis(p);
  const ch = gunCharge(g, t), sp = gunSpin(g, t), f = t - g.fireT, fl = f >= 0 && f < 0.6 ? Math.exp(-f/0.12) : 0;
  const tint = ch.k >= 0 ? FC_TINT[FCN.shots[ch.k].kind] : g.nf ? FC_TINT[FCN.shots[g.nf - 1].kind] : ICE_, tk = Math.max(ch.v, 0.7*fl);
  // (the side of the bow the camera sees: the embers leave from there)
  const sd = -(R[0]*rel[0] + R[1]*rel[1] + R[2]*rel[2]) > 0 ? 1 : -1;
  const whole = smooth(FCN.F1 - 0.2, FCN.F1 + 0.2, t)*(1 - smooth(bs, bs + 0.3, t));
  // the cells: an ember flying in off the bow, a piece of ring in place (white-hot as it lands, then ice blue), white-hot again as it breaks
  // away, an ember flying home
  for (const c of g.cells){
    if (c.skip) continue;
    const t0 = c.L - c.D, th = c.th + g.ph[c.j], src = [sd*0.012, c.sy, c.sz];
    if (t < t0) continue;
    if (t < c.L || (t >= c.B + 0.12 && t < c.B + 0.12 + c.Db)){
      const inb = t < c.L, s = inb ? smooth(0, 1, (t - t0)/c.D) : smooth(0, 1, (t - c.B - 0.12)/c.Db), dst = gunRingPt(g, F, c.j, th);
      const rc = gunRingPt(g, F, c.j, th, 0), ctrl = V.add(V.lerp(src, dst, 0.5), V.add(V.mul(V.sub(dst, rc), 0.9), V.mul(V.cross(F.a, V.sub(dst, rc)), 0.6*c.sw)));
      const at = u => inb ? bez2(src, ctrl, dst, u) : bez2(dst, ctrl, src, u), l = at(s), l2 = at(Math.max(s - 0.07, 0));
      toShip(GP, l[0], l[1], l[2]); if (!vis(GP)) continue;
      const b = (inb ? 1.3 + 0.8*s : 1.8*(1 - smooth(0.75, 1, s)))*(0.6 + 0.4*ks);
      mix3(ECOL, WHITE, ICE_, inb ? 0.3*s : 0.2 + 0.6*s);
      P_(GP, ECOL, b, s < 0.4 ? -3 : -2);
      if (!reduceMotion){ toShip(GQ, l2[0], l2[1], l2[2]); L_(GQ, GP, DEEP_, b*0.05, ECOL, b*0.3); }
      continue;
    }
    if (t >= c.B + 0.12) continue;
    // in place: a piece of its ring, 0.84 of its share, brighter with the charge (a wave running round it) and as it fires
    const heat = Math.max(Math.exp(-(t - c.L)/0.22), smooth(c.B - 0.06, c.B + 0.12, t)), dth = 3.1416/c.n*0.84;
    const a0 = gunRingPt(g, F, c.j, th - dth), a1 = gunRingPt(g, F, c.j, th + dth);
    toShip(GP, a0[0], a0[1], a0[2]); toShip(GQ, a1[0], a1[1], a1[2]); if (!vis(GP) || !vis(GQ)) continue;
    const wave = Math.pow(0.5 + 0.5*Math.cos(th*2 - t*9 + c.j), 6), b = (0.3 + 0.25*sp + 0.9*heat + (0.25 + 0.6*wave)*ch.v + 0.6*fl)*(0.45 + 0.55*ks);
    mix3(ECOL, ICE_, tint, 0.55*tk); mix3(ECOL, ECOL, HOT_, heat);
    L_(GP, GQ, ECOL, b);
    if (t < c.L + 0.1){ const m = V.lerp(GP, GQ, 0.5); P_(m, WHITE, 1.8*(1 - (t - c.L)/0.1), -3); }
  }
  // three bright nodes on each ring, turning with it (so the spin reads even when the ring is a few characters across)
  if (whole > 0.01) for (let j=0;j<3;j++) for (let k=0;k<3;k++){
    const l = gunRingPt(g, F, j, g.ph[j] + k*2.0944 + j*0.5); toShip(GP, l[0], l[1], l[2]); if (!vis(GP)) continue;
    mix3(ECOL, WHITE, tint, 0.35 + 0.3*tk); P_(GP, ECOL, (0.8 + 0.4*sp + 1.2*ch.v + fl)*whole*(0.5 + 0.5*ks), -3);
  }
  // the feed: beads of light running out along a thin line from the needle's tip to the gun, busier as it charges
  if (whole > 0.01){
    const tip = [0, 0.845, 0], c0 = gunRingPt(g, F, 0, 0, 0);
    for (let i=0;i<5;i++){ const u = ((t*(1.2 + 2.5*ch.v) + i/5) % 1), l = V.lerp(tip, c0, u); toShip(GP, l[0], l[1], l[2]); if (vis(GP)) P_(GP, ICE_, (0.25 + 1.1*ch.v)*Math.sin(3.1416*u)*whole, -2); }
  }
  // the charge: motes of light spiralling from the back ring into the muzzle, a glow gathering there (a black point for the singularity round)
  const mzL = gunMzL(g); toShip(GP, mzL[0], mzL[1], mzL[2]); const mz = GP.slice(), mzV = vis(mz);
  if (ch.k >= 0){
    const kind = FCN.shots[ch.k].kind, v = ch.v, c0 = gunRingPt(g, F, 0, 0, 0);
    for (let i=0;i<12;i++){
      const u = (t*(1.4 + 1.5*v) + i/12) % 1, rr = GUN_RING[0].r*(1 - u)*(1 - u), an = i*2.4 + u*5*(i % 2 ? 1 : -1), cc = V.lerp(c0, mzL, u);
      const l = V.add(cc, V.add(V.mul(F.u, Math.cos(an)*rr), V.mul(F.v, Math.sin(an)*rr))); toShip(GQ, l[0], l[1], l[2]);
      if (vis(GQ)) P_(GQ, u > 0.7 ? WHITE : tint, v*(0.35 + 0.9*u), -2);
    }
    if (mzV){
      if (kind === 'sing'){ SM_(mz, 0.9*v, -(3 + 4*v)); camRing(mz, (0.9 + 0.6*v)*chW(mz), 20, VIO_, a => 0.3*v*(0.4 + Math.pow(0.5 + 0.5*Math.cos(a - t*8), 3)), occ, WHITE); }
      else P_(mz, tint, 0.5 + 2*v, -(3 + 6*v));
    }
  }
  // the shot leaving: a flash at the muzzle
  if (fl > 0.01 && mzV){ P_(mz, WHITE, 3*fl, -12); P_(mz, tint, 1.1*fl, -22); }
  // space creases round it: ripples spreading in its plane, dashed, and a faint lensing shimmer round it (arcs of bent light that come and go)
  if (sp > 0.01 || g.rip.length){
    const cW = shipPt(gunMid(g)), nW = localDir(F.a);
    for (const q of g.rip){ const tt = t - q.t0, rr = (0.25 + 0.85*(1 - Math.exp(-tt*2.2)))*ship.rad, b = q.k*0.4*Math.pow(1 - tt/1.6, 2)*(0.5 + 0.5*ks);
      if (b > 0.005) planeRing(cW, nW, rr, 40, q.k > 0.5 ? mix3([0, 0, 0], ICE_, tint, 0.5) : ICE_, b, hide, true); }
    const sh = sp*(1 - smooth(bs, bs + 0.4, t))*ks;
    if (sh > 0.01 && V.dot(cW, cam.fwd) > 0){
      camRing(cW, 0.3*ship.rad, 48, ICE_, a => sh*0.22*Math.max(0, Math.sin(3*a + t*1.7)*Math.sin(5*a - t*2.3 + 1) - 0.1), hide, WHITE);
      const fw = V.norm(cW), x = V.norm(V.cross(fw, cam.up)), y = V.cross(x, fw);
      for (let k=0;k<6;k++){
        const cyc = t/1.1 + k/6, n = Math.floor(cyc), u = cyc - n, a0 = h01(n, k)*6.2832, rr = (0.36 + 0.1*h01(n, k + 9))*ship.rad, b = sh*0.3*Math.sin(3.1416*u);
        let prev = null; for (let m=0;m<=4;m++){ const a = a0 + m*0.11, q = V.add(cW, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), rr)); if (prev && vis(q) && vis(prev)) L_(prev, q, WHITE, b, ICE_, b); prev = q; }
      }
    }
  }
}

// ---------------------------------------------------------------- the shots
// Each is an effect tied to the target (anc, q: where it lands, target-relative); it leaves from the gun's muzzle (base: where that was as it
// fired, ship-relative, kept in space by its drift) and its dice are lcg
const SHOT_INIT = {};
function fireShot(g, kind, d){
  const tg = g.tg, h = pickHit(tg, d); if (!h) return;
  const s = fxAdd({ kind:'fc-' + kind, anc:tg, q:h.hitT, n:h.nrm, cloud:!h.sp.solid, dark:!!h.sp.hole, base:localPt(gunMzL(g)), drift:[0, 0, 0], gun:g,
    r:lcg((g.seed*7 + g.nf*131 + 3) >>> 0), E:baseE(tg, h.sp)*FC_E[kind], T:9, hold:0 });
  g.cur = s;
  const a = shotFrom(s), b = V.add(tg.rel, s.q); s.za = V.dot(a, cam.fwd); s.zb = V.dot(b, cam.fwd);
  SHOT_INIT[kind](s);
}
// where a shot leaves from (camera-relative): the gun's muzzle while the gun is there, otherwise where the muzzle was as it fired (kept in space)
const shotFrom = s => s.gun && gunLive(s.gun) ? shipPt(gunMzL(s.gun)) : shotFired(s);
const shotFired = s => V.sub(V.add(ship.rel, s.base), s.drift);
// how far along its path (0 to 1) a shot is when it has crossed a share w of the screen between the two ends, as the camera saw them when it
// fired: a shot moving evenly along its path, seen from beside the ship, would cross the screen in its first hundredth and then crawl
const pathU = (s, w) => s.za > 0 && s.zb > 0.02*s.za ? w*s.za/((1 - w)*s.zb + w*s.za) : w;
// the plane of the target at the hit (two directions across it): the surface's, or, in a cloud or by a black hole, square to the view
function hitFrame(s, O){
  if (!s.cloud){ const x = anyPerp(s.n); return [x, V.cross(s.n, x)]; }
  const f = V.norm(O), x = V.norm(V.cross(f, cam.up)); return [x, V.cross(x, f)];
}

// -- the fold lance: a crack torn through space from the gun to the target (TT s), held open, light bleeding out of it, and sealed from the gun
// end (from TS, over SEAL s); where it strikes, the crack splits into rays and a blast goes off
const LN = { TT:0.17, TS:1.0, SEAL:0.45 };
const LNP = [], LNQ = [], LNV = [];
SHOT_INIT.lance = s => {
  const r = s.r, a = shotFrom(s), b = V.add(s.anc.rel, s.q), ab = V.sub(b, a), za = V.dot(a, cam.fwd), zb = V.dot(b, cam.fwd);
  s.T = LN.TS + LN.SEAL + 0.6; s.hold = LN.TS + LN.SEAL; s.o = []; s.u = [];
  // its corners, fixed along it (u), about four characters apart on the screen as it is torn: evenly spread on the screen over the part in
  // front of the camera (to where it is a fifth as deep as the gun), and one more at its end. Evenly spread along it, a crack seen in depth
  // from beside the ship had one corner in view. Its head, its seal and its corners are counted in w, 0 to 1 over the corners
  let u1 = 1, z1 = zb; if (za > 0 && zb < 0.2*za){ z1 = 0.2*za; u1 = (za - z1)/(za - zb); }
  const sc = p => { const z = Math.max(V.dot(p, cam.fwd), 1e-30); return [V.dot(p, cam.right)/(z*tanX)*sceneW*0.25, V.dot(p, cam.up)/(z*tanY)*sceneH*0.25]; };
  const q0 = sc(a), q1 = sc(V.add(a, V.mul(ab, u1))), nc = za > 0 ? Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) : 60, M = Math.round(clamp(nc/4.2, 10, 44));
  for (let i=0;i<M;i++){ const w = i > 0 && i < M - 1 ? (i + 0.7*(r() - 0.5))/(M - 1) : i/(M - 1); s.u.push(za > 0 ? u1*w*za/((1 - w)*z1 + w*za) : w); }
  if (u1 < 0.999) s.u.push(1);
  s.M = s.u.length;
  // (a zigzag, now and then two the same way, now and then a big one)
  // (a zigzag, now and then two the same way, now and then a big one, on a slow meander)
  let sg = r() < 0.5 ? -1 : 1; const ph = r()*6.28; for (let i=0;i<s.M;i++){ if (r() > 0.25) sg = -sg; s.o.push(sg*(0.3 + 0.55*r())*(r() < 0.18 ? 1.8 : 1) + 0.6*Math.sin(i*0.55 + ph)); }
  const M1 = s.M;
  s.br = [0, 1, 2, 3].map(() => ({ i:2 + Math.floor(r()*Math.max(M1 - 5, 1)), sg:r() < 0.5 ? -1 : 1, ang:0.45 + 0.5*r(), len:3 + 4*r(), j:[r()*2 - 1, r()*2 - 1] }));
  s.rays = [0, 1, 2, 3, 4, 5, 6].map(k => ({ a:(k + 0.6*r())/7*6.2832, len:1.1 + 1.4*r(), j:[r()*2 - 1, r()*2 - 1] }));
  s.bm = blastModel(lcg((s.r()*4294967296) >>> 0), s);
  s.step = () => { if (!s.boom && s.t >= LN.TT){ s.boom = true; blastFx(s, s.bm, 'fire', 3.3, 1); } };
  s.draw = () => lanceDraw(s);
};
// (u at w, between its corners)
const lnU = (s, w) => { const x = clamp(w, 0, 1)*(s.M - 1), k = Math.min(Math.floor(x), s.M - 2); return s.u[k] + (s.u[k + 1] - s.u[k])*(x - k); };
function lanceDraw(s){
  const t = s.t, M = s.M, a = shotFrom(s), b = V.add(s.anc.rel, s.q), ab = V.sub(b, a), L = V.len(ab); if (!(L > 0)) return;
  const occ = occFor(s.anc), vis = p => V.dot(p, cam.fwd) > 0 && !occ(p), dir = V.mul(ab, 1/L), at = w => V.add(a, V.mul(ab, lnU(s, w)));
  const wh = t < LN.TT ? 1 - Math.pow(1 - t/LN.TT, 2) : 1, ws = smooth(LN.TS, LN.TS + LN.SEAL, t), fk = i => 0.75 + 0.25*Math.sin(t*37 + i*2.1)*Math.sin(t*23 - i*1.3);
  // the corners: along the line, pushed across it in the plane of the screen by up to about two characters (none at the ends)
  for (let i=0;i<M;i++){
    const q = V.add(a, V.mul(ab, s.u[i])), c = V.cross(dir, q), cl = V.len(c), pp = cl > 0 ? V.mul(c, 1/cl) : anyPerp(dir);
    LNP[i] = V.add(q, V.mul(pp, i > 0 && i < M - 1 ? s.o[i]*2*chW(q) : 0)); LNQ[i] = pp; LNV[i] = vis(LNP[i]);
  }
  const wI = w => w*(M - 1);
  // where it has sealed: a thin straight scar, fading
  if (ws > 0){ const f = 1 - smooth(LN.TS + 0.2, LN.TS + LN.SEAL + 0.5, t); if (f > 0) pathLine(u => at(u*ws), L*lnU(s, ws), DEEP_, 0.07*f, occ, ICE_, 0.12*f, 12); }
  // the open crack, from the seal to its head: a white core with its two lips in ice blue beside it
  for (let i=0;i<M - 1;i++){
    const w0 = i/(M - 1), w1 = (i + 1)/(M - 1); if (w1 <= ws || w0 >= wh || !LNV[i] || !LNV[i + 1]) continue;
    let p0 = LNP[i], p1 = LNP[i + 1];
    if (w1 > wh) p1 = V.lerp(p0, p1, wI(wh) - i);
    if (w0 < ws) p0 = V.lerp(p0, LNP[i + 1], wI(ws) - i);
    const b0 = 1.1*fk(i);
    // (space round the crack goes dark, so it reads over a bright planet, and over a black hole's disc most of all)
    if (i % 2 === 0) SM_(V.lerp(p0, p1, 0.5), (s.dark ? 0.7 : 0.3)*(1 - smooth(LN.TS, LN.TS + LN.SEAL, t)), -8);
    L_(p0, p1, WHITE, b0, WHITE, b0);
    // (one lip, on the side it bends toward, a little dimmer)
    const sd = s.o[i] + s.o[i + 1] > 0 ? 0.6 : -0.6, e0 = sd*chW(p0), e1 = sd*chW(p1);
    const l0 = V.add(p0, V.mul(LNQ[i], e0)), l1 = V.add(p1, V.mul(LNQ[i + 1], e1)); if (vis(l0) && vis(l1)) L_(l0, l1, ICE_, 0.22*fk(i + 7));
  }
  // light bleeding out of it: short rays and glints at its corners, flickering
  for (let i=1;i<M - 1;i++){
    const w = i/(M - 1); if (w <= ws || w >= wh || !LNV[i]) continue;
    const h = h01(i, Math.floor(t*12)), p = LNP[i]; P_(p, ICE_, 0.7*fk(i), -3); if (h < 0.2) continue;
    // (a ray out of each bend, on its outer side, and now and then one on the inner side too)
    const cw = chW(p), sg = s.o[i] > 0 ? 1 : -1, q = V.add(p, V.mul(V.add(V.mul(LNQ[i], sg), V.mul(dir, (h - 0.6)*0.8)), (1 + 2.6*h)*cw));
    if (vis(q)) L_(p, q, WHITE, 0.55*h, DEEP_, 0);
    if (h > 0.7){ const q2 = V.add(p, V.mul(LNQ[i], -sg*(0.8 + h)*cw)); if (vis(q2)) L_(p, q2, ICE_, 0.35*h, DEEP_, 0); }
  }
  // forks off it, at an angle in the plane of the screen
  for (const B of s.br){
    const w = B.i/(M - 1); if (w <= ws || !LNV[B.i]) continue;
    const gr = smooth(w, Math.min(w + 0.12, 1), wh), p = LNP[B.i], cw = chW(p), sd = V.mul(LNQ[B.i], B.sg), dd = V.add(V.mul(dir, Math.cos(B.ang)), V.mul(sd, Math.sin(B.ang)));
    let prev = p; for (let k=1;k<=3;k++){ const q = V.add(V.add(p, V.mul(dd, B.len*cw*k/3*gr)), V.mul(sd, (k < 3 ? B.j[k - 1] : 0)*0.7*cw)); if (vis(q) && vis(prev)) L_(prev, q, WHITE, 0.75*fk(B.i + k)*(1.1 - k/3), ICE_, 0.55*(1.1 - k/3)); prev = q; }
  }
  // the head, tearing
  if (t < LN.TT + 0.04){ const x = Math.min(wI(wh), M - 1.001), k = Math.floor(x), hp = V.lerp(LNP[k], LNP[k + 1], x - k); if (vis(hp)){ P_(hp, WHITE, 2.6, -5); P_(hp, ICE_, 0.8, -12); } }
  // the seal, closing along it
  if (ws > 0 && ws < 1){ const fp = at(ws); if (vis(fp)){ P_(fp, WHITE, 1.8, -3); P_(fp, ICE_, 0.5, -9); } }
  // where it strikes: the crack splits into rays round the spot, which close as it seals
  if (t >= LN.TT){
    const gr = smooth(LN.TT, LN.TT + 0.12, t)*(1 - smooth(LN.TS + LN.SEAL*0.5, LN.TS + LN.SEAL, t)), [x, y] = hitFrame(s, b);
    if (gr > 0.01) for (const R of s.rays){
      const dx = V.add(V.mul(x, Math.cos(R.a)), V.mul(y, Math.sin(R.a))), px = V.add(V.mul(x, -Math.sin(R.a)), V.mul(y, Math.cos(R.a)));
      let prev = b; for (let k=1;k<=3;k++){ const q = V.add(V.add(b, V.mul(dx, s.E*R.len*gr*k/3)), V.mul(px, (k < 3 ? R.j[k - 1] : 0)*0.2*s.E*R.len*gr)); if (vis(q) && vis(prev)) L_(prev, q, WHITE, 0.8*fk(k + R.a)*(1.15 - k/3), ICE_, 0.55*(1.15 - k/3)); prev = q; }
      if (vis(prev)) P_(prev, ICE_, 0.5*gr, -2);
    }
  }
}

// -- a blast on (or in) the target, made of embers like the fold (about a character each, never a ball of light): a crisp starburst, a shell of
// embers flying out, slowing, cooling from white to orange to red and dark, sparks streaking off, a quick shock ring, the ground under it
// darkened a little so the embers show over a bright planet, and a few puffs of smoke. blastDraw draws it at any time t, so it can also run
// backward (the time echo). Palettes: 'fire' (white, orange, red, dark) and 'violet'
function blastModel(r, s){
  const n = s.n, cl = s.cloud, rd = () => { const z = r()*2 - 1, a = r()*6.2832, q = Math.sqrt(1 - z*z); return [q*Math.cos(a), z, q*Math.sin(a)]; };
  const out = d => cl ? d : (V.dot(d, n) < 0.1 ? V.norm(V.add(d, V.mul(n, 1.2))) : d), dir = k => out(V.norm(V.add(V.mul(n, cl ? 0 : k), rd())));
  return { cl, dark:!!s.dark, emb:Array.from({ length:96 }, () => ({ d:dir(0.6), sp:0.35 + 1.1*Math.pow(r(), 0.7), heat:r(), rise:r(), big:r() < 0.3 })),
    sparks:Array.from({ length:48 }, () => ({ d:dir(0.45), s:3 + 6*r(), life:0.6 + 1.0*r(), hot:r() })),
    smoke:Array.from({ length:10 }, () => ({ d:out(V.norm(V.add(V.mul(n, cl ? 0 : 1), V.mul(rd(), 0.8)))), r:0.3 + 0.7*r(), at:0.5 + 0.6*r() })),
    ray:r()*0.8 };
}
// fire as it cools (f: 0 white-hot, 1 orange, 2 deep red, 3 dark), and the singularity's violet
function fireCol(f){
  if (f < 0.35) return V.lerp([1, 0.98, 0.9], [1, 0.85, 0.45], f/0.35);
  if (f < 1) return V.lerp([1, 0.85, 0.45], [1, 0.45, 0.12], (f - 0.35)/0.65);
  if (f < 2) return V.lerp([1, 0.45, 0.12], [0.55, 0.12, 0.04], f - 1);
  return V.lerp([0.55, 0.12, 0.04], [0.12, 0.05, 0.03], Math.min(f - 2, 1));
}
function violetCol(f){
  if (f < 0.35) return V.lerp([1, 0.97, 1], [0.85, 0.76, 1], f/0.35);
  if (f < 1) return V.lerp([0.85, 0.76, 1], [0.62, 0.45, 1], (f - 0.35)/0.65);
  if (f < 2) return V.lerp([0.62, 0.45, 1], [0.3, 0.18, 0.62], f - 1);
  return V.lerp([0.3, 0.18, 0.62], [0.07, 0.05, 0.14], Math.min(f - 2, 1));
}
// a starburst in the plane of the screen (centre O, rays up to R long): crisp thin rays, four long and four short, fading within a quarter second
function burst(O, R, t, k, c, hid, a0 = 0){
  const fd = Math.exp(-t/0.16)*k, gr = 1 - Math.exp(-t*14); if (fd < 0.01 || hid(O)) return;
  P_(O, WHITE, 2.6*fd, -6);
  for (let i=0;i<8;i++){ const a = a0 + i*0.7854, u = V.add(V.mul(cam.right, Math.cos(a)), V.mul(cam.up, Math.sin(a))), len = R*(i % 2 ? 0.5 : 1)*gr;
    const q0 = V.add(O, V.mul(u, len*0.08)), q1 = V.add(O, V.mul(u, len)); if (!hid(q1)) L_(q0, q1, WHITE, 0.7*fd, c, 0); }
}
// (o: tint, tk how much of it; jit, a jitter in characters, as if time stuttered; dim, a share of the light)
function blastDraw(B, O, n, E, t, hid, pal, o = {}){
  if (!(t >= 0)) return;
  const col = pal === 'violet' ? violetCol : fireCol, tk = o.tk || 0, dim = o.dim ?? 1, jit = o.jit || 0, fr = Math.floor(GT*20);
  const C = c => tk > 0 ? V.lerp(c, o.tint, tk) : c, J = (p, i) => jit > 0 ? V.add(p, V.mul(V.add(V.mul(cam.right, h01(i, fr) - 0.5), V.mul(cam.up, h01(i + 999, fr) - 0.5)), jit*chW(p))) : p;
  const Of = fore(O, 2.5*E);
  if (dim > 0.5) burst(Of, E*2.2, t, dim, C(pal === 'violet' ? VIO_ : [1, 0.85, 0.5]), hid, B.ray);
  // (the ground under it darkens a little while it burns, so its embers read over a bright surface; much more over a black hole's white-hot disc)
  const dk = smooth(0, 0.12, t)*(1 - smooth(1.2, 2.6, t))*dim; if (dk > 0.01) shade(Of, E*(B.dark ? 2.6 : 1.8), (B.dark ? 0.8 : B.cl ? 0.25 : 0.45)*dk, hid);
  const grow = 1 - Math.exp(-t*2.8);
  B.emb.forEach((b, i) => {
    const f = t/(0.3 + 0.9*b.heat), br = (f < 2.6 ? 1 - smooth(1.6, 2.6, f) : 0)*(1.5 - 0.4*Math.min(f, 2))*smooth(0, 0.04, t); if (br < 0.01) return;
    const p = J(V.add(V.add(O, V.mul(b.d, E*b.sp*(0.12 + 1.5*grow))), V.mul(n, E*0.35*b.rise*t*(B.cl ? 0 : 1))), i);
    if (!hid(p)) P_(p, C(col(0.12 + f*1.1)), br*(f < 0.4 ? 1.1 : 1.4)*dim, b.big && f < 0.6 ? -3 : -2);
  });
  B.sparks.forEach((s, i) => { const f = 1 - t/s.life; if (f <= 0) return; const k = 1.6, x = E*s.s*(1 - Math.exp(-k*t))/k, v = E*s.s*Math.exp(-k*t);
    const p = J(V.add(O, V.mul(s.d, x)), i + 300), p2 = V.sub(p, V.mul(s.d, v*0.07)); if (!hid(p) && !hid(p2)) L_(p2, p, C(col(1.4 + (1 - f))), 0.25*f*dim, C(col(0.5 + (1 - f)*1.5)), (0.7 + 0.5*s.hot)*f*dim); });
  const u = t/0.75; if (u > 0 && u < 1){ const r = E*(0.5 + 3.2*(1 - Math.exp(-t*3.5))), b = 0.7*(1 - u)*(1 - u)*dim;
    if (B.cl) camRing(O, r, 64, C([0.75, 0.85, 1]), () => b, hid); else planeRing(O, n, r, 64, C([0.75, 0.85, 1]), b, hid, false); }
  for (const m of B.smoke){ const tt = t - m.at; if (tt <= 0) continue; const f = Math.min(tt/0.6, 1)*(1 - smooth(1.2, 3, tt)); if (f <= 0) continue;
    const p = V.add(O, V.mul(m.d, E*(0.5 + 0.9*m.r)*(1 + tt*0.35))); if (!hid(p)) SM_(p, 0.5*f*dim, E*(0.35 + 0.25*tt)); }
  const ember = smooth(0.2, 0.6, t)*(1 - smooth(1.5, 3.2, t)); if (ember > 0.01 && !hid(O)) P_(O, C(col(1.2)), 0.8*ember*dim, -4);
}
// a blast as an effect of its own, tied to the target (it outlives the shot that made it)
function blastFx(s, B, pal, T, k){
  return fxAdd({ kind:'fc-blast', anc:s.anc, q:s.q, T, draw(e){ blastDraw(B, V.add(e.anc.rel, e.q), s.n, s.E*k, e.t, occFor(e.anc), pal); } });
}

// -- the singularity round: a pinpoint black ball in a thin bright photon ring flies to the target (TF s, speeding up), pulls light and debris
// in round where it lands (TI s), then blooms out in six petals of violet light and fire
const SG = { TF:1.25, TI:0.75, TB:2.6 };
SHOT_INIT.sing = s => {
  const r = s.r;
  s.T = SG.TF + SG.TI + SG.TB; s.hold = SG.TF + SG.TI;
  s.fx = anyPerp(s.n); s.fy = V.cross(s.n, s.fx);
  s.pull = Array.from({ length:110 }, () => ({ a:r()*6.2832, rr:1.3 + 2.7*Math.sqrt(r()), h:s.cloud ? (r() - 0.5)*1.6 : r()*0.5, deb:r() < 0.4, sw:0.8 + 1.4*r(), k:r() }));
  // (the bloom's shell: directions over the half above the surface (all round in a cloud), faster in six lobes round the normal: petals)
  s.shell = Array.from({ length:150 }, () => { const z = s.cloud ? r()*2 - 1 : 0.15 + 0.85*r(), a = r()*6.2832, q = Math.sqrt(1 - z*z);
    return { d:V.add(V.add(V.mul(s.fx, q*Math.cos(a)), V.mul(s.fy, q*Math.sin(a))), V.mul(s.n, z)), pf:0.5 + 0.5*Math.abs(Math.cos(3*a)), k:r() }; });
  s.bm = blastModel(lcg((r()*4294967296) >>> 0), s);
  const fc = s.anc.farColor || [1, 0.8, 0.6], mx = Math.max(fc[0], fc[1], fc[2], 1e-3); s.deb = [0.4 + 0.6*fc[0]/mx, 0.4 + 0.6*fc[1]/mx, 0.4 + 0.6*fc[2]/mx];
  s.draw = () => singDraw(s);
};
// the ball: a dark disc about three characters across, its photon ring (brighter on one side, turning), a faint lensing ring, and light
// streaking into it
function singBall(p, k, t, occ){
  if (V.dot(p, cam.fwd) <= 0 || occ(p)) return;
  const cw = chW(p);
  SM_(p, 0.95, -12*k);
  camRing(p, 2.5*k*cw, 44, VIO_, a => 0.25 + 0.7*Math.pow(0.5 + 0.5*Math.cos(a - t*6), 3), occ, WHITE);
  camRing(p, 3.5*k*cw, 32, VIOD_, a => 0.08*(0.5 + 0.5*Math.sin(5*a + t*9)), occ);
  const f = V.norm(p), x = V.norm(V.cross(f, cam.up)), y = V.cross(x, f);
  for (let i=0;i<8;i++){ const fr = (t*1.4 + i/8) % 1, rr = (6.5 - 4.4*fr)*cw*k, an = i*0.785 + t*0.9 + fr*1.2, d = V.add(V.mul(x, Math.cos(an)), V.mul(y, Math.sin(an)));
    const q0 = V.add(p, V.mul(d, rr)), q1 = V.add(p, V.mul(d, rr - 1.3*cw*k)); if (!occ(q0) && !occ(q1)) L_(q0, q1, VIOD_, 0.1*fr, WHITE, 0.45*fr*(1 - fr)*4); }
}
function singDraw(s){
  const t = s.t, O = V.add(s.anc.rel, s.q), occ = occFor(s.anc), vis = p => V.dot(p, cam.fwd) > 0 && !occ(p), hide = p => !vis(p);
  if (t < SG.TF){
    const a = shotFired(s), path = w => V.add(a, V.mul(V.sub(O, a), pathU(s, Math.pow(w, 1.3))));
    singBall(path(t/SG.TF), 1, t, occ);
    for (let k=1;k<=6;k++){ const q = path(Math.max(t - k*0.03, 0)/SG.TF); if (vis(q)) P_(q, VIOD_, 0.35*(1 - k/7), -2); }
    return;
  }
  const ti = t - SG.TF, [x, y] = hitFrame(s, O);
  if (ti < SG.TI){
    // the pull: light and debris round the spot spiral in, faster and faster; a ring of light closes on it; the ground round it dims
    const w = ti/SG.TI, ww = Math.pow(w, 2.2), w2 = Math.pow(Math.max(w - 0.06, 0), 2.2);
    for (const q of s.pull){
      const pos = ww_ => { const rr = q.rr*s.E*(1 - ww_), an = q.a + q.sw*ww_*2.2; return V.add(V.add(O, V.add(V.mul(x, Math.cos(an)*rr), V.mul(y, Math.sin(an)*rr))), V.mul(s.n, q.h*s.E*(1 - ww_))); };
      // (each on its own schedule, gone as it reaches the ball: swallowed, never piling up into a ball of light)
      const wi = clamp(w/(0.62 + 0.38*q.k), 0, 1), wj = clamp((w - 0.06)/(0.62 + 0.38*q.k), 0, 1), p = pos(Math.pow(wi, 2.2)); if (!vis(p) || wi >= 1) continue;
      const b = (0.6 + 1.4*wi)*(q.deb ? 0.7 : 1)*smooth(0, 0.12, w)*(1 - smooth(0.75, 1, wi)), c = q.deb ? s.deb : V.lerp(VIO_, WHITE, wi);
      const pj = pos(Math.pow(wj, 2.2)); P_(p, c, b, -2); if (vis(pj)) L_(pj, p, c, 0.1*b, c, 0.5*b);
    }
    // (a ring of light closing on it, round as seen from here; the ground round it going dark as it drinks the light)
    const rr = 2.6*s.E*(1 - Math.pow(w, 1.6)), b = (0.35 + 0.5*w)*(1 - smooth(0.7, 1, w));
    const Of = fore(O, 3*s.E);
    camRing(Of, rr, 56, V.lerp(VIO_, WHITE, w), () => b, hide, WHITE);
    shade(Of, s.E*(2.2 - 0.9*w), 0.85*smooth(0, 0.5, w), hide);
    singBall(Of, 1 + 0.9*w, t, occ);
    return;
  }
  // the bloom
  const tb = ti - SG.TI;
  if (vis(O)) P_(O, VIO_, 1.4*Math.exp(-tb/0.25), -12);
  const gr = 1 - Math.exp(-tb*2.2), fd = Math.exp(-tb/0.8);
  for (const q of s.shell){ const p = V.add(O, V.mul(q.d, s.E*(0.3 + 4.2*q.pf*gr))); if (!vis(p)) continue;
    const c = tb < 0.2 ? V.lerp(WHITE, VIO_, tb/0.2) : V.lerp(VIO_, VIOD_, Math.min((tb - 0.2)/1.2, 1)); P_(p, c, (0.6 + 0.6*q.k)*fd*(0.6 + 0.4*q.pf), -2); }
  blastDraw(s.bm, O, s.n, s.E*1.15, tb, occ, 'violet');
  for (let k=0;k<2;k++){ const tk = tb - k*0.15, u = tk/0.9; if (u <= 0 || u >= 1) continue; const r = s.E*(0.6 + 3.4*(1 - Math.exp(-tk*3.2))), b = 0.6*(1 - u)*(1 - u);
    if (s.cloud || k === 1) camRing(fore(O, 3*s.E), r, 64, VIO_, () => b, hide); else planeRing(O, s.n, r, 64, VIO_, b, hide, false); }
}

// -- the time echo: a gold bolt flies to the target (TF s) leaving ghost echoes along its path; its blast plays (TB s), stands still,
// stuttering (TZ s), runs backward (TR s) with a faint echo of itself a moment behind, while a dial of twelve ticks round it sweeps back;
// as time reaches the moment it struck, a thin ring closes on the spot (it heals) and the bolt flies back into the gun (TK s)
const EC = { TF:0.45, TB:0.8, TZ:0.45, TR:0.8, TK:0.5, NG:9 };
SHOT_INIT.echo = s => {
  s.T = EC.TF + EC.TB + EC.TZ + EC.TR + EC.TK + 0.4; s.hold = s.T - 0.3;
  s.bm = blastModel(lcg((s.r()*4294967296) >>> 0), s);
  s.draw = () => echoDraw(s);
};
function echoDraw(s){
  const t = s.t, O = V.add(s.anc.rel, s.q), occ = occFor(s.anc), vis = p => V.dot(p, cam.fwd) > 0 && !occ(p), hide = p => !vis(p);
  const t1 = EC.TF, t2 = t1 + EC.TB, t3 = t2 + EC.TZ, t4 = t3 + EC.TR, t5 = t4 + EC.TK, back = t >= t4;
  // (out from where the muzzle was as it fired; back into the muzzle where it is now: the path swings over while time runs back)
  const a = t < t3 ? shotFired(s) : V.lerp(shotFired(s), shotFrom(s), smooth(t3, t4 + 0.1, t)), at = w => V.add(a, V.mul(V.sub(O, a), pathU(s, w)));
  // the bolt, out and back, with a short tail; the gun catches it with a flash
  const ub = t < t1 ? t/t1 : back && t < t5 ? 1 - Math.pow((t - t4)/EC.TK, 1.3) : -1;
  if (ub >= 0){ const p = at(ub), q = at(clamp(ub + (back ? 0.1 : -0.1), 0, 1));
    if (vis(p)){ P_(p, back ? WHITE : GOLDW_, 3, -6); P_(p, back ? REW_ : GOLD_, 1, -14); if (vis(q)) L_(q, p, back ? REW_ : GOLD_, 0.05, WHITE, 0.9); } }
  if (t >= t5 && t < t5 + 0.4){ const p = shotFrom(s), f = 1 - (t - t5)/0.4; if (vis(p)){ P_(p, WHITE, 2.4*f*f, -8); P_(p, REW_, 0.9*f, -18); } }
  // ghost echoes along its path: left as the bolt passes, strobing as they fade; faint again while time runs back, and each goes out as the
  // bolt flies back through it
  for (let k=0;k<EC.NG;k++){
    const uk = (k + 0.5)/EC.NG, tk = uk*t1; if (t < tk) continue;
    let b, c = GOLD_;
    if (t < t3) b = 1.1*Math.exp(-(t - tk)/0.8)*(0.7 + 0.3*Math.cos((t - tk)*24));
    else { const tb = t4 + Math.pow(1 - uk, 1/1.3)*EC.TK; b = t < tb ? 0.35*smooth(t3, t3 + 0.3, t) + 0.9*smooth(tb - 0.12, tb, t) : 0; c = REW_; }
    if (b < 0.01) continue;
    const p = at(uk); if (!vis(p)) continue;
    // (each a small copy of the bolt: a bright point and a dash along the path about two characters long)
    const q0 = at(Math.max(uk - 0.035, 0)), q1 = at(Math.min(uk + 0.035, 1));
    P_(p, c, 1.6*b, -7); if (vis(q0) && vis(q1)) L_(q0, q1, c, 0.5*b, WHITE, 0.5*b);
  }
  // the blast: forward, standing still (stuttering), backward, dimmer as it closes back on the spot (with its echo a moment behind)
  if (t >= t1 && t < t4 + 0.05){
    let tb, o;
    if (t < t2){ tb = t - t1; o = {}; }
    else if (t < t3){ tb = EC.TB; o = { jit:0.5, tint:REW_, tk:0.3*smooth(t2, t3, t) }; }
    else { tb = EC.TB*(1 - smooth(0, 1, (t - t3)/EC.TR)); o = { tint:REW_, tk:0.3, jit:0.12, dim:0.35 + 0.65*smooth(0.04, 0.35, tb) }; }
    blastDraw(s.bm, O, s.n, s.E, tb, occ, 'fire', o);
    if (t >= t3) blastDraw(s.bm, O, s.n, s.E, Math.min(tb + 0.2, EC.TB), occ, 'fire', { tint:REW_, tk:0.85, dim:0.3 });
  }
  // the dial: twelve ticks round the blast and a hand sweeping backward, faster as time runs back
  if (t >= t2 && t < t4 + 0.15 && vis(O)){
    const k = smooth(t2, t2 + 0.15, t)*(1 - smooth(t4 - 0.1, t4 + 0.15, t)), R = 2.1*s.E, Of = fore(O, 3*s.E), f = V.norm(O), x = V.norm(V.cross(f, cam.up)), y = V.cross(x, f);
    const dAt = (an, r) => V.add(Of, V.mul(V.add(V.mul(x, Math.cos(an)), V.mul(y, Math.sin(an))), r));
    camRing(Of, R, 60, GOLD_, () => 0.1*k, hide);
    for (let i=0;i<12;i++){ const an = i*0.5236, p0 = dAt(an, R*0.86), p1 = dAt(an, R*1.08); if (vis(p0) && vis(p1)) L_(p0, p1, GOLDW_, 0.6*k*(i % 3 ? 0.6 : 1)); }
    const an = 1.5708 + (t < t3 ? (t - t2)*1.5 : EC.TZ*1.5 + (t - t3)*11), p1 = dAt(an, R*0.8);
    if (vis(p1)) pathLine(u => V.lerp(Of, p1, u), R*0.8, REW_, 0.1*k, hide, WHITE, 0.5*k, 6);
  }
  // it heals: a thin ring closes on the spot as time reaches the moment it struck, and one spark
  if (t >= t4 - 0.3 && t < t4 + 0.35){
    const w = clamp((t - t4 + 0.3)/0.6, 0, 1), rr = 2.2*s.E*(1 - w), b = 0.5*Math.sin(3.1416*w);
    camRing(fore(O, 2.5*s.E), rr, 56, REW_, () => b, hide, WHITE);
    if (vis(O)) P_(O, WHITE, 1.4*Math.sin(3.1416*w), -4);
  }
}

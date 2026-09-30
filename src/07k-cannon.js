
// ================================================================ the Halo's weapons test: Pip becomes the fold cannon (0.9.7, the owner's pick: the 0.9.4 ring gun that
// built itself in front of the needle looked "meh and unnatural"; made up, like the ship, and its readout says so). Pip, the drone, flies to
// the needle's tip, settles there facing ahead and winks (PIPJ.weapons, 07i-drone.js). Its shell breaks into cells that stream along the
// needle and lock into a long barrel pivoted on the tip, its two eyes glowing at the muzzle. Light runs from the heart down the hull into it.
// Then a volley of three plasma bolts (a flash, sparks and a glowing crater each), and a charged finale: a ball of folded space, dark in a
// bright rim with starlight bent round it, that blooms on impact into a shock ring across the surface. The barrel vents, the cells stream
// back into Pip, and Pip does a happy twirl. By a black hole the shots fall in instead: they redden, stretch and fade at the shadow's edge,
// and only a faint ring of light shows where they went (owner, 2026-09-27: shots falling into black holes). Nothing about the target changes
// and every trace fades: the craters cool from white to red to dark and are gone.
// Everything is drawn through the Halo's point, line and smoke buffers (P_, L_, SM_): the barrel relative to the ship, each shot and blast
// relative to the target (the precision rule in 07h-halo.js); hidden behind the hull and the body, and anywhere in a black hole's shadow
// (owner: no shot may show inside it). The gun and each shot are effects of their own (FX), on their own clocks, so a job cut short still
// ends cleanly (the barrel turns back into Pip at once). Dice: lcg, never hrnd, so the Halo's route stays the same. This file loads after
// 07h-halo.js, 07i-drone.js and 07j-scan.js (ACT, ACTS, S_, FX, the effect helpers, PIP and its break-up, inShadow).

// the timeline on the gun's clock (s from the moment Pip, docked and ready, starts to change): Pip becomes the barrel from TF over TFD; the
// heart's light runs into it from PW over PWD; the three bolts fire at `bolts`; the finale charges from C0 and fires at F; the barrel vents
// from V0 to V1; it turns back into Pip from RF over RFD; the test is over at END (Pip twirls after it)
const PG = { TF:0.15, TFD:1.3, PW:1.5, PWD:0.75, bolts:[2.4, 2.8, 3.2], C0:3.55, F:5.0, V0:5.15, V1:6.3, RF:6.45, RFD:1.3, END:7.85 };
// the barrel, in the ship's frame (ship radii, +y forward, the needle's tip at 0.835): pivoted a little over the tip (PV); rings along its axis
// (place from the pivot, radius), the last the muzzle's flare, where Pip's eyes glow
const GUN_C = [-0.012, 0.84, 0], GUN_ST = [[-0.1, 0.058], [-0.01, 0.054], [0.08, 0.05], [0.17, 0.047], [0.26, 0.044], [0.35, 0.042], [0.43, 0.046], [0.5, 0.068]];
const GUN_MZ = GUN_ST[GUN_ST.length - 1][0];
// each shot's size as a share of the target's (baseE: its drawn radius; a black hole's shadow x 2.6; half a cloud's bounding radius)
const PG_E = { bolt:0.07, ball:0.15 };
const HOT_ = [1, 0.97, 0.9], VIO_ = [0.8, 0.68, 1], REDS_ = [1, 0.35, 0.18];
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
// a point d nearer the camera than O on the same line of sight: marks that face the camera round a spot on a surface (a ring, a starburst)
// are drawn there, so that seen at a slant half of them do not sink behind the body (never more than a fifth of the way to the camera)
const fore = (O, d) => { const l = V.len(O); return l > 0 ? V.mul(O, 1 - Math.min(d, 0.2*l)/l) : O; };
// what hides a shot's light: the hull, the body's disc (a planet, a star), or a black hole's whole shadow, in front of it or behind (owner)
// (near: the barrel by the ship, which is in front of a black hole and never in its shadow)
function occFor(tg, near){
  const sp = aimSphere(tg);
  if (sp.hole) return near ? p => behindHull(p) : p => inShadow(p, tg.rel, tg.holeR) || behindHull(p);
  if (sp.solid){ const R = sp.r*0.998; return p => behindSphere(p, tg.rel, R) || behindHull(p); }
  return p => behindHull(p);
}
// the size a blast is measured by: the drawn radius, a black hole's shadow x 2.6, half a cloud's bounding radius
const baseE = (tg, sp) => sp.cloud ? tg.rad*0.5*magOf(tg) : sp.hole ? tg.holeR*2.6 : sp.r;
// where a shot lands (target-relative, world axes; its normal): on the part of the body ahead of the ship, which the trailing cameras see
// best; a cloud's heart; by a black hole, the edge of its shadow (the shot falls in there). d: the shot's two dice
function pickHit(tg, d){
  const sp = aimSphere(tg), M0 = V.add(ship.offset, localPt(GUN_C)), L0 = V.len(M0); if (!(L0 > 0)) return null;
  const e = V.mul(M0, -1/L0);
  let a = perpTo(S_.h, e); a = V.len(a) > 1e-6 ? V.norm(a) : anyPerp(e);
  const ra = (d[1] - 0.5)*1.4; a = V.norm(V.add(V.mul(a, Math.cos(ra)), V.mul(V.cross(e, a), Math.sin(ra))));
  if (sp.hole){ const hitT = V.mul(a, tg.holeR*(1.02 + 0.1*d[0])); return { hitT, nrm:V.norm(V.sub(M0, hitT)), sp, fall:a }; }
  const R = sp.r, th = Math.acos(clamp(R/Math.max(L0, R*1.0001), 0, 1))*(0.2 + 0.3*d[0]);
  const aimP = V.mul(V.norm(V.add(V.mul(e, -Math.cos(th)), V.mul(a, Math.sin(th)))), R);
  const dir = V.norm(V.sub(aimP, M0)); let t = raySphere(M0, dir, [0, 0, 0], R); if (t < 0) t = V.len(V.sub(aimP, M0));
  const hitT = V.add(M0, V.mul(dir, t));
  return { hitT, nrm:sp.cloud ? V.norm(V.sub(M0, hitT)) : V.norm(hitT), sp };
}

// ---------------------------------------------------------------- the job
ACT.weapons = pl => {
  const tg = pl.tg, T = ACTS.weapons.T, A = { kind:'weapons', tau:-9, tg, gun:null, t0:0, seed:(pl.seed*31 + 7) >>> 0, gunDone:false };
  A.update = (dt, tau) => {
    A.tau = tau;
    // (the cannon forms once Pip is docked at the tip and has winked, and the ship has come to the part of its pass where it works)
    if (!A.gun && !A.gunDone && tau >= 0 && pipDocked(A)){ A.gun = gunStart(A); A.t0 = tau; }
    // (no Pip to become the cannon: the stay is ending, or it waited too long)
    if (!A.gun && !A.gunDone && ((tau > 2 && !pipOut() && !pipWant()) || tau > 30)) A.gunDone = true;
  };
  A.env = () => env(A.tau, A.gun ? A.t0 + PG.END + 3.5 : Math.max(T, A.tau + 2));
  A.line = () => weapLine(A);
  A.cap = () => weapCap(A);
  A.done = () => A.gunDone && (!A.gun || A.gun.t > PG.END || A.gun.cut >= 0);
  A.draw = () => {};
  A.cut = () => { if (A.gun) gunCut(A.gun); else A.gunDone = true; };
  A.end = () => { if (A.gun) gunCut(A.gun); A.gunDone = true; };
  return A;
};
// what it is doing, by the gun's clock: 0 Pip on its way or docking, 1 becoming the barrel, 2 powering up, 3 the volley, 4 the finale's charge,
// 5 the finale, 6 venting, 7 back into Pip
function weapStage(A){
  const g = A.gun; if (!g) return 0; const t = g.t;
  return g.cut >= 0 ? 7 : t < PG.TF + PG.TFD ? 1 : t < PG.bolts[0] - 0.1 ? 2 : t < PG.C0 ? 3 : t < PG.F ? 4 : t < PG.V0 ? 5 : t < PG.RF ? 6 : 7;
}
function weapLine(A){
  const tg = A.tg, st = weapStage(A), hole = isHoleTarget(tg);
  if (A.tau < 0 && !A.gun) return 'approaching ' + tg.name + ' · weapons test ahead (fictional)';
  const a = [PIP.st === 'out' && PIP.g && PIP.g.dock === A ? 'Pip docks at the tip of the needle' : 'Pip flies to the tip of the needle', 'Pip turns into the fold cannon',
    "the heart's light runs down the hull into the cannon", 'a volley of plasma bolts at ' + tg.name, 'the fold cannon charges a ball of folded space',
    'a ball of folded space at ' + tg.name, 'the fold cannon vents', 'the fold cannon turns back into Pip'][st];
  const b = hole ? 'the shots fall into the black hole and are gone' : st >= 3 ? 'the craters cool and fade, and nothing is left' : 'every shot fades and leaves no mark';
  return `weapons test (fictional) · ${a}\nnothing real is harmed: ${b}`;
}
// (the showcase's caption: what each part is)
function weapCap(A){
  return ['Pip flies to the tip of the needle and docks', 'Pip breaks into cells that lock into a barrel on the needle', "the heart's light runs down the hull into the barrel",
    'a volley of plasma bolts', 'Pip charges a ball of folded space', 'the ball blooms into a shock ring', 'the barrel vents', 'the barrel turns back into Pip'][weapStage(A)];
}

// ---------------------------------------------------------------- the barrel: rings of cells along its axis, built from Pip's embers (07i-drone.js: pipTransform, pipFar)
// (its rings' cells: as many round each ring as about one character each on screen, 6 to 14, fixed as the gun starts)
function gunStart(A){
  const r = lcg(A.seed), rpx = clamp(ship.rpx || 30, 8, 600), NS = Math.round(clamp(2*Math.PI*0.04*rpx/5, 6, 14)), NC = GUN_ST.length*NS;
  const d0 = [r(), r()], hits = [d0, [clamp(d0[0] + (r() - 0.5)*0.2, 0, 1), clamp(d0[1] + (r() - 0.5)*0.16, 0, 1)], [clamp(d0[0] + (r() - 0.5)*0.2, 0, 1), clamp(d0[1] + (r() - 0.5)*0.16, 0, 1)], [d0[0], d0[1]]];
  const g = fxAdd({ kind:'gun', tg:A.tg, A, T:PG.END + 0.6, seed:A.seed, ax:[0, 1, 0], rec:0, recK:0, fireT:-9, nb:0, ball:false, tIn:false, tOut:false, cut:-1, NS, NC,
    lock:new Float64Array(NC).fill(9), un:new Float64Array(NC).fill(-9), hits, cur:null, eyes:0, blink:lcg(A.seed + 3) });
  GUN = g;
  const a = gunAim(g); if (a) g.ax = a;
  g.step = dt => gunStep(g, dt); g.draw = () => gunDraw(g);
  return g;
}
// the gun Pip's embers are streaming to or from (07i-drone.js asks for its cells' places)
let GUN = null;
// the barrel's frame (ship axes): its axis; w, its "up" (toward the ship's top, -x, square to the axis); h across it (where Pip's eyes sit)
function gunFrame(g){ const a = g.ax; let w = perpTo([-1, 0, 0], a); w = V.len(w) > 1e-3 ? V.norm(w) : V.norm(perpTo([0, 0, 1], a)); return { a, w, h:V.cross(a, w) }; }
// a point of ring j at angle th (ship axes, ship radii), rs of its radius out; its recoil moves it back along its axis
function gunPt(g, F, j, th, rs = 1){ const st = GUN_ST[j], k = st[0] + g.rec, rr = st[1]*rs, c = Math.cos(th)*rr, s = Math.sin(th)*rr;
  return [GUN_C[0] + F.a[0]*k + F.h[0]*c + F.w[0]*s, GUN_C[1] + F.a[1]*k + F.h[1]*c + F.w[1]*s, GUN_C[2] + F.a[2]*k + F.h[2]*c + F.w[2]*s]; }
// cell c: its ring and its angle
const gunCellJ = (g, c) => Math.floor(c/g.NS), gunCellTh = (g, c) => ((c % g.NS) + 0.5)/g.NS*6.2832 + 0.4*gunCellJ(g, c);
// (07i-drone.js) the barrel's middle, and the cell of ember i, ship-relative in world axes
function gunMidL(){ const g = GUN; return g ? localPt(V.add(GUN_C, V.mul(g.ax, 0.2))) : localPt(HULL.bay); }
const gunEmbC = (g, i) => (i*37 + (i >> 3)) % g.NC;
function gunCellW(i){ const g = GUN; if (!g) return localPt(HULL.bay); const F = gunFrame(g), c = gunEmbC(g, i); return localPt(gunPt(g, F, gunCellJ(g, c), gunCellTh(g, c))); }
// (07i-drone.js, as a break-up to or from the barrel starts) each cell lights as the first of its embers lands, or goes dark as the last leaves
function gunLocks(q){
  const g = GUN; if (!g || !q.cells) return;
  const n = q.cells.n, out = q.bk.mode > 0;
  if (out) g.lock.fill(9); else g.un.fill(-9);
  for (let i=0;i<n;i++){ const w = emberWhen(q, i), c = gunEmbC(g, i); if (out) g.lock[c] = Math.min(g.lock[c], w[1]); else g.un[c] = Math.max(g.un[c], w[0]); }
  // (a cell no ember came to lights with the last of them)
  if (out){ let m = 0; for (const x of g.lock) if (x < 9) m = Math.max(m, x); for (let c=0;c<g.NC;c++) if (g.lock[c] >= 9) g.lock[c] = m; }
}
// cut short (the job ended early, or the ship must leave): no more shots; if Pip is the barrel it turns back at once, quickly
function gunCut(g){
  if (g.cut >= 0 || g.t >= PG.END) return;
  g.cut = g.t;
  if (PIP.form === 'gun' && !PIP.bk && !PIP.hurry) pipTransform(-1, 0.8);
  g.T = g.t + 1.6;
}
// the way its axis wants to point (ship axes): at the next shot's mark, or the last one's; never more than 70 degrees off the needle
function gunAim(g){
  if (ship.parent !== g.tg) return null;
  const k = Math.min(g.ball ? 3 : g.nb, 3), h = g.cur && g.cur.t < 0.4 && FX.includes(g.cur) ? { hitT:g.cur.q } : pickHit(g.tg, g.hits[k]); if (!h) return null;
  let a = V.norm(M3.applyT(ship.R0, V.sub(V.add(g.tg.rel, h.hitT), V.add(ship.rel, localPt(GUN_C)))));
  if (a[1] < 0.342){ const s = V.norm([a[0], 0, a[2]]); a = V.norm(V.add(V.mul(s, 0.94), [0, 0.342, 0])); }
  return a;
}
const gunMzL = g => V.add(GUN_C, V.mul(g.ax, GUN_MZ + g.rec + 0.012));
function gunStep(g, dt){
  const t = g.t, A = g.A;
  if (g.cut < 0 && t < PG.END && (S_.act !== A || ship.parent !== g.tg || S_.phase === 'light' || S_.phase === 'fold' || (PIP.hurry && t > PG.TF))) gunCut(g);
  // Pip into the barrel; out of it again (a cut one turns back as soon as it has become the barrel)
  if (!g.tIn && t >= PG.TF && g.cut < 0){ g.tIn = true; if (!pipTransform(1, PG.TFD)) gunCut(g); }
  if (!g.tOut && (t >= PG.RF || g.cut >= 0) && PIP.form === 'gun' && !PIP.bk && !PIP.hurry){ g.tOut = true; pipTransform(-1, g.cut >= 0 ? 0.8 : PG.RFD); }
  if (!A.gunDone && ((t >= PG.RF && PIP.form === 'pod' && !PIP.bk) || (g.cut >= 0 && (PIP.form === 'pod' || PIP.hurry) && !(PIP.bk && PIP.bk.gun)) || PIP.st !== 'out')) A.gunDone = t >= PG.TF || g.cut >= 0 || PIP.st !== 'out';
  // aim, quickly between shots
  let want = gunAim(g); if (want) g.ax = V.norm(V.lerp(g.ax, want, 1 - Math.exp(-dt*6)));
  if (g.cut < 0 && PIP.form === 'gun'){
    while (g.nb < 3 && t >= PG.bolts[g.nb]){ fireShot(g, 'bolt', g.hits[g.nb]); g.nb++; g.fireT = t; g.recK = 0.028; }
    if (!g.ball && t >= PG.F){ g.ball = true; fireShot(g, 'ball', g.hits[3]); g.fireT = t; g.recK = 0.07; }
  }
  // (it kicks back along its axis as it fires and springs forward again)
  const f = t - g.fireT; g.rec = f >= 0 && f < 0.7 ? -g.recK*Math.exp(-f/0.09)*Math.cos(f*16) : 0;
  // the needle's tip glows as the power reaches it and as it fires (the bow gun's light in the ship's shader)
  const pw = smooth(PG.PW, PG.PW + 0.4, t)*(1 - smooth(PG.PW + PG.PWD, PG.PW + PG.PWD + 0.4, t)), ch = t >= PG.C0 && t < PG.F ? smooth(PG.C0, PG.F, t) : 0;
  S_.em[2] = Math.max(S_.em[2], 0.9*pw + 0.9*ch + (f >= 0 ? 1.2*Math.exp(-f/0.1) : 0));
  // Pip's eyes at the muzzle: open once it is the barrel, blinking now and then
  g.eyes += ((PIP.form === 'gun' ? 1 : 0) - g.eyes)*(1 - Math.exp(-dt*6));
}
// (scratch)
const GP = [0, 0, 0], GQ = [0, 0, 0];
// the path the heart's light runs along to the barrel: from the heart over the top of the hull to the needle's tip (ship axes)
const PG_FEED = [[-0.045, -0.3, 0], [-0.055, -0.16, 0], [-0.08, 0.02, 0], [-0.07, 0.2, 0], [-0.055, 0.42, 0], [-0.03, 0.66, 0], [-0.016, 0.8, 0]];
let PG_FEEDP = null;
function gunDraw(g){
  const t = g.t;
  if (!(ship.dist < ship.labelRange) || !(ship.rpx > 3) || S_.scale < 0.5 || V.dot(ship.rel, cam.fwd) < -ship.rad*3) return;
  const F = gunFrame(g), occ = occFor(g.tg, true), vis = p => V.dot(p, cam.fwd) > ship.rad*0.03 && !occ(p), ks = smooth(3, 16, ship.rpx);
  const q = PIP, bk = q.bk && q.bk.gun ? q.bk : null, formed = q.form === 'gun' && !bk, dt1 = 1/Math.max(PG.TFD, 0.3);
  const f = t - g.fireT, fl = f >= 0 && f < 0.5 ? Math.exp(-f/0.1) : 0, ch = t >= PG.C0 && t < PG.F && g.cut < 0 ? smooth(PG.C0, PG.F, t) : 0;
  const hot = g.ball ? Math.exp(-Math.max(t - PG.F, 0)/0.9) : 0, pw = t >= PG.PW && t < PG.PW + PG.PWD + 0.5 ? 1 : 0;
  // the cells: a piece of its ring each, white-hot as it locks, cooling to ice blue; a wave of light runs from the breech to the muzzle as the
  // power arrives and while it charges; hot orange after the finale, cooling
  let any = false;
  for (let c=0;c<g.NC;c++){
    let on = formed, heat = 0;
    if (bk && bk.mode > 0){ on = q.bp >= g.lock[c]; heat = on ? Math.exp(-(q.bp - g.lock[c])/(0.2*dt1)) : 0; }
    else if (bk && bk.mode < 0){ on = q.bp < g.un[c]; heat = on ? Math.exp(-(g.un[c] - q.bp)/(0.15*dt1)) : 0; }
    if (!on) continue;
    any = true;
    const j = gunCellJ(g, c), th = gunCellTh(g, c), dth = 3.1416/g.NS*0.8, a0 = gunPt(g, F, j, th - dth), a1 = gunPt(g, F, j, th + dth);
    toShip(GP, a0[0], a0[1], a0[2]); toShip(GQ, a1[0], a1[1], a1[2]); if (!vis(GP) || !vis(GQ)) continue;
    const u = j/(GUN_ST.length - 1), wave = pw*Math.pow(0.5 + 0.5*Math.cos(6.2832*(u - (t - PG.PW)*1.6)), 6) + ch*Math.pow(0.5 + 0.5*Math.cos(6.2832*(u*1.5 - t*(1.5 + 2*ch))), 4);
    const b = (0.35 + 0.8*heat + 0.9*wave + 0.5*ch + 0.7*fl*(0.3 + 0.7*u) + 0.4*hot)*(0.5 + 0.5*ks);
    mix3(ECOL, ICE_, WHITE, Math.min(heat + 0.5*wave, 1)); if (hot > 0.05) mix3(ECOL, ECOL, [1, 0.55, 0.25], 0.8*hot*(1 - heat));
    L_(GP, GQ, ECOL, b);
    if (heat > 0.5){ const m = V.lerp(GP, GQ, 0.5); P_(m, WHITE, 1.4*heat, -3); }
  }
  if (!any && !formed) return;
  // the rails: four lines along it, where both ends' cells are there
  const railK = formed ? 1 : bk && bk.mode > 0 ? smooth(0.85, 1, q.bp) : bk ? 1 - smooth(0, 0.2, q.bp) : 0;
  if (railK > 0.01) for (let k=0;k<4;k++){
    const th = 0.785 + k*1.5708;
    for (let j=0;j<GUN_ST.length - 1;j++){ const p0 = gunPt(g, F, j, th, 1.02), p1 = gunPt(g, F, j + 1, th, 1.02); toShip(GP, p0[0], p0[1], p0[2]); toShip(GQ, p1[0], p1[1], p1[2]);
      if (vis(GP) && vis(GQ)) L_(GP, GQ, ICE_, (0.16 + 0.3*ch + 0.25*hot)*railK*(0.5 + 0.5*ks), hot > 0.1 ? [1, 0.6, 0.3] : DEEP_, 0.12*railK); }
  }
  // Pip's eyes at the muzzle: two blue lights across its face; they narrow while it charges and flash as it fires
  const E = g.eyes*(formed ? 1 : 0); if (E > 0.02){
    const bl = ((t*0.37) % 1) < 0.05 ? 0.15 : 1, mz = GUN_ST[GUN_ST.length - 1][1];
    for (const s of [-1, 1]){ const l = V.add(V.add(GUN_C, V.mul(F.a, GUN_MZ + g.rec + 0.004)), V.add(V.mul(F.h, s*0.5*mz), V.mul(F.w, 0.12*mz))); toShip(GP, l[0], l[1], l[2]);
      if (vis(GP)){ mix3(ECOL, [0.45, 0.78, 1], WHITE, Math.min(fl + 0.4*ch, 1)); P_(GP, ECOL, E*bl*(1.3 + 1.2*ch + 2*fl), ch > 0.3 ? -2 : -3); } }
  }
  // the heart's light running down the hull into the barrel: beads along the top of the hull from the heart to the tip, a bright one in front
  if (t >= PG.PW - 0.1 && (t < PG.PW + PG.PWD + 0.4 || ch > 0) && g.cut < 0){
    if (!PG_FEEDP) PG_FEEDP = crPath(PG_FEED);
    const k = ch > 0 ? 0.5*ch : smooth(PG.PW - 0.1, PG.PW + 0.1, t)*(1 - smooth(PG.PW + PG.PWD, PG.PW + PG.PWD + 0.4, t)), front = ch > 0 ? 1 : clamp((t - PG.PW)/PG.PWD, 0, 1);
    for (let i=0;i<9;i++){ const s = ch > 0 ? (t*0.9 + i/9) % 1 : front - i*0.05; if (s < 0 || s > 1) continue;
      const l = PG_FEEDP(s); toShip(GP, l[0], l[1], l[2]); if (vis(GP)) P_(GP, i === 0 && ch === 0 ? WHITE : ICE_, k*(i === 0 && ch === 0 ? 1.8 : 0.9 - 0.06*i), i === 0 ? -3 : -2); }
  }
  // the finale's charge: motes spiralling into the muzzle, a glow gathering there, and starlight bending round it (arcs that slide round)
  const mz = gunMzL(g); toShip(GP, mz[0], mz[1], mz[2]); const mzW = GP.slice(), mzV = vis(mzW);
  if (ch > 0){
    for (let i=0;i<14;i++){
      const u = (t*(1.2 + 1.6*ch) + i/14) % 1, rr = 0.16*(1 - u)*(1 - u), an = i*2.4 + u*5*(i % 2 ? 1 : -1), c0 = V.add(mz, V.mul(F.a, 0.05*(1 - u)));
      const l = V.add(c0, V.add(V.mul(F.h, Math.cos(an)*rr), V.mul(F.w, Math.sin(an)*rr))); toShip(GQ, l[0], l[1], l[2]);
      if (vis(GQ)) P_(GQ, u > 0.7 ? WHITE : ICE_, ch*(0.35 + 0.9*u), -2);
    }
    if (mzV){ SM_(mzW, 0.8*ch, -(3 + 5*ch)); camRing(mzW, (0.8 + 0.8*ch)*chW(mzW), 24, ICE_, a => ch*(0.2 + 0.6*Math.pow(0.5 + 0.5*Math.cos(a - t*9), 3)), occ, WHITE);
      const fw = V.norm(mzW), x = V.norm(V.cross(fw, cam.up)), y = V.cross(x, fw);
      for (let k=0;k<5;k++){ const a0 = k*1.2566 - t*(1.5 + 2*ch), rr = (2.4 + 0.5*Math.sin(t*3 + k))*chW(mzW)*(0.7 + 0.6*ch);
        let prev = null; for (let m=0;m<=4;m++){ const a = a0 + m*0.13, p = V.add(mzW, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), rr)); if (prev && vis(p) && vis(prev)) L_(prev, p, WHITE, 0.45*ch, ICE_, 0.45*ch); prev = p; } }
    }
  }
  // each shot leaving: a flash at the muzzle, a ring of it thrown forward with the finale
  if (fl > 0.01 && mzV){ P_(mzW, WHITE, 3*fl, -10); P_(mzW, ICE_, 1.1*fl, -20);
    if (g.ball && f < 0.5){ const r = ship.rad*(0.04 + 0.5*(1 - Math.exp(-f*6))); planeRing(V.add(mzW, V.mul(localDir(F.a), ship.rad*0.25*f)), localDir(F.a), r, 36, ICE_, 0.5*fl, p => !vis(p), false); } }
  // venting after the finale: puffs of steam from slits along both sides, and the barrel cooling
  if (t >= PG.V0 && t < PG.V1 && g.cut < 0) for (let k=0;k<4;k++){
    const s = [0.03, 0.15, 0.27, 0.38][k], sd = k % 2 ? 1 : -1, tt = t - PG.V0 - 0.12*k; if (tt < 0 || tt > 0.9) continue;
    const base = V.add(V.add(GUN_C, V.mul(F.a, s + g.rec)), V.mul(F.h, sd*0.055)), dir = V.add(V.mul(F.h, sd), V.mul(F.w, -0.3)), e = 1 - tt/0.9;
    for (let m=0;m<3;m++){ const d = 0.02 + 0.09*tt + 0.03*m, l = V.add(base, V.mul(dir, d)); toShip(GP, l[0], l[1], l[2]); if (!vis(GP)) continue; SM_(GP, 0.25*e, ship.rad*(0.02 + 0.05*tt)); P_(GP, [0.85, 0.92, 1], 0.7*e*(1 - m/3), -2); }
    const l0 = V.add(base, V.mul(dir, 0.01)), l1 = V.add(base, V.mul(dir, 0.05 + 0.08*tt)); toShip(GP, l0[0], l0[1], l0[2]); toShip(GQ, l1[0], l1[1], l1[2]); if (vis(GP) && vis(GQ)) L_(GP, GQ, WHITE, 0.6*e, ICE_, 0.1*e);
  }
}

// ---------------------------------------------------------------- the shots
// Each is an effect tied to the target (anc, q: where it lands, target-relative); it leaves from the muzzle (base: where that was as it fired,
// ship-relative, kept in space by its drift) and its dice are lcg
function fireShot(g, kind, d){
  const tg = g.tg, h = pickHit(tg, d); if (!h) return;
  const s = fxAdd({ kind:'pg-' + kind, anc:tg, q:h.hitT, n:h.nrm, fall:h.fall || null, cloud:!!h.sp.cloud, dark:!!h.sp.hole, base:localPt(gunMzL(g)), drift:[0, 0, 0], gun:g,
    r:lcg((g.seed*7 + (kind === 'ball' ? 99 : g.nb)*131 + 3) >>> 0), E:baseE(tg, h.sp)*PG_E[kind], T:9 });
  g.cur = s;
  const a = shotFired(s), b = V.add(tg.rel, s.q); s.za = V.dot(a, cam.fwd); s.zb = V.dot(b, cam.fwd);
  (kind === 'ball' ? ballInit : boltInit)(s);
}
const shotFired = s => V.sub(V.add(ship.rel, s.base), s.drift);
// how far along its path (0 to 1) a shot is when it has crossed a share w of the screen between the two ends, as the camera saw them when it
// fired: a shot moving evenly along its path, seen from beside the ship, would cross the screen in its first hundredth and then crawl
const pathU = (s, w) => s.za > 0 && s.zb > 0.02*s.za ? w*s.za/((1 - w)*s.zb + w*s.za) : w;
// the plane of the target at the hit (two directions across it): the surface's, or, in a cloud or by a black hole, square to the view
function hitFrame(s, O){
  if (!s.cloud && !s.dark){ const x = anyPerp(s.n); return [x, V.cross(s.n, x)]; }
  const f = V.norm(O), x = V.norm(V.cross(f, cam.up)); return [x, V.cross(x, f)];
}
// where a shot is on its way (w: its share of the flight): from the muzzle to the mark; by a black hole it curves in toward the shadow's edge
function shotAt(s, w){
  const a = shotFired(s), O = V.add(s.anc.rel, s.q);
  if (!s.dark) return V.add(a, V.mul(V.sub(O, a), pathU(s, w)));
  // (falling in: it bends toward the hole's middle as it nears it, sliding round a little, as light would)
  const u = pathU(s, w), p = V.add(a, V.mul(V.sub(O, a), u)), C = s.anc.rel, k = smooth(0.55, 1, w);
  return V.add(p, V.mul(V.sub(V.add(C, V.mul(V.norm(V.sub(O, C)), s.anc.holeR*1.02)), O), k*k));
}

// -- a bolt: a bright head with a short streak, fast (TF s); where it lands, a flash, sparks, embers and a glowing crater that cools
const BT = { TF:0.3 };
function boltInit(s){
  s.T = BT.TF + 0.2; s.bm = blastModel(lcg((s.r()*4294967296) >>> 0), s, 0.6);
  s.step = () => { if (!s.boom && s.t >= BT.TF){ s.boom = true; if (s.dark) fallFx(s, 0.6); else { blastFx(s, s.bm, 2.6, 1); craterFx(s, 0.8, 5.5); } } };
  s.draw = () => boltDraw(s);
}
function boltDraw(s){
  const t = s.t, occ = occFor(s.anc), vis = p => V.dot(p, cam.fwd) > 0 && !occ(p); if (t > BT.TF) return;
  const w = t/BT.TF, p = shotAt(s, w), fade = s.dark ? 1 - smooth(0.6, 1, w) : 1, red = s.dark ? smooth(0.4, 1, w) : 0;
  if (!vis(p)) return;
  // (the streak: about three characters behind it, longer as it falls into a black hole)
  const q0 = shotAt(s, Math.max(w - (s.dark ? 0.22 : 0.12), 0)), cw = chW(p), dq = V.sub(q0, p), lq = V.len(dq), q = lq > 3.5*cw*(1 + 2*red) ? V.add(p, V.mul(dq, 3.5*cw*(1 + 2*red)/lq)) : q0;
  const hc = V.lerp(WHITE, REDS_, red), tc = V.lerp(ICE_, [0.9, 0.25, 0.12], red);
  P_(p, hc, 2.8*fade, -5); P_(p, tc, 0.9*fade, -11);
  if (vis(q)) L_(q, p, tc, 0.05*fade, hc, 0.9*fade);
}

// -- the finale: a ball of folded space, dark in a bright rim, with starlight bent round it (arcs sliding round it the other way) and a wake of
// bent light; it flies TF s, and where it lands it blooms: a flash, two shock rings running out across the surface, fire and sparks, and a big
// crater cooling. By a black hole it falls in, spiralling and reddening, and a faint ring of light runs out from the shadow's edge
const BL = { TF:0.95 };
function ballInit(s){
  s.T = BL.TF + 3.2; s.bm = blastModel(lcg((s.r()*4294967296) >>> 0), s, 1);
  s.step = () => { if (!s.boom && s.t >= BL.TF){ s.boom = true; if (s.dark) fallFx(s, 1.4); else { blastFx(s, s.bm, 3.4, 1.25); craterFx(s, 1.4, 7); } } };
  s.draw = () => ballDraw(s);
}
function ballBody(s, p, k, t, occ){
  if (V.dot(p, cam.fwd) <= 0 || occ(p)) return;
  const cw = chW(p), R = Math.max(2.2*cw, 0.35*s.E)*k;
  SM_(p, 0.95, -Math.min(10*k, 16));
  camRing(p, R, 40, WHITE, a => 0.35 + 0.8*Math.pow(0.5 + 0.5*Math.cos(a - t*7), 3), occ, ICE_);
  // (bent starlight: short arcs round it, sliding the other way)
  const f = V.norm(p), x = V.norm(V.cross(f, cam.up)), y = V.cross(x, f);
  for (let i=0;i<5;i++){ const a0 = i*1.2566 - t*2.6, rr = R*(1.7 + 0.25*Math.sin(t*4 + i));
    let prev = null; for (let m=0;m<=3;m++){ const a = a0 + m*0.16, q = V.add(p, V.mul(V.add(V.mul(x, Math.cos(a)), V.mul(y, Math.sin(a))), rr)); if (prev && !occ(q) && !occ(prev)) L_(prev, q, [0.8, 0.9, 1], 0.4, WHITE, 0.4); prev = q; } }
}
function ballDraw(s){
  const t = s.t, occ = occFor(s.anc); if (t >= BL.TF) return;
  const w = Math.pow(t/BL.TF, 1.15), p = shotAt(s, w), fade = s.dark ? 1 - smooth(0.7, 1, w) : 1;
  if (fade < 0.02) return;
  ballBody(s, p, (0.8 + 0.2*Math.sin(t*20))*fade*(s.dark ? 1 - 0.5*smooth(0.5, 1, w) : 1), t, occ);
  // (its wake: bent light left behind it, fading)
  for (let k=1;k<=6;k++){ const q = shotAt(s, Math.max(w - k*0.035, 0)); if (V.dot(q, cam.fwd) > 0 && !occ(q)) P_(q, s.dark ? V.lerp(ICE_, REDS_, smooth(0.5, 1, w)) : ICE_, 0.5*(1 - k/7)*fade, -2); }
}

// -- a blast on (or in) the target, made of embers like the fold (about a character each, never a ball of light): a crisp starburst, a shell of
// embers flying out, slowing, cooling from white to orange to red and dark, sparks streaking off, a quick shock ring (two for the finale), the
// ground under it darkened a little so the embers show over a bright planet, and a few puffs of smoke. k: its size (0.6 a bolt's, 1 the finale's)
function blastModel(r, s, k){
  const n = s.n, cl = s.cloud, rd = () => { const z = r()*2 - 1, a = r()*6.2832, q = Math.sqrt(1 - z*z); return [q*Math.cos(a), z, q*Math.sin(a)]; };
  const out = d => cl ? d : (V.dot(d, n) < 0.1 ? V.norm(V.add(d, V.mul(n, 1.2))) : d), dir = kk => out(V.norm(V.add(V.mul(n, cl ? 0 : kk), rd())));
  return { cl, dark:!!s.dark, rings:k > 0.9 ? 2 : 1, emb:Array.from({ length:Math.round(96*k) }, () => ({ d:dir(0.6), sp:0.35 + 1.1*Math.pow(r(), 0.7), heat:r(), rise:r(), big:r() < 0.3 })),
    sparks:Array.from({ length:Math.round(48*k) }, () => ({ d:dir(0.45), s:3 + 6*r(), life:0.6 + 1.0*r(), hot:r() })),
    smoke:Array.from({ length:Math.round(10*k) }, () => ({ d:out(V.norm(V.add(V.mul(n, cl ? 0 : 1), V.mul(rd(), 0.8)))), r:0.3 + 0.7*r(), at:0.5 + 0.6*r() })),
    ray:r()*0.8 };
}
// fire as it cools (f: 0 white-hot, 1 orange, 2 deep red, 3 dark)
function fireCol(f){
  if (f < 0.35) return V.lerp([1, 0.98, 0.9], [1, 0.85, 0.45], f/0.35);
  if (f < 1) return V.lerp([1, 0.85, 0.45], [1, 0.45, 0.12], (f - 0.35)/0.65);
  if (f < 2) return V.lerp([1, 0.45, 0.12], [0.55, 0.12, 0.04], f - 1);
  return V.lerp([0.55, 0.12, 0.04], [0.12, 0.05, 0.03], Math.min(f - 2, 1));
}
// a starburst in the plane of the screen (centre O, rays up to R long): crisp thin rays, four long and four short, fading within a quarter second
function burst(O, R, t, k, c, hid, a0 = 0){
  const fd = Math.exp(-t/0.16)*k, gr = 1 - Math.exp(-t*14); if (fd < 0.01 || hid(O)) return;
  P_(O, WHITE, 2.6*fd, -6);
  for (let i=0;i<8;i++){ const a = a0 + i*0.7854, u = V.add(V.mul(cam.right, Math.cos(a)), V.mul(cam.up, Math.sin(a))), len = R*(i % 2 ? 0.5 : 1)*gr;
    const q0 = V.add(O, V.mul(u, len*0.08)), q1 = V.add(O, V.mul(u, len)); if (!hid(q1)) L_(q0, q1, WHITE, 0.7*fd, c, 0); }
}
function blastDraw(B, O, n, E, t, hid){
  if (!(t >= 0)) return;
  const Of = fore(O, 2.5*E);
  burst(Of, E*2.2, t, 1, [1, 0.85, 0.5], hid, B.ray);
  // (the ground under it darkens a little while it burns, so its embers read over a bright surface)
  const dk = smooth(0, 0.12, t)*(1 - smooth(1.2, 2.6, t)); if (dk > 0.01) shade(Of, E*1.8, (B.cl ? 0.25 : 0.45)*dk, hid);
  const grow = 1 - Math.exp(-t*2.8);
  for (const b of B.emb){
    const f = t/(0.3 + 0.9*b.heat), br = (f < 2.6 ? 1 - smooth(1.6, 2.6, f) : 0)*(1.5 - 0.4*Math.min(f, 2))*smooth(0, 0.04, t); if (br < 0.01) continue;
    const p = V.add(V.add(O, V.mul(b.d, E*b.sp*(0.12 + 1.5*grow))), V.mul(n, E*0.35*b.rise*t*(B.cl ? 0 : 1)));
    if (!hid(p)) P_(p, fireCol(0.12 + f*1.1), br*(f < 0.4 ? 1.1 : 1.4), b.big && f < 0.6 ? -3 : -2);
  }
  for (const s of B.sparks){ const f = 1 - t/s.life; if (f <= 0) continue; const k = 1.6, x = E*s.s*(1 - Math.exp(-k*t))/k, v = E*s.s*Math.exp(-k*t);
    const p = V.add(O, V.mul(s.d, x)), p2 = V.sub(p, V.mul(s.d, v*0.07)); if (!hid(p) && !hid(p2)) L_(p2, p, fireCol(1.4 + (1 - f)), 0.25*f, fireCol(0.5 + (1 - f)*1.5), (0.7 + 0.5*s.hot)*f); }
  // the shock rings running out across the surface (square to the view in a cloud)
  for (let k=0;k<B.rings;k++){ const tk = t - 0.14*k, u = tk/(0.8 + 0.3*k); if (!(u > 0 && u < 1)) continue; const r = E*(0.5 + (3.2 + 1.6*k)*(1 - Math.exp(-tk*3.2))), b = 0.75*(1 - u)*(1 - u);
    if (B.cl) camRing(O, r, 64, [0.8, 0.9, 1], () => b, hid); else planeRing(O, n, r, 64, k ? ICE_ : [0.85, 0.92, 1], b, hid, k > 0); }
  for (const m of B.smoke){ const tt = t - m.at; if (tt <= 0) continue; const f = Math.min(tt/0.6, 1)*(1 - smooth(1.2, 3, tt)); if (f <= 0) continue;
    const p = V.add(O, V.mul(m.d, E*(0.5 + 0.9*m.r)*(1 + tt*0.35))); if (!hid(p)) SM_(p, 0.5*f, E*(0.35 + 0.25*tt)); }
}
// a blast as an effect of its own, tied to the target (it outlives the shot that made it)
function blastFx(s, B, T, k){
  return fxAdd({ kind:'pg-blast', anc:s.anc, q:s.q, T, draw(e){ blastDraw(B, V.add(e.anc.rel, e.q), s.n, s.E*k, e.t, occFor(e.anc)); } });
}
// a crater (not on a star, a cloud or a black hole): a patch of the surface glowing white-hot, cooling to orange and red from its rim inward
// and then dark, with a thin rim, over T s; then nothing is left. Its glowing points are about a character apart on screen
function craterFx(s, k, T){
  const tg = s.anc; if (s.cloud || s.dark || tg === sun || tg.group === 'stars' || tg.starR) return;
  const r = lcg((s.r()*4294967296) >>> 0), [x, y] = hitFrame(s, V.add(tg.rel, s.q)), R = s.E*k, pts = [];
  for (let i=0;i<48;i++){ const a = r()*6.2832, rr = Math.sqrt(r()); pts.push({ a, rr, k:r() }); }
  fxAdd({ kind:'pg-crater', anc:tg, q:s.q, T, draw(e){
    const t = e.t, O = V.add(tg.rel, e.q), occ = occFor(tg), cw = chW(O), keep = clamp((R/cw)*(R/cw)*0.9, 4, 48);
    const lift = V.mul(s.n, R*0.02);
    for (let i=0;i<keep;i++){ const q = pts[i], cool = t/(T*(0.35 + 0.45*(1 - q.rr) + 0.2*q.k)), f = cool < 3 ? 1 - smooth(2, 3, cool) : 0; if (f <= 0) continue;
      const p = V.add(V.add(O, lift), V.add(V.mul(x, Math.cos(q.a)*q.rr*R), V.mul(y, Math.sin(q.a)*q.rr*R))); if (occ(p)) continue;
      P_(p, fireCol(0.15 + cool*1.2), (1.1 - 0.3*q.rr)*f*(0.85 + 0.15*Math.sin(t*9 + i)), cool < 0.4 ? -3 : -2); }
    const rf = 1 - smooth(0.3*T, T, t); if (rf > 0.01) planeRing(V.add(O, lift), s.n, R*1.05, 40, fireCol(0.8 + 1.4*t/T), 0.18*rf, occ, false);
  } });
}
// a shot falling into a black hole: no blast; the shadow's edge brightens for a moment where it went in, and a faint ring of light runs out
// from the edge, fading (drawn outside the shadow only)
function fallFx(s, k){
  const tg = s.anc;
  fxAdd({ kind:'pg-fall', anc:tg, q:s.q, T:1.6, draw(e){
    const t = e.t, C = tg.rel, occ = occFor(tg), R = tg.holeR, P = V.add(C, V.mul(V.norm(s.q), R*1.03));
    if (!occ(P)) P_(P, [1, 0.55, 0.3], 1.4*k*Math.exp(-t/0.2), -4);
    const u = t/1.6, r = R*(1.08 + 1.6*u), b = 0.35*k*(1 - u)*(1 - u);
    camRing(C, r, 64, [0.95, 0.75, 1], a => b, occ, VIO_);
  } });
}


// ================================================================ the Halo's weapons test: Pip's railgun (0.9.9, round 2 of the owner's review: the 0.9.4 ring gun "spawns meh
// and unnatural", and the first try at Pip's cannon fired "at a random unnatural angle"; picked from three: the needle railgun, a mechanical
// unfold, rail slugs and a charged finale, fired on an attack run; made up, like the ship, and its readout says so).
// The weapons pass is an attack run (attackVisit in 07h-halo.js): the ship comes in on a straight line with its nose on the body, so the
// gun on the needle fires straight along its heading, then pulls up and climbs away. Pip flies to the needle and settles on it near its tip,
// facing ahead (PIPJ.weapons, 07i-drone.js), and stays there, itself, as the gun's heart: plates swing down from its sides and clamp round
// the needle, two rails telescope forward from its sides past the tip, segment by segment, each locking with a spark, and two prongs flip in
// at their ends. Light runs from the ship's heart down the hull into it. It fires rail slugs, each a white point too fast to follow with a
// straight streak behind it and a cone of light at the muzzle, a flash, sparks and a glowing crater where it hits; then a long charge
// (lightning crackling between the rails, Pip's eyes narrowing) and one big slug. It vents, folds back (the same steps backward) and Pip is
// free again. Every shot leaves along the ship's heading and lands where that line meets the body (aimHit): if it does not, the shot is not
// fired. By a black hole the slugs fall in and fade at the shadow's edge. Nothing about the target changes and every trace fades.
// Everything is drawn through the Halo's point, line and smoke buffers (P_, L_, SM_): the gun relative to the ship, each shot and blast
// relative to the target (the precision rule in 07h-halo.js); hidden behind the hull and the body, and anywhere in a black hole's shadow
// (owner: no shot may show inside it). The gun and each shot are effects of their own (FX) on their own clocks. Dice: lcg, never hrnd.
// This file loads after 07h-halo.js, 07i-drone.js and 07j-scan.js (ACT, ACTS, S_, FX, the effect helpers, PIP, pipDocked, inShadow).

// the timeline on the gun's clock (s from the moment Pip, settled and ready, starts to unfold): the deploy clock dc runs 0 to UF building it
// (plates open OPEN, clamps from CL0 to CL1, rail segment k from RS0 + k RSD over RSD, prongs from PR), and runs back down from RF over RFD
// folding it away; the power runs in from PW; slugs fire at `slugs`; the finale charges from C0 and fires at F; it vents from V0 to V1
const PG = { OPEN:0.3, CL0:0.1, CL1:0.5, RS0:0.55, RSD:0.2, PR:1.35, UF:1.6, PW:1.65, PWD:0.6, slugs:[2.45, 2.9, 3.35], C0:3.7, F:5.2, V0:5.35, V1:6.3, RF:6.45, RFD:1.25, END:7.8 };
// the rails, in the ship's frame (ship radii, +y forward, the needle's tip at 0.835): level just above the needle's top (x), from y0 to y1, a
// half-width apart z0 at the back (just outside Pip's sides) to z1 at the muzzle; four telescoping segments; the muzzle MZ just past their ends
const RG = { x:-0.034, y0:0.6, y1:1.16, z0:0.058, z1:0.034, h:0.006, w:0.007 };
const RG_SL = (RG.y1 - RG.y0)/4, GUN_C = [RG.x, 0.84, 0], MZ_L = [RG.x, RG.y1 + 0.05, 0];
const railZ = y => RG.z0 + (RG.z1 - RG.z0)*clamp((y - RG.y0)/(RG.y1 - RG.y0), 0, 1);
// each shot's size as a share of the target's (baseE: its drawn radius; a black hole's shadow x 2.6; half a cloud's bounding radius)
const PG_E = { slug:0.06, big:0.14 };
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

// where a shot along the ship's heading lands (target-relative): where the line from the muzzle meets the drawn surface; by a black hole, the
// edge of its shadow nearest that line (the slug falls in there), if the line passes within a few shadows of it; in a cloud, the line's
// nearest point to its middle, if that is inside it. Null when the heading misses: no shot then
function aimHit(tg){
  if (ship.parent !== tg) return null;
  const R = ship.R0, h = [R[3], R[4], R[5]], m = V.add(ship.offset, localPt(MZ_L)), sp = aimSphere(tg);
  if (sp.hole){ const t = Math.max(-V.dot(m, h), 0), c = V.add(m, V.mul(h, t)), lc = V.len(c); if (lc > tg.holeR*9 || !(t > 0)) return null;
    const u = lc > 1e-9 ? V.mul(c, 1/lc) : anyPerp(h), q = V.mul(u, tg.holeR*1.02); return { q, n:V.norm(V.sub(m, q)), sp, fall:true }; }
  if (sp.solid){ const t = raySphere(m, h, [0, 0, 0], sp.r); if (t < 0) return null; const q = V.add(m, V.mul(h, t)); return { q, n:V.norm(q), sp }; }
  const t = Math.max(-V.dot(m, h), 0), q = V.add(m, V.mul(h, t)); if (!(t > 0) || V.len(q) > tg.rad*0.8*magOf(tg)) return null; return { q, n:V.mul(h, -1), sp };
}
// ---------------------------------------------------------------- the job
ACT.weapons = pl => {
  const tg = pl.tg, T = ACTS.weapons.T, A = { kind:'weapons', tau:-9, tg, gun:null, t0:0, seed:(pl.seed*31 + 7) >>> 0, gunDone:false };
  A.update = (dt, tau) => {
    A.tau = tau;
    // (it deploys once Pip has settled on the needle and winked, the ship has come to the part of its run where it works, and its nose is on
    // the body: its heading meets the surface)
    if (!A.gun && !A.gunDone && tau >= 0 && pipDocked(A) && aimHit(tg)){ A.gun = gunStart(A); A.t0 = tau; }
    // (no Pip to become the gun: the stay is ending; or it waited too long, or the run went by without its nose on the body)
    if (!A.gun && !A.gunDone && ((tau > 2 && !pipOut() && !pipWant()) || tau > 30)) A.gunDone = true;
  };
  A.env = () => env(A.tau, A.gun ? A.t0 + PG.END + 3 : Math.max(T, A.tau + 2));
  A.line = () => weapLine(A);
  A.cap = () => weapCap(A);
  A.done = () => A.gunDone && (!A.gun || A.gun.t > PG.END || A.gun.cut >= 0);
  A.draw = () => {};
  A.cut = () => { if (A.gun) gunCut(A.gun); else A.gunDone = true; };
  A.end = () => { if (A.gun) gunCut(A.gun); A.gunDone = true; };
  return A;
};
// what it is doing, by the gun's clock: 0 Pip on its way or settling, 1 unfolding, 2 powering up, 3 the slugs, 4 the finale's charge, 5 the
// finale, 6 venting, 7 folding away
function weapStage(A){
  const g = A.gun; if (!g) return 0; const t = g.t;
  return g.cut >= 0 || t >= PG.RF ? 7 : t < PG.UF ? 1 : t < PG.slugs[0] - 0.1 ? 2 : t < PG.C0 ? 3 : t < PG.F ? 4 : t < PG.V0 ? 5 : 6;
}
function weapLine(A){
  const tg = A.tg, st = weapStage(A), hole = isHoleTarget(tg);
  if (A.tau < 0 && !A.gun) return 'an attack run on ' + tg.name + ' · weapons test ahead (fictional)';
  const a = [PIP.st === 'out' && PIP.g && PIP.g.dock === A ? 'Pip settles on the needle, ready' : 'Pip flies to the needle', "Pip unfolds into the railgun",
    "the heart's light runs down the hull into the railgun", 'rail slugs at ' + tg.name, 'the railgun charges its big shot',
    'the big shot hits ' + tg.name, 'the railgun vents', 'the railgun folds back into Pip'][st];
  const b = hole ? 'the slugs fall into the black hole and are gone' : st >= 3 ? 'the craters cool and fade, and nothing is left' : 'every shot fades and leaves no mark';
  return `weapons test (fictional) · ${a}\nnothing real is harmed: ${b}`;
}
// (the showcase's caption: what each part is)
function weapCap(A){
  return ['the Halo turns its nose onto the target; Pip settles on the needle', 'Pip unfolds: plates clamp round the needle, rails slide out', "the heart's light runs down the hull into the rails",
    'rail slugs, straight out of the nose', 'the railgun charges: lightning between the rails', 'the big shot', 'the rails vent', 'the railgun folds back into Pip'][weapStage(A)];
}
// (Pip's face and recoil while it is the gun's heart, for its move in PIPJ.weapons: focused as it unfolds and fires, a squint as each slug
// leaves, cross while it charges the big shot, happy as it folds back)
function gunFace(g){
  const t = g.t, f = t - g.fireT;
  if (g.cut >= 0 || t >= PG.RF) return 'happy';
  if (f >= 0 && f < 0.25) return 'cross';
  return t >= PG.C0 && t < PG.F ? 'cross' : 'focused';
}
const gunRec = g => g ? g.rec : 0;

// ---------------------------------------------------------------- the gun
let GUN = null;
function gunStart(A){
  const g = fxAdd({ kind:'gun', tg:A.tg, A, T:PG.END + 0.6, seed:A.seed, rec:0, recK:0, fireT:-9, ns:0, big:false, cut:-1, dcCut:0, dc:0, locks:new Set(), skipped:0, heat:0 });
  GUN = g;
  g.step = dt => gunStep(g, dt); g.draw = () => gunDraw(g);
  return g;
}
// cut short (the job ended early, or the ship must leave): no more shots; it folds away at once, quickly
function gunCut(g){ if (g.cut >= 0 || g.t >= PG.END) return; g.cut = g.t; g.dcCut = g.dc; g.T = g.t + 1.3; }
// the deploy clock: building (0 to UF), folding back (UF to 0), or folding back fast from where it was when cut
function gunDc(g){
  const t = g.t;
  if (g.cut >= 0) return Math.max(g.dcCut*(1 - (t - g.cut)/0.8), 0);
  return t < PG.RF ? Math.min(t, PG.UF) : PG.UF*Math.max(1 - (t - PG.RF)/PG.RFD, 0);
}
// the parts at deploy clock dc: how far the plates have opened, the clamps swung, each rail segment slid out, the prongs flipped, the power lit
const gOpen = dc => smooth(0, PG.OPEN, dc), gClamp = dc => smooth(PG.CL0, PG.CL1, dc), gSeg = (dc, k) => k === 0 ? smooth(PG.RS0 - 0.25, PG.RS0, dc) : smooth(PG.RS0 + (k - 1)*PG.RSD, PG.RS0 + k*PG.RSD, dc);
const gProng = dc => smooth(PG.PR, PG.PR + 0.18, dc), gLit = dc => smooth(PG.UF - 0.2, PG.UF, dc);
// the moments a part locks into place (deploy clock), where a spark flies: the clamps, each rail segment, the prongs
const G_LOCKS = [['clamp', PG.CL1], ['seg0', PG.RS0], ['seg1', PG.RS0 + PG.RSD], ['seg2', PG.RS0 + 2*PG.RSD], ['seg3', PG.RS0 + 3*PG.RSD], ['prong', PG.PR + 0.18]];
function gunStep(g, dt){
  const t = g.t, A = g.A;
  if (g.cut < 0 && t < PG.END && (S_.act !== A || ship.parent !== g.tg || S_.phase === 'light' || S_.phase === 'fold' || PIP.hurry || PIP.st !== 'out')) gunCut(g);
  const dc0 = g.dc; g.dc = gunDc(g);
  // (a spark where each part locks, building up; a smaller one as it lets go, folding away)
  for (const [name, at] of G_LOCKS){ if (dc0 < at && g.dc >= at) gunSpark(g, name, 1); else if (dc0 >= at && g.dc < at) gunSpark(g, name, 0.5); }
  if (g.cut < 0 && g.dc >= PG.UF - 1e-6){
    while (g.ns < 3 && t >= PG.slugs[g.ns]){ if (!fireSlug(g, false)) g.skipped++; g.ns++; }
    if (!g.big && t >= PG.F){ g.big = true; if (!fireSlug(g, true)) g.skipped++; }
  }
  // (it kicks back along the needle as it fires and springs forward again, harder for the big shot)
  const f = t - g.fireT; g.rec = f >= 0 && f < 0.8 ? g.recK*Math.exp(-f/0.08)*Math.cos(f*15) : 0;
  g.heat = Math.max(g.heat - dt/1.6, 0);
  if (!A.gunDone && (t >= PG.END || (g.cut >= 0 && g.dc <= 0))) A.gunDone = true;
  // the needle's tip glows as the power reaches it, while it charges and as it fires (the bow gun's light in the ship's shader)
  const pw = smooth(PG.PW, PG.PW + 0.3, t)*(1 - smooth(PG.PW + PG.PWD, PG.PW + PG.PWD + 0.4, t)), ch = t >= PG.C0 && t < PG.F && g.cut < 0 ? smooth(PG.C0, PG.F, t) : 0;
  S_.em[2] = Math.max(S_.em[2], 0.8*pw + 0.9*ch + (f >= 0 ? 1.2*Math.exp(-f/0.1) : 0));
}
// a spark where a part locks (ship axes: a burst of short streaks from the seam, and a flash)
function gunSpark(g, name, k){
  const F = name === 'clamp' ? [[RG.x + 0.02, 0.65, 0.04], [RG.x + 0.02, 0.65, -0.04]] : name === 'prong' ? [[RG.x, RG.y1, railZ(RG.y1)], [RG.x, RG.y1, -railZ(RG.y1)]]
    : (() => { const kk = +name[3], y = RG.y0 + RG_SL*(1 + kk) - 0.01; return [[RG.x, y, railZ(y)], [RG.x, y, -railZ(y)]]; })();
  const r = lcg((g.seed + name.length*97 + Math.round(g.t*100)) >>> 0), dirs = [];
  for (let i=0;i<5;i++) dirs.push(V.norm([-(0.3 + r()), (r() - 0.5)*1.4, (r() - 0.5)*1.4]));
  fxAdd({ kind:'gun-spark', T:0.3, draw(e){ const u = e.t/e.T, fl = (1 - u)*(1 - u)*k;
    for (const l of F){ const p = shipPt(l); if (behindHull(p)) continue; P_(p, [1, 0.95, 0.8], 1.8*fl, -3);
      for (const d of dirs){ const a = shipPt(V.add(l, V.mul(d, 0.012 + 0.05*u))), b = shipPt(V.add(l, V.mul(d, 0.03 + 0.07*u))); if (!behindHull(b)) L_(a, b, [1, 0.6, 0.2], 0.3*fl, [1, 0.95, 0.75], 0.9*fl); } } } });
}
// (scratch)
const GP = [0, 0, 0], GQ = [0, 0, 0];
// the path the heart's light runs along to the gun: from the heart over the top of the hull to the back of the rails (ship axes)
const PG_FEED = [[-0.045, -0.3, 0], [-0.055, -0.16, 0], [-0.08, 0.02, 0], [-0.07, 0.2, 0], [-0.055, 0.42, 0], [-0.04, 0.56, 0], [RG.x, RG.y0, 0]];
let PG_FEEDP = null;
// a line between two points in ship axes (ship radii), both shown
function gl2(g, a, b, c, br, c2 = c, br2 = br, vis){ toShip(GP, a[0], a[1], a[2]); toShip(GQ, b[0], b[1], b[2]); if (vis(GP) && vis(GQ)) L_(GP, GQ, c, br, c2, br2); }
const STEEL_ = [0.78, 0.84, 0.95];
function gunDraw(g){
  const t = g.t;
  if (!(ship.dist < ship.labelRange) || !(ship.rpx > 3) || S_.scale < 0.5 || V.dot(ship.rel, cam.fwd) < -ship.rad*3) return;
  const occ = occFor(g.tg, true), vis = p => V.dot(p, cam.fwd) > ship.rad*0.03 && !occ(p), ks = 0.5 + 0.5*smooth(3, 16, ship.rpx), dc = g.dc, rec = g.rec;
  if (dc <= 0.001) return;
  const lit = gLit(dc), ch = t >= PG.C0 && t < PG.F && g.cut < 0 ? smooth(PG.C0, PG.F, t) : 0, f = t - g.fireT, fl = f >= 0 && f < 0.5 ? Math.exp(-f/0.1) : 0;
  const hot = g.heat, glowC = hot > 0.05 ? V.lerp(ICE_, [1, 0.55, 0.25], Math.min(hot, 1)) : ICE_;
  // the clamps: two plates each side swing down from Pip's sides round the needle (an arc from a hinge at Pip's side to under the needle)
  const cl = gClamp(dc);
  for (const sd of [-1, 1]) for (const y of [0.625, 0.675]){
    const H = [-0.056, y, sd*0.046], ang = (1 - cl)*1.7*sd, rot = p => { const dx = p[0] - H[0], dz = p[2] - H[2], c = Math.cos(ang), s = Math.sin(ang); return [H[0] + dx*c - dz*s, y, H[2] + dx*s + dz*c]; };
    const pts = [H, rot([-0.012, y, sd*0.05]), rot([0.018, y, sd*0.024])];
    for (let i=0;i<2;i++) gl2(g, pts[i], pts[i + 1], STEEL_, (0.3 + 0.2*cl)*ks, STEEL_, (0.3 + 0.2*cl)*ks, vis);
  }
  // the rails: each segment a flat bar (its four long edges), sliding out of the one behind it, the inner edges glowing once it is powered;
  // they kick back as it fires
  const segF = k => { let s = RG.y0 + RG_SL; for (let j=1;j<=k;j++) s += RG_SL*gSeg(dc, j); return s; };
  const out0 = gSeg(dc, 0);
  for (const sd of [-1, 1]) for (let k=0;k<4;k++){
    const e = gSeg(dc, k); if (k > 0 && e <= 0.001) continue;
    const yf = segF(k) - rec, yb = Math.max(yf - RG_SL, RG.y0 - rec) + (k ? 0 : RG_SL*(1 - out0)), w = RG.w*(1 - 0.12*k), hx = RG.h*(1 - 0.1*k);
    if (yf - yb < 0.004) continue;
    const zb = railZ(yb), zf = railZ(yf), b = (0.2 + 0.16*lit)*ks*(k === 0 ? out0 : 1);
    for (const dx of [-hx, hx]){
      gl2(g, [RG.x + dx, yb, sd*(zb + w)], [RG.x + dx, yf, sd*(zf + w)], STEEL_, b, STEEL_, b, vis);
      const gi = b + (0.25 + 0.5*ch + 0.6*fl + 0.5*hot)*lit*ks;
      gl2(g, [RG.x + dx, yb, sd*(zb - w)], [RG.x + dx, yf, sd*(zf - w)], glowC, gi, glowC, gi*(0.7 + 0.3*Math.sin(t*9 + k)), vis);
    }
    // (a rib at the segment's front end)
    gl2(g, [RG.x - hx, yf, sd*(zf - w)], [RG.x - hx, yf, sd*(zf + w)], STEEL_, b*0.8, STEEL_, b*0.8, vis);
  }
  // the prongs at the muzzle: flipping in from along the rails to point ahead and inward
  const pr = gProng(dc);
  if (pr > 0.01) for (const sd of [-1, 1]){ const y = RG.y1 - rec, z = railZ(RG.y1), a = (1 - pr)*2.6, tip = [RG.x, y + 0.045*Math.cos(a), sd*(z - 0.02*Math.sin(Math.PI/2 - a*0.5) + 0.03*Math.sin(a))];
    gl2(g, [RG.x, y, sd*z], tip, STEEL_, 0.45*ks, glowC, (0.35 + 0.6*lit*(ch + fl))*ks, vis); }
  // lightning between the rails ahead of the needle: a flicker while powered, crackling hard while it charges the big shot
  const zap = lit*(0.15 + 0.85*ch + 0.6*fl);
  if (zap > 0.05 && g.cut < 0){
    const fr = Math.floor(t*22), n = ch > 0.3 ? 3 : 1;
    for (let i=0;i<n;i++){ if (h01(fr, i*13) > 0.35 + 0.6*zap) continue;
      const y = 0.88 + 0.26*h01(fr, i*13 + 1) - rec, z = railZ(y) - RG.w; let prev = [RG.x, y, -z];
      for (let j=1;j<=4;j++){ const q = [RG.x + (h01(fr, i*29 + j) - 0.5)*0.016, y + (h01(fr, i*31 + j) - 0.5)*0.02, -z + 2*z*j/4]; gl2(g, prev, q, [0.75, 0.9, 1], 0.7*zap, WHITE, 0.9*zap, vis); prev = q; } }
  }
  // the heart's light running down the hull into the gun: beads along the top of the hull from the heart to the rails, a bright one in front
  // (and again, steadily, while it charges)
  if (((t >= PG.PW - 0.1 && t < PG.PW + PG.PWD + 0.4) || ch > 0) && g.cut < 0){
    if (!PG_FEEDP) PG_FEEDP = crPath(PG_FEED);
    const k = ch > 0 ? 0.6*ch : smooth(PG.PW - 0.1, PG.PW + 0.1, t)*(1 - smooth(PG.PW + PG.PWD, PG.PW + PG.PWD + 0.4, t)), front = ch > 0 ? 1 : clamp((t - PG.PW)/PG.PWD, 0, 1);
    for (let i=0;i<9;i++){ const s = ch > 0 ? (t*0.9 + i/9) % 1 : front - i*0.05; if (s < 0 || s > 1) continue;
      const l = PG_FEEDP(s); toShip(GP, l[0], l[1], l[2]); if (vis(GP)) P_(GP, i === 0 && ch === 0 ? WHITE : ICE_, k*(i === 0 && ch === 0 ? 1.8 : 0.9 - 0.06*i), i === 0 ? -3 : -2); }
  }
  // the big shot's charge: motes spiralling into the muzzle and a glow gathering there
  const mz = [MZ_L[0], MZ_L[1] - rec, 0]; toShip(GP, mz[0], mz[1], mz[2]); const mzW = GP.slice(), mzV = vis(mzW);
  if (ch > 0){
    for (let i=0;i<12;i++){ const u = (t*(1.2 + 1.6*ch) + i/12) % 1, rr = 0.07*(1 - u)*(1 - u), an = i*2.4 + u*5*(i % 2 ? 1 : -1);
      toShip(GQ, mz[0] + Math.cos(an)*rr, mz[1] - 0.04*(1 - u), Math.sin(an)*rr); if (vis(GQ)) P_(GQ, u > 0.7 ? WHITE : ICE_, ch*(0.3 + 0.9*u), -2); }
    if (mzV) P_(mzW, ICE_, 0.4 + 1.8*ch, -(3 + 6*ch));
  }
  // venting after the big shot: puffs of steam from the rails' sides
  if (t >= PG.V0 && t < PG.V1 && g.cut < 0) for (let k=0;k<4;k++){
    const y = [0.7, 0.82, 0.94, 1.06][k], sd = k % 2 ? 1 : -1, tt = t - PG.V0 - 0.12*k; if (tt < 0 || tt > 0.9) continue;
    const e = 1 - tt/0.9, base = [RG.x, y, sd*(railZ(y) + RG.w)];
    for (let m=0;m<3;m++){ const l = [base[0] - 0.01*m, base[1] - 0.01*tt, base[2] + sd*(0.012 + 0.06*tt + 0.02*m)]; toShip(GP, l[0], l[1], l[2]); if (!vis(GP)) continue; SM_(GP, 0.25*e, ship.rad*(0.015 + 0.04*tt)); P_(GP, [0.85, 0.92, 1], 0.6*e*(1 - m/3), -2); }
  }
}

// ---------------------------------------------------------------- the shots: a slug (and the big one) is an effect tied to the target (anc, q: where it lands, target-relative);
// it leaves from the muzzle (base: where that was as it fired, ship-relative, kept in space by its drift)
function fireSlug(g, big){
  const tg = g.tg, h = aimHit(tg); if (!h) return false;
  const s = fxAdd({ kind:big ? 'pg-big' : 'pg-slug', anc:tg, q:h.q, n:h.n, cloud:!!h.sp.cloud, dark:!!h.sp.hole, base:localPt([MZ_L[0], MZ_L[1] - g.rec, 0]), drift:[0, 0, 0], big,
    dir:M3.apply(ship.R0, [0, 1, 0]), r:lcg((g.seed*7 + (big ? 99 : g.ns)*131 + 3) >>> 0), E:baseE(tg, h.sp)*(big ? PG_E.big : PG_E.slug), T:big ? 2 : 0.8 });
  const a = shotFired(s), b = V.add(tg.rel, s.q); s.za = V.dot(a, cam.fwd); s.zb = V.dot(b, cam.fwd);
  s.bm = blastModel(lcg((s.r()*4294967296) >>> 0), s, big ? 1 : 0.55);
  s.TF = big ? 0.3 : 0.16;
  s.step = () => { if (!s.boom && s.t >= s.TF){ s.boom = true; if (s.dark) fallFx(s, big ? 1.4 : 0.6); else { blastFx(s, s.bm, big ? 3.4 : 2.4, big ? 1.25 : 1); craterFx(s, big ? 1.5 : 0.8, big ? 7 : 5.5); } } };
  s.draw = () => slugDraw(s);
  g.fireT = g.t; g.recK = big ? 0.06 : 0.025; if (big) g.heat = 1.4;
  return true;
}
// the slug: a white point too fast to follow with a straight streak from the muzzle behind it, which lingers and fades after it hits (the
// big one's longer, thicker and ice violet); a cone of light at the muzzle as it leaves
function slugDraw(s){
  const t = s.t, occ = occFor(s.anc), vis = p => V.dot(p, cam.fwd) > 0 && !occ(p), a = shotFired(s), big = s.big;
  const w = Math.min(t/s.TF, 1), head = shotAt(s, w), fade = t < s.TF ? 1 : Math.exp(-(t - s.TF)/(big ? 0.45 : 0.16));
  if (fade < 0.02) return;
  // the streak: the part of the line from the muzzle to the head that is shown, in pieces, cut where the body or the hull hides it
  const col = big ? [0.8, 0.85, 1] : ICE_, red = s.dark ? smooth(0.5, 1, w) : 0;
  pathLine(u => shotAt(s, u*w), Math.max(V.len(V.sub(head, a)), 1e-9), V.lerp(col, REDS_, red*0.5), (big ? 0.55 : 0.4)*fade, occ, V.lerp(WHITE, REDS_, red), (big ? 1 : 0.8)*fade, 14);
  if (t < s.TF && vis(head)){ P_(head, V.lerp(WHITE, REDS_, red), (big ? 3.4 : 2.6)*(1 - 0.6*red), big ? -8 : -5); P_(head, col, 0.9, big ? -16 : -10); }
  // the cone of light at the muzzle: short rays spreading ahead, gone within a fifth of a second (twice as big and long for the big shot)
  const c = Math.exp(-t/(big ? 0.12 : 0.06)); if (c > 0.02 && vis(a)){
    const d = s.dir, x = anyPerp(d), y = V.cross(d, x), cw = chW(a), L = (big ? 9 : 5)*cw;
    P_(a, WHITE, (big ? 3 : 2)*c, big ? -14 : -9);
    for (let i=0;i<8;i++){ const an = i*0.785 + 0.3, q = V.add(a, V.add(V.mul(d, L*(0.7 + 0.3*(i % 2))), V.mul(V.add(V.mul(x, Math.cos(an)), V.mul(y, Math.sin(an))), L*0.28)));
      if (vis(q)) L_(a, q, WHITE, 0.7*c, ICE_, 0); }
  }
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

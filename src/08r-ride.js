
// ================================================================ riding along with the Halo (0.9.6): the camera shows the ship with the place it visits behind it
// (owner, 2026-09-29: straight behind the ship the view missed the planet or star it was near; and a camera that never moves is dull.)
// A shot is a place for the camera round the ship, set in the frame of the body the ship is visiting: u points from the body's centre to
// the ship (away from the surface), f is the ship's heading along the surface, s its side. The camera sits on the far side of the ship from
// the body, tipped b degrees from u toward the direction g (0 behind the ship, 90 its side, 180 ahead), d ship radii out; so seen from the
// camera the body's centre is b degrees from the ship. b follows the body's size on screen (shotPose), so its near edge always sits in the
// view: the ship above the middle, the body filling the view below and past it, the horizon level (the body's up is the camera's up)
// unless a shot rolls.
// Moving (the default, SET.rideCam): a shot moves by itself (drifts round, dollies in or out) and a new one takes over every 10 to 18 s,
// gliding there in about 4 s. Still: one shot over the ship's shoulder. While a job runs (a scan, the fold cannon, a skim) the camera moves
// to a shot made for it and holds until it is done (Pip's outing keeps moving). The Halo tour (09t-halotour.js, RIDE.epic) has shots of its
// own that frame the place first, with the ship small in front of it (TSHOTS, below).
// Between places (light speed, the fold) and for the last seconds before a jump the camera blends back into the chase pose behind the ship
// (chasePose in 08-camera.js): there is nothing to show there but the streaks and the fold, which are made for that view.
// Dice: rideR, its own generator (never hrnd, which steers the Halo's route, nor rnd, which gives every visitor the same numbers).
const RIDE_LAB = !!window.__LAB || new URLSearchParams(location.search).has('lab');   // (the lab keeps the plain chase camera: its stills must repeat)
const RIDE = { F:null, par:null, shot:null, from:null, t:0, tr:0, trT:4, wc:1, visits:-1, job:null, last:[], queue:[], epic:false, name:"", pip:null, pk:0, pkV:0, pipG:110, pipL:null, pipLV:[0, 0, 0], dg:0, wcV:0, n:0,
  fam:'ride', xf:null, lk:0, lkV:0, tdS:0, tref:null };
let rideR = (() => { let s = (Math.random()*4294967296) >>> 0; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; })();
const DEGR = Math.PI/180;
// a shot: a (where it starts) and z (where it ends, T seconds later). e: how far past the body's edge the camera tips, in degrees (the tilt
// b is worked out from the body's size on screen, so its edge sits near the middle of the view and it fills the lower part: shotPose);
// g, roll in degrees; d in ship radii. ease: an eased move (a dolly or a sweep), else a steady drift. The angles keep to the ship's side and
// front quarters: from straight behind, its needle points up the screen and it seems to climb (the owner saw that in the old chase camera,
// 2026-09-26)
const SHOTS = {
  shoulder:{ a:{ e:4, g:58, d:4.2 }, z:{ e:5, g:74, d:3.9 }, T:[12, 16] },
  side:{ a:{ e:7, g:84, d:4.2 }, z:{ e:5, g:104, d:3.9 }, T:[11, 15] },
  front:{ a:{ e:4, g:132, d:4.6 }, z:{ e:3, g:150, d:4 }, T:[10, 14] },
  high:{ a:{ e:-5, g:70, d:6, roll:18 }, z:{ e:-3, g:96, d:5, roll:10 }, T:[12, 16] },
  low:{ a:{ e:16, g:70, d:3.6 }, z:{ e:14, g:92, d:3.9 }, T:[10, 14] },
  wide:{ a:{ e:3, g:66, d:9 }, z:{ e:3, g:92, d:7 }, T:[12, 18] },
  orbit:{ a:{ e:6, g:48, d:4.8 }, z:{ e:6, g:140, d:4.8 }, T:[14, 18], ease:true },
  // still: over the ship's shoulder, and nothing moves
  still:{ a:{ e:4, g:64, d:4.2 }, z:{ e:4, g:64, d:4.2 }, T:[1e9, 1e9] },
};
// a job's own shot, from the side it is done on: the scan's ring and beams across the view, the cannon ahead of the needle and its shots
// toward the body, the skim low over the surface. (Pip's outing lasts half a minute: the shots go on round it, only the close ones, NEAR)
const JOB_SHOT = { scan:{ e:8, g:92, d:4.4 }, weapons:{ e:6, g:74, d:4.0 }, skim:{ e:18, g:80, d:3.6 },
  // (0.9.9: a signature move, 07h-halo.js sigSpec: low behind the ship's shoulder, so what it flies through or over comes at the camera with it)
  sig:{ e:10, g:38, d:3.4 } };
const NEAR = new Set(['shoulder', 'side', 'front', 'low', 'orbit']);
const MOVING = ['shoulder', 'side', 'front', 'high', 'low', 'wide', 'orbit'];
const rideOn = () => !RIDE_LAB;
const rideStill = () => SET.rideCam === 'still';
const bodyR = tg => tg ? (surfDrawn(tg) || tg.rad*0.6*magOf(tg)) : 0;

// ---------------------------------------------------------------- the Halo tour's shots (0.9.12): the place first, the ship a bonus
// (owner, 2026-09-30: "the tour object should be the main focus of almost every shot and halo is more a bonus cool addon". The ride camera sat
// a few ship lengths from the ship, which covered 10 to 50% of the view and the place 0.2 to 3%: the Halo roams 8 to 20 radii out for most of
// a stay, and 50 radii out round a star, outside its glow. Locked on by a click, the camera trailed the ship, and the place was often behind it.)
// A tour shot frames the place with a long lens (LENS.k, as the launch camera's): its disc fills a set share of the view (rho: its radius, in
// half the smaller side of the free view), its centre at px, py (half widths, half heights), and the ship sits at qx, qy, small in front of it
// (sig, its radius in the same unit): the camera is dS behind the ship, which makes it that small, on the far side from the place, turned
// round it by g (0 behind the ship, 90 its side, 180 ahead) and tipped as far from the place as puts the two where the shot wants. A place too
// near to fit (the lens never widens the view) becomes a horizon: its top edge at hz, its centre below the view, the ship above it.
const TSHOTS = {
  // (the first at a new place: all of it with room round it, easing in)
  arrive:{ a:{ rho:0.3, sig:0.088, px:0.16, py:0.08, qx:-0.45, qy:-0.3, hz:-0.3, g:160 }, z:{ rho:0.5, sig:0.075, px:0.12, py:0.05, qx:-0.38, qy:-0.26, hz:-0.3, g:145 }, T:[7, 10], ease:true },
  // (the ship crossing in front of it)
  cross:{ a:{ rho:0.55, sig:0.088, px:0.08, py:0.06, qx:-0.62, qy:-0.2, hz:-0.3, g:175 }, z:{ rho:0.6, sig:0.088, px:0.02, py:0.04, qx:0.22, qy:-0.1, hz:-0.3, g:185 }, T:[13, 16] },
  // (the place filling the view, the ship high on one side)
  grand:{ a:{ rho:0.85, sig:0.075, px:0.18, py:0, qx:-0.55, qy:0.32, hz:-0.25, g:130 }, z:{ rho:0.95, sig:0.081, px:0.12, py:-0.04, qx:-0.5, qy:0.28, hz:-0.25, g:108 }, T:[12, 16] },
  // (the ship nearer, the place big beside it)
  hero:{ a:{ rho:0.5, sig:0.163, px:0.3, py:0.12, qx:-0.42, qy:-0.28, hz:-0.3, g:120 }, z:{ rho:0.55, sig:0.138, px:0.26, py:0.1, qx:-0.36, qy:-0.24, hz:-0.3, g:95 }, T:[10, 13], ease:true },
  // (up close: the ship over its horizon, seen from the side, then from behind toward the horizon)
  horizon:{ a:{ rho:1.7, sig:0.112, px:0, py:-0.2, qx:-0.3, qy:0.2, hz:-0.28, g:95 }, z:{ rho:1.9, sig:0.112, px:0, py:-0.2, qx:0.1, qy:0.22, hz:-0.25, g:80 }, T:[12, 15] },
  ahead:{ a:{ rho:1.4, sig:0.125, px:0, py:-0.3, qx:0, qy:0.02, hz:-0.4, g:15 }, z:{ rho:1.6, sig:0.112, px:0, py:-0.3, qx:0.05, qy:0.06, hz:-0.35, g:0 }, T:[11, 14] },
  // (a long way off: the ship a glint and its flame against the place)
  tele:{ a:{ rho:0.7, sig:0.044, px:0.05, py:0.08, qx:-0.3, qy:-0.45, hz:-0.3, g:150 }, z:{ rho:0.75, sig:0.044, px:0, py:0.06, qx:-0.1, qy:-0.42, hz:-0.3, g:168 }, T:[10, 13] },
  // close-ups (0.10.2, owner: the camera was too often far from the ship; the Halo about a third of the screen, the place still big behind it
  // through the lens): beside the ship, the place over its shoulder; from behind it, flying at the place; swinging round it; pushing in from far
  close:{ a:{ rho:0.95, sig:0.3, px:0.3, py:0.12, qx:-0.38, qy:-0.22, hz:-0.3, g:115 }, z:{ rho:1, sig:0.34, px:0.26, py:0.1, qx:-0.33, qy:-0.2, hz:-0.3, g:92 }, T:[9, 12], ease:true },
  behind:{ a:{ rho:0.9, sig:0.32, px:0.05, py:0.26, qx:0, qy:-0.4, hz:-0.3, g:15 }, z:{ rho:0.95, sig:0.3, px:0.02, py:0.24, qx:0.06, qy:-0.38, hz:-0.3, g:32 }, T:[9, 12] },
  swing:{ a:{ rho:0.85, sig:0.28, px:0.28, py:0.06, qx:-0.32, qy:-0.18, hz:-0.3, g:70 }, z:{ rho:0.9, sig:0.3, px:-0.26, py:0.06, qx:0.32, qy:-0.18, hz:-0.3, g:150 }, T:[11, 14], ease:true },
  pushin:{ a:{ rho:0.6, sig:0.08, px:0.12, py:0.06, qx:-0.4, qy:-0.25, hz:-0.3, g:140 }, z:{ rho:0.9, sig:0.32, px:0.24, py:0.08, qx:-0.34, qy:-0.22, hz:-0.3, g:110 }, T:[10, 13], ease:true },
  still:{ a:{ rho:0.6, sig:0.1, px:0.15, py:0.06, qx:-0.45, qy:-0.28, hz:-0.3, g:140 }, z:{ rho:0.6, sig:0.1, px:0.15, py:0.06, qx:-0.45, qy:-0.28, hz:-0.3, g:140 }, T:[1e9, 1e9] },
};
// (wide and close take turns, 0.10.2: arrive is wide, a move's or a job's shot close; TCLOSE says which is which)
const TWIDE = ['cross', 'grand', 'horizon', 'ahead', 'tele'], TCLOSE_N = ['close', 'behind', 'swing', 'pushin', 'hero'], TCLOSE = new Set(TCLOSE_N);
// a job on the tour: the scan's hologram on the place with the ship beside it, the weapons test from just behind the ship as it runs in (its
// shots fly into the place), a skim and a signature move close behind the ship over the horizon
const TJOB = { scan:{ rho:0.8, sig:0.18, px:0.18, py:0.04, qx:-0.45, qy:0.28, hz:-0.3, g:100 }, weapons:{ rho:0.7, sig:0.25, px:0.1, py:0.15, qx:-0.2, qy:-0.3, hz:-0.3, g:15 },
  skim:{ rho:1.8, sig:0.25, px:0, py:-0.2, qx:-0.12, qy:0.12, hz:-0.3, g:70 }, sig:{ rho:1.5, sig:0.3, px:0, py:-0.2, qx:-0.12, qy:0.12, hz:-0.3, g:25 } };
// the size a shot frames: a surface (a star's with some of its glow; Saturn's with its rings, but only from well outside them: flying through
// them, a horizon on the rings' edge showed empty sky), a black hole's shadow and the light round it, or most of a cloud's or a galaxy's
// bounding sphere. D: the ship's distance from its centre
const FRAME_K = { saturn:2.3 };
function frameR(tg, D){
  if (!tg) return 0;
  if (tg.holeR) return tg.holeR*2.5*magOf(tg);
  const s = surfDrawn(tg), K = FRAME_K[tg.key];
  if (!(s > 0)) return tg.rad*0.6*magOf(tg);
  return s*(K ? 1 + (K - 1)*smooth(1.5*K, 3*K, (D || 0)/s) : tg.starR ? 1.6 : 1);
}
// (a star's glow keeps the Halo 50 or more of its radii out: up to 40 times closer, it still fills a good part of the view)
const LENS_MAX = 40;
// the frame of the place: u away from the body, f the heading along it (held when the ship heads straight in or out), s the side
function rideFrame(dt){
  const off = ship.offset, u = off && V.len(off) > 0 ? V.norm(off) : M3.apply(ship.R0, [-1, 0, 0]);
  if (RIDE.par !== ship.parent){ RIDE.par = ship.parent; RIDE.F = null; }
  const h = M3.apply(ship.R0, [0, 1, 0]), fr = V.sub(h, V.mul(u, V.dot(h, u))), fl = V.len(fr);
  let f = RIDE.F ? V.sub(RIDE.F.f, V.mul(u, V.dot(RIDE.F.f, u))) : fl > 1e-6 ? fr : anyPerp(u);
  // (it eases in by how far the heading is from straight in or out (kf), rather than switching on at a threshold: switched on, it set the
  // camera turning at full speed in one frame, 0.9.9 review)
  const kf = smooth(0.1, 0.4, fl);
  if (kf > 0){ const k = RIDE.F && dt > 0 ? (1 - Math.exp(-dt/0.8))*kf : 1; f = V.lerp(V.norm(f), V.mul(fr, 1/fl), k); }
  f = V.norm(f);
  RIDE.F = { u, f, s:V.cross(f, u), kf };
  return RIDE.F;
}
// a shot's settings at time t (s into it); w: the settings a transition started from, blended out over trT
const lerpA = (a, b, t) => a + Math.atan2(Math.sin((b - a)*DEGR), Math.cos((b - a)*DEGR))/DEGR*t;   // (degrees, the short way round)
const lerpL = (a, b, t) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a))*t), lerpN = (a, b, t) => a + (b - a)*t;
function mixP(p, q, t){
  if (p.rho != null) return { rho:lerpL(p.rho, q.rho, t), sig:lerpL(p.sig, q.sig, t), px:lerpN(p.px, q.px, t), py:lerpN(p.py, q.py, t), qx:lerpN(p.qx, q.qx, t), qy:lerpN(p.qy, q.qy, t), hz:lerpN(p.hz, q.hz, t), g:lerpA(p.g, q.g, t) };
  return { e:p.e + (q.e - p.e)*t, g:lerpA(p.g, q.g, t), d:lerpL(p.d, q.d, t), roll:(p.roll || 0) + ((q.roll || 0) - (p.roll || 0))*t };
}
const wrapD = x => Math.atan2(Math.sin(x*DEGR), Math.cos(x*DEGR))/DEGR;   // (degrees, into -180..180)
function shotP(){
  const sh = RIDE.shot; if (!sh) return RIDE.fam === 'tour' ? TSHOTS.still.a : SHOTS.still.a;
  const u = sh.ease ? smooth(0, 1, RIDE.t/sh.T) : clamp(RIDE.t/sh.T, 0, 1), p = mixP(sh.a, sh.z, u);
  if (!RIDE.from || RIDE.tr >= RIDE.trT) return p;
  // (the bearing turns the way it set out, from the last shot to where this one began (RIDE.dg), plus this shot's own move since: blended the
  // short way round every frame, it flipped to the other way round when the two were half a turn apart, and the camera jumped, 0.9.9 review)
  const t = smooth(0, RIDE.trT, RIDE.tr), m = mixP(RIDE.from, p, t);
  m.g = RIDE.from.g + (RIDE.dg + wrapD(p.g - sh.a.g))*t;
  return m;
}
// start a shot (name, or a job's settings) of the camera's family (RIDE.fam: the ride's SHOTS, or the Halo tour's TSHOTS); its side is a coin
// toss (a tour shot's layout mirrored with it). The glide there takes 4.2 s (3 for a job's), and longer for a long way round the ship: about 35
// degrees a second at most on average (0.9.9 review: a swing to the far side in 4.2 s read as a whip), and for a big change of distance or tilt
// (a job's shot taking over from a pull-back rushed in), or on the tour of the place's or the ship's size or where they sit
function startShot(name, job){
  const tour = RIDE.fam === 'tour', cur = RIDE.shot ? shotP() : null, S = job ? { a:job, z:job, T:[1e9, 1e9] } : (tour ? TSHOTS : SHOTS)[name], sd = job ? (S_.side || 1) : name === 'still' ? 1 : rideR() < 0.5 ? -1 : 1;
  const fix = p => tour ? { ...p, g:p.g*sd, px:p.px*sd, qx:p.qx*sd } : { ...p, g:p.g*sd, roll:(p.roll || 0)*sd };
  RIDE.shot = { name:job ? 'job' : name, a:fix(S.a), z:fix(S.z), T:S.T[0] + (S.T[1] - S.T[0])*rideR(), ease:!!S.ease };
  RIDE.dg = cur ? wrapD(RIDE.shot.a.g - cur.g) : 0;
  const a = RIDE.shot.a, lr = (x, y) => Math.abs(Math.log(Math.max(x, 1e-9)/Math.max(y, 1e-9)));
  const moveT = !cur ? 0 : tour ? Math.max(1.3*lr(cur.rho, a.rho), 1.3*lr(cur.sig, a.sig), 2.5*Math.hypot(cur.px - a.px, cur.py - a.py), 2.5*Math.hypot(cur.qx - a.qx, cur.qy - a.qy))
    : Math.max(1.3*lr(cur.d, a.d), Math.abs((a.e || 0) - (cur.e || 0))/12);
  RIDE.from = cur; RIDE.t = 0; RIDE.tr = 0; RIDE.trT = cur ? Math.max(job ? 3 : 4.2, Math.abs(RIDE.dg)/35, moveT) : 0;
  RIDE.name = RIDE.shot.name; RIDE.close = job ? true : TCLOSE.has(name);
  if (!job && name !== 'still'){ RIDE.last.push(name); if (RIDE.last.length > 3) RIDE.last.shift(); }
}
// the next shot: on the Halo tour its first at a new place (arrive), then one at random, never one of the last three.
// (0.9.9: now and then, while Pip is out, a close-up of Pip over it for 8 to 12 s, most of the time during Pip's show: pipShotPose, 07i-drone.js.
// 0.9.9 review, owner: slow and smooth, only while Pip does something calm near the ship and is barely moving: pipShotOk(true). Never on the
// tour, where the place comes first)
function nextShot(){
  if (rideStill()) return startShot('still');
  if (RIDE.queue.length) return startShot(RIDE.queue.shift());
  const tour = RIDE.fam === 'tour', pip = S_.act && S_.act.kind === 'probe', L = (tour ? (RIDE.close ? TWIDE : TCLOSE_N) : MOVING).filter(n => !RIDE.last.includes(n) && (tour || !pip || NEAR.has(n)));
  startShot(L[Math.floor(rideR()*L.length)]);
  // (only over a shot close by, and from about its own bearing, so the close-up is a slow push in rather than a swing round the ship)
  if (!tour && !RIDE.pip && NEAR.has(RIDE.shot.name) && pipShotOk(true) && rideR() < (pip ? 0.85 : 0.4)){
    const g = RIDE.shot.a.g; RIDE.pip = { t:0, T:8 + 4*rideR() }; RIDE.pipG = (g < 0 ? -1 : 1)*clamp(Math.abs(g), 70, 130); RIDE.shot.T = Math.max(RIDE.shot.T, RIDE.pip.T + 3); }
}
// (a critically damped spring: x toward x1 at angular rate w, its speed v carried from step to step, exact for any step; for numbers and for
// points. It starts and stops moving gently, and never overshoots from rest)
function spring1(x, v, x1, w, dt){ const e = x - x1, c = v + e*w, k = Math.exp(-w*dt); return [x1 + (e + c*dt)*k, (v - c*w*dt)*k]; }
function spring3(x, v, x1, w, dt){ const e = V.sub(x, x1), c = V.add(v, V.mul(e, w)), k = Math.exp(-w*dt); return [V.add(x1, V.mul(V.add(e, V.mul(c, dt)), k)), V.mul(V.sub(v, V.mul(c, w*dt)), k)]; }
// once a tick while riding along, before the pose is read (updateShipCam): the frame, the blend into the chase pose, the shot's clock
function rideStep(dt){
  if (!rideOn()) return;
  RIDE.n++;
  rideFrame(dt);
  // (the Halo tour starting or ending while riding: the camera glides from the last shot of the one family, held where it was, into the
  // first of the other, over 4.5 s)
  const fam = RIDE.epic ? 'tour' : 'ride';
  if (RIDE.fam !== fam){
    RIDE.xf = RIDE.shot ? { fam:RIDE.fam, p:shotP(), t:0, T:4.5 } : null;
    RIDE.fam = fam; RIDE.shot = null; RIDE.from = null; RIDE.job = null; RIDE.pip = null; RIDE.last.length = 0; RIDE.tref = null;
    RIDE.queue = fam === 'tour' && !rideStill() ? ['arrive'] : [];
  }
  if (RIDE.xf && (RIDE.xf.t += dt) >= RIDE.xf.T) RIDE.xf = null;
  if (RIDE.fam === 'tour' || RIDE.xf) tourRef(dt);
  rideShots(dt);
  rideLensStep(dt);
}
function rideShots(dt){
  const S = S_, ph = S.phase;
  // (the chase pose between places: in light speed and the fold, for the last seconds before a jump, and while the hull forms after a fold.
  // A fold's wind-up (9 s) takes the last 7.5 of them: 0.9.9 review, it took the chase pose the moment the wind-up began, swinging round at up to
  // 180 degrees a second with 9 s still to go)
  // (on the Halo tour earlier and slower, 0.9.12: its shots are far from the chase pose, a long way off and looking back at the place, and
  // the swing between them ran at up to 115 degrees a second)
  // the swing between them ran at up to 115 degrees a second; the turn before a light-speed hop is often only 3 s long, so on the tour it starts
  // in the last 6 s of the stay's last pass, and once started it never turns back: RIDE.lv)
  const tourW = RIDE.fam === 'tour';
  let leaving = ph === 'align' ? 1 - smooth(tourW ? 0.8 : 1.2, S.next && S.next.mode === 'fold' ? (tourW ? 8.5 : 7.5) : (tourW ? 7 : 5.5), S.jumpAt - S.t) : 0;
  if (tourW){
    if (ph === 'pass' && S.plan && (S.plan.last || (S.stay && S.stay.leave))) leaving = 1 - smooth(0, 6, S.plan.T - S.t);
    if (ph === 'pass' || ph === 'loop' || ph === 'align') leaving = RIDE.lv = Math.max(RIDE.lv || 0, leaving);
  }
  const want = ph === 'light' || ph === 'fold' || S.asm < FLK.A1 + 0.3 ? 1 : leaving;
  // (on a spring, 0.9.9 review: the swing into the chase pose and back out starts and ends gently, about 3 s long, and begins up to 5.5 s before a
  // jump; eased the old way it set off at full speed, up to 120 degrees a second when the ship left soon after the stay ended. What is left
  // of it after a short turn before a light-speed hop finishes in the first second of light speed)
  if (dt > 0) [RIDE.wc, RIDE.wcV] = spring1(RIDE.wc, RIDE.wcV, want, tourW ? 1 : 1.7, dt); else { RIDE.wc = want; RIDE.wcV = 0; }
  RIDE.wc = clamp(RIDE.wc, 0, 1);
  if (want === 1 && RIDE.wc > 0.997){ RIDE.wc = 1; RIDE.wcV = 0; } if (want === 0 && RIDE.wc < 0.003){ RIDE.wc = 0; RIDE.wcV = 0; }
  // a new place: its first shot starts once the chase pose has handed over (the Halo tour's pull-back and push-in first)
  if (S.visits !== RIDE.visits && ph !== 'light' && ph !== 'fold'){ RIDE.visits = S.visits; RIDE.tref = null; RIDE.lv = 0; RIDE.queue = RIDE.fam === 'tour' && !rideStill() ? ['arrive'] : []; RIDE.shot = null; }
  // (Pip's close-up glides in over about 2.5 s, and out again as slowly when it is over or no longer suits what Pip does, on a spring: the camera
  // starts and stops moving gently. It frames a point that follows Pip on a softer spring (pipL, ship axes), so when Pip darts off the camera
  // drifts after it rather than whipping round: before the 0.9.9 review it followed Pip itself, and turned at up to 1200 degrees a second)
  if (RIDE.pip){ RIDE.pip.t += dt; if (RIDE.pip.t > RIDE.pip.T || !pipShotOk() || RIDE.job || rideStill() || RIDE.wc > 0.5 || RIDE.fam === 'tour') RIDE.pip = null; }
  if (dt > 0) [RIDE.pk, RIDE.pkV] = spring1(RIDE.pk, RIDE.pkV, RIDE.pip ? 1 : 0, 2.2, dt);
  if (!RIDE.pip && RIDE.pk < 0.003 && Math.abs(RIDE.pkV) < 0.01){ RIDE.pk = 0; RIDE.pkV = 0; }
  RIDE.pk = clamp(RIDE.pk, 0, 1);
  if (RIDE.pk > 0 && PIP.anc){ if (!RIDE.pipL){ RIDE.pipL = PIP.anc.slice(); RIDE.pipLV = [0, 0, 0]; } else if (dt > 0) [RIDE.pipL, RIDE.pipLV] = spring3(RIDE.pipL, RIDE.pipLV, PIP.anc, 1.8, dt); }
  else if (!RIDE.pip){ RIDE.pipL = null; }
  if (!RIDE.shot){ if (RIDE.wc < 1) nextShot(); return; }
  if (RIDE.wc >= 1) return;   // (the shot waits while the chase pose has the camera)
  RIDE.t += dt; RIDE.tr += dt;
  // a job gets its own shot, held until it is done; then the shots go on
  // (on the Halo tour a move's close shot covers the move, from about 5 s before its main moment to 2 s after it, so the arrival's wide shot
  // shows the place first and a wide one follows: wide and close take turns)
  const sigNow = S.phase === 'pass' && S.plan.sig && (RIDE.fam !== 'tour' || (S.t > (S.plan.tA || 0) - 5 && S.t < (S.plan.tB || S.plan.T) + 2));
  const A = S.act, jk = A && JOB_SHOT[A.kind] && !rideStill() ? A : !A && sigNow && !rideStill() ? S.plan : null;
  if (jk && RIDE.job !== jk){ RIDE.job = jk; startShot(null, (RIDE.fam === 'tour' ? TJOB : JOB_SHOT)[jk.sig ? 'sig' : jk.kind]); return; }
  if (!jk && RIDE.job){ RIDE.job = null; nextShot(); return; }
  if (rideStill() !== (RIDE.shot.name === 'still') && !jk){ nextShot(); return; }
  // (0.9.9 review: not while Pip plays peekaboo or rides along beside the camera, made for this shot: it holds its end until Pip is done)
  if (!jk && RIDE.t >= RIDE.shot.T && !pipCamBit()) nextShot();
}
// the pose for a shot's settings p, in the ship's frame (relative to its centre, world axes; like shipPose). The ship sits phi above the
// middle of the view (as far as its size on screen allows, at most 12 degrees); the camera tips b from u, the body's edge e degrees past
// the middle: b = (the body's size on screen) + phi + e, so a near planet fills the lower part of the view and a far one sits under the ship
function shotPose(p){
  // (tanX0, tanY0: the view without a long lens, so a shot keeps its framing while the tour's lens eases in or out)
  const F = RIDE.F || rideFrame(0), r = ship.rad, zoom = shipCam.zoom*Math.max(1, 0.62/tanX0);
  // (halfV: half the height of the free view in degrees: on a phone only the space above the card and the dock, which the view is already
  // centred on (viewShift); leash.by is 35% of it)
  const freeH = clamp(leash.by/0.35/Math.max(viewHcss, 1), 0.2, 1), halfV = Math.atan(freeH*tanY0)/DEGR;
  const d = p.d*zoom, shipA = Math.asin(Math.min(0.95, 0.9/d))/DEGR, phi = clamp(0.8*halfV - shipA, 0, 12);
  const tg = S_.target, D = V.len(ship.offset || [1, 0, 0]), al = tg ? Math.asin(clamp(bodyR(tg)/Math.max(D, 1e-300), 0, 1))/DEGR : 30;
  const b = clamp(al + phi + p.e, 12, 80), B = b*DEGR, G = p.g*DEGR, psi = (b - phi)*DEGR;
  const a = V.add(V.mul(F.f, -Math.cos(G)), V.mul(F.s, Math.sin(G)));
  const o = V.add(V.mul(F.u, Math.cos(B)), V.mul(a, Math.sin(B)));
  const fwd = V.mul(V.add(V.mul(F.u, Math.cos(psi)), V.mul(a, Math.sin(psi))), -1);
  let up = V.sub(V.mul(F.u, Math.sin(psi)), V.mul(a, Math.cos(psi)));
  if (p.roll){ const R = p.roll*DEGR; up = V.add(V.mul(up, Math.cos(R)), V.mul(V.cross(fwd, up), Math.sin(R))); }
  const eye = V.mul(o, d*r);
  return { eye, look:V.add(eye, V.mul(fwd, d*r)), fwd, up };
}
// the tour's bearing reference: carried along with the ship (laid back each tick onto the plane square to u, so it never flips) and drawn
// toward the ship's heading on a slow spring, only while the heading runs along the surface (kf), so behind and ahead still mean something.
// Bearings taken from the heading itself rolled the picture at 260 degrees a second: in a loop the heading swings right round, and passing
// straight in or out its part along the surface flips. dt 0: read it without moving it
function tourRef(dt){
  const F = RIDE.F || rideFrame(0);
  if (!RIDE.tref) RIDE.tref = { d:F.f.slice(), v:0 };
  const T = RIDE.tref, q = V.sub(T.d, V.mul(F.u, V.dot(T.d, F.u))), l = V.len(q);
  let d = l > 1e-6 ? V.mul(q, 1/l) : F.f.slice();
  if (dt > 0){
    const w = 0.35, ang = Math.atan2(V.dot(V.cross(d, F.f), F.u), V.dot(d, F.f));
    T.v += (w*w*ang*F.kf - 2*w*T.v)*dt;
    const th = T.v*dt; d = V.norm(V.add(V.mul(d, Math.cos(th)), V.mul(V.cross(F.u, d), Math.sin(th))));
    T.d = d;
  }
  return d;
}
// the tour: the free view (fh, its share of the height on a phone, above the card) and m0, half its smaller side in tan units without a lens
// (leash.by is measured by the drawing loop, updateShift: until it has run, the whole view)
function tourFree(){ const fh = leash.by > 0 ? clamp(leash.by/0.35/Math.max(viewHcss, 1), 0.2, 1) : 1; return { fh, m0:Math.min(tanX0, fh*tanY0) }; }
// the lens a tour shot asks for: the place's disc rho across (never wider than the plain view, never more than LENS_MAX)
function tourLens(p){
  const tg = ship.parent || S_.target, D = V.len(ship.offset || [1, 0, 0]), R = frameR(tg, D);
  if (!tg || !(R > 0) || !(D > 0)) return 1;
  return clamp(p.rho*tourFree().m0/Math.tan(Math.asin(clamp(R/D, 0, 0.999))), 1, LENS_MAX);
}
// the pose for a tour shot's settings p (like shotPose: in the ship's frame, relative to its centre, world axes), with the lens as it is now
// (RIDE.lk). The place's centre and the ship are two directions from the camera, where the shot puts them on the screen (a horizon when the
// place is too big to fit: its centre below the view, its top edge at hz). The camera turns so the place's centre lands on its point with T,
// the shot's bearing (g) round the ship from the tour's reference, as the screen's up (seen straight at the centre; tipped up to a horizon, T
// is the way the camera looks along it and the horizon stays level), and it sits dS from the ship, where the ship lands on its point: the
// two worked out in turn, three times over, as each moves the other a little. (The roll once came from the line between the two points, and
// spun when the ship crossed in front of the place's centre)
const dirAE = (az, el) => [Math.cos(el)*Math.sin(az), Math.sin(el), Math.cos(el)*Math.cos(az)];
const rotAx = (v, n, c, s) => V.add(V.add(V.mul(v, c), V.mul(V.cross(n, v), s)), V.mul(n, V.dot(n, v)*(1 - c)));
function tourPose(p){
  const F = RIDE.F || rideFrame(0), r = ship.rad, tg = ship.parent || S_.target, off = ship.offset && V.len(ship.offset) > 0 ? ship.offset : V.mul(F.u, r*1e3), D = V.len(off);
  const k = Math.exp(RIDE.lk), { fh, m0 } = tourFree(), m = m0/k, tx = tanX0/k, ty = tanY0/k;
  // (a horizon for the shots that ask for one, bigger than the view, and only over a surface: a cloud, a disc or a galaxy keeps its middle in
  // the view. It went by how big the place was on the screen before, and a fast dive tipped the camera up to the horizon in a second; a
  // whole-place shot close in now looks down at the surface under the ship)
  // (the horizon is the surface itself, a star's photosphere or a planet's globe: a corona pass flies inside the glow framed for the whole
  // place, and a horizon on the glow's edge put the star 40 degrees below the view, 0.10.2)
  const sd = surfDrawn(tg), solid = sd > 0 && !tg.holeR, alS = Math.asin(clamp((solid ? sd : frameR(tg, D))/D, 0, 0.999)), w = solid ? smooth(1, 1.4, p.rho) : 0, elH = Math.atan(p.hz*fh*ty), sg = p.sig*m;
  const dP = dirAE(lerpN(Math.atan(p.px*tx), 0, w), lerpN(Math.atan(p.py*fh*ty), elH - alS, w));
  const elQ = Math.atan(p.qy*fh*ty), dQ = dirAE(Math.atan(p.qx*tx), lerpN(elQ, Math.max(elQ, elH + 2.2*Math.atan(sg)), w));
  // (the ship sg across in tan units; never more than half way to the place's centre)
  const dS = Math.min(r*shipCam.zoom/sg, 0.5*D), G = p.g*DEGR, fT = tourRef(0), T = V.add(V.mul(fT, Math.cos(G)), V.mul(V.cross(fT, F.u), Math.sin(G)));
  // (the turn in camera space that takes the view's middle onto the place's point, undone: c -> its camera-space vector seen straight at the centre)
  const nz = Math.hypot(dP[0], dP[1]), n = nz > 1e-9 ? [-dP[1]/nz, dP[0]/nz, 0] : [1, 0, 0], ct = dP[2], st = -nz;
  const un = c => rotAx(c, n, ct, st);
  const z0 = un([0, 0, 1]), y0 = un([0, 1, 0]), q0 = un(dQ);
  let eye = V.mul(F.u, dS), fwd, up;
  for (let it = 0; it < 3; it++){
    const bw = V.norm(V.sub(V.mul(off, -1), eye)), u1 = V.norm(V.sub(T, V.mul(bw, V.dot(T, bw)))), r1 = V.cross(bw, u1);
    const W = c => V.add(V.add(V.mul(r1, c[0]), V.mul(u1, c[1])), V.mul(bw, c[2]));
    fwd = V.norm(W(z0)); up = V.norm(W(y0)); eye = V.mul(V.norm(W(q0)), -dS);
  }
  RIDE.tdS = dS;
  return { eye, look:V.add(eye, V.mul(fwd, dS)), fwd, up };
}
// the lens, once a tick while riding: what the tour's shot asks for, eased in and out on a spring (and out between places, with the chase
// pose). Riding starts with the plain view and the lens zooms in while the camera backs away, so the ship keeps its size and the place grows
function rideLensStep(dt){
  const xf = RIDE.xf, xt = xf ? smooth(0, xf.T, xf.t) : 1, tw = RIDE.fam === 'tour' ? xt : xf && xf.fam === 'tour' ? 1 - xt : 0;
  const p = RIDE.fam === 'tour' ? (RIDE.shot ? shotP() : null) : xf ? xf.p : null;
  const want = tw > 0 && p && S_.target && RIDE.wc < 1 ? tw*(1 - RIDE.wc)*Math.log(tourLens(p)) : 0;
  if (dt > 0) [RIDE.lk, RIDE.lkV] = spring1(RIDE.lk, RIDE.lkV, want, 2, dt); else { RIDE.lk = want; RIDE.lkV = 0; }
  if (!LCAM.on) LENS.k = Math.exp(RIDE.lk);
}
// (not riding: the lens eases back to the plain view; a tick hook, from 09t-halotour.js)
function rideLensIdle(dt){
  if ((shipCam.on && shipCam.mode === 'chase' && rideOn()) || (!RIDE.lk && !RIDE.lkV)) return;
  [RIDE.lk, RIDE.lkV] = spring1(RIDE.lk, RIDE.lkV, 0, 2.5, dt);
  if (Math.abs(RIDE.lk) < 1e-4 && Math.abs(RIDE.lkV) < 1e-3){ RIDE.lk = 0; RIDE.lkV = 0; }
  if (!LCAM.on) LENS.k = Math.exp(RIDE.lk);
}
// the pose riding along: the shot (with Pip's close-up blended over it), blended into the chase pose between places. (0.9.9 review: the eye moves
// round the ship in the frame of the place, its tilt from u, its bearing and its distance each going from one pose's to the other's, the
// bearing round the side the first one is on, and the view aims at a point between the two poses' look points. The view directions were
// slerped before: a shot ahead of the ship looks almost straight back along the chase camera's view, and between two nearly opposite
// directions the turn flipped from one side to the other, the camera lurching at up to 120 degrees a second). The two bearings are followed
// from frame to frame (BG, per blend), the short way between them chosen as a blend starts: a bearing passing straight ahead would otherwise
// jump a whole turn and swing the blend with it
// The camera's roll comes from the two poses' orientations blended as quaternions (each one's sign followed from frame to frame too, so the
// turn between them never flips), squared to the view: mixing the two up vectors could leave the mix nearly along the view (a shot looking
// down on the ship, blended into the chase pose), and the picture rolled at 180 degrees a second
const BG = {}, wrapR = x => Math.atan2(Math.sin(x), Math.cos(x));
function quatOf(f, u){   // (the camera's orientation: right, up and back as the columns of a rotation)
  const r = V.norm(V.cross(f, u)), y = V.cross(r, f), m00 = r[0], m11 = y[1], m22 = -f[2], tr = m00 + m11 + m22;
  if (tr > 0){ const s = 0.5/Math.sqrt(tr + 1); return [0.25/s, (y[2] + f[1])*s, (-f[0] - r[2])*s, (r[1] - y[0])*s]; }
  if (m00 > m11 && m00 > m22){ const s = 2*Math.sqrt(1 + m00 - m11 - m22); return [(y[2] + f[1])/s, 0.25*s, (y[0] + r[1])/s, (-f[0] + r[2])/s]; }
  if (m11 > m22){ const s = 2*Math.sqrt(1 + m11 - m00 - m22); return [(-f[0] - r[2])/s, (y[0] + r[1])/s, 0.25*s, (-f[1] + y[2])/s]; }
  const s = 2*Math.sqrt(1 + m22 - m00 - m11); return [(r[1] - y[0])/s, (-f[0] + r[2])/s, (-f[1] + y[2])/s, 0.25*s];
}
const qdot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3], qfix = (q, ref) => ref && qdot(q, ref) < 0 ? q.map(x => -x) : q;
function qslerp(a, b, t){ const c = clamp(qdot(a, b), -1, 1), th = Math.acos(c), s = Math.sin(th);
  const q = s < 1e-5 ? a.map((x, i) => x + (b[i] - x)*t) : a.map((x, i) => (Math.sin((1 - t)*th)*x + Math.sin(t*th)*b[i])/s), l = Math.hypot(...q); return q.map(x => x/l); }
function rideBlend(P, C, w, key){
  const F = RIDE.F || rideFrame(0);
  const sph = e => { const d = V.len(e), n = V.mul(e, 1/d), a = V.sub(n, V.mul(F.u, V.dot(n, F.u)));
    return [Math.acos(clamp(V.dot(n, F.u), -1, 1)), Math.atan2(V.dot(a, F.s), -V.dot(a, F.f)), d]; };
  const [B0, G0, d0] = sph(P.eye), [B1, G1, d1] = sph(C.eye);
  // (a blend not followed on the last tick starts afresh: kept from an earlier ride, it could set off the long way round)
  let q0 = quatOf(P.fwd, P.up), q1 = quatOf(C.fwd, C.up), st = BG[key];
  if (!st || w < 1e-3 || w > 0.999 || st.n < RIDE.n - 1){ q1 = qfix(q1, q0); st = BG[key] = { g0:G0, g1:G0 + wrapR(G1 - G0), q0, q1 }; }
  else { st.g0 += wrapR(G0 - st.g0); st.g1 += wrapR(G1 - st.g1); st.q0 = q0 = qfix(q0, st.q0); st.q1 = q1 = qfix(q1, st.q1); }
  st.n = RIDE.n;
  const B = B0 + (B1 - B0)*w, G = st.g0 + (st.g1 - st.g0)*w, dist = Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0))*w);
  const a = V.add(V.mul(F.f, -Math.cos(G)), V.mul(F.s, Math.sin(G))), eye = V.mul(V.add(V.mul(F.u, Math.cos(B)), V.mul(a, Math.sin(B))), dist);
  const look = V.lerp(P.look, C.look, w), fwd = V.norm(V.sub(look, eye)), q = qslerp(q0, q1, w), x = q[1], y = q[2], z = q[3], s = q[0];
  const uq = [2*(x*y - s*z), 1 - 2*(x*x + z*z), 2*(y*z + s*x)], up = V.sub(uq, V.mul(fwd, V.dot(uq, fwd)));
  return { eye, look, fwd, up:V.len(up) > 1e-3 ? V.norm(up) : uq };
}
// (and on the Halo tour its shots; while the tour starts or ends, the last shot of the other kind blended into them: RIDE.xf)
const famPose = (fam, p) => fam === 'tour' ? tourPose(p) : shotPose(p);
function ridePose(){
  const C = chasePose(); if (!rideOn() || RIDE.wc >= 1 || !S_.target) return C;
  let P = famPose(RIDE.fam, shotP());
  if (RIDE.pk > 0 && RIDE.pipL) P = rideBlend(P, pipShotPose(RIDE.pipG, RIDE.pipL), smooth(0, 1, RIDE.pk), 'pip');
  if (RIDE.xf) P = rideBlend(famPose(RIDE.xf.fam, RIDE.xf.p), P, smooth(0, RIDE.xf.T, RIDE.xf.t), 'fam');
  return RIDE.wc <= 0 ? P : rideBlend(P, C, RIDE.wc, 'chase');
}
// how far the camera may be from the ship right now (tests: a camera that lost the ship would be far beyond this)
function rideReach(){
  const d = s => s && s.d != null ? s.d : 0, sh = RIDE.shot, P = sh ? Math.max(d(sh.a), d(sh.z), d(RIDE.from)) : 0, T = RIDE.fam === 'tour' || RIDE.xf ? 1.1*RIDE.tdS/ship.rad : 0;
  return Math.max(P*shipCam.zoom*Math.max(1, 0.62/tanX0), V.len(SHIP_POSE.chase.eye)*shipCam.zoom, T)*ship.rad;
}
// riding starts: the first shot is made now, so the flight up to the ship lands on it (on the Halo tour its first shot at a place)
function rideStart(){ RIDE.shot = null; RIDE.from = null; RIDE.job = null; RIDE.last.length = 0; RIDE.queue = []; RIDE.visits = S_.visits; RIDE.F = null; RIDE.pip = null; RIDE.pk = RIDE.pkV = 0; RIDE.pipL = null; rideFrame(0);
  RIDE.fam = RIDE.epic ? 'tour' : 'ride'; RIDE.xf = null; RIDE.tref = null;
  const between = S_.phase === 'light' || S_.phase === 'fold' || S_.fk > -90 || S_.asm < FLK.A1 + 0.3; RIDE.wc = between ? 1 : 0; RIDE.wcV = 0;
  if (!between) startShot(rideStill() ? 'still' : RIDE.fam === 'tour' ? 'arrive' : 'shoulder'); }
// the Halo tour's state (its logic is in 09t-halotour.js; kept here so the interface code, which loads before it, can read it)
const HT = { on:false, tourId:'grand', stops:[], i:0, want:null, visits:-1, capT:0, n:0, jk:0 };

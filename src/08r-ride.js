
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
// to a shot made for it and holds until it is done (Pip's outing keeps moving). The Halo tour (09t-halotour.js) asks for bigger moves (RIDE.epic): a pull-back that
// shows the whole place with the ship small against it, a push back in, sweeps round the ship, a crane over it.
// Between places (light speed, the fold) and for the last seconds before a jump the camera blends back into the chase pose behind the ship
// (chasePose in 08-camera.js): there is nothing to show there but the streaks and the fold, which are made for that view.
// Dice: rideR, its own generator (never hrnd, which steers the Halo's route, nor rnd, which gives every visitor the same numbers).
const RIDE_LAB = !!window.__LAB || new URLSearchParams(location.search).has('lab');   // (the lab keeps the plain chase camera: its stills must repeat)
const RIDE = { F:null, par:null, shot:null, from:null, t:0, tr:0, trT:4, wc:1, visits:-1, job:null, last:[], queue:[], epic:false, name:"", pip:null, pk:0, pipG:110 };
let rideR = (() => { let s = (Math.random()*4294967296) >>> 0; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; })();
const DEGR = Math.PI/180;
// a shot: a (where it starts) and z (where it ends, T seconds later). e: how far past the body's edge the camera tips, in degrees (the tilt
// b is worked out from the body's size on screen, so its edge sits near the middle of the view and it fills the lower part: shotPose);
// g, roll in degrees; d in ship radii ('far': a pull-back that shows the whole body, farD). ease: an eased move (a dolly or a sweep), else a
// steady drift. The angles keep to the ship's side and front quarters: from straight behind, its needle points up the screen and it seems
// to climb (the owner saw that in the old chase camera, 2026-09-26)
const SHOTS = {
  shoulder:{ a:{ e:4, g:58, d:4.2 }, z:{ e:5, g:74, d:3.9 }, T:[12, 16] },
  side:{ a:{ e:7, g:84, d:4.2 }, z:{ e:5, g:104, d:3.9 }, T:[11, 15] },
  front:{ a:{ e:4, g:132, d:4.6 }, z:{ e:3, g:150, d:4 }, T:[10, 14] },
  high:{ a:{ e:-5, g:70, d:6, roll:18 }, z:{ e:-3, g:96, d:5, roll:10 }, T:[12, 16] },
  low:{ a:{ e:16, g:70, d:3.6 }, z:{ e:14, g:92, d:3.9 }, T:[10, 14] },
  wide:{ a:{ e:3, g:66, d:9 }, z:{ e:3, g:92, d:7 }, T:[12, 18] },
  orbit:{ a:{ e:6, g:48, d:4.8 }, z:{ e:6, g:140, d:4.8 }, T:[14, 18], ease:true },
  // the Halo tour's bigger moves
  reveal:{ a:{ e:4, g:62, d:4.2 }, z:{ e:2, g:88, d:'far' }, T:[11, 14], ease:true, epic:true },
  pushin:{ a:{ e:2, g:96, d:'far' }, z:{ e:5, g:64, d:3.8 }, T:[9, 12], ease:true, epic:true },
  sweep:{ a:{ e:6, g:40, d:5, roll:-8 }, z:{ e:6, g:150, d:4.2, roll:8 }, T:[12, 15], ease:true, epic:true },
  grazing:{ a:{ e:20, g:76, d:3.4 }, z:{ e:17, g:112, d:3.8 }, T:[10, 13], epic:true },
  crane:{ a:{ e:16, g:120, d:3.8 }, z:{ e:-4, g:84, d:7, roll:14 }, T:[11, 14], ease:true, epic:true },
  charge:{ a:{ e:3, g:160, d:3.4 }, z:{ e:5, g:138, d:12 }, T:[10, 13], ease:true, epic:true },
  // still: over the ship's shoulder, and nothing moves
  still:{ a:{ e:4, g:64, d:4.2 }, z:{ e:4, g:64, d:4.2 }, T:[1e9, 1e9] },
};
// a job's own shot, from the side it is done on: the scan's ring and beams across the view, the cannon ahead of the needle and its shots
// toward the body, the skim low over the surface. (Pip's outing lasts half a minute: the shots go on round it, only the close ones, NEAR)
const JOB_SHOT = { scan:{ e:8, g:92, d:4.4 }, weapons:{ e:6, g:74, d:4.0 }, skim:{ e:18, g:80, d:3.6 },
  // (0.9.7: a signature move, 07h-halo.js sigSpec: low behind the ship's shoulder, so what it flies through or over comes at the camera with it)
  sig:{ e:10, g:38, d:3.4 } };
const NEAR = new Set(['shoulder', 'side', 'front', 'low', 'orbit', 'sweep', 'grazing']);
const MOVING = ['shoulder', 'side', 'front', 'high', 'low', 'wide', 'orbit'], EPIC = ['sweep', 'grazing', 'crane', 'charge', 'reveal', 'wide', 'orbit', 'front', 'low'];
const rideOn = () => !RIDE_LAB;
const rideStill = () => SET.rideCam === 'still';
// how far out the pull-back goes: until the whole body fits the view (its drawn size), but never so far that the ship is lost (600 ship
// radii, a character or two on screen, its engine trail still in sight); round something far bigger (a galaxy, a nebula) a plain pull-back
function farD(){
  const tg = S_.target, R = bodyR(tg), D = V.len(ship.offset || [1, 0, 0]), need = (2.6*R - D)/ship.rad;
  return need > 5e3 ? 40 : clamp(need, 12, 600);
}
const bodyR = tg => tg ? (surfDrawn(tg) || tg.rad*0.6*magOf(tg)) : 0;
// the frame of the place: u away from the body, f the heading along it (held when the ship heads straight in or out), s the side
function rideFrame(dt){
  const off = ship.offset, u = off && V.len(off) > 0 ? V.norm(off) : M3.apply(ship.R0, [-1, 0, 0]);
  if (RIDE.par !== ship.parent){ RIDE.par = ship.parent; RIDE.F = null; }
  const h = M3.apply(ship.R0, [0, 1, 0]), fr = V.sub(h, V.mul(u, V.dot(h, u))), fl = V.len(fr);
  let f = RIDE.F ? V.sub(RIDE.F.f, V.mul(u, V.dot(RIDE.F.f, u))) : fl > 1e-6 ? fr : anyPerp(u);
  if (fl > 0.25){ const k = RIDE.F && dt > 0 ? 1 - Math.exp(-dt/0.8) : 1; f = V.lerp(V.norm(f), V.mul(fr, 1/fl), k); }
  f = V.norm(f);
  RIDE.F = { u, f, s:V.cross(f, u) };
  return RIDE.F;
}
// a shot's settings at time t (s into it); w: the settings a transition started from, blended out over trT
const lerpA = (a, b, t) => a + Math.atan2(Math.sin((b - a)*DEGR), Math.cos((b - a)*DEGR))/DEGR*t;   // (degrees, the short way round)
function mixP(p, q, t){ return { e:p.e + (q.e - p.e)*t, g:lerpA(p.g, q.g, t), d:Math.exp(Math.log(p.d) + (Math.log(q.d) - Math.log(p.d))*t), roll:(p.roll || 0) + ((q.roll || 0) - (p.roll || 0))*t }; }
function shotP(){
  const sh = RIDE.shot; if (!sh) return SHOTS.still.a;
  const u = sh.ease ? smooth(0, 1, RIDE.t/sh.T) : clamp(RIDE.t/sh.T, 0, 1), p = mixP(sh.a, sh.z, u);
  return RIDE.from && RIDE.tr < RIDE.trT ? mixP(RIDE.from, p, smooth(0, RIDE.trT, RIDE.tr)) : p;
}
// start a shot (name, or a job's settings); its side is a coin toss, 'far' is worked out now
function startShot(name, job){
  const cur = RIDE.shot ? shotP() : null, S = job ? { a:job, z:job, T:[1e9, 1e9] } : SHOTS[name], sd = job ? (S_.side || 1) : name === 'still' ? 1 : rideR() < 0.5 ? -1 : 1, fd = farD();
  const fix = p => ({ ...p, g:p.g*sd, roll:(p.roll || 0)*sd, d:p.d === 'far' ? fd : p.d });
  RIDE.shot = { name:job ? 'job' : name, a:fix(S.a), z:fix(S.z), T:S.T[0] + (S.T[1] - S.T[0])*rideR(), ease:!!S.ease };
  RIDE.from = cur; RIDE.t = 0; RIDE.tr = 0; RIDE.trT = cur ? (job ? 3 : 4.2) : 0;
  RIDE.name = RIDE.shot.name;
  if (!job && name !== 'still'){ RIDE.last.push(name); if (RIDE.last.length > 3) RIDE.last.shift(); }
}
// the next shot: the Halo tour's program for a new place first (a pull-back to show it, then back in), then one at random, never one of the last three.
// (0.9.7: now and then, while Pip is out, a close-up of Pip over it for 8 to 12 s, most of the time during Pip's show: pipShotPose, 07i-drone.js)
function nextShot(){
  if (rideStill()) return startShot('still');
  if (RIDE.queue.length) return startShot(RIDE.queue.shift());
  const pip = S_.act && S_.act.kind === 'probe', L = (RIDE.epic ? EPIC : MOVING).filter(n => !RIDE.last.includes(n) && (!pip || NEAR.has(n)));
  startShot(L[Math.floor(rideR()*L.length)]);
  if (!RIDE.pip && pipShotOk() && rideR() < (pip ? 0.85 : 0.4)){ RIDE.pip = { t:0, T:8 + 4*rideR() }; RIDE.pipG = (rideR() < 0.5 ? -1 : 1)*(80 + 60*rideR()); RIDE.shot.T = Math.max(RIDE.shot.T, RIDE.pip.T + 2); }
}
// once a tick while riding along, before the pose is read (updateShipCam): the frame, the blend into the chase pose, the shot's clock
function rideStep(dt){
  if (!rideOn()) return;
  rideFrame(dt);
  const S = S_, ph = S.phase;
  // (the chase pose between places: in light speed and the fold, for the last seconds before a jump, and while the hull forms after a fold)
  const leaving = ph === 'align' ? 1 - smooth(1.2, 4, S.jumpAt - S.t) : 0;
  const want = ph === 'light' || ph === 'fold' || S.fk > -90 || S.asm < FLK.A1 + 0.3 ? 1 : leaving;
  RIDE.wc += (want - RIDE.wc)*(dt > 0 ? 1 - Math.exp(-dt/0.55) : 1);
  if (want === 1 && RIDE.wc > 0.985) RIDE.wc = 1; if (want === 0 && RIDE.wc < 0.01) RIDE.wc = 0;
  // a new place: its first shot starts once the chase pose has handed over (the Halo tour's pull-back and push-in first)
  if (S.visits !== RIDE.visits && ph !== 'light' && ph !== 'fold'){ RIDE.visits = S.visits; RIDE.queue = RIDE.epic && !rideStill() ? ['reveal', 'pushin'] : []; RIDE.shot = null; }
  // (Pip's close-up eases in over about a second and out again when it is over or no longer suits what Pip does)
  if (RIDE.pip){ RIDE.pip.t += dt; if (RIDE.pip.t > RIDE.pip.T || !pipShotOk() || RIDE.job || rideStill() || RIDE.wc > 0.5) RIDE.pip = null; }
  RIDE.pk += ((RIDE.pip ? 1 : 0) - RIDE.pk)*(dt > 0 ? 1 - Math.exp(-dt/0.9) : 1); if (!RIDE.pip && RIDE.pk < 0.005) RIDE.pk = 0;
  if (!RIDE.shot){ if (RIDE.wc < 1) nextShot(); return; }
  if (RIDE.wc >= 1) return;   // (the shot waits while the chase pose has the camera)
  RIDE.t += dt; RIDE.tr += dt;
  // a job gets its own shot, held until it is done; then the shots go on
  const A = S.act, jk = A && JOB_SHOT[A.kind] && !rideStill() ? A : !A && S.phase === 'pass' && S.plan.sig && !rideStill() ? S.plan : null;
  if (jk && RIDE.job !== jk){ RIDE.job = jk; startShot(null, JOB_SHOT[jk.sig ? 'sig' : jk.kind]); return; }
  if (!jk && RIDE.job){ RIDE.job = null; nextShot(); return; }
  if (rideStill() !== (RIDE.shot.name === 'still') && !jk){ nextShot(); return; }
  if (!jk && RIDE.t >= RIDE.shot.T) nextShot();
}
// the pose for a shot's settings p, in the ship's frame (relative to its centre, world axes; like shipPose). The ship sits phi above the
// middle of the view (as far as its size on screen allows, at most 12 degrees); the camera tips b from u, the body's edge e degrees past
// the middle: b = (the body's size on screen) + phi + e, so a near planet fills the lower part of the view and a far one sits under the ship
function shotPose(p){
  const F = RIDE.F || rideFrame(0), r = ship.rad, zoom = shipCam.zoom*Math.max(1, 0.62/tanX);
  // (halfV: half the height of the free view in degrees: on a phone only the space above the card and the dock, which the view is already
  // centred on (viewShift); leash.by is 35% of it)
  const freeH = clamp(leash.by/0.35/Math.max(viewHcss, 1), 0.2, 1), halfV = Math.atan(freeH*tanY)/DEGR;
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
// the pose riding along: the shot (with Pip's close-up blended over it), blended into the chase pose between places
function blendPose(P, C, w){
  const dP = V.len(P.eye), dC = V.len(C.eye), dist = Math.exp(Math.log(dP) + (Math.log(dC) - Math.log(dP))*w);
  const eye = V.mul(slerpDir(V.mul(P.eye, 1/dP), V.mul(C.eye, 1/dC), w), dist), fwd = slerpDir(P.fwd, C.fwd, w), up = V.norm(V.lerp(P.up, C.up, w));
  return { eye, look:V.add(eye, V.mul(fwd, dist)), fwd, up };
}
function ridePose(){
  const C = chasePose(); if (!rideOn() || RIDE.wc >= 1 || !S_.target) return C;
  let P = shotPose(shotP());
  if (RIDE.pk > 0 && PIP.anc) P = blendPose(P, pipShotPose(RIDE.pipG), smooth(0, 1, RIDE.pk));
  return RIDE.wc <= 0 ? P : blendPose(P, C, RIDE.wc);
}
// how far the camera may be from the ship right now (tests: a camera that lost the ship would be far beyond this)
function rideReach(){ const P = RIDE.shot ? Math.max(RIDE.shot.a.d, RIDE.shot.z.d, RIDE.from ? RIDE.from.d : 0) : 0; return Math.max(P*shipCam.zoom*Math.max(1, 0.62/tanX), V.len(SHIP_POSE.chase.eye)*shipCam.zoom)*ship.rad; }
// riding starts: the first shot is made now, so the flight up to the ship lands on it
function rideStart(){ RIDE.shot = null; RIDE.from = null; RIDE.job = null; RIDE.last.length = 0; RIDE.queue = []; RIDE.visits = S_.visits; RIDE.F = null; RIDE.pip = null; RIDE.pk = 0; rideFrame(0);
  const between = S_.phase === 'light' || S_.phase === 'fold' || S_.fk > -90 || S_.asm < FLK.A1 + 0.3; RIDE.wc = between ? 1 : 0;
  if (!between) startShot(rideStill() ? 'still' : 'shoulder');
  // (the Halo tour: a moment after landing, the pull-back that shows the place, and back in)
  if (RIDE.epic && !rideStill()){ RIDE.queue = ['reveal', 'pushin']; if (RIDE.shot) RIDE.shot.T = 2.5; } }
// the Halo tour's state (its logic is in 09t-halotour.js; kept here so the interface code, which loads before it, can read it)
const HT = { on:false, tourId:'grand', stops:[], i:0, want:null, visits:-1, capT:0, STAY:[55, 70] };


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
const RIDE = { F:null, par:null, shot:null, from:null, t:0, tr:0, trT:4, wc:1, visits:-1, job:null, last:[], queue:[], epic:false, name:"", pip:null, pk:0, pkV:0, pipG:110, pipL:null, pipLV:[0, 0, 0], dg:0, wcV:0, n:0 };
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
  // (it eases in by how far the heading is from straight in or out (kf), rather than switching on at a threshold: switched on, it set the
  // camera turning at full speed in one frame, 0.9.7 review)
  const kf = smooth(0.1, 0.4, fl);
  if (kf > 0){ const k = RIDE.F && dt > 0 ? (1 - Math.exp(-dt/0.8))*kf : 1; f = V.lerp(V.norm(f), V.mul(fr, 1/fl), k); }
  f = V.norm(f);
  RIDE.F = { u, f, s:V.cross(f, u) };
  return RIDE.F;
}
// a shot's settings at time t (s into it); w: the settings a transition started from, blended out over trT
const lerpA = (a, b, t) => a + Math.atan2(Math.sin((b - a)*DEGR), Math.cos((b - a)*DEGR))/DEGR*t;   // (degrees, the short way round)
function mixP(p, q, t){ return { e:p.e + (q.e - p.e)*t, g:lerpA(p.g, q.g, t), d:Math.exp(Math.log(p.d) + (Math.log(q.d) - Math.log(p.d))*t), roll:(p.roll || 0) + ((q.roll || 0) - (p.roll || 0))*t }; }
const wrapD = x => Math.atan2(Math.sin(x*DEGR), Math.cos(x*DEGR))/DEGR;   // (degrees, into -180..180)
function shotP(){
  const sh = RIDE.shot; if (!sh) return SHOTS.still.a;
  const u = sh.ease ? smooth(0, 1, RIDE.t/sh.T) : clamp(RIDE.t/sh.T, 0, 1), p = mixP(sh.a, sh.z, u);
  if (!RIDE.from || RIDE.tr >= RIDE.trT) return p;
  // (the bearing turns the way it set out, from the last shot to where this one began (RIDE.dg), plus this shot's own move since: blended the
  // short way round every frame, it flipped to the other way round when the two were half a turn apart, and the camera jumped, 0.9.7 review)
  const t = smooth(0, RIDE.trT, RIDE.tr), m = mixP(RIDE.from, p, t);
  m.g = RIDE.from.g + (RIDE.dg + wrapD(p.g - sh.a.g))*t;
  return m;
}
// start a shot (name, or a job's settings); its side is a coin toss, 'far' is worked out now. The glide there takes 4.2 s (3 for a job's), and
// longer for a long way round the ship: about 35 degrees a second at most on average (0.9.7 review: a swing to the far side in 4.2 s read as a whip),
// and for a big change of distance or tilt (a job's shot or a signature move's taking over from the Halo tour's pull-back rushed in)
function startShot(name, job){
  const cur = RIDE.shot ? shotP() : null, S = job ? { a:job, z:job, T:[1e9, 1e9] } : SHOTS[name], sd = job ? (S_.side || 1) : name === 'still' ? 1 : rideR() < 0.5 ? -1 : 1, fd = farD();
  const fix = p => ({ ...p, g:p.g*sd, roll:(p.roll || 0)*sd, d:p.d === 'far' ? fd : p.d });
  RIDE.shot = { name:job ? 'job' : name, a:fix(S.a), z:fix(S.z), T:S.T[0] + (S.T[1] - S.T[0])*rideR(), ease:!!S.ease };
  RIDE.dg = cur ? wrapD(RIDE.shot.a.g - cur.g) : 0;
  const ld = cur ? Math.abs(Math.log(Math.max(cur.d, 1e-9)/Math.max(RIDE.shot.a.d, 1e-9))) : 0, de = cur ? Math.abs((RIDE.shot.a.e || 0) - (cur.e || 0)) : 0;
  RIDE.from = cur; RIDE.t = 0; RIDE.tr = 0; RIDE.trT = cur ? Math.max(job ? 3 : 4.2, Math.abs(RIDE.dg)/35, 1.3*ld, de/12) : 0;
  RIDE.name = RIDE.shot.name;
  if (!job && name !== 'still'){ RIDE.last.push(name); if (RIDE.last.length > 3) RIDE.last.shift(); }
}
// the next shot: the Halo tour's program for a new place first (a pull-back to show it, then back in), then one at random, never one of the last three.
// (0.9.7: now and then, while Pip is out, a close-up of Pip over it for 8 to 12 s, most of the time during Pip's show: pipShotPose, 07i-drone.js.
// 0.9.7 review, owner: slow and smooth, only while Pip does something calm near the ship and is barely moving: pipShotOk(true))
function nextShot(){
  if (rideStill()) return startShot('still');
  if (RIDE.queue.length) return startShot(RIDE.queue.shift());
  const pip = S_.act && S_.act.kind === 'probe', L = (RIDE.epic ? EPIC : MOVING).filter(n => !RIDE.last.includes(n) && (!pip || NEAR.has(n)));
  startShot(L[Math.floor(rideR()*L.length)]);
  // (only over a shot close by, and from about its own bearing, so the close-up is a slow push in rather than a swing round the ship)
  if (!RIDE.pip && NEAR.has(RIDE.shot.name) && pipShotOk(true) && rideR() < (pip ? 0.85 : 0.4)){
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
  const S = S_, ph = S.phase;
  // (the chase pose between places: in light speed and the fold, for the last seconds before a jump, and while the hull forms after a fold.
  // A fold's wind-up (9 s) takes the last 7.5 of them: 0.9.7 review, it took the chase pose the moment the wind-up began, swinging round at up to
  // 180 degrees a second with 9 s still to go)
  const leaving = ph === 'align' ? 1 - smooth(1.2, S.next && S.next.mode === 'fold' ? 7.5 : 5.5, S.jumpAt - S.t) : 0;
  const want = ph === 'light' || ph === 'fold' || S.asm < FLK.A1 + 0.3 ? 1 : leaving;
  // (on a spring, 0.9.7 review: the swing into the chase pose and back out starts and ends gently, about 3 s long, and begins up to 5.5 s before a
  // jump; eased the old way it set off at full speed, up to 120 degrees a second when the ship left soon after the stay ended. What is left
  // of it after a short turn before a light-speed hop finishes in the first second of light speed)
  if (dt > 0) [RIDE.wc, RIDE.wcV] = spring1(RIDE.wc, RIDE.wcV, want, 1.7, dt); else { RIDE.wc = want; RIDE.wcV = 0; }
  RIDE.wc = clamp(RIDE.wc, 0, 1);
  if (want === 1 && RIDE.wc > 0.997){ RIDE.wc = 1; RIDE.wcV = 0; } if (want === 0 && RIDE.wc < 0.003){ RIDE.wc = 0; RIDE.wcV = 0; }
  // a new place: its first shot starts once the chase pose has handed over (the Halo tour's pull-back and push-in first)
  if (S.visits !== RIDE.visits && ph !== 'light' && ph !== 'fold'){ RIDE.visits = S.visits; RIDE.queue = RIDE.epic && !rideStill() ? ['reveal', 'pushin'] : []; RIDE.shot = null; }
  // (Pip's close-up glides in over about 2.5 s, and out again as slowly when it is over or no longer suits what Pip does, on a spring: the camera
  // starts and stops moving gently. It frames a point that follows Pip on a softer spring (pipL, ship axes), so when Pip darts off the camera
  // drifts after it rather than whipping round: before the 0.9.7 review it followed Pip itself, and turned at up to 1200 degrees a second)
  if (RIDE.pip){ RIDE.pip.t += dt; if (RIDE.pip.t > RIDE.pip.T || !pipShotOk() || RIDE.job || rideStill() || RIDE.wc > 0.5) RIDE.pip = null; }
  if (dt > 0) [RIDE.pk, RIDE.pkV] = spring1(RIDE.pk, RIDE.pkV, RIDE.pip ? 1 : 0, 2.2, dt);
  if (!RIDE.pip && RIDE.pk < 0.003 && Math.abs(RIDE.pkV) < 0.01){ RIDE.pk = 0; RIDE.pkV = 0; }
  RIDE.pk = clamp(RIDE.pk, 0, 1);
  if (RIDE.pk > 0 && PIP.anc){ if (!RIDE.pipL){ RIDE.pipL = PIP.anc.slice(); RIDE.pipLV = [0, 0, 0]; } else if (dt > 0) [RIDE.pipL, RIDE.pipLV] = spring3(RIDE.pipL, RIDE.pipLV, PIP.anc, 1.8, dt); }
  else if (!RIDE.pip){ RIDE.pipL = null; }
  if (!RIDE.shot){ if (RIDE.wc < 1) nextShot(); return; }
  if (RIDE.wc >= 1) return;   // (the shot waits while the chase pose has the camera)
  RIDE.t += dt; RIDE.tr += dt;
  // a job gets its own shot, held until it is done; then the shots go on
  const A = S.act, jk = A && JOB_SHOT[A.kind] && !rideStill() ? A : !A && S.phase === 'pass' && S.plan.sig && !rideStill() ? S.plan : null;
  if (jk && RIDE.job !== jk){ RIDE.job = jk; startShot(null, JOB_SHOT[jk.sig ? 'sig' : jk.kind]); return; }
  if (!jk && RIDE.job){ RIDE.job = null; nextShot(); return; }
  if (rideStill() !== (RIDE.shot.name === 'still') && !jk){ nextShot(); return; }
  // (0.9.7 review: not while Pip plays peekaboo or rides along beside the camera, made for this shot: it holds its end until Pip is done)
  if (!jk && RIDE.t >= RIDE.shot.T && !pipCamBit()) nextShot();
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
// the pose riding along: the shot (with Pip's close-up blended over it), blended into the chase pose between places. (0.9.7 review: the eye moves
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
function blendPose(P, C, w, key){
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
function ridePose(){
  const C = chasePose(); if (!rideOn() || RIDE.wc >= 1 || !S_.target) return C;
  let P = shotPose(shotP());
  if (RIDE.pk > 0 && RIDE.pipL) P = blendPose(P, pipShotPose(RIDE.pipG, RIDE.pipL), smooth(0, 1, RIDE.pk), 'pip');
  return RIDE.wc <= 0 ? P : blendPose(P, C, RIDE.wc, 'chase');
}
// how far the camera may be from the ship right now (tests: a camera that lost the ship would be far beyond this)
function rideReach(){ const P = RIDE.shot ? Math.max(RIDE.shot.a.d, RIDE.shot.z.d, RIDE.from ? RIDE.from.d : 0) : 0; return Math.max(P*shipCam.zoom*Math.max(1, 0.62/tanX), V.len(SHIP_POSE.chase.eye)*shipCam.zoom)*ship.rad; }
// riding starts: the first shot is made now, so the flight up to the ship lands on it
function rideStart(){ RIDE.shot = null; RIDE.from = null; RIDE.job = null; RIDE.last.length = 0; RIDE.queue = []; RIDE.visits = S_.visits; RIDE.F = null; RIDE.pip = null; RIDE.pk = RIDE.pkV = 0; RIDE.pipL = null; rideFrame(0);
  const between = S_.phase === 'light' || S_.phase === 'fold' || S_.fk > -90 || S_.asm < FLK.A1 + 0.3; RIDE.wc = between ? 1 : 0; RIDE.wcV = 0;
  if (!between) startShot(rideStill() ? 'still' : 'shoulder');
  // (the Halo tour: a moment after landing, the pull-back that shows the place, and back in)
  if (RIDE.epic && !rideStill()){ RIDE.queue = ['reveal', 'pushin']; if (RIDE.shot) RIDE.shot.T = 2.5; } }
// the Halo tour's state (its logic is in 09t-halotour.js; kept here so the interface code, which loads before it, can read it)
const HT = { on:false, tourId:'grand', stops:[], i:0, want:null, visits:-1, capT:0, STAY:[55, 70] };

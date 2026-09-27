
// ================================================================ Pip, the Halo's little drone (made up, like the ship). Review build: three looks, ?drone=a|b|c.
// It lives in the belly bay. On a probe job (ACT.probe in 07h-halo.js) it pops out, says hello to the camera, glances at the ship and then at
// the body, flies there, hovers taking pictures while it looks at what it photographs, flies home and docks. Near a black hole or a magnetar
// it stays by the ship. It is a small volume of its own (FS_DRONE; its body about 400 m across in a 600 m sphere), drawn right after the ship (ship.drawAfter) so the hull
// never covers it by mistake, and hidden wherever the hull or the body is in front of it (volumes have no depth test). Far away it is a steady
// ice-blue glint. Its controller is drone.ctl, called from ship.update only (an object's own update would run it a second time each tick), and
// its dice come from lcg, never hrnd, so the Halo's route stays the same. This file must load after 07h-halo.js (it uses S_, HULL, ACT).
const FS_DRONE_BODY = `
// Local frame: bounding sphere 1, +y the way it looks (its eye), +z up, x across. LOOK 1 eye-pod: a black egg with one big eye, two tiny
// crescent fins (the ship's arms in miniature), an antenna and a thruster ring. LOOK 2 little Halo: a round pod whose eye sits inside a ring of
// lights, like the ship's heart inside its dotted rings. LOOK 3 firefly: a teardrop with a big eye, its tail end glowing like a firefly's
// lantern and streaming light behind it.
// uP0: x the eye open (0 shut, 1 open), y the iris's glow (1; above 1 it flashes white for a picture), z the thruster, w mood (> 0 a happy
// squint, < 0 narrowed)   uP1: xyz the light's direction (world), w unfold (the fins, wings and antenna tuck in when it is stowed)
// uP2: xy where the pupil looks (in the eye's plane, -1..1), z the antenna's wink, w the lens lamp   uP3: rgb the iris's colour
// uM0 column 0: its scale (it pops out of the bay small), B's ring phase, C's tail length
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/max(k1, 1e-5); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
// a round cone: a sphere r1 at a narrowing to r2 at b
float sdRC(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr*rr, il2 = 1./l2;
  vec3 pa = p - a; float y = dot(pa, ba), z = y - l2; vec3 xv = pa*l2 - ba*y; float x2 = dot(xv, xv), y2 = y*y*l2, z2 = z*z*l2, k = sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2;
  if(sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1;
  return (sqrt(x2*a2*il2) + y*rr)*il2 - r1;
}
float sq(float x){ return x*x; }
float lampD(vec3 o, vec3 d, vec3 c, float s, float front){ return dot(c - o, d) < front ? pblob(o, d, c, s) : 0.; }
// the eye: a glass dome on the front (centre EC, half sizes ED), with a silver bezel round it; NZ the thruster's nozzle
#if LOOK == 1
const vec3 EC = vec3(0., 0.355, 0.1), ED = vec3(0.235, 0.09, 0.235), NZ = vec3(0., -0.42, -0.03);
#elif LOOK == 2
const vec3 EC = vec3(0., 0.345, 0.03), ED = vec3(0.24, 0.09, 0.24), NZ = vec3(0., -0.39, 0.);
#else
const vec3 EC = vec3(0., 0.445, 0.08), ED = vec3(0.23, 0.085, 0.23), NZ = vec3(0., -0.55, 0.02);
#endif
float gId = 0.;
float map(vec3 p){
  float u = uP1.w, d, fin = 1e9, trim = 1e9;
#if LOOK == 1
  // an egg, its top a little fuller, with two swept fins and an antenna; a ring round the thruster at the back
  vec3 q = p - vec3(0., 0., -0.03); float tq = 1. + 0.12*clamp(q.z/0.54, -1., 1.);
  d = sdEll(vec3(q.xy/tq, q.z), vec3(0.42, 0.4, 0.54))*0.85;
  vec3 pf = vec3(abs(p.x), p.y, p.z), f0 = vec3(0.37, 0.02, 0.02), f1 = vec3(0.41 + 0.15*u, -0.1 - 0.05*u, 0.09 + 0.05*u), f2 = vec3(0.43 + 0.17*u, -0.19 - 0.15*u, 0.19 + 0.11*u);
  fin = min(sdCap(pf, f0, f1, 0.03), sdCap(pf, f1, f2, 0.021));
  fin = min(fin, sdCap(p, vec3(0., -0.06, 0.47), vec3(0., -0.12, 0.51 + 0.17*u), 0.016));
  trim = length(vec2(length(p.xz - vec2(0., -0.03)) - 0.14, p.y + 0.385)) - 0.028;
#elif LOOK == 2
  // a round pod (its ring of lights is drawn as light, below)
  d = sdEll(p, vec3(0.4, 0.38, 0.36))*0.95;
  trim = length(vec2(length(p.xz) - 0.12, p.y + 0.365)) - 0.024;
#else
  // a teardrop, its point aft, with two little wings on its back and two feelers curling up from its head
  d = sdRC(p, vec3(0., 0.14, 0.04), vec3(0., -0.5, 0.02), 0.34, 0.06);
  vec3 pw = vec3(abs(p.x), p.y, p.z), a1 = vec3(0.1 + 0.08*u, 0.3 + 0.06*u, 0.4 + 0.14*u);
  fin = min(sdCap(pw, vec3(0.1, 0.02, 0.3), vec3(0.2 + 0.1*u, -0.16 - 0.08*u, 0.35 + 0.05*u), 0.02), min(sdCap(pw, vec3(0.06, 0.26, 0.3), a1, 0.013), sdCap(pw, a1, a1 + vec3(0.07, 0.03, -0.02)*u, 0.013)));
#endif
  float eye = sdEll(p - EC, ED)*0.9;
  float bez = length(vec2(length(vec2(p.x, p.z - EC.z)) - ED.x - 0.006, p.y - EC.y + 0.004)) - 0.022;
  gId = 0.;
  if(fin < d){ d = fin; gId = 3.; }
  float tr = min(trim, bez); if(tr < d){ d = tr; gId = 2.; }
  if(eye < d){ d = eye; gId = 1.; }
  return d;
}
vec3 nrmD(vec3 p){ const vec2 k = vec2(1., -1.); const float e = 0.002; return normalize(k.xyy*map(p + k.xyy*e) + k.yyx*map(p + k.yyx*e) + k.yxy*map(p + k.yxy*e) + k.xxx*map(p + k.xxx*e)); }
void main(){
  vec3 o, d; localRay(o, d);
  o /= max(uM0[0].x, 0.05);
  vec2 hb = sphIsect(o, d, vec3(0.), 0.8);
  vec3 L = normalize(uP1.xyz*uRot), ice = vec3(0.6, 0.83, 1.), silver = vec3(0.85, 0.9, 1.), white = vec3(1.);
  float tm = uTime, t = max(hb.x, 0.), id = 0.; bool hit = false;
  int N = int(mix(28., 48., uLod));
  if(hb.y > 0.) for(int i=0;i<48;i++){ if(i >= N) break; float h = map(o + d*t); if(h < 0.0015){ hit = true; id = gId; break; } t += h; if(t > hb.y) break; }
  vec3 col = vec3(0.), irisC = mix(uP3.rgb, white, clamp(uP0.y - 1., 0., 1.)); float alpha = 0.;
  if(hit){
    vec3 p = o + d*t, n = nrmD(p);
    float dif = max(dot(n, L), 0.), mu = max(dot(n, -d), 0.), rim = pow(1. - mu, 2.2);
    float spec = pow(max(dot(n, normalize(L - d)), 0.), 40.);
    // black lacquer with a faint grain, like the ship's hull, and a silver rim all round its outline (whatever side the Sun is on), so even a
    // small Pip shows its shape against black space: a black silhouette, a silver outline, one blue eye
    vec3 hull = vec3(0.075, 0.08, 0.095)*(0.85 + 0.3*ridge(p*14.)), body = hull*(dif*1.3 + 0.2) + silver*(spec*1.2 + rim*1.3);
    col = body;
    if(id > 2.5) col = hull*(dif*1.3 + 0.4) + silver*(0.25 + 1.2*rim + spec);               // fins, antenna, wings
    else if(id > 1.5) col = silver*(0.4 + 0.9*dif + 0.9*rim) + white*spec;                 // the bezel and the thruster ring
    else if(id > 0.5){
      // the eye. Lids close it to a slit when it blinks; a happy squint bends it into an arch (^); narrowed, both lids close in a little
      vec2 e = vec2(p.x, p.z - EC.z)/ED.x;
      float mood = uP0.w, hm = max(mood, 0.), top = mix(-0.1, 1.05, uP0.x)*(1. + 0.5*min(mood, 0.));
      float c = hm*(0.32 - 0.8*e.x*e.x), hw = mix(top, 0.22*uP0.x, hm), lid = smoothstep(hw + 0.08, hw - 0.08, abs(e.y - c));
      // (the iris: a bright ice-blue ring round a deeper blue, a dark pupil, a white catchlight; saturated, so even one character of it reads blue)
      vec2 pp = uP2.xy*0.32; float di = length(e - pp);
      float iris = smoothstep(0.68, 0.56, di)*(1. - 0.9*smoothstep(0.3, 0.2, di)), ringI = exp(-sq((di - 0.52)/0.1));
      vec2 cq = e - pp - vec2(-0.26, 0.3); float cat = exp(-dot(cq, cq)/0.012);
      vec3 eyeC = vec3(0.02, 0.035, 0.07) + silver*spec*0.8 + (irisC*vec3(0.55, 0.8, 1.)*iris*1.1 + irisC*ringI*1.3)*uP0.y + white*cat*1.4*uP0.x;
      col = mix(body + silver*0.4*exp(-sq((abs(e.y - c) - hw)/0.07)), eyeC, lid);
    }
#if LOOK == 1
    if(id < 0.5) col += silver*exp(-sq((p.z + 0.12)/0.012))*(0.3 + 0.5*dif);   // a silver seam round its waist
#elif LOOK == 3
    // its lantern: the tail end glows, breathing slowly, brighter as it flies
    if(id < 0.5) col += ice*smoothstep(-0.06, -0.36, p.y)*(0.75 + 0.25*sin(tm*(RM > 0 ? 1.2 : 2.6)))*(1.1 + 1.3*uP0.z);
#endif
    alpha = 1.;
  }
  float front = hit ? t : 1e9;
  // the eye's glow, so a small Pip still shows one bright blue character (only from in front, and only while it is small on screen)
  float face = smoothstep(0.05, 0.45, -d.y), small = smoothstep(0.06, 0.2, uPix*length(o));
  col += irisC*blob(o, d, EC + vec3(0., 0.07, 0.), 0.13)*0.7*uP0.y*max(uP0.x, 0.2)*face*small;
  // the lens lamp: light pouring out of the eye onto what it looks at
  if(uP2.w > 0.01) col += mix(ice, white, 0.5)*blob(o, d, EC + vec3(0., 0.24, 0.), 0.1)*uP2.w*face*1.4;
#if LOOK == 1
  col += white*lampD(o, d, vec3(0., -0.125, 0.53 + 0.17*uP1.w), 0.03, front + 0.02)*(6. + 24.*uP2.z);   // the antenna's lamp, winking now and then
#endif
#if LOOK == 2
  // the ring of lights round it, tilted a little, turning (like the ship's dotted rings round its heart); it hides behind the pod
  {
    const vec3 nr = vec3(0., -0.2474, 0.9689), ex = vec3(1., 0., 0.), ey = vec3(0., 0.9689, 0.2474);
    float dn = dot(d, nr);
    if(abs(dn) > 0.01){
      float tp = -dot(o, nr)/dn;
      if(tp > 0. && tp < front){
        vec3 pp = o + d*tp; float rr = length(pp), an = atan(dot(pp, ey), dot(pp, ex)), lw = max(0.02, uPix*tp*0.8);
        float ring = exp(-sq((rr - 0.63)/lw))*0.02/lw, dots = pow(0.5 + 0.5*cos(an*10. + uM0[0].y), 4.);
        col += (ice*dots*9. + silver*0.9)*ring;
      }
    }
  }
#endif
  // the thruster: a nozzle glow and a short plume that fades well inside the bounding sphere (C's tail is its firefly glow, longer as it flies)
  float th = uP0.z, behind = dot(NZ - o, d) > front ? 0.15 : 1.;   // (the body hides most of a plume behind it)
#if LOOK == 3
  float PL = 0.1 + 0.28*uM0[0].z;
  // (its lantern's glow spills round the body, so it shows even when Pip faces you)
  col += ice*blob(o, d, vec3(0., -0.33, 0.), 0.22)*(0.55 + 0.6*th)*(0.75 + 0.25*sin(tm*(RM > 0 ? 1.2 : 2.6)))*(1. - 0.75*alpha);
  col += jet(o - NZ, d, vec3(0., -1., 0.), PL, 0.035, 0.075, 0.4, tm*6., vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(3. + 10.*th)*behind;
#else
  float PL = 0.1 + 0.25*th;
  col += jet(o - NZ, d, vec3(0., -1., 0.), PL, 0.03, 0.06, 0.5, tm*6., vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(1. + 10.*th)*th*behind;
#endif
  col += mix(white, ice, 0.4)*lampD(o, d, NZ, 0.035, front + 0.02)*(2. + 7.*th);
  outCol(col, alpha);
}`;
const DRONE_LOOKS = { a:1, b:2, c:3 }, DRONE_NAMES = ['', 'Pip A · eye-pod', 'Pip B · little Halo', 'Pip C · firefly'];
const DRONE_Q = (new URLSearchParams(location.search).get('drone') || '').toLowerCase();
let droneLook = DRONE_LOOKS[DRONE_Q] || 1;
const droneProgs = [];
const droneProg = v => droneProgs[v] || (droneProgs[v] = program(VS_RECT, COMMON + `#define LOOK ${v}\n#define RM ${reduceMotion ? 1 : 0}\n` + FS_DRONE_BODY));
P.drone = droneProg(droneLook);

// ---------------------------------------------------------------- its state: where it is (ship-relative, world axes), where it looks, its face
// (st: 'stowed', 'out' on a job, 'pose' held by a test or a screenshot; kind: 'land' hovers over the ground or the cloud tops, 'star' keeps
// further off and squints, 'near' stays by the ship near a black hole or a magnetar, 'cloud' flies out toward the heart of a nebula or galaxy)
const ICE_P = [0.6, 0.83, 1];
const PIP = { st:'stowed', A:null, kind:'land', H:null, pos:[0, 0, 0], pupil:[0, 1, 0], body:[0, 1, 0], ax:[1, 0, 0], open:1, blinkIn:3, blinkT:9, glow:1, flash:0,
  thr:0, mood:0, unfold:0, scale:0.25, ring:0, tail:0.3, shots:0, nShots:5, at:[], lamp:0, px:0, pz:0, ant:0, iris:ICE_P.slice(), r:lcg(7), trail:[], trAcc:0,
  vis:0, pose:null, H2:null, hi:0, spot:null, alt:0.08, wd:null, wt:null, gas:false, minAlt:9 };
const DM0 = new Float32Array(9);
const drone = addObj({ key:'halo-drone', name:'Pip', label:'', type:"the Halo's little drone (made up)", group:'travel', layer:3, parent:ship, offset:[0, 0, 0], pos:[0, 0, 0],
  rad:0.12*ship.rad, prog:P.drone, selfPos:true, hidden:true, noPick:true, noLabel:true, noImpostor:true, atlas:false, noWaypoint:true,
  // (lit like the ship: by the Sun, or by the showcase's fixed light)
  setU(pr){ const S = ship.S, q = PIP, L = S.light ? M3.apply(ship.R0, V.norm(S.light)) : V.norm(V.sub(sun.rel, this.rel)), c = q.iris;
    gl.uniform4f(pr.u.uP0, q.open, q.glow, q.thr, q.mood); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], q.unfold);
    gl.uniform4f(pr.u.uP2, q.px, q.pz, q.ant, q.lamp); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], 0);
    DM0[0] = q.scale; DM0[1] = q.ring; DM0[2] = q.tail; gl.uniformMatrix3fv(pr.u.uM0, false, DM0); } });
drone.setLook = v => { if (!(v >= 1 && v <= 3)) return; droneLook = v; drone.prog = droneProg(v); progReady(drone.prog, true); };

// ---------------------------------------------------------------- the job's timeline (seconds after launch; ACTS.probe's timing is unchanged, so the route is too)
// pop out of the bay, say hello (looking at you, then at the ship), turn to the body, fly there, work, fly home, a happy look, dock
const PT = { POP:0.5, HI:1.1, SEE:1.45, TURN:1.75, GO:2.2, AT:4.4, WK:8.8, HM:10.4, DK:10.8, IN:11.9 };
const PB1 = [0.2, -0.1, 0];   // just under the bay (ship radii, ship axes: x the belly, y forward, z the side)
const pipKind = tg => isHoleTarget(tg) || RS_KM[tg.key] ? 'near' : !surfOf(tg) ? 'cloud' : tg === sun || tg.group === 'stars' ? 'star' : 'land';
const pipName = tg => tg.label && tg.label.length < tg.name.length && !/^the /.test(tg.name) ? tg.label : tg.name;
const backOut = x => { const y = x - 1; return 1 + 2.7*y*y*y + 1.7*y*y; };
function herm(a, ma, b, mb, D, u){ const u2 = u*u, u3 = u2*u; return V.add(V.add(V.mul(a, 2*u3 - 3*u2 + 1), V.mul(ma, (u3 - 2*u2 + u)*D)), V.add(V.mul(b, -2*u3 + 3*u2), V.mul(mb, (u3 - u2)*D))); }
function pipPlan(A){
  const q = PIP, tg = A.tg, pl = A.pl;
  q.A = A; q.kind = pipKind(tg); q.shots = 0; q.hi = 0; q.trail.length = 0; q.H = null; q.spot = null; q.minAlt = 9;
  q.r = lcg(pl.seed*17 + 3);
  q.at = q.kind === 'near' ? [3.2, 5.6, 8.0] : [4.9, 5.7, 6.5, 7.3, 8.1]; q.nShots = q.at.length;
  q.gas = tg.key === 'jupiter' || tg.key === 'saturn';
  if (q.kind === 'land' || q.kind === 'star'){
    // it works over the point under the ship halfway through its work, sweeping a little along the ship's track; its height from the drawn
    // surface (planets are enlarged in the Solar System overview), at least three of its own radii (Halley's nucleus is small)
    const m = passAt(pl, A.t0 + (PT.AT + PT.WK)/2); q.wd = V.norm(m.p); q.wt = V.norm(perpTo(m.h, q.wd));
    q.alt = q.kind === 'star' ? 0.3 : Math.max(0.08, 3*drone.rad/Math.max(surfOf(tg), 1e-300));
  }
}
// the spot it says hello from and comes home to. With the camera near the ship it is a spot in the camera's frame (c: right and up as shares of
// the view, and how far ahead), so Pip hovers where you can see it even while the camera turns toward the work: a little off to the side the
// ship banks toward and below the middle, 1.4 ship radii away (at most halfway to the ship); on a phone, where the ship is wider than the
// screen, 1 ship radius away in the sky above it; on the bridge (the camera inside the ship's sphere), 1.3 ship radii ahead and a little above
// the horizon, clear of the needle below it. The first such spot that the hull does not hide, with a margin (the hull's outline in behindHull
// is rough). With the camera far away, a spot beside the belly pod (l: ship axes, ship radii).
function pipHello(){
  const sd = S_.side, sp = camNear() ? V.len(ship.rel) : -1;
  if (sp >= 0){
    const bridge = sp < ship.rad, D = bridge ? 1.3*ship.rad : Math.min((isCompact() ? 1 : 1.4)*ship.rad, sp*0.5), m = ship.rad*0.15;
    const C = bridge ? [[0.4*sd, 0.12], [-0.4*sd, 0.12], [0.2*sd, 0.35]] : isCompact() ? [[0.3*sd, 0.3], [-0.3*sd, 0.3], [0.3*sd, 0.45]] : [[0.42*sd, -0.16], [0.42*sd, 0.14], [-0.42*sd, -0.16], [0.25*sd, 0.35]];
    for (let i=0;i<C.length;i++){
      const h = { c:[C[i][0], C[i][1], D] }, p = camSpot(h.c);
      if (i === C.length - 1 || (!behindHull(p) && !behindHull(V.sub(p, V.mul(cam.up, m))) && !behindHull(V.sub(p, V.mul(cam.right, m*Math.sign(h.c[0])))))){ spotLocal(h); return h; }
    }
  }
  return { l:[0.2, 0.3, 0.5*sd] };
}
const camSpot = c => V.add(V.add(V.mul(cam.right, c[0]*c[2]*tanX), V.mul(cam.up, c[1]*c[2]*tanY)), V.mul(cam.fwd, c[2]));   // (camera-relative)
// the spot in ship axes and ship radii, from where the camera is now (while it stays near the ship; otherwise where it was last)
function spotLocal(h){ if (h.c && camNear()) h.l = M3.applyT(ship.R0, V.mul(V.sub(camSpot(h.c), ship.rel), 1/ship.rad)); return h.l; }
// where it works, relative to the ship (world axes), at time u after launch, and how fast that spot moves relative to the ship
function pipWork(q, u){
  const A = q.A, tg = A.tg;
  if (q.kind === 'land' || q.kind === 'star'){
    const ps = passAt(A.pl, A.t0 + u), sw = 0.06*Math.sin(2*Math.PI*clamp((u - PT.AT)/(PT.WK - PT.AT), 0, 1));
    const W = V.mul(V.norm(V.add(q.wd, V.mul(q.wt, sw))), surfDrawn(tg)*(1 + q.alt));
    return { r:V.sub(W, ps.p), m:V.mul(ps.h, -ps.v) };
  }
  const H = localPt(q.H.l);
  // (near a black hole or a magnetar: closer in to the ship, inside its shield, a little toward the pull)
  if (q.kind === 'near') return { r:V.add(V.mul(H, 0.55), V.mul(V.norm(V.mul(ship.offset, -1)), ship.rad*0.2)), m:[0, 0, 0] };
  // a cloud: out ahead toward its heart (moving with the ship: the ship crosses a nebula or a galaxy far too fast to leave it behind)
  return { r:V.add(H, V.mul(V.norm(V.mul(ship.offset, -1)), ship.rad*14)), m:[0, 0, 0] };
}
function pipPos(q, u){
  const H = q.H.l, Z = [0, 0, 0];
  if (u < PT.POP) return localPt(V.lerp(HULL.bay, PB1, smooth(0, PT.POP, u)));
  if (u < PT.HI){ const s = smooth(PT.POP, PT.HI, u); return localPt(V.add(V.lerp(PB1, H, s), [0.12*Math.sin(Math.PI*s), 0, 0])); }
  if (u < PT.GO) return localPt(H);
  if (u < PT.AT){ const a = localPt(H), w = pipWork(q, PT.AT); return herm(a, V.mul(V.sub(w.r, a), 0.25/(PT.AT - PT.GO)), w.r, w.m, PT.AT - PT.GO, (u - PT.GO)/(PT.AT - PT.GO)); }
  if (u < PT.WK) return pipWork(q, u).r;
  const H2 = q.H2 ? q.H2.l : H;   // (home: a spot picked afresh as it sets off back)
  if (u < PT.HM){ const w = pipWork(q, PT.WK); return herm(w.r, w.m, localPt(H2), Z, PT.HM - PT.WK, (u - PT.WK)/(PT.HM - PT.WK)); }
  if (u < PT.DK) return localPt(H2);
  if (u < 11.5){ const s = smooth(PT.DK, 11.5, u); return localPt(V.add(V.lerp(H2, PB1, s), [0.12*Math.sin(Math.PI*s), 0, 0])); }
  return localPt(V.lerp(PB1, HULL.bay, smooth(11.5, PT.IN, u)));
}
// hidden from the camera by the hull, or by the body it visits (camera-relative p)
function pipHidden(p){
  if (behindHull(p)) return true;
  const tg = PIP.A && PIP.A.tg; if (!tg || PIP.st === 'pose') return false;
  const sp = aimSphere(tg); return (sp.solid || sp.hole) && behindSphere(p, tg.rel, sp.r*0.998);
}
// a small puff of ice-blue grains at the bay (launch and docking)
function pipPuff(n){
  const g = []; for (let i=0;i<n;i++) g.push(V.mul(rdir(PIP.r), ship.rad*(0.2 + 0.4*PIP.r())));
  fxAdd({ T:0.6, base:localPt(HULL.bay), drift:[0, 0, 0], draw(e){ const f = 1 - e.t/e.T; for (const v of g){ const p = V.sub(V.add(ship.rel, V.add(e.base, V.mul(v, e.t))), e.drift); if (!behindHull(p)) P_(p, ICE_P, 0.7*f, -2); } } });
}
// a picture: a white flash at Pip (kept relative to the ship, drifting back as the ship moves on) and, over the ground, on the spot it lights
function pipFlash(q, pos){
  const tg = q.A.tg, spot = q.spot ? q.spot.slice() : null, sz = surfDrawn(tg)*0.02;
  fxAdd({ T:0.3, q:pos.slice(), drift:[0, 0, 0], anc:tg, draw(e){ const f = 1 - e.t/e.T, p = V.sub(V.add(ship.rel, e.q), e.drift);
    if (!pipHidden(p)){ P_(p, WHITE, 3*f*f, -8); P_(p, [0.85, 0.92, 1], 0.7*f, -16); }
    if (spot){ const s = V.add(e.anc.rel, spot); if (!behindSphere(s, e.anc.rel, surfDrawn(e.anc)*0.998)) P_(s, [0.8, 0.9, 1], 1.1*f, sz); } } });
}
function pipStow(){ const q = PIP; q.st = 'stowed'; q.trail.length = 0; q.spot = null; q.lamp = 0; q.flash = 0; q.vis = 0; }
// ---------------------------------------------------------------- each tick, from ship.update (only there)
drone.ctl = dt => {
  const q = PIP;
  q.ring = (q.ring + dt*(reduceMotion ? 0.5 : 1.2 + 3*q.thr)) % 6.2831853;
  if (q.pose){ pipPose(q.pose); return; }
  const A = S_.act && S_.act.kind === 'probe' && S_.phase === 'pass' ? S_.act : null;
  if (!A){ if (q.st !== 'stowed') pipStow(); q.A = null; return; }
  const u = S_.t - A.t0;
  if (q.A !== A){ if (u < -0.6) return; pipPlan(A); }
  // the bay lamp (ice blue now, never green): on as the bay opens, a blink as it closes
  S_.em[3] = Math.max(S_.em[3], smooth(-0.4, -0.1, u)*(1 - smooth(0.3, 0.6, u)), Math.exp(-(((u - 11.95)/0.1)**2)));
  if (u < 0 || u >= PT.IN){ if (q.st !== 'stowed'){ if (u >= PT.IN) pipPuff(6); pipStow(); } return; }
  if (q.st === 'stowed'){
    q.st = 'out'; q.H = pipHello(); q.H2 = null; if (u < 0.3) pipPuff(8);
    const f = V.norm(V.mul(V.add(ship.rel, localPt(HULL.bay)), -1)); q.pupil = f; q.body = f; q.blinkIn = 1.6 + q.r(); q.flash = 0; q.thr = 0.4; q.mood = 0;
  }
  if (u >= PT.WK && !q.H2) q.H2 = pipHello();
  spotLocal(q.H); if (q.H2) spotLocal(q.H2);
  // (a trail while it flies: at most 6 fading points, fixed where they were left)
  for (const t of q.trail){ t.age += dt; t.r = V.sub(t.r, V.mul(S_.vel, dt)); }
  while (q.trail.length && q.trail[0].age > 0.5) q.trail.shift();
  let pos = pipPos(q, u);
  const tg = A.tg, up = V.norm(localPt([-1, 0, 0])), land = q.kind === 'land' || q.kind === 'star';
  // (never below the drawn surface on its way down or back up)
  if (land && u > PT.GO && u < PT.HM){ const tp = V.add(ship.offset, pos), r = V.len(tp), rmin = surfDrawn(tg)*(1 + 0.5*q.alt); if (r < rmin) pos = V.sub(V.mul(tp, rmin/r), ship.offset); }
  // hovering, it bobs a little; near a black hole it jitters
  const hover = smooth(0.5, 0.9, u)*(1 - smooth(1.9, 2.3, u)) + smooth(PT.AT - 0.2, PT.AT + 0.4, u)*(1 - smooth(PT.WK - 0.3, PT.WK, u)) + smooth(PT.HM - 0.3, PT.HM, u)*(1 - smooth(PT.DK, PT.DK + 0.3, u));
  pos = V.add(pos, V.mul(up, drone.rad*(reduceMotion ? 0.06 : 0.15)*Math.sin(drone.t*3.77)*hover));
  if (q.kind === 'near' && u > PT.TURN && u < PT.WK && !reduceMotion){ const j = drone.rad*0.03, w = drone.t*113; pos = V.add(pos, [j*Math.sin(w), j*Math.sin(w*1.31 + 1), j*Math.sin(w*0.77 + 2)]); }
  if ((u > PT.GO && u < PT.AT) || (u > PT.WK && u < PT.HM)){ q.trAcc += dt; if (q.trAcc > 0.08){ q.trAcc = 0; q.trail.push({ r:pos.slice(), age:0 }); if (q.trail.length > 6) q.trail.shift(); } }
  q.pos = pos; drone.offset = pos; drone.pos = V.add(ship.pos, pos);
  if (land){ const r = V.len(V.add(ship.offset, pos))/surfDrawn(tg) - 1; if (u > PT.GO && u < PT.HM) q.minAlt = Math.min(q.minAlt, r); }
  // where it looks: at you as it says hello (or at the bridge when no one is riding along), at the ship, then at the body; over the ground a
  // little ahead along the track (where its lamp falls), at a star's middle, at a black hole or a nebula's heart; home to the ship, a happy
  // look at you, then at the bay
  const toCam = V.norm(V.mul(V.add(ship.rel, pos), -1)), toBridge = V.norm(V.sub(localPt([-0.06, 0.03, 0]), pos)), toTg = V.norm(V.mul(V.add(ship.offset, pos), -1));
  let want;
  if (u < PT.SEE) want = camNear() ? toCam : toBridge;
  else if (u < PT.TURN) want = toBridge;
  else if (u < PT.WK){
    if (q.kind === 'land') want = u < PT.AT ? V.norm(V.sub(pipWork(q, PT.AT).r, pos)) : V.norm(V.add(toTg, V.mul(q.wt, 0.55)));
    else want = toTg;
  } else if (u < PT.HM - 0.3) want = V.norm(V.mul(pos, -1));
  else if (u < 11.2) want = camNear() ? toCam : toBridge;
  else want = V.norm(V.sub(localPt(HULL.bay), pos));
  // the pupil darts first, the body follows
  q.pupil = slerpDir(q.pupil, want, 1 - Math.exp(-dt/0.08));
  q.body = slerpDir(q.body, q.pupil, 1 - Math.exp(-dt/0.35));
  // blinks: every 2.5 to 4.5 s, and twice as it says hello
  q.blinkIn -= dt; if (q.blinkIn <= 0){ q.blinkT = 0; q.blinkIn = 2.5 + 2*q.r(); }
  if (u > 0.95 && q.hi < 1){ q.hi = 1; q.blinkT = 0; } if (u > 1.17 && q.hi < 2){ q.hi = 2; q.blinkT = 0; }
  q.blinkT += dt; const bk = q.blinkT < 0.16 ? Math.sin(Math.PI*q.blinkT/0.16) : 0;
  q.open = clamp(1 - 1.15*bk, 0, 1);
  // its mood: a happy squint as it comes home to you; narrowed near a black hole; squinting at a star
  let mood = smooth(PT.HM - 0.25, PT.HM + 0.05, u)*(1 - smooth(PT.DK, PT.DK + 0.25, u));
  if (q.kind === 'near' && u > PT.TURN && u < PT.WK) mood = -0.4;
  if (q.kind === 'star' && u > 2.6 && u < PT.WK) mood = -0.6*smooth(2.6, 3.4, u);
  q.mood += (mood - q.mood)*(1 - Math.exp(-dt*8));
  // pictures: a flash of its eye and a flash at it; over the ground its lamp lights a spot where it looks
  q.spot = null;
  if (q.kind === 'land' && u > PT.AT - 0.3 && u < PT.WK){ const C = tg.rel, dc = V.add(ship.rel, pos), t = raySphere(dc, q.pupil, C, surfDrawn(tg)); if (t > 0) q.spot = V.sub(V.add(dc, V.mul(q.pupil, t)), C); }
  while (q.shots < q.nShots && u >= q.at[q.shots]){ q.shots++; q.flash = 1; pipFlash(q, pos); }
  q.flash = Math.max(0, q.flash - dt/0.2);
  q.lamp = q.kind === 'land' ? smooth(PT.AT - 0.3, PT.AT + 0.3, u)*(1 - smooth(PT.WK - 0.3, PT.WK, u)) : 0;
  q.glow = 1 + 0.3*q.lamp + 2.4*q.flash;
  // the thruster: a flare as it sets off, cruising, braking; the rest of the time a low idle
  let th = 0.2;
  if (u < PT.POP) th = 0.45;
  else if (u > 1.9 && u < PT.AT) th = u < 2.7 ? 0.3 + 0.7*smooth(1.9, 2.2, u) : u < 3.9 ? 0.75 : 0.4;
  else if (u > PT.WK && u < PT.HM) th = u < 9.3 ? 0.9 : u < 10.1 ? 0.7 : 0.35;
  else if (u > PT.DK) th = 0.3;
  if (q.kind === 'near') th *= 0.5;
  q.thr += (th - q.thr)*(1 - Math.exp(-dt*6)); q.tail += (0.35 + 0.65*q.thr - q.tail)*(1 - Math.exp(-dt*4));
  // it pops out small with a little overshoot, unfolding its fins, and shrinks back into the bay
  q.unfold = smooth(0.08, 0.45, u)*(1 - smooth(11.2, 11.7, u));
  q.scale = u < PT.POP ? 0.25 + 0.75*backOut(u/PT.POP) : 1 - 0.75*smooth(11.55, PT.IN, u);
  const ph = (drone.t*0.62) % 1; q.ant = ph < 0.08 ? Math.sin(Math.PI*ph/0.08) : 0;
  // (squinting at a star, its iris takes on the star's colour)
  const fc = tg.farColor || ICE_P, mx = Math.max(fc[0], fc[1], fc[2], 1e-3), ks = q.kind === 'star' ? 0.7*smooth(2.6, 3.6, u)*(1 - smooth(PT.WK, PT.WK + 0.8, u)) : 0;
  q.iris = V.lerp(ICE_P, [fc[0]/mx, fc[1]/mx, fc[2]/mx], ks);
  pipOrient(q, up, Math.max(q.mood, 0));
};
// its frame from where it looks (+y) and the ship's up (+z), rolling in a little wiggle when it is happy; and where the pupil sits in the eye
function pipOrient(q, up, happy){
  let ax = V.cross(q.body, up); ax = V.len(ax) > 0.2 ? V.norm(ax) : q.ax; q.ax = ax;
  let R = frameY(q.body, ax);
  const roll = reduceMotion ? 0 : 0.3*Math.sin(drone.t*13)*happy;
  if (roll) R = M3.mul(R, M3.rotY(roll));
  drone.rot = drone.R0 = R;
  const lp = M3.applyT(R, q.pupil); q.px = clamp(lp[0]/0.55, -1, 1); q.pz = clamp(lp[2]/0.55, -1, 1);
}
// held still for a test or a screenshot: at a spot in the ship's frame (at, ship radii) or in the camera's (cam: right, up, ahead, ship radii),
// looking at the camera (look: a turn of the gaze right and up; eyes: only the pupil turns), with a given face
function pipPose(o){
  const q = PIP; q.st = 'pose';
  const pos = o.cam ? V.add(V.mul(ship.rel, -1), V.mul(V.add(V.add(V.mul(cam.right, o.cam[0]), V.mul(cam.up, o.cam[1])), V.mul(cam.fwd, o.cam[2])), ship.rad)) : localPt(o.at || [0.12, -1.3, 0.6]);
  q.pos = pos; drone.offset = pos; drone.pos = V.add(ship.pos, pos);
  const toCam = V.norm(V.mul(V.add(ship.rel, pos), -1)), lk = o.look || [0, 0];
  const want = V.norm(V.add(toCam, V.add(V.mul(cam.right, lk[0]), V.mul(cam.up, lk[1]))));
  q.pupil = want; q.body = o.eyes ? toCam : want;
  q.open = o.open ?? 1; q.mood = o.mood ?? 0; q.glow = o.glow ?? 1; q.thr = o.thr ?? 0.25; q.lamp = o.lamp ?? 0; q.scale = o.scale ?? 1; q.unfold = o.unfold ?? 1;
  q.ant = o.ant ?? 0; q.iris = o.iris || ICE_P; q.tail = 0.35 + 0.65*q.thr;
  pipOrient(q, V.norm(localPt([-1, 0, 0])), Math.max(q.mood, 0));
}
// how much of its volume shows (a glint takes over below about 3.5 pixels), 0 where the hull or the body is in front of it
function pipVis(){
  const q = PIP; if (q.st === 'stowed' || !progReady(drone.prog)) return 0;
  const rpx = drone.rad*q.scale/Math.max(drone.dist, 1e-300)*sceneH*0.5/tanY;
  return smooth(1.5, 3.5, rpx)*(pipHidden(drone.rel) ? 0 : 1);
}
// drawn straight after the ship's own volume, so the hull never paints over it (the two share one bounding sphere, and volumes are sorted only by
// their centres); where the hull is really in front of it, it is hidden instead
ship.drawAfter = () => { const v = pipVis(); PIP.vis = v; if (v > 0.003) drawVolume(drone, drone.prog, drone.rel, drone.rad, pr => drone.setU(pr), drone.rot, v); };
// the rest of it, with the ship's effects (haloDraw): the glint far away, its trail, the spot its lamp lights on the ground
function pipDraw(){
  const q = PIP; if (q.st === 'stowed') return;
  const v = pipVis(), p = drone.rel;
  if (!pipHidden(p) && v < 0.999 && V.dot(p, cam.fwd) > 0) P_(p, [0.62, 0.86, 1], (0.9 + 0.4*q.thr)*(1 - v)*(0.4 + 0.6*q.scale), -3);
  for (const t of q.trail){ const pp = V.add(ship.rel, t.r), f = 1 - t.age/0.5; if (f > 0 && !pipHidden(pp)) P_(pp, [0.5, 0.75, 1], 0.5*f*(1 - 0.6*v), -2); }
  if (q.spot && q.lamp > 0.01 && q.A){ const tg = q.A.tg, s = V.add(tg.rel, q.spot); if (!behindSphere(s, tg.rel, surfDrawn(tg)*0.998)) P_(s, [0.75, 0.9, 1], 0.3*q.lamp, surfDrawn(tg)*0.03); }
}
// what the readout says (the job's line)
function pipLine(A){
  const q = PIP, nm = pipName(A.tg), u = S_.t - A.t0, k = q.A === A ? q.kind : pipKind(A.tg);
  if (u < 0) return 'approaching ' + A.tg.name + " · Pip, the ship's drone, gets ready";
  if (u < PT.POP) return 'Pip pops out of the belly bay';
  if (u < PT.TURN) return 'Pip says hello';
  const near = `Pip stays inside the Halo's shield this close to ${nm}`;
  if (u < PT.AT) return k === 'near' ? near : k === 'cloud' ? 'Pip flies out ahead toward ' + nm : 'Pip flies down to ' + nm;
  if (u < PT.WK){ const n = ` · picture ${Math.max(q.shots, 1)} of ${q.nShots}`;
    return (k === 'land' ? `Pip lights up ${q.gas ? 'the cloud tops' : 'the ground'}` : k === 'star' ? 'Pip squints at ' + nm : k === 'near' ? near : 'Pip takes pictures of ' + nm) + n; }
  if (u < PT.DK) return 'Pip flies home to the Halo';
  if (u < PT.IN) return 'Pip docks in the belly bay';
  return `Pip is back aboard · ${q.nShots} pictures of ${nm}`;
}
drone.reset = () => { pipStow(); Object.assign(PIP, { A:null, pose:null, r:lcg(7), blinkIn:3, blinkT:9, ring:0, thr:0, mood:0, shots:0 }); };
// a read-only view of it (for the Halo's sounds later), and the test hooks: its state, a pose to hold it in, its look
// (bayD: how far it is from the bay, in ship radii; minAlt: its lowest height over the drawn surface on this job, in surface radii)
Object.defineProperty(drone, 'state', { get:() => ({ st:PIP.st, kind:PIP.kind, shots:PIP.shots, flash:PIP.flash, thr:PIP.thr, vis:PIP.vis, pos:PIP.pos.slice(), minAlt:PIP.minAlt,
  bayD:V.len(V.sub(PIP.pos, localPt(HULL.bay)))/ship.rad }) });
ship.dbg.drone = { get state(){ return drone.state; }, pose(o){ PIP.pose = o || null; if (!o) pipStow(); }, setLook:v => drone.setLook(v), get look(){ return droneLook; }, PT };
// review only: with ?drone= in the address, a small chip switches between the looks
if (DRONE_Q){
  const chip = document.createElement('div'), pick = v => { drone.setLook(v); sync(); toast(DRONE_NAMES[v]); };
  chip.className = 'shield-chip drone-chip' + (SHIELD_Q ? ' second' : ''); chip.setAttribute('aria-label', 'Drone look (review)');
  chip.innerHTML = 'Pip ' + ['A', 'B', 'C'].map((n, i) => `<button type="button" data-v="${i + 1}">${n}</button>`).join('');
  const sync = () => { for (const b of chip.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.v === droneLook); };
  chip.addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.v); });
  document.body.appendChild(chip); sync();
}

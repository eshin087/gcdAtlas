
// ================================================================ Pip, the Halo's little drone (made up, like the ship). Review build: three looks, ?drone=a|b|c.
// It lives in the belly bay. On a probe job (ACT.probe in 07h-halo.js) it pops out, says hello to the camera, glances at the ship and then at
// the body, flies there, hovers taking pictures while it looks at what it photographs, flies home and docks. Near a black hole or a magnetar
// it stays by the ship. It is a small volume of its own (FS_DRONE; its body about 400 m across in a 600 m sphere), drawn right after the ship (ship.drawAfter) so the hull
// never covers it by mistake, and hidden wherever the hull or the body is in front of it (volumes have no depth test). Far away it is a steady
// ice-blue glint. Its controller is drone.ctl, run once a tick after the camera has moved (AFTER_CAM: its spot is picked in the camera's view, and
// a spot worked out from the camera's last place made it shake with uneven frames; an object's own update would run before the camera), and
// its dice come from lcg, never hrnd, so the Halo's route stays the same. This file must load after 07h-halo.js (it uses S_, HULL, ACT).
const FS_DRONE_BODY = `
// Local frame: bounding sphere 1, +y the way it looks (its eye), +z up, x across. LOOK 1 eye-pod: a black egg with one big eye, two tiny
// crescent fins (the ship's arms in miniature), an antenna and a thruster ring. LOOK 2 little Halo: a round pod whose eye sits inside a ring of
// lights, like the ship's heart inside its dotted rings. LOOK 3 firefly: a teardrop with a big eye, its tail end glowing like a firefly's
// lantern and streaming light behind it.
// uP0: x the eye open (0 shut, 1 open), y the iris's glow (1; above 1 it flashes white for a picture), z the thruster, w mood (> 0 a happy
// squint, < 0 narrowed)   uP1: xyz the light's direction (world), w unfold (the fins, wings and antenna tuck in when it is stowed)
// uP2: xy where the pupil looks (in the eye's plane, -1..1), z the antenna's wink, w the lens lamp   uP3: rgb the iris's colour, w how much of
// it is there (1 whole; its glows fade with it as it breaks up)
// uM0 column 0: its scale, B's ring phase, C's tail length; column 1: its break-up into embers (dissolve g, mode 1 leaving / -1 arriving /
// 0 whole, the cells' size); column 2: toward the ship's bay, in its own frame (the side nearest the bay goes last and comes back first)
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
// its cells (cubes uM0[1].z wide in its own frame): a cell is gone while g is past its threshold, a front along the way to the bay plus a random
// share from an integer hash. pipCellThr in JS gives each the same threshold, so an ember leaves each cell (or lands on it) as it goes.
uint hsh3(ivec3 c){ uvec3 u = uvec3(c + 64); uint h = u.x*0x8da6b343u + u.y*0xd8163841u + u.z*0xcb1ab31fu + 0x9e3779b9u; h ^= h >> 15u; h *= 0x2c1b3c6du; h ^= h >> 12u; h *= 0x297a2d39u; h ^= h >> 15u; return h; }
float thrP(ivec3 c){ vec3 cc = (vec3(c) + 0.5)*uM0[1].z; return 0.5 + 0.45*clamp(dot(cc, uM0[2].xyz)/0.5, -1., 1.) + 0.3*(float(hsh3(c) >> 8u)*(1./16777216.) - 0.5); }
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
  // (sm: how small it is on screen, 0 from a radius of about 40 pixels up, 1 at 10 and under: its outline, A's fins and C's lantern grow
  // brighter and bolder as it shrinks, so each look keeps its own mark at the few characters it covers riding along)
  float sm = smoothstep(0.025, 0.1, uPix*length(o));
  // (breaking up: where the ray meets a cell that is gone it sees through it; a cell about to go, or just back, burns from within)
  float heat = 0.;
  if(hit && uM0[1].y != 0.){ float fe = thrP(ivec3(floor((o + d*t)/uM0[1].z))) - uM0[1].x; if(fe < 0.) hit = false; else heat = 1. - smoothstep(0., 0.08, fe); }
  if(hit){
    vec3 p = o + d*t, n = nrmD(p);
    float dif = max(dot(n, L), 0.), mu = max(dot(n, -d), 0.), rim = pow(1. - mu, mix(6., 3., sm));
    float spec = pow(max(dot(n, normalize(L - d)), 0.), 40.);
    // smooth black lacquer and a thin silver rim all round its outline (whatever side the Sun is on), so even a small Pip shows its shape
    // against black space: a black silhouette, a crisp silver outline, one big blue eye. (A broad rim and a grainy hull made it a dotted oval.)
    vec3 hull = vec3(0.05, 0.055, 0.07), body = hull*(dif*1.3 + 0.2) + silver*(spec*1.1 + rim*(1.8 + 2.5*sm));
    col = body;
    if(id > 2.5) col = hull*(dif*1.3 + 0.4) + silver*(0.25 + 1.2*rim + spec + (LOOK == 1 ? 0.6 : 0.)*sm);   // fins, antenna, wings (A's fins lit when small)
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
      vec3 eyeC = vec3(0.02, 0.035, 0.07) + silver*spec*0.8 + (irisC*vec3(0.55, 0.8, 1.)*iris*1.6 + irisC*ringI*1.9)*uP0.y + white*cat*1.4*uP0.x;
      col = mix(body + silver*0.4*exp(-sq((abs(e.y - c) - hw)/0.07)), eyeC, lid);
    }
#if LOOK == 1
    if(id < 0.5) col += silver*exp(-sq((p.z + 0.12)/0.012))*(0.3 + 0.5*dif);   // a silver seam round its waist
#elif LOOK == 3
    // its lantern: the tail end glows, breathing slowly, brighter as it flies
    if(id < 0.5) col += ice*smoothstep(-0.06, -0.36, p.y)*(0.75 + 0.25*sin(tm*(RM > 0 ? 1.2 : 2.6)))*(1.1 + 1.3*uP0.z)*(1. + 0.5*sm);
#endif
    // (the burn: from a blue glow to white-hot, like the ship's cells in fold A)
    // (toned down from the ship's: a small body whose cells all burn at once read as a white blob)
    col = mix(col, mix(vec3(0.3, 0.48, 1.), vec3(1.3, 1.5, 1.8), heat*heat*heat), 0.85*smoothstep(0., 0.55, heat));
    alpha = 1.;
  }
  float front = hit ? t : 1e9, pres = uP3.w;
  // the eye's glow, so a small Pip still shows one bright blue character (only from in front, and only while it is small on screen)
  float face = smoothstep(0.05, 0.45, -d.y), small = smoothstep(0.06, 0.2, uPix*length(o));
  col += irisC*blob(o, d, EC + vec3(0., 0.07, 0.), 0.13)*0.7*uP0.y*max(uP0.x, 0.2)*face*small*pres;
  // the lens lamp: light pouring out of the eye onto what it looks at
  if(uP2.w > 0.01) col += mix(ice, white, 0.5)*blob(o, d, EC + vec3(0., 0.24, 0.), 0.1)*uP2.w*face*1.4*pres;
#if LOOK == 1
  col += white*lampD(o, d, vec3(0., -0.125, 0.53 + 0.17*uP1.w), 0.03, front + 0.02)*(10. + 24.*uP2.z)*pres;   // the antenna's lamp, winking now and then
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
        col += (ice*dots*13. + silver*1.1)*ring*pres;
      }
    }
  }
#endif
  // the thruster: a nozzle glow and a short plume that fades well inside the bounding sphere (C's tail is its firefly glow, longer as it flies)
  float th = uP0.z, behind = dot(NZ - o, d) > front ? 0.15 : 1.;   // (the body hides most of a plume behind it)
#if LOOK == 3
  float PL = 0.1 + 0.28*uM0[0].z;
  // (its lantern's glow spills round the body, so it shows even when Pip faces you)
  col += ice*blob(o, d, vec3(0., -0.33, 0.), mix(0.22, 0.3, sm))*(0.55 + 0.6*th)*(1. + 0.5*sm)*(0.75 + 0.25*sin(tm*(RM > 0 ? 1.2 : 2.6)))*(1. - 0.75*alpha)*pres;
  col += jet(o - NZ, d, vec3(0., -1., 0.), PL, 0.035, 0.075, 0.4, tm*6., vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(3. + 10.*th)*behind*pres;
#else
  float PL = 0.1 + 0.25*th;
  col += jet(o - NZ, d, vec3(0., -1., 0.), PL, 0.03, 0.06, 0.5, tm*6., vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(1. + 10.*th)*th*behind*pres;
#endif
  col += mix(white, ice, 0.4)*lampD(o, d, NZ, 0.035, front + 0.02)*(2. + 7.*th)*pres;
  outCol(col, alpha);
}`;
const DRONE_LOOKS = { a:1, b:2, c:3 }, DRONE_NAMES = ['', 'Pip A · eye-pod', 'Pip B · little Halo', 'Pip C · firefly'];
const DRONE_Q = (new URLSearchParams(location.search).get('drone') || '').toLowerCase();
let droneLook = DRONE_LOOKS[DRONE_Q] || 1;
const droneProgs = [];
// (highp int: the cells' hash needs 32-bit integers to match pipHash in JS)
const droneProg = v => droneProgs[v] || (droneProgs[v] = program(VS_RECT, COMMON + `precision highp int;\n#define LOOK ${v}\n#define RM ${reduceMotion ? 1 : 0}\n` + FS_DRONE_BODY));
P.drone = droneProg(droneLook);

// ---------------------------------------------------------------- its state: where it is (ship-relative, world axes), where it looks, its face
// (st: 'stowed', 'out' on a job, 'pose' held by a test or a screenshot; kind: 'land' hovers over the ground or the cloud tops, 'star' keeps
// further off and squints, 'near' stays by the ship near a black hole or a magnetar, 'cloud' flies out toward the heart of a nebula or galaxy)
const ICE_P = [0.6, 0.83, 1];
// (all of its state as on page load: drone.reset puts it all back, so a test's result never depends on the job before it)
// anc, ancV: the spot it keeps to by the ship (ship axes, ship radii) and how fast that moves. It follows the spot it wants (H, or H2 on the way
// home, both picked in the camera's view) on a critically damped spring: a spot that moves with the camera, or a new one, never makes it jump
// or shake. dg, dm, pres: its break-up into embers (the dissolve, its mode, how much of it is there); cs its cells' size, bayL the way to the
// bay in its own frame (both fixed for each break-up), cells their table, wz the side its stream of embers bends to
const pipFresh = () => ({ st:'stowed', A:null, kind:'land', H:null, pos:[0, 0, 0], pupil:[0, 1, 0], body:[0, 1, 0], ax:[1, 0, 0], open:1, blinkIn:3, blinkT:9, glow:1, flash:0,
  thr:0, mood:0, unfold:0, scale:1, ring:0, tail:0.3, shots:0, nShots:4, at:[], lamp:0, px:0, pz:0, ant:0, iris:ICE_P.slice(), r:lcg(7), trail:[], trAcc:0,
  vis:0, pose:null, H2:null, spot:null, alt:0.08, wd:null, wt:null, gas:false, minAlt:9, anc:null, ancV:[0, 0, 0], fx:null,
  dg:0, dm:0, pres:1, cs:0.19, bayL:[0, 0, 1], cells:null, brk:0, wz:1, arr:0, embN:0, embIn:0, hi:0, lsx:0 });
const PIP = pipFresh();
const DM0 = new Float32Array(9);
const drone = addObj({ key:'halo-drone', name:'Pip', label:'', type:"the Halo's little drone (made up)", group:'travel', layer:3, parent:ship, offset:[0, 0, 0], pos:[0, 0, 0],
  rad:0.12*ship.rad, prog:P.drone, selfPos:true, hidden:true, noPick:true, noLabel:true, noImpostor:true, atlas:false, noWaypoint:true,
  // (lit like the ship: by the Sun, or by the showcase's fixed light)
  setU(pr){ const S = ship.S, q = PIP, L = S.light ? M3.apply(ship.R0, V.norm(S.light)) : V.norm(V.sub(sun.rel, this.rel)), c = q.iris, b = q.bayL;
    gl.uniform4f(pr.u.uP0, q.open, q.glow, q.thr, q.mood); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], q.unfold);
    gl.uniform4f(pr.u.uP2, q.px, q.pz, q.ant, q.lamp); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], q.pres);
    DM0[0] = q.scale; DM0[1] = q.ring; DM0[2] = q.tail; DM0[3] = q.dg; DM0[4] = q.dm; DM0[5] = q.cs; DM0[6] = b[0]; DM0[7] = b[1]; DM0[8] = b[2];
    gl.uniformMatrix3fv(pr.u.uM0, false, DM0); } });
drone.setLook = v => { if (!(v >= 1 && v <= 3)) return; droneLook = v; drone.prog = droneProg(v); progReady(drone.prog, true); };

// ---------------------------------------------------------------- the job's timeline (seconds after launch; ACTS.probe's timing is unchanged, so the route is too: it
// launches 0.3 s into the job and is back aboard 11.9 s later). It streams out of the belly bay as embers and takes shape at its spot in view
// (ASM0 to ASM), opens its eye (OPEN), says hello with a wiggle toward you (to HI), does a happy spin (to SPIN) and peeks at what it came for.
// Over a planet, a star or a cloud it flies there (GO to AT), takes pictures (each with a flash and a happy bounce), looks back at the ship
// (WK to HOME), flies home (HM) and loops the loop by the ship; near a black hole or a magnetar it stays by the ship and does it all there,
// with a goodbye wiggle. Then it breaks up into embers that stream back into the bay (DIS0 to DIS).
const PT = { ASM0:0.3, ASM:1.05, OPEN:1.3, HI:2.2, SPIN:2.9, GO:3.3, AT:5.2, WK:8, HOME:8.4, HM:9.7, DIS0:10.4, DIS:11.2, IN:11.9 };
const PIP_ACTS = { far:{ shots:[5.5, 6.2, 6.9, 7.6], peek:[2.9, 3.35], loop:[9.72, 10.35], back:[8, 8.45], bye:null },
  near:{ shots:[3.9, 5.3, 6.6], peek:[2.9, 3.6], loop:[7.15, 8], back:[8.2, 8.9], bye:[8.95, 9.8] } };
const pipKind = tg => isHoleTarget(tg) || RS_KM[tg.key] ? 'near' : !surfOf(tg) ? 'cloud' : tg === sun || tg.group === 'stars' ? 'star' : 'land';
const pipName = tg => tg.label && tg.label.length < tg.name.length && !/^the /.test(tg.name) ? tg.label : tg.name;
const pipActs = q => PIP_ACTS[q.kind === 'near' ? 'near' : 'far'];
const envW = (a, b, u, r) => smooth(a, a + r, u)*(1 - smooth(b - r, b, u));
function pipPlan(A){
  const q = PIP, tg = A.tg, pl = A.pl;
  q.A = A; q.kind = pipKind(tg); q.shots = 0; q.trail.length = 0; q.H = null; q.H2 = null; q.spot = null; q.minAlt = 9; q.anc = null; q.ancV = [0, 0, 0]; q.brk = 0; q.arr = 0; q.hi = 0; q.lsx = 0; q.embIn = 0;
  q.r = lcg(pl.seed*17 + 3); q.wz = q.r() < 0.5 ? -1 : 1;
  q.at = pipActs(q).shots; q.nShots = q.at.length;
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
// ship banks toward and below the middle, 1 ship radius away (at most 0.4 of the way to the ship; close enough that its face fills several
// characters); on a phone, where the ship is wider than the screen, 0.8 ship radii away in the sky above it; on the bridge (the camera inside
// the ship's sphere), 1.3 ship radii ahead and a little above
// the horizon, clear of the needle below it. The first such spot that the hull does not hide, with a margin (the hull's outline in behindHull
// is rough); near a black hole, where Pip stays at this spot for its whole job, not over the hole's bright disc either (its black body read
// as a second shadow there), trying the side of the view away from the hole first. With the camera far away, a spot beside the belly pod
// (l: ship axes, ship radii).
function pipHello(){
  const sd = S_.side, sp = camNear() ? V.len(ship.rel) : -1;
  if (sp >= 0){
    const hole = PIP.kind === 'near' && PIP.A ? PIP.A.tg : null, dr = hole ? Math.asin(Math.min(1, hole.rad*0.8/Math.max(V.len(hole.rel), 1e-300))) : 0;
    const onDisc = p => !!hole && angleOf(V.norm(p), V.norm(hole.rel)) < dr;
    const bridge = sp < ship.rad, D = bridge ? 1.3*ship.rad : Math.min((isCompact() ? 0.8 : 1)*ship.rad, sp*0.4), m = ship.rad*0.15;
    // (br: picked for a camera on the bridge or outside the ship, so a camera that moves in or out gets a spot of its own: drone.ctl)
    const C = bridge ? [[0.4*sd, 0.12], [-0.4*sd, 0.12], [0.2*sd, 0.35]] : isCompact() ? [[0.3*sd, 0.3], [-0.3*sd, 0.3], [0.3*sd, 0.45]] : [[0.42*sd, -0.16], [0.42*sd, 0.14], [-0.42*sd, -0.16], [0.25*sd, 0.35]];
    if (hole){ const s = Math.sign(V.dot(hole.rel, cam.right)) || 1; C.sort((a, b) => a[0]*s - b[0]*s); }
    for (let i=0;i<C.length;i++){
      const h = { c:[C[i][0], C[i][1], D] }, p = camSpot(h.c);
      if (i === C.length - 1 || (!behindHull(p) && !behindHull(V.sub(p, V.mul(cam.up, m))) && !behindHull(V.sub(p, V.mul(cam.right, m*Math.sign(h.c[0])))) && !onDisc(p))){ h.br = bridge; spotLocal(h); return h; }
    }
  }
  return { l:[0.2, 0.3, 0.5*sd] };
}
const camSpot = c => V.add(V.add(V.mul(cam.right, c[0]*c[2]*tanX), V.mul(cam.up, c[1]*c[2]*tanY)), V.mul(cam.fwd, c[2]));   // (camera-relative)
// the spot in ship axes and ship radii, from where the camera is now (while it stays near the ship; otherwise where it was last)
function spotLocal(h){ if (h.c && camNear()) h.l = M3.applyT(ship.R0, V.mul(V.sub(camSpot(h.c), ship.rel), 1/ship.rad)); return h.l; }
// the spot it keeps to follows the spot it wants on a critically damped spring (exact for any step, so uneven frames never make it shake)
function pipAnchor(q, dt){
  const T = spotLocal(q.H2 || q.H);
  if (!q.anc){ q.anc = T.slice(); q.ancV = [0, 0, 0]; return; }
  const w = 6, x = V.sub(q.anc, T), c = V.add(q.ancV, V.mul(x, w)), e = Math.exp(-w*dt);
  q.anc = V.add(T, V.mul(V.add(x, V.mul(c, dt)), e)); q.ancV = V.mul(V.sub(q.ancV, V.mul(c, w*dt)), e);
}
// where it works, relative to the ship (world axes), at time u after launch, and how fast that spot moves relative to the ship
function pipWork(q, u){
  const A = q.A, tg = A.tg;
  if (q.kind === 'land' || q.kind === 'star'){
    const ps = passAt(A.pl, A.t0 + u), sw = 0.06*Math.sin(2*Math.PI*clamp((u - PT.AT)/(PT.WK - PT.AT), 0, 1));
    const W = V.mul(V.norm(V.add(q.wd, V.mul(q.wt, sw))), surfDrawn(tg)*(1 + q.alt));
    return { r:V.sub(W, ps.p), m:V.mul(ps.h, -ps.v) };
  }
  // (near a black hole or a magnetar: it stays at its spot by the ship for the whole job, in the camera's view and clear of the hull, where its
  // face covers several characters. Tucked in over the deck it was about two characters lying on the hull's own, and could not be picked out)
  const H = localPt(q.anc);
  if (q.kind === 'near') return { r:H, m:[0, 0, 0] };
  // a cloud: out ahead toward its heart (moving with the ship: the ship crosses a nebula or a galaxy far too fast to leave it behind)
  return { r:V.add(H, V.mul(V.norm(V.mul(ship.offset, -1)), ship.rad*14)), m:[0, 0, 0] };
}
// a flight between its spot by the ship (a) and its work far away (b), s from 0 to 1: the distance from a grows by the same factor every moment,
// so it moves off at an even pace on screen, starting and stopping gently (and back, with s from 1 to 0). A cubic curve over thousands of ship
// radii put it some 50 ship radii away one frame after it set off, and brought it in as fast.
function pipFly(a, b, s){ const L = V.len(V.sub(b, a))/ship.rad, lam = Math.log(1 + L/0.3), k = ease(clamp(s, 0, 1)); return V.lerp(a, b, (Math.exp(lam*k) - 1)/(Math.exp(lam) - 1)); }
// where it is before its flourishes: at its spot by the ship, on the way to its work, at work (moving with the ground), on the way home
function pipBase(q, u){
  const H = localPt(q.anc);
  if (q.kind === 'near' || u < PT.GO || u >= PT.HM) return H;
  if (u < PT.AT) return pipFly(H, pipWork(q, u).r, (u - PT.GO)/(PT.AT - PT.GO));
  if (u < PT.HOME) return pipWork(q, u).r;
  return pipFly(H, pipWork(q, u).r, 1 - (u - PT.HOME)/(PT.HM - PT.HOME));
}
// hidden from the camera by the hull, or by the body it visits (camera-relative p)
function pipHidden(p){
  if (behindHull(p)) return true;
  const tg = PIP.A && PIP.A.tg; if (!tg || PIP.st === 'pose') return false;
  const sp = aimSphere(tg); return (sp.solid || sp.hole) && behindSphere(p, tg.rel, sp.r*0.998);
}
// a picture: a white flash at Pip (kept relative to the ship, drifting back as the ship moves on) and, over the ground, on the spot it lights
function pipFlash(q, pos){
  const tg = q.A.tg, spot = q.spot ? q.spot.slice() : null, sz = surfDrawn(tg)*0.02;
  fxAdd({ T:0.3, q:pos.slice(), drift:[0, 0, 0], anc:tg, draw(e){ const f = 1 - e.t/e.T, p = V.sub(V.add(ship.rel, e.q), e.drift);
    if (!pipHidden(p)){ P_(p, WHITE, 3*f*f, -8); P_(p, [0.85, 0.92, 1], 0.7*f, -16); }
    if (spot){ const s = V.add(e.anc.rel, spot); if (!behindSphere(s, e.anc.rel, surfDrawn(e.anc)*0.998)) P_(s, [0.8, 0.9, 1], 1.1*f, sz); } } });
}
function pipStow(){ const q = PIP; q.st = 'stowed'; q.trail.length = 0; q.spot = null; q.lamp = 0; q.flash = 0; q.vis = 0; q.dm = 0; q.dg = 0; q.pres = 1; q.arr = 0; q.embN = 0; }

// ---------------------------------------------------------------- its break-up into embers, the same look as the ship's fold A (ember wind): as it comes out, embers
// stream out of the belly bay and settle on its cells, which appear one by one from the side nearest the bay; going home, its cells burn and go
// one by one from the far side, and each sends an ember streaming into the bay, where they light the bay as they arrive. The cells are cubes
// about one character on screen (PIP_CS, chosen as each break-up starts), only those on its skin; pipCellThr gives each the threshold thrP gives
// it in the shader (the same front toward the bay, the same integer hash). Embers are pure functions of the job's clock; their dice are lcg.
const PIP_CS = [0.09, 0.13, 0.19, 0.27], PIP_TAB = new Map(), PIP_GLO = -0.25, PIP_GHI = 1.12, PIP_CW = 10;
function pipHash(ix, iy, iz){
  let h = (Math.imul((ix + 64) >>> 0, 0x8da6b343) + Math.imul((iy + 64) >>> 0, 0xd8163841) + Math.imul((iz + 64) >>> 0, 0xcb1ab31f) + 0x9e3779b9) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h = (h ^ (h >>> 12)) >>> 0; h = Math.imul(h, 0x297a2d39) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return (h >>> 8)/16777216;
}
const pipCellThr = (a, c, b) => 0.5 + 0.45*clamp((a[c]*b[0] + a[c + 1]*b[1] + a[c + 2]*b[2])/0.5, -1, 1) + 0.3*(a[c + 3] - 0.5);
// its body in its own frame (bounding sphere 1), as map() draws it for each look, without the fins: the cells on its skin
function pipBodyD(x, y, z, look){
  const ell = (x, y, z, a, b, c) => { const k0 = Math.hypot(x/a, y/b, z/c), k1 = Math.hypot(x/(a*a), y/(b*b), z/(c*c)); return k0*(k0 - 1)/Math.max(k1, 1e-5); };
  const E = look === 1 ? [0, 0.355, 0.1, 0.235, 0.09, 0.235] : look === 2 ? [0, 0.345, 0.03, 0.24, 0.09, 0.24] : [0, 0.445, 0.08, 0.23, 0.085, 0.23];
  const eye = ell(x - E[0], y - E[1], z - E[2], E[3], E[4], E[5])*0.9;
  if (look === 1){ const qz = z + 0.03, tq = 1 + 0.12*clamp(qz/0.54, -1, 1); return Math.min(ell(x/tq, y/tq, qz, 0.42, 0.4, 0.54)*0.85, eye); }
  if (look === 2) return Math.min(ell(x, y, z, 0.4, 0.38, 0.36)*0.95, eye);
  // (C: the teardrop, a round cone from its head to its tail)
  const ay = 0.14, az = 0.04, by = -0.5, bz = 0.02, r1 = 0.34, r2 = 0.06, pa = [x, y - ay, z - az], ba = [0, by - ay, bz - az], l2 = V.dot(ba, ba), rr = r1 - r2, a2 = l2 - rr*rr, il2 = 1/l2;
  const yy = V.dot(pa, ba), zz = yy - l2, xv = V.sub(V.mul(pa, l2), V.mul(ba, yy)), x2 = V.dot(xv, xv), y2 = yy*yy*l2, z2 = zz*zz*l2, k = Math.sign(rr)*rr*rr*x2;
  const d = Math.sign(zz)*a2*z2 > k ? Math.sqrt(x2 + z2)*il2 - r2 : Math.sign(yy)*a2*y2 < k ? Math.sqrt(x2 + y2)*il2 - r1 : (Math.sqrt(x2*a2*il2) + yy*rr)*il2 - r1;
  return Math.min(d, eye);
}
// (numbers per cell: its centre x y z in its own frame, its hash, then dice: flight time, bend, eddy radius, eddy phase, ash, keep)
function pipTable(look, cs){
  const key = look + ':' + cs; if (PIP_TAB.has(key)) return PIP_TAB.get(key);
  const L = [], r = lcg(4242 + look), n = Math.ceil(0.62/cs);
  for (let ix=-n;ix<n;ix++) for (let iy=-n;iy<n;iy++) for (let iz=-n;iz<n;iz++){
    const x = (ix + 0.5)*cs, y = (iy + 0.5)*cs, z = (iz + 0.5)*cs;
    if (Math.abs(pipBodyD(x, y, z, look)) > 0.6*cs) continue;
    L.push(x, y, z, pipHash(ix, iy, iz), r(), r(), r(), r(), r(), r());
  }
  const T = { cs, n:L.length/PIP_CW, a:new Float64Array(L) }; PIP_TAB.set(key, T); return T;
}
// (the cells' size: the nearest step to one character on screen, from its radius in scene pixels; two scene pixels to a character)
function pipCs(){ const rpx = drone.rad/Math.max(drone.dist, 1e-300)*sceneH*0.5/tanY, w = clamp(2.4/Math.max(rpx, 1), PIP_CS[0], PIP_CS[3]);
  let b = PIP_CS[0]; for (const c of PIP_CS) if (Math.abs(Math.log(c/w)) < Math.abs(Math.log(b/w))) b = c; return b; }
// the dissolve's front at time u: coming out it falls from all gone (PIP_GHI) to all there (PIP_GLO) between ASM0 and ASM; going home it rises
// between DIS0 and DIS. A cell's time: when the front crosses its threshold
const pipLandU = thr => PT.ASM0 + clamp((PIP_GHI - thr)/(PIP_GHI - PIP_GLO), 0, 1)*(PT.ASM - PT.ASM0);
const pipLeaveU = thr => PT.DIS0 + clamp((thr - PIP_GLO)/(PIP_GHI - PIP_GLO), 0, 1)*(PT.DIS - PT.DIS0);
// start a break-up (1 going home, -1 coming out): the cells' size, the way to the bay in its own frame, both kept to the end of it
function pipBreak(q, mode){
  q.brk = mode; q.cs = pipCs(); q.cells = pipTable(droneLook, q.cs);
  const R = drone.rot || I3, b = M3.applyT(R, V.norm(V.sub(localPt(HULL.bay), q.pos)));
  q.bayL = b;
}
// ember i at time u: where it is (ship-relative, world axes), how far along its way (s) and how long since it left (a); null when it is not out.
// It flies from its cell (where that cell is now, on Pip) to the bay (going home), or from the bay to its cell (coming out), on a curve that
// bends to one side (the same side for all, so they stream like a ribbon), each turning in a small eddy of its own
const EB = [0, 0, 0, 0];
function emberPip(q, i, u, out){
  const A = q.cells.a, c = i*PIP_CW, thr = pipCellThr(A, c, q.bayL), T = 0.34 + 0.24*A[c + 4];
  let t0, s;
  if (q.brk > 0){ t0 = pipLeaveU(thr); s = (u - t0)/T; }
  else { const tl = pipLandU(thr); t0 = Math.max(tl - T, 0.02); s = (u - t0)/Math.max(tl - t0, 0.05); }
  if (s < 0 || s > 1) return null;
  const R = drone.rot, cellP = V.add(q.pos, V.mul(M3.apply(R, [A[c], A[c + 1], A[c + 2]]), drone.rad)), bay = localPt(HULL.bay);
  const P0 = q.brk > 0 ? cellP : bay, P1 = q.brk > 0 ? bay : cellP, D = V.sub(P1, P0), L = V.len(D) || 1e-9, e = s*s*(3 - 2*s);
  const side = V.norm(V.cross(D, cam.fwd)), lift = V.norm(V.cross(side, D)), bend = L*(0.2 + 0.14*A[c + 5])*q.wz;
  const C = V.add(V.add(P0, V.mul(D, 0.5)), V.mul(side, bend));
  let p = V.add(V.add(V.mul(P0, (1 - e)*(1 - e)), V.mul(C, 2*(1 - e)*e)), V.mul(P1, e*e));
  const er = drone.rad*(0.3 + 0.5*A[c + 6])*Math.sin(Math.PI*s)*(reduceMotion ? 0.3 : 1), ea = 6.283*A[c + 7] + s*(5 + 4*A[c + 5]);
  p = V.add(p, V.add(V.mul(side, er*Math.cos(ea)), V.mul(lift, er*Math.sin(ea))));
  EB[0] = s; EB[1] = u - t0; return p;
}
// how many embers arrive between two moments (for the bay's glow), and the share that has arrived
function pipArrivals(q, u0, u1){
  if (!q.cells || !q.brk) return [0, q.embIn];
  const A = q.cells.a; let n = 0, done = 0;
  for (let i=0;i<q.cells.n;i++){
    const c = i*PIP_CW, thr = pipCellThr(A, c, q.bayL), tA = q.brk > 0 ? pipLeaveU(thr) + 0.34 + 0.24*A[c + 4] : Math.max(pipLandU(thr) - 0.34 - 0.24*A[c + 4], 0.02);
    if (tA > u0 && tA <= u1) n++; if (tA <= u1) done++;
  }
  return [n, done/Math.max(q.cells.n, 1)];
}
function pipEmbers(q, u){
  if (!q.brk || !q.cells || !(ship.rpx > 6)) return;
  const A = q.cells.a, N = q.cells.n, keep = Math.min(1, 110/N), leaving = q.brk > 0; let n = 0;
  for (let i=0;i<N;i++){
    const c = i*PIP_CW; if (A[c + 9] > keep) continue;
    const p0 = emberPip(q, i, u, EB); if (!p0) continue;
    const s = EB[0], a = EB[1], p = V.add(ship.rel, p0);
    if (behindHull(p)) continue;
    n++;
    const ash = A[c + 8] < 0.18;
    let b, col;
    if (leaving){
      // (white-hot as it leaves its cell, a bigger flake for its first 0.15 s, ice blue on the way, a spark as it reaches the bay; about one in
      // six a flake of grey ash, flickering)
      b = ash ? 0.8*(0.6 + 0.4*Math.sin(a*11 + A[c + 7]*30)) : 1.9*Math.exp(-a/0.12) + 0.9 + 0.5*smooth(0.75, 1, s);
      col = ash ? ASH_ : a < 0.3 ? mix3([0, 0, 0], WHITE, ICE_, a/0.3) : mix3([0, 0, 0], ICE_, DEEP_, Math.min((a - 0.3)/0.6, 1)*(1 - smooth(0.8, 1, s)));
    } else {
      // (coming out: deep blue as it leaves the bay, warming to white as it nears its cell, a spark as it lands)
      b = (ash ? 0.7 : 0.8 + 1.3*smooth(0.6, 1, s));
      col = ash ? ASH_ : mix3([0, 0, 0], DEEP_, WHITE, s*s);
    }
    P_(p, col, b, (leaving ? a < 0.15 : s > 0.85) && !ash ? -3 : -2);
    if (!ash && !reduceMotion){ const pb = emberPip(q, i, u - 0.03, EB); if (pb) L_(V.add(ship.rel, pb), p, DEEP_, b*0.05, col, b*0.3); }
  }
  q.embN = n;
  // the sparks where they arrive: in the bay going home, on its cells coming out
  if (q.arr > 0.02){ const bp = shipPt(HULL.bay); if (leaving && !behindHull(bp)) P_(bp, [0.8, 0.93, 1], Math.min(q.arr, 1.2), -4); }
}

// ---------------------------------------------------------------- each tick, from ship.update (only there)
// (after the camera has moved: the ship's place relative to the camera is brought up to date first; the tick does it again for every object)
AFTER_CAM.push(dt => { ship.rel = V.sub(frel(ship), cam.rel); ship.dist = V.len(ship.rel); drone.ctl(dt*timeScale); });
drone.ctl = dt => {
  const q = PIP;
  q.ring = (q.ring + dt*(reduceMotion ? 0.5 : 1.2 + 3*q.thr)) % 6.2831853;
  if (q.pose){ pipPose(q.pose); return; }
  const A = S_.act && S_.act.kind === 'probe' && S_.phase === 'pass' ? S_.act : null;
  if (!A){ if (q.st !== 'stowed') pipStow(); q.A = null; return; }
  const u = S_.t - A.t0;
  if (q.A !== A){ if (u < -0.6) return; pipPlan(A); }
  // the bay lamp (ice blue): on as the bay opens and while embers stream out, a blink as it closes
  S_.em[3] = Math.max(S_.em[3], smooth(-0.4, -0.1, u)*(1 - smooth(0.9, 1.3, u)), Math.exp(-(((u - 11.95)/0.1)**2)));
  if (u < 0 || u >= PT.IN){ if (q.st !== 'stowed') pipStow(); return; }
  if (q.st === 'stowed'){
    q.st = 'out'; q.H = pipHello(); q.H2 = null; q.anc = null; pipAnchor(q, dt);
    const f = V.norm(V.mul(V.add(ship.rel, localPt(q.anc)), -1)); q.pupil = f; q.body = f; q.blinkIn = 2 + q.r(); q.flash = 0; q.thr = 0.2; q.mood = 0; q.open = 0;
    q.brk = 0; q.pos = localPt(q.anc);
  }
  const acts = pipActs(q), far = q.kind !== 'near';
  // (on the way home it keeps to a spot picked afresh in the view as it sets off back)
  if (u >= (far ? PT.HOME : acts.back[0]) && !q.H2) q.H2 = pipHello();
  // (near a black hole it works at its spot: when the camera moves onto the bridge or off it, the spot is picked afresh for the new view and Pip
  // glides over to it)
  const Hn = q.H2 || q.H;
  if (q.kind === 'near' && Hn.c && camNear() && u > PT.ASM && (V.len(ship.rel) < ship.rad) !== Hn.br) drone.reframe();
  pipAnchor(q, dt);
  // (a trail while it flies: at most 6 fading points, fixed where they were left)
  for (const t of q.trail){ t.age += dt; t.r = V.sub(t.r, V.mul(S_.vel, dt)); }
  while (q.trail.length && q.trail[0].age > 0.5) q.trail.shift();
  let pos = pipBase(q, u);
  const tg = A.tg, up = V.norm(localPt([-1, 0, 0])), land = q.kind === 'land' || q.kind === 'star', near = camNear();
  // (never below the drawn surface on its way down or back up)
  if (land && u > PT.GO && u < PT.HM){ const tp = V.add(ship.offset, pos), r = V.len(tp), rmin = surfDrawn(tg)*(1 + 0.5*q.alt); if (r < rmin) pos = V.sub(V.mul(tp, rmin/r), ship.offset); }
  // its flourishes, all smooth functions of the job's clock (eased in and out): the axes of the view (or of the ship, with no one near)
  const R_ = near ? cam.right : localPt([0, 0, 1]), U_ = near ? cam.up : up, rad = drone.rad, toTgD = V.norm(V.mul(V.add(ship.offset, pos), -1));
  const flying = far ? envW(PT.GO, PT.AT, u, 0.35) + envW(PT.HOME, PT.HM, u, 0.35) : 0;
  // hovering, it bobs a little
  pos = V.add(pos, V.mul(up, rad*(reduceMotion ? 0.05 : 0.12)*Math.sin(drone.t*3.77)*(1 - flying)));
  // hello: a wiggle toward you, rocking side to side
  const kH = envW(PT.OPEN, PT.HI, u, 0.25), wig = Math.sin(2*Math.PI*2.2*(u - PT.OPEN));
  let roll = 0.34*wig*kH, spin = 0, nod = 0;
  pos = V.add(pos, V.mul(R_, rad*0.22*wig*kH));
  // a happy spin, once round
  if (u > PT.HI && u < PT.SPIN) spin = 2*Math.PI*ease(clamp((u - PT.HI)/(PT.SPIN - PT.HI), 0, 1));
  // a curious peek at what it came for: it leans toward it, head on one side
  const kP = envW(acts.peek[0], acts.peek[1], u, 0.15);
  roll += 0.3*kP; pos = V.add(pos, V.mul(toTgD, rad*0.5*kP));
  // after each picture a happy hop
  let hop = 0; for (const ts of q.at){ const s = (u - ts - 0.06)/0.42; if (s > 0 && s < 1) hop = Math.max(hop, Math.sin(Math.PI*s)**2); }
  pos = V.add(pos, V.mul(U_, rad*0.85*hop));
  // looking back at the ship before heading home, a little nod; near a hole, a goodbye wiggle after it
  const kB = envW(acts.back[0], acts.back[1], u, 0.12); nod = 0.25*Math.sin(2*Math.PI*1.8*(u - acts.back[0]))*kB;
  const kY = acts.bye ? envW(acts.bye[0], acts.bye[1], u, 0.2) : 0, wy = Math.sin(2*Math.PI*2.4*(u - (acts.bye ? acts.bye[0] : 0)));
  roll += 0.28*wy*kY; pos = V.add(pos, V.mul(R_, rad*0.16*wy*kY));
  // a loop the loop, out to the side it is on, seen side-on (it faces the way it flies, head toward the middle of the loop)
  const L = acts.loop, sL = clamp((u - L[0])/(L[1] - L[0]), 0, 1), kL = envW(L[0], L[1], u, 0.1);
  let tan = null, inw = null;
  if (sL > 0 && sL < 1){
    // (out to the side of the view it is on, chosen as the loop starts)
    if (!q.lsx) q.lsx = Math.sign(V.dot(V.add(ship.rel, pos), R_)) || 1;
    const X = V.mul(R_, q.lsx), th = 2*Math.PI*ease(sL), RL = rad*1.7*(reduceMotion ? 0.6 : 1);
    pos = V.add(pos, V.add(V.mul(X, RL*Math.sin(th)), V.mul(U_, RL*(1 - Math.cos(th)))));
    tan = V.norm(V.add(V.mul(X, Math.cos(th)), V.mul(U_, Math.sin(th)))); inw = V.norm(V.sub(V.mul(U_, Math.cos(th)), V.mul(X, Math.sin(th))));
  }
  if ((u > PT.GO && u < PT.AT) || (u > PT.HOME && u < PT.HM) || kL > 0.3){ q.trAcc += dt; if (q.trAcc > 0.08){ q.trAcc = 0; q.trail.push({ r:pos.slice(), age:0 }); if (q.trail.length > 6) q.trail.shift(); } }
  const moved = V.sub(pos, q.pos);
  q.pos = pos; drone.offset = pos; drone.pos = V.add(ship.pos, pos);
  if (land){ const r = V.len(V.add(ship.offset, pos))/surfDrawn(tg) - 1; if (u > PT.GO && u < PT.HM) q.minAlt = Math.min(q.minAlt, r); }
  // where it looks: at you as it takes shape and says hello (at the bridge when no one is riding along), at what it came for as it peeks, the
  // way it flies, at its work (over the ground a little ahead along the track, where its lamp falls; near a black hole at you, with a glance at
  // the hole for each picture), back at the ship, then at you again as it breaks up
  const toCam = V.norm(V.mul(V.add(ship.rel, pos), -1)), toBridge = V.norm(V.sub(localPt([-0.06, 0.03, 0]), pos)), toTg = toTgD, look = near ? toCam : toBridge;
  let want = look;
  if (kP > 0.5) want = toTg;
  else if (far && u > PT.GO - 0.1 && u < PT.AT - 0.3) want = V.norm(V.sub(pipWork(q, PT.AT).r, pos));
  else if (far && u >= PT.AT - 0.3 && u < PT.WK) want = q.kind === 'land' ? V.norm(V.add(toTg, V.mul(q.wt, 0.55))) : toTg;
  else if (!far && u > acts.peek[1] && u < acts.back[0] && q.at.some(a => Math.abs(u - a + 0.1) < 0.35)) want = toTg;
  if (kB > 0.5) want = toBridge;
  else if (far && u > PT.HOME + 0.1 && u < PT.HM - 0.25) want = V.len(moved) > 1e-9 ? V.norm(moved) : V.norm(V.mul(pos, -1));
  // the pupil darts first, the body follows
  q.pupil = slerpDir(q.pupil, want, 1 - Math.exp(-dt/0.08));
  q.body = slerpDir(q.body, q.pupil, 1 - Math.exp(-dt/0.35));
  // blinks: every 2.5 to 4.5 s, and one as its eye opens; shut while it takes shape
  q.blinkIn -= dt; if (q.blinkIn <= 0){ q.blinkT = 0; q.blinkIn = 2.5 + 2*q.r(); }
  if (u > PT.OPEN + 0.25 && q.hi !== 1){ q.hi = 1; q.blinkT = 0; }
  q.blinkT += dt; const bk = q.blinkT < 0.16 ? Math.sin(Math.PI*q.blinkT/0.16) : 0;
  q.open = clamp(smooth(PT.ASM, PT.OPEN, u) - 1.15*bk, 0, 1);
  // its mood: happy as it says hello and spins, after each picture, looking back at the ship, saying goodbye and coming home; narrowed near a
  // black hole while it works; squinting at a star
  let mood = Math.max(0.9*envW(PT.OPEN + 0.2, PT.SPIN, u, 0.2), 0.9*hop, 0.4*kB, 0.9*kY, far ? 0.8*envW(PT.HM - 0.1, PT.DIS0 + 0.3, u, 0.2) : 0);
  if (q.kind === 'near' && u > acts.peek[1] && u < acts.back[0] && hop < 0.05) mood = -0.4;
  if (q.kind === 'star' && u > PT.GO && u < PT.WK) mood = -0.6*smooth(PT.GO, PT.GO + 0.8, u);
  q.mood += (mood - q.mood)*(1 - Math.exp(-dt*8));
  // pictures: a flash of its eye and a flash at it; over the ground its lamp lights a spot where it looks
  q.spot = null;
  if (q.kind === 'land' && u > PT.AT - 0.3 && u < PT.WK){ const C = tg.rel, dc = V.add(ship.rel, pos), t = raySphere(dc, q.pupil, C, surfDrawn(tg)); if (t > 0) q.spot = V.sub(V.add(dc, V.mul(q.pupil, t)), C); }
  while (q.shots < q.nShots && u >= q.at[q.shots]){ q.shots++; q.flash = 1; pipFlash(q, pos); }
  q.flash = Math.max(0, q.flash - dt/0.2);
  q.lamp = q.kind === 'land' ? smooth(PT.AT - 0.3, PT.AT + 0.3, u)*(1 - smooth(PT.WK - 0.3, PT.WK, u)) : 0;
  q.glow = 1 + 0.3*q.lamp + 2.4*q.flash;
  // the thruster: a flare as it sets off, cruising, braking; a puff for the spin, each hop and the loop; the rest of the time a low idle
  let th = 0.2;
  if (far && u > PT.GO && u < PT.AT) th = u < PT.GO + 0.4 ? 0.3 + 0.7*smooth(PT.GO, PT.GO + 0.3, u) : u < PT.AT - 0.6 ? 0.75 : 0.4;
  else if (far && u > PT.HOME && u < PT.HM) th = u < PT.HOME + 0.5 ? 0.9 : u < PT.HM - 0.5 ? 0.7 : 0.35;
  th = Math.max(th, 0.45*envW(PT.HI, PT.SPIN, u, 0.15), 0.5*hop, 0.85*kL);
  if (q.kind === 'near') th *= 0.6;
  q.thr += (th - q.thr)*(1 - Math.exp(-dt*6)); q.tail += (0.35 + 0.65*q.thr - q.tail)*(1 - Math.exp(-dt*4));
  // its fins and antenna unfold once it has taken shape and tuck in before it breaks up
  q.unfold = smooth(PT.ASM - 0.1, PT.OPEN + 0.1, u)*(1 - smooth(PT.DIS0 - 0.35, PT.DIS0, u)); q.scale = 1;
  const ph = (drone.t*0.62) % 1; q.ant = ph < 0.08 ? Math.sin(Math.PI*ph/0.08) : 0;
  // (squinting at a star, its iris takes on the star's colour)
  const fc = tg.farColor || ICE_P, mx = Math.max(fc[0], fc[1], fc[2], 1e-3), ks = q.kind === 'star' ? 0.7*smooth(PT.GO, PT.GO + 1, u)*(1 - smooth(PT.WK, PT.WK + 0.8, u)) : 0;
  q.iris = V.lerp(ICE_P, [fc[0]/mx, fc[1]/mx, fc[2]/mx], ks);
  pipOrient(q, near ? cam.up : up, { roll, spin, nod, kL, tan, inw });
  // its break-up: coming out and going home (the cells' size and the way to the bay are fixed as each starts, from where it is then)
  if (u < PT.ASM + 0.6){ if (q.brk !== -1) pipBreak(q, -1); }
  else if (u >= PT.DIS0 - 0.02){ if (q.brk !== 1) pipBreak(q, 1); }
  else q.brk = 0;
  q.dm = u < PT.ASM + 0.02 ? -1 : u >= PT.DIS0 ? 1 : 0;
  q.dg = q.dm < 0 ? PIP_GHI - (PIP_GHI - PIP_GLO)*clamp((u - PT.ASM0)/(PT.ASM - PT.ASM0), 0, 1) : q.dm > 0 ? PIP_GLO + (PIP_GHI - PIP_GLO)*clamp((u - PT.DIS0)/(PT.DIS - PT.DIS0), 0, 1) : 0;
  q.pres = q.dm ? clamp((PIP_GHI - q.dg)/(PIP_GHI - PIP_GLO), 0, 1) : 1;
  // the bay glows as embers leave it and as they arrive (brighter with each arrival)
  const [na, done] = pipArrivals(q, u - dt, u); q.embIn = q.brk ? done : q.embIn;
  q.arr = q.arr*Math.exp(-dt/0.18) + na*0.08;
  const streaming = q.brk > 0 ? envW(PT.DIS0, PT.DIS + 0.6, u, 0.2) : q.brk < 0 ? envW(0, PT.ASM, u, 0.2) : 0;
  S_.em[3] = Math.max(S_.em[3], Math.min(0.35*streaming + (q.brk > 0 ? q.arr : 0), 1.3));
};
// (the looks review's buttons, while Pip is out: it goes home now, smoothly. At its spot by the ship with nothing under way (no flight, loop,
// hop, wiggle, spin or lean) it starts breaking up into the bay at once; otherwise its own clock runs three times as fast (every move is a
// smooth function of it) until it is. No more pictures. It moves its own clock on, never the route's. true once it is breaking up)
drone.hurry = dt => {
  const q = PIP, A = q.A; if (q.st !== 'out' || !A) return false;
  const u = S_.t - A.t0, a = pipActs(q), far = q.kind !== 'near';
  if (u >= PT.DIS0 - 0.05) return true;
  q.shots = q.nShots;
  const busy = u < PT.SPIN + 0.05 || envW(a.peek[0], a.peek[1], u, 0.15) > 0.001 || q.at.some(ts => u > ts - 0.05 && u < ts + 0.55) || (u > a.loop[0] - 0.02 && u < a.loop[1] + 0.02) ||
    (a.bye && u > a.bye[0] - 0.02 && u < a.bye[1] + 0.02) || (u > a.back[0] - 0.02 && u < a.back[1] + 0.02) || (far && u >= PT.GO && u < PT.HM + 0.02);
  if (!busy){ A.t0 = S_.t - PT.DIS0; return true; }
  A.t0 -= 2*(dt || 0); return false;
};
// near a black hole, while it works at its spot in the camera's view: a spot picked afresh for where the camera is now (the bridge, or the
// looks review's view from above); Pip glides there on its spring
drone.reframe = () => {
  const q = PIP; if (q.st !== 'out' || q.kind !== 'near' || !q.H || !q.H.c || !camNear() || !(S_.t - q.A.t0 < PT.DIS0)) return;
  if (q.H2) q.H2 = pipHello(); else q.H = pipHello();
};
// its frame from where it looks (+y) and which way is up (+z: the view's up with the camera near, else the ship's), with its flourishes: a
// loop (it faces the way it flies, head toward the middle), a spin about its up, a nod, a roll (the wiggle, the tilt of its head)
function pipOrient(q, up, fx){
  let body = q.body, upR = up;
  if (fx && fx.kL > 0 && fx.tan){ body = slerpDir(body, fx.tan, fx.kL); upR = slerpDir(up, fx.inw, fx.kL); }
  // (when it looks nearly straight up, the side axis leans on the view's right instead, smoothly, so its frame never flips)
  let ax = V.cross(body, upR); const la = V.len(ax), alt = V.cross(body, near3(q));
  ax = V.add(ax, V.mul(alt, 1 - smooth(0.1, 0.35, la))); ax = V.len(ax) > 1e-6 ? V.norm(ax) : q.ax; q.ax = ax;
  let R = frameY(body, ax);
  if (fx && fx.spin) R = M3.mul(R, M3.rotZ(fx.spin));
  if (fx && fx.nod) R = M3.mul(R, M3.rotX(fx.nod));
  const roll = (fx ? fx.roll : 0)*(reduceMotion ? 0.4 : 1);
  if (roll) R = M3.mul(R, M3.rotY(roll));
  drone.rot = drone.R0 = R;
  const lp = M3.applyT(R, q.pupil); q.px = clamp(lp[0]/0.55, -1, 1); q.pz = clamp(lp[2]/0.55, -1, 1);
}
const near3 = q => camNear() ? cam.right : localPt([0, 0, 1]).map(x => x/ship.rad);
// held still for a test or a screenshot: at a spot in the ship's frame (at, ship radii) or in the camera's (cam: right, up, ahead, ship radii),
// looking at the camera (look: a turn of the gaze right and up; eyes: only the pupil turns), with a given face
function pipPose(o){
  const q = PIP; q.st = 'pose'; q.dm = 0; q.dg = 0; q.pres = 1; q.brk = 0;
  const pos = o.cam ? V.add(V.mul(ship.rel, -1), V.mul(V.add(V.add(V.mul(cam.right, o.cam[0]), V.mul(cam.up, o.cam[1])), V.mul(cam.fwd, o.cam[2])), ship.rad)) : localPt(o.at || [0.12, -1.3, 0.6]);
  q.pos = pos; drone.offset = pos; drone.pos = V.add(ship.pos, pos);
  const toCam = V.norm(V.mul(V.add(ship.rel, pos), -1)), lk = o.look || [0, 0];
  const want = V.norm(V.add(toCam, V.add(V.mul(cam.right, lk[0]), V.mul(cam.up, lk[1]))));
  q.pupil = want; q.body = o.eyes ? toCam : want;
  q.open = o.open ?? 1; q.mood = o.mood ?? 0; q.glow = o.glow ?? 1; q.thr = o.thr ?? 0.25; q.lamp = o.lamp ?? 0; q.scale = o.scale ?? 1; q.unfold = o.unfold ?? 1;
  q.ant = o.ant ?? 0; q.iris = o.iris || ICE_P; q.tail = 0.35 + 0.65*q.thr;
  pipOrient(q, V.norm(localPt([-1, 0, 0])), null);
}
// how much of its volume shows (a glint takes over below about 3.5 pixels), 0 where the hull or the body is in front of it
function pipVis(){
  const q = PIP; if (q.st === 'stowed' || !progReady(drone.prog)) return 0;
  const rpx = drone.rad*q.scale/Math.max(drone.dist, 1e-300)*sceneH*0.5/tanY;
  return smooth(1.5, 3.5, rpx)*(pipHidden(drone.rel) ? 0 : 1);
}
// drawn straight after the ship's own volume, so the hull never paints over it (the two share one bounding sphere, and volumes are sorted only by
// their centres); where the hull is really in front of it, it is hidden instead
ship.drawAfter = () => { const v = pipVis(); PIP.vis = v; if (v > 0.003 && PIP.pres > 0.003) drawVolume(drone, drone.prog, drone.rel, drone.rad, pr => drone.setU(pr), drone.rot, v); };
// the rest of it, with the ship's effects (haloDraw): the glint far away, its trail, the spot its lamp lights on the ground, its embers
function pipDraw(){
  const q = PIP; if (q.st === 'stowed') return;
  const v = pipVis(), p = drone.rel;
  if (!pipHidden(p) && v < 0.999 && V.dot(p, cam.fwd) > 0) P_(p, [0.62, 0.86, 1], (0.9 + 0.4*q.thr)*(1 - v)*q.pres, -3);
  for (const t of q.trail){ const pp = V.add(ship.rel, t.r), f = 1 - t.age/0.5; if (f > 0 && !pipHidden(pp)) P_(pp, [0.5, 0.75, 1], 0.5*f*(1 - 0.6*v), -2); }
  if (q.spot && q.lamp > 0.01 && q.A){ const tg = q.A.tg, s = V.add(tg.rel, q.spot); if (!behindSphere(s, tg.rel, surfDrawn(tg)*0.998)) P_(s, [0.75, 0.9, 1], 0.3*q.lamp, surfDrawn(tg)*0.03); }
  if (q.A && q.brk) pipEmbers(q, S_.t - q.A.t0);
}
// what the readout says (the job's line)
function pipLine(A){
  const q = PIP, nm = pipName(A.tg), u = S_.t - A.t0, k = q.A === A ? q.kind : pipKind(A.tg), acts = PIP_ACTS[k === 'near' ? 'near' : 'far'], far = k !== 'near';
  if (u < 0) return 'approaching ' + A.tg.name + " · Pip, the ship's drone, gets ready";
  if (u < PT.OPEN) return 'Pip streams out of the belly bay and takes shape';
  if (u < PT.HI) return 'Pip says hello';
  if (u < PT.SPIN) return 'Pip does a happy spin';
  if (u < acts.peek[1]) return 'Pip peeks at ' + nm;
  // (near a black hole or a magnetar it stays by the ship: a choice of the story, not physics, so no reason is given)
  if (far && u < PT.AT) return k === 'cloud' ? 'Pip flies out ahead toward ' + nm : 'Pip flies down to ' + nm;
  const pic = ` · picture ${Math.max(q.shots, 1)} of ${q.nShots}`;
  if (far && u < PT.WK) return (k === 'land' ? `Pip lights up ${q.gas ? 'the cloud tops' : 'the ground'}` : k === 'star' ? 'Pip squints at ' + nm : 'Pip takes pictures of ' + nm) + pic;
  if (u >= acts.loop[0] && u < acts.loop[1]) return 'Pip loops the loop';
  if (u >= acts.back[0] && u < acts.back[1]) return 'Pip looks back at the ship';
  if (!far && u < acts.back[0]) return `Pip takes pictures of ${nm} from beside the ship` + pic;
  if (acts.bye && u >= acts.bye[0] && u < acts.bye[1]) return 'Pip waves goodbye';
  if (far && u < PT.HM) return 'Pip flies home to the Halo';
  if (u < PT.DIS0) return far ? 'Pip is home' : 'Pip gets ready to go in';
  if (u < PT.IN) return 'Pip streams back into the belly bay';
  return `Pip is back aboard · ${q.nShots} pictures of ${nm}`;
}
drone.reset = () => { Object.assign(PIP, pipFresh()); };
// whether it is in the picture: in front of the camera and inside the view, big enough to draw, and not hidden by the hull or the body (the
// geometry only, so a test can ask without drawing)
function pipShows(){
  const q = PIP; if (q.st === 'stowed') return false;
  const rpx = drone.rad*q.scale/Math.max(drone.dist, 1e-300)*sceneH*0.5/tanY;
  return rpx > 1.5 && onScreen(drone.rel, 1) && !pipHidden(drone.rel);
}
// a read-only view of it (for the Halo's sounds later), and the test hooks: its state, a pose to hold it in, its look
// (bayD: how far it is from the bay, in ship radii; minAlt: its lowest height over the drawn surface on this job, in surface radii, as the
// controller keeps it; shows: pipShows; pres: how much of it is there; embIn: the share of its embers that has arrived, in the bay going home)
Object.defineProperty(drone, 'state', { get:() => ({ st:PIP.st, kind:PIP.kind, shots:PIP.shots, flash:PIP.flash, thr:PIP.thr, vis:PIP.vis, pos:PIP.pos.slice(), minAlt:PIP.minAlt,
  bayD:V.len(V.sub(PIP.pos, localPt(HULL.bay)))/ship.rad, shows:pipShows(), scale:PIP.scale, pres:PIP.pres, brk:PIP.brk, embIn:PIP.embIn, embN:PIP.embN, mood:PIP.mood, open:PIP.open }) });
ship.dbg.drone = { get state(){ return drone.state; }, pose(o){ PIP.pose = o || null; if (!o) pipStow(); }, setLook:v => drone.setLook(v), get look(){ return droneLook; }, PT, ACTS:PIP_ACTS };
// review only: with ?drone= in the address (or the looks review), a small chip switches between the looks (under the shield's and the fold's: reviewChip)
if (DRONE_Q || REVIEW_SC){
  const chip = reviewChip('Pip', 'Drone look (review)', ['A', 'B', 'C'], i => i + 1), pick = v => { drone.setLook(v); sync(); toast(DRONE_NAMES[v]); };
  const sync = () => { for (const b of chip.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.v === droneLook); };
  chip.addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.v); });
  sync();
}

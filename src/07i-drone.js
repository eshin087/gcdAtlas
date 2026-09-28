
// ================================================================ Pip, the Halo's little drone (made up, like the ship): an eye-pod about 100 m tall, a fortieth of the
// ship's length. It lives in the belly bay. On a probe job (ACT.probe in 07h-halo.js) it streams out of the bay as embers, takes shape beside
// the ship and potters about it for half a minute, never more than about 2 ship radii away and never touching the hull: two or three of its
// four outings (a hull check and polish, engines and repairs, photos and a wave, play), in an order, on paths and with timings of their own,
// with a launch and a way home that vary too. Then it breaks up into embers that stream back into the bay. The job waits for it (done()), so
// the ship never leaves while it is out. It is a small volume of its own (FS_DRONE), drawn right after the ship (ship.drawAfter) so the hull
// never covers it by mistake, and hidden wherever the hull or the body is in front of it (volumes have no depth test). Far away it is a steady
// ice-blue glint. Its controller is drone.ctl, run once a tick after the camera has moved (AFTER_CAM), on the job's own clock; its dice come
// from lcg, never hrnd, so the Halo's route stays the same. This file must load after 07h-halo.js (it uses S_, HULL, ACT and the hull's outline).
const FS_DRONE_BODY = `
// Local frame: bounding sphere 1, +y the way it looks (its eye), +z up, x across. An eye-pod: a black egg with one big eye, two tiny
// crescent fins (the ship's arms in miniature), an antenna and a thruster ring.
// uP0: x the eye open (0 shut, 1 open), y the iris's glow (1; above 1 it flashes white for a picture), z the thruster, w mood (> 0 a happy
// squint, < 0 narrowed)   uP1: xyz the light's direction (world), w unfold (the fins, wings and antenna tuck in when it is stowed)
// uP2: xy where the pupil looks (in the eye's plane, -1..1), z the antenna's wink, w the lens lamp   uP3: rgb the iris's colour, w how much of
// it is there (1 whole; its glows fade with it as it breaks up)
// uM0 column 0: its scale; column 1: its break-up into embers (dissolve g, mode 1 leaving / -1 arriving /
// 0 whole, the cells' size); column 2: toward the ship's bay, in its own frame (the side nearest the bay goes last and comes back first)
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/max(k1, 1e-5); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float sq(float x){ return x*x; }
float lampD(vec3 o, vec3 d, vec3 c, float s, float front){ return dot(c - o, d) < front ? pblob(o, d, c, s) : 0.; }
// the eye: a glass dome on the front (centre EC, half sizes ED), with a silver bezel round it; NZ the thruster's nozzle
const vec3 EC = vec3(0., 0.355, 0.1), ED = vec3(0.235, 0.09, 0.235), NZ = vec3(0., -0.42, -0.03);
float gId = 0.;
float map(vec3 p){
  float u = uP1.w, d, fin = 1e9, trim = 1e9;
  // an egg, its top a little fuller, with two swept fins and an antenna; a ring round the thruster at the back
  vec3 q = p - vec3(0., 0., -0.03); float tq = 1. + 0.12*clamp(q.z/0.54, -1., 1.);
  d = sdEll(vec3(q.xy/tq, q.z), vec3(0.42, 0.4, 0.54))*0.85;
  vec3 pf = vec3(abs(p.x), p.y, p.z), f0 = vec3(0.37, 0.02, 0.02), f1 = vec3(0.41 + 0.15*u, -0.1 - 0.05*u, 0.09 + 0.05*u), f2 = vec3(0.43 + 0.17*u, -0.19 - 0.15*u, 0.19 + 0.11*u);
  fin = min(sdCap(pf, f0, f1, 0.03), sdCap(pf, f1, f2, 0.021));
  fin = min(fin, sdCap(p, vec3(0., -0.06, 0.47), vec3(0., -0.12, 0.51 + 0.17*u), 0.016));
  trim = length(vec2(length(p.xz - vec2(0., -0.03)) - 0.14, p.y + 0.385)) - 0.028;
  float eye = sdEll(p - EC, ED)*0.9;
  float bez = length(vec2(length(vec2(p.x, p.z - EC.z)) - ED.x - 0.006, p.y - EC.y + 0.004)) - 0.022;
  gId = 0.;
  if(fin < d){ d = fin; gId = 3.; }
  float tr = min(trim, bez); if(tr < d){ d = tr; gId = 2.; }
  if(eye < d){ d = eye; gId = 1.; }
  return d;
}
// its cells (cubes uM0[1].z wide in its own frame): a cell is gone while g is past its threshold, a front along the way to the bay plus a random
// share from an integer hash. pipCellThr in JS gives each the same threshold, so its embers leave each cell (or land on it) as it goes.
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
  // (sm: how small it is on screen, 0 from a radius of about 40 pixels up, 1 at 10 and under: its outline and fins grow brighter and bolder
  // as it shrinks, so it keeps its shape at the few characters it covers riding along)
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
    if(id > 2.5) col = hull*(dif*1.3 + 0.4) + silver*(0.25 + 1.2*rim + spec + 0.6*sm);   // fins and antenna (lit when small)
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
    if(id < 0.5) col += silver*exp(-sq((p.z + 0.12)/0.012))*(0.3 + 0.5*dif);   // a silver seam round its waist
    // (the burn: from a blue glow to white-hot, like the ship's cells in a fold)
    // (toned down from the ship's: a small body whose cells all burn at once read as a white blob)
    col = mix(col, mix(vec3(0.3, 0.48, 1.), vec3(1.3, 1.5, 1.8), heat*heat*heat), 0.85*smoothstep(0., 0.55, heat));
    alpha = 1.;
  }
  float front = hit ? t : 1e9, pres = uP3.w;
  // tiny (a radius of about three scene pixels and under, as it is riding along): a crisp silver ring round its outline about a pixel out, and
  // from in front its eye a saturated ice-blue glow a pixel or two wide (not so bright that it turns white), so the two or three characters it
  // covers still read as a black pod with a silver outline and one blue eye. Both fade out as it grows and its own shading takes over.
  float px = uPix*length(o), ic = smoothstep(0.14, 0.34, px), face = smoothstep(0.05, 0.45, -d.y);
  if(ic > 0.){
    float rr = length(o - d*dot(o, d)), R = 0.5 + 0.75*px, w = 0.42*px;
    col += silver*exp(-sq((rr - R)/w))*1.05*ic*pres*(hit ? 0.25 : 1.);
    col += irisC*vec3(0.5, 0.78, 1.)*blob(o, d, EC + vec3(0., 0.08, 0.), max(0.15, 0.85*px))*3.*uP0.y*max(uP0.x, 0.25)*face*ic*pres;
  }
  // the lens lamp: light pouring out of the eye onto what it looks at
  if(uP2.w > 0.01) col += mix(ice, white, 0.5)*blob(o, d, EC + vec3(0., 0.24, 0.), 0.1)*uP2.w*face*1.4*pres;
  col += white*lampD(o, d, vec3(0., -0.125, 0.53 + 0.17*uP1.w), 0.03, front + 0.02)*(10. + 24.*uP2.z)*pres;   // the antenna's lamp, winking now and then
  // the thruster: a nozzle glow and a short plume that fades well inside the bounding sphere
  float th = uP0.z, behind = dot(NZ - o, d) > front ? 0.15 : 1.;   // (the body hides most of a plume behind it)
  float PL = 0.1 + 0.25*th;
  col += jet(o - NZ, d, vec3(0., -1., 0.), PL, 0.03, 0.06, 0.5, tm*6., vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(1. + 10.*th)*th*behind*pres;
  col += mix(white, ice, 0.4)*lampD(o, d, NZ, 0.035, front + 0.02)*(2. + 7.*th)*pres;
  outCol(col, alpha);
}`;
// (highp int: the cells' hash needs 32-bit integers to match pipHash in JS)
P.drone = program(VS_RECT, COMMON + `precision highp int;\n#define RM ${reduceMotion ? 1 : 0}\n` + FS_DRONE_BODY);

// ---------------------------------------------------------------- its state: where it is (ship-relative, world axes), where it looks, its face
// (st: 'stowed', 'out' on a job, 'pose' held by a test or a screenshot; kind: 'near' by a black hole or a magnetar, where its outings are
// gentler and it keeps closer to the ship, otherwise 'land', 'star' or 'cloud' as the body is)
const ICE_P = [0.6, 0.83, 1];
// (all of its state as on page load: drone.reset puts it all back, so a test's result never depends on the job before it)
// plan: its outing (pipPlan); anc, ancV: where it is by the ship (ship axes, ship radii) and how fast that moves, on the plan but for an error
// (err, errV) that a jump in the plan leaves and a critically damped spring takes away (pipAnchor); bk: a break-up into embers under way (null while it is whole): its mode (-1 taking shape, 1 going home), its progress
// (bp from u0 at rate), its cells' size (cs), the way to the bay in its own frame (bayL) and its cells (cells); last, lastActs: the outing
// before (never the same one twice in a row); fin: this job's outing is over (the job is done)
const pipFresh = () => ({ st:'stowed', A:null, kind:'land', plan:null, g:null, last:'', lastActs:'', fin:false, u:-9, pos:[0, 0, 0], pupil:[0, 1, 0], body:[0, 1, 0],
  ax:[1, 0, 0], open:1, blinkIn:3, blinkT:9, glow:1, flash:0, thr:0, mood:0, unfold:0, scale:1, shots:0, lamp:0, px:0, pz:0, ant:0, iris:ICE_P.slice(), trail:[],
  trAcc:0, vis:0, pose:null, anc:null, ancV:[0, 0, 0], err:[0, 0, 0], errV:[0, 0, 0], Tp:null, spot:null, hurry:false, home:false, bk:null, bp:0, dg:0, dm:0, pres:1, cs:0.27, bayL:[0, 0, 1],
  cells:null, brk:0, wz:1, arr:0, embN:0, embIn:0, rb:lcg(7), clr:9, far:0, bobK:0, wasOut:false });
const PIP = pipFresh();
const DM0 = new Float32Array(9);
// its size: its bounding sphere in ship radii (0.04: a third of 0.8's Pip). Its body reaches 0.54 of that from its centre, so the clearance it
// keeps from the hull (PIP_R, below) follows it
const PIP_SIZE = 0.04;
const drone = addObj({ key:'halo-drone', name:'Pip', label:'', type:"the Halo's little drone (made up)", group:'travel', layer:3, parent:ship, offset:[0, 0, 0], pos:[0, 0, 0],
  rad:PIP_SIZE*ship.rad, prog:P.drone, selfPos:true, hidden:true, noPick:true, noLabel:true, noImpostor:true, atlas:false, noWaypoint:true,
  // (lit like the ship: by the Sun, or by the showcase's fixed light)
  setU(pr){ const S = ship.S, q = PIP, L = S.light ? M3.apply(ship.R0, V.norm(S.light)) : V.norm(V.sub(sun.rel, this.rel)), c = q.iris, b = q.bayL;
    gl.uniform4f(pr.u.uP0, q.open, q.glow, q.thr, q.mood); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], q.unfold);
    gl.uniform4f(pr.u.uP2, q.px, q.pz, q.ant, q.lamp); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], q.pres);
    DM0[0] = q.scale; DM0[3] = q.dg; DM0[4] = q.dm; DM0[5] = q.cs; DM0[6] = b[0]; DM0[7] = b[1]; DM0[8] = b[2];
    gl.uniformMatrix3fv(pr.u.uM0, false, DM0); } });
const pipKind = tg => isHoleTarget(tg) || RS_KM[tg.key] ? 'near' : !surfOf(tg) ? 'cloud' : tg === sun || tg.group === 'stars' ? 'star' : 'land';
const pipName = tg => tg.label && tg.label.length < tg.name.length && !/^the /.test(tg.name) ? tg.label : tg.name;
const envW = (a, b, u, r) => smooth(a, a + r, u)*(1 - smooth(b - r, b, u));
const localDir = v => M3.apply(ship.R0, v);                                   // a direction in ship axes, in world axes
const camL = () => M3.applyT(ship.R0, V.mul(ship.rel, -1/ship.rad));          // the camera, in ship axes and ship radii

// ---------------------------------------------------------------- the hull as the ship's shader draws it (map() in FS_SHIP_BODY), in ship radii and ship axes: Pip keeps
// its body (PIP_R across its middle) clear of it, follows its plates and lands on it
const PIP_R = 0.575*PIP_SIZE;   // (its body's radius in ship radii, 0.54 of its own radius, and a little: 0.023)
const sdCapJS = (px, py, pz, ax, ay, az, bx, by, bz, r) => { const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax*bax + pay*bay + paz*baz)/(bax*bax + bay*bay + baz*baz), 0, 1); return Math.hypot(pax - bax*h, pay - bay*h, paz - baz*h) - r; };
const sdEllJS = (x, y, z, a, b, c) => { const k0 = Math.hypot(x/a, y/b, z/c), k1 = Math.hypot(x/(a*a), y/(b*b), z/(c*c)); return k0*(k0 - 1)/Math.max(k1, 1e-9); };
// (the bow, its spine, the bridge and the pod under it, the arms, the engine nacelles and their rings, the heart: as map() in the shader)
function hullD(x, y, z){
  const w = Math.abs(z), db = bowPlanJS(y, w), bow = Math.max(db, Math.abs(x) - Math.min(0.6*Math.max(-db, 0), 0.054 - 0.034*smooth(0, 0.83, y)))*0.86;
  const det = Math.min(sdCapJS(x, y, z, -0.05, -0.06, 0, -0.024, 0.5, 0, 0.009), sdEllJS(x + 0.058, y - 0.035, z, 0.016, 0.075, 0.022), sdEllJS(x - 0.05, y - 0.06, z, 0.018, 0.2, 0.03));
  const da = armPlanJS(y, w), arm = Math.max(da, Math.abs(x - liftJS(w)) - Math.min(0.45*Math.max(-da, 0), 0.026))*0.85;
  const xe = liftJS(0.29), nac = Math.min(sdCapJS(x, y, w, xe, -0.832, 0.287, xe - 0.006, -0.63, 0.305, 0.017), Math.hypot(Math.hypot(x - xe, w - 0.289) - 0.024, y + 0.775) - 0.005);
  return Math.min(bow, det, arm, nac, Math.hypot(x, y + 0.3, z) - 0.038);
}
const hullDp = p => hullD(p[0], p[1], p[2]);
// the way out of the hull there (its gradient)
function hullN(p){ const e = 0.002, x = p[0], y = p[1], z = p[2];
  return V.norm([hullD(x + e, y, z) - hullD(x - e, y, z), hullD(x, y + e, z) - hullD(x, y - e, z), hullD(x, y, z + e) - hullD(x, y, z - e)]); }
// a point kept at least c from the hull: one that is closer is moved out along the way out
function hullOut(p, c){ for (let k=0;k<3;k++){ const d = hullDp(p); if (d >= c) return p; p = V.add(p, V.mul(hullN(p), c - d)); } return p; }
// the top of the hull (its dorsal side, -x) over a point (y, z) of the ship's plane: where a line straight down meets it; null where there is none
function hullTop(y, z){ let x = -0.3; for (let i=0;i<80;i++){ const d = hullD(x, y, z); if (d < 3e-4) return x; x += Math.max(d, 0.0015); if (x > 0.1) return null; } return null; }
// a point on an arm's midline (ua: 0 at the shoulder, 1 at the tail), as armPlan in the shader: its y and z (sd: -1 left, 1 right)
function armPt(ua, sd){ const th = 0.698 + 1.1*ua, cf = Math.max(1 - (0.508 - ua)/0.1, 0), cr = Math.max(1 - (ua - 0.508)/0.2, 0), cl = ua < 0.508 ? cf*Math.sqrt(cf) : cr*cr;
  const wd = 0.089*smooth(0, 0.45, ua)*(1 - smooth(0.68, 1, ua)) + 0.063*cl, rm = 0.68 - wd/2; return [-0.567 + rm*Math.cos(th), sd*(-0.33 + rm*Math.sin(th))]; }
// a spot h over the plates at (y, z), at least c from the hull all round (where the plates slope, straight up is not the nearest way)
const overHull = (y, z, h, c = Math.min(h, PIP_R + 0.004)) => hullOut([(hullTop(y, z) ?? -0.03) - h, y, z], c);

// ---------------------------------------------------------------- the outing: a plan of moves one after another, on its own clock (u: seconds after launch). A move says
// where Pip is (at(u, g): ship axes, ship radii), where it looks (look), how it moves on top of that (fl: rolls, spins, nods, hops), its face
// (mood, open, lamp, thr), its effects and what the readout says (say). A flight between two moves (fly) is worked out as it starts (flyPrep):
// a smooth curve from where the last move left Pip, at its speed, to where the next one begins, at that one's speed, bent round the hull where a
// straight one would graze it. So Pip keeps to one smooth path; the spring (pipAnchor) only has to smooth a plan cut short (drone.hurry).
const PIP_LAUNCH = 0.3, PIP_ASM = 2.5, PIP_DIS = 2.5, PIP_HURRY = 1.2;
const mv = (P, T, o) => { o.dur = T; o.a = o.a || P.a; P.segs.push(o); return o; };
const fly = (P, o) => { const g = Object.assign({ fly:true, look:'fly', sp:P.near ? 0.32 : 0.55, a:P.a, bodyT:0.18 }, o);
  if (P.zip){ Object.assign(g, { sp:1.1, thr:1, trail:true, say:'Pip zips out' }); P.zip = false; }
  g.at = flyAt; P.segs.push(g); return g; };
const sOf = (u, g) => clamp((u - g.t0)/g.dur, 0, 1);
const hold = p => () => p;
// a smooth path through points at an even pace (Hermite pieces, tangents from the points either side over the distance between them)
function crPath(pts){
  const n = pts.length, L = [0]; for (let i=1;i<n;i++) L.push(L[i - 1] + V.len(V.sub(pts[i], pts[i - 1])));
  const tan = i => V.mul(V.sub(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]), 1/Math.max(L[Math.min(i + 1, n - 1)] - L[Math.max(i - 1, 0)], 1e-9));
  const f = s => { const d = clamp(s, 0, 1)*L[n - 1]; let i = 0; while (i < n - 2 && L[i + 1] < d) i++; const l = Math.max(L[i + 1] - L[i], 1e-9), t = (d - L[i])/l;
    return hermV(pts[i], V.mul(tan(i), l), pts[i + 1], V.mul(tan(i + 1), l), t); };
  f.len = L[n - 1]; return f;
}
function hermV(p0, m0, p1, m1, s){ const s2 = s*s, s3 = s2*s, a = 2*s3 - 3*s2 + 1, b = s3 - 2*s2 + s, c = -2*s3 + 3*s2, d = s3 - s2;
  return [a*p0[0] + b*m0[0] + c*p1[0] + d*m1[0], a*p0[1] + b*m0[1] + c*p1[1] + d*m1[1], a*p0[2] + b*m0[2] + c*p1[2] + d*m1[2]]; }
const hermP = (h, u) => { const T = h.t1 - h.t0; return hermV(h.p0, V.mul(h.v0, T), h.p1, V.mul(h.v1, T), clamp((u - h.t0)/T, 0, 1)); };
function flyAt(u, g){ const H = g.pc; let j = 0; while (j < H.length - 1 && u > H[j].t1) j++; return hermP(H[j], u); }
// (a curve that comes closer to the hull than both its ends do, between a sixth and five sixths of the way, gets a knot pushed out over it,
// twice at most and never on a piece shorter than 0.4 s; near its ends it keeps to the clearance the moves there were given, which can be
// small: hovering over a plate, landing on it)
function hermRound(h, depth){
  const T = h.t1 - h.t0, lim = Math.min(0.034, 0.75*Math.min(hullDp(h.p0), hullDp(h.p1)));
  let worst = 9, ws = 0.5;
  for (let i=2;i<=10;i++){ const s = i/12, d = hullDp(hermP(h, h.t0 + s*T)); if (d < worst){ worst = d; ws = s; } }
  if (worst > lim || depth <= 0 || T < 0.4) return [h];
  const tm = h.t0 + ws*(h.t1 - h.t0), m = hullOut(hermP(h, tm), 0.08), vm = V.mul(V.sub(h.p1, h.p0), 1/(h.t1 - h.t0));
  return [...hermRound({ t0:h.t0, t1:tm, p0:h.p0, v0:h.v0, p1:m, v1:vm }, depth - 1), ...hermRound({ t0:tm, t1:h.t1, p0:m, v0:vm, p1:h.p1, v1:h.v1 }, depth - 1)];
}
function flyPrep(P, k){
  const g = P.segs[k], a = P.segs[k - 1], b = P.segs[k + 1], e = 0.01, p0 = a.at(g.t0, a);
  if (b.prep) b.prep(b, p0);
  const v0 = V.mul(V.sub(p0, a.at(g.t0 - e, a)), 1/e), p1 = b.at(g.t1, b), v1 = V.mul(V.sub(b.at(g.t1 + e, b), p1), 1/e);
  g.pc = hermRound({ t0:g.t0, t1:g.t1, p0, v0, p1, v1 }, 2);
}
// the moves' times: in order, each flight as long as its way needs at its pace
function pipLayout(P){
  let t = 0; const S = P.segs;
  for (let i=0;i<S.length;i++){
    const g = S[i];
    if (g.fly){ const a = S[i - 1], b = S[i + 1], p0 = a.at(a.t1, a); b.t0 = 0; b.t1 = b.dur; if (b.prep) b.prep(b, p0);
      g.dur = clamp(0.5 + V.len(V.sub(b.at(0, b), p0))/g.sp, g.sp > 1 ? 0.6 : 0.8, P.near ? 3 : 2.6); }
    g.t0 = t; g.t1 = t += g.dur;
  }
  P.DIS0 = S[S.length - 1].t0;
}
// (the segments up to u become current in turn: a flight is worked out as it starts, a move may do something as it starts)
function pipActivate(P, u){
  while (P.k < P.segs.length - 1 && u >= P.segs[P.k].t1){ P.k++; const g = P.segs[P.k]; if (g.fly) flyPrep(P, P.k); if (g.on) g.on(g); }
}
// where the plan puts it at u (ship axes, ship radii), never closer to the camera than 0.3 ship radii (on the bridge the window it polishes is
// half that from the camera: there it would fill a third of the screen)
function pipAt(P, u){
  let i = P.k; while (i > 0 && u < P.segs[i].t0) i--;
  const g = P.segs[i]; let p = g.at(u, g);
  if (camNear()){ const c = camL(), d = V.sub(p, c), l = V.len(d); if (l < 0.3) p = V.add(c, V.mul(d, 0.3/Math.max(l, 1e-6))); }
  return p;
}
// it keeps to the plan exactly (T0, T1: where the plan puts it a step ago and now). When the plan jumps (cut short by a hurry, or pushed by a
// camera that jumped), the jump goes into an error (err, errV) that dies away on a critically damped spring, exact for any step, so Pip glides
// over and never jumps. (A spring on the whole path would cut every curve short by its acceleration over w squared: 0.02 ship radii round the
// needle, enough to land it on the hull.)
function pipAnchor(q, dt, T0, T1){
  if (!q.anc){ q.anc = T1.slice(); q.ancV = [0, 0, 0]; q.err = [0, 0, 0]; q.errV = [0, 0, 0]; q.Tp = T1.slice(); return; }
  if (!(dt > 0)) return;
  const TV = V.mul(V.sub(T1, T0), 1/dt), jump = V.sub(q.Tp, T0);   // (where the plan put it a step ago, less where it puts that moment now)
  if (V.dot(jump, jump) > 1e-14) q.err = V.add(q.err, jump);
  const w = 9, c = V.add(q.errV, V.mul(q.err, w)), x = Math.exp(-w*dt);
  q.err = V.mul(V.add(q.err, V.mul(c, dt)), x); q.errV = V.mul(V.sub(q.errV, V.mul(c, w*dt)), x);
  q.anc = V.add(T1, q.err); q.ancV = V.add(TV, q.errV); q.Tp = T1.slice();
  // (never inside the hull, whatever the error)
  const a = hullOut(q.anc, PIP_R - 0.002); if (a !== q.anc){ q.err = V.sub(a, T1); q.anc = a; }
}

// ---------------------------------------------------------------- the outings. Each builder adds its moves to the plan (P.r: its dice; k3 < 1 when there are three of them,
// so each is a little shorter). Left and right as seen from the bridge and from behind (the chase camera): left is -z.
const PIPL = {}, PIPA = {}, PIPR = {}, PLAY = {};
// -- out of the bay: it takes shape beside the ship (pipSpot), then peeks over the edge and looks round, zips off, or spirals up
PIPL.peek = (P, F) => {
  const U = [F[0] - 0.12, F[1] + 0.03, F[2]], sd = Math.sign(F[2]) || 1;
  mv(P, 3.1, { at:(u, g) => V.lerp(F, U, smooth(0, 1.2, u - g.t0)), bodyT:0.28, thr:0.2, say:'Pip peeks out and looks around',
    look:(u, g) => { const t = u - g.t0; return t < 1.1 || t > 2.4 ? 'cam' : { dir:t < 1.75 ? [-0.25, 1, -0.2*sd] : [-0.25, -1, 0.3*sd] }; },
    fl:(u, g) => { const t = u - g.t0; return { roll:0.35*sd*envW(2.4, 3.1, t, 0.2), hop:Math.sin(Math.PI*clamp((t - 2.65)/0.4, 0, 1))**2 }; } });
};
PIPL.zip = (P, F) => {
  // (a crouch toward the bay, then off at speed: the flight after it is quick)
  mv(P, 0.8, { at:(u, g) => [F[0] + 0.02*Math.sin(Math.PI*sOf(u, g)), F[1], F[2]], look:'cam', thr:0.15, say:'Pip zips out' });
  P.zip = true;
};
PIPL.spiral = (P, F) => {
  const sd = Math.sign(F[2]) || 1, slow = reduceMotion || P.near, n = slow ? 1 : 1.5, H = 0.3, rr = 0.09;
  mv(P, slow ? 3.6 : 3, { at:(u, g) => { const s = sOf(u, g), a = 2*Math.PI*n*ease(s); return [F[0] - H*smooth(0, 1, s), F[1] + rr*Math.sin(a), F[2] + sd*rr*(1 - Math.cos(a))]; },
    look:'fly', bodyT:0.15, thr:0.6, say:'Pip spirals out' });
};
// -- a hull check and polish: along the plates with its lamp on (an arm from its tail to the shoulder, or the spine from the needle), then the
// bridge window, buffed in little circles with sparkles on the glass, then a happy blink (its eye bends into an arch)
PIPA.hull = (P, k3) => {
  const r = P.r, sd = r() < 0.5 ? -1 : 1, spine = r() < 0.4, h = 0.045;
  const pts = spine ? [0.5, 0.38, 0.26, 0.14].map(y => overHull(y, 0, h)) : [0.8, 0.63, 0.46, 0.3, 0.14].map(ua => { const [y, z] = armPt(ua, sd); return overHull(y, z, h); });
  const path = crPath(pts), T = clamp(path.len/0.14, 3, 5.5)*k3;
  fly(P, { say:'Pip flies over to check the hull' });
  // (weaving a little from side to side across its way as it looks the plates over, its lamp on the plate a little ahead)
  mv(P, T, { at:(u, g) => { const s = sOf(u, g), p = path(s), t = V.sub(path(Math.min(s + 0.01, 1)), path(Math.max(s - 0.01, 0))), side = V.norm([0, -t[2], t[1]]);
      return V.add(p, V.mul(side, 0.013*Math.sin(2*Math.PI*1.1*(u - g.t0))*envW(0, 1, s, 0.15))); },
    look:(u, g) => { const a = path(Math.min(sOf(u, g) + 0.12, 1)); return [a[0] + h + 0.01, a[1], a[2]]; }, glance:r(), lamp:1, thr:0.35, bodyT:0.25, say:'Pip checks the hull' });
  const B = HULL.bridge, W = [B[0] - 0.031, B[1], 0];
  fly(P, { say:'Pip checks the hull' });
  mv(P, 2.8*k3 + 0.2, { at:(u, g) => { const t = u - g.t0, k = envW(0, g.dur, t, 0.35), a = 2*Math.PI*2.2*t; return [W[0] + 0.003*Math.sin(2*a)*k, W[1] + 0.012*Math.cos(a)*k - 0.012*k, W[2] + 0.012*Math.sin(a)*k]; },
    look:[B[0], B[1] + 0.012, 0], glance:r(), lamp:0.6, thr:0.25, fx:'polish', say:'Pip polishes the bridge window' });
  mv(P, 1.5, { at:(u, g) => [W[0] - 0.04*smooth(0, 0.75, u - g.t0), W[1], W[2]], look:'cam', mood:0.95, blinks:[0.45], thr:0.25, say:'Pip blinks happily',
    fl:(u, g) => ({ hop:0.5*Math.sin(Math.PI*clamp((u - g.t0 - 0.75)/0.45, 0, 1))**2 }) });
};
// -- engines and repairs: it checks an engine at an arm's tail, peeks into the nozzle, a puff from it pushes Pip back tumbling (gently, with no
// tumble, near a black hole or a magnetar or with reduced motion), it shakes it off, then welds a panel on the same arm (tiny sparks) and nods
PIPA.engine = (P, k3) => {
  const r = P.r, e = r() < 0.5 ? -1 : 1, nm = e < 0 ? 'left' : 'right', N = e < 0 ? HULL.engL : HULL.engR, rm = reduceMotion || P.near;
  const C1 = [N[0] - 0.045, N[1] - 0.16, N[2] + e*0.06], C2 = [N[0] - 0.028, N[1] - 0.05, N[2] + e*0.03], k = rm ? 0.5 : 1, B1 = [C2[0] - 0.07*k, C2[1] - 0.13*k, C2[2] + e*0.09*k];
  fly(P, { say:`Pip flies to the ${nm} engine` });
  mv(P, (1.8 + 0.6*r())*k3, { at:(u, g) => [C1[0], C1[1], C1[2] + 0.012*Math.sin(2*Math.PI*0.7*(u - g.t0))*envW(0, 1, sOf(u, g), 0.25)], look:N, glance:r(), lamp:0.8, thr:0.25, say:`Pip checks the ${nm} engine` });
  mv(P, 1.3, { at:(u, g) => V.lerp(C1, C2, ease(sOf(u, g))), look:N, lamp:1, thr:0.2, fl:(u, g) => ({ nod:0.3*smooth(0.3, 1, sOf(u, g)) }), say:`Pip peeks into the ${nm} engine` });
  // (the puff: shoved back hard, at full speed within a tenth of a second, easing to a stop; a tumble once round, eyes screwed shut)
  const shove = t => (1 - (1 + t/0.1)*Math.exp(-t/0.1))/(1 - 9*Math.exp(-8));
  mv(P, 0.8, { at:(u, g) => V.lerp(C2, B1, shove(clamp(u - g.t0, 0, 0.8))), puff:N, look:N, thr:0.1, mood:-0.7, open:0.4, say:'a puff from the engine pushes Pip back',
    fl:(u, g) => { const s = sOf(u, g); return rm ? { roll:0.25*Math.sin(Math.PI*s) } : { roll:2*Math.PI*(1 - Math.pow(1 - s, 3))*e, spin:0.8*Math.sin(Math.PI*s) }; } });
  mv(P, 1.1, { at:hold(B1), look:'cam', thr:0.3, mood:(u, g) => -0.5*(1 - smooth(0.3, 0.9, u - g.t0)), say:'Pip shakes it off',
    fl:(u, g) => { const t = u - g.t0; return { spin:(rm ? 0.12 : 0.4)*Math.sin(2*Math.PI*4.2*t)*envW(0, 0.9, t, 0.1) }; } });
  const [py, pz] = armPt(0.72, e), Q = overHull(py, pz, 0.034), Wc = [hullTop(py + 0.004, pz) ?? Q[0] + 0.034, py + 0.004, pz];
  fly(P, { say:`Pip fixes a panel on the ${nm} arm` });
  mv(P, 2.9*k3, { at:hold(Q), look:Wc, glance:r(), fx:'weld', weld:Wc, lamp:(u, g) => 0.55 + 0.45*Math.abs(Math.sin((u - g.t0)*47)*Math.sin((u - g.t0)*29)), thr:0.2, say:`Pip fixes a panel on the ${nm} arm` });
  mv(P, 1.0, { at:(u, g) => [Q[0] - 0.03*smooth(0, 0.6, u - g.t0), Q[1], Q[2]], look:'cam', mood:0.7, thr:0.25, say:`Pip fixes a panel on the ${nm} arm`,
    fl:(u, g) => ({ nod:0.3*Math.sin(2*Math.PI*1.6*(u - g.t0))*envW(0, 1, sOf(u, g), 0.15) }) });
};
// -- photos and a wave: it flies out ahead and up (the body is below the ship's belly), turns and snaps the Halo with the body behind it (a
// flash, and a hop), sometimes a second one from a step to the side, then comes back toward you and waves (a wiggle toward the camera)
PIPA.photo = (P, k3) => {
  const r = P.r, sd = r() < 0.5 ? -1 : 1, near = P.near, two = !near && k3 === 1 && r() < 0.6;
  const K = near ? [-0.34, 0.8, 0.2*sd] : [-0.5 - 0.12*r(), 1.1 + 0.25*r(), (0.2 + 0.18*r())*sd], K2 = [K[0] + 0.12, K[1] - 0.2, K[2] - sd*0.32];
  fly(P, { sp:near ? 0.32 : 0.85, thr:0.8, trail:!near, say:'Pip flies out ahead of the Halo' });
  mv(P, 0.9, { at:hold(K), look:'ship', thr:0.25, say:'Pip turns to face the Halo' });
  const snap = Kp => mv(P, 1.1, { at:hold(Kp), look:'ship', shot:[0.25], thr:0.2, say:`Pip snaps a photo of the Halo with ${P.nm} behind it`,
    mood:(u, g) => 0.8*envW(0.35, 1.1, u - g.t0, 0.15), fl:(u, g) => ({ hop:0.6*Math.sin(Math.PI*clamp((u - g.t0 - 0.4)/0.45, 0, 1))**2 }) });
  snap(K);
  if (two){ mv(P, 1.2, { at:(u, g) => V.lerp(K, K2, ease(sOf(u, g))), look:'ship', thr:0.4, say:'Pip moves for another photo' }); snap(K2); }
  fly(P, { sp:near ? 0.32 : 0.95, thr:0.7, say:'Pip comes back to wave' });
  const w = mv(P, 2.2*k3 + 0.2, { prep:g => { g.W = pipWaveSpot(near, sd); }, at:(u, g) => g.W, look:'cam', wave:true, mood:0.9, thr:0.2, say:() => camNear() ? 'Pip waves at you' : 'Pip waves at the bridge' });
  w.W = pipWaveSpot(near, sd);
};
// -- play: loops round the needle, races along one side with a barrel roll, rests on the hull, in an order of its own (near a black hole or a
// magnetar, or with reduced motion, a slow loop and a rest)
PIPA.play = (P, k3) => {
  const r = P.r, gentle = P.near || reduceMotion, steps = gentle ? ['loop', 'rest'] : ['loop', 'race', 'rest'];
  if (!gentle){ for (let i=2;i>0;i--){ const j = Math.floor(r()*(i + 1)); [steps[i], steps[j]] = [steps[j], steps[i]]; } if (k3 < 1) steps.length = 2; }
  for (const s of steps) PLAY[s](P, r, gentle, k3);
};
PLAY.loop = (P, r, gentle, k3) => {
  // (round the needle's axis, from over its top, drifting a little along it)
  const dir = r() < 0.5 ? -1 : 1, n = gentle || k3 < 1 ? 1 : 1 + (r() < 0.45 ? 1 : 0), yc = 0.42 + 0.14*r(), rho = gentle ? 0.12 : 0.14, adv = (r() - 0.5)*0.16;
  fly(P, { say:'Pip loops round the needle' });
  mv(P, (gentle ? 3.2 : 1.9)*n, { at:(u, g) => { const s = sOf(u, g), a = 2*Math.PI*n*s*dir; return [-rho*Math.cos(a), yc + adv*(s - 0.5), rho*Math.sin(a)]; },
    look:'fly', bodyT:0.12, loop:true, thr:0.75, trail:!gentle, say:'Pip loops round the needle' });
};
PLAY.race = (P, r) => {
  // (along one side, just outside the arm's outer edge and level with it, toward the engines or the bow; a corkscrew and a roll midway)
  const sd = r() < 0.5 ? -1 : 1, aft = r() < 0.5, Rr = 0.8, a0 = 0.8, a1 = 1.84, roll = !reduceMotion;
  const arc = s => { const th = aft ? a0 + (a1 - a0)*s : a1 - (a1 - a0)*s, w = -0.33 + Rr*Math.sin(th); return [liftJS(Math.max(w, 0.1)) - 0.012, -0.567 + Rr*Math.cos(th), sd*w]; };
  fly(P, { say:"Pip races along the Halo's side" });
  mv(P, 1.7, { look:'fly', bodyT:0.1, thr:1, trail:true,
    at:(u, g) => { const s = sOf(u, g), p = arc(s); if (!roll) return p;
      const sb = smooth(0.3, 0.8, s), a = 0.045*Math.sin(Math.PI*sb), ph = 2*Math.PI*sb, t = V.norm(V.sub(arc(Math.min(s + 0.01, 1)), arc(Math.max(s - 0.01, 0)))), n2 = V.norm(V.cross(t, [-1, 0, 0]));
      return V.add(p, V.add(V.mul([-1, 0, 0], a*Math.sin(ph)), V.mul(n2, a*(1 - Math.cos(ph))))); },
    fl:(u, g) => ({ roll:roll ? 2*Math.PI*smooth(0.3, 0.8, sOf(u, g))*sd : 0 }),
    say:(u, g) => { const s = sOf(u, g); return roll && s > 0.28 && s < 0.82 ? 'Pip does a barrel roll' : "Pip races along the Halo's side"; } });
};
PLAY.rest = (P, r) => {
  const sd = r() < 0.5 ? -1 : 1, [y, z] = armPt(0.3 + 0.18*r(), sd), S = overHull(y, z, PIP_R, PIP_R + 0.001), U = [S[0] - 0.08, S[1], S[2]];
  fly(P, { say:'Pip lands on the hull' });
  mv(P, 0.8, { at:(u, g) => V.lerp(U, S, ease(sOf(u, g))), look:[S[0] + 0.06, y + 0.04, z], thr:0.3, say:'Pip lands on the hull' });
  mv(P, 1.6 + 0.7*r(), { at:hold(S), look:'cam', rest:true, thr:0, open:0.5, mood:0.45, blinks:[1.2], say:'Pip rests on the hull' });
  mv(P, 0.7, { at:(u, g) => V.lerp(S, U, ease(sOf(u, g))), look:'cam', thr:0.7, say:'Pip rests on the hull' });
};
// -- home: to a spot beside the ship like the one it took shape at, then a goodbye wave, a quick run that overshoots and settles, a spiral
// down, or (near a black hole or a magnetar) a slow glide and a nod
PIPR.wave = (P, D) => {
  fly(P, { say:'Pip heads home' });
  mv(P, 2, { at:hold(D), look:'cam', wave:true, mood:0.85, thr:0.2, say:() => camNear() ? 'Pip waves goodbye' : 'Pip heads home' });
};
PIPR.zip = (P, D) => {
  fly(P, { sp:1.1, thr:1, trail:true, say:'Pip zips home' });
  mv(P, 0.9, { prep:(g, p0) => { g.v = V.mul(V.norm(V.sub(D, p0)), 0.5); }, v:[0, 0, 0], look:'cam', thr:0.3, say:'Pip zips home',
    at:(u, g) => { const t = u - g.t0; return V.add(D, V.mul(g.v, t*Math.exp(-7*t)*(1 - smooth(0.6, 0.9, t)))); } });
};
PIPR.spiral = (P, D) => {
  const sd = Math.sign(D[2]) || 1, n = reduceMotion ? 1 : 1.5, H = 0.28, rr = 0.09;
  const up = t => { const a = 2*Math.PI*n*ease(t); return [D[0] - H*smooth(0, 1, t), D[1] + rr*Math.sin(a), D[2] + sd*rr*(1 - Math.cos(a))]; };
  fly(P, { say:'Pip spirals home' });
  mv(P, 2.8, { at:(u, g) => up(1 - sOf(u, g)), look:'fly', bodyT:0.15, thr:0.6, say:'Pip spirals home' });
};
PIPR.glide = (P, D) => {
  fly(P, { sp:0.28, say:'Pip heads home' });
  mv(P, 1, { at:hold(D), look:'cam', mood:0.6, thr:0.2, fl:(u, g) => ({ nod:0.35*Math.sin(Math.PI*sOf(u, g)) }), say:'Pip heads home' });
};
// the spot it takes shape at and breaks up at: beside the ship off the belly bay, a little below the ship's plane and just outside the arm, so
// it shows from above and behind (where the chase camera rides) and from below; on the given side unless the camera sees only the other
function pipSpot(sd){
  const c = [0.1, -0.2, 0.47*sd], o = [0.1, -0.2, -0.47*sd];
  return camNear() && behindHull(shipPt(c)) && !behindHull(shipPt(o)) ? o : c;
}
// where it waves from: between the ship and the camera, a little to one side (1 to 2 ship radii from the ship, well clear of the camera); on the
// bridge, just ahead of the window; with no one riding along, above the bridge (it waves at the pilot)
function pipWaveSpot(near, sd){
  if (!camNear()) return [-0.5, 0.2, 0.2*sd];
  const c = camL(), d = V.len(c), rt = M3.applyT(ship.R0, cam.right), up = M3.applyT(ship.R0, cam.up), fw = M3.applyT(ship.R0, cam.fwd);
  if (d < 1.1) return hullOut(V.add(V.add(c, V.mul(fw, 0.6)), V.mul(up, 0.05)), 0.08);
  const k = clamp(d - 1.25, 0.6, near ? 0.9 : 1.9);
  return hullOut(V.add(V.add(V.mul(c, k/d), V.mul(rt, 0.13*sd*k)), V.mul(up, 0.05*k)), 0.08);
}
// the mix: two or three of the four (near a black hole or a magnetar two), in an order of its own, a launch and a way home; never the same
// outing twice in a row (r: its dice)
function pipMix(r, near, last = '', lastActs = ''){
  let acts = null, launch = '', ret = '', sig = '';
  for (let k=0;k<12;k++){
    const bag = ['hull', 'engine', 'photo', 'play'];
    for (let i=bag.length - 1;i>0;i--){ const j = Math.floor(r()*(i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    acts = bag.slice(0, near || r() < 0.55 ? 2 : 3);
    launch = near ? (r() < 0.5 ? 'peek' : 'spiral') : ['peek', 'zip', 'spiral'][Math.floor(r()*3)];
    ret = near ? (r() < 0.5 ? 'wave' : 'glide') : ['wave', 'zip', 'spiral'][Math.floor(r()*3)];
    sig = [launch, ...acts, ret].join(' ');
    if (acts.join() !== lastActs && sig !== last) break;
  }
  return { acts, launch, ret, sig };
}
// (its dice: from the visit's seed and the place, so each visit and each place gets an outing of its own, the same on every run of a route)
const pipSeed = A => A.pl.seed*7919 + [...A.tg.key].reduce((h, c) => (h*31 + c.charCodeAt(0)) % 1000003, 17);
function pipPlan(A){
  const q = PIP, near = q.kind === 'near', r = lcg(pipSeed(A)), m = pipMix(r, near, q.last, q.lastActs);
  q.last = m.sig; q.lastActs = m.acts.join();
  const side = r() < 0.5 ? -1 : 1, P = Object.assign({ t:0, k:0, segs:[], r, near, side, nm:pipName(A.tg), a:'launch', DIS0:0, IN:0 }, m), F = pipSpot(side);
  mv(P, PIP_ASM + 0.4, { at:hold(F), look:'cam', thr:0.12, say:'Pip streams out of the belly bay and takes shape' });
  PIPL[m.launch](P, F);
  const k3 = m.acts.length > 2 ? 0.85 : 1;
  for (const a of m.acts){ P.a = a; PIPA[a](P, k3); }
  P.a = 'home';
  const D = pipSpot(r() < 0.6 ? side : -side);
  PIPR[m.ret](P, D);
  mv(P, 1e6, { at:hold(D), look:'cam', thr:0.15, home:true, say:'Pip streams back into the belly bay' });
  pipLayout(P);
  P.IN = P.DIS0 + PIP_DIS + 0.1;
  return P;
}

// ---------------------------------------------------------------- hidden from the camera by the hull, or by the body it visits (camera-relative p)
function pipHidden(p){
  if (behindHull(p)) return true;
  const tg = PIP.A && PIP.A.tg; if (!tg || PIP.st === 'pose') return false;
  const sp = aimSphere(tg); return (sp.solid || sp.hole) && behindSphere(p, tg.rel, sp.r*0.998);
}
// a photo: a white flash at Pip (kept where it was taken, relative to the ship)
function pipFlash(l){
  fxAdd({ T:0.35, draw(e){ const f = 1 - e.t/e.T, p = shipPt(l); if (!pipHidden(p)){ P_(p, WHITE, 3*f*f, -8); P_(p, [0.85, 0.92, 1], 0.7*f, -16); } } });
}
// a puff from an engine's nozzle (N, ship axes): a flash in the nozzle and a burst of exhaust streaming aft, relative to the ship
function pipPuff(N){
  const r = lcg(Math.round(PIP.u*977) + 31), jets = [];
  for (let i=0;i<9;i++) jets.push({ d:V.norm([(r() - 0.5)*0.7, -1, (r() - 0.5)*0.7]), s:0.35 + 0.4*r(), w:r() });
  fxAdd({ T:0.7, draw(e){ const f = 1 - e.t/e.T, x = (1 - Math.exp(-e.t*5))/5, n = shipPt(N);
    if (!behindHull(n)) P_(n, WHITE, 3*Math.exp(-e.t/0.1), -8);
    for (const j of jets){ const a = shipPt(V.add(N, V.mul(j.d, j.s*x*0.55))), b = shipPt(V.add(N, V.mul(j.d, j.s*x))); if (!behindHull(b)) L_(a, b, [0.45, 0.7, 1], 0.12*f, e.t < 0.2 ? WHITE : [0.75, 0.9, 1], (0.5 + 0.4*j.w)*f*f); } } });
}
function pipStow(){ const q = PIP; q.st = 'stowed'; q.trail.length = 0; q.spot = null; q.lamp = 0; q.flash = 0; q.vis = 0; q.dm = 0; q.dg = 0; q.pres = 1; q.arr = 0; q.embN = 0; q.bk = null; q.brk = 0; }

// ---------------------------------------------------------------- its break-up into embers, the same look as the ship's fold (ember wind): coming out, embers stream out
// of the belly bay and settle on its cells, which appear one by one from the side nearest the bay; going home, its cells burn and go one by
// one from the far side, each sending embers streaming into the bay, which lights up as they arrive. Each takes 2.5 s (1.2 s in a hurry). The
// cells are cubes about one character on screen (PIP_CS, chosen as each break-up starts), only those on its skin, each with a few embers (about
// 100 in all); pipCellThr gives each cell the threshold thrP gives it in the shader (the same front toward the bay, the same integer hash).
// Embers are pure functions of the break-up's progress bp (0 to 1); their dice are lcg.
const PIP_CS = [0.13, 0.19, 0.27, 0.38, 0.54], PIP_TAB = new Map(), PIP_GLO = -0.25, PIP_GHI = 1.12, PIP_CW = 13;
// (the shares of a break-up: coming out, the first cell lands at FA and each ember's flight takes about FL of it; going home, the last cell goes
// at 1 - FD and each ember's flight takes up to FD)
const PIP_FA = 0.36, PIP_FL = 0.42, PIP_FD = 0.42;
function pipHash(ix, iy, iz){
  let h = (Math.imul((ix + 64) >>> 0, 0x8da6b343) + Math.imul((iy + 64) >>> 0, 0xd8163841) + Math.imul((iz + 64) >>> 0, 0xcb1ab31f) + 0x9e3779b9) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h = (h ^ (h >>> 12)) >>> 0; h = Math.imul(h, 0x297a2d39) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return (h >>> 8)/16777216;
}
const pipCellThr = (a, c, b) => 0.5 + 0.45*clamp((a[c]*b[0] + a[c + 1]*b[1] + a[c + 2]*b[2])/0.5, -1, 1) + 0.3*(a[c + 3] - 0.5);
// its body in its own frame (bounding sphere 1), as map() draws it, without the fins: the cells on its skin
function pipBodyD(x, y, z){
  const ell = (x, y, z, a, b, c) => { const k0 = Math.hypot(x/a, y/b, z/c), k1 = Math.hypot(x/(a*a), y/(b*b), z/(c*c)); return k0*(k0 - 1)/Math.max(k1, 1e-5); };
  const eye = ell(x, y - 0.355, z - 0.1, 0.235, 0.09, 0.235)*0.9, qz = z + 0.03, tq = 1 + 0.12*clamp(qz/0.54, -1, 1);
  return Math.min(ell(x/tq, y/tq, qz, 0.42, 0.4, 0.54)*0.85, eye);
}
// (numbers per ember: its cell's centre x y z in its own frame and the cell's hash, where in the cell it leaves from (x y z), then dice: flight
// time, bend, eddy radius, eddy phase, ash, keep)
function pipTable(cs){
  if (PIP_TAB.has(cs)) return PIP_TAB.get(cs);
  const C = [], n = Math.ceil(0.62/cs);
  for (let ix=-n;ix<n;ix++) for (let iy=-n;iy<n;iy++) for (let iz=-n;iz<n;iz++){
    const x = (ix + 0.5)*cs, y = (iy + 0.5)*cs, z = (iz + 0.5)*cs;
    if (Math.abs(pipBodyD(x, y, z)) <= 0.6*cs) C.push([x, y, z, pipHash(ix, iy, iz)]);
  }
  const m = clamp(Math.round(100/C.length), 1, 8), r = lcg(4243 + Math.round(cs*1000)), L = [];
  for (const c of C) for (let k=0;k<m;k++) L.push(c[0], c[1], c[2], c[3], (r() - 0.5)*0.8*cs, (r() - 0.5)*0.8*cs, (r() - 0.5)*0.8*cs, r(), r(), r(), r(), r(), r());
  const T = { cs, n:L.length/PIP_CW, cells:C.length, a:new Float64Array(L) }; PIP_TAB.set(cs, T); return T;
}
// (the cells' size: the nearest step to one character on screen, from its radius in scene pixels; two scene pixels to a character)
function pipCs(){ const rpx = drone.rad/Math.max(drone.dist, 1e-300)*sceneH*0.5/tanY, w = clamp(2.2/Math.max(rpx, 0.5), PIP_CS[0], PIP_CS[PIP_CS.length - 1]);
  let b = PIP_CS[0]; for (const c of PIP_CS) if (Math.abs(Math.log(c/w)) < Math.abs(Math.log(b/w))) b = c; return b; }
// start a break-up (mode 1 going home, -1 coming out): its cells' size and the way to the bay in its own frame, both kept to its end
function pipBreak(q, mode, rate, u0){
  q.bk = { mode, u0, bp0:0, rate, end:-1 }; q.brk = mode; q.cs = pipCs(); q.cells = pipTable(q.cs); q.wz = q.plan.r() < 0.5 ? -1 : 1;
  q.bayL = M3.applyT(drone.rot || I3, V.norm(V.sub(localPt(HULL.bay), q.pos)));
}
const pipBp = (k, u) => clamp(k.bp0 + (u - k.u0)*k.rate, 0, 1);
// ember i: when it sets off and when it gets there (break-up progress)
const EW = [0, 0];
function emberWhen(q, i){
  const A = q.cells.a, c = i*PIP_CW, thr = pipCellThr(A, c, q.bayL);
  if (q.bk.mode > 0){ EW[0] = (1 - PIP_FD)*clamp((thr - PIP_GLO)/(PIP_GHI - PIP_GLO), 0, 1); EW[1] = EW[0] + PIP_FD*(0.72 + 0.28*A[c + 7]); }
  else { EW[1] = PIP_FA + (1 - PIP_FA)*clamp((PIP_GHI - thr)/(PIP_GHI - PIP_GLO), 0, 1); EW[0] = Math.max(EW[1] - PIP_FL*(0.75 + 0.5*A[c + 7]), 0.005); }
  return EW;
}
// ember i at progress bp: where it is (ship-relative, world axes), or null when it is not out; EB[0]: how far along its way (0 to 1). It flies
// from its cell (where that is now, on Pip) to the bay going home, or from the bay to its cell coming out, on a curve that bends to one side
// (the same side for all, so they stream like a ribbon), each turning in a small eddy of its own
const EB = [0];
function emberPip(q, i, bp){
  const A = q.cells.a, c = i*PIP_CW, w = emberWhen(q, i), s = (bp - w[0])/(w[1] - w[0]);
  if (s < 0 || s > 1) return null;
  const R = drone.rot, cellP = V.add(q.pos, V.mul(M3.apply(R, [A[c] + A[c + 4], A[c + 1] + A[c + 5], A[c + 2] + A[c + 6]]), drone.rad)), bay = localPt(HULL.bay);
  const P0 = q.bk.mode > 0 ? cellP : bay, P1 = q.bk.mode > 0 ? bay : cellP, D = V.sub(P1, P0), L = V.len(D) || 1e-9, e = s*s*(3 - 2*s);
  const side = V.norm(V.cross(D, cam.fwd)), lift = V.norm(V.cross(side, D)), bend = L*(0.2 + 0.14*A[c + 8])*q.wz;
  const C = V.add(V.add(P0, V.mul(D, 0.5)), V.mul(side, bend));
  let p = V.add(V.add(V.mul(P0, (1 - e)*(1 - e)), V.mul(C, 2*(1 - e)*e)), V.mul(P1, e*e));
  const er = L*(0.03 + 0.05*A[c + 9])*Math.sin(Math.PI*s)*(reduceMotion ? 0.3 : 1), ea = 6.283*A[c + 10] + s*(5 + 4*A[c + 8]);
  p = V.add(p, V.add(V.mul(side, er*Math.cos(ea)), V.mul(lift, er*Math.sin(ea))));
  EB[0] = s; return p;
}
// how many embers get where they are going between two moments (going home: into the bay; coming out: out of it), and the share that has got
// there going home, or landed on Pip coming out
function pipArrivals(q, b0, b1){
  if (!q.cells || !q.bk) return [0, q.embIn];
  const lo = Math.min(b0, b1), hi = Math.max(b0, b1), out = q.bk.mode < 0; let n = 0, done = 0;
  for (let i=0;i<q.cells.n;i++){ const w = emberWhen(q, i), t = out ? w[0] : w[1]; if (t > lo && t <= hi) n++; if (w[1] <= b1) done++; }
  return [n, done/Math.max(q.cells.n, 1)];
}
function pipEmbers(q){
  if (!q.bk || !q.cells || !(ship.rpx > 6)) return;
  const A = q.cells.a, N = q.cells.n, keep = Math.min(1, 110/N), leaving = q.bk.mode > 0, bp = q.bp, dur = 1/Math.max(Math.abs(q.bk.rate), 1e-3); let n = 0;
  for (let i=0;i<N;i++){
    const c = i*PIP_CW; if (A[c + 12] > keep) continue;
    const p0 = emberPip(q, i, bp); if (!p0) continue;
    const s = EB[0], a = s*(EW[1] - EW[0])*dur, p = V.add(ship.rel, p0);
    if (behindHull(p)) continue;
    n++;
    const ash = A[c + 11] < 0.16;
    let b, col;
    if (leaving){
      // (white-hot as it leaves its cell, a bigger flake for its first 0.15 s, ice blue on the way, a spark as it reaches the bay; about one in
      // six a flake of grey ash, flickering)
      b = ash ? 0.8*(0.6 + 0.4*Math.sin(a*11 + A[c + 10]*30)) : 1.9*Math.exp(-a/0.15) + 0.9 + 0.5*smooth(0.75, 1, s);
      col = ash ? ASH_ : a < 0.35 ? mix3([0, 0, 0], WHITE, ICE_, a/0.35) : mix3([0, 0, 0], ICE_, DEEP_, Math.min((a - 0.35)/0.7, 1)*(1 - smooth(0.8, 1, s)));
    } else {
      // (coming out: deep blue as it leaves the bay, warming to white as it nears its cell, a spark as it lands)
      b = ash ? 0.7 : 0.8 + 1.3*smooth(0.6, 1, s);
      col = ash ? ASH_ : mix3([0, 0, 0], DEEP_, WHITE, s*s);
    }
    P_(p, col, b, (leaving ? a < 0.15 : s > 0.85) && !ash ? -3 : -2);
    if (!ash && !reduceMotion){ const pb = emberPip(q, i, bp - 0.03/dur); if (pb) L_(V.add(ship.rel, pb), p, DEEP_, b*0.05, col, b*0.3); }
  }
  q.embN = n;
  // (the sparks where they arrive, in the bay going home)
  if (leaving && q.arr > 0.02){ const bp_ = shipPt(HULL.bay); if (!behindHull(bp_)) P_(bp_, [0.8, 0.93, 1], Math.min(q.arr, 1.2), -4); }
}

// ---------------------------------------------------------------- each tick, after the camera has moved (the ship's place relative to the camera is brought up to date first;
// the tick does it again for every object)
AFTER_CAM.push(dt => { ship.rel = V.sub(frel(ship), cam.rel); ship.dist = V.len(ship.rel); drone.ctl(dt*timeScale); });
const NOFL = {};
drone.ctl = dt => {
  const q = PIP;
  if (q.pose){ pipPose(q.pose); return; }
  const A = S_.act && S_.act.kind === 'probe' ? S_.act : null;
  if (!A){ if (q.st !== 'stowed') pipStow(); q.A = null; return; }
  const u = A.tau - PIP_LAUNCH;
  if (q.A !== A){ if (u < -0.6) return; pipBegin(q, A); }
  if (q.fin){ if (q.st !== 'stowed') pipStow(); return; }
  // the bay lamp (ice blue): on as the bay opens and while embers stream out
  S_.em[3] = Math.max(S_.em[3], smooth(-0.4, -0.1, u)*(1 - smooth(1.4, 2.2, u)));
  if (u < 0) return;
  const P = q.plan, u0 = q.st === 'stowed' ? u : q.u;
  q.u = u;
  pipActivate(P, u);
  const g = P.segs[P.k], su = sOf(u, g), f = g.fl ? g.fl(u, g) : NOFL, val = (x, d) => typeof x === 'function' ? x(u, g) : x ?? d;
  // where the plan puts it now and a step ago; it keeps to that on its spring, never inside the hull
  const T1 = hullOut(pipAt(P, u), PIP_R), T0 = hullOut(pipAt(P, u - dt), PIP_R);
  if (q.st === 'stowed'){ q.st = 'out'; q.wasOut = true; q.anc = null; q.open = 0; q.unfold = 0; q.mood = 0; q.flash = 0; q.thr = 0.15; }
  pipAnchor(q, dt, T0, T1);
  const cl = hullDp(q.anc) - PIP_R, fr = V.len(q.anc); q.clr = Math.min(q.clr, cl); q.far = Math.max(q.far, fr); q.clrNow = cl; q.farNow = fr;
  const near = camNear(), upW = near ? cam.up : localDir([-1, 0, 0]), rightW = near ? cam.right : localDir([0, 0, 1]), rad = drone.rad, spd = V.len(q.ancV);
  let pos = localPt(q.anc), roll = f.roll || 0;
  // its flourishes, smooth functions of the clock that start and end at nothing: hovering, it bobs a little; hops; a wave, a wiggle toward you
  q.bobK += ((g.rest ? 0 : 1 - clamp(spd/0.2, 0, 1)) - q.bobK)*(1 - Math.exp(-dt*5));
  pos = V.add(pos, V.mul(upW, rad*(reduceMotion ? 0.05 : 0.1)*Math.sin(drone.t*3.77)*q.bobK));
  if (f.hop) pos = V.add(pos, V.mul(upW, rad*0.9*f.hop));
  if (g.wave){ const kW = envW(0, 1, su, 0.12), wig = Math.sin(2*Math.PI*2.2*(u - g.t0)); pos = V.add(pos, V.mul(rightW, rad*0.25*wig*kW)); roll += 0.34*wig*kW; }
  q.pos = pos; drone.offset = pos; drone.pos = V.add(ship.pos, pos);
  // (a trail while it zips, races or loops: at most 8 fading points, kept by the ship)
  for (const t of q.trail) t.age += dt;
  while (q.trail.length && q.trail[0].age > 0.45) q.trail.shift();
  if (g.trail && spd > 0.25){ q.trAcc += dt; if (q.trAcc > 0.055){ q.trAcc = 0; q.trail.push({ l:q.anc.slice(), age:0 }); if (q.trail.length > 8) q.trail.shift(); } }
  // where it looks: at you (at the bridge with no one riding along), the way it flies, at the ship, at a point on the hull
  const toCam = V.norm(V.mul(V.add(ship.rel, pos), -1)), L = typeof g.look === 'function' ? g.look(u, g) : g.look;
  let want = q.body;
  if (L === 'cam') want = near ? toCam : V.norm(V.sub(localPt([-0.09, 0.05, 0]), pos));
  else if (L === 'fly'){ if (spd > 0.05) want = V.norm(localDir(q.ancV)); }
  else if (L === 'ship') want = V.norm(V.sub(localPt([0, -0.12, 0]), pos));
  else if (Array.isArray(L)) want = V.norm(V.sub(localPt(L), pos));
  else if (L && L.dir) want = V.norm(localDir(L.dir));
  // (busy with a job, it glances at you now and then: half a second every 2.6 s or so, never as a job starts or ends)
  if (g.glance != null && near){ const t = u - g.t0, ph = (t + 2.6*g.glance) % 2.6; if (ph > 2.05 && t > 0.8 && t < g.dur - 0.7) want = toCam; }
  // the pupil darts first, the body follows
  q.pupil = slerpDir(q.pupil, want, 1 - Math.exp(-dt/0.08));
  q.body = slerpDir(q.body, q.pupil, 1 - Math.exp(-dt/(g.bodyT || 0.35)));
  // (a loop round the needle: it faces the way it flies, head toward the needle)
  let loop = null;
  if (g.loop && spd > 0.05){ const a = q.anc, k = envW(0, 1, su, 0.08); loop = { kL:k, tan:V.norm(localDir(q.ancV)), inw:V.norm(localDir([-a[0], 0, -a[2]])) }; }
  pipOrient(q, upW, { roll, spin:f.spin || 0, nod:f.nod || 0, kL:loop ? loop.kL : 0, tan:loop && loop.tan, inw:loop && loop.inw });
  // blinks: every 2.5 to 4.5 s, one as its eye opens, and those a move asks for
  q.blinkIn -= dt; if (q.blinkIn <= 0){ q.blinkT = 0; q.blinkIn = 2.5 + 2*q.rb(); }
  const tg0 = u0 - g.t0, tg1 = u - g.t0;
  if (u0 < PIP_ASM + 0.3 && u >= PIP_ASM + 0.3) q.blinkT = 0;
  if (g.blinks) for (const b of g.blinks) if (tg0 < b && tg1 >= b) q.blinkT = 0;
  q.blinkT += dt; const bk = q.blinkT < 0.16 ? Math.sin(Math.PI*q.blinkT/0.16) : 0;
  q.open = clamp(smooth(PIP_ASM - 0.05, PIP_ASM + 0.35, u)*val(g.open, 1) - 1.15*bk, 0, 1);
  q.mood += (val(g.mood, 0) - q.mood)*(1 - Math.exp(-dt*8));
  // photos: a flash of its eye and a flash at it
  if (g.shot) for (const s of g.shot) if (tg0 < s && tg1 >= s){ q.shots++; q.flash = 1; pipFlash(q.anc.slice()); }
  q.flash = Math.max(0, q.flash - dt/0.2);
  q.lamp += (val(g.lamp, 0) - q.lamp)*(1 - Math.exp(-dt*(g.fx === 'weld' ? 30 : 6)));
  q.glow = 1 + 0.3*q.lamp + 2.4*q.flash;
  // the spot its lamp lights on the plates: along its gaze, up to a quarter of a ship radius
  q.spot = null;
  if (q.lamp > 0.05){ const dL = M3.applyT(ship.R0, q.pupil); let t = 0.02; for (let i=0;i<14;i++){ const p = V.add(q.anc, V.mul(dL, t)), d = hullDp(p); if (d < 0.002){ q.spot = p; break; } t += Math.max(d, 0.004); if (t > 0.25) break; } }
  // the thruster: idling, harder the faster it goes, off at rest, a puff for each hop
  const th = g.rest ? 0 : Math.max(val(g.thr, 0.25), 0.25 + 0.65*clamp(spd/0.9, 0, 1), 0.5*(f.hop || 0));
  q.thr += (th - q.thr)*(1 - Math.exp(-dt*6));
  // its fins and antenna unfold once it has taken shape and tuck in before it breaks up
  q.unfold = smooth(PIP_ASM - 0.15, PIP_ASM + 0.3, u)*(1 - smooth(P.DIS0 - 0.35, P.DIS0, u)); q.scale = 1;
  const ph = (drone.t*0.62) % 1; q.ant = ph < 0.08 ? Math.sin(Math.PI*ph/0.08) : 0;
  q.iris = ICE_P;
  q.g = g;
  // its break-ups: taking shape from launch, going home from DIS0 (the cells' size and the way to the bay are fixed as each starts)
  if (!q.bk && !q.home && u < PIP_ASM) pipBreak(q, -1, 1/PIP_ASM, 0);
  if (!q.bk && !q.home && u >= P.DIS0){ q.home = true; pipBreak(q, 1, 1/(q.hurry ? PIP_HURRY : PIP_DIS), P.DIS0); }
  const k = q.bk, bp0 = q.bp;
  if (k){
    const bp = pipBp(k, u); q.bp = bp;
    q.dm = k.mode; q.dg = k.mode < 0 ? PIP_GHI - (PIP_GHI - PIP_GLO)*clamp((bp - PIP_FA)/(1 - PIP_FA), 0, 1) : PIP_GLO + (PIP_GHI - PIP_GLO)*clamp(bp/(1 - PIP_FD), 0, 1);
    q.pres = k.mode < 0 ? clamp((bp - PIP_FA)/(1 - PIP_FA), 0, 1) : 1 - clamp(bp/(1 - PIP_FD), 0, 1);
    // the bay glows as embers leave it and as they arrive (brighter with each arrival)
    const [na, done] = pipArrivals(q, bp0, bp); q.embIn = done;
    q.arr = q.arr*Math.exp(-dt/0.18) + na*0.06;
    S_.em[3] = Math.max(S_.em[3], Math.min(0.35 + (k.mode > 0 ? q.arr : 0), 1.3));
    // (whole: the break-up is over; home, or back in the bay in a hurry: every ember has got there, and a moment later it is stowed)
    if (k.mode < 0 && k.rate > 0 && bp >= 1){ q.bk = null; q.brk = 0; q.dm = 0; q.dg = 0; q.pres = 1; }
    else if ((k.mode > 0 && bp >= 1) || (k.mode < 0 && k.rate < 0 && bp <= 0)){ if (k.end < 0) k.end = u; if (u - k.end >= 0.1){ q.fin = true; A.fin = true; pipStow(); } }
  } else { q.dm = 0; q.dg = 0; q.pres = 1; q.arr = 0; }
};
// a new job: its outing planned, everything else as it was on page load but the outing before
function pipBegin(q, A){
  const last = q.last, lastActs = q.lastActs;
  Object.assign(q, pipFresh(), { last, lastActs, A, kind:pipKind(A.tg), u:A.tau - PIP_LAUNCH });
  q.plan = pipPlan(A); q.rb = lcg(pipSeed(A) + 5);
  A.len = q.plan.IN + PIP_LAUNCH;   // (the job's framing lasts as long as the outing)
}
// the job ends (a new visit, a reset): if it is still out, it is gone with it
function pipEnd(A){ const q = PIP; if (q.A === A && q.st !== 'stowed') pipStow(); }
// home early and quickly (the ship is leaving now), in about 1.2 s: taking shape, it comes apart the way it came, its embers flying back into
// the bay; out and about, it glides to a stop (its error from the new plan dies away from its speed) and streams back into the bay from there;
// already on its way in, the rest goes quicker. Not out yet: it stays aboard, and the job is done at once.
drone.hurry = () => {
  const q = PIP, A = S_.act && S_.act.kind === 'probe' ? S_.act : null; if (!A || A.fin) return false;
  if (q.hurry) return true;
  const u = A.tau - PIP_LAUNCH, P = q.plan, k = q.bk;
  if (q.A !== A || !P || u < 0 || q.st === 'stowed'){ Object.assign(q, pipFresh(), { last:q.last, lastActs:q.lastActs, A, kind:pipKind(A.tg), fin:true, hurry:true }); A.fin = true; return true; }
  q.hurry = true;
  if (k && k.mode < 0){ Object.assign(k, { u0:u, bp0:pipBp(k, u), rate:-1/PIP_HURRY }); q.home = true; }
  else if (k){ Object.assign(k, { u0:u, bp0:pipBp(k, u), rate:Math.max(k.rate, 1/PIP_HURRY) }); }
  else {
    const H = hullOut(V.add(q.anc, V.mul(q.ancV, 1/9)), PIP_R), g = P.segs[P.k];
    P.segs.length = P.k + 1; g.t1 = u; q.err = V.sub(q.anc, H); q.errV = q.ancV.slice(); q.Tp = H.slice();
    P.segs.push({ a:'home', t0:u, t1:1e9, dur:1e9, at:hold(H), look:'cam', thr:0.3, home:true, say:'Pip hurries back into the belly bay' });
    P.DIS0 = u + 0.15; P.IN = P.DIS0 + PIP_HURRY + 0.1;
  }
  A.len = u + PIP_LAUNCH + PIP_HURRY + 0.4;
  return true;
};
// its frame from where it looks (+y) and which way is up (+z: the view's up with the camera near, else the ship's), with its flourishes: a
// loop (it faces the way it flies, head toward the middle), a spin about its up, a nod, a roll (a wiggle, a tumble, a barrel roll)
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
  const q = PIP; q.st = 'pose'; q.dm = 0; q.dg = 0; q.pres = 1; q.bk = null; q.brk = 0;
  const pos = o.cam ? V.add(V.mul(ship.rel, -1), V.mul(V.add(V.add(V.mul(cam.right, o.cam[0]), V.mul(cam.up, o.cam[1])), V.mul(cam.fwd, o.cam[2])), ship.rad)) : localPt(o.at || [0.12, -1.3, 0.6]);
  q.pos = pos; drone.offset = pos; drone.pos = V.add(ship.pos, pos);
  const toCam = V.norm(V.mul(V.add(ship.rel, pos), -1)), lk = o.look || [0, 0];
  const want = V.norm(V.add(toCam, V.add(V.mul(cam.right, lk[0]), V.mul(cam.up, lk[1]))));
  q.pupil = want; q.body = o.eyes ? toCam : want;
  q.open = o.open ?? 1; q.mood = o.mood ?? 0; q.glow = o.glow ?? 1; q.thr = o.thr ?? 0.25; q.lamp = o.lamp ?? 0; q.scale = o.scale ?? 1; q.unfold = o.unfold ?? 1;
  q.ant = o.ant ?? 0; q.iris = o.iris || ICE_P;
  pipOrient(q, V.norm(localPt([-1, 0, 0])), null);
}
// how much of its volume shows (a glint takes over below about 1.8 pixels), 0 where the hull or the body is in front of it
function pipVis(){
  const q = PIP; if (q.st === 'stowed' || !progReady(drone.prog)) return 0;
  const rpx = drone.rad*q.scale/Math.max(drone.dist, 1e-300)*sceneH*0.5/tanY;
  return smooth(0.9, 1.8, rpx)*(pipHidden(drone.rel) ? 0 : 1);
}
// drawn straight after the ship's own volume, so the hull never paints over it (the two share one bounding sphere, and volumes are sorted only by
// their centres); where the hull is really in front of it, it is hidden instead
ship.drawAfter = () => { const v = pipVis(); PIP.vis = v; if (v > 0.003 && PIP.pres > 0.003) drawVolume(drone, drone.prog, drone.rel, drone.rad, pr => drone.setU(pr), drone.rot, v); };
// the rest of it, with the ship's effects (haloDraw): the glint far away, its trail, the spot its lamp lights, sparkles and sparks, its embers
function pipDraw(){
  const q = PIP; if (q.st === 'stowed') return;
  const v = pipVis(), p = drone.rel, g = q.g;
  if (!pipHidden(p) && v < 0.999 && V.dot(p, cam.fwd) > 0) P_(p, [0.62, 0.86, 1], (0.9 + 0.4*q.thr)*(1 - v)*q.pres, -3);
  for (const t of q.trail){ const pp = shipPt(t.l), f = 1 - t.age/0.45; if (f > 0 && !pipHidden(pp)) P_(pp, [0.5, 0.75, 1], 0.5*f*(1 - 0.5*v), -2); }
  if (q.spot && q.lamp > 0.02){ const s = shipPt(q.spot), n = hullN(q.spot); if (!behindHull(shipPt(V.add(q.spot, V.mul(n, 0.004)))) && V.dot(localDir(n), V.mul(s, -1)) > 0) P_(s, [0.75, 0.9, 1], 0.45*q.lamp, ship.rad*0.02); }
  if (g && g.fx === 'polish') pipSparkles(q, g);
  if (g && g.fx === 'weld') pipWeld(q, g);
  if (q.bk && q.cells) pipEmbers(q);
}
// polishing the bridge window: little sparkles coming and going on the glass
function pipSparkles(q, g){
  const t = q.u - g.t0, B = HULL.bridge, k = envW(0, g.dur, t, 0.3);
  for (let i=0;i<3;i++){
    const x = t*3.2 + i*0.37, n = Math.floor(x), h1 = pipHash(n, i, 7), h2 = pipHash(n, i, 11), b = Math.sin(Math.PI*(x - n))**2*1.6*k;
    const s = shipPt([B[0] - 0.003, B[1] - 0.03 + 0.075*h1, (h2 - 0.5)*0.03]);
    if (b > 0.02 && !behindHull(s)) P_(s, [0.9, 0.96, 1], b, -2);
  }
}
// welding a panel: a flickering arc where its eye points and tiny sparks flying up off the plate
function pipWeld(q, g){
  const t = q.u - g.t0, k = envW(0, g.dur, t, 0.2), W = g.weld;
  if (behindHull(shipPt([W[0] - 0.004, W[1], W[2]]))) return;
  P_(shipPt(W), [0.85, 0.95, 1], (1.2 + 0.9*Math.abs(Math.sin(t*63)*Math.sin(t*41)))*k, -4);
  for (let i=0;i<10;i++){
    const x = t/0.42 + i*0.1, n = Math.floor(x), a = (x - n)*0.42, h1 = pipHash(n, i, 3), h2 = pipHash(n, i, 5), h3 = pipHash(n, i, 9);
    const d = V.norm([-(0.5 + 0.8*h3), (h1 - 0.5)*1.6, (h2 - 0.5)*1.6]), sp = 0.1 + 0.12*h3, f = (1 - a/0.42)**2*k;
    L_(shipPt(V.add(W, V.mul(d, sp*Math.max(a - 0.04, 0)))), shipPt(V.add(W, V.mul(d, sp*a))), [1, 0.5, 0.15], 0.2*f, [1, 0.85, 0.5], 1.1*f);
  }
}
// what the readout says (the job's line)
function pipLine(A){
  const q = PIP, u = A.tau - PIP_LAUNCH, mine = q.A === A;
  if (mine && q.fin) return q.wasOut ? 'Pip is back aboard' + (q.shots ? ` · ${q.shots} photo${q.shots > 1 ? 's' : ''} of the Halo` : '') : 'Pip stays aboard this time';
  if (!mine || !q.plan || u < 0) return 'approaching ' + A.tg.name + " · Pip, the ship's drone, gets ready";
  if (q.bk && (q.bk.mode > 0 || q.bk.rate < 0)) return q.hurry ? 'Pip hurries back into the belly bay' : 'Pip streams back into the belly bay';
  const g = q.g; if (!g) return 'Pip streams out of the belly bay and takes shape';
  return typeof g.say === 'function' ? g.say(u, g) : g.say;
}
drone.reset = () => { Object.assign(PIP, pipFresh()); };
// whether it is in the picture: in front of the camera and inside the view, big enough to draw, and not hidden by the hull or the body (the
// geometry only, so a test can ask without drawing)
function pipShows(){
  const q = PIP; if (q.st === 'stowed' || q.pres < 0.02) return false;
  const rpx = drone.rad*q.scale/Math.max(drone.dist, 1e-300)*sceneH*0.5/tanY;
  return rpx > 0.9 && onScreen(drone.rel, 1) && !pipHidden(drone.rel);
}
// a read-only view of it (for the Halo's sounds later), and the test hooks: its state, its outing, a pose to hold it in
// (bayD: how far it is from the bay, in ship radii; clr: how far its body is from the hull now, far: from the ship's centre (ship radii), and
// the least and most of those on this outing (clrMin, farMax); shows: pipShows; pres: how much of it is there; embIn: the share of its embers
// that has got there, in the bay going home)
Object.defineProperty(drone, 'state', { get:() => ({ st:PIP.st, kind:PIP.kind, shots:PIP.shots, flash:PIP.flash, thr:PIP.thr, vis:PIP.vis, pos:PIP.pos.slice(),
  bayD:V.len(V.sub(PIP.pos, localPt(HULL.bay)))/ship.rad, shows:pipShows(), scale:PIP.scale, pres:PIP.pres, brk:PIP.brk, embIn:PIP.embIn, embN:PIP.embN, mood:PIP.mood,
  open:PIP.open, act:PIP.g ? PIP.g.a : null, fin:PIP.fin, hurry:PIP.hurry, clr:PIP.clrNow ?? 9, far:PIP.farNow ?? 0, clrMin:PIP.clr, farMax:PIP.far }) });
ship.dbg.drone = { get state(){ return drone.state; }, pose(o){ PIP.pose = o || null; if (!o) pipStow(); }, hurry:() => drone.hurry(), hullD, PIP_R,
  get plan(){ const P = PIP.plan; return P && PIP.A === S_.act && { acts:P.acts.slice(), launch:P.launch, ret:P.ret, sig:P.sig, DIS0:P.DIS0, IN:P.IN, k:P.k, segs:P.segs.map(g => [g.a, +(g.t0 || 0).toFixed(2), g.fly ? 'fly' : '']) }; },
  mix:(seed, near = false, last = "", lastActs = "") => pipMix(lcg(seed), near, last, lastActs) };

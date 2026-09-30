
// ================================================================ Pip, the Halo's little drone (made up, like the ship): a round cartoon pod about 150 m across, a
// thirtieth of the ship's length, with two big eyes. It lives in the belly bay. On a probe job (ACT.probe in 07h-halo.js) it streams out of
// the bay as embers, takes shape beside the ship and potters about it for half a minute, never more than about 2 ship radii away and never
// touching the hull: two or three of its four outings (a hull check and polish, engines and repairs, photos and a wave, play), in an order,
// on paths and with timings of their own, with a launch and a way home that vary too. Its eyes show how it feels about what it does (FACES).
// Then it breaks up into embers that stream back into the bay. The job waits for it (done()), so the ship never leaves while it is out. It is
// a small volume of its own (FS_DRONE), drawn right after the ship (ship.drawAfter) so the hull never covers it by mistake, and hidden
// wherever the hull or the body is in front of it (volumes have no depth test). Far away it is a steady ice-blue glint. Its controller is
// drone.ctl, run once a tick after the camera has moved (AFTER_CAM), on the job's own clock; its dice come from lcg, never hrnd, so the
// Halo's route stays the same. This file must load after 07h-halo.js (it uses S_, HULL, ACT and the hull's outline).
const FS_DRONE_BODY = `
// Local frame: bounding sphere 1, +y the way it looks (its face), +z up, x across. A bold cartoon: a round black pod a little wider than
// tall with a crisp silver outline, a dark visor on its face with two big glowing eyes, a short antenna with a lamp, a thruster at the back.
// uP0: x its eyes open (0 shut, 1 open), y their glow (1; above 1 they flash white for a picture), z the thruster, w happy (its eyes bend
// into arches, ^ ^)   uP1: xyz the light's direction (world), w unfold (the antenna tucks in when it is stowed)
// uP2: xy where it looks (its eyes slide across the visor, -1..1), z the antenna's wink, w the lens lamp   uP3: rgb its eyes' colour, w how
// much of it is there (1 whole; its glows fade with it as it breaks up)
// uP4: x the lids' slant (> 0 the inner corners down: focused, cross; < 0 the outer corners down: sad), y the eyes' size (1; bigger when
// surprised or worried), z dizzy (its eyes turn into spirals), w brows (> 0 their inner ends up: worried, sad; < 0 down: cross)
// uM0 column 0: its scale, a wink (> 0 its right eye shuts, < 0 its left); column 1: its break-up into embers (dissolve g, mode 1 leaving /
// -1 arriving / 0 whole, the cells' size); column 2: toward the ship's bay, in its own frame (the side nearest the bay goes last and comes back first)
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/max(k1, 1e-5); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float seg2(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba*clamp(dot(pa, ba)/dot(ba, ba), 0., 1.)); }
float sq(float x){ return x*x; }
float lampD(vec3 o, vec3 d, vec3 c, float s, float front){ return dot(c - o, d) < front ? pblob(o, d, c, s) : 0.; }
// the body's half sizes (BR); the visor's half sizes (VS) and its centre's height (VZ); the eyes: across (EX), up (EZ), their radius (ER);
// NZ the thruster's nozzle
const vec3 BR = vec3(0.55, 0.47, 0.45), NZ = vec3(0., -0.47, -0.03);
const vec2 VS = vec2(0.43, 0.31);
const float VZ = 0.04, EX = 0.25, EZ = 0.03, ER = 0.155;
float gId = 0.;
float map(vec3 p){
  // a round pod, a little fuller at the top, and a short antenna leaning to one side with a ball on its tip
  float u = uP1.w, tq = 1. + 0.07*clamp(p.z/0.45, -1., 1.), d = sdEll(vec3(p.xy/tq, p.z), BR)*0.88;
  vec3 tip = vec3(0.15, -0.1, 0.45 + 0.13*u);
  float ant = min(sdCap(p, vec3(0.1, -0.06, 0.36), tip, 0.017), length(p - tip) - 0.036);
  gId = 0.; if(ant < d){ d = ant; gId = 3.; }
  return d;
}
// one eye, as a distance in eye radii from its outline (e: from its centre, x outward, y up; op: how open): a tall oval cut by its lids
// (they close to a dash; slanted, they cut the inner corner or the outer), morphing into an arch when happy and a spiral when dizzy
float eyeD(vec2 e, float op, float sm){
  vec2 s = e/uP4.y;
  float sl = uP4.x, T = mix(0.15, 1.3, op) - abs(sl)*0.75*(0.9 - sign(sl)*s.x), B = -mix(0.15, 1.3, op);
  float dd = max((length(s/vec2(0.84, 1.12)) - 1.)*0.84, max(s.y - T, B - s.y));
  // (the arch is bolder when small, so a character or two of it still reads)
  vec2 ac = s - vec2(0., mix(-0.38, -0.05, sm)); dd = mix(dd, max(abs(length(ac) - mix(0.78, 0.7, sm)) - mix(0.34, 0.42, sm), -ac.y - 0.02), uP0.w);
#if RM == 0
  if(uP4.z > 0.01){ float r = length(s), a = atan(s.y, s.x) + uTime*6.; const float k = 0.38;
    dd = mix(dd, max((0.5 - abs(fract(r/k - a/6.2832) - 0.5))*k - 0.1, r - 1.1), uP4.z); }
#endif
  return dd*uP4.y;
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
  // (am, amT: the ray's closest pass by its body and where: a ray that misses it by about a pixel draws its outline)
  float tm = uTime, t = max(hb.x, 0.), id = 0., am = 1e9, amT = 0.; bool hit = false;
  int N = int(mix(28., 48., uLod));
  if(hb.y > 0.) for(int i=0;i<48;i++){ if(i >= N) break; float h = map(o + d*t); if(h < am){ am = h; amT = t; } if(h < 0.0015){ hit = true; id = gId; break; } t += h; if(t > hb.y) break; }
  vec3 col = vec3(0.), irisC = mix(uP3.rgb, white, clamp(uP0.y - 1., 0., 1.)); float alpha = 0.;
  // (a scene pixel's size at its distance, in its own units, up and across (character cells are taller than wide, so the pixels are too);
  // sm: how small it is on screen, 0 from a radius of about 40 pixels up, 1 at 8 and under: its outline grows bolder and its eyes bigger and
  // further apart as it shrinks, so the few characters it covers riding along still show a black pod, a silver outline and two blue eyes)
  float pv = uPix*length(o), ph = 2.*uTan.x/uRes.x*length(o), sm = smoothstep(0.025, 0.125, pv);
  // (breaking up: where the ray meets a cell that is gone it sees through it; a cell about to go, or just back, burns from within)
  float heat = 0.;
  if(hit && uM0[1].y != 0.){ float fe = thrP(ivec3(floor((o + d*t)/uM0[1].z))) - uM0[1].x; if(fe < 0.) hit = false; else heat = 1. - smoothstep(0., 0.08, fe); }
  float pres = uP3.w;
  if(hit){
    vec3 p = o + d*t, n = nrmD(p);
    float dif = max(dot(n, L), 0.), mu = max(dot(n, -d), 0.), rim = pow(1. - mu, mix(8., 3., sm));
    float spec = pow(max(dot(n, normalize(L - d)), 0.), 60.);
    // black lacquer with a bright silver rim all round its outline (whatever side the Sun is on)
    vec3 hull = vec3(0.04, 0.045, 0.06);
    col = hull*(dif*0.6 + 0.05) + silver*(spec*0.8 + rim*(1.6 - 0.8*sm));
    if(id > 2.5) col = hull*(dif*1.3 + 0.4) + silver*(0.3 + 1.2*rim + spec);   // the antenna
    else if(p.y > 0.){
      // the visor: a rounded panel of dark glass on its face, edged with a thin silver line (only while it is big enough to show)
      vec2 vq = vec2(p.x, p.z - VZ)/VS; float vr = pow(pow(abs(vq.x), 3.) + pow(abs(vq.y), 3.), 1./3.), vw = max(0.012, 0.6*pv);
      float onV = smoothstep(1. + vw/VS.y, 1. - vw/VS.y, vr)*smoothstep(0.05, 0.15, p.y);
      col = mix(col, vec3(0.006, 0.01, 0.022) + silver*spec*0.9 + silver*rim*0.25, onV);
      col += silver*exp(-sq((vr - 1.)*VS.y/vw))*smoothstep(0.05, 0.15, p.y)*(0.9 + 0.8*dif)*(1. - sm);
      // its eyes: two glowing ovals on the visor, sliding the way it looks. Small on screen, each becomes a bar a pixel and more across and a
      // row (two pixels) high, and they move out toward its sides until four pixels of dark visor lie between them, so wherever the character
      // grid falls they come out as two bright glyphs with a dark one between, never one blob in its middle
      float sd = p.x < 0. ? -1. : 1., ex = clamp(max(EX, 2.7*ph), EX, 0.42);
      vec2 er = vec2(max(mix(ER, 0.7*ER, smoothstep(0.1, 0.25, pv)), 0.7*ph), max(ER, 0.95*pv)), e = (vec2(p.x, p.z) - vec2(sd*ex, EZ) - uP2.xy*vec2(0.07, 0.06))/er; e.x *= sd;
      float op = uP0.x*(1. - max(uM0[0].y*sd, 0.)), de = eyeD(e, op, sm), fw = clamp(0.35*ph/er.x, 0.05, 0.35), eye = smoothstep(fw, -fw, de)*max(onV, sm);
      // (bright ice blue with a brighter core and, up close, a white catchlight; never white when small, so even one character of it reads blue)
      vec2 cq = e/uP4.y - vec2(-0.3*sd, 0.42); float cat = exp(-dot(cq, cq)/0.03)*(1. - uP0.w)*(1. - uP4.z)*op*(1. - sm);
      vec3 eyeC = irisC*mix(vec3(0.5, 0.8, 1.), vec3(0.3, 0.68, 1.), sm)*(1.8 + 1.1*smoothstep(0., -0.35, de) + 2.6*sm)*uP0.y + white*cat*1.3;
      col = mix(col, eyeC, eye) + irisC*vec3(0.4, 0.7, 1.)*0.35*exp(-max(de, 0.)/0.3)*onV*(1. - eye)*(1. - sm)*uP0.y;
      // brows, up close: short bars over its eyes, their inner ends raised (worried, sad) or lowered (cross)
      if(abs(uP4.w) > 0.01 && sm < 0.99){ vec2 s = e/uP4.y, b0 = vec2(-0.72, 1.48 + 0.32*uP4.w), b1 = vec2(0.7, 1.48 - 0.32*uP4.w);
        col = mix(col, eyeC*0.9, smoothstep(fw, -fw, seg2(s, b0, b1) - 0.15)*abs(uP4.w)*onV*(1. - sm)); }
    }
    // (the burn: from a blue glow to white-hot, like the ship's cells in a fold; toned down from the ship's, as a small body whose cells all
    // burn at once read as a white blob)
    col = mix(col, mix(vec3(0.3, 0.48, 1.), vec3(1.3, 1.5, 1.8), heat*heat*heat), 0.85*smoothstep(0., 0.55, heat));
    alpha = 0.97;   // (not quite opaque, so its dark visor is never marked void: a black hole cut in the glow of its eyes)
  } else if(am < 0.2){
    // its outline: a ray that just misses the pod lights up, about a pixel wide at any size, so a small Pip keeps a crisp silver edge
    float w = max(0.55*uPix*amT, 0.004);
    col += silver*exp(-sq(am/w))*(0.95 + 0.55*sm)*pres*pres*pres;
  }
  float front = hit ? t : 1e9;
  // the lens lamp: light pouring out of its eyes onto what it looks at
  if(uP2.w > 0.01) col += mix(ice, white, 0.5)*blob(o, d, vec3(0., 0.66, EZ), 0.12)*uP2.w*smoothstep(0.05, 0.45, -d.y)*1.4*pres;
  col += white*lampD(o, d, vec3(0.15, -0.1, 0.45 + 0.13*uP1.w), 0.03, front + 0.02)*(5. + 24.*uP2.z)*pres;   // the antenna's lamp, winking now and then
  // the thruster: a nozzle glow and a short plume that fades well inside the bounding sphere
  float th = uP0.z, behind = dot(NZ - o, d) > front ? 0. : 1.;   // (the body hides a plume behind it: through it, it shone between the eyes)
  col += jet(o - NZ, d, vec3(0., -1., 0.), 0.08 + 0.2*th, 0.03, 0.06, 0.5, tm*6., vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(1. + 10.*th)*th*behind*pres;
  col += mix(white, ice, 0.4)*lampD(o, d, NZ, 0.035, front + 0.02)*(2. + 7.*th)*pres;
  outCol(col, alpha);
}`;
// (highp int: the cells' hash needs 32-bit integers to match pipHash in JS)
P.drone = program(VS_RECT, COMMON + `precision highp int;\n#define RM ${reduceMotion ? 1 : 0}\n` + FS_DRONE_BODY);

// ---------------------------------------------------------------- its state: where it is (ship-relative, world axes), where it looks, its face
// (st: 'stowed', 'out' on a job, 'pose' held by a test or a screenshot; kind: 'near' by a black hole or a magnetar, where its outings are
// gentler and it keeps closer to the ship, otherwise 'land', 'star' or 'cloud' as the body is)
const ICE_P = [0.6, 0.83, 1];
// its faces, drawn with its two eyes: how open they are, happy (arches, ^ ^), the lids' slant (> 0 the inner corners down, < 0 the outer),
// their size, dizzy (spirals), brows (> 0 their inner ends up, < 0 down) and a look down. Each move says which face it shows (face, a name
// or a function of the clock); the eyes ease to it in about 0.2 s, so a face never flickers. Near a black hole or a magnetar a curious face
// is a worried one; called home early (drone.hurry) it is sad; with reduced motion dizzy is droopy, with no spirals.
const FACES = {
  curious:  { open:1,    happy:0, slant:0,     size:1,    dizzy:0, brow:0,    down:0 },
  happy:    { open:1,    happy:1, slant:0,     size:1,    dizzy:0, brow:0,    down:0 },
  focused:  { open:0.6,  happy:0, slant:0.75,  size:0.96, dizzy:0, brow:-0.6, down:0 },
  cross:    { open:0.7,  happy:0, slant:1,     size:1,    dizzy:0, brow:-1,   down:0 },
  surprised:{ open:1,    happy:0, slant:0,     size:1.32, dizzy:0, brow:0.5,  down:0 },
  dizzy:    { open:1,    happy:0, slant:0,     size:1.08, dizzy:1, brow:0,    down:0 },
  sad:      { open:0.72, happy:0, slant:-0.85, size:0.96, dizzy:0, brow:0.8,  down:0.55 },
  sleepy:   { open:0.3,  happy:0, slant:-0.3,  size:1,    dizzy:0, brow:0,    down:0.3 },
  worried:  { open:1,    happy:0, slant:-0.35, size:1.14, dizzy:0, brow:1,    down:0 },
};
const FACE_K = Object.keys(FACES.curious);
const pipFace = (q, f) => q.hurry ? 'sad' : f === 'curious' && q.kind === 'near' ? 'worried' : f === 'dizzy' && reduceMotion ? 'sad' : FACES[f] ? f : 'curious';
// (all of its state as on page load: drone.reset puts it all back, so a test's result never depends on the job before it)
// plan: its outing (pipPlan); anc, ancV: where it is by the ship (ship axes, ship radii) and how fast that moves, on the plan but for an error
// (err, errV) that a jump in the plan leaves and a critically damped spring takes away (pipAnchor); bk: a break-up into embers under way (null while it is whole): its mode (-1 taking shape, 1 going home), its progress
// (bp from u0 at rate), its cells' size (cs), the way to the bay in its own frame (bayL) and its cells (cells); last, lastActs: the outing
// before (never the same one twice in a row); fin: this job's outing is over (the job is done); face: the face it shows (a name in FACES),
// fc: its eyes' shape now, easing toward that face; wink: one eye shut (> 0 its right, < 0 its left), winkS: the eye a blink shuts (0 both)
const pipFresh = () => ({ st:'stowed', O:null, req:null, reqDone:null, nextBit:null, form:'pod', wantT:0, outAt:4, outN:0, kind:'land', plan:null, g:null, last:'', lastActs:'', fin:false, u:-9, pos:[0, 0, 0], pupil:[0, 1, 0], body:[0, 1, 0],
  ax:[1, 0, 0], open:1, blinkIn:3, blinkT:9, glow:1, flash:0, thr:0, face:'curious', fc:{ ...FACES.curious }, wink:0, wkF:0, winkS:0, unfold:0, scale:1, shots:0, lamp:0, px:0, pz:0, ant:0, iris:ICE_P.slice(), trail:[],
  trAcc:0, vis:0, pose:null, anc:null, ancV:[0, 0, 0], err:[0, 0, 0], errV:[0, 0, 0], Tp:null, spot:null, hurry:false, home:false, bk:null, bp:0, dg:0, dm:0, pres:1, cs:0.27, bayL:[0, 0, 1],
  cells:null, brk:0, wz:1, arr:0, embN:0, embIn:0, rb:lcg(7), clr:9, far:0, bobK:0, wasOut:false });
const PIP = pipFresh();
const DM0 = new Float32Array(9);
// its size: its bounding sphere in ship radii (0.08 since 0.9.7, a third bigger than 0.9.3's 0.06, so it has a presence by the ship; 0.9.3's was
// 1.5 times its first one, owner). Its body reaches 0.55 of that
// from its centre, so the clearance it keeps from the hull (PIP_R, below) follows it
const PIP_SIZE = 0.08;
const drone = addObj({ key:'halo-drone', name:'Pip', label:'', type:"the Halo's little drone (made up)", group:'travel', layer:3, parent:ship, offset:[0, 0, 0], pos:[0, 0, 0],
  rad:PIP_SIZE*ship.rad, prog:P.drone, selfPos:true, hidden:true, noPick:true, noLabel:true, noImpostor:true, atlas:false, noWaypoint:true,
  // (lit like the ship: by the Sun, or by the showcase's fixed light)
  setU(pr){ const S = ship.S, q = PIP, L = S.light ? M3.apply(ship.R0, V.norm(S.light)) : V.norm(V.sub(sun.rel, this.rel)), c = q.iris, b = q.bayL;
    const f = q.fc; gl.uniform4f(pr.u.uP0, q.open, q.glow, q.thr, f.happy); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], q.unfold);
    gl.uniform4f(pr.u.uP2, q.px, clamp(q.pz - f.down, -1, 1), q.ant, q.lamp); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], q.pres);
    gl.uniform4f(pr.u.uP4, f.slant, f.size, f.dizzy, f.brow);
    DM0[0] = q.scale; DM0[1] = q.wink; DM0[3] = q.dg; DM0[4] = q.dm; DM0[5] = q.cs; DM0[6] = b[0]; DM0[7] = b[1]; DM0[8] = b[2];
    gl.uniformMatrix3fv(pr.u.uM0, false, DM0); } });
const pipKind = tg => isHoleTarget(tg) || RS_KM[tg.key] ? 'near' : !surfOf(tg) ? 'cloud' : tg === sun || tg.group === 'stars' ? 'star' : 'land';
const pipName = tg => tg.label && tg.label.length < tg.name.length && !/^the /.test(tg.name) ? tg.label : tg.name;
const envW = (a, b, u, r) => smooth(a, a + r, u)*(1 - smooth(b - r, b, u));
const localDir = v => M3.apply(ship.R0, v);                                   // a direction in ship axes, in world axes
const camL = () => M3.applyT(ship.R0, V.mul(ship.rel, -1/ship.rad));          // the camera, in ship axes and ship radii

// ---------------------------------------------------------------- the hull as the ship's shader draws it (map() in FS_SHIP_BODY), in ship radii and ship axes: Pip keeps
// its body (PIP_R across its middle) clear of it, follows its plates and lands on it
const PIP_R = 0.575*PIP_SIZE;   // (its body's radius in ship radii, 0.55 of its own radius across, and a little: 0.046)
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
// (face, wink: FACES), its lamp and thruster (lamp, thr), its effects and what the readout says (say). A flight between two moves (fly) is worked out as it starts (flyPrep):
// a smooth curve from where the last move left Pip, at its speed, to where the next one begins, at that one's speed, bent round the hull where a
// straight one would graze it. So Pip keeps to one smooth path; the spring (pipAnchor) only has to smooth a plan cut short (drone.hurry).
const PIP_LAUNCH = 0.3, PIP_ASM = 2.5, PIP_DIS = 2.5, PIP_HURRY = 1.2;
const mv = (P, T, o) => { o.dur = T; o.a = o.a || P.a; P.segs.push(o); return o; };
const fly = (P, o) => { const g = Object.assign({ fly:true, look:'fly', sp:P.near ? 0.32 : 0.55, a:P.a, bodyT:0.18 }, o);
  if (P.zip){ Object.assign(g, { sp:1.1, thr:1, trail:true, face:'happy', say:'Pip zips out' }); P.zip = false; }
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
// the moves' times: in order from move i0 on (the ones before are laid out already), each flight as long as its way needs at its pace. The
// break-up home starts with the last move when that is the way home (home); an outing still open (it ends in an idle stretch) has none yet
const PIP_NEVER = 1e9;
function pipLayout(P, i0 = 0){
  const S = P.segs; let t = i0 > 0 ? S[i0 - 1].t1 : 0;
  for (let i=i0;i<S.length;i++){
    const g = S[i];
    if (g.fly){ const a = S[i - 1], b = S[i + 1], p0 = a.at(a.t1, a); b.t0 = 0; b.t1 = b.dur; if (b.prep) b.prep(b, p0);
      g.dur = clamp(0.5 + V.len(V.sub(b.at(0, b), p0))/g.sp, g.sp > 1 ? 0.6 : 0.8, P.near ? 3 : 2.6); }
    g.t0 = t; g.t1 = t += g.dur;
  }
  const L = S[S.length - 1]; P.DIS0 = L.home ? L.t0 : PIP_NEVER; P.IN = L.home ? P.DIS0 + PIP_DIS + 0.1 : PIP_NEVER;
}
// more of an outing, from u on: the move Pip is on ends there (nothing planned after it is kept) and build adds what comes next, starting
// from where Pip is (p0). A builder starts with a flight, so Pip flies on from where it is at its speed, or with a move that holds p0
function pipAppend(P, u, build){
  pipActivate(P, u);
  const g = P.segs[P.k], p0 = g.at(Math.max(u, g.t0), g);
  P.segs.length = P.k + 1;
  if (u > g.t0){ g.t1 = u; g.dur = u - g.t0; } else { g.t1 = g.t0; g.dur = 0; }
  const i0 = P.segs.length; build(P, p0); pipLayout(P, i0);
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
  mv(P, 3.1, { at:(u, g) => V.lerp(F, U, smooth(0, 1.2, u - g.t0)), bodyT:0.28, thr:0.2, face:(u, g) => u - g.t0 < 2.4 ? 'curious' : 'happy', say:'Pip peeks out and looks around',
    look:(u, g) => { const t = u - g.t0; return t < 1.1 || t > 2.4 ? 'cam' : { dir:t < 1.75 ? [-0.25, 1, -0.2*sd] : [-0.25, -1, 0.3*sd] }; },
    fl:(u, g) => { const t = u - g.t0; return { roll:0.35*sd*envW(2.4, 3.1, t, 0.2), hop:Math.sin(Math.PI*clamp((t - 2.65)/0.4, 0, 1))**2 }; } });
};
PIPL.zip = (P, F) => {
  // (a crouch toward the bay, then off at speed: the flight after it is quick)
  mv(P, 0.8, { at:(u, g) => [F[0] + 0.02*Math.sin(Math.PI*sOf(u, g)), F[1], F[2]], look:'cam', thr:0.15, face:'happy', say:'Pip zips out' });
  P.zip = true;
};
PIPL.spiral = (P, F) => {
  const sd = Math.sign(F[2]) || 1, slow = reduceMotion || P.near, n = slow ? 1 : 1.5, H = 0.3, rr = 0.09;
  mv(P, slow ? 3.6 : 3, { at:(u, g) => { const s = sOf(u, g), a = 2*Math.PI*n*ease(s); return [F[0] - H*smooth(0, 1, s), F[1] + rr*Math.sin(a), F[2] + sd*rr*(1 - Math.cos(a))]; },
    look:'fly', bodyT:0.15, thr:0.6, face:'happy', say:'Pip spirals out' });
};
// -- a hull check and polish: along the plates with its lamp on (an arm from its tail to the shoulder, or the spine from the needle), then the
// bridge window, buffed in little circles with sparkles on the glass (focused), then a happy blink (its eyes bend into arches)
PIPA.hull = (P, k3) => {
  const r = P.r, sd = r() < 0.5 ? -1 : 1, spine = r() < 0.4, h = PIP_R + 0.022;
  const pts = spine ? [0.5, 0.38, 0.26, 0.14].map(y => overHull(y, 0, h)) : [0.8, 0.63, 0.46, 0.3, 0.14].map(ua => { const [y, z] = armPt(ua, sd); return overHull(y, z, h); });
  const path = crPath(pts), T = clamp(path.len/0.14, 3, 5.5)*k3;
  fly(P, { say:'Pip flies over to check the hull' });
  // (weaving a little from side to side across its way as it looks the plates over, its lamp on the plate a little ahead)
  mv(P, T, { at:(u, g) => { const s = sOf(u, g), p = path(s), t = V.sub(path(Math.min(s + 0.01, 1)), path(Math.max(s - 0.01, 0))), side = V.norm([0, -t[2], t[1]]);
      return V.add(p, V.mul(side, 0.013*Math.sin(2*Math.PI*1.1*(u - g.t0))*envW(0, 1, s, 0.15))); },
    look:(u, g) => { const a = path(Math.min(sOf(u, g) + 0.12, 1)); return [a[0] + h + 0.01, a[1], a[2]]; }, glance:r(), lamp:1, thr:0.35, bodyT:0.25, say:'Pip checks the hull' });
  const B = HULL.bridge, W = [B[0] - PIP_R - 0.008, B[1], 0];
  fly(P, { say:'Pip checks the hull' });
  mv(P, 2.8*k3 + 0.2, { at:(u, g) => { const t = u - g.t0, k = envW(0, g.dur, t, 0.35), a = 2*Math.PI*2.2*t; return [W[0] + 0.003*Math.sin(2*a)*k, W[1] + 0.012*Math.cos(a)*k - 0.012*k, W[2] + 0.012*Math.sin(a)*k]; },
    look:[B[0], B[1] + 0.012, 0], glance:r(), lamp:0.6, thr:0.25, fx:'polish', face:'focused', say:'Pip polishes the bridge window' });
  mv(P, 1.5, { at:(u, g) => [W[0] - 0.04*smooth(0, 0.75, u - g.t0), W[1], W[2]], look:'cam', face:(u, g) => u - g.t0 < 0.3 ? 'curious' : 'happy', blinks:[0.15], thr:0.25, say:'Pip blinks happily',
    fl:(u, g) => ({ hop:0.5*Math.sin(Math.PI*clamp((u - g.t0 - 0.75)/0.45, 0, 1))**2 }) });
};
// -- engines and repairs: it checks an engine at an arm's tail, peeks into the nozzle, a puff from it pushes Pip back tumbling (gently, with no
// tumble, near a black hole or a magnetar or with reduced motion), it shakes it off, then welds a panel on the same arm (tiny sparks) and nods
PIPA.engine = (P, k3) => {
  const r = P.r, e = r() < 0.5 ? -1 : 1, nm = e < 0 ? 'left' : 'right', N = e < 0 ? HULL.engL : HULL.engR, rm = reduceMotion || P.near;
  const C1 = [N[0] - 0.045, N[1] - 0.16, N[2] + e*0.06], C2 = [N[0] - 0.028, N[1] - 0.05, N[2] + e*0.03], k = rm ? 0.5 : 1, B1 = [C2[0] - 0.07*k, C2[1] - 0.13*k, C2[2] + e*0.09*k];
  fly(P, { say:`Pip flies to the ${nm} engine` });
  mv(P, (1.8 + 0.6*r())*k3, { at:(u, g) => [C1[0], C1[1], C1[2] + 0.012*Math.sin(2*Math.PI*0.7*(u - g.t0))*envW(0, 1, sOf(u, g), 0.25)], look:N, glance:r(), lamp:0.8, thr:0.25, face:'focused', say:`Pip checks the ${nm} engine` });
  mv(P, 1.3, { at:(u, g) => V.lerp(C1, C2, ease(sOf(u, g))), look:N, lamp:1, thr:0.2, fl:(u, g) => ({ nod:0.3*smooth(0.3, 1, sOf(u, g)) }), say:`Pip peeks into the ${nm} engine` });
  // (the puff: shoved back hard, at full speed within a tenth of a second, easing to a stop; a tumble once round, its eyes wide, then dizzy)
  const shove = t => (1 - (1 + t/0.1)*Math.exp(-t/0.1))/(1 - 9*Math.exp(-8));
  mv(P, 0.8, { at:(u, g) => V.lerp(C2, B1, shove(clamp(u - g.t0, 0, 0.8))), puff:N, look:N, thr:0.1, face:(u, g) => u - g.t0 < 0.3 ? 'surprised' : 'dizzy', say:'a puff from the engine pushes Pip back',
    fl:(u, g) => { const s = sOf(u, g); return rm ? { roll:0.25*Math.sin(Math.PI*s) } : { roll:2*Math.PI*(1 - Math.pow(1 - s, 3))*e, spin:0.8*Math.sin(Math.PI*s) }; } });
  // (shaking it off: still dizzy, then a cross look back at the engine)
  mv(P, 1.1, { at:hold(B1), look:(u, g) => u - g.t0 < 0.7 ? 'cam' : N, thr:0.3, face:(u, g) => u - g.t0 < 0.7 ? 'dizzy' : 'cross', say:'Pip shakes it off',
    fl:(u, g) => { const t = u - g.t0; return { spin:(rm ? 0.12 : 0.4)*Math.sin(2*Math.PI*4.2*t)*envW(0, 0.9, t, 0.1) }; } });
  const [py, pz] = armPt(0.72, e), Q = overHull(py, pz, PIP_R + 0.011), Wc = [hullTop(py + 0.004, pz) ?? Q[0] + PIP_R + 0.011, py + 0.004, pz];
  fly(P, { say:`Pip fixes a panel on the ${nm} arm` });
  mv(P, 2.9*k3, { at:hold(Q), look:Wc, glance:r(), fx:'weld', weld:Wc, lamp:(u, g) => 0.55 + 0.45*Math.abs(Math.sin((u - g.t0)*47)*Math.sin((u - g.t0)*29)), thr:0.2, face:'focused', say:`Pip fixes a panel on the ${nm} arm` });
  mv(P, 1.0, { at:(u, g) => [Q[0] - 0.03*smooth(0, 0.6, u - g.t0), Q[1], Q[2]], look:'cam', face:'happy', thr:0.25, say:`Pip fixes a panel on the ${nm} arm`,
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
    face:(u, g) => u - g.t0 < 0.3 ? 'focused' : 'happy', wink:(u, g) => u - g.t0 < 0.3 ? 1 : 0, fl:(u, g) => ({ hop:0.6*Math.sin(Math.PI*clamp((u - g.t0 - 0.4)/0.45, 0, 1))**2 }) });
  snap(K);
  if (two){ mv(P, 1.2, { at:(u, g) => V.lerp(K, K2, ease(sOf(u, g))), look:'ship', thr:0.4, say:'Pip moves for another photo' }); snap(K2); }
  fly(P, { sp:near ? 0.32 : 0.95, thr:0.7, say:'Pip comes back to wave' });
  const w = mv(P, 2.2*k3 + 0.2, { prep:g => { g.W = pipWaveSpot(near, sd); }, at:(u, g) => g.W, look:'cam', wave:true, face:'happy', thr:0.2, say:() => camNear() ? 'Pip waves at you' : 'Pip waves at the bridge' });
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
    look:'fly', bodyT:0.12, loop:true, thr:0.75, trail:!gentle, face:'happy', say:'Pip loops round the needle' });
};
PLAY.race = (P, r) => {
  // (along one side, just outside the arm's outer edge and level with it, toward the engines or the bow; a corkscrew and a roll midway)
  const sd = r() < 0.5 ? -1 : 1, aft = r() < 0.5, Rr = 0.8, a0 = 0.8, a1 = 1.84, roll = !reduceMotion;
  const arc = s => { const th = aft ? a0 + (a1 - a0)*s : a1 - (a1 - a0)*s, w = -0.33 + Rr*Math.sin(th); return [liftJS(Math.max(w, 0.1)) - 0.012, -0.567 + Rr*Math.cos(th), sd*w]; };
  fly(P, { say:"Pip races along the Halo's side" });
  mv(P, 1.7, { look:'fly', bodyT:0.1, thr:1, trail:true, face:'happy',
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
  mv(P, 1.6 + 0.7*r(), { at:hold(S), look:'cam', rest:true, thr:0, face:'sleepy', blinks:[1.2], say:'Pip rests on the hull' });
  mv(P, 0.7, { at:(u, g) => V.lerp(S, U, ease(sOf(u, g))), look:'cam', thr:0.7, say:'Pip rests on the hull' });
};
// -- home: to a spot beside the ship like the one it took shape at, then a goodbye wave, a quick run that overshoots and settles, a spiral
// down, or (near a black hole or a magnetar) a slow glide and a nod
PIPR.wave = (P, D) => {
  fly(P, { say:'Pip heads home' });
  mv(P, 2, { at:hold(D), look:'cam', wave:true, face:'happy', thr:0.2, say:() => camNear() ? 'Pip waves goodbye' : 'Pip heads home' });
};
PIPR.zip = (P, D) => {
  fly(P, { sp:1.1, thr:1, trail:true, face:'happy', say:'Pip zips home' });
  mv(P, 0.9, { prep:(g, p0) => { g.v = V.mul(V.norm(V.sub(D, p0)), 0.5); }, v:[0, 0, 0], look:'cam', thr:0.3, face:'happy', say:'Pip zips home',
    at:(u, g) => { const t = u - g.t0; return V.add(D, V.mul(g.v, t*Math.exp(-7*t)*(1 - smooth(0.6, 0.9, t)))); } });
};
PIPR.spiral = (P, D) => {
  const sd = Math.sign(D[2]) || 1, n = reduceMotion ? 1 : 1.5, H = 0.28, rr = 0.09;
  const up = t => { const a = 2*Math.PI*n*ease(t); return [D[0] - H*smooth(0, 1, t), D[1] + rr*Math.sin(a), D[2] + sd*rr*(1 - Math.cos(a))]; };
  fly(P, { say:'Pip spirals home' });
  mv(P, 2.8, { at:(u, g) => up(1 - sOf(u, g)), look:'fly', bodyT:0.15, thr:0.6, face:'happy', say:'Pip spirals home' });
};
PIPR.glide = (P, D) => {
  fly(P, { sp:0.28, say:'Pip heads home' });
  mv(P, 1, { at:hold(D), look:'cam', face:'happy', thr:0.2, fl:(u, g) => ({ nod:0.35*Math.sin(Math.PI*sOf(u, g)) }), say:'Pip heads home' });
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
// ---------------------------------------------------------------- 0.9.7: Pip is out for most of every stay (owner: it rarely came out; "make the viewer love Pip"). Between
// the bits it keeps the ship company (pipIdle), and each bit is one of the outings above or one of these (PIPB), or it helps with the job
// under way (PIPJ). Each builder adds a flight and its moves and ends on a move; the scheduler (pipSchedule, drone.ctl) adds the idle stretch
// after it, and the next bit once that has lasted its while (wait).
const PIPB = {}, PIPJ = {};
// where the camera is, in ship axes: which side of the plates it sees (-1 the top, 1 the belly)
const camSideX = () => camNear() ? (camL()[0] > 0 ? 1 : -1) : -1;
// an idle stretch: flying alongside the bow, a little above the plates and out to one side (the other side each time), drifting a little and
// looking round: ahead, at the place, at you. Endless: the scheduler cuts it after `wait` s
function pipIdle(P, wait){
  const r = P.r, sd = P.eside = P.eside ? -P.eside : (r() < 0.5 ? -1 : 1), E = hullOut([-0.07 - 0.04*r(), 0.16 + 0.22*r(), sd*(0.19 + 0.09*r())], 0.1), ph = r()*7;
  fly(P, { sp:P.near ? 0.3 : 0.45, say:'Pip flies alongside the Halo' });
  const lk = t => { const c = (t + ph) % 8; return c < 2.4 ? 0 : c < 4.6 ? 1 : c < 5.6 ? 2 : 3; };
  mv(P, 1e6, { idle:true, wait:wait ?? (P.near ? 2.5 + 2*r() : 1.2 + 2.6*r()), bodyT:0.3, thr:0.3, glance:null,
    at:(u, g) => { const t = u - g.t0, k = smooth(0, 1.5, t); return [E[0] + 0.012*Math.sin(t*0.9)*k, E[1] + 0.028*Math.sin(t*0.53)*k, E[2] + 0.02*Math.sin(t*0.71 + 1)*k]; },
    look:(u, g) => [{ dir:[-0.1, 1, 0] }, 'tg', 'cam', { dir:[-0.3, 0.6, sd*0.6] }][lk(u - g.t0)],
    face:(u, g) => lk(u - g.t0) === 2 ? 'happy' : 'curious',
    say:(u, g) => lk(u - g.t0) === 1 ? `Pip looks at ${P.nm}` : 'Pip flies alongside the Halo' });
}
// a spot in front of the camera, in ship axes (ship radii): D ship radii ahead, x and y across the view as shares of its half width and half
// height there (x: + to the right, y: + up); worked out every tick, so it rides along with the camera. Never inside the hull, and never more
// than PIP_FAR ship radii from the ship's middle (a camera pulling far back leaves it behind, by the ship)
const PIP_FAR = 3.2;
function pipCamSpot(D, x, y){
  const c = camL(), f = M3.applyT(ship.R0, cam.fwd), rt = M3.applyT(ship.R0, cam.right), up = M3.applyT(ship.R0, cam.up);
  let p = V.add(c, V.add(V.mul(f, D), V.add(V.mul(rt, x*D*tanX), V.mul(up, y*D*tanY)))); const l = V.len(p); if (l > PIP_FAR) p = V.mul(p, PIP_FAR/l);
  return hullOut(p, PIP_R + 0.02);
}
// -- peekaboo (only with the camera on the ship): it hides just past the right edge of your view, pops in with a start, ducks back out, pops in
// again a little higher and giggles (little hops, a wink). The spots ride along with the camera
PIPB.peek = P => {
  const r = P.r, D = 0.8 + 0.25*r(), y1 = isCompact() ? 0 : -0.3, y2 = y1 + 0.45, xin = 0.72, xout = 1 + 2.2*PIP_R/(D*tanX);
  const at = (x0, y0, x1, y1_, s) => pipCamSpot(D, x0 + (x1 - x0)*s, y0 + (y1_ - y0)*s);
  fly(P, { sp:0.9, thr:0.7, say:'Pip sneaks off to hide' });
  mv(P, 0.7, { at:() => pipCamSpot(D, xout, y1), look:'cam', face:'curious', thr:0.2, say:'Pip plays peekaboo' });
  mv(P, 0.35, { at:(u, g) => at(xout, y1, xin, y1, ease(sOf(u, g))), look:'cam', face:'surprised', thr:0.5, say:'Pip plays peekaboo' });
  mv(P, 1.1, { at:() => pipCamSpot(D, xin, y1), look:'cam', face:(u, g) => u - g.t0 < 0.4 ? 'surprised' : 'happy', thr:0.2, say:'peekaboo!', fl:(u, g) => ({ hop:0.4*Math.sin(Math.PI*clamp((u - g.t0 - 0.45)/0.35, 0, 1))**2 }) });
  mv(P, 0.3, { at:(u, g) => at(xin, y1, xout, y1, ease(sOf(u, g))), look:'cam', face:'happy', thr:0.5, say:'Pip plays peekaboo' });
  mv(P, 0.8, { at:(u, g) => at(xout, y1, xout, y2, ease(sOf(u, g))), look:'cam', face:'curious', thr:0.3, say:'Pip plays peekaboo' });
  mv(P, 0.35, { at:(u, g) => at(xout, y2, xin, y2, ease(sOf(u, g))), look:'cam', face:'happy', thr:0.5, say:'Pip plays peekaboo' });
  mv(P, 1.4, { at:() => pipCamSpot(D, xin, y2), look:'cam', face:'happy', wink:(u, g) => u - g.t0 > 0.55 && u - g.t0 < 1.1 ? 1 : 0, thr:0.2, say:'peekaboo!',
    fl:(u, g) => { const t = u - g.t0; return { hop:0.35*(Math.sin(Math.PI*clamp(t/0.3, 0, 1))**2 + Math.sin(Math.PI*clamp((t - 0.32)/0.3, 0, 1))**2), roll:0.25*Math.sin(t*14)*envW(0, 0.7, t, 0.1) }; } });
};
// -- beside you (only with the camera on the ship): it flies over to just in front of the camera, a little to one side and low, and rides
// along there for a while (a big close-up of its face): it looks at the view, at the place, back at the ship and at you, and winks
PIPB.buddy = P => {
  // (on a desk the right side: the info panel covers the left)
  const r = P.r, sd = !isCompact() || r() < 0.5 ? 1 : -1, D = 0.85 + 0.3*r(), x = 0.5*sd, y = isCompact() ? 0.05 : -0.32, T = 6 + 3*r(), ph = r()*5;
  const lk = t => { const c = (t + ph) % 6.5; return c < 1.6 ? 0 : c < 3.4 ? 1 : c < 4.6 ? 2 : 3; };
  const at = (u, g) => { const t = u - g.t0; return V.add(pipCamSpot(D, x, y), [0.006*Math.sin(t*1.3), 0.004*Math.sin(t*0.9), 0.006*Math.sin(t*1.1 + 1)]); };
  fly(P, { sp:0.9, thr:0.8, say:() => camNear() ? 'Pip flies over to you' : 'Pip flies alongside the Halo' });
  mv(P, T, { at, bodyT:0.3, thr:0.3, look:(u, g) => ['cam', 'tg', 'ship', { dir:[-0.15, 1, 0] }][lk(u - g.t0)], face:(u, g) => lk(u - g.t0) === 0 ? 'happy' : 'curious',
    say:(u, g) => lk(u - g.t0) === 1 ? `Pip rides along beside you, looking at ${P.nm}` : 'Pip rides along beside you' });
  mv(P, 1.1, { at, look:'cam', face:'happy', wink:(u, g) => u - g.t0 > 0.2 && u - g.t0 < 0.75 ? 1 : 0, thr:0.3, say:'Pip winks at you', fl:(u, g) => ({ hop:0.3*Math.sin(Math.PI*clamp((u - g.t0)/0.5, 0, 1))**2 }) });
};
// the ride camera's close-up of Pip (08r-ride.js): the ride's own framing (shotPose: the place's near edge in the view) from g degrees round,
// only much closer, and centred between Pip and the ship's middle, near enough that both fill a good part of the view and far enough that both
// stay in it. World axes, relative to the ship's middle, like shotPose
function pipShotPose(g){
  const A = PIP.anc || [0, 0.3, 0.3], L = V.len(A), M = localPt(V.mul(A, 0.5));
  const p = shotPose({ e:6, g, d:Math.max(0.95, 0.35 + 0.75*L/Math.max(tanY, 0.3)), roll:0 });
  return { eye:V.add(p.eye, M), look:V.add(p.look, M), fwd:p.fwd, up:p.up };
}
// (a close-up of Pip suits it now: out, itself, not heading home, near the ship and not doing something made for the camera where it is)
const PIP_CAMBITS = new Set(['peek', 'buddy', 'heart', 'photo', 'launch', 'home']);
const pipShotOk = () => { const q = PIP, P = q.plan; return q.st === 'out' && q.form === 'pod' && !q.bk && !q.home && !q.hurry && !!P && !P.goHome && !PIP_CAMBITS.has(P.a) && !!q.anc && V.len(q.anc) < 1.3; };
// -- the bow: it sits on top of the needle near its tip and rides there, happy in the wind (its eyes arches, swaying, looking round), then waves
PIPB.bow = P => {
  const r = P.r, y = 0.68 + 0.05*r(), S = [(hullTop(y, 0) ?? -0.01) - PIP_R - 0.003, y, 0], U = [S[0] - 0.06, y - 0.05, 0], T = 4.5 + 2.5*r();
  fly(P, { say:'Pip flies up to the bow' });
  mv(P, 0.9, { at:(u, g) => V.lerp(U, S, ease(sOf(u, g))), look:{ dir:[0, 1, 0] }, thr:0.3, face:'happy', say:'Pip sits on the bow' });
  mv(P, T, { at:hold(S), rest:true, thr:0, face:(u, g) => ((u - g.t0) % 5) < 3.6 ? 'happy' : 'curious', say:'Pip rides on the bow, enjoying the view',
    look:(u, g) => { const c = (u - g.t0) % 5; return c < 3.6 ? { dir:[-0.12, 1, 0.12*Math.sin(u*0.7)] } : 'tg'; },
    fl:(u, g) => { const t = u - g.t0, k = envW(0, g.dur, t, 0.4); return { roll:0.16*Math.sin(t*1.9)*k, nod:0.07*Math.sin(t*3.1)*k }; } });
  mv(P, 1.4, { at:hold(S), rest:true, thr:0, look:'cam', wave:true, face:'happy', say:() => camNear() ? 'Pip waves at you from the bow' : 'Pip waves from the bow' });
  mv(P, 0.6, { at:(u, g) => V.lerp(S, U, ease(sOf(u, g))), look:'cam', thr:0.6, face:'happy', say:'Pip hops off the bow' });
};
// -- a heart (only with the camera on the ship): between the ship and you it traces a heart in light in the plane of your view, a little to
// one side, then winks. The heart stays for a moment and fades (pipHeartFx)
const heartXY = t => { const a = 2*Math.PI*t, s = Math.sin(a); return [16*s*s*s/17, (13*Math.cos(a) - 5*Math.cos(2*a) - 2*Math.cos(3*a) - Math.cos(4*a))/17]; };
PIPB.heart = P => {
  const r = P.r, sd = r() < 0.5 ? -1 : 1, C = pipWaveSpot(P.near, sd), c = camL(), dc = Math.max(V.len(V.sub(C, c)), 0.2);
  const rt = M3.applyT(ship.R0, cam.right), up = M3.applyT(ship.R0, cam.up), sz = clamp(0.22*tanY*dc, 0.06, 0.3);
  const at = t => { const [x, y] = heartXY(t); return hullOut(V.add(C, V.add(V.mul(rt, x*sz), V.mul(up, (y - 0.1)*sz))), 0.06); };
  fly(P, { say:'Pip gets ready to draw something' });
  const g = mv(P, 2.6, { at:(u, g) => at(ease(sOf(u, g))), look:'cam', face:'happy', thr:0.7, trail:false, say:() => camNear() ? 'Pip draws a heart for you' : 'Pip draws a heart',
    on:g => pipHeartFx(g, at) });
  mv(P, 1.3, { at:hold(at(1)), look:'cam', face:'happy', wink:(u, g) => u - g.t0 > 0.25 && u - g.t0 < 0.95 ? 1 : 0, thr:0.2, say:() => camNear() ? 'Pip draws a heart for you' : 'Pip draws a heart',
    fl:(u, g) => ({ hop:0.4*Math.sin(Math.PI*clamp((u - g.t0 - 0.1)/0.4, 0, 1))**2 }) });
  return g;
};
// (the heart it draws: the part traced so far glows pink with white sparkles running along it; it holds a moment once done, then fades.
// Relative to the ship, like Pip)
const PINK_ = [1, 0.5, 0.72], PINKW_ = [1, 0.82, 0.9];
function pipHeartFx(g, at){
  const T = g.dur, N = 44, pts = []; for (let i=0;i<=N;i++) pts.push(at(i/N));
  fxAdd({ kind:'pip-heart', T:T + 2.6, draw(e){
    const t = e.t, w = ease(clamp(t/T, 0, 1)), f = 1 - smooth(T + 1.3, T + 2.6, t), n = Math.floor(w*N); if (f <= 0) return;
    let prev = null, pv = false;
    for (let i=0;i<=Math.min(n + 1, N);i++){ const l = i <= n ? pts[i] : at(w), p = shipPt(l), v = !behindHull(p) && V.dot(p, cam.fwd) > 0;
      if (prev && v && pv) L_(prev, p, PINK_, 0.32*f, PINK_, 0.32*f);
      prev = p; pv = v; if (i > n) break; }
    for (let k=0;k<4;k++){ const s = ((t*0.45 + k/4) % 1)*w, p = shipPt(at(s)); if (!behindHull(p)) P_(p, PINKW_, 0.9*f*Math.sin(Math.PI*((t*1.7 + k*0.37) % 1)), -3); }
  } });
}
// -- a spark: one drifts off the heart; Pip spots it (surprised), darts after it, catches it (a flash, happy eyes), carries it back and lets it
// fall into the heart (a streak and a glint on the heart)
PIPB.mote = P => {
  const r = P.r, sd = r() < 0.5 ? -1 : 1, core = HULL.core, W = [-0.11, -0.2, 0.03*sd];
  const path = crPath([[-0.04, -0.3, 0], [-0.12, -0.26, 0.08*sd], [-0.2, -0.16, 0.17*sd], [-0.26, -0.04, 0.1*sd], [-0.22, 0.04, -0.06*sd], [-0.17, -0.02, -0.14*sd]]);
  const m = P.mote = { path, g:null, drop:null };
  fly(P, { say:'Pip goes to look at the heart' });
  mv(P, 1.1, { at:hold(W), look:core, face:'curious', thr:0.2, say:'Pip looks at the heart' });
  mv(P, 0.6, { at:hold(W), look:(u, g) => path(0.02), face:'surprised', thr:0.2, say:'a spark drifts off the heart' });
  // (it chases the spark a quarter of a second behind it, weaving; the spark is caught at the chase's end)
  // (from where it watched, easing onto the spark's trail within 0.4 s)
  const ch = m.g = mv(P, 2.6, { at:(u, g) => { const s = sOf(u, g), w = clamp((u - g.t0 + 0.6)/(g.dur + 0.6), 0, 1), l = clamp(w - 0.1*(1 - s), 0, 1), p = path(l);
      return hullOut(V.lerp(W, V.add(p, [0.015*Math.sin(u*9)*(1 - s), 0, 0.02*Math.sin(u*7)*(1 - s)]), smooth(0, 0.4, u - g.t0)), PIP_R + 0.01); },
    look:(u, g) => path(clamp((u - g.t0 + 0.6)/(g.dur + 0.6), 0, 1)), face:'happy', thr:0.85, trail:true, bodyT:0.12, say:'Pip chases the spark' });
  mv(P, 0.9, { at:(u, g) => ch.at(ch.t1, ch), look:'cam', face:'happy', thr:0.3, shot:[0.02], say:'Pip catches the spark', fl:(u, g) => ({ hop:0.5*Math.sin(Math.PI*clamp((u - g.t0 - 0.1)/0.45, 0, 1))**2 }) });
  const B = hullOut([-0.1, -0.3, 0], PIP_R + 0.03);
  fly(P, { sp:0.4, say:'Pip carries the spark back' });
  m.drop = mv(P, 1.4, { at:hold(B), look:core, face:(u, g) => u - g.t0 < 0.6 ? 'focused' : 'happy', thr:0.2, say:'Pip puts the spark back in the heart',
    fl:(u, g) => ({ nod:0.3*envW(0.3, 0.8, u - g.t0, 0.15) }) });
};
// (the spark: along its path until it is caught, then held in front of Pip, then a streak down into the heart and a glint there)
function pipMoteDraw(q){
  const m = q.plan && q.plan.mote; if (!m || !m.g || !m.drop || !(m.g.t1 > 0)) return;
  const u = q.u, g = m.g, e0 = g.t0 - 0.6, d0 = m.drop.t0 + 0.6; if (u < e0 || u > d0 + 0.6) return;
  let p;
  if (u < g.t1){ const w = clamp((u - e0)/(g.t1 - e0), 0, 1); p = shipPt(m.path(w)); if (u < e0 + 0.3){ const c = shipPt(HULL.core); if (!behindHull(c)) P_(c, WHITE, 1.5*(1 - (u - e0)/0.3), -5); } }
  else if (u < d0){ p = V.add(drone.rel, M3.apply(drone.rot, [0, 1.2*drone.rad, 0])); }
  else { const c = shipPt(HULL.core), f = 1 - (u - d0)/0.6, h = V.add(drone.rel, M3.apply(drone.rot, [0, 1.2*drone.rad, 0]));
    if (!behindHull(c)){ P_(c, [0.9, 0.95, 1], 2.2*f, -7); if (!behindHull(h) && f > 0.5) L_(h, c, WHITE, 0.6*(f - 0.5)*2, ICE_, 0.9*(f - 0.5)*2); } return; }
  if (behindHull(p) || pipHidden(p)) return;
  const tw = 0.75 + 0.25*Math.sin(u*23);
  P_(p, WHITE, 1.6*tw, -3); P_(p, [0.75, 0.9, 1], 0.5*tw, -6);
}
// -- a twirl: two happy turns on the spot with a hop and a few sparkles (after a job well done, and now and then for fun)
PIPB.twirl = (P, p0) => {
  const n = reduceMotion ? 1 : 2;
  mv(P, 1.5, { at:hold(p0 || [-0.09, 0.3, 0.2]), look:'cam', face:'happy', thr:0.4, fx:'twinkle', say:'Pip does a happy twirl',
    fl:(u, g) => { const s = sOf(u, g); return { spin:2*Math.PI*n*ease(s), hop:0.5*Math.sin(Math.PI*s)**2 }; } });
};
// (the next bit: a shuffled bag of them all, never the same twice running; peekaboo and the heart only with the camera on the ship, a race
// or a spark chase not by a black hole)
const PIP_BITS = ['hull', 'engine', 'photo', 'play', 'peek', 'bow', 'heart', 'mote', 'buddy', 'twirl', 'buddy'];
function pipBitNext(q){
  // (the bits made for the camera wait while the ride camera is close on Pip, whose place it would take)
  const P = q.plan, r = P.r, close = typeof RIDE !== 'undefined' && RIDE.pk > 0.05;
  const camOk = camNear() && V.len(cam.rel) < ship.rad*6;   // (the made-for-the-camera bits only with the camera close by)
  const ok = b => (camOk || !(b === 'heart' || b === 'peek' || b === 'buddy')) && !(close && (b === 'heart' || b === 'peek' || b === 'buddy')) && b !== P.lastBit && !(P.near && b === 'mote');
  for (let k=0;k<2;k++){
    if (!P.bag.length){ const b = PIP_BITS.slice(); for (let i=b.length - 1;i>0;i--){ const j = Math.floor(r()*(i + 1)); [b[i], b[j]] = [b[j], b[i]]; } P.bag.push(...b); }
    const i = P.bag.findIndex(ok); if (i >= 0){ const b = P.bag.splice(i, 1)[0]; P.lastBit = b; return b; }
    P.bag.length = 0;
  }
  return 'twirl';
}
function pipBitAdd(P, b, p0){
  P.a = b;
  if (PIPA[b]) PIPA[b](P, 0.85); else PIPB[b](P, p0);
}
// -- the jobs Pip helps with. The scan: it flies down beside the bow on the belly's side, by the scan array, turns its lamp on the place and gathers the readings
// (motes of light streaming up to it from the ring on the body) until the sweep is over, then hops for joy
PIPJ.scan = (P, A) => {
  const r = P.r, sd = r() < 0.5 ? -1 : 1, K = hullOut([0.07, 0.3 + 0.08*r(), 0.15*sd], PIP_R + 0.03);
  fly(P, { sp:0.6, say:'Pip flies down to help with the scan' });
  mv(P, 1e6, { at:(u, g) => V.add(K, [0, 0.008*Math.sin((u - g.t0)*1.3), 0]), look:'tg', face:'focused', lamp:(u, g) => smooth(0.3, 0.9, u - g.t0), thr:0.25, fx:'data', job:A,
    until:() => S_.act !== A || A.tau > SCAN.SW0 + SCAN.SWT + 0.5, say:() => A.tau >= SCAN.SW0 ? 'Pip gathers the readings' : 'Pip helps with the scan',
    then:(P, p0) => { mv(P, 1.3, { at:hold(p0), look:'cam', face:'happy', thr:0.3, shot:[0.05], say:'Pip got the readings', fl:(u, g) => ({ hop:0.6*Math.sin(Math.PI*clamp((u - g.t0 - 0.15)/0.45, 0, 1))**2 }) }); } });
};
// the skim: it rides out in front of the bow scoop, braced in the stream of gas (a cross little face, shaken about), then shakes itself off
PIPJ.skim = (P, A) => {
  const r = P.r, sd = r() < 0.5 ? -1 : 1, K = [-0.02, 0.93, 0.05*sd];
  fly(P, { sp:0.6, say:'Pip flies out to the bow scoop' });
  mv(P, 1e6, { at:(u, g) => { const b = A.low || 0, t = u - g.t0; return V.add(K, [0.006*b*Math.sin(t*37), -0.012*b*(0.5 + 0.5*Math.sin(t*23)), 0.008*b*Math.sin(t*29 + 1)]); },
    look:{ dir:[0.15, 1, 0] }, face:() => (A.low || 0) > 0.05 ? 'cross' : 'focused', thr:() => 0.5 + 0.5*(A.low || 0), job:A,
    until:() => S_.act !== A || (A.tau > 1 && (A.low || 0) < 0.02 && A.tau > ACTS.skim.T*0.6), say:() => (A.low || 0) > 0.05 ? 'Pip braces in the gas at the bow scoop' : 'Pip rides out in front of the bow scoop',
    fl:(u, g) => ({ roll:0.25*(A.low || 0)*Math.sin((u - g.t0)*19) }),
    then:(P, p0) => { mv(P, 1.4, { at:hold(p0), look:'cam', thr:0.3, face:(u, g) => u - g.t0 < 0.8 ? 'dizzy' : 'happy', say:'Pip shakes the gas off',
      fl:(u, g) => { const t = u - g.t0; return { spin:(reduceMotion ? 0.12 : 0.4)*Math.sin(2*Math.PI*4.2*t)*envW(0, 0.9, t, 0.1) }; } }); } });
};
// the weapons test: it flies to the needle's tip, settles there facing ahead (a determined look, a wink at you), and becomes the fold cannon's
// barrel (07k-cannon.js starts and ends that: pipTransform); once it is Pip again it does a happy twirl
const PIP_DOCK = [-0.012, 0.835 + PIP_R + 0.03, 0];
PIPJ.weapons = (P, A) => {
  const D = PIP_DOCK, U = [D[0] - 0.05, D[1] - 0.06, 0];
  fly(P, { sp:0.7, thr:0.8, say:'Pip flies to the tip of the needle' });
  mv(P, 0.9, { at:(u, g) => V.lerp(U, D, ease(sOf(u, g))), look:{ dir:[0, 1, 0] }, face:'focused', thr:0.4, say:'Pip docks at the tip of the needle' });
  mv(P, 1e6, { at:hold(D), dock:A, job:A, look:(u, g) => { const t = u - g.t0; return t > 0.4 && t < 1.2 ? 'cam' : { dir:[0, 1, 0] }; },
    face:(u, g) => { const t = u - g.t0; return t > 0.4 && t < 1.2 ? 'happy' : 'cross'; }, wink:(u, g) => { const t = u - g.t0; return t > 0.55 && t < 1.05 ? 1 : 0; }, thr:0.2,
    until:() => S_.act !== A || A.gunDone, say:() => A.gunDone ? 'Pip is itself again' : A.gun ? 'Pip becomes the fold cannon' : 'Pip waits at the tip of the needle, ready',
    then:(P, p0) => PIPB.twirl(P, p0) });
};
// Pip's own show (the probe job, and the showcase's and the lab's Pip button): two or three of its four outings in a row while the cameras
// turn to it; the job is done when they are
PIPJ.probe = (P, A) => {
  const m = pipMix(P.r, P.near, PIP.last, PIP.lastActs), k3 = m.acts.length > 2 ? 0.85 : 1; PIP.last = m.sig; PIP.lastActs = m.acts.join(); P.acts = m.acts.slice();
  for (const a of m.acts){ P.a = a; PIPA[a](P, k3); }
  mv(P, 0.01, { at:(u, g) => { const L = P.segs[P.segs.indexOf(g) - 1]; return L.at(L.t1, L); }, on:() => { A.fin = true; A.finT = A.tau; }, say:'Pip is done showing off' });
};

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
// (its dice: from the stay and the place, so each stay and each place gets an outing of its own, the same on every run of a route)
const pipSeed = O => (O.seed*7919 + [...O.tg.key].reduce((h, c) => (h*31 + c.charCodeAt(0)) % 1000003, 17)) >>> 0;
// an outing (O: its place, dice, clock tau): it takes shape beside the ship and comes out (one of the launches), then helps with the job that
// called it or keeps the ship company; the rest is added as it goes (pipTick), and its way home once it is time (pipGoHome)
function pipOpen(O, req){
  const q = PIP, near = q.kind === 'near', r = lcg(pipSeed(O)), m = pipMix(r, near, q.last, q.lastActs), side = r() < 0.5 ? -1 : 1;
  const P = { t:0, k:0, segs:[], r, near, side, nm:pipName(O.tg), a:'launch', DIS0:PIP_NEVER, IN:PIP_NEVER, launch:m.launch, ret:m.ret, sig:m.sig, acts:[], bag:[], lastBit:'', eside:0, mote:null, goHome:false };
  const F = pipSpot(side);
  mv(P, PIP_ASM + 0.4, { at:hold(F), look:'cam', thr:0.12, say:'Pip streams out of the belly bay and takes shape' });
  // (called out by a job, it zips straight off to it)
  if (req){ PIPL.zip(P, F); P.a = req.kind; PIPJ[req.kind](P, req); q.reqDone = req; } else PIPL[m.launch](P, F);
  pipIdle(P, req ? undefined : 1 + 2*r());
  pipLayout(P);
  return P;
}
// Pip is out while the ship stays somewhere: from a few seconds after it arrives (the hull whole again after a fold) until the stay's last
// pass is nearly over (PIP_HOMEBY s before its end, so it is home before the ship turns to leave) or the ship is sent on
const PIP_HOMEBY = 8;
function pipWant(){
  const S = S_, st = S.stay;
  if (!st || st.leave || (S.phase !== 'pass' && S.phase !== 'loop') || ship.parent !== S.target) return false;
  if (S.fk > -90 || S.asm < FLK.A1 + 0.5) return false;
  return !(S.phase === 'pass' && S.plan.last && S.t > S.plan.T - PIP_HOMEBY);
}
// each tick, before it moves: out it comes (a few seconds after it is wanted, at once when a job calls it), home it goes when it is no longer
// wanted; an outing is over once it is back in the bay
function pipSchedule(q, dt){
  const S = S_, O = q.O;
  if (q.req && (S.act !== q.req || q.req.fin)) q.req = null;   // (a job that is over no longer calls)
  const want = pipWant();
  if (!O){
    if (!want){ q.wantT = 0; return; }
    q.wantT += dt;
    if (!q.req && q.wantT < q.outAt) return;
    q.outN++;
    q.O = { tg:S.target, seed:S.visits*131 + q.outN, tau:-0.6, fin:false };
    pipBegin(q, q.O);
    return;
  }
  if (O.fin){ if (q.st === 'stowed' || q.st === 'pose'){ q.O = null; q.wantT = 0; q.outAt = 2 + 3*q.rb(); } return; }
  O.tau += dt;
  if (!want || O.tg !== S.target) pipGoHome(q);
}
// home, at its own pace: the mix's way home from wherever it is (once it is whole and itself: not while it takes shape or is the cannon)
function pipGoHome(q){
  const P = q.plan, O = q.O; if (!P || !O || O.fin || q.home || P.goHome || q.hurry) return;
  const u = O.tau - PIP_LAUNCH;
  if (q.st !== 'out'){ if (u < 0){ O.fin = true; q.fin = true; } return; }   // (not out yet: it stays aboard)
  if (q.bk || q.form !== 'pod') return;
  P.goHome = true;
  pipAppend(P, u, P => { P.a = 'home'; const D = pipSpot(P.r() < 0.6 ? P.side : -P.side); PIPR[P.ret](P, D);
    mv(P, 1e6, { at:hold(D), look:'cam', thr:0.15, home:true, face:'happy', say:'Pip streams back into the belly bay' }); });
}
// out and whole: a job's call (its bit now, from wherever Pip is), the end of a job's bit (until), or the next bit after an idle stretch
function pipTick(q, P, u){
  if (q.home || P.goHome || q.bk || q.form !== 'pod' || q.hurry) return;
  const g = P.segs[P.k], req = q.req;
  if (req && q.reqDone !== req){ q.reqDone = req; pipAppend(P, u, P => { P.a = req.kind; PIPJ[req.kind](P, req); pipIdle(P); }); return; }
  if (g.until && g.until(u, g)){ pipAppend(P, u, (P, p0) => { P.a = 'idle'; if (g.then) g.then(P, p0); pipIdle(P); }); return; }
  // (the lab's buttons: that bit now, unless it is helping with a job)
  if (q.nextBit && !g.job && !g.dock){ const b = q.nextBit; q.nextBit = null; pipAppend(P, u, (P, p0) => { pipBitAdd(P, b, p0); P.lastBit = b; pipIdle(P); }); return; }
  if (g.idle && u - g.t0 > g.wait) pipAppend(P, u, (P, p0) => { pipBitAdd(P, pipBitNext(q), p0); pipIdle(P); });
}
// a job asks for Pip (the scan, the skim, the weapons test, Pip's own show)
function pipJoin(A){ if (A && PIPJ[A.kind]) PIP.req = A; }
// (out of the bay: the ship waits for it before it jumps)
const pipOut = () => !!(PIP.O && !PIP.O.fin) && PIP.st !== 'pose';
// docked at the needle's tip for the weapons test A, and has winked: the cannon can form
const pipDocked = A => { const q = PIP, g = q.g; return q.st === 'out' && q.form === 'pod' && !q.bk && !q.hurry && !!g && g.dock === A && q.u - g.t0 > 1.3; };
// the fold cannon (07k-cannon.js) turns Pip into its barrel (mode 1: its cells stream to the barrel's) and back again (-1), over dur s
function pipTransform(mode, dur){
  const q = PIP; if (q.st !== 'out' || q.hurry || (mode > 0 ? q.form !== 'pod' || q.bk : q.form !== 'gun')) return false;
  pipBreak(q, mode, 1/dur, q.u, true); return true;
}

// ---------------------------------------------------------------- hidden from the camera by the hull, or by the body it visits (camera-relative p)
function pipHidden(p){
  if (behindHull(p)) return true;
  const tg = PIP.O && PIP.O.tg; if (!tg || PIP.st === 'pose') return false;
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
function pipStow(){ const q = PIP; q.st = 'stowed'; q.trail.length = 0; q.spot = null; q.lamp = 0; q.flash = 0; q.vis = 0; q.dm = 0; q.dg = 0; q.pres = 1; q.arr = 0; q.embN = 0; q.bk = null; q.brk = 0; q.form = 'pod'; }

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
// its body in its own frame (bounding sphere 1), as map() draws it, without the antenna: the cells on its skin
function pipBodyD(x, y, z){
  const tq = 1 + 0.07*clamp(z/0.45, -1, 1), a = x/tq/0.55, b = y/tq/0.47, c = z/0.45, k0 = Math.hypot(a, b, c), k1 = Math.hypot(a/0.55, b/0.47, c/0.45);
  return k0*(k0 - 1)/Math.max(k1, 1e-5)*0.88;
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
// start a break-up (mode 1 going home, -1 coming out): its cells' size and the way to the bay in its own frame, both kept to its end. gun:
// into the fold cannon's barrel and back out of it instead of the bay (its cells light as their first ember lands: gunLocks, 07k-cannon.js)
function pipBreak(q, mode, rate, u0, gun = false){
  q.bk = { mode, u0, bp0:0, rate, end:-1, gun }; q.brk = mode; q.cs = pipCs(); q.cells = pipTable(q.cs); q.wz = q.plan.r() < 0.5 ? -1 : 1;
  q.bayL = M3.applyT(drone.rot || I3, V.norm(V.sub(gun ? gunMidL() : localPt(HULL.bay), q.pos)));
  if (gun) gunLocks(q);
}
// where ember i goes (or comes from): the bay, or its cell of the cannon's barrel (ship-relative, world axes)
const pipFar = (q, i) => q.bk.gun ? gunCellW(i) : localPt(HULL.bay);
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
  const R = drone.rot, cellP = V.add(q.pos, V.mul(M3.apply(R, [A[c] + A[c + 4], A[c + 1] + A[c + 5], A[c + 2] + A[c + 6]]), drone.rad)), bay = pipFar(q, i);
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
  if (leaving && !q.bk.gun && q.arr > 0.02){ const bp_ = shipPt(HULL.bay); if (!behindHull(bp_)) P_(bp_, [0.8, 0.93, 1], Math.min(q.arr, 1.2), -4); }
}

// ---------------------------------------------------------------- each tick, after the camera has moved (the ship's place relative to the camera is brought up to date first;
// the tick does it again for every object)
AFTER_CAM.push(dt => { ship.rel = V.sub(frel(ship), cam.rel); ship.dist = V.len(ship.rel); drone.ctl(dt*timeScale); });
const NOFL = {};
drone.ctl = dt => {
  const q = PIP;
  if (q.pose){ pipPose(q.pose); return; }
  pipSchedule(q, dt);
  const O = q.O;
  if (!O || q.fin){ if (q.st !== 'stowed') pipStow(); return; }
  const u = O.tau - PIP_LAUNCH;
  // the bay lamp (ice blue): on as the bay opens and while embers stream out
  S_.em[3] = Math.max(S_.em[3], smooth(-0.4, -0.1, u)*(1 - smooth(1.4, 2.2, u)));
  if (u < 0) return;
  const P = q.plan, u0 = q.st === 'stowed' ? u : q.u;
  q.u = u;
  pipActivate(P, u);
  if (q.st === 'out') pipTick(q, P, u);
  const g = P.segs[P.k], su = sOf(u, g), f = g.fl ? g.fl(u, g) : NOFL, val = (x, d) => typeof x === 'function' ? x(u, g) : x ?? d;
  // where the plan puts it now and a step ago; it keeps to that on its spring, never inside the hull
  const T1 = hullOut(pipAt(P, u), PIP_R), T0 = hullOut(pipAt(P, u - dt), PIP_R);
  if (q.st === 'stowed'){ q.st = 'out'; q.wasOut = true; q.anc = null; q.open = 0; q.unfold = 0; q.fc = { ...FACES.curious }; q.flash = 0; q.thr = 0.15; }
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
  else if (L === 'tg'){ const d = V.sub(V.sub(O.tg.rel, ship.rel), pos); if (V.len(d) > 0) want = V.norm(d); }
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
  // its face: the one the move asks for, its eyes easing to it in about 0.2 s
  q.face = pipFace(q, val(g.face, 'curious'));
  const F = FACES[q.face], kf = 1 - Math.exp(-dt/0.07); for (const k of FACE_K) q.fc[k] += (F[k] - q.fc[k])*kf;
  q.wkF += (val(g.wink, 0) - q.wkF)*kf;
  // blinks: every 2.5 to 4.5 s (5 to 8 with reduced motion), now and then a wink, one as its eyes open, and those a move asks for
  q.blinkIn -= dt; if (q.blinkIn <= 0){ q.blinkT = 0; q.blinkIn = reduceMotion ? 5 + 3*q.rb() : 2.5 + 2*q.rb(); q.winkS = !reduceMotion && q.rb() < 0.15 ? (q.rb() < 0.5 ? -1 : 1) : 0; }
  const tg0 = u0 - g.t0, tg1 = u - g.t0;
  if (u0 < PIP_ASM + 0.3 && u >= PIP_ASM + 0.3){ q.blinkT = 0; q.winkS = 0; }
  if (g.blinks) for (const b of g.blinks) if (tg0 < b && tg1 >= b){ q.blinkT = 0; q.winkS = 0; }
  q.blinkT += dt; const bk = q.blinkT < 0.16 ? Math.sin(Math.PI*q.blinkT/0.16) : 0;
  q.open = clamp(smooth(PIP_ASM - 0.05, PIP_ASM + 0.35, u)*q.fc.open - (q.winkS ? 0 : 1.15*bk), 0, 1);
  q.wink = clamp(q.wkF + q.winkS*1.15*bk, -1, 1);
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
    if (!k.gun) S_.em[3] = Math.max(S_.em[3], Math.min(0.35 + (k.mode > 0 ? q.arr : 0), 1.3));
    // (whole: the break-up is over, and out of the cannon it is itself again; into the cannon: it is the barrel now; home, or back in the bay
    // in a hurry: every ember has got there, and a moment later it is stowed)
    if (k.mode < 0 && k.rate > 0 && bp >= 1){ q.bk = null; q.brk = 0; q.dm = 0; q.dg = 0; q.pres = 1; if (k.gun) q.form = 'pod'; }
    else if (k.gun && k.mode > 0 && bp >= 1){ q.bk = null; q.brk = 0; q.form = 'gun'; q.dm = 0; q.dg = 0; q.pres = 0; }
    else if ((k.mode > 0 && bp >= 1) || (k.mode < 0 && k.rate < 0 && bp <= 0)){ if (k.end < 0) k.end = u; if (u - k.end >= 0.1){ q.fin = true; O.fin = true; pipStow(); } }
  } else if (q.form === 'gun'){ q.dm = 0; q.dg = 0; q.pres = 0; q.arr = 0; }
  else { q.dm = 0; q.dg = 0; q.pres = 1; q.arr = 0; }
};
// a new outing: planned, everything else as it was on page load but the outings before and a job's call
function pipBegin(q, O){
  const keep = { last:q.last, lastActs:q.lastActs, outN:q.outN, req:q.req, wantT:q.wantT, nextBit:q.nextBit };
  Object.assign(q, pipFresh(), keep, { O, kind:pipKind(O.tg), u:O.tau - PIP_LAUNCH });
  q.rb = lcg(pipSeed(O) + 5);
  q.plan = pipOpen(O, q.req && S_.act === q.req ? q.req : null);
}
// home early and quickly (the ship is leaving now), in about 1.2 s: taking shape, it comes apart the way it came, its embers flying back into
// the bay; out and about, it glides to a stop (its error from the new plan dies away from its speed) and streams back into the bay from there;
// already on its way in, the rest goes quicker. Not out yet: it stays aboard, and the job is done at once.
drone.hurry = () => {
  const q = PIP, O = q.O; if (!O || O.fin) return false;
  if (q.hurry) return true;
  const u = O.tau - PIP_LAUNCH, P = q.plan; let k = q.bk;
  if (!P || u < 0 || q.st === 'stowed'){ q.fin = true; q.hurry = true; O.fin = true; pipStow(); return true; }
  q.hurry = true;
  // (the cannon, or on its way into it or out of it: it is itself again at once, where it docked, and streams home from there)
  if (q.form === 'gun' || (k && k.gun)){ q.bk = k = null; q.form = 'pod'; q.brk = 0; q.dm = 0; q.dg = 0; q.pres = 1; }
  if (k && k.mode < 0){ Object.assign(k, { u0:u, bp0:pipBp(k, u), rate:-1/PIP_HURRY }); q.home = true; }
  else if (k){ Object.assign(k, { u0:u, bp0:pipBp(k, u), rate:Math.max(k.rate, 1/PIP_HURRY) }); }
  else {
    const H = hullOut(V.add(q.anc, V.mul(q.ancV, 1/9)), PIP_R), g = P.segs[P.k];
    P.segs.length = P.k + 1; g.t1 = u; q.err = V.sub(q.anc, H); q.errV = q.ancV.slice(); q.Tp = H.slice();
    P.segs.push({ a:'home', t0:u, t1:1e9, dur:1e9, at:hold(H), look:'cam', thr:0.3, home:true, say:'Pip hurries back into the belly bay' });
    P.DIS0 = u + 0.15; P.IN = P.DIS0 + PIP_HURRY + 0.1;
  }
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
// looking at the camera (look: a turn of the gaze right and up; eyes: only the pupil turns; away: from the camera), with a given face (face,
// open, wink: FACES)
function pipPose(o){
  const q = PIP; q.st = 'pose'; q.dm = 0; q.dg = 0; q.pres = 1; q.bk = null; q.brk = 0;
  const pos = o.cam ? V.add(V.mul(ship.rel, -1), V.mul(V.add(V.add(V.mul(cam.right, o.cam[0]), V.mul(cam.up, o.cam[1])), V.mul(cam.fwd, o.cam[2])), ship.rad)) : localPt(o.at || [0.12, -1.3, 0.6]);
  q.pos = pos; drone.offset = pos; drone.pos = V.add(ship.pos, pos);
  const toCam = V.norm(V.mul(V.add(ship.rel, pos), -1)), lk = o.look || [0, 0];
  const want = V.norm(V.add(V.mul(toCam, o.away ? -1 : 1), V.add(V.mul(cam.right, lk[0]), V.mul(cam.up, lk[1]))));
  q.pupil = want; q.body = o.eyes ? toCam : want;
  q.face = o.face || 'curious'; q.fc = { ...FACES[q.face], ...o.fc }; q.open = (o.open ?? 1)*q.fc.open; q.wink = o.wink ?? 0;
  q.glow = o.glow ?? 1; q.thr = o.thr ?? 0.25; q.lamp = o.lamp ?? 0; q.scale = o.scale ?? 1; q.unfold = o.unfold ?? 1;
  q.ant = o.ant ?? 0; q.iris = o.iris || ICE_P;
  pipOrient(q, V.norm(localPt([-1, 0, 0])), null);
}
// how much of its volume shows (a glint takes over below about 1.8 pixels), 0 where the hull or the body is in front of it
function pipVis(){
  const q = PIP; if (q.st === 'stowed' || (q.form === 'gun' && !q.bk) || !progReady(drone.prog)) return 0;
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
  // (its trail, but where its own body is in front: flying at you, the points behind it came out between its eyes)
  for (const t of q.trail){ const pp = shipPt(t.l), f = 1 - t.age/0.45; if (f > 0 && !pipHidden(pp) && !(v > 0.1 && behindSphere(pp, p, drone.rad*0.6))) P_(pp, [0.5, 0.75, 1], 0.5*f*(1 - 0.5*v), -2); }
  if (q.spot && q.lamp > 0.02){ const s = shipPt(q.spot), n = hullN(q.spot); if (!behindHull(shipPt(V.add(q.spot, V.mul(n, 0.004)))) && V.dot(localDir(n), V.mul(s, -1)) > 0) P_(s, [0.75, 0.9, 1], 0.45*q.lamp, ship.rad*0.02); }
  if (g && g.fx === 'polish') pipSparkles(q, g);
  if (g && g.fx === 'weld') pipWeld(q, g);
  if (g && g.fx === 'data') pipData(q, g);
  if (g && g.fx === 'twinkle') pipTwinkle(q, g);
  pipMoteDraw(q);
  if (q.bk && q.cells) pipEmbers(q);
}
// gathering a scan's readings: motes of light rising from the body's side under it to Pip, each about a second on its way, spread evenly on
// the screen (they would crawl near the body and rush in at the end), only while the ring sweeps
function pipData(q, g){
  const A = g.job, tg = q.O && q.O.tg; if (!A || !tg || !(A.tau > SCAN.SW0 - 0.4) || q.form !== 'pod') return;
  const k = smooth(SCAN.SW0 - 0.4, SCAN.SW0 + 0.3, A.tau)*(1 - smooth(SCAN.SW0 + SCAN.SWT, SCAN.SW0 + SCAN.SWT + 0.6, A.tau)); if (k < 0.01) return;
  const sp = aimSphere(tg), C = tg.rel, R = sp.r || tg.rad*0.5, pip = drone.rel, d0 = V.norm(V.sub(pip, C)), e1 = anyPerp(d0), e2 = V.cross(d0, e1), zb = V.dot(pip, cam.fwd), t = q.u - g.t0;
  const occ = p => V.dot(p, cam.fwd) <= 0 || behindHull(p) || ((sp.solid || sp.hole) && behindSphere(p, C, R*0.998));
  for (let i=0;i<12;i++){
    const x = t*0.95 + i/12, n = Math.floor(x), s = x - n, a = pipHash(n, i, 13)*6.2832, b = 0.2 + 0.5*pipHash(n, i, 17);
    const src = V.add(C, V.mul(V.norm(V.add(d0, V.add(V.mul(e1, Math.cos(a)*b), V.mul(e2, Math.sin(a)*b)))), R*1.01)), za = V.dot(src, cam.fwd);
    const w = za > 0 && zb > 0 ? s*za/((1 - s)*zb + s*za) : s, p = V.lerp(src, pip, w);
    if (!occ(p)) P_(p, [0.45, 0.9, 1], k*0.9*Math.sin(Math.PI*s), s > 0.8 ? -3 : -2);
  }
}
// a twirl's sparkles: a few little stars circling out from it
function pipTwinkle(q, g){
  const t = q.u - g.t0, f = Math.sin(Math.PI*clamp(t/g.dur, 0, 1));
  for (let i=0;i<6;i++){ const a = i*1.0472 + t*3.2, r = drone.rad*(1.2 + 1.1*t), p = V.add(drone.rel, V.add(V.mul(cam.right, Math.cos(a)*r), V.mul(cam.up, Math.sin(a)*r)));
    if (!pipHidden(p)) P_(p, i % 2 ? PINKW_ : WHITE, f*(0.7 + 0.3*Math.sin(t*19 + i*2)), -2); }
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
// what Pip is doing, in words ('' while it is aboard)
function pipSay(){
  const q = PIP, O = q.O; if (!O || q.st === 'pose') return '';
  if (q.st !== 'out') return O.fin ? '' : O.tau - PIP_LAUNCH > -0.6 ? 'Pip streams out of the belly bay' : '';
  if (q.bk && q.bk.gun) return q.bk.mode > 0 ? 'Pip turns into the fold cannon' : 'the fold cannon turns back into Pip';
  if (q.form === 'gun') return 'Pip is the fold cannon';
  if (q.bk && (q.bk.mode > 0 || q.bk.rate < 0)) return q.hurry ? 'Pip hurries back into the belly bay' : 'Pip streams back into the belly bay';
  const g = q.g; if (!g) return 'Pip streams out of the belly bay and takes shape';
  return typeof g.say === 'function' ? g.say(q.u, g) : g.say;
}
// the show's line in the readout (the probe job)
function pipLine(A){
  if (A.fin) return 'Pip is done showing off' + (PIP.shots ? ` · ${PIP.shots} photo${PIP.shots > 1 ? 's' : ''} of the Halo` : '');
  return pipSay() || 'approaching ' + A.tg.name + " · Pip, the ship's drone, gets ready";
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
Object.defineProperty(drone, 'state', { get:() => ({ st:PIP.st, kind:PIP.kind, out:pipOut(), form:PIP.form, bit:PIP.plan && PIP.st === 'out' ? PIP.plan.a : null, say:pipSay(), shots:PIP.shots, flash:PIP.flash, thr:PIP.thr, vis:PIP.vis, pos:PIP.pos.slice(),
  bayD:V.len(V.sub(PIP.pos, localPt(HULL.bay)))/ship.rad, shows:pipShows(), scale:PIP.scale, pres:PIP.pres, brk:PIP.brk, embIn:PIP.embIn, embN:PIP.embN, face:PIP.face, fc:{ ...PIP.fc }, wink:PIP.wink,
  open:PIP.open, act:PIP.g ? PIP.g.a : null, fin:PIP.fin, hurry:PIP.hurry, clr:PIP.clrNow ?? 9, far:PIP.farNow ?? 0, clrMin:PIP.clr, farMax:PIP.far }) });
ship.dbg.drone = { get state(){ return drone.state; }, pose(o){ PIP.pose = o || null; if (!o) pipStow(); }, hurry:() => drone.hurry(), hullD, PIP_R, PIP_BITS,
  // (the lab: one of its bits now; out of the bay first if it is aboard and may come out)
  bit(b){ if (!PIPB[b] && !PIPA[b]) return false; PIP.nextBit = b; if (!PIP.O) PIP.wantT = 99; return true; },
  get plan(){ const P = PIP.plan; return P && PIP.O && { acts:P.acts.slice(), launch:P.launch, ret:P.ret, sig:P.sig, DIS0:P.DIS0, IN:P.IN, k:P.k, segs:P.segs.map(g => [g.a, +(g.t0 || 0).toFixed(2), g.fly ? 'fly' : '']) }; },
  mix:(seed, near = false, last = "", lastActs = "") => pipMix(lcg(seed), near, last, lastActs) };

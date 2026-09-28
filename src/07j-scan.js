
// ================================================================ the Halo's scan: a hologram sweep (made up, like the ship; the numbers it finds are real)
// A bright ring, where a plane meets the drawn surface, passes over the body from one pole to the other along its real spin axis (along the
// ship's track where we know of none). Behind it a glowing grid of latitude and longitude lines wraps the surface, shimmers and fades a few
// seconds after the ring has gone by; brackets lock onto real features the body's shader draws at known places (the Great Red Spot, Saturn's
// hexagon, Olympus Mons...), each named by a small label; a thin fan of light joins the ship's scan array to the ring. As the ring reaches
// the far pole a line traces the rim, and the readout gives real numbers (size, gravity, a day). Stars: the sweep runs over the photosphere.
// Black holes: the rings run round a shell just outside the shadow and are never drawn inside it; the rim trace is the shadow's edge.
// Nebulae and clusters: a grid shell round the heart. Galaxies: a flattened shell round the disc, swept along the ship's track (seen face-on
// its grid is rings and spokes, seen edge-on a lens). At the end the numbers also show for a moment at the bottom of the screen (a toast).
// The ring and the grid are a hologram drawn pixel by pixel (FS_HOLO) right after the body itself (its drawBefore, while the job runs), so it
// lies exactly on the drawn surface, stops exactly at its rim, and anything nearer (the Halo, a moon, Saturn's rings) still covers it. Its lines
// are about one character wide and cover part of what is under them, so they keep their colour over a bright planet. Brackets and the fan
// are lines: brackets in a buffer of their own (SCB, which covers what is under it the same way), the fan in the Halo's (L_ in 07h-halo.js).
// This file loads after 07h-halo.js (it uses ACT, ACTS, S_, HULL and the effect helpers there).

// the timeline, on the job's own clock (s): the ring leaves the first pole at SW0 and reaches the other SWT later; the grid behind it glows
// for HOLD after the ring has passed, then fades over FADE; brackets and the readout's numbers follow the ring; the rim is traced after it
const SCAN = { SW0:0.9, SWT:6, HOLD:2, FADE:1.8 };
const SC_RING = [0.8, 0.96, 1], SC_GRID = [0.36, 0.82, 1], SC_BRK = [0.72, 0.96, 1];

// ---------------------------------------------------------------- real numbers, for the readout (each is shown as the ring finds it).
// Planets and moons: equatorial diameter, surface gravity and one turn on the axis (the sidereal rotation). NASA NSSDCA planetary fact sheets
// (nssdc.gsfc.nasa.gov/planetary/factsheet: Earth, Moon, Mars, Jupiter, Saturn; the Jovian and Saturnian satellite sheets for Io, Europa and
// Titan, their gravity from GM/R^2). Jupiter's turn is System III (9 h 55 min 29.7 s); Saturn's inner turn is from Cassini's ring seismology
// (Mankovich et al. 2019: 10 h 33 min 38 s, give or take a minute or two, so "about"). Ceres: Dawn (Park et al. 2016; NASA: 939.4 km, 9.074 h),
// gravity from GM 62.63 km^3/s^2. Halley: the Giotto images (Keller et al. 1986). The Sun: NASA's Sun fact sheet (695,700 km, 274 m/s^2,
// a turn in 25.38 days, the Carrington period: its equator turns a little faster, its poles slower) and the IAU's 5,772 K. Stars: the radii
// and temperatures the atlas draws them with (o12-stars.js, o13-betelgeuse.js:
// Kervella et al. 2017 for Alpha Centauri A and Proxima, Kervella et al. 2003 and Bond et al. 2017 for Sirius, Agol et al. 2021 and Mann et al. 2019
// for TRAPPIST-1, Ohnaka et al. 2013 for Antares, Joyce et al. 2020 for Betelgeuse). SGR 1806-20: its spin (Kouveliotou et al. 1998, 7.5 s)
// and field; its size is a typical neutron star's. Black holes, nebulae, clusters and galaxies: the numbers their own readouts and facts in this
// atlas give (the Event Horizon Telescope for M87* and Sgr A*, GRAVITY for Sgr A*'s mass, NASA and ESA for the rest; the LMC's width is NASA's).
// The Antennae's distance is disputed (13.3 Mpc, 43 million light-years, from its red giants: Saviane et al. 2008; 22.3 Mpc, 73 million, from
// its supernova 2007sr: Schweizer et al. 2008), so a range. Uncertain ones say "about".
const SCAN_FACTS = {
  earth:['12,756 km wide', 'gravity 9.8 m/s²', 'turns once in 23 h 56 min 4 s'],
  moon:['3,475 km wide', 'gravity 1.62 m/s²', 'turns once in 27.3 days'],
  mars:['6,792 km wide', 'gravity 3.71 m/s²', 'turns once in 24 h 37 min 22 s'],
  jupiter:['142,984 km wide', 'gravity 24.8 m/s²', 'turns once in 9 h 55 min 30 s'],
  saturn:['120,536 km wide', 'gravity 10.4 m/s²', 'turns once in about 10 h 34 min'],
  titan:['5,150 km wide', 'gravity 1.35 m/s²', 'turns once in 15.9 days'],
  io:['3,643 km wide', 'gravity 1.80 m/s²', 'turns once in 1.77 days'],
  europa:['3,122 km wide', 'gravity 1.31 m/s²', 'turns once in 3.55 days'],
  ceres:['939 km wide', 'gravity 0.28 m/s²', 'turns once in 9 h 4 min'],
  halley:['nucleus about 15 km long', 'one lap of the Sun in 76 years'],
  sun:['1.39 million km wide', 'surface 5,772 K (5,500 °C)', 'gravity 274 m/s²', 'turns once in about 25 days'],
  alphacen:['1.7 million km wide', 'surface 5,790 K', '1.1 times the Sun\'s mass'],
  proxima:['215,000 km wide', 'surface 3,042 K', '0.12 times the Sun\'s mass'],
  sirius:['2.4 million km wide', 'surface 9,940 K', '2.1 times the Sun\'s mass'],
  trappist1:['166,000 km wide, a little wider than Jupiter', 'surface 2,566 K', '0.09 times the Sun\'s mass'],
  antares:['about 680 times the Sun\'s width', 'surface about 3,660 K'],
  betelgeuse:['about 764 times the Sun\'s width', 'surface about 3,600 K'],
  magnetar:['about 24 km wide', 'field about 10^15 gauss', 'turns once in about 7.5 s'],
  sgra:['4.3 million Suns', 'event horizon 25 million km across'],
  m87bh:['6.5 billion Suns', 'event horizon 38 billion km across'],
  ton618:['about 40 billion Suns', 'event horizon about 1,600 AU across'],
  pillars:['tallest pillar about 4 light-years high', '6,500 light-years away'],
  crab:['about 11 light-years across', 'its pulsar turns 30 times a second'],
  etacar:['two stars of about 90 and 30 Suns', 'a 5.5-year orbit'],
  catseye:['central star about 80,000 K', 'a shell every 1,500 years or so'],
  hltau:['disc about 240 AU across', 'gaps at 13 to 81 AU from the star'],
  omegacen:['about 150 light-years across', 'about 10 million stars'],
  sn1987a:['168,000 light-years away', 'its star, about 20 Suns, was seen to explode in 1987'],
  casa:['about 10 light-years across', 'debris flying out at up to 14,000 km/s'],
  bubble:['7 light-years wide', 'its star is about 45 times the Sun\'s mass'],
  southernring:['about half a light-year across', '2,500 light-years away'],
  pleiades:['about 1,000 stars', 'about 115 million years old'],
  rsoph:['one orbit takes about 454 days', 'a nova every 15 to 20 years'],
  galcentre:['26,670 light-years away', 'millions of stars within a few light-years'],
  '3c273':['2.4 billion light-years away', 'jet about 200,000 light-years long'],
  andromeda:['about 220,000 light-years across', 'about a trillion stars'],
  m51:['76,000 light-years across', '31 million light-years away'],
  antennae:['NGC 4038 and NGC 4039, two spirals colliding', 'about 45 to 75 million light-years away'],
  milkyway:['about 100,000 light-years across', 'about 200 billion stars'],
  lmc:['about 14,000 light-years across', '163,000 light-years away'],
  m104:['50,000 light-years across', '31 million light-years away'],
};

// ---------------------------------------------------------------- the shape the sweep runs over
// Bodies whose frame is their real one (the IAU pole and turn in addBody and the planets' own files, the Sun's pole): the ring runs along
// their spin axis. A black hole's frame has its disk in local xz, so its axis is the disk's. Anything else: the ship's track.
const SCAN_AXIS = new Set(['earth', 'moon', 'mars', 'jupiter', 'saturn', 'titan', 'io', 'europa', 'ceres', 'sun']);
// Jupiter's shader flattens it (OBL 0.0649 in o00j-jupiter.js): its surface is a spheroid, polar radius 0.9351 of the equatorial
const SCAN_OBL = { jupiter:0.0649 };
// the shell round a cloud's heart (or round Halley's nucleus, which has no round surface), as a share of its bounding radius
const SCAN_SHELL = { halley:0.95, pillars:0.72, crab:0.62, catseye:0.45, omegacen:0.5, pleiades:0.55, casa:0.6, bubble:0.5, southernring:0.7, sn1987a:0.45,
  etacar:0.55, hltau:0.7, rsoph:0.7, galcentre:0.35, '3c273':0.25, magnetar:0.7, antennae:0.45 };
// galaxies drawn as a disc in their local xz plane: the share of the bounding radius the scan covers, and the shell's thickness (a flattened
// shell wraps the disc: seen face-on its grid is rings and spokes, seen edge-on a lens)
const SCAN_DISC = { andromeda:0.62, m51:0.7, milkyway:0.62, lmc:0.7, m104:0.75 }, SCAN_LENS = 0.16;
// kind: 0 a solid surface (planet, moon, star), 1 a shell round a cloud, 2 a shell round a black hole, 3 a flattened shell round a galaxy's disc
function scanShape(tg, axisT){
  const C = tg.rel, sh = { C, tg };
  if (isHoleTarget(tg)){ const r = tg.holeR*2; return Object.assign(sh, { kind:2, hole:true, hr:tg.holeR, R:tg.rot, a:r, b:r, real:true }); }
  if (SCAN_DISC[tg.key]){ const a = tg.rad*SCAN_DISC[tg.key]*magOf(tg); return Object.assign(sh, { kind:3, disc:true, R:tg.rot, a, b:a*SCAN_LENS, real:true }); }
  const s = SCAN_SHELL[tg.key] ? 0 : surfDrawn(tg);
  if (s > 0){
    const real = SCAN_AXIS.has(tg.key), ob = SCAN_OBL[tg.key] || 0;
    return Object.assign(sh, { kind:0, solid:true, R:real ? tg.rot : axisT, a:s, b:s*(1 - ob), real });
  }
  const r = tg.rad*(SCAN_SHELL[tg.key] || 0.6)*magOf(tg);
  return Object.assign(sh, { kind:1, cloud:true, R:axisT, a:r, b:r, real:false });
}
// a point of the shape from a point (q0, q1, q2) of the unit sphere it is scaled from (its own frame), camera-relative, and its outward normal
// (world axes); and the same from a latitude and longitude (longitude growing toward local -z as in bodyFrame; for a spheroid the parametric
// latitude, as Jupiter's shader has it)
function shapePt(sh, q0, q1, q2, out){
  const x = sh.a*q0, y = sh.b*q1, z = sh.a*q2, R = sh.R, C = sh.C;
  out.p[0] = C[0] + R[0]*x + R[3]*y + R[6]*z; out.p[1] = C[1] + R[1]*x + R[4]*y + R[7]*z; out.p[2] = C[2] + R[2]*x + R[5]*y + R[8]*z;
  const n0 = q0/sh.a, n1 = q1/sh.b, n2 = q2/sh.a, nx = R[0]*n0 + R[3]*n1 + R[6]*n2, ny = R[1]*n0 + R[4]*n1 + R[7]*n2, nz = R[2]*n0 + R[5]*n1 + R[8]*n2;
  const nl = Math.hypot(nx, ny, nz) || 1; out.n[0] = nx/nl; out.n[1] = ny/nl; out.n[2] = nz/nl;
  return out;
}
const globePt = (sh, la, lo, out) => { const c = Math.cos(la); return shapePt(sh, c*Math.cos(lo), Math.sin(la), -c*Math.sin(lo), out); };
// how squarely a point on the shape faces the camera (1 straight on, 0 at the limb, < 0 on the far side)
const facing = (p, n) => -(p[0]*n[0] + p[1]*n[1] + p[2]*n[2])/(Math.hypot(p[0], p[1], p[2]) || 1);
// in a black hole's shadow as seen from the camera (the line of sight passes within the shadow's radius of the hole, beyond the camera):
// never drawn there. It is the shader's own test: a ray is caught when its impact parameter is under 2.6 r_s, which is holeR.
function inShadow(p, C, hr){
  const pl = Math.hypot(p[0], p[1], p[2]) || 1, cx = C[1]*p[2] - C[2]*p[1], cy = C[2]*p[0] - C[0]*p[2], cz = C[0]*p[1] - C[1]*p[0];
  return Math.hypot(cx, cy, cz)/pl < hr*1.03 && (p[0]*C[0] + p[1]*C[1] + p[2]*C[2]) > 0;
}

// ---------------------------------------------------------------- the hologram, pixel by pixel
// Local frame: the shape's own (+y its axis), the bounding sphere 1 (the volume is drawn a little larger than the shape, so the rim trace fits).
// The sweep runs along an axis of its own (a planet's: its axis; a galaxy's: the ship's track, flattened onto the disc): the ring is where the
// plane square to it cuts the shape, and "height" is along it, -1 to 1 across the shape.
// uP0: xy the shape's equatorial and polar radii, z the ring's height, w the sweep's direction (1 or -1: which end is first)
// uP1: x the job's clock, y when the ring leaves the first end (SW0), z how long it takes (SWT), w HOLD
// uP2: x FADE, y the kind (0 solid, 1 a cloud's shell, 2 a hole's shell, 3 a galaxy's), z a hole's shadow radius, w the rim trace (0 to 1)
// uP3: x, y the grid's spacing in latitude and longitude (radians), z the grid's brightness, w the ring's (0 when it is not sweeping)
// uP4: Saturn's rings, in front of the planet: x, y their inner and outer radius, z 1 when there are any; w the reduced-motion flag
// uM0 column 0: the sweep's axis in the unit sphere the shape is scaled from (height = dot(q, it)); column 1: how much of what is under them
// the lines cover, how much the swept surface is dimmed
const FS_HOLO = COMMON + `
float lineAA(float d, float w){ return 1. - smoothstep(0.5*w, 1.5*w, d); }
float wakeAt(float dt){ return dt < 0. ? 0. : (0.6 + 0.9*exp(-dt/0.3))*(1. - smoothstep(uP1.w, uP1.w + uP2.x, dt)); }
float passAt(float s){ return uP1.y + uP1.z*acos(clamp(uP0.w*s, -1., 1.))/PI; }
const vec3 RINGC = vec3(0.62, 0.93, 1.), GRIDC = vec3(0.36, 0.82, 1.), CYANC = vec3(0.4, 0.85, 1.);
// the hologram at a point q of the unit sphere the shape is scaled from: its height along the sweep h, how fast its latitude, the distance to
// the nearest meridian and the height's angle change from one pixel to the next (wla, wmg, wh), and this side's share w (1 in front, less
// for the far side of a shell)
void globeAt(vec3 q, float h, float wla, float wmg, float wh, float w, inout vec3 col, inout float al){
  float la = asin(clamp(q.y, -1., 1.)), tau = uP1.x, dir = uP0.w, wk = wakeAt(tau - passAt(h));
  float lo = atan(-q.z, q.x), shim = uP4.w > 0.5 ? 1. : 0.8 + 0.2*sin(tau*2.4 + la*9. + lo*3.);
  // the grid: latitude lines and meridians, in the shape's own frame
  float dLa = uP3.x, dLo = uP3.y;
  float gl = lineAA(abs(la - dLa*floor(la/dLa + 0.5)), 2.2*wla)*step(abs(la), 1.45);
  float lk = dLo*floor(lo/dLo + 0.5), dm = abs(q.x*sin(lk) + q.z*cos(lk)), gm = lineAA(dm, 2.2*wmg)*smoothstep(0.985, 0.93, abs(q.y));
  float g = max(gl, gm)*wk*uP3.z*shim*w;
  // (the lines cover part of what is under them, uM0[1].x; the swept surface is dimmed a little while the grid glows on it, uM0[1].y, so the
  // lines stand out on a bright planet, or on the near side of a hole's shell in front of its bright disk)
  col += GRIDC*g; al = max(al, max(uM0[1].x*min(g, 1.), uM0[1].y*min(wk, 1.)*step(0.5, w)));
  // the ring: a bright line about a character wide where the plane cuts the surface, and a short cyan wake behind it (the swept side); it
  // burns brighter where it crosses a meridian (the knots in the sketch: =#===#===#=)
  if(uP3.w > 0.){
    float dr = asin(clamp(h, -1., 1.)) - asin(clamp(uP0.z, -1., 1.)), back = dir*dr;
    float core = lineAA(abs(dr), 1.9*wh)*(1. + 1.1*lineAA(dm, 4.*wmg)), tail = back > 0. ? exp(-back/(5.*wh)) : 0.;
    float r = (core*2. + tail*0.45)*uP3.w*w;
    col += (RINGC*core*2. + CYANC*tail*0.45)*uP3.w*w; al = max(al, min(r, 1.)*0.65);
  }
}
void main(){
  vec3 o, d; localRay(o, d);
  float kind = uP2.y;
  vec3 col = vec3(0.); float al = 0.;
  // scaled to a unit sphere (a spheroid becomes one)
  vec3 sc = vec3(uP0.x, uP0.y, uP0.x), os = o/sc, ds = normalize(d/sc), M = uM0[0];
  float b = dot(os, ds), c = dot(os, os) - 1., h = b*b - c, sq = sqrt(max(h, 0.));
  float t0 = -b - sq, t1 = -b + sq;
  // (every pixel works out the same things before any is left out: the pixel-to-pixel changes need all four of each little square)
  vec3 qf = normalize(os + ds*max(t0, 0.)), qb = normalize(os + ds*max(t1, 0.));
  float hF = dot(qf, M), hB = dot(qb, M);
  float wF = min(fwidth(asin(clamp(qf.y, -1., 1.))), 0.06), wB = min(fwidth(asin(clamp(qb.y, -1., 1.))), 0.06);
  float whF = min(fwidth(asin(clamp(hF, -1., 1.))), 0.06), whB = min(fwidth(asin(clamp(hB, -1., 1.))), 0.06);
  float lkF = uP3.y*floor(atan(-qf.z, qf.x)/uP3.y + 0.5), lkB = uP3.y*floor(atan(-qb.z, qb.x)/uP3.y + 0.5);
  float wmF = min(fwidth(qf.x*sin(lkF) + qf.z*cos(lkF)), 0.06), wmB = min(fwidth(qb.x*sin(lkB) + qb.z*cos(lkB)), 0.06);
  // the ray's closest pass by the surface (below 0 it hits), for the rim trace
  float m = length(cross(os, ds)) - 1., wm = min(fwidth(m), 0.05);
  // a black hole: nothing inside its shadow (the ray's impact parameter under the shadow's radius)
  float bi = length(cross(o, d)), hole = kind > 1.5 && kind < 2.5 ? step(uP2.z*1.03, bi) : 1.;
  bool hit = h > 0. && t1 > 0.;
  if(hit && t0 > 0.){
    float wf = 1.;
    // (Saturn: its rings in front of the planet cover it)
    if(uP4.z > 0.5 && abs(d.y) > 1e-5){ float tr = -o.y/d.y; vec3 pr = o + d*tr; float rr = length(pr.xz);
      if(tr > 0. && tr < length((os + ds*t0)*sc - o)) wf *= 1. - 0.85*smoothstep(uP4.x, uP4.x*1.02, rr)*smoothstep(uP4.y, uP4.y*0.99, rr); }
    globeAt(qf, hF, wF, wmF, whF, wf*hole, col, al);
  }
  // a shell (not a solid surface): its far side too, dimmer (a galaxy's flattened shell most of all, or its two faces' grids would crowd together)
  if(hit && kind > 0.5) globeAt(qb, hB, wB, wmB, whB, (kind > 2.5 ? 0.15 : 0.3)*hole, col, al);
  // the rim trace (a hole's: the edge of its shadow)
  if(uP2.w > 0.){ float e = kind > 1.5 ? lineAA(abs(bi - uP2.z*1.03), 1.9*min(fwidth(bi), 0.05)) : lineAA(abs(m), 1.9*wm);
    col += RINGC*e*1.3*uP2.w; al = max(al, e*0.5*uP2.w); }
  outCol(col, al);
}`;
P.scanHolo = program(VS_RECT, FS_HOLO);

// ---------------------------------------------------------------- brackets: lines in a buffer and a shader of their own
// (aC.w is how much of what lies under a line it covers, so a bracket keeps its colour over a bright surface. Nothing shows through a black
// hole's shadow, as in VS_FX.)
const VS_SCAN = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC;
uniform mat3 uCamRot; uniform vec2 uTan; uniform float uOut; uniform float uSB; uniform vec4 uHole;
out vec4 vC;
void main(){
  vec3 w = aP.xyz, v = w*uCamRot; float br = aP.w;
  if(uHole.w > 0.){ float lw = length(w); if(lw > length(uHole.xyz) - uHole.w && dot(w, uHole.xyz) > 0. && length(cross(uHole.xyz, w))/lw < uHole.w) br = 0.; }
  gl_Position = vec4(v.x/uTan.x, v.y/uTan.y, 0., v.z);
  vC = vec4(aC.rgb*max(br, 0.)*uSB*uOut, br > 0. ? aC.w : 0.);
}`;
P.scanLn = program(VS_SCAN, `#version 300 es
precision mediump float;
in vec4 vC; out vec4 o;
void main(){ o = vC; }`);
const SCB = { ln:makePS(400), nl:0 };
// one line (camera-relative ends p, q; colour, brightness, how much it covers), then the same two scene pixels thick: a second copy one
// pixel beside it, across it on the screen (a character is two scene pixels wide and tall, so a one-pixel line only half covers the cells
// it crosses). Lines need LK times a point's light.
function SL_(p, q, c, br, al){
  if (SCB.nl + 2 > SCB.ln.n || !(br > 0.004)) return;
  const a = SCB.ln.a, k = SCB.ln.c; let i = SCB.nl*4; br *= LK;
  a[i] = p[0]; a[i + 1] = p[1]; a[i + 2] = p[2]; a[i + 3] = br; k[i] = c[0]; k[i + 1] = c[1]; k[i + 2] = c[2]; k[i + 3] = al; i += 4;
  a[i] = q[0]; a[i + 1] = q[1]; a[i + 2] = q[2]; a[i + 3] = br; k[i] = c[0]; k[i + 1] = c[1]; k[i + 2] = c[2]; k[i + 3] = al; SCB.nl += 2;
}
const SO = [0, 0, 0], SQ = [0, 0, 0];
function SL2_(p, q, c, br, al){
  SL_(p, q, c, br, al);
  const r = cam.right, u = cam.up, f = cam.fwd, wx = q[0] - p[0], wy = q[1] - p[1], wz = q[2] - p[2];
  const across = Math.abs(wx*r[0] + wy*r[1] + wz*r[2]) >= Math.abs(wx*u[0] + wy*u[1] + wz*u[2]), o = across ? u : r, px = across ? 2*tanY/sceneH : 2*tanX/sceneW;
  const zp = (p[0]*f[0] + p[1]*f[1] + p[2]*f[2])*px, zq = (q[0]*f[0] + q[1]*f[1] + q[2]*f[2])*px;
  for (let k=0;k<3;k++){ SO[k] = p[k] + o[k]*zp; SQ[k] = q[k] + o[k]*zq; }
  SL_(SO, SQ, c, br, al);
}

// ---------------------------------------------------------------- real features the bodies draw at fixed places, for the brackets
// On a planet or a moon (at): lat, lon in radians in the body's own frame (+y north, longitude toward local -z, as FS_PLANETG and Jupiter's shader
// measure it; FS_PLANETG's `lat` is the sine of the latitude, so asin is taken here), r the bracket's half size in radians of arc. Each checked
// against the shader that draws it: Jupiter (o00j-jupiter.js), Saturn (o10-planet.js), the Moon, Mars, Io and Ceres (surface() in o00-sun.js),
// Earth (its map). Elsewhere: another object of the atlas at its real place (obj), or a point of the object's own drawing (local: its frame, in
// units of its bounding radius, where its shader or particles put it), r in units of the bounding radius.
const asinS = Math.asin;
// (the Pleiades' bright stars sit at their sky positions, 444 light-years out, their depths scattered by 0.12 of the cluster's radius, as in p5-wonders.js)
const pleiad = (h, m, s, dd, dm, ds, dz) => tg => { const l = V.mul(M3.applyT(tg.R0, V.sub(radec(hms(h, m, s), dms(dd, dm, ds), 444), tg.pos)), 1/tg.rad); return [l[0], l[1], l[2] + dz]; };
const SCAN_SPOTS = {
  // (the Great Red Spot drifts slowly against System III, as the shader has it: glon = lon + t 0.0015 - 1.1)
  jupiter:[{ name:'Great Red Spot', r:0.11, at:tg => [-22.4*DEG, 1.1 - tg.t*0.0015] }],
  // (the hexagon, 76 to 78 degrees north round the pole: FS_PLANET's `lat > 0.85`, hexR = 0.2/cos)
  saturn:[{ name:'the hexagon', r:0.22, at:() => [Math.PI/2, 0] }],
  mars:[{ name:'Olympus Mons', r:0.07, at:() => [asinS(0.31), -2.34] }, { name:'Valles Marineris', r:0.16, at:() => [asinS(-0.24), -1.4] },
    { name:'Syrtis Major', r:0.12, at:() => [asinS(0.15), 1.22] }, { name:'north polar cap', r:0.2, at:() => [Math.PI/2, 0] }, { name:'south polar cap', r:0.16, at:() => [-Math.PI/2, 0] }],
  moon:[{ name:'Tycho', r:0.05, at:() => [-0.76, -0.19] }, { name:'Copernicus', r:0.05, at:() => [0.17, -0.35] }, { name:'Mare Imbrium', r:0.18, at:() => [asinS(0.56), -0.28] },
    { name:'Mare Tranquillitatis', r:0.13, at:() => [asinS(0.15), 0.54] }, { name:'Mare Crisium', r:0.08, at:() => [asinS(0.28), 1.03] }, { name:'Oceanus Procellarum', r:0.3, at:() => [asinS(0.2), -0.95] }],
  io:[{ name:'Pele', r:0.26, at:() => [-0.326, 1.83] }],
  ceres:[{ name:'Occator crater', r:0.06, at:() => [0.346, 4.177] }],
  // (Earth: real coastlines from its map; places in degrees)
  earth:[{ name:'Sahara', r:0.2, at:() => [23*DEG, 12*DEG] }, { name:'Amazon rainforest', r:0.16, at:() => [-4*DEG, -62*DEG] }, { name:'Greenland', r:0.14, at:() => [72*DEG, -41*DEG] },
    { name:'Antarctica', r:0.3, at:() => [-Math.PI/2, 0] }, { name:'Australia', r:0.24, at:() => [-25*DEG, 134*DEG] }, { name:'Himalayas', r:0.09, at:() => [29*DEG, 84*DEG] }],
  // galaxies: their neighbours and parts where the atlas has them
  andromeda:[{ name:'M32', obj:'m32', r:0.04 }, { name:'M110', obj:'m110', r:0.06 }, { name:'nucleus', local:[0, 0, 0], r:0.04 }],
  // (the bright core the galaxy shader draws round Sgr A*; the Sun and Sgr A* themselves are too small to be drawn at this scale)
  milkyway:[{ name:'Galactic Centre', local:[0, 0, 0], r:0.03 }],
  lmc:[{ name:'Tarantula Nebula', obj:'tarantula', r:0.04 }, { name:'SN 1987A', obj:'sn1987a', r:0.02 }],
  // (NGC 5195 at the end of an arm, where o05-spiral.js puts it: compPos)
  m51:[{ name:'NGC 5195', local:tg => { const pa = 4.2 + tg.t*0.03 - 0.64; return [Math.cos(pa), -0.05, Math.sin(pa)]; }, r:0.12 }, { name:'nucleus', local:[0, 0, 0], r:0.04 }],
  m104:[{ name:'nucleus', local:[0, 0, 0], r:0.05 }],
  // (the Galactic Centre's frame is the Milky Way's; Sgr B2, the Arches and the Quintuplet where FS_GALCENTRE draws them)
  galcentre:[{ name:'Sgr A*', local:[0, 0, 0], r:0.02 }, { name:'Sgr B2', local:[0.05, -0.01, 0.74], r:0.05 }, { name:'Arches cluster', local:[-0.05, 0.02, 0.14], r:0.03 },
    { name:'Quintuplet cluster', local:[0.1, -0.01, 0.19], r:0.03 }],
  // nebulae and clusters: the stars that made or light them
  // (the pulsar's glow at the heart of FS_CRAB)
  crab:[{ name:'Crab Pulsar', local:[0, 0, 0], r:0.04 }],
  // (the head of the tallest column in FS_NEBULA: x = -0.32 + 0.035 (top + 1)^2, top 0.42)
  pillars:[{ name:'the tallest pillar', local:[-0.249, 0.42, -0.011], r:0.1 }],
  pleiades:[{ name:'Alcyone', local:pleiad(3, 47, 29.1, 24, 6, 18, -0.12), r:0.04 }, { name:'Merope', local:pleiad(3, 46, 19.6, 23, 56, 54, 0), r:0.04 },
    { name:'Atlas', local:pleiad(3, 49, 9.7, 24, 3, 12, 0), r:0.04 }],
  magnetar:[{ name:'the neutron star', local:[0, 0, 0], r:0.1 }],
};

// ---------------------------------------------------------------- labels on the brackets (DOM, like the site's labels: cyan, in [ ])
const SCAN_LAB = [];
function scanLabel(i){
  if (!SCAN_LAB[i]){ const b = document.createElement('span'); b.className = 'lab ship'; b.style.pointerEvents = 'none'; b.style.cursor = 'default'; $('#labels').appendChild(b); SCAN_LAB[i] = b; }
  return SCAN_LAB[i];
}
function scanLabelsOff(except){ for (const el of SCAN_LAB) if ((!except || !except.has(el)) && el.classList.contains('on')) el.classList.remove('on'); }
// (drew: the job drew this frame; holo: how many times the hologram has been drawn; lines: the last frame's bracket lines; noHolo: tests leave the hologram out)
const SCAN_DBG = { drew:false, holo:0, lines:0, noHolo:false };

// ---------------------------------------------------------------- the job
ACT.scan = pl => {
  const tg = pl.tg, T = ACTS.scan.T, facts = SCAN_FACTS[tg.key] || [], spots = SCAN_SPOTS[tg.key] || [];
  const A = { kind:'scan', tg, tau:-9, dir:0, axisT:null, dAx:null, lock:spots.map(() => -1), nl:0, np:0, shown:[], holoU:null };
  const P1 = { p:[0, 0, 0], n:[0, 0, 0] };
  // the ring's height along the axis (1 the first pole, -1 the other), from the sweep's share u: evenly in latitude
  const ringS = u => Math.cos(Math.PI*clamp(u, 0, 1));
  const sweepU = tau => (tau - SCAN.SW0)/SCAN.SWT;
  A.update = (dt, tau) => {
    A.tau = tau;
    // the scan array lights up as the sweep starts and glows while it runs (the belly light, uP2.x)
    const on = smooth(0, 0.5, tau)*(1 - smooth(SCAN.SW0 + SCAN.SWT, SCAN.SW0 + SCAN.SWT + 0.8, tau));
    if (on > 0) S_.em[0] = on*(0.7 + 0.15*Math.sin(tau*7));
    // (the sweep's frame and direction are chosen here and brackets lock here, every tick, so neither depends on which frames are drawn: the
    // camera and the places are the last tick's)
    if (live()){ const g = A.geo(); if (spots.length && g.u > -0.1) lockSpots(g); }
    // as the ring reaches the far end, the numbers also show for a moment at the bottom of the screen (on a phone the readout is folded away
    // in the card); not while a showcase's caption is being written there
    if (!A.told && sweepU(tau) >= 1 && live()){ A.told = true; if (riding() && facts.length && !SHOWCAP.txt) toast(tg.name + ' scanned · ' + facts.join(' · ')); }
  };
  A.env = () => env(A.tau, T);
  A.line = () => {
    const tau = A.tau, nm = tg.name, u = sweepU(tau);
    if (tau < 0) return 'approaching ' + nm + ' · scanner warming up';
    if (u < 0) return 'scanning ' + nm + ' · locking on';
    // (each number appears once the ring has covered its share of the body, the last one as it reaches the far pole)
    const got = facts.filter((f, i) => u >= (i + 1)/(facts.length + 0.25));
    if (u < 1) return `scanning ${nm} · ${Math.round(u*100)}%` + (got.length ? '\n' + got.join(' · ') : '');
    return `scan of ${nm} complete (real numbers)` + (facts.length ? '\n' + facts.join(' · ') : '');
  };
  // the hologram is drawn right after the body (its drawBefore, which runs just after its volume), and put back as it was when the job ends
  const prevDB = Object.prototype.hasOwnProperty.call(tg, 'drawBefore') ? tg.drawBefore : undefined, holoDB = function(vis){ if (prevDB) prevDB.call(this, vis); drawHolo(); };
  tg.drawBefore = holoDB;
  A.end = () => { scanLabelsOff(); if (tg.drawBefore === holoDB){ if (prevDB) tg.drawBefore = prevDB; else delete tg.drawBefore; } };
  // this frame's geometry: the shape; the sweep's axis (sw, in the shape's own frame: its own axis, or for a galaxy the ship's track flattened
  // onto its disc), the same in the unit sphere the shape is scaled from (mh: a point's height along the sweep is dot(q, mh)) and in world
  // axes (ax); the sweep's direction (chosen once, as the ring starts: from whichever end of the axis is higher on the screen, so it sweeps
  // down), how far it has gone (u) and the ring's height (s)
  A.geo = () => {
    const tau = A.tau;
    // (the sweep's frame, fixed as it starts: the body's own where it is real, else the ship's track)
    if (!A.axisT){ const h = S_.h, u = V.norm(V.sub(tg.rel, ship.rel)); let x = perpTo(u, h); x = V.len(x) > 1e-6 ? V.norm(x) : anyPerp(h); A.axisT = frameY(h, x); }
    const sh = scanShape(tg, A.axisT);
    if (sh.disc && !A.dAx){ const R = sh.R, n = [R[3], R[4], R[5]]; let w = perpTo(S_.h, n); w = V.len(w) > 1e-6 ? V.norm(w) : anyPerp(n); const l = M3.applyT(R, w), k = Math.hypot(l[0], l[2]) || 1; A.dAx = [l[0]/k, l[2]/k]; }
    const sw = sh.disc ? [A.dAx[0], 0, A.dAx[1]] : [0, 1, 0], m = [sw[0]*sh.a, sw[1]*sh.b, sw[2]*sh.a], ext = Math.hypot(m[0], m[1], m[2]);
    const ax = M3.apply(sh.R, sw);
    if (!A.dir && tau >= SCAN.SW0 - 0.5) A.dir = V.dot(ax, cam.up) >= 0 ? 1 : -1;
    const dir = A.dir || 1, u = sweepU(tau);
    return { sh, dir, u, s:dir*ringS(u), ax, sw, mh:[m[0]/ext, m[1]/ext, m[2]/ext], ext };
  };
  // a point of the ring at height s (t: 0 to 1 round it), camera-relative, and its normal (into out)
  const ringPt = (g, s, t, out) => { const r = Math.sqrt(Math.max(1 - s*s, 0)), e1 = anyPerp(g.mh), e2 = V.cross(g.mh, e1), c = Math.cos(t*6.2832)*r, n = Math.sin(t*6.2832)*r;
    return shapePt(g.sh, s*g.mh[0] + c*e1[0] + n*e2[0], s*g.mh[1] + c*e1[1] + n*e2[1], s*g.mh[2] + c*e1[2] + n*e2[2], out); };
  const live = () => S_.act === A && (S_.phase === 'pass' || S_.phase === 'align') && ship.dist < ship.labelRange && A.tau > -0.2 && A.tau < T + 0.5;
  // ---------------------------------------------------------------- the hologram (FS_HOLO)
  function drawHolo(){
    if (!live() || SCAN_DBG.noHolo) return;
    const g = A.geo(), sh = g.sh, tau = A.tau; if (g.u < -0.1) return;
    const B = Math.max(sh.a, sh.b)*1.08, rpx = sh.a/Math.max(V.len(sh.C), sh.a*1.001)/tanY*sceneH*0.5;
    const ue = tau - SCAN.SW0 - SCAN.SWT, rim = sh.cloud || sh.disc ? 0 : smooth(-0.1, 0.25, ue)*(1 - smooth(0.9, 1.8, ue));
    const ring = g.u > 0 && g.u < 1 ? 1 - 0.5*Math.pow(Math.abs(g.s), 16) : 0;
    const dLa = (rpx < 40 ? 45 : 30)*DEG, dLo = (rpx < 40 ? 60 : 30)*DEG;
    // (Saturn's dense rings, which cover the planet where they are in front of it: 1.24 to 2.27 of its radius, as FS_PLANET draws them)
    const sat = tg === BYKEY.saturn, RPb = sh.a/B;
    const U = A.holoU = { p0:[sh.a/B, sh.b/B, g.s, g.dir], p1:[tau, SCAN.SW0, SCAN.SWT, SCAN.HOLD], p2:[SCAN.FADE, sh.kind, (sh.hr || 0)/B, rim],
      p3:[dLa, dLo, (sh.solid ? 1.35 : 1.0)*(tg.starR || sh.hole ? 1.6 : 1), ring*(tg.starR || sh.hole ? 1.3 : 1)], p4:[sat ? 1.24*RPb : 0, sat ? 2.27*RPb : 0, sat ? 1 : 0, reduceMotion ? 1 : 0], mh:g.mh, cov:sh.solid ? [0.65, 0.3] : sh.hole ? [0.85, 0.5] : [0.55, 0], B, C:sh.C.slice(), R:sh.R.slice() };
    const M = [U.mh[0], U.mh[1], U.mh[2], U.cov[0], U.cov[1], 0, 0, 0, 0];
    if (drawVolume(tg, P.scanHolo, sh.C, B, pr => { gl.uniform4fv(pr.u.uP0, U.p0); gl.uniform4fv(pr.u.uP1, U.p1); gl.uniform4fv(pr.u.uP2, U.p2); gl.uniform4fv(pr.u.uP3, U.p3); gl.uniform4fv(pr.u.uP4, U.p4); gl.uniformMatrix3fv(pr.u.uM0, false, M); }, sh.R, 1)) SCAN_DBG.holo++;
  }
  // ---------------------------------------------------------------- lines: the ping, the fan, a spark at the far pole, brackets
  A.draw = () => {
    const tau = A.tau, d0 = FXB.nl, p0 = FXB.np, s0 = SCB.nl;
    A.nl = A.np = 0; A.shown = []; SCAN_DBG.drew = true;
    if (!live()){ scanLabelsOff(); return; }
    const g = A.geo(), sh = g.sh, u = g.u, E = shipPt(HULL.scan);
    // the ping: a faint ring spreading out from the scan array as the sweep starts
    if (tau > 0 && tau < 0.9){ const k = tau/0.9; ringCam(E, ship.rad*(0.3 + 9*k), CYAN, 0.3*(1 - k)*(1 - k), 40); }
    if (u < -0.1){ scanLabelsOff(); return; }
    const ringOn = u > 0 && u < 1;
    // the fan from the scan array to the ring: a few thin lines to points of the ring the array and the camera can both see
    if (ringOn && (camNear() || (onScreen(E) && !behindHull(E)))){
      const pts = [], fk = smooth(0, 0.08, u)*(1 - smooth(0.92, 1, u));
      for (let k=0;k<64;k++){ ringPt(g, g.s, k/64, P1); if (V.dot(V.sub(E, P1.p), P1.n) > 0 && facing(P1.p, P1.n) > 0.08 && !(sh.hole && inShadow(P1.p, sh.C, sh.hr))) pts.push(P1.p.slice()); }
      const K = Math.min(5, pts.length), occ = p => (sh.solid && behindSphere(p, sh.C, sh.a*0.998)) || behindHull(p) || (sh.hole && inShadow(p, sh.C, sh.hr));
      // (each in two parts: the first 200 ship radii in fine pieces near the array, where the hull can hide it, the rest in a few; one line
      // from the ship to a galaxy in fine pieces all the way used some 130 line ends)
      for (let k=0;k<K;k++){ const q = pts[Math.floor((k + 0.5)*pts.length/K)], d = V.sub(q, E), L = V.len(d), m = Math.min(L, ship.rad*200), M = V.add(E, V.mul(d, m/L)), bm = 0.16 + 0.29*m/L;
        beamLine(E, M, CYAN, 0.16*fk, occ, CYAN, bm*fk, 6, ship.rad*0.25); if (L > m*1.001) beamLine(M, q, CYAN, bm*fk, occ, SC_RING, 0.45*fk, 8); }
    }
    // the ring closes at the far end with a small spark
    const ue = tau - SCAN.SW0 - SCAN.SWT;
    if (ue > 0 && ue < 0.5){ ringPt(g, -g.dir, 0, P1); if ((facing(P1.p, P1.n) > 0 || !sh.solid) && !behindHull(P1.p) && !(sh.hole && inShadow(P1.p, sh.C, sh.hr))) P_(P1.p, SC_RING, 1.3*(1 - ue/0.5), -4); }
    drawSpots(g);
    A.nl = FXB.nl - d0 + SCB.nl - s0; A.np = FXB.np - p0;
  };

  // ---------------------------------------------------------------- brackets on real features, once the ring has passed them
  // a feature: where it is now (SPT.p, camera-relative), its height along the sweep (SPT.h, -1 to 1 across the shape)
  // and its half size (SPT.r); and whether it can be seen well: on a surface, facing the camera and not near the rim (the score is how squarely
  // it faces it); anywhere, in the picture, not behind the ship, not in a black hole's shadow, and another object only while it is drawn
  const SPT = { p:[0, 0, 0], h:0, r:0 };
  function spotSeen(sp, g){
    const sh = g.sh;
    if (sp.at){
      if (!sh.solid) return -1;
      const [la, lo] = sp.at(tg); globePt(sh, la, lo, P1); SPT.p = P1.p.slice(); SPT.h = V.dot(V.sub(SPT.p, sh.C), g.ax)/g.ext; SPT.r = sp.r*sh.a;
      const f = facing(P1.p, P1.n); return f > 0.28 && onScreen(P1.p, 1.02) && !behindHull(P1.p) ? f : -1;
    }
    const s = tg.rad*magOf(tg);
    if (sp.obj){ const o = BYKEY[sp.obj]; if (!o || !drawnNow(o)) return -1; SPT.p = o.rel.slice(); }
    else { const l = typeof sp.local === 'function' ? sp.local(tg) : sp.local, R = tg.rot, C = tg.rel;
      SPT.p = [C[0] + (R[0]*l[0] + R[3]*l[1] + R[6]*l[2])*s, C[1] + (R[1]*l[0] + R[4]*l[1] + R[7]*l[2])*s, C[2] + (R[2]*l[0] + R[5]*l[1] + R[8]*l[2])*s]; }
    SPT.r = sp.r*s;
    SPT.h = V.dot(V.sub(SPT.p, sh.C), g.ax)/g.ext;
    return onScreen(SPT.p, 1.02) && !behindHull(SPT.p) && !(sh.hole && inShadow(SPT.p, sh.C, sh.hr)) ? 1 : -1;
  }
  // another object is drawn (last frame): as itself, or as the glowing dot that stands in for it far away (render() in 09-render.js)
  const drawnNow = o => !o.hidden && !(o.magHide > 0.5) && (o.vis > 0.02 || (!o.noImpostor && (o.rpx > 0) &&
    o.farLum*(1 - o.vis)*clamp(Math.pow(o.rpx/1.2, 0.33), 0, 1.2)*(1 - smooth(40, 120, o.rpx))*(o.occ ?? 1) > 0.015));
  // a bracket locks on once the ring has passed its feature, while the camera can see it
  function lockSpots(g){
    for (let i=0;i<spots.length;i++){
      if (A.lock[i] >= 0 || g.u >= 1.2) continue;
      if (spotSeen(spots[i], g) > 0 && (g.dir*SPT.h >= ringS(g.u) - 1e-9 || g.u >= 1)) A.lock[i] = A.tau;
    }
  }
  function drawSpots(g){
    const tau = A.tau, show = [], out = 1 - smooth(SCAN.SW0 + SCAN.SWT + 1.6, SCAN.SW0 + SCAN.SWT + 3, tau);
    if (out > 0.01) for (let i=0;i<spots.length;i++){
      if (A.lock[i] < 0) continue;
      const f = spotSeen(spots[i], g); if (f < 0) continue;
      show.push({ i, sp:spots[i], p:SPT.p, r:SPT.r, f, age:tau - A.lock[i], out });
    }
    // (at most three, those facing the camera most squarely)
    show.sort((x, y) => y.f - x.f); show.length = Math.min(show.length, 3);
    const pxW = 2*tanY/viewHcss, used = new Set(), placed = [], avoid = show.length && cam.focus === ship.index ? uiRects() : [];   // (world units per CSS pixel, per unit of depth)
    // (nor on the ship: it is what the camera looks at, and no label may sit on it)
    const shp = show.length ? projectCSS(ship.rel) : null, shr = shp ? ship.rad*1.05/(shp.z*pxW) : 0;
    const onShip = (x, y, w, lh) => shp && Math.hypot(clamp(shp.x, x, x + w) - shp.x, clamp(shp.y, y, y + lh) - shp.y) < shr;
    for (const s of show){
      const z = V.dot(s.p, cam.fwd), h = clamp(s.r, 7*pxW*z, 34*pxW*z), k = 1 + 0.7*(1 - smooth(0, 0.3, s.age)), hk = h*k;
      const br = (0.5 + 0.5*Math.exp(-s.age/0.25) + 0.06*Math.sin(tau*5 + s.i))*s.out, L = hk*0.38;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]){
        const K = V.add(s.p, V.add(V.mul(cam.right, sx*hk), V.mul(cam.up, sy*hk)));
        SL2_(K, V.sub(K, V.mul(cam.right, sx*L)), SC_BRK, br, 0.5); SL2_(K, V.sub(K, V.mul(cam.up, sy*L)), SC_BRK, br, 0.5);
      }
      A.shown.push({ name:s.sp.name, i:s.i, p:s.p.slice() });
      // its name beside it: only with the camera on the ship (no label may sit on the disc of what you are looking at)
      if (cam.focus !== ship.index || s.age < 0.25 || s.out < 0.3) continue;
      const pr = projectCSS(s.p); if (!pr) continue;
      const el = scanLabel(used.size); if (el.textContent !== s.sp.name) el.textContent = s.sp.name;
      // (beside the bracket, on whichever side is clear of the interface, the screen's edges, the ship and the other labels; none if neither is)
      const w = el.offsetWidth || 90, lh = 18, off = hk/(pxW*z) + 4, y = pr.y - 10, clear = x => x > 4 && x + w < innerWidth - 4 && y > 4 && y + lh < innerHeight - 4 && !onShip(x, y, w, lh) &&
        !avoid.some(r => x < r.right + 4 && x + w > r.left - 4 && y < r.bottom + 2 && y + lh > r.top - 2) && !placed.some(q => x < q[0] + q[2] + 6 && x + w + 6 > q[0] && y < q[1] + lh && y + lh > q[1]);
      const x = [pr.x + off, pr.x - off - w].find(clear); if (x === undefined) continue;
      placed.push([x, y, w]);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      used.add(el); if (!el.classList.contains('on')) el.classList.add('on');
    }
    scanLabelsOff(used);
  }
  return A;
};
// the brackets' lines, drawn after the Halo's other effects (the job fills SCB while haloDraw runs), and the labels switched off in any frame
// the scan did not draw (the camera went too far from the ship, or the job ended)
const Z3S = [0, 0, 0];
EXTRAS.push(() => {
  if (!SCAN_DBG.drew) scanLabelsOff();
  SCAN_DBG.drew = false; SCAN_DBG.lines = SCB.nl;
  if (SCB.nl){ fxUpload(SCB.ln, SCB.nl); drawParticles(null, { ps:SCB.ln, prog:'scanLn', lines:true, mode:3, sb:1, size:1, rad:1, rel:() => Z3S, rot:() => I3, count:() => SCB.nl }); }
  SCB.nl = 0;
});
// (tests: the numbers, the features, the shape and the hologram's last settings; what the last frame drew)
ship.dbg.scan = { SCAN, facts:SCAN_FACTS, spots:SCAN_SPOTS, targets:SHIP_TARGETS, shape:scanShape, globePt, inShadow, dbg:SCAN_DBG,
  get job(){ return S_.act && S_.act.kind === 'scan' ? S_.act : null; }, get labels(){ return SCAN_LAB.filter(el => el.classList.contains('on')).map(el => el.textContent); } };

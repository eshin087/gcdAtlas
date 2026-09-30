// ================================================================ Starman and his Tesla Roadster: launched on the first Falcon Heavy on 6 February 2018, shown where it is now
// Position: JPL Horizons state vectors (s0-roadster-data.js, made by tools/roadster.mjs), heliocentric ICRF, one row every 40 days from
// 2018-02-08 to 2069, joined by cubic Hermite curves (within about 32,000 km of Horizons' daily positions in 2026, about 160,000 km at the
// 2047 pass by Earth). Before the table it waits at the first row; after it, it coasts on the Kepler orbit of the last row.
// The stack is what Horizons lists: the car on its payload adapter atop the Falcon Heavy upper stage (a Merlin Vacuum engine with the
// extended nozzle). Its slow spin here is illustrative: nobody has measured it since 2018. The stack turns about its long axis, which is kept
// tilted 55 degrees from the Sun toward ecliptic north (R0, set each tick), so the car is always lit from above.
const RD = (() => {
  const D = ROADSTER_DATA.rows.split(';').map(r => r.split(',').map(s => parseInt(s, 36)));
  return { jd0:ROADSTER_DATA.jd0, h:ROADSTER_DATA.h, D, n:D.length, jdEnd:ROADSTER_DATA.jd0 + (D.length - 1)*ROADSTER_DATA.h,
    launch:2458156.3646,   // 2018-02-06 20:45 UTC, Falcon Heavy from LC-39A
    MU:2.9591220828559e-4 };   // the Sun's GM in AU^3/day^2
})();
// heliocentric position (AU) and velocity (AU/day), J2000 equatorial, at jd
function roadsterEq(jd){
  if (jd > RD.jdEnd) return roadsterKepler(jd);
  const x = (Math.max(jd, RD.jd0) - RD.jd0)/RD.h, i = Math.min(Math.floor(x), RD.n - 2), s = x - i, a = RD.D[i], b = RD.D[i + 1], h = RD.h;
  const h00 = 2*s*s*s - 3*s*s + 1, h10 = s*s*s - 2*s*s + s, h01 = -2*s*s*s + 3*s*s, h11 = s*s*s - s*s;
  const d00 = (6*s*s - 6*s)/h, d10 = 3*s*s - 4*s + 1, d01 = (-6*s*s + 6*s)/h, d11 = 3*s*s - 2*s;
  const p = [0, 0, 0], v = [0, 0, 0];
  for (let k=0;k<3;k++){
    const pa = a[k]*1e-8, pb = b[k]*1e-8, va = a[k + 3]*1e-10, vb = b[k + 3]*1e-10;
    p[k] = h00*pa + h10*h*va + h01*pb + h11*h*vb;
    v[k] = jd < RD.jd0 ? va : d00*pa + d10*va + d01*pb + d11*vb;
  }
  return { p, v };
}
// past the table: two-body motion from its last row (universal Kepler for an ellipse)
function roadsterKepler(jd){
  const r0 = RD.D[RD.n - 1], p0 = r0.slice(0, 3).map(x => x*1e-8), v0 = r0.slice(3).map(x => x*1e-10), mu = RD.MU;
  const r = V.len(p0), a = 1/(2/r - V.dot(v0, v0)/mu), n = Math.sqrt(mu/(a*a*a));
  const hv = V.cross(p0, v0), ev = V.sub(V.mul(V.cross(v0, hv), 1/mu), V.mul(p0, 1/r)), e = V.len(ev);
  const P = V.norm(ev), Q = V.norm(V.cross(hv, P)), b = a*Math.sqrt(1 - e*e);
  const E0 = Math.atan2(V.dot(p0, Q)/b, V.dot(p0, P)/a + e), M = E0 - e*Math.sin(E0) + n*(jd - RD.jdEnd), E = keplerE(M, e);
  const Ed = n/(1 - e*Math.cos(E));
  return { p:V.add(V.mul(P, a*(Math.cos(E) - e)), V.mul(Q, b*Math.sin(E))), v:V.add(V.mul(P, -a*Math.sin(E)*Ed), V.mul(Q, b*Math.cos(E)*Ed)) };
}
const roadsterAt = jd => V.mul(eqToGal(roadsterEq(jd).p), AU_LY);   // heliocentric galactic, light-years
// the distance it has flown round the Sun since the first row (AU), row by row (Simpson on the Hermite speed), for the odometer
const RD_ODO = (() => { const c = [0]; for (let i=1;i<RD.n;i++){ const j = RD.jd0 + (i - 1)*RD.h, sp = t => V.len(roadsterEq(t).v);
  c.push(c[i - 1] + RD.h/6*(sp(j) + 4*sp(j + RD.h/2) + sp(j + RD.h))); } return c; })();
function roadsterOdo(jd){   // AU flown since 2018-02-08
  const x = clamp((jd - RD.jd0)/RD.h, 0, RD.n - 1.0001), i = Math.floor(x), j = RD.jd0 + i*RD.h, t = jd - j, sp = u => V.len(roadsterEq(u).v);
  if (jd > RD.jdEnd) return RD_ODO[RD.n - 1] + sp(jd)*(jd - RD.jdEnd);
  return RD_ODO[i] + t/6*(sp(j) + 4*sp(j + t/2) + sp(j + t));
}
// close passes from JPL Horizons' encounter list for solution 11 (nominal date, distance in AU)
const RD_PASSES = [[2459129.768, 'Mars', 0.049505], [2464439.855, 'Mars', 0.01598], [2468723.390, 'Earth', 0.031891], [2469885.010, 'Earth', 0.11888], [2470774.723, 'Mars', 0.176165]];

// The model, in metres, in the car's frame: x forward, y up, z to the right, the ground under its tyres at y = 0 and the middle of the
// wheelbase at x = 0. A 2008 Roadster: 3.95 m long, 1.85 m wide, 1.13 m high with its top, wheelbase 2.35 m, tracks 1.46 and 1.50 m, tyres
// 175/55 R16 in front and 225/45 R17 behind. The body is a height field (topAt: the bonnet between the front wings, the wings' crests, the
// doors' tops, the rear haunches and the deck between them) over a plan that is widest over the rear wheels, cut by the wheel arches, the
// cockpit, the side intakes and the mouth. The car sits nose up on its mount above the payload adapter, as SpaceX's photos show it (the
// tilt, 16 degrees, is judged from them), so the stage below leans back: its own frame s (y along its axis) is toStage(p). Starman is in
// the driver's seat (the left), his right hand on the wheel and his left elbow on the door. The windscreen is not in map(): main() finds
// the glass by itself, so the march sees Starman through it.
// uP0: x the bounding radius (m), w 0 (ZI: the loops start from it, so ANGLE on Direct3D keeps them loops); uP1: the Sun's direction
// (world). map() has one call site: one loop in main() marches, then takes the normal, the occlusion and the shadow.
const FS_ROADSTER = COMMON + `
#define ZI int(uP0.w)
const vec3 CEN = vec3(-1.55, -6.55, 0.);
const float CI = 0.96126, SI = 0.27564, KZ = 0.3;
const vec3 CT = vec3(0.05, 0.33, 0.);
float gPix = 0.01;   // (a pixel's width where the ray is, m: parts finer than that are left out)
vec3 toStage(vec3 q){ return vec3(CI*q.x - SI*q.y, SI*q.x + CI*q.y, q.z) + CT; }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdRBox(vec3 p, vec3 b, float r){ return sdBox(p, b - r) - r; }
float sdRect(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/max(k1, 1e-5); }
float sdCylY(vec3 p, float r, float h){ vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0., 1.); return mix(b, a, h) - k*h*(1. - h); }
float smax(float a, float b, float k){ float h = clamp(0.5 + 0.5*(a - b)/k, 0., 1.); return mix(b, a, h) + k*h*(1. - h); }
// the windscreen: its surface (wsF = 0: raked back 49 degrees, its sides swept back KZ z^2) and its outline on it (wsO < 0 inside: narrower
// at the top, the top corners rounded)
float wsF(vec3 q){ return q.x - 0.5 + 1.1667*(q.y - 0.74) + KZ*q.z*q.z; }
float wsO(vec3 q){ return sdRect(vec2(abs(q.z)*0.67/(0.67 - 0.25*(q.y - 0.74)), q.y - 0.92), vec2(0.67, 0.18), 0.1); }
// the body's top (m) at x and |z|: the bonnet falling to the nose between the front wings, the wings' crests, the tops of the doors, the
// rear haunches over the rear wheels and the deck between them with a lip at the tail; outboard of the crests the shoulder rolls over
float topAt(float x, float z){
  float c = mix(0.855 + 0.05*smoothstep(-1.5, -2.02, x), 0.725 - 0.27*pow(smoothstep(0.45, 1.98, x), 2.), smoothstep(-0.75, 0.4, x));
  float f = mix(0.815 + 0.15*smoothstep(-0.4, -1.05, x) - 0.02*smoothstep(-1.45, -2.05, x),
                0.765 + 0.035*smoothstep(0.8, 0.35, x) - 0.25*pow(smoothstep(1.2, 1.98, x), 1.5), smoothstep(-0.5, 0.1, x));
  float u = max(z - 0.64, 0.);
  return mix(c, f, smoothstep(0.08, 0.64, z)) - 1.6*u*u;
}
// the body seen from above (a = x, y, |z|): widest over the rear wheels, narrowest at the doors; a bowed, rounded nose; a square tail whose
// top overhangs a little
float halfW(float x){ return 0.925 - 0.065*smoothstep(-0.85, -0.3, x) + 0.012*smoothstep(0.3, 0.75, x); }
float plan(vec3 a){
  float r = a.x > 0. ? 0.36 : 0.3, u = max(a.y - 0.3, 0.);
  float v = max(0.5 - a.y, 0.);
  vec2 q = vec2(a.x > 0. ? a.x - 1.92 + 0.22*a.z*a.z + 0.8*u*u : -2.03 - a.x + 0.12*a.z*a.z - 0.08*(a.y - 0.55) + 0.8*v*v, a.z - halfW(a.x)) + r;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}
// (the height field's slope reaches about 1, so its distance is scaled down to stay a safe step)
float shell(vec3 a){
  float d = smax(plan(a), (a.y - topAt(a.x, a.z))*0.7, 0.1 + 0.08*smoothstep(1.3, 1.9, a.x) + 0.05*smoothstep(-1.6, -2., a.x));
  return smax(d, 0.16 + 0.12*smoothstep(-1.5, -2., a.x) + 0.03*smoothstep(1.55, 1.9, a.x) - a.y, 0.05);
}
// a wheel (a.z = |z|): c = its axle's x and height and its middle's |z|, R the tyre's radius, rr the rim's, hw half the tyre's width
float wheel(vec3 a, vec3 c, float R, float rr, float hw, out float m){
  vec3 w = a - c; float r = length(w.xy);
  m = 8.;
  float bb = max(r - R, abs(w.z) - hw); if(bb > 0.06) return bb;   // (nothing of the wheel lies outside its cylinder)
  float d = sdRect(vec2(r - (R + rr)*0.5, w.z), vec2((R - rr)*0.5, hw), 0.04);
  if(gPix > 0.035){ float disc = max(r - rr, abs(w.z - hw*0.3) - hw*0.35); if(disc < d){ d = disc; m = 9.; } return d; }
  // silver: the rim's lip, ten spokes and the hub, in front of a dark brake disc
  float an = atan(w.y, w.x), k = floor(an/0.6283185 + 0.5)*0.6283185, ck = cos(k), sk = sin(k);
  vec2 u = vec2(ck*w.x + sk*w.y, ck*w.y - sk*w.x);
  float sv = sdRect(vec2(r - rr + 0.014, w.z - hw*0.3), vec2(0.016, hw*0.6), 0.006);
  sv = min(sv, sdBox(vec3(u.x - rr*0.52, u.y, w.z - hw*0.55), vec3(rr*0.46, 0.012 + 0.014*(1. - u.x/rr), 0.02)));
  sv = min(sv, max(r - 0.07, abs(w.z - hw*0.55) - 0.035));
  if(sv < d){ d = sv; m = 9.; }
  float bd = max(r - rr + 0.025, abs(w.z + hw*0.1) - 0.02); if(bd < d){ d = bd; m = 14.; }
  return d;
}
// Starman (s: from the middle of the driver's seat, s.z toward the car's middle, his right): the suit white with black on the shoulders and
// knees, black gloves and boots, a white helmet with a dark visor
float starman(vec3 q, out float m){
  vec3 s = q - vec3(0., 0., -0.36), l = vec3(s.xy, abs(s.z));
  float d = sdCap(vec3(s.xy, s.z*0.72), vec3(-0.31, 0.46, 0.), vec3(-0.43, 0.76, 0.), 0.12);
  d = smin(d, sdCap(s, vec3(-0.33, 0.39, -0.09), vec3(-0.33, 0.39, 0.09), 0.1), 0.05);
  d = smin(d, sdCap(s, vec3(-0.44, 0.8, -0.155), vec3(-0.44, 0.8, 0.155), 0.07), 0.05);
  d = smin(d, sdCap(s, vec3(-0.45, 0.82, 0.), vec3(-0.47, 0.96, 0.), 0.058), 0.03);
  float lb = sdCap(s, vec3(-0.44, 0.8, 0.17), vec3(-0.25, 0.64, 0.22), 0.056);
  lb = min(lb, sdCap(s, vec3(-0.25, 0.64, 0.22), vec3(0.04, 0.83, 0.085), 0.047));
  lb = min(lb, sdCap(s, vec3(-0.44, 0.8, -0.17), vec3(-0.3, 0.83, -0.4), 0.056));
  lb = min(lb, sdCap(s, vec3(-0.3, 0.83, -0.4), vec3(0.02, 0.845, -0.41), 0.047));
  lb = min(lb, sdCap(l, vec3(-0.3, 0.39, 0.1), vec3(0.12, 0.5, 0.12), 0.078));
  lb = min(lb, sdCap(l, vec3(0.12, 0.5, 0.12), vec3(0.42, 0.28, 0.12), 0.06));
  d = smin(d, lb, 0.035); m = 3.;
  if(length(l - vec3(0.12, 0.52, 0.12)) < 0.1 || length(vec3(l.x + 0.44, l.y - 0.84, l.z - 0.16)) < 0.095) m = 13.;
  float bk = min(min(length(s - vec3(0.04, 0.83, 0.085)), length(s - vec3(0.02, 0.845, -0.41))) - 0.054, sdRBox(l - vec3(0.47, 0.25, 0.12), vec3(0.1, 0.05, 0.055), 0.04));
  if(bk < d){ d = bk; m = 13.; }
  vec3 h = s - vec3(-0.48, 1.08, 0.);
  float hm = sdEll(h, vec3(0.18, 0.175, 0.16));
  if(hm < d){ d = hm; m = (h.y > -0.12 && h.y < 0.1 && h.x > 0.12*length(h) + 0.3*abs(h.z)) ? 12. : 3.; }
  return d;
}
// the cockpit: the seats, the dashboard and the roll hoop (black), the steering wheel (dark grey, so it shows against the dashboard) and
// Starman
float cabin(vec3 q, vec3 a, out float m){
  float d = sdRBox(a - vec3(-0.33, 0.25, 0.36), vec3(0.24, 0.055, 0.22), 0.045);
  vec3 b = a - vec3(-0.56, 0.6, 0.36); b.xy = rot2(-0.33)*b.xy;
  d = min(d, sdRBox(b, vec3(0.06, 0.31, 0.225), 0.05));
  d = min(d, sdRBox(b - vec3(0., 0.39, 0.), vec3(0.05, 0.09, 0.13), 0.045));
  d = min(d, sdRBox(a - vec3(0.37, 0.6, 0.), vec3(0.15, 0.12, 0.64), 0.06));
  d = min(d, sdCap(q, vec3(0.28, 0.715, -0.46), vec3(0.28, 0.715, -0.26), 0.05));
  d = min(d, length(vec2(abs(sdRect(vec2(a.z, a.y - 0.86), vec2(0.52, 0.22), 0.12)), a.x + 0.8)) - 0.035);
  // the steering wheel faces the driver (NW, back and up): rim, three spokes, hub and column
  vec3 w = q - vec3(-0.02, 0.7, -0.36);
  const vec3 NW = vec3(-0.912, 0.41, 0.), UW = vec3(0.41, 0.912, 0.);
  float hh = dot(w, NW), sw = length(vec2(length(w - NW*hh) - 0.17, hh)) - 0.018;
  sw = min(sw, min(sdCap(w, vec3(0., 0., -0.16), vec3(0., 0., 0.16), 0.013), sdCap(w, vec3(0.), -UW*0.16, 0.013)));
  sw = min(sw, sdCap(w, NW*0.015, -NW*0.3, 0.03));
  m = 11.; if(sw < d){ d = sw; m = 14.; }
  if(sdBox(q - vec3(-0.05, 0.71, -0.45), vec3(0.64, 0.57, 0.4)) < d){ float mm, sd = starman(q, mm); if(sd < d){ d = sd; m = mm; } }
  return d;
}
// m: 1 paint, 2 black trim, 3 suit, 4 stage, 5 nozzle, 6 headlights, 7 adapter and mount, 8 tyres, 9 wheels, 10 tail lights, 11 the cockpit
// (black), 12 visor and mirror glass, 13 the suit's black parts, 14 brake discs and the steering wheel, 15 the stage's dark rings, 16 the
// mesh in the openings
float car(vec3 q, out float m){
  vec3 a = vec3(q.x, q.y, abs(q.z));
  float sh = shell(a);
  // cut by the wheel arches, the cockpit, the side intakes behind the doors and the mouth under the nose
  float ar = max(min(length(a.xy - vec2(1.176, 0.299)) - 0.345, length(a.xy - vec2(-1.176, 0.317)) - 0.365), 0.5 - a.z);
  float ck = sdRBox(a - vec3(-0.13, 0.95, 0.), vec3(0.6, 0.68, 0.66), 0.08);
  float ik = max(sdRect(vec2(a.x + 0.64 + 0.4*(a.y - 0.46), a.y - 0.46), vec2(0.2, 0.15), 0.1), 0.79 - a.z);
  float mo = max(sdRect(vec2(a.z, a.y - 0.27), vec2(0.34, 0.055), 0.05), 1.87 - a.x);
  float s1 = smax(smax(sh, -ar, 0.015), -sdEll(a - vec3(-0.28, 0.45, 0.99), vec3(0.55, 0.17, 0.13)), 0.05), d = max(max(max(s1, -ck), -ik), -mo);
  m = 1.;
  if(-ck > s1 - 0.004 && -ck >= -ik) m = 11.;                   // the cockpit's walls
  else if(-ik > s1 - 0.004 || -mo > s1 - 0.004) m = 16.;        // the side intakes and the mouth
  else if(-ar > sh - 0.012 || a.y < 0.21) m = 2.;               // inside the wheel arches, underneath
  else if(a.z > 0.7 && a.y < 0.8 && (abs(a.x - 0.52) < 0.011 || abs(a.x + 0.41) < 0.011)) m = 2.;   // the doors' shut lines
  else if(a.x < -1.8 && a.y < 0.36) m = 2.;                     // the diffuser
  else if(a.x < -1.88 && length((a.yz - vec2(0.735, 0.575))/vec2(0.075, 0.15)) < 1.) m = 10.;   // tail lights
  else if(a.y > 0.45 && a.x > 1.2){                             // headlights: teardrops on the wings' front slopes
    vec2 A = vec2(1.63, 0.69), B = vec2(1.25, 0.63); float t = clamp(dot(a.xz - A, B - A)/dot(B - A, B - A), 0., 1.);
    if(length(a.xz - A - (B - A)*t) < mix(0.085, 0.025, t)) m = 6.;
  }
  float mw, dw = a.x > 0. ? wheel(a, vec3(1.176, 0.299, 0.732), 0.299, 0.203, 0.0875, mw) : wheel(a, vec3(-1.176, 0.317, 0.7495), 0.317, 0.216, 0.1125, mw);
  if(dw < d){ d = dw; m = mw; }
  float sp = max(sdRBox(a - vec3(1.66, 0.155, 0.), vec3(0.26, 0.012, 0.72), 0.01), plan(a) - 0.03);   // the front splitter
  if(sp < d){ d = sp; m = 2.; }
  if(gPix < 0.25){
    if(sdBox(a - vec3(-0.2, 0.75, 0.), vec3(0.84, 0.52, 0.92)) < d){ float mc, dc = cabin(q, a, mc); if(dc < d){ d = dc; m = mc; } }
  }
  if(gPix < 0.12){
    // the windscreen's black frame, and the door mirrors on their stalks
    float fr = max(abs(wsF(q))*0.63 - 0.016, abs(wsO(q) + 0.028) - 0.028);
    if(fr < d){ d = fr; m = 2.; }
    float mr = sdEll(a - vec3(0.33, 0.87, 0.95), vec3(0.055, 0.045, 0.08)); if(mr < d){ d = mr; m = a.x < 0.29 ? 12. : 1.; }
    float st = sdCap(a, vec3(0.42, 0.8, 0.8), vec3(0.35, 0.86, 0.92), 0.012); if(st < d){ d = st; m = 2.; }
  }
  return d;
}
// the upper stage in its own frame s (a white tank 3.66 m across, its dark rings, a cable raceway), the payload adapter, the Merlin
// Vacuum engine and its bell
float stage(vec3 s, out float m){
  m = 4.;
  float bb = sdCylY(s - vec3(0., -7.1, 0.), 1.92, 7.2); if(bb > 0.3) return bb;
  float r = length(s.xz);
  float d = sdCylY(s - vec3(0., -5.75, 0.), 1.83, 4.6);
  if(s.y > -1.35 || s.y < -10.05) m = 15.;
  float rw = sdRBox(s - vec3(0., -5.9, -1.85), vec3(0.09, 4.25, 0.05), 0.02); if(rw < d){ d = rw; m = 4.; }
  float ad = max(sdCylY(s - vec3(0., -0.55, 0.), 1.0, 0.6), r - mix(1.0, 0.6, clamp((s.y + 1.15)/1.1, 0., 1.)));
  ad = min(ad, sdCylY(s - vec3(0., 0.05, 0.), 0.64, 0.03)); if(ad < d){ d = ad; m = 7.; }
  float ft = sdEll(s - vec3(0., -1.15, 0.), vec3(1.7, 0.3, 1.7)); if(ft < d){ d = ft; m = 15.; }
  float af = min(sdEll(s - vec3(0., -10.35, 0.), vec3(1.5, 0.45, 1.5)), sdCylY(s - vec3(0., -10.95, 0.), 0.42, 0.35)); if(af < d){ d = af; m = 15.; }
  float u = clamp((-11.25 - s.y)/2.85, 0., 1.), rb = 0.4 + 1.1*pow(u, 0.8);
  float bl = max(abs(r - rb) - 0.03, abs(s.y + 12.675) - 1.425)*0.7; if(bl < d){ d = bl; m = 5.; }
  return d;
}
float map(vec3 p, out float m){
  vec3 s = toStage(p);
  float d = stage(s, m);
  float bb = sdBox(p - vec3(-0.05, 0.55, 0.), vec3(2.06, 0.72, 1.06));
  if(bb < d){
    if(bb > max(0.1, gPix*1.5)){ d = bb; m = 1.; }
    else {
      float mc, dc = car(p, mc); if(dc < d){ d = dc; m = mc; }
      float mt = max(sdBox(p - vec3(-0.05, -0.22, 0.), vec3(0.55, 0.38, 0.34)), 0.05 - s.y); if(mt < d){ d = mt; m = 7.; }
    }
  }
  return d;
}
vec3 matCol(float m, out float ks, out float gl){
  ks = 0.25; gl = 20.;
  if(m < 1.5){ ks = 1.; gl = 110.; return vec3(0.9, 0.055, 0.07); }     // paint: midnight cherry red
  if(m < 2.5){ ks = 0.35; gl = 24.; return vec3(0.11); }                 // black trim (a dark grey, so it reads in characters)
  if(m < 3.5){ ks = 0.25; gl = 16.; return vec3(0.86, 0.87, 0.86); }     // the suit and helmet
  if(m < 4.5){ ks = 0.3; gl = 20.; return vec3(0.55, 0.56, 0.58); }      // the stage's white paint
  if(m < 5.5){ ks = 0.8; gl = 40.; return vec3(0.2, 0.19, 0.19); }       // the nozzle
  if(m < 6.5){ ks = 1.6; gl = 50.; return vec3(0.75, 0.77, 0.8); }       // headlights
  if(m < 7.5){ ks = 0.3; gl = 20.; return vec3(0.12, 0.12, 0.13); }      // the adapter and the mount
  if(m < 8.5){ ks = 0.15; gl = 10.; return vec3(0.09); }                 // tyres
  if(m < 9.5){ ks = 1.2; gl = 50.; return vec3(0.66, 0.67, 0.7); }       // wheels
  if(m < 10.5){ ks = 1.2; gl = 80.; return vec3(1., 0.32, 0.2); }       // tail lights
  if(m < 11.5){ ks = 0.25; gl = 16.; return vec3(0.1, 0.095, 0.09); }    // the cockpit: black leather and trim
  if(m < 12.5){ ks = 1.6; gl = 120.; return vec3(0.05, 0.05, 0.06); }    // the visor, the mirrors' glass
  if(m < 13.5){ ks = 0.25; gl = 12.; return vec3(0.09); }                // gloves, boots, the suit's black parts
  if(m < 14.5){ ks = 0.6; gl = 30.; return vec3(0.16); }                 // brake discs, the steering wheel
  if(m < 15.5) return vec3(0.12, 0.12, 0.13);                            // the stage's dark rings and domes
  ks = 0.1; return vec3(0.025);                                          // the mesh in the intakes and the mouth
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float R = uP0.x;
  vec3 ro = o*R + CEN, L = normalize(uP1.xyz*uRot);
  float t = max(hb.x, 0.)*R, tEnd = hb.y*R, m = 0.;
  // one loop and one call of map() for everything: the march, then after a hit 4 samples for the normal, 4 for the occlusion and the
  // soft shadow toward the Sun (ANGLE on Direct3D compiles each call of map() on its own)
  int steps = int(mix(70., 150., clamp(uLod, 0., 1.))), ns = uLod > 0.4 ? 44 : 8, j = 0;
  vec3 col = vec3(0.), p = vec3(0.), n = vec3(0.); float a = 0., e = 0., ao = 0., sh = 1., st = 0.02; bool hit = false;
  for(int i=ZI;i<200;i++){
    if(!hit && i >= steps) break;
    vec3 k = vec3(j == 0 || j == 3 ? 1. : -1., j >= 2 ? 1. : -1., j == 1 || j == 3 ? 1. : -1.);
    float hh = 0.012 + 0.04*float(j - 4);
    vec3 x = !hit ? ro + d*t : j < 4 ? p + k*e : j < 8 ? p + n*hh : p + n*0.003 + L*st;
    if(!hit) gPix = uPix*t;
    float mm, dd = map(x, mm);
    if(!hit){
      if(dd < max(0.0008, gPix*0.35)){ hit = true; m = mm; p = x; e = max(0.0012, gPix*0.5); continue; }
      t += dd*0.9; if(t > tEnd) break;
      continue;
    }
    if(j < 4){ n += k*dd; if(j == 3) n = normalize(n); }
    else if(j < 8) ao += max(hh - dd, 0.)/(1. + float(j - 4));
    else { sh = min(sh, 10.*dd/st); st += clamp(dd, 0.015, 1.5); if(sh < 0.02 || st > 16.) break; }
    j++; if(j >= ns) break;
  }
  if(hit){
    sh = clamp(sh, 0., 1.);
    float ks, gl; vec3 base = matCol(m, ks, gl);
    vec3 hv = normalize(L - d);
    float dif = max(dot(n, L), 0.)*sh, nh = max(dot(n, hv), 0.), nv = clamp(dot(n, -d), 0., 1.);
    float occ = clamp(1. - ao*4., 0.25, 1.), fr = 0.04 + 0.96*pow(1. - nv, 5.);
    // the Sun; a soft fill from above the car and a little from the camera's side, and a rim of light round the outline (brightest with
    // the Sun behind), so the shaded side still reads in characters; the clear coat's highlight, the metallic paint's broad sheen and the
    // clear coat's reflection of the soft light above (it runs along the crests of the wings, the doors and the haunches)
    float up = clamp(0.5 + 0.5*n.y, 0., 1.), bk = max(dot(L, d), 0.);
    col = base*(dif*2.2 + ((0.1 + 0.25*nv + 0.45*up*up)*(1. + 1.5*bk) + pow(1. - nv, 3.)*(0.2 + 0.9*bk))*occ);
    col += vec3(1., 0.96, 0.9)*pow(nh, gl)*ks*sh*gl*0.022;
    if(m < 1.5) col += base*pow(nh, 10.)*sh + vec3(0.9, 0.8, 0.8)*smoothstep(0.25, 0.75, reflect(d, n).y)*fr*occ*0.6;
    a = 1.;
  }
  // the windscreen: dims what is behind it a little and catches the Sun
  float qa = KZ*d.z*d.z, qb = d.x + 1.1667*d.y + 2.*KZ*ro.z*d.z, qc = wsF(ro), tH = hit ? t : tEnd;
  float D = qb*qb - 4.*qa*qc;
  if(D >= 0.){
    float sq = sqrt(D), t1 = abs(qa) > 1e-6 ? (-qb - sq)/(2.*qa) : -qc/qb, t2 = abs(qa) > 1e-6 ? (-qb + sq)/(2.*qa) : -1.;
    if(t1 > t2){ float tt = t1; t1 = t2; t2 = tt; }
    for(int k=ZI;k<2;k++){
      float tg = k == 0 ? t1 : t2;
      if(tg <= 0. || tg >= tH) continue;
      vec3 g = ro + d*tg;
      if(g.y < 0.74 || wsO(g) > -0.05) continue;
      vec3 ng = normalize(vec3(1., 1.1667, 2.*KZ*g.z)); if(dot(ng, d) > 0.) ng = -ng;
      float f = 0.04 + 0.96*pow(1. - abs(dot(ng, d)), 5.), gs = pow(max(dot(reflect(d, ng), L), 0.), 300.)*6.;
      float sk = 0.025 + 0.5*f*(0.3 + 0.7*smoothstep(0.1, 0.7, reflect(d, ng).y));
      col = col*0.82 + vec3(0.55, 0.62, 0.72)*sk + vec3(1., 0.96, 0.9)*gs;
      a = max(a, min(sk + gs, 1.));
      break;
    }
  }
  outCol(col, a);
}`;
P.roadster = program(VS_RECT, FS_ROADSTER);
const roadster = (() => {
  const RADM = 8.1, CENM = [-1.55, -6.55, 0], SPIN = 2*Math.PI/260, TILT = 55*DEG;   // (metres, as in FS_ROADSTER; one illustrative turn every 260 s)
  const eclN = M3.apply(ECL, [0, 1, 0]);
  // a point of the model (car frame, m) as a view's offset: it turns with the stack
  const at = q => M3.applyT(o.R0, M3.apply(o.rot, V.mul(V.sub(q, CENM), 1/RADM)));
  const narrow = () => clamp((0.75 - tanX0)/0.3, 0, 1);   // (0 on a desk, 1 on a screen much taller than it is wide: the views below)
  // its orbit, one lap round now, rebuilt when the clock moves on (line segments in AU, relative to the Sun)
  const SEG = 240, ring = makePS(SEG*2); let ringJD = -1e9;
  function buildRing(jd){
    const e = roadsterEq(jd), r = V.len(e.p), a = 1/(2/r - V.dot(e.v, e.v)/RD.MU), P = 2*Math.PI*Math.sqrt(a*a*a/RD.MU);
    let k = 0;
    for (let i=0;i<SEG;i++) for (const j of [i, i + 1]){ const t = jd + (j/SEG - 0.5)*P, g = eqToGal(roadsterEq(t).p), w = 0.35 + 0.65*Math.pow(1 - Math.abs(j/SEG - 0.5)*2, 0.6);
      ring.a.set([g[0], g[1], g[2], w], k*4); ring.c.set([1, 0.34, 0.3, 0], k*4); k++; }
    ring.upload('ac'); ringJD = jd;
  }
  const o = addObj({ key:'roadster', name:'Starman and the Tesla Roadster', label:'Roadster', labelClass:'ship', type:'a car in orbit round the Sun · launched on the first Falcon Heavy', group:'travel', tags:['human'],
    fact:'On 6 February 2018 the first Falcon Heavy carried a cherry-red Tesla Roadster, with a mannequin in a spacesuit called Starman at the wheel, as its test payload. The car is still fixed to the rocket\'s upper stage, coasting round the Sun on an orbit that crosses the paths of both Earth and Mars. Its dashboard screen read DON\'T PANIC!',
    aka:'tesla roadster starman spacex falcon heavy car elon musk dont panic 2018-017a',
    parent:sun, offset:roadsterAt(JD_NOW), rad:RADM*1e-3*KM, R0:ECL, prog:P.roadster, layer:3, minZoom:0.2, pxMin:4, noImpostor:false,
    farColor:[1, 0.55, 0.5], farLum:0.35, labelRange:3*AU_LY, sortKey:1.5,
    distNow:() => V.len(V.sub(roadsterAt(jdNow()), earth.offset)),
    update(){
      const jd = jdNow();
      this.offset = roadsterAt(jd); this.pos = V.add(sun.pos, this.offset);
      const L = sunDirFrom(this), sp = V.norm(V.sub(L, V.mul(eclN, V.dot(L, eclN))));
      this.R0 = frameY(V.add(V.mul(sp, Math.cos(TILT)), V.mul(eclN, Math.sin(TILT))), sp);
      this.rot = M3.mul(this.R0, M3.rotY(GT*(reduceMotion ? 0.3 : 1)*SPIN));
      if (Math.abs(jd - ringJD) > 10 && this.ringOn()) buildRing(jd);
    },
    ringOn(){ return typeof orbit !== 'undefined' && (orbit.lock === this.index || (tour.on && tour.obj === this.index) || (flight && flight.obj === this)); },
    setU(pr){ const L = sunDirFrom(this); gl.uniform4f(pr.u.uP0, RADM, 0, 0, 0); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0); },
    particleVis:() => 1,
    particles:[{ ps:ring, prog:'lnBasic', lines:true, mode:3, sb:0.55, size:1, rad:AU_LY, rot:() => I3, rel:() => sun.rel,
      show:() => o.ringOn(), vis:() => smooth(0.004*AU_LY, 0.05*AU_LY, orbit.dist) }],
    // (the car fills the view, three-quarters from the front on Starman's side, low, aimed a little ahead of its middle so the car clears
    // the info panel; then over his left shoulder from outside the door, his arm on the door and the bonnet ahead, the rear deck out of the
    // picture; then a pull back until its whole orbit round the Sun is in view. The first two turn with the car as the stack spins, so they
    // always show what they say, and on a narrow screen (a phone held upright) they stand back and aim nearer the middle until the car fits
    // across it: tanX0, set by 09-render.js, is the tangent of half the view's width, 0.83 on a 1280 x 800 desk and 0.47 on a phone)
    views:[
      { track:() => M3.apply(o.rot, V.norm([0.58, 0.2, -0.79])), get k(){ return (4 + 1.3*narrow())/RADM; }, off:() => at([0.45 - 0.35*narrow(), 0.6, 0]), hold:9 },
      { track:() => M3.apply(o.rot, V.norm([-0.5, 0.35, -0.8])), get k(){ return (2.2 + 0.8*narrow())/RADM; }, off:() => at([0.2 - 0.25*narrow(), 0.85, -0.3]), hold:9 },
      { dirFn:() => V.norm(V.add(V.norm(V.sub(o.pos, sun.pos)), V.mul(M3.apply(ECL, [0, 1, 0]), 0.35))), k:2.2, off:[0, 0.4, 0], hold:14, drift:0, flyby:'pulling back to its orbit round the Sun', offW:'dist',
        to:{ dirFn:() => V.norm(V.add(V.mul(M3.apply(ECL, [0, 1, 0]), 1), V.mul(V.norm(V.sub(o.pos, sun.pos)), 0.35))), get k(){ return 2.6*AU_LY/o.rad; },
          off:() => V.mul(M3.applyT(o.R0, V.mul(o.offset, -1)), 0.7/o.rad) } },
    ],
    readout:() => {
      const jd = jdNow(), e = roadsterEq(jd), pE = V.mul(eqToGal(e.p), 1), dE = V.len(V.sub(pE, V.mul(earth.offset, 1/AU_LY))), dS = V.len(e.p);
      const kmS = x => x*149597870.7 >= 1e9 ? (x*149597870.7/1e9).toFixed(2) + ' billion km' : Math.round(x*149597870.7/1e6).toLocaleString('en-US') + ' million km';
      if (jd < RD.launch) return 'not launched yet on this date (it left Florida on 6 February 2018)\nshown where it was two days after launch';
      const v = V.len(e.v)*149597870.7/86400, r = dS, a = 1/(2/r - V.dot(e.v, e.v)/RD.MU), P = 2*Math.PI*Math.sqrt(a*a*a/RD.MU), laps = (jd - RD.launch)/P;
      const next = RD_PASSES.find(p => p[0] > jd), date = j => new Date((j - 2440587.5)*86400000).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
      return `${kmS(dE)} from Earth · ${dS.toFixed(2)} AU from the Sun · ${v.toFixed(1)} km/s\n` +
        `about ${laps.toFixed(1)} laps of the Sun (one every ${Math.round(P)} days) · ${kmS(roadsterOdo(jd))} flown since 8 February 2018\n` +
        (next ? `next close pass (predicted): ${next[1]}, ${date(next[0])}, ${(next[2]*149.6).toFixed(1)} million km` : 'no close pass left in the JPL list') +
        `\nposition from JPL Horizons · the slow spin is illustrative`;
    } });
  return o;
})();

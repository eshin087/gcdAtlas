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

// the model, in metres (car frame: x forward, y up, z to the right; the car sits on the adapter at y = 0.15, the stage hangs below).
// uP0: x the bounding radius in metres; uP1: sun direction (world)
const FS_ROADSTER = COMMON + `
const vec3 CEN = vec3(0., -6.25, 0.);
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdRBox(vec3 p, vec3 b, float r){ return sdBox(p, b - r) - r; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float sdCylZ(vec3 p, float r, float h){ vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
float sdCylY(vec3 p, float r, float h){ vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0., 1.); return mix(b, a, h) - k*h*(1. - h); }
// m: 1 paint, 2 black (tyres, cockpit, visor), 3 suit, 4 stage, 5 nozzle, 6 glass and trim, 7 adapter
float map(vec3 p, out float m){
  m = 4.;
  // ---- the car: a low wedge, rear deck a little higher than the nose, open cockpit
  float x = p.x;
  float top = mix(0.9, 0.74, smoothstep(-1.9, 0.5, x)) - 0.3*smoothstep(1.05, 1.98, x);
  vec2 q = abs(p.xz) - vec2(1.62, 0.6);
  float plan = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - 0.33;
  float body = max(max(plan, p.y - top), 0.2 - p.y);
  body = max(body, -sdRBox(p - vec3(-0.15, 1.02, 0.), vec3(0.78, 0.4, 0.7), 0.12));   // cockpit
  vec3 wp = vec3(abs(p.x) - 1.24, p.y - 0.32, abs(p.z) - 0.78);
  body = max(body, -sdCylZ(wp, 0.4, 0.3));                                          // wheel arches
  body = min(body, sdRBox(p - vec3(-0.5, 0.52, 0.), vec3(0.55, 0.14, 0.62), 0.05));   // seats' base
  float d = body; m = 1.;
  float tyre = sdCylZ(wp, 0.31, 0.11); if(tyre < d){ d = tyre; m = 2.; }
  float seats = min(sdRBox(p - vec3(-0.62, 0.8, -0.38), vec3(0.08, 0.3, 0.22), 0.06), sdRBox(p - vec3(-0.62, 0.8, 0.38), vec3(0.08, 0.3, 0.22), 0.06));
  if(seats < d){ d = seats; m = 2.; }
  // windscreen: a thin raked pane with its frame, and the steering wheel
  vec3 ws = p - vec3(0.72, 0.95, 0.); ws.xy = mat2(0.82, 0.57, -0.57, 0.82)*ws.xy;
  float glass = sdRBox(ws, vec3(0.02, 0.24, 0.72), 0.01); if(glass < d){ d = glass; m = 6.; }
  vec3 sw = p - vec3(0.28, 0.9, -0.38); sw.xy = mat2(0.87, 0.5, -0.5, 0.87)*sw.xy;
  float wheel = length(vec2(length(sw.yz) - 0.17, sw.x)) - 0.025; if(wheel < d){ d = wheel; m = 2.; }
  // ---- Starman in the driver's seat (left): suit, helmet, legs to the pedals, right hand on the wheel, left arm on the door
  vec3 s = p - vec3(0., 0., -0.38);
  float man = sdCap(s, vec3(-0.44, 0.62, 0.), vec3(-0.52, 1.08, 0.), 0.19);
  man = smin(man, sdCap(s, vec3(-0.35, 0.62, -0.1), vec3(0.3, 0.72, -0.1), 0.085), 0.05);
  man = min(man, sdCap(s, vec3(0.3, 0.72, -0.1), vec3(0.72, 0.42, -0.1), 0.075));
  man = smin(man, sdCap(s, vec3(-0.35, 0.62, 0.1), vec3(0.3, 0.72, 0.1), 0.085), 0.05);
  man = min(man, sdCap(s, vec3(0.3, 0.72, 0.1), vec3(0.72, 0.42, 0.1), 0.075));
  man = smin(man, sdCap(s, vec3(-0.46, 1.04, 0.2), vec3(-0.12, 0.84, 0.18), 0.07), 0.04);
  man = min(man, sdCap(s, vec3(-0.12, 0.84, 0.18), vec3(0.26, 0.9, 0.02), 0.06));
  man = smin(man, sdCap(s, vec3(-0.48, 1.04, -0.2), vec3(-0.3, 0.86, -0.42), 0.07), 0.04);
  man = min(man, sdCap(s, vec3(-0.3, 0.86, -0.42), vec3(0.05, 0.84, -0.5), 0.06));
  float helm = length(s - vec3(-0.46, 1.32, 0.)) - 0.17;
  if(man < d){ d = man; m = 3.; }
  if(helm < d){ d = helm; m = (s.x + 0.46 > 0.07 && s.y > 1.24) ? 2. : 3.; }
  // ---- the payload adapter and the upper stage below it, with its long vacuum nozzle
  float paf = max(sdCylY(p - vec3(0., -0.45, 0.), 1.83, 0.62), length(p.xz) - mix(1.83, 0.55, clamp((p.y + 1.07)/1.25, 0., 1.)));
  if(paf < d){ d = paf; m = 7.; }
  float tank = sdCylY(p - vec3(0., -5.7, 0.), 1.83, 4.6);
  tank = smin(tank, length((p - vec3(0., -10.3, 0.))*vec3(1., 2.2, 1.)) - 1.5, 0.1);
  if(tank < d){ d = tank; m = 4.; }
  float u = clamp((-10.6 - p.y)/3.5, 0., 1.), rb = 0.42 + 1.2*pow(u, 0.72);
  float bell = max(abs(length(p.xz) - rb) - 0.035, abs(p.y + 12.35) - 1.75);
  if(bell < d){ d = bell; m = 5.; }
  return d;
}
vec3 nrm(vec3 p){ float m; vec2 e = vec2(0.004, 0.);
  return normalize(vec3(map(p + e.xyy, m) - map(p - e.xyy, m), map(p + e.yxy, m) - map(p - e.yxy, m), map(p + e.yyx, m) - map(p - e.yyx, m))); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float R = uP0.x;
  vec3 ro = o*R + CEN;
  vec3 L = normalize(uP1.xyz*uRot);
  float t = max(hb.x, 0.)*R, tEnd = hb.y*R, m = 0.; bool hit = false;
  for(int i=0;i<110;i++){ float h = map(ro + d*t, m); if(h < 0.0015*max(t, 1.)){ hit = true; break; } t += h*0.9; if(t > tEnd) break; }
  vec3 col = vec3(0.); float a = 0.;
  if(hit){
    vec3 p = ro + d*t, n = nrm(p); map(p, m);
    // soft shadow toward the Sun (Starman shades his seat, the car shades the adapter)
    float sh = 1., st = 0.03, mm;
    for(int i=0;i<24;i++){ float h = map(p + n*0.01 + L*st, mm); sh = min(sh, 12.*h/st); st += clamp(h, 0.03, 0.6); if(sh < 0.02 || st > 14.) break; }
    sh = clamp(sh, 0., 1.);
    vec3 base = m < 1.5 ? vec3(0.78, 0.05, 0.06) : m < 2.5 ? vec3(0.025) : m < 3.5 ? vec3(0.92, 0.92, 0.9) : m < 4.5 ? vec3(0.82, 0.82, 0.84) : m < 5.5 ? vec3(0.2, 0.19, 0.18) : m < 6.5 ? vec3(0.12, 0.14, 0.17) : vec3(0.6, 0.6, 0.62);
    if(m > 3.5 && m < 4.5) base *= 0.9 + 0.1*step(0.5, fract(p.y*0.8));   // (the stage's barrel panels)
    float dif = max(dot(n, L), 0.)*sh;
    float gloss = m < 1.5 ? 60. : m < 2.5 ? 20. : m > 4.5 ? 30. : 12., ks = m < 1.5 ? 0.9 : m > 4.5 && m < 6.5 ? 0.7 : m < 2.5 ? 0.35 : 0.15;
    float sp = pow(max(dot(reflect(-L, n), -d), 0.), gloss)*sh;
    col = base*(dif*1.3 + 0.035) + vec3(1., 0.95, 0.88)*sp*ks;
    col += base*vec3(0.55, 0.65, 0.9)*0.14*(0.6 + 0.4*n.y);   // (fill light, a little more than space would give, so the car's shape reads in characters)
    a = 1.;
  }
  outCol(col, a);
}`;
P.roadster = program(VS_RECT, FS_ROADSTER);
const roadster = (() => {
  const RADM = 8.2, SPIN = 2*Math.PI/260, TILT = 55*DEG;   // (metres; one illustrative turn every 260 s)
  const eclN = M3.apply(ECL, [0, 1, 0]);
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
    parent:sun, offset:roadsterAt(JD_NOW), rad:RADM*1e-3*KM, R0:ECL, prog:P.roadster, layer:3, minZoom:0.35, pxMin:4, noImpostor:false,
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
    // (the car fills the view, three-quarters from the front; then over Starman's shoulder;
    // then a pull back until its whole orbit round the Sun is in view)
    views:[
      { d:[0.92, 0.22, 0.4], k:1.25, off:[0, 0.8, 0], hold:9, drift:0.03 },
      { d:[-0.75, 0.62, -0.35], k:0.95, off:[0, 0.84, 0], hold:9, drift:-0.02 },
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

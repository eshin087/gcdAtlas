// ================================================================ SpaceX launches (1): the shaders. The rest (sites, flights, the camera) is in s3-spacex.js.
// A "cluster" is one ray-marched volume holding everything close together: a pad with its tower and any stage near it, or a stage
// (or stack) in flight, or the droneship with the booster landing on it. One march per cluster, so the tower's chopsticks hide the
// booster they catch. Distances are in metres in the cluster's frame (x east, y up, z south at its anchor, see sxFrame in s3).
// Two programs, one per family, so each stays small enough to compile quickly: Starship (P.sxStar: Super Heavy, the ship, the tower
// with its chopsticks, the launch mount) and Falcon (P.sxFal: Falcon 9, Falcon Heavy, the second stage with a fairing or Dragon,
// Dragon on its own, the pads, the droneship, the landing zone). Loops start from ZI (a 0 the compiler cannot see) so ANGLE on
// Direct3D does not unroll them, and map() has two call sites (the march and one normal loop).
// Uniforms (arrays of 4 parts):
//   uPt[i] = position of the part's base (engine exit plane), type (0 none; 1 Super Heavy, 2 ship; 3 Falcon core, 4 Falcon Heavy side
//            core, 6 second stage, 7 Dragon)
//   uPa[i] = axis (unit, nose-ward), throttle 0..1
//   uPb[i] = side axis (unit, x of the part), a (Falcon: landing legs 0..1; ship: flaps; second stage: payload 0 fairing, 1 Dragon, 2 none)
//   uPc[i] = plume length (m), plume radius at the nozzles (m), spread (radius gained per metre), b (grid fins out 0..1; ship: heat glow)
//   uSo = site origin (m), site yaw (rad);  uSt = site kind (0 none, 1 Starbase, 2 Falcon pad, 3 Falcon pad with a crew tower, 4 droneship,
//         5 landing zone), chopstick height (m), chopsticks open 0..1, strongback / crew arm swing (rad)
//   uLt = sun direction, daylight 0..1;  uPl = the brightest plume's light: position, strength
//   uCl = ground cloud centre, age (s, < 0 none);  uCl2 = strength, steam (1 white, 0 brown), size, venting 0..1
//   uDim = bounding radius (m), time (s), ZI (0), seed
const SX_GLSL = `
uniform vec4 uPt[4]; uniform vec4 uPa[4]; uniform vec4 uPb[4]; uniform vec4 uPc[4];
uniform vec4 uSo; uniform vec4 uSt; uniform vec4 uLt; uniform vec4 uPl; uniform vec4 uCl; uniform vec4 uCl2; uniform vec4 uDim;
uniform vec4 uVc;   // the vapour cone: strength, part index, the collar's height up the part (m), length (m)
uniform mat3 uCm; uniform vec4 uCo;   // this frame to the frame the clouds are in (the site's): p_site = uCm p + uCo.xyz; uCo.w: that site's height above the sea
#define ZI int(uDim.z)
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdCylY(vec3 p, float r, float y0, float y1){ vec2 d = vec2(length(p.xz) - r, abs(p.y - (y0 + y1)*0.5) - (y1 - y0)*0.5); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
// a point in part i's own frame (y along its axis, origin at its engines)
vec3 toPart(vec3 p, int i){ vec3 y = uPa[i].xyz, x = uPb[i].xyz, z = cross(x, y), q = p - uPt[i].xyz; return vec3(dot(q, x), dot(q, y), dot(q, z)); }
// fold the plane round the axis onto the nearest of n directions, starting at angle a0 (for fins, legs, columns)
vec2 polarFold(vec2 xz, float n, float a0){ float a = atan(xz.y, xz.x) - a0, s = 6.2831853/n, k = floor(a/s + 0.5)*s + a0; float c = cos(k), sn = sin(k); return vec2(c*xz.x + sn*xz.y, -sn*xz.x + c*xz.y); }
// a square lattice tower of half-width w and height h (corner columns, a floor of beams every 'cell' metres, one diagonal per face and cell)
float lattice(vec3 q, float w, float h, float cell, float b){
  float bound = sdBox(q - vec3(0., h*0.5, 0.), vec3(w + b, h*0.5, w + b));
  if(bound > 1.5) return bound;
  float cols = length(vec2(abs(q.x) - w, abs(q.z) - w)) - b*1.4;
  float yb = q.y - cell*floor(q.y/cell + 0.5);
  float per = max(abs(q.x), abs(q.z));
  float beams = max(min(length(vec2(abs(q.x) - w, yb)), length(vec2(abs(q.z) - w, yb))) - b, per - w - b);
  float y0 = mod(q.y, cell), k = 2.*w/cell, n = inversesqrt(1. + k*k);
  float dg = min(length(vec2(abs(q.x) - w, (q.z + w - y0*k)*n)), length(vec2(abs(q.z) - w, (q.x + w - y0*k)*n))) - b*0.8;
  dg = max(dg, per - w - b);
  return max(min(min(cols, beams), dg), bound);
}
// plume emission of every burning part along the ray, up to tMax (the surface hit), in the cluster's metres
vec3 plumes(vec3 ro, vec3 rd, float tMax){
  vec3 acc = vec3(0.);
  for(int i=ZI;i<4;i++){
    float thr = uPa[i].w; if(uPt[i].w < 0.5 || thr < 0.01) continue;
    vec3 ax = -uPa[i].xyz, e = uPt[i].xyz;
    float L = uPc[i].x, r0 = uPc[i].y, sp = uPc[i].z, R = r0 + L*sp;
    vec3 w = ro - e; float ea = dot(rd, ax), wa = dot(w, ax);
    vec3 dd = rd - ax*ea, ww = w - ax*wa;
    float A = dot(dd, dd), B = 2.*dot(dd, ww), C = dot(ww, ww) - R*R, D = B*B - 4.*A*C;
    if(D < 0. || A < 1e-8) { if(A >= 1e-8) continue; }
    float sq = sqrt(max(D, 0.)), t0 = A < 1e-8 ? 0. : (-B - sq)/(2.*A), t1 = A < 1e-8 ? 1e9 : (-B + sq)/(2.*A);
    // the stretch along the axis 0..L
    if(abs(ea) > 1e-5){ float ta = -wa/ea, tb = (L - wa)/ea; t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb)); }
    else if(wa < 0. || wa > L) continue;
    t0 = max(t0, 0.); t1 = min(t1, tMax); if(t1 <= t0) continue;
    float ty = uPt[i].w, ker = (ty > 2.5 && ty < 6.5) ? 1. : 0.;   // kerosene (Falcon) or methane (Starship)
    float vac = clamp(sp*3., 0., 1.);   // how far the plume has blown open with altitude
    vec3 acc1 = vec3(0.); float dt = (t1 - t0)/14.;
    for(int k=ZI;k<14;k++){
      vec3 p = w + rd*(t0 + dt*(float(k) + 0.5)); float s = dot(p, ax); vec3 pr = p - ax*s; float rho = length(pr);
      if(uSt.x > 0.5 && (p + e).y < uSo.y + 0.5) continue;   // (the plume ends on the pad: the ground cloud takes it from there)
      float rr = r0 + s*sp, u = s/L;
      float core = exp(-rho*rho/(rr*rr)*2.2)*pow(r0/rr, 1.7);   // (as it widens the same light spreads out: dimmer, not bigger and brighter)
      float dia = 1. + (1. - vac)*0.9*pow(0.5 + 0.5*cos(s/(r0*0.9)*3.1416), 6.)*exp(-u*4.);   // shock diamonds near the ground
      float flick = 0.85 + 0.3*noise(vec3(s*0.08 - uDim.y*9., rho*0.1, float(i)*7.));
      float fall = exp(-u*(2.6 - vac*1.4))*smoothstep(0., 0.04, u + 0.02);
      vec3 hot = ker > 0.5 ? vec3(1., 0.86, 0.55) : vec3(1., 0.8, 0.62), mid = ker > 0.5 ? vec3(1., 0.5, 0.16) : vec3(1., 0.45, 0.22);
      vec3 c = mix(hot*1.6, mid, smoothstep(0.02, 0.35, u));
      c = mix(c, vec3(0.55, 0.62, 1.)*0.8, vac*smoothstep(0.1, 0.6, u));   // thin, bluish in near vacuum
      acc1 += c*core*dia*flick*fall;
    }
    acc += acc1*dt*thr*(2.2/max(r0, 0.5))*mix(1., 0.35, vac);
  }
  return acc;
}
// the ground cloud (exhaust and steam from the sound-suppression water) and venting before launch: front-to-back, returns colour and
// transmittance (xyz, w). Since 0.9.9 (owner: more smoke, as in a real launch) it billows out to about 500 m round Starbase's pad within
// 45 s and rises to about 170 m, its lobes rolling outward, with a ring of dust and spray thrown out at ignition by the blast (the first
// 4 s). Lit by the Sun (brighter on its sunward side), the sky from above, and the plume from inside while the engines are near
vec4 cloud(vec3 ro, vec3 rd, float tMax){
  vec3 col = vec3(0.); float T = 1.;
  float age = uCl.w;
  if(age >= 0. && uCl2.x > 0.01){
    float S = uCl2.z, ag = min(max(age, 0.), 60.), Rr = S*(30. + 40.*pow(ag, 0.62)), H = S*(14. + 13.*pow(ag, 0.62));
    // (the shock ring: out at 150 m/s at first, slowing, 4 s)
    float ra = age, rr = S*(12. + 150.*pow(ra, 0.72)), rth = S*(7. + ra*5.), rk = ra < 4. ? (1. - ra/4.)*(1. - ra/4.) : 0.;
    float Rb = max(Rr, rk > 0. ? rr + 2.2*rth : 0.);
    vec3 c0 = uCl.xyz;
    // bounding cylinder round the pad
    vec3 w = ro - c0; float A = dot(rd.xz, rd.xz), B = 2.*dot(w.xz, rd.xz), C = dot(w.xz, w.xz) - Rb*Rb, D = B*B - 4.*A*C;
    if(D > 0. && A > 1e-8){
      float sq = sqrt(D), t0 = max((-B - sq)/(2.*A), 0.), t1 = min((-B + sq)/(2.*A), tMax);
      if(abs(rd.y) > 1e-5){ float ta = (-w.y - 2.)/rd.y, tb = (H*1.6 - w.y)/rd.y; t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb)); }
      if(t1 > t0){
        float dt = (t1 - t0)/26.;
        vec3 steam = mix(vec3(0.62, 0.5, 0.4), vec3(0.92, 0.93, 0.95), uCl2.y);
        vec3 Ls = normalize(vec3(uLt.x, max(uLt.y, 0.05), uLt.z));
        for(int k=ZI;k<26;k++){
          vec3 p = w + rd*(t0 + dt*(float(k) + 0.5)); float rl = length(p.xz), r = rl/Rr, y = p.y/H;
          float shape = smoothstep(1., 0.4, r)*smoothstep(1.5, 0.15, y + 0.35*r)*smoothstep(-0.2, 0.12, y);
          float ring = rk > 0. ? rk*exp(-pow((rl - rr)/rth, 2.))*smoothstep(S*(10. + ra*6.), 0., p.y)*smoothstep(-2., 1., p.y) : 0.;
          if(shape + ring < 0.01) continue;
          // (the billows roll outward from the pad as they grow: the noise is carried out along the ground and up)
          vec2 out2 = rl > 1. ? p.xz/rl : vec2(0.);
          vec3 q = p/(S*13.) - vec3(out2.x, 0., out2.y)*age*0.045 + vec3(0., -age*0.04, 0.);
          float n = fbm3(q + 0.55*noise(q*1.9 + vec3(uDim.w)) + vec3(uDim.w)) - 0.48 + 0.3*shape;
          float dens = 1. - exp(-(clamp(n*3., 0., 1.)*shape*uCl2.x + ring*clamp(0.6 + (noise(p/(S*5.)) - 0.5)*2., 0., 1.))*0.055*dt);   // (Beer-Lambert: never more than all of the light)
          if(dens < 1e-4) continue;
          // (its sunward side brighter: the cloud's own shape toward the Sun stands in for a shadow ray)
          vec3 ps = p + Ls*S*30.; float rs = length(ps.xz)/Rr, ys = ps.y/H;
          float shd = smoothstep(1., 0.4, rs)*smoothstep(1.5, 0.15, ys + 0.35*rs)*smoothstep(-0.2, 0.12, ys);
          vec3 wp = p + c0; float lp = uPl.w/(1. + dot(wp - uPl.xyz, wp - uPl.xyz)/(900.*S*S));
          float yy = clamp(y, 0., 1.);
          // (bright: sunlit steam is the whitest thing at a launch, brighter than the ground round it)
          vec3 L = steam*(0.05 + uLt.w*(0.3 + 0.8*(1. - 0.65*shd))*(0.6 + 0.4*yy) + uLt.w*0.16*vec3(0.8, 0.88, 1.)) + vec3(1., 0.55, 0.22)*lp*0.7*(1. - 0.5*yy);
          col += T*L*dens; T *= 1. - dens; if(T < 0.04) break;
        }
      }
    }
  }
  // venting: thin white vapour streaming from the stack before launch
  if(uCl2.w > 0.01 && uPt[0].w > 0.5){
    for(int k=ZI;k<10;k++){
      float fk = float(k), h = fract(fk*0.618 + 0.13);
      vec3 base = uPt[0].xyz + uPa[0].xyz*(12. + h*95.), dir = normalize(vec3(sin(fk*2.4), -0.15, cos(fk*2.4)));
      float ph = fract(uDim.y*0.25 + h);
      vec3 cpos = base + dir*(5. + ph*14.) + vec3(0., -ph*6., 0.);
      float s = 1.5 + ph*4.;
      float b = blob(ro, rd, cpos, s)*uCl2.w*(1. - ph)*0.05;
      col += T*vec3(0.85, 0.88, 0.92)*(0.1 + 0.8*uLt.w)*b;
    }
  }
  return vec4(col, T);
}
// the vapour cone: going through the speed of sound in damp air a stage wears a thin conical sheet of condensation, flaring back from its
// shoulder (the collar uVc.z up part uVc.y) over uVc.w m, flickering as it forms and clears. Front-to-back like the cloud
vec4 vcone(vec3 ro, vec3 rd, float tMax){
  vec3 col = vec3(0.); float T = 1.;
  if(uVc.x < 0.01) return vec4(col, T);
  int i = int(uVc.y); float yc = uVc.z, L = uVc.w, ta = 0.8, hr = uPt[i].w < 2.5 ? 4.6 : 1.9;
  // (the stretch of the ray within the cylinder round the axis that holds the cone)
  vec3 ax = uPa[i].xyz, e = uPt[i].xyz + ax*(yc - L*0.5); float Rc = hr + L*ta + 1.;
  vec3 w = ro - e; float ea = dot(rd, ax), wa = dot(w, ax); vec3 dd = rd - ax*ea, ww = w - ax*wa;
  float A = dot(dd, dd), B = 2.*dot(dd, ww), C = dot(ww, ww) - Rc*Rc, D = B*B - 4.*A*C;
  if(D <= 0. || A < 1e-8) return vec4(col, T);
  float sq = sqrt(D), t0 = max((-B - sq)/(2.*A), 0.), t1 = min((-B + sq)/(2.*A), tMax);
  if(abs(ea) > 1e-5){ float tA = (-L*0.5 - 2. - wa)/ea, tB = (L*0.5 + 2. - wa)/ea; t0 = max(t0, min(tA, tB)); t1 = min(t1, max(tA, tB)); }
  if(t1 <= t0) return vec4(col, T);
  float dt = (t1 - t0)/18.;
  for(int k=ZI;k<18;k++){
    vec3 q = toPart(ro + rd*(t0 + dt*(float(k) + 0.5)), i); float s = yc + 1.5 - q.y;
    if(s < 0. || s > L) continue;
    float rho = length(q.xz), dc = rho - (hr + s*ta), th = 0.5 + s*0.05;
    float fl = 0.55 + 0.45*noise(vec3(atan(q.z, q.x)*2.5, s*0.35 - uDim.y*3., uDim.y*5.));
    float dens = 1. - exp(-exp(-dc*dc/(th*th))*smoothstep(0., 2.5, s)*smoothstep(L, L*0.5, s)*fl*uVc.x*0.5*dt);
    col += T*vec3(0.95, 0.96, 1.)*(0.15 + 1.1*uLt.w)*dens; T *= 1. - dens;
  }
  return vec4(col, T);
}
`;

// ---------------------------------------------------------------- Starship: Super Heavy, the ship, the tower and the launch mount
const FS_SX_STAR = COMMON + CLOUD_GLSL + SX_GLSL + `
float booster(vec3 q, out float m){
  float d = sdCylY(q, 4.5, 2.4, 69.); m = 1.;
  float sk = sdCylY(q, 4.25, 0., 2.4); if(sk < d){ d = sk; m = 3.; }
  float ring = sdCylY(q, 4.45, 69., 71.3); if(ring < d){ d = ring; m = 4.; }
  vec2 f = polarFold(q.xz, 4., 0.785);
  float fin = sdBox(vec3(f.x - 6.1, q.y - 65.6, f.y), vec3(1.65, 1.9, 0.3)); if(fin < d){ d = fin; m = 5.; }
  float ch = sdBox(vec3(abs(q.x) - 4.62, q.y - 35., q.z), vec3(0.26, 27., 0.22)); if(ch < d){ d = ch; m = 1.; }
  return d;
}
float shipSD(vec3 q, float fl, out float m){
  float body = sdCylY(q, 4.5, 1.9, 36.);
  float nose = q.y > 36. ? (length(vec3(q.x, (q.y - 36.)*0.3147, q.z)) - 4.5)*0.9 : 1e9;
  float d = min(body, max(nose, 36. - q.y)); m = 1.;
  float eng = sdCylY(q, 3.4, -0.2, 1.9); if(eng < d){ d = eng; m = 3.; }
  vec3 f = vec3(abs(q.x), q.y, q.z);
  vec3 fa = f - vec3(4.5, 2.2, -1.1); fa.xz = mat2(cos(fl), sin(fl), -sin(fl), cos(fl))*fa.xz;
  float af = sdBox(fa - vec3(1.9, 5.2, 0.), vec3(1.9, 5.2, 0.26)); if(af < d){ d = af; m = 6.; }
  float ff = sdBox(f - vec3(5.55, 41.5, -0.9), vec3(1.25, 3.6, 0.24)); if(ff < d){ d = ff; m = 6.; }
  if(m < 1.5 && q.z < -0.4 && q.y > 1.9) m = 2.;   // the heat shield: black tiles on the windward half
  return d;
}
float site(vec3 p, out float m){
  m = 11.; float d = 1e9;
  vec3 q = p - uSo.xyz;
  // tower: square lattice 9 m wide, 146 m to the lightning rod, 28 m north of the mount
  vec3 tq = q - vec3(0., 0., -28.);
  d = lattice(tq, 4.5, 141., 9., 0.55);
  float rod = sdCylY(tq, 0.4, 141., 152.); d = min(d, rod);
  float top = sdBox(tq - vec3(0., 141.5, 0.), vec3(5.2, 0.6, 5.2)); d = min(d, top);
  // the chopsticks: two arms on a carriage, hinged at the tower's front corners
  float hc = uSt.y, op = uSt.z*0.55;
  float car = max(sdBox(tq - vec3(0., hc + 1., 0.), vec3(6.4, 3.4, 6.4)), -sdBox(tq - vec3(0., hc + 1., 0.), vec3(5.3, 4., 5.3)));
  d = min(d, car);
  for(int k=ZI;k<2;k++){
    float sg = k == 0 ? 1. : -1.;
    vec3 a = tq - vec3(4.8*sg, hc, 4.5); float an = -op*sg; a.xz = mat2(cos(an), -sin(an), sin(an), cos(an))*a.xz;
    float arm = sdBox(a - vec3(1.2*sg, 0., 16.5), vec3(0.75, 1.9, 16.5)); if(arm < d){ d = arm; m = 13.; }
  }
  // the ship's quick-disconnect arm at 112 m, swinging back to the tower before launch
  vec3 qa = tq - vec3(-3., 112., 4.5); float sw = uSt.w; qa.xz = mat2(cos(sw), -sin(sw), sin(sw), cos(sw))*qa.xz;
  float qd = sdBox(qa - vec3(1.5, 0., 9.), vec3(1.1, 1.7, 9.)); if(qd < d){ d = qd; m = 11.; }
  // launch mount: a ring table on six legs, 20 m up, over the water-cooled steel plate
  float tab = max(abs(length(q.xz) - 8.2) - 2.6, abs(q.y - 18.2) - 1.8); if(tab < d){ d = tab; m = 11.; }
  vec2 lg = polarFold(q.xz, 6., 0.); float legs = sdCylY(vec3(lg.x - 9.6, q.y, lg.y), 1.25, 0., 17.); if(legs < d){ d = legs; m = 11.; }
  float plate = sdCylY(q, 15., -1., 0.5); if(plate < d){ d = plate; m = 10.; }
  // two tanks of the tank farm, west of the pad
  float tk = min(sdCylY(q - vec3(-150., 0., -40.), 5., 0., 32.), sdCylY(q - vec3(-165., 0., -18.), 5., 0., 32.)); if(tk < d){ d = tk; m = 1.; }
  return d;
}
float map(vec3 p, out float m){
  float d = 1e9, mm; m = 0.;
  if(uSt.x > 0.5){ d = site(p, mm); m = mm; }
  for(int i=ZI;i<4;i++){
    float ty = uPt[i].w; if(ty < 0.5) continue;
    vec3 q = toPart(p, i);
    if(length(q - vec3(0., 36., 0.)) > 44.){ d = min(d, length(q - vec3(0., 36., 0.)) - 40.); continue; }
    float dp = ty < 1.5 ? booster(q, mm) : shipSD(q, uPb[i].w, mm);
    if(dp < d){ d = dp; m = mm + (ty < 1.5 ? 0. : 20.); }
  }
  return d;
}
`;
// ---------------------------------------------------------------- Falcon 9 and Falcon Heavy, the second stage, Dragon, the pads, the droneship and the landing zone
const FS_SX_FAL = COMMON + CLOUD_GLSL + SX_GLSL + `
float core(vec3 q, float legs, float fins, float nose, out float m){
  if(length(q - vec3(0., 23., 0.)) > 34.){ m = 7.; return length(q - vec3(0., 23., 0.)) - 30.; }
  float d = sdCylY(q, 1.83, 1.1, 41.2); m = 7.;
  float eng = sdCylY(q, 1.72, 0., 1.1); if(eng < d){ d = eng; m = 3.; }
  if(nose > 0.5){ float nc = q.y > 41.2 ? (length(vec3(q.x, (q.y - 41.2)*0.34, q.z)) - 1.83)*0.9 : 1e9; nc = max(nc, 41.2 - q.y); if(nc < d){ d = nc; m = 9.; } }
  else { float is = sdCylY(q, 1.83, 41.2, 47.7); if(is < d){ d = is; m = 8.; } }
  vec2 f = polarFold(q.xz, 4., 0.785);
  float gy = nose > 0.5 ? 40. : 46.4;
  float fin = sdBox(vec3(f.x - 1.83 - 0.75*fins, q.y - gy, f.y), vec3(0.05 + 0.72*fins, 0.75, 0.62 - 0.52*fins)); if(fin < d){ d = fin; m = 5.; }
  vec2 g = polarFold(q.xz, 4., 0.);
  vec2 foot = mix(vec2(1.96, 10.4), vec2(8.4, -1.4), legs);
  float leg = sdCap(vec3(g.x, q.y, g.y), vec3(1.96, 1.3, 0.), vec3(foot.x, foot.y, 0.), 0.28); if(leg < d){ d = leg; m = 8.; }
  return d;
}
float dragonSD(vec3 q, out float m){
  float d = sdCylY(q, 1.85, 0., 3.7); m = q.x > 0.2 ? 12. : 7.;   // trunk: solar cells on one half
  float u = clamp((q.y - 3.7)/4.1, 0., 1.);
  float cap = max((length(q.xz) - mix(1.96, 1.05, u))*0.93, abs(q.y - 5.75) - 2.05); if(cap < d){ d = cap; m = 9.; }
  float nc = max(length(vec3(q.x, (q.y - 7.8)*1.6, q.z)) - 1.02, 7.8 - q.y); if(nc < d){ d = nc; m = 8.; }
  return d;
}
float stage2(vec3 q, float pay, out float m){
  if(length(q - vec3(0., 13., 0.)) > 18.){ m = 7.; return length(q - vec3(0., 13., 0.)) - 14.; }
  float u = clamp(q.y/2.9, 0., 1.), rb = mix(1.55, 0.45, pow(u, 0.7));
  float d = max(abs(length(q.xz) - rb) - 0.035, abs(q.y - 1.45) - 1.45); m = 3.;
  float tk = sdCylY(q, 1.83, 2.9, 12.6); if(tk < d){ d = tk; m = 7.; }
  if(pay < 0.5){
    float fr = sdCylY(q, 2.6, 13.2, 19.6); float og = q.y > 19.6 ? (length(vec3(q.x, (q.y - 19.6)*0.43, q.z)) - 2.6)*0.9 : 1e9; og = max(og, 19.6 - q.y);
    float bt = sdCylY(q, 2.6 - 0.8*clamp((13.2 - q.y)/0.6, 0., 1.), 12.6, 13.2);
    float fa = min(min(fr, og), bt); if(fa < d){ d = fa; m = 7.; }
  } else if(pay < 1.5){ float mm; float dg = dragonSD(q - vec3(0., 12.6, 0.), mm); if(dg < d){ d = dg; m = mm; } }
  return d;
}
float site(vec3 p, out float m){
  vec3 q = p - uSo.xyz; float c = cos(uSo.w), s = sin(uSo.w); q.xz = mat2(c, -s, s, c)*q.xz;
  float k = uSt.x, d = 1e9; m = 10.;
  if(k < 3.5){
    // pad: the launch mount and the strongback (transporter-erector) on the north side, leaning back before launch
    float mt = max(sdBox(q - vec3(0., 1.6, 0.), vec3(4.5, 1.6, 4.5)), -sdCylY(q, 2.2, 0., 4.)); d = mt; m = 10.;
    vec3 tq = q - vec3(0., 0., -4.3); float tl = uSt.w; tq.yz = mat2(cos(tl), sin(tl), -sin(tl), cos(tl))*tq.yz;
    float te = lattice(tq - vec3(0., 0., -1.3), 1.25, 57., 3.2, 0.2); if(te < d){ d = te; m = 11.; }
    if(k > 2.5){
      // the tower (80 m), with the crew access arm where crews board (kind 3: SLC-40; 39A, kind 2.75, lost its arm in 2026)
      vec3 cq = q - vec3(0., 0., -20.);
      float tw = lattice(cq, 5., 80., 8., 0.45); if(tw < d){ d = tw; m = 11.; }
      if(k > 2.9){ float arm = sdBox(q - vec3(0., 66., -9.5), vec3(1.4, 1.6, 7.5)); if(arm < d){ d = arm; m = 11.; } }
    }
  } else if(k < 4.5){
    // the droneship: a 91 x 52 m deck with walls along its long sides and a thruster pod at each corner
    float dk = sdBox(q - vec3(0., 1., 0.), vec3(45.5, 2., 26.)); d = dk; m = 14.;
    if(q.y > 2.8 && abs(length(q.xz) - 11.) < 0.8) m = 9.;   // (the landing ring painted on the deck)
    float wl = sdBox(vec3(q.x, q.y - 4., abs(q.z) - 25.5), vec3(44., 1.2, 0.5)); if(wl < d){ d = wl; m = 14.; }
    float th = sdBox(vec3(abs(q.x) - 42., q.y - 3.6, abs(q.z) - 22.), vec3(2.5, 1.2, 2.5)); if(th < d){ d = th; m = 14.; }
  } else {
    float lz = sdCylY(q, 42., -1., 0.25); d = lz; m = 10.;
  }
  return d;
}
float map(vec3 p, out float m){
  float d = 1e9, mm; m = 0.;
  if(uSt.x > 0.5){ d = site(p, mm); m = mm; }
  for(int i=ZI;i<4;i++){
    float ty = uPt[i].w; if(ty < 0.5) continue;
    vec3 q = toPart(p, i);
    float dp = ty < 5.5 ? core(q, uPb[i].w, uPc[i].w, ty > 3.5 ? 1. : 0., mm) : ty < 6.5 ? stage2(q, uPb[i].w, mm) : dragonSD(q, mm);
    if(dp < d){ d = dp; m = mm; }
  }
  return d;
}
`;
// the shared main(): march, shade (Sun, sky, the plume's own light, soft shadows), then plumes and clouds along the ray
const SX_MAIN = `
vec3 skyTint(vec3 r){ vec3 day = mix(vec3(0.3, 0.26, 0.2)*0.4, vec3(0.45, 0.62, 0.95), smoothstep(-0.05, 0.25, r.y)); return day*(0.04 + 0.5*uLt.w) + vec3(0.02, 0.025, 0.05); }
vec3 matCol(float m, vec3 p, vec3 q, out float ks, out float gl){
  ks = 0.2; gl = 16.;
  if(m > 19.5) m -= 20.;
  if(m < 1.5){ ks = 1.; gl = 40.; return vec3(0.78, 0.79, 0.8)*(0.9 + 0.1*noise(p*1.3)); }   // stainless steel
  if(m < 2.5){ ks = 0.25; gl = 20.; return vec3(0.045); }                                        // heat-shield tiles
  if(m < 3.5){ ks = 0.6; gl = 30.; return vec3(0.16, 0.15, 0.14); }                              // engines
  if(m < 4.5){ return vec3(0.1); }                                                                // hot-staging ring
  if(m < 5.5){ ks = 0.5; gl = 20.; return vec3(0.22, 0.22, 0.24); }                               // grid fins
  if(m < 6.5){ ks = 0.8; gl = 30.; return vec3(0.4, 0.41, 0.43); }                                // flaps
  if(m < 7.5){ float soot = smoothstep(0.35, 0.8, noise(p*0.35))*smoothstep(38., 8., p.y - uPt[0].y); return vec3(0.88, 0.88, 0.86)*mix(1., 0.55, soot*0.7); }   // white paint, sooty low down
  if(m < 8.5){ return vec3(0.05); }                                                               // black: interstage, legs, Dragon's nose
  if(m < 9.5){ ks = 0.35; return vec3(0.9, 0.9, 0.9); }                                           // Dragon, nosecones
  if(m < 10.5){ return vec3(0.34, 0.33, 0.31)*(0.85 + 0.3*noise(p*0.2)); }                        // concrete
  if(m < 11.5){ ks = 0.3; return vec3(0.42, 0.42, 0.43); }                                        // tower steel
  if(m < 12.5){ ks = 0.6; gl = 40.; return vec3(0.06, 0.07, 0.12); }                              // solar cells
  if(m < 13.5){ ks = 0.5; return vec3(0.5, 0.5, 0.52); }                                          // chopsticks
  return vec3(0.3, 0.3, 0.32);                                                                    // the droneship's deck
}
vec3 nrmAt(vec3 p, float e){
  vec3 n = vec3(0.); float m;
  for(int i=ZI;i<4;i++){ vec3 k = vec3((i == 3 || i == 0) ? 1. : -1., (i == 1 || i == 3) ? 1. : -1., (i == 2 || i == 3) ? 1. : -1.)*0.5773; n += k*map(p + k*e, m); }
  return normalize(n);
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float R = uDim.x;
  vec3 ro = o*R, L = uLt.xyz;
  float t = max(hb.x, 0.)*R, tEnd = hb.y*R, m = 0., eps = 0.;
  bool hit = false;
  int steps = int(mix(70., 150., clamp(uLod, 0., 1.)));
  for(int i=ZI;i<200;i++){
    if(i >= steps) break;
    float h = map(ro + d*t, m); eps = max(0.02, t*uPix*0.7);
    if(h < eps){ hit = true; break; }
    t += h*0.92; if(t > tEnd) break;
  }
  vec3 col = vec3(0.); float a = 0., tHit = hit ? t : tEnd;
  if(hit){
    vec3 p = ro + d*t, n = nrmAt(p, max(eps*0.6, 0.015)); float ks, gl;
    vec3 base = matCol(m, p, p, ks, gl);
    // soft shadow toward the Sun (only when the Sun is up, and only on larger views)
    float sh = 1.;
    if(uLt.w > 0.02 && uLod > 0.45){ float st = 0.3, mm; for(int i=ZI;i<22;i++){ float h = map(p + n*0.1 + L*st, mm); sh = min(sh, 10.*h/st); st += clamp(h, 0.4, 12.); if(sh < 0.03 || st > 220.) break; } sh = clamp(sh, 0., 1.); }
    float dif = max(dot(n, L), 0.)*sh*smoothstep(-0.02, 0.08, L.y + 0.05);
    vec3 r = reflect(d, n);
    vec3 c = base*(dif*1.5 + 0.6*skyTint(n)) + ks*skyTint(r)*0.9;
    c += base*0.22*pow(1. - max(dot(n, -d), 0.), 3.)*(0.3 + 0.7*uLt.w);   // (a rim of light, so a stage stands out from the ground behind it)
    c += vec3(1., 0.95, 0.85)*pow(max(dot(r, L), 0.), gl)*ks*sh*1.2;
    // the plume lights the pad, the hull and the tower, fading with distance
    vec3 lv = uPl.xyz - p; float ld2 = dot(lv, lv);
    c += base*vec3(1., 0.62, 0.3)*uPl.w*max(dot(n, lv*inversesqrt(max(ld2, 1.))), 0.)*1800./(ld2 + 1800.);
    // floodlights: the pads are lit from the ground at night, so the rocket stands out white against the sky
    if(uSt.x > 0.5 && uSt.x < 3.5){ vec3 so = uSo.xyz;
      for(int k=ZI;k<3;k++){ float fk = float(k); vec3 lp = so + vec3(sin(fk*2.1 + 0.6)*110., 3., cos(fk*2.1 + 0.6)*110.), lv = lp - p; float l2 = dot(lv, lv);
        c += base*vec3(0.85, 0.9, 1.)*max(dot(n, lv*inversesqrt(l2)), 0.)*(1. - uLt.w)*1.6*30000./(l2 + 30000.); } }
    col = c; a = 1.;
  }
  vec4 cl = cloud(ro, d, tHit);
  col = col*cl.w + cl.xyz;
  vec4 vk = vcone(ro, d, tHit);
  col = col*vk.w + vk.xyz;
  col += plumes(ro, d, tHit)*mix(1., 0.6, 1. - cl.w);
  a = 1. - (1. - a)*cl.w*vk.w;
  // (the low cloud between the camera and what the ray met: a stage climbing through the deck fades into it; the ground and sky behind
  // already show the cloud)
  if(uWx0.x > 0.01){
    vec3 so = uCm*ro + uCo.xyz, sdir = uCm*d; float tcl = hit ? tHit : tEnd;
    float alt0 = so.y + uCo.w + dot(so.xz, so.xz)/12742000., ta = (uWx1.x - alt0)/(abs(sdir.y) > 1e-5 ? sdir.y : 1e-5), tb = (uWx1.y - alt0)/(abs(sdir.y) > 1e-5 ? sdir.y : 1e-5);
    float c0 = max(min(ta, tb), 0.), c1 = min(max(ta, tb), tcl);
    if(c1 > c0){ float Tc = 1., dc = (c1 - c0)/8.;
      for(int k=ZI;k<8;k++){ vec3 q = so + sdir*(c0 + dc*(float(k) + 0.5)); Tc *= exp(-cloudLowCheap(q, q.y + uCo.w + dot(q.xz, q.xz)/12742000.)*dc*0.012); }
      col *= Tc; a *= Tc; }
  }
  outCol(col, a);
}`;
P.sxStar = program(VS_RECT, FS_SX_STAR + SX_MAIN);
P.sxFal = program(VS_RECT, FS_SX_FAL + SX_MAIN);

// ---------------------------------------------------------------- the smoke column a flight leaves (0.9.9, owner: more smoke, as in a real launch)
// A chain of capsules along the stack's path from the pad up through the lower air (to about 14 km), each widening with its age and drifting
// with the wind (s3-spacex.js, smokeUpdate), filled with turbulence at the column's own scale, lit by the Sun through the smoke above each
// point, by the sky, and a little from the ground. White steam from Starship's methane, greyer from Falcon's kerosene. In metres, in the
// pad's frame round the volume's centre. uK[k] = centre, radius; uKd[k] = density, age (s), soot 0..1; uSm = count, 0, 0, ZI (0);
// uLtS = sun direction, daylight; uDimS = bounding radius (m), time (s)
const FS_SX_SMOKE = COMMON + `
uniform vec4 uK[16]; uniform vec4 uKd[16]; uniform vec4 uSm; uniform vec4 uLtS; uniform vec4 uDimS;
#define ZI int(uSm.w)
// the smoke at p: its density, the column's radius and soot there (out), and how far p lies outside the column (for skipping empty air)
float smokeAt(vec3 p, out float rad, out float soot, out float outside){
  float best = 0.; rad = 4.; soot = 0.; outside = 1e9;
  int n = int(uSm.x);
  for(int k=ZI;k<15;k++){
    if(k + 1 >= n) break;
    vec3 a = uK[k].xyz, ba = uK[k + 1].xyz - a; float h = clamp(dot(p - a, ba)/max(dot(ba, ba), 1e-6), 0., 1.);
    float r = mix(uK[k].w, uK[k + 1].w, h), q = length(p - a - ba*h);
    outside = min(outside, q - r);
    if(q >= r) continue;
    float dn = mix(uKd[k].x, uKd[k + 1].x, h)*smoothstep(1., 0.3, q/r);
    if(dn > best){ best = dn; rad = r; soot = mix(uKd[k].z, uKd[k + 1].z, h); }
  }
  return best;
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float R = uDimS.x; vec3 ro = o*R; float t = max(hb.x, 0.)*R, tEnd = hb.y*R;
  vec3 L = uLtS.xyz; float day = uLtS.w;
  vec3 col = vec3(0.); float T = 1.;
  int steps = int(mix(28., 56., clamp(uLod, 0., 1.)));
  for(int i=ZI;i<56;i++){
    if(i >= steps || t > tEnd || T < 0.03) break;
    vec3 p = ro + d*t; float rad, soot, outside;
    float base = smokeAt(p, rad, soot, outside);
    if(base <= 0.){ t += max(outside, 1.5 + t*0.002); continue; }
    float st = max(rad*0.16, 1.2);
    // (turbulence at the column's own scale, rising slowly)
    vec3 q = p/(rad*0.85) + vec3(0., -uDimS.y*0.05, 0.);
    float dens = clamp((fbm3(q) - 0.42 + base*0.45)*2.4, 0., 1.)*base;
    if(dens > 0.002){
      float r2, s2, o2; float sh = smokeAt(p + L*rad*0.8, r2, s2, o2);
      float lit = exp(-sh*2.4)*smoothstep(-0.1, 0.15, L.y)*day;
      vec3 c = mix(vec3(0.96, 0.95, 0.92), vec3(0.4, 0.36, 0.32), soot);
      vec3 li = c*(lit*1.05 + day*0.26*vec3(0.78, 0.86, 1.) + 0.015);
      float a = 1. - exp(-dens*st*0.04);
      col += T*li*a; T *= 1. - a;
    }
    t += st;
  }
  outCol(col, 1. - T);
}`;
P.sxSmoke = program(VS_RECT, FS_SX_SMOKE);

/// ---------------------------------------------------------------- the ground and the sky round a launch site, seen from near the ground
// Drawn right after Earth (earth.drawAfter), over the whole screen, while the camera is within a few tens of kilometres of the surface:
// Earth's own shader is a planet seen from space, so close to the pad this takes over. In metres, in the frame of the site the camera is
// nearest (x east, y up, z south, the pad at the origin, the sea uP4.y below it), the ground follows the Earth's curve. Where the site's
// images are loaded (ED_GLSL, e3-earth-detail.js) it is the real ground: near the camera the heights (terrain and buildings from
// OpenStreetMap) are ray-marched, so hills, hangars and the Vehicle Assembly Building stand up and cast shadows; further off the images lie
// flat on the curve. Elsewhere, and without the images (offline, the artifact page), a sketch: land and sea split along a straight coastline.
// Colours are worked out as they should show on screen (after FS_CELL's tone map, which unTone undoes, as the planets do): the images a
// little richer in colour and contrast, so tidal flats, marsh, sand and roofs land on different characters. Water reflects the sky (more at
// a glancing angle), glints in the Sun and takes the plume's light; the open sea is one colour. Distant ground fades into the haze of the
// horizon. The sky: blue by day, darkening to black as the camera climbs, an orange band at twilight, the Sun.
// uP0 = camera (m), fade;  uP1 = sun direction, daylight;  uP2 = coast normal (x, z), coast distance (m), open sea (1);
// uP3 = plume light: position (m), strength;  uP4 = time, the height of the pad above the sea (m), 0, ZI (0)
const FS_SX_ENV = COMMON + '#define ED_GRAD\n' + ED_GLSL + CLOUD_GLSL + `
const float RE = 6371000.;
int ZI = 0;   // (a 0 the compiler cannot see, set in main from a uniform, so the loops stay loops)
float CALT = 0., DIP = 0.;   // the height of the camera above the sea (m), and how far below level the horizon lies (radians, about)
vec3 unTone(vec3 c){ return -log(1. - clamp(c, 0., 0.985)); }
// where a ray meets the sea-level curve (y = -e - r^2/2R), or -1
float curveT(vec3 o, vec3 d, float e){
  o.y += e;
  float A = dot(d.xz, d.xz)/(2.*RE), B = d.y + dot(o.xz, d.xz)/RE, C = o.y + dot(o.xz, o.xz)/(2.*RE);
  float D = B*B - 4.*A*C; if(D < 0.) return -1.;
  float q = -0.5*(B + sign(B)*sqrt(D)); float t1 = A > 1e-18 ? q/A : -1., t2 = C/q;
  float t = 1e30; if(t1 > 0.) t = t1; if(t2 > 0.) t = min(t, t2);
  return t < 1e29 ? t : -1.;
}
// a point of the ground plane at (x, z): its place on the sea-level sphere, in the layers' frame
vec3 seaPt(vec2 xz){ return vec3(xz.x, -uP4.y - dot(xz, xz)/(2.*RE), xz.y); }
// the height of whatever is at (x, z), as a y in this frame
float groundY(vec2 xz, out float water, out float ok){ vec3 P = seaPt(xz); float h = edHeight(P, water, ok); return P.y + max(h, 0.); }
// the sky as it shows in direction r (day 0..1): deep blue overhead, paler toward the horizon (whiter when the air is hazy), both fading as
// the air thins below the camera; gold round a low Sun and along that side of the horizon; at dusk and dawn, the Earth's grey-blue shadow
// low on the far side with the pink band above it (the Belt of Venus); the Sun, in a halo that grows with haze
vec3 skyCol(vec3 r, vec3 L, float day){
  float thin = exp(-CALT/8500.), el = r.y - DIP, mu = dot(r, L), mz = max(mu, 0.), sunE = L.y;
  float hazy = clamp(1. - uWx0.w/40000., 0., 0.8);
  float hb = exp(-max(el, 0.)*mix(22., mix(3.2, 2.3, hazy), thin));
  vec3 zen = vec3(0.08, 0.19, 0.46)*mix(0.03, 1., thin), hor = mix(vec3(0.42, 0.53, 0.67), vec3(0.62, 0.67, 0.72), hazy)*mix(0.4, 1., thin);
  vec3 c = mix(zen, hor, hb)*day;
  vec2 rh = normalize(r.xz + vec2(1e-5, 0.)), lh = normalize(L.xz + vec2(1e-5, 0.));
  float toward = pow(max(dot(rh, lh), 0.), 2.), away = pow(max(-dot(rh, lh), 0.), 1.5);
  float low = smoothstep(0.35, 0.02, sunE)*smoothstep(-0.18, 0., sunE);
  c += vec3(0.78, 0.4, 0.13)*low*hb*(0.15 + 0.85*toward)*0.85*thin;
  float dusk = smoothstep(0.12, 0., sunE)*smoothstep(-0.2, -0.02, sunE);
  c += vec3(0.55, 0.3, 0.38)*dusk*away*smoothstep(0., 0.04, el)*exp(-max(el - 0.04, 0.)*12.)*0.55*thin;
  c *= 1. - 0.35*dusk*away*smoothstep(0.03, 0., el);   // (the Earth's shadow)
  // (the Sun: a disc about 1.2 degrees across, twice the real one so it reads as more than a character)
  c += vec3(1., 0.93, 0.8)*(pow(mz, 16.)*(0.08 + 0.3*hazy)*(0.3 + 0.7*thin) + pow(mz, 300.)*0.22 + pow(mz, 12000.)*3.)*smoothstep(-0.04, 0.02, sunE);
  return c;
}
// ---------------------------------------------------------------- the clouds (CLOUD_GLSL) as this shader sees them
float altOf(vec3 p, float e){ return p.y + e + dot(p.xz, p.xz)/(2.*RE); }
// how much of the air's haze lies between the camera and a point t away (the real visibility, uWx0.w)
float hazeF(float t, float thin){ return (1. - exp(-t*0.7/max(uWx0.w, 3000.)*mix(0.35, 1., thin)))*0.92; }
// the low layer along a ray up to tMax: marched in 16 steps within the slab, the light that reaches each sample worked out from the cloud
// between it and the Sun (two coarse samples), bright edges toward the Sun (the silver lining), dark undersides, hazed with distance
vec4 layerLow(vec3 o, vec3 d, float e, float tMax, vec3 L, float lit, vec3 sunC, vec3 hz, float thin, out float tIn){
  tIn = 1e9; vec3 col = vec3(0.); float T = 1.;
  if(uWx0.x < 0.01) return vec4(col, T);
  float b = uWx1.x, tp = uWx1.y, tB = curveT(o, d, e - b), tT = curveT(o, d, e - tp), t0, t1;
  if(CALT < b){ t0 = tB; t1 = tT; } else if(CALT > tp){ t0 = tT; t1 = tB > 0. ? tB : t0 + 40000.; } else { t0 = 0.; t1 = min(tB > 0. ? tB : 1e9, tT > 0. ? tT : 1e9); }
  if(t0 < 0. || t0 > min(tMax, 90000.)) return vec4(col, T);
  if(t1 < 0.) t1 = t0 + 40000.;
  t1 = min(min(t1, tMax), t0 + 40000.);
  if(t1 <= t0) return vec4(col, T);
  tIn = t0;
  float dt = (t1 - t0)/16., ph = 0.6 + 1.3*pow(max(dot(d, L), 0.), 8.);
  for(int i=ZI;i<16;i++){
    float t = t0 + dt*(float(i) + 0.5); vec3 p = o + d*t; float al = altOf(p, e);
    // (a camera inside the layer flies in clear air between the clouds, as a camera plane would: no fog round it)
    float dn = cloudLow(p, al)*(CALT > b && CALT < tp ? smoothstep(150., 700., t) : 1.); if(dn < 0.01) continue;
    // (the light through the cloud toward the Sun, gentler than physics would have it: in characters a cloud reads by its bright sunlit
    // side against the blue, and a physically deep cloud came out as a grey veil)
    float od = cloudLowC(p + L*140.)*0.8 + cloudLowC(p + L*450.)*1.0, hN = clamp((al - b)/max(tp - b, 50.), 0., 1.);
    vec3 cc = sunC*exp(-od*0.5)*ph + vec3(0.62, 0.68, 0.78)*(0.3 + 0.32*hN)*lit;
    cc *= mix(1., 0.55, clamp(uWx1.w*0.4, 0., 1.));   // (rain clouds are dark)
    cc = mix(cc, hz, hazeF(t, thin));
    float a = 1. - exp(-dn*dt*0.012);
    col += T*cc*a; T *= 1. - a; if(T < 0.03) break;
  }
  return vec4(col, T);
}
// a sheet (kind 0: the altocumulus at 4.5 km, 1: the cirrus at 9 km) where the ray crosses it, if nearer than tMax
vec4 sheet(vec3 o, vec3 d, float e, float H, float tMax, int kind, vec3 L, float lit, vec3 sunC, vec3 hz, float thin, out float tS){
  tS = curveT(o, d, e - H);
  if(tS <= 0. || tS > min(tMax, 150000.)){ tS = 1e9; return vec4(0., 0., 0., 1.); }
  vec3 p = o + d*tS; float dn = kind == 0 ? cloudMid(p.xz) : cloudHigh(p.xz);
  float a = dn*(kind == 0 ? 0.85 : 0.55)*(1. - smoothstep(70000., 150000., tS));
  vec3 cc = sunC*(kind == 0 ? 0.85 : 1.)*(0.7 + 0.5*pow(max(dot(d, L), 0.), 6.)) + vec3(0.55, 0.62, 0.74)*0.2*lit;
  cc = mix(cc, hz, hazeF(tS, thin)*0.8);
  return vec4(cc*a, 1. - a);
}
// the shadow the clouds cast on the ground at p: their big shapes where the Sun's ray crosses the low layer and the mid sheet
float cloudShadow(vec3 p, float e, vec3 L){
  if(L.y < 0.03) return 1.;
  float al = altOf(p, e), mid = 0.5*(uWx1.x + uWx1.y);
  float s = 1. - 0.62*cloudLowC(p + L*max(mid - al, 0.)/L.y)*smoothstep(0.02, 0.2, uWx0.x);
  return s*(1. - 0.3*cloudMid((p + L*max(4500. - al, 0.)/L.y).xz));
}
// the images as shown near the ground: a little more colour and contrast than the photo, so scrub, marsh, sand and concrete land on
// different characters
vec3 grade(vec3 c){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 1.3); return clamp((c - 0.45)*1.2 + 0.45, 0., 1.); }
// and as Earth's own shader shows them from space (FS_EARTH: edLin, times the light of the Sun, through the tone map), for the handover
vec3 fromSpace(vec3 lin, float sunE){ return 1. - exp(-lin*1.25*max(sunE, 0.)); }
void main(){
  ZI = int(uP4.w);
  vec3 d = rayDir()*uRot, o = uP0.xyz, L = uP1.xyz;
  float day = uP1.w, fade = uP0.w, e = uP4.y, sunE = L.y;
  CALT = o.y + e + dot(o.xz, o.xz)/(2.*RE); DIP = -sqrt(2.*max(CALT, 0.)/RE);
  float thin = exp(-CALT/8500.);
  float lit = 0.04 + 0.96*smoothstep(-0.08, 0.35, sunE);   // how bright the day is: full with the Sun 20 degrees up, dim at night
  float near = smoothstep(30000., 8000., CALT);   // (above 30 km the ground shows as Earth's shader shows it, below 8 km brighter and richer)
  vec3 col; float a;
  // the ground: march the heights near the camera (then halve the last step a few times), else the sea-level curve
  float t = -1., water = 0., ok = 0.;
  bool det = uEdS.x > 0.5;
  // (the march starts where the ray comes down to the highest ground near the site: from a plane's height it skips most of the way)
  float hTop = uEdS.z - e + 5.;
  if(det && d.y < 0.3 && (o.y < hTop || d.y < 0.)){
    float tt = o.y > hTop ? (o.y - hTop)/max(-d.y, 1e-5) : 0., tp = tt, lo = 0., hi = 0.; int nb = -1;
    for(int i=ZI;i<86;i++){
      float tm = nb < 0 ? tt : 0.5*(lo + hi), w, k;
      vec3 p = o + d*tm; float dh = p.y - groundY(p.xz, w, k);
      if(nb < 0){
        if(dh < 0.){ nb = 0; lo = tp; hi = tt; continue; }
        tp = tt; tt += clamp(dh*0.55, 0.25 + tt*0.003, 25. + tt*0.04);
        if(tt > 40000. || (k < 0.5 && tt > 200.)) break;
      } else { if(dh < 0.) hi = tm; else lo = tm; nb++; if(nb >= 6) break; }
    }
    if(nb >= 0) t = hi;
  }
  float tc = curveT(o, d, e);
  if(t < 0. && tc > 0.) t = tc;
  if(t > 0.){
    vec3 p = o + d*t;
    float fp = max(t*uPix, 0.05), cov = 0., wall = 0., sh = 1.;
    vec3 n = vec3(0., 1., 0.), g;
    // (a pixel's footprint on the ground: stretched along the view by the glancing angle, up to 16 times)
    vec3 hd = normalize(vec3(d.x, 0., d.z) + vec3(1e-5, 0., 0.)), g1 = hd*fp/max(abs(d.y), 0.0625), g2 = vec3(-hd.z, 0., hd.x)*fp;
    vec3 img = det ? edColourG(seaPt(p.xz), g1, g2, cov).rgb : vec3(0.);
    float gy = det ? groundY(p.xz, water, ok) : -e;
    if(det && ok > 0.5 && water < 0.5){
      // the slope from the heights a little east and south (a wall where it changes by more than a storey in a pixel or two)
      float s = max(fp*1.5, 0.8), hx = gy, hz = gy;
      for(int j=ZI;j<2;j++){ float w1, k1, h = groundY(p.xz + (j == 0 ? vec2(s, 0.) : vec2(0., s)), w1, k1); if(j == 0) hx = h; else hz = h; }
      n = normalize(vec3(gy - hx, s, gy - hz)); wall = 1. - smoothstep(0.35, 0.75, n.y);
      // shadows of buildings and hills near the camera: march toward the Sun over the heights
      if(sunE > 0.02 && t < 5000.){
        float st = 1.5, w1, k1; vec3 q0 = vec3(p.x, gy, p.z) + n*0.4;
        for(int j=ZI;j<24;j++){ vec3 q = q0 + L*st; float hh = q.y - groundY(q.xz, w1, k1); sh = min(sh, clamp(6.*hh/st + 0.5, 0., 1.));
          st += max(hh*0.6, 1.5 + st*0.08); if(sh < 0.05 || st > 900. || hh > 400.) break; }
        sh = mix(1., sh, smoothstep(5000., 2500., t));
      }
    }
    float csh = cloudShadow(p, e, L);
    // (outside the images: the sketch, sea past a straight coastline)
    float sd = dot(p.xz, uP2.xy) - uP2.z + 180.*(fbm3(vec3(p.xz*0.0004, 1.)) - 0.5);
    bool sea = cov > 0.5 ? water > 0.5 : (uP2.w > 0.5 || sd > 0.);
    vec3 haze = skyCol(normalize(vec3(d.x, DIP + 0.015, d.z)), L, day);
    if(sea){
      vec2 wv = p.xz*0.02 + vec2(uP4.x*0.3, uP4.x*0.17);
      vec3 nw = normalize(vec3((noise(vec3(wv, 3.)) - 0.5)*0.3, 1., (noise(vec3(wv.yx, 7.)) - 0.5)*0.3));
      // (waves tilt the water: it mirrors a higher, darker part of the sky than a flat mirror would, and never all of it, so the sea stays
      // darker than the sky at the horizon)
      vec3 rr = reflect(d, nw); rr.y = max(abs(rr.y), 0.12); rr = normalize(rr);
      float F = min(0.02 + 0.98*pow(1. - max(-dot(d, nw), 0.), 5.), 0.35);
      // (the water's own colour: the photo's, turned bluer, so a murky coast still reads as sea and a dark lagoon never as a hole; one colour on the open sea)
      float eg, op = cov > 0.5 ? edWide(seaPt(p.xz), eg).a : 1.;
      vec3 deep = vec3(0.03, 0.1, 0.2), ocn = vec3(0.03, 0.12, 0.24), wi = mix(img*vec3(0.7, 0.85, 1.05), vec3(0.04, 0.13, 0.25), 0.55);
      vec3 wc = mix(fromSpace(mix(mix(ocn, edLin(img), 0.55*step(0.5, cov)), ocn, op), sunE), mix(cov > 0.5 ? wi : deep, deep, op)*lit, near);
      g = mix(wc*mix(0.72, 1., csh), skyCol(rr, L, day)*0.95, F);
      g += vec3(1., 0.9, 0.75)*pow(max(dot(rr, L), 0.), 80.)*smoothstep(-0.05, 0.05, sunE)*0.8*csh;
      vec3 lv = uP3.xyz - p; g += vec3(1., 0.55, 0.22)*uP3.w*pow(max(dot(rr, normalize(lv)), 0.), 20.)*0.3/(1. + dot(lv, lv)*2e-7);
    } else {
      vec3 base;
      // (near the ground a little darker than the rockets and towers, so they stand out; from a kilometre or more up, where the view is
      // about the land, brighter)
      if(cov > 0.5) base = mix(fromSpace(edLin(img), sunE), grade(img)*mix(0.6, 0.9, smoothstep(300., 1500., CALT))*lit, near);
      else {
        float h = fbm3(vec3(p.xz*0.004, 2.)), h2 = noise(vec3(p.xz*0.03, 5.));
        base = mix(vec3(0.5, 0.45, 0.33), vec3(0.3, 0.36, 0.2), smoothstep(0.4, 0.6, h))*(0.8 + 0.4*h2);
        if(sd > -120.) base = mix(base, vec3(0.75, 0.7, 0.58), smoothstep(-120., -40., sd));
        base = mix(base, vec3(0.5, 0.49, 0.47), smoothstep(90., 70., length(p.xz)))*lit;
      }
      // (the photo already holds the light on flat ground; slopes, walls and shadows change it by their share of the light of the Sun)
      float fl = max(sunE, 0.) + 0.3, here = max(dot(n, L), 0.)*sh*csh + 0.3*(0.6 + 0.4*n.y);
      g = base*clamp(here/fl, 0.15, 1.6)*mix(1., 0.8, wall);
      // lights round the site at night
      vec2 cl = floor(p.xz/35.); float hl = hash12(cl);
      if(hl > 0.93 && length(p.xz) < 1400.){ vec2 f = fract(p.xz/35.) - 0.5; g += vec3(1., 0.7, 0.35)*exp(-dot(f, f)*60.)*(1. - day)*0.5; }
      vec3 lv = uP3.xyz - p; g += base*vec3(1., 0.55, 0.22)*uP3.w*1.5*max(dot(n, normalize(lv)), 0.)/(1. + dot(lv, lv)*4e-6);
    }
    g = mix(g, haze, hazeF(t, thin));
    col = g; a = 1.;
  } else {
    col = skyCol(d, L, day);
    float tw = smoothstep(-0.18, 0.02, sunE)*smoothstep(0.25, 0.0, sunE);
    a = clamp((0.25 + 0.74*day)*mix(0.35, 1., thin) + 0.3*tw, 0., 0.99);
  }
  // the clouds in front of what the ray met, in the order it meets them (the sunlight warm when the Sun is low)
  { vec3 sunC = mix(vec3(1., 0.97, 0.92), vec3(1., 0.62, 0.36), smoothstep(0.3, 0.02, sunE))*lit*smoothstep(-0.06, 0.04, sunE);
    vec3 hz = skyCol(normalize(vec3(d.x, DIP + 0.015, d.z)), L, day);
    float tB = t > 0. ? t : 1e9, tL, tM, tH;
    vec4 A1 = layerLow(o, d, e, tB, L, lit, sunC, hz, thin, tL), A2 = sheet(o, d, e, 4500., tB, 0, L, lit, sunC, hz, thin, tM), A3 = sheet(o, d, e, 9000., tB, 1, L, lit, sunC, hz, thin, tH);
    vec4 X; float y;
    if(tM < tL){ X = A1; A1 = A2; A2 = X; y = tL; tL = tM; tM = y; }
    if(tH < tM){ X = A2; A2 = A3; A3 = X; y = tM; tM = tH; tH = y; }
    if(tM < tL){ X = A1; A1 = A2; A2 = X; }
    vec3 cc = A1.rgb + A1.a*(A2.rgb + A2.a*A3.rgb); float Tc = A1.a*A2.a*A3.a;
    col = col*Tc + cc; a = 1. - (1. - a)*Tc; }
  outCol(unTone(col)*fade, a*fade);
}`;
P.sxEnv = program(VS_RECT, FS_SX_ENV);

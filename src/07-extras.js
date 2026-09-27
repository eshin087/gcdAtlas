
// ================================================================ travellers and transients: the Halo (a starship that folds space), comets, meteors, gamma-ray bursts
// ---------------------------------------------------------------- the Halo: a long-range cruiser shaped like a trident, its star-heart held between two crescent arms (local: bounding sphere 1, +y = forward)
// The ship's shader is built once per shield look (SHIELD 0 none, 1 outline, 2 bubble, 3 honeycomb): BOUND is the sphere it is drawn in, in
// ship radii (the shield reaches a little past the hull's own bound), RM 1 when the visitor asked for reduced motion.
const FS_SHIP_BODY = `
// the Halo (0.8.2, drawn after the owner's concept art): an original long-range cruiser. Local frame: bounding sphere 1, forward +y (the needle's
// tip at +0.834), dorsal side -x, belly +x toward what it studies, span along z. From above it is a trident: a needle-shaped bow, and two crescent
// arms sweeping back from its shoulders to the engines at their tails. Between the arms floats its heart, a captured ball of star plasma inside
// two dotted rings of light (the halo of its name), wired to the claws of the arms and to the bow by chains of lights. Black hull, silver edges,
// rows of small blue-white lights. The heart surges now and then, throwing sparks at its rings.
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/k1; }
// distance to a quadratic Bezier curve (A, B, C) and where along it (0..1) the nearest point is
vec2 sdBez(vec2 pos, vec2 A, vec2 B, vec2 C){
  vec2 a = B - A, b = A - 2.*B + C, c = a*2., dd = A - pos;
  float kk = 1./dot(b, b), kx = kk*dot(a, b), ky = kk*(2.*dot(a, a) + dot(dd, b))/3., kz = kk*dot(dd, a);
  float p = ky - kx*kx, q = kx*(2.*kx*kx - 3.*ky) + kz, h = q*q + 4.*p*p*p, res, t;
  if(h >= 0.){ h = sqrt(h); vec2 x = (vec2(h, -h) - q)/2.; vec2 uv = sign(x)*pow(abs(x), vec2(1./3.)); t = clamp(uv.x + uv.y - kx, 0., 1.); vec2 e = dd + (c + b*t)*t; res = dot(e, e); }
  else { float z = sqrt(-p), v = acos(q/(p*z*2.))/3., m = cos(v), n = sin(v)*1.732050808; vec3 tt = clamp(vec3(m + m, -n - m, n - m)*z - kx, 0., 1.);
    vec2 e1 = dd + (c + b*tt.x)*tt.x, e2 = dd + (c + b*tt.y)*tt.y; float r1 = dot(e1, e1), r2 = dot(e2, e2); if(r1 < r2){ res = r1; t = tt.x; } else { res = r2; t = tt.y; } }
  return vec2(sqrt(res), t);
}
const vec3 CORE = vec3(0., -0.3, 0.);
const vec2 ARM_C = vec2(-0.567, -0.33);                                   // the arms' arc: its centre in (y, |z|)
const vec2 KN = vec2(-0.187, 0.), KS = vec2(-0.041, 0.108);               // the bow: its neck (behind the shoulders) and a shoulder (the tip is at y 0.834)
const vec2 N1 = vec2(0.1225, 0.9925), N2 = vec2(-0.5947, 0.8039);         // outward normals of the bow's front and rear edges
float surge(float tm){ float k = floor(tm/2.3), f = fract(tm/2.3); float h = hash12(vec2(k, 7.3)); return h > 0.5 ? smoothstep(0., 0.05, f)*exp(-f*4.5)*(0.6 + 0.9*hash12(vec2(k, 1.1))) : 0.; }
float lift(float w){ float u = max(w - 0.1, 0.)/0.26; return -0.075*u*u; }   // the arms rise a little toward the dorsal side as they reach out
float bowPlan(vec2 q){ return max(dot(q - KS, N1), dot(q - KN, N2)); }
float sq(float x){ return x*x; }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0., 1.); return mix(b, a, h) - k*h*(1. - h); }
// set by map() as it goes: the distance to the hull without the heart (gH; the shield's outline goes round the hull, not the heart, whose
// outline would sit on the inner ring) and, for the honeycomb, to the skin of cells a little outside the hull (gE)
float gH = 1e9, gE = 1e9;
const float SKIN = 0.065;
#if FOLD > 0
// the fold (FOLD 1 ember wind, 2 singularity, 3 streak-out): the hull breaks up into square cells in the ship's plane (y, z), each about one
// character on screen (uM0[2].x wide, chosen by the page as the break-up starts). A cell is gone while the dissolve g (uM0[0].x) is past its
// threshold: a smooth front (foldF, no noise, so the march stays safe) plus a random share per cell from an integer hash. The page works out
// the same thresholds (foldCellThr in JS) to send an ember off each cell as it goes. The cut is part of map(), so the shield's outline and
// cells crumble with the hull. uM0: column 0 (g, mode: 1 leaving, -1 arriving, 0 whole; the heart's flare), column 1 (the shield's share,
// the style's amount: B the heart's darkness, C its stretch; the collapse clock), column 2 (the cell's size; B the dark heart's growth)
float gC = -1.;   // (set by map: signed distance in the plane to the cells still there, negative inside them)
const float FL = 1.8, RIMW = 0.1;
uint hsh(ivec2 c){ uvec2 u = uvec2(c + 1024); uint h = u.x*0x8da6b343u + u.y*0xd8163841u + 0x9e3779b9u; h ^= h >> 15u; h *= 0x2c1b3c6du; h ^= h >> 12u; h *= 0x297a2d39u; h ^= h >> 15u; return h; }
float cRnd(ivec2 c){ return float(hsh(c) >> 8u)*(1./16777216.); }
// the front, q = (y, z): low where the hull goes first (or comes back last). Its slope is at most FL.
float foldF(vec2 q){
#if FOLD == 1
  if(uM0[0].y > 0.) return (0.834 - q.x)/1.69 + 0.05*sin(q.y*9. + q.x*4.);            // leaving: from the needle's tip aft
  return 1. - length(vec2(q.x + 0.3, q.y))/1.14 + 0.05*sin(q.y*9. - q.x*5.);          // arriving: from the heart outward
#elif FOLD == 2
  return 1. - length(vec2((q.x + 0.3)*0.55, q.y))/0.62 + 0.04*sin(q.y*11. + q.x*6.);   // from the outer tips in toward the heart
#else
  return (q.x + 0.86)/1.72 + 0.02*sin(q.y*14.);                                       // from the engines to the tip
#endif
}
float thrC(ivec2 c){ return foldF((vec2(c) + 0.5)*uM0[2].x) + FJIT*(cRnd(c) - 0.5); }
float cellD(vec2 q){
  float cs = uM0[2].x, g = uM0[0].x; vec2 cf = q/cs; ivec2 c = ivec2(floor(cf)); vec2 f = (cf - vec2(c))*cs;
  bool me = thrC(c) > g; float best = 1e9;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    if(i == 0 && j == 0) continue;
    if((thrC(c + ivec2(i, j)) > g) != me){ vec2 lo = vec2(float(i), float(j))*cs, dd = max(max(lo - f, f - lo - cs), 0.); best = min(best, length(dd)); }
  }
  if(me) return -min(best, cs);
  // (a gone cell: at least as far as the nearest live cell beside it, or out of the 3 x 3 block; far behind the front, as far as the slope allows)
  float edge = min(min(f.x, cs - f.x), min(f.y, cs - f.y));
  return max(min(best, cs + edge), (g - foldF(q) - 0.5*FJIT)/FL - 0.71*cs);
}
float liveAt(vec3 c){ if(uM0[0].y == 0.) return 1.; return step(uM0[0].x, thrC(ivec2(floor(c.yz/uM0[2].x)))); }
#else
float liveAt(vec3 c){ return 1.; }
#endif
// one arm, in (y, |z|): a crescent round ARM_C, pointed at the shoulder and at the tail, widest two thirds of the way back, with a claw reaching in
// toward the heart. A: along the arm (0 shoulder, 1 tail), across it (0 inner edge, 1 outer edge), its width
float armPlan(vec2 q, out vec3 A){
  vec2 v = q - ARM_C; float r = length(v), u = (atan(v.y, v.x) - 0.698)/1.1;
  float Ro = 0.68 + 0.012*exp(-(u - 0.3)*(u - 0.3)*25.);
  float cf = max(1. - (0.508 - u)/0.1, 0.), cr = max(1. - (u - 0.508)/0.2, 0.), cl = u < 0.508 ? cf*sqrt(cf) : cr*cr;
  float wd = 0.089*smoothstep(0., 0.45, u)*(1. - smoothstep(0.68, 1., u)) + 0.063*cl;
  A = vec3(u, (r - Ro + wd)/max(wd, 1e-4), wd);
  float d = max(max(r - Ro, Ro - wd - r), max(-u, u - 1.)*r*1.1);
  return d*mix(0.92, 0.66, min(cl*1.5, 1.));
}
float map(vec3 p, out float id){
  float w = abs(p.z); vec2 q = vec2(p.y, w); vec3 A;
  // the bow: diamond in section, thickest at the shoulders; a spine and the bridge on top, a pod for the working gear underneath
  float db = bowPlan(q), bow = max(db, abs(p.x) - min(0.6*max(-db, 0.), 0.054 - 0.034*smoothstep(0., 0.83, p.y)))*0.86;
  float det = min(sdCap(p, vec3(-0.05, -0.06, 0.), vec3(-0.024, 0.5, 0.), 0.009), min(sdEll(p - vec3(-0.058, 0.035, 0.), vec3(0.016, 0.075, 0.022)), sdEll(p - vec3(0.05, 0.06, 0.), vec3(0.018, 0.2, 0.03))));
  // the arms, bevelled to sharp edges
  float da = armPlan(q, A), arm = max(da, abs(p.x - lift(w)) - min(0.45*max(-da, 0.), 0.026))*0.85;
  // an engine nacelle under each arm's tail, with a ring round it
  vec3 pe = vec3(p.x, p.y, w); float xe = lift(0.29);
  float nac = min(sdCap(pe, vec3(xe, -0.832, 0.287), vec3(xe - 0.006, -0.63, 0.305), 0.017), length(vec2(length(pe.xz - vec2(xe, 0.289)) - 0.024, pe.y + 0.775)) - 0.005);
#if FOLD > 0
  // (the fold's holes, cut only near the hull)
  gC = -1.;
  if(uM0[0].y != 0.){ float hm = min(min(bow, det), min(arm, nac)); if(hm < 2.5*uM0[2].x){ gC = cellD(p.yz); bow = max(bow, gC); det = max(det, gC); arm = max(arm, gC); nac = max(nac, gC); } }
#endif
#if FOLD == 2
  float core = length(p - CORE) - 0.038*(1. + 2.*uM0[2].y);   // (B: the heart turns dark, then swells as it swallows the ship)
#elif FOLD == 3
  float core = sdCap(p, CORE, CORE + vec3(0., 0.5*uM0[1].y, 0.), 0.038*(1. - 0.4*uM0[1].y));   // (C: it stretches forward as it pours away)
#else
  float core = length(p - CORE) - 0.038;
#endif
  gH = min(min(bow, det), min(arm, nac));
#if SHIELD == 3
  gE = smin(smin(min(bow, det), arm, 0.12), nac, 0.05) - SKIN;
#endif
  float d = bow; id = 0.;
  if(det < d){ d = det; id = 4.; }
  if(arm < d){ d = arm; id = 1.; }
  if(nac < d){ d = nac; id = 3.; }
  if(core < d){ d = core; id = 2.; }
  return d;
}
vec3 nrm(vec3 p){ float id; vec2 e = vec2(0.0012, 0.); return normalize(vec3(map(p + e.xyy, id) - map(p - e.xyy, id), map(p + e.yxy, id) - map(p - e.yxy, id), map(p + e.yyx, id) - map(p - e.yyx, id))); }
// a small light, hidden when the hull is in front of it (front: how far along the ray the hull is)
float lamp(vec3 o, vec3 d, vec3 c, float s, float front){ return dot(c - o, d) < front ? pblob(o, d, c, s) : 0.; }
// a row of dots: position along the row, spacing, distance from the row's line, dot radius
float dots(float x, float sp, float y, float r){ float c = (fract(x/sp) - 0.5)*sp; return exp(-(c*c + y*y)/(r*r)); }
// the uniforms (one map for the ship; the page sets them in setU below):
// uP0: x fold-drive spool, y light-speed sheen, z scale (1; it shrinks to a point as it folds away and grows back on arrival), w how far the rings have turned
// uP1: xyz light direction, w ram-scoop glow   uP2: glow of the scan array, tractor emitter, bow gun / drill, probe bay
// uP3: rgb the scoop's colour, w the heart's beat (its phase: one beat per unit)   uP4: xyz toward what pulls on the ship (world axes), w the shield's load
// uM0: the fold: column 0 (dissolve g, mode, the heart's flare), column 1 (shield share, style amount, collapse clock), column 2 (cell size)
// hexagon cells, neighbours 1 apart: the offset from the nearest cell's centre (xy) and that centre (zw)
vec4 hexCell(vec2 p){ const vec2 s = vec2(1., 1.7320508); vec4 c = floor(vec4(p, p - vec2(0.5, 1.))/s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy*s, p - (c.zw + 0.5)*s); return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy*s) : vec4(h.zw, (c.zw + 0.5)*s); }
float hexD(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }   // 0 at a cell's centre, 0.5 on its edge
#if SHIELD == 3
const float CELL = 0.12;
// the honeycomb seen in one plane of the ship (uv the point on the skin in that plane, w its third coordinate, ax which plane: 0 plan, 1 side,
// 2 front; cpx a cell's width in scene pixels): a dot at each cell's centre (and its edges when the cells are big on screen), lit by the wave
// that runs out from the heart on each beat, by the pull on the side facing it, and now and then a single cell twinkling
float honey(vec2 uv, float w, int ax, float cpx, float bf, float load, vec3 n, vec3 G, float tm){
  vec4 hc = hexCell(uv/CELL); vec2 cc = hc.zw*CELL;
  vec3 c3 = ax == 0 ? vec3(w, cc) : ax == 1 ? vec3(cc.y, cc.x, w) : vec3(cc.x, w, cc.y);
  float wave = exp(-sq((length(c3 - CORE) - 1.3*bf)/0.07));
  float tw = step(0.978, hash12(hc.zw*7.31 + float(ax)*13.7 + floor(tm*(RM > 0 ? 0.6 : 1.7))));
  float lit = wave*(0.9 + load) + tw*0.7 + load*smoothstep(0.1, 0.7, dot(n, G));
  float r = max(0.13, 0.9/cpx), v = exp(-dot(hc.xy, hc.xy)/(r*r));
  v += 0.45*exp(-sq((0.5 - hexD(hc.xy))*cpx/0.9))*smoothstep(8., 12., cpx);
  return v*lit*smoothstep(5., 7., cpx);
}
#endif
void main(){
  vec3 o, d; localRay(o, d);
  o *= BOUND/max(uP0.z, 0.01);
  vec2 hs = sphIsect(o, d, vec3(0.), BOUND);
  if(hs.y < 0.) discard;
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  float spool = uP0.x, ls = uP0.y, tm = uTime, S = surge(tm);
#if FOLD == 2
  float HDARK = 1. - uM0[1].y;   // (B: the heart's own glow goes out as it turns dark)
#else
  const float HDARK = 1.;
#endif
  // the heart beats (a double beat) and pumps harder the more the shield has to hold. Its own glow never grows past hp (so it never becomes a
  // white ball); the rings and the chains take the rest
  float load = uP4.w, bf = fract(uP3.w), beat = exp(-9.*bf) + 0.6*exp(-9.*max(bf - 0.2, 0.))*step(0.2, bf);
  float power = 1. + spool*1.6 + S*2. + 0.6*ls + load*(0.5 + 1.5*beat), hp = min(power, 2.2), rp = min(power, 4.5);
  vec3 L = normalize(uP1.xyz*uRot), G = uP4.xyz*uRot; G /= max(length(G), 1e-6);
  vec3 ice = vec3(0.6, 0.83, 1.), silver = vec3(0.85, 0.9, 1.), white = vec3(1.), shc = vec3(0.55, 0.8, 1.);
  // the shield: faint at rest, charging with the fold drive, about nine times brighter at the closest point of a black-hole pass, flickering
  // there (damped with reduced motion). Its fine detail only shows where the ship is big enough on screen (sv); the glow that flares under
  // load shows at any size. From the bridge the camera is inside it, so it is dimmer there, and the parts right beside the camera fade out
  // (nearK: by how far along the ray they are).
  float px0 = uPix*length(o), sv = smoothstep(0.05, 0.03, px0);
  float fl = RM > 0 ? 0.3*(noise(vec3(tm*1.5, 3.1, 7.7)) - 0.5) : noise(vec3(tm*8., 3.1, 7.7)) - 0.5;
  float sh = sv*(0.25 + 1.6*load + 0.9*spool)*(1. + 0.8*load*load*fl), flare = load*(0.35 + 0.65*beat);
  float damp = length(o) < 0.4 ? 0.35 : 1.; sh *= damp; flare *= damp;
#if FOLD > 0
  // (in a fold the shield folds into the heart before the hull breaks up, and forms again after it has come back together)
  float shk = uM0[1].x; sh *= shk; flare *= shk;
#else
  float shk = 1.;
#endif
  float t = max(hb.x, 0.), id = 0.; bool hit = false;
  // while marching: the ray's closest pass by the hull (am, for the glow round the outline); each dip toward the hull that comes out again
  // lights the outline where it passed at DL from the hull (lnV, lnP where it is brightest); where the ray enters and leaves the honeycomb skin
  float cm = 1e9, ct = 0., am = 1e9, amT = 0., lnV = 0., lnB = 0.; vec3 lnP = vec3(0.);
  float eP = 1., tP = 0., tE0 = -1., tE1 = -1.;
  float DL = clamp(2.4*px0, 0.05, 0.07);
  if(hb.y > 0.){
    for(int i=0;i<150;i++){ vec3 p = o + d*t; float h = map(p, id); if(h < 0.0005) { hit = true; break; }
      float g = gH; if(g < am){ am = g; amT = t; }
#if SHIELD > 0
      if(g < cm){ cm = g; ct = t; }
      else if(g > cm + 0.02){
#if SHIELD == 1
        if(cm < 0.2){ float lw = max(0.005, uPix*ct*0.8), v = exp(-sq((cm - DL)/lw))*(0.005/lw)*smoothstep(0.12, 0.5, ct); lnV += v; if(v > lnB){ lnB = v; lnP = o + d*ct; } }
#endif
        cm = 1e9; }
#endif
#if SHIELD == 3
      if(eP > 0. && gE <= 0. && tE0 < 0.) tE0 = mix(tP, t, eP/(eP - gE));
      else if(eP <= 0. && gE > 0. && tE0 >= 0. && tE1 < 0.) tE1 = mix(tP, t, eP/(eP - gE));
      eP = gE; tP = t;
#endif
      t += h*0.8; if(t > hb.y) break; }
  }
#if FOLD > 0
  float gc0 = gC;   // (at the hit: how far to the nearest hole)
#endif
#if SHIELD == 1
  if(!hit && cm < 0.2){ float lw = max(0.005, uPix*ct*0.8), v = exp(-sq((cm - DL)/lw))*(0.005/lw)*smoothstep(0.12, 0.5, ct); lnV += v; if(v > lnB){ lnB = v; lnP = o + d*ct; } }
#endif
  vec3 col = vec3(0.); float alpha = 0.;
  if(hit){
    vec3 p = o + d*t, n = nrm(p), A;
    float w = abs(p.z); vec2 q = vec2(p.y, w);
    float dif = max(dot(n, L), 0.), mu = max(dot(n, -d), 0.), rim = pow(1. - mu, 3.);
    vec3 hv = normalize(L - d); float spec = pow(max(dot(n, hv), 0.), 60.), sheen = pow(max(dot(n, hv), 0.), 6.);
    vec3 toC = CORE - p; float coreLit = max(dot(n, normalize(toC)), 0.)*0.25/(dot(toC, toC)*40. + 0.15);
    // black lacquer with a faint engraved pattern; a broad sheen and a sharp glint where the light catches it
    vec3 base = vec3(0.075, 0.08, 0.095)*(0.7 + 0.8*ridge(p*48.));
    col = base*(dif*1.3 + 0.3) + silver*(spec*1.2 + sheen*0.05) + ice*rim*0.12 + ice*coreLit*hp;
    // at light speed a thin blue-white sheen runs along the edges, brighter toward the needle's tip, streaming aft
    float lsk = ls*(0.15 + 0.85*pow(smoothstep(-0.9, 0.85, p.y), 2.))*(0.75 + 0.25*sin(p.y*30. + tm*12.));
    float lit = 0.;
    if(id > 1.5 && id < 2.5){
      // the heart: white-hot plasma, grainy, brighter as it surges or the drive spools up
      float pl = fbm3((p - CORE)*95. + vec3(0., tm*1.3, tm*0.4));
      col = mix(vec3(0.78, 0.88, 1.), white, smoothstep(0.3, 0.7, pl))*(3.2 + 2.2*pl + 1.2*mu)*hp;
#if FOLD == 2
      col *= 1. - uM0[1].y;   // (B: it goes dark, a tiny black hole)
#endif
    } else if(id > 2.5 && id < 3.5){
      float xe0 = lift(0.29);
      // nacelles: dark, with a silver ring and a glowing nozzle facing aft
      float noz = smoothstep(-0.8, -0.832, p.y)*max(-n.y, 0.);
      col += silver*exp(-sq((p.y + 0.775)/0.008))*1.6 + ice*noz*3.5*(1. + spool + S + 1.5*ls + load) + ice*dots(p.y, 0.03, abs(p.x - xe0) - 0.017, 0.006)*step(-0.76, p.y)*step(p.y, -0.64)*1.6;
    } else if(id > 0.5 && id < 1.5){
      // the arms: silver edges, a panel line along the middle, a row of lights near the outer edge and another along the inner one
      float e = -armPlan(q, A), s = A.x*0.75, edge = smoothstep(0.013, 0.003, e);
      col += silver*edge*(0.45 + 0.9*dif + 0.7*rim) + vec3(0.6, 0.84, 1.)*lsk*(edge*1.6 + rim*0.12);
      col += silver*exp(-sq((A.y - 0.5)*A.z/0.004))*smoothstep(0.15, 0.3, A.x)*smoothstep(0.92, 0.8, A.x)*0.3;
      lit += dots(s, 0.027, (1. - A.y)*A.z - 0.017, 0.0055)*smoothstep(0.08, 0.14, A.x)*smoothstep(0.97, 0.9, A.x);
      lit += dots(s + 0.011, 0.034, A.y*A.z - 0.014, 0.005)*smoothstep(0.2, 0.3, A.x)*smoothstep(0.94, 0.86, A.x)*0.8;
    } else {
      // the bow, its spine, bridge and pod: silver edges, an inner panel line, lights down the spine and along both edges, the bridge windows
      float e = -bowPlan(q), edge = smoothstep(0.013, 0.003, e);
      col += silver*(edge*(0.45 + 0.9*dif + 0.7*rim) + exp(-sq((e - 0.03)/0.0045))*step(-0.12, p.y)*0.3) + vec3(0.6, 0.84, 1.)*lsk*(edge*1.6 + rim*0.12);
      lit += dots(p.y + 0.15, 0.034, w, 0.0055)*step(-0.14, p.y)*step(p.y, 0.76);
      lit += dots(p.y, 0.03, e - 0.016, 0.005)*step(0.02, p.y)*step(p.y, 0.7)*0.7;
      lit += dots(p.y + 0.017, 0.022, w, 0.008)*step(-0.03, p.y)*step(p.y, 0.08)*step(p.x, -0.03)*1.5;
    }
    // (the fold drive spooling up: pulses of light run along the rows of lights in toward the heart)
    lit *= 1. + spool*1.5*pow(0.5 + 0.5*sin(length(q - vec2(-0.3, 0.))*40. + tm*14.), 6.);
    col += ice*lit*(2.3 + 0.6*sin(tm*1.3 + p.y*9.))*(0.85 + 0.15*hp);
    // skimming: the needle glows with the gas it rams through
    col += uP3.rgb*uP1.w*pow(max(n.y, 0.), 2.)*(1.2 + 0.8*noise(p*40. + tm*3.));
#if FOLD > 0
    // the fold: a cell about to go (or just back) burns from within, from a blue glow to white-hot; the walls of the holes burn too
    if(uM0[0].y != 0. && (id < 1.5 || id > 2.5)){
      float cs = uM0[2].x; ivec2 c = ivec2(floor(p.yz/cs)); float fe = thrC(c) - uM0[0].x;
      float heat = 1. - smoothstep(0., RIMW, fe), fk = 0.7 + 0.6*hash12(vec2(c) + floor(tm*14.)*vec2(1.7, 3.1));
      float edge = smoothstep(-0.35*cs, 0., gc0);
      // (close to the camera a cell covers many characters: it burns dimmer there, so it never becomes a white patch)
      fk *= mix(0.3, 1., smoothstep(14., 4., cs/(uPix*t)));
#if FOLD == 2
      vec3 hot = mix(vec3(0.35, 0.5, 1.), vec3(2.7, 2.6, 2.4), heat*heat*heat);
#elif FOLD == 3
      vec3 hot = mix(vec3(0.3, 0.75, 1.), vec3(2.2, 2.8, 3.2), heat*heat*heat);
#else
      vec3 hot = mix(vec3(0.3, 0.48, 1.), vec3(2.4, 2.7, 3.1), heat*heat*heat);
#endif
      col = mix(col, hot*fk, smoothstep(0., 0.55, heat)) + mix(vec3(0.35, 0.55, 1.), vec3(1.6, 1.8, 2.1), heat)*edge*0.9*fk;
    }
#endif
    alpha = 1.;
  }
  float front = hit ? t : 1e9;
  // the halo: two dotted rings of light round the heart in the plane of the ship, turning slowly (faster as the fold drive spools up and as
  // the shield works), and chains of lights running from the heart to the claws of both arms and forward to the bow's neck. Under load a bead
  // of light runs out along the chains on each beat, from the heart toward the shield
  if(abs(d.x) > 0.01){
    float tp = -o.x/d.x;
    if(tp > 0. && tp < front && tp < hb.y){
      vec3 pp = o + d*tp; vec2 rq = vec2(pp.y - CORE.y, pp.z); float rr = length(rq), an = atan(rq.y, rq.x);
      float lw = max(0.0028, uPix*tp*0.7), k = 0.0028/lw;
#if FOLD > 0
      // (the rings and chains crumble with the cells they cross, flaring as they go)
      if(uM0[0].y != 0.){ float fe = thrC(ivec2(floor(pp.yz/uM0[2].x))) - uM0[0].x; k *= step(0., fe)*(1. + 2.5*(1. - smoothstep(0., RIMW, fe))); }
#endif
#if FOLD == 2
      // (B: the rings are drawn in toward the dark heart as it closes, and a whirl of light circles it in the ship's plane)
      float rs = 1. - 0.55*smoothstep(0., 0.8, uM0[1].z);
      if(uM0[1].y > 0.001){ float hA = uM0[1].y, rh = 0.038*(1. + 2.*uM0[2].y);
        float disc = hA*step(rh*1.15, rr)*exp(-(rr - rh)/0.1)*(0.4 + 0.6*pow(0.5 + 0.5*sin(an*2. - tm*11. + 50.*rr), 3.));
        col += mix(white, ice, smoothstep(rh, rh + 0.08, rr))*disc*k*2.2; }
#else
      const float rs = 1.;
#endif
      float a1 = an + uP0.w, a2 = an - 0.7*uP0.w;
      float r1 = exp(-sq((rr - 0.089*rs)/lw))*pow(0.5 + 0.5*cos(a1*48.), 5.);
      float r2 = exp(-sq((rr - 0.109*rs)/lw))*pow(0.5 + 0.5*cos(a2*60.), 5.)*smoothstep(-0.2, 0.4, sin(a2*3. + 0.6));
      vec2 cq = vec2(pp.y, abs(pp.z)), bz = sdBez(cq, vec2(-0.3, 0.036), vec2(-0.33, 0.11), vec2(-0.403, 0.176));
      float cw = exp(-bz.x*bz.x/(lw*lw)), nw = exp(-cq.y*cq.y/(lw*lw))*step(-0.262, cq.x)*step(cq.x, -0.19);
      float ch = cw*pow(0.5 + 0.5*cos(bz.y*6.2832*15. - tm*4.), 4.);
      float nk = nw*pow(0.5 + 0.5*cos((cq.x + 0.262)*6.2832/0.012 - tm*4.), 4.);
      float bead = load > 0.01 ? (cw*exp(-sq((bz.y - 1.2*bf)/0.1)) + nw*exp(-sq(((cq.x + 0.262)/0.072 - 1.2*bf)/0.25)))*2.5*load : 0.;
      col += ice*(r1*3.2 + r2*2.6 + ch*4.*(0.8 + 0.4*S) + nk*3. + bead)*k*rp;
    }
  }
  // the heart's glow and its churning corona (white and pale blue)
  vec2 ha = sphIsect(o, d, CORE, 0.12);
  if(ha.y > 0.){
    float a0 = max(ha.x, 0.), a1 = min(ha.y, front), dt = (a1 - a0)/10.;
    vec3 acc = vec3(0.);
    for(int i=0;i<10;i++){
      vec3 qq = o + d*(a0 + dt*(float(i) + 0.5)) - CORE; float r = length(qq);
      float sw = fbm3(qq*30. + vec3(tm*0.5, -tm*0.8, tm*0.3));
      acc += mix(white, ice, smoothstep(0.04, 0.09, r))*exp(-r/(0.016 + 0.01*hp))*(0.4 + 1.3*sw*sw)*smoothstep(0.12, 0.06, r);
    }
    col += acc*max(dt, 0.)*7.*hp*HDARK;
  }
  col += vec3(0.92, 0.96, 1.)*(blob(o, d, CORE, 0.05)*1.6 + blob(o, d, CORE, 0.13)*0.08)*hp*(1. - alpha*0.5)*HDARK;
#if FOLD > 0
  // the heart's flare in a fold (a flash as the shield folds into it, as it winks out and opens again; B's dark heart flares in its ring instead)
  col += vec3(0.9, 0.96, 1.)*blob(o, d, CORE, 0.022 + 0.03*uM0[0].z)*uM0[0].z*6.*HDARK;
#endif
#if FOLD == 2
  // (B: a thin ring of light hugs the dark heart, like the photon ring round a black hole)
  if(uM0[1].y > 0.001){ float hA = uM0[1].y, rh = 0.038*(1. + 2.*uM0[2].y); vec3 oc = CORE - o; float tc = dot(oc, d), b = length(oc - d*tc);
    if(tc > rh*2. && tc - rh*1.5 < front) col += vec3(0.95, 0.97, 1.)*exp(-sq((b - rh*1.3)/max(uPix*tc*0.9, 0.0025)))*hA*(1.4 + 0.4*sin(tm*13.) + 1.5*uM0[0].z); }
#endif
  // surges: sparks leap from the heart to its rings (more often while the shield works hard)
  if(S > 0.02){
    float k = floor(tm/2.3);
    for(int a=0;a<4;a++){
      float fa = float(a), an = hash12(vec2(k, fa))*6.2832;
      vec3 dir = normalize(vec3((hash12(vec2(fa, k + 3.)) - 0.5)*0.5, cos(an), sin(an)));
      for(int j=1;j<8;j++){
        float s = float(j)/8.;
        vec3 jit = vec3(noise(vec3(s*7., fa, tm*25.)), noise(vec3(s*7. + 3., fa, tm*25.)), noise(vec3(s*7. + 6., fa, tm*25.))) - 0.5;
        col += mix(white, ice, s)*lamp(o, d, CORE + dir*0.1*s + jit*0.03*sin(3.1416*s), 0.003, front)*55.*S*HDARK;
      }
    }
  }
  // the engines: a plume and a dotted exhaust trail streaming aft from each (fading before the edge of the bounding sphere); blinking lights
  // on the claws and the shoulders, the bow's neck, a node on the outer ring and the needle's beacon. At light speed the engines burn
  // brighter and a small star sits on the needle's tip.
  float tk = 1. + spool + S + 1.5*ls + load;
  for(int k=0;k<2;k++){
    float sg = k == 0 ? 1. : -1.;
    vec3 nz = vec3(lift(0.29), -0.857, 0.287*sg);   // (just behind the nacelle's end cap)
    float lv = liveAt(nz), lc = liveAt(vec3(0., -0.403, 0.176*sg)), lsh = liveAt(vec3(0., -0.043, 0.108*sg));   // (in a fold: a light goes with its cell)
    col += lv*jet(o - nz, d, vec3(0., -1., 0.), 0.1, 0.007, 0.018, 0.6, tm*5. + sg, vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(2. + 3.*spool + 4.*ls + 2.5*load);
    col += mix(white, ice, 0.4)*lamp(o, d, nz, 0.008, front)*40.*tk*lv;
    for(int j=1;j<5;j++){ float fj = float(j); col += lv*ice*lamp(o, d, nz + vec3(0., -0.02*fj, 0.), 0.0035, front)*(10. - 1.8*fj)*tk*(0.7 + 0.3*sin(tm*9. - fj*1.7)); }
    col += lc*white*lamp(o, d, vec3(lift(0.176), -0.403, 0.176*sg), 0.006, front)*22.*(0.5 + 0.5*pow(0.5 + 0.5*sin(tm*1.7 + sg), 4.));
    col += lsh*white*lamp(o, d, vec3(0., -0.043, 0.108*sg), 0.005, front)*16.*(0.55 + 0.45*pow(0.5 + 0.5*sin(tm*1.3 - sg*0.8), 6.));
  }
  col += white*lamp(o, d, vec3(0., -0.19, 0.), 0.005, front)*14.*liveAt(vec3(0., -0.19, 0.));
  col += white*lamp(o, d, vec3(0., -0.409, 0.), 0.005, front)*12.*liveAt(vec3(0., -0.409, 0.));
  float ltip = liveAt(vec3(0., 0.82, 0.));
  col += vec3(0.8, 0.95, 1.)*lamp(o, d, vec3(0., 0.845, 0.), 0.005, front + 0.01)*25.*pow(0.5 + 0.5*sin(tm*1.9), 12.)*ltip;
  if(ls > 0.01){
    col += vec3(0.85, 0.94, 1.)*lamp(o, d, vec3(0., 0.855, 0.), 0.016, front + 0.03)*120.*ls*ltip;
    // (and the sheen along the edges where the hull meets the sky: a thin line of light hugging its outline)
    if(!hit){ vec3 pa = o + d*amT; col += vec3(0.6, 0.84, 1.)*ls*(0.15 + 0.85*sq(smoothstep(-0.9, 0.85, pa.y)))*exp(-max(am, 0.)/max(0.9*uPix*amT, 0.002))*0.9; }
  }
  // the working lights on the belly pod (scan array, tractor emitter, probe bay) and at the needle's tip (the gun, also lit by the drill);
  // the scoop's plasma sheath round the needle
  col += vec3(0.45, 0.9, 1.)*lamp(o, d, vec3(0.066, 0.2, 0.), 0.01, front + 0.02)*45.*uP2.x;
  col += vec3(0.5, 1., 0.75)*lamp(o, d, vec3(0.07, -0.02, 0.), 0.011, front + 0.02)*45.*uP2.y;
  col += vec3(1., 0.8, 0.55)*pblob(o, d, vec3(0., 0.85, 0.), 0.014)*55.*uP2.z;
  col += vec3(0.6, 0.83, 1.)*lamp(o, d, vec3(0.064, -0.1, 0.), 0.009, front + 0.02)*35.*uP2.w;   // (the bay Pip, the drone, lives in: ice blue)
  if(uP1.w > 0.01) col += uP3.rgb*(blob(o, d, vec3(0., 0.74, 0.), 0.1)*5. + pblob(o, d, vec3(0., 0.85, 0.), 0.02)*30.)*uP1.w;
#if SHIELD == 0
  // (no shield: the fold drive's spool lights a round shell as before)
  vec2 hf = sphIsect(o, d, vec3(0.), 0.92);
  if(hf.y > 0. && spool > 0.){ vec3 qn = normalize(o + d*max(hf.x, 0.)); col += vec3(0.5, 0.85, 1.)*pow(1. - abs(dot(qn, d)), 3.)*spool*1.3*shk*(0.7 + 0.3*noise(qn*9. + tm)); }
#else
  // under load the hull's outline glows, at any size (on a phone the fine detail is too small to show; this is what flares there)
  if(!hit && SHIELD != 2){ float gw = max(1.6*px0, 0.012); col += shc*flare*exp(-max(am, 0.)/gw)*(1. - 0.85*sv)*0.9; }
#endif
#if SHIELD == 1
  // A, the outline: a fine silver-blue line just outside the hull (about one character out), with a faint shimmer and two glints running
  // round it. Under load it brightens most on the side facing the pull, and waves of light run out from the heart along it on each beat.
  if(lnV > 0.001){
    vec3 pm = lnP; float id2; vec2 e = vec2(0.004, 0.);
    map(pm, id2); float g0 = gH; map(pm + e.xyy, id2); float gx = gH; map(pm + e.yxy, id2); float gy = gH; map(pm + e.yyx, id2); float gz = gH;
    vec3 nout = normalize(vec3(gx, gy, gz) - g0 + 1e-7);
    float ang = atan(pm.z, pm.y + 0.05), cg = cos(ang - (RM > 0 ? 0.3 : 0.9)*tm), glint = pow(cg*cg, 7.);
    float wave = exp(-sq((length(pm - CORE) - 1.3*bf)/0.08));
    float v = lnV*(sh*(0.55 + 0.45*noise(pm*30. + vec3(0., tm*0.7, 0.)))*(1. + 1.2*glint) + 2.5*wave*load*sv*damp)*(1. + 1.5*load*max(dot(nout, G), 0.));
    v *= 1. - smoothstep(0.95, 0.99, length(pm)/BOUND);
    col += mix(shc, uP3.rgb*1.4, uP1.w*smoothstep(0.25, 0.45, pm.y))*v;
  }
#endif
#if SHIELD == 2
  // B, the bubble: a see-through egg round the whole ship, faint except its rim, with ripples running out from the heart on each beat. Under
  // load its rim flares on the side facing the pull; skimming, its front glows with the gas like a bow shock.
  {
    const vec3 E = vec3(0.27, 1.1, 0.62), c0 = vec3(0., -0.02, 0.);
    // (in the egg's own units it is a unit sphere: disc = 1 - (how far off centre the ray passes)^2, so a small disc is the rim)
    vec3 oe = (o - c0)/E, de = d/E; float dl = length(de); de /= dl; float b = dot(oe, de), disc = b*b - dot(oe, oe) + 1.;
    if(disc > 0.){
      float sd = sqrt(disc), rim = exp(-disc/max(3.*px0/0.45, 0.03));
      for(int k=0;k<2;k++){
        float tb = (k == 0 ? -b - sd : -b + sd)/dl; if(tb < 0. || tb > front) continue;
        vec3 p = o + d*tb, n = normalize((p - c0)/(E*E)); float fr = pow(1. - abs(dot(n, d)), 4.);
        float wave = exp(-sq((length(p - CORE) - 1.3*bf)/0.07))*smoothstep(0.12, 0.5, tb);
        float v = rim*(sh*0.9*(1. + 0.8*load*max(dot(n, G), 0.)) + flare*(1. - 0.6*sv)) + fr*sh*0.12 + sh*0.25*wave*(0.35 + load);
        col += (shc*v + uP3.rgb*uP1.w*fr*pow(max(n.y, 0.), 2.)*2.)*(k == 0 ? 1. : 0.45);
      }
    }
  }
#endif
#if SHIELD == 3
  // C, the honeycomb: a skin of small cells a little outside the hull, nearly invisible until a wave of lit cells runs out from the heart on
  // each beat; at rest a few cells twinkle and a faint rim keeps the shape. Under load the cells facing the pull stay lit.
  for(int k=0;k<2;k++){
    float te = k == 0 ? tE0 : tE1; if(te < 0.) continue;
    vec3 pc = o + d*te; float id2; const vec2 kk = vec2(1., -1.); const float ee = 0.003;
    map(pc + kk.xyy*ee, id2); float b1 = gE; map(pc + kk.yyx*ee, id2); float b2 = gE; map(pc + kk.yxy*ee, id2); float b3 = gE; map(pc + kk.xxx*ee, id2); float b4 = gE;
    vec3 n = normalize(kk.xyy*b1 + kk.yyx*b2 + kk.yxy*b3 + kk.xxx*b4 + 1e-7);
    float cpx = CELL/(uPix*te), fr = pow(1. - abs(dot(n, d)), 3.)*smoothstep(0.12, 0.5, te);
    vec3 wt = n*n; wt /= wt.x + wt.y + wt.z;
    float cells = 0.;
    if(wt.x > 0.05) cells += wt.x*honey(pc.yz, pc.x, 0, cpx, bf, load, n, G, tm);
    if(wt.z > 0.05) cells += wt.z*honey(pc.yx, pc.z, 1, cpx, bf, load, n, G, tm);
    if(wt.y > 0.05) cells += wt.y*honey(pc.xz, pc.y, 2, cpx, bf, load, n, G, tm);
    cells *= smoothstep(0.12, 0.5, te);
    float v = sh*(cells*1.6 + 0.18*fr*(1. + 2.*load)) + flare*fr*0.3;
    col += mix(shc, uP3.rgb*1.4, uP1.w*smoothstep(0.25, 0.45, pc.y))*v*(k == 0 ? 1. : 0.4);
  }
#endif
  outCol(col, alpha);
}`;

// ---------------------------------------------------------------- the shield's look (made up, like the ship): A outline, B bubble, C honeycomb, or none.
// For the review it is picked once from the address (?shield=a|b|c|off, A when not given); keys 1 2 3 0 switch it while that is in the address.
const SHIELD_LOOKS = { off:0, a:1, b:2, c:3 }, SHIELD_NAMES = ['no shield', 'shield A · outline', 'shield B · bubble', 'shield C · honeycomb'];
const SHIELD_BOUND = [1, 1.1, 1.2, 1.1];   // the sphere the ship is drawn in, in ship radii (the shield reaches past the hull's own)
const SHIELD_Q = (new URLSearchParams(location.search).get('shield') || '').toLowerCase();
// ---------------------------------------------------------------- the fold's look (made up, like the ship): A ember wind, B singularity, C streak-out.
// For the review it is picked once from the address (?fold=a|b|c, A when not given). The hull breaks up into cells; foldCellThr gives the page
// the same threshold per cell as thrC in the shader (the same front, the same integer hash), so an ember leaves each cell as the shader cuts it.
const FOLD_LOOKS = { a:1, b:2, c:3 }, FOLD_NAMES = ['', 'fold A · ember wind', 'fold B · singularity', 'fold C · streak-out'];
const foldLook = FOLD_LOOKS[(new URLSearchParams(location.search).get('fold') || '').toLowerCase()] || 1;
const FOLD_JIT = [0, 0.28, 0.16, 0.06][foldLook];
function foldF(y, z, mode){
  if (foldLook === 1) return mode > 0 ? (0.834 - y)/1.69 + 0.05*Math.sin(z*9 + y*4) : 1 - Math.hypot(y + 0.3, z)/1.14 + 0.05*Math.sin(z*9 - y*5);
  if (foldLook === 2) return 1 - Math.hypot((y + 0.3)*0.55, z)/0.62 + 0.04*Math.sin(z*11 + y*6);
  return (y + 0.86)/1.72 + 0.02*Math.sin(z*14);
}
function foldHash(ix, iz){
  let h = (Math.imul((ix + 1024) >>> 0, 0x8da6b343) + Math.imul((iz + 1024) >>> 0, 0xd8163841) + 0x9e3779b9) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h = (h ^ (h >>> 12)) >>> 0; h = Math.imul(h, 0x297a2d39) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return (h >>> 8)/16777216;
}
const foldCellThr = (ix, iz, mode, cs) => foldF((ix + 0.5)*cs, (iz + 0.5)*cs, mode) + FOLD_JIT*(foldHash(ix, iz) - 0.5);
const shipProgs = [];
const shipProg = v => shipProgs[v] || (shipProgs[v] = program(VS_RECT, COMMON + `#define SHIELD ${v}\n#define BOUND ${SHIELD_BOUND[v].toFixed(2)}\n#define RM ${reduceMotion ? 1 : 0}\n#define FOLD ${foldLook}\n#define FJIT ${FOLD_JIT.toFixed(3)}\n` + FS_SHIP_BODY));
let shieldLook = SHIELD_LOOKS[SHIELD_Q] ?? 1;
P.ship = shipProg(shieldLook);
const SHIP_TARGETS = ['earth', 'moon', 'jupiter', 'saturn', 'titan', 'sun', 'mars', 'sgra', 'betelgeuse', 'pillars', 'crab', 'etacar', 'catseye', 'hltau', 'omegacen', 'm87bh', 'andromeda',
  'm51', 'antennae', 'ton618', 'milkyway', 'antares', 'alphacen', 'trappist1', 'magnetar', 'sn1987a', 'galcentre', 'rsoph', 'europa', 'io', 'lmc', 'm104', '3c273', 'proxima', 'sirius', 'pleiades', 'casa', 'bubble', 'halley', 'ceres', 'southernring'];
// the ship itself. How it travels (light speed, folds) and what it does on each visit (scan, probe, weapons test, skim, tractor and drill) is in 07h-halo.js.
const shipOff = () => ship.viewOff || [0, 0, 0];
const ship = (() => {
  const RAD = 2.5*KM;
  // S: phase ('pass' | 'align' | 'light' | 'fold'), target (the body it is visiting: its parent), shader state (spool, ls light-speed sheen,
  // scale, scoop, ringPh the rings' turn, beat the heart's beat, load the shield's load and gDir the way the pull comes from), em (belly lights)
  // and the fold's look (07h-halo.js): dg the dissolve, dm its mode, hfl the heart's flare, shK the shield's share, sx the style's amount,
  // cc the collapse clock, cs the cells' size
  const S = { phase:'pass', t:0, target:null, spool:0, ls:0, scale:1, scoop:0, scoopC:[1, 0.6, 0.3], em:[0, 0, 0, 0], visits:0, ringPh:0, beat:0, load:0, gDir:[0, 1, 0],
    dg:0, dm:0, hfl:0, shK:1, sx:0, sy:0, cc:0, cs:0.03 };
  const M0 = new Float32Array(9);
  const o = addObj({ key:'halo', name:'the Halo', label:'Halo', labelClass:'ship', type:'long-range cruiser · a wandering starship that folds space', group:'travel', sortKey:0, layer:3,
    fact:'A long-range cruiser from a civilisation that learned to fold space. Seen from above it is a trident: a needle-shaped bow and two crescent arms sweeping back to the engines at their tips. Between the arms floats its heart, a captured ball of star plasma inside two rings of light. It hops between the wonders of the universe: light speed for short hops, a fold through space for long ones. On each visit it does one job: a sensor scan, a photo trip by Pip, its little drone, a weapons test, a skim through a gas giant or a star, or drilling a passing rock. (The Halo and Pip are the only made-up things in this atlas.)',
    // (seen from afar it is an engine glint; its hull fades in over a wide range of sizes, so flying up to it never pops it into view)
    pos:[0, 0, 0], rad:RAD, prog:P.ship, drawK:SHIELD_BOUND[shieldLook], minZoom:1.2, pxMin:3, visFn:rpx => smooth(1.5, 12, rpx), noImpostor:false, farColor:[0.55, 0.8, 1], farLum:0.7, labelRange:1, selfPos:true, aka:'ship starship spaceship ring halo follow trident crescent',
    // locked on, the camera always trails the ship (its frame turns with the ship: see the lock-follow in tick): from behind and a little above (low enough that it reads as flying straight on), lower and to one side, then wide from one side and above
    // (camera frame, camFrame: +y is up from the deck, +z is behind the stern)
    // (off: while it works on something below its belly, the camera aims a little below the ship, so the job shows beneath it)
    views:[{d:[0, 0.3, 1], k:2.5, hold:10, drift:0, off:shipOff}, {d:[0.62, 0.12, 1], k:2.1, hold:9, drift:0, off:shipOff}, {d:[-0.5, 0.5, 0.9], k:3.4, hold:9, drift:0, off:shipOff}],
    // (S.light: a fixed light in the ship's own frame, for the showcase and screenshots; otherwise the Sun lights it)
    setU(pr){ const L = S.light ? M3.apply(this.R0, V.norm(S.light)) : S.target ? V.norm(V.sub(sun.rel, this.rel)) : [0, 1, 0], c = S.scoopC, e = S.em;
      gl.uniform4f(pr.u.uP0, S.spool, S.ls, S.scale, S.ringPh); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], S.scoop); gl.uniform4f(pr.u.uP2, e[0], e[1], e[2], e[3]); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], S.beat);
      gl.uniform4f(pr.u.uP4, S.gDir[0], S.gDir[1], S.gDir[2], S.load);
      M0[0] = S.dg; M0[1] = S.dm; M0[2] = S.hfl; M0[3] = S.shK; M0[4] = S.sx; M0[5] = S.cc; M0[6] = S.cs; M0[7] = S.sy; gl.uniformMatrix3fv(pr.u.uM0, false, M0); },
    readout:() => haloReadout() });
  o.S = S;
  // the camera's frame for the ship: x = its starboard side, y = up from the deck (-x in the ship's own frame), z = behind the stern (-y).
  // It follows viewR, the ship's frame turned part of the way toward whatever the ship is working on, so a trailing camera keeps the job in the picture.
  const CAMQ = [0, 0, 1, -1, 0, 0, 0, -1, 0];
  o.camFrame = () => M3.mul(o.viewR || o.R0, CAMQ);
  // (drawK: the ship is drawn in a sphere this many times its radius, so the shield round it is not cut off)
  o.setShield = v => { if (!(v in SHIELD_NAMES)) return; shieldLook = v; o.prog = shipProg(v); progReady(o.prog, true); o.drawK = SHIELD_BOUND[v]; };
  return o;
})();
// review only: with ?shield= in the address, keys 1 2 3 0 and a small chip switch between the looks
if (SHIELD_Q){
  const chip = document.createElement('div'), pick = v => { ship.setShield(v); sync(); toast(SHIELD_NAMES[v]); };
  chip.className = 'shield-chip'; chip.setAttribute('aria-label', 'Shield look (review)');
  chip.innerHTML = 'shield ' + ['A', 'B', 'C', 'off'].map((n, i) => `<button type="button" data-v="${(i + 1) % 4}">${n}</button>`).join('');
  const sync = () => { for (const b of chip.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.v === shieldLook); };
  chip.addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.v); });
  document.body.appendChild(chip); sync();
  addEventListener('keydown', e => { if (e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input'))) return; const v = '0123'.indexOf(e.key); if (v >= 0) pick(v); });
}

// ---------------------------------------------------------------- comets: new visitors dropping in from the Oort cloud, with an ion tail and a curved dust tail
const comets = (() => {
  const MAX = 3, NT = 420, list = [];
  const ps = makePS(MAX*(NT + 1));
  let next = 4;
  const spawn = () => {
    const q = 0.35 + 1.2*rnd(), inc = rnd()*Math.PI, node = rnd()*6.283, w = rnd()*6.283;
    const Rm = M3.mul(M3.rotY(node), M3.mul(M3.rotX(inc), M3.rotY(w)));
    const U = new Float32Array(NT), Ev = new Float32Array(NT*3); for (let j=0;j<NT;j++){ U[j] = rnd(); const e = V.mul(randDir(), rndn()); Ev.set(e, j*3); }
    list.push({ q, R:M3.mul(ECL, Rm), nu:-2.2, speed:0.9 + 0.4*rnd(), bright:0.6 + 0.8*rnd(), age:0, U, Ev });
  };
  const o = addObj({ key:'comets', name:'comets', label:'', type:'', layer:3, parent:sun, offset:[0, 0, 0], pos:[0, 0, 0], rad:3*AU_LY, noPick:true, noLabel:true, noImpostor:true, atlas:false,
    particleVis:() => 1,
    update(dt){
      next -= dt; if (next < 0 && list.length < MAX){ spawn(); next = 12 + rnd()*14; }
      let k = 0;
      for (let i=list.length - 1; i>=0; i--){
        const c = list[i]; c.age += dt;
        // parabolic orbit: r = 2q/(1 + cos nu), true anomaly advanced with a compressed clock
        const r = 2*c.q/(1 + Math.cos(c.nu)); c.nu += dt*c.speed*0.06*Math.pow(c.q/r, 1.5)*Math.sqrt(2)*3;
        if (c.nu > 2.3){ list.splice(i, 1); continue; }
      }
      for (const c of list){
        const r = 2*c.q/(1 + Math.cos(c.nu));
        const pl = M3.apply(c.R, [r*Math.cos(c.nu), 0, -r*Math.sin(c.nu)]), p = V.mul(pl, AU_LY);
        const vdir = V.norm(V.sub(M3.apply(c.R, [2*c.q/(1 + Math.cos(c.nu + 0.01))*Math.cos(c.nu + 0.01), 0, -2*c.q/(1 + Math.cos(c.nu + 0.01))*Math.sin(c.nu + 0.01)]), pl));
        const anti = V.norm(p), act = clamp(1.6/(r*r), 0, 3)*c.bright, len = Math.min(0.4*act + 0.04, 0.9)*AU_LY;
        ps.a.set([p[0], p[1], p[2], 1.5 + act], k*4); ps.c.set([0.85, 0.95, 1, 0], k*4); k++;
        for (let j=0;j<NT;j++){
          const u = (c.U[j] + c.age*0.08*(j % 2 ? 1 : 0.6)) % 1, ion = j % 3 === 0;
          let q;
          if (ion) q = V.add(p, V.mul(anti, u*len*1.3));
          else { const bend = u*u*0.45; q = V.add(p, V.add(V.mul(anti, u*len*0.8), V.mul(vdir, -bend*len))); }
          const sc = (ion ? 0.004 : 0.012)*len*(0.3 + u*2);
          q = [q[0] + c.Ev[j*3]*sc, q[1] + c.Ev[j*3 + 1]*sc, q[2] + c.Ev[j*3 + 2]*sc];
          const b = ((1 - u)*(ion ? 0.8 : 1)*act + 0.05)*0.9;
          ps.a.set([q[0], q[1], q[2], b], k*4); ps.c.set(ion ? [0.45, 0.7, 1, 0] : [1, 0.88, 0.62, 0], k*4); k++;
        }
      }
      ps.count = k; if (k) ps.upload('ac');
    },
    particles:[{ ps, prog:'ptBasic', mode:3, sb:0.6, size:1.6, rad:1, rot:() => I3, show:() => ps.count > 0, vis:() => smooth(2e-6, 2e-5, orbit.dist)*(1 - smooth(0.004, 0.03, orbit.dist)) }] });
  o.list = list;
  return o;
})();

// ---------------------------------------------------------------- the Sun seen from the planets: at its true size it is a small disc there (about 1% of the screen from Earth),
// so it gets a soft round glare: a tight bright glow hugging the disc and a much fainter, wider halo around it (no rays, so the
// Sun stays round). It fades as its disc grows large enough to speak for itself, and when a planet or moon moves in front of it
// (sun.occ, from updateSunOcc). The same glow marks Alpha Centauri B seen from beside A (the brightest star in A's sky).
const glowPS = makePS(1); glowPS.a.set([0, 0, 0, 1], 0); glowPS.c.set([1, 0.88, 0.68, 0], 0); glowPS.upload('ac');
function glare(o, a, k){
  if (a < 0.01) return;
  drawParticles(null, { ps:glowPS, prog:'ptBasic', mode:3, sb:a*1.8, size:9*k, rad:1, rel:() => o.rel, rot:() => I3 });
  drawParticles(null, { ps:glowPS, prog:'ptBasic', mode:3, sb:a*0.42, size:34*k, rad:1, rel:() => o.rel, rot:() => I3 });
}
EXTRAS.push(() => {
  if (SKYV.on) return;
  const S = sun, d = S.dist;
  if (!S.hidden && d > 0 && V.dot(S.rel, cam.fwd) > 0){
    const rpxS = coreOf(S)*magOf(S)/d*(sceneH*0.5/tanY);
    glare(S, (1 - smooth(12, 45, rpxS))*(1 - smooth(60*AU_LY, 600*AU_LY, d))*(1 - SYSMAG.k)*(S.occ ?? 1), 1);
  }
  const B = alphaCenB;
  if (orbit.lock === alphaCen.index && B.dist > 0 && V.dot(B.rel, cam.fwd) > 0 && B.dist < 60*AU_LY) glare(B, 0.8*(1 - smooth(8, 30, B.rpx || 0)), 0.7);
});

// ---------------------------------------------------------------- meteors burning up in Earth's atmosphere, and distant gamma-ray bursts
const meteorPS = makePS(12), grbPS = makePS(1), grbSp = makeSpikes([{ p:[0, 0, 0], w:1, c:[0.85, 0.9, 1] }]);
const transient = { meteors:[], mNext:2, grb:null, gNext:10 };
EXTRAS.push(() => {
  const dt = 1/60*timeScale, E = earth;
  // meteors: only worth drawing when Earth is close and large on screen
  transient.mNext -= dt;
  if (E.rpx > 60 && E.dist < E.rad*8){
    if (transient.mNext < 0){ transient.mNext = 1.5 + rnd()*3; const n = V.norm(randDir()), side = V.norm(V.cross(n, randDir())); transient.meteors.push({ n, side, t:0, dur:0.7 + 0.5*rnd() }); }
    let k = 0;
    for (let i=transient.meteors.length - 1; i>=0; i--){ const m = transient.meteors[i]; m.t += dt; if (m.t > m.dur){ transient.meteors.splice(i, 1); continue; }
      const u = m.t/m.dur, R = E.rad*0.893*(1.018 - 0.01*u), a = V.add(V.mul(m.n, R), V.mul(m.side, E.rad*0.05*u)), b = V.add(a, V.mul(m.side, -E.rad*0.02));
      meteorPS.a.set([a[0], a[1], a[2], 1], k*8); meteorPS.a.set([b[0], b[1], b[2], 0], k*8 + 4); meteorPS.c.set([1, 0.9, 0.7, 0], k*8); meteorPS.c.set([1, 0.6, 0.3, 0], k*8 + 4); k++; }
    if (k){ meteorPS.count = k*2; meteorPS.upload('ac'); drawParticles(null, { ps:meteorPS, prog:'lnBasic', lines:true, mode:3, sb:1.4, size:1, rad:1, rel:() => E.rel, rot:() => I3, count:() => k*2 }); }
  }
  // gamma-ray bursts: a star collapsing or neutron stars merging, billions of light-years away, visible for a moment
  transient.gNext -= dt;
  if (!transient.grb && transient.gNext < 0 && orbit.dist > 3e6){ const d = randDir(); transient.grb = { p:V.mul(d, 5e9 + 2e10*rnd()), t:0 }; }
  if (transient.grb){ const g = transient.grb; g.t += dt; const amp = g.t < 0.15 ? g.t/0.15 : Math.exp(-(g.t - 0.15)/0.9);
    if (g.t > 4){ transient.grb = null; transient.gNext = 12 + rnd()*20; }
    else { const rel = V.sub(V.sub(g.p, earth.pos), V.sub(cam.rel, frel(earth))); grbPS.a.set([0, 0, 0, 1], 0); grbPS.c.set([0.9, 0.93, 1, 0], 0); grbPS.upload('ac');
      if (V.dot(rel, cam.fwd) > 0){ drawParticles(null, { ps:grbPS, prog:'ptBasic', mode:3, sb:amp*2.2, size:4, rad:1, rel:() => rel, rot:() => I3 });
        drawParticles(null, { ps:grbSp, prog:'spike', lines:true, mode:1, sb:1, size:1, len:0.05, rad:1, rel:() => rel, rot:() => I3, q0:() => [amp*1.5, 0, 0, 0] }); } } }
});

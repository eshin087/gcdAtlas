
// ================================================================ travellers and transients: the Halo (a starship that folds space), comets, meteors, gamma-ray bursts
// (the shared random seed once every object exists: the Halo's route and all that follows draw from here, so a pack that uses rnd() and
// forgets to put the seed back changes them; the smoke test checks this value)
const SEED_OBJECTS = seed;
// ---------------------------------------------------------------- the Halo: a long-range cruiser shaped like a trident, its star-heart held between two crescent arms (local: bounding sphere 1, +y = forward)
// RM is 1 in its shader when the visitor asked for reduced motion.
const FS_SHIP_BODY = `
// the Halo (0.8.2, drawn after the owner's concept art): an original long-range cruiser. Local frame: bounding sphere 1, forward +y (the needle's
// tip at +0.834), dorsal side -x, belly +x toward what it studies, span along z. From above it is a trident: a needle-shaped bow, and two crescent
// arms sweeping back from its shoulders to the engines at their tails. Between the arms floats its heart, a captured ball of star plasma inside
// two dotted rings of light (the halo of its name), wired to the claws of the arms and to the bow by chains of lights. Black hull, silver edges,
// rows of small blue-white lights. The heart surges now and then, throwing sparks at its rings.
// ZI: 0, but only known when the shader runs (the page sets uM0[2].z to 0). Loops start from it so the compiler cannot unroll them: on Windows
// (ANGLE on Direct3D) every unrolled copy of map() and of the noise loops was compiled separately, and a shield look with more of them took
// 5.4 to 6.1 s to compile on a fast desk CPU, long enough on a slower one for Chrome to reset the GPU. Each loop body is compiled once.
#define ZI int(uM0[2].z)
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
// set by map() as it goes: the distance to the hull without the heart (gH; the shield's outline goes round the hull, not the heart, whose
// outline would sit on the inner ring)
float gH = 1e9;
// the fold (ember wind): the hull breaks up into square cells in the ship's plane (y, z), each about one
// character on screen (uM0[2].x wide, chosen by the page as the break-up starts). A cell is gone while the dissolve g (uM0[0].x) is past its
// threshold: a smooth front (foldF, no noise, so the march stays safe) plus a random share per cell from an integer hash. The page works out
// the same thresholds (foldCellThr in JS) to send an ember off each cell as it goes. The cut is part of map(), so the shield's outline and
// cells crumble with the hull. uM0: column 0 (g, mode: 1 leaving, -1 arriving, 0 whole; the heart's flare), column 1 (the shield's share),
// column 2 (the cell's size, then ZI's 0)
float gC = -1.;   // (set by map: signed distance in the plane to the cells still there, negative inside them)
const float FL = 1.8, RIMW = 0.1, FJIT = 0.28;
uint hsh(ivec2 c){ uvec2 u = uvec2(c + 1024); uint h = u.x*0x8da6b343u + u.y*0xd8163841u + 0x9e3779b9u; h ^= h >> 15u; h *= 0x2c1b3c6du; h ^= h >> 12u; h *= 0x297a2d39u; h ^= h >> 15u; return h; }
float cRnd(ivec2 c){ return float(hsh(c) >> 8u)*(1./16777216.); }
// the front, q = (y, z): low where the hull goes first (or comes back last). Its slope is at most FL.
float foldF(vec2 q){
  if(uM0[0].y > 0.) return (0.834 - q.x)/1.69 + 0.05*sin(q.y*9. + q.x*4.);            // leaving: from the needle's tip aft
  return 1. - length(vec2(q.x + 0.3, q.y))/1.14 + 0.05*sin(q.y*9. - q.x*5.);          // arriving: from the heart outward
}
float thrC(ivec2 c){ return foldF((vec2(c) + 0.5)*uM0[2].x) + FJIT*(cRnd(c) - 0.5); }
float cellD(vec2 q){
  float cs = uM0[2].x, g = uM0[0].x; vec2 cf = q/cs; ivec2 c = ivec2(floor(cf)); vec2 f = (cf - vec2(c))*cs;
  bool me = thrC(c) > g; float best = 1e9;
  for(int n=ZI;n<9;n++){
    int i = n - 3*(n/3) - 1, j = n/3 - 1;
    if(i == 0 && j == 0) continue;
    if((thrC(c + ivec2(i, j)) > g) != me){ vec2 lo = vec2(float(i), float(j))*cs, dd = max(max(lo - f, f - lo - cs), 0.); best = min(best, length(dd)); }
  }
  if(me) return -min(best, cs);
  // (a gone cell: at least as far as the nearest live cell beside it, or out of the 3 x 3 block; far behind the front, as far as the slope allows)
  float edge = min(min(f.x, cs - f.x), min(f.y, cs - f.y));
  return max(min(best, cs + edge), (g - foldF(q) - 0.5*FJIT)/FL - 0.71*cs);
}
float liveAt(vec3 c){ if(uM0[0].y == 0.) return 1.; return step(uM0[0].x, thrC(ivec2(floor(c.yz/uM0[2].x)))); }
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
  // (the fold's holes, cut only near the hull)
  gC = -1.;
  if(uM0[0].y != 0.){ float hm = min(min(bow, det), min(arm, nac)); if(hm < 2.5*uM0[2].x){ gC = cellD(p.yz); bow = max(bow, gC); det = max(det, gC); arm = max(arm, gC); nac = max(nac, gC); } }
  float core = length(p - CORE) - 0.038;
  gH = min(min(bow, det), min(arm, nac));
  float d = bow; id = 0.;
  if(det < d){ d = det; id = 4.; }
  if(arm < d){ d = arm; id = 1.; }
  if(nac < d){ d = nac; id = 3.; }
  if(core < d){ d = core; id = 2.; }
  return d;
}
// (the hull's normal and the outline's search sample map() from one loop in main(), so it is compiled twice in all: there and in the march)
vec3 axisV(int a){ return vec3(a == 0 ? 1. : 0., a == 1 ? 1. : 0., a == 2 ? 1. : 0.); }
// a small light, hidden when the hull is in front of it (front: how far along the ray the hull is)
float lamp(vec3 o, vec3 d, vec3 c, float s, float front){ return dot(c - o, d) < front ? pblob(o, d, c, s) : 0.; }
// a row of dots: position along the row, spacing, distance from the row's line, dot radius
float dots(float x, float sp, float y, float r){ float c = (fract(x/sp) - 0.5)*sp; return exp(-(c*c + y*y)/(r*r)); }
// the uniforms (one map for the ship; the page sets them in setU below):
// uP0: x fold-drive spool, y light-speed sheen, z scale (1; it shrinks to a point as it folds away and grows back on arrival), w how far the rings have turned
// uP1: xyz light direction, w ram-scoop glow   uP2: glow of the scan array, tractor emitter, bow gun / drill, probe bay
// uP3: rgb the scoop's colour, w the heart's beat (its phase: one beat per unit)   uP4: xyz toward what pulls on the ship (world axes), w the shield's load
// uM0: the fold: column 0 (dissolve g, mode, the heart's flare), column 1 (shield share), column 2 (cell size, ZI)
void main(){
  vec3 o, d; localRay(o, d);
  o /= max(uP0.z, 0.01);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float spool = uP0.x, ls = uP0.y, tm = uTime, S = surge(tm);
  // the heart beats (a double beat) and pumps harder the more the shield has to hold. Its own glow never grows past hp (so it never becomes a
  // white ball); the rings and the chains take the rest
  // (at light speed the shield lets go of the load at once: the stop the ship left is far behind)
  float load = uP4.w*(1. - smoothstep(0.1, 0.3, ls)), bf = fract(uP3.w), beat = exp(-9.*bf) + 0.6*exp(-9.*max(bf - 0.2, 0.))*step(0.2, bf);
  // (px0: a scene pixel at the ship, in ship radii. At light speed the lights that flare up (the star on the needle's tip, the engines, the
  // heart) are toned down on a small ship: one bright pixel spreads into a wide glow, a white haze over the whole ship on a phone)
  float px0 = uPix*length(o), lsK = ls*(1. - 0.7*smoothstep(0.012, 0.045, px0));
  float power = 1. + spool*1.6 + S*2. + 0.6*lsK + load*(0.5 + 1.5*beat), hp = min(power, 2.2), rp = min(power, 4.5);
  vec3 L = normalize(uP1.xyz*uRot), G = uP4.xyz*uRot; G /= max(length(G), 1e-6);
  vec3 ice = vec3(0.6, 0.83, 1.), silver = vec3(0.85, 0.9, 1.), white = vec3(1.), shc = vec3(0.55, 0.8, 1.);
  // the shield: barely there at rest (0.9.3, owner: subtle, not an easy-to-see border), a slow glint running round it now and then (in the
  // outline below), charging a little with the fold drive, and bright only under a strong pull: at the closest point of a black-hole pass,
  // flickering there (damped with reduced motion). Its fine detail only shows where the ship is big enough on screen (sv); the line that flares
  // under load shows at any size. From the bridge the camera is inside it: each part fades out only right beside the camera (by how far along
  // the ray it is), so the rest flares there as it does outside. None of it at light speed.
  float sv = smoothstep(0.07, 0.05, px0);
  float fl = RM > 0 ? 0.3*(noise(vec3(tm*1.5, 3.1, 7.7)) - 0.5) : noise(vec3(tm*8., 3.1, 7.7)) - 0.5;
  float sh = sv*(0.06 + 1.6*load + 0.45*spool)*(1. + 0.8*load*load*fl), flare = load*(0.35 + 0.65*beat);
  // (in a fold the shield folds into the heart before the hull breaks up, and forms again after it has come back together)
  float shk = uM0[1].x; sh *= shk; flare *= shk;
  float t = max(hb.x, 0.), id = 0.; bool hit = false;
  // while marching: the ray's closest pass by the hull (am, and where along the ray, amT), for the outline
  float am = 1e9, amT = 0.;
  if(hb.y > 0.){
    for(int i=ZI;i<150;i++){ vec3 p = o + d*t; float h = map(p, id); if(h < 0.0005) { hit = true; break; }
      float g = gH; if(g < am){ am = g; amT = t; }
      t += h*0.8; if(t > hb.y) break; }
  }
  float gc0 = gC;   // (at the hit: how far to the nearest hole)
  // every other sample of map() in one loop (see ZI), each part only when it is needed: the hull's normal where the ray hits it (6 samples);
  // for the outline the ray's closest pass by the hull between two march steps, found exactly (a search of 4 rounds of two, and the closest
  // pass sampled once more: 9), and the hull's gradient there (4)
  // (the march only samples the ray every 0.8 of the distance to the hull: the line stays unbroken up close)
  float DL = clamp(1.2*px0, 0.03, 0.06);
  bool doL = !hit && am < 3.*DL && shk > 0.001;
  const int NT = 19;
  vec3 nH = vec3(0.); vec4 gL = vec4(0.);
  float am0 = am, amT0 = amT, lo = max(amT - 0.9*am, 0.), hi = amT + 0.9*am, g1 = 0.;   // (am0, amT0: as the march left them, for the flare line)
  for(int i=ZI;i<NT;i++){
    vec3 q; float m = 0.;
    if(i < 6){ if(!hit) continue; q = o + d*t + axisV(i/2)*(i - 2*(i/2) == 0 ? 0.0012 : -0.0012); }
    else { if(!doL) continue;
      if(i < 15){ int k = i - 6; m = k == 8 ? 0.5*(lo + hi) : mix(lo, hi, k - 2*(k/2) == 1 ? 0.6 : 0.4); q = o + d*m; }
      else q = o + d*amT + (i == 15 ? vec3(0.) : axisV(i - 16)*0.004); }
    float id2, v = map(q, id2);
    if(i < 6) nH[i/2] += i - 2*(i/2) == 0 ? v : -v;
    else if(i < 15){ int k = i - 6; if(k == 8){ if(gH < am){ am = gH; amT = m; } } else if(k - 2*(k/2) == 0) g1 = gH; else if(g1 < gH) hi = m; else lo = mix(lo, hi, 0.4); }
    else gL[i - 15] = gH;
  }
  vec3 col = vec3(0.); float alpha = 0.;
  if(hit){
    vec3 p = o + d*t, n = normalize(nH), A;
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
    } else if(id > 2.5 && id < 3.5){
      float xe0 = lift(0.29);
      // nacelles: dark, with a silver ring and a glowing nozzle facing aft
      float noz = smoothstep(-0.8, -0.832, p.y)*max(-n.y, 0.);
      col += silver*exp(-sq((p.y + 0.775)/0.008))*1.6 + ice*noz*3.5*(1. + spool + S + 1.5*lsK + load) + ice*dots(p.y, 0.03, abs(p.x - xe0) - 0.017, 0.006)*step(-0.76, p.y)*step(p.y, -0.64)*1.6;
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
    // (the fold drive spooling up: pulses of light run along the rows of lights in toward the heart; under load they beat with the heart, so
    // its work shows from every camera, the bridge too)
    lit *= 1. + spool*1.5*pow(0.5 + 0.5*sin(length(q - vec2(-0.3, 0.))*40. + tm*14.), 6.) + 1.2*load*beat;
    col += ice*lit*(2.3 + 0.6*sin(tm*1.3 + p.y*9.))*(0.85 + 0.15*hp);
    // skimming: the needle glows with the gas it rams through
    col += uP3.rgb*uP1.w*pow(max(n.y, 0.), 2.)*(1.2 + 0.8*noise(p*40. + tm*3.));
    // the fold: a cell about to go (or just back) burns from within, from a blue glow to white-hot; the walls of the holes burn too
    if(uM0[0].y != 0. && (id < 1.5 || id > 2.5)){
      float cs = uM0[2].x; ivec2 c = ivec2(floor(p.yz/cs)); float fe = thrC(c) - uM0[0].x;
      float heat = 1. - smoothstep(0., RIMW, fe), fk = 0.7 + 0.6*hash12(vec2(c) + floor(tm*14.)*vec2(1.7, 3.1));
      float edge = smoothstep(-0.35*cs, 0., gc0);
      // (close to the camera a cell covers many characters: it burns dimmer there, so it never becomes a white patch)
      fk *= mix(0.3, 1., smoothstep(14., 4., cs/(uPix*t)));
      vec3 hot = mix(vec3(0.3, 0.48, 1.), vec3(2.4, 2.7, 3.1), heat*heat*heat);
      col = mix(col, hot*fk, smoothstep(0., 0.55, heat)) + mix(vec3(0.35, 0.55, 1.), vec3(1.6, 1.8, 2.1), heat)*edge*0.9*fk;
    }
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
      // (the rings and chains crumble with the cells they cross, flaring as they go)
      if(uM0[0].y != 0.){ float fe = thrC(ivec2(floor(pp.yz/uM0[2].x))) - uM0[0].x; k *= step(0., fe)*(1. + 2.5*(1. - smoothstep(0., RIMW, fe))); }
      float a1 = an + uP0.w, a2 = an - 0.7*uP0.w;
      float r1 = exp(-sq((rr - 0.089)/lw))*pow(0.5 + 0.5*cos(a1*48.), 5.);
      float r2 = exp(-sq((rr - 0.109)/lw))*pow(0.5 + 0.5*cos(a2*60.), 5.)*smoothstep(-0.2, 0.4, sin(a2*3. + 0.6));
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
    for(int i=ZI;i<10;i++){
      vec3 qq = o + d*(a0 + dt*(float(i) + 0.5)) - CORE; float r = length(qq);
      float sw = fbm3(qq*30. + vec3(tm*0.5, -tm*0.8, tm*0.3));
      acc += mix(white, ice, smoothstep(0.04, 0.09, r))*exp(-r/(0.016 + 0.01*hp))*(0.4 + 1.3*sw*sw)*smoothstep(0.12, 0.06, r);
    }
    col += acc*max(dt, 0.)*7.*hp;
  }
  col += vec3(0.92, 0.96, 1.)*(blob(o, d, CORE, 0.05)*1.6 + blob(o, d, CORE, 0.13)*0.08)*hp*(1. - alpha*0.5);
  // the heart's flare in a fold (a flash as the shield folds into it, as it winks out and opens again)
  col += vec3(0.9, 0.96, 1.)*blob(o, d, CORE, 0.022 + 0.03*uM0[0].z)*uM0[0].z*6.;
  // surges: sparks leap from the heart to its rings (more often while the shield works hard)
  if(S > 0.02){
    float k = floor(tm/2.3);
    for(int a=ZI;a<4;a++){
      float fa = float(a), an = hash12(vec2(k, fa))*6.2832;
      vec3 dir = normalize(vec3((hash12(vec2(fa, k + 3.)) - 0.5)*0.5, cos(an), sin(an)));
      for(int j=ZI+1;j<8;j++){
        float s = float(j)/8.;
        vec3 jit = vec3(noise(vec3(s*7., fa, tm*25.)), noise(vec3(s*7. + 3., fa, tm*25.)), noise(vec3(s*7. + 6., fa, tm*25.))) - 0.5;
        col += mix(white, ice, s)*lamp(o, d, CORE + dir*0.1*s + jit*0.03*sin(3.1416*s), 0.003, front)*55.*S;
      }
    }
  }
  // the engines: a plume and a dotted exhaust trail streaming aft from each (fading before the edge of the bounding sphere); blinking lights
  // on the claws and the shoulders, the bow's neck, a node on the outer ring and the needle's beacon. At light speed the engines burn
  // brighter and a small star sits on the needle's tip.
  float tk = 1. + spool + S + 1.5*lsK + load;
  for(int k=ZI;k<2;k++){
    float sg = k == 0 ? 1. : -1.;
    vec3 nz = vec3(lift(0.29), -0.857, 0.287*sg);   // (just behind the nacelle's end cap)
    float lv = liveAt(nz), lc = liveAt(vec3(0., -0.403, 0.176*sg)), lsh = liveAt(vec3(0., -0.043, 0.108*sg));   // (in a fold: a light goes with its cell)
    col += lv*jet(o - nz, d, vec3(0., -1., 0.), 0.1, 0.007, 0.018, 0.6, tm*5. + sg, vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(2. + 3.*spool + 4.*lsK + 2.5*load);
    col += mix(white, ice, 0.4)*lamp(o, d, nz, 0.008, front)*40.*tk*lv;
    for(int j=ZI+1;j<5;j++){ float fj = float(j); col += lv*ice*lamp(o, d, nz + vec3(0., -0.02*fj, 0.), 0.0035, front)*(10. - 1.8*fj)*tk*(0.7 + 0.3*sin(tm*9. - fj*1.7)); }
    col += lc*white*lamp(o, d, vec3(lift(0.176), -0.403, 0.176*sg), 0.006, front)*22.*(0.5 + 0.5*pow(0.5 + 0.5*sin(tm*1.7 + sg), 4.));
    col += lsh*white*lamp(o, d, vec3(0., -0.043, 0.108*sg), 0.005, front)*16.*(0.55 + 0.45*pow(0.5 + 0.5*sin(tm*1.3 - sg*0.8), 6.));
  }
  col += white*lamp(o, d, vec3(0., -0.19, 0.), 0.005, front)*14.*liveAt(vec3(0., -0.19, 0.));
  col += white*lamp(o, d, vec3(0., -0.409, 0.), 0.005, front)*12.*liveAt(vec3(0., -0.409, 0.));
  float ltip = liveAt(vec3(0., 0.82, 0.));
  col += vec3(0.8, 0.95, 1.)*lamp(o, d, vec3(0., 0.845, 0.), 0.005, front + 0.01)*25.*pow(0.5 + 0.5*sin(tm*1.9), 12.)*ltip;
  if(ls > 0.01){
    col += vec3(0.85, 0.94, 1.)*lamp(o, d, vec3(0., 0.855, 0.), 0.016, front + 0.03)*120.*lsK*ltip;
    // (and the sheen along the edges where the hull meets the sky: a thin line of light hugging its outline)
    if(!hit){ vec3 pa = o + d*amT; col += vec3(0.6, 0.84, 1.)*lsK*(0.15 + 0.85*sq(smoothstep(-0.9, 0.85, pa.y)))*exp(-max(am, 0.)/max(0.9*uPix*amT, 0.002))*0.9; }
  }
  // the working lights on the belly pod (scan array, tractor emitter, probe bay) and at the needle's tip (the gun, also lit by the drill);
  // the scoop's plasma sheath round the needle
  col += vec3(0.45, 0.9, 1.)*lamp(o, d, vec3(0.066, 0.2, 0.), 0.01, front + 0.02)*45.*uP2.x;
  col += vec3(0.5, 1., 0.75)*lamp(o, d, vec3(0.07, -0.02, 0.), 0.011, front + 0.02)*45.*uP2.y;
  col += vec3(1., 0.8, 0.55)*pblob(o, d, vec3(0., 0.85, 0.), 0.014)*55.*uP2.z;
  col += vec3(0.6, 0.83, 1.)*lamp(o, d, vec3(0.064, -0.1, 0.), 0.009, front + 0.02)*35.*uP2.w;   // (the bay Pip, the drone, lives in: ice blue)
  if(uP1.w > 0.01) col += uP3.rgb*(blob(o, d, vec3(0., 0.74, 0.), 0.1)*5. + pblob(o, d, vec3(0., 0.85, 0.), 0.02)*30.)*uP1.w;
  // the shield. Under load a line hugs the hull's outline, one pixel out and about one wide, at any size: on a phone the fine detail is too small to show,
  // and this is what flares there (a crisp line, not a glow: a glow spread into a haze over a small ship)
  if(!hit && flare > 0.){ float w0 = max(0.6*px0, 0.003); col += shc*flare*exp(-sq((am0 - 0.7*px0)/w0))*(1. - 0.85*sv)*2.*smoothstep(0.1, 0.4, amT0); }
  // the outline: a fine silver-blue line just outside the hull (about one character out: DL), barely there with a faint shimmer, and a glint
  // that runs once round it every 9 s (14 s with reduced motion), taking about 3 s. Under load it brightens most on the side facing the pull,
  // and waves of light run out from the heart along it on each beat.
  // It is where the ray's closest pass by the hull, over its whole length, is DL: so it runs round the ship's silhouette, and where two parts
  // are closer on screen than 2 DL it goes round the gap between them instead of filling it (the ray passes nearer than DL to one of them).
  // Rays that hit the hull draw none of it, so it never lies over the hull. (Folded away, shk 0, none of this is worked out.)
  // (lw: about one pixel at any size, so it is a line both on a phone and up close from the bridge; am, amT and the gradient gL come from the
  // sampling loop above, DL and doL too)
  if(doL){
    float lw = max(uPix*amT*0.8, 1e-5), lnV = exp(-sq((am - DL)/lw))*smoothstep(0.12, 0.5, amT);
    vec3 pm = o + d*amT, nout = normalize(gL.yzw - gL.x + 1e-7);
    float cyc = fract(tm/(RM > 0 ? 14. : 9.)), run = smoothstep(0., 0.04, cyc)*(1. - smoothstep(0.3, 0.36, cyc));
    float ang = atan(pm.z, pm.y + 0.05), cg = max(cos(ang - cyc/0.36*6.2832 + 1.6), 0.), glint = pow(cg, 40.)*run;
    float wave = exp(-sq((length(pm - CORE) - 1.3*bf)/0.08));
    float v = lnV*(sh*(0.55 + 0.45*noise(pm*30. + vec3(0., tm*0.7, 0.))) + 0.45*glint*sv*shk*(1. - load) + 2.5*wave*load*sv*shk)*(1. + 1.5*load*max(dot(nout, G), 0.));
    v *= 1. - smoothstep(0.95, 0.99, length(pm));
    col += mix(shc, uP3.rgb*1.4, uP1.w*smoothstep(0.25, 0.45, pm.y))*v;
  }
  outCol(col, alpha);
}`;

// ---------------------------------------------------------------- the fold's look (made up, like the ship): ember wind. The hull breaks up into cells; foldCellThr gives
// the page the same threshold per cell as thrC in the shader (the same front, the same integer hash), so an ember leaves each cell as the shader cuts it.
const FOLD_JIT = 0.28;   // (FJIT in the shader)
const foldF = (y, z, mode) => mode > 0 ? (0.834 - y)/1.69 + 0.05*Math.sin(z*9 + y*4) : 1 - Math.hypot(y + 0.3, z)/1.14 + 0.05*Math.sin(z*9 - y*5);
function foldHash(ix, iz){
  let h = (Math.imul((ix + 1024) >>> 0, 0x8da6b343) + Math.imul((iz + 1024) >>> 0, 0xd8163841) + 0x9e3779b9) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h = (h ^ (h >>> 12)) >>> 0; h = Math.imul(h, 0x297a2d39) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return (h >>> 8)/16777216;
}
const foldCellThr = (ix, iz, mode, cs) => foldF((ix + 0.5)*cs, (iz + 0.5)*cs, mode) + FOLD_JIT*(foldHash(ix, iz) - 0.5);
// (highp int: the fold's cell hash needs 32-bit integers to match foldHash, and a fragment shader's ints are only mediump by default, 16 bits
// on some phones)
P.ship = program(VS_RECT, COMMON + `precision highp int;\n#define RM ${reduceMotion ? 1 : 0}\n` + FS_SHIP_BODY);
const SHIP_TARGETS = ['earth', 'moon', 'jupiter', 'saturn', 'titan', 'sun', 'mars', 'sgra', 'betelgeuse', 'pillars', 'crab', 'etacar', 'catseye', 'hltau', 'omegacen', 'm87bh', 'andromeda',
  'm51', 'antennae', 'ton618', 'milkyway', 'antares', 'alphacen', 'trappist1', 'magnetar', 'sn1987a', 'galcentre', 'rsoph', 'europa', 'io', 'lmc', 'm104', '3c273', 'proxima', 'sirius', 'pleiades', 'casa', 'bubble', 'halley', 'ceres', 'southernring'];
// the ship itself. How it travels (light speed, folds) and what it does on each visit (scan, probe, weapons test, skim, tractor and drill) is in 07h-halo.js.
const shipOff = () => ship.viewOff || [0, 0, 0];
const ship = (() => {
  const RAD = 2.5*KM;
  // S: phase ('pass' | 'align' | 'light' | 'fold'), target (the body it is visiting: its parent), shader state (spool, ls light-speed sheen,
  // scale, scoop, ringPh the rings' turn, beat the heart's beat, load the shield's load and gDir the way the pull comes from), em (belly lights)
  // and the fold's look (07h-halo.js): dg the dissolve, dm its mode, hfl the heart's flare, shK the shield's share, cc the collapse clock,
  // cs the cells' size
  const S = { phase:'pass', t:0, target:null, spool:0, ls:0, scale:1, scoop:0, scoopC:[1, 0.6, 0.3], em:[0, 0, 0, 0], visits:0, ringPh:0, beat:0, load:0, gDir:[0, 1, 0],
    dg:0, dm:0, hfl:0, shK:1, cc:0, cs:0.03 };
  const M0 = new Float32Array(9);
  const o = addObj({ key:'halo', name:'the Halo', label:'Halo', labelClass:'ship', type:'long-range cruiser · a wandering starship that folds space', group:'travel', sortKey:0, layer:3,
    fact:'A long-range cruiser from a civilisation that learned to fold space. Seen from above it is a trident: a needle-shaped bow and two crescent arms sweeping back to the engines at their tips. Between the arms floats its heart, a captured ball of star plasma inside two rings of light. It roams round the wonders of the universe, a couple of minutes at each, then moves on: light speed for short hops, a fold through space for long ones. At each place it does a job or two: a sensor scan, a weapons test, a skim through a gas giant or a star, or an outing by Pip, its little drone. (The Halo and Pip are the only made-up things in this atlas.)',
    // (seen from afar it is an engine glint; its hull fades in over a wide range of sizes, so flying up to it never pops it into view)
    pos:[0, 0, 0], rad:RAD, prog:P.ship, minZoom:1.2, pxMin:3, visFn:rpx => smooth(1.5, 12, rpx), noImpostor:false, farColor:[0.55, 0.8, 1], farLum:0.7, labelRange:1, selfPos:true, aka:'ship starship spaceship ring halo follow trident crescent',
    // locked on, the camera always trails the ship (its frame turns with the ship: see the lock-follow in tick): from behind and a little above (low enough that it reads as flying straight on), lower and to one side, then wide from one side and above
    // (camera frame, camFrame: +y is up from the deck, +z is behind the stern)
    // (off: while it works on something below its belly, the camera aims a little below the ship, so the job shows beneath it)
    views:[{d:[0, 0.3, 1], k:2.5, hold:10, drift:0, off:shipOff}, {d:[0.62, 0.12, 1], k:2.1, hold:9, drift:0, off:shipOff}, {d:[-0.5, 0.5, 0.9], k:3.4, hold:9, drift:0, off:shipOff}],
    // (S.light: a fixed light in the ship's own frame, for the showcase and screenshots; otherwise the Sun lights it)
    setU(pr){ const L = S.light ? M3.apply(this.R0, V.norm(S.light)) : S.target ? V.norm(V.sub(sun.rel, this.rel)) : [0, 1, 0], c = S.scoopC, e = S.em;
      gl.uniform4f(pr.u.uP0, S.spool, S.ls, S.scale, S.ringPh); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], S.scoop); gl.uniform4f(pr.u.uP2, e[0], e[1], e[2], e[3]); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], S.beat);
      gl.uniform4f(pr.u.uP4, S.gDir[0], S.gDir[1], S.gDir[2], S.load);
      M0[0] = S.dg; M0[1] = S.dm; M0[2] = S.hfl; M0[3] = S.shK; M0[6] = S.cs; gl.uniformMatrix3fv(pr.u.uM0, false, M0); },
    readout:() => haloReadout() });
  o.S = S;
  // the camera's frame for the ship: x = its starboard side, y = up from the deck (-x in the ship's own frame), z = behind the stern (-y).
  // It follows viewR, the ship's frame turned part of the way toward whatever the ship is working on, so a trailing camera keeps the job in the picture.
  const CAMQ = [0, 0, 1, -1, 0, 0, 0, -1, 0];
  o.camFrame = () => M3.mul(o.viewR || o.R0, CAMQ);
  return o;
})();

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

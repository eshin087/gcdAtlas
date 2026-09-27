
// ================================================================ travellers and transients: the Halo (a starship that folds space), comets, meteors, gamma-ray bursts
// (the shared random seed once every object exists: the Halo's route and all that follows draw from here, so a pack that uses rnd() and
// forgets to put the seed back changes them; the smoke test checks this value)
const SEED_OBJECTS = seed;
// ---------------------------------------------------------------- the Halo: a long-range cruiser shaped like a trident, its star-heart held between two crescent arms (local: bounding sphere 1, +y = forward)
const FS_SHIP = COMMON + `
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
  float core = length(p - CORE) - 0.038;
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
// uP0: x fold-drive spool, y jump glow (light speed and folds), z scale (1; it shrinks to a point as it folds away and grows back on arrival)
// uP1: xyz light direction, w ram-scoop glow (uP3.rgb its colour)   uP2: glow of the scan array, tractor emitter, bow gun / drill, probe bay
void main(){
  vec3 o, d; localRay(o, d);
  o /= max(uP0.z, 0.01);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float spool = uP0.x, jg = uP0.y, tm = uTime, S = surge(tm);
  float power = 1. + spool*1.6 + S*2.;
  vec3 L = normalize(uP1.xyz*uRot);
  vec3 ice = vec3(0.6, 0.83, 1.), silver = vec3(0.85, 0.9, 1.), white = vec3(1.);
  float t = max(hb.x, 0.), id = 0.; bool hit = false;
  for(int i=0;i<150;i++){ vec3 p = o + d*t; float h = map(p, id); if(h < 0.0005) { hit = true; break; } t += h*0.8; if(t > hb.y) break; }
  vec3 col = vec3(0.); float alpha = 0.;
  if(hit){
    vec3 p = o + d*t, n = nrm(p), A;
    float w = abs(p.z); vec2 q = vec2(p.y, w);
    float dif = max(dot(n, L), 0.), mu = max(dot(n, -d), 0.), rim = pow(1. - mu, 3.);
    vec3 hv = normalize(L - d); float spec = pow(max(dot(n, hv), 0.), 60.), sheen = pow(max(dot(n, hv), 0.), 6.);
    vec3 toC = CORE - p; float coreLit = max(dot(n, normalize(toC)), 0.)*0.25/(dot(toC, toC)*40. + 0.15);
    // black lacquer with a faint engraved pattern; a broad sheen and a sharp glint where the light catches it
    vec3 base = vec3(0.075, 0.08, 0.095)*(0.7 + 0.8*ridge(p*48.));
    col = base*(dif*1.3 + 0.3) + silver*(spec*1.2 + sheen*0.05) + ice*rim*0.12 + ice*coreLit*power;
    float lit = 0.;
    if(id > 1.5 && id < 2.5){
      // the heart: white-hot plasma, grainy, brighter as it surges or the drive spools up
      float pl = fbm3((p - CORE)*95. + vec3(0., tm*1.3, tm*0.4));
      col = mix(vec3(0.78, 0.88, 1.), white, smoothstep(0.3, 0.7, pl))*(3.2 + 2.2*pl + 1.2*mu)*power;
    } else if(id > 2.5 && id < 3.5){
      float xe0 = lift(0.29);
      // nacelles: dark, with a silver ring and a glowing nozzle facing aft
      float noz = smoothstep(-0.8, -0.832, p.y)*max(-n.y, 0.);
      col += silver*exp(-pow((p.y + 0.775)/0.008, 2.))*1.6 + ice*noz*3.5*(1. + spool + S) + ice*dots(p.y, 0.03, abs(p.x - xe0) - 0.017, 0.006)*step(-0.76, p.y)*step(p.y, -0.64)*1.6;
    } else if(id > 0.5 && id < 1.5){
      // the arms: silver edges, a panel line along the middle, a row of lights near the outer edge and another along the inner one
      float e = -armPlan(q, A), s = A.x*0.75;
      col += silver*smoothstep(0.013, 0.003, e)*(0.45 + 0.9*dif + 0.7*rim);
      col += silver*exp(-pow((A.y - 0.5)*A.z/0.004, 2.))*smoothstep(0.15, 0.3, A.x)*smoothstep(0.92, 0.8, A.x)*0.3;
      lit += dots(s, 0.027, (1. - A.y)*A.z - 0.017, 0.0055)*smoothstep(0.08, 0.14, A.x)*smoothstep(0.97, 0.9, A.x);
      lit += dots(s + 0.011, 0.034, A.y*A.z - 0.014, 0.005)*smoothstep(0.2, 0.3, A.x)*smoothstep(0.94, 0.86, A.x)*0.8;
    } else {
      // the bow, its spine, bridge and pod: silver edges, an inner panel line, lights down the spine and along both edges, the bridge windows
      float e = -bowPlan(q);
      col += silver*(smoothstep(0.013, 0.003, e)*(0.45 + 0.9*dif + 0.7*rim) + exp(-pow((e - 0.03)/0.0045, 2.))*step(-0.12, p.y)*0.3);
      lit += dots(p.y + 0.15, 0.034, w, 0.0055)*step(-0.14, p.y)*step(p.y, 0.76);
      lit += dots(p.y, 0.03, e - 0.016, 0.005)*step(0.02, p.y)*step(p.y, 0.7)*0.7;
      lit += dots(p.y + 0.017, 0.022, w, 0.008)*step(-0.03, p.y)*step(p.y, 0.08)*step(p.x, -0.03)*1.5;
    }
    col += ice*lit*(2.3 + 0.6*sin(tm*1.3 + p.y*9.))*(0.85 + 0.15*power);
    // jumping: the hull flares white-blue; skimming: the needle glows with the gas it rams through
    col += vec3(0.72, 0.9, 1.)*jg*(0.4 + 2.4*rim);
    col += uP3.rgb*uP1.w*pow(max(n.y, 0.), 2.)*(1.2 + 0.8*noise(p*40. + tm*3.));
    alpha = 1.;
  }
  float front = hit ? t : 1e9;
  // the halo: two dotted rings of light round the heart in the plane of the ship, turning slowly (faster as the fold drive spools up),
  // and chains of lights running from the heart to the claws of both arms and forward to the bow's neck
  if(abs(d.x) > 0.01){
    float tp = -o.x/d.x;
    if(tp > 0. && tp < front && tp < hb.y){
      vec3 pp = o + d*tp; vec2 rq = vec2(pp.y - CORE.y, pp.z); float rr = length(rq), an = atan(rq.y, rq.x);
      float lw = max(0.0028, uPix*tp*0.7), k = 0.0028/lw;
      float a1 = an + tm*(0.1 + spool*1.2), a2 = an - tm*(0.07 + spool*0.9);
      float r1 = exp(-pow((rr - 0.089)/lw, 2.))*pow(0.5 + 0.5*cos(a1*48.), 5.);
      float r2 = exp(-pow((rr - 0.109)/lw, 2.))*pow(0.5 + 0.5*cos(a2*60.), 5.)*smoothstep(-0.2, 0.4, sin(a2*3. + 0.6));
      vec2 cq = vec2(pp.y, abs(pp.z)), bz = sdBez(cq, vec2(-0.3, 0.036), vec2(-0.33, 0.11), vec2(-0.403, 0.176));
      float ch = exp(-bz.x*bz.x/(lw*lw))*pow(0.5 + 0.5*cos(bz.y*6.2832*15. - tm*4.), 4.);
      float nk = exp(-cq.y*cq.y/(lw*lw))*step(-0.262, cq.x)*step(cq.x, -0.19)*pow(0.5 + 0.5*cos((cq.x + 0.262)*6.2832/0.012 - tm*4.), 4.);
      col += ice*(r1*3.2 + r2*2.6 + ch*4.*(0.8 + 0.4*S) + nk*3.)*k*power;
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
      acc += mix(white, ice, smoothstep(0.04, 0.09, r))*exp(-r/(0.016 + 0.01*power))*(0.4 + 1.3*sw*sw)*smoothstep(0.12, 0.06, r);
    }
    col += acc*max(dt, 0.)*7.*power;
  }
  col += vec3(0.92, 0.96, 1.)*(blob(o, d, CORE, 0.05)*1.6 + blob(o, d, CORE, 0.13)*0.08)*power*(1. - alpha*0.5);
  // surges: sparks leap from the heart to its rings
  if(S > 0.02){
    float k = floor(tm/2.3);
    for(int a=0;a<4;a++){
      float fa = float(a), an = hash12(vec2(k, fa))*6.2832;
      vec3 dir = normalize(vec3((hash12(vec2(fa, k + 3.)) - 0.5)*0.5, cos(an), sin(an)));
      for(int j=1;j<8;j++){
        float s = float(j)/8.;
        vec3 jit = vec3(noise(vec3(s*7., fa, tm*25.)), noise(vec3(s*7. + 3., fa, tm*25.)), noise(vec3(s*7. + 6., fa, tm*25.))) - 0.5;
        col += mix(white, ice, s)*lamp(o, d, CORE + dir*0.1*s + jit*0.03*sin(3.1416*s), 0.003, front)*55.*S;
      }
    }
  }
  // the engines: a plume and a dotted exhaust trail streaming aft from each (fading before the edge of the bounding sphere); blinking lights
  // on the claws and the shoulders, the bow's neck, a node on the outer ring and the needle's beacon
  float tk = 1. + spool + S;
  for(int k=0;k<2;k++){
    float sg = k == 0 ? 1. : -1.;
    vec3 nz = vec3(lift(0.29), -0.857, 0.287*sg);   // (just behind the nacelle's end cap)
    col += jet(o - nz, d, vec3(0., -1., 0.), 0.1, 0.007, 0.018, 0.6, tm*5. + sg, vec3(0.85, 0.95, 1.), vec3(0.3, 0.55, 1.))*(2. + 3.*spool + 6.*jg);
    col += mix(white, ice, 0.4)*lamp(o, d, nz, 0.008, front)*40.*tk;
    for(int j=1;j<5;j++){ float fj = float(j); col += ice*lamp(o, d, nz + vec3(0., -0.02*fj, 0.), 0.0035, front)*(10. - 1.8*fj)*tk*(0.7 + 0.3*sin(tm*9. - fj*1.7)); }
    col += white*lamp(o, d, vec3(lift(0.176), -0.403, 0.176*sg), 0.006, front)*22.*(0.5 + 0.5*pow(0.5 + 0.5*sin(tm*1.7 + sg), 4.));
    col += white*lamp(o, d, vec3(0., -0.043, 0.108*sg), 0.005, front)*16.*(0.55 + 0.45*pow(0.5 + 0.5*sin(tm*1.3 - sg*0.8), 6.));
  }
  col += white*lamp(o, d, vec3(0., -0.19, 0.), 0.005, front)*14.;
  col += white*lamp(o, d, vec3(0., -0.409, 0.), 0.005, front)*12.;
  col += vec3(0.8, 0.95, 1.)*lamp(o, d, vec3(0., 0.845, 0.), 0.005, front + 0.01)*25.*pow(0.5 + 0.5*sin(tm*1.9), 12.);
  vec2 hf = sphIsect(o, d, vec3(0.), 0.92);
  if(hf.y > 0. && spool > 0.){ vec3 qn = normalize(o + d*max(hf.x, 0.)); col += vec3(0.5, 0.85, 1.)*pow(1. - abs(dot(qn, d)), 3.)*spool*1.3*(0.7 + 0.3*noise(qn*9. + tm)); }
  // the working lights on the belly pod (scan array, tractor emitter, probe bay) and at the needle's tip (the gun, also lit by the drill);
  // the scoop's plasma sheath round the needle; the jump flare
  col += vec3(0.45, 0.9, 1.)*lamp(o, d, vec3(0.066, 0.2, 0.), 0.01, front + 0.02)*45.*uP2.x;
  col += vec3(0.5, 1., 0.75)*lamp(o, d, vec3(0.07, -0.02, 0.), 0.011, front + 0.02)*45.*uP2.y;
  col += vec3(1., 0.8, 0.55)*pblob(o, d, vec3(0., 0.85, 0.), 0.014)*55.*uP2.z;
  col += vec3(0.7, 1., 0.8)*lamp(o, d, vec3(0.064, -0.1, 0.), 0.009, front + 0.02)*35.*uP2.w;
  if(uP1.w > 0.01) col += uP3.rgb*(blob(o, d, vec3(0., 0.74, 0.), 0.1)*5. + pblob(o, d, vec3(0., 0.85, 0.), 0.02)*30.)*uP1.w;
  if(jg > 0.01) col += vec3(0.75, 0.9, 1.)*blob(o, d, vec3(0.), 0.3)*jg*4.;
  outCol(col, alpha);
}`;

P.ship = program(VS_RECT, FS_SHIP);
const SHIP_TARGETS = ['earth', 'moon', 'jupiter', 'saturn', 'titan', 'sun', 'mars', 'sgra', 'betelgeuse', 'pillars', 'crab', 'etacar', 'catseye', 'hltau', 'omegacen', 'm87bh', 'andromeda',
  'm51', 'antennae', 'ton618', 'milkyway', 'antares', 'alphacen', 'trappist1', 'magnetar', 'sn1987a', 'galcentre', 'rsoph', 'europa', 'io', 'lmc', 'm104', '3c273', 'proxima', 'sirius', 'pleiades', 'casa', 'bubble', 'halley', 'ceres', 'southernring'];
// the ship itself. How it travels (light speed, folds) and what it does on each visit (scan, probe, weapons test, skim, tractor and drill) is in 07h-halo.js.
const shipOff = () => ship.viewOff || [0, 0, 0];
const ship = (() => {
  const RAD = 2.5*KM;
  // S: phase ('pass' | 'align' | 'light' | 'fold'), target (the body it is visiting: its parent), shader state (spool, jg jump glow, scale, scoop), em (belly lights)
  const S = { phase:'pass', t:0, target:null, spool:0, jg:0, scale:1, scoop:0, scoopC:[1, 0.6, 0.3], em:[0, 0, 0, 0], visits:0 };
  const o = addObj({ key:'halo', name:'the Halo', label:'Halo', labelClass:'ship', type:'long-range cruiser · a wandering starship that folds space', group:'travel', sortKey:0, layer:3,
    fact:'A long-range cruiser from a civilisation that learned to fold space. Seen from above it is a trident: a needle-shaped bow and two crescent arms sweeping back to the engines at their tips. Between the arms floats its heart, a captured ball of star plasma inside two rings of light. It hops between the wonders of the universe: light speed for short hops, a fold through space for long ones. On each visit it does one job: a sensor scan, a probe launch, a weapons test, a skim through a gas giant or a star, or drilling a passing rock. (It is the only made-up thing in this atlas.)',
    // (seen from afar it is an engine glint; its hull fades in over a wide range of sizes, so flying up to it never pops it into view)
    pos:[0, 0, 0], rad:RAD, prog:P.ship, minZoom:1.2, pxMin:3, visFn:rpx => smooth(1.5, 12, rpx), noImpostor:false, farColor:[0.55, 0.8, 1], farLum:0.7, labelRange:1, selfPos:true, aka:'ship starship spaceship ring halo follow trident crescent',
    // locked on, the camera always trails the ship (its frame turns with the ship: see the lock-follow in tick): from behind and a little above (low enough that it reads as flying straight on), lower and to one side, then wide from one side and above
    // (camera frame, camFrame: +y is up from the deck, +z is behind the stern)
    // (off: while it works on something below its belly, the camera aims a little below the ship, so the job shows beneath it)
    views:[{d:[0, 0.3, 1], k:2.5, hold:10, drift:0, off:shipOff}, {d:[0.62, 0.12, 1], k:2.1, hold:9, drift:0, off:shipOff}, {d:[-0.5, 0.5, 0.9], k:3.4, hold:9, drift:0, off:shipOff}],
    // (S.light: a fixed light in the ship's own frame, for the showcase and screenshots; otherwise the Sun lights it)
    setU(pr){ const L = S.light ? M3.apply(this.R0, V.norm(S.light)) : S.target ? V.norm(V.sub(sun.rel, this.rel)) : [0, 1, 0], c = S.scoopC, e = S.em;
      gl.uniform4f(pr.u.uP0, S.spool, S.jg, S.scale, 0); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], S.scoop); gl.uniform4f(pr.u.uP2, e[0], e[1], e[2], e[3]); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], 0); },
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

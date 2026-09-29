// ================================================================ SpaceX launches (2): the pads, the flights, the director and its camera
// Four missions, each a set of stages flying keyframed paths (downrange s km along the launch azimuth, crossrange c km to the left,
// altitude h km, pitch from the vertical toward downrange in degrees) modelled on real flights: Starship (hot staging, the booster
// flies back and is caught by the tower), Falcon 9 (the booster lands on a droneship), Falcon Heavy (both side boosters land back at
// Cape Canaveral, the centre core on a droneship) and Crew Dragon (Falcon 9 from SLC-40, then, a day later, docking at the ISS).
// Three ways a flight starts: a real SpaceX launch at its scheduled time (from /api/launches, played in real time, joined in progress),
// a click on the rocket in the atlas (the camera flies to the pad and a countdown starts), and an illustrative replay now and then while
// you look at Earth (seen from orbit as a glowing trail, with a caption and a watch button). Replays and clicks are sped up in the quiet
// parts (MIS.*.rate) and say so. Watching, a scripted camera (LCAM) cuts between shots: the pad, the tower, a tracking camera miles
// away, beside the stages at separation, the catch, the droneship's deck. Any drag hands the camera back; play picks it up again.
// Everything positional is kept in Earth-fixed kilometres (float64) and turned into world coordinates through earth.rel and earth.rot,
// so a 70 m rocket and a pad 6,371 km from Earth's centre stay exact to well under a millimetre.
const SX_SEED = seed;
const MET = 1e-3*KM, RE_KM = 6371;
const llUnit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
// a site's local axes in Earth-fixed coordinates, and its frame matrix (columns: x east, y up, z south)
function enuOf(up){ const e = V.norm(V.cross([0, 1, 0], up)), n = V.cross(up, e); return { up, e, n, M:[...e, ...up, ...V.mul(n, -1)] }; }
// ---------------------------------------------------------------- the sites (coast: the direction toward the sea in the site's x-z plane and the distance to the beach, m)
const SXS = {
  starbase:{ name:'Starbase, Texas', short:'Starbase', la:25.99677, lo:-97.15799, kind:1, coast:[1, 0, 1300] },   // (Pad 2, where Starship now flies from)
  lc39a:{ name:'Launch Complex 39A, Kennedy Space Center, Florida', short:'Kennedy Space Center', la:28.60822, lo:-80.60428, kind:2.75, coast:[0.93, 0.36, 1250] },   // (its crew access arm came off in February 2026)
  slc40:{ name:'Space Launch Complex 40, Cape Canaveral, Florida', short:'Cape Canaveral', la:28.56194, lo:-80.57735, kind:3, coast:[0.95, 0.3, 700] },
  slc4e:{ name:'Space Launch Complex 4E, Vandenberg, California', short:'Vandenberg', la:34.63208, lo:-120.61074, kind:2, coast:[-0.98, -0.2, 700] },
  lz:{ name:'Landing Zones 1 and 2, Cape Canaveral', short:'the Cape\'s landing zones', la:28.48575, lo:-80.54385, kind:5, coast:[0.95, 0.3, 1100] },
};
for (const k in SXS){ const S = SXS[k]; S.key = k; S.up = llUnit(S.la, S.lo); S.F = enuOf(S.up); S.p = V.mul(S.up, RE_KM); }
// along a launch azimuth: the point s km downrange, c km to the left, h km up, and the axes there (Earth-fixed)
function azFrame(S, az){ const d = V.add(V.mul(S.F.n, Math.cos(az*DEG)), V.mul(S.F.e, Math.sin(az*DEG))); return { up:S.up, dir:d, left:V.cross(S.up, d) }; }
function trajPoint(A, s, c, h, pd){
  const a = s/RE_KM;
  let u = V.add(V.mul(A.up, Math.cos(a)), V.mul(A.dir, Math.sin(a)));
  const f0 = V.sub(V.mul(A.dir, Math.cos(a)), V.mul(A.up, Math.sin(a)));
  u = V.norm(V.add(u, V.mul(A.left, c/RE_KM)));
  const left = V.norm(V.cross(u, f0)), fwd = V.cross(left, u), pr = pd*DEG;
  return { p:V.mul(u, RE_KM + h), up:u, fwd, left, axis:V.add(V.mul(u, Math.cos(pr)), V.mul(fwd, Math.sin(pr))) };
}
// where a lat/lon lies from a site along an azimuth (small distances): [s, c] km
function sxSC(S, az, la, lo){ const d = V.sub(V.mul(llUnit(la, lo), RE_KM), S.p), e = V.dot(d, S.F.e), n = V.dot(d, S.F.n), a = az*DEG;
  return [e*Math.sin(a) + n*Math.cos(a), -e*Math.cos(a) + n*Math.sin(a)]; }
// ---------------------------------------------------------------- keyframed paths: monotone cubic (Fritsch-Carlson) through [t, s, c, h, pitch]
function monoSl(x, y){
  const n = x.length, d = [], m = new Array(n).fill(0);
  for (let i=0;i<n - 1;i++) d.push((y[i + 1] - y[i])/(x[i + 1] - x[i]));
  for (let i=1;i<n - 1;i++) m[i] = d[i - 1]*d[i] <= 0 ? 0 : (d[i - 1] + d[i])/2;
  m[0] = d[0] || 0; m[n - 1] = d[n - 2] || 0;
  for (let i=0;i<n - 1;i++){ if (d[i] === 0){ m[i] = m[i + 1] = 0; continue; } const a = m[i]/d[i], b = m[i + 1]/d[i], s = a*a + b*b; if (s > 9){ const t = 3/Math.sqrt(s); m[i] = t*a*d[i]; m[i + 1] = t*b*d[i]; } }
  return m;
}
function Kp(rows){ const T = rows.map(r => r[0]), C = [1, 2, 3, 4].map(j => rows.map(r => r[j])); return { T, C, S:C.map(y => monoSl(T, y)) }; }
function kAt(k, t){
  const T = k.T, n = T.length; t = clamp(t, T[0], T[n - 1]);
  let i = 0; while (i < n - 2 && t > T[i + 1]) i++;
  const h = T[i + 1] - T[i], u = (t - T[i])/h, u2 = u*u, u3 = u2*u;
  const h00 = 2*u3 - 3*u2 + 1, h10 = u3 - 2*u2 + u, h01 = -2*u3 + 3*u2, h11 = u3 - u2;
  const g00 = (6*u2 - 6*u)/h, g10 = 3*u2 - 4*u + 1, g01 = (-6*u2 + 6*u)/h, g11 = 3*u2 - 2*u;
  const v = [], dv = [];
  for (let j=0;j<4;j++){ const a = k.C[j][i], b = k.C[j][i + 1], ma = k.S[j][i], mb = k.S[j][i + 1];
    v.push(h00*a + h10*h*ma + h01*b + h11*h*mb); dv.push(g00*a + g10*ma + g01*b + g11*mb); }
  return { v, dv };
}
const lin = (A, t) => { if (t <= A[0][0]) return A[0][1]; for (let i=1;i<A.length;i++) if (t <= A[i][0]) { const [t0, a] = A[i - 1], [t1, b] = A[i]; return a + (b - a)*(t - t0)/Math.max(t1 - t0, 1e-9); } return A[A.length - 1][1]; };
const clk = s => { const a = Math.abs(s), m = Math.floor(a/60), ss = Math.floor(a % 60); return (s < 0 ? 'T-' : 'T+') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); };

// ---------------------------------------------------------------- the stages of each family: type (the shader's), length (m), plume (sea-level length m, radius at the nozzles m)
const FAM = {
  star:{ parts:[
    { id:'booster', key:'superheavy', name:'Super Heavy', type:1, len:71.3, pl:[170, 4.3] },
    { id:'ship', key:'starship', name:'Starship', type:2, len:50.3, pl:[80, 3.3] } ] },
  f9:{ parts:[
    { id:'core', key:'falcon9', name:'Falcon 9', type:3, len:47.7, pl:[95, 1.75] },
    { id:'s2', key:'f9s2', name:'Falcon 9 second stage', type:6, len:25.7, pl:[70, 1.5] },
    { id:'dragon', key:'dragon', name:'Crew Dragon', type:7, len:8.4, pl:[0, 0] } ] },
  fh:{ parts:[
    { id:'core', key:'falconheavy', name:'Falcon Heavy', type:3, len:47.7, pl:[95, 1.75] },
    { id:'sideA', key:'fhside1', name:'Falcon Heavy side booster', type:4, len:47, pl:[95, 1.75] },
    { id:'sideB', key:'fhside2', name:'Falcon Heavy side booster', type:4, len:47, pl:[95, 1.75] },
    { id:'s2', key:'fhs2', name:'Falcon Heavy second stage', type:6, len:25.7, pl:[70, 1.5] } ] },
};
// ---------------------------------------------------------------- the missions
// stack: the path of the first part's base while the stack is whole. Each part: sep (when it flies on its own path), dy / dz (its base
// above / beside the first part's base while stacked, m), path, thr (throttle, 0..1 of all engines), legs / fins (0..1 over time).
// events: captions. rate: playback speed from each mission time (replays and clicks). shots: the camera (see shotPose).
const LZ_SC = [sxSC(SXS.lc39a, 90, 28.48581, -80.54287), sxSC(SXS.lc39a, 90, 28.48569, -80.54484)];
const MIS = {
  starship:{ fam:'star', name:'Starship', site:'starbase', az:97, end:560, h0:0.020,
    stack:Kp([[0,0,0,0.020,0],[4,0,0,0.052,0],[8,0,0,0.15,0],[12,0,0,0.31,0],[16,0,0,0.55,0.5],[20,0.02,0,0.85,1.5],[26,0.08,0,1.45,4],[34,0.3,0,2.6,8],[45,0.9,0,4.8,14],[62,2.6,0,9.5,23],[80,6.2,0,16,32],[100,12.8,0,25,41],[120,22.5,0,36,48],[140,36,0,49,54],[162,57,0,66,58]]),
    parts:{
      booster:{ sep:162, dy:0, path:Kp([[162,57,0,66,58],[168,64,0,72,45],[175,70,0,77,-20],[182,74,0,81,-72],[205,80,0,90,-80],[228,78,0,97,-78],[250,70,0,101,-55],[290,55,0,94,-20],[320,43,0,80,-8],[345,32,0,60,-5],[365,22,0,40,-3],[380,14,0,25,-2],[392,8,0,13,-1.5],[402,4,0,6.5,-1],[412,1.4,0,2.6,-0.5],[418,0.4,0,0.9,0],[424,0.06,0,0.2,0],[430,0,0,0.036,0],[436,0,0,0.031,0]]),
        thr:[[-3.2,0],[-2.4,0.6],[0,1],[157,1],[158,0.12],[163,0.12],[164,0],[182,0],[183,1],[226,1],[227,0],[411,0],[412,1],[419,1],[420,0.3],[431,0.3],[432,0]] },
      ship:{ sep:162, dy:71.3, path:Kp([[162,57,0,66,58],[172,72,0,76,62],[190,100,0,91,67],[220,152,0,112,72],[260,238,0,136,78],[320,400,0,162,84],[380,610,0,179,88],[440,880,0,188,91],[515,1290,0,192,93],[560,1600,0,192,93]]),
        thr:[[159.5,0],[160.5,1],[515,1],[516,0]] } },
    pad:{ chopH:[[-600,62],[380,62],[405,93],[900,93]], chopOpen:[[-600,1],[428,1],[431,0.16],[900,0.16]], qd:[[-600,0],[-7,0],[-4.5,-1.3],[900,-1.3]] },
    cloud:{ strength:[[-3.2,0],[-2.2,1],[40,1],[110,0.35],[220,0]], steam:0.85, vent:[[-60,1],[-3,0.5],[1,0]] },
    events:[[-10,'final countdown'],[-6,'the quick-disconnect arm swings back'],[-3,'33 Raptor engines start'],[0,'liftoff'],[9,'clear of the tower'],[62,'max Q: the hardest push of the air'],[157,'the booster cuts its engines'],[160,'hot staging: the ship lights its engines while still attached'],[183,'boostback burn: the booster turns back for Texas'],[227,'boostback done: the booster coasts home'],[412,'landing burn: 13 engines, then 3'],[430,'caught by the tower\'s chopsticks'],[515,'ship engine cutoff'],[525,'the ship coasts on round the world']],
    rate:[[-12,1],[20,2],[55,3],[150,1],[172,1.5],[185,2.5],[228,8],[385,2.5],[404,1],[440,4],[505,1.5],[560,1]],
    shots:[
      { t:-60, eye:['site', 'starbase', [-380, 4, 520]], look:['part', 'booster', 62], lens:['fit', 130, 0.62] },
      { t:-4.5, eye:['site', 'starbase', [-72, 3, 96]], look:['part', 'booster', 16], lens:1.15 },
      { t:3, eye:['site', 'starbase', [62, 26, 48]], look:['part', 'booster', 4], lens:1 },
      { t:10, eye:['site', 'starbase', [-2400, 6, 1800]], look:['part', 'ship', 0], lens:['fit', 130, 0.55] },
      { t:55, eye:['traj', 'ship', [-380, -70, 120]], look:['part', 'ship', 0], lens:['fit', 130, 0.5], lag:1 },
      { t:150, eye:['traj', 'ship', [240, 28, -40]], look:['part', 'ship', -4], lens:['fit', 70, 0.8], lag:1 },
      { t:172, eye:['traj', 'booster', [300, 120, 180]], look:['part', 'booster', 36], lens:['fit', 80, 0.5], lag:0.8 },
      { t:228, eye:['traj', 'booster', [330, -40, 170]], look:['part', 'booster', 36], lens:['fit', 80, 0.4], lag:0.6 },
      { t:395, eye:['site', 'starbase', [900, 60, 300]], look:['part', 'booster', 36], lens:['fit', 90, 0.4] },
      { t:414, eye:['site', 'starbase', [250, 92, -10]], look:['site', 'starbase', [0, 88, -12]], lens:['fit', 160, 0.9] },
      { t:440, eye:['traj', 'ship', [110, -25, -150]], look:['part', 'ship', 30], lens:1.2, lag:1 },
      { t:505, eye:['traj', 'ship', [190, -40, 60]], look:['part', 'ship', 25], lens:['fit', 55, 0.5], lag:1 } ] },
  falcon9:{ fam:'f9', name:'Falcon 9', site:'slc40', az:45, end:565, h0:0.004, pay:0, dsS:465,
    stack:Kp([[0,0,0,0.004,0],[4,0,0,0.012,0],[8,0,0,0.045,0],[12,0,0,0.11,0],[18,0,0,0.26,1],[25,0.03,0,0.55,3],[35,0.25,0,1.3,8],[50,1.1,0,3.3,15],[72,3.5,0,8.6,27],[90,8,0,14.5,36],[110,17,0,24,44],[130,35,0,39,51],[148,62,0,58,56]]),
    parts:{
      core:{ sep:151, dy:0, path:Kp([[148,62,0,58,56],[151,67,0,61,57],[160,80,0,70,120],[175,100,0,83,200],[200,133,0,101,235],[240,185,0,120,258],[273,228,0,125,270],[320,286,0,117,285],[360,334,0,98,300],[400,381,0,68,318],[418,400,0,54,322],[440,420,0,38,328],[470,443,0,20,336],[500,458,0,7.5,346],[512,462,0,3.2,352],[520,464,0,1.2,356],[528,464.9,0,0.3,359],[534,465,0,0.0075,360],[540,465,0,0.0075,360]]),
        thr:[[-3.2,0],[-2.6,0.7],[0,1],[147.5,1],[148,0],[399,0],[400,0.33],[417,0.33],[418,0],[511,0],[512,0.11],[533,0.11],[534,0]], legs:[[526,0],[530,1]], fins:[[153,0],[163,1]] },
      s2:{ sep:151, dy:44.8, path:Kp([[148,62,0,58,56],[151,67,0,61,57],[160,80,0,69,60],[180,112,0,85,64],[220,190,0,112,70],[280,340,0,145,78],[360,610,0,176,85],[440,960,0,196,89],[522,1400,0,207,92],[565,1700,0,209,93]]),
        thr:[[156,0],[157.5,1],[522,1],[523,0]], pay:[[194,0],[195,2]] } },
    events:[[-10,'final countdown'],[-3,'nine Merlin engines start'],[0,'liftoff'],[72,'max Q: the hardest push of the air'],[148,'main engine cutoff'],[151,'stage separation'],[157,'second stage engine start'],[195,'the fairing halves fall away'],[400,'entry burn'],[512,'landing burn'],[522,'second stage engine cutoff: in orbit'],[534,'landed on the droneship']],
    rate:[[-12,1],[18,2.5],[65,3.5],[140,1],[175,3],[230,10],[390,1.5],[430,6],[505,1],[545,3],[565,1]],
    shots:[
      { t:-60, eye:['site', 'SITE', [-300, 3, 420]], look:['part', 'core', 36], lens:['fit', 72, 0.62] },
      { t:-4.5, eye:['site', 'SITE', [-115, 3, 150]], look:['part', 'core', 22], lens:['fit', 75, 0.75] },
      { t:5, eye:['site', 'SITE', [26, 2, 30]], look:['part', 'core', 30], lens:1 },
      { t:12, eye:['site', 'SITE', [-2200, 5, 1400]], look:['part', 'core', 36], lens:['fit', 72, 0.5] },
      { t:65, eye:['traj', 'core', [-230, -40, 80]], look:['part', 'core', 36], lens:['fit', 72, 0.5], lag:1 },
      { t:140, eye:['traj', 'core', [45, -12, -8]], look:['part', 'core', 46], lens:1.3, lag:1 },
      { t:175, eye:['traj', 'core', [70, -20, 50]], look:['part', 'core', 24], lens:['fit', 50, 0.55], lag:0.8 },
      { t:230, eye:['traj', 'core', [160, -30, 90]], look:['part', 'core', 24], lens:['fit', 50, 0.45], lag:0.6 },
      { t:390, eye:['traj', 'core', [160, -50, 40]], look:['part', 'core', 20], lens:['fit', 50, 0.45], lag:1 },
      { t:430, eye:['traj', 'core', [150, -30, 80]], look:['part', 'core', 20], lens:['fit', 50, 0.45], lag:1 },
      { t:505, eye:['site', 'DS', [-72, 7, 96]], look:['part', 'core', 22], lens:['fit', 60, 0.5] },
      { t:545, eye:['traj', 's2', [40, 12, -60]], look:['part', 's2', 8], lens:1, lag:1 } ] },
  falconheavy:{ fam:'fh', name:'Falcon Heavy', site:'lc39a', az:90, end:585, h0:0.004, pay:0, dsS:585,
    stack:Kp([[0,0,0,0.004,0],[4,0,0,0.011,0],[8,0,0,0.04,0],[12,0,0,0.1,0],[18,0,0,0.24,1],[25,0.03,0,0.52,3],[35,0.25,0,1.25,8],[50,1.1,0,3.2,15],[72,3.4,0,8.4,27],[90,7.8,0,14.3,36],[110,16.5,0,23.5,44],[130,32,0,36,50],[150,54,0,51,55],[152,57,0,53,56],[170,86,0,65,60],[185,118,0,75,63]]),
    parts:{
      core:{ sep:188, dy:0, path:Kp([[185,118,0,75,63],[188,124,0,78,64],[200,145,0,88,120],[215,172,0,98,200],[240,215,0,112,245],[290,300,0,128,270],[340,380,0,122,285],[390,452,0,100,300],[430,506,0,74,315],[450,528,0,58,322],[480,556,0,34,330],[510,575,0,15,342],[530,582,0,5,350],[540,584,0,1.5,356],[548,584.9,0,0.3,359],[554,585,0,0.0075,360],[560,585,0,0.0075,360]]),
        thr:[[-3.2,0],[-2.6,0.7],[0,1],[40,0.6],[150,0.6],[152,1],[185,1],[186,0],[429,0],[430,0.33],[449,0.33],[450,0],[539,0],[540,0.11],[553,0.11],[554,0]], legs:[[550,0],[553,1]], fins:[[190,0],[200,1]] },
      sideA:{ sep:152, dy:0, dz:4.1, path:null, thr:null, legs:[[457,0],[461,1]], fins:[[155,0],[163,1]] },
      sideB:{ sep:152, dy:0, dz:-4.1, path:null, thr:null, legs:[[457.5,0],[461.5,1]], fins:[[155,0],[163,1]] },
      s2:{ sep:188, dy:44.8, path:Kp([[185,118,0,75,63],[188,124,0,78,64],[200,150,0,86,67],[240,245,0,112,73],[300,430,0,150,80],[380,740,0,183,86],[460,1110,0,203,90],[546,1560,0,212,92],[585,1860,0,213,93]]),
        thr:[[193,0],[195,1],[546,1],[547,0]], pay:[[219,0],[220,2]] } },
    events:[[-10,'final countdown'],[-3,'27 Merlin engines start'],[0,'liftoff'],[72,'max Q: the hardest push of the air'],[150,'the side boosters cut off'],[152,'the side boosters separate'],[168,'the side boosters turn back to Florida'],[185,'centre core cutoff'],[188,'the centre core separates'],[195,'second stage engine start'],[220,'the fairing halves fall away'],[355,'side boosters: entry burns'],[440,'side boosters: landing burns'],[462,'both side boosters landed at Cape Canaveral, as on the first flight in 2018'],[540,'centre core: landing burn'],[547,'second stage engine cutoff'],[554,'the centre core landed on the droneship']],
    rate:[[-12,1],[18,2.5],[65,3.5],[145,1],[160,3],[215,10],[345,2],[430,1],[470,4],[535,1],[560,3],[585,1]],
    shots:[
      { t:-60, eye:['site', 'lc39a', [-330, 3, 450]], look:['part', 'core', 36], lens:['fit', 72, 0.62] },
      { t:-4.5, eye:['site', 'lc39a', [-120, 3, 155]], look:['part', 'core', 22], lens:['fit', 75, 0.75] },
      { t:5, eye:['site', 'lc39a', [30, 2, 34]], look:['part', 'core', 30], lens:1 },
      { t:12, eye:['site', 'lc39a', [-2500, 5, 1300]], look:['part', 'core', 36], lens:['fit', 72, 0.5] },
      { t:65, eye:['traj', 'core', [-240, -40, 90]], look:['part', 'core', 36], lens:['fit', 72, 0.5], lag:1 },
      { t:145, eye:['traj', 'core', [10, -30, -170]], look:['part', 'core', 30], lens:['fit', 60, 0.7], lag:1 },
      { t:160, eye:['traj', 'sideA', [140, 60, 60]], look:['part', 'sideA', 23], lens:['fit', 60, 0.5], lag:0.8 },
      { t:215, eye:['traj', 'sideA', [0, 350, 300]], look:['part', 'sideA', 23], lens:['fit', 50, 0.35], lag:0.6 },
      { t:345, eye:['traj', 'sideA', [180, -40, 60]], look:['part', 'sideA', 20], lens:['fit', 50, 0.45], lag:1 },
      { t:425, eye:['traj', 'sideA', [110, -12, 60]], look:['part', 'sideA', 20], lens:['fit', 50, 0.55], lag:1 },
      { t:458, eye:['site', 'lz', [0, 9, 235]], look:['site', 'lz', [0, 28, 0]], focus:'sideA', lens:1 },
      { t:470, eye:['traj', 'core', [150, 40, 60]], look:['part', 'core', 24], lens:['fit', 50, 0.45], lag:1 },
      { t:535, eye:['site', 'DS', [-72, 7, 96]], look:['part', 'core', 22], lens:['fit', 60, 0.5] },
      { t:560, eye:['traj', 's2', [40, 12, -60]], look:['part', 's2', 8], lens:1, lag:1 } ] },
  dragon:{ fam:'f9', name:'Crew Dragon', site:'slc40', az:44, end:1175, realEnd:760, h0:0.004, pay:1, dsS:465, jump:[760, 1000],
    stack:null, parts:{ core:null, s2:null,
      dragon:{ sep:720, dy:57.4 } },
    events:[[-10,'final countdown'],[-3,'nine Merlin engines start'],[0,'liftoff'],[72,'max Q: the hardest push of the air'],[148,'main engine cutoff'],[151,'stage separation'],[157,'second stage engine start'],[400,'the booster\'s entry burn'],[512,'the booster\'s landing burn'],[522,'second stage engine cutoff: in orbit'],[534,'the booster landed on the droneship'],[720,'Dragon separates from the second stage'],[1000,'about a day later: Dragon closes in on the space station'],[1045,'holding about 220 m out'],[1085,'holding about 20 m out'],[1150,'soft capture: docked']],
    rate:[[-12,1],[18,2.5],[65,3.5],[140,1],[175,3],[230,10],[390,2],[505,1],[545,5],[700,1],[760,1],[1000,1.5],[1030,4],[1045,2],[1060,4],[1085,1.5],[1100,3],[1130,1],[1175,1]],
    shots:[
      { t:-60, eye:['site', 'SITE', [-300, 3, 420]], look:['part', 'core', 36], lens:['fit', 72, 0.62] },
      { t:-4.5, eye:['site', 'SITE', [-115, 3, 150]], look:['part', 'core', 22], lens:['fit', 75, 0.75] },
      { t:5, eye:['site', 'SITE', [26, 2, 30]], look:['part', 'core', 30], lens:1 },
      { t:12, eye:['site', 'SITE', [-2200, 5, 1400]], look:['part', 'core', 36], lens:['fit', 72, 0.5] },
      { t:65, eye:['traj', 'core', [-230, -40, 80]], look:['part', 'core', 36], lens:['fit', 72, 0.5], lag:1 },
      { t:140, eye:['traj', 'core', [45, -12, -8]], look:['part', 'core', 46], lens:1.3, lag:1 },
      { t:175, eye:['traj', 's2', [60, 18, -90]], look:['part', 's2', 14], lens:['fit', 30, 0.5], lag:1 },
      { t:505, eye:['site', 'DS', [-72, 7, 96]], look:['part', 'core', 22], lens:['fit', 60, 0.5] },
      { t:545, eye:['traj', 's2', [50, 10, -40]], look:['part', 's2', 16], lens:1, lag:1 },
      { t:700, eye:['traj', 'dragon', [16, 6, 18]], look:['part', 'dragon', 3], lens:1, lag:1 },
      { t:1000, eye:['iss', [70, 26, 48]], look:['mid'], lens:1 },
      { t:1085, eye:['iss', [44, 9, 14]], look:['part', 'dragon', 6], lens:1 } ] },
};
// Falcon Heavy's side boosters fly back to Landing Zones 1 and 2; the Dragon mission flies Falcon 9's paths with Dragon on top
(() => {
  const fh = MIS.falconheavy, side = (sc, dz) => Kp([[150,54,dz/1000,51,55],[152,57,dz/1000,53,56],[158,63,dz*2/1000,57,20],[166,68,dz*4/1000,61,-60],[190,73,dz*8/1000,69,-80],[210,70,dz*10/1000,74,-85],[240,58,sc[1]*0.25,80,-60],[270,45,sc[1]*0.5,80,-30],[310,30,sc[1]*0.8,66,-8],[350,18,sc[1]*0.95,38,-3],[380,9,sc[1],15,-2],[395,sc[0] + 4,sc[1],9,-1.5],[420,sc[0] + 1,sc[1],3.8,-1],[440,sc[0] + 0.2,sc[1],1.3,0],[452,sc[0] + 0.02,sc[1],0.25,0],[460,sc[0],sc[1],0.03,0],[463,sc[0],sc[1],0.0003,0],[470,sc[0],sc[1],0.0003,0]]);
  const sthr = [[-3.2,0],[-2.6,0.7],[0,1],[151.5,1],[152,0],[167,0],[168,1],[210,1],[211,0],[354,0],[355,0.33],[368,0.33],[369,0],[439,0],[440,0.11],[462,0.11],[463,0]];
  fh.parts.sideA.path = side(LZ_SC[0], 4.1); fh.parts.sideA.thr = sthr;
  fh.parts.sideB.path = side(LZ_SC[1], -4.1); fh.parts.sideB.thr = sthr;
  const f9 = MIS.falcon9, dg = MIS.dragon;
  dg.stack = f9.stack;
  dg.parts.core = f9.parts.core;
  dg.parts.s2 = Object.assign({}, f9.parts.s2, { path:Kp([[148,62,0,58,56],[151,67,0,61,57],[160,80,0,69,60],[180,112,0,85,64],[220,190,0,112,70],[280,340,0,145,78],[360,610,0,176,85],[440,960,0,196,89],[522,1400,0,207,92],[600,1990,0,210,94],[680,2590,0,211,95],[760,3190,0,211,95]]), pay:[[0,1],[720,2]] });
})();

// ---------------------------------------------------------------- the objects: a stage per part (what the camera locks on), the pads and landing sites (drawn as clusters)
const SX = { runs:[], parts:{}, sites:{}, clusters:[], pend:null, nextReplay:25, trail:null, real:new Set(), dismissed:new Set() };
const LCAP = { txt:'', btn:'', go:null };   // the caption (and its button) while a launch is on (read by updateCaption in 09-render.js)
const SX_FACTS = {
  superheavy:'Starship\'s first stage, about 71 m tall, lifts off on 33 methane-fuelled Raptor engines. On 13 October 2024 the arms of its launch tower caught one in mid-air as it came back, seven minutes after launch.',
  starship:'The largest rocket ever flown: about 120 m tall with its Super Heavy booster (124 m in its newest version), lifting off on 33 Raptor engines. Both stages are built to be reused. Here it stands on the launch mount at Starbase, Texas, beside the tower whose arms catch the booster.',
  falcon9:'The rocket that made reuse routine: a 70 m two-stage rocket whose first stage lands itself on a ship at sea or back near the pad, then flies again. Some boosters have flown more than 30 times.',
  f9s2:'Falcon 9\'s upper stage carries the payload the rest of the way to orbit on a single Merlin Vacuum engine. It is not recovered.',
  dragon:'SpaceX\'s capsule for crew and cargo, 8.1 m tall with its trunk. Since May 2020 Crew Dragon has carried astronauts to and from the International Space Station; it docks by itself.',
  falconheavy:'Three Falcon 9 cores side by side, 27 engines at liftoff. On its first flight, on 6 February 2018, it sent a Tesla Roadster into orbit round the Sun, and both side boosters landed back at Cape Canaveral, seconds apart.',
  fhside1:'One of Falcon Heavy\'s two side boosters. They separate about two and a half minutes after liftoff, turn round and land back at Cape Canaveral a few seconds apart.',
  fhside2:'One of Falcon Heavy\'s two side boosters. They separate about two and a half minutes after liftoff, turn round and land back at Cape Canaveral a few seconds apart.',
  fhs2:'Falcon Heavy\'s upper stage: the same as Falcon 9\'s, with one Merlin Vacuum engine.',
};
const SX_AKA = {
  starship:'spacex starship super heavy ship elon musk mechazilla chopsticks starbase boca chica raptor rocket launch',
  superheavy:'spacex super heavy booster starship chopsticks catch mechazilla raptor',
  falcon9:'spacex falcon 9 f9 rocket booster droneship launch starlink cape canaveral',
  falconheavy:'spacex falcon heavy fh rocket side boosters roadster launch kennedy 39a',
  dragon:'spacex crew dragon capsule iss space station docking astronauts',
};
const SX_TYPE = { starship:'rocket · the largest ever flown · on its pad at Starbase', falcon9:'rocket · reusable first stage · on its pad at Cape Canaveral', falconheavy:'rocket · three Falcon 9 cores · on its pad at Kennedy', dragon:'capsule for crew and cargo · docked at the ISS' };
const ATLAS_SX = new Set(['starship', 'falcon9', 'falconheavy', 'dragon']);
for (const fk in FAM) for (const d of FAM[fk].parts){
  const inAtlas = ATLAS_SX.has(d.key);
  const o = addObj({ key:d.key, name:d.name, label:d.name.replace(/ second stage$/, ' stage 2').replace(/Falcon Heavy side booster/, 'side booster'), labelClass:'ship', type:SX_TYPE[d.key] || 'rocket stage', group:'travel', tags:['human'],
    fact:SX_FACTS[d.key], aka:SX_AKA[d.key] || 'spacex rocket', parent:earth, offset:[0, 0, 0], selfPos:false, rad:d.len*0.5*MET, layer:3, noImpostor:true, noTour:true, noWaypoint:true,
    minZoom:0.25, pxMin:1, visFn:() => 1, labelRange:4e-10, sortKey:1e-9, atlasDist:d.key === 'dragon' ? 'at the ISS' : 'on Earth', atlas:inAtlas, noPick:false,
    views:[{ d:[0.8, 0.22, 0.56], k:4.2, hold:9, drift:0.03 }, { d:[-0.6, 0.1, 0.8], k:2.6, hold:9, drift:-0.03 }],
    readout:() => sxReadout(o) });
  o.sx = { fam:fk, def:d, st:null };
  // (sorted by distance, the rockets on their pads come straight after Earth, in a fixed order, and Dragon with the station it docks at)
  const rank = ['starship', 'falcon9', 'falconheavy'].indexOf(d.key);
  if (inAtlas) o.distNow = d.key === 'dragon' ? () => V.len(BYKEY.iss.offset) : () => RE_KM*KM*(1 + (rank + 1)*1e-9);
  // (the line under the name: where it is now)
  Object.defineProperty(o, 'distEarth', { get(){ const st = o.sx.st; if (!st) return 'here on Earth';
    if (st.atISS) return 'in orbit around Earth, at the ISS'; if (st.alt > 0.3) return (st.alt < 10 ? st.alt.toFixed(1) : Math.round(st.alt)) + ' km up from the ground'; return 'here on Earth'; } });
  SX.parts[d.key] = o;
}
// the family of each part, by the mission's part id
const famPart = (fk, id) => SX.parts[FAM[fk].parts.find(p => p.id === id).key];
for (const k of ['starbase', 'lc39a', 'slc40', 'slc4e', 'lz']){
  const S = SXS[k];
  S.o = addObj({ key:'sx-' + k, name:S.name, label:'', type:'launch site', group:'travel', parent:earth, offset:V.mul(S.p, KM), rad:160*MET, layer:3, noPick:true, atlas:false, noLabel:true, noTour:true,
    noImpostor:true, pxMin:1, visFn:() => 1, labelRange:0, views:[{ d:[0.6, 0.3, 0.7], k:3, hold:9, drift:0.02 }] });
  S.o.sxSite = S;
}
// the droneships: one for Falcon 9 (and Dragon), one for Falcon Heavy's centre core; placed where each flight lands
const SX_DS = {};
for (const k of ['f9', 'fh']){
  const S = { key:'ds-' + k, name:'the droneship', short:'the droneship', kind:4, coast:[0, 0, -1e9], sea:true };
  S.o = addObj({ key:'sx-ds-' + k, name:'droneship', label:'', type:'autonomous landing ship', group:'travel', parent:earth, offset:[0, 0, 0], rad:60*MET, layer:3, noPick:true, atlas:false, noLabel:true, noTour:true,
    noImpostor:true, pxMin:1, visFn:() => 1, labelRange:0 });
  S.o.sxSite = S; SX_DS[k] = S;
}
function placeDS(S, site, az, s){ const A = azFrame(site, az), P = trajPoint(A, s, 0, 0, 0); S.up = P.up; S.F = enuOf(P.up); S.p = V.mul(P.up, RE_KM); S.yaw = Math.atan2(V.dot(A.dir, S.F.n), V.dot(A.dir, S.F.e)); }
placeDS(SX_DS.f9, SXS.slc40, 45, 465); placeDS(SX_DS.fh, SXS.lc39a, 90, 585);
const siteOf = (key, run) => key === 'SITE' ? SXS[run.site] : key === 'DS' ? SX_DS[run.mis.fam === 'fh' ? 'fh' : 'f9'] : SXS[key];

// ---------------------------------------------------------------- runs: one mission flying, with its clock
// mode: 'real' (the clock is the wall clock against the scheduled time), 'click' (waits on the pad at T-10 s until the camera has arrived),
// 'replay' (starts at T-10 s wherever the camera is). Ended runs keep their last frame until the camera has left them.
function newRun(key, mode, opt = {}){
  const mis = MIS[key]; if (!mis) return null;
  const pend = SX.pend;
  for (const r of SX.runs.filter(r => r.mis.fam === mis.fam)) endRun(r);
  SX.pend = pend;
  const run = { key, mis, mode, site:opt.site || mis.site, az:opt.az ?? mis.az, mt:opt.mt ?? (mode === 'real' ? -90 : -10.5), t0:opt.t0 || 0, label:opt.label || '', hold:mode === 'click', ended:false, born:GT, idleT:0, seen:false };
  if (mis.dsS) placeDS(SX_DS[mis.fam === 'fh' ? 'fh' : 'f9'], SXS[run.site], run.az, mis.dsS);
  run.A = azFrame(SXS[run.site], run.az);
  SX.runs.push(run);
  if (SX.pend && !SX.runs.includes(SX.pend.run) && SX.pend.run.mis.fam === mis.fam) SX.pend.run = run;   // (the camera on its way to this rocket watches the new flight)
  sxEval(run);
  return run;
}
function endRun(run){
  const i = SX.runs.indexOf(run); if (i >= 0) SX.runs.splice(i, 1);
  if (LCAM.run === run) stopLaunchCam(true);
  if (SX.pend && SX.pend.run === run) SX.pend = null;
}
const famRun = fk => SX.runs.find(r => r.mis.fam === fk);
// the state of every part of a family at mission time mt (run null: standing on its home pad)
function sxEval(run){
  const fk = run ? run.mis.fam : null;
  for (const fam of run ? [fk] : Object.keys(FAM)){
    if (!run && famRun(fam)) continue;
    const r = run || { mis:MIS[fam === 'star' ? 'starship' : fam === 'fh' ? 'falconheavy' : 'falcon9'], idle:true, mt:-600 };
    const mis = r.mis, siteK = run ? run.site : mis.site, A = run ? run.A : azFrame(SXS[siteK], mis.az), mt = r.mt;
    for (const d of FAM[fam].parts){
      const o = SX.parts[d.key], P = mis.parts[d.id];
      const st = o.sx.st || (o.sx.st = {});
      st.on = !!P; st.site = siteK;
      if (!P){ st.on = false; if (d.id === 'dragon') dockDragon(o); continue; }
      let pt, vel = [0, 0, 0], alt;
      if (d.id === 'dragon' && mt >= 1000){ dragonAtISS(o, mt); continue; }
      const own = P.path && mt >= P.sep, K = own ? P.path : mis.stack;
      const pathOwner = !own && d.id === 'dragon' ? mis.parts.s2 : null;
      const k = kAt(pathOwner && mt >= pathOwner.sep ? pathOwner.path : K, mt);
      let [s, c, h, pd] = k.v;
      pt = trajPoint(A, s, c, h, pd);
      let base = pt.p;
      if (!own){
        let dy = P.dy || 0; const dz = P.dz || 0;
        if (d.id === 'dragon'){ dy = mt >= (mis.parts.s2.sep || 1e9) ? 12.6 + Math.max(0, mt - P.sep)*0.4 : P.dy; }
        base = V.add(base, V.add(V.mul(pt.axis, dy*1e-3), V.mul(pt.left, dz*1e-3)));
      }
      alt = V.len(base) - RE_KM;
      vel = V.add(V.mul(pt.fwd, k.dv[0]), V.mul(pt.up, k.dv[2]));
      const thr = r.idle ? 0 : lin(P.thr || [[0, 0]], mt);
      const pay = P.pay ? lin(P.pay, mt) : (mis.pay ?? 0);
      Object.assign(st, { base, axis:pt.axis, left:pt.left, up:pt.up, fwd:pt.fwd, alt, vel, speed:V.len(vel), s, thr,
        legs:P.legs ? lin(P.legs, mt) : 0, fins:P.fins ? lin(P.fins, mt) : 0, pay:d.id === 's2' ? Math.round(pay) : 0, attached:!own, hidden:false, atISS:false });
      if (d.id === 'dragon') st.hidden = mt < P.sep;   // (riding on the second stage it is drawn as its payload)
      if (fam === 'fh' && !run && famRun('f9') && famRun('f9').site === 'lc39a') st.hidden = true;   // (Falcon 9 is using its pad)
      placePart(o, st);
    }
  }
}
function placePart(o, st){
  const c = V.add(st.base, V.mul(st.axis, o.sx.def.len*0.5e-3));
  o.offset = V.mul(M3.apply(earth.rot, c), KM);
  o.pos = V.add(earth.pos, o.offset);   // (now, not on the next tick: the engine reaches Earth from the camera's focus through pos)
  const z = st.left, y = st.axis, x = V.cross(y, z);
  st.Mf = [...x, ...y, ...z];
  o.R0 = o.rot = M3.mul(earth.rot, st.Mf);
  o.hidden = !!st.hidden || !st.on;
}
// Dragon at the ISS: docked at the forward port (the ISS model's +x end, 29 m out), or closing in along that axis during a mission
const ISS_PORT = 29;
const transposeRot = R => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
function issFrame(){ const iss = BYKEY.iss; return { c:M3.applyT(earth.rot, V.mul(iss.offset, 1/KM)), M:M3.mul(transposeRot(earth.rot), iss.R0) }; }
function dockAt(o, dist, lat){
  const I = issFrame(), X = M3.apply(I.M, [1, 0, 0]), Y = M3.apply(I.M, [0, 1, 0]), Z = M3.apply(I.M, [0, 0, 1]);
  const st = o.sx.st || (o.sx.st = {});
  const nose = V.mul(X, -1), base = V.add(I.c, V.add(V.mul(X, (ISS_PORT + 8.4 + dist)*1e-3), V.add(V.mul(Y, lat[0]*1e-3), V.mul(Z, lat[1]*1e-3))));
  Object.assign(st, { on:true, base, axis:nose, left:Z, up:Y, fwd:X, alt:V.len(base) - RE_KM, vel:[0, 0, 0], speed:0, thr:0, legs:0, fins:0, pay:0, attached:false, hidden:false, atISS:true, dist });
  placePart(o, st);
}
function dockDragon(o){ if (BYKEY.iss) dockAt(o, 0, [0, 0]); }
function dragonAtISS(o, mt){ const d = lin([[1000, 400], [1030, 235], [1045, 220], [1060, 220], [1080, 20], [1100, 20], [1140, 0.6], [1150, 0]], mt), l = lin([[1000, 25], [1045, 6], [1080, 1], [1150, 0]], mt); dockAt(o, d, [l, -l*0.6]); }

// ---------------------------------------------------------------- clusters: what is drawn together, in one ray march
// Parts within 300 m of a site (and below 600 m) are drawn with it; the rest group with any part within 160 m.
const SITE_LIST = () => [...Object.values(SXS), SX_DS.f9, SX_DS.fh];
function buildClusters(){
  const cl = [];
  const sites = SITE_LIST();
  for (const S of sites){ S.cl = null; }
  for (const k in SX.parts){ const o = SX.parts[k], st = o.sx.st; o.sx.drawnBy = null; if (!st || o.hidden) continue;
    let home = null;
    if (st.alt < 0.6) for (const S of sites){ if (V.len(V.sub(st.base, S.p)) < 0.3){ home = S; break; } }
    if (home){ if (!home.cl){ home.cl = { anchor:home.p, F:home.F, site:home, parts:[], owner:home.o }; cl.push(home.cl); } if (home.cl.parts.length < 4){ home.cl.parts.push(o); o.sx.drawnBy = home.cl; } continue; }
    let g = cl.find(c => !c.site && c.parts.length < 4 && V.len(V.sub(c.anchor, st.base)) < 0.16);
    if (!g){ g = { anchor:st.base, F:enuOf(V.norm(st.base)), site:null, parts:[], owner:o }; cl.push(g); }
    g.parts.push(o); o.sx.drawnBy = g;
  }
  // sites with nothing on them are still drawn (the empty pad, the tower, the droneship)
  for (const S of sites) if (!S.cl) { S.cl = { anchor:S.p, F:S.F, site:S, parts:[], owner:S.o }; cl.push(S.cl); }
  // each cluster's bounding sphere (Earth-fixed km centre, radius m), covering the parts, their plumes and the site
  for (const c of cl){
    const pts = [];
    if (c.site) { const r = c.site.kind === 1 ? 175 : c.site.kind <= 3 ? 95 : c.site.kind === 4 ? 55 : 290; pts.push([V.add(c.site.p, V.mul(c.site.up, (c.site.kind === 1 ? 70 : 20)*1e-3)), r]); }
    for (const o of c.parts){ const st = o.sx.st, L = o.sx.def.len, pl = plumeOf(o);
      pts.push([V.add(st.base, V.mul(st.axis, L*0.5e-3)), L*0.5 + 9]);
      if (st.thr > 0.01) pts.push([V.add(st.base, V.mul(st.axis, -pl.L*0.5e-3)), pl.L*0.5 + pl.r0 + pl.L*pl.sp]); }
    let C = pts[0][0], R = pts[0][1];
    for (const [p, r] of pts.slice(1)){ const d = V.len(V.sub(p, C))*1000; if (d + r <= R) continue; if (R + d <= r){ C = p; R = r; continue; } const nr = (R + d + r)/2; C = V.add(C, V.mul(V.sub(p, C), (nr - R)/d)); R = nr; }
    // (the ground cloud round a pad, while a flight is on)
    if (c.site && SX.runs.some(r => r.site === c.site.key)) R = Math.max(R, c.site.kind === 1 ? 290 : 200);
    c.C = C; c.R = R*1.04;
  }
  SX.clusters = cl;
}
// a part's plume: length, radius at the nozzles and how fast it widens, opening up with altitude
function plumeOf(o){
  const st = o.sx.st, [L0, r0] = o.sx.def.pl, h = st.alt || 0, vac = o.sx.def.type === 6 ? 1 : smooth(12, 70, h);
  const eng = st.thr > 0 ? 0.45 + 0.55*Math.sqrt(st.thr) : 1;
  return { L:L0*(0.55 + 0.45*eng)*(1 + 3.5*vac), r0:r0*eng, sp:0.035 + 0.55*vac };
}
// ---------------------------------------------------------------- drawing
const SXU = { pt:new Float32Array(16), pa:new Float32Array(16), pb:new Float32Array(16), pc:new Float32Array(16) };
function sunFixed(){ return M3.applyT(earth.rot, sunDirFrom(earth)); }
function drawCluster(c, vis){
  const fam = c.site ? (c.site.kind === 1 ? 'star' : 'fal') : (c.parts[0].sx.fam === 'star' ? 'star' : 'fal');
  const pr = fam === 'star' ? P.sxStar : P.sxFal;
  const Rw = M3.mul(earth.rot, c.F.M), toL = x => M3.applyT(c.F.M, V.mul(V.sub(x, c.C), 1000));
  const rel = V.add(earth.rel, V.mul(M3.apply(earth.rot, c.C), KM));
  SXU.pt.fill(0); SXU.pa.fill(0); SXU.pb.fill(0); SXU.pc.fill(0);
  let pl = null, plI = 0;
  c.parts.forEach((o, i) => {
    const st = o.sx.st, d = o.sx.def, b = toL(st.base), ax = M3.applyT(c.F.M, st.axis), sd = M3.applyT(c.F.M, V.cross(st.axis, st.left)), P = plumeOf(o);
    const thr = st.thr > 0.005 ? 0.55 + 0.45*st.thr : 0;
    SXU.pt.set([b[0], b[1], b[2], d.type], i*4); SXU.pa.set([ax[0], ax[1], ax[2], thr], i*4);
    SXU.pb.set([sd[0], sd[1], sd[2], d.type === 6 ? st.pay : d.type === 2 ? 0.25 : st.legs], i*4); SXU.pc.set([P.L, P.r0, P.sp, st.fins], i*4);
    if (thr > plI){ plI = thr; pl = V.add(b, V.mul(ax, -P.L*0.25)); }
  });
  const L = M3.applyT(c.F.M, sunFixed()), day = smooth(-0.12, 0.12, V.dot(sunFixed(), c.F.up));
  const S = c.site, run = S ? SX.runs.find(r => r.site === S.key || (S.kind === 4 && SX_DS[r.mis.fam === 'fh' ? 'fh' : 'f9'] === S) || (S.kind === 5 && r.mis.fam === 'fh')) : null;
  drawVolume(c.owner, pr, rel, c.R*MET, p => {
    gl.uniform4fv(p.u.uPt, SXU.pt); gl.uniform4fv(p.u.uPa, SXU.pa); gl.uniform4fv(p.u.uPb, SXU.pb); gl.uniform4fv(p.u.uPc, SXU.pc);
    const so = S ? toL(S.p) : [0, -1e6, 0];
    gl.uniform4f(p.u.uSo, so[0], so[1], so[2], S && S.kind === 4 ? S.yaw || 0 : 0);
    const mt = run ? run.mt : -600, pad = MIS.starship.pad, smt = run && run.mis.fam === 'star' ? mt : -600;
    const chopH = S && S.kind === 1 ? lin(pad.chopH, smt) : 0, chopO = S && S.kind === 1 ? lin(pad.chopOpen, smt) : 1;
    const sw = S && S.kind === 1 ? lin(pad.qd, smt) : lin([[-600, 0], [-5, 0], [-2, 0.035]], run && S.key === run.site ? mt : -600);
    gl.uniform4f(p.u.uSt, S ? S.kind : 0, chopH, chopO, sw);
    gl.uniform4f(p.u.uLt, L[0], L[1], L[2], day);
    gl.uniform4f(p.u.uPl, pl ? pl[0] : 0, pl ? pl[1] : 0, pl ? pl[2] : 0, plI*(0.35 + 1.4*(1 - day)));
    const cd = run && S ? cloudOf(run, S) : null;
    if (cd){ const cc = toL(cd.at); gl.uniform4f(p.u.uCl, cc[0], cc[1], cc[2], cd.age); gl.uniform4f(p.u.uCl2, cd.k, cd.steam, cd.size, cd.vent); }
    else { gl.uniform4f(p.u.uCl, 0, 0, 0, -1); gl.uniform4f(p.u.uCl2, 0, 1, 1, 0); }
    gl.uniform4f(p.u.uDim, c.R, GT, 0, 0.37);
  }, Rw, vis);
}
// the ground cloud: at the pad from engine start, at the landing site as the booster comes down
function cloudOf(run, S){
  const mis = run.mis, mt = run.mt;
  if (S.key === run.site){
    const cl = mis.cloud || { strength:[[-3.2, 0], [-2.2, 0.8], [30, 0.8], [90, 0.3], [180, 0]], steam:0.55, vent:[[-60, 0.6], [-3, 0.3], [1, 0]] };
    return { at:S.p, age:Math.min(Math.max(mt + 3.2, 0), 45), k:lin(cl.strength, mt), steam:cl.steam, size:mis.fam === 'star' ? 1.1 : 0.75, vent:lin(cl.vent, mt) };
  }
  // a small cloud of spray or dust as a booster lands
  const land = mis.fam === 'fh' ? (S.kind === 5 ? 440 : 540) : mis.fam === 'f9' ? 512 : -1;
  if (land > 0 && mt > land - 2) return { at:S.p, age:mt - land, k:lin([[land, 0], [land + 8, 0.55], [land + 40, 0.2], [land + 90, 0]], mt), steam:S.kind === 4 ? 0.9 : 0.4, size:0.45, vent:0 };
  return null;
}
// every cluster draws through its owner's drawBefore (so it sorts with everything else by distance)
for (const o of [...Object.values(SX.parts), ...Object.values(SXS).map(S => S.o), SX_DS.f9.o, SX_DS.fh.o]){
  o.drawBefore = vis => { if (!FLAGS.spacex) return; for (const c of SX.clusters) if (c.owner === o && sxCamNear(c)) drawCluster(c, 1); };
}
// only clusters that could cover more than a character or so are drawn
function sxCamNear(c){ const rel = V.add(earth.rel, V.mul(M3.apply(earth.rot, c.C), KM)), d = V.len(rel)/MET; return c.R/Math.max(d, 1) > 0.0015; }
// the ground and sky near a launch site, drawn just after Earth
const SXENV = { on:false };
{ const prev = earth.drawAfter; earth.drawAfter = vis => { if (prev) prev(vis); if (FLAGS.spacex) drawEnv(); }; }
function camFixed(){ return M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)); }
function drawEnv(){
  const cf = camFixed(), alt = V.len(cf) - RE_KM;
  SXENV.on = false; if (alt > 90 || alt < -1) return;
  let best = null, bd = 1e9;
  for (const S of SITE_LIST()){ const d = V.len(V.sub(cf, S.p)); if (d < bd){ bd = d; best = S; } }
  if (!best || bd > 700) return;
  const fade = (1 - smooth(22, 85, alt))*(1 - smooth(350, 700, bd));
  if (fade < 0.01) return;
  SXENV.on = true; SXENV.site = best; SXENV.alt = alt;
  const Rw = M3.mul(earth.rot, best.F.M), cl = M3.applyT(best.F.M, V.mul(V.sub(cf, best.p), 1000)), L = M3.applyT(best.F.M, sunFixed()), day = smooth(-0.12, 0.12, L[1]);
  let pl = [0, 0, 0], plI = 0;
  for (const k in SX.parts){ const st = SX.parts[k].sx.st; if (!st || !st.on || SX.parts[k].hidden || !(st.thr > plI) || st.alt > 20) continue; plI = st.thr; pl = M3.applyT(best.F.M, V.mul(V.sub(st.base, best.p), 1000)); }
  const rel = V.add(earth.rel, V.mul(M3.apply(earth.rot, best.p), KM));
  drawVolume(earth, P.sxEnv, rel, V.len(rel)*4 + 1e-3, p => {
    gl.uniform4f(p.u.uP0, cl[0], cl[1], cl[2], fade); gl.uniform4f(p.u.uP1, L[0], L[1], L[2], day);
    gl.uniform4f(p.u.uP2, best.coast[0], best.coast[1], best.coast[2], best.kind === 4 ? 1 : 0);
    gl.uniform4f(p.u.uP3, pl[0], pl[1], pl[2], plI*(0.4 + 1.6*(1 - day))); gl.uniform4f(p.u.uP4, GT, 0, 0, 0);
  }, Rw, 1);
}
// ---------------------------------------------------------------- seen from far away: the trail of a flight, glowing where the exhaust is in sunlight (the "jellyfish" of
// twilight launches), drawn as points in Earth's frame. The head's own plume is drawn as a cluster only close up.
// Seen from thousands of km a real trail is a few pixels long, so from far away it is drawn wider than life (X, up to 10 times) and the
// burning stages carry a bright glow (SXTR.hd) that marks where the flight is.
const SXTR = { n:220, ps:null, hd:null };
SXTR.ps = makePS(SXTR.n); SXTR.ps.upload('ac'); SXTR.hd = makePS(4); SXTR.hd.upload('ac');
earth.particles.push({ ps:SXTR.ps, prog:'ptBasic', mode:3, sb:1.5, size:3, rot:() => earth.rot, rad:6371*KM*1.12, show:() => FLAGS.spacex && SXTR.on, vis:() => SXTR.vis });
earth.particles.push({ ps:SXTR.hd, prog:'ptBasic', mode:3, sb:3.2, size:8, rot:() => earth.rot, rad:6371*KM*1.12, show:() => FLAGS.spacex && SXTR.on, vis:() => SXTR.vis });
function updateTrail(){
  const run = SX.runs.find(r => r.mt > 0 && !r.ended && r.mt < r.mis.end), ps = SXTR.ps;
  SXTR.on = false; if (!run) return;
  const cf = camFixed(), head = SX.parts[FAM[run.mis.fam].parts[0].key].sx.st;
  const dHead = V.len(V.sub(cf, head.base));
  SXTR.vis = smooth(30, 160, dHead); if (SXTR.vis < 0.01) return;
  SXTR.on = true;
  const sun = sunFixed(), B = 6371*1.12, mis = run.mis, A = run.A, X = clamp(V.len(cf)/2500, 1, 10);
  const ids = Object.keys(mis.parts).filter(id => mis.parts[id] && id !== 'dragon'), per = Math.floor(SXTR.n/ids.length);
  let k = 0;
  const lcg = (() => { let s = 91; return () => (s = (s*1664525 + 1013904223) >>> 0)/4294967296; })();
  // (points behind the Earth, seen from the camera, are left out: points are not depth-tested against the planet's volume)
  const behind = p => { const d = V.sub(p, cf), dd = V.dot(d, d), t = -V.dot(cf, d)/dd; return t > 0 && t < 1 && V.len(V.add(cf, V.mul(d, t))) < RE_KM*1.001; };
  for (const id of ids){
    const P = mis.parts[id];
    for (let j=0;j<per;j++){
      const u = j/(per - 1), t = Math.max(0, run.mt - 150*(1 - u)*(1 - u)), own = P.path && t >= P.sep;
      if (t <= 0.5 || (P.path && own === false && id !== ids[0])){ ps.a.set([0, 0, 0, 0], k*4); k++; continue; }
      const kk = kAt(own ? P.path : mis.stack, t), [s, c, h] = kk.v, pt = trajPoint(A, s, c, h, 0), thr = lin(P.thr || [[0, 0]], t);
      // the exhaust opens into a wide glowing cloud high up (tens of km across above 100 km), lit only where the Sun reaches it
      const spread = (0.3 + 30*smooth(40, 160, h))*(1 - u*0.6)*X, off = V.mul(V.norm([lcg() - 0.5, lcg() - 0.5, lcg() - 0.5]), spread*lcg());
      const p = V.add(pt.p, off), lit = V.dot(p, sun) > 0 || V.len(V.sub(p, V.mul(sun, V.dot(p, sun)))) > RE_KM ? 1 : 0;
      const b = behind(p) ? 0 : (thr > 0.01 ? 1.2 : 0.35)*(0.25 + 0.75*u)*(0.35 + 0.65*lit)*(h > 3 ? 1 : 0.6);
      ps.a.set([p[0]/B, p[1]/B, p[2]/B, b], k*4);
      const cc = lit && h > 60 ? [0.62, 0.8, 1] : thr > 0.01 ? [0.85, 0.92, 1] : [0.6, 0.7, 0.85];   // (bluish white: city lights are orange)
      ps.c.set([cc[0], cc[1], cc[2], 0], k*4); k++;
    }
  }
  for (; k < SXTR.n; k++) ps.a.set([0, 0, 0, 0], k*4);
  ps.upload('ac');
  // the glow on each burning stage
  let j = 0;
  for (const d of FAM[mis.fam].parts){ const st = SX.parts[d.key].sx.st; if (j > 3 || !st || !st.on || SX.parts[d.key].hidden) continue;
    const on = st.thr > 0.01 && st.alt > 0.05, p = V.add(st.base, V.mul(V.norm(st.base), 2)), b = on && !behind(p) ? 1 : 0;
    SXTR.hd.a.set([p[0]/B, p[1]/B, p[2]/B, b*(0.85 + 0.15*Math.sin(GT*9 + j))], j*4); SXTR.hd.c.set([1, 1, 1, 0], j*4); j++; }
  for (; j < 4; j++) SXTR.hd.a.set([0, 0, 0, 0], j*4);
  SXTR.hd.upload('ac');
}
seed = SX_SEED;

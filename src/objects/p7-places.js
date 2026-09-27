// ================================================================ content pack (0.9.0): new places that reuse the shared builders
// Vesta and Bennu (FS_ROCK shapes 3 and 4), three planets of other stars (FS_PLANETG kinds 21 to 23), Gaia BH3 (quietHole), T Coronae Borealis
// (novaBinary), the Lagoon Nebula and the Great Hercules Cluster. Mimas and its crater Herschel are in o10-planet.js.
// Real positions and sizes; what is sped up or guessed says so in its readout.
// (this pack draws its random numbers from the shared seeded rnd() and then puts the seed back, so everything made after it,
// the Halo's route included, gets the same numbers as before the pack existed)
const P7_SEED = seed;

// ---------------------------------------------------------------- Vesta: the brightest asteroid, with a crater as wide as itself at its south pole
// orbit: osculating elements from JPL Horizons for 2026-09-27; pole and spin: IAU (WGCCRE 2015)
const vesta = addRock({ key:'vesta', tags:['moons'], name:'Vesta', label:'Vesta', type:'asteroid · the brightest in our sky', shape:3, rad:310*KM, sizeR:262.7*KM, sortKey:2.36,
  el:{ a:2.361241, e:0.090230, i:7.143879, om:103.6998, w:151.4364, tp:2460901.4973 }, orbitCol:[0.55, 0.6, 0.78], R0:poleFrame(309.031, 42.235),
  farLum:0.5, farColor:[0.85, 0.82, 0.76], labelRange:1.5*AU_LY, pxMin:6,
  tick(){ this.rot = bodyFrame(309.031, 42.235, 285.39 + 1617.3329428*(jdNow() - 2451545)); },
  fact:'The second-heaviest body in the asteroid belt, a squashed ball about 525 km across. A giant impact dug Rheasilvia, a crater about 500 km wide around its south pole, and left a mountain in the middle about 22 km high. NASA\'s Dawn orbited Vesta in 2011 and 2012.',
  aka:'4 vesta asteroid rheasilvia divalia dawn protoplanet hed meteorites',
  // (the second angle looks up at the south pole from the sunward side, so Rheasilvia and its peak are in view with the Sun low over them)
  views:[{dirFn:() => sunSide(vesta, 0.8, 0.35), k:3.4, hold:8, drift:0.04},
    {dirFn:() => { const S = M3.apply(vesta.R0, [0, -1, 0]), L = sunDirFrom(vesta); return V.norm(V.add(S, V.mul(L, 0.9))); }, k:2.1, hold:9, drift:0.02},
    {dirFn:() => sunSide(vesta, 1.45, 0.06), k:2.3, hold:8, drift:0.03}],
  readout:() => `${heliocentric(vesta).toFixed(2)} AU from the Sun · 573 x 557 x 446 km\nRheasilvia is 505 km wide; its central peak rises about 22 km` });

// ---------------------------------------------------------------- Bennu: the rubble pile OSIRIS-REx brought a sample home from
// orbit: osculating elements from JPL Horizons for 2026-09-27; pole and spin period: JPL small-body database
const bennu = addRock({ key:'bennu', tags:['moons'], name:'Bennu', label:'Bennu', type:'near-Earth asteroid · a spinning top of rubble', shape:4, rad:0.28*KM, sizeR:0.245*KM, sortKey:1.126,
  el:{ a:1.125915, e:0.203677, i:6.033018, om:1.966547, w:66.40066, tp:2461112.6645 }, orbitCol:[0.62, 0.52, 0.45], R0:poleFrame(85.45, -60.37),
  tick(){ this.rot = bodyFrame(85.45, -60.37, 2011.145*(jdNow() - 2451545)); },
  fact:'A loose pile of rubble about 500 m wide, shaped like a spinning top, with a ridge round its middle and boulders everywhere. NASA\'s OSIRIS-REx scooped up 121.6 g of it and dropped the sample off at Earth on 24 September 2023. It has a 1 in 2,700 chance of hitting Earth in 2182.',
  aka:'101955 bennu 1999 rq36 osiris-rex osiris rex sample return near-earth asteroid',
  // (the second angle is side-on from its equator, where the spinning-top outline shows best)
  views:[{dirFn:() => sunSide(bennu, 0.8, 0.35), k:3.4, hold:8, drift:0.04},
    {dirFn:() => sunSide(bennu, 1.15, 0.02), k:2.6, hold:8, drift:0.02},
    {dirFn:() => sunSide(bennu, 1.35, 0.3), k:1.75, hold:9, drift:0.02}],
  readout:() => `${heliocentric(bennu).toFixed(2)} AU from the Sun · 565 x 535 x 508 m\none turn every 4.3 hours · one lap of the Sun every 437 days` });

// ---------------------------------------------------------------- planets of other stars
// (their periods are sped up so you can see them move; the readout gives the real one. Their host stars stay out of the atlas list)
// the views turn with the planet round its star (track), so each keeps its phase: the day side, half lit, and closer in from above its
// orbit, over the line between day and night. (Each planet's frame is its star's, so 'horizontal' in sunSide is the plane of its orbit.)
// (a thin crescent with the star beyond the limb looked empty: a sliver of light and half a star at the edge of the screen; and from
// closer in the old third angle's lit edge fell off a phone's screen)
const exoViews = b => { b.R0 = b.host.R0; return [{track:() => sunSide(b, 0.65, 0.25), k:3, hold:8}, {track:() => sunSide(b, 1.7, 0.15), k:3.4, hold:9}, {track:() => sunSide(b, 1.3, 0.75), k:2.4, hold:9}]; };
// K2-18 b and HD 189733 b pass in front of their stars, so we see their orbits almost edge-on (tilted 89.6 and 85.7 degrees): their stars get
// a frame whose orbit plane (local xz) is tilted that way to our line of sight
const edgeOn = (pos, inc) => { const c = Math.cos(inc*DEG), s = Math.sqrt(1 - c*c), h = V.norm([0.3, 0, 1]); return facingEarth(pos, [h[0]*s, c, h[2]*s], 0); };
// 51 Pegasi b: the first planet found around a Sun-like star (1995)
const peg51 = namedStar('peg51', '51 Pegasi', hms(22,57,27.98), dms(20,46,7.8), 50.6, 1.152, 5768, { label:'51 Peg', atlas:false, type:'Sun-like star · Helvetios',
  star:{ cells:36, act:0.3 }, bound:8, farLum:0.6, labelRange:400, aka:'51 pegasi helvetios',
  fact:'A Sun-like star a little older than the Sun. In 1995 it became the first star like the Sun known to have a planet.', readout:() => '50.6 light-years · about 5,770 K, as hot as the Sun' });
const peg51b = exoPlanet({ key:'peg51b', name:'51 Pegasi b', host:peg51, type:'the first planet found around a Sun-like star · Dimidium', R:69911, kind:21, a:0.0527, P:40, locked:true, sortKey:50.6001,
  aka:'dimidium 51 peg b hot jupiter mayor queloz nobel first exoplanet',
  fact:'Found in 1995 by Michel Mayor and Didier Queloz, who won half of the 2019 Nobel Prize in Physics for it. A gas giant a little over half Jupiter\'s mass, it circles its star every 4.2 days, far closer than Mercury is to the Sun.',
  readout:() => 'orbit 4.2 days (sped up here) at 0.05 AU · 50.6 light-years\nit never passes in front of its star, so its width is unknown: drawn Jupiter-sized, colours a guess' });
peg51b.views = exoViews(peg51b);
orbitRing(peg51, 0.0527, [0.62, 0.55, 0.45]);
// K2-18 b: a world between Earth and Neptune in size, in its star's habitable zone, whose air JWST has analysed
const k218 = namedStar('k218', 'K2-18', hms(11,30,14.52), dms(7,35,18.3), 124.3, 0.469, 3645, { atlas:false, type:'red dwarf in Leo', R0:edgeOn(radec(hms(11,30,14.52), dms(7,35,18.3), 124.3), 89.6),
  star:{ cells:30, act:0.8, prom:0.4 }, bound:20, farLum:0.25, labelRange:600, aka:'k2 18',
  fact:'A cool red dwarf about half the Sun\'s width, with two known planets.', readout:() => '124 light-years · about 3,600 K' });
const k218b = exoPlanet({ key:'k218b', name:'K2-18 b', host:k218, type:'sub-Neptune in the habitable zone · studied by JWST', R:2.61*6371, kind:22, a:0.1429, P:60, sortKey:124.3001,
  aka:'k2 18b hycean ocean world jwst methane dms habitable zone leo',
  fact:'A world 2.6 times Earth\'s width and 8.6 times its mass, orbiting where its star\'s warmth could allow liquid water. In 2023 JWST found methane and carbon dioxide in its hydrogen-rich air, and it may hide a deep ocean. A claimed hint of dimethyl sulfide, a gas that on Earth comes only from living things, has not been confirmed, and it can also form without life.',
  readout:() => 'orbit 33 days (sped up here) at 0.14 AU · 124 light-years\nJWST measured its gases, not its looks: the colours are a guess' });
k218b.views = exoViews(k218b);
orbitRing(k218, 0.1429, [0.5, 0.62, 0.75]);
// HD 189733 b: the deep blue planet Hubble measured the colour of (2013)
const hd189733 = namedStar('hd189733', 'HD 189733', hms(20,0,43.71), dms(22,42,39.1), 64.5, 0.805, 4875, { atlas:false, type:'orange dwarf in Vulpecula', R0:edgeOn(radec(hms(20,0,43.71), dms(22,42,39.1), 64.5), 85.7),
  star:{ cells:36, act:0.6 }, bound:6.5, farLum:0.5, labelRange:500, aka:'hd 189733 a',
  fact:'An orange dwarf a little smaller than the Sun, with a red dwarf partner far out and a giant planet close in.', readout:() => '64.5 light-years · about 4,900 K' });
const hd189733b = exoPlanet({ key:'hd189733b', name:'HD 189733 b', host:hd189733, type:'the deep blue planet · it may rain glass', R:1.13*69911, kind:23, a:0.031, P:36, locked:true, sortKey:64.5001,
  aka:'blue planet glass rain hot jupiter vulpecula hubble azure',
  fact:'A gas giant a little bigger than Jupiter. In 2013 Hubble found it is a deep azure blue, from a hazy sky thought to be laced with silicate particles. It is about 1,000 °C there, and it may rain glass, sideways, in 7,000 km/h winds.',
  readout:() => 'orbit 2.2 days (sped up here) at 0.031 AU · 64.5 light-years\nHubble measured its blue; the cloud bands are drawn' });
hd189733b.views = exoViews(hd189733b);
orbitRing(hd189733, 0.031, [0.45, 0.55, 0.85]);

// ---------------------------------------------------------------- Gaia BH3: the heaviest black hole of stellar origin found in the Milky Way (2024)
const gaiabh3 = quietHole({ M:33, dist:1926, pos:radec(hms(19,39,18.71), dms(14,55,54), 1926), A:16.55*AU_LY, E:0.728, PER:40, face:[0.35, 0.8, 0.3], k0:2.2, lineSb:0.8,
  obj:{ key:'gaiabh3', name:'Gaia BH3', label:'Gaia BH3', type:'dormant black hole · 33 Suns · the heaviest from a star in our galaxy', aka:'gaia bh3 dormant black hole aquila heaviest stellar',
    fact:'A black hole 33 times the Sun\'s mass, 1,926 light-years away in Aquila: the heaviest found in our galaxy that was made by a star. It gives off no light; Gaia found it in 2024 from the wobble of an ancient giant star that circles it every 11.6 years.' },
  star:{ key:'gaiabh3-star', name:'Gaia BH3 companion', label:'old giant star', R:4.94, T:5212, star:{ cells:24, act:0.2 }, farLum:1.4,
    fact:'A giant star that formed in the first two billion years after the Big Bang, with very little iron in it.' },
  readout:() => 'event horizon about 195 km across · 33 times the Sun\'s mass\nits star swings between 4.5 and 28.6 AU from it (the orbit is sped up here)' });

// ---------------------------------------------------------------- T Coronae Borealis, the Blaze Star: a recurrent nova that erupts about every 80 years
// a red giant (published masses 0.7 to 1.1 Suns) and a white dwarf of about 1.37 Suns, 228 days a lap: about 0.93 AU apart for the lighter giant
const tcrb = novaBinary({ mu1:0.335, RD:0.25, dist:3000, pos:radec(hms(15,59,30.16), dms(25,55,12.6), 3000), rad:1.86*AU_LY, face:[0.2, 0.5, 1],
  obj:{ key:'tcrb', name:'T Coronae Borealis', label:'T CrB', type:'recurrent nova · the Blaze Star', aka:'t crb blaze star nova corona borealis recurrent',
    fact:'A red giant and a white dwarf, 3,000 light-years away. About every 80 years, gas that the white dwarf has pulled off the giant explodes on the dwarf\'s surface, and for a few days the pair can be seen without a telescope. It last erupted in 1946, and before that in 1866.' },
  readout:(tn, NOVA) => tn < 12 ? 'the nova, replayed: hydrogen piled on the white dwarf explodes\nfor a few days you could see it without a telescope' :
    `the two stars circle each other every 228 days (shown ~18 s)\nlast erupted in 1946 · the replay here comes every ${NOVA} s` });

// ---------------------------------------------------------------- the Lagoon Nebula (M8): a star nursery cut by a dark lane of dust
const FS_LAGOON = COMMON + `
// local radius 1 = 60 light-years, +z toward Earth: a long glowing cloud crossed by the dark lane that gives it its name, the bright Hourglass
// around the young star Herschel 36 on one side, the young cluster NGC 6530 on the other
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(40., 70., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  vec3 HG = vec3(-0.3, 0.04, 0.06);
  for(int i=0;i<70;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    vec3 w = vec3(fbm3(p*2.2 + 3.), fbm3(p*2.2 + 9.), fbm3(p*2.2 + 15.)) - 0.5;
    vec3 q = p + w*0.4;
    float body = smoothstep(1., 0.3, length(q*vec3(1.05, 2.1, 2.3)));
    if(body < 0.002) continue;
    float g = fbmW(p*3. + vec3(0., 0., tm*0.003)), fil = pow(ridge(p*4.5 + w*2.), 3.);
    vec3 hq = p - HG; float core = exp(-dot(hq, hq)*40.);
    float em = body*(0.06 + 2.6*g*g*g + 0.9*fil*g) + core*(0.6 + 2.2*g*g);
    vec3 c = mix(vec3(1., 0.3, 0.42), vec3(1., 0.52, 0.45), g);
    c = mix(c, vec3(1., 0.8, 0.62), core*0.7);
    c = mix(c, vec3(0.45, 0.9, 0.85), smoothstep(0.62, 0.85, fbm3(p*4. + 2.))*0.3);
    // the lagoon: a lane of dust crossing the cloud, in front of it; and dark globules
    float lx = p.x + 0.02 - 0.3*p.y - 0.07*sin(p.y*6. + 1.) + 0.12*(fbm3(p*3.5 + 11.) - 0.5);
    float lane = smoothstep(0.065, 0.0, abs(lx) - 0.03*fbm3(p*7.))*smoothstep(-0.2, 0.15, p.z)*smoothstep(0.55, 0.2, abs(p.y))*(0.45 + 0.8*fbm3(p*5. + 3.));
    float glob = smoothstep(0.66, 0.82, fbm3(p*8. + 30.))*smoothstep(0., 0.25, p.z)*body;
    col += T*c*em*dt*3.;
    T *= exp(-(lane*10. + glob*5.)*dt);
    if(T < 0.01) break;
  }
  // the Hourglass: two small bright lobes lit by Herschel 36, and the star itself
  col += vec3(1., 0.86, 0.7)*(blob(o, d, HG + vec3(0.004, 0.018, 0.), 0.012) + blob(o, d, HG - vec3(0.004, 0.018, 0.), 0.012))*60.;
  col += vec3(0.8, 0.88, 1.)*(pblob(o, d, HG + vec3(0.012, -0.03, 0.), 0.004)*320. + blob(o, d, HG + vec3(0.012, -0.03, 0.), 0.03)*0.5);
  outCol(col, (1. - T)*0.85);
}`;
const lagoon = (() => {
  const pos = radec(hms(18,3,37), dms(-24,23,12), 4300), RAD = 60, HG = [-0.3, 0.04, 0.06];
  const cl = clusterPS(Math.round(380*QUALITY), [0.32, -0.02, 0.08], 0.2, 26000);
  return addObj({ key:'lagoon', name:'Lagoon Nebula', label:'Lagoon Nebula', type:'star-forming region · M8 · in Sagittarius', group:'nebulae', sortKey:4300,
    fact:'A cloud of glowing hydrogen about 110 by 50 light-years, where new stars are forming. A lane of dark dust across it gives it its name. On one side of the dark lane the young star Herschel 36 lights up the Hourglass; the young cluster NGC 6530 sits on the other.',
    pos, rad:RAD, sizeR:55, R0:facingEarth(pos, [0, 0, 1], -20), prog:program(VS_RECT, FS_LAGOON), minZoom:0.03, pxMin:6, farColor:[1, 0.5, 0.58], farLum:0.55, labelRange:1.5e5, labelMin:15,
    aka:'m8 messier 8 lagoon nebula ngc 6523 ngc 6530 hourglass herschel 36 sagittarius',
    visFn(rpx){ return smooth(6, 16, rpx)*(0.2 + 0.8*smooth(2, 30, orbit.dist)); },
    views:nebView(pos, [{ d:[0.55, 0.3, 0.8], k:1.1, hold:8, drift:0.03 }, { dirFn:() => V.norm(V.mul(pos, -1)), k:0.3, off:HG, hold:9, drift:0.02 }]),
    particles:[{ ps:cl.ps, prog:'ptBasic', mode:1, sb:1.1, size:1.8 }, { ps:cl.spikes, prog:'spike', lines:true, mode:1, sb:1.1, size:1, len:0.03, q0:() => [1, 0, 0, 0] }],
    readout:() => 'about 4,300 light-years (Gaia measured its cluster) · 110 x 50 light-years\nfaintly visible to the naked eye from a dark site' });
})();

// ---------------------------------------------------------------- the Great Hercules Cluster (M13): the globular cluster the Arecibo message was aimed at
const m13 = (() => {
  const RAD = 85, pos = radec(hms(16,41,41.24), dms(36,27,35.5), 25000);
  const n = Math.round(22000*QUALITY), ps = makePS(n);
  for (let i=0;i<n;i++){
    let r; do { r = 0.11/Math.sqrt(Math.pow(Math.max(rnd(), 1e-6), -2/3) - 1); } while (r > 1);   // Plummer sphere
    // (its stars are old: red giants, and a blue horizontal branch M13 is known for)
    const dd = randDir(), u = rnd();
    const c = u < 0.08 ? [1, 0.64, 0.38] : (u < 0.18 ? [0.62, 0.74, 1] : blackbodyJS(5200 + 1100*rnd()));
    const w = u < 0.08 ? 1.7 + rnd() : (u < 0.18 ? 1.3 : 0.5 + 0.5*rnd());
    ps.a.set([dd[0]*r, dd[1]*r, dd[2]*r, w], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4);
  }
  ps.upload('ac');
  const sent = Date.UTC(1974, 10, 16);   // the Arecibo message went out on 16 November 1974
  return addObj({ key:'m13', tags:['clusters'], name:'Great Hercules Cluster', label:'M13', type:'globular cluster · M13, target of the Arecibo message', group:'nebulae', sortKey:25000,
    fact:'Several hundred thousand stars in a ball about 145 light-years across, around 12 billion years old. In 1974 the Arecibo radio telescope beamed a short message toward it. Travelling at the speed of light, it will take about 25,000 years to get there.',
    pos, rad:RAD, sizeR:72.5, R0:facingEarth(pos, [0, 0, 1], 0), prog:omegacen.prog, minZoom:0.03, pxMin:5, farColor:[1, 0.9, 0.75], farLum:0.6, labelRange:2e5, aka:'m13 messier 13 ngc 6205 great globular cluster hercules globular cluster arecibo message',
    setU(pr){ gl.uniform4f(pr.u.uP0, 0.6, 0, 0, 0); },
    views:[{d:[0.2, 0.3, 1], k:1.7, hold:9, drift:0.03}, {d:[0.6, 0.4, 0.7], k:0.4, hold:8, drift:0.04}, {d:[0.3, 0.2, 1], k:0.08, hold:8, drift:0.05}],
    particles:[{ps, prog:'ptBasic', mode:0, sb:0.4, size:1.3, cap:0.9}],
    readout:() => `about 25,000 light-years · 145 light-years across\nthe Arecibo message has covered ${Math.floor((Date.now() - sent)/(365.25*864e5))} light-years of the way so far` });
})();

seed = P7_SEED;

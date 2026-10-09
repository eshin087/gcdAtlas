// ================================================================ content pack (0.18.0): the second pack from the checklists, Messier's nebulae and open clusters
// Sixteen open clusters drawn from their real stars (Gaia DR3 members, gaiaOpenCluster in p8-messier.js), the Little Dumbbell (M76), the
// reflection nebula M78 and the Sagittarius Star Cloud (M24, with its cluster NGC 6603). Positions: the clusters' centres from Hunt & Reffert
// 2023, the nebulae's from SIMBAD; distances and sizes in each readout.
// (this pack draws its random numbers from the shared seeded rnd() and then puts the seed back, as the others do)
const P9_SEED = seed;

// ---------------------------------------------------------------- the Little Dumbbell (M76): a ring of gas seen edge-on, with two faint lobes
// local radius 1, +z toward Earth: a thick ring round the local y axis, seen nearly edge-on, so it shows as the bright bar; two faint lobes of
// gas blown out along the axis, brightest at their edges; local x lies along the bar
const FS_LITTLEDB = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(40., 70., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<70;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float n = fbmW(p*5. + tm*0.004), fine = fbm3(p*13. + 2.);
    float rho = length(p.xz);
    float ring = exp(-pow((rho - 0.3)/0.1, 2.) - pow(p.y/0.12, 2.));
    vec3 lc = vec3(0., p.y > 0. ? 0.4 : -0.4, 0.);
    float lr = length((p - lc)*vec3(1., 0.8, 1.));
    float lobe = exp(-pow((lr - 0.32)/0.06, 2.))*smoothstep(0.05, 0.2, abs(p.y));
    float fill = smoothstep(0.32, 0.1, lr)*0.25;
    float em = ring*(2.2 + 4.*n*n)*(0.5 + fine) + (lobe + fill)*(0.3 + 0.9*n)*(0.5 + fine)*0.18;
    vec3 c = mix(vec3(1., 0.34, 0.36), vec3(1., 0.55, 0.45), n);
    c = mix(c, vec3(0.4, 1., 0.8), smoothstep(0.25, 0.05, rho)*smoothstep(0.15, 0.02, abs(p.y))*0.7);
    col += T*c*em*dt*1.6;
    T *= exp(-em*0.4*dt);
  }
  col += vec3(0.78, 0.86, 1.)*(pblob(o, d, vec3(0.), 0.004)*120. + blob(o, d, vec3(0.), 0.03)*0.2);
  outCol(col, (1. - T)*0.6);
}`;
{
  // (Gaia gives no usable parallax for its central star: the distance is the statistical one, Frew et al. 2016 and later, about 1 kpc)
  const D = 3400, pos = simbadPos(25.5819, 51.5754, D), RAD = 1.6;
  addObj({ key:'littledumbbell', name:'Little Dumbbell Nebula', label:'Little Dumbbell', type:'planetary nebula · M76 · in Perseus', group:'nebulae', sortKey:D,
    fact:'One of the faintest objects in Messier\'s list, found by Pierre Méchain in 1780 and given two NGC numbers because it was thought to be two clouds side by side. A ring of gas seen nearly edge-on makes the bright bar, and two faint lobes of gas are blown out on either side of it.',
    pos, rad:RAD, sizeR:1.3, R0:skyR0(pos, [0, 0, 1], 40), prog:program(VS_RECT, FS_LITTLEDB), minZoom:0.1, pxMin:6, farColor:[1, 0.55, 0.55], farLum:0.4, labelRange:2e4,
    aka:'m76 messier 76 ngc 650 ngc 651 little dumbbell cork nebula barbell planetary nebula perseus',
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:2.3, hold:9, drift:0.02 }, { d:[0.3, 0.2, 1], k:1.8, hold:8, drift:0.03 }, { d:[0.2, 1, 0.3], k:2, hold:8, drift:0.03 }],
    readout:() => 'about 3,400 light-years (uncertain by about 40%) · about 2.6 light-years across\nits central star is about 140,000 to 210,000 °C' });
}

// ---------------------------------------------------------------- M78: the brightest reflection nebula in the sky (FS_NURSERY, KIND 3)
{
  const D = 1320, pos = simbadPos(86.6908, 0.0792, D), RAD = 2.2;
  addObj({ key:'m78', name:'M78', label:'M78', type:'reflection nebula · in Orion', group:'nebulae', sortKey:D,
    fact:'A cloud of dust that shines only by the light of a close pair of young, hot stars at its head, scattered back toward us and mostly blue. Dozens of young stars, some firing jets, are forming in and around it.',
    pos, rad:RAD, sizeR:1.55, R0:skyR0(pos, [0, 0, 1], 0), prog:nurseryProg(3), minZoom:0.06, pxMin:6, farColor:[0.6, 0.75, 1], farLum:0.4, labelRange:2e4,
    aka:'m78 messier 78 ngc 2068 reflection nebula orion b hd 38563 casper the friendly ghost mcneil',
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:1.15, off:[-0.04, 0.08, 0], hold:9, drift:0.02 }, { d:[0.42, 0.32, 0.85], k:1.25, hold:8, drift:0.03 }, { d:[0.15, 0.1, 1], k:0.75, off:[-0.08, 0.15, 0], hold:8, drift:0.02 }],
    readout:() => '1,320 light-years (Gaia) · about 3 light-years across\nit shines almost only by light it scatters' });
}

// ---------------------------------------------------------------- the Sagittarius Star Cloud (M24): a window through the dust (FS_NURSERY, KIND 2)
// (the stars seen through the window are 10,000 to 16,000 light-years away: drawn at the near end; its depth is illustrative)
{
  const D = 10000, pos = simbadPos(274.2, -18.55, D), RAD = 200;
  addObj({ key:'m24', name:'Sagittarius Star Cloud', label:'M24', type:'star cloud · M24 · in Sagittarius', group:'nebulae', sortKey:D,
    fact:'Not a cluster but a window: a gap in the dust of our galaxy through which we see a crowd of stars far off toward its inner parts. Dark clouds of dust such as Barnard 92 hang in front of it, and the open cluster NGC 6603 is seen within it.',
    pos, rad:RAD, sizeR:150, R0:skyR0(pos, [0, 0, 1], 90), prog:nurseryProg(2), minZoom:0.03, pxMin:6, farColor:[1, 0.88, 0.7], farLum:0.6, labelRange:3e5, labelMin:20,
    aka:'m24 messier 24 ic 4715 sagittarius star cloud small sagittarius star cloud delle caustiche barnard 92 barnard 93 ngc 6603',
    visFn(rpx){ return smooth(6, 16, rpx)*(0.2 + 0.8*smooth(4, 60, viewDist())); },
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:1.5, hold:9, drift:0.02 }, { d:[0.6, 0.3, 0.75], k:1.4, hold:8, drift:0.03 }, { dirFn:() => V.norm(V.mul(pos, -1)), k:0.95, off:[-0.22, 0.14, 0.15], hold:8, drift:0.02 }],
    readout:() => 'its stars are about 10,000 to 16,000 light-years away\nabout 300 light-years across · a gap in the dust toward the inner galaxy' });
}
// (the cluster seen within it, drawn from its Gaia members; on neither checklist, so not listed in the atlas)
gaiaOpenCluster('ngc6603', { name:'NGC 6603', label:'NGC 6603', type:'open star cluster · seen within the Sagittarius Star Cloud', atlas:false, labelRange:6e4,
  fact:'A rich open cluster seen within the Sagittarius Star Cloud, M24, though probably nearer than most of the cloud\'s stars. Many catalogues have wrongly called it M24.',
  readout:() => '9,000 light-years (Gaia) · 557 of its stars as Gaia measured them' });

// ---------------------------------------------------------------- open clusters, from their real stars (gaiaOpenCluster, p8-messier.js)
// (distances: Hunt & Reffert 2023, Gaia DR3; ages: published fits, Cantat-Gaudin et al. 2020 and Dias et al. 2021, or a range where they
// disagree; sizes: the spread of the members drawn, twice the radius holding nine in ten of them)
gaiaOpenCluster('m6', { name:'Butterfly Cluster', label:'Butterfly Cluster', type:'open star cluster · M6 · in Scorpius', labelRange:5e4,
  fact:'Its brightest stars outline a butterfly with open wings. Most are hot and blue-white, but the brightest, BM Scorpii, is an orange giant; on the sky it is the Messier object nearest the centre of our galaxy.',
  aka:'m6 messier 6 ngc 6405 butterfly cluster bm scorpii scorpius',
  readout:() => '1,470 light-years (Gaia) · its stars spread over about 30 light-years\n50 to 80 million years old · 533 of its stars as Gaia measured them' });
gaiaOpenCluster('m23', { name:'M23', label:'M23', type:'open star cluster · in Sagittarius', labelRange:6e4,
  fact:'A rich, scattered cluster in the Milky Way\'s band in Sagittarius, found by Messier in 1764. Over a thousand of its stars have been picked out by their shared motion.',
  aka:'m23 messier 23 ngc 6494 sagittarius',
  readout:() => '2,330 light-years (Gaia) · its stars spread over about 45 light-years\nabout 300 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('m25', { name:'M25', label:'M25', type:'open star cluster · in Sagittarius', labelRange:6e4,
  fact:'A bright cluster you can see without a telescope from a dark site. One of its stars, U Sagittarii, is a Cepheid: it swells and shrinks, brightening and fading every 6.7 days, and helps set the scale of distances in space.',
  aka:'m25 messier 25 ic 4725 u sagittarii cepheid sagittarius',
  readout:() => '2,100 light-years (Gaia) · its stars spread over about 50 light-years\nabout 100 million years old · 565 of its stars as Gaia measured them' });
gaiaOpenCluster('m29', { name:'M29', label:'M29', type:'open star cluster · in Cygnus', labelRange:9e4,
  fact:'A small, young cluster of hot stars in Cygnus, dimmed several times over by the dust between us. Its brightest stars form a small box with a little triangle above it, a shape nicknamed the Cooling Tower.',
  aka:'m29 messier 29 ngc 6913 cooling tower cygnus',
  readout:() => '5,600 light-years (Gaia) · its stars spread over about 40 light-years\nabout 10 million years old · 70 of its stars as Gaia measured them' });
gaiaOpenCluster('m34', { name:'M34', label:'M34', type:'open star cluster · in Perseus', labelRange:5e4,
  fact:'A bright, loose cluster in Perseus, just visible to the naked eye from a dark site. Its stars are about 220 million years old, a stage between the young Pleiades and the older Hyades; how fast its stars spin gives a matching age.',
  aka:'m34 messier 34 ngc 1039 spiral cluster perseus',
  readout:() => '1,600 light-years (Gaia) · its stars spread over about 40 light-years\nabout 220 million years old · 589 of its stars as Gaia measured them' });
gaiaOpenCluster('m35', { name:'M35', label:'M35', type:'open star cluster · in Gemini', labelRange:6e4,
  fact:'A big, bright cluster at the feet of Gemini, about the size of the full Moon on the sky. The small, dimmer cluster NGC 2158 beside it is about four times farther away and about ten times older.',
  aka:'m35 messier 35 ngc 2168 shoe buckle cluster gemini ngc 2158',
  readout:() => '2,740 light-years (Gaia) · its stars spread over about 50 light-years\nabout 150 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('m36', { name:'M36', label:'M36', type:'open star cluster · in Auriga', labelRange:7e4,
  fact:'The youngest of the three bright clusters in Auriga: hot blue stars with no red giants yet. About eight times closer, it would look much like the Pleiades.',
  aka:'m36 messier 36 ngc 1960 pinwheel cluster auriga',
  readout:() => '3,670 light-years (Gaia) · its stars spread over about 20 light-years\nabout 27 million years old · 217 of its stars as Gaia measured them' });
gaiaOpenCluster('m37', { name:'M37', label:'M37', type:'open star cluster · in Auriga', labelRange:7e4,
  fact:'The richest of the three bright clusters in Auriga, with thousands of stars; about a dozen of them have swollen into red giants. It even holds a planetary nebula, one of only a handful known in an open cluster.',
  aka:'m37 messier 37 ngc 2099 salt and pepper cluster auriga',
  readout:() => '4,570 light-years (Gaia) · its stars spread over about 40 light-years\nabout 500 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('m38', { name:'M38', label:'M38', type:'open star cluster · in Auriga', labelRange:7e4,
  fact:'The third of Auriga\'s bright clusters. Its brightest stars are said to form a cross or a starfish, and a few yellow giants shine among its brightest members.',
  aka:'m38 messier 38 ngc 1912 starfish cluster auriga',
  readout:() => '3,540 light-years (Gaia) · its stars spread over about 55 light-years\nabout 270 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('m39', { name:'M39', label:'M39', type:'open star cluster · in Cygnus', labelRange:4e4,
  fact:'A large, loose cluster in Cygnus, easy in binoculars: a few dozen bright stars spread over an area about the size of the full Moon.',
  aka:'m39 messier 39 ngc 7092 cygnus',
  readout:() => '965 light-years (Gaia) · its stars spread over about 80 light-years\n300 to 450 million years old · 284 of its stars as Gaia measured them' });
gaiaOpenCluster('m41', { name:'M41', label:'M41', type:'open star cluster · in Canis Major', labelRange:6e4,
  fact:'A bright cluster four degrees south of Sirius, with an orange giant near its middle. It may be the faint patch Aristotle noted around 325 BC; if so, it is the faintest object recorded in ancient times.',
  aka:'m41 messier 41 ngc 2287 little beehive canis major',
  readout:() => '2,330 light-years (Gaia) · its stars spread over about 45 light-years\nabout 170 to 300 million years old · 598 of its stars as Gaia measured them' });
gaiaOpenCluster('m46', { name:'M46', label:'M46', type:'open star cluster · in Puppis', labelRange:9e4,
  fact:'A rich cluster of thousands of stars. The small ring of a planetary nebula seen at its edge, NGC 2438, is probably not part of it: it moves differently and seems to lie well in front.',
  aka:'m46 messier 46 ngc 2437 ngc 2438 puppis',
  readout:() => '5,070 light-years (Gaia) · its stars spread over about 70 light-years\nabout 300 to 500 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('m47', { name:'M47', label:'M47', type:'open star cluster · in Puppis', labelRange:5e4,
  fact:'A bright, coarse cluster. Messier wrote down its position wrongly, so for nearly two centuries no one knew which cluster he meant, until it was matched to NGC 2422 in 1959.',
  aka:'m47 messier 47 ngc 2422 ngc 2478 puppis',
  readout:() => '1,530 light-years (Gaia) · its stars spread over about 30 light-years\nabout 110 million years old · 510 of its stars as Gaia measured them' });
gaiaOpenCluster('m52', { name:'M52', label:'M52', type:'open star cluster · in Cassiopeia', labelRange:9e4,
  fact:'A rich young cluster in Cassiopeia that Messier found in 1774 while following a comet. Its brightest member is a yellow supergiant.',
  aka:'m52 messier 52 ngc 7654 cassiopeia',
  readout:() => '5,120 light-years (Gaia) · its stars spread over about 40 light-years\nabout 50 to 150 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('m67', { name:'M67', label:'M67', type:'open star cluster · the oldest in Messier\'s list · in Cancer', labelRange:6e4,
  fact:'About 4 billion years old, the oldest open cluster in Messier\'s list and nearly as old as the Sun, which it matches in make-up. Its Sun-like stars spin once in about 26 days, as the Sun does.',
  aka:'m67 messier 67 ngc 2682 king cobra cluster solar twins cancer',
  readout:() => '2,730 light-years (Gaia) · its stars spread over about 35 light-years\nabout 4 billion years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('m103', { name:'M103', label:'M103', type:'open star cluster · in Cassiopeia', labelRange:1.2e5,
  fact:'The last entry in Messier\'s catalogue as he published it in 1781: a young cluster of hot stars in Cassiopeia and, by Gaia, the farthest open cluster in his list.',
  aka:'m103 messier 103 ngc 581 cassiopeia',
  readout:() => '8,240 light-years (Gaia) · its stars spread over about 45 light-years\nabout 30 million years old · 211 of its stars as Gaia measured them' });

seed = P9_SEED;

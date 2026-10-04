// ================================================================ the famous places (phase 3 of docs/EARTH_PLAN.md, 0.15.0): 30 mountains, deserts, rivers, coasts, islands, ice
// and wonders built by people, from EARTH_PLACES (tools/earth-places.mjs). Each place's layers (Sentinel-2 images, aerial photos in the United
// States, and the heights of the ground: 410 km down to about 12 km across, 3 km at a few) join the Earth detail (e3-earth-detail.js) as a site
// of their own, so Earth shows them from space as it shows the launch sites and the cities. Below 90 km near a place the ground and sky are
// drawn by FS_SX_ENV with the place as the site: its layers marched as far as the ground anywhere's (the mountains stand up to the horizon), the
// ground anywhere (e7g-earth-ground.js) round them. Each place is an object of its own (earth-iconic-<key>), standing on the turning Earth
// like the place objects of the search (e7s-earth-search.js, whose code moves it): with the framings in its data, its fact and readout, the
// credits of its data while it shows, and a stop on the tour "wonders of Earth" (08t-tours.js). The atlas's "on Earth" list, its marks on the
// globe and the search lead to it: rows that name a place here fly to its object (ownHooks), new rows are added for the places the list did
// not have, and a place object set to one of them is dressed the same (spotHooks).
const PLC = (() => {
  const D = typeof EARTH_PLACES !== 'undefined' && FLAGS.realEarth ? EARTH_PLACES : null;
  const R = 6371, unit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  const fold = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const places = D ? D.places : [];
  // how each place is listed: what it is (the line under its name), the rows of the "on Earth" list that lead to it (an existing famous place,
  // or a new row in one of the list's kinds), each with the angle it starts from (the index of the view in its data), and its place on the
  // tour. Rows from the search name it too: any of these names within 800 km, or a region, sea or island whose every word is one of its search
  // words within 100 km ("Lake Mead", "Disko Bay"); never a city (Cairo stays Cairo, drawn over Giza's ground) or a peak not listed here (Mauna
  // Kea keeps its own angles, over Hawaii's ground)
  const META = {
    everest:{ type:'mountains on the border of Nepal and China', rows:{ 'Mount Everest':1, 'Everest':1, 'Himalayas':0, 'Himalaya':0 } },
    grandcanyon:{ type:'a canyon in Arizona, United States', rows:{ 'Grand Canyon':1 } },
    alps:{ type:'mountains in France, Italy and Switzerland', rows:{ 'Alps':0, 'Matterhorn':1, 'Mont Blanc':2 } },
    kilimanjaro:{ type:'a volcano in Tanzania', rows:{ 'Mount Kilimanjaro':1, 'Kilimanjaro':1 } },
    fuji:{ type:'a volcano in Japan', rows:{ 'Mount Fuji':1, 'Fuji':1 } },
    yosemite:{ type:'a valley in California, United States', add:['regions', ['Yosemite Valley', 'r', 37.745, -119.585, 13, '', 'valley']] },
    torresdelpaine:{ type:'a national park in Chile', add:['regions', ['Torres del Paine', 'r', -50.95, -73.0, 50, '', 'national park']] },
    denali:{ type:'a mountain in Alaska, United States', rows:{ 'Denali':1, 'Mount McKinley':1 } },
    richat:{ type:'a ring of rock in Mauritania', add:['regions', ['Richat Structure', 'r', 21.1244, -11.4009, 40, '', 'ring of rock']] },
    amazon:{ type:'rivers in Brazil', add:['regions', ['Meeting of Waters', 'r', -3.14, -59.92, 12, '', 'rivers meeting']] },
    nile:{ type:'a river delta in Egypt', rows:{ 'Nile Delta':1 } },
    uluru:{ type:'a sandstone rock in Australia', add:['regions', ['Uluru', 'r', -25.3444, 131.0369, 4, '', 'sandstone rock']] },
    okavango:{ type:'an inland delta in Botswana', add:['regions', ['Okavango Delta', 'r', -19.3, 22.8, 250, '', 'inland delta']] },
    sossusvlei:{ type:'dunes in Namibia', add:['regions', ['Sossusvlei', 'r', -24.74, 15.3, 30, '', 'dunes']] },
    gbr:{ type:'a coral reef in Australia', rows:{ 'Great Barrier Reef':1 } },
    hawaii:{ type:'a volcanic island in Hawaii, United States', rows:{ 'Hawaii':1, 'Kilauea':2 } },
    iceland:{ type:'an ice cap in Iceland', rows:{ 'Iceland':1, 'Vatnajokull':1 } },
    antarctic:{ type:'an island and an ice shelf in Antarctica', add:['islands', ['Ross Island', 'i', -77.53, 167.17, 80, '', 'island and ice shelf']] },
    greenland:{ type:'a glacier and its fjord in Greenland', rows:{ 'Greenland':1 } },
    maldives:{ type:'coral atolls in the Indian Ocean', add:['islands', ['Maldives', 'i', 4.2, 73.5, 870, '', 'coral atolls']] },
    borabora:{ type:'an island in French Polynesia', add:['islands', ['Bora Bora', 'i', -16.5, -151.74, 10, '', 'island']] },
    halong:{ type:'a bay in Vietnam', add:['waters', ['Ha Long Bay', 'w', 20.85, 107.1, 40, '', 'bay']] },
    geiranger:{ type:'a fjord in Norway', add:['waters', ['Geirangerfjord', 'w', 62.105, 7.15, 15, '', 'fjord']] },
    palm:{ type:'an island built in the sea, Dubai', add:['wonders', ['Palm Jumeirah', 'r', 25.1124, 55.139, 6, '', 'island built in the sea']] },
    panama:{ type:'a canal in Panama', add:['wonders', ['Panama Canal', 'r', 9.12, -79.7, 82, '', 'canal']] },
    greatwall:{ type:'a wall in China', add:['wonders', ['Great Wall of China', 'r', 40.43, 116.57, 2000, '', 'wall']] },
    giza:{ type:'pyramids in Egypt', add:['wonders', ['Pyramids of Giza', 'r', 29.9753, 31.1308, 1, '', 'pyramids']] },
    suez:{ type:'a canal in Egypt', add:['wonders', ['Suez Canal', 'r', 30.6, 32.3, 193, '', 'canal']] },
    threegorges:{ type:'a dam in China', add:['wonders', ['Three Gorges Dam', 'r', 30.8231, 111.0033, 2, '', 'dam']] },
    hoover:{ type:'a dam in the United States', add:['wonders', ['Hoover Dam', 'r', 36.0156, -114.7378, 1, '', 'dam']] },
  };
  // the tour, west round the world from Japan (each hop a few thousand km at most, the long ones across the Pacific and the Southern Ocean)
  const TOUR = ['fuji', 'greatwall', 'threegorges', 'halong', 'everest', 'maldives', 'palm', 'suez', 'nile', 'giza', 'kilimanjaro', 'okavango', 'sossusvlei',
    'richat', 'alps', 'geiranger', 'iceland', 'greenland', 'denali', 'yosemite', 'hoover', 'grandcanyon', 'panama', 'amazon', 'torresdelpaine', 'antarctic',
    'uluru', 'gbr', 'borabora', 'hawaii'];
  // (the views in the data are wide, middle and close: a place opens on its middle one, where it is recognisable, then goes wide, then close;
  // owner, 0.13.0, for the cities: "arrive closer, then go wide". A tour plays the middle and the close one)
  const ORDER = [1, 0, 2];
  // the credit while a place's ground shows (the licences ask for it), from the sources its layers use: the images, then the heights (with
  // OpenStreetMap's buildings, wall lines and footprints, rasterised into them) near the ground. Sentinel-2's line takes the years of its scenes
  const creditOf = p => {
    const yrs = [...new Set(p.layers.flatMap(L => L.s2dates || []).map(d => d.slice(0, 4)))].sort();
    const yt = yrs.length < 2 ? yrs[0] || '' : yrs.length === 2 ? yrs.join(' and ') : yrs[0] + ' to ' + yrs[yrs.length - 1];
    const C = D.credits, img = p.credits.filter(k => k === 's2' || k === 'naip').map(k => k === 's2' ? C.s2 + (yt ? ' ' + yt : '') : C[k]);
    const hgt = p.credits.filter(k => k === 'cop' || k === '3dep' || k === 'terrarium' || k === 'osm').map(k => C[k]);
    return near => ['images: ' + img.join(' · '), near && hgt.length ? 'heights: ' + hgt.join(' · ') : ''].filter(Boolean).join('\n');
  };
  const near = (p, la, lo) => V.len(V.sub(V.mul(unit(la, lo), R), V.mul(p.up, R)));
  for (const p of places){
    const M = META[p.key] || { type:'a place on Earth', rows:{} };
    p.up = unit(p.la, p.lo); p.type = M.type;
    // (only the nearest place's layers load, its widest from about 3,500 km away, not a launch site's 6,000: EDT.tick. A flight passing over
    // places at 6,000 km left a trail of their widest layers)
    p.ed = EDT.addSite(Object.assign({}, p, { pads:{} }), 'places/', { place:p, credit:creditOf(p), far:1500 });
    // the ground and sky round the place: a site for drawEnv, at sea level under its middle
    p.env = { key:'place-' + p.key, name:p.name, short:p.name, kind:8, place:p, ed:p.ed, coast:[0, 0, 1e9], elev:0, up:p.up, p:V.mul(p.up, R), F:enuOf(p.up) };
    // (how far from its middle its layers reach, km)
    p.reach = Math.max(...p.layers.map(L => near(p, L.la, L.lo) + L.size/2000));
    // its framings (each looking at its own point, given as an offset from the place's middle at sea level, as a city's: e9c-earth-cities.js)
    p.views = ORDER.filter(i => p.views[i]).map(i => {
      const v = p.views[i], e = (v.look[1] - p.lo)*DEG*R*1000*Math.cos(p.la*DEG), n = (v.look[0] - p.la)*DEG*R*1000, az = v.az*DEG, ti = v.tilt*DEG;
      const off = [e/3000, v.look[2]/3000, -n/3000];
      return { d:[-Math.sin(az)*Math.cos(ti), Math.sin(ti), Math.cos(az)*Math.cos(ti)], k:v.dist/3000, off:() => off, hold:11, drift:0.01, why:v.why };
    });
    // the rows that lead to it: the list's own (its numbers made to agree with the fact) and a new one where the list had none
    p.names = new Map([[fold(p.name), 0]]);
    for (const [nm, vi] of Object.entries(M.rows || {})) p.names.set(fold(nm), Math.max(ORDER.indexOf(vi), 0));
    if (M.add){ const [cat, row] = M.add; (EPL.PICKS[cat] = EPL.PICKS[cat] || []).push(row); EPL.ALL_PICKS.push(row); p.names.set(fold(row[0]), 0); }
    // (its row: the new one, or the first of its own the list has; and a row with its full name, for the search)
    p.row = M.add ? M.add[1] : Object.keys(M.rows || {}).map(nm => EPL.ALL_PICKS.find(r => r[0] === nm && near(p, r[2], r[3]) < 800)).find(Boolean) || [p.name, 'r', p.la, p.lo, 10, '', 'place'];
    p.srow = [p.name, p.row[1], p.la, p.lo, p.row[4], '', p.row[6] || ''];
    p.aka = new Set(fold(p.aka + ' ' + p.name).split(/[^a-z0-9]+/).filter(Boolean));
  }
  // (the list's heights where they differ from the fact by a metre or more: the 2020 survey of Everest, USGS's Denali, Mont Blanc's mean)
  for (const r of EPL.ALL_PICKS){ const h = { 'Mount Everest':8849, 'Denali':6190, 'Mont Blanc':4806 }[r[0]]; if (h && r[1] === 'm') r[4] = h; }
  // the famous place a row names, if any (see META)
  const STOP = new Set(['the', 'of', 'and', 'de', 'del', 'la', 'le', 'mount', 'mt']);
  function placeOf(r){
    if (!r || !places.length || r[1] === 'c' || r[1] === 'C' || !isFinite(r[2]) || !isFinite(r[3])) return null;
    const nm = fold(r[0]);
    for (const p of places){ const vi = p.names.get(nm); if (vi != null && near(p, r[2], r[3]) < 800) return { p, vi }; }
    if (r[1] === 'm') return null;
    const w = nm.split(/[^a-z0-9]+/).filter(x => x && !STOP.has(x)); if (!w.length) return null;
    for (const p of places) if (w.every(x => p.aka.has(x)) && near(p, r[2], r[3]) < 100) return { p, vi:0 };
    return null;
  }
  // the readout: its number, where it is, and the credits for the ground in view (a city's when a city draws it: the Palm is in Dubai's)
  function readout(p){
    const env = typeof SXENV !== 'undefined' && SXENV.on ? EDT.creditNow() : '';
    const cr = env || (p.ed.layers.some(L => L.state === 2) ? EDT.credit(p.ed, false) : '');
    return [p.readout + ' · ' + EPL.llTxt(p.la, p.lo), cr].filter(Boolean).join('\n');
  }
  // the moment to fly to a place by day (within half a day of the atlas clock): the Sun about 32 degrees up (at least 18 where it can be), and
  // about 50 degrees round from behind the camera of the angle it arrives at, so the relief is lit from the side and in front; the afternoon
  // at a launch pad (afternoonAt) put the Matterhorn, seen from Zermatt toward the south-west, against the Sun. vp: the angle's framing, or
  // its index
  function sunFor(o, vp){
    if (typeof vp === 'number') vp = viewParams(o, vp);
    const F = o.F || enuOf(o.up), d = sphL(vp.yaw, vp.pitch), cb = Math.atan2(d[0], -d[2]), d0 = ssDays;
    let best = null, bs = 1e9;
    for (let k=-48;k<=48;k++){
      ssDays = d0 + k/96; earth.update(0); const sv = sunFixed(), el = Math.asin(clamp(V.dot(sv, F.up), -1, 1))/DEG;
      if (el < 6) continue;
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(V.dot(sv, F.e), V.dot(sv, F.n)) - cb), Math.cos(Math.atan2(V.dot(sv, F.e), V.dot(sv, F.n)) - cb)))/DEG;
      // (a high Sun first: low, side light left Torres del Paine dark, at 8 degrees)
      const sc = Math.abs(el - 32)*0.8 + Math.max(18 - el, 0)*2 + Math.abs(da - 50)*0.3 + Math.abs(k)*0.05;
      if (sc < bs){ bs = sc; best = ssDays; }
    }
    ssDays = d0; earth.update(0);
    return best != null ? best : afternoonAt({ up:o.up });
  }
  // dress a place object as place p: its name, fact, framings and readout, standing at sea level under its middle
  function dress(o, p){
    const P = o.place; P.la = P.la0 = p.la; P.lo = P.lo0 = p.lo; P.h = 0; P.kind = p.row[1] === 'm' ? 'm' : 'r'; P.row = P.row || p.row;
    o.iconic = p; o.city = null; o.readoutExtra = null; o.hNow = 0;
    o.name = p.name; o.type = p.type; o.fact = p.fact; o.rad = 3*KM; o.minZoom = 0.05; o.views = p.views; o.tourViews = [0, 2];
    o.dressRO = () => readout(p); o.dayAt = vp => sunFor(o, vp);
  }
  // each place's own object
  for (const p of places){
    p.obj = addObj({ key:'earth-iconic-' + p.key, name:p.name, label:'', type:p.type, group:'travel', parent:earth, offset:[0, 0, 0],
      rad:3*KM, layer:3, noPick:true, atlas:false, noLabel:true, noWaypoint:true, noImpostor:true, pxMin:1, visFn:() => 1, labelRange:0, minZoom:0.05,
      distEarth:'here on Earth', earthSpot:true, own:true, views:p.views, R0:M3.I(), place:{ la:p.la, lo:p.lo, la0:p.la, lo0:p.lo, h:0, row:p.row, kind:'r' },
      readout(){ return this.dressRO ? this.dressRO() : ''; }, update(){ EPL.placeSpot(this); }, flyIn(vp, done){ return EPL.flyIn(this, vp, done); } });
    dress(p.obj, p);
  }
  EPL.ownHooks.push(r => { const m = placeOf(r); return m ? { obj:m.p.obj, vi:m.vi } : null; });
  EPL.spotHooks.push((o, r) => { const m = placeOf(r); if (m) dress(o, m.p); });
  // the search: a place whose name or other names have a word starting with each word typed, first (its row: the one named most like what was typed)
  EPL.findHooks.push((words, qq, hit) => {
    const out = [];
    for (const p of places){
      const nms = fold(p.name + ' ' + [...p.names.keys()].join(' ')), txt = nms + ' ' + [...p.aka].join(' ');
      if (!words.every(w => hit(txt, w))) continue;
      const r = EPL.ALL_PICKS.find(x => p.names.get(fold(x[0])) != null && fold(x[0]).startsWith(qq) && near(p, x[2], x[3]) < 800) || p.srow;
      // (its own names first; found only by its other names, after a place of that very name: "cairo" is the city first, then Giza)
      out.push([words.every(w => hit(nms, w)) ? 200 + (p.names.has(qq) ? 100 : 0) : 45, r]);
    }
    return out;
  });
  // the site drawEnv draws with near a place: the place the camera is with (its object, or a place object dressed as it) within 400 km of its
  // middle, else the nearest within reach of its layers, once one of them is in; its layers, then the ground anywhere's as the widest (it holds
  // the horizon)
  function envSite(cf){
    if (!places.length) return null;
    const g = V.mul(cf, R/Math.max(V.len(cf), 1)), lk = OBJ[orbit.lock], mine = lk && lk.iconic;
    let best = null, bs = 1;
    for (const p of places){ const d = V.len(V.sub(g, V.mul(p.up, R))), s = p === mine ? d/400*0.5 : d/p.reach; if (s < bs){ bs = s; best = p; } }
    if (!best || !best.ed.layers.some(L => L.state === 2)) return null;
    const S = best.env; S.layers = EGR.ready ? best.ed.layers.concat([EGR.layer]) : best.ed.layers; S.top = Math.max(best.ed.top, best.top, EGR.ready ? EGR.site.top : 0);
    return S;
  }
  const byKey = k => places.find(p => 'place-' + p.key === k || p.key === k) || null;
  // (tests: the site the ground is drawn with, each place's layers that are in, and the camera: latitude, longitude, km above the sea)
  const dbg = () => { const cf = camFixed(), r = V.len(cf);
    return { env:typeof SXENV !== 'undefined' && SXENV.on && SXENV.site ? SXENV.site.key : null, layers:places.map(p => p.key + ' ' + p.ed.layers.filter(L => L.state === 2).length + '/' + p.ed.layers.length),
      cam:[+(Math.asin(cf[1]/r)/DEG).toFixed(4), +(Math.atan2(-cf[2], cf[0])/DEG).toFixed(4), +(r - R).toFixed(3)] }; };
  return { places, envSite, placeOf, byKey, dbg, sunFor, tour:TOUR.filter(k => places.some(p => p.key === k)).map(k => 'earth-iconic-' + k) };
})();

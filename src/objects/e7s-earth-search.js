// ================================================================ places on Earth (phase 2 of docs/EARTH_PLAN.md): the search also finds cities (GeoNames), mountains, regions and
// waters (Natural Earth), from the list EARTH_NAMES names, fetched the first time a search is typed. Picking one flies down to it: a place is
// one of two objects, set to it and used in turn (a flight always goes from one to the other), standing on the turning Earth like a launch
// pad, with angles that suit its kind: oblique ones that let mountains stand up, and one from overhead. Mountains and regions are flown to by
// day (the clock eases to the afternoon there, as for a launch); cities keep the clock, so at night their lights show. A link to one carries
// the place itself (g=), so it opens there.
const EPL = (() => {
  const can = typeof EARTH_NAMES !== 'undefined' && FLAGS.realEarth && /^https?:$/.test(location.protocol) && typeof fetch === 'function';
  const R = 6371, unit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let data = null, names = null, ctry = null, state = 0, turn = 0, pend = null;
  const onLoad = [];
  function load(){
    if (!can || state) return; state = 1;
    fetch('earth/' + EARTH_NAMES.file).then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => { data = j; names = j.p.map(r => fold(r[0])); ctry = {}; for (const k in j.cc) ctry[k] = fold(j.cc[k]); state = 2; onLoad.forEach(f => f()); })
      .catch(e => { state = 3; console.info('places on Earth: names not loaded (' + e + ')'); });
  }
  // how big a place is, for the ranking: people, height or size
  const big = r => r[1] === 'c' || r[1] === 'C' ? Math.log10(r[4]) + (r[1] === 'C' ? 1.2 : 0) : r[1] === 'm' ? 3 + r[4]/1500 : 3.5 + Math.log10(r[4])*0.8;
  // up to n places whose name (or country) has a word starting with each word typed, the best first: the whole name typed, then names that
  // start with it, then the biggest (Paris before Paris, Texas)
  function find(q, n = 6){
    if (!can) return [];
    if (!names){ load(); return []; }
    const qq = fold(q).trim(), words = qq.split(/[\s,]+/).filter(Boolean); if (qq.length < 2 || !words.length) return [];
    const hit = (s, w) => s.startsWith(w) || s.includes(' ' + w) || s.includes('-' + w) || s.includes('(' + w);
    const out = [];
    for (let i=0;i<names.length;i++){
      const nm = names[i], r = data.p[i], c = r[5] ? ctry[r[5]] || '' : '';
      if (!words.every(w => hit(nm, w) || (c && hit(c, w)))) continue;
      out.push([(nm === qq ? 100 : nm.startsWith(qq) ? 40 : 0) + big(r), r]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out.slice(0, n).map(x => x[1]);
  }
  const people = p => p >= 1e6 ? (p/1e6).toFixed(p >= 1e7 ? 0 : 1) + ' million' : Math.round(p/1000)*1000 >= 1000 ? Math.round(p/1000).toLocaleString('en-US') + ',000' : String(p);
  const metres = m => Math.round(m).toLocaleString('en-US') + ' m';
  const llTxt = (la, lo) => Math.abs(la).toFixed(2) + '° ' + (la >= 0 ? 'N' : 'S') + ', ' + Math.abs(lo).toFixed(2) + '° ' + (lo >= 0 ? 'E' : 'W');
  // a result in words: [what it is, the short line in the list]
  function about(r){
    const cn = r[5] && data && data.cc[r[5]] ? data.cc[r[5]] : '';
    if (r[1] === 'c' || r[1] === 'C') return [(r[1] === 'C' ? 'the capital of ' : 'a city in ') + (cn || 'its country'), cn || 'city'];
    if (r[1] === 'm') return [r[6] ? 'a ' + r[6] : 'a mountain', metres(r[4])];
    return ['a' + (/^[aeiou]/.test(r[6] || '') ? 'n ' : ' ') + (r[6] || (r[1] === 'i' ? 'island' : 'region')), r[6] || (r[1] === 'w' ? 'water' : 'region')];
  }
  // ---------------------------------------------------------------- the two place objects
  const VIEWS = {
    // (mountains: from the south-east and low, looking up at it; closer from the west; then from high above)
    m:[{ d:[0.62, 0.3, 0.72], k:13, hold:12, drift:0.012 }, { d:[-0.78, 0.15, 0.6], k:6, hold:10, drift:0.015 }, { d:[0.1, 0.75, 0.65], k:24, hold:10, drift:0.01 }],
    c:[{ d:[0.5, 0.42, 0.75], k:9, hold:11, drift:0.015 }, { d:[-0.6, 0.22, 0.77], k:4.5, hold:10, drift:0.02 }, { d:[0.05, 1, 0.1], k:14, hold:9, drift:0.008 }],
    r:[{ d:[0.3, 0.6, 0.75], k:2.4, hold:12, drift:0.01 }, { d:[-0.2, 0.3, 0.93], k:1.6, hold:10, drift:0.012 }, { d:[0, 1, 0.1], k:3.2, hold:10, drift:0.008 }],
  };
  const spots = [0, 1].map(i => addObj({ key:'earth-place-' + i, name:'a place on Earth', label:'', type:'a place on Earth', group:'travel', parent:earth, offset:[0, 0, 0],
    rad:4*KM, layer:3, noPick:true, atlas:false, noLabel:true, noTour:true, noWaypoint:true, noImpostor:true, pxMin:1, visFn:() => 1, labelRange:0, minZoom:0.3,
    distEarth:'here on Earth', earthSpot:true, views:VIEWS.c, R0:M3.I(),
    place:{ la:0, lo:0, h:0, row:null, kind:'c' }, readout(){ return readout(this); }, update(){ placeSpot(this); } }));
  // where it stands now: on the turning Earth, at the height of the ground as drawn (the tiles' heights once they are in)
  function placeSpot(o){
    const P = o.place, g = ETL.heightAt(P.la*DEG, P.lo*DEG), h = g != null ? (P.kind === 'm' ? Math.max(g, P.h*0.8) : g) : P.h;
    o.hNow = o.hNow == null || Math.abs(o.hNow - h) > 2000 ? h : o.hNow + (h - o.hNow)*0.1;
    const u = unit(P.la, P.lo), F = enuOf(u);
    o.offset = V.mul(M3.apply(earth.rot, V.mul(u, R + o.hNow/1000)), KM); o.pos = V.add(earth.pos, o.offset);
    o.R0 = M3.mul(earth.rot, F.M); o.up = u; o.F = F;
    // locked on it, the camera turns with the Earth, and stays above the ground under it (and 150 m clear)
    if (orbit.lock === o.index && !flight && !LCAM.on && !SKYV.on){ orbit.frame = o.R0; clearGround(o); }
  }
  function clearGround(o){
    const P = o.place, dKm = orbit.dist/KM;
    for (let k=0;k<3;k++){
      const d = sphL(orbit.yaw, orbit.pitch), eyeF = V.add(V.mul(o.up, R + o.hNow/1000), V.add(V.add(V.mul(o.F.e, d[0]*dKm), V.mul(o.up, d[1]*dKm)), V.mul(o.F.n, -d[2]*dKm)));
      const r = V.len(eyeF), la = Math.asin(eyeF[1]/r), lo = Math.atan2(-eyeF[2], eyeF[0]), g = ETL.heightAt(la, lo);
      const need = ((g == null ? 0 : g) + 150)/1000 - (r - R);   // (km the eye is under where it should be)
      if (!(need > 0)) break;
      orbit.pitch = Math.min(orbit.pitch + need/Math.max(dKm, 0.1)*1.05, 1.5);
    }
  }
  function readout(o){
    const P = o.place, r = P.row; if (!r) return '';
    const what = r[1] === 'c' || r[1] === 'C' ? `about ${people(r[4])} people` : r[1] === 'm' ? `${metres(r[4])} above sea level` : `its outline spans about ${Math.round(r[4]).toLocaleString('en-US')} km`;
    return `${llTxt(P.la, P.lo)} · ${what}\n${r[1] === 'c' || r[1] === 'C' ? 'name: GeoNames (CC BY 4.0)' : 'name: Natural Earth'} · ground: NASA Blue Marble and GEBCO, about 2.4 km a pixel`;
  }
  // set a place object to a result
  function setSpot(o, r){
    const [name, kind, la, lo, n] = r, k = kind === 'C' ? 'c' : kind === 'm' ? 'm' : kind === 'c' ? 'c' : 'r', [what] = about(r);
    o.place = { la, lo, h:kind === 'm' ? n : 0, row:r, kind:k }; o.hNow = null;
    o.name = name; o.type = what;
    o.rad = (k === 'm' ? 3 : k === 'c' ? 5 : clamp(n*0.35, 20, 2000))*KM; o.minZoom = k === 'r' ? 0.05 : 0.3;
    o.views = VIEWS[k];
    o.fact = k === 'c' ? `${name} is ${what}, with about ${people(n)} people (GeoNames).` :
      k === 'm' ? `${name} rises ${metres(n)} above sea level (Natural Earth). Its shape here comes from GEBCO's heights at about 2 km a pixel, so smaller peaks and ridges are smoothed; the clouds are illustrative.` :
      `${name} is ${what}. Natural Earth's outline of it spans about ${Math.round(n).toLocaleString('en-US')} km.`;
    placeSpot(o);
  }
  // fly down to a result: straight there when the camera is above the place's horizon, else first round to above it (a flight that
  // started on the far side would go through the Earth)
  function go(r){
    if (!r) return;
    const o = spots[turn]; turn ^= 1;
    if (orbit.lock === o.index){ const p = spots[turn]; turn ^= 1; return goWith(p, r); }
    goWith(o, r);
  }
  function goWith(o, r){
    stopTour(false); show.on = show.pending = false; if (LCAM.on) stopLaunchCam(true, true);
    setSpot(o, r); setInfo(o.index);
    if (o.place.kind !== 'c') dayTo(afternoonAt({ up:o.up }), 3);
    const E = frel(earth), up = M3.apply(earth.rot, o.up), rel = V.sub(cam.rel, frel(o)), el = V.dot(V.norm(rel), up);
    if (el > 0.08 && V.len(rel) < 30*R*KM){ lockOn(o.index); return; }
    // (first to about 6,000 km over the place, Earth below; the place turning with it)
    const yp = () => { const d = M3.applyT(camFrameOf(earth), M3.apply(earth.rot, o.up)); return [Math.atan2(d[0], d[2]), Math.asin(clamp(d[1], -0.999, 0.999))]; };
    const [yaw, pitch] = yp();
    pend = o; startFlight(earth, { yaw, pitch, dist:R*KM*1.95, track:yp }, () => { pend = null; lockOn(o.index); });
    motion.last = 'show'; updateModeUI();
  }
  // a link: the place itself (latitude, longitude, kind, n, then the name), checked
  const hashOf = o => o.place.row ? [o.place.la, o.place.lo, o.place.row[1], o.place.row[4], o.place.row[5] || '', o.place.row[6] || ''].join(',') + ',' + o.name : '';
  function fromHash(o, s){
    const f = (s || '').split(','); if (f.length < 7) return false;
    const la = +f[0], lo = +f[1], n = +f[3], kind = f[2];
    if (!(Math.abs(la) <= 90 && Math.abs(lo) <= 180 && isFinite(n) && /^[cCmriw]$/.test(kind))) return false;
    const name = f.slice(6).join(',').slice(0, 80), cc = f[4].slice(0, 2).toUpperCase(), what = f[5].slice(0, 30);
    // (the country's name comes with the list; until then a city just says it is a city)
    setSpot(o, [name, kind, la, lo, n, cc, what]);
    if (cc){ load(); onLoad.push(() => { if (o.place.row && o.place.row[5] === cc){ setSpot(o, o.place.row); if (infoObj === o.index) setInfo(o.index); } }); }
    return true;
  }
  // (while a place on Earth is visited, or flown to, the clock runs in real time, as near a launch pad: at the atlas's usual pace the
  // afternoon it was flown to turned to night on the way)
  const hold = () => { const o = OBJ[orbit.lock]; return !!(o && o.earthSpot && !flight) || !!(flight && (flight.obj.earthSpot || (pend && flight.obj === earth))); };
  return { can, find, go, about, load, spots, hashOf, fromHash, onLoad, hold, get state(){ return state; } };
})();

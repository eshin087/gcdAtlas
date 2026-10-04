// ================================================================ the cities alive, part 2 (0.14.0): planes at the airports and boats on the
// water, as points of light drawn over the ground (drawEnv calls EAS.draw right after it, as points are not depth-tested; each point is
// tested against the heights on the CPU a few times a second, so a boat behind a block or a plane behind a hill is hidden).
//
// Planes (owner's pick: simulated, on the real runways, into the real wind): each airport of the city near the camera (EARTH_CITIES airports,
// OpenStreetMap runways) has a slot every 3600/PEAK seconds for an arrival and one for a departure, each flown or not by the local hour
// (busy by day, a few at night). Each flight uses the runways facing into the wind at its own time (the city's hourly weather, Open-Meteo,
// /api/weather), so a change of wind never moves a plane in the air. Arrivals fly a straight 3 degree approach from 19 km out at 72 m/s,
// touch down 300 m past the threshold and slow down; departures roll, lift off at 78 m/s and climb out straight at about 7 degrees. Lights:
// landing lights (brightest when the plane faces you), a red beacon, white strobes; by day a silver speck. Positions are made up, timings
// typical; the readout says so.
//
// Boats (owner's pick: on the real ferry routes and rivers): every ferry route of the city (OpenStreetMap, `sea` in EARTH_CITIES) carries
// boats back and forth with a minute at each end, spaced along it, at a speed for the city (the Seine's tour boats about 3.5 m/s, the
// Thames Clippers about 9); short crossings at 2.5 m/s. From 6:00 to midnight, a quarter of them at night. A white light at night, a white
// speck by day. They ride on the water as drawn (sea level).
const EAS = (() => {
  const can = /^https?:$/.test(location.protocol), R = 6371000;
  // arrivals an hour at the busiest hours, from each airport's yearly movements (2024, rounded; illustrative), and the share kept at night
  const PEAK = { JFK:30, LGA:26, EWR:28, HND:36, NRT:20, DXB:26, DWC:3, LHR:36, LGW:20, LCY:5, STN:14, LTN:10, CDG:34, ORY:17 };
  const NIGHT = { DXB:0.75, JFK:0.3, HND:0.25 };
  // the prevailing wind (degrees, where it comes from) for calm hours, when runways are used as usual
  const CALM = { newyork:310, tokyo:20, dubai:300, london:250, paris:250 };
  const BOATV = { newyork:8, tokyo:7, dubai:5, london:9, paris:3.5 };
  const S = { city:null, ap:[], routes:[], state:0, pts:[], n:0, vis:new Float32Array(1024), visAt:new Float32Array(1024), vi:0, line:'', seen:0 };
  const MAXP = 1024, ps = makePS(MAXP);
  const spec = { ps, prog:'ptBasic', mode:3, sb:1, size:4.5,   // (4.5 px: a light must fill a character's cell of the scene, two by two pixels, or it averages away)
    rel:() => S.rel, rot:() => S.rot, rad:1e-3*KM, count:() => S.n };
  const hsh = (a, b) => { let x = Math.sin(a*12.9898 + b*78.233)*43758.5453; return x - Math.floor(x); };
  // a city's frame: x east, y up, z south, metres from its centre at sea level; the ground curves away as in FS_SX_ENV
  const loc = (c, la, lo, alt) => { const e = (lo - c.lo)*DEG*R*Math.cos(c.la*DEG), n = (la - c.la)*DEG*R; return [e, alt - (e*e + n*n)/(2*R), -n]; };
  function setup(c){
    S.city = c; S.ap = []; S.routes = [];
    for (const a of c.airports || []){
      const rw = a.runways.map(r => { const A = loc(c, r.a[1], r.a[2], 0), B = loc(c, r.b[1], r.b[2], 0);
        return { r, ends:[[A, B, r.a[0]], [B, A, r.b[0]]].map(([P, Q, des]) => { const d = V.norm(V.sub(Q, P)); return { P, d, hdg:(Math.atan2(d[0], -d[2])/DEG + 360) % 360, des, len:r.len }; }) }; });
      S.ap.push({ a, rw, peak:PEAK[a.iata] || 8, night:NIGHT[a.iata] || 0.06, ele:a.ele || 0, use:new Map() });
    }
    S.state = 1;
    if (c.sea && can) fetch('earth/cities/' + c.sea.file).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(buf => {
      if (S.city !== c) return;
      const b = new Uint8Array(buf), dv = new DataView(buf), nL = dv.getUint32(4, true), nP = dv.getUint32(8, true), unit = dv.getFloat32(12, true), po = 16 + 4*(nL + 1), ao = po + 4*nP;
      let total = 0;
      for (let i=0;i<nL;i++){
        if (b[ao + i] !== 0) continue;   // (ferry routes only)
        const s0 = dv.getUint32(16 + 4*i, true), s1 = dv.getUint32(20 + 4*i, true), pts = [], cum = [0];
        for (let k=s0;k<s1;k++){ const x = dv.getInt16(po + 4*k, true)*unit, y = dv.getInt16(po + 4*k + 2, true)*unit; pts.push([x, -(x*x + y*y)/(2*R), -y]);
          if (pts.length > 1){ const p = pts[pts.length - 1], q = pts[pts.length - 2]; cum.push(cum[cum.length - 1] + Math.hypot(p[0] - q[0], p[2] - q[2])); } }
        const L = cum[cum.length - 1]; if (L < 150) continue;
        const v = L < 1500 ? 2.5 : BOATV[c.key] || 6, n = Math.max(1, Math.min(4, Math.round(L/3000))), cyc = 2*(L/v + 60);
        S.routes.push({ pts, cum, L, v, n, cyc, ph:hsh(i, 7.7)*cyc, name:c.sea.names[b[ao + 3*nL + i]] || '' }); total += n;
        if (total > 160) break;
      }
      S.state = 2;
    }).catch(() => { if (S.city === c) S.state = 2; });
  }
  const at = (rt, s) => { let j = 1; while (j < rt.cum.length - 1 && rt.cum[j] < s) j++; const u = clamp((s - rt.cum[j-1])/Math.max(rt.cum[j] - rt.cum[j-1], 1e-3), 0, 1), a = rt.pts[j-1], b = rt.pts[j];
    return { p:[a[0] + (b[0] - a[0])*u, a[1] + (b[1] - a[1])*u, a[2] + (b[2] - a[2])*u], d:V.norm([b[0] - a[0], 0, b[2] - a[2]]) }; };
  // the local hour of the city at a moment (s since 1970); a fixed offset worked out once a minute is close enough for the timetable
  let tzAt = -1, tzOff = 0;
  function localH(c, t){
    if (Math.abs(t - tzAt) > 3600){ tzAt = t; try { const f = new Intl.DateTimeFormat('en-GB', { timeZone:c.tz, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(t*1000)), g = k => +(f.find(x => x.type === k) || {}).value;
      tzOff = ((g('hour')*60 + g('minute')) - Math.floor(((t/60) % 1440 + 1440) % 1440)); } catch (e) { tzOff = 0; } }
    return (((t/60 + tzOff) % 1440 + 1440) % 1440)/60;
  }
  const dayShare = (h, night) => { const k = h < 5 ? 0 : h < 6.5 ? (h - 5)/1.5 : h < 22 ? 1 : h < 23.5 ? 1 - (h - 22)/1.5 : 0; return night + (1 - night)*k*k*(3 - 2*k); };
  // the runway ends in use for a flight at time t: arrivals on the end facing most into the wind, departures on its parallel twin
  function ends(A, t){
    const key = Math.floor(t/3600); let u = A.use.get(key); if (u) return u;
    const w = wxAt('city-' + S.city.key, (key + 0.5)*3600*1000), calm = !w || !w.real || !(w.ws >= 2.5), wd = calm ? CALM[S.city.key] : w.wd;
    // (the end most into the wind lands; its parallel twin, if any, takes the departures; a long crosswind runway is never chosen over it)
    const all = A.rw.flatMap(r => r.ends), dA = e => Math.abs(((e.hdg - wd + 540) % 360) - 180), arr = all.reduce((p, q) => dA(q) < dA(p) - 1 || (Math.abs(dA(q) - dA(p)) <= 1 && q.len > p.len) ? q : p);
    const twin = all.filter(e => e !== arr && Math.abs(((e.hdg - arr.hdg + 540) % 360) - 180) < 8).sort((p, q) => q.len - p.len)[0];
    u = { arr, dep:twin || arr, wd:Math.round(wd), calm }; A.use.set(key, u); if (A.use.size > 6) A.use.delete(A.use.keys().next().value); return u;
  }
  const TAN3 = Math.tan(3*DEG);
  // the planes flying now at airport A: [position, heading, on the ground] for each
  function planes(A, t, out){
    const I = 3600/A.peak, ele = A.ele;
    for (const kind of [0, 1]){
      const T0 = kind ? 0 : 265, T1 = kind ? 200 : 50, k0 = Math.floor((t - T1)/I), k1 = Math.floor((t + T0)/I);
      for (let k=k0;k<=k1;k++){
        const T = (k + 0.15 + 0.6*hsh(k, A.peak + kind*31))*I, u = t - T; if (u < -T0 || u > T1) continue;
        if (hsh(k*1.7, A.peak*3.1 + kind) > dayShare(localH(S.city, T), A.night)) continue;
        const e = ends(A, T), E = kind ? e.dep : e.arr; let s, h, v, gnd;
        if (!kind){ const TD = 300; if (u < 0){ s = TD + 72*u; h = 15 - 72*u*TAN3; v = 72; gnd = false; } else { const roll = Math.min(72*u - u*u, 1296) + Math.max(u - 36, 0)*10; s = TD + Math.min(roll, E.len - 350); h = 0; v = Math.max(72 - 2*u, 10); gnd = true; } }
        else if (u < 39){ s = u*u; h = 0; v = 2*u; gnd = true; }
        else { const w = u - 39; s = 1521 + 78*w + 0.27*w*w; h = w*(9.5 + 0.035*w); v = 78 + 0.54*w; gnd = false; }
        const p = V.add(E.P, V.mul(E.d, s)); p[1] += ele + h + 4;
        const fade = kind ? clamp((T1 - u)/25, 0, 1)*clamp(u/3, 0, 1) : clamp((u + T0)/25, 0, 1)*clamp((T1 - u)/10, 0, 1);
        out.push({ p, d:E.d, gnd, v, fade, id:k*2 + kind + A.peak*1e5 });
      }
    }
  }
  // what hides a point: the heights between the camera and it (the city's layers, buildings and all), sampled in 12 steps
  function hidden(cf, c, p){
    const fx = V.add(c.env.p, M3.apply(c.env.F.M, V.mul(p, 1e-3))), d = V.sub(fx, cf), L = V.len(d)*1000;
    if (L < 30) return false;
    for (let i=1;i<12;i++){ const q = V.add(cf, V.mul(d, i/12)), alt = (V.len(q) - 6371)*1000;   // (the line's own height above the sea at that point)
      const g = EDT.heightAt(q); if (g != null && g > alt + 1.5) return true; }
    return false;
  }
  function tick(){
    if (!FLAGS.realEarth) return;
    const cf = M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)), alt = V.len(cf) - 6371, c = alt < 90 ? ECT.near(cf) : null;
    if (!c){ S.n = 0; if (S.city && GT - S.seen > 120){ S.city = null; S.state = 0; } return; }
    S.seen = GT; if (S.city !== c){ setup(c); S.vis.fill(1); }
  }
  { const prev = earth.update; let last = -1; earth.update = function(dt){ if (prev) prev.call(this, dt); if (GT !== last){ last = GT; tick(); } }; }
  // the points of this frame, from drawEnv after the ground (camera-relative city frame: rel, Rw)
  function draw(best, rel, Rw){
    const c = best && best.city; if (!c || S.city !== c || !FLAGS.realEarth){ S.n = 0; return; }
    const t = (jdNow() - 2440587.5)*86400, cf = M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)), cam = M3.applyT(c.env.F.M, V.mul(V.sub(cf, c.env.p), 1000));
    const sunEl = Math.asin(clamp(V.dot(M3.applyT(earth.rot, sunDirFrom(earth)), c.up), -1, 1))/DEG, night = 1 - smooth(-6, 4, sunEl), day = 1 - night;
    const list = [], wall = performance.now()/1000;
    for (const A of S.ap) planes(A, t, list);
    const P = ps.a, C = ps.c; let n = 0, k = 0;
    const put = (p, b, r, g, bl) => { if (n >= MAXP || b < 0.01) return; P[n*4] = p[0]; P[n*4 + 1] = p[1]; P[n*4 + 2] = p[2]; P[n*4 + 3] = b; C[n*4] = r; C[n*4 + 1] = g; C[n*4 + 2] = bl; C[n*4 + 3] = 0; n++; };
    // (each object's visibility is checked again every few frames, round robin, and eased so nothing pops)
    const seen = (id, p) => { const j = (Math.abs(Math.floor(id)) % 1009); if ((k++ + S.vi) % 12 === 0) S.visAt[j] = hidden(cf, c, p) ? 0 : 1; S.vis[j] += (S.visAt[j] - S.vis[j])*0.25; return S.vis[j]; };
    for (const f of list){
      const vz = seen(f.id, f.p), b = f.fade*vz; if (b < 0.01) continue;
      const toC = V.norm(V.sub(cam, f.p)), face = Math.max(V.dot(f.d, toC), 0), low = f.p[1] < 3000;
      put(f.p, b*(low ? 1.1 + 2.4*Math.pow(face, 3) : 0.6)*(night*1 + day*0.35*Math.pow(face, 3)), 1, 0.95, 0.85);   // (landing lights, by day only head-on)
      put(V.add(f.p, [0, 3, 0]), b*night*(wall*1.1 % 1 < 0.14 ? 1.2 : 0), 1, 0.15, 0.1);   // (the red beacon, about once a second)
      const st = (wall + hsh(f.id, 2)) % 1.2; put(V.add(f.p, [0, -1, 0]), b*(st < 0.05 || (st > 0.12 && st < 0.17) ? 1.6 : 0)*(0.4 + 0.6*night), 1, 1, 1);   // (white strobes, a double flash)
      put(f.p, b*day*0.8, 0.85, 0.87, 0.9);   // (the plane itself by day, a silver speck)
    }
    if (S.state === 2){
      const h = localH(c, t), on = h >= 6 ? 1 : 0.25;
      S.routes.forEach((rt, ri) => {
        for (let j=0;j<rt.n;j++){
          if (on < 1 && hsh(ri, j + 0.5) > on) continue;
          const q = ((t + rt.ph + j*rt.cyc/rt.n) % rt.cyc + rt.cyc) % rt.cyc, run = rt.L/rt.v, s = q < 60 ? 0 : q < 60 + run ? (q - 60)*rt.v : q < 120 + run ? rt.L : rt.L - (q - 120 - run)*rt.v;
          const a = at(rt, clamp(s, 0, rt.L)), p = a.p; p[1] += 2.5;
          const id = 5e5 + ri*8 + j, vz = seen(id, p); if (vz < 0.01) continue;
          put(p, vz*(1.1*night + 0.6*day), 1, night > 0.5 ? 0.86 : 0.97, night > 0.5 ? 0.66 : 0.95);
        }
      });
    }
    S.vi++; S.n = n;
    if (!n) return;
    ps.upload('ac');
    S.rel = rel; S.rot = Rw;
    drawParticles(earth, spec, 1);
    // (the readout's line: which runways the planes use now, and that they are simulated)
    const u = S.ap.filter(A => A.peak >= 10).map(A => { const e = ends(A, t); return A.a.iata + ' ' + (e.arr === e.dep ? e.arr.des : e.arr.des + ' and ' + e.dep.des); });
    const w = S.ap.length ? ends(S.ap[0], t) : null;
    S.line = u.length ? `planes (simulated): landing ${u.join(', ')}, into the wind${w && !w.calm ? ' from ' + w.wd + '°' : ''}` : '';
  }
  const dbg = () => ({ city:S.city && S.city.key, state:S.state, airports:S.ap.map(A => A.a.iata), routes:S.routes.length, boats:S.routes.reduce((s, r) => s + r.n, 0), points:S.n, line:S.line });
  return { tick, draw, dbg, S, ps, get line(){ return S.line; } };
})();

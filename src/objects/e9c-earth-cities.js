// ================================================================ the five cities (phase 4 of docs/EARTH_PLAN.md, first part, 0.13.0): New York, Tokyo, Dubai, London and Paris,
// from EARTH_CITIES (tools/earth-cities.mjs). Each city's layers (photos and the heights of the ground and its buildings, 51 km down to 3.2 km
// across, and one a main airport) join the Earth detail (e3-earth-detail.js) as a site of their own, so Earth shows them from space as it shows
// the launch sites'. Below 90 km near a city the ground and sky are drawn by FS_SX_ENV with the city as the site: its layers marched finely
// enough for the towers to stand up, the ground anywhere (e7g-earth-ground.js) round them to the horizon, the city's real weather
// (/api/weather) and the blinking lights on its tallest towers. A city picked in the atlas or the search flies to the framings in its data,
// and its readout says its local time and weather.
const ECT = (() => {
  const C = typeof EARTH_CITIES !== 'undefined' && FLAGS.realEarth ? EARTH_CITIES : null;
  const R = 6371, unit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  const cities = C ? C.cities : [];
  // the credit line while a city's ground shows (the licences ask for it), from the sources its data uses
  const creditOf = c => near => 'ground: ' + c.credits.map(k => C.sources[k] && C.sources[k].credit).filter(Boolean).filter(t => near || !/building|OpenStreetMap/i.test(t)).join(' · ') +
    (c.layers.some(L => L.painted) && near ? ' · colours partly illustrative (no open aerial photos: satellite images with the streets and buildings painted in)' : '');
  for (const c of cities){
    c.up = unit(c.la, c.lo);
    c.ed = EDT.addSite(Object.assign({}, c, { pads:{} }), 'cities/', { city:c, credit:creditOf(c) });
    // the ground and sky round the city: a site for drawEnv, at sea level under the city's centre
    c.env = { key:'city-' + c.key, name:c.name, short:c.name, kind:7, city:c, ed:c.ed, coast:[0, 0, 1e9], elev:0, up:c.up, p:V.mul(c.up, R), F:enuOf(c.up) };
    // (the towers' tops, Earth-fixed km, and each one's blink phase)
    c.lights = c.towers.map((t, i) => ({ t, p:V.mul(unit(t.la, t.lo), R + (t.ground + t.h)/1000), ph:(i*0.618) % 1 }));
  }
  // the city the camera is over (its centre within 60 km of the point under the camera), if any
  function near(cf){ const g = V.mul(cf, R/Math.max(V.len(cf), 1)); let best = null, bd = 60;
    for (const c of cities){ const d = V.len(V.sub(g, V.mul(c.up, R))); if (d < bd){ bd = d; best = c; } } return best; }
  // the site drawEnv draws with: the city's layers, then the ground anywhere's as the widest (it holds the horizon)
  function envSite(cf){
    const c = near(cf); if (!c || !c.ed.layers.some(L => L.state === 2)) return null;
    const S = c.env; S.layers = EGR.ready ? c.ed.layers.concat([EGR.layer]) : c.ed.layers; S.top = Math.max(c.ed.top, c.top, EGR.ready ? EGR.site.top : 0);
    return S;
  }
  // the lights on the towers nearest the camera (16 at most, within 30 km), as uniforms in the site's frame: x y z, w the brightness
  // (aviation warning lights: red, blinking about 40 times a minute, each tower at its own moment; bright at night, faint by day)
  const LT = new Float32Array(64); let lastN = 0;
  function lights(S, cf, day){
    LT.fill(0); if (!S || !S.city) return 0;
    const c = S.city, list = c.lights.map(l => [l, V.len(V.sub(l.p, cf))]).filter(x => x[1] < 30).sort((a, b) => a[1] - b[1]).slice(0, 16);
    list.forEach(([l], i) => { const q = M3.applyT(S.F.M, V.mul(V.sub(l.p, S.p), 1000)), f = (GT*0.667 + l.ph) % 1, blink = f < 0.35 ? Math.sin(f/0.35*Math.PI) : 0;
      LT.set([q[0], q[1], q[2], blink*(0.2 + 0.8*(1 - day))], i*4); });
    return lastN = list.length;
  }
  // the slender towers nearest the camera (4 at most, within 30 km), too thin for the height images, drawn by FS_SX_ENV as shapes of their own:
  // a lattice tapering from its foot (the Eiffel Tower's is 125 m across, its top a few metres), or a straight shaft (a mast, a chimney).
  // Their sizes are the real ones; the shapes are simplified
  const TH = new Float32Array(16), THB = new Float32Array(16);
  const footOf = t => /eiffel|tokyo tower/i.test(t.name) ? [Math.min(0.19*t.h, 62), 0] : t.h > 500 ? [34, 0] : t.kind === 'chimney' ? [5, 1] : [12, 1];
  function thin(S, cf){
    TH.fill(0); THB.fill(0); if (!S || !S.city) return 0;
    const list = S.city.towers.filter(t => t.thin).map(t => [t, V.len(V.sub(V.mul(unit(t.la, t.lo), R), cf))]).filter(x => x[1] < 30).sort((a, b) => a[1] - b[1]).slice(0, 4);
    list.forEach(([t], i) => { const q = M3.applyT(S.F.M, V.mul(V.sub(V.mul(unit(t.la, t.lo), R), S.p), 1000)), [hw, straight] = footOf(t);
      TH.set([q[0], q[2], t.ground, t.h], i*4); THB.set([hw, straight, /eiffel|tokyo tower|skytree/i.test(t.name) ? 2 : 0, 0], i*4); });   // (z 2: drawn as a model, in P.sxEnvEf or P.sxEnvTk)
    return list.length;
  }
  // the Eiffel Tower as a model (0.13.0, FS_SX_ENV's EIFFEL copy): its foot in the site's frame, the turn of its faces, and its lights by the
  // tower's own schedule (toureiffel.paris): gold from about 10 minutes after sunset (here the Sun 1.5 degrees under the horizon) to
  // 23:45, sparkling for 5 minutes on the hour. Null away from Paris (more than 30 km from the tower)
  const EF = { g:0, s:0, at:0, fmt:null };
  function eiffel(S, cf, sunEl){
    if (!S || !S.city || S.city.key !== 'paris') return null;
    const tw = S.city.towers.find(t => /eiffel/i.test(t.name)), u = tw && unit(tw.la, tw.lo);
    if (!tw || V.len(V.sub(V.mul(u, R), cf)) > 30) return null;
    const q = M3.applyT(S.F.M, V.mul(V.sub(V.mul(u, R), S.p), 1000)), b = 138.2*DEG;   // (its faces look along the Champ de Mars, to 138 degrees)
    let hm = 20*60;
    try { if (!EF.fmt) EF.fmt = new Intl.DateTimeFormat('en-GB', { timeZone:S.city.tz, hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
      const pt = EF.fmt.formatToParts(new Date((jdNow() - 2440587.5)*86400000)); hm = +pt.find(x => x.type === 'hour').value*60 + +pt.find(x => x.type === 'minute').value; } catch (e) {}
    const on = sunEl < -1.5 && hm >= 12*60 && hm < 23*60 + 45, now = performance.now(), dt = EF.at ? Math.min((now - EF.at)/1000, 0.5) : 1; EF.at = now;
    EF.g += ((on ? 1 : 0) - EF.g)*Math.min(1, dt*1.5); EF.s += ((on && hm % 60 < 5 ? 1 : 0) - EF.s)*Math.min(1, dt*3);
    return [q[0], q[2], tw.ground, Math.atan2(-Math.cos(b), Math.sin(b)), EF.g, EF.s, (now/1000) % 1000, 0];
  }
  // Tokyo Tower and the Skytree as models (0.14.0, FS_SX_ENV's TOKYO copy): their feet, the turn of their faces (illustrative), and their
  // lights: from about 10 minutes after sunset to midnight; the Skytree in its two styles on alternate days (Iki, light blue; Miyabi,
  // purple), Tokyo Tower orange (its winter Landmark Light, October to early July) or white (summer)
  const TK = { a:0, b:0, at:0, fmt:null };
  function tokyo(S, cf, sunEl){
    if (!S || !S.city || S.city.key !== 'tokyo') return null;
    const tt = S.city.towers.find(t => /tokyo tower/i.test(t.name)), sk = S.city.towers.find(t => /skytree/i.test(t.name)); if (!tt || !sk) return null;
    const ft = t => M3.applyT(S.F.M, V.mul(V.sub(V.mul(unit(t.la, t.lo), R), S.p), 1000)), a = ft(tt), b = ft(sk);
    let hm = 20*60, mo = 10, dd = 1;
    try { if (!TK.fmt) TK.fmt = new Intl.DateTimeFormat('en-GB', { timeZone:S.city.tz, hour:'2-digit', minute:'2-digit', month:'numeric', day:'numeric', hourCycle:'h23' });
      const pt = TK.fmt.formatToParts(new Date((jdNow() - 2440587.5)*86400000)), g = k => +(pt.find(x => x.type === k) || {}).value; hm = g('hour')*60 + g('minute'); mo = g('month'); dd = g('day'); } catch (e) {}
    const on = sunEl < -1.5 && hm >= 12*60, now = performance.now(), dt = TK.at ? Math.min((now - TK.at)/1000, 0.5) : 1; TK.at = now;
    TK.a += ((on ? 1 : 0) - TK.a)*Math.min(1, dt*1.5); TK.b += ((on ? 1 : 0) - TK.b)*Math.min(1, dt*1.5);
    const day = Math.floor((jdNow() + S.city.lo/360)), summer = (mo === 7 && dd >= 7) || mo === 8 || mo === 9;
    return [a[0], a[2], tt.ground, 0.3, b[0], b[2], sk.ground, 0.5, TK.a, TK.b, day % 2, summer ? 1 : 0];
  }
  // the landmarks of the cities of 0.19.0 as models (FS_SX_ENV's LM copies): where each stands (its middle), which way its own x points (b,
  // degrees from north: along the bridge, the sign, the building's axis; its front faces b + 90), the ground there (g, m above the sea: the
  // city's own heights when they are in, else this), and whether it is lit at night. The Hollywood sign is not
  const LMK = {
    sanfrancisco:{ prog:'sxEnvSF', lit:true, items:[{ name:'the Golden Gate Bridge', la:37.81870, lo:-122.47825, b:-7.1, g:0, water:true }] },
    sydney:{ prog:'sxEnvSyd', lit:true, items:[{ name:'the Sydney Opera House', la:-33.85680, lo:151.21530, b:20, g:3 }] },
    rome:{ prog:'sxEnvRome', lit:true, items:[{ name:'the Colosseum', la:41.89021, lo:12.49223, b:72, g:21 }, { name:"St Peter's Basilica", la:41.90220, lo:12.45330, b:96, g:33 }] },   // (the Colosseum's long axis about 72 degrees from north, St Peter's facade toward 96: OpenStreetMap outlines)
    losangeles:{ prog:'sxEnvLA', lit:false, items:[{ name:'the Hollywood sign', la:34.13412, lo:-118.32150, b:110, g:485 }] },
    rio:{ prog:'sxEnvRio', lit:true, items:[{ name:'Christ the Redeemer', la:-22.95192, lo:-43.21049, b:-15, g:700 }] },
  };
  const LM = { k:0, at:0 };
  function landmarks(S, cf, sunEl){
    const L = S && S.city && LMK[S.city.key]; if (!L) return null;
    const u = [];
    for (const it of L.items){
      const p = V.mul(unit(it.la, it.lo), R); if (V.len(V.sub(p, cf)) > 40){ u.push(null); continue; }
      const q = M3.applyT(S.F.M, V.mul(V.sub(p, S.p), 1000)), h = it.water ? null : EDT.heightAt(p);
      u.push([q[0], q[2], h != null && h > -50 ? h : it.g, (it.b - 90)*DEG]);
    }
    if (!u.some(Boolean)) return null;
    const now = performance.now(), dt = LM.at ? Math.min((now - LM.at)/1000, 0.5) : 1; LM.at = now;
    LM.k += ((L.lit && sunEl < -1.5 ? 1 : 0) - LM.k)*Math.min(1, dt*1.5);
    const a = u[0] || u[1], b = u[1] || u[0];
    return { prog:L.prog, u0:a, u1:b, u2:[LM.k, (now/1000) % 1000, u.filter(Boolean).length > 1 && u[0] && u[1] ? 2 : 1, 0] };
  }
  // the time and weather there now (the atlas clock's moment), for the readout
  const WMO = c => c == null ? '' : c === 0 ? 'clear' : c <= 1 ? 'mainly clear' : c === 2 ? 'partly cloudy' : c === 3 ? 'overcast' : c <= 48 ? 'fog' : c <= 57 ? 'drizzle' :
    c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'showers' : c <= 86 ? 'snow showers' : 'thunderstorms';
  function nowLine(c){
    const ms = (jdNow() - 2440587.5)*86400000;
    let t = ''; try { t = new Intl.DateTimeFormat('en-GB', { timeZone:c.tz, hour:'2-digit', minute:'2-digit', weekday:'short' }).format(new Date(ms)) + ' local time'; } catch (e) {}
    const w = typeof wxAt === 'function' ? wxAt('city-' + c.key, ms) : null;
    const wt = w && w.real ? `${w.temp != null ? Math.round(w.temp) + ' °C, ' : ''}${WMO(w.code)}, wind ${Math.round(w.ws)} m/s` : '';
    return [t, wt].filter(Boolean).join(' · ');
  }
  // the city a place result is (its name and within 30 km of its centre), for the place objects (e7s-earth-search.js)
  function match(la, lo, name){ const u = unit(la, lo);
    return cities.find(c => V.len(V.sub(V.mul(u, R), V.mul(c.up, R))) < 30 && (!name || name.toLowerCase() === c.name.toLowerCase() || c.facts.aka.includes(name.toLowerCase()))) || null; }
  // a place object set to a city: its facts, its framings (each looking at its own point, given as an offset from the place's middle), its readout
  EPL.spotHooks.push((o, r) => {
    const c = match(o.place.la, o.place.lo, r[0]); o.city = c; if (!c) return;
    o.place.la = c.la; o.place.lo = c.lo; o.name = c.name; o.rad = 3*KM; o.minZoom = 0.05;
    const pop = c.facts.population, F = enuOf(c.up), h0 = c.ele || 0;
    o.fact = c.facts.facts.join(' ') + ` (${pop.source}, ${pop.year}.)`;
    // (first the nearest landmark, where the buildings and their colours are clear, then the wide view, then the other landmark; owner,
    // 0.13.0: "arrive closer, then go wide". A made-up view from 3 km above the centre showed a flat grey carpet)
    const fv = c.facts.views, vs = [fv[1], fv[0]].concat(fv.slice(2));
    o.views = vs.map(v => {
      const e = (v.look[1] - c.lo)*DEG*R*1000*Math.cos(c.la*DEG), n = (v.look[0] - c.la)*DEG*R*1000, az = v.az*DEG, ti = v.tilt*DEG;
      // (the aim as a function, so viewParams turns it with the Earth every frame: a fixed one stayed put in space while the Earth turned,
      // and after the time was moved the camera looked at the far side of the city, or from under the ground)
      const off = [e/3000, (v.look[2] - h0)/3000, -n/3000];
      return { d:[-Math.sin(az)*Math.cos(ti), Math.sin(ti), Math.cos(az)*Math.cos(ti)], k:v.dist/3000, off:() => off, hold:11, drift:0.012 };
    });
    o.readoutExtra = () => [nowLine(c), EAS.S.city === c ? EAS.line : ''].filter(Boolean).join('\n');
  });
  // (tests: the site the ground is drawn with, the city's layers that are in, the tower lights last drawn)
  const dbg = (key) => ({ cam:(() => { const c = cities.find(x => x.key === key); if (!c) return null; const q = M3.applyT(c.env.F.M, V.mul(V.sub(camFixed(), c.env.p), 1000)); return [Math.round(q[0]), Math.round(q[1]), Math.round(-q[2])]; })(), env:typeof SXENV !== 'undefined' && SXENV.on && SXENV.site ? SXENV.site.key : null, eiffel:typeof SXENV !== 'undefined' && SXENV.on && !!SXENV.eiffel, tokyo:typeof SXENV !== 'undefined' && SXENV.on && !!SXENV.tokyo, landmark:typeof SXENV !== 'undefined' && SXENV.on ? SXENV.lm || null : null, cityProg:typeof SXENV !== 'undefined' && SXENV.on && !!SXENV.city, layers:cities.map(c => c.key + ' ' + c.ed.layers.filter(L => L.state === 2).length + '/' + c.ed.layers.length), lights:lastN });
  return { cities, near, envSite, lights, LT, thin, TH, THB, eiffel, EF, tokyo, TK, landmarks, LMK, nowLine, match, dbg };
})();

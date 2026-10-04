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
    o.views = c.facts.views.map(v => {
      const e = (v.look[1] - c.lo)*DEG*R*1000*Math.cos(c.la*DEG), n = (v.look[0] - c.la)*DEG*R*1000, az = v.az*DEG, ti = v.tilt*DEG;
      return { d:[-Math.sin(az)*Math.cos(ti), Math.sin(ti), Math.cos(az)*Math.cos(ti)], k:v.dist/3000, off:[e/3000, (v.look[2] - h0)/3000, -n/3000], hold:11, drift:0.012 };
    });
    o.readoutExtra = () => nowLine(c);
  });
  // (tests: the site the ground is drawn with, the city's layers that are in, the tower lights last drawn)
  const dbg = (key) => ({ cam:(() => { const c = cities.find(x => x.key === key); if (!c) return null; const q = M3.applyT(c.env.F.M, V.mul(V.sub(camFixed(), c.env.p), 1000)); return [Math.round(q[0]), Math.round(q[1]), Math.round(-q[2])]; })(), env:typeof SXENV !== 'undefined' && SXENV.on && SXENV.site ? SXENV.site.key : null, layers:cities.map(c => c.key + ' ' + c.ed.layers.filter(L => L.state === 2).length + '/' + c.ed.layers.length), lights:lastN });
  return { cities, near, envSite, lights, LT, nowLine, match, dbg };
})();

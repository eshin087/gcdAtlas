// ================================================================ the whole Earth seen from space: real colours, month by month, with its relief, the depth of the sea and
// sharper night lights (phase 1 of docs/EARTH_PLAN.md). The maps are made by tools/earth-global.mjs (listed in EARTH_GLOBAL) and served
// next to the page as earth/global-*.webp, 4096 x 2048 on a desk and 2048 x 1024 on a phone. None is in the page: they are fetched when
// Earth grows past a small disc on the screen and let go of a minute after it has shrunk away, so the first load stays as it was. Until
// they arrive, and offline (the artifact page), Earth keeps its painted map.
// The colours are NASA's Blue Marble of the month the atlas clock shows, blended toward the neighbouring month by the date (the images
// stand for the middle of their month), so snow spreads and forests green up as the time machine runs. FS_EARTH draws them (uEgC0, uEgC1,
// uEgD on texture units 13 to 15, uEg); Earth's shader is unchanged in cost while they are not there (one uniform test).
const EGL = (() => {
  const can = FLAGS.realEarth && /^https?:$/.test(location.protocol) && typeof createImageBitmap === 'function';
  const SZ = !isCompact() && gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096 ? 4096 : 2048, F = EARTH_GLOBAL.sizes[SZ];
  const T = {};   // file -> { t, state 0 none / 1 loading / 2 ready / 3 failed, used }
  let dummy = null, fade = 0, lastT = -1e9, seen = -1e9, off = false;   // (off: tests compare with the painted map)
  function load(file){
    const e = T[file] || (T[file] = { t:null, state:0, used:0 }); e.used = GT;
    if (e.state || !can) return e;
    e.state = 1;
    fetch('earth/' + file).then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(async b => {
        // (a month's colours also small on the CPU, 512 x 256: where it is white (snow, ice) the real clouds' picture is not taken for cloud
        // near the ground, e5c-earth-clouds.js)
        if (F.color.includes(file)) try { const s = await createImageBitmap(b, { resizeWidth:512, resizeHeight:256, resizeQuality:'medium' });
          const cv = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(512, 256) : Object.assign(document.createElement('canvas'), { width:512, height:256 });
          const cx = cv.getContext('2d', { willReadFrequently:true }); cx.drawImage(s, 0, 0); const px = cx.getImageData(0, 0, 512, 256).data, m = new Uint8Array(512*256);
          for (let i=0;i<m.length;i++) m[i] = Math.min(px[i*4], px[i*4 + 1], px[i*4 + 2]); e.cpu = m; if (s.close) s.close(); } catch (er) { e.cpu = null; }
        return createImageBitmap(b, { premultiplyAlpha:'none', colorSpaceConversion:'none' }); })
      .then(img => {
        if (glLost){ e.state = 0; return; }
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // (round the world east to west; clamped at the poles)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
        if (img.close) img.close();
        e.t = t; e.state = 2;
      })
      .catch(err => { e.state = 3; console.info('real Earth: ' + file + ' not loaded (' + err + ')'); });
    return e;
  }
  function free(file){ const e = T[file]; if (e && e.t) gl.deleteTexture(e.t); delete T[file]; }
  // the month the atlas clock shows (0 to 11) and the neighbouring one it blends toward: the two cross over in the five days either side of
  // the change of month (half and half on the 1st), so for most of the month only one image is in memory (each is 45 MB on a desk's GPU)
  function months(){
    const d = new Date((jdNow() - 2440587.5)*86400000), m = d.getUTCMonth(), dim = new Date(Date.UTC(d.getUTCFullYear(), m + 1, 0)).getUTCDate();
    const f = (d.getUTCDate() - 1 + d.getUTCHours()/24)/dim - 0.5, x = clamp((Math.abs(f) - 0.5 + 5/dim)/(5/dim), 0, 1), w = 0.5*x*x*(3 - 2*x);
    return f < 0 ? { a:m, b:(m + 11) % 12, w } : { a:m, b:(m + 1) % 12, w };
  }
  // twice a second: fetch what a near Earth needs, let go of what has not been drawn for a minute
  function tick(){
    if (!can || GT - lastT < 0.5) return; lastT = GT;
    const near = earth.rpx > 40 && !earth.hidden;
    if (near){ seen = GT; const M = months(); load(F.data); load(F.color[M.a]); if (M.w > 0.002) load(F.color[M.b]); }
    // (Earth draws with its copy that reads the maps once one month and the data are here; that copy compiles in the background meanwhile)
    EARTH_PR.eg = !off && !!ready(F.data) && F.color.some(f => ready(f)); earthProgPick();
    // (a month no longer drawn goes after 20 s; everything a minute after Earth has shrunk away)
    for (const f in T) if (GT - T[f].used > (f === F.data ? 60 : 20) && (f !== F.data || GT - seen > 60)) free(f);
  }
  // the uniforms: the two months (the nearest ready one standing in for one still loading), the data, how far it has faded in
  const ready = f => T[f] && T[f].state === 2 ? T[f] : null;
  function bind(pr){
    if (!pr.u.uEg) return;
    if (!dummy){ dummy = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dummy); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); }
    const M = months(), d = ready(F.data);
    let A = ready(F.color[M.a]), B = ready(F.color[M.b]), w = M.w;
    if (!A && B){ A = B; w = 0; } if (!B) { B = A; w = 0; }
    if (!A){ for (const f of F.color) if (ready(f)){ A = B = T[f]; w = 0; break; } }   // (the time machine ran ahead: the last month loaded meanwhile)
    const on = !!(A && d) && !off;
    fade = on ? Math.min(1, fade + 0.04) : 0;   // (about a second to fade in once both are ready, never a pop)
    for (const [u, e, name] of [[13, A, 'uEgC0'], [14, B, 'uEgC1'], [15, d, 'uEgD']]){ gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, e ? e.t : dummy); gl.uniform1i(pr.u[name], u); if (e && (e !== B || w > 0)) e.used = GT; }
    gl.activeTexture(gl.TEXTURE0);
    // (w: the map's level of detail, like uP0.w for the painted map: about one texel a pixel across the middle of the disc)
    gl.uniform4f(pr.u.uEg, on ? fade : 0, w, 7, Math.log2(Math.max(SZ/(4*Math.max(earth.rpx, 1)), 1)));
  }
  { const prev = earth.setU; earth.setU = function(pr){ prev.call(this, pr); bind(pr); }; }
  { const prev = earth.update; earth.update = function(dt){ if (prev) prev.call(this, dt); tick(); }; }
  // (the credit line: NASA's images while they show)
  { const prev = earth.readout; earth.readout = () => { const t = prev(); return fade > 0.5 && orbit.lock === earth.index ? t + '\nground: NASA Blue Marble (' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][months().a] + ' 2004) · GEBCO · NASA Black Marble' : t; }; }
  // (tests: the camera over a latitude and longitude, k Earth radii from the centre, and the Sun up there, el degrees, in the afternoon)
  function lookAt(la, lo, k = 2, el = 45){
    const u = [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
    lockOn(earth.index); flight = null; show.on = show.pending = false; tour.on = false;
    let best = ssDays, bd = 1e9; const d0 = ssDays;
    for (let h=0;h<96;h++){ ssDays = d0 + h/96; earth.update(0); const s = sunDirFrom(earth), up = M3.apply(earth.rot, u), e = Math.asin(V.dot(s, up))/DEG;
      ssDays += 0.01; earth.update(0); const e2 = Math.asin(V.dot(sunDirFrom(earth), M3.apply(earth.rot, u)))/DEG; ssDays -= 0.01;
      const dd = Math.abs(e - el) + (e2 < e ? 0 : 60); if (dd < bd){ bd = dd; best = ssDays; } }
    ssDays = best; earth.update(0);
    orbit.lock = earth.index; cam.focus = earth.index; orbit.frame = camFrameOf(earth); const d = M3.applyT(orbit.frame, M3.apply(earth.rot, u));
    orbit.yaw = Math.atan2(d[0], d[2]); orbit.pitch = Math.asin(d[1]); orbit.dist = orbit.distT = earth.rad*k; orbit.off = [0, 0, 0]; orbit.target = [0, 0, 0]; applyOrbit(); return 1;
  }
  // how white the month's map is at u, v (0 to 1, from the CPU copy; 0 before it is in): snow and ice
  function snowAt(u, v){ const M = months(), e = T[F.color[M.a]] || T[F.color[M.b]]; if (!e || !e.cpu) return 0;
    const x = ((Math.floor(u*512) % 512) + 512) % 512, y = clamp(Math.floor(v*256), 0, 255); return smooth(0.45, 0.75, e.cpu[y*512 + x]/255); }
  return { SZ, months, lookAt, bind, snowAt, set off(v){ off = !!v; fade = 0; }, get on(){ return fade > 0; }, get fade(){ return fade; }, get ready(){ return Object.keys(T).filter(f => T[f].state === 2); }, tick };
})();

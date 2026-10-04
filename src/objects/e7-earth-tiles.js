// ================================================================ the Earth's finer tiles (phase 2 of docs/EARTH_PLAN.md): the land at about 2.4 km a pixel, four times
// sharper than the global maps (e5-earth-global.js), in 512-pixel tiles made by tools/earth-tiles.mjs (listed in EARTH_TILES) and served as
// earth/<dir>/<file>. Only the tiles the camera is near enough to see sharper are fetched (their pixels would show at least half a screen
// pixel), within a fixed number of slots (32 on a desk, 12 on a phone; the oldest go first), and drawn into two texture arrays: the detail of
// January and July (two layers a slot) and the data (one), with a small index texture saying which slot holds which tile and how far it has
// faded in. A tile's detail is the ratio of Blue Marble at 500 m to the global map of its month, so FS_EARTH multiplies the global map of the
// month on the clock by it: from far away the tiles are exactly the global map, near they add the detail, and the snow and green of the month
// still come from the month's own map. Nothing is fetched until the real Earth's maps are in, and nothing at all offline.
const ETL = (() => {
  const T = typeof EARTH_TILES !== 'undefined' ? EARTH_TILES : null;
  const can = !!T && FLAGS.realEarth && /^https?:$/.test(location.protocol) && typeof createImageBitmap === 'function';
  const NX = T ? T.n[0] : 32, NY = T ? T.n[1] : 16, PX = T ? T.px : 512, SLOTS = isCompact() ? 12 : 32, TEXEL = 2*Math.PI*6371/(NX*PX);   // (km at the equator)
  const has = new Uint8Array(NX*NY); if (T) for (let k=0;k<NX*NY;k++) has[k] = (parseInt(T.has[k >> 2], 16) >> (3 - (k & 3))) & 1;
  const tiles = new Map();   // k -> { k, x, y, slot, st:{ d, c01, c07 } (0 none, 1 loading, 2 in, 3 failed), fade, s (its season, eased), used, pri }
  const slots = new Array(SLOTS).fill(null), ind = new Uint8Array(NX*NY*4);
  let arrC = null, arrD = null, indT = null, dum = null, ver = 0, busy = 0, lastT = -1e9, dirty = true, on = false, season = 0.5, hgtN = 0, seen = -1e9;
  const unitLL = (la, lo) => [Math.cos(la)*Math.cos(lo), Math.sin(la), -Math.cos(la)*Math.sin(lo)];
  // the season of the detail: 0 January's, 1 July's, all of one from about 10 November to 20 February and 10 May to 20 August, blended between
  function seasonNow(){ const d = new Date((jdNow() - 2440587.5)*86400000), y0 = Date.UTC(d.getUTCFullYear(), 0, 1), doy = (d - y0)/86400000;
    return smooth(0.25, 0.75, 0.5 - 0.5*Math.cos(2*Math.PI*(doy - 14)/365.25)); }
  function gl0(){
    if (arrC) return;
    const mk = n => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, PX, PX, n);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    arrC = mk(2*SLOTS); arrD = mk(SLOTS);
    indT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, indT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NX, NY, 0, gl.RGBA, gl.UNSIGNED_BYTE, ind);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  // one file of a tile into its layer (kind 'd' the data, 'c01' / 'c07' the detail)
  function fetchInto(t, kind){
    t.st[kind] = 1; busy++;
    const file = (kind === 'd' ? 'd' : kind) + '-' + t.x + '-' + t.y + '.webp';
    fetch('earth/' + T.dir + '/' + file).then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(b => createImageBitmap(b, { premultiplyAlpha:'none', colorSpaceConversion:'none' }))
      .then(img => {
        busy--;
        if (glLost || slots[t.slot] !== t){ t.st[kind] = 0; if (img.close) img.close(); return; }   // (its slot was given to another tile meanwhile)
        gl0();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, kind === 'd' ? arrD : arrC);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, kind === 'd' ? t.slot : 2*t.slot + (kind === 'c07' ? 1 : 0), PX, PX, 1, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
        // (the data's heights stay on the CPU too, for the cameras near the ground and the ground's height steps: heightAt. Whole: a copy at
        // half the size averaged the peaks down, and the ground's layer cut the Alps off at 2,500 m)
        if (kind === 'd') try { const N = PX, cv = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(N, N) : Object.assign(document.createElement('canvas'), { width:N, height:N });
          const cx = cv.getContext('2d', { willReadFrequently:true }); cx.drawImage(img, 0, 0, N, N); const px = cx.getImageData(0, 0, N, N).data, h = new Uint8Array(N*N*2);
          let mx = 0; for (let i=0;i<N*N;i++){ h[i*2] = px[i*4]; h[i*2 + 1] = px[i*4 + 3]; if (px[i*4 + 3] >= 160 && px[i*4] > mx) mx = px[i*4]; }
          t.hgt = h; t.hmax = 8848*(mx/255)**2; hgtN++; } catch (e) { t.hgt = null; }
        if (img.close) img.close();
        t.st[kind] = 2; dirty = true;
      })
      .catch(e => { busy--; t.st[kind] = 3; console.info('earth tiles: ' + file + ' not loaded (' + e + ')'); });
  }
  // the nearest a tile comes to the camera (km), and whether any of it faces the camera: 9 points over it
  function near(x, y, cf){
    let dm = 1e9, face = false;
    // (first the tile's point nearest the one under the camera, its latitude and longitude each held within the tile's: with the camera
    // over a tile's edge, between two of the samples below, the tile under it came out 20% farther than it is and was left out)
    { const r = V.len(cf), la = Math.asin(clamp(cf[1]/r, -1, 1)), lo = Math.atan2(-cf[2], cf[0]), w = 2*Math.PI/NX;
      const la0 = (90 - (y + 1)*180/NY)*DEG, la1 = (90 - y*180/NY)*DEG, lm = (-180 + (x + 0.5)*360/NX)*DEG;
      let dl = lo - lm; dl -= 2*Math.PI*Math.round(dl/(2*Math.PI));
      const p = V.mul(unitLL(clamp(la, la0, la1), lm + clamp(dl, -w/2, w/2)), 6371), v = V.sub(p, cf);
      dm = V.len(v); face = V.dot(v, p) < 0; }
    for (let j=0;j<=2;j++) for (let i=0;i<=2;i++){
      const lo = (-180 + (x + i/2)*360/NX)*DEG, la = (90 - (y + j/2)*180/NY)*DEG, p = V.mul(unitLL(la, lo), 6371), v = V.sub(p, cf);
      const d = V.len(v); if (d < dm) dm = d; if (V.dot(v, p) < 0) face = true; }
    return face ? dm : 1e9;
  }
  // four times a second: which tiles the camera is near enough to see sharper (and the ground site's, extra), loaded into slots, the rest
  // kept until a slot is wanted (the least recently wanted goes first)
  const extra = new Set(); let dbgW = null, off = false;   // (off: tests compare with the global maps alone)
  function tick(){
    if (!can || GT - lastT < 0.25) return; lastT = GT;
    on = EGL.on && !earth.hidden;
    season = seasonNow();
    if (!on){ if (arrC && GT - seen > 60) freeAll(); return; }
    seen = GT;
    const cf = M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)), pix = 2*tanY/sceneH, reach = 2*TEXEL/pix;
    const want = [];
    for (let y=0;y<NY;y++) for (let x=0;x<NX;x++){ const k = y*NX + x; if (!has[k]) continue;
      // (the ground's tiles ahead of every other, and nearest first among themselves: all at 0, a slot short near the poles or on a phone
      // could leave out the tile under the camera; from Codex's review of #43)
      const dn = near(x, y, cf), d = extra.has(k) ? Math.min(dn, 1e5) - 1e6 : dn; if (d < reach) want.push([k, d]); }
    want.sort((a, b) => a[1] - b[1]); dbgW = { reach, alt:V.len(cf) - 6371, n:want.length, near:want.slice(0, 3) };
    for (const [k, d] of want.slice(0, SLOTS)){
      let t = tiles.get(k);
      if (!t){ t = { k, x:k % NX, y:Math.floor(k/NX), slot:-1, st:{ d:0, c01:0, c07:0 }, fade:0, s:season, used:GT }; tiles.set(k, t); }
      t.used = GT; t.pri = d;
      if (t.slot < 0){
        let i = slots.indexOf(null);
        if (i < 0){ let old = null; for (const u of slots) if (u.used < GT && (!old || u.used < old.used)) old = u; if (!old) continue; i = old.slot; drop(old); }
        t.slot = i; slots[i] = t; t.st = { d:0, c01:0, c07:0 }; t.fade = 0; dirty = true;
      }
    }
    // (the nearest first, four files in flight at most; the detail of both seasons only while the date blends them)
    for (const t of [...slots].filter(Boolean).sort((a, b) => b.used - a.used || a.pri - b.pri)){
      if (busy >= 4) break;
      if (!t.st.d) fetchInto(t, 'd');
      else if (season < 0.98 && !t.st.c01) fetchInto(t, 'c01');
      else if (season > 0.02 && !t.st.c07) fetchInto(t, 'c07');
    }
  }
  // (a minute after Earth was last near, the arrays go: 96 MB on a desk's GPU)
  function freeAll(){ for (const t of [...slots]) if (t) drop(t); for (const x of [arrC, arrD, indT]) gl.deleteTexture(x); arrC = arrD = indT = null; ind.fill(0); }
  function drop(t){ slots[t.slot] = null; t.slot = -1; t.fade = 0; if (t.hgt){ t.hgt = null; hgtN--; } t.st = { d:0, c01:0, c07:0 }; tiles.delete(t.k); dirty = true; }
  // once a frame (from Earth's uniforms): the fades and seasons eased, the index texture updated when anything changed
  let lastF = 0;
  function frame(){
    const dt = clamp(GT - lastF, 0, 0.1); lastF = GT;
    for (const t of slots){ if (!t) continue;
      const ready = t.st.d === 2 && (t.st.c01 === 2 || t.st.c07 === 2);
      const sw = t.st.c01 === 2 && t.st.c07 === 2 ? season : t.st.c07 === 2 ? 1 : 0;
      const f = ready ? Math.min(1, t.fade + dt*1.2) : 0, s = t.s + (sw - t.s)*Math.min(1, dt*2);
      if (f !== t.fade || Math.abs(s - t.s) > 1e-3){ t.fade = f; t.s = s; dirty = true; } }
    if (!dirty || !arrC) return; dirty = false;
    ind.fill(0);
    for (const t of slots){ if (!t || !(t.fade > 0)) continue; const o = t.k*4; ind[o] = t.slot + 1; ind[o + 1] = Math.round(t.fade*255); ind[o + 2] = Math.round(t.s*255); ind[o + 3] = 255; }
    gl.bindTexture(gl.TEXTURE_2D, indT); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NX, NY, gl.RGBA, gl.UNSIGNED_BYTE, ind); ver++;
  }
  // the uniforms (units 1 to 3, which only the post passes use otherwise, and they bind theirs each frame)
  function bind(pr){
    if (!pr.u.uEt) return;
    const live = can && on && !!arrC && !off;
    if (live) frame();
    // (before the first tile, tiny stand-ins: the arrays are made only when one arrives)
    if (!live && !dum){ dum = {}; for (const k of ['c', 'd']){ const t = dum[k] = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, 1, 1, 2); }
      dum.i = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dum.i); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.bindTexture(gl.TEXTURE_2D_ARRAY, live ? arrC : dum.c); gl.uniform1i(pr.u.uEtC, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null); gl.bindTexture(gl.TEXTURE_2D_ARRAY, live ? arrD : dum.d); gl.uniform1i(pr.u.uEtD, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, live ? indT : dum.i); gl.uniform1i(pr.u.uEtI, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4f(pr.u.uEt, live ? 1 : 0, NX, NY, TEXEL*1000);
  }
  // the height of the land (m above the sea, 0 at sea) at a latitude and longitude (radians), from a loaded tile, or null
  function heightAt(la, lo){
    if (!hgtN) return null;
    const u = (lo/(2*Math.PI) + 0.5)*NX, v = (0.5 - la/Math.PI)*NY, x = Math.floor(u), y = Math.floor(v), t = tiles.get(clamp(y, 0, NY - 1)*NX + ((x % NX) + NX) % NX);
    if (!t || !t.hgt) return null;
    const N = PX, fx = clamp((u - x)*N - 0.5, 0, N - 1.001), fy = clamp((v - y)*N - 0.5, 0, N - 1.001), i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const h = (ii, jj) => { const o = (jj*N + ii)*2; return t.hgt[o + 1] < 160 ? 0 : 8848*(t.hgt[o]/255)**2; };
    return (h(i, j)*(1 - tx) + h(i + 1, j)*tx)*(1 - ty) + (h(i, j + 1)*(1 - tx) + h(i + 1, j + 1)*tx)*ty;
  }
  { const prev = earth.setU; earth.setU = function(pr){ prev.call(this, pr); bind(pr); }; }
  { const prev = earth.update; earth.update = function(dt){ if (prev) prev.call(this, dt); tick(); }; }
  return { can, NX, NY, PX, SLOTS, TEXEL, has, tick, bind, heightAt, get season(){ return season; }, get ver(){ return ver; }, get dbg(){ return { on, lastT, dbgW, extra:extra.size }; }, set off(v){ off = !!v; },
    // (the highest land in the tiles of these keys whose heights are in (m), or null if none is)
    maxIn(keys){ let m = null; for (const k of keys){ const t = tiles.get(k); if (t && t.hgt) m = Math.max(m || 0, t.hmax); } return m; },
    // (the ground site's tiles: wanted whatever the camera's distance; keys y*NX + x)
    want(keys){ extra.clear(); for (const k of keys) if (has[k]) extra.add(k); },
    get state(){ return [...tiles.values()].map(t => ({ k:t.k, slot:t.slot, d:t.st.d, c01:t.st.c01, c07:t.st.c07, fade:+t.fade.toFixed(2) })); },
    get arrays(){ return { arrC, arrD, indT }; } };
})();

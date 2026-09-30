// ================================================================ Earth detail round the launch sites: real images of the ground and the heights of what stands on it
// The images are made by tools/earth-detail.mjs (the list is EARTH_DETAIL, e2-earth-detail-data.js) and served next to the page as
// earth/<file>.webp. None of them is in the page itself: the page fetches a site's layers only when the camera heads there (the 410 km
// region from a few thousand km away, the finer ones as it closes in, all of them at once when a rocket there is picked) and lets go of
// them when the camera has been far away for a while, so the first load stays as small as before and memory stays bounded however many
// sites are added. Offline, in the artifact page and when a file cannot be fetched, the ground keeps its sketch (FS_SX_ENV) and Earth its map.
// A layer is a square in the orthographic projection of a 6,371 km sphere round its centre; the shaders place points on it with ED_GLSL
// (03-glsl-common.js), in Earth's own frame (FS_EARTH) or in a launch site's (FS_SX_ENV). Credits: docs/ACCURACY.md.
const EDT = (() => {
  const unit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  const axes = u => { const e = V.norm(V.cross([0, 1, 0], u)); return { e, n:V.cross(u, e) }; };
  const sites = EARTH_DETAIL.sites.map(S => ({ key:S.key, name:S.name, c:unit(S.la, S.lo), pads:S.pads, top:S.top || 0, used:0,
    layers:S.layers.map(L => Object.assign({}, L, { c:unit(L.la, L.lo) }, axes(unit(L.la, L.lo)), { tex:null, state:0 })).sort((a, b) => a.size - b.size) }));
  const can = /^https?:$/.test(location.protocol) && typeof createImageBitmap === 'function';
  let dummy = null, last = 0;
  const ANISO = gl.getExtension('EXT_texture_filter_anisotropic');
  function load(L){
    if (L.state || !can) return;
    L.state = 1;
    fetch('earth/' + L.file).then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(b => createImageBitmap(b, { premultiplyAlpha:'none', colorSpaceConversion:'none' }))
      .then(img => {
        if (glLost){ L.state = 0; return; }
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        // (colours and heights as they are in the file: no premultiplied alpha, no colour conversion)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (ANISO) gl.texParameterf(gl.TEXTURE_2D, ANISO.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));   // (sharp at glancing angles)
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
        if (img.close) img.close();
        L.tex = t; L.state = 2;
      })
      .catch(e => { L.state = 3; console.info('earth detail: ' + L.file + ' not loaded (' + e + ')'); });
  }
  function free(L){ if (L.tex) gl.deleteTexture(L.tex); L.tex = null; L.state = 0; }
  // the camera, in Earth-fixed km (the same as camFixed in s3-spacex.js, which loads later)
  const camE = () => M3.applyT(earth.rot, V.mul(V.sub(cam.rel, frel(earth)), 1/KM));
  // once a second: load what the camera is heading for, let go of what it left
  function tick(){
    if (!can || !FLAGS.spacex || GT - last < 1) return; last = GT;
    const cf = camE(), r = V.len(cf), alt = r - 6371, g = V.mul(cf, 6371/Math.max(r, 1));
    for (const S of sites){
      const dS = V.len(V.sub(g, V.mul(S.c, 6371))) + Math.max(alt, 0)*0.5;
      if (dS < 4500) S.used = GT;
      for (const L of S.layers){ const dL = V.len(V.sub(g, V.mul(L.c, 6371))) + Math.max(alt, 0)*0.7, k = L.size/1000;
        if (dL < Math.max(k*5, 25) + (k > 100 ? 4000 : 0)) load(L); }
      if (GT - S.used > 120) for (const L of S.layers) if (L.state === 2) free(L);
    }
    // Earth draws with the images (P.earthEd, compiled in the background the first time) only near a site that has some ready
    const S = pick(); earth.prog = S && progReady(P.earthEd) ? P.earthEd : P.earth;
  }
  // all of a site's layers now (a rocket there was picked)
  function want(key){ const S = sites.find(s => s.key === key); if (S){ S.used = GT; for (const L of S.layers) load(L); } }
  const siteOfPad = k => sites.find(s => s.pads[k]);
  // the site whose layers the camera sees: the nearest one within 5,000 km that has any ready
  function pick(){ const cf = camE(); let best = null, bd = 5000;
    for (const S of sites){ const d = V.len(V.sub(cf, V.mul(S.c, 6371))); if (d < bd && S.layers.some(L => L.state === 2)){ bd = d; best = S; } } return best; }
  // the uniforms: up to four ready layers of site S, finest first (the fine patches only near them), in Earth's frame or a site's.
  // Earth's shader takes only the two widest (ED_N 2 there: seen from space the finer ones add nothing, and it compiles at start-up)
  const ub = { C:new Float32Array(16), E:new Float32Array(16), N:new Float32Array(16), X:new Float32Array(16) };
  function bind(pr, S, frame){
    if (!pr.u.uEdS) return;
    if (!dummy){ dummy = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dummy); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); }
    const N = frame.earth ? 2 : 4;
    let ls = [];
    if (S){ const cf = camE(), alt = V.len(cf) - 6371, g = V.mul(cf, 6371/Math.max(V.len(cf), 1)), near = L => V.len(V.sub(g, V.mul(L.c, 6371))) + Math.max(alt, 0);
      // (a 1.6 km patch adds detail only within a few km of the camera; the others while the camera is anywhere near them)
      for (const L of S.layers){ if (L.state !== 2) continue; const k = L.size/1000; if (k < 20 && near(L) > (k < 5 ? k*1.5 + 2 : k*6 + 10)) continue; ls.push(L); }
      if (frame.earth) ls = ls.slice(-N);
      // more than four: the fine patches farthest away go first, then the second widest (the widest stays: it holds the horizon)
      while (ls.length > N){ const fine = ls.filter(L => L.size < 5000).sort((a, b) => near(b)/b.size - near(a)/a.size);
        ls.splice(ls.indexOf(fine.length > 1 ? fine[0] : ls[ls.length - 2]), 1); } }
    ub.C.fill(0); ub.E.fill(0); ub.N.fill(0); ub.X.fill(0);
    ls.forEach((L, i) => {
      let c, e, n;
      if (frame.earth){ c = V.mul(L.c, 0.893); e = L.e; n = L.n; }
      else { c = M3.applyT(frame.M, V.mul(V.sub(V.mul(L.c, 6371), frame.p), 1000)); e = M3.applyT(frame.M, L.e); n = M3.applyT(frame.M, L.n); }
      ub.C.set([c[0], c[1], c[2], L.size/2], i*4); ub.E.set([e[0], e[1], e[2], 0], i*4); ub.N.set([n[0], n[1], n[2], 0], i*4); ub.X.set([L.px, L.base, L.step, 0], i*4);
    });
    gl.uniform4fv(pr.u.uEdC, ub.C, 0, N*4); gl.uniform4fv(pr.u.uEdE, ub.E, 0, N*4); gl.uniform4fv(pr.u.uEdN, ub.N, 0, N*4); gl.uniform4fv(pr.u.uEdX, ub.X, 0, N*4);
    gl.uniform4f(pr.u.uEdS, ls.length, frame.earth ? 6371000/0.893 : 1, S ? S.top : 0, 0);
    for (let i=0;i<N;i++){ gl.activeTexture(gl.TEXTURE9 + i); gl.bindTexture(gl.TEXTURE_2D, ls[i] ? ls[i].tex : dummy); gl.uniform1i(pr.u['uEd' + i], 9 + i); }
    gl.activeTexture(gl.TEXTURE0);
    if (ls.length) S.used = GT;
    return ls.length;
  }
  // the credit line for the ground in view (the licences ask for it: Copernicus Sentinel data, OpenStreetMap's ODbL), from the layers drawn;
  // near is false seen from space, where only the satellite images show
  function credit(S, near){ if (!S) return ''; const ls = S.layers.filter(L => L.state === 2 && (near || L.size > 20000)); if (!ls.length) return '';
    const naip = ls.some(L => L.naip), s2 = ls.some(L => L.src.includes('s2')), bld = near && ls.some(L => L.bld);
    const yrs = [...new Set(ls.flatMap(L => L.s2dates || []).map(d => d.slice(0, 4)))].sort(), yr = yrs.length > 1 ? yrs[0] + ' to ' + yrs[yrs.length - 1] : yrs[0] || '';
    return 'ground: ' + [naip ? 'USGS aerial photos' : '', s2 ? `contains modified Copernicus Sentinel data ${yr}` : '', bld ? 'buildings © OpenStreetMap contributors' : ''].filter(Boolean).join(' · '); }
  // what the readout adds now: the ground under a launch camera or near a pad, or the images on Earth seen from space nearby
  function creditNow(){
    if (!can || !FLAGS.spacex) return '';
    if (typeof SXENV !== 'undefined' && SXENV.on && SXENV.site && SXENV.site.key) return credit(siteOfPad(SXENV.site.key), true);
    if (earth.prog === P.earthEd && orbit.lock === earth.index){ const alt = V.len(camE()) - 6371; if (alt < 2500) return credit(pick(), false); }
    return '';
  }
  { const prev = earth.readout; earth.readout = () => { const t = prev(), c = creditNow(); return c ? t + '\n' + c : t; }; }
  // Earth's shader takes the layers of the site nearest the camera
  { const prev = earth.setU; earth.setU = function(pr){ prev.call(this, pr); bind(pr, FLAGS.spacex ? pick() : null, { earth:true }); }; }
  return { sites, tick, want, bind, pick, siteOfPad, credit, creditNow, load, get ready(){ return sites.flatMap(S => S.layers.filter(L => L.state === 2).map(L => S.key + '-' + L.id)); } };
})();

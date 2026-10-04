// ================================================================ the real clouds (0.13.0, owner: "make sure the weather and clouds look natural, realistic and tied to real data"): NASA
// GIBS's true-colour picture of a recent day over the whole Earth (VIIRS, each place as seen at about 1:30 pm on one pass, a day or two old),
// through our own /api/clouds (api/clouds.js), fetched once when Earth is near. FS_EARTH draws its clouds from it in place of the made-up
// ones: cloud is what is white in the picture (smoothstep(0.42, 0.85) of its darkest channel), less where the month's Blue Marble is white
// too (snow and ice, which the picture shows white as well). Near the ground anywhere (e7g-earth-ground.js) the sky's cloud cover is taken from
// the same picture round the place; the launch sites and the five cities keep their hour-by-hour weather. Without it (offline, the artifact
// page, an error) the made-up clouds stay.
const ECLD = (() => {
  const can = FLAGS.realEarth && FLAGS.live && /^https?:$/.test(location.protocol) && typeof createImageBitmap === 'function';
  let tex = null, dum = null, cov = null, state = 0, tried = -1e9, fade = 0, day = '', lastT = -1e9;
  const CW = 1024, CH = 512;
  function load(){
    state = 1; tried = GT;
    fetch('/api/clouds').then(async r => { if (!r.ok) throw r.status; day = r.headers.get('X-Clouds-Date') || ''; return r.blob(); })
      .then(async b => {
        const img = await createImageBitmap(b, { premultiplyAlpha:'none', colorSpaceConversion:'none' });
        // (on the CPU, smaller: the cloud cover round a place near the ground)
        const small = await createImageBitmap(b, { resizeWidth:CW, resizeHeight:CH, resizeQuality:'medium' });
        const cv = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(CW, CH) : Object.assign(document.createElement('canvas'), { width:CW, height:CH });
        const cx = cv.getContext('2d', { willReadFrequently:true }); cx.drawImage(small, 0, 0); const px = cx.getImageData(0, 0, CW, CH).data;
        cov = new Uint8Array(CW*CH);
        for (let i=0;i<CW*CH;i++){ const m = Math.min(px[i*4], px[i*4 + 1], px[i*4 + 2])/255; cov[i] = px[i*4] + px[i*4 + 1] + px[i*4 + 2] < 30 ? 255 : Math.round(254*smooth(0.42, 0.85, m)); }   // (255: no data there)
        if (small.close) small.close();
        if (glLost){ state = 0; return; }
        tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
        if (img.close) img.close();
        state = 2;
      })
      .catch(e => { state = 3; console.info('real clouds unavailable, made-up ones instead (' + e + ')'); });
  }
  function tick(){ if (!can || GT - lastT < 1) return; lastT = GT;
    if ((state === 0 || (state === 3 && GT - tried > 300)) && earth.rpx > 40 && !earth.hidden) load(); }
  // the cloud cover (0 to 1) round a place (radians), averaged over about 60 km, less where the month's map is snow or ice; null without data
  function coverAt(la, lo){
    if (!cov) return null;
    let s = 0, n = 0;
    for (let j=-2;j<=2;j++) for (let i=-2;i<=2;i++){
      const u = ((lo + i*0.0025*Math.PI/Math.max(Math.cos(la), 0.2))/(2*Math.PI) + 0.5), v = 0.5 - (la + j*0.0025*Math.PI)/Math.PI;
      const x = ((Math.floor(u*CW) % CW) + CW) % CW, y = clamp(Math.floor(v*CH), 0, CH - 1), c = cov[y*CW + x]; if (c === 255) continue;
      const snow = EGL.snowAt(u, v); s += c/254*(1 - 0.85*snow); n++; }
    return n ? s/n : null;
  }
  // the weather near the ground from it: how much low, middle and high cloud, and how far one can see (illustrative split by height)
  function wxAt(la, lo){ const c = coverAt(la, lo); if (c == null) return null;
    return { low:0.8*c, mid:0.35*c, high:0.3*c, ws:4, wd:270, ws850:8, wd850:270, vis:60000 - 45000*c, rain:c > 0.85 ? 0.4 : 0, code:c < 0.15 ? 1 : c < 0.5 ? 2 : 3, rh:50 + 40*c, real:false, sat:true }; }
  function bind(pr){
    if (!pr.u.uCl) return;
    fade = state === 2 ? Math.min(1, fade + 0.03) : 0;
    if (!dum){ dum = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dum); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); }
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, state === 2 ? tex : dum); gl.uniform1i(pr.u.uClT, 4); gl.activeTexture(gl.TEXTURE0);
    gl.uniform4f(pr.u.uCl, fade, 0, 0, 0);
  }
  { const prev = earth.setU; earth.setU = function(pr){ prev.call(this, pr); bind(pr); }; }
  { const prev = earth.update; earth.update = function(dt){ if (prev) prev.call(this, dt); tick(); }; }
  // (the credit while they show)
  const dayTxt = () => { const d = new Date(day + 'T12:00:00Z'); return isFinite(d) ? d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] : 'a recent day'; };
  { const prev = earth.readout; earth.readout = () => { const t = prev(); return fade > 0.5 && orbit.lock === earth.index ? t + '\nclouds: NASA GIBS, VIIRS, ' + dayTxt() + ' (a snapshot, not live)' : t; }; }
  return { coverAt, wxAt, get ready(){ return state === 2; }, get on(){ return fade > 0; }, get day(){ return day; }, dayTxt };
})();

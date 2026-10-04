// ================================================================ the ground anywhere (phase 2 of docs/EARTH_PLAN.md). Near the launch sites the ground and sky are drawn by
// FS_SX_ENV from their own layers (e3-earth-detail.js). Everywhere else, once the camera is lower than about 120 km, a "ground site" stands in
// for a launch site: a square 2,400 km across round a point under the camera, baked on the GPU from the global maps and the finer tiles into
// one layer in the launch sites' format (RGB the ground, alpha its height in steps), so FS_SX_ENV marches the mountains and draws the sky
// over them as it does at the pads. The site moves on when the camera has gone 450 km from its middle; the layer is baked again when the
// tiles under it arrive or the month changes. Its colours are made so that the ground shader's edLin gives the globe's colours (FS_EARTH),
// so from 30 km up the two look the same.
const FS_ET_BAKE = `#version 300 es
precision highp float; precision highp sampler2DArray;
uniform sampler2D uEgC0; uniform sampler2D uEgC1; uniform sampler2D uEgD; uniform vec4 uEg;
uniform sampler2DArray uEtC; uniform sampler2DArray uEtD; uniform sampler2D uEtI; uniform vec4 uEt;
uniform vec3 uBc; uniform vec3 uBe; uniform vec3 uBn; uniform vec4 uB;   // the layer's centre, east and north (Earth-fixed), uB: its size (m), pixels, base, step
out vec4 fragColor;
void main(){
  vec2 q = gl_FragCoord.xy/uB.y; float x = (q.x - 0.5)*uB.x, y = (0.5 - q.y)*uB.x;   // (row 0 is the north edge, as in the images)
  vec3 n = normalize(uBe*x + uBn*y + uBc*sqrt(max(4.0589641e13 - x*x - y*y, 0.)));
  vec2 uv = vec2(atan(-n.z, n.x)*0.15915494 + 0.5, 0.5 - asin(clamp(n.y, -1., 1.))*0.31830989);
  vec3 bm = mix(textureLod(uEgC0, uv, 0.).rgb, textureLod(uEgC1, uv, 0.).rgb, uEg.y);
  vec4 d = textureLod(uEgD, uv, 0.);
  if(uEt.x > 0.5){
    vec2 tc = uv*uEt.yz; vec4 ix = texelFetch(uEtI, ivec2(clamp(floor(tc), vec2(0.), uEt.yz - 1.)), 0);
    if(ix.r > 0.){ float sl = floor(ix.r*255. + 0.5) - 1., dx = 1./float(textureSize(uEtD, 0).x); vec2 f = clamp(fract(tc), 0.5*dx, 1. - 0.5*dx);
      vec3 r = mix(textureLod(uEtC, vec3(f, sl*2.), 0.).rgb, textureLod(uEtC, vec3(f, sl*2. + 1.), 0.).rgb, ix.b);
      bm = mix(bm, max((bm + 0.00784)*exp2((r - 0.5)*4.) - 0.00784, 0.), ix.g);
      d = mix(d, textureLod(uEtD, vec3(f, sl), 0.), ix.g); }
  }
  float A = d.a > 0.5 ? clamp(2. + (8848.*d.r*d.r - uB.z)/uB.w, 2., 255.) : 1.;
  // (edLin(c) = c^1.6 x 2.6 then gives the globe's pow(bm, 1.2) x 1.9)
  fragColor = vec4(pow(pow(max(bm, 0.), vec3(1.2))*0.7308, vec3(0.625)), A/255.);
}`;
P.etBake = program(VS_RECT, FS_ET_BAKE);
const EGR = (() => {
  const R = 6371, SIZE = 2400e3, NPX = isCompact() ? 1024 : 2048;
  const unit = (la, lo) => [Math.cos(la)*Math.cos(lo), Math.sin(la), -Math.cos(la)*Math.sin(lo)];
  const L = { id:'ground', c:null, e:null, n:null, size:SIZE, px:NPX, base:0, step:35, top:0, tex:null, state:0, src:[] };
  const G = { key:'ground', name:'the ground', short:'the ground', kind:6, ground:true, coast:[0, 0, 1e9], elev:0, layers:[L], top:0, used:0, p:null, up:null, F:null, la:0, lo:0 };
  let fb = null, lastT = -1e9, bakedAt = -1e9, bakedVer = -1, seen = -1e9, fade = 0, active = false;
  // the site's middle at a point (Earth-fixed unit vector); the tiles under the square are asked for
  function centre(u){
    G.up = u; G.p = V.mul(u, R); G.F = enuOf(u); G.la = Math.asin(clamp(u[1], -1, 1)); G.lo = Math.atan2(-u[2], u[0]);
    const e = V.norm(V.cross([0, 1, 0], u)); L.c = u; L.e = e; L.n = V.cross(u, e);
    const ks = new Set();
    for (let j=0;j<=8;j++) for (let i=0;i<=8;i++){ const x = (i/8 - 0.5)*SIZE/1000, y = (j/8 - 0.5)*SIZE/1000, z = Math.sqrt(Math.max(R*R - x*x - y*y, 0));
      const p = V.norm(V.add(V.add(V.mul(L.e, x), V.mul(L.n, y)), V.mul(u, z))), la = Math.asin(p[1]), lo = Math.atan2(-p[2], p[0]);
      ks.add(clamp(Math.floor((0.5 - la/Math.PI)*ETL.NY), 0, ETL.NY - 1)*ETL.NX + ((Math.floor((lo/(2*Math.PI) + 0.5)*ETL.NX) % ETL.NX) + ETL.NX) % ETL.NX); }
    ETL.want(keys = [...ks]); bakedVer = -1;
  }
  // the highest land under the square (m), from the tiles' own highest points: the layer's height steps, and where the march starts
  let keys = [];
  const topNow = () => { const m = ETL.maxIn(keys); return m == null ? 8848 : m; };
  function bake(){
    if (!progReady(P.etBake)) return false;
    const pr = P.etBake, top = Math.max(topNow()*1.08 + 50, 300);
    if (!L.tex){ L.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, L.tex); gl.texStorage2D(gl.TEXTURE_2D, Math.log2(NPX) + 1, gl.RGBA8, NPX, NPX);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const AN = gl.getExtension('EXT_texture_filter_anisotropic'); if (AN) gl.texParameterf(gl.TEXTURE_2D, AN.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(AN.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, L.tex, 0); }
    const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING), vp = gl.getParameter(gl.VIEWPORT), bl = gl.isEnabled(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, NPX, NPX); gl.disable(gl.BLEND);
    gl.useProgram(pr.p); EGL.bind(pr); ETL.bind(pr);
    gl.uniform3fv(pr.u.uBc, L.c); gl.uniform3fv(pr.u.uBe, L.e); gl.uniform3fv(pr.u.uBn, L.n);
    L.base = 0; L.step = top/253; L.top = top; G.top = top;
    gl.uniform4f(pr.u.uB, SIZE, NPX, L.base, L.step); gl.uniform4f(pr.u.uRect, -1, -1, 1, 1);
    drawQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb); gl.viewport(vp[0], vp[1], vp[2], vp[3]); if (bl) gl.enable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, L.tex); gl.generateMipmap(gl.TEXTURE_2D);
    L.state = 2; bakedAt = GT; bakedVer = ETL.ver; return true;
  }
  function free(){ if (L.tex) gl.deleteTexture(L.tex); if (fb) gl.deleteFramebuffer(fb); L.tex = fb = null; L.state = 0; G.p = null; fade = 0; }
  // four times a second: where the site is, whether to bake again; the fade once a tick
  function tick(dt){
    fade = active && L.state === 2 ? Math.min(1, fade + dt*1.5) : 0;
    if (GT - lastT < 0.25) return; lastT = GT;
    const cf = M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)), r = V.len(cf), alt = r - R;
    active = ETL.can && EGL.on && alt < 120 && !earth.hidden && !SKYV.on;
    if (!active){ if (L.tex && GT - seen > 60) free(); return; }
    seen = GT;
    const u = V.mul(cf, 1/r);
    if (!G.p || V.len(V.sub(V.mul(u, R), G.p)) > 450){ centre(u); L.state = L.state === 2 ? 1 : 0; }
    // (again when tiles under it came in, at most once a second, and every half minute for the month's slow change)
    if (bakedVer !== ETL.ver && GT - bakedAt > 1 || GT - bakedAt > 30 || L.state !== 2) bake();
  }
  // (once a frame, on the page's own clock: Earth's update also runs with the clock moved for a moment, to see where a pad will be)
  let lastGT = -1;
  { const prev = earth.update; earth.update = function(dt){ if (prev) prev.call(this, dt); if (GT !== lastGT){ const d = lastGT < 0 ? 0 : GT - lastGT; lastGT = GT; tick(d); } }; }
  // (tests: the camera's height above the sea (km) and the Sun's elevation over the site (degrees))
  function dbg(){ const cf = M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)), s = M3.applyT(earth.rot, sunDirFrom(earth));
    return { alt:+(V.len(cf) - R).toFixed(2), sun:G.up ? +(Math.asin(V.dot(s, G.up))/DEG).toFixed(1) : null, top:Math.round(G.top), la:+(G.la/DEG).toFixed(2), lo:+(G.lo/DEG).toFixed(2) }; }
  return { site:G, layer:L, dbg, get ready(){ return active && L.state === 2 && !!G.p; }, get fade(){ return fade; }, bake, centre };
})();

// ================================================================ the cities alive, part 2 (0.14.0, phase 4 of the real Earth; owner's picks
// 2026-10-04: lights at night and specks by day, simulated planes on the real runways into the real wind, boats on the ferry routes and
// rivers). This file is the traffic on the roads.
//
// A city's roads (OpenStreetMap: motorway to tertiary, their lanes, one-way, bridges; `roads` in EARTH_CITIES) are drawn once into two road
// maps on the GPU: 'far', the whole city (48 km across), and 'near', 8 km round the camera, drawn again when the camera moves on. Each texel
// holds the road on it: the direction of travel, how far the texel's centre lies across from the road's centre line, its lanes and class,
// one-way and bridge. FS_SX_ENV's CITY copy reads them where its rays meet the ground and draws the cars there: each lane's cars spaced and
// moving by how busy the roads are at the city's local hour, at a speed for the road's class (illustrative: no live traffic data), on the
// side of the road the city drives on. At night they are lights (white coming toward you, red going away), by day faint specks.
const ETR = (() => {
  const can = /^https?:$/.test(location.protocol);
  const SMALL = Math.min(screen.width, screen.height) < 700, NN = SMALL ? 1024 : 2048, HN = 4000, HF = 24000, LW = 3.3;
  const S = { city:null, state:0, n:0, vao:null, vbo:null, near:{ tex:null, fb:null, c:[0, 0], at:-1 }, far:{ tex:null, fb:null, c:[0, 0], at:-1 }, seen:0, busy:0.5, hm:-1, fmt:null, fmtTz:'' };
  // the road maps' program: each road segment an instanced quad, widened by a texel and a half so even a lane shows on the far map
  const VS_RD = `#version 300 es
layout(location=0) in vec4 aC; layout(location=1) in vec4 aS; layout(location=2) in vec4 aI;
uniform vec4 uV;   // the map's centre (m east, north of the city's centre), its half-size (m), the extra half-width (m)
uniform float uR;   // the offset across is encoded over +-uR m
out vec4 vS; out vec4 vI;
void main(){
  vec2 a = aS.xy, b = aS.zw, t = normalize(b - a + vec2(1e-6, 0.)), nr = vec2(t.y, -t.x); float w = aI.w + uV.w;
  vec2 P = mix(a, b, aC.x) + t*aC.z*w + nr*aC.y*w;
  vS = aS; vI = aI; gl_Position = vec4((P - uV.xy)/uV.z, 0., 1.);
}`;
  const FS_RD = `#version 300 es
precision highp float;
in vec4 vS; in vec4 vI; uniform vec4 uV; uniform float uN; uniform float uR; out vec4 o;
void main(){
  vec2 P = uV.xy + (gl_FragCoord.xy/uN*2. - 1.)*uV.z, a = vS.xy, b = vS.zw, t = normalize(b - a + vec2(1e-6, 0.)), nr = vec2(t.y, -t.x);
  // r: the direction of travel (of the points' order) in turns; g: the texel centre's offset across the road, +-uR m; b: lanes*16 + class*2 +
  // one-way; a: 1, or 0.6 on a bridge
  o = vec4(fract(atan(t.y, t.x)/6.2831853 + 1.), clamp(dot(P - a, nr)/(2.*uR) + 0.5, 0., 1.), (vI.x*16. + vI.y)/255., vI.z > 0.5 ? 0.6 : 1.);
}`;
  let prog = null;
  function load(c){
    S.city = c; S.state = 1;
    fetch('earth/cities/' + c.roads.file).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(buf => {
      if (S.city !== c) return;
      const b = new Uint8Array(buf), dv = new DataView(buf), nL = dv.getUint32(4, true), nP = dv.getUint32(8, true), unit = dv.getFloat32(12, true);
      const po = 16 + 4*(nL + 1), ao = po + 4*nP, segs = [];
      for (let i=0;i<nL;i++){
        const cls = b[ao + i], lanes = Math.min(Math.max(b[ao + nL + i], 1), 12), fl = b[ao + 2*nL + i];
        if (fl & 8 || cls > 4) continue;   // (tunnels are underground)
        const one = fl & 2 ? 1 : 0, bridge = fl & 4 ? 1 : 0, s0 = dv.getUint32(16 + 4*i, true), s1 = dv.getUint32(20 + 4*i, true);
        for (let k=s0;k<s1 - 1;k++){
          const ax = dv.getInt16(po + 4*k, true)*unit, ay = dv.getInt16(po + 4*k + 2, true)*unit, bx = dv.getInt16(po + 4*k + 4, true)*unit, by = dv.getInt16(po + 4*k + 6, true)*unit;
          if (ax === bx && ay === by) continue;
          segs.push([ax, ay, bx, by, lanes, cls*2 + one, bridge, lanes*LW*0.5]);
        }
      }
      // (minor roads first, motorways last: where roads cross, the bigger one's traffic is drawn)
      segs.sort((p, q) => (q[5] >> 1) - (p[5] >> 1));
      const inst = new Float32Array(segs.length*8); segs.forEach((s, i) => inst.set(s, i*8));
      build(inst, segs.length); S.state = 2; S.near.at = -1; S.far.at = -1;
    }).catch(() => { if (S.city === c) S.state = 3; });
  }
  function build(inst, n){
    if (!prog){ prog = program(VS_RD, FS_RD); progReady(prog, true); }
    if (!S.vao){ S.vao = gl.createVertexArray(); S.vbo = gl.createBuffer(); S.cb = gl.createBuffer(); }
    gl.bindVertexArray(S.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.cb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, -1, 0,  0, 1, -1, 0,  1, 1, 1, 0,  0, -1, -1, 0,  1, 1, 1, 0,  1, -1, 1, 0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.vbo); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    S.n = n;
  }
  // (pad: m added each side of a road, R: the offset's range; the far map's roads padded wide, so far off the streams can be drawn wider than life)
  const PAD = { near:[12, 40], far:[70, 100] };
  function map(M, c, half){
    if (!M.tex){
      M.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, M.tex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, NN, NN);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      M.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, M.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, M.tex, 0);
    }
    const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING), vp = gl.getParameter(gl.VIEWPORT), bl = gl.isEnabled(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, M.fb); gl.viewport(0, 0, NN, NN); gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const [pad, R] = M === S.far ? PAD.far : PAD.near;
    gl.useProgram(prog.p); gl.uniform4f(prog.u.uV, c[0], c[1], half, pad + half/NN); gl.uniform1f(prog.u.uN, NN); gl.uniform1f(prog.u.uR, R);
    gl.bindVertexArray(S.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, S.n); gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb); gl.viewport(vp[0], vp[1], vp[2], vp[3]); if (bl) gl.enable(gl.BLEND);
    M.c = c.slice(); M.at = GT;
  }
  function free(){
    for (const M of [S.near, S.far]){ if (M.tex) gl.deleteTexture(M.tex); if (M.fb) gl.deleteFramebuffer(M.fb); M.tex = M.fb = null; M.at = -1; }
    if (S.vao){ gl.deleteVertexArray(S.vao); gl.deleteBuffer(S.vbo); gl.deleteBuffer(S.cb); S.vao = S.vbo = S.cb = null; }
    S.city = null; S.state = 0; S.n = 0;
  }
  // how busy the roads are at a local hour (0 to 1): low before dawn, the morning and evening rush on weekdays, a flatter day at weekends
  // (illustrative, after typical city traffic counts)
  const WKD = [[0, 0.18], [4, 0.1], [6, 0.45], [7.5, 0.95], [9, 0.8], [12, 0.65], [16, 0.8], [17.5, 1], [19, 0.75], [21, 0.45], [24, 0.18]];
  const WKE = [[0, 0.28], [4, 0.12], [8, 0.25], [11, 0.6], [15, 0.65], [19, 0.55], [23, 0.35], [24, 0.28]];
  const curve = (P, h) => { for (let i=1;i<P.length;i++) if (h <= P[i][0]){ const a = P[i-1], b = P[i], u = (h - a[0])/(b[0] - a[0]); return a[1] + (b[1] - a[1])*(u*u*(3 - 2*u)); } return P[P.length - 1][1]; };
  function busyNow(c){
    let hm = 12*60, wd = 'Wed';
    try { if (!S.fmt || S.fmtTz !== c.tz){ S.fmt = new Intl.DateTimeFormat('en-GB', { timeZone:c.tz, hour:'2-digit', minute:'2-digit', weekday:'short', hourCycle:'h23' }); S.fmtTz = c.tz; }
      const pt = S.fmt.formatToParts(new Date((jdNow() - 2440587.5)*86400000)), g = t => (pt.find(x => x.type === t) || {}).value;
      hm = +g('hour')*60 + +g('minute'); wd = g('weekday'); } catch (e) {}
    S.hm = hm; return curve(wd === 'Sat' || wd === 'Sun' ? WKE : WKD, hm/60);
  }
  // once a tick: load the roads of the city the camera is over, draw the maps, let them go two minutes after leaving
  function tick(){
    if (!can || !FLAGS.realEarth) return;
    const cf = M3.applyT(earth.rot, V.mul(earth.rel, -1/KM)), alt = V.len(cf) - 6371, c = alt < 90 ? ECT.near(cf) : null;
    if (!c){ if (S.city && GT - S.seen > 120) free(); return; }
    S.seen = GT;
    if (S.city !== c){ free(); if (c.roads) load(c); return; }
    if (S.state !== 2) return;
    S.busy = busyNow(c);
    if (S.far.at < 0) map(S.far, [0, 0], HF);
    // (the near map round the point under the camera, again when it is 1.5 km off its centre)
    const q = M3.applyT(c.env.F.M, V.mul(V.sub(cf, c.env.p), 1000)), en = [Math.round(q[0]/250)*250, Math.round(-q[2]/250)*250];
    if (S.near.at < 0 || Math.hypot(en[0] - S.near.c[0], en[1] - S.near.c[1]) > 1500) map(S.near, en, HN);
  }
  { const prev = earth.update; let last = -1; earth.update = function(dt){ if (prev) prev.call(this, dt); if (GT !== last){ last = GT; tick(); } }; }
  // the maps and the traffic's numbers for FS_SX_ENV's CITY copy: uRdN = near centre (east, north), its half-size, the far half-size;
  // uRdT = how busy (-1: no maps), the side of the road (1 right, -1 left), the clock (s), 0
  function bind(pr, city){
    if (!pr.u.uRdN) return;
    const on = city && S.city === city && S.state === 2 && S.near.at >= 0 && S.far.at >= 0 && !S.off;   // (S.off: tests)
    gl.activeTexture(gl.TEXTURE13); gl.bindTexture(gl.TEXTURE_2D, on ? S.near.tex : EDT.dummy()); gl.uniform1i(pr.u.uRd0, 13);
    gl.activeTexture(gl.TEXTURE14); gl.bindTexture(gl.TEXTURE_2D, on ? S.far.tex : EDT.dummy()); gl.uniform1i(pr.u.uRd1, 14);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4f(pr.u.uRdN, S.near.c[0], S.near.c[1], HN, HF);
    // (the cars' clock: the atlas clock, which runs in real time near the ground, so moving the time moves the traffic too; it starts again every
    // six hours, kept small for the shader's precision)
    gl.uniform4f(pr.u.uRdT, on ? S.busy : -1, city && city.drive === 'left' ? -1 : 1, ((jdNow() - 2440587.5)*86400) % 21600, S.debug ? 1 : 0);
  }
  const dbg = () => ({ city:S.city && S.city.key, state:S.state, segs:S.n, busy:+S.busy.toFixed(2), hm:S.hm, near:S.near.c, nearAt:S.near.at, farAt:S.far.at });
  return { tick, bind, free, busyNow, dbg, S };
})();

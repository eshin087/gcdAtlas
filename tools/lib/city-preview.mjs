// Preview PNGs without a browser: a written layer (its WebP read back) as photo times a hillshade of its heights, with lines drawn over it.
// Lines are in the city's plane (metres east, north of its centre), like the line binaries; layer pixel = (x - dx + size/2)/m.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { OUT, CACHE, clampN } from './city-common.mjs';

export const PREVIEW_DIR = path.join(CACHE, 'preview');
fs.mkdirSync(PREVIEW_DIR, { recursive:true });

export async function readLayer(meta){
  const { data } = await sharp(path.join(OUT, meta.file)).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  return data;
}
function line(buf, N, x0, y0, x1, y1, col, w){
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))*2));
  for (let k=0;k<=n;k++){
    const x = x0 + dx*k/n, y = y0 + dy*k/n;
    for (let oy=-w;oy<=w;oy++) for (let ox=-w;ox<=w;ox++){ if (ox*ox + oy*oy > w*w + 0.5) continue; const xi = Math.round(x) + ox, yi = Math.round(y) + oy; if (xi < 0 || yi < 0 || xi >= N || yi >= N) continue; const o = (yi*N + xi)*3; buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; }
  }
}
// overlays: [{ pts:[[x, y]...], col:[r, g, b], w: pixel half-width (at the layer's own resolution) }]
export async function previewLayer(meta, overlays, name, maxPx = 1500, exag = 1){
  const N = meta.px, m = meta.size/N, rgba = await readLayer(meta), H = new Float32Array(N*N), rgb = Buffer.alloc(N*N*3);
  for (let i=0;i<N*N;i++){ const a = rgba[i*4 + 3]; H[i] = a < 2 ? 0 : meta.base + (a - 2)*meta.step; }
  const L = (() => { const az = 315*Math.PI/180, el = 42*Math.PI/180; return [Math.sin(az)*Math.cos(el), Math.cos(az)*Math.cos(el), Math.sin(el)]; })();
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const i = y*N + x, a = rgba[i*4 + 3], xl = Math.max(0, x - 1), xr = Math.min(N - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(N - 1, y + 1);
    const dzx = (H[y*N + xr] - H[y*N + xl])/((xr - xl)*m)*exag, dzy = (H[yu*N + x] - H[yd*N + x])/((yd - yu)*m)*exag;   // (y up on the map)
    const inv = 1/Math.sqrt(dzx*dzx + dzy*dzy + 1), s = clampN((-dzx*L[0] - dzy*L[1] + L[2])*inv, 0, 1), k = 0.45 + 0.85*s;
    let r = rgba[i*4], g = rgba[i*4 + 1], b = rgba[i*4 + 2];
    if (a === 1){ r = r*0.5 + 20; g = g*0.55 + 40; b = b*0.7 + 70; }
    rgb[i*3] = clampN(r*k, 0, 255); rgb[i*3 + 1] = clampN(g*k, 0, 255); rgb[i*3 + 2] = clampN(b*k, 0, 255);
  }
  for (const o of overlays || []){
    const half = meta.size/2;
    for (const l of (o.lines || [o])){
      const P = l.pts.map(p => [(p[0] - meta.dx + half)/m, (half - (p[1] - meta.dy))/m]);
      if (l.closed) P.push(P[0]);
      for (let k=0;k + 1<P.length;k++){ if (Math.max(P[k][0], P[k + 1][0]) < 0 || Math.min(P[k][0], P[k + 1][0]) > N || Math.max(P[k][1], P[k + 1][1]) < 0 || Math.min(P[k][1], P[k + 1][1]) > N) continue; line(rgb, N, P[k][0], P[k][1], P[k + 1][0], P[k + 1][1], l.col || o.col, l.w ?? o.w ?? 0); }
    }
  }
  const out = path.join(PREVIEW_DIR, name + '.png');
  await sharp(rgb, { raw:{ width:N, height:N, channels:3 } }).resize(Math.min(N, maxPx)).png().toFile(out);
  return out;
}

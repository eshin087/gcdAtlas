// A rough CPU view of a city's layers (heights ray-marched, photo colours, simple light) to check the suggested camera framings without a browser.
// view = { look:[la, lo, height m], az, tilt, dist, fov? } as in the manifest. Not the page's renderer: only to see that a framing shows what it should.
import path from 'node:path';
import sharp from 'sharp';
import { frameAt, llToPlane, OUT, clampN } from './city-common.mjs';
import { PREVIEW_DIR } from './city-preview.mjs';

async function load(man, ids){
  const out = [];
  for (const L of man.layers.filter(l => !ids || ids.includes(l.id)).sort((a, b) => a.size - b.size)){
    const { data } = await sharp(path.join(OUT, L.file)).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
    out.push({ ...L, data });
  }
  return out;
}
export async function renderView(man, view, name, W = 800, H = 450, ids = null){
  const cityF = frameAt(man.la, man.lo), layers = await load(man, ids);
  const [lx, ly] = llToPlane(cityF, view.look[0], view.look[1]), lz = view.look[2], az = view.az*Math.PI/180, tl = view.tilt*Math.PI/180;
  const fwd = [Math.sin(az)*Math.cos(tl), Math.cos(az)*Math.cos(tl), -Math.sin(tl)];
  const cam = [lx - fwd[0]*view.dist, ly - fwd[1]*view.dist, lz - fwd[2]*view.dist];
  // right and up
  const right = [Math.cos(az), -Math.sin(az), 0], up = [fwd[1]*right[2] - fwd[2]*right[1], fwd[2]*right[0] - fwd[0]*right[2], fwd[0]*right[1] - fwd[1]*right[0]];
  const upv = [right[1]*fwd[2] - right[2]*fwd[1], right[2]*fwd[0] - right[0]*fwd[2], right[0]*fwd[1] - right[1]*fwd[0]];
  void up;
  const fy = Math.tan((view.fov || 50)*Math.PI/360), fx = fy*W/H;
  const sample = (x, y) => {
    for (const L of layers){
      const u = (x - L.dx + L.size/2)/L.size*L.px - 0.5, v = (L.size/2 - (y - L.dy))/L.size*L.px - 0.5;
      if (u < 1 || v < 1 || u >= L.px - 2 || v >= L.px - 2) continue;
      const i = (Math.round(v)*L.px + Math.round(u))*4, a = L.data[i + 3];
      return { a, h:a < 2 ? 0 : L.base + (a - 2)*L.step, r:L.data[i], g:L.data[i + 1], b:L.data[i + 2], L, u:Math.round(u), v:Math.round(v) };
    }
    return null;
  };
  const px = Buffer.alloc(W*H*3), sun = (() => { const a = Math.atan2(-0.6, -0.5), e = 0.7; return [Math.cos(e)*Math.cos(a), Math.cos(e)*Math.sin(a), Math.sin(e)]; })();
  for (let j=0;j<H;j++) for (let i=0;i<W;i++){
    const sx = (2*(i + 0.5)/W - 1)*fx, sy = (1 - 2*(j + 0.5)/H)*fy;
    let d = [fwd[0] + right[0]*sx + upv[0]*sy, fwd[1] + right[1]*sx + upv[1]*sy, fwd[2] + right[2]*sx + upv[2]*sy]; const n = Math.hypot(...d); d = d.map(v => v/n);
    let t = 5, hit = null, prevAbove = true, tPrev = 0;
    const tMax = view.dist*6 + 6000;
    while (t < tMax){
      const x = cam[0] + d[0]*t, y = cam[1] + d[1]*t, z = cam[2] + d[2]*t, s = sample(x, y);
      if (!s){ t += 40; continue; }
      if (z <= s.h){ hit = s; break; }
      // (step by the height above the ground, never more than 4% of the distance)
      t += Math.max(1.2, Math.min((z - s.h)*0.6, t*0.04)); tPrev = t; prevAbove = true;
    }
    void tPrev; void prevAbove;
    let r, g, b;
    if (hit){
      const L = hit.L, o = (dx, dy) => { const k = ((hit.v + dy)*L.px + hit.u + dx)*4, a = L.data[k + 3]; return a < 2 ? 0 : L.base + (a - 2)*L.step; };
      const m = L.size/L.px, gx = (o(1, 0) - o(-1, 0))/(2*m), gy = (o(0, -1) - o(0, 1))/(2*m), inv = 1/Math.sqrt(gx*gx + gy*gy + 1), nn = [-gx*inv, -gy*inv, inv];
      const s = clampN(nn[0]*sun[0] + nn[1]*sun[1] + nn[2]*sun[2], 0, 1), k = 0.35 + 0.8*s;
      r = hit.r*k; g = hit.g*k; b = hit.b*k;
      if (hit.a === 1){ r = 18 + r*0.2; g = 40 + g*0.3; b = 70 + b*0.4; }
    } else { const q = clampN(0.5 - d[2]*2, 0, 1); r = 120 + 60*q; g = 150 + 50*q; b = 200 + 30*q; }
    px[(j*W + i)*3] = clampN(r, 0, 255); px[(j*W + i)*3 + 1] = clampN(g, 0, 255); px[(j*W + i)*3 + 2] = clampN(b, 0, 255);
  }
  const f = path.join(PREVIEW_DIR, name + '.png');
  await sharp(px, { raw:{ width:W, height:H, channels:3 } }).png().toFile(f);
  return f;
}

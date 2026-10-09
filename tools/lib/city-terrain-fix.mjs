// Fixes to a city layer's heights (0.19.0), applied to the encoded alpha (1 water, else 2 + (height - base)/step), in place:
//   - despike, in the 51 km region layer (no buildings): a pixel more than 300 m above the median of its eight neighbours takes that median
//     (the terrain tiles have a few bad values: Rio's region had four pixels of 1,134 to 3,163 m out at sea south of Ipanema), then one more
//     than 250 m above the median of the 5 x 5 round it;
//   - peaks: a summit the terrain tiles round down, raised to its measured height as a steep cone with a rounded top (`city.peaks`: la, lo,
//     h m above the sea, r m; Corcovado's narrow summit, 704 m, came out at about 520 m where Christ the Redeemer stands). Illustrative in its
//     shape.
// When a fix goes past what the layer's steps can hold, the whole layer is encoded again with a new base and step (L.base, L.step, L.top are
// updated). Returns how many pixels changed.
import { frameAt, llToPlane } from './city-common.mjs';
export function fixHeights(city, L, rgba){
  const N = L.px, m = L.size/N, h = new Float32Array(N*N), wet = new Uint8Array(N*N);
  for (let i=0;i<N*N;i++){ const a = rgba[i*4 + 3]; if (a < 2){ wet[i] = 1; h[i] = 0; } else h[i] = L.base + (a - 2)*L.step; }
  const changed = new Uint8Array(N*N);
  // despike, only in a layer with no buildings (the 51 km region, 50 m pixels): in a layer with buildings it took the corners off Hong Kong's
  // tallest towers
  const fix = [], bare = L.size > 13000;
  if (bare) for (let y=1;y<N - 1;y++) for (let x=1;x<N - 1;x++){
    const i = y*N + x; if (wet[i]) continue;
    const nb = []; for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){ if (!dx && !dy) continue; const j = i + dy*N + dx; if (!wet[j]) nb.push(h[j]); }
    if (nb.length < 4) continue; nb.sort((a, b) => a - b); const md = nb[nb.length >> 1];
    if (h[i] > md + 300) fix.push([i, md]);
  }
  for (const [i, md] of fix){ h[i] = md; changed[i] = 1; }
  // it also loses spikes in small clusters or at the shore, which the rule above keeps
  // (Sydney's region had a patch of 400 to 946 m by Prospect Reservoir and 1,392 m at the coast, Hong Kong's a 2,134 m pixel by the sea): a
  // pixel more than 250 m above the median of the 5 x 5 pixels round it, the sea counted as 0 m, takes that median, twice over. No real slope
  // rises 250 m within 100 m of a median.
  if (bare) for (let pass=0;pass<2;pass++){
    const f2 = [];
    for (let y=2;y<N - 2;y++) for (let x=2;x<N - 2;x++){
      const i = y*N + x; if (wet[i]) continue;
      const nb = []; for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++){ const j = i + dy*N + dx; nb.push(wet[j] ? 0 : h[j]); }
      nb.sort((a, b) => a - b); const md = nb[12];
      if (h[i] > md + 250) f2.push([i, md]);
    }
    for (const [i, md] of f2){ h[i] = md; changed[i] = 1; }
  }
  // peaks
  const F = frameAt(L.la, L.lo);
  for (const pk of city.peaks || []){
    const [px, py] = llToPlane(F, pk.la, pk.lo), cx = (px + L.size/2)/m, cy = (L.size/2 - py)/m, rp = pk.r/m + 1;
    if (cx < -rp || cy < -rp || cx > N + rp || cy > N + rp) continue;
    for (let y=Math.max(0, Math.floor(cy - rp));y<=Math.min(N - 1, Math.ceil(cy + rp));y++) for (let x=Math.max(0, Math.floor(cx - rp));x<=Math.min(N - 1, Math.ceil(cx + rp));x++){
      const i = y*N + x; if (wet[i]) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)*m; if (d > pk.r) continue;
      const want = pk.h - (pk.h - h[i])*(d/pk.r)**1.6;
      if (want > h[i] + 0.5){ h[i] = want; changed[i] = 1; }
    }
  }
  let n = 0; for (let i=0;i<N*N;i++) n += changed[i];
  if (!n) return 0;
  // encode again: the same base and step if every height still fits, else new ones
  let lo = Infinity, hi = -Infinity; for (let i=0;i<N*N;i++) if (!wet[i]){ if (h[i] < lo) lo = h[i]; if (h[i] > hi) hi = h[i]; }
  if (hi > L.base + 253*L.step + 0.01 || lo < L.base - 0.01){
    L.base = Math.floor(lo); L.step = Math.max(0.1, Math.ceil((hi - L.base)/253*10)/10);
    for (let i=0;i<N*N;i++) changed[i] = 1;   // (every pixel is encoded again)
  }
  L.top = Math.ceil(hi);   // (the fixed layer's own highest point: kept as the old top, a removed spike stayed the city's top and the page's ground rays started 3 km up; from Codex's review of #52)
  for (let i=0;i<N*N;i++) if (changed[i] && !wet[i]) rgba[i*4 + 3] = Math.max(2, Math.min(255, 2 + Math.round((h[i] - L.base)/L.step)));
  return n;
}

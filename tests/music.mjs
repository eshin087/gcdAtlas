// Music test: renders every style offline (seeded, so every run gives the same songs) and checks that the styles are equally
// loud and never clip. Loudness is measured as in ITU-R BS.1770 (K-weighted and gated, the way streaming services even out
// songs), twice: full range (headphones) and above 200 Hz (a laptop or phone speaker, which cannot play deep bass). A style's
// loudness is the average of the two, so a bass-heavy style (lofi) and a light one (piano) sound alike on either.
// Also writes a one-minute WAV of each style to tests/out/music/ for listening.
//   node tests/music.mjs                      all styles
//   node tests/music.mjs --styles bossa,lofi  some styles (lofi, the reference, is always measured)
//   node tests/music.mjs --no-wav             no WAV files
import { openPage, report, OUT } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TOL = 1.5, PEAK_MAX = -1;   // dB from lofi; dBFS at full volume
const SEEDS = [[1, 60], [2, 40], [3, 40]];   // [seed, seconds], rendered side by side; the first one is also the WAV
const wav = !process.argv.includes('--no-wav');
const { browser, page, errors } = await openPage({ settings:{ sound:false }, init:() => { window.__freeze = true; } });
const all = await page.evaluate(() => window.__cosmos.music._dbg.styles);
const want = (arg('styles', '') || all.join(',')).split(',').filter(s => all.includes(s));
if (!want.includes('lofi')) want.unshift('lofi');
const dir = path.join(OUT, 'music'); if (wav) fs.mkdirSync(dir, { recursive:true });
const res = {};
for (const st of want){
  const t0 = Date.now();
  const runs = await page.evaluate(async ({ st, SEEDS, wav }) => {
    const music = window.__cosmos.music;
    // (each render is scheduled at once, then they render side by side)
    const jobs = SEEDS.map(([seed, sec]) => { const p = music._render(st, sec, { seed }); return { seed, name:music._last, p }; });
    const out = [];
    for (const j of jobs){
      const buf = await j.p, sr = buf.sampleRate, ch = [buf.getChannelData(0), buf.getChannelData(1)], n = ch[0].length;
      const biquad = (x, [b0, b1, b2, a1, a2]) => { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i=0;i<x.length;i++){ const v = b0*x[i] + b1*x1 + b2*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
      // K-weighting (BS.1770, 48 kHz): a high shelf and a high-pass; the small speaker adds a 200 Hz high-pass
      const kw = x => biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585]), [1, -2, 1, -1.99004745483398, 0.99007225036621]);
      const w = 2*Math.PI*200/sr, al = Math.sin(w)/(2*Math.SQRT1_2), c = Math.cos(w), a0 = 1 + al, HP = [(1 + c)/2/a0, -(1 + c)/a0, (1 + c)/2/a0, -2*c/a0, (1 - al)/a0];
      const L = e => -0.691 + 10*Math.log10(e), mean = a => a.reduce((p, q) => p + q, 0)/Math.max(a.length, 1);
      const loud = k => { const blk = Math.round(0.4*sr), hop = Math.round(0.1*sr), z = [];
        for (let s = 0; s + blk <= n; s += hop){ let e = 0; for (const x of k) for (let i = s; i < s + blk; i++) e += x[i]*x[i]; z.push(e/blk); }
        const abs = z.filter(e => L(e) > -70), rel = L(mean(abs)) - 10; return L(mean(abs.filter(e => L(e) > rel))); };
      const k = ch.map(kw), full = loud(k), small = loud(k.map(x => biquad(x, HP)));
      let pk = 0; for (const x of ch) for (let i=0;i<n;i++){ const a = Math.abs(x[i]); if (a > pk) pk = a; }
      const r = { seed:j.seed, name:j.name, full, small, peak:20*Math.log10(pk) };
      if (!isFinite(full) || !isFinite(small) || !isFinite(r.peak)) r.bad = 'no sound or not a number';
      if (wav && j.seed === SEEDS[0][0]){   // 16-bit stereo WAV, as base64
        const bytes = new Uint8Array(44 + n*4), dv = new DataView(bytes.buffer), str = (o, s) => { for (let i=0;i<s.length;i++) bytes[o + i] = s.charCodeAt(i); };
        str(0, 'RIFF'); dv.setUint32(4, 36 + n*4, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
        dv.setUint32(24, sr, true); dv.setUint32(28, sr*4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n*4, true);
        for (let i=0;i<n;i++) for (let c=0;c<2;c++) dv.setInt16(44 + i*4 + c*2, Math.max(-32767, Math.min(32767, Math.round(ch[c][i]*32767))), true);
        let bin = ''; for (let i=0;i<bytes.length;i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        r.wav = btoa(bin);
      }
      out.push(r);
    }
    return out;
  }, { st, SEEDS, wav });
  for (const r of runs){
    if (r.bad) errors.push(`${st} seed ${r.seed}: ${r.bad}`);
    if (r.wav){ fs.writeFileSync(path.join(dir, `${st}.wav`), Buffer.from(r.wav, 'base64')); delete r.wav; }
  }
  // the style's loudness: the energy mean over its seeds, for each measure
  const em = key => 10*Math.log10(runs.reduce((a, r) => a + Math.pow(10, r[key]/10), 0)/runs.length);
  const full = em('full'), small = em('small');
  res[st] = { loud:(full + small)/2, full, small, peak:Math.max(...runs.map(r => r.peak)), runs, sec:(Date.now() - t0)/1000 };
}
// the shuffle: 400 songs of each mood
const sh = await page.evaluate(() => { const m = window.__cosmos.music, plans = {};
  for (const mood in m.moods) plans[mood] = m._plan(mood, 400);
  return { plans, moods:m.moods, places:m._places, names:window.__cosmos.OBJ.map(o => o.name), text:m.moodText('mix') }; });
const shNotes = [];
for (const [mood, list] of Object.entries(sh.plans)){
  const allowed = Object.keys(sh.moods[mood]), seen = new Set(), bad = new Set();
  list.forEach((x, i) => {
    seen.add(x.style);
    if (!allowed.includes(x.style)) bad.add(`${mood} plays ${x.style}`);
    if (!(x.key >= 48 && x.key <= 59)) bad.add(`${mood}: key ${x.key} out of range`);
    if (i && x.style === list[i - 1].style) bad.add(`${mood} plays ${x.style} twice in a row`);
    if (i && ![0, 2, 5, 7, 10].includes(((x.sig - list[i - 1].sig) % 12 + 12) % 12)) bad.add(`${mood}: the key jumps from ${list[i - 1].sig} to ${x.sig}`);
    if (mood === 'mix' && i >= 4 && !list.slice(i - 4, i + 1).some(y => y.style === 'ambient' || y.style === 'piano')) bad.add('mix: five songs without a calm one');
    if (list.slice(Math.max(0, i - 59), i).some(y => y.title === x.title)) bad.add(`${mood}: "${x.title}" again within 60 songs`);
  });
  for (const st of allowed) if (!seen.has(st)) bad.add(`${mood} never plays ${st}`);
  errors.push(...bad);
  const count = {}; for (const x of list) count[x.style] = (count[x.style] || 0) + 1;
  shNotes.push(mood + ' ' + Object.entries(count).map(([k, v]) => `${k} ${Math.round(100*v/list.length)}%`).join(' '));
}
for (const p of sh.places){ const q = p.replace(/^the /, ''); if (!sh.names.some(n => n.includes(q))) errors.push(`song names use "${p}", which is not in the atlas`); }
// moods saved before 0.8.9 map across: lofi -> beats, house -> groove, ambient -> calm, anything else -> mix
await page.addInitScript(() => { const v = sessionStorage.getItem('__ms'); if (v) localStorage.setItem('gcdatlas.settings', JSON.stringify({ musicStyle:v, sound:false, fadeUI:'off' })); });
for (const [was, now] of [['lofi', 'beats'], ['house', 'groove'], ['ambient', 'calm'], ['disco', 'mix']]){
  await page.evaluate(v => sessionStorage.setItem('__ms', v), was);
  await page.reload(); await page.waitForFunction(() => window.__cosmos && window.__cosmos.SET, null, { timeout:60000 });
  const r = await page.evaluate(() => ({ set:window.__cosmos.SET.musicStyle, on:[...document.querySelectorAll('.seg[data-key=musicStyle] button')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.dataset.v), note:document.querySelector('#moodNote').textContent }));
  if (r.set !== now || r.on.join() !== now) errors.push(`a saved "${was}" became ${r.set} (button ${r.on.join()}), not ${now}`);
  if (!r.note.startsWith('plays ')) errors.push('mood note: ' + r.note);
}
console.log('shuffle, 400 songs each: ' + shNotes.join(' · ') + '\nmix plays ' + sh.text);
const ref = res.lofi, lines = [];
for (const st of want){
  const r = res[st], d = r.loud - ref.loud, sg = x => (x >= 0 ? '+' : '') + x.toFixed(1);
  lines.push(`${st.padEnd(10)} ${sg(d).padStart(5)} dB vs lofi (full range ${sg(r.full - ref.full)}, small speakers ${sg(r.small - ref.small)})  peak ${r.peak.toFixed(1)} dBFS  · ${r.runs[0].name} (${r.sec.toFixed(0)} s)`);
  if (!(Math.abs(d) <= TOL)) errors.push(`${st} is ${sg(d)} dB from lofi (at most ${TOL})`);
  if (!(r.peak <= PEAK_MAX)) errors.push(`${st} peaks at ${r.peak.toFixed(1)} dBFS (at most ${PEAK_MAX})`);
}
console.log(`lofi: ${ref.full.toFixed(1)} LUFS full range, ${ref.small.toFixed(1)} on small speakers (at full volume)\n` + lines.join('\n'));
report('music', errors, `${want.length} styles within ${TOL} dB of lofi, peaks under ${PEAK_MAX} dBFS` + (wav ? ' · WAVs in tests/out/music' : ''));
await browser.close();

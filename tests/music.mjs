// Music test: renders every song of the catalogue offline (a seed deals the same song every time), checks that each one is
// the song its name says, that every style is about as loud as lofi and that nothing clips, and checks the shuffle.
// Loudness is measured as in ITU-R BS.1770 (K-weighted and gated, the way streaming services
// even out songs), twice: full range (headphones) and above 200 Hz (a laptop or phone speaker, which cannot play deep bass).
// The average of the two must be within TOL of lofi's, and each one within TOL_EACH: a style with less bass than lofi comes
// out quieter on headphones and louder on small speakers, so its bass has to be close to lofi's for both to hold.
// The reference is lofi from seeds 1 to 3 (the engine's own lofi, steadier than one song). Each song is measured over
// SONG_SEC seconds from the end of its intro (where the radio starts its first song). Also writes a WAV of each style's
// first song to tests/out/music/ for listening.
//   node tests/music.mjs                      all styles
//   node tests/music.mjs --styles piano,lofi  some styles (the lofi reference is always measured)
//   node tests/music.mjs --no-wav             no WAV files
import { openPage, report, OUT } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TOL = 1.5, TOL_EACH = 2.5, TOL_SONG = 3, PEAK_MAX = -1;   // dB from lofi (a style's average, each measure, one song); dBFS at full volume
const SEEDS = [[1, 60], [2, 40], [3, 40]];   // the lofi reference: [seed, seconds], rendered side by side
const SONG_SEC = 45;
const wav = !process.argv.includes('--no-wav');
const { browser, page, errors } = await openPage({ settings:{ sound:false }, init:() => { window.__freeze = true; } });
const all = await page.evaluate(() => window.__cosmos.music._dbg.styles);
const songs = await page.evaluate(() => window.__cosmos.music.songs());
const want = (arg('styles', '') || all.join(',')).split(',').filter(s => all.includes(s));
const dir = path.join(OUT, 'music'); if (wav) fs.mkdirSync(dir, { recursive:true });
const res = {};
// the renders: the lofi reference, then every song of the styles asked for
const groups = [['ref', 'lofi', SEEDS.map(([seed, sec]) => ({ seed, sec }))]];
for (const st of want){ const L = songs.filter(x => x.style === st); if (L.length) groups.push([st, st, L.map((x, i) => ({ seed:x.seed, sec:SONG_SEC, song:x, wav:i === 0 }))]); }
for (const st of all) if (!songs.some(x => x.style === st)) errors.push(`no song of ${st} in the catalogue`);
for (const [key, st, jobsIn] of groups){
  const t0 = Date.now();
  const runs = await page.evaluate(async ({ st, jobsIn, wav }) => {
    const music = window.__cosmos.music;
    // (each render is scheduled at once, then they render side by side)
    const jobs = jobsIn.map(j => { const p = music._render(st, j.sec, { seed:j.seed }); return { ...j, name:music._last, info:music._info, p }; });
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
      const r = { seed:j.seed, name:j.name, title:j.info.title, length:j.info.length, song:j.song, full, small, peak:20*Math.log10(pk) };
      if (!isFinite(full) || !isFinite(small) || !isFinite(r.peak)) r.bad = 'no sound or not a number';
      if (wav && j.wav){   // 16-bit stereo WAV, as base64
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
  }, { st, jobsIn, wav });
  for (const r of runs){
    const what = r.song ? `"${r.song.title}" (${st} seed ${r.seed})` : `${st} seed ${r.seed}`;
    if (r.bad) errors.push(`${what}: ${r.bad}`);
    if (r.song && r.title !== r.song.title) errors.push(`${st} seed ${r.seed} deals "${r.title}", not "${r.song.title}"`);
    if (r.song && !(Math.abs(r.length - r.song.sec) < 0.01 && r.song.sec > 60 && r.song.sec < 300)) errors.push(`${what}: length ${r.song.sec} s (a render says ${r.length} s)`);
    if (r.wav){ fs.writeFileSync(path.join(dir, `${st}.wav`), Buffer.from(r.wav, 'base64')); delete r.wav; }
  }
  // the loudness: the energy mean over the renders, for each measure
  const em = k => 10*Math.log10(runs.reduce((a, r) => a + Math.pow(10, r[k]/10), 0)/runs.length);
  const full = em('full'), small = em('small');
  res[key] = { loud:(full + small)/2, full, small, peak:Math.max(...runs.map(r => r.peak)), runs, sec:(Date.now() - t0)/1000 };
}
// the shuffle: 200 songs of each mood, from a fresh start
const sh = await page.evaluate(() => { const m = window.__cosmos.music, plans = {};
  for (const mood in m.moods) plans[mood] = m._shuffle(mood, 200);
  return { plans, moods:m.moods, calm:m.calm, places:m._places, tpls:m._names, names:window.__cosmos.OBJ.map(o => o.name), text:m.moodText('mix') }; });
const shNotes = [];
for (const [mood, list] of Object.entries(sh.plans)){
  const allowed = sh.moods[mood], ids = songs.filter(x => allowed.includes(x.style)).map(x => x.id), n = ids.length, bad = new Set();
  list.forEach((x, i) => {
    if (!allowed.includes(x.style)) bad.add(`${mood} plays ${x.style}`);
    if (i && x.id === list[i - 1].id) bad.add(`${mood} plays "${x.title}" twice in a row`);
    if (mood === 'mix' && i >= 4 && !list.slice(i - 4, i + 1).some(y => sh.calm.includes(y.style))) bad.add('mix: five songs without a calm one');
  });
  // every song of the mood once in each round of n songs
  for (let i = 0; i + n <= list.length; i += n){ const r = new Set(list.slice(i, i + n).map(x => x.id)); if (r.size !== n || ids.some(id => !r.has(id))) bad.add(`${mood}: songs ${i + 1} to ${i + n} are not every song once`); }
  errors.push(...bad);
  shNotes.push(`${mood} ${n} songs`);
}
const seen = new Set(); for (const x of songs){ if (seen.has(x.id)) errors.push('the song ' + x.id + ' is in the list twice'); seen.add(x.id); }
for (const p of sh.places){ const q = p.replace(/^the /, ''); if (!sh.names.some(n => n.includes(q))) errors.push(`song names use "${p}", which is not in the atlas`); }
// a place ('the Moon') reads well after a word like 'on' or at the start before 'at',
// never bare after a word ('Velvet the Moon') or before one ('The Perseids Nights')
for (const [st, list] of Object.entries(sh.tpls)) for (const tpl of list)
  if (!/^# at |\b(on|over|of|from|to|for|past|under|above|at|by|in) #/i.test(tpl)) errors.push(`${st} song name "${tpl}" reads badly with a place like "the Moon"`);
for (const x of songs) if (/\bthe the\b|^The the |—/i.test(x.title)) errors.push(`song name "${x.title}"`);
// moods saved before 0.9.2 map across: lofi -> beats, house -> groove, ambient -> calm, anything else (such as the dropped lounge mood) -> mix
await page.addInitScript(() => { const v = sessionStorage.getItem('__ms'); if (v) localStorage.setItem('gcdatlas.settings', JSON.stringify({ musicStyle:v, sound:false, fadeUI:'off' })); });
for (const [was, now] of [['lofi', 'beats'], ['house', 'groove'], ['ambient', 'calm'], ['lounge', 'mix'], ['bossa', 'mix']]){
  await page.evaluate(v => sessionStorage.setItem('__ms', v), was);
  await page.reload(); await page.waitForFunction(() => window.__cosmos && window.__cosmos.SET, null, { timeout:60000 });
  const r = await page.evaluate(() => ({ set:window.__cosmos.SET.musicStyle, on:[...document.querySelectorAll('.seg[data-key=musicStyle] button')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.dataset.v), note:document.querySelector('#moodNote').textContent }));
  if (r.set !== now || r.on.join() !== now) errors.push(`a saved "${was}" became ${r.set} (button ${r.on.join()}), not ${now}`);
  if (!r.note.startsWith('plays ')) errors.push('mood note: ' + r.note);
}
console.log('shuffle, 200 songs of each mood, every song once a round: ' + shNotes.join(' · ') + '\nmix plays ' + sh.text);
const ref = res.ref, lines = [], sg = x => (x >= 0 ? '+' : '') + x.toFixed(1), mmss = s => { s = Math.round(s); return Math.floor(s/60) + ':' + String(s % 60).padStart(2, '0'); };
for (const st of want){
  const r = res[st]; if (!r) continue;
  const d = r.loud - ref.loud;
  lines.push(`${st.padEnd(10)} ${sg(d).padStart(5)} dB vs lofi (full range ${sg(r.full - ref.full)}, small speakers ${sg(r.small - ref.small)})  peak ${r.peak.toFixed(1)} dBFS  · ${r.runs.length} song${r.runs.length > 1 ? "s" : ""} (${r.sec.toFixed(0)} s)`);
  for (const q of r.runs){
    const dq = (q.full + q.small)/2 - ref.loud;
    lines.push(`    ${sg(dq).padStart(5)} dB  ${q.title} (seed ${q.seed}, ${mmss(q.song.sec)})`);
    if (!(Math.abs(dq) <= TOL_SONG)) errors.push(`"${q.title}" is ${sg(dq)} dB from lofi (at most ${TOL_SONG})`);
  }
  if (!(Math.abs(d) <= TOL)) errors.push(`${st} is ${sg(d)} dB from lofi (at most ${TOL})`);
  for (const [k, what] of [['full', 'on headphones'], ['small', 'on small speakers']]){
    const dk = r[k] - ref[k]; if (!(Math.abs(dk) <= TOL_EACH)) errors.push(`${st} is ${sg(dk)} dB from lofi ${what} (at most ${TOL_EACH})`);
  }
  if (!(r.peak <= PEAK_MAX)) errors.push(`${st} peaks at ${r.peak.toFixed(1)} dBFS (at most ${PEAK_MAX})`);
}
console.log(`lofi (seeds 1 to 3): ${ref.full.toFixed(1)} LUFS full range, ${ref.small.toFixed(1)} on small speakers (at full volume)\n` + lines.join('\n'));
report('music', errors, `${songs.length} songs, ${want.length} styles within ${TOL} dB of lofi (${TOL_EACH} dB on headphones and on small speakers, ${TOL_SONG} dB a song), peaks under ${PEAK_MAX} dBFS` + (wav ? ' · WAVs in tests/out/music' : ''));
await browser.close();

// Music test: renders every song of the review page (music.candidates(): the radio's songs and the new candidates) offline,
// from start to end (a seed deals the same song every time), and checks each one:
//  - it is the song its name says, with a name of its own (none of the names the owner removed), 1 to 5 minutes long;
//  - loudness, measured as in ITU-R BS.1770 (K-weighted and gated, the way streaming services even out songs), twice: full
//    range (headphones) and above 200 Hz (a laptop or phone speaker, which cannot play deep bass). What every speaker plays is
//    matched: above 200 Hz each style's songs are within TOL of lofi on average and each song within TOL_SONG. Full range is
//    only held between FULL_MIN and FULL_MAX of lofi: the calm styles have a lighter low end, so on headphones they come out a
//    little quieter than lofi, never louder. (Before 0.9.4 every style had to match lofi on both measures, which forced
//    lofi's bass on every style: ambient and ambient piano held a sine on the chord root, and the owner found the bass loud
//    and unpleasant.)
//  - bass balance: the energy below 160 Hz against the energy from 400 to 2500 Hz (LOW_MID, dB), and how much of the
//    loudness comes from below 160 Hz (SHARE: full range minus the same after a 160 Hz high-pass, in LU), each under its
//    style's limit (lower for ambient and ambient piano); the beat styles also keep a floor, so the beat has a low end;
//  - the peak stays under PEAK_MAX dBFS at full volume.
// The reference is lofi from seeds 1 to 3 (the engine's own lofi, steadier than one song). Also checks the shuffle and the
// song names, and writes a minute of each style's first song (from the end of its intro) to tests/out/music/ for listening.
// Whole songs take a few minutes: renders run CONC at a time.
//   node tests/music.mjs                      every song
//   node tests/music.mjs --styles piano,lofi  some styles (the lofi reference is always measured)
//   node tests/music.mjs --sec 45             45 s of each song from the end of its intro (quicker, for tuning)
//   node tests/music.mjs --no-wav             no WAV files
import { openPage, report, OUT } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TOL = 1.5, TOL_SONG = 2.5, FULL_MIN = -4.5, FULL_MAX = 2, PEAK_MAX = -1;   // dB from lofi (a style's average and one song, above 200 Hz; full range); dBFS
// bass balance limits: [LOW_MID max, SHARE max, SHARE min] (dB, LU)
const CALM = { lowMid:6, share:3.5, shareMin:0 }, BEAT = { lowMid:11.5, share:6.5, shareMin:2 };
const BASS = { ambient:CALM, piano:CALM, lofi:BEAT, downtempo:BEAT, house:BEAT, synthwave:BEAT };
// names the owner took out after listening (docs/HANDOFF.md): a new song must not come back under one of them
const REMOVED = ['Window Seat to Io', 'Midnight over Hale-Bopp', 'Midnight over Rigel', 'Balcony on Io', 'Haze over Antares', 'Morning over Hale-Bopp', 'Notes from Antares', 'The Veil at Midnight', 'Lullaby for Proxima b'];
const SEEDS = [1, 2, 3];   // the lofi reference
const SEC = +arg('sec', 0), CONC = +arg('conc', 6);
const wav = !process.argv.includes('--no-wav');
const { browser, page, errors } = await openPage({ settings:{ sound:false }, init:() => { window.__freeze = true; } });
const all = await page.evaluate(() => window.__cosmos.music._dbg.styles);
const songs = await page.evaluate(() => window.__cosmos.music.songs());
const cands = await page.evaluate(() => window.__cosmos.music.candidates());
const want = (arg('styles', '') || all.join(',')).split(',').filter(s => all.includes(s));
const dir = path.join(OUT, 'music'); if (wav) fs.mkdirSync(dir, { recursive:true });
for (const st of all) if (!songs.some(x => x.style === st)) errors.push(`no song of ${st} in the catalogue`);
for (const x of songs) if (!cands.some(y => y.id === x.id)) errors.push(`${x.id} plays on the radio but is not a candidate`);
// the jobs: the lofi reference, then every candidate of the styles asked for (the first of each style also writes a WAV)
const jobs = SEEDS.map(seed => ({ key:'ref', st:'lofi', seed }));
for (const st of want) cands.filter(x => x.style === st).forEach((x, i) => jobs.push({ key:st, st, seed:x.seed, id:x.id, wav:wav && i === 0 }));
const t0 = Date.now();
const runs = await page.evaluate(async ({ jobs, SEC, CONC }) => {
  const music = window.__cosmos.music, out = [];
  const biquad = (x, [b0, b1, b2, a1, a2]) => { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i=0;i<x.length;i++){ const v = b0*x[i] + b1*x1 + b2*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
  // Butterworth sections (RBJ); two in a row make a 4th-order Linkwitz-Riley split
  const hp = (f, sr) => { const w = 2*Math.PI*f/sr, al = Math.sin(w)/Math.SQRT2, c = Math.cos(w), a0 = 1 + al; return [(1 + c)/2/a0, -(1 + c)/a0, (1 + c)/2/a0, -2*c/a0, (1 - al)/a0]; };
  const lp = (f, sr) => { const w = 2*Math.PI*f/sr, al = Math.sin(w)/Math.SQRT2, c = Math.cos(w), a0 = 1 + al; return [(1 - c)/2/a0, (1 - c)/a0, (1 - c)/2/a0, -2*c/a0, (1 - al)/a0]; };
  const lr = (x, C) => biquad(biquad(x, C), C);
  // K-weighting (BS.1770) at any sample rate: a high shelf and a high-pass
  const kCoef = sr => { let K = Math.tan(Math.PI*1681.974450955533/sr), Q = 0.7071752369554196, Vh = Math.pow(10, 3.999843853973347/20), Vb = Math.pow(Vh, 0.4996667741545416), a0 = 1 + K/Q + K*K;
    const shelf = [(Vh + Vb*K/Q + K*K)/a0, 2*(K*K - Vh)/a0, (Vh - Vb*K/Q + K*K)/a0, 2*(K*K - 1)/a0, (1 - K/Q + K*K)/a0];
    K = Math.tan(Math.PI*38.13547087602444/sr); Q = 0.5003270373238773; a0 = 1 + K/Q + K*K;
    return [shelf, [1, -2, 1, 2*(K*K - 1)/a0, (1 - K/Q + K*K)/a0]]; };
  const L = e => -0.691 + 10*Math.log10(e), mean = a => a.reduce((p, q) => p + q, 0)/Math.max(a.length, 1);
  function analyse(buf, j, info){
    const sr = buf.sampleRate, ch = [buf.getChannelData(0), buf.getChannelData(1)], n = ch[0].length, [sh, rlb] = kCoef(sr);
    const loud = k => { const blk = Math.round(0.4*sr), hop = Math.round(0.1*sr), z = [];
      for (let s = 0; s + blk <= n; s += hop){ let e = 0; for (const x of k) for (let i = s; i < s + blk; i++) e += x[i]*x[i]; z.push(e/blk); }
      const abs = z.filter(e => L(e) > -70), rel = L(mean(abs)) - 10; return L(mean(abs.filter(e => L(e) > rel))); };
    const energy = xs => { let e = 0; for (const x of xs) for (let i = 0; i < x.length; i++) e += x[i]*x[i]; return e; };
    const k = ch.map(x => biquad(biquad(x, sh), rlb)), full = loud(k), small = loud(k.map(x => biquad(x, hp(200, sr)))), hp160 = loud(k.map(x => lr(x, hp(160, sr))));
    const low = energy(ch.map(x => lr(x, lp(160, sr)))), mid = energy(ch.map(x => lr(lr(x, hp(400, sr)), lp(2500, sr))));
    let pk = 0; for (const x of ch) for (let i=0;i<n;i++){ const a = Math.abs(x[i]); if (a > pk) pk = a; }
    const r = { ...j, title:info.title, length:info.length, full, small, share:full - hp160, lowMid:10*Math.log10(low/mid), peak:20*Math.log10(pk) };
    if (![full, small, r.share, r.lowMid, r.peak].every(isFinite)) r.bad = 'no sound or not a number';
    if (j.wav){   // a minute from the end of the intro, as 16-bit stereo WAV (base64)
      const a = Math.round((SEC ? 0.1 : info.introEnd*240/info.bpm)*sr), m = Math.min(n - a, 60*sr), bytes = new Uint8Array(44 + m*4), dv = new DataView(bytes.buffer), str = (o, s) => { for (let i=0;i<s.length;i++) bytes[o + i] = s.charCodeAt(i); };
      str(0, 'RIFF'); dv.setUint32(4, 36 + m*4, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr*4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, m*4, true);
      for (let i=0;i<m;i++) for (let c=0;c<2;c++) dv.setInt16(44 + i*4 + c*2, Math.max(-32767, Math.min(32767, Math.round(ch[c][a + i]*32767))), true);
      let bin = ''; for (let i=0;i<bytes.length;i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      r.wavData = btoa(bin);
    }
    return r;
  }
  // (a render is scheduled at once and renders on its own thread: CONC of them at a time, each analysed as it finishes)
  let next = 0;
  async function worker(){
    while (next < jobs.length){
      const j = jobs[next++];
      music._render(j.st, 0.001, { seed:j.seed, rate:3000 }); const len = music._info.length;
      const p = SEC ? music._render(j.st, SEC, { seed:j.seed }) : music._render(j.st, len + 2.5, { seed:j.seed, intro:true }), info = music._info;
      out.push(analyse(await p, j, info));
    }
  }
  await Promise.all(Array.from({ length:CONC }, worker));
  return out;
}, { jobs, SEC, CONC });
const secs = (Date.now() - t0)/1000;
const res = {};
for (const r of runs){
  const c = cands.find(x => x.id === r.id), what = c ? `"${c.title}" (${r.id})` : `${r.st} seed ${r.seed}`;
  if (r.bad) errors.push(`${what}: ${r.bad}`);
  if (c && r.title !== c.title) errors.push(`${r.id} deals "${r.title}", not "${c.title}"`);
  if (c && !(Math.abs(r.length - c.sec) < 0.01 && c.sec > 60 && c.sec < 300)) errors.push(`${what}: length ${c.sec} s (a render says ${r.length} s)`);
  if (r.wavData){ fs.writeFileSync(path.join(dir, `${r.st}.wav`), Buffer.from(r.wavData, 'base64')); delete r.wavData; }
  (res[r.key] = res[r.key] || []).push(r);
}
// the loudness of a group: the energy mean over its songs, for each measure
const em = (L, k) => 10*Math.log10(L.reduce((a, r) => a + Math.pow(10, r[k]/10), 0)/L.length);
const ref = { full:em(res.ref, 'full'), small:em(res.ref, 'small') };
// the shuffle: 200 songs of each mood, from a fresh start
const sh = await page.evaluate(() => { const m = window.__cosmos.music, plans = {};
  for (const mood in m.moods) plans[mood] = m._shuffle(mood, 200);
  return { plans, moods:m.moods, calm:m.calm, places:m._places, tpls:m._names, names:window.__cosmos.OBJ.map(o => o.name), text:m.moodText('mix') }; });
const shNotes = [];
for (const [mood, list] of Object.entries(sh.plans)){
  const allowed = sh.moods[mood], ids = songs.filter(x => allowed.includes(x.style)).map(x => x.id), n = ids.length, bad = new Set();
  list.forEach((x, i) => {
    if (!allowed.includes(x.style)) bad.add(`${mood} plays ${x.style}`);
    if (!songs.some(y => y.id === x.id)) bad.add(`${mood} plays ${x.id}, which is not in the radio's list`);
    if (i && x.id === list[i - 1].id) bad.add(`${mood} plays "${x.title}" twice in a row`);
    if (mood === 'mix' && i >= 4 && !list.slice(i - 4, i + 1).some(y => sh.calm.includes(y.style))) bad.add('mix: five songs without a calm one');
  });
  // every song of the mood once in each round of n songs
  for (let i = 0; i + n <= list.length; i += n){ const r = new Set(list.slice(i, i + n).map(x => x.id)); if (r.size !== n || ids.some(id => !r.has(id))) bad.add(`${mood}: songs ${i + 1} to ${i + n} are not every song once`); }
  errors.push(...bad);
  shNotes.push(`${mood} ${n} songs`);
}
const seen = new Set(), titles = new Set();
for (const x of cands){
  if (seen.has(x.id)) errors.push('the song ' + x.id + ' is in the list twice'); seen.add(x.id);
  if (titles.has(x.title)) errors.push(`two songs are called "${x.title}"`); titles.add(x.title);
  if (!songs.some(y => y.id === x.id) && REMOVED.includes(x.title)) errors.push(`"${x.title}" was removed by the owner; ${x.id} brings the name back`);
}
for (const p of sh.places){ const q = p.replace(/^the /, ''); if (!sh.names.some(n => n.includes(q))) errors.push(`song names use "${p}", which is not in the atlas`); }
// a place ('the Moon') reads well after a word like 'on' or at the start before 'at',
// never bare after a word ('Velvet the Moon') or before one ('The Perseids Nights')
for (const [st, list] of Object.entries(sh.tpls)) for (const tpl of list)
  if (!/^# at |\b(on|over|of|from|to|for|past|under|above|at|by|in) #/i.test(tpl)) errors.push(`${st} song name "${tpl}" reads badly with a place like "the Moon"`);
for (const x of cands) if (/\bthe the\b|^The the |—/i.test(x.title)) errors.push(`song name "${x.title}"`);
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
const lines = [], sg = x => (x >= 0 ? '+' : '') + x.toFixed(1), mmss = s => { s = Math.round(s); return Math.floor(s/60) + ':' + String(s % 60).padStart(2, '0'); };
for (const st of want){
  const L = res[st]; if (!L) continue;
  const small = em(L, 'small') - ref.small, full = em(L, 'full') - ref.full, B = BASS[st];
  lines.push(`${st.padEnd(10)} ${sg(small).padStart(5)} dB vs lofi above 200 Hz, ${sg(full).padStart(5)} full range · peak ${Math.max(...L.map(r => r.peak)).toFixed(1)} dBFS · ${L.length} songs · bass under ${B.lowMid} dB / ${B.share} LU`);
  for (const r of L){
    const c = cands.find(x => x.id === r.id), ds = r.small - ref.small, df = r.full - ref.full, what = `"${c.title}" (${r.id})`;
    lines.push(`    ${sg(ds).padStart(5)} ${sg(df).padStart(5)}  low/mid ${sg(r.lowMid).padStart(5)} dB  share ${r.share.toFixed(1)} LU  peak ${r.peak.toFixed(1)}  ${c.radio ? 'radio' : 'new  '}  ${c.title} (${r.id}, ${mmss(c.sec)})`);
    if (!(Math.abs(ds) <= TOL_SONG)) errors.push(`${what} is ${sg(ds)} dB from lofi above 200 Hz (at most ${TOL_SONG})`);
    if (!(df >= FULL_MIN && df <= FULL_MAX)) errors.push(`${what} is ${sg(df)} dB from lofi on full range (${FULL_MIN} to +${FULL_MAX})`);
    if (!(r.lowMid <= B.lowMid)) errors.push(`${what}: the bass is ${sg(r.lowMid)} dB over the middle (at most ${B.lowMid})`);
    if (!(r.share <= B.share)) errors.push(`${what}: ${r.share.toFixed(1)} LU of its loudness is bass (at most ${B.share})`);
    if (!(r.share >= B.shareMin)) errors.push(`${what}: only ${r.share.toFixed(1)} LU of its loudness is bass (a beat needs at least ${B.shareMin})`);
    if (!(r.peak <= PEAK_MAX)) errors.push(`${what} peaks at ${r.peak.toFixed(1)} dBFS (at most ${PEAK_MAX})`);
  }
  if (!(Math.abs(small) <= TOL)) errors.push(`${st} is ${sg(small)} dB from lofi above 200 Hz (at most ${TOL})`);
}
console.log(`lofi (seeds 1 to 3): ${ref.full.toFixed(1)} LUFS full range, ${ref.small.toFixed(1)} above 200 Hz (at full volume) · columns: above 200 Hz and full range vs lofi\n` + lines.join('\n'));
report('music', errors, `${cands.length} songs (${songs.length} on the radio) in ${secs.toFixed(0)} s, ${want.length} styles within ${TOL} dB of lofi above 200 Hz (${TOL_SONG} dB a song), bass balance within limits, peaks under ${PEAK_MAX} dBFS` + (wav ? ' · WAVs in tests/out/music' : ''));
await browser.close();

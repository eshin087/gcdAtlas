
// ================================================================ soundtrack: gcd radio, a generative mix that never repeats
// Six styles (STYLES): lofi beats, chill house, ambient, ambient piano, downtempo and soft synthwave.
// A mood in the settings (MOODS) picks which ones play: the default mix plays all but chill house and synthwave, which play
// under 'groove'. Every track gets its own key (close to the last one's), tempo, chord progression, melody, arrangement
// and a name from a place in the atlas, so nothing loops audibly. Every style is about as loud as lofi, on headphones and on
// small speakers (tests/music.mjs checks both).
// Everything is synthesised in the browser: no audio files. It tries to start on load; browsers that block that start it on the first
// click, tap or key press. The first track skips its intro so the groove is there at once.
const music = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, mixG = null, verbSend = null, drumBus = null, drumLP = null, musBus = null, duck = null, crackleG = null, droneG = null, wobble = null, noiseBuf = null;
  let vibesBus = null, arpBus = null, echoIn = null, echoL = null, echoR = null;
  let wantOn = false, running = false, timer = 0, first = true, live = 0, offline = false, vel = 1;   // (vel: the track's level, applied as notes are made)
  const VMAX = 48;   // live notes; the new styles skip optional notes beyond this (phones)
  const busy = () => !offline && live > VMAX;
  const hz = m => 440*Math.pow(2, (m - 69)/12);
  let R = Math.random;   // (swapped for a seeded generator in offline renders)
  const pick = a => a[Math.floor(R()*a.length)];
  // ---------------------------------------------------------------- harmony
  // (soft colours only: sevenths, ninths, sixths, elevenths and a sus; no flat or sharp ninths)
  const TYPES = { maj9:[0, 4, 7, 11, 14], m9:[0, 3, 7, 10, 14], dom9:[0, 4, 10, 14, 21], m11:[0, 3, 10, 14, 17], sus:[0, 5, 7, 10, 14], maj7:[0, 4, 7, 11], m7:[0, 3, 7, 10],
    six9:[0, 4, 7, 9, 14], m6:[0, 3, 7, 9, 14] };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  function voice(root, type, lo = 52, hi = 72){
    const v = TYPES[type].map(i => { let m = root + i; while (m < lo) m += 12; while (m > hi) m -= 12; return m; });
    return [...new Set(v)].sort((a, b) => a - b);
  }
  // a voicing without the root (the bass plays it), as jazz players comp
  const voiceNR = (root, type, lo, hi) => voice(root, type, lo, hi).filter(m => (m - root) % 12 !== 0);
  // a bass note in a low range (A1 to A2 unless given)
  const low = (m, lo = 33, hi = 45) => { while (m > hi) m -= 12; while (m < lo) m += 12; return m; };
  // the chord under every bar of a track: a progression is [root, type, bars?] entries (bars defaults to barsPerChord);
  // it starts again at each new section
  function chordPlan(sections, pr, bpc){
    const out = []; let runStart = 0;
    for (let b = 0; b < sections.length; b++){
      if (b > 0 && sections[b] !== sections[b - 1]) runStart = b;
      const len = c => c[2] || bpc;
      let p = (b - runStart) % pr.reduce((n, c) => n + len(c), 0), i = 0;
      while (p >= len(pr[i])){ p -= len(pr[i]); i++; }
      out.push({ root:pr[i][0], type:pr[i][1], start:p === 0, k:b - runStart });   // (k: the bar within its section)
    }
    return out;
  }
  // seconds from this sixteenth to the next chord change (or the end of the track)
  function chordLeft(bar, s, sd){ let b = bar + 1; while (b < T.chords.length && !T.chords[b].start) b++; return ((b - bar)*16 - s)*sd; }
  // ---------------------------------------------------------------- melodies of the newer styles
  // A phrase is two bars: a rhythm (sixteenths 0..31) and a contour in scale steps. Each note is then fitted to the chord under it:
  // on beats 1 and 3 to a chord tone, elsewhere to a note that sits well on that chord, so a melody never clashes.
  const SCALES = { major:[0, 2, 4, 7, 9], minor:[0, 3, 5, 7, 10] };
  const CTONES = { maj9:[0, 4, 7, 11], six9:[0, 4, 7, 9], maj7:[0, 4, 7, 11], m9:[0, 3, 7, 10], m11:[0, 3, 7, 10], m7:[0, 3, 7, 10], m6:[0, 3, 7, 9], dom9:[0, 4, 7, 10], sus:[0, 5, 7, 10] };
  const AVAIL = { maj9:[0, 2, 4, 7, 9, 11], six9:[0, 2, 4, 7, 9], maj7:[0, 2, 4, 7, 9, 11], m9:[0, 2, 3, 5, 7, 10], m11:[0, 2, 3, 5, 7, 10], m7:[0, 2, 3, 5, 7, 10],
    m6:[0, 2, 3, 5, 7, 9], dom9:[0, 2, 4, 7, 9, 10], sus:[0, 2, 5, 7, 10] };
  function fit(m, root, type, strong){
    const set = (strong ? CTONES : AVAIL)[type] || AVAIL.maj9;
    for (let d = 0; d <= 3; d++) for (const x of [m - d, m + d]) if (set.includes((((x - root) % 12) + 12) % 12)) return x;
    return m;
  }
  function phrase(cells){
    const at = pick(cells), shape = pick([1, -1, 0, 0]), n = at.length;   // rising, falling or an arch
    let deg = 5 + Math.floor(R()*3);
    return at.map((s, i) => {
      if (i) deg += (shape ? shape : i < n/2 ? 1 : -1)*(R() < 0.65 ? 1 : 2)*(R() < 0.2 ? -1 : 1);
      deg = Math.max(2, Math.min(10, deg));
      return { s, d:Math.min((i < n - 1 ? at[i + 1] : 32) - s, i === n - 1 ? 8 : 6), deg };
    });
  }
  // the answer: the same rhythm, with an ending that comes down home
  const answer = p => p.map((x, i) => i < p.length - 2 ? x : { ...x, deg:Math.max(2, x.deg - 1 - Math.floor(R()*2)) });
  function melodySetup(T, cells){ const a = phrase(cells), b = phrase(cells); T.mel = [a, answer(a), b, answer(b)]; }
  const melPitch = (n, base) => base + 12*Math.floor(n.deg/5) + SCALES[T.mode][n.deg % 5];
  // the notes of phrase ph on this sixteenth (bar2: first or second bar of the phrase)
  const melNotes = (ph, bar2, s) => ph.filter(n => n.s === bar2*16 + s);
  // which phrase plays in bar k of a section: 'on' two bars, 'off' two bars, or all the way through
  function melAt(k, always){ if (!always && k % 4 >= 2) return null; return T.mel[(always ? k >> 1 : k >> 2) % T.mel.length]; }
  // ---------------------------------------------------------------- styles
  // Each style sets its tempo range, its chord progressions (degrees above the key), its arrangement (plan), textures and level,
  // and plays one sixteenth note at a time in step(c).
  const STYLES = {
    lofi:{ label:'lofi', bpm:[70, 85], swing:() => 0.14 + R()*0.08, bpc:prog => prog.length <= 2 ? 2 : 1, crackle:0.022, drone:0.012, level:1,
      progs:[[[2, 'm9'], [7, 'dom9'], [0, 'maj9'], [9, 'm9']], [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [7, 'dom9']], [[5, 'maj7'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],
        [[9, 'm9'], [2, 'm11'], [7, 'dom9'], [0, 'maj9']], [[0, 'maj9'], [5, 'maj9']], [[4, 'm7'], [9, 'm9'], [2, 'm9'], [7, 'sus']]],
      plan:() => [['intro', 4], ['A', 8], ['B', 8], ['break', 4], ['A', 8], ['B', 8], ['outro', 4]], step:lofiStep },
    house:{ label:'chill house', minor:true, bpm:[110, 118], bpc:prog => prog.length <= 2 ? 2 : 1, crackle:0.005, drone:0.012, level:1,
      progs:[[[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'dom9']], [[0, 'm9'], [5, 'm9']], [[0, 'm11'], [10, 'sus'], [8, 'maj9'], [7, 'm7']], [[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'sus']]],
      plan:() => [['intro', 8], ['A', 16], ['B', 16], ['break', 8], ['drop', 16], ['outro', 8]], step:houseStep },
    ambient:{ label:'ambient', bpm:[60, 60], bpc:() => 4, crackle:0, drone:0.05, level:1.02,
      progs:[[[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [2, 'm11']], [[0, 'sus'], [10, 'maj9'], [5, 'maj9']], [[2, 'm11'], [0, 'maj9'], [7, 'sus'], [9, 'm9']]],
      plan:() => [['A', 20 + 4*Math.floor(R()*4)]], step:ambientStep },   // (20 to 32 bars: 1:20 to 2:08)
    // the newer styles: gentle, for hours in the background. mode sets the melody's scale, home the chord the song ends on.
    piano:{ label:'ambient piano', bpm:[60, 72], mode:'major', home:'maj9', bpc:() => 2, crackle:0, drone:0, hiss:0.0005, level:9.0,
      progs:[[[0, 'maj9'], [7, 'sus'], [9, 'm9'], [5, 'maj9']], [[9, 'm9'], [5, 'maj9'], [0, 'maj9'], [7, 'sus']], [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [5, 'm6']]],
      cells:[[0, 8, 12, 16, 24], [0, 4, 8, 16, 20, 24], [4, 8, 16, 28], [0, 12, 16, 20]],
      setup:T => { T.drift = 0.015; T.driftPh = R()*6; },   // the tempo breathes by about 1.5%
      plan:() => [['intro', 2], ['A', 12], ['B', 12], ['A', 8], ['outro', 2]], step:pianoStep },
    downtempo:{ label:'downtempo', minor:true, bpm:[86, 96], mode:'minor', home:'m9', swing:() => 0.08 + R()*0.06, bpc:() => 2, crackle:0.012, drone:0, level:3.3,
      progs:[[[0, 'm9'], [5, 'dom9']], [[0, 'm11'], [3, 'maj9'], [8, 'maj9'], [7, 'm7']], [[0, 'm9'], [10, 'sus'], [8, 'maj9'], [10, 'dom9']]],
      cells:[[0, 6, 10, 16], [4, 8, 14, 24], [0, 3, 8, 20], [2, 6, 18, 22]],
      plan:() => [['intro', 4], ['A', 12], ['B', 12], ['break', 4], ['A', 8], ['outro', 4]], step:downStep },
    synthwave:{ label:'synthwave', minor:true, bpm:[84, 100], mode:'minor', home:'m9', bpc:() => 2, crackle:0, drone:0, level:2.0,
      progs:[[[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'sus']], [[0, 'm9'], [10, 'dom9'], [8, 'maj9'], [10, 'dom9']], [[0, 'm9'], [8, 'maj9'], [5, 'm9'], [7, 'm7']]],
      cells:[[0, 4, 8, 12, 16, 20, 24], [0, 6, 8, 14, 16, 22, 24], [0, 8, 12, 16, 24, 28], [2, 4, 8, 14, 18, 20, 24]],
      setup:T => { T.arpUD = R() < 0.5; },
      plan:() => [['intro', 8], ['A', 16], ['B', 16], ['break', 8], ['B', 16], ['outro', 8]], step:waveStep },
  };
  // ---------------------------------------------------------------- the shuffle
  // A mood picks the styles, with weights. The default mix plays the gentle ones: all but chill house and synthwave, which play
  // under groove. (calm is the mood of ambient and ambient piano, and CALM those two styles.)
  const MOODS = {
    mix:{ ambient:2, piano:2, lofi:3, downtempo:2 },
    calm:{ ambient:1, piano:1 },
    beats:{ lofi:3, downtempo:2 },
    groove:{ house:1, synthwave:1 },
  };
  const CALM = ['ambient', 'piano'];
  const moodOf = () => MOODS[SET.musicStyle] ? SET.musicStyle : 'mix';
  // Songs are dealt from a weighted bag, refilled when empty: never the same style twice in a row, and in the mix a calm song
  // (ambient or piano) at least every fifth song. sig: the key signature of the last song, recent: the last 60 names.
  const fresh = () => ({ mood:null, bag:[], last:null, sinceCalm:0, sig:null, recent:[] });
  let SH = fresh();
  function nextStyle(){
    const mood = moodOf(), W = MOODS[mood];
    if (SH.mood !== mood){ SH.mood = mood; SH.bag = []; }
    const fill = () => { for (const st in W) for (let i=0;i<W[st];i++) SH.bag.push(st); };
    const calmDue = mood === 'mix' && SH.sinceCalm >= 4, ok = st => st !== SH.last && (!calmDue || CALM.includes(st));
    if (!SH.bag.length) fill();
    let pool = SH.bag.filter(ok);
    if (!pool.length){ fill(); pool = SH.bag.filter(ok); }
    const st = pool.length ? pick(pool) : pick(Object.keys(W));
    if (SH.bag.includes(st)) SH.bag.splice(SH.bag.indexOf(st), 1);
    SH.last = st; SH.sinceCalm = CALM.includes(st) ? 0 : SH.sinceCalm + 1;
    return st;
  }
  // Keys move gently from song to song: the key signature stays or moves by one or two sharps or flats (a fourth, a fifth or a
  // whole tone), and a minor style takes the relative minor, so the next song starts close to where the last one ended.
  const fold = pc => 48 + ((pc - 48) % 12 + 12) % 12;   // C3 .. B3
  function nextKey(S){
    let key;
    if (SH.sig === null) key = 50 + Math.floor(R()*8);   // the first song: D3 .. A3
    else key = fold((SH.sig + pick([0, 5, -5, 5, -5, 2, -2]) + (S.minor ? 9 : 0)) % 12);
    SH.sig = ((key + (S.minor ? 3 : 0)) % 12 + 12) % 12;
    return key;
  }
  // Song names are made from places in the atlas: 'Rain on Titan', 'Night Drive to Vega'. None repeats among the last 60.
  // A place goes after a word like 'on' or 'over', or at the start before 'at' ('The Moon at 3 AM').
  const PLACES = ['Europa', 'Titan', 'Io', 'Enceladus', 'the Moon', 'Ceres', 'Pluto', 'Mars', 'Venus', 'Saturn', 'Jupiter', 'Neptune', 'Mercury',
    'Vega', 'Sirius', 'Polaris', 'Rigel', 'Deneb', 'Altair', 'Arcturus', 'Aldebaran', 'Antares', 'Betelgeuse', 'the Pleiades', 'Andromeda', 'Orion',
    'Proxima b', 'Alpha Centauri', 'TRAPPIST-1', 'Omega Centauri', 'the Sombrero', 'the Whirlpool', 'Carina', 'the Helix', 'the Crab', 'Halley',
    'Arrokoth', 'the Oort cloud', 'Epsilon Eridani', 'Hale-Bopp', 'the Perseids', 'the Leonids', 'HL Tauri', 'Centaurus A', 'the Veil', 'the Horsehead'];
  const NAMES = {
    lofi:['Rainy Day on #', 'Study Notes from #', 'Cassette from #', 'Slow Orbit of #', '# at 3 AM', 'Midnight over #', 'Tea on #', 'Window Seat to #', 'Dusty Records from #'],
    house:['Sunrise over #', 'Deep over #', 'Dancing on #', 'Warm Signal from #', 'Afterglow over #', 'Nights under #', 'Night Bus to #', 'Golden Hour on #'],
    ambient:['Drifting past #', 'Above #', 'The Long Night of #', 'Far Light of #', 'Silence over #', 'Horizon of #', 'Slowly past #', 'Dust over #'],
    piano:['Rain on #', 'Letter from #', 'Snow on #', 'Morning over #', 'Quiet Hours on #', 'Notes from #', 'Lullaby for #', 'A Light over #'],
    downtempo:['Slow Motion over #', 'Haze over #', 'Low Tide on #', 'Half Light on #', 'Afternoon on #', 'Soft Focus on #', 'Balcony on #', 'Long Way to #'],
    synthwave:['Night Drive to #', 'Neon over #', 'Cruising past #', '# at Midnight', 'Coastline of #', 'Last Train to #', 'Tapes from #', 'City Lights of #'],
  };
  function makeTitle(style){
    let name = '';
    for (let i=0;i<20;i++){
      const tpl = pick(NAMES[style]), place = pick(PLACES);
      name = tpl.replace('#', place); name = name[0].toUpperCase() + name.slice(1);
      if (!SH.recent.includes(name)) break;
    }
    SH.recent.push(name); if (SH.recent.length > 60) SH.recent.shift();
    return name;
  }
  let T = null, nextT = 0, step = 0, forceStyle = null;
  // (at: the time the track starts; a new track is made a little ahead of the music)
  function newTrack(at){
    const style = forceStyle || nextStyle(), S = STYLES[style];
    const key = nextKey(S);
    const bpm = S.bpm[0] + (S.bpm[1] > S.bpm[0] ? Math.floor(R()*(S.bpm[1] - S.bpm[0] + 1)) : 0);
    const prog = pick(S.progs).map(([deg, type, bars]) => [key + deg, type, bars]);
    const plan = S.plan();
    const sections = []; plan.forEach(([n, b]) => { for (let i=0;i<b;i++) sections.push(n); });
    // a short motif from the pentatonic scale, reused and varied through the track
    const rhythm = pick([[0, 3, 6, 10], [2, 6, 8, 12, 14], [0, 4, 7, 10, 12], [0, 6, 8, 14], [3, 6, 10, 11, 14]]);
    const motif = rhythm.map(s => ({ s, n:key + 12 + pick(PENTA), d:pick([1, 2, 2, 3, 4]) }));
    T = { style, key, bpm, prog, sections, motif, swing:S.swing ? S.swing() : 0, barsPerChord:S.bpc(prog),
      kickPat:pick([[0, 7, 10], [0, 10], [0, 3, 10], [0, 8, 11]]), hatDensity:0.55 + R()*0.4, lead:R() < 0.8,
      title:makeTitle(style), label:S.label + ' · ' + bpm + ' bpm' };
    // (the newer styles draw their own extras after this point, so the older styles keep their exact random sequence)
    if (S.mode){
      T.mode = S.mode;
      if (S.setup) S.setup(T);
      melodySetup(T, S.cells); T.subPrev = 0;
    }
    T.chords = chordPlan(sections, prog, T.barsPerChord);
    // the newer styles end on their home chord
    if (S.home){ const n = sections.length; T.chords[n - 2] = { root:key, type:S.home, start:true, k:T.chords[n - 2].k }; T.chords[n - 1] = { root:key, type:S.home, start:false, k:T.chords[n - 1].k }; }
    T.cur = [prog[0][0], prog[0][1]];   // the chord playing now (for sounds that should stay in tune with the music)
    T.name = `${T.title} · ${T.label}`;
    step = first ? Math.max(sections.indexOf('A'), 0)*16 : 0; first = false;
    if (!offline && typeof onTrack === 'function') onTrack(T);
    // the style's level (set on each note as it is made, so the last song's tail keeps its own) and its textures
    vel = S.level;
    // (a song is dealt up to 0.25 s ahead, so a skip can land before the skipped song's settings: those are cancelled first)
    const t = at === undefined ? ctx.currentTime : at;
    crackleG.gain.cancelScheduledValues(t); crackleG.gain.setTargetAtTime(S.crackle*vel, t, 2);
    droneG.gain.cancelScheduledValues(t); droneG.gain.setTargetAtTime(S.drone*vel, t, 4);
    if (hissNow && hissNow.end > t + 1.2){
      const h = hissNow; h.g.gain.cancelScheduledValues(t);
      if (h.start >= t){ h.g.gain.setValueAtTime(0, t); h.s.stop(t); }   // (not started yet: it never plays)
      else { h.g.gain.setTargetAtTime(0, t, 0.3); h.s.stop(t + 1.2); }
    }
    hissNow = null;
    if (S.hiss) hiss(t, (sections.length*16 - step)*60/bpm/4, S.hiss*vel);
    for (const d of [echoL, echoR]){ d.delayTime.cancelScheduledValues(t); d.delayTime.setTargetAtTime(3*60/bpm/4, t, 0.05); }   // a dotted eighth
  }
  let onTrack = null;
  // ---------------------------------------------------------------- synthesis
  function impulse(sec, decay){
    const n = Math.floor(ctx.sampleRate*sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c=0;c<2;c++){ const d = buf.getChannelData(c); let lp = 0;
      for (let i=0;i<n;i++){ const t = i/ctx.sampleRate; lp += (R()*2 - 1 - lp)*(0.25 + 0.5*Math.exp(-t*1.5)); d[i] = lp*Math.exp(-t/decay); } }
    return buf;
  }
  function build(c){
    ctx = c || new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.4;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9000; tone.Q.value = 0.3;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(tone).connect(comp).connect(ctx.destination);
    mixG = ctx.createGain(); mixG.connect(master);   // the music (everything but the whooshes)
    const verb = ctx.createConvolver(); verb.buffer = impulse(4.5, 1.4);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.7; verb.connect(verbOut).connect(mixG);
    verbSend = ctx.createGain(); verbSend.connect(verb);
    drumLP = ctx.createBiquadFilter(); drumLP.type = 'lowpass'; drumLP.frequency.value = 12000; drumLP.Q.value = 0.5;
    drumBus = ctx.createGain(); drumBus.gain.value = 0.9; drumBus.connect(drumLP).connect(mixG);
    duck = ctx.createGain(); duck.gain.value = 1; duck.connect(mixG);
    musBus = ctx.createGain(); musBus.gain.value = 1; musBus.connect(duck);
    const mv = ctx.createGain(); mv.gain.value = 0.35; musBus.connect(mv).connect(verbSend);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i] = R()*2 - 1;
    // vinyl crackle: sparse clicks over a whisper of hiss
    const cb = ctx.createBuffer(1, ctx.sampleRate*4, ctx.sampleRate), cd = cb.getChannelData(0);
    for (let i=0;i<cd.length;i++) cd[i] = (R()*2 - 1)*0.05 + (R() < 0.0009 ? (R()*2 - 1)*(0.4 + R()) : 0);
    const cs = ctx.createBufferSource(); cs.buffer = cb; cs.loop = true;
    const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 900;
    crackleG = ctx.createGain(); crackleG.gain.value = 0; cs.connect(chp).connect(crackleG).connect(mixG); cs.start();
    // tape wobble shared by the keys
    wobble = ctx.createGain(); wobble.gain.value = 7; const wo = ctx.createOscillator(); wo.frequency.value = 0.35; wo.connect(wobble); wo.start();
    // a low drone that thickens in the ambient sections
    droneG = ctx.createGain(); droneG.gain.value = 0;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 170; droneG.connect(dl).connect(mixG);
    for (const [m, g] of [[38, 0.6], [45, 0.35], [50, 0.18]]){ const o = ctx.createOscillator(); o.frequency.value = hz(m); const vg = ctx.createGain(); vg.gain.value = g; o.connect(vg).connect(droneG); o.start(); }
    // vibraphone bus with its slow motor tremolo
    vibesBus = ctx.createGain(); vibesBus.gain.value = 0.85; vibesBus.connect(musBus);
    const vt = ctx.createOscillator(), vtg = ctx.createGain(); vt.frequency.value = 5.2; vtg.gain.value = 0.14; vt.connect(vtg).connect(vibesBus.gain); vt.start();
    // ping-pong echo, darker on every repeat (timed to the track: a dotted eighth)
    echoIn = ctx.createGain(); echoL = ctx.createDelay(1.5); echoR = ctx.createDelay(1.5); echoL.delayTime.value = echoR.delayTime.value = 0.4;
    const eLP = ctx.createBiquadFilter(), eLP2 = ctx.createBiquadFilter(), fbA = ctx.createGain(), fbB = ctx.createGain(), pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner(), wet = ctx.createGain();
    eLP.type = eLP2.type = 'lowpass'; eLP.frequency.value = eLP2.frequency.value = 2500; fbA.gain.value = fbB.gain.value = 0.35; pl.pan.value = -0.75; pr.pan.value = 0.75; wet.gain.value = 0.8;
    echoIn.connect(echoL).connect(eLP).connect(pl).connect(wet); eLP.connect(fbA).connect(echoR).connect(eLP2).connect(pr).connect(wet); eLP2.connect(fbB).connect(echoL);
    wet.connect(musBus);
    // the synthwave arpeggio: one soft filter, and a send into the echo
    arpBus = ctx.createGain(); const al = ctx.createBiquadFilter(), ae = ctx.createGain(); al.type = 'lowpass'; al.frequency.value = 1500; al.Q.value = 1;
    arpBus.connect(al).connect(musBus); ae.gain.value = 0.5; al.connect(ae).connect(echoIn);
  }
  // (live counts the notes still sounding: the new styles skip optional notes when too many ring at once)
  const tidy = (src, nodes) => { const on = !offline; if (on) live++; src.onended = () => { if (on) live--; for (const n of nodes) try { n.disconnect(); } catch (e) {} }; };
  function noise(t, dur, v, type, f, q, out, send = 0){
    v *= vel;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.9 + R()*0.2;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(out); if (send){ const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg).connect(verbSend); }
    s.start(t, R()*1.5); s.stop(t + dur + 0.05); tidy(s, [s, fl, g]);
  }
  function kick(t, v){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v*vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(drumBus); o.start(t); o.stop(t + 0.45); tidy(o, [o, g]);
    noise(t, 0.012, v*0.25, 'highpass', 2500, 0.5, drumBus);
  }
  function snare(t, v, soft){
    noise(t, soft ? 0.16 : 0.2, v, 'bandpass', soft ? 1500 : 1900, 0.8, drumBus, 0.25);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(v*0.5*vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g).connect(drumBus); o.start(t); o.stop(t + 0.12); tidy(o, [o, g]);
  }
  function clap(t, v){ for (let k=0;k<3;k++) noise(t + k*0.011, 0.07 + (k === 2 ? 0.12 : 0), v*(k === 2 ? 1 : 0.6), 'bandpass', 1300, 1.2, drumBus, 0.35); }
  function hat(t, v, open){ noise(t, open ? 0.28 : 0.045, v, 'highpass', open ? 6500 : 7800, 0.7, drumBus, open ? 0.15 : 0); }
  function rhodes(t, m, dur, v, pan = 0){
    v *= vel;
    const f = hz(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), p = ctx.createStereoPanner(), lp = ctx.createBiquadFilter();
    car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f*1.6, t); mg.gain.exponentialRampToValueAtTime(f*0.12, t + 0.6);
    mod.connect(mg).connect(car.frequency); wobble.connect(car.detune);
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(v*0.45, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.1);
    p.pan.value = pan; car.connect(lp).connect(g).connect(p).connect(musBus);
    car.start(t); mod.start(t); car.stop(t + dur + 1.2); mod.stop(t + dur + 1.2); const on = !offline; if (on) live++;
    car.onended = () => { if (on) live--; try { wobble.disconnect(car.detune); } catch (e) {} for (const n of [car, mod, mg, g, p, lp]) try { n.disconnect(); } catch (e) {} };
  }
  function bass(t, m, dur, v){
    v *= vel;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(m); o2.type = 'triangle'; o2.frequency.value = hz(m); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2).connect(lp); o.connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v, t + Math.max(dur - 0.06, 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    lp.connect(g).connect(duck); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1); tidy(o, [o, o2, g2, lp, g]);
  }
  function pad(t, notes, dur, v, cutoff = 900){
    v *= vel;
    notes.forEach((m, i) => {
      const f = hz(m), g = ctx.createGain(), flt = ctx.createBiquadFilter(), pan = ctx.createStereoPanner();
      flt.type = 'lowpass'; flt.frequency.value = cutoff*(0.8 + 0.4*R()); flt.Q.value = 0.5;
      pan.pan.value = (R()*2 - 1)*0.6;
      const oscs = [['sawtooth', -6 - R()*4], ['sawtooth', 6 + R()*4], ['sine', 0]].map(([type, det]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = type === 'sine' ? f/2 : f; o.detune.value = det; o.connect(flt); return o; });
      flt.connect(g).connect(pan).connect(musBus);
      const att = Math.min(dur*0.3, 3 + R()*3), peak = v*(0.8 + 0.4*R());
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setValueAtTime(peak, t + Math.max(dur - 1.5, att)); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      for (const o of oscs){ o.start(t); o.stop(t + dur + 1.6); }
      tidy(oscs[0], [...oscs, flt, g, pan]);
    });
  }
  function pluck(t, m, v){
    v *= vel;
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = 'sawtooth'; o.frequency.value = hz(m); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.22);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    p.pan.value = (R()*2 - 1)*0.5; o.connect(lp).connect(g).connect(p).connect(musBus); const sg = ctx.createGain(); sg.gain.value = 0.5; p.connect(sg).connect(verbSend);
    o.start(t); o.stop(t + 0.4); tidy(o, [o, lp, g, p, sg]);
  }
  function lead(t, m, dur, v){
    v *= vel;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = hz(m); o2.frequency.value = hz(m + 12);
    vib.frequency.value = 5; vg.gain.value = 9; vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2).connect(g); o.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.04); g.gain.setValueAtTime(v, t + dur*0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    p.pan.value = 0.25; g.connect(p).connect(musBus); const sg = ctx.createGain(); sg.gain.value = 0.7; p.connect(sg).connect(verbSend);
    for (const x of [o, o2, vib]){ x.start(t); x.stop(t + dur + 0.35); } tidy(o, [o, o2, vib, vg, g2, g, p, sg]);
  }
  function bell(t, m, amp){
    amp *= vel;
    const f = hz(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    car.frequency.value = f; mod.frequency.value = f*3.5; mg.gain.setValueAtTime(f*1.2, t); mg.gain.exponentialRampToValueAtTime(f*0.05, t + 2.5);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    pan.pan.value = (R()*2 - 1)*0.8; car.connect(g).connect(pan); pan.connect(verbSend);
    const dry = ctx.createGain(); dry.gain.value = 0.25; pan.connect(dry).connect(mixG);
    car.start(t); mod.start(t); car.stop(t + 6); mod.stop(t + 6); tidy(car, [car, mod, mg, g, pan, dry]);
  }
  // ---------------------------------------------------------------- instruments of the newer styles
  // vibraphone: a sine bar with its tuned fourth partial and a faint tenth, through the motor tremolo
  function vibes(t, m, dur, v, pan = 0, echo = 0){
    v *= vel;
    const f = hz(m), g = ctx.createGain(), p = ctx.createStereoPanner(), sg = ctx.createGain(), nodes = [g, p, sg]; let src = null;
    for (const [r, a, d] of [[1, 1, 2.4 + dur], [4, 0.18, 0.5], [10, 0.04, 0.12]]){
      if (f*r > 8500) continue;
      const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f*r;
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(a, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(og).connect(g); o.start(t); o.stop(t + d + 0.02); nodes.push(o, og); if (!src) src = o;
    }
    g.gain.value = v; p.pan.value = pan; sg.gain.value = 0.45; g.connect(p).connect(vibesBus); p.connect(sg).connect(verbSend);
    if (echo){ const eg = ctx.createGain(); eg.gain.value = echo; p.connect(eg).connect(echoIn); nodes.push(eg); }
    tidy(src, nodes);
  }
  // felt piano: slightly stretched partials that fade faster the higher they are, two strings beating slowly on the
  // fundamental, a soft attack and the thump of the felt. The pedal comes up after dur (at the chord change).
  const PIANO_AMP = [1, 0.42, 0.22, 0.12, 0.07, 0.045, 0.03, 0.02];
  function piano(t, m, dur, v, pan){
    const f = hz(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), p = ctx.createStereoPanner(), sg = ctx.createGain(), nodes = [g, lp, p, sg];
    const ring = 4.2*Math.min(1.5, Math.max(0.5, 1.5 - (m - 45)/40)), n = Math.min(IS_SMALL ? 4 : 8, Math.max(3, Math.floor(3200/f)));
    const end = t + Math.min(dur, ring); let src = null;
    for (let k = 1; k <= n; k++){
      const fk = k*f*Math.sqrt(1 + 0.0004*k*k), d = ring/Math.pow(k, 0.7), stop = Math.min(t + d, end + 0.4);
      for (const det of k === 1 ? [0, 1.1] : [0]){
        const o = ctx.createOscillator(), og = ctx.createGain(), a = PIANO_AMP[k - 1]*(det ? 0.5 : 1);
        o.frequency.value = fk; o.detune.value = det;
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a, t + 0.007 + 0.002*k); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(og).connect(g); o.start(t); o.stop(stop); nodes.push(o, og); if (!src) src = o;
      }
    }
    lp.type = 'lowpass'; lp.Q.value = 0.3; lp.frequency.value = 1200 + 1800*Math.min(1, v/0.05);
    g.gain.setValueAtTime(v*0.45*vel, t); g.gain.setValueAtTime(v*0.45*vel, end); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.35);
    p.pan.value = pan === undefined ? Math.max(-0.6, Math.min(0.6, (m - 62)/28)) : pan; sg.gain.value = 0.55;
    g.connect(lp).connect(p).connect(musBus); p.connect(sg).connect(verbSend);
    tidy(src, nodes);
    noise(t, 0.03, v*0.12, 'lowpass', 420, 0.7, musBus);   // the felt
  }
  // a soft "ooh" choir: two detuned saws and a triangle through the two formants of the vowel
  function choir(t, notes, dur, v){
    v *= vel;
    for (const m of notes){
      const f = hz(m), env = ctx.createGain(), p = ctx.createStereoPanner(), sg = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
      const [f1, f2, lo] = [['bandpass', 330, 3.5], ['bandpass', 820, 5], ['lowpass', 480, 0.5]].map(([ty, fr, q]) => { const b = ctx.createBiquadFilter(); b.type = ty; b.frequency.value = fr; b.Q.value = q; return b; });
      const [g1, g2, g3] = [1, 0.35, 0.5].map(x => { const g = ctx.createGain(); g.gain.value = x; return g; });
      vib.frequency.value = 4.6 + R()*0.8; vg.gain.value = 7; vib.connect(vg);
      const oscs = [['sawtooth', -7], ['sawtooth', 7], ['triangle', 0]].map(([ty, d]) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f; o.detune.value = d + (R() - 0.5)*4; vg.connect(o.detune); o.connect(f1); o.connect(f2); o.connect(lo); return o; });
      f1.connect(g1).connect(env); f2.connect(g2).connect(env); lo.connect(g3).connect(env);
      const att = Math.min(1.6, dur*0.4);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(v, t + att); env.gain.setValueAtTime(v, t + Math.max(dur - 0.5, att)); env.gain.linearRampToValueAtTime(0, t + dur + 1.6);
      p.pan.value = (R()*2 - 1)*0.5; sg.gain.value = 0.6; env.connect(p).connect(musBus); p.connect(sg).connect(verbSend);
      for (const o of [...oscs, vib]){ o.start(t); o.stop(t + dur + 1.7); }
      tidy(oscs[0], [...oscs, vib, vg, f1, f2, lo, g1, g2, g3, env, p, sg]);
    }
  }
  // synthwave: a soft square arpeggio into the echo; downtempo: a sine sub bass that can slide in from the last note
  function arp(t, m, v, pan){
    v *= vel;
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = 'square'; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    p.pan.value = pan; o.connect(g).connect(p).connect(arpBus);
    o.start(t); o.stop(t + 0.27); tidy(o, [o, g, p]);
  }
  function sub(t, m, dur, v, from){
    v *= vel;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain(), g = ctx.createGain();
    o2.type = 'triangle'; lp.type = 'lowpass'; lp.frequency.value = 380; g2.gain.value = 0.25;
    for (const x of [o, o2]){ if (from){ x.frequency.setValueAtTime(hz(from), t); x.frequency.exponentialRampToValueAtTime(hz(m), t + 0.09); } else x.frequency.value = hz(m); }
    o.connect(lp); o2.connect(g2).connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.setValueAtTime(v, t + Math.max(dur - 0.06, 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    lp.connect(g).connect(duck); o.start(t); o2.start(t); o.stop(t + dur + 0.15); o2.stop(t + dur + 0.15); tidy(o, [o, o2, lp, g2, g]);
  }
  // a warm pad: one soft triangle per note, slow in and out
  function warm(t, notes, dur, v, cutoff = 900){
    v *= vel;
    for (const m of notes){
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
      o.type = 'triangle'; o.frequency.value = hz(m); o.detune.value = (R() - 0.5)*8; lp.type = 'lowpass'; lp.frequency.value = cutoff; p.pan.value = (R()*2 - 1)*0.5;
      const att = Math.min(dur*0.35, 2);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + Math.max(dur - 0.5, att)); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      o.connect(lp).connect(g).connect(p).connect(musBus); o.start(t); o.stop(t + dur + 1.6); tidy(o, [o, lp, g, p]);
    }
  }
  // a soft sine under the chord's root (ambient and ambient piano): slow in and out, dry and in the middle, no random draws
  function subPad(t, m, dur, v){
    v *= vel;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 2.5); g.gain.setValueAtTime(v, t + Math.max(dur - 2, 2.5)); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
    o.connect(g).connect(duck); o.start(t); o.stop(t + dur + 1.6); tidy(o, [o, g]);
  }
  // tape hiss for one song (it fades out early if the next song starts sooner)
  let hissNow = null;
  function hiss(t, dur, v){
    const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; hp.type = 'highpass'; hp.frequency.value = 1800; lp.type = 'lowpass'; lp.frequency.value = 7000;
    g.gain.value = 0;   // (a gain starts at 1: if its events are cancelled before t, it must not come back to full noise)
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 2); g.gain.setValueAtTime(v, t + Math.max(dur - 2, 2)); g.gain.linearRampToValueAtTime(0, t + dur + 1);
    s.connect(hp).connect(lp).connect(g).connect(mixG); s.start(t); s.stop(t + dur + 1.1); tidy(s, [s, hp, lp, g]);
    hissNow = { s, g, start:t, end:t + dur + 1.1 };
  }
  // ---------------------------------------------------------------- the sequencer: sixteenth notes, scheduled a little ahead
  function play(t){
    if (!T || step >= T.sections.length*16){ newTrack(t); }
    const s = step % 16, bar = Math.floor(step/16), sec = T.sections[bar];
    const sd = 60/(T.drift ? T.bpm*(1 + T.drift*Math.sin(bar*0.45 + T.driftPh)) : T.bpm)/4;
    // swing: every odd sixteenth comes a little late (lofi, downtempo)
    const swing = s % 2 ? sd*T.swing : 0, hum = () => (R() - 0.5)*0.008, tt = t + swing;
    const ch = T.chords[bar], root = ch.root, type = ch.type, chordStart = ch.start && s === 0;
    if (chordStart) T.cur = [root, type];
    const lastBar = bar === T.sections.length - 1;
    // the drum filter opens through the intro and closes for breakdowns and the outro
    if (s === 0){
      const target = sec === 'intro' ? 900 + 9000*Math.pow(bar/Math.max(T.sections.indexOf('A'), 1), 2) : sec === 'break' ? 700 : sec === 'outro' ? 1400 : 12000;
      drumLP.frequency.setTargetAtTime(Math.min(target, 12000), t, 0.6);
    }
    STYLES[T.style].step({ t, tt, sd, s, bar, sec, root, type, chordStart, lastBar, hum });
    step++;
    return sd;
  }
  // ---------------------------------------------------------------- lofi: dusty drums, Rhodes chords, a lead motif
  function lofiStep({ t, tt, sd, s, bar, sec, root, type, chordStart, lastBar, hum }){
    if (chordStart){
      const v = voice(root, type, 52, 71), dur = sd*16*T.barsPerChord;
      v.forEach((m, i) => rhodes(t + i*0.012 + hum(), m, dur*0.9, 0.05 + 0.015*R(), (i/(v.length - 1) - 0.5)*0.5));
      if (sec !== 'intro') bass(t, root - 24 + (root - 24 < 33 ? 12 : 0), sd*6, 0.2);
    }
    if (s === 10 && sec !== 'break' && R() < 0.5){ voice(root, type, 55, 72).slice(1).forEach((m, i) => rhodes(tt + i*0.01, m, sd*5, 0.03, 0.2)); }
    if (s === 8 && sec !== 'intro' && sec !== 'break') bass(tt, root - 24 + (R() < 0.5 ? 7 : 12) + (root - 24 < 33 ? 12 : 0), sd*3, 0.14);
    if (sec !== 'break' && !(sec === 'outro' && bar > T.sections.length - 3)){
      if (T.kickPat.includes(s) || (s === 14 && R() < 0.15)) kick(t + hum(), s === 0 ? 0.75 : 0.55);
      if (s === 4 || s === 12) snare(tt + 0.01 + hum(), 0.32, true);
      if (s % 2 === 0 || R() < 0.25*T.hatDensity) hat(tt + hum(), (s % 4 === 2 ? 0.085 : 0.05)*(0.6 + 0.8*R()), false);
      if ((s === 7 || s === 15) && R() < 0.2) snare(tt, 0.07, true);   // ghost notes
    }
    if ((sec === 'B' || (sec === 'A' && bar % 8 >= 4 && T.lead)) && !lastBar){
      for (const n of T.motif) if (n.s === s && R() < 0.9){ const up = bar % 4 === 3 && R() < 0.4 ? 2 : 0; lead(tt + hum(), n.n + up, sd*n.d, 0.045); }
    }
  }
  // ---------------------------------------------------------------- chill house: soft four-on-the-floor, sidechained pads, plucks
  function houseStep({ t, sd, s, bar, sec, root, type, chordStart, hum }){
    if (chordStart){
      const v = voice(root, type, 55, 74), dur = sd*16*T.barsPerChord;
      pad(t, v, dur, sec === 'break' ? 0.035 : 0.022, sec === 'break' ? 1800 : 1100);
    }
    const drums = sec !== 'break' && !(sec === 'intro' && bar < 4);
    if (drums){
      if (s % 4 === 0){ kick(t, 0.8);
        // the sidechain pump: everything but the drums ducks on each kick
        duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.3, t); duck.gain.linearRampToValueAtTime(1, t + sd*3.2); }
      if ((s === 4 || s === 12) && sec !== 'intro') clap(t + 0.004, 0.28);
      if (s % 4 === 2) hat(t, 0.09, true);
      else if (R() < 0.7) hat(t + hum(), 0.04*(0.5 + R()), false);
    }
    if (sec !== 'intro' && s % 4 === 2 && sec !== 'break') bass(t, root - 24 + (root - 24 < 33 ? 12 : 0) + (R() < 0.12 ? 12 : 0), sd*1.6, 0.22);
    if ((sec === 'B' || sec === 'drop') && (s % 2 === 0 || R() < 0.3)){
      const v = voice(root, type, 64, 88), idx = (Math.floor(step/2) + (sec === 'drop' ? bar : 0)) % v.length;
      pluck(t, v[s % 4 === 0 ? 0 : idx], 0.05*(s % 4 === 0 ? 1.2 : 0.8));
    }
    if (sec === 'break' && s % 8 === 0 && R() < 0.6) bell(t, voice(root, type, 72, 90)[Math.floor(R()*3)], 0.03);
  }
  // ---------------------------------------------------------------- ambient: slow pads over the drone and a low root, distant chimes
  function ambientStep({ t, sd, s, bar, root, type }){
    if (bar % 4 === 0 && s === 0){ pad(t, voice(root, type, 50, 74), sd*16*4 + 4, 0.04, 800); subPad(t, low(root, 36, 47), sd*16*4 + 2, 0.12); }
    if (R() < 0.022) bell(t + R()*sd, voice(root, type, 74, 94)[Math.floor(R()*4)], 0.02 + R()*0.02);
  }
  // ---------------------------------------------------------------- ambient piano: felt piano, broken chords, a slow melody, a faint pad
  function pianoStep({ t, sd, s, bar, sec, root, type, chordStart, lastBar }){
    const n = T.sections.length, k = T.chords[bar].k, loose = () => (R() - 0.5)*0.03, left = chordLeft(bar, s, sd);
    // left hand: root and fifth, low, under the pedal until the next chord, with a soft sine on the same root
    if (chordStart){
      const r = low(root, 36, 47);
      piano(t + loose(), r, left, 0.042); piano(t + 0.05 + loose(), r + 7, left, 0.03);
      if (sec !== 'intro') warm(t, voice(root, type, 52, 67), left + 0.5, 0.0025, 650);
      subPad(t, r, left + 0.5, 0.018);
    }
    // right hand: broken chords in eighths, rising and falling over two bars, about a quarter of the notes left out
    if (s % 2 === 0 && sec !== 'outro' && !(sec === 'intro' && bar === 0)){
      const vs = voice(root, type, 57, 76), i = (bar % 2)*8 + s/2, up = i < 8 ? i : 15 - i, idx = Math.min(vs.length - 1, Math.floor(up*vs.length/8));
      if (R() > 0.25 && !busy()) piano(t + loose(), vs[idx], left, (0.017 + 0.01*R())*(sec === 'B' ? 0.8 : 1));
    }
    // a slow melody on top in B
    if (sec === 'B' && !lastBar){
      const ph = melAt(k, true);
      for (const nn of melNotes(ph, k % 2, s)) piano(t + loose(), fit(melPitch(nn, T.key + 12), root, type, s % 8 === 0), Math.min(left, sd*nn.d + 1.5), 0.036);
    }
    // the ending: the home chord, spread slowly upward and left to ring
    if (sec === 'outro' && bar === n - 2 && s % 4 === 0){ const vs = voice(root, type, 57, 79); if (vs[s/4] !== undefined) piano(t + loose(), vs[s/4], sd*28, 0.026); }
  }
  // ---------------------------------------------------------------- downtempo: half-time drums, Rhodes, a sliding sub bass, an "ooh" choir, a vibes hook
  function downStep({ t, tt, sd, s, bar, sec, root, type, chordStart, lastBar }){
    const n = T.sections.length, k = T.chords[bar].k, end = bar >= n - 2, hum = () => (R() - 0.5)*0.008, left = chordLeft(bar, s, sd);
    // Rhodes: the chord on every bar (a Rhodes note fades within two seconds), softer when it is not new
    if (s === 0) voice(root, type, 52, 70).forEach((m, i, a) => rhodes(t + i*0.015 + hum(), m, Math.min(left, sd*16)*0.95, chordStart ? 0.036 : 0.03, (i/(a.length - 1) - 0.5)*0.5));
    if (s === 10 && (bar % 2) && sec !== 'break' && !end && R() < 0.35) voiceNR(root, type, 55, 72).forEach((m, i) => rhodes(tt + i*0.01, m, sd*4, 0.022, 0.2));
    // sub bass: long notes that sometimes slide in from the last one
    if (sec !== 'intro' && sec !== 'break' && !(end && bar === n - 1)){
      const r = low(root, 33, 45);
      // (a second note on the and-of-3 in most bars; otherwise the first one holds through the bar)
      if (s === 0){ T.subTwo = !end && R() < 0.7; sub(t, r, end ? sd*30 : T.subTwo ? sd*9 : sd*15, 0.043, T.subPrev && T.subPrev !== r && R() < 0.5 ? T.subPrev : 0); T.subPrev = r; }
      else if (s === 10 && T.subTwo){ const m = r + pick(CTONES[type].includes(10) ? [7, 12, 10] : [7, 12]); sub(tt, m, sd*5, 0.03, r); }   // (no flat seventh under a maj9)
    }
    // drums: kick on 1 and the and-of-3, snare on 3, lightly swung sixteenth hats
    if (!(sec === 'intro' && bar < 2) && sec !== 'break' && !end){
      if (s === 0 || s === 10) kick(t + hum(), s === 0 ? 0.15 : 0.1);
      if (s === 8) snare(tt + 0.01, 0.18, true);
      if ((s % 2 === 0 || R() < 0.35) && !busy()) hat(tt + hum(), (s % 4 === 2 ? 0.057 : s % 2 ? 0.023 : 0.038)*(0.7 + 0.6*R()), false);
    }
    // the choir in B and in the break
    if (chordStart && (sec === 'B' || sec === 'break')) choir(t, voiceNR(root, type, 57, 72).slice(0, 3), left, 0.009);
    // a sparse vibes hook in A, with a little echo
    if (sec === 'A' && !lastBar){
      const ph = melAt(k, false);
      if (ph) for (const nn of melNotes(ph, k % 2, s)) vibes(tt + hum(), fit(melPitch(nn, T.key), root, type, s % 8 === 0), sd*nn.d, 0.056, -0.2, 0.25);
    }
  }
  // ---------------------------------------------------------------- soft synthwave: pads with a gentle pump, a square arpeggio in echo, octave bass, a lead
  function waveStep({ t, tt, sd, s, bar, sec, root, type, chordStart, lastBar }){
    const k = T.chords[bar].k, left = chordLeft(bar, s, sd), fadeOut = sec === 'outro' && k >= 4;
    if (chordStart) pad(t, voice(root, type, 55, 74), left, sec === 'break' ? 0.024 : 0.017, sec === 'break' ? 1500 : 1000);
    // the arpeggio: sixteenths up (or up and down) the chord
    if (!(sec === 'intro' && k < 4) && !(fadeOut && k >= 6) && !busy()){
      const vs = voice(root, type, 62, 81), L = vs.length, cyc = T.arpUD ? 2*L - 2 : L, i = step % cyc, idx = i < L ? i : cyc - i;
      arp(t, vs[idx], (s % 4 === 0 ? 0.062 : 0.043)*(sec === 'intro' || fadeOut ? 0.7 : 1), s % 2 ? 0.3 : -0.3);
    }
    const drums = sec === 'A' || sec === 'B' || (sec === 'outro' && k < 4);
    // bass: eighth notes jumping an octave
    if ((drums || (sec === 'intro' && k >= 4)) && s % 2 === 0) bass(t, low(root, 33, 45) + (s % 4 === 2 ? 12 : 0), sd*1.5, s % 4 === 0 ? 0.085 : 0.057);
    if (drums){
      if (s === 0 || s === 8){ kick(t, 0.25);
        // a gentle pump: the music dips a little on each kick
        duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.6, t); duck.gain.linearRampToValueAtTime(1, t + sd*3.5); }
      if (s === 4 || s === 12) snare(t + 0.005, 0.18, true);
      if (s % 2 === 0) hat(t, s % 4 === 2 ? 0.06 : 0.034, false);
    }
    // the lead: two bars on, two off, in B
    if (sec === 'B' && !lastBar){
      const ph = melAt(k, false);
      if (ph) for (const nn of melNotes(ph, k % 2, s)) lead(tt, fit(melPitch(nn, T.key), root, type, s % 8 === 0), sd*nn.d, 0.047);
    }
  }
  function pump(){
    if (!ctx || !running) return;
    const ahead = document.hidden ? 1.6 : 0.25;
    while (nextT < ctx.currentTime + ahead) nextT += play(nextT);
  }
  const level1 = 0.85;   // the master level at full volume
  function level(){ return level1*SET.volume; }
  function fadeTo(v, sec){ if (!master) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); }
  function start(){
    if (!AC) return;
    if (!ctx){ try { build(); } catch (e) { console.warn('sound unavailable', e); return; } }
    running = true;
    if (ctx.state === 'suspended') ctx.resume();
    if (!T) newTrack();
    nextT = Math.max(nextT, ctx.currentTime + 0.1);
    clearInterval(timer); timer = setInterval(pump, 50); pump();
    fadeTo(level(), ctx.currentTime < 1 ? 0.6 : 3);
  }
  function stop(){
    running = false;
    if (!ctx) return;
    fadeTo(0, 1.2);
    setTimeout(() => { if (!running){ clearInterval(timer); if (ctx.state === 'running') ctx.suspend(); } }, 1400);
  }
  // Offline render (tests/music.mjs: levels and listening clips): sec seconds of one style from a seed, at full volume,
  // on an OfflineAudioContext. Everything is scheduled at once and the live graph and track are put back before it renders.
  let lastRender = '';
  function render(style, sec, seed, rate){
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || !STYLES[style]) return Promise.resolve(null);
    const keep = [ctx, master, mixG, verbSend, drumBus, drumLP, musBus, duck, crackleG, droneG, wobble, noiseBuf, vibesBus, arpBus, echoIn, echoL, echoR, R, T, nextT, step, first, forceStyle, offline, vel, SH, hissNow];
    let oc = null, z = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0;   // (scrambled: nearby seeds give different songs)
    try {
      R = () => { z = (z*1664525 + 1013904223) >>> 0; return z/4294967296; }; for (let i=0;i<4;i++) R();
      oc = new OAC(2, Math.ceil(sec*rate), rate); offline = true; build(oc);
      forceStyle = style; first = true; T = null; SH = fresh(); hissNow = null; newTrack(0); lastRender = T.name;
      let t = 0.1; while (t < sec) t += play(t);
      master.gain.value = level1;
    } finally {
      [ctx, master, mixG, verbSend, drumBus, drumLP, musBus, duck, crackleG, droneG, wobble, noiseBuf, vibesBus, arpBus, echoIn, echoL, echoR, R, T, nextT, step, first, forceStyle, offline, vel, SH, hissNow] = keep;
    }
    return oc.startRendering();
  }
  // the next n songs a mood would deal (style, key and name), without playing anything (for the tests)
  function plan(mood, n){
    const keep = [SH, SET.musicStyle, R], out = [];
    try {
      SH = fresh(); SET.musicStyle = mood; R = Math.random;
      for (let i=0;i<n;i++){ const st = nextStyle(), S = STYLES[st], key = nextKey(S); out.push({ style:st, key, sig:SH.sig, title:makeTitle(st) }); }
    } finally { [SH, SET.musicStyle, R] = keep; }
    return out;
  }
  const moodText = m => { const L = Object.keys(MOODS[m] || MOODS.mix).map(st => STYLES[st].label); return L.length > 1 ? L.slice(0, -1).join(', ') + ' and ' + L[L.length - 1] : L[0]; };
  return {
    get on(){ return wantOn; },
    // really playing: wanted, started and not held back by the browser (before the first click the context stays suspended)
    // (without Web Audio there is nothing to wait for, so the wish counts)
    get audible(){ return AC ? !!(wantOn && running && ctx && ctx.state === 'running') : wantOn; },
    get track(){ return T; },
    get _dbg(){ return { ctx, master, live, styles:Object.keys(STYLES) }; },
    // the moods of the settings panel, and what each one plays ('ambient, piano and lofi')
    moods:MOODS, moodText,
    _render:(style, sec = 30, { seed = 1, rate = 48000 } = {}) => render(style, sec, seed, rate),   // for tests/music.mjs
    _plan:plan, _places:PLACES, _names:NAMES,
    get _last(){ return lastRender; },
    set onTrack(f){ onTrack = f; },
    // a blocked context stays suspended, so every gesture retries until one is accepted (wheel and touchstart are not)
    gesture(){ if (!wantOn) return; if (!running) start(); else if (ctx.state === 'suspended'){ ctx.resume(); fadeTo(level(), 0.6); } },
    set(on){ wantOn = on; if (on) start(); else stop(); },
    volume(){ if (running) fadeTo(level(), 0.3); },
    // move on to a new track now (the current one is cut at the next beat with a short fade)
    skip(){ if (!ctx || !running){ T = null; return; } const t = ctx.currentTime; musBus.gain.setValueAtTime(musBus.gain.value, t); musBus.gain.linearRampToValueAtTime(0, t + 0.4); musBus.gain.linearRampToValueAtTime(1, t + 1.2); T = null; newTrack(); },
    styleChanged(){ if (ctx && running) this.skip(); else T = null; },
    whoosh(dur){
      if (!running || !ctx) return;
      const t = ctx.currentTime, d = Math.max(dur, 0.8);
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(180, t); bp.frequency.exponentialRampToValueAtTime(900, t + d*0.5); bp.frequency.exponentialRampToValueAtTime(220, t + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + d*0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
      src.connect(bp).connect(g); g.connect(master); g.connect(verbSend);
      src.start(t); src.stop(t + d + 0.8); tidy(src, [src, bp, g]);
    },
  };
})();

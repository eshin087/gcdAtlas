// ================================================================ the Halo showcases: scripted looks at the ship, for reviewing its design.
// ?showcase=halo: the camera circles the ship once (it holds still for that, which it never does on the site), then rides along through one visit of each
// kind: a scan at Saturn, light speed to Jupiter (seen from the bridge) and a skim, light speed to the Moon and a weapons test, light speed
// to Mars and a probe (Pip, the drone), a fold to the Pillars of Creation and a tractor beam and drill, then a fold back to Saturn and round again.
// ?showcase=review, the looks review (about 45 s a round, in the looks the address picks: ?shield=a|b|c|off, ?fold=a|b|c, ?drone=a|b|c, with a
// switch for each, bottom left on a desk and at the top on a phone): the ship held at Saturn while the camera circles it (the shield at rest), a
// fold to Sgr A* in the chosen style, arriving 6.5 s before the closest point, the pass there (the shield flares as the pull grows, the heart
// beats harder; Pip comes out, says hello, spins, peeks at the hole, takes pictures, loops the loop, waves and streams back into the bay) seen
// from the chase camera, from above at the closest point, as riders see it and from the bridge, a light-speed hop to SGR 1806-20, a few
// seconds there, and a fold back to Saturn. Buttons beside the switches (keys 4 to 7) do a fold, a black-hole pass, Pip or light speed now.
// The route is the site's own: the review only picks the stops and the jobs, starts a visit later than the route would (as the ship comes out
// of a fold: S_.onFoldIn, before it is first drawn), times Pip's launch, and leaves a stop early from where the ship is (leaveNow, the ship's
// own turn and jump from there on).
// A caption names each part. Taking the camera (a drag, the pause button, picking something) ends it and the site carries on as usual.
const SHOWCASE = { on:REVIEW_SC || new URLSearchParams(location.search).get('showcase') === 'halo', review:REVIEW_SC, t:0, turn:-1, fade:-1, fadeIn:false, visits:-1, wait:-1, loops:0, part:'', partT:0, cam:null,
  queue:null, leaveAt:-1, stopT:0, ltNext:0 };
if (SHOWCASE.on){
  const SC = SHOWCASE, D = Math.PI/180, TURN_T = SC.review ? 11 : 22, LIGHT = [-0.55, 0.35, 0.6];   // (the light during the turn, in the ship's frame: above, ahead, starboard)
  const PLAN = [{ key:'saturn', act:'scan', by:'fold' }, { key:'jupiter', act:'skim', by:'light' }, { key:'moon', act:'weapons', by:'light' },
    { key:'mars', act:'probe', by:'light' }, { key:'pillars', act:'tractor', by:'fold' }];
  const JOB = { scan:tg => 'sensor scan of ' + tg.name + ' · every beam ends where it meets the surface',
    probe:tg => "Pip, the ship's little drone, pops out, says hello, takes pictures of " + tg.name + ' and docks again',
    weapons:tg => 'weapons test on ' + tg.name + ' (fictional): rail gun, plasma lance, antimatter pulse · nothing is harmed',
    skim:tg => 'skimming ' + tg.name + "'s cloud tops to refuel", tractor:() => 'tractor beam and drill · a passing rock is held, cored and let go' };
  // what the ship should do at the stop after next (the ship picks its next stop and job ahead of time)
  const forceFrom = i => { const n = PLAN.length, a = PLAN[(i + 1) % n], b = PLAN[(i + 2) % n]; S_.force = { target:b.key, travel:b.by, act:a.act }; };
  // the turn, in the ship's frame (ship radii): from straight above with the needle pointing right (like the concept art) down to the
  // starboard side, then once round (the front, the port side from below, the stern) and up into the chase camera's place. Its clock runs
  // 22 s (the looks review plays it in TURN_T, faster).
  // On a tall, narrow screen it stands further back so the whole ship fits across.
  function turnPose(t){
    t *= 22/TURN_T;
    let phi = 90, el = 89.5, dist = 1.75, look = [0, 0, 0];
    if (t < 3.5) dist = 1.75 - 0.2*smooth(0, 3.5, t);
    else if (t < 7){ const u = smooth(3.5, 7, t); el = 89.5 - 74.5*u; dist = 1.55 + 0.1*u; }
    else if (t < 19){ phi = 90 + 270*smooth(7, 19, t);
      el = 15 + 5*smooth(90, 180, phi) - 48*smooth(180, 270, phi) + 53*smooth(270, 360, phi);
      dist = 1.65 + 0.35*smooth(90, 180, phi) - 0.25*smooth(180, 270, phi) + 0.2*smooth(270, 360, phi); }
    else { const u = smooth(19, 22, t); phi = 360; el = 25 - 10*u; dist = 1.95 + 1.15*u; look = [-0.3*u, 1.5*u, 0]; }
    const fit = Math.max(1, 0.62/tanX), e = el*D, f = phi*D, dir = [-Math.sin(e), -Math.cos(e)*Math.cos(f), Math.cos(e)*Math.sin(f)];
    return { eye:V.mul(dir, dist*(t < 19 ? fit : 1 + (fit - 1)*(1 - smooth(19, 22, t)))), look, up:V.norm(V.sub([-1, 0, 0], V.mul(dir, Math.sin(e)))) };
  }
  // (while the camera circles the ship the info panel steps back to its compact form, so it covers none of the ship; in the looks review it
  // stays compact until the review ends (it covered Pip), otherwise it comes back for the ride. Not saved: the visitor's own choice stays.)
  function startTurn(){ S_.hold = true; SC.turn = 0; SC.fadeIn = true; SC.fade = 0; shipCam.turn = turnPose(0); shipCam.mode = 'turn'; document.body.classList.add('info-compact'); syncLayout(); updateModeUI(); }
  function endTurn(){ S_.hold = false; SC.turn = -1; SC.fadeIn = false; SC.fade = 0; if (shipCam.mode === 'turn') shipCam.mode = 'chase'; if (!SC.review) applyInfoState(); updateModeUI(); }
  const setMode = m => { if (shipCam.mode !== m){ shipCam.mode = m; updateModeUI(); } };

  // ---------------------------------------------------------------- the looks review: Saturn (the turn, then a fold from where the ship is) → Sgr A* (Pip's probe) →
  // light speed → SGR 1806-20 (a few seconds) → fold → Saturn. Where the ship goes after each stop, how, and its job there (any other stop, reached
  // by the light-speed button, folds on to Sgr A*): S_.force is kept to what the next stop asks for, so whatever the buttons change, the ship's
  // own next choice (as it arrives from a fold, or as it turns for light speed) follows the round.
  const ROUTE = { saturn:{ act:'scan', target:'sgra', travel:'fold' }, sgra:{ act:'probe', target:'magnetar', travel:'light' }, magnetar:{ act:'scan', target:'saturn', travel:'fold' } };
  const routeOf = k => ROUTE[k] || { act:'scan', target:'sgra', travel:'fold' };
  // (seconds: riding along at Saturn after the turn; before the closest point at Sgr A*; riding along at SGR 1806-20 or another stop; Pip's
  // launch after arriving at Sgr A*, once the hull has formed)
  const LEAD = 1, PRE = 6.5, RIDE = 4.5, PIP_AT = 1.8;
  // (the moment of the pass closest to the body)
  function closestT(pl){ let best = 1e300, bt = 0; for (let i=0;i<=240;i++){ const t = pl.T*i/240, r = V.len(passAt(pl, t).p); if (r < best){ best = r; bt = t; } } return bt; }
  // as the ship comes out of a fold (before the new pass is first drawn): at Saturn well before the end of the pass (time for Pip, if asked for,
  // after the turn); at a black hole PRE seconds before the closest point, with Pip out soon after (and back aboard before the pass ends)
  function onArrive(){
    if (!SC.on) return;
    const pl = S_.plan, k = S_.target.key;
    if (k === 'saturn') S_.t = Math.max(pl.T - 16, 0);
    else if (isHoleTarget(S_.target)){ S_.t = clamp(closestT(pl) - PRE, 0, Math.max(pl.T - ship.dbg.drone.PT.IN - PIP_AT - 1, 0)); if (S_.act && S_.act.kind === 'probe') S_.act.t0 = S_.t + PIP_AT; }
  }
  // leave now for tg (by 'fold' or 'light'), from wherever the ship is on its pass: what startAlign does at the end of a pass, from here (the
  // ship flies straight on while the drive spools up for a fold, or turns toward tg for light speed, then jumps), so it never jumps in place.
  // try: only work out whether light speed can be flown from here (the turn it takes, in radians), changing nothing. Returns the way it goes.
  function leaveNow(tg, mode, tryOnly){
    if (S_.phase !== 'pass') return null;
    const pl = S_.plan, e = passAt(pl, S_.t), A = S_.target, r = routeOf(tg.key), nx = { tg, mode };
    let al = null;
    if (mode === 'light'){
      const after = BYKEY[r.target] !== tg ? BYKEY[r.target] : BYKEY.saturn;
      nx.after = { tg:after, mode:r.travel }; nx.actK = r.act; nx.seed = S_.seedN;
      let d = V.norm(V.sub(tg.pos, V.add(A.pos, e.p)));
      for (let k=0;k<4;k++){ nx.plan = planVisit(tg, 'light', d, nx.after, nx.actK, nx.seed); al = aimAlign(e.p, e.h, e.v, V.sub(V.add(tg.pos, nx.plan.P[0]), A.pos), pl.Rc); if (!al) break; d = al.h1; }
      if (!al || angleOf(d, nx.plan.dIn) > 0.5) nx.mode = 'fold';
      if (tryOnly) return nx.mode === 'light' ? al.th : null;
      S_.seedN++;
    }
    if (tryOnly) return 0;
    if (S_.act && S_.act.end) S_.act.end();
    S_.act = null;
    S_.next = nx; S_.align = nx.mode === 'light' ? al : makeAlign(e.p, e.h, e.v, e.h, pl.Rc); S_.reaim = 0;
    S_.jumpAt = Math.max(S_.align.Tt + 0.4, nx.mode === 'fold' ? HALO.FOLD_SPOOL : HALO.LS_SPOOL);
    S_.phase = 'align'; S_.t = 0;
    return nx.mode;
  }
  // light speed from here: to the stop that needs the least turning (the round's own stops first), so the jump comes soon
  function lightTarget(){
    if (SC.t < SC.ltNext) return null;   // (working it out takes a while: at most once a second)
    SC.ltNext = SC.t + 1;
    // (the round's stops, and the six others most nearly ahead, in reach of light speed)
    const A = S_.target, h = S_.h, from = ship.pos, ahead = k => { const B = BYKEY[k]; return B ? V.dot(h, V.norm(V.sub(B.pos, from))) : -2; };
    const keys = ['sgra', 'magnetar', 'saturn', ...SHIP_TARGETS.filter(k => !ROUTE[k] && BYKEY[k] && V.len(V.sub(BYKEY[k].pos, A.pos)) < HALO.LS_FAR).sort((a, b) => ahead(b) - ahead(a)).slice(0, 6)];
    let best = null, bs = 1e9;
    for (const k of keys){
      const B = BYKEY[k]; if (!B || B === A || !(V.len(V.sub(B.pos, A.pos)) < HALO.LS_FAR)) continue;
      const th = leaveNow(B, 'light', true); if (th == null) continue;
      const sc = th - (ROUTE[k] ? 0.5 : 0); if (sc < bs){ bs = sc; best = B; }
    }
    return best;
  }
  // ---------------------------------------------------------------- the buttons: do it now, or as soon as the ship can (a queue of one: the last button pressed). The ship can
  // once it is on a pass with its hull formed; the camera circling the ship lets go first; Pip, when out, goes home first (at once where that is
  // smooth: see drone.hurry). 'fold' goes on to the next stop; 'hole' folds to Sgr A* (or, on the way in there, just carries on); 'pip' sends
  // Pip out from here when the pass has time for its whole job (otherwise at the next stop); 'light' jumps to light speed.
  const ACT_WORDS = { fold:'teleport', hole:'black hole', pip:'Pip', light:'light speed' };
  function press(kind){
    SC.queue = { kind, t:0 };
    // (the camera circling the ship lets go; the stop is left as after the turn, once the button's work is done)
    if (SC.turn >= 0){ endTurn(); SC.leaveAt = SC.t + LEAD; }
    const done = tryAct(kind, 0);
    if (done) SC.queue = null;
    toast(ACT_WORDS[kind] + (done ? ' · now' : ' · as soon as the ship can'));
  }
  function tryAct(kind, dt){
    const S = S_, u = S.act && S.act.kind === 'probe' ? S.t - S.act.t0 : -99, pipOut = PIP.st === 'out';
    if (kind === 'hole' && S.target === BYKEY.sgra && S.phase === 'pass' && S.t < closestT(S.plan) - 1.5) return true;   // (already on the way in)
    if (kind === 'pip' && pipOut && SC.queue && SC.queue.t > 0.2 && u < 0.5) return true;   // (it has come out since: at the next stop, on its own)
    if (S.phase !== 'pass' || S.asm < FLK_END || S.hold) return false;
    if (kind === 'pip'){
      if (pipOut || u > -1 && u < ship.dbg.drone.PT.IN) return false;   // (out, or about to be: once it is back aboard)
      if (S.plan.T - S.t < ship.dbg.drone.PT.IN + 0.9) return false;    // (not time enough on this pass: at the next stop)
      const pl = S.plan, t0 = S.t + 0.3, A = ACT.probe(pl);
      if (S.act && S.act.end) S.act.end();
      // (its own clock for the framing: the ship banks and the cameras turn toward the work as for a probe from the start)
      A.t0 = t0; A.update = () => { A.tau = S_.t - t0 + 0.3; }; A.tau = -0.3; S.act = A;
      return true;
    }
    if (pipOut){ drone.hurry(dt); return false; }
    if (kind === 'light'){ const B = lightTarget(); if (!B) return false; return !!leaveNow(B, 'light'); }
    return !!leaveNow(kind === 'hole' ? BYKEY.sgra : S.next.tg, 'fold');
  }
  // (the buttons, beside the switches for the looks, and their keys; a lit button waits for the ship)
  const actChip = SC.review ? reviewChip('now', 'Do it now (review)', ['<span class="k">4</span> teleport', '<span class="k">5</span> black hole', '<span class="k">6</span> Pip', '<span class="k">7</span> light speed'], i => ['fold', 'hole', 'pip', 'light'][i]) : null;
  if (actChip){
    actChip.classList.add('act-chip');
    actChip.addEventListener('click', e => { const b = e.target.closest('button'); if (b && SC.on) press(b.dataset.v); });
    addEventListener('keydown', e => { if (!SC.on || e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input'))) return; const i = '4567'.indexOf(e.key); if (i >= 0) press(['fold', 'hole', 'pip', 'light'][i]); });
  }
  const syncAct = () => { if (!actChip) return; const q = SC.queue; for (const b of actChip.querySelectorAll('button')) b.classList.toggle('on', !!q && q.kind === b.dataset.v); };

  // At Sgr A* the chase camera shows the ship side-on while it banks toward the hole, so at the closest point the camera rises for a few seconds
  // to a three-quarter view from above and behind, where the whole shield and the heart show; then the chase view as riders see it (Pip says
  // goodbye and streams back into the bay), then the bridge. The hole sits toward the edge of the picture, beside the ship: behind it, its bright
  // disc hid the heart's beat and the flare on the side facing it.
  // (A pose in the ship's frame, blended from wherever the camera is; Pip, near a black hole at its spot in the camera's view, moves with it.
  // eye: how far it leans away from the hole, back along the ship and up off the deck, and its distance in ship radii; look: how far toward the
  // hole and ahead it aims; up: the needle points up the screen.)
  const ABOVE = { eye:[0.2, -0.5, 2.7, 0.6], look:[0.15, 0.05], up:[0, 1, 0] };
  function toAbove(){
    const R = ship.R0, e = V.mul(M3.applyT(R, shipCam.eye || [0, 0, 0]), 1/ship.rad), f = M3.applyT(R, shipCam.fwd || cam.fwd);
    SC.cam = { t:0, e0:e, l0:V.add(e, V.mul(f, Math.max(V.len(e), 1))), u0:M3.applyT(R, shipCam.up || cam.up) };
    if (PIP.H && PIP.kind !== 'near') PIP.H.c = null;
    shipCam.turn = { eye:e, look:SC.cam.l0, up:SC.cam.u0 }; setMode('turn');
  }
  function abovePose(dt){
    const c = SC.cam, k = smooth(0, 1.6, c.t += dt), fit = Math.max(1, 0.42/tanX), A = ABOVE;   // (on a tall, narrow screen it stands further back)
    // (in the ship's axes: g toward the hole; the camera on the far side of the ship from it and a little behind, looking past the ship toward it)
    // (on a tall, narrow screen it aims less toward the hole, or the ship would sit half off the side of the screen)
    const g = M3.applyT(ship.R0, V.norm(V.mul(ship.offset, -1))), e = V.norm(V.add(V.mul(g, -A.eye[0]), [-(A.eye[3] || 0), A.eye[1], 0]));
    const eye = V.mul(e, A.eye[2]*fit), look = V.add(V.mul(g, A.look[0]*Math.min(1, tanX/tanY)), [0, A.look[1], 0]), f = V.norm(V.sub(look, eye)), up = V.norm(V.sub(A.up, V.mul(f, V.dot(A.up, f))));
    shipCam.turn = { eye:V.lerp(c.e0, eye, k), look:V.lerp(c.l0, look, k), up:V.norm(V.lerp(c.u0, up, k)) };
    // (once the camera is up there, Pip, waiting by the ship near the hole, takes a spot of its own in the new view: drone.reframe)
    if (c.t > 1 && !c.re){ c.re = true; drone.reframe(); }
  }
  function reviewStart(){
    S_.force = Object.assign({}, ROUTE.saturn); foldVisit(BYKEY.saturn);
    onArrive(); S_.belly = null; S_.viewA = 0; S_.hFrom = null; placeShip(0);
    // (and each later visit after a fold: endFold calls this before the new pass is first drawn)
    S_.onFoldIn = onArrive;
  }
  // the looks' names for the captions: 'fold A (ember wind)', 'Pip A (eye-pod)'
  const PART_WORDS = { chase:'on the way in', above:'closest point', close:'just past the closest point', bridge:'on the way out', leave:'on the way out' };
  const named = s => { const p = s.split(' · '); return p.length > 1 ? `${p[0]} (${p[1]})` : s; };
  const nm = tg => tg.label && tg.label.length < tg.name.length && !/^the /.test(tg.name) ? tg.label : tg.name;
  // the shield's work: what drives it (the pull there is real, the shield made up) and its power, last, so the caption's typing only redoes the
  // number as it changes (setCaption keeps what the old and new text share)
  function shieldBit(){
    const S = S_, pw = shieldPower(); if (!shieldLook) return 'no shield';
    if (!(pw > 0.12)) return named(SHIELD_NAMES[shieldLook]) + ' at rest';
    return (pw > 0.7 ? 'the heart beats harder to feed the shield' : `${S.climbK > 0.5 ? 'climbing out of' : 'holding course in'} ${nm(S.gTg)}'s gravity`) + ` · shield power ${Math.round(pw*100)}%`;
  }
  // what Pip is doing, in a few words ('Pip A (eye-pod) peeks at Sgr A*')
  const pipBit = () => PIP.st === 'out' && PIP.A ? ' · ' + pipLine(PIP.A).split(' · ')[0].replace(' from beside the ship', '').replace(/^Pip/, named(DRONE_NAMES[droneLook])) : '';
  // (a button waiting for the ship)
  const waitBit = () => SC.queue ? ` · ${ACT_WORDS[SC.queue.kind]} next` : '';
  function reviewCaption(){
    const S = S_, tg = S.target, nx = S.next, fold = named(FOLD_NAMES[foldLook]);
    if (SC.turn >= 0) return (shieldLook ? named(SHIELD_NAMES[shieldLook]) + ' · at rest' : 'no shield, to compare') + (SC.turn < 2 ? ' · seen from above like the concept art' : ' · from every side (the ship holds still while the camera circles it)');
    const fl = foldLine(); if (fl) return fold + ' · ' + fl;
    if (S.phase === 'fold') return fold + ' · folding space · to ' + nm(nx.tg);
    if (S.phase === 'light') return 'light speed · to ' + S.leg.B.name + ' · a thin sheen on the edges and a star on the needle, no white glow';
    if (S.phase === 'align'){
      if (nx.mode === 'light') return (S.stretch > 0.05 ? 'jumping to light speed' : 'turning toward ' + nm(nx.tg)) + ' · chase view';
      return (S.fk > FLK.SH0 - 0.1 && shieldLook ? 'the shield folds into the heart' : 'the fold drive spools up') + ' · next: ' + fold + ' to ' + nm(nx.tg);
    }
    // (at a black hole: the hole's name first, then where the ship is on its pass, which follows the showcase's part (SC.part, switched a few
    // times a pass, never back and forth), and the view. setCaption keeps what is typed while the first 8 characters stay the same, so a
    // change types again only what follows the name)
    const hole = isHoleTarget(tg);
    if (!hole && !PIP.A && tg === BYKEY.saturn) return 'riding along · chase view · next: ' + fold + ' to ' + nm(nx.tg) + waitBit();
    const view = shipCam.mode === 'cockpit' ? 'from the bridge' : shipCam.mode === 'turn' ? 'from above' : SC.part === 'close' ? 'chase view, as riders see it' : 'chase view';
    const where = hole ? `${nm(tg)} · ${PART_WORDS[SC.part] || 'the pass'} · ${view}` : 'at ' + tg.name + (RS_KM[tg.key] ? ', a magnetar' : '');
    return where + pipBit() + waitBit() + ' · ' + shieldBit();
  }

  function begin(){
    document.body.classList.add('showcase'); hideHint();
    stopTour(false); pauseShow(); tween = null; flyMove = null; flight = null;
    if (SC.review) reviewStart(); else { forceFrom(-1); foldVisit(BYKEY.saturn); forceFrom(0); S_.t = 1; }
    SC.visits = S_.visits;
    shipCam.on = true; shipCam.pending = false; shipCam.eye = null; shipCam.zoom = 1; motion.last = 'ship';
    startTurn(); SC.fade = -1; S_.light = LIGHT.slice();   // (the first time, the showcase light is on from the start)
    setInfo(ship.index); updateModeUI();
  }
  function end(){
    SC.on = false; S_.hold = false; S_.light = null; S_.onFoldIn = null; SHOWCAP.txt = ''; SC.queue = null; syncAct(); if (actChip) actChip.hidden = true; document.body.classList.remove('showcase');
    // (a camera of the showcase's own, circling the ship or the view from above, is not left behind for when the visitor rides along again)
    if (shipCam.mode === 'turn') shipCam.mode = 'chase'; SC.cam = null; SC.turn = -1;
    updateModeUI(); applyInfoState();
    toast('showcase over · the camera is yours');
  }
  function caption(){
    if (SC.review) return reviewCaption();
    if (SC.turn >= 0) return SC.turn < 4 ? 'the new Halo · seen from above, like the concept art' : 'the new Halo · all angles (it holds still while the camera circles it; on the site it never stops)';
    const S = S_, tg = S.target, A = S.act, nx = S.next, bridge = shipCam.mode === 'cockpit' ? 'from the bridge · ' : '', fl = foldLine();
    if (fl) return fl;
    if (S.phase === 'light') return bridge + 'light speed · to ' + S.leg.B.name;
    if (S.phase === 'fold') return 'folding space · to ' + nx.tg.name;
    if (S.phase === 'align') return nx.mode === 'fold' ? (S.spool > 0.05 ? 'the fold drive spools up · next stop: ' : 'setting course for ') + nx.tg.name : bridge + 'turning toward ' + nx.tg.name + ' · light speed next';
    if (!A || A.tau < -0.8) return (bridge || 'riding along · chase view · ') + 'heading for ' + tg.name;
    if (A.tau > ACTS[A.kind].T + 0.5) return (bridge || 'riding along · chase view · ') + 'leaving ' + tg.name;
    return JOB[A.kind](tg);
  }
  TICKS.push(dt => {
    if (!SC.on) return;
    if (!SC.started){ SC.started = true; begin(); }
    SC.t += dt;
    // taking the camera ends the showcase (switching to the chase view during the turn only ends the turn)
    if (!shipCam.on && !shipCam.pending){ end(); return; }
    if (SC.turn >= 0 && shipCam.mode !== 'turn') endTurn();
    if (SC.turn >= 0){ SC.turn += dt; shipCam.turn = turnPose(SC.turn); if (SC.turn >= TURN_T){ endTurn(); if (SC.review) SC.leaveAt = SC.t + LEAD; } }
    // the showcase light fades in for the turn and back to the Sun's after it
    if (SC.fade >= 0){
      SC.fade += dt; const k = smooth(0, SC.fadeIn ? 1 : 2, SC.fade), sunL = M3.applyT(ship.R0, V.norm(V.sub(sun.rel, ship.rel)));
      S_.light = SC.fadeIn ? V.lerp(sunL, LIGHT, k) : V.lerp(LIGHT, sunL, k);
      if (k >= 1){ if (!SC.fadeIn) S_.light = null; SC.fade = -1; }
    }
    if (SC.review){
      // (the ship's next choice follows the round: see ROUTE)
      if (S_.next) S_.force = Object.assign({}, routeOf(S_.next.tg.key));
      // a new visit: back at Saturn, circle the ship again; elsewhere (after light speed) ride along a few seconds, then fold on
      if (S_.visits !== SC.visits){
        SC.visits = S_.visits; const k = S_.target.key; SC.stopT = 0; SC.leaveAt = -1;
        if (k === 'saturn'){ SC.loops++; SC.wait = 0.4; }
        else if (!isHoleTarget(S_.target)) SC.leaveAt = SC.t + RIDE;
        SC.part = 'chase'; SC.cam = null;
      }
      SC.stopT += dt;
      if (SC.wait >= 0 && (SC.wait -= dt) < 0){ SC.wait = -1; if (!SC.queue && S_.target === BYKEY.saturn) startTurn(); else SC.leaveAt = SC.t + LEAD; }
      // (leaving a stop early, by its route; not while Pip is out or a button waits, and not once the ship is on its way)
      if (SC.leaveAt >= 0 && SC.t >= SC.leaveAt && !SC.queue && S_.phase === 'pass' && PIP.st !== 'out' && !(S_.act && S_.act.kind === 'probe' && S_.t - S_.act.t0 > -1.5)){
        SC.leaveAt = -1; const r = routeOf(S_.target.key); leaveNow(BYKEY[r.target], r.travel === 'light' ? 'light' : 'fold');
      }
      // a button waiting for the ship
      if (SC.queue){ SC.queue.t += dt; if (tryAct(SC.queue.kind, dt)) SC.queue = null; }
      syncAct();
      // at Sgr A*: the chase camera while Pip comes out, says hello and spins (or, with no Pip, until the ship is nearly at its closest point), the
      // view from above there (Pip peeks, takes pictures, loops the loop), the chase view as riders see it (Pip looks back at the ship, waves and
      // streams into the bay), the bridge once it is aboard, and the chase camera for the jump (switched only as each part starts: the view
      // button still works in between)
      if (SC.turn < 0 && S_.target === BYKEY.sgra){
        const A = S_.act, u = A && A.kind === 'probe' ? S_.t - A.t0 : -9, PT_ = ship.dbg.drone.PT, near = V.len(ship.offset) < S_.plan.Rc*1.15;
        SC.partT += dt;
        // (with a button waiting, or the ship on its way, the chase camera stays: the view from above or the bridge would only flash by)
        const busy = !!SC.queue || S_.phase !== 'pass';
        if (SC.part === 'chase' && !busy && ((PIP.st === 'out' && u > PT_.SPIN) || (PIP.st !== 'out' && near && u < -1))){ SC.part = 'above'; SC.partT = 0; toAbove(); }
        else if (SC.part === 'above' && (busy || (u > 8.1 && u < PT_.IN) || SC.partT > 6)){ SC.part = 'close'; SC.partT = 0; SC.cam = null; setMode('chase'); }
        else if (SC.part === 'close' && (busy || (PIP.st !== 'out' && SC.partT > 1.5) || SC.partT > 6)){ SC.part = busy ? 'leave' : 'bridge'; SC.partT = 0; setMode(busy ? 'chase' : 'cockpit'); }
        else if (SC.part === 'bridge' && S_.phase !== 'pass' && (S_.phase !== 'align' || S_.next.mode === 'fold' || S_.stretch > 0.02)){ SC.part = 'leave'; setMode('chase'); }
      }
      if (SC.cam){ if (shipCam.mode === 'turn' && SC.turn < 0) abovePose(dt); else SC.cam = null; }
      SHOWCAP.txt = caption();
      return;
    }
    // a new visit: line up the stop after next; back at Saturn, circle the ship again (once it has come out of the fold)
    if (S_.visits !== SC.visits){
      SC.visits = S_.visits;
      const i = PLAN.findIndex(p => p.key === S_.target.key); forceFrom(i);
      if (i === 0){ SC.loops++; SC.wait = 0.8; }
      if (shipCam.mode === 'cockpit'){ shipCam.mode = 'chase'; updateModeUI(); }
    }
    if (SC.wait >= 0 && (SC.wait -= dt) < 0){ SC.wait = -1; startTurn(); }
    // from the bridge for the first light-speed jump: after the scan at Saturn, until the ship drops out at Jupiter
    if (SC.turn < 0 && S_.target === BYKEY.saturn && (S_.phase === 'align' || (S_.act && S_.act.kind === 'scan' && S_.act.tau > ACTS.scan.T + 0.3)) && shipCam.mode === 'chase'){ shipCam.mode = 'cockpit'; updateModeUI(); }
    SHOWCAP.txt = caption();
  });
}

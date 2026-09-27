// ================================================================ the Halo showcases: scripted looks at the ship, for reviewing its design.
// ?showcase=halo: the camera circles the ship once (it holds still for that, which it never does on the site), then rides along through one visit of each
// kind: a scan at Saturn, light speed to Jupiter (seen from the bridge) and a skim, light speed to the Moon and a weapons test, light speed
// to Mars and a probe (Pip, the drone), a fold to the Pillars of Creation and a tractor beam and drill, then a fold back to Saturn and round again.
// ?showcase=review, the looks review (about 85 s a round, in the looks the address picks: ?shield=a|b|c|off, ?fold=a|b|c, ?drone=a|b|c, with a
// switch for each at the top): the ship held at Saturn while the camera circles it (the shield at rest), a fold to Sgr A* in the chosen style,
// a pass there (the shield flares as the pull grows, the heart beats harder, Pip stays inside the shield) seen from the chase camera, from above
// at the closest point and from the bridge, a light-speed hop to SGR 1806-20 seen from behind, and a fold back to Saturn. The route is the
// site's own: the review only picks the stops and the jobs, and starts each Saturn visit a few seconds before its pass ends (S_.onFoldIn,
// before it is first drawn), so the fold comes soon after the turn.
// A caption names each part. Taking the camera (a drag, the pause button, picking something) ends it and the site carries on as usual.
const SHOWCASE = { on:REVIEW_SC || new URLSearchParams(location.search).get('showcase') === 'halo', review:REVIEW_SC, t:0, turn:-1, fade:-1, fadeIn:false, visits:-1, wait:-1, loops:0, part:'', cam:null };
if (SHOWCASE.on){
  const SC = SHOWCASE, D = Math.PI/180, TURN_T = 22, LIGHT = [-0.55, 0.35, 0.6];   // (the light during the turn, in the ship's frame: above, ahead, starboard)
  const PLAN = [{ key:'saturn', act:'scan', by:'fold' }, { key:'jupiter', act:'skim', by:'light' }, { key:'moon', act:'weapons', by:'light' },
    { key:'mars', act:'probe', by:'light' }, { key:'pillars', act:'tractor', by:'fold' }];
  const JOB = { scan:tg => 'sensor scan of ' + tg.name + ' · every beam ends where it meets the surface',
    probe:tg => "Pip, the ship's little drone, pops out, says hello, takes pictures of " + tg.name + ' and docks again',
    weapons:tg => 'weapons test on ' + tg.name + ' (fictional): rail gun, plasma lance, antimatter pulse · nothing is harmed',
    skim:tg => 'skimming ' + tg.name + "'s cloud tops to refuel", tractor:() => 'tractor beam and drill · a passing rock is held, cored and let go' };
  // what the ship should do at the stop after next (the ship picks its next stop and job ahead of time)
  const forceFrom = i => { const n = PLAN.length, a = PLAN[(i + 1) % n], b = PLAN[(i + 2) % n]; S_.force = { target:b.key, travel:b.by, act:a.act }; };
  // the turn, in the ship's frame (ship radii): from straight above with the needle pointing right (like the concept art) down to the
  // starboard side, then once round (the front, the port side from below, the stern) and up into the chase camera's place.
  // On a tall, narrow screen it stands further back so the whole ship fits across.
  function turnPose(t){
    let phi = 90, el = 89.5, dist = 1.75, look = [0, 0, 0];
    if (t < 3.5) dist = 1.75 - 0.2*smooth(0, 3.5, t);
    else if (t < 7){ const u = smooth(3.5, 7, t); el = 89.5 - 74.5*u; dist = 1.55 + 0.1*u; }
    else if (t < 19){ phi = 90 + 270*smooth(7, 19, t);
      el = 15 + 5*smooth(90, 180, phi) - 48*smooth(180, 270, phi) + 53*smooth(270, 360, phi);
      dist = 1.65 + 0.35*smooth(90, 180, phi) - 0.25*smooth(180, 270, phi) + 0.2*smooth(270, 360, phi); }
    else { const u = smooth(19, TURN_T, t); phi = 360; el = 25 - 10*u; dist = 1.95 + 1.15*u; look = [-0.3*u, 1.5*u, 0]; }
    const fit = Math.max(1, 0.62/tanX), e = el*D, f = phi*D, dir = [-Math.sin(e), -Math.cos(e)*Math.cos(f), Math.cos(e)*Math.sin(f)];
    return { eye:V.mul(dir, dist*(t < 19 ? fit : 1 + (fit - 1)*(1 - smooth(19, TURN_T, t)))), look, up:V.norm(V.sub([-1, 0, 0], V.mul(dir, Math.sin(e)))) };
  }
  // (while the camera circles the ship the info panel steps back to its compact form, so it covers none of the ship; it comes back for the ride,
  // with its chase view / cockpit view button. Not saved: the visitor's own choice stays.)
  function startTurn(){ S_.hold = true; SC.turn = 0; SC.fadeIn = true; SC.fade = 0; shipCam.turn = turnPose(0); shipCam.mode = 'turn'; document.body.classList.add('info-compact'); syncLayout(); updateModeUI(); }
  function endTurn(){ S_.hold = false; SC.turn = -1; SC.fadeIn = false; SC.fade = 0; if (shipCam.mode === 'turn') shipCam.mode = 'chase'; applyInfoState(); updateModeUI(); }
  const setMode = m => { if (shipCam.mode !== m){ shipCam.mode = m; updateModeUI(); } };

  // ---------------------------------------------------------------- the looks review: Saturn (a scan, mostly past by the time the ride starts) → fold → Sgr A*
  // (Pip's probe) → light speed → SGR 1806-20 (a scan) → fold → Saturn. At the start of each visit the stop after next is lined up (NEXT: what
  // the ship picks when it next chooses; it chooses a fold's next stop as it arrives, a light-speed hop's as it turns toward it).
  const LEAD = 3;   // (each Saturn visit starts this many seconds before its pass ends)
  const NEXT = { saturn:{ target:'magnetar', travel:'light', act:'probe' }, sgra:{ target:'saturn', travel:'fold', act:'scan' }, magnetar:{ target:'sgra', travel:'fold', act:'scan' } };
  const toPassEnd = () => { S_.t = Math.max(S_.plan.T - LEAD, 0); };
  // At Sgr A* the chase camera shows the ship side-on while it banks toward the hole, so at the closest point the camera rises for a few seconds
  // to a three-quarter view from above and behind (the hole beyond the ship), where the whole shield and the heart show; then the bridge.
  // (A pose in the ship's frame, blended from wherever the camera is; Pip keeps its spot by the ship meanwhile instead of following the camera.
  // eye: how far it leans away from the hole, back along the ship and up off the deck, and its distance in ship radii; look: how far toward the
  // hole and ahead it aims; up: the needle points up the screen.)
  const ABOVE = { eye:[0.6, -0.5, 2.7, 0.6], look:[0.7, 0.05], up:[0, 1, 0] };
  function toAbove(){
    const R = ship.R0, e = V.mul(M3.applyT(R, shipCam.eye || [0, 0, 0]), 1/ship.rad), f = M3.applyT(R, shipCam.fwd || cam.fwd);
    SC.cam = { t:0, e0:e, l0:V.add(e, V.mul(f, Math.max(V.len(e), 1))), u0:M3.applyT(R, shipCam.up || cam.up) };
    if (PIP.H) PIP.H.c = null;
    shipCam.turn = { eye:e, look:SC.cam.l0, up:SC.cam.u0 }; setMode('turn');
  }
  function abovePose(dt){
    const c = SC.cam, k = smooth(0, 1.6, c.t += dt), fit = Math.max(1, 0.42/tanX), A = ABOVE;   // (on a tall, narrow screen it stands further back)
    // (in the ship's axes: g toward the hole; the camera on the far side of the ship from it and a little behind, looking past the ship toward it)
    const g = M3.applyT(ship.R0, V.norm(V.mul(ship.offset, -1))), e = V.norm(V.add(V.mul(g, -A.eye[0]), [-(A.eye[3] || 0), A.eye[1], 0]));
    const eye = V.mul(e, A.eye[2]*fit), look = V.add(V.mul(g, A.look[0]), [0, A.look[1], 0]), f = V.norm(V.sub(look, eye)), up = V.norm(V.sub(A.up, V.mul(f, V.dot(A.up, f))));
    shipCam.turn = { eye:V.lerp(c.e0, eye, k), look:V.lerp(c.l0, look, k), up:V.norm(V.lerp(c.u0, up, k)) };
  }
  function reviewStart(){
    S_.force = Object.assign({}, NEXT.magnetar); foldVisit(BYKEY.saturn); S_.force = Object.assign({}, NEXT.saturn);
    toPassEnd(); S_.belly = null; S_.viewA = 0; S_.hFrom = null; placeShip(0);
    // (and each later Saturn visit, as the ship comes out of the fold there: endFold calls this before the new pass is first drawn)
    S_.onFoldIn = () => { if (SC.on && S_.target === BYKEY.saturn) toPassEnd(); };
  }
  // the looks' names for the captions: 'fold A (ember wind)', 'Pip A (eye-pod)'
  const named = s => { const p = s.split(' · '); return p.length > 1 ? `${p[0]} (${p[1]})` : s; };
  const nm = tg => tg.label && tg.label.length < tg.name.length && !/^the /.test(tg.name) ? tg.label : tg.name;
  // the shield's work: its power, and what drives it (the pull there is real, the shield made up)
  function shieldBit(){
    const S = S_; if (!shieldLook) return 'no shield';
    if (!(S.load > 0.12 && S.gTg)) return named(SHIELD_NAMES[shieldLook]) + ' at rest';
    return `shield power ${Math.round(S.load*100)}% · ` + (S.load > 0.7 ? 'the heart beats harder to feed it' : `${S.climbK > 0.5 ? 'climbing out of' : 'holding course in'} ${nm(S.gTg)}'s gravity`);
  }
  function reviewCaption(){
    const S = S_, tg = S.target, nx = S.next, fold = named(FOLD_NAMES[foldLook]), bridge = shipCam.mode === 'cockpit' ? 'from the bridge · ' : '';
    if (SC.turn >= 0) return (shieldLook ? named(SHIELD_NAMES[shieldLook]) + ' · at rest' : 'no shield, to compare') + (SC.turn < 4 ? ' · seen from above like the concept art' : ' · from every side (the ship holds still while the camera circles it)');
    const fl = foldLine(); if (fl) return fold + ' · ' + fl;
    if (S.phase === 'fold') return fold + ' · folding space · to ' + nm(nx.tg);
    if (S.phase === 'light') return 'light speed · to ' + S.leg.B.name + ' · a thin sheen on the edges and a star on the needle, no white glow';
    if (S.phase === 'align'){
      if (nx.mode === 'light') return (S.stretch > 0.05 ? 'jumping to light speed' : 'turning toward ' + nm(nx.tg)) + ' · chase view';
      return (S.fk > FLK.SH0 - 0.1 && shieldLook ? 'the shield folds into the heart' : 'the fold drive spools up') + ' · next: ' + fold + ' to ' + nm(nx.tg);
    }
    if (tg === BYKEY.saturn) return 'riding along · chase view · next: ' + fold + ' to ' + nm(nx.tg);
    const hole = isHoleTarget(tg), r = V.len(ship.offset), close = r < S.plan.Rc*1.06 && S.act && S.act.tau > 0;
    const above = shipCam.mode === 'turn' ? 'from above · ' : '';
    let where = hole ? (close ? 'closest point to ' + nm(tg) : bridge || above ? nm(tg) : nm(tg) + ' pass · chase view') : 'at ' + tg.name + (RS_KM[tg.key] ? ', a magnetar' : '');
    if (hole) where = bridge + above + where;
    const pip = PIP.st === 'out' ? ' · ' + named(DRONE_NAMES[droneLook]) + (PIP.kind !== 'near' ? ' is out' : shieldLook ? ' stays inside the shield' : ' stays by the ship') : '';
    return where + ' · ' + shieldBit() + pip;
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
    SC.on = false; S_.hold = false; S_.light = null; S_.onFoldIn = null; SHOWCAP.txt = ''; document.body.classList.remove('showcase'); applyInfoState();
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
    if (SC.turn >= 0){ SC.turn += dt; shipCam.turn = turnPose(SC.turn); if (SC.turn >= TURN_T) endTurn(); }
    // the showcase light fades in for the turn and back to the Sun's after it
    if (SC.fade >= 0){
      SC.fade += dt; const k = smooth(0, SC.fadeIn ? 1 : 2, SC.fade), sunL = M3.applyT(ship.R0, V.norm(V.sub(sun.rel, ship.rel)));
      S_.light = SC.fadeIn ? V.lerp(sunL, LIGHT, k) : V.lerp(LIGHT, sunL, k);
      if (k >= 1){ if (!SC.fadeIn) S_.light = null; SC.fade = -1; }
    }
    if (SC.review){
      // a new visit: line up the stop after next; back at Saturn, circle the ship again (once it has come out of the fold)
      if (S_.visits !== SC.visits){
        SC.visits = S_.visits; const k = S_.target.key;
        if (NEXT[k]) S_.force = Object.assign({}, NEXT[k]);
        if (k === 'saturn'){ SC.loops++; SC.wait = 0.8; }
        SC.part = 'chase'; SC.cam = null;
      }
      if (SC.wait >= 0 && (SC.wait -= dt) < 0){ SC.wait = -1; startTurn(); }
      // at Sgr A*: the chase camera until the ship is nearly at its closest point, the view from above until Pip is back aboard, the bridge until
      // the pass ends, and the chase camera again as the ship turns for light speed (switched only as each part starts: the view button still
      // works in between)
      if (SC.turn < 0 && S_.target === BYKEY.sgra){
        const A = S_.act, u = A && A.kind === 'probe' ? S_.t - A.t0 : -9;
        if (SC.part === 'chase' && S_.phase === 'pass' && u > 0 && V.len(ship.offset) < S_.plan.Rc*1.12){ SC.part = 'above'; toAbove(); }
        else if (SC.part === 'above' && (S_.phase !== 'pass' || u > PT.IN + 0.2)){ SC.part = 'bridge'; SC.cam = null; setMode('cockpit'); }
        else if (SC.part === 'bridge' && S_.phase !== 'pass'){ SC.part = 'leave'; setMode('chase'); }
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

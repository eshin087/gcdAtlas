// ================================================================ the Halo showcase (?showcase=halo): a scripted look at the ship, for reviewing its design.
// The camera circles the ship once (it holds still for that, which it never does on the site), then rides along through one visit of each
// kind: a scan at Saturn, light speed to Jupiter (seen from the bridge) and a skim, light speed to the Moon and a weapons test, light speed
// to Mars and a probe, a fold to the Pillars of Creation and a tractor beam and drill, then a fold back to Saturn and round again.
// A caption names each part. Taking the camera (a drag, the pause button, picking something) ends it and the site carries on as usual.
const SHOWCASE = { on:new URLSearchParams(location.search).get('showcase') === 'halo', t:0, turn:-1, fade:-1, fadeIn:false, visits:-1, wait:-1, loops:0 };
if (SHOWCASE.on){
  const SC = SHOWCASE, D = Math.PI/180, TURN_T = 22, LIGHT = [-0.55, 0.35, 0.6];   // (the light during the turn, in the ship's frame: above, ahead, starboard)
  const PLAN = [{ key:'saturn', act:'scan', by:'fold' }, { key:'jupiter', act:'skim', by:'light' }, { key:'moon', act:'weapons', by:'light' },
    { key:'mars', act:'probe', by:'light' }, { key:'pillars', act:'tractor', by:'fold' }];
  const JOB = { scan:tg => 'sensor scan of ' + tg.name + ' · every beam ends where it meets the surface',
    probe:tg => 'a probe goes out, loops round ' + tg.name + ' taking pictures, and docks again',
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
  function begin(){
    document.body.classList.add('showcase'); hideHint();
    stopTour(false); pauseShow(); tween = null; flyMove = null; flight = null;
    forceFrom(-1); foldVisit(BYKEY.saturn); forceFrom(0); S_.t = 1; SC.visits = S_.visits;
    shipCam.on = true; shipCam.pending = false; shipCam.eye = null; shipCam.zoom = 1; motion.last = 'ship';
    startTurn(); SC.fade = -1; S_.light = LIGHT.slice();   // (the first time, the showcase light is on from the start)
    setInfo(ship.index); updateModeUI();
  }
  function end(){
    SC.on = false; S_.hold = false; S_.light = null; SHOWCAP.txt = ''; document.body.classList.remove('showcase'); applyInfoState();
    toast('showcase over · the camera is yours');
  }
  function caption(){
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

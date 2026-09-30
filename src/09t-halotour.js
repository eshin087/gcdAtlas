// ================================================================ the Halo tour (0.9.6): ride along while the Halo flies the stops of a tour
// (owner, 2026-09-29: a clear button to take the tours with the Halo, in the riding view, with cinematic moves, angles and zooms at every place.)
// The tour is the one picked in the tours list (TOUR_ID, the grand tour until another is picked; picking one while the Halo tour plays
// switches to it). Its stops are the ones the Halo can fly past (haloCan: the places on its own list, SHIP_TARGETS, and any other real place
// at least 80 ship radii (200 km) in radius that is not a craft, a spot on a surface or too big to fly round), from the one the tour is on; a random tour
// gives it a shuffle of its own places. At each stop it stays about a minute (HT.STAY), with one job at most and only at a place on its own
// list, then goes on by light speed or a fold (travelMode). The camera plays the ride's bigger moves (RIDE.epic, 08r-ride.js) and a caption
// names each place as the ship arrives. The green button beside the name sends it on at once; a drag takes the camera (play rides along
// again, the ship flying on meanwhile); the halo switch on tours (0.9.7; on a phone the ship menu), stop riding, a tour, the screensaver or
// picking something else ends it.
const HT_SKIP = new Set(['solarsystem', 'oort', 'universe', 'cosmicweb', 'bootesvoid', 'gw170817', 'gw150914', 'tde', 'sstars', 'm87jet']);
function haloCan(o){
  if (!o || o === ship || o.marker || HT_SKIP.has(o.key)) return false;
  if (SHIP_TARGETS.includes(o.key)) return true;
  if (!tourable(o) || (o.tags && o.tags.includes('human')) || o.rad < 80*ship.rad || o.rad > 3e5) return false;
  // (a spot on a surface, a crater or a landing site, has its bounding sphere inside its world)
  return !(o.parent && surfOf(o.parent) > 0 && V.len(o.offset) < surfOf(o.parent)*1.2);
}
function haloStops(id){
  const t = TOURS.find(t => t.id === id) || TOURS[0];
  if (t.deal || !t.stops.length){ const L = SHIP_TARGETS.map(k => BYKEY[k]).filter(haloCan); for (let i = L.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i + 1)); [L[i], L[j]] = [L[j], L[i]]; } return L; }
  const L = []; for (const s of tourStops(t.id)){ const o = OBJ[s.i]; if (haloCan(o) && !L.includes(o)) L.push(o); }
  return L;
}
const htTour = () => TOURS.find(t => t.id === HT.tourId) || TOURS[0];
function haloTourStart(id = TOUR_ID){
  if (typeof ship === 'undefined' || SHOWCASE.on || RIDE_LAB || !S_.target) return;
  if (SAVER.on) stopSaver();
  let L = haloStops(id);
  if (L.length < 2){ toast('the Halo cannot fly ' + (TOURS.find(t => t.id === id) || TOURS[0]).name + ' · the grand tour instead'); id = 'grand'; L = haloStops(id); }
  if (tour.on) stopTour(false);
  const was = HT.on; Object.assign(HT, { on:true, tourId:id, stops:L, visits:S_.visits, want:null });
  // (from the stop the tour is on, or the place the ship is at, when that is one of them; otherwise the first)
  const k = L.indexOf(S_.target), kt = TOUR_ID === id ? L.indexOf(OBJ[tour.obj]) : -1;
  HT.i = k >= 0 ? k : kt >= 0 ? kt : 0;
  RIDE.epic = true;
  if (k >= 0) htArrive(); else HT.want = L[HT.i];
  if (!shipCam.on && !shipCam.pending) startShipCam('chase');
  else if (!was){ RIDE.queue = rideStill() ? [] : ['reveal', 'pushin']; RIDE.job = null; if (RIDE.wc < 1) nextShot(); }
  toast('the Halo tour · ' + htTour().name + ' · ' + L.length + ' places · ' + (k >= 0 ? 'at ' : 'first ') + L[HT.i].name);
  updateModeUI();
}
function haloTourEnd(quiet){
  if (!HT.on) return;
  HT.on = false; HT.want = null; RIDE.epic = false; RIDE.queue = [];
  if (HT.capT > 0){ HT.capT = 0; SHOWCAP.txt = ''; }
  if (!quiet) toast('Halo tour over · the Halo roams on its own again');
  updateModeUI();
}
// arrived at stop HT.i: its stay (about a minute), at most one job, and where next; the caption names the place
function htArrive(){
  const st = S_.stay, o = HT.stops[HT.i], n = HT.stops.length; if (!st || !o) return;
  st.dur = HT.STAY[0] + (HT.STAY[1] - HT.STAY[0])*Math.random();
  if (!SHIP_TARGETS.includes(o.key)) st.jobs.length = 0; else if (st.jobs.length > 1) st.jobs.length = 1;
  // (a random tour's shuffle is dealt again at its end, so it never loops)
  if (HT.i === n - 1 && htTour().deal){ const L = haloStops(HT.tourId).filter(x => x !== o); L.unshift(o); HT.stops = L; HT.i = 0; }
  const nx = HT.stops[(HT.i + 1) % HT.stops.length];
  S_.next = { tg:nx, mode:travelMode(o, nx) };
  const f0 = o.fact || o.type || '', dot = f0.indexOf('. '), fact = dot > 0 ? f0.slice(0, dot + 1) : f0;   // (its first sentence)
  SHOWCAP.txt = o.name + ' · the Halo tour, ' + (HT.i + 1) + ' of ' + HT.stops.length + (fact ? ' · ' + fact : ''); HT.capT = 11;
}
// where the green button goes: the stop after the one the ship is at, or is on its way to
function htNextStop(){
  if (!HT.on || HT.stops.length < 2) return null;
  const S = S_, going = HT.want || ((S.phase === 'light' || S.phase === 'fold' || (S.phase === 'align' && S.stay && S.stay.leave)) && S.next ? S.next.tg : null);
  const k = going ? HT.stops.indexOf(going) : HT.i;
  return HT.stops[((k < 0 ? HT.i : k) + 1) % HT.stops.length];
}
function haloTourSkip(){
  const o = htNextStop(); if (!o) return;
  HT.want = o; htSeek();
  toast('the Halo tour · on to ' + o.name);
}
// send the ship on to HT.want as soon as it can go (not in light speed or a fold, and not while Pip is still out: leaveNow hurries it home)
function htSeek(){
  const S = S_, w = HT.want; if (!w) return;
  if (S.target === w && S.phase !== 'light' && S.phase !== 'fold'){ HT.want = null; HT.i = HT.stops.indexOf(w); htArrive(); return; }
  if (S.phase === 'light' || S.phase === 'fold' || (S.phase === 'align' && S.next && S.next.tg === w)) return;
  ship.demo.leaveNow(w, travelMode(S.target, w));
}
TICKS.push(dt => {
  if (!HT.on) return;
  // (ended by something else: a tour, the screensaver, the camera locked on something other than the ship)
  if (tour.on || SAVER.on || (!shipCam.on && !shipCam.pending && orbit.lock !== ship.index)){ haloTourEnd(true); return; }
  const S = S_;
  if (S.visits !== HT.visits && S.phase !== 'light' && S.phase !== 'fold'){
    HT.visits = S.visits;
    const k = HT.stops.indexOf(S.target);
    if (HT.want && S.target !== HT.want){ /* passing through on the way: htSeek sends it on */ }
    else if (k >= 0){ HT.want = null; HT.i = k; htArrive(); }
    else HT.want = HT.stops[(HT.i + 1) % HT.stops.length];
  }
  if (HT.want) htSeek();
  if (HT.capT > 0 && (HT.capT -= dt) <= 0) SHOWCAP.txt = '';
  RIDE.epic = true;
});
// the halo switch on tours (0.9.7; the ship menu's item on a phone), and test hooks. Off, it ends the Halo tour and you keep riding
$('#btnHaloSw').addEventListener('click', () => { hideHint(); if (HT.on) haloTourEnd(); else haloTourStart(TOUR_ID); updateModeUI(); });
Object.assign(window.__cosmos, { haloTourStart, haloTourEnd, haloTourSkip, haloStops, haloCan, HT,
  ride:{ RIDE, SHOTS, get shot(){ return RIDE.shot ? RIDE.shot.name : null; }, reach:rideReach, seed:n => { let s = n >>> 0; rideR = () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; }, start:startShot } });

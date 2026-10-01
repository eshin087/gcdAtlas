# Changelog

All notable changes, newest first. Dates are UTC.

## Unreleased

## 0.10.2 · 2026-09-30

**The Halo tour keeps the normal tour's pace** (owner, 2026-09-30: it spent about 2 minutes at each place; "the main point of the halo tour was to mirror the normal tours but in the perspective of halo's 3rd person view with cool scenes, moments (halo dynamically interacting or flying through the objects)"; picked from three each time)
- About 40 s a stop, jump included, like the normal tour (26 to 64 s a stop, 43 on average). It was 67 to 131 s: a stay of about a minute that only ended with a pass, plus loops, a signature move and a job.
- The Halo arrives straight into its move for the place and goes on at the end of that pass: through Saturn's ring gap, through a star's corona, low over the Great Red Spot or Earth's day side, weaving through a nebula. A move that needs a heading of its own (Saturn's ring gap, a ring nebula's hole, a galaxy's disc) arrives by a fold, since a light-speed leg comes in on a fixed line.
- At about one place in three it arrives on a job instead, taking turns: an attack run with Pip's railgun, a scan, a skim to refuel where the place can be skimmed. That stop runs a little longer, and Pip comes out for it.
- Pip comes out on the tour only for a job (a stop is short, and the jump waits for Pip to come home).
- Started at a place where the Halo already is, with little of its pass left, the tour gives it one more pass there first.

**Close and far** (owner: the camera was too often far from the Halo; picked: wide and close take turns, a close-up with the Halo about a third of the screen)
- Four close-ups: beside the ship with the place over its shoulder, from just behind it flying at the place, swinging round it, and a push in from far away. The place still fills the background through the long lens.
- Wide and close take turns: a wide shot as the Halo arrives, its move from close behind the ship (from about 5 s before the move's main moment to 2 s after), then a wide one.
- A horizon shot puts the horizon on the surface itself (a star's photosphere, a planet's globe), not on the glow framed for the whole place: on a corona pass the star was 40 degrees below the view.

**The Halo indicator** (owner: the square with "halo" and its distance)
- Hidden during the Halo tour, with its arrow at the screen's edge.

**Checked**
- Motion test: on the Halo tour from Saturn, stops of 30 to 50 s on average and none over 70, moves on arrival and at least one job; the place framed first in 85% of the samples or more, the ship in the picture, and bigger than the place in 5% of the samples at most (close-ups).
- Measured on the test's route: 36 to 51 s a stop, 40 on average; an attack run at the Pillars, a skim at Betelgeuse, a scan at Eta Carinae.

## 0.10.0 · 2026-09-30

**Watching a launch: one take from space to the pad** (owner: picking a rocket, the camera zoomed in at weird angles, under the Earth or behind a rock, clipped, and some transitions were abrupt)
- Picking a rocket flies straight there (no detour past anything else) and comes down from space onto the pad: over the flight the view turns, never fast, to look straight down on the site, then tilts to the countdown's first angle as it descends. The picture's up is carried along and rolled evenly. It takes at least 9 s (6 s on quick travel). Setting off far away, it heads for where the pad will be once it is day; from the space station it goes round the Earth, not through it.
- It never goes underground, never looks at the pad through the Earth, and keeps a twentieth of its distance clear of the ground; checked frame by frame from Earth, the Moon, Saturn, Andromeda, the Sun and the station at both travel speeds (at most 3.6 degrees of turn a frame on the cinematic setting).
- During a flight no shot change jolts: a chase-plane view before each camera on a hull (the move from the ground went 2 km in 4 s and swung 120 degrees in one frame); the station's camera moves with the station; the picture never flips over (its up turns at most 90 degrees a second); a blend turns at most 100 degrees a second. Checked for all four flights: at most 4.5 degrees of turn and 4.8 of roll a frame.
- Cameras near the ground stand at least 2.5 m above whatever is under them and see over dunes, hangars and berms to what they film (a Falcon Heavy camera passed 2 m into a berm).
- The countdown's aerial view starts high over the pad, where the descent ends, and glides down.

**The launch you can hear and feel** (owner: more effects, like the smoke, vibration and pressure of a real launch, and a cool rocket sound)
- Sound: a deep rumble, the roar and the crackle of a big rocket's exhaust. It comes from each burning stage as it was when the sound left it, at 343 m/s, so from the far cameras the roar arrives seconds after the flame; it fades with distance and thinner air, and there is none in near-vacuum, except on a camera fixed to a hull, where the structure carries a muffled roar. The music dips under it (owner's choice). It plays when the sound is on.
- The camera shakes near the pad, up to about half a degree, 10 to 20 times a second with a slower sway, and buzzes on a hull. None for people who ask their computer for reduced motion.
- The ground cloud billows out to about 500 m round Starbase's pad and rises to about 170 m, its lobes rolling outward, brighter on its sunward side; at ignition a ring of dust and spray races out from the pad.
- A smoke column rises from the pad to about 14 km behind the rocket, widening, fading over a couple of minutes and drifting with the real wind at its height.
- A vapour cone forms round the rocket near the speed of sound, below about 13 km.
- The cameras by the pad at liftoff stand 410 and 630 m out (Falcon's about 320 m). They stood 40 to 120 m out, where the new ground cloud swallowed them within seconds and the picture turned to grey fog. Now the rocket rises out of the cloud in view.

**Real skies and weather** (owner: a more beautiful sky with dynamic clouds and realistic weather; picked: real weather)
- A new function, /api/weather, gets the weather over the three launch sites from Open-Meteo, hour by hour from three days ago to two days ahead: cloud cover low, mid and high, wind at 10 m and at about 1.5 km, visibility, rain and humidity. It uses the pads' coordinates only.
- Three cloud layers from it: low cumulus (or flat stratus when the sky is nearly covered), their base worked out from the humidity, with bright sunlit tops and grey undersides; altocumulus puffs at 4.5 km; cirrus streaks along the wind at 9 km. They drift with the wind at the flight's pace and slowly change shape, cast shadows that move over the ground, and a rocket climbing through the deck fades into it.
- The haze follows the real visibility. The sky is a richer blue, gold round a low Sun, with the Earth's shadow and the pink band above it at dusk and dawn.
- Without the weather (offline, the artifact page) a fair day with a few clouds.
- Dawn and dusk are brighter near the ground: the light is full once the Sun is 12 degrees up (it was 20), as a camera's exposure would follow it. A launch soon after sunrise came out murky.

**Starbase as it is now**
- The ground round Starbase's pads is from NOAA's aerial photos of 18 January 2026 (0.3 m a pixel), with the finished Pad 2, the tank farm and the new buildings; USDA's October 2024 photos fill what NOAA did not fly, their colours shifted to match NOAA's (the difference measured round each patch and spread smoothly into it: the autumn fill stood out as green, yellow and teal squares). The 2022 photo showed marsh where Pad 2 now stands. NOAA flies at an angle, so the photo's towers lean across the ground like long shadows; the page's own towers stand at the pads.
- OpenStreetMap entries that do not belong in a height map are left out: an underground flame trench mapped with its tower's height, and lattice towers that turned into blocks floating in the sky.

**Starman's Roadster** (owner: it looked bad; make a high quality replica)
- A new model of the 2008 Tesla Roadster at its published size: 3.95 m long, 1.85 m wide, 2.35 m between the axles. It has the bonnet between the front wings, the wing crests, haunches over the rear wheels, the intakes behind the doors, teardrop headlights, mirrors on stalks, the black roll hoop and ten-spoke wheels.
- Starman sits in the left seat, right hand on the wheel and left arm on the door, as in SpaceX's photos. His suit is white with black shoulders, knees, gloves and boots, and his visor is dark.
- A soft fill light from above keeps the shaded side readable. In space that side would be nearly black: `docs/ACCURACY.md` says so.
- The first angle is closer and lower, and the second looks over Starman's left shoulder. On a phone held upright both stand back until the car fits across the screen.
- The shader compiles in about 0.4 s on Direct3D (0.7 s before).

**Under the hood**
- `frel` gives the exact position when the focus circles the object (the ground moved thousands of kilometres a frame, seen from the station while the clock jumped).
- The ground and sky shader compiles in 0.6 s on Direct3D, the rockets' in 1.0 and 1.2 s (in the background while the camera flies in).

## 0.9.12 · 2026-09-30

Built as 0.9.10 (PR #38); renumbered 0.9.12 when 0.9.11 (PR #36) merged first and was brought in.

**The Halo tour shows the places** (owner, 2026-09-30: "the tour object should be the main focus of almost every shot and halo is more a bonus cool addon")
- The Halo tour has shots of its own. Each frames the place first, through a long lens: the camera sits a few hundred to a few thousand km behind the ship, so the place fills a set share of the view (from all of it with room round it, to more than the view) and the Halo sits small in front of it, a few percent of the view. Up close to a planet or a star the place becomes a horizon across the lower part of the view, with the ship above it.
- Seven shots and one for each job: the place whole as the ship arrives, the ship crossing in front of it, the place filling the view, the ship nearer with the place big beside it, over the horizon from the side and from behind, and a long way off with the ship a glint. The scan shows its hologram on the place, the weapons test is seen from behind the ship as it runs in, the skim and the signature moves over the horizon.
- The lens eases in and out: riding starts with the plain view and zooms in while the camera backs away, so the ship keeps its size and the place grows. Between places (light speed, the fold) the camera goes back to the view behind the ship, as before.
- Before, the ride camera sat a few ship lengths from the Halo: the ship covered 10 to 50% of the view and the place 0.2 to 3% (the Halo roams 8 to 20 radii out for most of a stay, and round a star 50 radii out, outside its glow). On the test's route (Saturn, Alpha Centauri, Betelgeuse) the place now covers 17 to 44% of the view on average in each kind of shot and the ship under 1% (the first seconds at a new place, while the camera comes out of the view behind the ship, 6%).
- A click on the Halo during the Halo tour rides along again with these shots. It used to switch to the ship's own angles, which trail it: the place was behind the camera about 90% of the time.
- The shots keep a steady roll while the ship turns and loops, and the ship can pass right over the place's centre without the picture turning. Before the ship leaves a place, the swing into the view behind it starts in the last 6 s of the stay and runs slower (the turn before a light-speed hop is often only 3 s).
- On a phone the picture's shift into the free space above the card follows the lens (it lagged the zoom, and at 40 times it put Alpha Centauri off the screen).
- Pip's show is left out of the Halo tour's jobs, and the ride camera's close-ups of Pip too: in these shots Pip would be a speck. Riding along without the tour is unchanged.

**Places show whatever the camera is locked on**
- Some places change their look with the camera's distance: the Crab Nebula fades round its pulsar, the Galactic Centre round Sgr A*, the Carina, Veil, Tarantula and Lagoon nebulae round the stars inside them, orbit lines and belts come and go, readouts switch to their close-up lines. They went by the distance to what the camera is locked on, which riding along is the ship itself, a few hundred km away: every such place took its closest form, the Crab Nebula faded to 4% and Saturn's readout said the camera was inside its rings. With the Halo they now go by the camera's distance to the place the ship is visiting (`viewDist`).

**Fixes**
- After you stop riding, Pip is no longer held to its calm bits: the ride camera's close-up of it was left half faded in, and it also changed when Pip came home and so when the ship jumped.
- On the Halo tour Pip acts as when no one rides along while the tour's shots have the camera (they sit 15 to over 2,000 ship lengths away): it faced and waved at the camera only within 80, and each crossing in the middle of a bit made it jump.
- The Halo tour's stay lengths draw from the ride camera's dice, so the motion test flies the same tour on every run (a check failed now and then).

**Checked**
- Pip smoothness test: the Halo tour's camera at most 66 degrees a second on a desk and a phone, no cuts.
- Motion test: on the Halo tour from Saturn, at a place (a pass or a loop), the place's disc covers at least 4% of the view or is 3 times the ship's size in 85% of the samples or more, the ship stays in the picture and is never bigger than the place, and a click on the ship rides along again.

## 0.9.11 · 2026-09-30

Built beside 0.9.10 (the Halo tour's camera, in review at the same time); whichever merges second renumbers.

**Sharing and credit** (owner, 2026-09-30: make the site easier to share and say who made it, without anything personal)
- Link previews: a shared link shows a 1200 x 630 picture (M87* at its third angle, with "gcdatlas", "the real universe, drawn in ASCII" and gcdatlas.com) in chats, X, Discord and the like. New meta tags: `og:image` (with size and alt text), `og:site_name`, `twitter:card` (large image) and its title, description and image. `tools/og-image.mjs` (`npm run og`) renders candidates on the GPU into tests/out/og/ and writes the chosen one to assets/og.jpg; build.mjs copies it to dist/og.jpg.
- The site's address is gcdatlas.com: the canonical link, `og:url` and the preview point there (gcdatlas.vercel.app still works).
- Photo mode signs its pictures and its copied text gcdatlas.com (was gcdatlas.vercel.app).
- Help's last line: what's new · made by GCD · the code on GitHub · your settings, location and progress stay on your device. What's new ends with "Made by GCD; the code is on GitHub."

## 0.9.9 · 2026-09-30

Built as 0.9.7 (PR #34); renumbered 0.9.9 when 0.9.8 (SpaceX, PR #29) was merged first and brought in.

**The info panel** (owner, 2026-09-29)
- The grey angle line ("‹ angle 1/4 [#####-----] ›", "en route", the Halo tour's stop) now sits right under the name, not at the bottom of the info panel, on a desk and on the phone card.
- The "halo tour" button is gone. Right of a plain "▸ tours" button is a switch labelled "Halo tour" (owner, round 2: "a typical toggle that is intuitive"): a grey track with the knob on the left when off, a glowing Halo blue track with the knob on the right when on. On, it flies the tour you picked with the Halo; while it is on, the list of tours says "flown by the Halo" and picking a tour starts it with the Halo. Space and Enter flip it, and the knob does not slide with reduced motion.
- On a phone the ship menu's Halo tour item has the same switch, and the list of tours has one at its top.
- To make room on the desk's top row, ship and ride moved to the lower row beside play (the ride camera switch joins them while riding), and the top bar leaves 400 px on its left (was 440).
- On the Halo tour the info panel shows the place, not the ship: its name, fact and numbers, with one blue line over the name saying what the ship is doing ("with the Halo · a wide pass round Saturn") or where it is going ("→ Jupiter · light speed"). It moves on to the next stop as soon as the ship sets course, and back to the Halo when the tour ends. The ruler, share, compare size and the seen marks follow the place; flyby is hidden.
- On a phone the Halo's "out of light speed" toast no longer sits on the Halo tour's caption.

**Pip is out for most of every stay** (owner: it rarely came out; "make the viewer love Pip")
- Pip comes out a few seconds after the Halo arrives somewhere and stays out until the stay is nearly over; it flies home as embers before the ship jumps, and the jump waits for it.
- Between things to do it flies alongside the bow, looking round. Its bits: peekaboo (it glides in from the right edge of your view and back out, twice, with hops and a giggle), riding along beside you (a close-up of its face, glancing at the place and back at you), sitting on the bow in the wind, chasing a spark that drifts off the ship's heart and putting it back, a happy twirl, and its four old outings (a hull check, the engines, photos and a wave, play). Never the same one twice running. (A heart it drew in the air was removed in review.)
- It helps with every job: it gathers the scan's readings (motes of light rising to it from the body), braces at the bow scoop through a skim, and is the heart of the railgun (below). Its show (the old outing) is still a job now and then, with the cameras turned to it.
- Pip is a third bigger (0.08 of the ship's radius, about 200 m across), so it shows beside the ship.
- The ride camera now and then gives Pip a close-up for 8 to 12 s, slow and smooth: only while Pip does something calm near the ship, gliding in and out over about 2.5 s and following it gently, the ship and the place still in view. Its lines show in the readout.
- Everything Pip does is smooth (owner, round 2: abrupt cuts on the Halo tour, peekaboo and the photo "teleporting"): flights are paced to their length at an easy speed and kept clear of the hull, flights to a spot by the camera land exactly on it as it moves, a move cut short no longer snaps, and Pip's body turns through two easings.
- The cameras on the Halo no longer lurch: locked on, when a job ends, as a pass starts or before a jump; riding along, between shots (longer for a big change of distance, such as from the Halo tour's pull-back), into and out of the view behind the ship, with no sudden roll.

**The weapons test: Pip's railgun, on an attack run** (owner: the 0.9.4 ring gun "spawns meh and unnatural"; round 2: the first cannon fired "at a random unnatural angle"; picked from three each time)
- The weapons pass is an attack run, like a fighter strafing: the Halo comes in on a straight line with its nose on the body, fires straight along its heading, then pulls up and climbs away. By a black hole it keeps its usual distance.
- Pip settles on top of the needle near its tip and winks, and stays itself as the gun's heart while it unfolds round it like a transforming toy: plates swing down and clamp round the needle, two rails telescope forward past the tip segment by segment, prongs flip in at their ends, each locking with a spark. Light runs from the heart down the hull into it.
- Three rail slugs, each a white point too fast to follow with a straight streak behind it and a cone of light at the muzzle, and a flash, sparks and a glowing crater where it hits; then a charged big shot (lightning crackling between the rails, Pip's eyes narrowing) with a longer, thicker streak and two shock rings. The rails and Pip kick back with each shot; the rails vent, glow hot and cool, fold away the same steps backward, and Pip twirls.
- The craters cool from white to orange to red and dark, and are gone within 7 s. By a black hole the shots fall in: they redden, stretch and fade at the shadow's edge, and a faint ring of light runs out from it (the owner's 2026-09-27 request). Nothing is ever drawn inside the shadow.
- Replaces the 0.9.4 ring gun and its three shots (fold lance, singularity round, time echo).

**A signature move at every kind of place** (owner: "make halo do cool manuevers and movement based on the object")
- Once a stay, on its second pass, the Halo flies a move made for the place, easing to half speed round its best moment, with a ride camera shot low behind it and a line in the readout:
  - Saturn: through the Cassini Division, the gap in its rings.
  - Jupiter, Mars, the Moon, Io: low over the Great Red Spot, Valles Marineris, Tycho and Pele (when they are on the day side); Earth, Titan, Europa, Ceres: low over the day side (over Earth about as high as the space station).
  - Stars: through the corona. Galaxies: an arc inside the disc, among the arms. Ring nebulae: along the axis through the hole, beside the central star. Other nebulae, remnants and star clusters: a weave through the middle. Halley: through its tail when it has one, else close by the nucleus.
  - Black holes, the magnetar and quasars keep their distance.
- A place with a move has one job at most, on the third pass, so the stay stays about two minutes.

**The engines** (owner: the trail "looks like some kind of water", then the rings "look like bubbles")
- A short blue ion flame: a white-hot core in a flickering blue cone, and a glow in the nozzle. It is longer and brighter the harder the engines work (speed, hard turns, the fold drive spooling up), a long white streak at light speed. About a tenth of the ship long cruising, never under a few characters on screen, so a far ship still shows it is moving.

**The lab** (`/lab`)
- New buttons for each of Pip's bits, an engines camera and a Pip camera (the ride camera's close-up). For a weapons test the parked ship turns its nose onto the place, and the aim camera looks along its heading.

**Checked**
- Motion test: Pip is out for most of a stay at Mars (167 of 176 s on the test's route), in the picture, doing several bits with several faces, never inside the hull, below the surface or more than 3.2 ship radii out, home as embers before the jump; called home early it is back within 1.7 s and sad; an attack run on the Moon unfolds the railgun fully, fires 3 slugs and a big shot within 1 degree of the heading, leaves 4 craters and nothing after; at Sgr A* an attack run's shots fall in and nothing is drawn in its shadow; stays with a signature move last 114 to 152 s on the test's route. The ride camera's close-up keeps the ship and the place in view.
- New test, tests/pipsmooth.mjs (in `npm test`, `npm run test:pip`): Pip and the Halo's cameras every tick, over every bit, launch and way home, a hurry, every job (the weapons test on an attack run), whole stays and 240 s of the Halo tour, riding and locked on, on a desk and a phone. It fails on a screen step over 40 px in a frame, Pip over 2.2 ship radii/s or 20 ship radii/s², its body over 900 degrees/s, or the camera over 110 degrees/s or its turn changing by over 600 degrees/s². This release's first build had 251 such events; now 0.
- Smoke test: the Halo tour switch sits right after tours on the same row, is a real switch (role, name, pill size), starts and ends the Halo tour, slides its knob (not with reduced motion), answers Space and Enter; the note shows; the top row is one line at 1280 px; the Halo tour's panel shows the place. Phone test: the angle line sits under the name, the card shows the place on the Halo tour, and the ship menu's and the list of tours' switches work.

## 0.9.8 · 2026-09-29

Built on the desktop as 0.9.5 (PR #29) while 0.9.4 and 0.9.6 were being made; renumbered 0.9.8 when it was brought up to date with them (0.9.7 was taken on the desktop).

**SpaceX launches and Starman's Roadster**
- Starman and the Tesla Roadster, where they really are right now: the cherry-red car with Starman at the wheel, still fixed to the Falcon Heavy upper stage that carried it in 2018. The position comes from NASA JPL's own tracking (JPL Horizons, solution 11). The readout gives its distance from Earth and from the Sun, its speed, the laps of the Sun it has made, how far it has flown, and its next predicted close pass (Mars, 22 April 2035, 2.4 million km). One angle pulls back until its whole orbit round the Sun is in view.
- Four SpaceX rockets stand on their real pads, in the atlas under human-made: Starship on the launch mount beside its tower at Starbase, Texas (Pad 2); Falcon 9 at Cape Canaveral; Falcon Heavy at Kennedy; Crew Dragon docked at the International Space Station.
- Pick one and it launches. The camera flies down to the pad in one move, a 20-second countdown starts with a view from the air that glides in to the rocket, and the whole flight plays with a moving camera: liftoff in a cloud of exhaust and steam, a tracking camera miles away, a camera on the booster's side looking down at the ground falling away, max Q, stage separation up close, the boosters turning back, and the landings.
- Starship: 33 engines, hot staging, the booster flying back to Texas and caught by the tower's chopstick arms, the ship burning on toward orbit. Falcon 9: the booster lands on a droneship at sea. Falcon Heavy: both side boosters land back at Cape Canaveral seconds apart, as on its first flight in 2018, and the centre core on a droneship. Crew Dragon: launch, separation from the second stage, then, about a day later, the approach to the space station, holding about 220 m and 20 m out, and docking.
- Real SpaceX launches play at their real time from their real pad, from the same launch schedule the atlas already shows. A caption with a watch button appears 20 minutes before liftoff, on any page, and you can join a flight already on its way.
- Now and then, while you look at Earth, an illustrative replay lifts off from a pad on the side you can see, in daylight: a glowing trail from orbit, and a caption with a watch button.
- A link to a rocket (for example gcdatlas.vercel.app/#o=starship) starts its countdown when it opens.
- The small illustrative ascents that used to rise from the launch pads are gone.

**The ground round the launch sites is real** (owner, after the first look: the Earth there should look real, "the point is to be impressed at the earth detail")
- Starbase, Cape Canaveral with Kennedy, and Vandenberg are drawn from real images and heights: USGS aerial photos round the pads (0.3 m a pixel at the Cape, flown 9 January 2023; 0.6 m at Starbase, flown 10 June 2022), Copernicus Sentinel-2 satellite images (10 m, clear scenes from 2025 and 2026) for regions 410 km across and for Vandenberg, the ground's height from the AWS Terrain Tiles (USGS 3DEP elevation in the United States), and about 2,300 buildings from OpenStreetMap.
- Near the ground the heights are ray-marched: the Vehicle Assembly Building, hangars, the tank farms and Vandenberg's hills stand up and cast shadows in the afternoon Sun. Water mirrors the sky and glints; the open sea is one colour (satellite passes from different days showed seams there). From higher up the images lie on the curve of the Earth, and from space the same images show on Earth round the sites, blending into the painted globe with no square edge.
- The images are files next to the page (3.1 MB in 14 WebP images), never part of it: a site's regional image loads when the camera heads there from a few thousand kilometres away, the fine ones within a few kilometres (all of a site's at once when a rocket there is picked), and they are let go of two minutes after the camera leaves. The page's first load is the same as before. Offline and in the artifact page the ground keeps its sketch.
- The readout credits the sources while they show (the licences ask for it): "USGS aerial photos · contains modified Copernicus Sentinel data 2025 to 2026 · buildings © OpenStreetMap contributors".
- `tools/earth-detail.mjs` makes the images (cached, so adding a site only fetches what is new); see `docs/ACCURACY.md` for how accurate and how recent each part is.

**Watching a launch, round 2** (owner: the transitions were abrupt, the flights too long, the galaxies showed from the pad, and launches happened at night)
- No more cuts. Picking a rocket flies the camera straight into the first shot, and the launch camera takes over from exactly there. Every change of shot is a glide of about 3 s: the aim slides, the camera swings round, the distance and the zoom ease, and it widens on the way when the two subjects are far apart. Two ground cameras travel along the ground from one to the other; into or out of the camera on a booster's side the view swings round the booster. On the way it never goes below the ground or through a rocket or the core of a plume (checked for all four flights).
- Clicked flights and replays are flown by day: the atlas clock eases over a few seconds to the nearest afternoon at the pad (the Sun about 35 degrees up). Before, a flight played at whatever time the atlas showed, often night at the pads. Live launches keep the real time, at night if they are at night.
- The air hides the deep sky: near the ground, galaxies, nebulae and far stars fade out with their labels, the star field dims, and the sky is blue by day. They come back above about 90 km. Your sky (the planetarium) keeps the whole sky.
- About 3 minutes a flight, countdown included (Starship 172 s, Falcon 9 173 s, Falcon Heavy 175 s, Crew Dragon 200 s; they were 244, 224, 249 and 429 s): the quiet parts go faster. While you watch, the caption's "real speed" button plays every second as it happened (a Starship flight is about 9 minutes), and "highlights" switches back. It is remembered.
- New shots: the aerial view of the place during the countdown; on the booster's side, fixed to its sunlit half, looking down along the hull at the coast falling away (Starship, Falcon 9, Crew Dragon, and a Falcon Heavy side booster); the catch seen from the sunlit side, and the ship from above with the Earth behind it.

**Speed**
- Earth's shader with the images is a second copy, compiled in the background the first time the camera nears a site (0.4 s on Direct3D); the one drawn at start-up compiles as fast as before (0.3 s).
- Near the ground, Earth's own volume is not drawn under the ground and sky that cover it (it cost as much again), and the ground's ray march starts at the height of the highest roof near the site: an aerial view costs half what it did, less than a close view of the Sun.

**Under the hood**
- `build.mjs` fails when two files define a top-level function with the same name: the ride camera's `shotPose` (0.9.6) had silently replaced the launch camera's, and the flight to a rocket came out as not-a-number.

## 0.9.6 · 2026-09-29

Built on the MacBook, on top of 0.9.4 (see `docs/SYNC.md`). Numbered 0.9.6 because 0.9.5 (SpaceX launches) was already open.

**Riding along: the place in view** (owner: straight behind the ship the view missed the planet or star it was near, and a camera that never moves is dull)
- Riding the Halo, the camera now sits on the far side of the ship from the place it is visiting, so the ship is in front and the planet, star, nebula or galaxy fills the view behind and below it. How far it tips follows the place's size on screen, so a near planet fills the lower half of the view and a far one sits under the ship.
- It moves by itself: seven shots (over the shoulder, beside it, the front quarter, high with a roll, low along the horizon, wide, a slow orbit), each drifting round or dollying in or out, a new one every 10 to 18 s, gliding there in about 4 s. It keeps to the ship's side and front quarters: from straight behind, its needle points up the screen and it seems to climb.
- While the ship works (a scan, the fold cannon, a skim) the camera moves to a shot made for the job and holds it until it is done. During Pip's half-minute outings it keeps moving, with close shots only.
- Between places (light speed, the fold) and for the last seconds before a jump it blends back into the old chase view behind the ship, which the streaks and the fold are made for.
- **Still camera**: the camera switch (moving / still) appears next to travel while you ride, in settings, and in the phone's ship menu; K switches too. Still holds one angle over the ship's shoulder, the place still in view. It is remembered, and it starts still for people whose computer asks for reduced motion.
- On a phone the shot fits the space above the card.
- The ride button keeps its word and lights up while you ride ("riding" was wider and pushed the ? button onto a row of its own at 1280 x 800). The chase view is called the outside view now.

**The Halo tour**
- A new "halo tour" button beside play (on a phone, in the ship menu). You ride along while the Halo flies the stops of the tour picked in tours, from the one the tour is on, or from where the ship is if that is a stop. Pick another tour while it plays and it switches.
- It visits the places on its own list and any other real place at least 400 km across that is not a craft or a spot on a surface, and not too big to fly round (the grand tour: 26 places; life of a star: 17). A random tour gives it a shuffle of its places, dealt again at the end.
- About a minute at each place, one job at most, then light speed or a fold to the next. The camera plays bigger moves: on arrival it pulls back until the whole place fits the view (or the ship is a speck), then pushes back in; sweeps round the ship, a crane over it, a low pass along the horizon, a charge toward the camera.
- A caption names each place as the ship arrives, with the first sentence of its fact. The card says "stop 5 / 26 · HALO TOUR · GRAND TOUR", the angle line shows how long the ship stays ("Saturn · 5/26 [#####-----]"), and the green button says "next stop · Alpha Centauri" and sends it on at once.
- A drag takes the camera and play rides along again (the ship flies on meanwhile). The button again, stop riding, a tour, the screensaver or picking something else ends it.

**Fixes**
- Riding along from far away (the observable universe, the cosmic web) no longer loses the ship. The flight up to it aimed at a point worked out as the difference of two numbers millions of light-years across, which rounding put thousands of kilometres off the 2.5 km ship: it sat 50 to 60 degrees off the view, its marker jumping at the edge of the screen, until it popped into place on the last frame. The flight now measures the point back from its end of the trip, and switches to working relative to the ship sooner when the place it set off from is that far away.
- In the screensaver the angle line ("angle 2/4 [#####-----]") moves under the place's name, and back into the info panel when it ends.

**Checked**
- Motion test, new section 5b: riding from the observable universe to the Halo at Andromeda keeps the ship within 30 degrees of the middle of the view all the way (it was up to 60); 70 s of the moving camera at Saturn and at Earth keep the ship on the screen and the place's edge in the view every frame, with 3 shots or more; the still camera keeps one; the Halo tour flies the grand tour from Saturn stop by stop, naming each place.
- Phone test: the ship menu's Halo tour and camera switch.

## 0.9.4 · 2026-09-29

**A softer bass, and songs to review**
- The music's bass is much softer. The bass line and the kick drum sit under the music instead of booming over it (bass lines 6 to 11 dB softer against the rest, kicks 6 to 10 dB softer, their click kept so the beat still punches), and the tunes are 2 to 4 dB louder.
- Ambient piano no longer holds a low hum under every chord; its left hand gives the low end, and its busier right hands are a little softer so the tune stands out. Ambient keeps only a faint low note that fades in over up to 4 s.
- Every song now has at most 11.5 dB more energy below 160 Hz than in the middle of the sound (400 to 2,500 Hz); it was 11 to 21 dB. The calm songs are at 5 dB or less. Lullaby for Io went from 21 dB to 3.5 dB.
- Songs keep their notes: only the balance changed, so every song is still the same song.
- On speakers the music is about as loud as before (1.4 dB louder above 200 Hz); on headphones it is about 4 dB quieter overall, because the boom is gone.
- For the owner: a review page, /songs, with the radio's 15 songs (rebalanced) and 16 new ones picked by measurement (clear, repeating tunes; mostly lofi and downtempo). Play one, jump anywhere in it, mark keep, drop or not sure, and copy the picks as text. The radio keeps playing its 15 songs until the picks are in. The page is kept out of search.
- The music test now matches loudness above 200 Hz (what every speaker plays), lets calm songs have a lighter low end, and checks every song's bass balance.

**What's new, and a shorter help**
- A "new" button beside ? opens the patch notes: every version, newest first, each with a short title and a few lines. The newest is open; tap any other to open it. A small dot on the button means there is a version you have not seen yet (on your first visit there is nothing to catch up on). The full changelog is one link away.
- On a phone, what's new is in settings and in help, and a dot on the dock's settings button shows when there is something new.
- Help is short: three columns (look, go, more) that fit a 1280 x 800 screen without scrolling. Keys only show when you have a mouse, gestures only on a touch screen.

**Riding the Halo on a phone**
- The ship button in the dock opens a small menu over the dock: ride along, cockpit, and show or hide the marker. While you ride, the button says "riding" and the menu offers the chase view, the cockpit and stop riding. A tap anywhere else closes it. On a desk nothing changes: ship shows the marker, ride rides along.

**The Halo: a visible thrust and a fold cannon** (the ship is made up)
- The Halo's engines leave a glowing trail behind the ship: white at the nozzle, then ice blue, then deep blue, flickering a little and bending into turns. It is a few characters long even from far away, so you can tell the ship is moving, longer and brighter the faster it flies, and a long streak at light speed. It hides behind the hull and the body, and goes with the engines in a fold.
- A new weapons test: a fold cannon. Three rings build themselves from embers in front of the needle, white-hot pieces streaming off the bow and locking into place, then spin up while space ripples round them. Before each shot the rings glow and light spirals into the muzzle; it kicks back as it fires.
- It fires three shots. A fold lance: a jagged white-blue crack tears through space to the target, light bleeding from its bends, then seals from the gun end. A singularity round: a black ball in a violet ring flies in, pulls light and debris inward while the ground darkens, then blooms out in violet petals. A time echo: a gold bolt leaves ghost echoes along its path, the blast plays, stutters and runs backward until the surface heals, and the bolt flies back into the gun.
- Then the cannon breaks up and streams back into the bow. The job still lasts 11.5 s and the route is unchanged. The rail gun, plasma lance and antimatter pulse are gone.
- Blasts are made of embers about one character each, never a white ball. Round each hit space darkens a little, so the effects read over a bright planet or a black hole's disc. No shot ever shows inside a black hole's shadow.
- The readout stays honest: "weapons test (fictional) · time echo on Saturn", then "nothing real is harmed: the blast runs backward and the surface heals".
- The lab (/lab) has an aim camera that looks over the cannon at where it fires, and the showcase (?showcase=halo) now includes a weapons test at Saturn.

**Planets up close**
- Planets and moons are easier to make out close up: their markings sit at their real places, the light stays even across the lit side, and there is a clear line between day and night. The contrast is stronger than in reality, so the markings read as characters (docs/ACCURACY.md says so).
- Mars shows Syrtis Major and its other dark markings, bright Hellas and Argyre, Olympus Mons, the Tharsis volcanoes, Valles Marineris and both polar caps.
- Mercury shows its craters, bright ray craters such as Hokusai and Debussy, and the 1,550 km Caloris basin.
- The Moon shows its seas where they really are, rayed craters such as Tycho and Copernicus, and the rings of the Orientale basin.
- Jupiter's belts are darker and redder, and the Great Red Spot is drawn about 16,000 km wide, close to its size today.
- Saturn's bands follow Cassini's pictures, and its first view looks at the side of the rings the Sun lights (in 2026, from the south), so the rings are bright.
- Venus shows the dark Y and cloud chevrons seen in ultraviolet photos; its readout says the eye sees a plain planet.
- Uranus and Pluto, tipped on their sides, now show their sunlit pole; Uranus's view back at the Sun works again.
- Neptune's dark spot and white clouds, Pluto's heart and its thin blue haze, and the big moons (Io, Europa, Ganymede, Callisto, Titan, Enceladus, Ceres) are clearer.
- Each kind of body now has a shader of its own, which compiles in 0.06 to 0.32 s instead of one shared shader that would have taken 11 s with the new surfaces.

**Auto detail**
- Detail has a new first choice, auto, and it is the default. It starts on fine and steps up to ultra after about 5 smooth seconds where ultra's characters are still at least 6 pixels wide (a sharp, high-density screen). On an ordinary screen ultra's characters are 4 x 7 pixels, too small to read as letters, so auto stays on fine there. After 3 slow seconds it steps back to fine; after two steps back it stops trying and remembers that on this device for 14 days.
- Ultra draws about 1.6 times the characters of fine, and every one of them is ray-marched, so a frame costs about 60% more on the graphics card. That is why fine was the default.
- If you picked a detail other than fine before, it stays as you set it. V now steps through auto, ultra, fine, normal and bold.

## 0.9.3 · 2026-09-28

**Search by catalogue number**
- Search finds places by their Messier, NGC or IC number: M31, NGC 224, "m 42", "Messier 42" or ngc1952, in any case, with or without spaces. A number finds only that number, so M4 never finds M42 or M45. The place with that number comes first: M87 before its jet and M87*.
- Every place in the atlas that has one of these numbers now has it, such as M31 and NGC 224 for Andromeda, M42 and NGC 1976 for the Orion Nebula, and M1 and NGC 1952 for the Crab Nebula.

**Music**
- The song "Lullaby for Proxima b" is gone (owner's choice), so the radio has 15 songs.

**The Halo roams, folds more slowly, and its shield is subtler** (the ship is made up)
- It stays at each place for about two minutes and roams round it: three or so slow passes from different sides (low, wide, over a pole, over the day side, along the line between day and night), with a wide U-turn out and back between them. Every turn is gentle, at most its usual rate.
- One or two jobs at each place, a loop apart, never the same kind twice in a row, and none on the first pass: the ship arrives and looks round first. On plain passes the cameras turn toward the body too, so it stays in view.
- It mostly hops to places nearby at light speed. It folds space only for the long trips, so it teleports every few stops instead of every half minute.
- The readout says what each pass is, and only when that is true: "passing over Saturn's north pole", "a low pass by Jupiter", "along the line between day and night on Earth", "a wide turn out from Mars", "leaving Saturn · next stop: Earth".
- The rock it caught with a green tractor beam and drilled is gone.
- A slower teleport (a fold). The ship eases off to under half its speed while its heart powers up for about 4 seconds, growing brighter and beating faster. Then the hull burns away over about 2.5 seconds, and the heart pulls in the embers over 2 seconds, slowly at first. A starburst marks the jump: a white point, eight thin rays and two rings. With the camera on the ship, the whole screen flashes white for a split second.
- On arrival the heart comes first. With the camera on the ship it streaks in from beside and behind the camera, flying forward into the view with a fading tail over about 1.4 seconds (seen from elsewhere, it comes from far behind the ship). The screen flashes softly and a starburst marks it taking its place. It glows alone for a moment, then the hull streams out of it, white-hot pieces flying out to their places, and forms from the heart outward over 3 seconds while the ship picks up speed.
- The shield takes no part in a teleport. It fades out as the heart starts to power up and fades back in slowly, over 4 seconds, well after the hull has formed.
- A subtler shield. At rest it is barely there, with one faint glint running round it every 9 seconds. In strong gravity, such as near a black hole, its line stays thin but flickers brighter in patches, wobbles and leaves a faint echo a moment behind, as if time and space round it were bent.
- A new scan, a hologram sweep. A bright ring passes over the body from pole to pole along its real spin axis, and a glowing grid of latitude and longitude lines follows it and fades. Brackets lock onto real features the atlas draws and name them: the Great Red Spot, Olympus Mons, Tycho, the Sahara, the Crab Pulsar, M32 and more. The scan ends with real numbers (size, gravity, how long one turn on its axis takes) in the readout and in a toast. Black holes get rings round their shadow, never inside it; nebulae and clusters a grid shell; galaxies a flattened shell across the disc. The fans of beams are gone.
- The Halo scans a star from 2.6 of its radii, so the star fills the view.
- A lab page for trying the Halo's looks quickly (/lab): the ship parked by one of six places (Saturn, Jupiter, Earth, Mars, Sgr A*, the Crab Nebula), fixed cameras, slow motion from 0.1x, pause and single steps, buttons that teleport it out and back or start Pip, a scan or a weapons test at once, Pip up close with any of its faces, and a slider for the shield's load. It is kept out of search engines.
- The Halo showcase (?showcase=halo) has buttons that act at once: teleport, light speed, black hole, scan, Pip, weapons and skim (keys 1 to 7). A button stays lit until the ship can do it. The showcase's stays last 75 seconds instead of about two minutes, so a round of it is quicker.

**Pip, smaller and busier**
- Pip is now a bolder cartoon, a little bigger than at first (half its 0.9.2 size): a black pod with a silver outline, a dark visor and two big eyes that stay two eyes even when Pip is only a few characters across.
- Its eyes show how it feels. It looks happy when it waves or loops, focused when it welds or polishes, and surprised and then dizzy when an engine puffs at it. It is cross as it shakes that off, sleepy resting on the hull, worried near a black hole and sad when called home early. It blinks and sometimes winks.
- Pip, the Halo's little drone, is half its old size and stays by the ship. It no longer flies down to the planet or star.
- Each time it comes out it does two or three of four jobs round the Halo, in a new mix and order, never the same outing twice in a row. It checks the hull with its lamp, polishes the bridge window and blinks happily. It checks an engine, peeks into the nozzle, gets pushed back by a puff, shakes it off and welds a panel. It flies out ahead, snaps a photo of the Halo with the planet behind it and comes back to wave at you. Or it plays: it loops round the needle, races along the side with a barrel roll and rests on the hull.
- It peeks out, zips out or spirals out, and waves goodbye, zips home or spirals home.
- Coming out and going home take 2.5 s each instead of under a second.
- The Halo waits for Pip before it leaves. Near a black hole or a magnetar Pip stays closer and moves more gently.
- With reduced motion, Pip makes no barrel rolls or tumbles and loops only once.

## 0.9.2 · 2026-09-28

**More music, and 16 songs you can pick from a list**
- The radio now plays a fixed list of 16 songs, all made live in your browser: one lofi, two downtempo, four ambient, two ambient piano, four chill house and three synthwave. Together they last about 33 minutes; the mix has 9 of them, about 17 minutes. The owner picked them by ear from 24 and removed 8.
- Each song is the same every time it plays, from its first note to its last, with its full intro and ending (the first song after you arrive still starts where the groove comes in).
- The settings list every song by style, with its length and the moods it plays in. The song playing is marked. Click or tap a song, or press Enter on it, and it plays at once; the shuffle then carries on from there. It turns the music on if it was off.
- The shuffle plays every song of your mood once, in a random order, before any plays again. No song plays twice in a row, a new order never starts with a song you just heard, and the mix still plays an ambient or ambient piano song at least every fifth song.
- Three new styles, made live in your browser like the others: ambient piano (a soft felt piano over a faint pad), downtempo (slow drums, electric piano, a gliding bass and a soft choir) and soft synthwave (warm pads and a gentle arpeggio with an echo).
- The style buttons are now moods: mix, calm (ambient and ambient piano), beats (lofi and downtempo) and groove (chill house and synthwave). A line under them says what the chosen mood plays.
- The mix plays every style except chill house and synthwave. Those two play only when you pick groove.
- A style you picked before carries over: lofi becomes beats, chill house becomes groove and ambient becomes calm.
- Songs are named after places in the atlas, such as "Slowly past Io" or "Tapes from Rigel".
- The new styles have a full, low bass like lofi's, so the volume stays about even when the style changes: every style is within about 2 dB of lofi's loudness, both on headphones and on laptop or phone speakers.
- Ambient has a soft low note under its chords now, and its songs last 1 min 20 s to 2 min 10 s instead of about a minute, so the calm mood changes songs less often.
- Two songs of the same style now sound like two different songs, not two mixes of one. Each song picks its own sounds and keeps them to the end:
  - Chords: 12 to 22 progressions per style instead of 3 to 6, in major and in minor, some with two chords to a bar and some with one chord over two or four bars. Many songs play a second progression in their B part.
  - Instruments: lofi picks its keys (Rhodes, Wurlitzer, felt piano or a muted guitar) and its lead (a soft sine, flute, music box, vibraphone, kalimba, guitar, piano, ocarina or Rhodes). Downtempo picks from Rhodes, organ, Wurlitzer, guitar or piano, with its own lead. Ambient picks its pad (saw, choir, glass, strings or a warm pad) and its chime (bells, music box, kalimba, glockenspiel, piano or vibraphone). Synthwave picks its pad (saw, strings, soft brass or choir), its arpeggio and its lead. Chill house plays a pad, organ stabs, Rhodes or strings, with plucks, a mallet riff or a choir on top.
  - Rhythm: each song picks its bass line, drum sounds (four kicks; a snare, rim click, brush, snap or clap; three hi-hat sounds or a shaker), its groove and swing, and sometimes congas, a wood block or soft toms. Downtempo can be half time, a broken beat or a shuffle.
  - Tunes: A and B parts get tunes of their own, in four different phrase shapes, and some songs add a second instrument that answers the tune or a slow line under it.
  - Shape: two to six song shapes per style (with or without an intro, a break or a second B), and wider tempo ranges.
  - Texture: a quiet bed of vinyl crackle, rain, wind or tape hiss, chosen per song. Some lofi and downtempo songs start as if heard from the next room and open up.
- Every song stays about as loud as the others: each instrument that can stand in for another was matched in loudness, and every one of the 16 songs is within 3 dB of lofi.
- In every style the melody fits the chord under it, and every song ends on its home chord. The low drone under ambient follows the song's key.
- Skipping a song fades out its long notes at once, so the last song no longer rings on under the next one in its old key.

## 0.9.1 · 2026-09-28

**The Halo's new look** (the ship is made up; the pull it works against is real)
- A shield. A fine silver-blue line runs just outside the hull. In open space it is faint. Near strong gravity the shield works harder: the line brightens, most on the side facing the pull, the heart beats faster and harder, beads of light run out along its chains and the rings spin faster. How hard it works follows the real escape speed where the ship is: nothing at the planets, about a quarter at the Sun's surface, about half as a black-hole pass begins and all of it at the closest point. On a phone, where the ship is small, the flare shows as a bright line round its outline. Under load the rows of lights on the hull beat with the heart, so its work shows from every camera, the bridge too.
- The readout says so, in at most three lines: "shield power 96% · climbing out of Sgr A*'s gravity", and with no job line the real escape speed there ("escape speed here: 19% of light speed (real)"; at SGR 1806-20, whose mass is not measured, "about 2% of light speed (for a typical 1.4-Sun neutron star)"). The power shown is never more than the pull where the ship is asks for.
- With reduced motion the heart beats at most 0.6 times a second and the shield's flicker is damped.
- A new fold (the long jump through space): an ember wind. The electric arcs from the heart are gone. The shield first folds into the heart, then the hull burns away from the needle's tip, one small cell at a time (each about one character on screen). Each cell glows white-hot before it goes, and the embers and grey ash drift away to one side, each grain curling in a small eddy. In the last half second the heart pulls the ash back in and winks out. On arrival the stream flows back, the hull forms again from the heart outward, the needle last, and the shield unfolds. About one ember per character of the ship on screen, so they never pile up into a white ball. The route and its timing are unchanged.
- Riding along through a fold, the camera stays behind the ship, moves in closer while the drive spools up, so the break-up fills more of the screen, and eases back out once the hull has formed again. The readout says what happens: "the hull burns away for the fold · next stop: Pillars of Creation", then "out of the fold at Pillars of Creation · the hull forms again".
- A calmer light speed. The white wash over the hull and the white ball in the middle of the ship are gone. A thin blue-white line runs along the hull's edges, brighter toward the needle, a small star sits on the needle's tip and the engines burn brighter. Where the ship is heading shows as a pinpoint, not a glow over the needle. Riding along, the jump blinks the screen for 0.35 s instead of flashing it white, and so does a fold. Dropping out, a small flash at the tip and a thin ring replace the white disc on the ship.
- Pip, the Halo's little drone, replaces the green blinking dot of the probe job (the lamp on the belly bay is ice blue now). It is a black egg about 400 m across with one big ice-blue eye, a thin silver outline, two tiny swept fins like the ship's arms and an antenna whose tip winks. On a probe job it streams out of the belly bay as embers and takes shape, opens its eye, says hello with a wiggle toward you, does a happy spin and peeks at what it came for. Over a planet or a moon it hovers low, lights up the ground and takes four pictures, each with a flash and a happy hop; at a star it keeps further off and squints; at a nebula or a galaxy it flies out ahead; near a black hole or a magnetar it stays beside the ship, in your view and off the hole's bright disc, and waves goodbye at the end. Then it flies home, loops the loop by the ship and breaks up into embers that stream back into the bay, which glows as they arrive. It blinks, bobs while it hovers, moves smoothly at any frame rate and hides behind the hull or the planet like anything solid. Far away it is a steady ice-blue glint. The readout says what it does: "Pip lights up the ground · picture 3 of 4".
- `?showcase=halo` shows Pip at Mars and the new fold, with a caption for each.
- Fixed: the dotted rings round the heart whipped round and flickered while the fold drive spooled up, more so the longer the page had been open.
- Fixed: a caption whose end changes (a live number) kept starting over and could not be read; it now keeps what is already typed.
- If the browser resets the graphics (a driver reset, a GPU hang), the page says so and reloads when they are back. The ship's shader compiles in about 1.1 s on a fast desk, in the background, instead of up to 6 s for a heavier look tried during the review.

## 0.9.0 · 2026-09-27

**New places**
- Vesta, the brightest asteroid: a squashed ball about 525 km across with Rheasilvia, a crater about 500 km wide around its south pole, its central peak about 22 km high and the troughs round its equator, all at true height and where the IAU puts them. It sits on its real orbit and turns on its real axis every 5.3 hours. Its second angle looks up at Rheasilvia with the Sun low and to the side, so the crater's walls and peak cast shadows.
- Bennu, the rubble pile NASA's OSIRIS-REx brought a sample home from in 2023: a spinning top about 490 m wide (505 x 492 x 457 m, as OSIRIS-REx measured it) with a ridge round its middle and boulders everywhere.
- Mimas joins the atlas with its real crater Herschel: 130 km wide, walls about 5 km high and a peak 6 km tall, which is why it looks like the Death Star. Its crater angle plays only while Herschel is in sunlight. For about three and a half years either side of Saturn's equinox (the last was in May 2025, so until about 2028), Saturn's shadow covers Mimas for up to about two hours every orbit: the readout says so, and the camera pulls back to look past the dark moon at Saturn as soon as it goes dark.
- Three planets of other stars: 51 Pegasi b, the first found around a Sun-like star (1995); K2-18 b, whose hydrogen-rich air JWST has analysed; HD 189733 b, the deep blue planet where it may rain glass. Their views turn with their fast orbits, so each keeps its day side, its half-lit face or its dusk, also when you fly there or swing round from the far side. K2-18 b and HD 189733 b pass in front of their stars, so their orbits are drawn almost edge-on from Earth, as measured.
- Gaia BH3, the heaviest black hole found in our galaxy that was made by a star (33 Suns), with its ancient giant companion on an 11.6-year orbit, and its starlight bent into a ring.
- T Coronae Borealis, the Blaze Star: a red giant feeding a white dwarf that erupts about every 80 years. It erupted in 1866 and 1946, and the next eruption is expected soon; the nova here is a replay.
- The Lagoon Nebula (M8), a star nursery cut by its dark lane, with the Hourglass and the cluster NGC 6530. Its close angle looks along the dark lane, with the glow round the Hourglass on one side and the cluster's stars on the other.
- The Great Hercules Cluster (M13), the globular cluster the Arecibo message was aimed at in 1974. Its readout counts how far the message has come, and the time machine moves the count too.
- The "our neighbourhood" tour now stops at Vesta, and "other worlds" at 51 Pegasi b and K2-18 b (the stops were already written).
- The random tour can pick every new place.

**Atlas**
- A new heading, Other worlds, holds the planets of other stars (they were under Stars; their stars stay there).
- Every choice in the atlas is on screen at once, on a desk and on a phone. Nothing scrolls sideways any more, and the list keeps its room (about 12 rows on a 1280 x 800 screen).
  - Sort: one bar with four choices: kind (the headings), distance, size and name. The button beside it says the order the list is in ("near → far", "big → small", "A → Z") and reverses it. It keeps its width whatever it says, so changing the sort never moves the controls. Tapping the chosen sort again no longer reverses the order without saying so.
  - Show: "all" across the top, then twelve kinds in a grid of three columns, each with its count, running near to far like the list: solar system, moons & more, comets, stars, other worlds, nebulae, star clusters, black holes, galaxies, universe, explosions, human-made. Moons & small worlds, star clusters, explosions & collisions and human-made are new. One place can be in several kinds (the Crab Nebula is a nebula and an explosion); the headings still list it once. Human-made (it was "spacecraft") holds the real spacecraft, not the made-up Halo.
  - "Not seen yet" is now a box you tick, and it works with any kind: tick it with galaxies chosen to see the galaxies you have not visited. The counts then say how many are left, and a kind you have finished shows a ✓. If nothing is left, a button shows them all again. A place you see while it is ticked counts at once, in the kind's count, the line above the list and the atlas head; it stays in the list, with its ✓, until you change the view.
  - When the list is not the default view, a line above it says what it shows ("19 galaxies not seen yet · near → far"), with the only reset button. Screen readers hear the same words.
  - The arrow keys move through the sort and the kinds, "all" included (one group for screen readers).
- Each heading says what its numbers measure. The Solar System and Comets & meteors headings now measure from the Sun and run outward, so the numbers always climb: Mercury 0.47 AU, Venus 0.73 AU, Earth 1.00 AU, out to the Oort cloud. They used to show distances from Earth in the planets' order, so Mercury (1.21 AU) sat above Venus (0.37 AU). A comet is measured where it is today. Moons sit under their planet, marked └, and measured from it ("from Earth", "from Jupiter"). The other headings, and the one-list sorts, measure from Earth, like the info card.
- With one kind chosen, its places are under one heading named after it ("Galaxies", from Earth). Galaxies lists only galaxies and the parts of them you can visit: the S-stars and the neutron stars of GW170817 now count as stars.
- Sorted by distance, the list starts at Earth and runs outward (the space stations, the Moon, Webb, Venus...). The places we are inside (the Solar System, the Oort cloud, the cosmic web, the observable universe) come last under "all around us", instead of sorting as if they were 1 AU away.
- Sorted by size, the sizes are short ("93 billion ly") and the line above the list says they are true sizes, across. The observable universe read 56 billion light-years across; it is 93 billion, and the cosmic web, which fills it, the same.
- A name is never cut short: when a name and its number do not fit on one line, the number moves under the name. The numbers, counts and notes are brighter, so they read on a phone outdoors. No row looks picked by the keyboard until you type (the first row used to be grey).
- The search looks through everything, whatever kind is chosen; the kinds fade a little while you type, and picking one clears the search. On a phone the results move to the top of the card.
- The collection moved to the bottom line: "seen 18 of 137 [##--------] badges 1 of 9 ›". It opens a solid tray with every badge's progress and how a place counts as seen (3 seconds on it, kept on this device only). Every badge row does something: it shows the places still to see for it (black hole hunter: the black holes you have not seen; planet hopper: just the planets), and edge of everything and ship spotter fly there. Esc closes the tray first, then the atlas.
- Phones held upright: the atlas card is about two thirds of the screen, and its controls and list are one column that scrolls. It opens with every choice in sight; one swipe up gives the list the whole card (about 12 rows on a 390 x 844 phone, 9 on an iPhone SE, also with a kind and "not seen yet" chosen), and the line above the list and the heading stay at the top. Buttons are 34 px tall. With bigger menu text the search box just says "search".
- Phones on their side: two panes, the head and the controls on the left, the list on the right from the top of the screen with the collection line under it. The atlas takes the whole width on smaller phones, so the list keeps at least 340 px. The info card, the logo and the chips step aside while it is open. On a very small phone, or with very big menu text, it becomes one scrolling column like the upright one.
- The last choice is kept, also a choice saved before this version: "not seen yet" becomes all with the box ticked, "spacecraft" becomes human-made.
- Distances in the atlas: the James Webb Space Telescope read "0 m", the observable universe "1.00 AU" and the Halo where it was at start-up. The universe now reads "all around us", the satellites "in Earth orbit", and things that move are measured each time the atlas opens.
- With ten more places in the atlas, today's discovery reshuffles on release day, and the collection log and badges count the new places.

## 0.8.8 · 2026-09-27

**New: a random tour**
- "random tour" is second in the list of tours, on a desk and on a phone. It picks 12 places from the whole atlas, a new mix every time you start it. It also reaches the 23 places no other tour visits, such as Vega, the Horsehead and Voyager 2.
- Places you have not seen yet come first. A place you have seen comes up when no unseen place is left to pick, or when the trip to every unseen one would be much rougher: with only a few places left to see, the tour gets to them through places you know, instead of zooming out to the whole universe and back for each one. With 6 places left unseen, 3% of trips zoom out more than 100,000 times, as for a new visitor. What you have seen is kept on your device only.
- One stop per place: Earth, the Moon and the ISS count as one place, and so do a star and its planet, or the Crab and its pulsar. At most 3 stops are of one kind (stars, galaxies, black holes and so on). The first stop is never where you are; from Earth, the Moon or the ISS can still come later in the tour.
- The trips stay smooth: trips that zoom far out and back in are picked much less often. In 440 test trips, 2% zoomed out to a view more than 100,000 times wider than at either end, against 7% on the grand tour and 29% for places picked blindly. Trips that would fly through another object on the way are left out.
- On the last stop the green button reads "new random tour ›". The button, the ] key and the end of the last angle pick 12 new places, starting from where you are and never the 12 you just saw, so the tour goes on without repeating. The next 12 are picked a little at a time while the last stop plays or waits paused (and a new tour's first 12 while the list of tours is open), so the next trip usually starts without a hitch.
- No captions: the card already shows each place's fact.
- On a phone on its side, the list of tours now comes before "time at each stop", so the random tour is in view without scrolling.
- A shared link to a random tour starts a new one at the linked place. The order is not in the link, since it depends on what each visitor has seen.
- Every visitor gets their own tours: the order comes from the browser's own random numbers, not from the page's fixed seed.

**Fixed**
- The tour track on the scale bar shows the right names after a new random tour or a new screensaver shuffle. The screensaver used to keep the names of its first shuffle.
- Epsilon Eridani's far angle looked empty: its debris ring was drawn far too faint to see. It now shows as a faint ring of dust around the star. The readout called the ring ~65 AU across; it lies ~65 AU from the star.
- 55 Cancri and KELT-9 were specks on a phone from both of their angles. Their cameras now sit closer, so the star fills more of a phone screen.
- The Tarantula Nebula filled a desk screen edge to edge from its first angle. That angle now sits further back, so the whole nebula fits on a desk and fills about two thirds of a phone's width.
- Tours skip the Tarantula Nebula's close angle, where the glow fills the screen with bright characters, and play only the Ring Nebula's view from Earth: from the side the Ring is a solid block of bright characters. That side angle now sits further back, in dark sky. Picked by themselves both still play all their angles.
- HR 8799 b's second angle looked mostly at its night side: a large, dark red disc with little to see. It now looks up at the line between day and night, where the lit clouds and their bands show. Its three sister planets have the same new angle.
- Voyager 2 had a single, distant angle. It now has a second, close one of its sunlit dish. New Horizons' second angle is closer: the probe fills about a third of a phone screen.
- A shared link could make "your sky" (the view from your own backyard) the first stop of a random tour. Such a link now opens the sky without starting the tour: it is a backdrop, not a place.

## 0.8.7 · 2026-09-27

**Fixed: how the Halo flies** (the ship is fictional; these were mistakes in its route, found by the motion test once it flew fixed routes)
- A light-speed hop into something the ship was already inside (from Earth or anywhere else in the Milky Way to the Milky Way, from SN 1987A to the Large Magellanic Cloud) flew out to where its pass began and turned back there, about 160 degrees in under 2 seconds. It now folds space to the start of that pass instead. The same goes for the Pleiades from HL Tau, whose pass starts beyond where the ship already is.
- The turn before a light-speed jump aimed from where the ship would be after 2 seconds of straight flight, not from where the turn ends. On a short hop (Jupiter to Europa) or leaving a galaxy for something inside it (the Milky Way to Earth), the ship then swung round by up to 130 degrees as it jumped and again when it arrived. It now works out the turn exactly, so it points straight at the next pass when it jumps and flies straight into it; if the stop has moved on meanwhile (Europa round Jupiter), it turns a little more first, or folds.
- When a light-speed hop is too short for a proper jump (the Pleiades to HL Tau), the ship glided on a curve that overshot and was held back, so it stood dead still for up to 2.4 seconds. The glide now changes speed evenly and never stops.
- At the end of a light-speed leg across the Milky Way the ship moved in jerks, with pauses between, because the distance still to go was rounded over the whole length of the leg. It is now measured from where the ship arrives, and the ship comes in smoothly.
- The ship never turns faster than its tightest turn, three times its usual rate. The motion test checks this on a whole route and on each of the hops above.

## 0.8.6 · 2026-09-27

**Calmer ASCII**
- Bright areas are calm now. Seven heavy characters (`& # 8 % W @ $`) put almost the same ink on screen, so bright cores such as the Milky Way's bulge or the heart of the Orion Nebula looked like confetti. The brightest levels now use only `& 8 @`, in order of the ink each one really has in the page's font. The faint characters are unchanged.
- Smoother brightness. Each character's colour now makes up for the ink it has more or less than its brightness asks for, so gradients rise smoothly instead of in bands. The overall brightness of a view stays within about 2%.
- Less work off screen. A galaxy or nebula whose outer edge reached behind the camera was drawn over the whole screen, even when it was out of sight: the Large Magellanic Cloud was drawn in many Sun, Earth and Jupiter views. Now only the part of the screen it can cover is drawn, and nothing when it is out of view. The picture is the same, and frames in the Sun, Earth and Crab Nebula views take about 7 to 25% less time to draw in a software renderer (a few percent less on a fast graphics card).

## 0.8.5 · 2026-09-26

**Say where it goes**
- A green button beside the object's name says where it goes. On a tour it reads "next stop · Moon ›", and on the last stop "start again ›". Once you leave a tour it reads "back to the tour · Earth ›" and flies back to the stop you left. If you only paused on a stop (a drag, the pause button), it goes on to the next stop. With no tour involved it is hidden. The phone card has it too.
- The camera-angle arrows moved onto the angle line: "‹ angle 1/5 [#####-----] ›". The grey ASCII bar is unchanged. Every tap moves one angle, also while the camera is still swinging to the last one (fast taps used to be lost), and the line shows the angle it is swinging to.
- The tour's name above the object's name is a button: "GRAND TOUR ▾" opens the list of tours.
- The row above the name says something useful: "stop 3 / 31" on a tour. Off a tour it names the kind of object ("gas giant") while the type line below is folded away. It used to read "-- / 31".
- The ‹ › around "tours" in the top bar are gone, and so are both "resume tour" buttons (the green button does that now). [ and ] still step through the stops on a tour and along the scale bar otherwise. Pausing from the tours panel remembers the stop, like the pause button.
- On a touch screen the first tap on a faded button works (it used to only bring the interface back). A tap on the sky still only brings it back. So does a tap on the line of the faded scale bar on a tablet (its names are buttons and work at once).
- Esc closes whatever is open first: help, photo mode, Earth's story, the tours, time or settings panel, the atlas or the search. It lets go of the object only when nothing is open. It also closes a panel while one of its sliders has the focus.
- The scale bar hides while the search or the atlas is open (it used to move out into the scene). Picking something from the search empties the search box.

**Tour angles**
- On a tour Earth plays three of its angles, about 30 s instead of a minute: the day side, the horizon up close and the night side. Picked by itself it still loops through all five.
- Earth's night-side angle looked empty, especially on a phone: a dark disc with a few city lights. It now looks from a little further round, so a lit crescent sits beside the city lights.
- Gaia BH1's second angle showed two small smudges. The camera now sits closer and nearer the line to the star, so the star's light bends into two long arcs around the shadow that close into a ring and open again.
- Betelgeuse seen from above and SN 1987A's first angle (the rings before the flash) were small specks on a phone. Both cameras now sit closer.
- Every grand tour angle was checked on a desk and a phone. Tours now skip the angles that looked empty: Jupiter's wide view of its moons (specks at that distance), and the views back at the Sun from behind Jupiter and Saturn, and Saturn's night side (a dark disc and a thin crescent). They still play when you pick the planet yourself.
- Tours also skip the Crab Pulsar's closest angle: from 80 km its glow filled the whole screen with bright characters. Picked by itself it still plays.

## 0.8.4 · 2026-09-26

**Stay with it: phone gestures**
- A pinch only zooms, and it follows your fingers exactly: spread them three times apart and the view comes three times closer (it used to zoom almost six times). It stays on the object and stops at its surface.
- Two fingers moving together slide the object across the screen on a leash. The camera stays locked on, and the object's centre never goes further than about a third of the screen from the middle, so it cannot leave the screen or hide behind the card. It glides back to the middle when you press play, a tour takes over or you fly somewhere. A double-tap on the sky brings it back too.
- Lifting one finger of a pinch no longer swings the camera round.
- A pinch that starts on the info card no longer zooms the whole page (it could blow it up five times). One finger still scrolls the card.
- While the camera is paused, the card shows one hint line: "drag to turn · pinch to zoom · double-tap to centre".
- On a desk nothing changes here: a right-drag still lets go of the object and pans freely.

**Home**
- A home button: first in the dock on a phone, right after the search box on a desk ("⌂ home"). The logo, H and the Home key do the same. It flies to Earth's opening view from anywhere. A running tour pauses, and "resume tour" stays so you can pick it up again.
- On narrow phones (under 380 px wide) the dock buttons share the width by the length of their words, so "settings" still fits beside home.
- Help moved to the ? key and the ? button.

**Free camera**
- Once you let go of an object, the view keeps moving with it while you are near it. The Solar System clock used to carry it away: Earth moved out of view within a second.
- The play button says where it goes: "back to the Moon" (space does the same). It flies back to the object you left and plays its angles again.
- When that object has been off screen for a moment, a small pill at the edge of the screen points the way: "› back to the Moon · 10,000 km". Tap it to fly back.
- The card no longer says "you are here" once you have left Earth. In free camera it reads "free camera · H for home" (on a phone, "free camera · ⌂ for home").
- W A S D can no longer take you out into empty black space: the camera stays close to the nearest object, never more than eight times your viewing distance from its surface. Flying back toward it is always allowed; scroll out to go further. A note says so when you reach the edge.
- The planets no longer swell around you. The enlarged Solar System overview used to switch on anywhere 1 to 2,000 AU from the Sun, so a camera that had just let go of Jupiter saw it grow hundreds of times around it. In free camera it now switches on only when you look at the system from outside: a wide view, with no planet near the camera.

**Top bar (desk)**
- Travel, resume tour and play / pause always sit together on the second row, with play at the far right. The play button's words can change ("pause", "back to the Moon") without anything else moving.

## 0.8.3 · 2026-09-26

**Quick wins**
- The sound button shows when no music is playing: "sound off" in soft red with a thin red border (on phones, "muted" with a thin red ring), and the tooltip "Music is off: click to turn it on (M)". It does not blink, and it fades with the rest of the interface.
- Before your first click the browser keeps the music silent, although the button used to say "sound". Now the button stays red until the music really plays, and a click on it then starts the music (it used to turn it off). M works the same way. The first track's name shows when the music starts, not while it is held back.
- The top bar keeps its shape when you turn the music off. The sound button is always as wide as "sound off", so "pause" no longer drops to a second row at 1280 px wide; nothing moves at 1024 px either.
- Scrolling over a label (the Moon's, a planet's, a moon's) zooms, as it does over the sky. It used to do nothing.
- On a desktop, picking or resuming a tour closes the tours panel, so it no longer covers the caption.
- Bigger targets to click or tap: the daily card's close button, and "less" and "hide" on the info panel, are 28 px tall. Names on the scale ladder are 28 px tall where the next name is at least that far away; where two sit closer, they grow only as far as the space between them. Nothing looks different.

**Content**
- TRAPPIST-1e, "the most Earth-like of the seven", was drawn as a lava world. It is now a temperate world that keeps one side to its star: open sea under the star, a few rocky islands, ice beyond and across the night side, clouds over the warmest water and a thin blue haze. A second angle looks at the edge between its day and night sides. The readout says the look is a guess: no one knows yet if it has air or water.
- Voyager 1 now moves along its real path (fitted to JPL Horizons) as the Solar System clock runs. Its readout gives the light-time to Earth and counts down to the day it is first one light-day (173.1 AU, 25.9 billion km) from Earth: 18 November 2026. After that it says "now more than one light-day from Earth". Its distance from the Sun on its card and in the Solar System's readout follow the same path.

## 0.8.2 · 2026-09-26

**New: the Halo's new look** (drawn after the owner's concept art; the ship is still fictional)
- Seen from above it is a trident: a long needle-shaped bow and two crescent arms sweeping back from its shoulders to the engines at their tails, each arm with a claw reaching in toward the heart.
- Between the arms floats its heart, a white ball of star plasma inside two dotted rings of light that turn faster as the fold drive spools up, wired to the claws and to the bow by chains of lights pulsing outward.
- A black hull with silver edges, a faint engraved pattern and rows of small blue-white lights; slow blinking lights on the claws, the shoulders and the needle's tip; a plume and a dotted exhaust trail behind each engine.
- The working gear sits in a pod under the bow (scan array, tractor emitter, probe bay, drill), with the gun at the needle's tip and a turret under the bow; beams, the probe, shots, the drill and the skim trail leave from the new places. The bridge sits on the bow's spine, so the cockpit view looks down the needle.
- Riding along, the chase camera sits low behind the ship and looks along its heading, so the ship reads as flying straight on (from higher up its long needle pointed up the screen, as if it were climbing); the lock-on angles are lowered to match. The readout gives its size, about 4.2 km from needle to engines.
- A showcase for reviewing the ship: open the site with `?showcase=halo`. The camera circles the ship once (it holds still just for this), then rides along through a scan at Saturn, light speed to Jupiter seen from the bridge and a skim, a weapons test on the Moon, a probe at Mars, and a fold to the Pillars of Creation for the tractor beam and drill, then round again. A caption names each part; the cockpit view button (or C) switches to the bridge during the ride; a drag or the pause button ends it.

## 0.8.1 · 2026-09-26

**New**
- Comets and meteors, with their own atlas category (Halley's Comet and 'Oumuamua moved there too):
  - Comets Hale-Bopp (1997), NEOWISE (2020), Tsuchinshan-ATLAS (2024), the interstellar comet 3I/ATLAS (2025) and Rosetta's rubber-duck comet 67P, each on its real orbit at the moment it was at its best (the readout gives the date and where it is now). Each has a nucleus with jets, a glowing coma, a straight blue ion tail and a curved dust tail that point away from the Sun; seen from Earth's direction, Tsuchinshan-ATLAS shows its anti-tail.
  - Comet Shoemaker-Levy 9 hitting Jupiter in July 1994, replayed: the string of fragments falling in, plumes rising 3,000 km over the limb, and dark scars about the size of Earth turning into view.
  - The Kreutz sungrazers: a family of small comets diving through the Sun's corona on real parabolic orbits, replayed 15,000 times faster; most boil away.
  - The Perseids and the Leonids: the dust of Comets Swift-Tuttle and Tempel-Tuttle spread along their real orbits, flowing across Earth's path where the showers happen. The readout counts the days until Earth gets there.
- A new tour, *comets & meteors*.
- Now and then on a tour (about one trip in three) a comet or a meteor zips past the camera on the way to the next stop: a short streak with a glowing head and a fading tail, away from the middle of the screen. Flights are unchanged.

## 0.8.0 · 2026-09-26

**New: the Halo at work** (all of it fictional, and its readout says so)
- The Halo always travels in a direction. Each visit is one smooth pass: it flies in, does one job on the way past, turns toward its next stop on a wide arc while still moving, and leaves. It no longer circles a body or turns on the spot.
- Two ways to travel. Short hops (around a planet, across the Solar System, to a neighbouring star, now and then inside the Milky Way) are light-speed jumps: riding along, the stars stretch into streaks rushing out of a point ahead, with a flash as it jumps and drops out; from outside, the ship stretches into a streak of light. Long hops are folds through space, now bigger: the drive spools up inside a shield of light with arcs leaping from the reactor, the ship collapses into a point with a flash and a ring, and bursts out at the other end.
- Five jobs, one per visit: a sensor scan; a probe that drifts out of the belly bay, loops round the body taking pictures (small flashes) and comes back to dock; a weapons test on any body (rail gun, plasma lance, antimatter pulse: blasts that flash, swell and cool from white to orange to dark, with sparks, a shock ring and a little smoke, then fade completely); a skim just above the cloud tops of Jupiter or the surface of a star, gas streaming into the bow and a glowing trail behind; and a tractor beam that catches a passing rock beside the ship, drills a core sample (sparks) and lets it go.
- Scan beams now end exactly where they first meet the body's surface (for a black hole, the edge of its shadow; for a nebula or galaxy, its heart). They fan across the body like a scanner, paint a band of light on it, and a faint rim of scan light traces the body's edge at the start of each sweep. Beams are only drawn from a ship you can see: no more lines appearing from nowhere, from behind a planet, or through the ship's hull.
- While it works, the ship banks toward the body, and the camera trailing it (locked on, or riding along) turns to keep the job in the picture; from the bridge the pilot's gaze turns toward it. The readout and a short note say what it is doing.

**Fixed**
- Riding along: the camera's fly-in now lands exactly on the chase view even though the ship keeps moving (it used to swing into place at the end).

## 0.7.9 · 2026-09-26

**New**
- Earth's night side shows the real lights seen from space (NASA's Black Marble satellite map): road networks, coasts, the Nile, India, the eastern US. Bright city cores burn whiter, suburbs and highways glow sodium orange, and clouds soften them.
- Weather seen from space (illustrative, sped up): tropical cyclones with spiral bands and an eye in the basins active this month, thunderstorm clusters over the stormiest places on Earth where, now and then, lightning briefly lights a patch of cloud from inside on the night side (a quick flicker of 2 to 4 strokes), Saharan dust over the Atlantic, and burning seasons glowing at night where they happen that month. The readout says what is going on.

**Security**
- The API functions refuse query strings (they bypassed the edge cache and made every request hit CelesTrak or Launch Library), keep their last good answer, share one upstream fetch, and no longer echo upstream error text.
- A crafted share link (`#o=constructor`, `#o=__proto__`, or a non-numeric date or camera) could stop the page from starting. Links are now checked.
- `?flags=` in a link applies to that visit only; it is no longer saved in the visitor's browser.
- `.gitignore` covers `.env` files and `.vercel/`; dev dependency sharp updated to 0.35 (security advisory in its image libraries; it never ships to visitors).

## 0.7.8 · 2026-09-26

**New**
- Every planet has an angle from its night side looking back at the Sun, which sits just past the planet's edge at its true size, with a soft round glow: a bright core and a faint wider halo, no rays. The glare hides when a planet or moon passes in front of the Sun.
- The Solar System view zooms in much closer, until the Sun fills the screen (2.7 Sun radii from its centre); its corona returns as it nears true size.
- Betelgeuse up close: a boiling surface of dark lanes, granules and bright filaments inside its giant convection cells. Its dusty plumes now drift outward and fray, and fade out before the edge (no more ring-like boundary).
- Alpha Centauri's third angle looks past A at B, the brightest star in its sky, and follows B along its orbit.
- Locked on the Halo, the camera always trails the ship from behind (three angles: above, low to one side, pulled back) and turns with it.

**Improved**
- Galaxies: brighter, more continuous spiral arms, a soft glow between them and thin dust lanes on the inner edge of each arm.
- Faint glow and haze no longer flicker: dim areas use a steady, even pattern of characters instead of random dots that reshuffle.
- Riding the Halo: the ship shows as an engine glint from afar and fades in gradually as you fly up behind it, with a slower final glide.
- Labels never sit on the object you are looking at (locked on or free flight): no more Sgr A* text across the Galactic Centre.

**Fixed**
- Star spikes (bright nebula stars, supernova flashes, gamma-ray bursts, Eta Carinae) were never drawn: their shader did not divide by distance, so they landed off-screen. They show now.
- Betelgeuse's scale rings are gone (they distracted from the star).

## 0.7.7 · 2026-09-25

**Fixed**
- Solar System lock-on: the Sun is now always the largest body, and the planets keep their true order of size (Jupiter, Saturn, Uranus, Neptune, Earth, Venus, Mars, Mercury). Before, Jupiter and Saturn were drawn bigger than the Sun.
- Solar System zoom: zooming in never makes the Sun shrink any more; it grows gently from 4% to 10% of the screen height. The planets are drawn larger.
- The Sun is a clear disc at every zoom of the system; its corona and ejections fade while it is enlarged, so they no longer cover the inner planets.
- The Crab Nebula, the Crab Pulsar and the magnetar SGR 1806-20 were not drawn since 0.7.5 (a property name clash made their size "not a number"). They are back, and the smoke test now fails on any such object.
- Travel no longer detours to an object on the way and zooms in on it before carrying on (it looked like the camera crashed into the Orion Nebula and bounced off). A trip is one smooth flight; it only bends past something that is really in view along the route, without slowing to a stop. The motion test checks that no grand tour trip dips in and out.
- When the page lowered the detail level to keep motion smooth, it never raised it again. It now goes back to your chosen detail after 10 calm seconds, and shader compiling at start-up no longer counts as slow frames.
- Stars with our Solar System's orbits drawn around them for scale (Betelgeuse, Antares, UY Scuti, Stephenson 2-18) now say so in the readout.
- The asteroid belt dims as the view widens, so it reads as a faint ring instead of a bright blob in the middle.
- Planets whose orbits fall inside the enlarged Sun step aside, and the readout names them.

## 0.7.6 · 2026-09-25

**Fixed**
- Music starts as soon as the page loads when the browser allows it, and otherwise on the first click, tap or key press. Before, a scroll or a touch could leave it silent until a later click.
- The first track skips its quiet intro and fades in over 0.6 s instead of 3 s.

## 0.7.5 · 2026-09-25

**New**
- 16 new places: the JWST icons Cassiopeia A, WR 124, the Southern Ring and the Bubble Nebula, and the Pleiades; strange worlds Kepler-16b (two suns), 55 Cancri e (lava), KELT-9b (hottest planet) and HR 8799's four photographed giants; the wanderers Halley's Comet (tails near the Sun), 'Oumuamua, Ceres and Arrokoth; and the oddities the Einstein Cross, the Boötes Void, El Gordo and Tabby's Star.
- Two new tours: *through JWST's eyes* and *cosmic oddities*.
- Scenic travel: long trips pass something real on the way (a nebula, a cluster, a galaxy near the route), turn to look at it, then carry on.
- The Solar System view draws the Sun and planets enlarged, so you can see each of them; orbits stay to scale and the readout says how much each is enlarged. Pick a planet and it returns to true size.

**Changed**
- The arrows beside an object's name step through its camera angles. The arrows at the top right step through tour stops on a tour, and otherwise up and down the scale bar (Moon, Earth, Jupiter, the Sun, ...).
- Every lock-on loops through the object's angles, including picks from the scale bar and shared links.
- Travel speed: slow by default for new visitors; changing it mid-flight re-times the rest of the trip; the speed you pick is honoured on computers set to reduce motion.
- The Sun's surface churns like fire, with tongues of flame licking up from its edge. Other stars with boiling surfaces (cooler than about 7,000 K) get the same look in their own colours.
- The Milky Way and other spirals have golden cores, blue-white arms, pink star-forming clouds and darker dust lanes. The Milky Way's views were reframed to show it whole.
- The Pillars of Creation stand out against a darker sky when you are close.

**Fixed**
- "you are inside it away" under the Solar System's name.

## 0.7.4 · 2026-09-25

**New**
- Ride along with the Halo: the *ride* button (or *ride along* in its card, or a tap on its marker) puts the camera behind the ship, the pilot's third-person view. C switches to the cockpit on the bridge and back; scroll moves the chase camera nearer or further. When the ship folds space the camera folds with it, behind a flash, so you never lose it. Drag to take the camera; play rides again.
- The Halo is redesigned as a long-range cruiser: an armoured hull with a sharp bow, a bridge tower, swept wings, a dorsal fin and three engines, with its star-heart visible through an open reactor bay.
- Menu text size: the atlas, settings and other panels are bigger by default (115%), with their own slider in settings.
- The Sun is warm yellow-orange and its surface boils: bright granules flicker, patches swell and fade, and flame-like spicules ripple along the edge.
- The Pillars of Creation take the JWST look: translucent rust-and-gold columns with glowing orange-red edges against a blue haze. Gas peels off the lit surfaces and drifts away, the edges shimmer, and young stars glow in the tips.

**Changed**
- The ship button now only shows or hides the Halo's blue marker, and it is off by default. It no longer flies to the ship.
- Labels fade in and out instead of popping, and the orange numbers in the info panel fade in when the object changes. The panel fades in when the page opens.
- Labels of other things no longer sit on top of the object you are looking at. Its own parts (moons inside its bounds, a galaxy's companions) and things visibly in front of it keep theirs.

**Fixed**
- Objects picked from the scale ladder, a shared or reloaded link, and the end of a size compare no longer arrive paused: the camera keeps moving (a slow circle at the ladder's scale, the angle loop otherwise).
- Following the Halo between destinations no longer shows empty space: the camera stays attached to the ship through the fold.

## 0.7.3 · 2026-09-25

**New**
- Play / pause at the top right (and the space bar): pause the tour or the camera to admire a view, then carry on.
- Pick any object and, once the camera arrives, it loops through that object's tour angles by itself. Any drag or zoom pauses it; play brings it back.

**Fixed**
- Black holes are pitch black: nothing shows through a shadow any more. Lines and points behind or inside it are hidden, and so are labels. M87* and TON 618 lose their Solar System scale rings, which sat entirely inside their shadows.
- Gaia BH1 is no longer an empty black disc: its Sun-like companion's light is bent around it like the rest of the sky. From behind, the second angle follows the star so its light splits into two arcs that swing into a ring.
- Cygnus X-1's disk no longer thins out as you zoom in: it now runs continuously from the inner disk to where the stream lands, and reads as a surface at every scale.
- The Sun's coronal mass ejections were cut off by the edge of the Sun's drawing area, a cut that moved with the camera. They now fade into space, and fly straight out instead of turning with the Sun.
- The Halo's scan beams land on the side of a planet or star the ship can see, with a small glow where they hit. They stop at a black hole's shadow and never pass through the body.
- The Solar System tour stop now frames all eight orbits, then out to Saturn, then the inner planets. The orbit lines are brighter.
- Flights land on where the destination is now, not where it was at take-off: arriving at Earth from the edge of the universe no longer jumps in the last frame. Every flight glides in and settles.
- The orange numbers in the info panel wrap inside the panel again, like the text above them, and *less · hide* stay next to that text.

## 0.7.2 · 2026-09-25

**Back to the subtle look**
- Black holes are shown by their own physics again: light bending around them, the photon ring, and the colour and brightness shifts of the disk (Doppler beaming and gravitational redshift). The blue gravity grids and their settings switch are gone.
- GW150914 is two dark shadows spiralling together, seen only through the starlight they bend, without the grid. Gaia BH1's lensing is no longer boosted.
- The tour's angle progress is the ASCII bar again: `angle 1/4  [#####-------------]`.
- Kept from 0.7: pure-black shadows (no stray glow or dots inside) and zooming in to 1.06 Schwarzschild radii.

## 0.7.1 · 2026-09-25

**Phones**
- A dock of six big buttons at the bottom (atlas, tours, time, ship, sound, settings) that always fits the screen.
- The object's details are a card above the dock. It starts compact (name, distance, tour progress); tap *more*, tap its grip or swipe up for the facts, numbers and ruler; *hide* or swipe down puts it away and leaves a small *i* pill to bring it back. The choice is remembered.
- The scale ladder folds away behind a chip at the top right showing the current scale (or the tour stop). Tap it to open the ladder; it closes by itself after you pick a rung or tap elsewhere.
- The camera re-frames the object into the space the card, atlas or a panel leaves free, instead of hiding it behind them.
- *Resume tour* sits in the card; choosing a tour closes the tours panel so you can watch it; atlas filters scroll sideways so the list keeps its room; landscape puts the card on the left and panels on the right.

**Everywhere**
- The interface fades after a few quiet seconds (sooner during a tour), leaving just the object's name; move the mouse, tap or press a key to bring it back. The first tap only wakes it, so a tour keeps playing. Settings → interface: never fade, slowly, quickly. New objects get time to be read before their facts fade, and resting the mouse on the text keeps it.
- The info panel has *less* and *hide* on desktop too (`I` cycles full, compact, hidden).

## 0.7.0 · 2026-09-25

**New**
- Content packs: famous nebulae (Orion, Horsehead, Helix, Ring, Carina, Veil, the Eagle), galaxy gallery (Sculptor, Cartwheel, Hoag's Object, Stephan's Quintet, NGC 1275), extreme stars (UY Scuti, Stephenson 2-18, the Tarantula Nebula, R136a1, WR 140), the black hole zoo (Gaia BH1, Cygnus X-1, a star torn apart, GW150914).
- Tonight: *your sky* (stand at your location and look up at the real sky, in real time), and a list of what is up: Moon phase, bright planets, ISS passes over you, the next launches, meteor showers and eclipses.
- Earth's story: 4.54 billion years on one slider, with the globe changing from magma ocean to ocean world, snowball Earth, bare rock and green, and 31 milestones.
- Live Earth: every active satellite from CelesTrak (`/api/sats`), the ISS and Hubble as real objects at their real positions, the next rocket launches at their pads (`/api/launches`), illustrative ascents, and simulated air traffic on 55 real routes.
- Screensaver mode (`Z`): full screen, the interface fades, an endless shuffled tour plays with the music; can start by itself after 2, 5 or 10 idle minutes.
- Photo mode (`P`): save a picture with a caption, or copy the frame as ASCII text.
- Today's discovery (one object a day, with a streak) and a collection log with badges.
- Music: gcd radio, a generative mix of lofi, chill house and ambient with its own keys, tempos, chord progressions and melodies per track; style picker and skip.
- Flybys: sweeping camera moves past the Sun, Jupiter, Saturn, Betelgeuse, UY Scuti, Stephenson 2-18, R136a1, Sgr A*, M87*, TON 618, the Milky Way, Andromeda, the Sculptor Galaxy and the cosmic web.
- Gravity grids: the true shape of space (Flamm's paraboloid) under every black hole; the camera can now go to 1.06 Schwarzschild radii.
- The Eagle Nebula around the Pillars of Creation, with more columns and a soft edge.
- New Horizons, the ISS and Hubble have their own models.
- Feature flags (`?flags=`), documentation set (CLAUDE.md, docs/), test harness (`npm test`) and a generated content catalogue.

**Improved**
- Black hole shadows are pure black (no glow or stray dots inside).
- RS Ophiuchi: a red giant with a glowing envelope, a brighter disk and stream, and a bigger two-colour nova shell.
- Spiral galaxies: cloudier arms, pink star-forming regions, dust feathers; the Milky Way's arms carry more of the picture.
- The Halo: a star-heart in spinning containment rings, a fiery aura, random power surges with arcs and light spikes, circuit traces and a halo ring.
- Interface: selectable text, readable object titles, larger logo, text-size slider, one-line readouts, clearer tour progress bar, a highlighted *free camera* chip, travel speed in the toolbar, the ship button flies to the Halo, *resume tour*, `‹ ›` tour skipping, tour stop length, the ladder turns into the tour's track during tours, atlas sorting and filters with reset, Earth's fourth angle is now a pull-back to the Moon.

## 0.6.0 · September 2026

- Tours (seven themed tours with captions), size compare, time machine with deep-time star drift, share links.

## 0.5.0 · September 2026

- New home on GitHub and Vercel (gcdatlas.vercel.app).
- Atlas stays open with the current object highlighted; search box; settings panel; scale ladder with drag-to-zoom; star twinkle; atmospheres; the crescent Halo and ship finder; generative ambient soundtrack; travel speeds; lazy shader compilation and simulation gating for scale.

## 0.1.0 – 0.4.0

- The ASCII rendering pipeline, real star catalogue, planets from JPL elements, seamless zoom from Earth to the observable universe, the first objects (black holes, quasars, nebulae, galaxies, pulsars, mergers), the first tour, published as a claude.ai artifact.

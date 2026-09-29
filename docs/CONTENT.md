# Content: what exists, what is next

## What is already in the atlas

**`docs/CATALOG.md` is the source of truth.** It is generated from the built page (`npm run catalog`), so it cannot drift from the code: every object with its key, name, group, category, distance, true size, number of camera angles, whether it has a flyby, and the file it is defined in. Check it before adding anything, and regenerate it after.

## How to add a pack

1. Pick objects from the backlog below and mark them *in progress* here.
2. Create `src/objects/pN-name.js`. One pack per theme. Reuse helpers (`namedStar`, `addGalaxy`, `addBody`, `addProbe`, `clusterPS`, `orbitLine`) and shared shaders before writing new ones.
3. Every object: real position (`radec` with catalogue RA/Dec and distance), true size, a sourced fact, a readout with numbers, 2–3 views including one close and dramatic, `aka` search words (with its Messier, NGC and IC numbers, like `m31 ngc 224`), a `sortKey`. Big objects: add them to `FLYBY_OBJ` in `src/objects/z8-flybys.js`.
   - Atlas place: `group` is its one heading (`GROUPS` in `src/09-render.js`: solar, comets, stars, worlds, nebulae, galaxies, cosmic, travel). `tags` put it in more kinds (`CATS`, the grid of filters in the atlas): `moons` (moons and small worlds), `events` (explosions and collisions), `clusters` (star clusters), `human` (human-made; `addProbe` adds it). Planets of other stars go in `worlds` (`exoPlanet` does this). When an object is not what its heading says, `atlasKind` sets its main kind (the S-stars sit under Galaxies & black holes but are `stars`); do not use `kind`, which is the surface shader's number on planets and moons.
4. Consider: a tour stop (`src/08t-tours.js`), a ship destination (`SHIP_TARGETS` in `src/07-extras.js`), a ladder rung (`LADDER` in `src/09-render.js`) for iconic scales.
5. Screenshot every view, `npm test`, `npm run catalog`, changelog line.

## Backlog

Status: `planned`, `in progress`, `done` (then it appears in CATALOG.md and can be removed from here).

### Done in 0.9.0 (`src/objects/p7-places.js`, Mimas in `src/o10-planet.js`)
Vesta, Bennu, Mimas and its crater Herschel, 51 Pegasi b, K2-18 b, HD 189733 b, Gaia BH3, T Coronae Borealis, the Lagoon Nebula, the Great Hercules Cluster (M13); the Other worlds heading and the moons, events, clusters and human-made chips.

### Next packs · planned (one pull request each)
| Pack | Objects |
| --- | --- |
| 0.9.1 human reach | Parker Solar Probe, the Tesla Roadster with Starman (no logos), Tiangong (its elements already come from `/api/sats`), our radio bubble (about 212 light-years across, worked out from the date; its star count computed once), the Arecibo message on its way to M13 (illustrative), a "human reach" tour |
| 0.9.2 surfaces | a terrain shader for patches you can fly low over; Olympus Mons, Tranquility Base and the other landing sites, Perseverance in Jezero, Valles Marineris, Io's and Enceladus's plumes (both readouts already mention them), Didymos and Dimorphos |
| 0.9.3 the biggest things | Laniakea (real Cosmicflows-4 flows), the Virgo Cluster, the Hercules-Corona Borealis Great Wall (labelled debated), Porphyrion, GRB 221009A, the heliosphere, the Butterfly Nebula |

### Comets and meteors · first pack done in 0.8.1 (`src/objects/p6-comets.js`), more planned
| Object | Notes |
| --- | --- |
| 2I/Borisov | the second interstellar object (2019), a clearly active comet |
| Tempel 1 and Wild 2 | Deep Impact's crater (2005) and Stardust's sample (2004) |
| Comet Lovejoy (C/2011 W3) | the Kreutz sungrazer that survived the Sun, then broke up |
| Geminids and 3200 Phaethon | a meteor shower from an asteroid-like parent |
| Orionids and Eta Aquariids | the two showers from Halley's Comet (its orbit is already drawn) |

### Human spaceflight · planned (see 0.9.1 and 0.9.2 above)
| Object | Notes |
| --- | --- |
| Apollo landing sites | markers on the Moon (11, 12, 14, 15, 16, 17) |
| Perseverance | Jezero crater, Mars (18.44°N, 77.45°E) |
| Curiosity | Gale crater, Mars (4.59°S, 137.44°E) |
| Parker Solar Probe | its closest passes, 6.1 million km from the Sun's surface; the fastest object ever built |
| Tiangong | model (currently label only via live data) |

### Other worlds · ideas
| Object | Notes |
| --- | --- |
| TOI-700 d, LHS 1140 b | temperate rocky worlds |
| WASP-76 b | the planet where it may rain iron |

### Planet surfaces · planned
| Object | Notes |
| --- | --- |
| Olympus Mons | low flyover view on Mars |
| Valles Marineris | canyon system |
| Io's plumes | volcanic plumes rising 300 km |
| Lunar craters | Tycho and Copernicus close-ups |

### Earth, closer · planned (see ROADMAP: ASCII Earth phase 2)
| Object | Notes |
| --- | --- |
| Landmarks | Pyramids of Giza, Eiffel Tower, Burj Khalifa, Great Wall, Statue of Liberty |
| Cities | brighter, more detailed night lights for the 50 largest cities |

### Deep sky ideas · planned
| Object | Notes |
| --- | --- |
| Sombrero, Whirlpool detail passes | dust ring, pink HII regions (partly done in 0.7) |
| Crab Nebula filaments | pulsar wind nebula glow |
| Omega Nebula, Butterfly Nebula | more famous nebulae |
| Phoenix Cluster, El Gordo | galaxy clusters |
| Hercules–Corona Borealis Great Wall | biggest structure claim (with the caveat that it is debated) |
| Magnetar SGR 1935+2154 | fast radio burst source |

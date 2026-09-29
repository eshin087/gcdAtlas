# src/objects

Content packs and add-ons, loaded after the built-in `src/o*.js` objects, in file-name order:

- `p*-….js`: content packs (one theme per file: nebulae, galaxies, extreme stars, the black hole zoo…)
- `e*-….js`: Earth layers (live satellites, launches, air traffic, your-sky site)
- `s*-….js`: spaceflight: Starman's Roadster (`s0` its JPL data, made by `tools/roadster.mjs`; `s1`), SpaceX's rockets and flights (`s2` shaders, `s3` pads, stages and missions, `s4` the director and the launch camera)
- `z*-….js`: add-ons that must run after every object exists (flybys)

See `docs/CONTENT.md` for how to add a pack and `docs/CATALOG.md` for everything already implemented.

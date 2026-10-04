# api

Serverless functions deployed by Vercel next to the static page. Read-only, no secrets, fixed upstream URLs, cached at the edge.

| Endpoint | Source | Cache |
| --- | --- | --- |
| `/api/sats` | CelesTrak active satellites (OMM JSON), compacted by `_lib/orbits.js` | 6 h |
| `/api/launches` | The Space Devs Launch Library 2, next launches | 1 h |
| `/api/weather` | Open-Meteo, the weather over the three launch sites and the centres of the five cities (fixed coordinates), hourly, three days back to two ahead | 30 min |
| `/api/quakes` | USGS earthquakes of the past week, magnitude 2.5 and over, as `[time, lat, lon, depth, magnitude, place]` arrays (about 20 KB) | 5 min |
| `/api/fires` | NASA FIRMS VIIRS active fires of the last 24 hours, added up on a 0.1 degree grid as `[lat, lon, detections, MW]` (about 250 KB) | 2 h |
| `/api/clouds` | NASA GIBS true-colour VIIRS composite of the last complete day: a 2048 x 1024 equirectangular JPEG passed through (about 600 KB; its day is in the `X-Clouds-Date` header) | 6 h |

Files in `_lib/` are shared helpers, not endpoints. `_lib/guard.js` serves JSON by default; an endpoint can set `type` for a binary body (`clouds`), and `load()` can return `{ body, headers }` to add response headers (`clouds` does). The live data (clouds, quakes, fires): exact formats, credits, what to draw and failure modes are in `docs/LIVE_DATA.md`; `node tools/check-live-api.mjs` runs the three against the real upstreams. See `docs/SECURITY.md`.

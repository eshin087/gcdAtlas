# api

Serverless functions deployed by Vercel next to the static page. Read-only, no secrets, fixed upstream URLs, cached at the edge.

| Endpoint | Source | Cache |
| --- | --- | --- |
| `/api/sats` | CelesTrak active satellites (OMM JSON), compacted by `_lib/orbits.js` | 6 h |
| `/api/launches` | The Space Devs Launch Library 2, next launches | 1 h |
| `/api/weather` | Open-Meteo, the weather over the three launch sites and the centres of the five cities (fixed coordinates), hourly, three days back to two ahead | 30 min |

Files in `_lib/` are shared helpers, not endpoints. See `docs/SECURITY.md`.

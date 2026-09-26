# Testing

The page is WebGL, so tests drive a real (headless) Chromium with Playwright. WebGL runs on SwiftShader (a CPU renderer): correct but slow, so frames take longer than on a real GPU and simulations advance less per second of wall time.

## Setup

```sh
npm install      # installs playwright and sharp (dev only; the site itself has no dependencies)
npx playwright install chromium   # first time only, if Playwright has no browser yet
```

## The tests

| Command | What it checks | Time |
| --- | --- | --- |
| `npm test` (`tests/smoke.mjs`, then `tests/mobile.mjs`) | the page loads without errors; every object in the registry renders one frame from its first view; no NaN camera; key interface panels open; then the phone checks below | 4–6 min |
| `npm run test:wallpaper` (`tests/wallpaper.mjs`) | wallpaper mode (`?wallpaper=1`): checks embedded screensaver start, tour playback, input swallowing, sound/network silencing, dynamic FPS changes, freeze/unfreeze state, lap reshuffle, and normal saver regression (part of `npm test`) | ~30 s |
| `npm run test:motion` (`tests/motion.mjs`) | the angle loop starts after picking an object and moves the camera; pause, play and space work; the flight from the edge of the universe to Earth grows Earth smoothly and lands without a jump; H flies home to Earth and pauses a tour; a free camera keeps moving with the object it left, says so, and play and the "back to" pill fly back; letting go of Jupiter does not enlarge it around the camera; W A S D stays within reach of the nearest object (part of `npm test`) | ~1 min |
| `npm run test:mobile` (`tests/mobile.mjs`) | at 390 x 844 and 844 x 390: the dock fits without overflow, the info card sits above it and expands, collapses and hides, the scale chip opens and closes the ladder, the atlas stays above the dock, the interface fades on a tour and the first tap only wakes it (the tour keeps playing); home is the first dock button; with real two-finger touch events a pinch zooms by the finger ratio, a slide keeps the lock and Earth on screen, lifting one finger does not orbit, a double-tap on the sky and play re-centre, a pinch on the card does not zoom the page; home pauses a tour; screenshots in `tests/out/mobile/` | ~2 min |
| `npm run test:tour` (`tests/tour.mjs`) | plays the grand tour for 1,000 simulated seconds, then locks on, zooms, orbits and flies freely; reports any error or NaN | 5–8 min |
| `npm run shots -- sun:0,ton618:1` (`tests/shots.mjs`) | screenshots of objects at given view indices into `tests/out/`, plus a contact sheet `tests/out/sheet.png` | ~10 s each |
| `npm run shots -- --phone earth:0` | the same at a 390 x 844 phone viewport | |
| `npm run showcase:video` (`tools/showcase-video.mjs`) | records the Halo showcase (`?showcase=halo`: all angles, then every job, light speed and a fold) to `tests/out/halo-showcase.webm`, frame by frame on the GPU, for reviewing changes to the ship | ~3 min |
| `npm run catalog` (`tools/catalog.mjs`) | not a test: regenerates `docs/CATALOG.md` from the built page | 30 s |

## Test hooks

The page exposes `window.__cosmos` (read the bottom of `src/09-render.js`, `09f-features.js`, `09g-sky.js`):

- `view(key, index)`: jump straight to an object's view (no flight).
- `simulate(seconds)`: advance the whole simulation deterministically at 30 steps per second.
- `setMove(obj, view, fraction)`: freeze a flyby at a point, for screenshots.
- `setOpt(key, value, quiet)`, `SET`, `FLAGS`: settings and flags.
- `startSaver()`, `startPhoto()`, `enterSky()`, `openStory()`, `setStory(0..1000)`.

Set `window.__syncCompile = true` in an init script to compile shaders synchronously (otherwise objects show as dots for their first frames), and `window.__noAdapt = true` to stop the automatic quality reduction on slow (software) rendering.

## Writing a new test

Copy `tests/smoke.mjs`: use `tests/lib.mjs` → `openPage()`, do things through `page.evaluate` and the hooks, collect `pageerror` and console errors, exit non-zero on failure. Prefer checking state (`__cosmos.orbit.lock`, a readout text) over pixels; use screenshots for anything visual and look at them.

## Manual checks before merging visual work

- Desktop Chrome and one of Safari or Firefox.
- A phone (or `npm run test:mobile` and its screenshots): the dock, the info card (more, less, hide, swipe), the scale chip, panels, idle fade. Try it upright and on its side. Gestures need a real iPhone and a real Android phone: pinch, a two-finger slide, lifting one finger, a double-tap on the sky, and a pinch on the card (the page must not zoom).
- Reduced motion (OS setting): no flashes, tours still work.
- Sound on and off; the first click starts music.

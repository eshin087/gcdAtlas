# KDE Plasma Wallpaper: gcdatlas

gcdatlas can run directly as a live desktop wallpaper on KDE Plasma 6.

It runs in a dedicated **wallpaper mode** (`?wallpaper=1`):
- All HUD, menus, sound, and network calls are disabled.
- Loops through a continuously shuffled screensaver tour across all catalog objects without repeating stops.
- Desktop input (clicks, drags, keystrokes) is swallowed so desktop interactions do not affect the camera.
- Frame rate is throttled (15, 30, or 60 FPS) via hybrid timer scheduling to minimize CPU and GPU usage.
- Canvas DPR is clamped to 1x to avoid fill-rate overhead on HiDPI screens.
- Off-screen DOM updates (labels, HUD, captions, time, hash) are skipped.
- Pauses execution and frees rendering when covered by maximized or fullscreen windows.

---

## Installation

### Option 1: One-liner install script

From the repository root:

```bash
npm run wallpaper:install
```

Or build the package and install with KDE's package tool:

```bash
npm run wallpaper
kpackagetool6 -t Plasma/Wallpaper -i dist/plasma-wallpaper
# If already installed and updating:
kpackagetool6 -t Plasma/Wallpaper -u dist/plasma-wallpaper
```

### Option 2: From Release Archive

Download `gcdatlas-plasma-wallpaper.tar.gz` from GitHub Releases and run:

```bash
kpackagetool6 -t Plasma/Wallpaper -i gcdatlas-plasma-wallpaper.tar.gz
```

---

## Applying on Desktop

1. Right-click your desktop and choose **Configure Desktop and Wallpaper...**
2. In the **Wallpaper Type** dropdown, select **gcdatlas**.
3. Choose your preferred settings:
   - **Travel between places**: *Slow and scenic* (`cinematic`) or *Quick* (`quick`).
   - **Frames per second**: `15`, `30`, or `60`.
   - **Object name**: Position of the viewed object name (*Hide*, *Top left*, *Top center*, *Top right*, *Bottom left*, *Bottom center*, or *Bottom right*).
   - **Text size**: Size of the object name (*Extra small*, *Small*, *Normal*, *Large*, or *Extra large*).
   - **Save power**: Pause while a maximized or full screen window covers the screen.
4. Click **Apply**.

### Desktop Context Menu Actions

Right-clicking on an empty area of the desktop reveals navigation actions:
- **Next Object**: Flies to the next stop on the tour.
- **Next View**: Cycles between viewpoints and camera angles for the current body.

---

## Resource Usage and Performance

Because the wallpaper runs inside QtWebEngine (Chromium), system resource monitors will list `QtWebEngineProcess` instances under your user session:

- **RAM**: Resident memory (RSS) is typically around 550 to 590 MB. This breaks down into roughly 450 MB of private heap and WebGL context buffers, plus 120 MB of shared system libraries. Helper zygote processes share the same library pages and do not duplicate this memory.
- **CPU**: At 30 FPS, typical CPU load is 3% to 5% of one modern CPU core.
- **Power saving (window coverage)**: With "Save power" enabled, opening any window maximized or full screen on that monitor freezes the WebEngine lifecycle. JavaScript timers and WebGL animation frames stop completely, bringing CPU and GPU use down to 0%.

---

## Running in Other Wallpaper Tools or Browsers

`?wallpaper=1` is a standard web URL mode supported by any web-view wallpaper utility (such as Komorebi, Electron wallpaper runners, or a kiosk browser):

```text
https://gcdatlas.com/?wallpaper=1&travel=cinematic&fps=30
```

Supported query parameters:
- `wallpaper=1`: enables wallpaper mode.
- `travel=cinematic|quick`: flight duration between stops (`cinematic` is slower and calmer).
- `fps=N`: caps the target frame rate (clamped between 10 and 60).
- `title=none|top-left|top-center|top-right|bottom-left|bottom-center|bottom-right`: position of the object name overlay.
- `textSize=xsmall|small|normal|large|xlarge`: size of the object name text.

---

## Requirements

- KDE Plasma 6.0+
- Qt 6 with `QtWebEngine` and `Kirigami` (installed by default on most Plasma 6 desktop distributions like Fedora KDE, Arch, openSUSE Tumbleweed, Neon, Kubuntu 24.10+).

---

## Testing

Run the Playwright test suite for wallpaper mode:

```bash
npm run test:wallpaper
```

This verifies embedded screensaver start, tour playback, event swallowing, network silence, dynamic FPS adjustment, and freeze/unfreeze transitions.

---

## Uninstall

```bash
kpackagetool6 -t Plasma/Wallpaper -r app.gcdatlas.wallpaper
# or remove the directory:
rm -rf ~/.local/share/plasma/wallpapers/app.gcdatlas.wallpaper
```

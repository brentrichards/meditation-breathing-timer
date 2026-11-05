# Meditation Breathing Timer

A static browser app for meditation. No build, package installation, account,
or backend is required. It can be hosted directly on GitHub Pages.

## Run locally

Keep the whole folder together, including audio/ and icons/. Double-click index.html.
Synthesized sounds and bundled recordings work offline; audio/samples.js
provides local-file-compatible copies of the recordings.

Alternatively, open PowerShell in the project directory and run:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Python is required only for this optional method. Open http://127.0.0.1:8080/
and stop the server with Ctrl+C. Choose another port if 8080 is already in use.

## Download to another computer

In GitHub, select Code > Download ZIP. Extract the entire ZIP, open the extracted
folder, and double-click index.html. Keep audio/ and icons/ with the HTML, CSS, and JS files.

## Sessions and appearance

- Inhale/exhale: 3-7 seconds; hold after inhale: 0-2 seconds; 0.1-second increments.
- Continuous sessions or 3-40 minutes, with 5/10/20-minute presets.
- Pause freezes position and elapsed time; Resume continues; Reset returns to zero.
- Changing breath timing or session length resets the current session.
- Switching tabs, minimizing, or locking the device pauses the session.
  Resume manually when returning.
- Settings slides over the session and closes on Start.
- Circle, Wave, Petal, and Dashboard share one session.
- Australian green and gold, vivid blue shades, and warm red palettes; light and dim backgrounds.
- Phase words appear above the graphic. The optional smaller countdown offers
  0.1, 0.2, 0.5, or 1-second display steps. It defaults to visible and a 1-second step.
  Display rounding never changes actual breathing timing.
- The elapsed/remaining session readout can be hidden.
- Gentler breathing motion follows the device's reduced-motion preference on
  first use and can be changed. It reduces the movement amplitude while keeping
  the breathing animation active.
- Preferences are remembered in browser storage when available.

## Audio

Choose separate inhale, hold, and exhale sounds, including Silence.
Individual preview buttons stop any previous preview and pause running sessions.
Choose sound throughout each breath or short cues; hold sound stays sustained.
Volume and envelope shape are adjustable.

Synthesized bowls, bell, flute, hum, drone, pulse, and air/water textures are
joined by two treatments of a real bowl recording. Nature textures are synthesized
interpretations, not field recordings. See [audio credits](AUDIO-CREDITS.md).
Press Start or Preview to unlock browser audio.

Soft air and Soft flowing water use dedicated low-level textures with three
low-pass smoothing stages, bass-rumble removal, no filter wobble, and extended
fades. These presets are deliberately quieter than the other noise options.

## Publish

Commit and push all project files, including audio/ and icons/. In GitHub Settings > Pages,
choose Deploy from a branch, main, / (root), and Save. No build is needed.

## Regression checks

With Node.js installed, run:

```powershell
node tests/session.test.cjs
```

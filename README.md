# Meditation Breathing Timer

A simple static web app for guided meditation breathing sessions. It includes a breathing circle, a wave visualization, configurable breath timing, session timing, and synthesized soothing audio cues.

## Features

- Adjustable inhale time from 3.0 to 7.0 seconds
- Adjustable pause time from 0.0 to 2.0 seconds
- Adjustable exhale time from 3.0 to 7.0 seconds
- Continuous sessions or timed sessions from 3 to 40 minutes
- Quick session buttons for 5, 10, and 20 minutes
- Circle, wave, and dashboard views
- Selectable inhale, exhale, and pause sounds
- Overall volume control
- Sound envelope options

## Run Directly From This Directory

This app does not require a build step or package install.

Open `index.html` in a web browser.

On Windows, you can usually double-click:

```text
index.html
```

Some browsers apply stricter rules when running directly from a local file. If anything behaves oddly, run it through a small local web server instead:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8080/index.html
```

## Download And Run On Another Computer

Download or copy the full project folder, keeping these files together:

```text
index.html
styles.css
app.js
README.md
```

Then open `index.html` in a browser.

If downloading from GitHub later:

1. Open the GitHub repository page.
2. Select `Code`.
3. Select `Download ZIP`.
4. Extract the ZIP file.
5. Open the extracted folder.
6. Double-click `index.html`.

If audio does not start immediately, press `Start` or `Preview` once. Browsers require a user action before playing web audio.

## Hosting

Because the app is static HTML, CSS, and JavaScript, it can be hosted on GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static web server.

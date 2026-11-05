"use strict";

const $ = (id) => document.getElementById(id);
const defaults = {
  inhale: 5,
  pause: 0,
  exhale: 5,
  sessionMinutes: 10,
  sessionMode: "continuous",
  inhaleSound: "bowl",
  pauseSound: "hum",
  exhaleSound: "ocean",
  volume: 0.45,
  shape: "fade-out",
  playback: "sustained",
  view: "circle",
  palette: "sea",
  theme: "light",
  showTimer: false,
  timerStep: 1,
  showSession: true,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};
const sounds = [
  { id: "silent", name: "Silence", family: "silent" },
  {
    id: "bowl",
    name: "Singing bowl",
    family: "bowl",
    base: 164,
    partials: [1, 2.71, 4.05],
  },
  {
    id: "deep-bowl",
    name: "Deep bowl",
    family: "bowl",
    base: 110,
    partials: [1, 2.02, 2.73],
  },
  {
    id: "bell",
    name: "Soft bell",
    family: "bell",
    base: 440,
    partials: [1, 2.76, 5.4],
  },
  {
    id: "recorded-bowl",
    name: "Recorded bowl · struck",
    family: "sample",
    file: "audio/bowl-struck.mp3",
  },
  {
    id: "recorded-sustain",
    name: "Recorded bowl · resonant",
    family: "sample",
    file: "audio/bowl-resonant.mp3",
  },
  { id: "ocean", name: "Ocean wash", family: "noise", cutoff: 650, q: 0.5 },
  { id: "rain", name: "Rain hush", family: "noise", cutoff: 2800, q: 0.4 },
  {
    id: "wind",
    name: "Wind through leaves",
    family: "noise",
    cutoff: 1100,
    q: 1.8,
  },
  { id: "breath", name: "Soft air", family: "noise", cutoff: 1600, q: 0.7 },
  { id: "stream", name: "Stream murmur", family: "noise", cutoff: 1900, q: 3 },
  {
    id: "flute",
    name: "Bamboo flute",
    family: "flute",
    base: 294,
    partials: [1, 2, 3],
  },
  {
    id: "hum",
    name: "Low grounding hum",
    family: "hum",
    base: 98,
    partials: [1, 2, 3],
  },
  {
    id: "drone",
    name: "Warm drone",
    family: "hum",
    base: 131,
    partials: [1, 1.5, 2.001],
  },
  {
    id: "pulse",
    name: "Gentle low pulse",
    family: "pulse",
    base: 82,
    partials: [1, 2],
  },
];
const palettes = {
  sea: ["#287d71", "#7bc8ac", "#e5b879"],
  rose: ["#a8567d", "#d5a2bd", "#81afa2"],
  blue: ["#467da9", "#8abdd1", "#cfab81"],
};
let settings = { ...defaults };
try {
  const saved = JSON.parse(
    localStorage.getItem("breathing-settings-v2") || "{}",
  );
  Object.keys(defaults).forEach((key) => {
    if (typeof saved[key] === typeof defaults[key]) settings[key] = saved[key];
  });
} catch (_) {
  /* Storage may be unavailable in private browsing. */
}
["inhale", "exhale"].forEach(
  (key) => (settings[key] = Math.min(7, Math.max(3, settings[key]))),
);
settings.pause = Math.min(2, Math.max(0, settings.pause));
settings.sessionMinutes = Math.min(40, Math.max(3, settings.sessionMinutes));
settings.volume = Math.min(1, Math.max(0, settings.volume));
if (![0.1, 0.2, 0.5, 1].includes(settings.timerStep)) settings.timerStep = 1;
if (!palettes[settings.palette]) settings.palette = "sea";
if (!["circle", "wave", "petal", "dashboard"].includes(settings.view))
  settings.view = "circle";
["inhaleSound", "pauseSound", "exhaleSound"].forEach((key) => {
  if (!sounds.some((sound) => sound.id === settings[key]))
    settings[key] = defaults[key];
});

const session = {
  running: false,
  elapsed: 0,
  started: 0,
  phase: "inhale",
  progress: 0,
  breaths: 0,
  complete: false,
};
let audio,
  master,
  clock,
  animation,
  voiceToken = 0,
  starting = false;
const voices = new Set();
const buffers = new Map();
const noiseBuffers = new Map();
const ctx = $("visual").getContext("2d");

function persist() {
  try {
    localStorage.setItem("breathing-settings-v2", JSON.stringify(settings));
  } catch (_) {}
}
function elapsed() {
  return (
    session.elapsed +
    (session.running ? (performance.now() - session.started) / 1000 : 0)
  );
}
function duration() {
  return settings.inhale + settings.pause + settings.exhale;
}
function timeLabel(seconds) {
  const whole = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(whole / 3600);
  return (
    (hours
      ? hours + ":" + String(Math.floor(whole / 60) % 60).padStart(2, "0")
      : Math.floor(whole / 60)) +
    ":" +
    String(whole % 60).padStart(2, "0")
  );
}
function locate(seconds) {
  const cycle = duration();
  const breaths = Math.floor(seconds / cycle);
  let t = seconds % cycle;
  if (t < settings.inhale)
    return { phase: "inhale", progress: t / settings.inhale, breaths };
  t -= settings.inhale;
  if (settings.pause && t < settings.pause)
    return { phase: "pause", progress: t / settings.pause, breaths };
  t -= settings.pause;
  return { phase: "exhale", progress: t / settings.exhale, breaths };
}
function levelAt(seconds) {
  const point = locate(((seconds % duration()) + duration()) % duration());
  if (point.phase === "pause") return 1;
  const smooth = (1 - Math.cos(point.progress * Math.PI)) / 2;
  return point.phase === "inhale" ? smooth : 1 - smooth;
}
function setDrawer(open) {
  $("settings").classList.toggle("open", open);
  $("settings").inert = !open;
  $("settings").setAttribute("aria-hidden", String(!open));
  $("settings-open").setAttribute("aria-expanded", String(open));
  $("scrim").hidden = !open;
  if (!open) {
    stopVoices("preview");
    $("settings-open").focus();
  } else $("settings-close").focus();
}

function ensureAudio() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    master = audio.createGain();
    master.gain.value = settings.volume * 0.65;
    const limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 6;
    master.connect(limiter);
    limiter.connect(audio.destination);
  }
  return audio.resume();
}
function stopVoices(group) {
  voiceToken++;
  voices.forEach((voice) => {
    if (group && voice.group !== group) return;
    voice.gain.gain.cancelScheduledValues(audio.currentTime);
    voice.gain.gain.setTargetAtTime(0, audio.currentTime, 0.018);
    voice.sources.forEach((source) => {
      try {
        source.stop(audio.currentTime + 0.09);
      } catch (_) {}
    });
    voices.delete(voice);
  });
}
function noiseBuffer() {
  if (noiseBuffers.has("pink")) return noiseBuffers.get("pink");
  const buffer = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.15;
  }
  noiseBuffers.set("pink", buffer);
  return buffer;
}
async function sampleBuffer(file) {
  if (!buffers.has(file)) {
    const promise = (
      location.protocol === "file:" && window.BREATHING_SAMPLES
        ? Promise.resolve(
            Uint8Array.from(atob(window.BREATHING_SAMPLES[file]), (char) =>
              char.charCodeAt(0),
            ).buffer,
          )
        : fetch(file).then((response) => {
            if (!response.ok) throw new Error("Audio file unavailable");
            return response.arrayBuffer();
          })
    ).then((data) => audio.decodeAudioData(data));
    buffers.set(file, promise);
    promise.catch(() => buffers.delete(file));
  }
  return buffers.get(file);
}
async function playSound(phase, seconds, group = "session") {
  const sound = sounds.find((item) => item.id === settings[phase + "Sound"]);
  if (!sound || sound.family === "silent" || seconds <= 0) return;
  const token = voiceToken;
  const requestedAt = performance.now();
  let buffer;
  try {
    await ensureAudio();
    if (sound.file) buffer = await sampleBuffer(sound.file);
  } catch (_) {
    if (token === voiceToken)
      $("notice").textContent =
        "This sound could not load. Choose another sound in Settings.";
    return;
  }
  if (token !== voiceToken) return;
  seconds -= (performance.now() - requestedAt) / 1000;
  if (seconds <= 0.03) return;
  const span = Math.min(
    seconds,
    settings.playback === "cue" && phase !== "pause" ? 1.25 : seconds,
  );
  const start = audio.currentTime + 0.01;
  const end = start + span;
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  const voice = { gain, sources: [], group };
  voices.add(voice);
  gain.connect(filter);
  filter.connect(master);
  filter.type = "lowpass";
  filter.frequency.value = sound.cutoff || 3200;
  filter.Q.value = sound.q || 0.5;
  const peak = phase === "pause" ? 0.15 : sound.family === "noise" ? 0.65 : 0.4;
  const attack = Math.min(
    span * 0.2,
    sound.family === "bell" || sound.family === "bowl" ? 0.04 : 0.35,
  );
  const release = Math.min(span * 0.22, 0.35);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  if (phase === "pause" || settings.shape === "constant") {
    gain.gain.setValueAtTime(peak, end - release);
  } else if (settings.shape === "swell") {
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + span * 0.5);
  } else gain.gain.exponentialRampToValueAtTime(peak * 0.1, end - release);
  gain.gain.linearRampToValueAtTime(0, end);
  function source(node, target = gain) {
    node.connect(target);
    node.start(start);
    node.stop(end + 0.02);
    voice.sources.push(node);
  }
  if (buffer) {
    const node = audio.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    source(node);
  } else if (sound.family === "noise") {
    const node = audio.createBufferSource();
    node.buffer = noiseBuffer();
    node.loop = true;
    source(node);
    filter.frequency.setValueAtTime(
      sound.cutoff * (phase === "exhale" ? 1.15 : 0.65),
      start,
    );
    filter.frequency.linearRampToValueAtTime(
      sound.cutoff * (phase === "exhale" ? 0.65 : 1.15),
      end,
    );
    const lfo = audio.createOscillator();
    const depth = audio.createGain();
    lfo.frequency.value = sound.id === "stream" ? 4.3 : 0.19;
    depth.gain.value = sound.cutoff * 0.12;
    lfo.connect(depth);
    depth.connect(filter.frequency);
    lfo.start(start);
    lfo.stop(end);
    voice.sources.push(lfo);
  } else {
    sound.partials.forEach((partial, i) => {
      const oscillator = audio.createOscillator();
      const partialGain = audio.createGain();
      oscillator.frequency.value =
        sound.base * partial * (phase === "exhale" ? 0.84 : 1);
      oscillator.detune.value = i % 2 ? 3 : -2;
      partialGain.gain.setValueAtTime(0.55 / (1 + i * 2), start);
      if (["bowl", "bell"].includes(sound.family))
        partialGain.gain.exponentialRampToValueAtTime(0.001, end);
      partialGain.connect(gain);
      source(oscillator, partialGain);
    });
    if (sound.family === "pulse") {
      const lfo = audio.createOscillator(),
        depth = audio.createGain();
      lfo.frequency.value = 0.85;
      depth.gain.value = peak * 0.2;
      lfo.connect(depth);
      depth.connect(gain.gain);
      lfo.start(start);
      lfo.stop(end);
      voice.sources.push(lfo);
    }
  }
  voice.sources[0].onended = () => {
    voice.sources.forEach((node) => node.disconnect());
    gain.disconnect();
    filter.disconnect();
    voices.delete(voice);
  };
}
function updateSession(play = false) {
  let seconds = elapsed();
  if (
    session.running &&
    settings.sessionMode !== "continuous" &&
    seconds >= settings.sessionMinutes * 60
  ) {
    session.elapsed = settings.sessionMinutes * 60;
    session.running = false;
    session.complete = true;
    clearInterval(clock);
    stopVoices();
    document.body.classList.remove("running");
    $("start-stop").textContent = "Start";
    seconds = session.elapsed;
  }
  const next = locate(seconds);
  const changed =
    next.phase !== session.phase || next.breaths !== session.breaths;
  Object.assign(session, next);
  if (session.running && (play || changed)) {
    stopVoices("session");
    playSound(session.phase, settings[session.phase] * (1 - session.progress));
  }
  const ready = !session.running && seconds === 0;
  const label = session.complete
    ? "Complete"
    : ready
      ? "Ready"
      : { inhale: "Breathe in", pause: "Hold", exhale: "Breathe out" }[
          session.phase
        ];
  $("phase-label").textContent = label;
  const left = session.complete
    ? 0
    : settings[session.phase] * (1 - session.progress);
  const step = settings.timerStep;
  const rounded = Math.min(
    settings[session.phase],
    Math.ceil((left - 0.000001) / step) * step,
  );
  $("breath-timer").hidden = !settings.showTimer;
  $("breath-timer").textContent =
    step === 1 ? Math.ceil(left) : Math.max(0, rounded).toFixed(1);
  $("session-time").textContent =
    settings.sessionMode === "continuous"
      ? "Continuous"
      : timeLabel(settings.sessionMinutes * 60 - seconds);
  $("elapsed").textContent = timeLabel(seconds) + " elapsed";
  $("session-readout").hidden = !settings.showSession;
  $("dash-phase").textContent = label;
  $("dash-session").textContent = $("session-time").textContent;
  $("cycle-length").textContent = duration().toFixed(1) + "s";
  $("breath-count").textContent = session.breaths;
}
async function start() {
  if (session.running || starting) return;
  starting = true;
  stopVoices();
  $("notice").textContent = "";
  try {
    await ensureAudio();
  } catch (_) {
    $("notice").textContent =
      "Audio is unavailable. The visual timer will still run.";
  }
  starting = false;
  if (document.hidden) return;
  if (session.complete) {
    session.elapsed = 0;
    session.complete = false;
  }
  session.started = performance.now();
  session.running = true;
  $("start-stop").textContent = "Pause";
  document.body.classList.add("running");
  setDrawer(false);
  updateSession(true);
  clearInterval(clock);
  clock = setInterval(() => updateSession(), 50);
  animate();
}
function pause() {
  if (!session.running) return;
  session.elapsed = elapsed();
  session.running = false;
  clearInterval(clock);
  stopVoices();
  $("start-stop").textContent = "Resume";
  document.body.classList.remove("running");
  updateSession();
  draw();
}
function reset() {
  pause();
  stopVoices();
  session.elapsed = 0;
  session.complete = false;
  $("start-stop").textContent = "Start";
  $("notice").textContent = "";
  updateSession();
  draw();
}

function draw() {
  const canvas = $("visual");
  if (settings.view === "dashboard" || document.hidden) return;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width,
    h = rect.height;
  if (!w || !h) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (
    canvas.width !== Math.round(w * dpr) ||
    canvas.height !== Math.round(h * dpr)
  ) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const colors = palettes[settings.palette];
  const seconds = elapsed();
  const level = session.complete ? 0 : levelAt(seconds);
  const centerX = w / 2,
    centerY = h / 2;
  const radius = Math.min(w * 0.34, h * 0.37, 210);
  if (settings.view === "wave") {
    const pad = 25,
      top = h * 0.18,
      height = h * 0.64;
    const width = w - pad * 2,
      anchor = 0.43;
    // The curve and marker share the same eased breath function.
    const offset = settings.reducedMotion ? 0 : seconds;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const gradient = ctx.createLinearGradient(pad, 0, w - pad, 0);
    gradient.addColorStop(0, colors[1]);
    gradient.addColorStop(0.43, colors[0]);
    gradient.addColorStop(1, colors[2]);
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    for (let i = 0; i <= 260; i++) {
      const x = pad + (width * i) / 260;
      const value = levelAt(offset + (i / 260 - anchor) * duration() * 1.7);
      const y = top + (1 - value) * height;
      if (!i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const marker = settings.reducedMotion ? levelAt(0) : level;
    ctx.fillStyle = colors[0];
    ctx.beginPath();
    ctx.arc(
      pad + width * anchor,
      top + (1 - marker) * height,
      8,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  } else if (settings.view === "petal") {
    const expansion = settings.reducedMotion ? 0.55 : level;
    ctx.save();
    ctx.translate(centerX, centerY);
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.fillStyle = colors[i % 3];
      ctx.globalAlpha = settings.theme === "dim" ? 0.48 : 0.25;
      ctx.beginPath();
      ctx.ellipse(
        0,
        -radius * (0.22 + expansion * 0.26),
        radius * (0.19 + expansion * 0.11),
        radius * (0.43 + expansion * 0.32),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = colors[0];
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    const size = radius * (settings.reducedMotion ? 0.78 : 0.62 + level * 0.3);
    ctx.strokeStyle = colors[1];
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const gradient = ctx.createRadialGradient(
      centerX - size * 0.25,
      centerY - size * 0.3,
      size * 0.08,
      centerX,
      centerY,
      size,
    );
    gradient.addColorStop(0, colors[1]);
    gradient.addColorStop(0.65, colors[0]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function animate() {
  cancelAnimationFrame(animation);
  function frame() {
    draw();
    if (
      session.running &&
      !settings.reducedMotion &&
      settings.view !== "dashboard" &&
      !document.hidden
    )
      animation = requestAnimationFrame(frame);
  }
  frame();
}
function applySettings() {
  document.body.dataset.theme = settings.theme;
  document.body.classList.toggle("reduced", settings.reducedMotion);
  document.documentElement.style.setProperty(
    "--accent",
    palettes[settings.palette][0],
  );
  document
    .querySelectorAll("[data-view]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.view === settings.view),
      ),
    );
  document
    .querySelectorAll("[data-palette]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.palette === settings.palette),
      ),
    );
  document
    .querySelectorAll("[data-session]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(
          button.dataset.session ===
            (settings.sessionMode === "continuous"
              ? "continuous"
              : String(settings.sessionMinutes)),
        ),
      ),
    );
  $("dashboard").hidden = settings.view !== "dashboard";
  $("visual").hidden = settings.view === "dashboard";
  ["inhale", "pause", "exhale"].forEach(
    (key) => ($(key + "-value").textContent = settings[key].toFixed(1) + "s"),
  );
  $("minutes-value").textContent = settings.sessionMinutes + " min";
  $("volume-value").textContent = Math.round(settings.volume * 100) + "%";
  if (master)
    master.gain.setTargetAtTime(
      settings.volume * 0.65,
      audio.currentTime,
      0.025,
    );
  persist();
  updateSession();
  animate();
}
const bindings = {
  inhale: "inhale",
  pause: "pause",
  exhale: "exhale",
  "session-minutes": "sessionMinutes",
  "inhale-sound": "inhaleSound",
  "pause-sound": "pauseSound",
  "exhale-sound": "exhaleSound",
  volume: "volume",
  shape: "shape",
  playback: "playback",
  theme: "theme",
  "show-timer": "showTimer",
  "timer-step": "timerStep",
  "show-session": "showSession",
  "reduced-motion": "reducedMotion",
};
["inhale", "pause", "exhale"].forEach((phase) => {
  const select = $(phase + "-sound");
  sounds.forEach((sound) => select.add(new Option(sound.name, sound.id)));
});
Object.entries(bindings).forEach(([id, key]) => {
  const control = $(id);
  if (control.type === "checkbox") control.checked = settings[key];
  else control.value = settings[key];
  control.addEventListener("input", () => {
    const timing = ["inhale", "pause", "exhale", "sessionMinutes"].includes(
      key,
    );
    if (timing && elapsed() > 0) reset();
    settings[key] =
      control.type === "checkbox"
        ? control.checked
        : typeof defaults[key] === "number"
          ? Number(control.value)
          : control.value;
    if (key === "sessionMinutes") settings.sessionMode = "timed";
    applySettings();
    if (key.endsWith("Sound")) {
      stopVoices("session");
      if (session.running) updateSession(true);
    }
  });
});
document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => {
    settings.view = button.dataset.view;
    applySettings();
  }),
);
document.querySelectorAll("[data-palette]").forEach((button) =>
  button.addEventListener("click", () => {
    settings.palette = button.dataset.palette;
    applySettings();
  }),
);
document.querySelectorAll("[data-session]").forEach((button) =>
  button.addEventListener("click", () => {
    if (elapsed() > 0) reset();
    settings.sessionMode =
      button.dataset.session === "continuous" ? "continuous" : "timed";
    if (settings.sessionMode === "timed")
      settings.sessionMinutes = Number(button.dataset.session);
    $("session-minutes").value = settings.sessionMinutes;
    applySettings();
  }),
);
document.querySelectorAll("[data-preview]").forEach((button) =>
  button.addEventListener("click", () => {
    if (session.running) pause();
    stopVoices();
    $("notice").textContent = "";
    playSound(button.dataset.preview, 3, "preview");
  }),
);
$("settings-open").addEventListener("click", () => setDrawer(true));
$("settings-close").addEventListener("click", () => setDrawer(false));
$("scrim").addEventListener("click", () => setDrawer(false));
$("start-stop").addEventListener("click", () =>
  session.running ? pause() : start(),
);
$("reset").addEventListener("click", reset);
document.addEventListener("keydown", (event) => {
  if (!$("settings").classList.contains("open")) return;
  if (event.key === "Escape") setDrawer(false);
  if (event.key === "Tab") {
    const items = Array.from(
      $("settings").querySelectorAll("button,input,select,a"),
    ).filter((item) => !item.disabled);
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (session.running) {
      pause();
      $("notice").textContent = "Session paused while the page was away.";
    }
    stopVoices();
  } else {
    updateSession();
    animate();
  }
});
window.addEventListener("pagehide", () => {
  pause();
  stopVoices();
});
window.addEventListener("resize", draw);
applySettings();

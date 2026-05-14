const SOUND_PRESETS = [
  { name: "Singing bowl", family: "bowl", base: 164.8, harmonics: [1, 2.01, 2.73, 3.98], noise: 0.012, filter: 1600 },
  { name: "Deep temple bowl", family: "bowl", base: 123.5, harmonics: [1, 1.5, 2.02, 2.9], noise: 0.016, filter: 1200 },
  { name: "Tingsha bell", family: "bell", base: 392, harmonics: [1, 2.01, 2.99, 4.2], noise: 0.006, filter: 2400 },
  { name: "Bamboo breath", family: "air", base: 293.7, harmonics: [1, 1.99], noise: 0.16, filter: 1450 },
  { name: "Ocean wash", family: "water", base: 98, harmonics: [1], noise: 0.34, filter: 820 },
  { name: "Rain hush", family: "rain", base: 110, harmonics: [1], noise: 0.28, filter: 1750 },
  { name: "Wind shimmer", family: "air", base: 246.9, harmonics: [1, 1.34, 2.01], noise: 0.18, filter: 2100 },
  { name: "Warm drone", family: "drone", base: 130.8, harmonics: [1, 1.5, 2], noise: 0.035, filter: 900 },
  { name: "Soft heart pulse", family: "pulse", base: 82.4, harmonics: [1, 2], noise: 0.025, filter: 700 },
  { name: "White breath", family: "breath", base: 174.6, harmonics: [1], noise: 0.38, filter: 1050 }
];

const PAUSE_PRESETS = [
  { name: "Low grounding drone", family: "drone", base: 82.4, harmonics: [1, 1.5, 2], noise: 0.025, filter: 620 },
  { name: "Soft hum", family: "drone", base: 110, harmonics: [1, 2.01], noise: 0.035, filter: 780 },
  { name: "Rain bed", family: "rain", base: 92.5, harmonics: [1], noise: 0.26, filter: 1300 },
  { name: "Deep bowl sustain", family: "bowl", base: 98, harmonics: [1, 1.5, 2.02], noise: 0.012, filter: 850 },
  { name: "Quiet ocean floor", family: "water", base: 73.4, harmonics: [1], noise: 0.24, filter: 520 }
];

const state = {
  inhale: 5,
  pause: 0,
  exhale: 5,
  sessionMode: "continuous",
  sessionMinutes: 10,
  inhaleSound: 0,
  exhaleSound: 3,
  pauseSound: 0,
  shape: "fade-out",
  volume: 0.45,
  running: false,
  phase: "ready",
  phaseStartedAt: 0,
  phaseElapsedBeforePause: 0,
  sessionStartedAt: 0,
  elapsedBeforeStart: 0,
  breathCount: 0,
  rafId: null,
  audio: null,
  masterGain: null,
  pauseNodes: null
};

const els = {
  inhale: document.querySelector("#inhale"),
  pause: document.querySelector("#pause"),
  exhale: document.querySelector("#exhale"),
  inhaleValue: document.querySelector("#inhale-value"),
  pauseValue: document.querySelector("#pause-value"),
  exhaleValue: document.querySelector("#exhale-value"),
  breathSummary: document.querySelector("#breath-summary"),
  sessionSummary: document.querySelector("#session-summary"),
  sessionMinutes: document.querySelector("#session-minutes"),
  sessionMinutesValue: document.querySelector("#session-minutes-value"),
  sessionButtons: Array.from(document.querySelectorAll("[data-session]")),
  inhaleSound: document.querySelector("#inhale-sound"),
  exhaleSound: document.querySelector("#exhale-sound"),
  pauseSound: document.querySelector("#pause-sound"),
  soundShape: document.querySelector("#sound-shape"),
  volume: document.querySelector("#volume"),
  volumeValue: document.querySelector("#volume-value"),
  phaseLabel: document.querySelector("#phase-label"),
  phaseTime: document.querySelector("#phase-time"),
  phaseHelper: document.querySelector("#phase-helper"),
  sessionTime: document.querySelector("#session-time"),
  sessionElapsed: document.querySelector("#session-elapsed"),
  breathOrb: document.querySelector("#breath-orb"),
  waveCanvas: document.querySelector("#wave-canvas"),
  wavePhase: document.querySelector("#wave-phase"),
  waveTime: document.querySelector("#wave-time"),
  waveHelper: document.querySelector("#wave-helper"),
  waveSessionTime: document.querySelector("#wave-session-time"),
  waveSessionElapsed: document.querySelector("#wave-session-elapsed"),
  startStop: document.querySelector("#start-stop"),
  dashStartStop: document.querySelector("#dash-start-stop"),
  waveStartStop: document.querySelector("#wave-start-stop"),
  reset: document.querySelector("#reset"),
  dashReset: document.querySelector("#dash-reset"),
  waveReset: document.querySelector("#wave-reset"),
  dashPhase: document.querySelector("#dash-phase"),
  cycleLength: document.querySelector("#cycle-length"),
  dashSession: document.querySelector("#dash-session"),
  breathCount: document.querySelector("#breath-count"),
  previewSound: document.querySelector("#preview-sound"),
  viewButtons: Array.from(document.querySelectorAll("[data-view]")),
  panels: Array.from(document.querySelectorAll("[data-panel]"))
};

function formatSeconds(value) {
  return `${value.toFixed(1)}s`;
}

function formatSession(ms) {
  if (state.sessionMode === "continuous") return "Continuous";
  const total = state.sessionMinutes * 60 * 1000;
  const remaining = Math.max(0, total - ms);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getCycleDuration() {
  return state.inhale + state.pause + state.exhale;
}

function getSessionElapsed(now) {
  if (!state.running) return state.elapsedBeforeStart;
  return state.elapsedBeforeStart + now - state.sessionStartedAt;
}

function hydrateSoundSelect(select, presets, selectedIndex) {
  select.innerHTML = "";
  presets.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = preset.name;
    select.append(option);
  });
  select.value = String(selectedIndex);
}

function ensureAudio() {
  if (!state.audio) {
    state.audio = new AudioContext();
    state.masterGain = state.audio.createGain();
    state.masterGain.gain.value = state.volume;
    state.masterGain.connect(state.audio.destination);
  }

  if (state.audio.state === "suspended") {
    state.audio.resume();
  }
}

function makeNoiseBuffer(audio, duration, color = "pink") {
  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let slow = 0;
  let medium = 0;

  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    slow = slow * 0.985 + white * 0.015;
    medium = medium * 0.92 + white * 0.08;
    data[i] = color === "brown" ? slow : (slow * 0.65 + medium * 0.35);
  }

  return buffer;
}

function applyEnvelope(gain, start, duration, peak) {
  const end = start + duration;
  gain.cancelScheduledValues(start);
  gain.setValueAtTime(0.0001, start);

  if (state.shape === "constant") {
    gain.linearRampToValueAtTime(peak, start + 0.12);
    gain.setValueAtTime(peak, Math.max(start + 0.13, end - 0.18));
    gain.linearRampToValueAtTime(0.0001, end);
    return;
  }

  if (state.shape === "swell") {
    gain.linearRampToValueAtTime(peak * 0.28, start + 0.12);
    gain.linearRampToValueAtTime(peak, start + duration * 0.52);
    gain.linearRampToValueAtTime(0.0001, end);
    return;
  }

  gain.linearRampToValueAtTime(peak, start + 0.08);
  gain.exponentialRampToValueAtTime(0.0001, end);
}

function createFilter(audio, preset, direction, start, duration) {
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.8;
  const base = preset.filter || 1200;
  const startFreq = direction === "out" ? base * 1.2 : base * 0.72;
  const endFreq = direction === "out" ? base * 0.62 : base * 1.12;
  filter.frequency.setValueAtTime(startFreq, start);
  filter.frequency.linearRampToValueAtTime(endFreq, start + duration);
  return filter;
}

function makeTremolo(audio, start, duration, depth = 0.08, rate = 0.18) {
  const tremoloGain = audio.createGain();
  const lfo = audio.createOscillator();
  const lfoGain = audio.createGain();
  tremoloGain.gain.value = 1 - depth;
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain);
  lfoGain.connect(tremoloGain.gain);
  lfo.start(start);
  lfo.stop(start + duration + 0.08);
  return tremoloGain;
}

function playMeditationSound(presets, presetIndex, duration, direction = "in", options = {}) {
  ensureAudio();
  const audio = state.audio;
  const preset = presets[presetIndex];
  const startedAt = audio.currentTime + 0.02;
  const safeDuration = Math.max(0.2, duration);
  const output = audio.createGain();
  const filter = createFilter(audio, preset, direction, startedAt, safeDuration);
  const tremolo = makeTremolo(audio, startedAt, safeDuration, preset.family === "pulse" ? 0.18 : 0.055, preset.family === "pulse" ? 0.9 : 0.16);
  const nodes = [output, filter, tremolo];

  output.gain.value = 0.0001;
  output.connect(filter);
  filter.connect(tremolo);
  tremolo.connect(state.masterGain);
  applyEnvelope(output.gain, startedAt, safeDuration, options.peak || (direction === "pause" ? 0.34 : 0.58));

  preset.harmonics.forEach((multiple, index) => {
    const oscillator = audio.createOscillator();
    const toneGain = audio.createGain();
    const directionRatio = direction === "out" ? 0.82 : 1;
    const detune = (index % 2 === 0 ? -1 : 1) * (preset.family === "bowl" ? 4 : 1.6);
    oscillator.type = preset.family === "bell" ? "triangle" : "sine";
    oscillator.frequency.value = preset.base * multiple * directionRatio;
    oscillator.detune.setValueAtTime(detune, startedAt);
    oscillator.detune.linearRampToValueAtTime(-detune * 0.4, startedAt + safeDuration);
    toneGain.gain.value = (preset.family === "air" || preset.family === "breath" ? 0.18 : 0.3) / (index + 1);
    oscillator.connect(toneGain);
    toneGain.connect(output);
    oscillator.start(startedAt);
    oscillator.stop(startedAt + safeDuration + 0.04);
    nodes.push(oscillator, toneGain);
  });

  if (preset.noise > 0) {
    const noise = audio.createBufferSource();
    const noiseGain = audio.createGain();
    const color = preset.family === "water" || preset.family === "drone" ? "brown" : "pink";
    noise.buffer = makeNoiseBuffer(audio, safeDuration, color);
    noiseGain.gain.value = preset.noise;
    noise.connect(noiseGain);
    noiseGain.connect(output);
    noise.start(startedAt);
    noise.stop(startedAt + safeDuration);
    nodes.push(noise, noiseGain);
  }

  return { nodes, output };
}

function startPauseSound(duration) {
  if (duration <= 0) return;
  stopPauseSound();
  state.pauseNodes = playMeditationSound(PAUSE_PRESETS, state.pauseSound, duration, "pause", { peak: 0.24 });
}

function stopPauseSound() {
  if (!state.pauseNodes) return;
  const audio = state.audio;
  const now = audio ? audio.currentTime : 0;
  try {
    state.pauseNodes.output.gain.cancelScheduledValues(now);
    state.pauseNodes.output.gain.setTargetAtTime(0.0001, now, 0.04);
    state.pauseNodes.nodes.forEach((node) => {
      if (typeof node.stop === "function") {
        node.stop(now + 0.1);
      }
    });
  } catch (error) {
    // Nodes may have already stopped at the end of the scheduled pause.
  }
  state.pauseNodes = null;
}

function setPhase(phase, now) {
  state.phase = phase;
  state.phaseStartedAt = now;
  state.phaseElapsedBeforePause = 0;
  els.breathOrb.classList.toggle("paused", phase === "pause");

  if (phase === "inhale") {
    stopPauseSound();
    playMeditationSound(SOUND_PRESETS, state.inhaleSound, state.inhale, "in");
  } else if (phase === "pause") {
    startPauseSound(state.pause);
  } else if (phase === "exhale") {
    stopPauseSound();
    playMeditationSound(SOUND_PRESETS, state.exhaleSound, state.exhale, "out");
  } else {
    stopPauseSound();
  }
}

function nextPhase(now) {
  if (state.phase === "inhale") {
    if (state.pause > 0) {
      setPhase("pause", now);
    } else {
      setPhase("exhale", now);
    }
    return;
  }

  if (state.phase === "pause") {
    setPhase("exhale", now);
    return;
  }

  state.breathCount += 1;
  setPhase("inhale", now);
}

function updateOrb(progress) {
  let scale = 1;
  if (state.phase === "inhale") {
    scale = 1 + progress * 0.32;
  } else if (state.phase === "pause") {
    scale = 1.32;
  } else if (state.phase === "exhale") {
    scale = 1.32 - progress * 0.32;
  }
  els.breathOrb.style.transform = `scale(${scale})`;
}

function getBreathLevel(phase, progress) {
  if (phase === "inhale") return progress;
  if (phase === "pause") return 1;
  if (phase === "exhale") return 1 - progress;
  return 0;
}

function getCycleLevelAt(seconds) {
  const cycle = getCycleDuration();
  if (cycle <= 0) return 0;
  let position = ((seconds % cycle) + cycle) % cycle;

  if (position <= state.inhale) {
    return 0.5 - Math.cos((position / state.inhale) * Math.PI) * 0.5;
  }

  position -= state.inhale;
  if (state.pause > 0 && position <= state.pause) {
    return 1;
  }

  position -= state.pause;
  return 0.5 + Math.cos((Math.min(position, state.exhale) / state.exhale) * Math.PI) * 0.5;
}

function drawWave(progress, phaseElapsed) {
  const canvas = els.waveCanvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width;
  const h = rect.height;
  const pad = Math.max(22, Math.min(w, h) * 0.08);
  const top = pad;
  const bottom = h - pad;
  const mid = (top + bottom) / 2;
  const amp = (bottom - top) / 2;
  const cycle = getCycleDuration();
  const samples = 220;
  const visibleSeconds = cycle * 2.25;
  const elapsedInCycle = state.phase === "ready" || state.phase === "complete"
    ? 0
    : state.breathCount * cycle + (state.phase === "inhale" ? phaseElapsed : state.phase === "pause" ? state.inhale + phaseElapsed : state.inhale + state.pause + phaseElapsed);

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "rgba(255, 253, 248, 0.72)");
  bg.addColorStop(0.58, "rgba(238, 245, 243, 0.8)");
  bg.addColorStop(1, "rgba(245, 239, 232, 0.74)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(31, 41, 51, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, mid);
  ctx.lineTo(w - pad, mid);
  ctx.stroke();

  ctx.strokeStyle = "rgba(47, 143, 131, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const x = pad + ((w - pad * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  ctx.beginPath();
  for (let i = 0; i <= samples; i += 1) {
    const ratio = i / samples;
    const seconds = elapsedInCycle - visibleSeconds * 0.44 + ratio * visibleSeconds;
    const level = getCycleLevelAt(seconds);
    const x = pad + ratio * (w - pad * 2);
    const y = bottom - level * amp * 2;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  const line = ctx.createLinearGradient(pad, 0, w - pad, 0);
  line.addColorStop(0, "rgba(73, 106, 156, 0.34)");
  line.addColorStop(0.48, "rgba(47, 143, 131, 0.98)");
  line.addColorStop(1, "rgba(208, 111, 81, 0.56)");
  ctx.strokeStyle = line;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  const currentLevel = getBreathLevel(state.phase, progress);
  const markerX = pad + (w - pad * 2) * 0.44;
  const markerY = bottom - currentLevel * amp * 2;
  ctx.fillStyle = "rgba(255, 253, 248, 0.95)";
  ctx.strokeStyle = "rgba(31, 41, 51, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(markerX, markerY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = state.phase === "exhale" ? "#d06f51" : "#2f8f83";
  ctx.beginPath();
  ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
  ctx.fill();
}

function render(now = performance.now()) {
  const durations = {
    ready: state.inhale,
    inhale: state.inhale,
    pause: state.pause,
    exhale: state.exhale,
    complete: 0
  };
  const phaseNames = {
    ready: "Ready",
    inhale: "Breathe in",
    pause: "Pause",
    exhale: "Breathe out",
    complete: "Complete"
  };
  const duration = durations[state.phase] || state.inhale;
  const elapsed = state.running ? (now - state.phaseStartedAt) / 1000 : 0;

  if (state.running && elapsed >= duration) {
    nextPhase(now);
    return render(now);
  }

  const phaseElapsed = state.running ? Math.max(0, elapsed) : 0;
  const remaining = Math.max(0, duration - phaseElapsed);
  const progress = duration > 0 ? Math.min(1, phaseElapsed / duration) : 0;
  const sessionElapsed = getSessionElapsed(now);

  if (state.running && state.sessionMode !== "continuous" && sessionElapsed >= state.sessionMinutes * 60 * 1000) {
    completeSession(now);
    return;
  }

  updateOrb(progress);
  drawWave(progress, phaseElapsed);
  els.phaseLabel.textContent = phaseNames[state.phase];
  els.phaseTime.textContent = state.phase === "complete" ? "0.0" : remaining.toFixed(1);
  els.phaseHelper.textContent = state.running ? `${Math.round(progress * 100)}%` : "Press start";
  els.sessionTime.textContent = formatSession(sessionElapsed);
  els.sessionElapsed.textContent = `${formatElapsed(sessionElapsed)} elapsed`;
  els.wavePhase.textContent = phaseNames[state.phase];
  els.waveTime.textContent = state.phase === "complete" ? "0.0" : remaining.toFixed(1);
  els.waveHelper.textContent = state.running ? `${Math.round(progress * 100)}%` : "Press start";
  els.waveSessionTime.textContent = formatSession(sessionElapsed);
  els.waveSessionElapsed.textContent = `${formatElapsed(sessionElapsed)} elapsed`;
  els.dashPhase.textContent = phaseNames[state.phase];
  els.dashSession.textContent = formatSession(sessionElapsed);
  els.breathCount.textContent = String(state.breathCount);
}

function tick(now) {
  render(now);
  if (state.running) {
    state.rafId = requestAnimationFrame(tick);
  }
}

function start() {
  ensureAudio();
  const now = performance.now();
  state.running = true;
  state.sessionStartedAt = now;
  if (state.phase === "ready" || state.phase === "complete") {
    state.elapsedBeforeStart = 0;
    state.breathCount = 0;
    setPhase("inhale", now);
  } else {
    state.phaseStartedAt = now - state.phaseElapsedBeforePause * 1000;
    const remaining = Math.max(0.2, ({
      inhale: state.inhale,
      pause: state.pause,
      exhale: state.exhale
    }[state.phase] || state.inhale) - state.phaseElapsedBeforePause);

    if (state.phase === "inhale") {
      playMeditationSound(SOUND_PRESETS, state.inhaleSound, remaining, "in");
    } else if (state.phase === "pause") {
      startPauseSound(remaining);
    } else if (state.phase === "exhale") {
      playMeditationSound(SOUND_PRESETS, state.exhaleSound, remaining, "out");
    }
  }
  syncTransport();
  tick(now);
}

function stop() {
  const now = performance.now();
  state.elapsedBeforeStart = getSessionElapsed(now);
  state.phaseElapsedBeforePause = Math.max(0, (now - state.phaseStartedAt) / 1000);
  state.running = false;
  cancelAnimationFrame(state.rafId);
  stopPauseSound();
  syncTransport();
  render();
}

function reset() {
  state.running = false;
  state.phase = "ready";
  state.phaseStartedAt = 0;
  state.phaseElapsedBeforePause = 0;
  state.sessionStartedAt = 0;
  state.elapsedBeforeStart = 0;
  state.breathCount = 0;
  cancelAnimationFrame(state.rafId);
  stopPauseSound();
  syncTransport();
  render();
}

function completeSession(now) {
  state.running = false;
  state.phase = "complete";
  state.phaseElapsedBeforePause = 0;
  state.elapsedBeforeStart = state.sessionMinutes * 60 * 1000;
  cancelAnimationFrame(state.rafId);
  stopPauseSound();
  syncTransport();
  render(now);
}

function syncTransport() {
  const label = state.running ? "Pause" : "Start";
  els.startStop.textContent = label;
  els.dashStartStop.textContent = label;
  els.waveStartStop.textContent = label;
}

function syncSettings() {
  state.inhale = Number(els.inhale.value);
  state.pause = Number(els.pause.value);
  state.exhale = Number(els.exhale.value);
  state.sessionMinutes = Number(els.sessionMinutes.value);
  state.inhaleSound = Number(els.inhaleSound.value);
  state.exhaleSound = Number(els.exhaleSound.value);
  state.pauseSound = Number(els.pauseSound.value);
  state.shape = els.soundShape.value;
  state.volume = Number(els.volume.value);

  if (state.masterGain) {
    state.masterGain.gain.setTargetAtTime(state.volume, state.audio.currentTime, 0.03);
  }

  els.inhaleValue.textContent = formatSeconds(state.inhale);
  els.pauseValue.textContent = formatSeconds(state.pause);
  els.exhaleValue.textContent = formatSeconds(state.exhale);
  els.breathSummary.textContent = `${state.inhale.toFixed(1)} / ${state.pause.toFixed(1)} / ${state.exhale.toFixed(1)}s`;
  els.sessionMinutesValue.textContent = `${state.sessionMinutes} min`;
  els.sessionSummary.textContent = state.sessionMode === "continuous" ? "Continuous" : `${state.sessionMinutes} min`;
  els.volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  els.cycleLength.textContent = `${getCycleDuration().toFixed(1)}s`;

  if (state.phase === "ready") {
    els.phaseTime.textContent = state.inhale.toFixed(1);
  }

  render();
}

function setSessionMode(mode) {
  state.sessionMode = mode;
  if (mode !== "continuous") {
    state.sessionMinutes = Number(mode);
    els.sessionMinutes.value = mode;
  }

  els.sessionButtons.forEach((button) => {
    const active = button.dataset.session === mode;
    button.classList.toggle("active", active);
  });
  syncSettings();
}

function setView(view) {
  els.viewButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  els.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === view);
  });

  render();
}

function previewSound() {
  playMeditationSound(SOUND_PRESETS, state.inhaleSound, 2.4, "in");
  window.setTimeout(() => startPauseSound(1.2), 700);
  window.setTimeout(() => playMeditationSound(SOUND_PRESETS, state.exhaleSound, 2.4, "out"), 1500);
}

hydrateSoundSelect(els.inhaleSound, SOUND_PRESETS, state.inhaleSound);
hydrateSoundSelect(els.exhaleSound, SOUND_PRESETS, state.exhaleSound);
hydrateSoundSelect(els.pauseSound, PAUSE_PRESETS, state.pauseSound);

[els.inhale, els.pause, els.exhale, els.sessionMinutes, els.inhaleSound, els.exhaleSound, els.pauseSound, els.soundShape, els.volume]
  .forEach((control) => {
    control.addEventListener("input", () => {
      if (control === els.sessionMinutes) {
        state.sessionMode = String(els.sessionMinutes.value);
        els.sessionButtons.forEach((button) => button.classList.toggle("active", false));
      }
      syncSettings();
    });
  });

els.sessionButtons.forEach((button) => {
  button.addEventListener("click", () => setSessionMode(button.dataset.session));
});

els.viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

[els.startStop, els.dashStartStop, els.waveStartStop].forEach((button) => {
  button.addEventListener("click", () => {
    if (state.running) {
      stop();
    } else {
      start();
    }
  });
});

[els.reset, els.dashReset, els.waveReset].forEach((button) => {
  button.addEventListener("click", reset);
});

els.previewSound.addEventListener("click", previewSound);
window.addEventListener("resize", () => render());

syncSettings();
render();

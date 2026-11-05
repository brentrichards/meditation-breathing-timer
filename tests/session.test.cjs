const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
let now = 0;
const elements = new Map();
const documentEvents = {};
const sources = [];
const drawingLog = [];
let scheduledFrames = 0;
const drawing = new Proxy(
  {},
  {
    get: (_, name) =>
      name === "createRadialGradient" || name === "createLinearGradient"
        ? () => ({ addColorStop() {} })
        : (...args) => drawingLog.push([name, ...args]),
  },
);
function element(id) {
  if (!elements.has(id))
    elements.set(id, {
      id,
      value: "",
      checked: false,
      textContent: "",
      hidden: false,
      type: "select",
      dataset: {},
      style: { setProperty() {} },
      classList: {
        toggle() {},
        add() {},
        remove() {},
        contains() {
          return false;
        },
      },
      setAttribute() {},
      events: {},
      addEventListener(name, fn) {
        this.events[name] = fn;
      },
      focus() {},
      add() {},
      querySelectorAll() {
        return [];
      },
      getBoundingClientRect() {
        return { width: 800, height: 400 };
      },
      getContext() {
        return drawing;
      },
    });
  return elements.get(id);
}
class Param {
  setValueAtTime(v) {
    this.value = v;
  }
  linearRampToValueAtTime(v) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v) {
    this.value = v;
  }
  setTargetAtTime(v) {
    this.value = v;
  }
  cancelScheduledValues() {}
}
class AudioNode {
  constructor() {
    this.gain = new Param();
    this.frequency = new Param();
    this.detune = new Param();
    this.Q = {};
    this.threshold = {};
    this.ratio = {};
  }
  connect() {}
  disconnect() {}
  start() {
    sources.push(this);
  }
  stop(t) {
    this.stopTime = t;
  }
}
class Audio {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 100;
    this.destination = {};
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return new AudioNode();
  }
  createDynamicsCompressor() {
    return new AudioNode();
  }
  createBiquadFilter() {
    return new AudioNode();
  }
  createOscillator() {
    return new AudioNode();
  }
  createBufferSource() {
    return new AudioNode();
  }
  createBuffer(_, size) {
    return { getChannelData: () => new Float32Array(size) };
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 8 });
  }
}
const context = vm.createContext({
  console,
  Uint8Array,
  Float32Array,
  Option: function () {},
  performance: { now: () => now },
  localStorage: { getItem: () => null, setItem() {} },
  location: { protocol: "http:" },
  window: {
    matchMedia: () => ({ matches: false }),
    AudioContext: Audio,
    devicePixelRatio: 1,
    addEventListener() {},
  },
  document: {
    getElementById: element,
    querySelectorAll: () => [],
    hidden: false,
    body: element("body"),
    documentElement: element("html"),
    addEventListener: (name, fn) => {
      documentEvents[name] = fn;
    },
  },
  setInterval: () => 1,
  clearInterval() {},
  requestAnimationFrame: () => ++scheduledFrames,
  cancelAnimationFrame() {},
  fetch: async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(10),
  }),
});
vm.runInContext(
  fs.readFileSync(require("node:path").join(__dirname, "../app.js"), "utf8"),
  context,
);
const run = (code) => vm.runInContext(code, context);
async function main() {
  assert.equal(element("breath-timer").hidden, false);
  const sourceCode = fs.readFileSync(
    require("node:path").join(__dirname, "../app.js"),
    "utf8",
  );
  const originalVisibilityHandler = documentEvents.visibilitychange;
  const originalInputs = new Map(
    Array.from(elements, ([id, node]) => [id, { ...node.events }]),
  );
  for (const version of [undefined, 3]) {
    const migration = vm.createContext({
      ...context,
      window: { ...context.window, matchMedia: () => ({ matches: true }) },
      localStorage: {
        getItem: () =>
          JSON.stringify({
            showTimer: false,
            reducedMotion: true,
            displayVersion: version,
          }),
        setItem() {},
      },
    });
    vm.runInContext(sourceCode, migration);
    assert.equal(
      vm.runInContext("settings.showTimer", migration),
      version !== 3,
    );
    assert.equal(vm.runInContext("settings.reducedMotion", migration), true);
  }
  documentEvents.visibilitychange = originalVisibilityHandler;
  originalInputs.forEach((events, id) => {
    element(id).events = events;
  });
  run("settings.showTimer = false");
  element("timer-step").value = "0.5";
  element("timer-step").events.input();
  assert.equal(element("breath-timer").hidden, false);
  run("settings.timerStep = 1; settings.reducedMotion = true");
  await run("start()");
  assert.ok(
    scheduledFrames > 0,
    "Gentler motion must schedule animation frames",
  );
  for (const view of ["circle", "wave", "petal"]) {
    now = 0;
    run("settings.view = " + JSON.stringify(view) + "; draw()");
    const before = JSON.stringify(drawingLog.splice(0));
    now = 2500;
    run("draw()");
    assert.notEqual(
      JSON.stringify(drawingLog.splice(0)),
      before,
      view + " must move with reduced motion enabled",
    );
  }
  run("reset(); settings.reducedMotion = false");
  now = 0;
  assert.ok(run("sounds.find(s => s.id === 'stream').q") < 0.5);
  assert.ok(run("sounds.find(s => s.id === 'stream').driftRate") < 0.1);
  assert.equal(run("locate(0).phase"), "inhale");
  assert.equal(run("locate(5).phase"), "exhale");
  run("settings.pause = 1.2");
  assert.equal(run("locate(5.5).phase"), "pause");
  assert.equal(run("locate(6.3).phase"), "exhale");
  assert.equal(run("levelAt(0)"), 0);
  assert.equal(run("levelAt(5.5)"), 1);
  await run("start()");
  now = 2300;
  run("updateSession()");
  run("pause()");
  const frozen = run("elapsed()");
  now = 8000;
  run("updateSession()");
  assert.equal(run("elapsed()"), frozen);
  assert.ok(Math.abs(run("session.progress") - 0.46) < 1e-10);
  await run("start()");
  now = 9000;
  run("updateSession()");
  assert.ok(Math.abs(run("elapsed()") - 3.3) < 1e-10);
  run("pause()");
  for (const step of [0.1, 0.2, 0.5, 1]) {
    run(
      "settings.showTimer = true; settings.timerStep = " +
        step +
        "; updateSession()",
    );
    assert.equal(
      Number(element("breath-timer").textContent),
      { 0.1: 1.7, 0.2: 1.8, 0.5: 2, 1: 2 }[String(step)],
    );
  }
  run("reset(); settings.sessionMode = 'timed'; settings.sessionMinutes = 3");
  await run("start()");
  now += 180001;
  run("updateSession()");
  assert.equal(run("session.complete"), true);
  assert.equal(run("session.running"), false);
  assert.equal(element("elapsed").textContent, "3:00 elapsed");
  assert.equal(element("session-time").textContent, "0:00");
  assert.equal(run("voices.size"), 0);
  run("reset(); settings.sessionMode = 'continuous'");
  for (const sound of run("sounds.map(s => s.id)")) {
    run("settings.inhaleSound = " + JSON.stringify(sound));
    await run("playSound('inhale', 0.1)");
    run("stopVoices()");
    assert.equal(run("voices.size"), 0);
  }
  assert.ok(sources.length > 0);
  assert.ok(sources.every((source) => Number.isFinite(source.stopTime)));
  run("settings.inhaleSound = 'bowl'");
  await run("start()");
  now += 1000;
  context.document.hidden = true;
  documentEvents.visibilitychange();
  assert.equal(run("session.running"), false);
  assert.equal(run("voices.size"), 0);
  assert.match(element("notice").textContent, /paused/);
}
main()
  .then(() =>
    console.log(
      "Session, countdown, completion, presets, audio cancellation and interruption checks passed.",
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

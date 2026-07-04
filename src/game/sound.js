let ctx;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, duration, { type = "sine", startTime = 0, gain = 0.2 } = {}) {
  const audio = getCtx();
  if (!audio) return;

  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const t0 = audio.currentTime + startTime;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.connect(g);
  g.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playHit() {
  tone(520, 0.12, { type: "square", gain: 0.15 });
}

export function playMiss() {
  tone(160, 0.08, { type: "sine", gain: 0.08 });
}

export function playSink() {
  tone(300, 0.18, { type: "sawtooth", gain: 0.18 });
  tone(140, 0.28, { type: "sawtooth", startTime: 0.1, gain: 0.2 });
}

export function playBoom() {
  tone(110, 0.35, { type: "sawtooth", gain: 0.25 });
  tone(70, 0.4, { type: "sawtooth", startTime: 0.05, gain: 0.22 });
}

export function playPing() {
  tone(880, 0.25, { type: "sine", gain: 0.12 });
  tone(1320, 0.2, { type: "sine", startTime: 0.08, gain: 0.08 });
}

export function playChime() {
  tone(523, 0.14, { type: "triangle", gain: 0.16 });
  tone(659, 0.14, { type: "triangle", startTime: 0.1, gain: 0.16 });
  tone(784, 0.22, { type: "triangle", startTime: 0.2, gain: 0.16 });
}

export function playVictory() {
  tone(523, 0.16, { type: "triangle", gain: 0.18 });
  tone(659, 0.16, { type: "triangle", startTime: 0.14, gain: 0.18 });
  tone(784, 0.16, { type: "triangle", startTime: 0.28, gain: 0.18 });
  tone(1047, 0.35, { type: "triangle", startTime: 0.42, gain: 0.2 });
}

export function playDefeat() {
  tone(300, 0.3, { type: "sine", gain: 0.16 });
  tone(220, 0.35, { type: "sine", startTime: 0.22, gain: 0.16 });
  tone(160, 0.5, { type: "sine", startTime: 0.44, gain: 0.16 });
}

export function playEventSounds(events) {
  for (const event of events) {
    const msg = event.toLowerCase();
    if (msg.includes("victory")) playVictory();
    else if (msg.includes("got away")) playDefeat();
    else if (msg.includes("sunk")) playSink();
    else if (msg.includes("record") || msg.includes("streak!") || msg.includes("surprise") || msg.includes("recon")) {
      playChime();
    }
  }
}

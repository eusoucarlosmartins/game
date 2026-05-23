// audio.js — síntese procedural via Web Audio API. Sem arquivos externos.
// Tons curtos e suaves pra feedback de interação.
import { state } from './state.js';

/** @type {AudioContext|null} */
let ctx = null;

function getCtx() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

// Toca um tom único ADSR-like.
function tone(c, { freq, dur = 0.08, vol = 0.08, type = 'sine', sweep = 0 }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.connect(g);
  g.connect(c.destination);
  const t0 = c.currentTime;
  o.frequency.setValueAtTime(freq, t0);
  if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// Ruído branco curto (pra explosão, swoosh)
function noise(c, { dur = 0.2, vol = 0.15 } = {}) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // ruído com decay exponencial
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g);
  g.connect(c.destination);
  src.start();
}

const SOUNDS = {
  click(c) {
    tone(c, { freq: 600, dur: 0.04, vol: 0.05, type: 'square' });
  },
  pickaxe(c) {
    tone(c, { freq: 220, dur: 0.06, vol: 0.06, type: 'triangle', sweep: -120 });
  },
  boom(c) {
    noise(c, { dur: 0.35, vol: 0.18 });
    tone(c, { freq: 110, dur: 0.4, vol: 0.12, type: 'sawtooth', sweep: -80 });
  },
  coin(c) {
    tone(c, { freq: 880, dur: 0.06, vol: 0.06, type: 'square' });
    setTimeout(() => tone(c, { freq: 1320, dur: 0.08, vol: 0.06, type: 'square' }), 60);
  },
  success(c) {
    // acorde maior ascendente
    tone(c, { freq: 523, dur: 0.12, vol: 0.06, type: 'triangle' });
    setTimeout(() => tone(c, { freq: 659, dur: 0.12, vol: 0.06, type: 'triangle' }), 100);
    setTimeout(() => tone(c, { freq: 784, dur: 0.18, vol: 0.07, type: 'triangle' }), 200);
  },
  chime(c) {
    // sino brilhante (chord)
    tone(c, { freq: 1046, dur: 0.4, vol: 0.05, type: 'sine' });
    tone(c, { freq: 1318, dur: 0.4, vol: 0.04, type: 'sine' });
    tone(c, { freq: 1568, dur: 0.4, vol: 0.03, type: 'sine' });
  },
  whoosh(c) {
    noise(c, { dur: 0.25, vol: 0.06 });
  },
  fail(c) {
    tone(c, { freq: 220, dur: 0.18, vol: 0.08, type: 'sawtooth', sweep: -120 });
  },
};

export function play(type) {
  if (state.muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }
  const fn = SOUNDS[type];
  if (fn) {
    try { fn(c); } catch { /* ignore */ }
  }
}

// "Desperta" o AudioContext na primeira interação (políticas de autoplay)
export function unlockOnFirstGesture() {
  const wake = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    document.removeEventListener('click', wake);
    document.removeEventListener('keydown', wake);
  };
  document.addEventListener('click', wake, { once: true });
  document.addEventListener('keydown', wake, { once: true });
}

export function toggleMute() {
  state.muted = !state.muted;
  return state.muted;
}

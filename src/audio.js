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
  era_up(c) {
    // Fanfarra grande de transição de era — 5 notas ascendentes longas
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        tone(c, { freq, dur: 0.35, vol: 0.07, type: 'triangle' });
        // Harmônico mais grave em cada nota pra "encorpar"
        tone(c, { freq: freq / 2, dur: 0.35, vol: 0.04, type: 'sine' });
      }, i * 130);
    });
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

// ===== Música ambiente procedural por era =====
// Sparse, suave. Notas espalhadas no tempo formando um colchão sonoro.
// Cada era adiciona instrumentos/notas pra dar sensação de evolução.
// MUSIC_PATTERNS[era] = { tempo (s entre notas), vol, notes (Hz array),
// bass (Hz harmônico opcional), type (waveform) }
const MUSIC_PATTERNS = {
  1: { tempo: 7, vol: 0.025, notes: [220, 247, 220, 196], type: 'triangle' },
  2: { tempo: 6, vol: 0.028, notes: [220, 277, 247, 220, 196, 220], type: 'triangle', bass: 110 },
  3: { tempo: 5.5, vol: 0.03, notes: [220, 277, 330, 277, 247, 220, 196], type: 'triangle', bass: 110 },
  4: { tempo: 5, vol: 0.032, notes: [196, 247, 294, 392, 294, 247, 196, 247], type: 'sine', bass: 98 },
  5: { tempo: 4.5, vol: 0.035, notes: [196, 247, 294, 392, 494, 392, 294, 247], type: 'sine', bass: 98 },
  6: { tempo: 4, vol: 0.038, notes: [196, 247, 294, 392, 494, 587, 494, 392, 294], type: 'sine', bass: 98 },
};

let musicTimer = null;
let noteIdx = 0;
let currentMusicEra = 0;
let musicEnabled = true;

function tickMusic() {
  if (state.muted || !musicEnabled || state.over || state.speed === 0) {
    scheduleNextNote(2);
    return;
  }
  const era = state.eraReached || 1;
  const pattern = MUSIC_PATTERNS[era] || MUSIC_PATTERNS[1];
  if (era !== currentMusicEra) {
    noteIdx = 0;
    currentMusicEra = era;
  }
  const c = getCtx();
  if (c) {
    if (c.state === 'suspended') c.resume().catch(() => {});
    try {
      const freq = pattern.notes[noteIdx % pattern.notes.length];
      tone(c, { freq, dur: 1.8, vol: pattern.vol, type: pattern.type });
      // Bass harmônico de fundo (alguns patterns)
      if (pattern.bass && noteIdx % 2 === 0) {
        tone(c, { freq: pattern.bass, dur: 2.5, vol: pattern.vol * 0.6, type: 'sine' });
      }
    } catch { /* ignore */ }
  }
  noteIdx++;
  // Tempo varia ±20% pra não ficar mecânico
  const variance = 0.8 + Math.random() * 0.4;
  scheduleNextNote(pattern.tempo * variance);
}

function scheduleNextNote(seconds = 5) {
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = setTimeout(tickMusic, seconds * 1000);
}

export function startMusic() {
  if (musicTimer) return;
  // Espera 3s antes da primeira nota pra não tocar logo no carregamento
  scheduleNextNote(3);
}

export function stopMusic() {
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
}

export function toggleMusic() {
  musicEnabled = !musicEnabled;
  state.musicEnabled = musicEnabled;
  if (musicEnabled) startMusic(); else stopMusic();
  return musicEnabled;
}

export function isMusicEnabled() {
  return musicEnabled && !state.muted;
}

export function syncMusicPreference() {
  if (typeof state.musicEnabled === 'boolean') musicEnabled = state.musicEnabled;
}

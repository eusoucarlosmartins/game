// audio.test.js — smoke test do módulo de audio.
// happy-dom não tem AudioContext, então o módulo deve degradar
// silenciosamente sem quebrar.
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { play, toggleMute } from '../src/audio.js';

beforeEach(() => {
  state.muted = false;
});

describe('audio (degrada quando Web Audio indisponível)', () => {
  it('play() não lança quando AudioContext não existe', () => {
    expect(() => play('click')).not.toThrow();
    expect(() => play('boom')).not.toThrow();
    expect(() => play('coin')).not.toThrow();
  });

  it('play() é no-op quando muted', () => {
    state.muted = true;
    expect(() => play('chime')).not.toThrow();
  });

  it('play() ignora tipo desconhecido', () => {
    expect(() => play('inexistente')).not.toThrow();
  });
});

describe('toggleMute', () => {
  it('alterna o estado e retorna o novo valor', () => {
    state.muted = false;
    expect(toggleMute()).toBe(true);
    expect(state.muted).toBe(true);
    expect(toggleMute()).toBe(false);
    expect(state.muted).toBe(false);
  });
});

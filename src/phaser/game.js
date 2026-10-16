// @ts-nocheck
// phaser/game.js — bootstrap do Phaser (ponto de entrada alternativo ao canvas)
import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import OverworldScene from './scenes/OverworldScene.js';
import MineScene from './scenes/MineScene.js';
import { state } from '../state.js';
import { updateMine } from '../mine.js';
import { updateFactories } from '../factories.js';
import { updateWagon } from '../wagon.js';
import { updateContract, updateDay } from '../contracts.js';
import { updateEvents } from '../events.js';
import { updateProjects } from '../projects.js';
import { checkAchievements, updateAchievementToast } from '../achievements.js';

/**
 * Boot da versão Phaser do jogo. Mantém toda a lógica de state/updates
 * do canvas; apenas troca o renderer.
 */
export function startPhaserGame() {
  const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'phaser-container',
    backgroundColor: '#c9b282',
    scene: [BootScene, OverworldScene, MineScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  };
  const game = new Phaser.Game(config);

  // Hook: Phaser dispara eventos a cada frame — rodamos o tick do jogo nele.
  let lastT = performance.now();
  game.events.on('step', (time) => {
    if (state.over) return;
    const dt = Math.min(0.1, (time - lastT) / 1000) * state.speed;
    lastT = time;
    try {
      updateMine(dt);
      updateFactories(dt);
      updateWagon(dt);
      updateContract(dt);
      updateEvents(dt);
      updateProjects(dt);
      updateDay(dt);
      checkAchievements();
      updateAchievementToast(dt);
    } catch (err) {
      console.error('[phaser-tick]', err);
    }
  });

  return game;
}

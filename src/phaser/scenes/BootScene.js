// @ts-nocheck
// phaser/scenes/BootScene.js — pré-carrega sprites + mostra progresso
import Phaser from 'phaser';

const SPRITE_IDS = [
  'miner', 'miner-anim', 'wagon-horse', 'church', 'house-yellow',
  'house-green', 'factory', 'tree', 'mine-entrance', 'mercado', 'pesquisa',
];

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    const { width, height } = this.cameras.main;
    // Progress bar
    const bar = this.add.graphics();
    const progressTxt = this.add.text(width / 2, height / 2 + 40, 'Carregando sprites…', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#c69042',
    }).setOrigin(0.5);
    this.load.on('progress', (p) => {
      bar.clear();
      bar.fillStyle(0x5a3416, 1);
      bar.fillRect(width / 2 - 150, height / 2 - 2, 300, 4);
      bar.fillStyle(0xc69042, 1);
      bar.fillRect(width / 2 - 150, height / 2 - 2, 300 * p, 4);
    });
    // Carrega todos os SVG sprites
    for (const id of SPRITE_IDS) {
      this.load.svg(id, `./sprites/${id}.svg`);
    }
    this.load.on('complete', () => {
      bar.destroy();
      progressTxt.destroy();
      this.scene.start('OverworldScene');
    });
  }
}

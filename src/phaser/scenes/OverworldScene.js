// @ts-nocheck
// phaser/scenes/OverworldScene.js — mapa com minas, fábricas, cidade
import Phaser from 'phaser';
import { state } from '../../state.js';
import { OVERWORLD, factoryRect, ROAD, CITY } from '../../geometry.js';
import { CIV_BY_ID } from '../../data.js';

export default class OverworldScene extends Phaser.Scene {
  constructor() { super({ key: 'OverworldScene' }); }

  create() {
    const { width, height } = this.cameras.main;
    // Background parchment gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xd4b478, 0xd4b478, 0xb89058, 0xb89058, 1);
    bg.fillRect(0, 0, width, height);
    // Textura pontilhada
    const tex = this.add.graphics();
    tex.fillStyle(0x5a3410, 0.08);
    for (let i = 0; i < 240; i++) {
      const x = (i * 137) % width;
      const y = (i * 89) % height;
      tex.fillRect(x, y, 2, 2);
    }
    // Horizonte de montanhas distantes
    const mt = this.add.graphics();
    mt.fillStyle(0x9a7a4a, 1);
    mt.fillPoints([
      { x: 0, y: 180 }, { x: 130, y: 80 }, { x: 230, y: 170 },
      { x: 340, y: 60 }, { x: 480, y: 160 }, { x: 620, y: 90 },
      { x: 770, y: 170 }, { x: 900, y: 70 }, { x: 1080, y: 160 },
      { x: 1280, y: 90 }, { x: 1280, y: 0 }, { x: 0, y: 0 },
    ], true);

    // Árvores decorativas
    const treePositions = [
      [60, 240], [110, 270], [160, 260],
      [320, 250], [350, 230], [380, 250],
      [620, 260], [660, 250], [700, 230],
      [840, 250], [880, 230],
      [580, 660], [640, 670], [700, 660],
      [990, 600], [1100, 620], [1200, 640],
    ];
    for (const [x, y] of treePositions) {
      this.add.image(x, y + 16, 'tree').setDisplaySize(28, 44).setOrigin(0.5, 1);
    }

    // Mine entrances (até 4 slots)
    this.mineImages = [];
    for (let i = 0; i < OVERWORLD.mineEntrances.length; i++) {
      const rect = OVERWORLD.mineEntrances[i];
      const img = this.add.image(rect.x + rect.w / 2, rect.y + rect.h / 2, 'mine-entrance');
      img.setDisplaySize(rect.w + 20, rect.h + 20);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => this.onMineClick(i));
      this.mineImages.push(img);
    }

    // Mercado node
    const mn = OVERWORLD.mercadoNode;
    const mercado = this.add.image(mn.x + mn.w / 2, mn.y + mn.h / 2, 'mercado');
    mercado.setDisplaySize(mn.w, mn.h + 10);
    mercado.setInteractive({ useHandCursor: true });
    mercado.on('pointerdown', () => this.onNodeClick('mercado'));

    // Pesquisa node
    const pn = OVERWORLD.pesquisaNode;
    const pesquisa = this.add.image(pn.x + pn.w / 2, pn.y + pn.h / 2, 'pesquisa');
    pesquisa.setDisplaySize(pn.w, pn.h + 10);
    pesquisa.setInteractive({ useHandCursor: true });
    pesquisa.on('pointerdown', () => this.onNodeClick('pesquisa'));

    // Fábricas
    this.factoryImages = [];
    for (let i = 0; i < 3; i++) {
      const rect = factoryRect(i);
      const f = this.add.image(rect.x + rect.w / 2, rect.y + rect.h / 2, 'factory');
      f.setDisplaySize(rect.w + 8, rect.h + 30);
      f.setInteractive({ useHandCursor: true });
      f.on('pointerdown', () => this.onFactoryClick(i));
      this.factoryImages.push(f);
    }

    // Igreja central da cidade
    const church = this.add.image(CITY.x + CITY.w / 2, CITY.y + CITY.h - 40, 'church');
    church.setDisplaySize(80, 180);
    church.setOrigin(0.5, 1);
    // Casas da cidade (lados)
    const h1 = this.add.image(CITY.x + 40, CITY.y + CITY.h - 10, 'house-yellow');
    h1.setDisplaySize(60, 100).setOrigin(0.5, 1);
    const h2 = this.add.image(CITY.x + CITY.w - 40, CITY.y + CITY.h - 10, 'house-green');
    h2.setDisplaySize(60, 100).setOrigin(0.5, 1);

    // Carruagem com cavalo (sprite com flip pela direção)
    this.wagon = this.add.image(ROAD.x1, ROAD.y + 10, 'wagon-horse');
    this.wagon.setDisplaySize(70, 42).setOrigin(0.5, 1);

    // Bandeira da civilização (overlay fixo no canto superior esquerdo)
    this.updateCivFlag();

    // Legenda e stats compactos (overlay via DOM separado — ou tudo via graphics)
    this.add.text(width / 2, 40, 'TAPUIA — MAPA (Phaser Edition)', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#3a1f0a', fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  updateCivFlag() {
    const civ = state.civilization ? CIV_BY_ID[state.civilization] : null;
    if (!civ) return;
    // Mastro
    const g = this.add.graphics();
    g.fillStyle(0x5a3416, 1);
    g.fillRect(220, 12, 3, 48);
    // Bandeira
    g.fillStyle(parseInt(civ.color.replace('#', ''), 16), 1);
    g.fillRect(223, 14, 54, 32);
    // Listra accent
    g.fillStyle(parseInt(civ.accentColor.replace('#', ''), 16), 1);
    g.fillRect(223, 26, 54, 8);
    // Emoji centralizado
    this.add.text(250, 30, civ.emoji, {
      fontFamily: 'Arial', fontSize: '16px', color: '#f1e3c2',
    }).setOrigin(0.5);
    // Nome
    this.add.text(250, 58, civ.name.toUpperCase(), {
      fontFamily: 'Segoe UI, Arial', fontSize: '10px', color: '#3a1f0a', fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  onMineClick(i) {
    const m = state.mines[i];
    if (m) {
      state.activeMineIdx = i;
      state.scene = 'mine';
      this.scene.start('MineScene');
    } else {
      // Abre modal de compra via DOM (reaproveita HTML atual)
      const btn = document.querySelector('[data-action="confirm-buy-mine"]');
      if (btn) btn.click();
      const modal = document.getElementById('modal-buy-mine');
      if (modal) modal.classList.remove('hidden');
    }
  }

  onNodeClick(id) {
    if (id === 'mercado') {
      const tab = document.querySelector('.tab[data-tab="market"]');
      if (tab) tab.click();
    } else if (id === 'pesquisa') {
      const upgBtn = document.getElementById('upgrades-btn');
      if (upgBtn) upgBtn.click();
    }
  }

  onFactoryClick(i) {
    // Delega pro modal legado de receita
    const btn = document.querySelector(`[data-action="change-recipe"][data-fact="${i}"]`);
    if (btn) btn.click();
    else {
      // Abre direto via dispatch
      document.dispatchEvent(new CustomEvent('open-recipe', { detail: { idx: i } }));
    }
  }

  update() {
    // Posição da carruagem via state.wagon
    if (this.wagon && state.wagon) {
      const w = state.wagon;
      const x = ROAD.x1 + (ROAD.x2 - ROAD.x1) * w.pos;
      this.wagon.setX(x);
      // Flip pela direção
      this.wagon.setFlipX(w.dir < 0);
    }
    // Dim das minas esgotadas
    for (let i = 0; i < this.mineImages.length; i++) {
      const m = state.mines[i];
      const img = this.mineImages[i];
      if (m && m.exhausted) img.setTint(0x606060);
      else img.clearTint();
    }
  }
}

// @ts-nocheck
// phaser/scenes/OverworldScene.js — mapa com minas, fábricas, cidade
import Phaser from 'phaser';
import { state } from '../../state.js';
import { OVERWORLD, factoryRect, ROAD, CITY } from '../../geometry.js';
import { CIV_BY_ID } from '../../data.js';
import { getTerrainCanvas } from '../../terrain.js';

export default class OverworldScene extends Phaser.Scene {
  constructor() { super({ key: 'OverworldScene' }); }

  create() {
    // Terreno AoE compartilhado com o renderer canvas (pré-renderizado uma vez)
    if (!this.textures.exists('aoe-terrain')) this.textures.addCanvas('aoe-terrain', getTerrainCanvas());
    this.add.image(0, 0, 'aoe-terrain').setOrigin(0, 0).setDisplaySize(1280, 720);

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

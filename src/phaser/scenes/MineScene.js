// @ts-nocheck
// phaser/scenes/MineScene.js — interior da mina com grid de tiles + miners animados
import Phaser from 'phaser';
import { state } from '../../state.js';
import { MINE, TOOLS, R } from '../../data.js';
import { TOOLBAR, MINE_BACK_BTN } from '../../geometry.js';
import { activeMine } from '../../mine.js';

const TILE_SIZE = MINE.cell;
const COLORS = {
  shaft: 0x0a0604,
  air: 0x1a0e06,
  dirt: 0x8a5a30,
  stone: 0x7d7d7d,
  ore: 0x4a3020,
  fog: 0x0a0604,
};

export default class MineScene extends Phaser.Scene {
  constructor() { super({ key: 'MineScene' }); }

  create() {
    const { width } = this.cameras.main;

    // Céu
    const sky = this.add.graphics();
    sky.fillGradientStyle(0xe8c98a, 0xe8c98a, 0xd2a76a, 0xd2a76a, 1);
    sky.fillRect(0, 0, width, MINE.y);
    sky.fillStyle(0x8a5a30, 1);
    sky.fillRect(0, MINE.y, width, 8);
    sky.fillStyle(0x5a3416, 1);
    sky.fillRect(0, MINE.y + 8, width, 4);

    // Título com nome da mina
    const mine = activeMine();
    this.titleText = this.add.text(
      210, 70,
      `${(mine ? mine.name : 'MINA').toUpperCase()} — SUPERFÍCIE`,
      { fontFamily: 'Segoe UI, Arial', fontSize: '14px', color: '#3a1f0a', fontStyle: 'bold' }
    ).setOrigin(0, 0.5);

    // Botão "← Voltar ao Mapa"
    const b = MINE_BACK_BTN;
    const backBg = this.add.graphics();
    backBg.fillStyle(0x3a1f0a, 1);
    backBg.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    backBg.fillStyle(0xc69042, 1);
    backBg.fillRect(b.x, b.y, b.w, b.h);
    this.add.text(b.x + b.w / 2, b.y + b.h / 2, '← Voltar ao Mapa', {
      fontFamily: 'Segoe UI, Arial', fontSize: '14px', color: '#1a0e06', fontStyle: 'bold',
    }).setOrigin(0.5);
    const backHit = this.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, 0, 0);
    backHit.setInteractive({ useHandCursor: true });
    backHit.on('pointerdown', () => {
      state.scene = 'overworld';
      this.scene.start('OverworldScene');
    });

    // Grid de tiles — renderizados como graphics
    this.tileLayer = this.add.graphics();
    this.labelsLayer = this.add.container(0, 0);
    this.minerImages = []; // referências aos sprites dos miners pra animação

    // Hit area pro grid todo
    const gridHit = this.add.rectangle(
      MINE.x + MINE.cols * MINE.cell / 2,
      MINE.y + MINE.rows * MINE.cell / 2,
      MINE.cols * MINE.cell, MINE.rows * MINE.cell, 0, 0,
    );
    gridHit.setInteractive({ useHandCursor: true });
    gridHit.on('pointerdown', (pointer) => this.onGridClick(pointer));

    // Toolbar lateral
    this.drawToolbar();

    // Clique na toolbar
    const order = ['pick', 'tnt', 'compass', 'miner'];
    for (let i = 0; i < order.length; i++) {
      const x = TOOLBAR.x, y = TOOLBAR.y + i * TOOLBAR.slotH;
      const hit = this.add.rectangle(x + TOOLBAR.w / 2, y + TOOLBAR.w / 2, TOOLBAR.w, TOOLBAR.w, 0, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => { state.tool = order[i]; this.drawToolbar(); });
    }
  }

  drawToolbar() {
    if (this.toolbarGfx) this.toolbarGfx.destroy();
    if (this.toolbarTexts) this.toolbarTexts.forEach(t => t.destroy());
    this.toolbarGfx = this.add.graphics();
    this.toolbarTexts = [];
    const order = ['pick', 'tnt', 'compass', 'miner'];
    const icons = { pick: '⛏', tnt: 'TNT', compass: '◇', miner: '👤' };
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const x = TOOLBAR.x, y = TOOLBAR.y + i * TOOLBAR.slotH;
      const selected = state.tool === id;
      this.toolbarGfx.fillStyle(selected ? 0xc69042 : 0x5a3416, 1);
      this.toolbarGfx.fillRect(x - 3, y - 3, TOOLBAR.w + 6, TOOLBAR.w + 6);
      this.toolbarGfx.fillStyle(0x1a0e06, 1);
      this.toolbarGfx.fillRect(x, y, TOOLBAR.w, TOOLBAR.w);
      const t = this.add.text(x + TOOLBAR.w / 2, y + TOOLBAR.w / 2, icons[id], {
        fontFamily: 'Segoe UI, Arial', fontSize: '20px', color: selected ? '#ffd44a' : '#f1e3c2', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.toolbarTexts.push(t);
      const name = this.add.text(x + TOOLBAR.w / 2, y + TOOLBAR.w + 2, TOOLS[id].name, {
        fontFamily: 'Segoe UI, Arial', fontSize: '10px', color: '#f1e3c2', fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      this.toolbarTexts.push(name);
    }
  }

  onGridClick(pointer) {
    const x = pointer.worldX - MINE.x;
    const y = pointer.worldY - MINE.y;
    if (x < 0 || y < 0) return;
    const c = Math.floor(x / TILE_SIZE);
    const r = Math.floor(y / TILE_SIZE);
    if (c < 0 || c >= MINE.cols || r < 0 || r >= MINE.rows) return;
    // Delega ao sistema de mina via dispatch (reaproveita handlers)
    const tool = state.tool || 'pick';
    import('../../mine.js').then((m) => {
      if (tool === 'pick') m.tryDigClick(r, c);
      else if (tool === 'tnt') m.tryTNT(r, c);
      else if (tool === 'compass') m.tryCompass(r, c);
      else if (tool === 'miner') m.tryPlaceWorker(r, c);
    });
  }

  update() {
    const mine = activeMine();
    if (!mine || !mine.grid) return;
    // Redesenha grid a cada frame (simples, mas funcional)
    this.tileLayer.clear();
    this.labelsLayer.removeAll(true);
    // Remove miners antigos
    for (const img of this.minerImages) img.destroy();
    this.minerImages = [];
    for (let r = 0; r < MINE.rows; r++) {
      for (let c = 0; c < MINE.cols; c++) {
        const t = mine.grid[r][c];
        const px = MINE.x + c * TILE_SIZE;
        const py = MINE.y + r * TILE_SIZE;
        if (!t.revealed) {
          this.tileLayer.fillStyle(COLORS.fog, 1);
          this.tileLayer.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          continue;
        }
        if (t.type === 'shaft') {
          this.tileLayer.fillStyle(COLORS.shaft, 1);
          this.tileLayer.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          this.tileLayer.fillStyle(0x3a3a3a, 1);
          this.tileLayer.fillRect(px + 6, py, 3, TILE_SIZE);
          this.tileLayer.fillRect(px + TILE_SIZE - 9, py, 3, TILE_SIZE);
        } else if (t.type === 'air') {
          this.tileLayer.fillStyle(COLORS.air, 1);
          this.tileLayer.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          this.tileLayer.fillStyle(0x5a3416, 1);
          this.tileLayer.fillRect(px, py, TILE_SIZE, 3);
          this.tileLayer.fillRect(px, py + TILE_SIZE - 3, TILE_SIZE, 3);
        } else if (t.type === 'dirt') {
          this.tileLayer.fillStyle(COLORS.dirt, 1);
          this.tileLayer.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (t.type === 'stone') {
          this.tileLayer.fillStyle(COLORS.stone, 1);
          this.tileLayer.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          this.tileLayer.fillStyle(0x5a5a5a, 1);
          this.tileLayer.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        } else if (t.type === 'ore') {
          this.tileLayer.fillStyle(COLORS.ore, 1);
          this.tileLayer.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          // Chips do minério
          const col = parseInt(R[t.resource].color.replace('#', ''), 16);
          this.tileLayer.fillStyle(col, 1);
          const n = Math.max(4, Math.floor(t.amount / 4));
          for (let i = 0; i < n; i++) {
            const dx = (px * 7 + i * 5) % (TILE_SIZE - 10);
            const dy = (py * 11 + i * 7) % (TILE_SIZE - 14);
            this.tileLayer.fillRect(px + 4 + dx, py + 14 + dy, 6, 5);
          }
          // Label do recurso
          const abbrev = this.resAbbrev(t.resource);
          const label = this.add.text(px + TILE_SIZE / 2, py + 8, abbrev, {
            fontFamily: 'Segoe UI, Arial', fontSize: '11px', color: '#ffd44a', fontStyle: 'bold',
            backgroundColor: 'rgba(20,10,5,0.88)', padding: { left: 3, right: 3, top: 1, bottom: 1 },
          }).setOrigin(0.5);
          this.labelsLayer.add(label);
          // Miner animado se worker
          if (t.worker) {
            const frame = Math.floor(performance.now() / 170 + c * 0.7) % 3;
            // miner-anim é 96x44 (3 frames de 32x44); phaser SVG inteiro,
            // então usamos crop manualmente
            const img = this.add.image(px + 8, py + TILE_SIZE - 2, 'miner-anim');
            img.setDisplaySize(66, 44); // 3 frames × tamanho visual
            img.setOrigin(frame / 3 + 1 / 6, 1);
            // Crop pra mostrar apenas o frame correto
            img.setCrop(frame * 32, 0, 32, 44);
            this.minerImages.push(img);
          }
          // Moldura amarela quando worker
          if (t.worker) {
            this.tileLayer.lineStyle(2, 0xffd44a, 1);
            this.tileLayer.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }
        }
      }
    }
  }

  resAbbrev(id) {
    return ({
      coal:'CVO', iron_ore:'FRO', copper_ore:'CBR', zinc_ore:'ZNC', lead:'CHB',
      silver_ore:'PRT', gold_ore:'OUR', sulfur:'ENX', saltpeter:'SLT', oil:'PET',
      wood:'MAD', stone:'PED', clay:'ARG', sand:'ARE', diamond:'DIA', ruby:'RUB',
    })[id] || id.slice(0, 3).toUpperCase();
  }
}

/* =========================================================
   TAPUIA — Protótipo de Loop Logístico
   Mina (Carvão + Ferro) → Carrinho → Fábrica → Carruagem → Cidade
   ========================================================= */

(() => {
  'use strict';

  // ---------- CONFIG ----------
  const CFG = {
    startMoney: 500,
    minerCost: 80,
    cartUpgradeBase: 200,
    wagonUpgradeBase: 250,

    minerRate: 0.6,            // ore por segundo por minerador
    minePileMax: 30,           // capacidade do estoque na boca da mina

    cartCapacityBase: 5,
    cartSpeedBase: 60,         // pixels por segundo (subida+descida do poço)
    cartLoadTime: 1.0,

    factoryRecipe: { coal: 1, iron: 1, steel: 1, time: 2.0 },
    factoryStockMax: 20,

    wagonCapacityBase: 3,
    wagonSpeedBase: 80,
    wagonLoadTime: 0.8,

    cityDemandMin: 8,
    cityDemandMax: 18,
    cityDeadlineMin: 45,       // segundos
    cityDeadlineMax: 75,
    contractReward: 350,
    contractApprovalGain: 12,
    contractApprovalLoss: 18,

    // Principais cidades de Santa Catarina como solicitantes
    cities: [
      'Florianópolis',
      'Joinville',
      'Blumenau',
      'Chapecó',
      'Criciúma',
      'Itajaí',
      'Lages',
      'Tubarão',
      'Jaraguá do Sul',
      'Balneário Camboriú',
      'São José',
      'Brusque',
    ],

    dayLengthSec: 30,          // 1 dia = 30s de tempo real (em 1x)

    approvalStart: 50,
    approvalMax: 100,
  };

  // ---------- ESTADO ----------
  const state = {
    money: CFG.startMoney,
    approval: CFG.approvalStart,
    day: 1,
    dayTimer: 0,
    speed: 1,
    over: false,

    miners: { coal: 1, iron: 1 },
    minePile: { coal: 0, iron: 0 },
    factory:  { coal: 0, iron: 0, steel: 0, brewing: 0 },

    cart: {
      level: 1,
      pos: 1,           // 0 = topo (fábrica), 1 = fundo (mina)
      dir: 0,           // -1 sobe, +1 desce, 0 parado
      load: { coal: 0, iron: 0 },
      state: 'idle',    // idle | loading | hauling | unloading
      timer: 0,
    },
    wagon: {
      level: 1,
      pos: 0,           // 0 = fábrica, 1 = cidade
      dir: 0,
      load: 0,          // aço
      state: 'idle',
      timer: 0,
    },

    contract: null,     // { need, delivered, deadline, elapsed, city }
    currentCity: 'Florianópolis', // cidade visível atualmente na tela
    nextContractIn: 4,  // segundos para o primeiro contrato

    log: [],
  };

  // ---------- CANVAS ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Coordenadas-âncora (em pixel do canvas 1280x720)
  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = 300;       // linha de superfície

  const FACTORY = { x: 180, y: GROUND_Y - 110, w: 200, h: 110 };
  const CITY    = { x: 1000, y: GROUND_Y - 170, w: 240, h: 170 };
  const MINE_SHAFT = { x: 80, top: GROUND_Y, bottom: H - 80, w: 60 };
  const MINE_TUNNEL_Y = H - 110;
  const ROAD = { y: GROUND_Y, x1: FACTORY.x + FACTORY.w, x2: CITY.x };

  // ---------- UTIL ----------
  const $ = (id) => document.getElementById(id);
  const fmtMoney = (n) => '$' + Math.floor(n).toLocaleString('pt-BR');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));

  function log(msg, kind = '') {
    state.log.unshift({ msg, kind, day: state.day });
    if (state.log.length > 40) state.log.pop();
  }

  // ---------- AÇÕES ----------
  function tryHire(kind) {
    if (state.money < CFG.minerCost) return;
    state.money -= CFG.minerCost;
    state.miners[kind]++;
    log(`Contratado minerador de ${kind === 'coal' ? 'carvão' : 'ferro'}.`);
  }

  function cartUpgradeCost() { return CFG.cartUpgradeBase * state.cart.level; }
  function wagonUpgradeCost() { return CFG.wagonUpgradeBase * state.wagon.level; }

  function upgradeCart() {
    const cost = cartUpgradeCost();
    if (state.money < cost) return;
    state.money -= cost;
    state.cart.level++;
    log(`Carrinho aprimorado para nível ${state.cart.level}.`, 'good');
  }
  function upgradeWagon() {
    const cost = wagonUpgradeCost();
    if (state.money < cost) return;
    state.money -= cost;
    state.wagon.level++;
    log(`Carruagem aprimorada para nível ${state.wagon.level}.`, 'good');
  }

  function cartCapacity() { return CFG.cartCapacityBase + (state.cart.level - 1) * 4; }
  function cartSpeed()    { return CFG.cartSpeedBase * (1 + (state.cart.level - 1) * 0.25); }
  function wagonCapacity(){ return CFG.wagonCapacityBase + (state.wagon.level - 1) * 2; }
  function wagonSpeed()   { return CFG.wagonSpeedBase * (1 + (state.wagon.level - 1) * 0.30); }

  // ---------- SIMULAÇÃO ----------
  function generateContract() {
    const need = irand(CFG.cityDemandMin, CFG.cityDemandMax);
    const deadline = rand(CFG.cityDeadlineMin, CFG.cityDeadlineMax);
    // Sorteia uma cidade de SC, evitando repetir a anterior se possível
    let city = CFG.cities[irand(0, CFG.cities.length - 1)];
    if (state.contract && city === state.contract.city && CFG.cities.length > 1) {
      city = CFG.cities[(CFG.cities.indexOf(city) + 1) % CFG.cities.length];
    }
    state.contract = { need, delivered: 0, deadline, elapsed: 0, city };
    state.currentCity = city;
    log(`${city} pede ${need} unidades de aço em ${Math.round(deadline)}s.`);
  }

  function deliverSteel(amount) {
    if (!state.contract) return;
    state.contract.delivered += amount;
    if (state.contract.delivered >= state.contract.need) {
      // contrato cumprido
      state.money += CFG.contractReward;
      state.approval = clamp(state.approval + CFG.contractApprovalGain, 0, CFG.approvalMax);
      log(`${state.contract.city}: contrato cumprido! +${fmtMoney(CFG.contractReward)} e +${CFG.contractApprovalGain} aprovação.`, 'good');
      state.contract = null;
      state.nextContractIn = rand(6, 10);
    }
  }

  function failContract() {
    const cityName = state.contract ? state.contract.city : 'Cidade';
    state.approval = clamp(state.approval - CFG.contractApprovalLoss, 0, CFG.approvalMax);
    log(`${cityName}: contrato expirou. −${CFG.contractApprovalLoss} aprovação.`, 'bad');
    state.contract = null;
    state.nextContractIn = rand(6, 12);
  }

  function updateMiners(dt) {
    // Cada minerador adiciona ore no estoque da mina, até o limite
    const totalMined = (kind) => state.miners[kind] * CFG.minerRate * dt;
    const c = totalMined('coal');
    const i = totalMined('iron');
    state.minePile.coal = Math.min(CFG.minePileMax, state.minePile.coal + c);
    state.minePile.iron = Math.min(CFG.minePileMax, state.minePile.iron + i);
  }

  function updateCart(dt) {
    const c = state.cart;
    const cap = cartCapacity();
    const spd = cartSpeed();

    switch (c.state) {
      case 'idle': {
        // No fundo, esperando ore. Sobe assim que tiver algo + fábrica não está cheia.
        if (c.pos >= 0.99 && (state.minePile.coal > 0 || state.minePile.iron > 0)) {
          const room = (CFG.factoryStockMax - state.factory.coal) + (CFG.factoryStockMax - state.factory.iron);
          if (room > 0) {
            c.state = 'loading';
            c.timer = CFG.cartLoadTime;
          }
        }
        // No topo, esperando para descer
        if (c.pos <= 0.01 && c.load.coal === 0 && c.load.iron === 0) {
          c.state = 'hauling';
          c.dir = +1;
        }
        break;
      }
      case 'loading': {
        c.timer -= dt;
        if (c.timer <= 0) {
          // tira do pile até capacidade, priorizando o menos abastecido na fábrica
          let remaining = cap;
          const needCoal = CFG.factoryStockMax - state.factory.coal;
          const needIron = CFG.factoryStockMax - state.factory.iron;
          // alterna: pega proporcional ao disponível e ao "vão" da fábrica
          while (remaining > 0 && (state.minePile.coal >= 1 || state.minePile.iron >= 1)) {
            const wantCoal = state.minePile.coal >= 1 && c.load.coal <= c.load.iron && needCoal > 0;
            const wantIron = state.minePile.iron >= 1 && (!wantCoal || c.load.iron < c.load.coal) && needIron > 0;
            if (wantCoal) {
              c.load.coal++;
              state.minePile.coal--;
              remaining--;
            } else if (wantIron) {
              c.load.iron++;
              state.minePile.iron--;
              remaining--;
            } else {
              break;
            }
          }
          if (c.load.coal + c.load.iron === 0) {
            c.state = 'idle';
          } else {
            c.state = 'hauling';
            c.dir = -1; // sobe
          }
        }
        break;
      }
      case 'hauling': {
        // move ao longo do shaft. pos 1 = fundo, 0 = topo.
        const shaftLen = MINE_SHAFT.bottom - MINE_SHAFT.top;
        const dPos = (spd * dt) / shaftLen;
        c.pos += c.dir * dPos;
        if (c.dir < 0 && c.pos <= 0) {
          c.pos = 0;
          c.state = 'unloading';
          c.timer = CFG.cartLoadTime;
        } else if (c.dir > 0 && c.pos >= 1) {
          c.pos = 1;
          c.dir = 0;
          c.state = 'idle';
        }
        break;
      }
      case 'unloading': {
        c.timer -= dt;
        if (c.timer <= 0) {
          // entrega na fábrica respeitando capacidade
          const dropCoal = Math.min(c.load.coal, CFG.factoryStockMax - state.factory.coal);
          const dropIron = Math.min(c.load.iron, CFG.factoryStockMax - state.factory.iron);
          state.factory.coal += dropCoal;
          state.factory.iron += dropIron;
          c.load.coal -= dropCoal;
          c.load.iron -= dropIron;
          // o que sobrar fica no carrinho na próxima viagem
          c.state = 'idle';
        }
        break;
      }
    }
  }

  function updateFactory(dt) {
    const r = CFG.factoryRecipe;
    if (state.factory.brewing > 0) {
      state.factory.brewing -= dt;
      if (state.factory.brewing <= 0) {
        state.factory.steel = Math.min(CFG.factoryStockMax, state.factory.steel + r.steel);
        state.factory.brewing = 0;
      }
    }
    // começa nova receita se houver insumos e espaço
    if (state.factory.brewing <= 0 &&
        state.factory.coal >= r.coal &&
        state.factory.iron >= r.iron &&
        state.factory.steel < CFG.factoryStockMax) {
      state.factory.coal -= r.coal;
      state.factory.iron -= r.iron;
      state.factory.brewing = r.time;
    }
  }

  function updateWagon(dt) {
    const w = state.wagon;
    const cap = wagonCapacity();
    const spd = wagonSpeed();

    switch (w.state) {
      case 'idle': {
        if (w.pos <= 0.01 && state.factory.steel > 0 && state.contract) {
          w.state = 'loading';
          w.timer = CFG.wagonLoadTime;
        }
        if (w.pos >= 0.99 && w.load === 0) {
          // volta vazia
          w.state = 'hauling';
          w.dir = -1;
        }
        break;
      }
      case 'loading': {
        w.timer -= dt;
        if (w.timer <= 0) {
          const take = Math.min(cap, state.factory.steel);
          w.load = take;
          state.factory.steel -= take;
          if (w.load > 0) {
            w.state = 'hauling';
            w.dir = +1;
          } else {
            w.state = 'idle';
          }
        }
        break;
      }
      case 'hauling': {
        const roadLen = ROAD.x2 - ROAD.x1;
        const dPos = (spd * dt) / roadLen;
        w.pos += w.dir * dPos;
        if (w.dir > 0 && w.pos >= 1) {
          w.pos = 1;
          w.state = 'unloading';
          w.timer = CFG.wagonLoadTime;
        } else if (w.dir < 0 && w.pos <= 0) {
          w.pos = 0;
          w.dir = 0;
          w.state = 'idle';
        }
        break;
      }
      case 'unloading': {
        w.timer -= dt;
        if (w.timer <= 0) {
          deliverSteel(w.load);
          w.load = 0;
          w.state = 'hauling';
          w.dir = -1;
        }
        break;
      }
    }
  }

  function updateContract(dt) {
    if (state.contract) {
      state.contract.elapsed += dt;
      if (state.contract.elapsed >= state.contract.deadline) {
        failContract();
      }
    } else {
      state.nextContractIn -= dt;
      if (state.nextContractIn <= 0) generateContract();
    }
  }

  function updateDay(dt) {
    state.dayTimer += dt;
    if (state.dayTimer >= CFG.dayLengthSec) {
      state.dayTimer = 0;
      state.day++;
      // impostos simbólicos a cada 7 dias
      if (state.day % 7 === 0) {
        const tax = Math.floor(state.approval * 4);
        state.money += tax;
        log(`Coleta tributária: +${fmtMoney(tax)} (semana ${state.day / 7}).`);
      }
    }
  }

  function checkGameOver() {
    if (state.approval <= 0 && !state.over) {
      state.over = true;
      $('end-title').textContent = 'A população te destituiu';
      $('end-text').textContent = 'A aprovação caiu a zero. O governo central revogou seu mandato como governador.';
      $('game-over').classList.remove('hidden');
    }
    if (state.approval >= CFG.approvalMax && !state.over && state.day >= 14) {
      state.over = true;
      $('end-title').textContent = 'Vitória política!';
      $('end-text').textContent = `Você atingiu aprovação máxima após ${state.day} dias. Tapuia é um modelo de governança industrial em Santa Catarina.`;
      $('game-over').classList.remove('hidden');
    }
  }

  function tick(dt) {
    if (state.over) return;
    updateMiners(dt);
    updateCart(dt);
    updateFactory(dt);
    updateWagon(dt);
    updateContract(dt);
    updateDay(dt);
    checkGameOver();
  }

  // ---------- DESENHO ----------
  function drawSky() {
    const grd = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grd.addColorStop(0, '#e8c98a');
    grd.addColorStop(1, '#d2a76a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, GROUND_Y);
    // sol pálido
    ctx.fillStyle = 'rgba(255, 220, 150, 0.6)';
    ctx.beginPath();
    ctx.arc(W - 180, 80, 50, 0, Math.PI * 2);
    ctx.fill();
    // nuvens de poeira
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (const c of [[200, 60, 40], [500, 90, 60], [800, 50, 35]]) {
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], c[2], c[2] * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround() {
    // superfície
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(0, GROUND_Y, W, 20);
    ctx.fillStyle = '#6b3f1a';
    ctx.fillRect(0, GROUND_Y + 20, W, H - GROUND_Y - 20);
    // textura: pedrinhas
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < 80; i++) {
      const x = (i * 71) % W;
      const y = GROUND_Y + 40 + ((i * 47) % (H - GROUND_Y - 60));
      ctx.fillRect(x, y, 3, 2);
    }
    // veios de mineral
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(220, H - 200, 14, 8);
    ctx.fillRect(900, H - 250, 18, 6);
    ctx.fillStyle = '#9c6b3a';
    ctx.fillRect(700, H - 180, 14, 6);
    ctx.fillRect(400, H - 280, 18, 8);
  }

  function drawMine() {
    // poço vertical
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(MINE_SHAFT.x, MINE_SHAFT.top, MINE_SHAFT.w, MINE_SHAFT.bottom - MINE_SHAFT.top);
    // trilho central
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 - 8, MINE_SHAFT.top);
    ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 - 8, MINE_SHAFT.bottom);
    ctx.moveTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 + 8, MINE_SHAFT.top);
    ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 + 8, MINE_SHAFT.bottom);
    ctx.stroke();
    // dormentes
    ctx.strokeStyle = '#5a3416';
    for (let y = MINE_SHAFT.top + 20; y < MINE_SHAFT.bottom; y += 30) {
      ctx.beginPath();
      ctx.moveTo(MINE_SHAFT.x + 8, y);
      ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w - 8, y);
      ctx.stroke();
    }
    // estrutura de madeira sobre o poço (torre de mina)
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(MINE_SHAFT.x - 10, GROUND_Y - 90, 12, 90);
    ctx.fillRect(MINE_SHAFT.x + MINE_SHAFT.w - 2, GROUND_Y - 90, 12, 90);
    ctx.fillRect(MINE_SHAFT.x - 10, GROUND_Y - 90, MINE_SHAFT.w + 20, 10);
    // roldana
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(MINE_SHAFT.x + MINE_SHAFT.w / 2, GROUND_Y - 85, 8, 0, Math.PI * 2);
    ctx.fill();

    // túnel horizontal no fundo
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(MINE_SHAFT.x + MINE_SHAFT.w, MINE_TUNNEL_Y, 380, 50);
    // pilhas no fundo (carvão preto, ferro marrom)
    drawPile(MINE_SHAFT.x + MINE_SHAFT.w + 25, MINE_TUNNEL_Y + 40, state.minePile.coal, '#1f1c1a');
    drawPile(MINE_SHAFT.x + MINE_SHAFT.w + 95, MINE_TUNNEL_Y + 40, state.minePile.iron, '#8a6a4d');

    // mineradores: silhuetas simples no túnel
    drawMiners(state.miners.coal, MINE_SHAFT.x + MINE_SHAFT.w + 170, MINE_TUNNEL_Y + 40, '#1f1c1a');
    drawMiners(state.miners.iron, MINE_SHAFT.x + MINE_SHAFT.w + 270, MINE_TUNNEL_Y + 40, '#8a6a4d');
  }

  function drawPile(x, baseY, amount, color) {
    if (amount <= 0) return;
    const n = Math.min(20, Math.ceil(amount));
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const px = x + (i % 5) * 5 - ((Math.floor(i / 5)) * 1);
      const py = baseY - Math.floor(i / 5) * 4;
      ctx.fillRect(px, py - 4, 5, 4);
    }
  }

  function drawMiners(count, x, baseY, accent) {
    const t = performance.now() / 200;
    for (let i = 0; i < Math.min(count, 6); i++) {
      const mx = x + i * 14;
      const swing = Math.sin(t + i) * 3;
      // corpo
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(mx, baseY - 14, 6, 10);
      // cabeça (com capacete amarelo)
      ctx.fillStyle = accent;
      ctx.fillRect(mx, baseY - 20, 6, 5);
      ctx.fillStyle = '#c69042';
      ctx.fillRect(mx - 1, baseY - 21, 8, 2);
      // picareta
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx + 6, baseY - 10);
      ctx.lineTo(mx + 12 + swing, baseY - 18 - Math.abs(swing));
      ctx.stroke();
    }
  }

  function drawCart() {
    const c = state.cart;
    const shaftLen = MINE_SHAFT.bottom - MINE_SHAFT.top;
    const cy = MINE_SHAFT.top + shaftLen * c.pos;
    const cx = MINE_SHAFT.x + MINE_SHAFT.w / 2;
    // cabo
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, GROUND_Y - 85);
    ctx.lineTo(cx, cy - 6);
    ctx.stroke();
    // carrinho
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(cx - 18, cy - 14, 36, 20);
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(cx - 18, cy + 4, 36, 4);
    // rodas
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(cx - 12, cy + 8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 12, cy + 8, 4, 0, Math.PI * 2); ctx.fill();
    // carga
    const total = c.load.coal + c.load.iron;
    if (total > 0) {
      const wCoal = c.load.coal / total;
      const wIron = c.load.iron / total;
      const barW = 30;
      ctx.fillStyle = '#1f1c1a';
      ctx.fillRect(cx - 15, cy - 12, barW * wCoal, 12);
      ctx.fillStyle = '#8a6a4d';
      ctx.fillRect(cx - 15 + barW * wCoal, cy - 12, barW * wIron, 12);
    }
  }

  function drawFactory() {
    // base
    ctx.fillStyle = '#7a4b25';
    ctx.fillRect(FACTORY.x, FACTORY.y, FACTORY.w, FACTORY.h);
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(FACTORY.x, FACTORY.y, FACTORY.w, 10);
    // janelas
    ctx.fillStyle = '#f1e3c2';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(FACTORY.x + 20 + i * 50, FACTORY.y + 30, 24, 20);
    }
    // chaminés
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(FACTORY.x + 30, FACTORY.y - 50, 18, 50);
    ctx.fillRect(FACTORY.x + 150, FACTORY.y - 70, 22, 70);
    // fumaça
    const t = performance.now() / 600;
    ctx.fillStyle = 'rgba(60,40,20,0.5)';
    for (let i = 0; i < 4; i++) {
      const yOff = (t * 30 + i * 25) % 100;
      const r = 8 + i * 2;
      ctx.beginPath();
      ctx.arc(FACTORY.x + 39, FACTORY.y - 55 - yOff, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(FACTORY.x + 161, FACTORY.y - 75 - yOff, r + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // engrenagem girando
    const gx = FACTORY.x + FACTORY.w - 30;
    const gy = FACTORY.y + 70;
    drawGear(gx, gy, 20, performance.now() / 400);
    drawGear(gx - 30, gy + 18, 14, -performance.now() / 350);

    // placa
    ctx.fillStyle = '#c69042';
    ctx.fillRect(FACTORY.x + FACTORY.w / 2 - 50, FACTORY.y + FACTORY.h - 28, 100, 18);
    ctx.fillStyle = '#1a0e06';
    ctx.font = 'bold 11px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('FUNDIÇÃO', FACTORY.x + FACTORY.w / 2, FACTORY.y + FACTORY.h - 15);

    // barra de progresso da receita
    if (state.factory.brewing > 0) {
      const pct = 1 - state.factory.brewing / CFG.factoryRecipe.time;
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(FACTORY.x + 10, FACTORY.y - 10, FACTORY.w - 20, 6);
      ctx.fillStyle = '#c69042';
      ctx.fillRect(FACTORY.x + 10, FACTORY.y - 10, (FACTORY.w - 20) * pct, 6);
    }
  }

  function drawGear(x, y, r, angle) {
    const teeth = 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#888';
    for (let i = 0; i < teeth; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / teeth);
      ctx.fillRect(-3, -r - 4, 6, 8);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3416';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRoad() {
    ctx.fillStyle = '#a07a4a';
    ctx.fillRect(ROAD.x1, ROAD.y - 6, ROAD.x2 - ROAD.x1, 14);
    ctx.strokeStyle = '#5a3416';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(ROAD.x1, ROAD.y + 1);
    ctx.lineTo(ROAD.x2, ROAD.y + 1);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawWagon() {
    const w = state.wagon;
    const wx = ROAD.x1 + (ROAD.x2 - ROAD.x1) * w.pos;
    const wy = ROAD.y - 16;
    // cavalo (forma básica)
    if (w.dir !== 0) {
      ctx.fillStyle = '#3a1f0a';
      const hx = wx + (w.dir > 0 ? 32 : -50);
      ctx.fillRect(hx, wy + 4, 18, 14);
      ctx.fillRect(hx + (w.dir > 0 ? 14 : -4), wy - 2, 6, 8);
    }
    // carroceria
    ctx.fillStyle = '#7a4b25';
    ctx.fillRect(wx - 20, wy, 40, 16);
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(wx - 20, wy + 14, 40, 4);
    // toldo
    ctx.fillStyle = '#e8d4a4';
    ctx.beginPath();
    ctx.ellipse(wx, wy + 2, 22, 8, 0, Math.PI, 0);
    ctx.fill();
    // rodas
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(wx - 14, wy + 20, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(wx + 14, wy + 20, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(wx - 14, wy + 20, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(wx + 14, wy + 20, 2, 0, Math.PI * 2); ctx.fill();
    // carga (aço)
    if (w.load > 0) {
      ctx.fillStyle = '#8c95a1';
      const barW = (w.load / wagonCapacity()) * 30;
      ctx.fillRect(wx - 15, wy + 4, barW, 6);
    }
  }

  function drawCity() {
    // sombra do morro
    ctx.fillStyle = '#a07a4a';
    ctx.beginPath();
    ctx.moveTo(CITY.x - 20, GROUND_Y);
    ctx.lineTo(CITY.x + 30, CITY.y + 20);
    ctx.lineTo(CITY.x + CITY.w + 20, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // prédios
    const buildings = [
      { x: 20, y: 70, w: 50, h: 100, c: '#a85a2a' },
      { x: 80, y: 40, w: 60, h: 130, c: '#7a4b25' },
      { x: 150, y: 60, w: 45, h: 110, c: '#c46a3a' },
      { x: 200, y: 30, w: 35, h: 140, c: '#5a3416' },
    ];
    for (const b of buildings) {
      ctx.fillStyle = b.c;
      ctx.fillRect(CITY.x + b.x, CITY.y + b.y, b.w, b.h);
      // teto
      ctx.fillStyle = '#3a1f0a';
      ctx.fillRect(CITY.x + b.x - 2, CITY.y + b.y - 6, b.w + 4, 6);
      // janelas iluminadas
      ctx.fillStyle = '#f1e3c2';
      for (let row = 0; row < Math.floor(b.h / 20); row++) {
        for (let col = 0; col < Math.floor(b.w / 14); col++) {
          if ((row + col) % 2 === 0) {
            ctx.fillRect(CITY.x + b.x + 4 + col * 14, CITY.y + b.y + 8 + row * 20, 6, 8);
          }
        }
      }
    }
    // placa com o nome da cidade SC ativa
    const cityLabel = (state.currentCity || 'Florianópolis').toUpperCase();
    ctx.font = 'bold 12px Georgia';
    const labelW = Math.max(140, ctx.measureText(cityLabel).width + 20);
    ctx.fillStyle = '#c69042';
    ctx.fillRect(CITY.x + CITY.w / 2 - labelW / 2, CITY.y + 6, labelW, 20);
    ctx.fillStyle = '#1a0e06';
    ctx.textAlign = 'center';
    ctx.fillText(cityLabel, CITY.x + CITY.w / 2, CITY.y + 20);

    // contrato visualizado sobre a cidade
    if (state.contract) {
      const k = state.contract;
      const pct = clamp(k.delivered / k.need, 0, 1);
      const tpct = clamp(k.elapsed / k.deadline, 0, 1);
      const bx = CITY.x + 20;
      const by = CITY.y - 36;
      // fundo
      ctx.fillStyle = 'rgba(241,227,194,0.95)';
      ctx.fillRect(bx, by, 200, 30);
      ctx.strokeStyle = '#5a3416';
      ctx.strokeRect(bx, by, 200, 30);
      ctx.fillStyle = '#1a0e06';
      ctx.font = '11px Georgia';
      ctx.textAlign = 'left';
      ctx.fillText(`Pedido: ${k.delivered}/${k.need} aço`, bx + 6, by + 12);
      // barras
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(bx + 6, by + 16, 188, 4);
      ctx.fillStyle = '#4d7c3a';
      ctx.fillRect(bx + 6, by + 16, 188 * pct, 4);
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(bx + 6, by + 22, 188, 4);
      ctx.fillStyle = tpct > 0.75 ? '#a82e1c' : '#c69042';
      ctx.fillRect(bx + 6, by + 22, 188 * (1 - tpct), 4);
    }
  }

  function draw() {
    drawSky();
    drawGround();
    drawMine();
    drawRoad();
    drawFactory();
    drawCity();
    drawCart();
    drawWagon();
  }

  // ---------- HUD ----------
  function syncUI() {
    $('stat-money').textContent = fmtMoney(state.money);
    $('stat-day').textContent = state.day;
    const pct = Math.round(state.approval);
    $('approval-fill').style.width = pct + '%';
    $('approval-text').textContent = pct + '%';

    $('stock-coal-mine').textContent = Math.floor(state.minePile.coal);
    $('stock-iron-mine').textContent = Math.floor(state.minePile.iron);
    $('stock-coal-factory').textContent = Math.floor(state.factory.coal);
    $('stock-iron-factory').textContent = Math.floor(state.factory.iron);
    $('stock-steel-factory').textContent = Math.floor(state.factory.steel);

    $('miners-coal').textContent = state.miners.coal;
    $('miners-iron').textContent = state.miners.iron;
    $('cart-status').textContent = cartStateLabel();
    $('wagon-status').textContent = wagonStateLabel();

    $('cart-cost').textContent = fmtMoney(cartUpgradeCost());
    $('wagon-cost').textContent = fmtMoney(wagonUpgradeCost());

    $('hire-coal').disabled = state.money < CFG.minerCost;
    $('hire-iron').disabled = state.money < CFG.minerCost;
    $('upgrade-cart').disabled = state.money < cartUpgradeCost();
    $('upgrade-wagon').disabled = state.money < wagonUpgradeCost();

    // contrato
    const box = $('contract-box');
    if (state.contract) {
      const k = state.contract;
      const pPct = Math.round((k.delivered / k.need) * 100);
      const tLeft = Math.max(0, k.deadline - k.elapsed);
      box.className = 'contract contract-active';
      box.innerHTML = `
        <div class="contract-title">${k.city} — Aço</div>
        <div class="contract-line"><span>Entregue</span><span>${k.delivered} / ${k.need}</span></div>
        <div class="contract-bar"><div class="contract-bar-fill" style="width:${pPct}%"></div></div>
        <div class="contract-line"><span>Tempo restante</span><span>${tLeft.toFixed(1)}s</span></div>
        <div class="contract-bar"><div class="contract-bar-fill contract-time-bar-fill" style="width:${(tLeft / k.deadline) * 100}%"></div></div>
      `;
    } else {
      box.className = 'contract';
      box.innerHTML = `<div class="contract-empty">Próximo pedido em ${Math.max(0, state.nextContractIn).toFixed(1)}s…</div>`;
    }

    // log
    const logEl = $('log');
    logEl.innerHTML = state.log.slice(0, 15)
      .map(l => `<li class="${l.kind}"><em>D${l.day}</em> · ${l.msg}</li>`)
      .join('');
  }

  function cartStateLabel() {
    const c = state.cart;
    switch (c.state) {
      case 'idle': return c.pos > 0.5 ? 'aguardando minério' : 'pronto p/ descer';
      case 'loading': return 'carregando';
      case 'unloading': return 'descarregando';
      case 'hauling': return c.dir < 0 ? 'subindo' : 'descendo';
    }
    return '—';
  }
  function wagonStateLabel() {
    const w = state.wagon;
    switch (w.state) {
      case 'idle': return w.pos > 0.5 ? 'aguardando contrato' : 'aguardando aço';
      case 'loading': return 'carregando';
      case 'unloading': return 'entregando';
      case 'hauling': return w.dir > 0 ? 'a caminho da cidade' : 'voltando';
    }
    return '—';
  }

  // ---------- LOOP ----------
  let lastT = performance.now();
  function frame(now) {
    const dtReal = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    const dt = dtReal * state.speed;
    tick(dt);
    draw();
    syncUI();
    requestAnimationFrame(frame);
  }

  // ---------- EVENTOS ----------
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.speed = parseFloat(btn.dataset.speed);
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  $('hire-coal').addEventListener('click', () => tryHire('coal'));
  $('hire-iron').addEventListener('click', () => tryHire('iron'));
  $('upgrade-cart').addEventListener('click', upgradeCart);
  $('upgrade-wagon').addEventListener('click', upgradeWagon);
  $('restart-btn').addEventListener('click', () => location.reload());

  // ---------- INÍCIO ----------
  log('Nomeado governador de Santa Catarina. Apenas a Tapuia pode salvar o estado.');
  requestAnimationFrame((t) => { lastT = t; frame(t); });
})();

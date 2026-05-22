/* =========================================================
   TAPUIA — Cadeia Produtiva de 4 Níveis
   N1 (raw) -> N2 (processados) -> N3 (componentes) -> N4 (acabados)
   Apenas N4 é demandado pelas cidades.
   ========================================================= */

(() => {
  'use strict';

  // ---------- DICIONÁRIO DE RECURSOS ----------
  // kind: 'raw' (extraído) | 'prod' (produzido em fábrica)
  // tier: 1..4 (nível na cadeia produtiva)
  // free: recurso infinito (Água)
  const R = {
    // NÍVEL 1 - BRUTOS (subsolo)
    coal:        { name: 'Carvão',             color: '#1f1c1a', kind: 'raw', tier: 1, price: 4 },
    iron_ore:    { name: 'Minério de Ferro',   color: '#6a4a30', kind: 'raw', tier: 1, price: 5 },
    copper_ore:  { name: 'Minério de Cobre',   color: '#7a4020', kind: 'raw', tier: 1, price: 7 },
    zinc_ore:    { name: 'Minério de Zinco',   color: '#7a8870', kind: 'raw', tier: 1, price: 6 },
    lead:        { name: 'Chumbo',             color: '#5a6068', kind: 'raw', tier: 1, price: 5 },
    silver_ore:  { name: 'Minério de Prata',   color: '#a0a0a0', kind: 'raw', tier: 1, price: 25 },
    gold_ore:    { name: 'Minério de Ouro',    color: '#b8902a', kind: 'raw', tier: 1, price: 40 },
    sulfur:      { name: 'Enxofre',            color: '#e6d149', kind: 'raw', tier: 1, price: 8 },
    saltpeter:   { name: 'Salitre',            color: '#f0e6d2', kind: 'raw', tier: 1, price: 7 },
    oil:         { name: 'Petróleo Bruto',     color: '#2a1a08', kind: 'raw', tier: 1, price: 12 },
    wood:        { name: 'Madeira Bruta',      color: '#8a5a30', kind: 'raw', tier: 1, price: 5 },
    stone:       { name: 'Pedra',              color: '#7d7d7d', kind: 'raw', tier: 1, price: 2 },
    clay:        { name: 'Argila',             color: '#a0623f', kind: 'raw', tier: 1, price: 3 },
    sand:        { name: 'Areia',              color: '#e8d4a4', kind: 'raw', tier: 1, price: 2 },
    diamond:     { name: 'Diamante Bruto',     color: '#b8e6e6', kind: 'raw', tier: 1, price: 300 },
    ruby:        { name: 'Rubi Bruto',         color: '#c8243c', kind: 'raw', tier: 1, price: 250 },
    water:       { name: 'Água',               color: '#5a9fc8', kind: 'raw', tier: 1, price: 0, free: true },

    // NÍVEL 2 - PROCESSADOS
    iron_ingot:   { name: 'Lingote de Ferro',   color: '#8a6a4d', kind: 'prod', tier: 2, price: 18 },
    copper_ingot: { name: 'Lingote de Cobre',   color: '#b87333', kind: 'prod', tier: 2, price: 22 },
    silver_ingot: { name: 'Lingote de Prata',   color: '#d8d8d8', kind: 'prod', tier: 2, price: 80 },
    gold_ingot:   { name: 'Lingote de Ouro',    color: '#ffd700', kind: 'prod', tier: 2, price: 130 },
    brass:        { name: 'Latão',              color: '#cd9b32', kind: 'prod', tier: 2, price: 28 },
    steel:        { name: 'Aço Base',           color: '#8c95a1', kind: 'prod', tier: 2, price: 45 },
    gunpowder:    { name: 'Pólvora',            color: '#2a2a2a', kind: 'prod', tier: 2, price: 32 },
    kerosene:     { name: 'Querosene',          color: '#c8a040', kind: 'prod', tier: 2, price: 26 },
    wood_plank:   { name: 'Tábua de Madeira',   color: '#c8954a', kind: 'prod', tier: 2, price: 14 },
    brick:        { name: 'Tijolo',             color: '#c66c3a', kind: 'prod', tier: 2, price: 16 },
    glass:        { name: 'Placa de Vidro',     color: '#a4d8e0', kind: 'prod', tier: 2, price: 20 },

    // NÍVEL 3 - COMPONENTES
    nails:         { name: 'Pregos e Parafusos',   color: '#888888', kind: 'prod', tier: 3, price: 35 },
    steel_beam:    { name: 'Vigas de Aço',         color: '#7a7e87', kind: 'prod', tier: 3, price: 80 },
    bronze_gear:   { name: 'Engrenagens de Bronze',color: '#b08a3a', kind: 'prod', tier: 3, price: 75 },
    copper_cable:  { name: 'Cabo de Cobre',        color: '#d28040', kind: 'prod', tier: 3, price: 55 },
    sulfuric_acid: { name: 'Ácido Sulfúrico',      color: '#d0e030', kind: 'prod', tier: 3, price: 40 },
    dynamite:      { name: 'Dinamite',             color: '#b8403a', kind: 'prod', tier: 3, price: 160 },
    jewel:         { name: 'Joia Lapidada',        color: '#ffe680', kind: 'prod', tier: 3, price: 420 },

    // NÍVEL 4 - ACABADOS (contratos)
    rails:        { name: 'Trilhos de Trem',         color: '#6a7080', kind: 'prod', tier: 4, price: 200 },
    lantern:      { name: 'Lâmpada de Querosene',    color: '#ffa030', kind: 'prod', tier: 4, price: 220 },
    telegraph:    { name: 'Fio Telegráfico',         color: '#a85a2a', kind: 'prod', tier: 4, price: 180 },
    mining_tools: { name: 'Ferramentas de Mineração',color: '#5a3a25', kind: 'prod', tier: 4, price: 170 },
    steam_engine: { name: 'Motor a Vapor',           color: '#444444', kind: 'prod', tier: 4, price: 450 },
    cargo_wagon:  { name: 'Carruagem de Carga',      color: '#7a4b25', kind: 'prod', tier: 4, price: 320 },
    bullets:      { name: 'Cartuchos de Munição',    color: '#c0a040', kind: 'prod', tier: 4, price: 110 },
    rifle:        { name: 'Rifle de Repetição',      color: '#4a3020', kind: 'prod', tier: 4, price: 400 },
    pocket_watch: { name: 'Relógio de Bolso',        color: '#d4af37', kind: 'prod', tier: 4, price: 850 },
    bank_safe:    { name: 'Cofre de Banco',          color: '#303030', kind: 'prod', tier: 4, price: 1600 },
  };

  // ---------- RECEITAS ----------
  const RECIPES = [
    // === NÍVEL 2 (processados) ===
    { id: 'iron_ingot',   in: { iron_ore: 1, coal: 1 },                 time: 2.0 },
    { id: 'copper_ingot', in: { copper_ore: 1, coal: 1 },               time: 2.0 },
    { id: 'silver_ingot', in: { silver_ore: 1, coal: 1 },               time: 2.5 },
    { id: 'gold_ingot',   in: { gold_ore: 1, coal: 1 },                 time: 2.5 },
    { id: 'brass',        in: { copper_ore: 1, zinc_ore: 1, coal: 1 },  time: 2.6 },
    { id: 'steel',        in: { iron_ingot: 1, coal: 1 },               time: 2.2 },
    { id: 'gunpowder',    in: { saltpeter: 1, sulfur: 1, coal: 1 },     time: 3.0 },
    { id: 'kerosene',     in: { oil: 1 },                               time: 2.0 },
    { id: 'wood_plank',   in: { wood: 1 },                              time: 1.5 },
    { id: 'brick',        in: { clay: 1, stone: 1 },                    time: 1.8 },
    { id: 'glass',        in: { sand: 2, coal: 1 },                     time: 2.4 },

    // === NÍVEL 3 (componentes) ===
    { id: 'nails',         in: { iron_ingot: 1 },                       time: 1.5 },
    { id: 'steel_beam',    in: { steel: 1 },                            time: 1.8 },
    { id: 'bronze_gear',   in: { brass: 1 },                            time: 2.0 },
    { id: 'copper_cable',  in: { copper_ingot: 1 },                     time: 1.8 },
    { id: 'sulfuric_acid', in: { sulfur: 1, water: 1 },                 time: 2.0 },
    { id: 'dynamite',      in: { glass: 1, sulfuric_acid: 1, gunpowder: 1 }, time: 3.2 },
    { id: 'jewel',         in: { diamond: 1, silver_ingot: 1 },         time: 4.0 },

    // === NÍVEL 4 (acabados) ===
    { id: 'rails',        in: { steel_beam: 1, wood_plank: 1 },                 time: 3.0 },
    { id: 'lantern',      in: { glass: 1, brass: 1, kerosene: 1 },              time: 3.4 },
    { id: 'telegraph',    in: { copper_cable: 1, wood_plank: 1 },               time: 3.0 },
    { id: 'mining_tools', in: { steel: 1, wood_plank: 1 },                      time: 3.0 },
    { id: 'steam_engine', in: { steel: 1, bronze_gear: 1, nails: 1 },           time: 4.5 },
    { id: 'cargo_wagon',  in: { wood_plank: 2, iron_ingot: 1, bronze_gear: 1 }, time: 4.0 },
    { id: 'bullets',      in: { brass: 1, lead: 1, gunpowder: 1 },              time: 2.8 },
    { id: 'rifle',        in: { steel: 1, wood_plank: 1, nails: 2 },            time: 4.0 },
    { id: 'pocket_watch', in: { bronze_gear: 1, gold_ingot: 1, glass: 1 },      time: 5.0 },
    { id: 'bank_safe',    in: { steel: 2, bronze_gear: 1, jewel: 1 },           time: 6.0 },
  ];
  const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));
  // Receitas agrupadas por tier de produto
  const RECIPES_BY_TIER = { 2: [], 3: [], 4: [] };
  for (const r of RECIPES) RECIPES_BY_TIER[R[r.id].tier].push(r);

  // ---------- TIPOS DE DEPÓSITO (excluímos water, é infinita) ----------
  const DEPOSIT_TYPES = [
    { id: 'coal',       cost: 0,    rate: 0.75 },
    { id: 'iron_ore',   cost: 0,    rate: 0.65 },
    { id: 'stone',      cost: 70,   rate: 0.95 },
    { id: 'sand',       cost: 80,   rate: 0.90 },
    { id: 'clay',       cost: 90,   rate: 0.70 },
    { id: 'wood',       cost: 110,  rate: 0.60 },
    { id: 'copper_ore', cost: 220,  rate: 0.45 },
    { id: 'zinc_ore',   cost: 240,  rate: 0.45 },
    { id: 'lead',       cost: 260,  rate: 0.45 },
    { id: 'sulfur',     cost: 280,  rate: 0.40 },
    { id: 'saltpeter',  cost: 320,  rate: 0.35 },
    { id: 'oil',        cost: 480,  rate: 0.35 },
    { id: 'silver_ore', cost: 750,  rate: 0.22 },
    { id: 'gold_ore',   cost: 1300, rate: 0.15 },
    { id: 'ruby',       cost: 1800, rate: 0.10 },
    { id: 'diamond',    cost: 2400, rate: 0.08 },
  ];
  const DEP_BY_ID = Object.fromEntries(DEPOSIT_TYPES.map(d => [d.id, d]));

  // ---------- EQUIPAMENTOS (compra em $) ----------
  const EQUIPMENT = [
    { id: 'pick_iron',  name: 'Picareta de Ferro',  desc: '+15% velocidade de mineração',  cost: 250,  effect: 'mineRate', mod: 0.15 },
    { id: 'pick_steel', name: 'Picareta de Aço',    desc: '+25% adicional na mineração',   cost: 700,  effect: 'mineRate', mod: 0.25, req: 'pick_iron' },
    { id: 'dynamite_eq',name: 'Dinamite (uso)',     desc: '+50% adicional na mineração',   cost: 1800, effect: 'mineRate', mod: 0.50, req: 'pick_steel' },
    { id: 'lantern_eq', name: 'Lampião a Óleo',     desc: '+25% capacidade das pilhas',    cost: 300,  effect: 'pileMax',  mod: 0.25 },
    { id: 'rail_track', name: 'Trilhos Reforçados', desc: '+30% adicional na capacidade',  cost: 650,  effect: 'pileMax',  mod: 0.30, req: 'lantern_eq' },
    { id: 'cart_a',     name: 'Vagonete Reforçado', desc: 'Carrinho +60% capacidade',      cost: 400,  effect: 'cartCap',  mod: 0.60 },
    { id: 'cart_b',     name: 'Elevador a Vapor',   desc: 'Carrinho +70% velocidade',      cost: 900,  effect: 'cartSpd',  mod: 0.70, req: 'cart_a' },
    { id: 'wagon_a',    name: 'Carruagem Robusta',  desc: 'Carruagem +60% capacidade',     cost: 450,  effect: 'wagonCap', mod: 0.60 },
    { id: 'wagon_b',    name: 'Carruagem Veloz',    desc: 'Carruagem +50% velocidade',     cost: 1000, effect: 'wagonSpd', mod: 0.50, req: 'wagon_a' },
    { id: 'foreman',    name: 'Mestre de Obras',    desc: 'Fábricas 25% mais rápidas',     cost: 1500, effect: 'factSpd',  mod: 0.25 },
  ];
  const EQ_BY_ID = Object.fromEntries(EQUIPMENT.map(e => [e.id, e]));

  // ---------- ÁRVORE DE PESQUISA (compra em PP) ----------
  const RESEARCH = [
    // Transporte (visual evolui)
    { id: 'r_wagon_big',  cat: 'Transporte', name: 'Carruagem Reforçada', desc: 'Carruagem +30% capacidade',                cost: 40,   effect: 'wagonCap',  mod: 0.30, tier: 1 },
    { id: 'r_car',        cat: 'Transporte', name: 'Carro a Combustão',   desc: '+50% capacidade, +30% velocidade',          cost: 120,  effect: 'wagonCap',  mod: 0.50, mod2: 0.30, e2: 'wagonSpd', tier: 2, req: 'r_wagon_big' },
    { id: 'r_truck',      cat: 'Transporte', name: 'Caminhão',            desc: '+80% capacidade, +30% velocidade',          cost: 250,  effect: 'wagonCap',  mod: 0.80, mod2: 0.30, e2: 'wagonSpd', tier: 3, req: 'r_car' },
    { id: 'r_bigtruck',   cat: 'Transporte', name: 'Caminhão Grande',     desc: '+120% capacidade, +20% velocidade',         cost: 450,  effect: 'wagonCap',  mod: 1.20, mod2: 0.20, e2: 'wagonSpd', tier: 4, req: 'r_truck' },
    { id: 'r_carreta',    cat: 'Transporte', name: 'Carreta',             desc: '+200% capacidade',                          cost: 700,  effect: 'wagonCap',  mod: 2.00, tier: 5, req: 'r_bigtruck' },
    { id: 'r_train',      cat: 'Transporte', name: 'Trem a Vapor',        desc: '+400% capacidade, +80% velocidade',         cost: 1200, effect: 'wagonCap',  mod: 4.00, mod2: 0.80, e2: 'wagonSpd', tier: 6, req: 'r_carreta' },
    { id: 'r_diesel',     cat: 'Transporte', name: 'Locomotiva Diesel',   desc: '+600% capacidade, +120% velocidade',        cost: 2000, effect: 'wagonCap',  mod: 6.00, mod2: 1.20, e2: 'wagonSpd', tier: 7, req: 'r_train' },

    // Mineração
    { id: 'r_drill_manual',cat: 'Mineração', name: 'Broca Manual',         desc: '+20% velocidade de mineração',             cost: 80,   effect: 'mineRate',  mod: 0.20 },
    { id: 'r_drill_pneu',  cat: 'Mineração', name: 'Broca Pneumática',     desc: '+35% adicional na mineração',              cost: 200,  effect: 'mineRate',  mod: 0.35, req: 'r_drill_manual' },
    { id: 'r_steam_dig',   cat: 'Mineração', name: 'Escavadeira a Vapor',  desc: '+60% adicional na mineração',              cost: 500,  effect: 'mineRate',  mod: 0.60, req: 'r_drill_pneu' },
    { id: 'r_hydro',       cat: 'Mineração', name: 'Britadeira Hidráulica', desc: '+100% adicional na mineração',            cost: 1000, effect: 'mineRate',  mod: 1.00, req: 'r_steam_dig' },

    // Produção
    { id: 'r_line',        cat: 'Produção', name: 'Linha de Montagem',    desc: 'Fábricas +30% velocidade',                  cost: 150,  effect: 'factSpd',   mod: 0.30 },
    { id: 'r_forge',       cat: 'Produção', name: 'Forja Industrial',     desc: '+50% adicional na produção',                cost: 380,  effect: 'factSpd',   mod: 0.50, req: 'r_line' },
    { id: 'r_auto',        cat: 'Produção', name: 'Automação a Vapor',    desc: '+80% adicional na produção',                cost: 800,  effect: 'factSpd',   mod: 0.80, req: 'r_forge' },

    // Logística
    { id: 'r_dual_rails',  cat: 'Logística',name: 'Trilhos Duplos',       desc: 'Carrinho da mina +50% capacidade',          cost: 100,  effect: 'cartCap',   mod: 0.50 },
    { id: 'r_elevator',    cat: 'Logística',name: 'Elevador Industrial',  desc: 'Carrinho +60% velocidade',                  cost: 250,  effect: 'cartSpd',   mod: 0.60, req: 'r_dual_rails' },
    { id: 'r_pulley',      cat: 'Logística',name: 'Polias Múltiplas',     desc: 'Capacidade das pilhas +50%',                cost: 500,  effect: 'pileMax',   mod: 0.50 },
  ];
  const RES_BY_ID = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
  const RES_CATS = [...new Set(RESEARCH.map(r => r.cat))];

  // ---------- CONFIG ----------
  const NUM_DEPOSITS = 7;
  const CFG = {
    startMoney: 700,
    minerCost: 60,
    factoryCosts: [0, 900, 2200, 5000],
    factorySlotsMax: 3,
    cartCapacityBase: 8,
    cartSpeedBase: 60,
    wagonCapacityBase: 5,
    wagonSpeedBase: 80,
    factoryStockMax: 25,
    warehouseMax: 300,
    minePileMaxBase: 30,
    cityDeadlineMin: 65,
    cityDeadlineMax: 100,
    contractReward: 200,
    contractApprovalGain: 12,
    contractApprovalLoss: 18,
    dayLengthSec: 30,
    approvalStart: 50,
    approvalMax: 100,
    cities: [
      'Florianópolis', 'Joinville', 'Blumenau', 'Chapecó', 'Criciúma',
      'Itajaí', 'Lages', 'Tubarão', 'Jaraguá do Sul', 'Balneário Camboriú',
      'São José', 'Brusque', 'São Bento do Sul', 'Concórdia', 'Caçador',
      'Palhoça', 'Rio do Sul', 'Camboriú', 'Navegantes', 'Içara',
    ],
    // Apenas produtos finais (Nível 4) são pedidos
    contractPool: ['rails','lantern','telegraph','mining_tools','steam_engine','cargo_wagon','bullets','rifle','pocket_watch','bank_safe'],
  };

  // ---------- PERSISTÊNCIA ----------
  const SAVE_KEY = 'tapuia_save_v1';
  const SAVE_VERSION = 1;
  const AUTOSAVE_INTERVAL = 15; // segundos de tempo real
  const PERSIST_KEYS = [
    'money','approval','day','dayTimer','speed','over',
    'deposits','factories','warehouse','products',
    'contract','currentCity','nextContractIn','contractsCompleted',
    'equipment','research','rp','log',
  ];

  let autosaveTimer = 0;
  let lastSaveTime = 0;

  function saveGame() {
    try {
      const data = { version: SAVE_VERSION, savedAt: Date.now() };
      for (const k of PERSIST_KEYS) data[k] = state[k];
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      lastSaveTime = Date.now();
      updateSaveStatus();
      return true;
    } catch (e) {
      console.error('Falha ao salvar:', e);
      return false;
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) {
        console.warn('Versão de save incompatível, ignorando.');
        return false;
      }
      for (const k of PERSIST_KEYS) {
        if (data[k] !== undefined) state[k] = data[k];
      }
      // Garantir que warehouse/products tenham todas as chaves atuais (caso adicionemos recursos)
      for (const k in R) {
        if (R[k].kind === 'raw' && state.warehouse[k] === undefined) state.warehouse[k] = 0;
        if (R[k].kind === 'prod' && state.products[k] === undefined) state.products[k] = 0;
      }
      // Reinicia carrinho e carruagem para estados estáveis (evita transições parciais)
      state.cart = { pos: 1, dir: 0, load: {}, state: 'idle', timer: 0 };
      state.wagon = { pos: 0, dir: 0, product: null, load: 0, state: 'idle', timer: 0 };
      lastSaveTime = data.savedAt || Date.now();
      return true;
    } catch (e) {
      console.error('Falha ao carregar:', e);
      return false;
    }
  }

  function deleteSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  function updateSaveStatus() {
    const el = $('save-status');
    if (!el) return;
    if (!lastSaveTime) { el.textContent = 'sem gravação'; return; }
    const ago = Math.floor((Date.now() - lastSaveTime) / 1000);
    if (ago < 5) el.textContent = 'salvo agora';
    else if (ago < 60) el.textContent = `salvo há ${ago}s`;
    else if (ago < 3600) el.textContent = `salvo há ${Math.floor(ago/60)} min`;
    else el.textContent = `salvo há ${Math.floor(ago/3600)}h`;
  }

  // ---------- ESTADO ----------
  const state = {
    money: CFG.startMoney,
    approval: CFG.approvalStart,
    day: 1,
    dayTimer: 0,
    speed: 1,
    over: false,

    deposits: Array.from({ length: NUM_DEPOSITS }, (_, i) => ({
      slot: i,
      resource: i === 0 ? 'coal' : (i === 1 ? 'iron_ore' : null),
      miners: (i < 2) ? 1 : 0,
      pile: 0,
    })),

    factories: [
      { recipeId: 'iron_ingot', brewing: 0, output: 0 },
    ],

    warehouse: Object.fromEntries(Object.keys(R).filter(k => R[k].kind === 'raw').map(k => [k, 0])),
    products: Object.fromEntries(Object.keys(R).filter(k => R[k].kind === 'prod').map(k => [k, 0])),

    cart: { pos: 1, dir: 0, load: {}, state: 'idle', timer: 0 },
    wagon: { pos: 0, dir: 0, product: null, load: 0, state: 'idle', timer: 0 },

    contract: null,
    currentCity: 'Florianópolis',
    nextContractIn: 6,
    contractsCompleted: 0,

    equipment: {},
    research: {},
    rp: 0,
    log: [],
  };

  // ---------- UTIL ----------
  const $ = (id) => document.getElementById(id);
  const fmtMoney = (n) => '$' + Math.floor(n).toLocaleString('pt-BR');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));

  function log(msg, kind = '') {
    state.log.unshift({ msg, kind, day: state.day });
    if (state.log.length > 80) state.log.pop();
  }

  function eqMod(effect) {
    let total = 0;
    for (const id in state.equipment) {
      if (state.equipment[id]) {
        const e = EQ_BY_ID[id];
        if (e && e.effect === effect) total += e.mod;
      }
    }
    for (const id in state.research) {
      if (state.research[id]) {
        const r = RES_BY_ID[id];
        if (!r) continue;
        if (r.effect === effect) total += r.mod;
        if (r.e2 === effect) total += r.mod2 || 0;
      }
    }
    return total;
  }

  function transportTier() {
    let t = 0;
    for (const id in state.research) {
      if (state.research[id]) {
        const r = RES_BY_ID[id];
        if (r && r.tier && r.tier > t) t = r.tier;
      }
    }
    return t;
  }

  const cartCapacity   = () => Math.floor(CFG.cartCapacityBase * (1 + eqMod('cartCap')));
  const cartSpeed      = () => CFG.cartSpeedBase * (1 + eqMod('cartSpd'));
  const wagonCapacity  = () => Math.floor(CFG.wagonCapacityBase * (1 + eqMod('wagonCap')));
  const wagonSpeed     = () => CFG.wagonSpeedBase * (1 + eqMod('wagonSpd'));
  const mineRateMul    = () => 1 + eqMod('mineRate');
  const factSpdMul     = () => 1 + eqMod('factSpd');
  const pileMaxMul     = () => 1 + eqMod('pileMax');
  const pileMax        = () => Math.floor(CFG.minePileMaxBase * pileMaxMul());

  // ---------- CANVAS ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = 320;
  const WAREHOUSE = { x: 80, y: 180, w: 130, h: 140 };
  const FACTORY_AREA = { x: 230, y: 180, w: 590, h: 140, gap: 10, slots: 3 };
  const factoryRect = (i) => {
    const slotW = (FACTORY_AREA.w - (FACTORY_AREA.slots - 1) * FACTORY_AREA.gap) / FACTORY_AREA.slots;
    return { x: FACTORY_AREA.x + i * (slotW + FACTORY_AREA.gap), y: FACTORY_AREA.y, w: slotW, h: FACTORY_AREA.h };
  };
  const CITY = { x: 1000, y: 150, w: 240, h: 170 };
  const MINE_SHAFT = { x: 100, top: GROUND_Y, bottom: H - 110, w: 50 };
  const TUNNEL = { x: 160, y: H - 160, w: W - 170, h: 90 };
  const DEPOSIT_W = TUNNEL.w / NUM_DEPOSITS;
  const ROAD = { y: GROUND_Y, x1: FACTORY_AREA.x + FACTORY_AREA.w + 20, x2: CITY.x };

  // ---------- AÇÕES ----------
  function tryHire(slotIndex) {
    const d = state.deposits[slotIndex];
    if (!d || !d.resource) return;
    if (state.money < CFG.minerCost) return;
    state.money -= CFG.minerCost;
    d.miners++;
    log(`Minerador contratado em ${R[d.resource].name} (slot ${slotIndex + 1}).`);
  }

  function tryFireMiner(slotIndex) {
    const d = state.deposits[slotIndex];
    if (!d || d.miners <= 0) return;
    d.miners--;
    state.money += Math.floor(CFG.minerCost * 0.3);
    log(`Minerador dispensado de ${R[d.resource].name}.`);
  }

  function openDeposit(slotIndex, resourceId) {
    const dep = state.deposits[slotIndex];
    const type = DEP_BY_ID[resourceId];
    if (!type || !dep || dep.resource) return;
    if (state.money < type.cost) return;
    if (state.deposits.some(d => d.resource === resourceId)) return;
    state.money -= type.cost;
    dep.resource = resourceId;
    log(`Depósito de ${R[resourceId].name} aberto (slot ${slotIndex + 1}).`, 'good');
    closeModal('modal-deposit');
  }

  function buyFactory() {
    if (state.factories.length >= CFG.factorySlotsMax) return;
    const cost = CFG.factoryCosts[state.factories.length];
    if (state.money < cost) return;
    state.money -= cost;
    state.factories.push({ recipeId: 'wood_plank', brewing: 0, output: 0 });
    log(`Nova fábrica construída por ${fmtMoney(cost)}.`, 'good');
  }

  function setRecipe(factoryIndex, recipeId) {
    const f = state.factories[factoryIndex];
    if (!f || !RECIPE_BY_ID[recipeId]) return;
    f.recipeId = recipeId;
    f.brewing = 0;
    log(`Fábrica ${factoryIndex + 1} agora produz ${R[recipeId].name}.`);
    closeModal('modal-recipe');
  }

  function buyEquipment(id) {
    const e = EQ_BY_ID[id];
    if (!e || state.equipment[id]) return;
    if (e.req && !state.equipment[e.req]) return;
    if (state.money < e.cost) return;
    state.money -= e.cost;
    state.equipment[id] = true;
    log(`Equipamento adquirido: ${e.name}.`, 'good');
  }

  function buyResearch(id) {
    const r = RES_BY_ID[id];
    if (!r || state.research[id]) return;
    if (r.req && !state.research[r.req]) return;
    if (state.rp < r.cost) return;
    state.rp -= r.cost;
    state.research[id] = true;
    log(`Pesquisa concluída: ${r.name}.`, 'good');
  }

  // ---------- CONTRATOS ----------
  function pickContractProduct() {
    // Quanto mais contratos cumpridos, mais variedade
    const tier = Math.min(state.contractsCompleted, CFG.contractPool.length - 1);
    const max = Math.max(3, Math.min(CFG.contractPool.length, 3 + Math.floor(tier / 2)));
    return CFG.contractPool[irand(0, max - 1)];
  }

  function generateContract() {
    const productId = pickContractProduct();
    const price = R[productId].price;
    // Itens mais caros: contratos com menor quantidade e mais tempo
    const need = clamp(Math.round(rand(8, 18) * 100 / price), 2, 16);
    const deadline = rand(CFG.cityDeadlineMin, CFG.cityDeadlineMax) + price * 0.18;
    let city = CFG.cities[irand(0, CFG.cities.length - 1)];
    if (state.contract && city === state.contract.city) {
      city = CFG.cities[(CFG.cities.indexOf(city) + 1) % CFG.cities.length];
    }
    state.contract = { city, product: productId, need, delivered: 0, deadline, elapsed: 0 };
    state.currentCity = city;
    log(`${city} pede ${need} ${R[productId].name} em ${Math.round(deadline)}s.`);
  }

  function deliverProduct(amount) {
    if (!state.contract) return;
    state.contract.delivered += amount;
    if (state.contract.delivered >= state.contract.need) {
      const p = R[state.contract.product];
      const reward = CFG.contractReward + p.price * state.contract.need;
      const rpGain = 5 + Math.floor(state.contract.need * 0.6 + p.price * 0.02);
      state.money += reward;
      state.rp += rpGain;
      state.approval = clamp(state.approval + CFG.contractApprovalGain, 0, CFG.approvalMax);
      state.contractsCompleted++;
      log(`${state.contract.city}: ${p.name} entregue! +${fmtMoney(reward)}, +${rpGain} PP e +${CFG.contractApprovalGain} aprovação.`, 'good');
      state.contract = null;
      state.nextContractIn = rand(5, 9);
    }
  }

  function failContract() {
    const cityName = state.contract ? state.contract.city : 'Cidade';
    state.approval = clamp(state.approval - CFG.contractApprovalLoss, 0, CFG.approvalMax);
    log(`${cityName}: contrato expirou. −${CFG.contractApprovalLoss} aprovação.`, 'bad');
    state.contract = null;
    state.nextContractIn = rand(6, 12);
  }

  // ---------- SIMULAÇÃO ----------
  function updateDeposits(dt) {
    const cap = pileMax();
    const mul = mineRateMul();
    for (const d of state.deposits) {
      if (!d.resource || d.miners <= 0) continue;
      const type = DEP_BY_ID[d.resource];
      if (!type) continue;
      const produced = d.miners * type.rate * mul * dt;
      d.pile = Math.min(cap, d.pile + produced);
    }
  }

  function totalMinePile() {
    let total = 0;
    for (const d of state.deposits) total += d.pile;
    return total;
  }

  function warehouseTotal() {
    let total = 0;
    for (const k in state.warehouse) {
      if (R[k] && R[k].free) continue;
      total += state.warehouse[k];
    }
    return total;
  }

  function updateCart(dt) {
    const c = state.cart;
    const cap = cartCapacity();
    const spd = cartSpeed();
    const shaftLen = MINE_SHAFT.bottom - MINE_SHAFT.top;

    switch (c.state) {
      case 'idle': {
        if (c.pos >= 0.99 && totalMinePile() >= 1 && warehouseTotal() < CFG.warehouseMax) {
          c.state = 'loading';
          c.timer = 1.0;
        }
        if (c.pos <= 0.01 && Object.keys(c.load).length === 0) {
          c.state = 'hauling';
          c.dir = +1;
        }
        break;
      }
      case 'loading': {
        c.timer -= dt;
        if (c.timer <= 0) {
          let remaining = cap;
          const order = state.deposits
            .filter(d => d.resource && d.pile >= 1)
            .sort((a, b) => b.pile - a.pile);
          for (const d of order) {
            if (remaining <= 0) break;
            const take = Math.min(Math.floor(d.pile), remaining);
            if (take > 0) {
              c.load[d.resource] = (c.load[d.resource] || 0) + take;
              d.pile -= take;
              remaining -= take;
            }
          }
          c.state = Object.keys(c.load).length > 0 ? 'hauling' : 'idle';
          c.dir = -1;
        }
        break;
      }
      case 'hauling': {
        const dPos = (spd * dt) / shaftLen;
        c.pos += c.dir * dPos;
        if (c.dir < 0 && c.pos <= 0) {
          c.pos = 0;
          c.state = 'unloading';
          c.timer = 0.8;
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
          for (const res in c.load) {
            const space = CFG.warehouseMax - warehouseTotal();
            if (space <= 0) break;
            const drop = Math.min(c.load[res], space);
            state.warehouse[res] += drop;
            c.load[res] -= drop;
            if (c.load[res] <= 0) delete c.load[res];
          }
          c.state = 'idle';
        }
        break;
      }
    }
  }

  function ingredientHave(ing) {
    if (R[ing].free) return Infinity;
    if (R[ing].kind === 'raw') return state.warehouse[ing] || 0;
    return state.products[ing] || 0;
  }
  function ingredientConsume(ing, n) {
    if (R[ing].free) return;
    if (R[ing].kind === 'raw') state.warehouse[ing] -= n;
    else state.products[ing] -= n;
  }

  function updateFactories(dt) {
    const mul = factSpdMul();
    for (const f of state.factories) {
      const recipe = RECIPE_BY_ID[f.recipeId];
      if (!recipe) continue;
      if (f.brewing > 0) {
        f.brewing -= dt * mul;
        if (f.brewing <= 0) {
          state.products[f.recipeId] = (state.products[f.recipeId] || 0) + 1;
          f.output = state.products[f.recipeId];
          f.brewing = 0;
        }
      }
      if (f.brewing <= 0 && (state.products[f.recipeId] || 0) < CFG.factoryStockMax) {
        let canStart = true;
        for (const ing in recipe.in) {
          if (ingredientHave(ing) < recipe.in[ing]) { canStart = false; break; }
        }
        if (canStart) {
          for (const ing in recipe.in) ingredientConsume(ing, recipe.in[ing]);
          f.brewing = recipe.time;
        }
      }
    }
  }

  function updateWagon(dt) {
    const w = state.wagon;
    const cap = wagonCapacity();
    const spd = wagonSpeed();
    const roadLen = ROAD.x2 - ROAD.x1;

    switch (w.state) {
      case 'idle': {
        if (w.pos <= 0.01 && state.contract && (state.products[state.contract.product] || 0) > 0) {
          w.product = state.contract.product;
          w.state = 'loading';
          w.timer = 0.6;
        }
        if (w.pos >= 0.99 && w.load === 0) {
          w.state = 'hauling';
          w.dir = -1;
        }
        break;
      }
      case 'loading': {
        w.timer -= dt;
        if (w.timer <= 0) {
          const avail = state.products[w.product] || 0;
          let needBy = avail;
          if (state.contract && state.contract.product === w.product) {
            needBy = Math.max(0, state.contract.need - state.contract.delivered);
          }
          const take = Math.min(cap, avail, needBy);
          if (take > 0) {
            w.load = take;
            state.products[w.product] -= take;
            w.state = 'hauling';
            w.dir = +1;
          } else {
            w.state = 'idle';
            w.product = null;
          }
        }
        break;
      }
      case 'hauling': {
        const dPos = (spd * dt) / roadLen;
        w.pos += w.dir * dPos;
        if (w.dir > 0 && w.pos >= 1) {
          w.pos = 1;
          w.state = 'unloading';
          w.timer = 0.5;
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
          if (state.contract && state.contract.product === w.product) {
            deliverProduct(w.load);
          } else {
            state.products[w.product] = (state.products[w.product] || 0) + w.load;
          }
          w.load = 0;
          w.product = null;
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
      if (state.contract.elapsed >= state.contract.deadline) failContract();
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
      state.rp += 2;
      if (state.day % 7 === 0) {
        const tax = Math.floor(state.approval * 5);
        state.money += tax;
        log(`Coleta tributária semanal: +${fmtMoney(tax)}.`);
      }
    }
  }

  function checkEnd() {
    if (state.over) return;
    if (state.approval <= 0) {
      state.over = true;
      $('end-title').textContent = 'A população te destituiu';
      $('end-text').textContent = 'A aprovação caiu a zero. O governo central revogou seu mandato.';
      $('game-over').classList.remove('hidden');
    } else if (state.approval >= CFG.approvalMax && state.day >= 21 && state.contractsCompleted >= 10) {
      state.over = true;
      $('end-title').textContent = 'Vitória política!';
      $('end-text').textContent = `Aprovação máxima após ${state.day} dias e ${state.contractsCompleted} contratos cumpridos. Santa Catarina prospera sob a Tapuia.`;
      $('game-over').classList.remove('hidden');
    }
  }

  function tick(dt) {
    if (state.over) return;
    updateDeposits(dt);
    updateCart(dt);
    updateFactories(dt);
    updateWagon(dt);
    updateContract(dt);
    updateDay(dt);
    checkEnd();
    // autosave (usa tempo real, não dt do jogo, para garantir gravação mesmo pausado/acelerado)
  }

  // ---------- DESENHO ----------
  function drawSky() {
    const grd = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grd.addColorStop(0, '#e8c98a');
    grd.addColorStop(1, '#d2a76a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, GROUND_Y);
    ctx.fillStyle = 'rgba(255, 220, 150, 0.6)';
    ctx.beginPath();
    ctx.arc(W - 180, 80, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (const c of [[200, 60, 40], [500, 90, 60], [800, 50, 35]]) {
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], c[2], c[2] * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround() {
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(0, GROUND_Y, W, 20);
    ctx.fillStyle = '#6b3f1a';
    ctx.fillRect(0, GROUND_Y + 20, W, H - GROUND_Y - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 100; i++) {
      const x = (i * 71) % W;
      const y = GROUND_Y + 40 + ((i * 47) % (H - GROUND_Y - 60));
      ctx.fillRect(x, y, 3, 2);
    }
  }

  function drawMineShaft() {
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(MINE_SHAFT.x, MINE_SHAFT.top, MINE_SHAFT.w, MINE_SHAFT.bottom - MINE_SHAFT.top);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 - 6, MINE_SHAFT.top);
    ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 - 6, MINE_SHAFT.bottom);
    ctx.moveTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 + 6, MINE_SHAFT.top);
    ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 + 6, MINE_SHAFT.bottom);
    ctx.stroke();
    ctx.strokeStyle = '#5a3416';
    for (let y = MINE_SHAFT.top + 20; y < MINE_SHAFT.bottom; y += 30) {
      ctx.beginPath();
      ctx.moveTo(MINE_SHAFT.x + 4, y);
      ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w - 4, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(MINE_SHAFT.x - 10, GROUND_Y - 90, 12, 90);
    ctx.fillRect(MINE_SHAFT.x + MINE_SHAFT.w - 2, GROUND_Y - 90, 12, 90);
    ctx.fillRect(MINE_SHAFT.x - 10, GROUND_Y - 90, MINE_SHAFT.w + 20, 10);
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(MINE_SHAFT.x + MINE_SHAFT.w / 2, GROUND_Y - 85, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDeposits() {
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(TUNNEL.x, TUNNEL.y, TUNNEL.w, TUNNEL.h);
    ctx.fillStyle = '#3a1f0a';
    for (let i = 1; i < NUM_DEPOSITS; i++) {
      ctx.fillRect(TUNNEL.x + i * DEPOSIT_W - 2, TUNNEL.y, 4, TUNNEL.h);
    }
    for (let i = 0; i < state.deposits.length; i++) {
      const d = state.deposits[i];
      const dx = TUNNEL.x + i * DEPOSIT_W;
      if (d.resource) {
        const c = R[d.resource].color;
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(dx + 4, TUNNEL.y + 4, DEPOSIT_W - 8, TUNNEL.h - 8);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = d.resource ? '#f1e3c2' : '#a07a4a';
      ctx.font = 'bold 9px Georgia';
      ctx.textAlign = 'center';
      const label = d.resource ? R[d.resource].name.toUpperCase() : 'SLOT VAZIO';
      // quebra nome em duas linhas se for longo
      if (label.length > 14) {
        const words = label.split(' ');
        const half = Math.ceil(words.length / 2);
        ctx.fillText(words.slice(0, half).join(' '), dx + DEPOSIT_W / 2, TUNNEL.y + 12);
        ctx.fillText(words.slice(half).join(' '), dx + DEPOSIT_W / 2, TUNNEL.y + 22);
      } else {
        ctx.fillText(label, dx + DEPOSIT_W / 2, TUNNEL.y + 14);
      }
      if (d.resource) {
        drawPile(dx + 10, TUNNEL.y + TUNNEL.h - 6, d.pile, R[d.resource].color);
        drawMiners(d.miners, dx + DEPOSIT_W / 2 + 4, TUNNEL.y + TUNNEL.h - 8, R[d.resource].color);
        ctx.fillStyle = '#f1e3c2';
        ctx.font = '9px Georgia';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(d.pile)}/${pileMax()}`, dx + DEPOSIT_W - 6, TUNNEL.y + 34);
        ctx.textAlign = 'left';
        ctx.fillText(`⛏ ${d.miners}`, dx + 6, TUNNEL.y + 34);
      }
    }
  }

  function drawPile(x, baseY, amount, color) {
    if (amount <= 0) return;
    const n = Math.min(24, Math.ceil(amount));
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const px = x + (i % 5) * 5;
      const py = baseY - Math.floor(i / 5) * 4;
      ctx.fillRect(px, py - 4, 5, 4);
    }
  }

  function drawMiners(count, x, baseY, accent) {
    const t = performance.now() / 200;
    for (let i = 0; i < Math.min(count, 4); i++) {
      const mx = x + i * 11;
      const swing = Math.sin(t + i) * 3;
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(mx, baseY - 14, 5, 10);
      ctx.fillStyle = accent;
      ctx.fillRect(mx, baseY - 20, 5, 5);
      ctx.fillStyle = '#c69042';
      ctx.fillRect(mx - 1, baseY - 21, 7, 2);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(mx + 5, baseY - 10);
      ctx.lineTo(mx + 10 + swing, baseY - 16 - Math.abs(swing));
      ctx.stroke();
    }
  }

  function drawCart() {
    const c = state.cart;
    const shaftLen = MINE_SHAFT.bottom - MINE_SHAFT.top;
    const cy = MINE_SHAFT.top + shaftLen * c.pos;
    const cx = MINE_SHAFT.x + MINE_SHAFT.w / 2;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, GROUND_Y - 85);
    ctx.lineTo(cx, cy - 6);
    ctx.stroke();
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(cx - 16, cy - 14, 32, 18);
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(cx - 16, cy + 2, 32, 4);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(cx - 10, cy + 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 10, cy + 6, 4, 0, Math.PI * 2); ctx.fill();
    const total = Object.values(c.load).reduce((a, b) => a + b, 0);
    if (total > 0) {
      let xOff = 0;
      for (const res in c.load) {
        const w = (c.load[res] / total) * 28;
        ctx.fillStyle = R[res].color;
        ctx.fillRect(cx - 14 + xOff, cy - 12, w, 10);
        xOff += w;
      }
    }
  }

  function drawWarehouse() {
    const w = WAREHOUSE;
    ctx.fillStyle = '#6b4a28';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(w.x, w.y, w.w, 12);
    ctx.beginPath();
    ctx.moveTo(w.x - 8, w.y);
    ctx.lineTo(w.x + w.w / 2, w.y - 26);
    ctx.lineTo(w.x + w.w + 8, w.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(w.x + w.w / 2 - 18, w.y + w.h - 50, 36, 50);
    ctx.strokeStyle = '#c69042';
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x + w.w / 2 - 18, w.y + w.h - 50, 36, 50);
    ctx.fillStyle = '#c69042';
    ctx.fillRect(w.x + 8, w.y + 18, w.w - 16, 16);
    ctx.fillStyle = '#1a0e06';
    ctx.font = 'bold 10px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('ARMAZÉM CENTRAL', w.x + w.w / 2, w.y + 30);
    drawWarehouseBars(w);
  }

  function drawWarehouseBars(w) {
    const items = [];
    for (const k in state.warehouse) {
      if (R[k] && R[k].free) continue;
      if (state.warehouse[k] > 0) items.push({ k, n: state.warehouse[k] });
    }
    items.sort((a, b) => b.n - a.n);
    const top = items.slice(0, 8);
    const startX = w.x + 8;
    const barW = (w.w - 16) / Math.max(1, top.length);
    const baseY = w.y + w.h - 8;
    const maxH = w.h - 60;
    let maxN = 1;
    for (const it of top) if (it.n > maxN) maxN = it.n;
    for (let i = 0; i < top.length; i++) {
      const it = top[i];
      const h = (it.n / Math.max(maxN, 10)) * maxH;
      ctx.fillStyle = R[it.k].color;
      ctx.fillRect(startX + i * barW + 2, baseY - h, barW - 4, h);
    }
  }

  function drawFactories() {
    for (let i = 0; i < state.factories.length; i++) {
      const f = state.factories[i];
      const rect = factoryRect(i);
      ctx.fillStyle = '#7a4b25';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#5a3416';
      ctx.fillRect(rect.x, rect.y, rect.w, 10);
      ctx.fillStyle = '#f1e3c2';
      for (let j = 0; j < 3; j++) {
        ctx.fillRect(rect.x + 16 + j * 40, rect.y + 30, 20, 18);
      }
      ctx.fillStyle = '#3a1f0a';
      ctx.fillRect(rect.x + rect.w - 38, rect.y - 56, 16, 56);
      const intensity = f.brewing > 0 ? 1 : 0.4;
      const t = performance.now() / 600;
      ctx.fillStyle = `rgba(60,40,20,${0.4 * intensity})`;
      for (let k = 0; k < 4; k++) {
        const yOff = (t * 30 + k * 25) % 100;
        const r = 7 + k * 2;
        ctx.beginPath();
        ctx.arc(rect.x + rect.w - 30, rect.y - 60 - yOff, r, 0, Math.PI * 2);
        ctx.fill();
      }
      drawGear(rect.x + 22, rect.y + 70, 14, performance.now() / 400 * (f.brewing > 0 ? 1 : 0.2));
      const recipeName = R[f.recipeId]?.name || '—';
      ctx.fillStyle = '#c69042';
      ctx.fillRect(rect.x + 6, rect.y + rect.h - 28, rect.w - 12, 18);
      ctx.fillStyle = '#1a0e06';
      ctx.font = 'bold 9px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(recipeName.toUpperCase(), rect.x + rect.w / 2, rect.y + rect.h - 15);
      const recipe = RECIPE_BY_ID[f.recipeId];
      if (recipe && f.brewing > 0) {
        const pct = 1 - f.brewing / recipe.time;
        ctx.fillStyle = '#1a0e06';
        ctx.fillRect(rect.x + 8, rect.y - 10, rect.w - 16, 5);
        ctx.fillStyle = '#c69042';
        ctx.fillRect(rect.x + 8, rect.y - 10, (rect.w - 16) * pct, 5);
      }
      ctx.fillStyle = R[f.recipeId]?.color || '#888';
      const stkW = clamp(state.products[f.recipeId] || 0, 0, 25) * 2;
      ctx.fillRect(rect.x + 8, rect.y + rect.h + 4, stkW, 6);
      // indicador de tier
      ctx.fillStyle = '#1a0e06';
      ctx.font = '9px Georgia';
      ctx.textAlign = 'left';
      ctx.fillText(`N${R[f.recipeId]?.tier || '?'}`, rect.x + 4, rect.y + 22);
    }
    for (let i = state.factories.length; i < CFG.factorySlotsMax; i++) {
      const rect = factoryRect(i);
      ctx.strokeStyle = '#7a4b25';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(122, 75, 37, 0.4)';
      ctx.font = 'bold 14px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('SLOT DISPONÍVEL', rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.font = '11px Georgia';
      ctx.fillText(fmtMoney(CFG.factoryCosts[i]), rect.x + rect.w / 2, rect.y + rect.h / 2 + 18);
    }
  }

  function drawGear(x, y, r, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#888';
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / 8);
      ctx.fillRect(-3, -r - 3, 6, 7);
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
    const tier = transportTier();
    if (tier >= 6) {
      ctx.fillStyle = '#6b3f1a';
      ctx.fillRect(ROAD.x1, ROAD.y - 8, ROAD.x2 - ROAD.x1, 18);
      ctx.fillStyle = '#3a1f0a';
      for (let x = ROAD.x1; x < ROAD.x2; x += 14) {
        ctx.fillRect(x, ROAD.y - 6, 8, 14);
      }
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ROAD.x1, ROAD.y - 4); ctx.lineTo(ROAD.x2, ROAD.y - 4);
      ctx.moveTo(ROAD.x1, ROAD.y + 6); ctx.lineTo(ROAD.x2, ROAD.y + 6);
      ctx.stroke();
    } else if (tier >= 2) {
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(ROAD.x1, ROAD.y - 8, ROAD.x2 - ROAD.x1, 18);
      ctx.strokeStyle = '#e8d4a4';
      ctx.setLineDash([12, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ROAD.x1, ROAD.y + 1);
      ctx.lineTo(ROAD.x2, ROAD.y + 1);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
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
  }

  function drawWagon() {
    const w = state.wagon;
    const wx = ROAD.x1 + (ROAD.x2 - ROAD.x1) * w.pos;
    const wy = ROAD.y - 16;
    const tier = transportTier();
    if (tier <= 1) drawCarriage(wx, wy, w, tier);
    else if (tier === 2) drawCar(wx, wy, w);
    else if (tier === 3) drawTruck(wx, wy, w, 1.0);
    else if (tier === 4) drawTruck(wx, wy, w, 1.3);
    else if (tier === 5) drawCarreta(wx, wy, w);
    else if (tier === 6) drawTrain(wx, wy, w, 'steam');
    else drawTrain(wx, wy, w, 'diesel');
  }

  function drawCarriage(wx, wy, w, tier) {
    const scale = tier === 1 ? 1.15 : 1.0;
    const half = 20 * scale;
    if (w.dir !== 0) {
      ctx.fillStyle = '#3a1f0a';
      const hx = wx + (w.dir > 0 ? half + 12 : -half - 30);
      ctx.fillRect(hx, wy + 4, 18, 14);
      ctx.fillRect(hx + (w.dir > 0 ? 14 : -4), wy - 2, 6, 8);
    }
    ctx.fillStyle = '#7a4b25';
    ctx.fillRect(wx - half, wy, half * 2, 16);
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(wx - half, wy + 14, half * 2, 4);
    ctx.fillStyle = '#e8d4a4';
    ctx.beginPath();
    ctx.ellipse(wx, wy + 2, half + 2, 8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(wx - half + 6, wy + 20, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(wx + half - 6, wy + 20, 6, 0, Math.PI * 2); ctx.fill();
    drawCargoBar(wx - half + 5, wy + 4, half * 2 - 10, 8, w);
  }

  function drawCar(wx, wy, w) {
    ctx.fillStyle = '#8a2a1a';
    ctx.fillRect(wx - 24, wy + 2, 48, 16);
    ctx.fillRect(wx + (w.dir >= 0 ? 18 : -28), wy + 6, 14, 8);
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(wx - 20, wy - 2, 30, 6);
    ctx.fillStyle = '#a8c8d8';
    ctx.fillRect(wx - 18, wy, 12, 4);
    ctx.fillRect(wx - 4, wy, 12, 4);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(wx - 16, wy + 22, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(wx + 16, wy + 22, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe680';
    if (w.dir !== 0) {
      ctx.beginPath();
      ctx.arc(wx + (w.dir > 0 ? 30 : -30), wy + 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    drawCargoBar(wx - 22, wy + 6, 44, 4, w);
  }

  function drawTruck(wx, wy, w, scale) {
    const len = 60 * scale;
    ctx.fillStyle = '#2a4a7a';
    ctx.fillRect(wx + (w.dir > 0 ? len/2 - 16 : -len/2), wy, 16, 18);
    ctx.fillStyle = '#7a4b25';
    ctx.fillRect(wx - len/2, wy - 4, len - 18, 22);
    ctx.fillStyle = '#a8c8d8';
    ctx.fillRect(wx + (w.dir > 0 ? len/2 - 14 : -len/2 + 2), wy + 2, 12, 6);
    ctx.fillStyle = '#222';
    for (const offX of [-len/2 + 8, len/2 - 24, len/2 - 8]) {
      ctx.beginPath(); ctx.arc(wx + offX, wy + 22, 6 * Math.min(scale, 1.15), 0, Math.PI * 2); ctx.fill();
    }
    drawCargoBar(wx - len/2 + 4, wy, len - 26, 10, w);
  }

  function drawCarreta(wx, wy, w) {
    ctx.fillStyle = '#2a4a7a';
    ctx.fillRect(wx + (w.dir > 0 ? 26 : -42), wy, 18, 22);
    ctx.fillStyle = '#a8c8d8';
    ctx.fillRect(wx + (w.dir > 0 ? 28 : -40), wy + 4, 14, 8);
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(wx - 40, wy - 6, 70, 26);
    ctx.strokeStyle = '#7a7e87';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(wx - 40 + i * 9, wy - 6);
      ctx.lineTo(wx - 40 + i * 9, wy + 20);
      ctx.stroke();
    }
    ctx.fillStyle = '#222';
    for (const offX of [-32, -20, 18, 30, 38]) {
      ctx.beginPath(); ctx.arc(wx + offX, wy + 24, 5, 0, Math.PI * 2); ctx.fill();
    }
    drawCargoBar(wx - 36, wy, 60, 10, w);
  }

  function drawTrain(wx, wy, w, type) {
    if (type === 'steam') {
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(wx - 10, wy - 8, 30, 28);
      ctx.fillStyle = '#3a1f0a';
      ctx.fillRect(wx + (w.dir > 0 ? 18 : -34), wy - 2, 16, 18);
      ctx.fillStyle = '#222';
      ctx.fillRect(wx + (w.dir > 0 ? 22 : -30), wy - 18, 8, 12);
      const t = performance.now() / 400;
      ctx.fillStyle = 'rgba(80,80,80,0.6)';
      for (let i = 0; i < 3; i++) {
        const yOff = (t * 15 + i * 8) % 30;
        ctx.beginPath();
        ctx.arc(wx + (w.dir > 0 ? 26 : -26), wy - 22 - yOff, 5 + i, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#9c3a1a';
      ctx.fillRect(wx - 20, wy - 6, 44, 24);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(wx - 18, wy - 4, 40, 4);
      ctx.fillStyle = '#a8c8d8';
      ctx.fillRect(wx + (w.dir > 0 ? 12 : -22), wy + 2, 10, 6);
    }
    ctx.fillStyle = type === 'steam' ? '#5a3416' : '#3a4a7a';
    ctx.fillRect(wx + (w.dir > 0 ? -50 : 28), wy - 4, 40, 22);
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(wx + (w.dir > 0 ? -50 : 28), wy + 14, 40, 4);
    ctx.fillStyle = '#222';
    for (const offX of [-44, -32, -8, 8, 20]) {
      ctx.beginPath(); ctx.arc(wx + (w.dir > 0 ? offX : -offX), wy + 22, 5, 0, Math.PI * 2); ctx.fill();
    }
    drawCargoBar(wx + (w.dir > 0 ? -48 : 30), wy, 36, 8, w);
  }

  function drawCargoBar(x, y, width, height, w) {
    if (w.load > 0 && w.product) {
      ctx.fillStyle = R[w.product].color;
      const barW = (w.load / wagonCapacity()) * width;
      ctx.fillRect(x, y, barW, height);
    }
  }

  function drawCity() {
    ctx.fillStyle = '#a07a4a';
    ctx.beginPath();
    ctx.moveTo(CITY.x - 20, GROUND_Y);
    ctx.lineTo(CITY.x + 30, CITY.y + 20);
    ctx.lineTo(CITY.x + CITY.w + 20, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    const buildings = [
      { x: 20, y: 70, w: 50, h: 100, c: '#a85a2a' },
      { x: 80, y: 40, w: 60, h: 130, c: '#7a4b25' },
      { x: 150, y: 60, w: 45, h: 110, c: '#c46a3a' },
      { x: 200, y: 30, w: 35, h: 140, c: '#5a3416' },
    ];
    for (const b of buildings) {
      ctx.fillStyle = b.c;
      ctx.fillRect(CITY.x + b.x, CITY.y + b.y, b.w, b.h);
      ctx.fillStyle = '#3a1f0a';
      ctx.fillRect(CITY.x + b.x - 2, CITY.y + b.y - 6, b.w + 4, 6);
      ctx.fillStyle = '#f1e3c2';
      for (let row = 0; row < Math.floor(b.h / 20); row++) {
        for (let col = 0; col < Math.floor(b.w / 14); col++) {
          if ((row + col) % 2 === 0) {
            ctx.fillRect(CITY.x + b.x + 4 + col * 14, CITY.y + b.y + 8 + row * 20, 6, 8);
          }
        }
      }
    }
    const cityLabel = (state.currentCity || 'Florianópolis').toUpperCase();
    ctx.font = 'bold 12px Georgia';
    const labelW = Math.max(140, ctx.measureText(cityLabel).width + 20);
    ctx.fillStyle = '#c69042';
    ctx.fillRect(CITY.x + CITY.w / 2 - labelW / 2, CITY.y + 6, labelW, 20);
    ctx.fillStyle = '#1a0e06';
    ctx.textAlign = 'center';
    ctx.fillText(cityLabel, CITY.x + CITY.w / 2, CITY.y + 20);

    if (state.contract) {
      const k = state.contract;
      const pct = clamp(k.delivered / k.need, 0, 1);
      const tpct = clamp(k.elapsed / k.deadline, 0, 1);
      const bx = CITY.x + 10;
      const by = CITY.y - 60;
      ctx.fillStyle = 'rgba(241,227,194,0.95)';
      ctx.fillRect(bx, by, 220, 54);
      ctx.strokeStyle = '#5a3416';
      ctx.strokeRect(bx, by, 220, 54);
      ctx.fillStyle = '#1a0e06';
      ctx.font = 'bold 11px Georgia';
      ctx.textAlign = 'left';
      ctx.fillText(`${R[k.product].name}`, bx + 6, by + 14);
      ctx.font = '11px Georgia';
      ctx.fillText(`${k.delivered}/${k.need}`, bx + 6, by + 28);
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(bx + 6, by + 32, 208, 4);
      ctx.fillStyle = '#4d7c3a';
      ctx.fillRect(bx + 6, by + 32, 208 * pct, 4);
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(bx + 6, by + 40, 208, 4);
      ctx.fillStyle = tpct > 0.75 ? '#a82e1c' : '#c69042';
      ctx.fillRect(bx + 6, by + 40, 208 * (1 - tpct), 4);
      // tempo restante em segundos
      ctx.fillStyle = '#1a0e06';
      ctx.font = '10px Georgia';
      ctx.textAlign = 'right';
      ctx.fillText(`${(k.deadline - k.elapsed).toFixed(0)}s`, bx + 214, by + 28);
    }
  }

  function draw() {
    drawSky();
    drawGround();
    drawMineShaft();
    drawDeposits();
    drawRoad();
    drawWarehouse();
    drawFactories();
    drawCity();
    drawCart();
    drawWagon();
  }

  // ---------- UI ----------
  function statusCart() {
    const c = state.cart;
    if (c.state === 'idle') return c.pos > 0.5 ? 'aguardando minério' : 'pronto p/ descer';
    if (c.state === 'loading') return 'carregando';
    if (c.state === 'unloading') return 'descarregando';
    return c.dir < 0 ? 'subindo' : 'descendo';
  }
  function statusWagon() {
    const w = state.wagon;
    if (w.state === 'idle') return w.pos > 0.5 ? 'aguardando contrato' : 'aguardando produto';
    if (w.state === 'loading') return 'carregando';
    if (w.state === 'unloading') return 'entregando';
    return w.dir > 0 ? 'a caminho da cidade' : 'voltando';
  }

  function renderContract() {
    const box = $('contract-box');
    if (state.contract) {
      const k = state.contract;
      const pPct = Math.round((k.delivered / k.need) * 100);
      const tLeft = Math.max(0, k.deadline - k.elapsed);
      box.className = 'contract contract-active';
      box.innerHTML = `
        <div class="contract-title">${k.city} pede <span style="color:${R[k.product].color}">${R[k.product].name}</span></div>
        <div class="contract-line"><span>Entregue</span><span>${k.delivered} / ${k.need}</span></div>
        <div class="contract-bar"><div class="contract-bar-fill" style="width:${pPct}%"></div></div>
        <div class="contract-line"><span>Tempo restante</span><span>${tLeft.toFixed(1)}s</span></div>
        <div class="contract-bar"><div class="contract-bar-fill contract-time-bar-fill" style="width:${(tLeft / k.deadline) * 100}%"></div></div>
      `;
    } else {
      box.className = 'contract';
      box.innerHTML = `<div class="contract-empty">Próximo pedido em ${Math.max(0, state.nextContractIn).toFixed(1)}s…</div>`;
    }
  }

  function renderStockLists() {
    const prods = $('products-list');
    const prodItems = [];
    for (const k in state.products) {
      if (state.products[k] > 0) prodItems.push({ k, n: state.products[k] });
    }
    prodItems.sort((a, b) => b.n - a.n);
    prods.innerHTML = prodItems.length === 0
      ? '<li><em>Nada pronto ainda.</em></li>'
      : prodItems.map(it => `<li><span class="dot" style="background:${R[it.k].color}"></span>${R[it.k].name} <small style="opacity:.6">N${R[it.k].tier}</small> <strong>${Math.floor(it.n)}</strong></li>`).join('');

    const wh = $('warehouse-list');
    const whItems = [];
    for (const k in state.warehouse) {
      if (R[k] && R[k].free) continue;
      if (state.warehouse[k] > 0) whItems.push({ k, n: state.warehouse[k] });
    }
    whItems.sort((a, b) => b.n - a.n);
    wh.innerHTML = whItems.length === 0
      ? '<li><em>Armazém vazio.</em></li>'
      : whItems.map(it => `<li><span class="dot" style="background:${R[it.k].color}"></span>${R[it.k].name} <strong>${Math.floor(it.n)}</strong></li>`).join('');
  }

  function renderDeposits() {
    const cont = $('deposits-list');
    cont.innerHTML = state.deposits.map((d, i) => {
      if (!d.resource) {
        return `
          <div class="deposit">
            <span class="dot" style="background:#1a0e06"></span>
            <div class="deposit-info">
              <span class="deposit-name">Slot ${i + 1} — vazio</span>
              <span class="deposit-meta">Clique em "Abrir" para escolher um recurso.</span>
            </div>
            <div class="deposit-actions">
              <button class="mini-btn open" data-action="open-deposit" data-slot="${i}">Abrir</button>
            </div>
          </div>
        `;
      }
      const res = R[d.resource];
      const pct = Math.round((d.pile / pileMax()) * 100);
      const cantHire = state.money < CFG.minerCost;
      return `
        <div class="deposit">
          <span class="dot" style="background:${res.color}"></span>
          <div class="deposit-info">
            <span class="deposit-name">${res.name}</span>
            <span class="deposit-meta">Mineradores: ${d.miners} · Pilha: ${Math.floor(d.pile)}/${pileMax()}</span>
            <div class="deposit-pile"><div class="deposit-pile-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="deposit-actions">
            <button class="mini-btn" data-action="hire" data-slot="${i}" ${cantHire ? 'disabled' : ''}>+ Minerador (${fmtMoney(CFG.minerCost)})</button>
            <button class="mini-btn" data-action="fire" data-slot="${i}" ${d.miners <= 0 ? 'disabled' : ''}>− Dispensar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderFactories() {
    const cont = $('factories-list');
    cont.innerHTML = state.factories.map((f, i) => {
      const recipe = RECIPE_BY_ID[f.recipeId];
      const product = R[f.recipeId];
      const pct = recipe && f.brewing > 0 ? Math.round((1 - f.brewing / recipe.time) * 100) : 0;
      const needs = recipe ? Object.keys(recipe.in).map(ing => {
        const need = recipe.in[ing];
        const haveRaw = ingredientHave(ing);
        const have = R[ing].free ? '∞' : Math.floor(haveRaw);
        const ok = haveRaw >= need;
        return `<span class="recipe-need" style="${ok ? 'color:var(--good)' : 'color:var(--bad)'}"><span class="dot" style="width:8px;height:8px;background:${R[ing].color}"></span>${R[ing].name} ${have}/${need}</span>`;
      }).join('') : '';
      return `
        <div class="factory">
          <div class="factory-header">
            <span class="factory-title">Fábrica ${i + 1}</span>
            <button class="mini-btn" data-action="change-recipe" data-fact="${i}">Trocar receita</button>
          </div>
          <div class="factory-recipe">Produz: <strong style="color:${product.color}">${product.name}</strong> <small>(N${product.tier} · ${recipe.time.toFixed(1)}s/un · ${fmtMoney(product.price)}/un)</small></div>
          <div class="factory-bar"><div class="factory-bar-fill" style="width:${pct}%"></div></div>
          <div class="recipe-needs">${needs}</div>
          <div class="factory-stock">Estoque pronto: <strong>${Math.floor(state.products[f.recipeId] || 0)}</strong></div>
        </div>
      `;
    }).join('');

    const btn = $('buy-factory-btn');
    if (state.factories.length >= CFG.factorySlotsMax) {
      btn.textContent = 'Todas as fábricas construídas';
      btn.disabled = true;
    } else {
      const cost = CFG.factoryCosts[state.factories.length];
      btn.textContent = `Comprar Fábrica ${state.factories.length + 1} — ${fmtMoney(cost)}`;
      btn.disabled = state.money < cost;
    }
  }

  function renderEquipment() {
    const cont = $('equipment-list');
    cont.innerHTML = EQUIPMENT.map(e => {
      const owned = !!state.equipment[e.id];
      const reqMissing = e.req && !state.equipment[e.req];
      const reqText = e.req ? ` <em>(requer ${EQ_BY_ID[e.req].name})</em>` : '';
      return `
        <div class="equipment-item${owned ? ' owned' : ''}">
          <div class="eq-info">
            <div class="eq-name">${e.name} ${owned ? '✓' : ''}</div>
            <div class="eq-desc">${e.desc}${reqText}</div>
          </div>
          <div>
            ${owned
              ? `<span class="eq-cost">Adquirido</span>`
              : `<button class="mini-btn" data-action="buy-eq" data-id="${e.id}" ${reqMissing || state.money < e.cost ? 'disabled' : ''}>${fmtMoney(e.cost)}</button>`
            }
          </div>
        </div>
      `;
    }).join('');
  }

  function renderResearch() {
    const cont = $('research-list');
    let html = '';
    for (const cat of RES_CATS) {
      html += `<div class="research-section">— ${cat} —</div>`;
      for (const r of RESEARCH.filter(x => x.cat === cat)) {
        const owned = !!state.research[r.id];
        const reqMissing = r.req && !state.research[r.req];
        const reqText = r.req ? ` <em>(requer ${RES_BY_ID[r.req].name})</em>` : '';
        html += `
          <div class="equipment-item${owned ? ' owned' : ''}">
            <div class="eq-info">
              <div class="eq-name">${r.name} ${owned ? '✓' : ''}</div>
              <div class="eq-desc">${r.desc}${reqText}</div>
            </div>
            <div>
              ${owned
                ? `<span class="eq-cost">Pesquisado</span>`
                : `<button class="mini-btn" data-action="buy-res" data-id="${r.id}" ${reqMissing || state.rp < r.cost ? 'disabled' : ''}><span class="rp-cost">${r.cost} PP</span></button>`
              }
            </div>
          </div>
        `;
      }
    }
    cont.innerHTML = html;
  }

  function renderLog() {
    const logEl = $('log');
    logEl.innerHTML = state.log.slice(0, 80)
      .map(l => `<li class="${l.kind}"><em>D${l.day}</em> · ${l.msg}</li>`)
      .join('');
  }

  function syncUI() {
    $('stat-money').textContent = fmtMoney(state.money);
    $('stat-day').textContent = state.day;
    $('stat-rp').textContent = state.rp + ' PP';
    const pct = Math.round(state.approval);
    $('approval-fill').style.width = pct + '%';
    $('approval-text').textContent = pct + '%';
    $('cart-status').textContent = statusCart();
    $('wagon-status').textContent = statusWagon();
    $('factory-count').textContent = state.factories.length;
    $('deposit-count').textContent = state.deposits.filter(d => d.resource).length;

    renderContract();
    renderStockLists();
    renderDeposits();
    renderFactories();
    renderEquipment();
    renderResearch();
    renderLog();
  }

  // ---------- MODAIS ----------
  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModal(id) { $(id).classList.add('hidden'); }

  function openDepositModal(slotIndex) {
    const used = new Set(state.deposits.map(d => d.resource).filter(Boolean));
    const opts = $('deposit-options');
    opts.innerHTML = DEPOSIT_TYPES.map(t => {
      const usedAlready = used.has(t.id);
      const tooExpensive = state.money < t.cost;
      const disabled = usedAlready || tooExpensive;
      return `
        <button class="grid-option" ${disabled ? 'disabled' : ''} data-action="confirm-open" data-slot="${slotIndex}" data-res="${t.id}">
          <div class="grid-option-title"><span class="dot" style="background:${R[t.id].color}"></span>${R[t.id].name}</div>
          <div class="grid-option-detail">Taxa: ${t.rate.toFixed(2)}/s · Vende a ${fmtMoney(R[t.id].price)}/un</div>
          <div class="grid-option-cost">${t.cost === 0 ? 'Grátis' : fmtMoney(t.cost)}${usedAlready ? ' — já aberto' : ''}</div>
        </button>
      `;
    }).join('');
    openModal('modal-deposit');
  }

  function openRecipeModal(factoryIndex) {
    const opts = $('recipe-options');
    let html = '';
    for (const tier of [2, 3, 4]) {
      html += `<div class="research-section" style="grid-column:1/-1">— Nível ${tier} (${tier === 2 ? 'processados' : tier === 3 ? 'componentes' : 'acabados — peças de contrato'}) —</div>`;
      for (const r of RECIPES_BY_TIER[tier]) {
        const product = R[r.id];
        const ingredients = Object.entries(r.in).map(([k, v]) => `${v}× ${R[k].name}`).join(' + ');
        html += `
          <button class="grid-option" data-action="confirm-recipe" data-fact="${factoryIndex}" data-recipe="${r.id}">
            <div class="grid-option-title"><span class="dot" style="background:${product.color}"></span>${product.name}</div>
            <div class="grid-option-detail">${ingredients}</div>
            <div class="grid-option-cost">${r.time.toFixed(1)}s · vende a ${fmtMoney(product.price)}</div>
          </button>
        `;
      }
    }
    opts.innerHTML = html;
    openModal('modal-recipe');
  }

  // ---------- LOOP ----------
  let lastT = performance.now();
  function frame(now) {
    const dtReal = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    const dt = dtReal * state.speed;
    tick(dt);
    // autosave roda em tempo real
    autosaveTimer += dtReal;
    if (autosaveTimer >= AUTOSAVE_INTERVAL) {
      autosaveTimer = 0;
      if (!state.over) saveGame();
    }
    // atualizar contador de "salvo há Xs" periodicamente
    if (Math.floor(performance.now() / 1000) !== lastStatusSecond) {
      lastStatusSecond = Math.floor(performance.now() / 1000);
      updateSaveStatus();
    }
    draw();
    syncUI();
    requestAnimationFrame(frame);
  }
  let lastStatusSecond = 0;

  // ---------- EVENTOS ----------
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.speed = parseFloat(btn.dataset.speed);
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector(`.tab-panel[data-panel="${t}"]`).classList.add('active');
    });
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    switch (a) {
      case 'hire':           tryHire(+t.dataset.slot); break;
      case 'fire':           tryFireMiner(+t.dataset.slot); break;
      case 'open-deposit':   openDepositModal(+t.dataset.slot); break;
      case 'confirm-open':   openDeposit(+t.dataset.slot, t.dataset.res); break;
      case 'change-recipe':  openRecipeModal(+t.dataset.fact); break;
      case 'confirm-recipe': setRecipe(+t.dataset.fact, t.dataset.recipe); break;
      case 'buy-eq':         buyEquipment(t.dataset.id); break;
      case 'buy-res':        buyResearch(t.dataset.id); break;
    }
  });

  $('buy-factory-btn').addEventListener('click', buyFactory);
  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => closeModal(b.dataset.close));
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
  });
  $('restart-btn').addEventListener('click', () => {
    deleteSave();
    location.reload();
  });

  // Botões de save
  $('save-btn').addEventListener('click', () => {
    if (saveGame()) {
      log('Partida salva.', 'good');
    } else {
      log('Falha ao salvar partida.', 'bad');
    }
  });
  $('newgame-btn').addEventListener('click', () => {
    if (confirm('Apagar a partida atual e começar de novo? Não dá para desfazer.')) {
      deleteSave();
      location.reload();
    }
  });

  // Salvar ao fechar a aba
  window.addEventListener('beforeunload', () => {
    if (!state.over) saveGame();
  });

  // INÍCIO
  const loaded = loadGame();
  if (loaded) {
    log(`Partida carregada (dia ${state.day}, ${state.contractsCompleted} contratos cumpridos).`, 'good');
    updateSaveStatus();
  } else {
    log('Nomeado governador de Santa Catarina. Apenas a Tapuia pode salvar o estado.');
    log('Comece extraindo Carvão + Minério de Ferro → produza Lingote de Ferro → expanda para Aço Base.');
  }
  requestAnimationFrame((t) => { lastT = t; frame(t); });
})();

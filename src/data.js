// data.js — constantes puras (dicionários, configurações)
// Não importa nada nem mantém estado mutável.

// ---------- DICIONÁRIO DE RECURSOS ----------
// kind: 'raw' (extraído) | 'prod' (produzido em fábrica)
// tier: 1..4 (nível na cadeia produtiva)
// free: recurso infinito (Água)
export const R = {
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
export const RECIPES = [
  // Nível 2 (processados)
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
  // Nível 3 (componentes)
  { id: 'nails',         in: { iron_ingot: 1 },                       time: 1.5 },
  { id: 'steel_beam',    in: { steel: 1 },                            time: 1.8 },
  { id: 'bronze_gear',   in: { brass: 1 },                            time: 2.0 },
  { id: 'copper_cable',  in: { copper_ingot: 1 },                     time: 1.8 },
  { id: 'sulfuric_acid', in: { sulfur: 1, water: 1 },                 time: 2.0 },
  { id: 'dynamite',      in: { glass: 1, sulfuric_acid: 1, gunpowder: 1 }, time: 3.2 },
  { id: 'jewel',         in: { diamond: 1, silver_ingot: 1 },         time: 4.0 },
  // Nível 4 (acabados)
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
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));
export const RECIPES_BY_TIER = { 2: [], 3: [], 4: [] };
for (const r of RECIPES) RECIPES_BY_TIER[R[r.id].tier].push(r);

// ---------- TIPOS DE DEPÓSITO ----------
export const DEPOSIT_TYPES = [
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
export const DEP_BY_ID = Object.fromEntries(DEPOSIT_TYPES.map(d => [d.id, d]));

// ---------- EQUIPAMENTOS (compra em $) ----------
export const EQUIPMENT = [
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
export const EQ_BY_ID = Object.fromEntries(EQUIPMENT.map(e => [e.id, e]));

// ---------- PESQUISA (compra em PP) ----------
export const RESEARCH = [
  // Transporte
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
export const RES_BY_ID = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
export const RES_CATS = [...new Set(RESEARCH.map(r => r.cat))];

// ---------- ERAS DE PROGRESSÃO ----------
const ERAS_RAW = [
  { id: 1, name: 'Colônia Mineradora', desc: 'Pioneiros do oeste catarinense — apenas o essencial.',
    deposits:  ['coal','iron_ore','stone','clay'],
    recipes:   ['iron_ingot','brick'],
    contracts: ['iron_ingot'],
    nextAt: 3 },
  { id: 2, name: 'Vila Industrial', desc: 'Serrarias e vidrarias surgem. O Aço Base se torna possível.',
    deposits:  ['sand','wood'],
    recipes:   ['wood_plank','glass','steel'],
    contracts: ['iron_ingot','brick','wood_plank','steel'],
    nextAt: 8 },
  { id: 3, name: 'Cidade Próspera', desc: 'Latão, pólvora e os primeiros componentes finos.',
    deposits:  ['copper_ore','zinc_ore','lead','sulfur','saltpeter'],
    recipes:   ['copper_ingot','brass','gunpowder','nails','copper_cable'],
    contracts: ['steel','wood_plank','nails','gunpowder','copper_cable','brass'],
    nextAt: 15 },
  { id: 4, name: 'Era Industrial', desc: 'Petróleo, telégrafos e ferrovias. Os primeiros acabados.',
    deposits:  ['oil'],
    recipes:   ['kerosene','steel_beam','bronze_gear','telegraph','rails','lantern','mining_tools'],
    contracts: ['telegraph','rails','lantern','mining_tools','gunpowder','nails'],
    nextAt: 25 },
  { id: 5, name: 'Era do Aço', desc: 'Motores a vapor, carruagens robustas e armamento.',
    deposits:  ['silver_ore','gold_ore'],
    recipes:   ['silver_ingot','gold_ingot','steam_engine','cargo_wagon','bullets','rifle'],
    contracts: ['steam_engine','cargo_wagon','bullets','rifle','telegraph','rails','lantern'],
    nextAt: 40 },
  { id: 6, name: 'Era do Luxo', desc: 'Joalheria, dinamite e a segurança dos cofres.',
    deposits:  ['diamond','ruby'],
    recipes:   ['sulfuric_acid','dynamite','jewel','pocket_watch','bank_safe'],
    contracts: ['pocket_watch','bank_safe','rifle','steam_engine','cargo_wagon'],
    nextAt: null },
];
// Pré-calcula listas cumulativas de depósitos/receitas
export const ERAS = ERAS_RAW.map((e, i) => {
  const upTo = ERAS_RAW.slice(0, i + 1);
  return {
    ...e,
    deposits: [...new Set(upTo.flatMap(x => x.deposits))],
    recipes:  [...new Set(upTo.flatMap(x => x.recipes))],
  };
});
export const ROMAN = ['I','II','III','IV','V','VI'];

// ---------- CONFIG ----------
export const NUM_DEPOSITS = 7;

// ---------- MINE GRID ----------
export const MINE = {
  cols: 30, rows: 13, cell: 40,
  x: 0, y: 200,
};
export const TOOLS = {
  pick:    { id:'pick',    name: 'Picareta',  costDirt: 5, costStone: 12, costOre: 6,
             desc: 'Clique em terra/pedra/veio adjacente a um túnel para cavar 1 tile.' },
  tnt:     { id:'tnt',     name: 'Dinamite',  costPerUse: 120, radius: 1,
             desc: 'Clique para explodir 3×3. Ignora adjacência. Coleta minério com 30% de perda. $120/uso.' },
  compass: { id:'compass', name: 'Bússola',   costPerUse: 40,  radius: 4,
             desc: 'Clique para revelar a neblina em raio 4 sem cavar. $40/uso.' },
  miner:   { id:'miner',   name: 'Minerador', desc: 'Clique num veio descoberto para alocar/retirar 1 minerador.' },
};
export const SILO_DEFAULT_CAP = 400;
export const WORKER_COST = 80;

// ---------- CATÁLOGO DE MINAS ----------
// id: chave única
// name/desc: para UI
// cost: $ para comprar (0 = inicial, ganha de graça)
// eraReq: era mínima pra liberar a compra
// oreBias: lista de recursos cuja densidade é aumentada nesta mina
//   (e os outros recursos pagos têm densidade reduzida pra metade)
// ---------- CONQUISTAS ----------
// Cada conquista tem: id, name, desc, emoji
// Desbloqueada uma vez (state.achievements[id] = timestamp)
export const ACHIEVEMENTS = [
  { id: 'first_contract',    emoji: '📜', name: 'Primeiro Contrato',  desc: 'Cumpra seu primeiro contrato.' },
  { id: 'contracts_10',      emoji: '📋', name: 'Burocrata',          desc: 'Complete 10 contratos.' },
  { id: 'contracts_50',      emoji: '🎖', name: 'Estadista',          desc: 'Complete 50 contratos.' },
  { id: 'first_project',     emoji: '🏗', name: 'Construtor',         desc: 'Conclua seu primeiro projeto de obra.' },
  { id: 'era_3',             emoji: '🏘', name: 'Era da Indústria',   desc: 'Alcance a Era III.' },
  { id: 'era_6',             emoji: '💎', name: 'Era do Luxo',        desc: 'Alcance a Era VI (final).' },
  { id: 'tiles_100',         emoji: '🪨', name: 'Mineiro',            desc: 'Cave 100 tiles.' },
  { id: 'tiles_500',         emoji: '⛏', name: 'Mineiro Veterano',   desc: 'Cave 500 tiles.' },
  { id: 'earnings_10k',      emoji: '💰', name: 'Próspero',           desc: 'Acumule $10.000 em ganhos totais.' },
  { id: 'earnings_50k',      emoji: '🏦', name: 'Magnata',            desc: 'Acumule $50.000 em ganhos totais.' },
  { id: 'first_mine_bought', emoji: '🗺', name: 'Expansionista',      desc: 'Compre uma mina paga.' },
  { id: 'all_mines',         emoji: '👑', name: 'Conquistador',       desc: 'Possua todas as 4 minas do mapa.' },
  { id: 'mine_exhausted',    emoji: '🚫', name: 'Esgotamento',        desc: 'Esgote uma mina por completo.' },
  { id: 'mine_regenerated',  emoji: '✨', name: 'Renascimento',       desc: 'Regenere uma mina esgotada.' },
  { id: 'tnt_10',            emoji: '💥', name: 'Demolidor',          desc: 'Use a Dinamite 10 vezes.' },
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const MINE_CATALOG = [
  {
    id: 'central',
    name: 'Mina Central',
    desc: 'Mina balanceada inicial — bom pra começar.',
    cost: 0,
    eraReq: 1,
    oreBias: null,
  },
  {
    id: 'vale',
    name: 'Mina do Vale',
    desc: 'Segunda mina balanceada inicial.',
    cost: 0,
    eraReq: 1,
    oreBias: null,
  },
  {
    id: 'mar',
    name: 'Mina do Mar',
    desc: 'Litoral catarinense — abundante em areia, enxofre, salitre e petróleo.',
    cost: 1500,
    eraReq: 3,
    oreBias: ['sand', 'sulfur', 'saltpeter', 'oil'],
  },
  {
    id: 'serra',
    name: 'Mina da Serra',
    desc: 'Serra Geral — concentra prata, ouro, rubi e diamante (mais fundos).',
    cost: 3000,
    eraReq: 4,
    oreBias: ['silver_ore', 'gold_ore', 'ruby', 'diamond'],
  },
];
export const CFG = {
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
};

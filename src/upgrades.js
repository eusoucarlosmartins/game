// upgrades.js — tela de Upgrades em árvore + ações de compra
import { state, log } from './state.js';
import { EQ_BY_ID, RES_BY_ID } from './data.js';
import { $, fmtMoney } from './util.js';
import { openModal } from './modals.js';
import { registerUpgradesRefresh } from './ui.js';

// Layout da árvore: colunas por categoria
const UPGRADE_LAYOUT = {
  equip: [
    { name: 'Picareta',  items: ['pick_iron','pick_steel','dynamite_eq'] },
    { name: 'Silos',     items: ['lantern_eq','rail_track'] },
    { name: 'Carrinho',  items: ['cart_a','cart_b'] },
    { name: 'Carruagem', items: ['wagon_a','wagon_b'] },
    { name: 'Gestão',    items: ['foreman'] },
  ],
  research: [
    { name: 'Transporte', items: ['r_wagon_big','r_car','r_truck','r_bigtruck','r_carreta','r_train','r_diesel'] },
    { name: 'Mineração',  items: ['r_drill_manual','r_drill_pneu','r_steam_dig','r_hydro'] },
    { name: 'Produção',   items: ['r_line','r_forge','r_auto'] },
    { name: 'Trilhos',    items: ['r_dual_rails','r_elevator'] },
    { name: 'Polias',     items: ['r_pulley'] },
  ],
};
const UPGRADE_ICONS = {
  pick_iron:'⛏', pick_steel:'⚒', dynamite_eq:'💥',
  lantern_eq:'🔦', rail_track:'🛤',
  cart_a:'📦', cart_b:'🛗',
  wagon_a:'🐎', wagon_b:'💨',
  foreman:'👷',
  r_wagon_big:'🛒', r_car:'🚗', r_truck:'🚚', r_bigtruck:'🛻',
  r_carreta:'🚛', r_train:'🚂', r_diesel:'🚆',
  r_drill_manual:'⛏', r_drill_pneu:'🔧', r_steam_dig:'⚙', r_hydro:'💧',
  r_line:'🔁', r_forge:'🔥', r_auto:'🤖',
  r_dual_rails:'🛤', r_elevator:'🛗',
  r_pulley:'⚙',
};

// ----- Ações de compra (também usadas pelas abas Loja/Pesquisa via main.js) -----
export function buyEquipment(id) {
  const e = EQ_BY_ID[id];
  if (!e || state.equipment[id]) return;
  if (e.req && !state.equipment[e.req]) return;
  if (state.money < e.cost) return;
  state.money -= e.cost;
  state.equipment[id] = true;
  log(`Equipamento adquirido: ${e.name}.`, 'good');
}

export function buyResearch(id) {
  const r = RES_BY_ID[id];
  if (!r || state.research[id]) return;
  if (r.req && !state.research[r.req]) return;
  if (state.rp < r.cost) return;
  state.rp -= r.cost;
  state.research[id] = true;
  log(`Pesquisa concluída: ${r.name}.`, 'good');
}

export function buyUpgrade(id, kind) {
  if (kind === 'equip') buyEquipment(id);
  else if (kind === 'research') buyResearch(id);
  renderUpgradesTree();
}

// ----- Modal -----
export function openUpgradesModal() {
  renderUpgradesTree();
  openModal('modal-upgrades');
}

export function renderUpgradesTree() {
  $('upg-money').textContent = fmtMoney(state.money);
  $('upg-rp').textContent = state.rp + ' PP';
  const renderColumn = (col, kind) => `
    <div class="upgrade-column">
      <div class="upgrade-column-head">${col.name}</div>
      ${col.items.map((id, i) => renderUpgradeTile(id, kind, i === col.items.length - 1)).join('')}
    </div>
  `;
  $('upg-equip-tree').innerHTML = UPGRADE_LAYOUT.equip.map(c => renderColumn(c, 'equip')).join('');
  $('upg-research-tree').innerHTML = UPGRADE_LAYOUT.research.map(c => renderColumn(c, 'research')).join('');
}

function renderUpgradeTile(id, kind, isLast) {
  const item = kind === 'equip' ? EQ_BY_ID[id] : RES_BY_ID[id];
  if (!item) return '';
  const owned = kind === 'equip' ? !!state.equipment[id] : !!state.research[id];
  const reqId = item.req;
  const reqMet = !reqId || (kind === 'equip' ? !!state.equipment[reqId] : !!state.research[reqId]);
  const currency = kind === 'equip' ? state.money : state.rp;
  const affordable = !owned && reqMet && currency >= item.cost;
  const locked = !owned && !reqMet;
  const classes = ['upgrade-tile'];
  if (owned) classes.push('owned');
  else if (affordable) classes.push('affordable');
  else if (locked) classes.push('locked');
  if (isLast) classes.push('last');
  const costText = kind === 'equip' ? fmtMoney(item.cost) : `${item.cost} PP`;
  const reqName = reqId ? (kind === 'equip' ? EQ_BY_ID[reqId].name : RES_BY_ID[reqId].name) : '';
  const tooltip = `${item.name} — ${item.desc || ''}${reqId ? ' (requer ' + reqName + ')' : ''}${owned ? ' [ADQUIRIDO]' : ''}`;
  const icon = UPGRADE_ICONS[id] || '★';
  return `
    <button class="${classes.join(' ')}"
            data-action="buy-upgrade"
            data-upg-id="${id}"
            data-upg-kind="${kind}"
            ${(locked || owned) ? 'disabled' : ''}
            title="${tooltip.replace(/"/g, '&quot;')}">
      <div class="upgrade-icon">${icon}</div>
      <div class="upgrade-cost">${owned ? '✓' : costText}</div>
    </button>
  `;
}

// Registra a função de refresh para que ui.syncUI chame quando o modal está aberto
registerUpgradesRefresh(renderUpgradesTree);

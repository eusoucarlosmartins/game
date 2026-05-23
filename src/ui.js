// ui.js — renderização da sidebar e modais (depósito, receita, etc.)
import { state } from './state.js';
import { R, RECIPE_BY_ID, RECIPES_BY_TIER, DEPOSIT_TYPES, EQUIPMENT, EQ_BY_ID, RESEARCH, RES_BY_ID, RES_CATS, ERAS, ROMAN, CFG } from './data.js';
import { $, fmtMoney } from './util.js';
import {
  currentEra, eraData, isDepositUnlocked, isRecipeUnlocked, pileMax,
} from './progression.js';
import { ingredientHave } from './factories.js';
import { openModal, closeModal } from './modals.js';

// ----- Status compactos -----
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

function renderEraBanner() {
  const el = $('era-banner');
  if (!el) return;
  const eraId = currentEra();
  const era = eraData(eraId);
  const next = ERAS[eraId];
  if (next) {
    const pct = Math.min(100, (state.contractsCompleted / era.nextAt) * 100);
    el.innerHTML = `Era ${ROMAN[eraId - 1]} — ${era.name}
      <small>${era.desc}</small>
      <small>Próxima era: ${state.contractsCompleted}/${era.nextAt} contratos</small>
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>`;
  } else {
    el.innerHTML = `Era ${ROMAN[eraId - 1]} — ${era.name}
      <small>${era.desc}</small>
      <small>Era final atingida.</small>`;
  }
}

// função adicional injetada pelo upgrades.js para refresh quando modal aberto
let upgradesRefreshFn = null;
export function registerUpgradesRefresh(fn) { upgradesRefreshFn = fn; }

export function syncUI() {
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

  renderEraBanner();
  renderContract();
  renderStockLists();
  renderDeposits();
  renderFactories();
  renderEquipment();
  renderResearch();
  renderLog();

  const upgModal = $('modal-upgrades');
  if (upgModal && !upgModal.classList.contains('hidden') && upgradesRefreshFn) {
    upgradesRefreshFn();
  }
}

// ----- Modais (re-exporta de modals.js) -----
export { openModal, closeModal };

export function openDepositModal(slotIndex) {
  const used = new Set(state.deposits.map(d => d.resource).filter(Boolean));
  const opts = $('deposit-options');
  opts.innerHTML = DEPOSIT_TYPES.map(t => {
    const usedAlready = used.has(t.id);
    const tooExpensive = state.money < t.cost;
    const locked = !isDepositUnlocked(t.id);
    const disabled = usedAlready || tooExpensive || locked;
    let unlockEra = ERAS.find(e => e.deposits.includes(t.id));
    const lockMsg = locked && unlockEra ? ` — Era ${ROMAN[unlockEra.id - 1]} necessária` : '';
    return `
      <button class="grid-option" ${disabled ? 'disabled' : ''} data-action="confirm-open" data-slot="${slotIndex}" data-res="${t.id}" title="${locked ? 'Bloqueado nesta era' : ''}">
        <div class="grid-option-title"><span class="dot" style="background:${R[t.id].color}"></span>${R[t.id].name}${locked ? ' 🔒' : ''}</div>
        <div class="grid-option-detail">Taxa: ${t.rate.toFixed(2)}/s · Vende a ${fmtMoney(R[t.id].price)}/un</div>
        <div class="grid-option-cost">${t.cost === 0 ? 'Grátis' : fmtMoney(t.cost)}${usedAlready ? ' — já aberto' : ''}${lockMsg}</div>
      </button>
    `;
  }).join('');
  openModal('modal-deposit');
}

export function openRecipeModal(factoryIndex) {
  const opts = $('recipe-options');
  let html = '';
  for (const tier of [2, 3, 4]) {
    html += `<div class="research-section" style="grid-column:1/-1">— Nível ${tier} (${tier === 2 ? 'processados' : tier === 3 ? 'componentes' : 'acabados — peças de contrato'}) —</div>`;
    for (const r of RECIPES_BY_TIER[tier]) {
      const product = R[r.id];
      const locked = !isRecipeUnlocked(r.id);
      const ingredients = Object.entries(r.in).map(([k, v]) => `${v}× ${R[k].name}`).join(' + ');
      let unlockEra = ERAS.find(e => e.recipes.includes(r.id));
      const lockMsg = locked && unlockEra ? `Era ${ROMAN[unlockEra.id - 1]} necessária` : '';
      html += `
        <button class="grid-option" data-action="confirm-recipe" data-fact="${factoryIndex}" data-recipe="${r.id}" ${locked ? 'disabled' : ''}>
          <div class="grid-option-title"><span class="dot" style="background:${product.color}"></span>${product.name}${locked ? ' 🔒' : ''}</div>
          <div class="grid-option-detail">${ingredients}</div>
          <div class="grid-option-cost">${r.time.toFixed(1)}s · vende a ${fmtMoney(product.price)}${lockMsg ? ' — ' + lockMsg : ''}</div>
        </button>
      `;
    }
  }
  opts.innerHTML = html;
  openModal('modal-recipe');
}

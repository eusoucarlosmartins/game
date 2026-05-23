// ui.js — renderização da sidebar e modais (receita)
import { state } from './state.js';
import { R, RECIPE_BY_ID, RECIPES_BY_TIER, EQUIPMENT, EQ_BY_ID, RESEARCH, RES_BY_ID, RES_CATS, ERAS, ROMAN, CFG, TOOLS, WORKER_COST, MINE_CATALOG } from './data.js';
import { isMineOwned } from './mine.js';
import { $, fmtMoney } from './util.js';
import { currentEra, eraData, isRecipeUnlocked } from './progression.js';
import { ingredientHave } from './factories.js';
import { workersActive, getRevealedOreCounts, isResourceUnlocked } from './mine.js';
import { openModal, closeModal } from './modals.js';
import { MARKET_RAW_MULT, MARKET_PROD_MULT } from './market.js';
import { PROJECT_DEFS, availableProjects, canActivateProject, getProjectDef } from './projects.js';
import { statusWagons } from './wagon.js';

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

function renderMinePanel() {
  const total = state.workersTotal;
  const active = workersActive();
  const avail = total - active;
  const tWorkers = $('workers-total');     if (tWorkers) tWorkers.textContent = total;
  const tAvail   = $('workers-available'); if (tAvail)   tAvail.textContent   = avail;
  const tAct     = $('workers-active');    if (tAct)     tAct.textContent     = active;

  const hireBtn = $('hire-worker-btn');
  if (hireBtn) hireBtn.disabled = state.money < WORKER_COST;

  const tool = TOOLS[state.tool] || TOOLS.pick;
  const info = $('tool-info');
  if (info) info.innerHTML = `<strong>${tool.name}</strong> — ${tool.desc}`;

  // Sincroniza estado visual dos botões de ferramenta (HTML)
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    const el = /** @type {HTMLElement} */ (btn);
    if (el.dataset.tool === state.tool) el.classList.add('active');
    else el.classList.remove('active');
  });

  // Veios descobertos no mapa (revelados, ainda não cavados)
  const oreMap = $('ore-map-list');
  if (oreMap) {
    const counts = getRevealedOreCounts();
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    oreMap.innerHTML = keys.length === 0
      ? '<li><em>Nenhum veio descoberto ainda. Cave para revelar mais terreno.</em></li>'
      : keys.map(k => {
          const locked = !isResourceUnlocked(k);
          return `<li>
            <span class="dot" style="background:${R[k].color}"></span>
            <span style="flex:1">${R[k].name}${locked ? ' 🔒' : ''}</span>
            <strong>${counts[k]}</strong>
          </li>`;
        }).join('');
  }

  // Silos por recurso (apenas com estoque > 0 ou desbloqueados pela era atual)
  const era = eraData(currentEra());
  const items = [];
  for (const k in state.warehouse) {
    if (R[k] && R[k].free) continue;
    const inEra = era.deposits.includes(k);
    const stock = state.warehouse[k] || 0;
    if (inEra || stock > 0) items.push({ k, n: stock, cap: (state.silos[k] && state.silos[k].cap) || 400 });
  }
  items.sort((a, b) => b.n - a.n);
  const list = $('silos-list');
  if (list) {
    list.innerHTML = items.length === 0
      ? '<li><em>Nenhum silo em uso ainda.</em></li>'
      : items.map(it => {
          const pct = Math.min(100, Math.round((it.n / it.cap) * 100));
          const full = pct >= 99;
          return `<li>
            <span class="dot" style="background:${R[it.k].color}"></span>
            <span style="flex:1">${R[it.k].name}</span>
            <span style="font-size:11px;${full ? 'color:var(--bad)' : ''}">${Math.floor(it.n)}/${it.cap}${full ? ' CHEIO' : ''}</span>
          </li>`;
        }).join('');
  }
}

function renderProjects() {
  // Painel "Projeto Ativo"
  const activeEl = $('project-active');
  if (activeEl) {
    if (!state.projects.active) {
      activeEl.className = 'project-active empty';
      activeEl.textContent = 'Nenhum projeto em andamento. Inicie um abaixo.';
    } else {
      const def = getProjectDef(state.projects.active.id);
      const prog = state.projects.active.progress;
      let totalNeed = 0, totalHave = 0;
      const rows = Object.entries(def.requirements).map(([res, need]) => {
        const have = prog[res] || 0;
        totalNeed += need;
        totalHave += Math.min(have, need);
        const done = have >= need;
        return `<div class="resource ${done ? 'done' : 'pending'}">
          <span class="dot" style="background:${R[res].color}"></span>${R[res].name}
        </div>
        <div class="amount ${done ? 'done' : 'pending'}">${Math.floor(have)}/${need}</div>`;
      }).join('');
      const pct = Math.round((totalHave / Math.max(1, totalNeed)) * 100);
      activeEl.className = 'project-active';
      activeEl.innerHTML = `
        <div class="project-card active">
          <div class="project-name">${def.name}</div>
          <div class="project-desc">${def.desc}</div>
          <div class="project-req">${rows}</div>
          <div class="project-bar"><div class="project-bar-fill" style="width:${pct}%"></div></div>
          <div class="project-reward">Recompensa: ${fmtMoney(def.reward.money)} · +${def.reward.approval} aprov · +${def.reward.rp} PP</div>
          <div class="project-actions">
            <button class="mini-btn" data-action="project-cancel">Cancelar (devolve 50%)</button>
          </div>
        </div>
      `;
    }
  }

  // Lista de projetos disponíveis
  const listEl = $('project-list');
  if (listEl) {
    const items = availableProjects().filter(p => !state.projects.active || state.projects.active.id !== p.id);
    if (items.length === 0) {
      listEl.innerHTML = '<p class="hint"><em>Nenhum projeto disponível na era atual.</em></p>';
    } else {
      listEl.innerHTML = items.map(p => {
        const canStart = canActivateProject(p.id);
        const reqLines = Object.entries(p.requirements).map(([res, need]) => {
          const have = R[res] && R[res].kind === 'raw' ? (state.warehouse[res] || 0) : (state.products[res] || 0);
          const enough = have >= need;
          return `<div class="resource ${enough ? 'done' : 'pending'}">
            <span class="dot" style="background:${R[res].color}"></span>${R[res].name}
          </div>
          <div class="amount ${enough ? 'done' : 'pending'}">${Math.floor(have)}/${need}</div>`;
        }).join('');
        const effectTxt = p.effect ? ` · efeito permanente` : '';
        return `<div class="project-card">
          <div class="project-name">${p.name}<span class="project-era-tag">ERA ${ROMAN[p.eraReq - 1]}</span></div>
          <div class="project-desc">${p.desc}</div>
          <div class="project-req">${reqLines}</div>
          <div class="project-reward">Recompensa: ${fmtMoney(p.reward.money)} · +${p.reward.approval} aprov · +${p.reward.rp} PP${effectTxt}</div>
          <div class="project-actions">
            <button class="mini-btn" data-action="project-start" data-id="${p.id}" ${canStart ? '' : 'disabled'}>${state.projects.active ? 'Outro ativo' : 'Iniciar'}</button>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Concluídos
  const doneEl = $('project-completed');
  if (doneEl) {
    if (!state.projects.completed.length) {
      doneEl.innerHTML = '<li><em>Nenhum projeto concluído ainda.</em></li>';
    } else {
      doneEl.innerHTML = state.projects.completed.map(id => {
        const def = PROJECT_DEFS.find(p => p.id === id);
        return def ? `<li>✓ ${def.name}</li>` : '';
      }).join('');
    }
  }
}

function renderMarket() {
  const cont = $('market-list');
  if (!cont) return;
  // Matérias-primas
  const raws = [];
  for (const k in state.warehouse) {
    if (R[k] && R[k].free) continue;
    if ((state.warehouse[k] || 0) > 0) raws.push(k);
  }
  raws.sort((a, b) => state.warehouse[b] - state.warehouse[a]);
  let html = '<div class="market-section"><h4>Matérias-primas (60% do preço)</h4>';
  if (raws.length === 0) {
    html += '<div class="market-empty">Nenhuma matéria-prima em estoque.</div>';
  } else {
    html += raws.map(k => {
      const n = Math.floor(state.warehouse[k]);
      const price = Math.max(1, Math.round(R[k].price * MARKET_RAW_MULT));
      return `<div class="market-item">
        <span class="dot" style="background:${R[k].color}"></span>
        <span class="market-name">${R[k].name}</span>
        <span class="market-stock">${n}</span>
        <span class="market-price">${fmtMoney(price)}/un</span>
        <button class="mini-btn" data-action="sell-raw" data-id="${k}" data-amt="1" ${n < 1 ? 'disabled' : ''}>Vender 1</button>
        <button class="mini-btn" data-action="sell-raw" data-id="${k}" data-amt="all" ${n < 1 ? 'disabled' : ''}>Tudo</button>
      </div>`;
    }).join('');
  }
  html += '</div>';
  // Produtos
  const prods = [];
  for (const k in state.products) {
    if ((state.products[k] || 0) > 0) prods.push(k);
  }
  prods.sort((a, b) => state.products[b] - state.products[a]);
  html += '<div class="market-section"><h4>Produtos (70% do preço)</h4>';
  if (prods.length === 0) {
    html += '<div class="market-empty">Nenhum produto em estoque.</div>';
  } else {
    html += prods.map(k => {
      const n = Math.floor(state.products[k]);
      const price = Math.max(1, Math.round(R[k].price * MARKET_PROD_MULT));
      return `<div class="market-item">
        <span class="dot" style="background:${R[k].color}"></span>
        <span class="market-name">${R[k].name}</span>
        <span class="market-stock">${n}</span>
        <span class="market-price">${fmtMoney(price)}/un</span>
        <button class="mini-btn" data-action="sell-prod" data-id="${k}" data-amt="1" ${n < 1 ? 'disabled' : ''}>Vender 1</button>
        <button class="mini-btn" data-action="sell-prod" data-id="${k}" data-amt="all" ${n < 1 ? 'disabled' : ''}>Tudo</button>
      </div>`;
    }).join('');
  }
  html += '</div>';
  cont.innerHTML = html;
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

function renderStats() {
  const summary = $('stats-summary');
  if (summary) {
    const totalTilesDug = state.tilesDug || 0;
    const totalEarn = state.totalEarnings || 0;
    const completedProj = (state.projects && state.projects.completed) ? state.projects.completed.length : 0;
    const minesOwned = (state.mines || []).length;
    const minesExhausted = (state.mines || []).filter((m) => m.exhausted).length;
    const rows = [
      ['💰 Dinheiro ganho total', fmtMoney(totalEarn), 'good'],
      ['📜 Contratos cumpridos', state.contractsCompleted, 'good'],
      ['🏗 Projetos concluídos', completedProj, 'good'],
      ['⛏ Tiles cavados', totalTilesDug.toLocaleString('pt-BR'), ''],
      ['👤 Mineradores contratados', state.workersTotal, ''],
      ['🏭 Fábricas operando', state.factories.length + '/' + CFG.factorySlotsMax, ''],
      ['📅 Dia atual', state.day, ''],
      ['⭐ Aprovação', Math.round(state.approval) + '%', state.approval >= 50 ? 'good' : 'bad'],
      ['🎓 Era atual', `${ROMAN[currentEra() - 1]} — ${eraData(currentEra()).name}`, ''],
      ['⛰ Minas (ativas / esgotadas)', `${minesOwned - minesExhausted} / ${minesExhausted}`, ''],
    ];
    summary.innerHTML = rows.map(([label, value, cls]) =>
      `<li><span class="label">${label}</span><span class="value ${cls}">${value}</span></li>`
    ).join('');
  }
  const oresEl = $('stats-ores');
  if (oresEl) {
    const ores = state.oreMined || {};
    const items = Object.keys(ores)
      .filter((k) => ores[k] > 0)
      .sort((a, b) => ores[b] - ores[a]);
    if (items.length === 0) {
      oresEl.innerHTML = '<li><em>Nenhum minério extraído ainda.</em></li>';
    } else {
      oresEl.innerHTML = items.map((k) =>
        `<li><span class="dot" style="background:${R[k].color}"></span>${R[k].name} <strong>${Math.floor(ores[k]).toLocaleString('pt-BR')}</strong></li>`
      ).join('');
    }
  }
  const minesEl = $('stats-mines');
  if (minesEl) {
    const rows = (state.mines || []).map((m, i) => {
      const status = m.exhausted ? '<span class="value bad">🚫 esgotada</span>' :
                     (i === state.activeMineIdx ? '<span class="value good">● ativa</span>' :
                     '<span class="value">operando</span>');
      return `<li><span class="label">${m.name}</span>${status}</li>`;
    });
    minesEl.innerHTML = rows.length === 0 ? '<li><em>Nenhuma mina.</em></li>' : rows.join('');
  }
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

// Hook do modal de upgrades (registrado por upgrades.js)
let upgradesRefreshFn = null;
let lastUpgRender = 0;
let lastButtonsRender = 0;
export function registerUpgradesRefresh(fn) { upgradesRefreshFn = fn; }

export function syncUI() {
  $('stat-money').textContent = fmtMoney(state.money);
  $('stat-day').textContent = state.day;
  $('stat-rp').textContent = state.rp + ' PP';
  const pct = Math.round(state.approval);
  $('approval-fill').style.width = pct + '%';
  $('approval-text').textContent = pct + '%';
  const wagonEl = $('wagon-status');     if (wagonEl)  wagonEl.textContent  = statusWagons();
  const factEl  = $('factory-count');    if (factEl)   factEl.textContent   = state.factories.length;
  const wkEl    = $('footer-workers');   if (wkEl)     wkEl.textContent     = `${workersActive()}/${state.workersTotal}`;
  const tilesEl = $('footer-tiles');     if (tilesEl)  tilesEl.textContent  = state.tilesDug;

  renderEraBanner();
  renderContract();
  renderStockLists();
  renderMinePanel();
  // Painéis com botões interativos: throttle a 500ms pra não recriar
  // os botões a cada frame (cancelaria mousedown→mouseup do click).
  const nowT = performance.now();
  if (nowT - lastButtonsRender > 500) {
    renderFactories();
    renderMarket();
    renderProjects();
    renderEquipment();
    renderResearch();
    lastButtonsRender = nowT;
  }
  renderStats();
  renderLog();

  const upgModal = $('modal-upgrades');
  if (upgModal && !upgModal.classList.contains('hidden') && upgradesRefreshFn) {
    // Throttle: refresh full do modal a cada 600ms para não recriar
    // os botões durante mousedown/mouseup (que cancelava o click).
    const now = performance.now();
    if (now - lastUpgRender > 600) {
      upgradesRefreshFn();
      lastUpgRender = now;
    }
  }
}

export { openModal, closeModal };

export function openBuyMineModal() {
  const opts = $('buy-mine-options');
  if (!opts) return;
  const era = currentEra();
  let html = '';
  for (const cat of MINE_CATALOG) {
    const owned = isMineOwned(cat.id);
    const eraOk = era >= cat.eraReq;
    const broke = state.money < cat.cost;
    const disabled = owned || !eraOk || broke;
    let status = '';
    if (owned) status = ' — já aberta';
    else if (!eraOk) status = ` — Era ${ROMAN[cat.eraReq - 1]} necessária`;
    else if (broke) status = ' — sem dinheiro';
    const biasTxt = cat.oreBias
      ? `Viés: ${cat.oreBias.map((id) => R[id].name).join(', ')}`
      : 'Distribuição balanceada';
    html += `
      <button class="grid-option" data-action="confirm-buy-mine" data-id="${cat.id}" ${disabled ? 'disabled' : ''}>
        <div class="grid-option-title">⛏ ${cat.name}${owned ? ' ✓' : ''}</div>
        <div class="grid-option-detail">${cat.desc}<br><em>${biasTxt}</em></div>
        <div class="grid-option-cost">${cat.cost === 0 ? 'Inicial (grátis)' : fmtMoney(cat.cost)}${status}</div>
      </button>
    `;
  }
  opts.innerHTML = html;
  openModal('modal-buy-mine');
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
      const unlockEra = ERAS.find(e => e.recipes.includes(r.id));
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

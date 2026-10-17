// ui.js — renderização da sidebar e modais (receita)
import { state } from './state.js';
import { R, RECIPE_BY_ID, RECIPES_BY_TIER, EQUIPMENT, EQ_BY_ID, RESEARCH, RES_BY_ID, RES_CATS, ERAS, ROMAN, CFG, TOOLS, WORKER_COST, MINE_CATALOG, ACHIEVEMENTS, CIVILIZATIONS, CIV_BY_ID } from './data.js';
import { isMineOwned } from './mine.js';
import { getAchievementProgress } from './achievements.js';
import { $, fmtMoney } from './util.js';
import { currentEra, eraData, isRecipeUnlocked } from './progression.js';
import { ingredientHave } from './factories.js';
import { workersActive, getRevealedOreCounts, isResourceUnlocked } from './mine.js';
import { openModal, closeModal } from './modals.js';
import { STAFF, staffLevel, staffActive, nextLevel, canHire, totalSalary, staffAttention } from './staff.js';
import { SITE_BY_ID, siteState, siteUnlocked } from './sites.js';
import { freeWorkers } from './advisor.js';
import { ROUTES, carts, routeUnlocked, canBuyCart, CART_COST } from './trade.js';
import { victoryProgress, POLITICAL } from './victory.js';
import { army, UNITS, BARRACKS, canTrain, costText, armyPower, rivals, garrisonPower, canConquer, tributePerDay, upkeepPerDay, nextThreat, RESERVE_CHOICES, reserveUnits, militaryReserve } from './military.js';
import { MARKET_RAW_MULT, MARKET_PROD_MULT } from './market.js';
import { PROJECT_DEFS, availableProjects, canActivateProject, getProjectDef } from './projects.js';

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

let lastArmySig = '';
function renderArmy() {
  const body = $('army-body');
  const borders = $('army-borders');
  if (!body || !borders) return;
  const a = army();
  const era = currentEra();
  const th = nextThreat();
  const sum = $('army-summary');
  if (sum) sum.textContent = `· força ${armyPower()} · ${a.wins}V/${a.losses}D`;
  const sig = JSON.stringify([reserveUnits(), [...militaryReserve()].map(([k, q]) => [k, q, Math.floor(state.products[k] || 0)]), a.barracks, a.units, a.territories, !!a.expedition, era, state.money >= BARRACKS.cost,
    UNITS.map((u) => canTrain(u.id)), th ? [th.rival, th.power] : 0, armyPower()]);
  if (sig === lastArmySig) return;
  lastArmySig = sig;
  if (!a.barracks) {
    body.innerHTML = era < BARRACKS.era
      ? `<p>🔒 O Quartel é liberado na Era ${ROMAN[BARRACKS.era - 1]}.</p>`
      : `<button class="big-btn" data-action="build-barracks" ${state.money < BARRACKS.cost ? 'disabled' : ''}>⚔️ Construir Quartel — ${fmtMoney(BARRACKS.cost)}</button>`;
  } else {
    const rows = UNITS.map((u) => {
      const st = canTrain(u.id);
      const n = a.units[u.id] || 0;
      const btn = st === 'era'
        ? `<button class="mini-btn" disabled>🔒 Era ${ROMAN[u.era - 1]}</button>`
        : `<button class="mini-btn" data-action="train-unit" data-id="${u.id}" ${st !== 'ok' ? 'disabled' : ''}>Treinar · ${costText(u.cost)}</button>`;
      return `<div class="staff-card${n ? ' hired' : ''}"><div class="staff-face">${u.emoji}</div><div class="staff-info">
        <div class="staff-name">${u.name} <span class="staff-stars">× ${n}</span></div>
        <div class="staff-role">força ${u.power} cada · manutenção ${fmtMoney(u.upkeep)}/dia</div>
        <div class="staff-btn">${btn}</div></div></div>`;
    }).join('');
    const exp = a.expedition ? `<p>🏃 Expedição a caminho (${Math.ceil(a.expedition.eta)}s).</p>` : '';
    const res = [...militaryReserve()];
    const reserve = `<div class="army-reserve"><b>Reserva para o exército:</b> guardar material para
      ${RESERVE_CHOICES.map((n) => `<button class="mini-btn${reserveUnits() === n ? ' active' : ''}" data-action="army-reserve" data-n="${n}">${n}</button>`).join(' ')} unidades
      <div class="hint">${res.length ? res.map(([k, q]) => `${R[k].name}: ${Math.floor(state.products[k] || 0)}/${q}`).join(' · ') : 'nada guardado'} — o gerente e as caravanas não vendem isso; o Gerente de Fábrica completa a reserva.</div></div>`;
    body.innerHTML = `<p>Força em casa: <b>${armyPower()}</b>${th ? ` · próximo ataque: <b>${th.power}</b>` : ''} · manutenção ${fmtMoney(upkeepPerDay())}/dia · tributos ${fmtMoney(tributePerDay())}/dia</p>${exp}${reserve}<div class="staff-list">${rows}</div>`;
  }
  borders.innerHTML = rivals().map((r) => {
    const won = a.territories[r.id];
    const g = garrisonPower(r.id);
    const btn = won ? '<span class="eq-cost">🏴 Conquistado</span>'
      : `<button class="mini-btn" data-action="send-expedition" data-id="${r.id}" ${canConquer(r.id) ? '' : 'disabled'}>Conquistar (guarnição ${g})</button>`;
    return `<div class="staff-card${won ? ' hired' : ''}"><div class="staff-face">${r.emoji}</div><div class="staff-info">
      <div class="staff-name">Território ${r.name}</div>
      <div class="staff-role">${won ? `paga ${fmtMoney(120)}/dia de tributo` : 'rival — ataca pela fronteira'}</div>
      <div class="staff-btn">${btn}</div></div></div>`;
  }).join('');
}

let lastTradeSig = '';
function renderTrade() {
  const cont = $('trade-routes');
  if (!cont) return;
  const list = carts();
  const sig = ROUTES.map((r) => `${r.id}${routeUnlocked(r.id)}${list.filter((c) => c.route === r.id).length}`).join('|') + (state.money >= CART_COST) + canBuyCart();
  const earned = $('trade-earned');
  if (earned) earned.textContent = state.trade && state.trade.earned ? `· ${fmtMoney(state.trade.earned)} vendidos` : '';
  if (sig === lastTradeSig) return;
  lastTradeSig = sig;
  cont.innerHTML = ROUTES.map((r) => {
    const n = list.filter((c) => c.route === r.id).length;
    const unlocked = routeUnlocked(r.id);
    const btn = !unlocked
      ? `<button class="mini-btn" disabled>🔒 Era ${ROMAN[r.era - 1]}</button>`
      : `<button class="mini-btn" data-action="buy-cart" data-id="${r.id}" ${!canBuyCart() || state.money < CART_COST ? 'disabled' : ''}>+ Carroça · ${fmtMoney(CART_COST)}</button>`;
    return `
      <div class="staff-card${n ? ' hired' : ''}">
        <div class="staff-face">🐎</div>
        <div class="staff-info">
          <div class="staff-name">${r.name}</div>
          <div class="staff-role">paga ${Math.round(r.mult * 100)}% do preço · ${n} carroça(s)</div>
          <div class="staff-btn">${btn}</div>
        </div>
      </div>`;
  }).join('');
}

let lastStaffSig = '';
function renderStaff() {
  const cont = $('staff-list');
  if (!cont) return;
  const era = currentEra();
  const sig = STAFF.map((d) => `${d.id}${staffLevel(d.id)}${canHire(d.id)}${staffActive(d.id)}`).join('|') + era;
  const pay = $('staff-payroll');
  if (pay) pay.textContent = totalSalary() > 0 ? `· folha ${fmtMoney(totalSalary())}/dia` : '';
  const tab = document.querySelector('.tab[data-tab="staff"]');
  if (tab) tab.classList.toggle('attention', staffAttention());
  const navBtn = document.querySelector('#bottom-nav [data-sheet="staff"]');
  if (navBtn) navBtn.classList.toggle('attention', staffAttention());
  if (sig === lastStaffSig) return;
  lastStaffSig = sig;
  cont.innerHTML = STAFF.map((d) => {
    const lv = staffLevel(d.id);
    const cur = lv > 0 ? d.levels[lv - 1] : null;
    const nl = nextLevel(d.id);
    const status = canHire(d.id);
    const stars = d.levels.map((_, i) => (i < lv ? '★' : '☆')).join('');
    const unpaid = lv > 0 && !staffActive(d.id);
    let btn = '';
    if (nl) {
      const label = lv === 0 ? 'Contratar' : `Promover p/ nível ${lv + 1}`;
      btn = status === 'era'
        ? `<button class="mini-btn" disabled>🔒 Era ${ROMAN[nl.era - 1]}</button>`
        : `<button class="mini-btn" data-action="hire-staff" data-id="${d.id}" ${status !== 'ok' ? 'disabled' : ''}>${label} · ${fmtMoney(nl.cost)}</button>`;
    } else {
      btn = '<span class="eq-cost">Nível máximo</span>';
    }
    return `
      <div class="staff-card${lv > 0 ? ' hired' : ''}${unpaid ? ' unpaid' : ''}">
        <div class="staff-face">${d.emoji}</div>
        <div class="staff-info">
          <div class="staff-name">${d.name} <span class="staff-stars" title="Nível ${lv}/${d.levels.length}">${stars}</span></div>
          <div class="staff-role">${d.role}${cur ? ` · salário ${fmtMoney(cur.salary)}/dia` : ''}${unpaid ? ' · <b>sem salário, parado</b>' : ''}</div>
          ${cur ? `<div class="staff-now">Agora: ${cur.desc}</div>` : ''}
          ${nl ? `<div class="staff-next">${lv === 0 ? 'Ao contratar' : 'Próximo nível'}: ${nl.desc} <em>(+${fmtMoney(nl.salary)}/dia)</em></div>` : ''}
          <div class="staff-btn">${btn}</div>
        </div>
      </div>`;
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
      ...(() => {
        const v = victoryProgress();
        const pol = v.political;
        return [
          ['🌉 Vitória: Maravilha', v.wonder ? 'de pé!' : (state.projects && state.projects.active && state.projects.active.id === 'maravilha' ? 'em obra' : 'Era VI · Projetos'), v.wonder ? 'good' : ''],
          ['⚔️ Vitória: Conquista', `${v.conquest.have}/${v.conquest.need} territórios`, v.conquest.have ? 'good' : ''],
          ['⭐ Vitória: Política', `Era ${ROMAN[pol.era - 1]}/${ROMAN[POLITICAL.era - 1]} · ${pol.contracts}/${POLITICAL.contracts} contratos · dia ${pol.day}/${POLITICAL.day} · ${pol.approval}/${POLITICAL.approval}%`, ''],
        ];
      })(),
      ['🏺 Relíquias', `${state.relics || 0} (+${fmtMoney((state.relics || 0) * 30)}/dia)`, (state.relics || 0) > 0 ? 'good' : ''],
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
  // Conquistas
  const achEl = $('achievements-list');
  const achProg = $('achievements-progress');
  if (achProg) {
    const { unlocked, total } = getAchievementProgress();
    achProg.textContent = `(${unlocked}/${total})`;
  }
  if (achEl) {
    const unlockedMap = state.achievements || {};
    achEl.innerHTML = ACHIEVEMENTS.map((a) => {
      const owned = !!unlockedMap[a.id];
      return `<li class="${owned ? 'unlocked' : 'locked'}">
        <span class="emoji">${a.emoji}</span>
        <span>
          <span class="name">${a.name}</span>
          <span class="desc">${a.desc}</span>
        </span>
      </li>`;
    }).join('');
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
export function registerUpgradesRefresh(fn) { upgradesRefreshFn = fn; }

export function syncUI() {
  $('stat-money').textContent = fmtMoney(state.money);
  $('stat-day').textContent = state.day;
  $('stat-rp').textContent = state.rp + ' PP';
  const pct = Math.round(state.approval);
  $('approval-fill').style.width = pct + '%';
  $('approval-text').textContent = pct + '%';
  // Badge da civilização
  const civWrap = $('civ-badge-wrap');
  const civBadge = $('civ-badge');
  if (civWrap && civBadge) {
    const civ = state.civilization ? CIV_BY_ID[state.civilization] : null;
    if (civ) {
      civWrap.style.display = '';
      civBadge.textContent = `${civ.emoji} ${civ.name}`;
      civBadge.style.borderLeft = `4px solid ${civ.color}`;
      civBadge.style.paddingLeft = '6px';
      civBadge.title = civ.desc;
    } else {
      civWrap.style.display = 'none';
    }
  }
  const wagonEl = $('wagon-status');     if (wagonEl)  wagonEl.textContent  = statusWagon();
  const factEl  = $('factory-count');    if (factEl)   factEl.textContent   = state.factories.length;
  const wkEl    = $('footer-workers');   if (wkEl)     wkEl.textContent     = `${workersActive()}/${state.workersTotal}`;
  const tilesEl = $('footer-tiles');     if (tilesEl)  tilesEl.textContent  = state.tilesDug;

  renderEraBanner();
  renderContract();
  renderStockLists();
  renderMinePanel();
  renderFactories();
  renderMarket();
  renderProjects();
  renderStats();
  renderEquipment();
  renderStaff();
  renderTrade();
  renderArmy();
  if (openSiteId) renderSiteModal();
  renderResearch();
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

export function openCivilizationModal() {
  const opts = $('civ-options');
  if (!opts) return;
  opts.innerHTML = CIVILIZATIONS.map((c) => {
    const bonuses = c.bonuses.map((b) => {
      const positive = (typeof b.mod === 'number' && b.mod > 0) || b.effect === 'approval_start_bonus' || b.effect === 'silo_cap_bonus';
      const neg = (typeof b.mod === 'number' && b.mod < 0);
      const cls = positive ? 'good' : neg ? 'bad' : '';
      return `<div class="civ-bonus ${cls}">${b.text}</div>`;
    }).join('');
    return `
      <button class="grid-option civ-card" data-action="confirm-civ" data-id="${c.id}">
        <div class="civ-emoji">${c.emoji}</div>
        <div class="grid-option-title">${c.name}</div>
        <div class="grid-option-detail">${c.desc}</div>
        <div class="civ-bonuses">${bonuses}</div>
      </button>
    `;
  }).join('');
  openModal('modal-civilization');
}

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

let openSiteId = '';
let lastSiteSig = '';
/** @param {string} id */
export function openSiteModal(id) {
  openSiteId = id;
  lastSiteSig = '';
  renderSiteModal();
  openModal('modal-site');
}

function renderSiteModal() {
  const modal = $('modal-site');
  if (!modal || modal.classList.contains('hidden') && lastSiteSig) return;
  const def = SITE_BY_ID[openSiteId];
  if (!def) return;
  const st = siteState(def.id);
  const res = R[def.resource];
  const stock = Math.floor(state.warehouse[def.resource] || 0);
  const free = freeWorkers();
  const sig = `${def.id}${st.built}${st.workers}${free}${stock}${state.money >= def.cost}${siteUnlocked(def.id)}`;
  if (sig === lastSiteSig) return;
  lastSiteSig = sig;
  $('site-title').textContent = `${def.emoji} ${def.name}`;
  $('site-desc').textContent = def.desc;
  const perMin = Math.round(def.rate * 60);
  let body;
  if (!st.built) {
    body = siteUnlocked(def.id)
      ? `<p>Produz <b>${res.name}</b> (≈${perMin}/min por trabalhador, até ${def.maxWorkers} trabalhadores).</p>
         <button class="big-btn" data-action="site-build" data-id="${def.id}" ${state.money < def.cost ? 'disabled' : ''}>Construir — ${fmtMoney(def.cost)}</button>`
      : `<p>🔒 Liberado na Era ${ROMAN[def.era - 1]}.</p>`;
  } else {
    body = `
      <p>Produz <b>${res.name}</b>: ≈${perMin * st.workers}/min agora · estoque ${stock}.</p>
      <div class="site-workers">
        <button class="big-btn" data-action="site-worker" data-id="${def.id}" data-delta="-1" ${st.workers <= 0 ? 'disabled' : ''}>−</button>
        <div class="site-count"><b>${st.workers}</b>/${def.maxWorkers} trabalhadores<br><small>${free} livre(s)</small></div>
        <button class="big-btn" data-action="site-worker" data-id="${def.id}" data-delta="1" ${st.workers >= def.maxWorkers ? 'disabled' : ''}>+</button>
      </div>
      ${free <= 0 ? '<p class="hint">Sem trabalhador livre: o + libera um ocioso (silo cheio ou recurso sem uso) ou contrata um por $80.</p>' : ''}`;
  }
  $('site-body').innerHTML = body;
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

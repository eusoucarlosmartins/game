// ui.js — renderização da sidebar e modais (receita)
import { state } from './state.js';
import { R, RECIPE_BY_ID, RECIPES_BY_TIER, EQUIPMENT, EQ_BY_ID, RESEARCH, RES_BY_ID, RES_CATS, ERAS, ROMAN, CFG, TOOLS, WORKER_COST, MINE_CATALOG, MINE, SILO_DEFAULT_CAP } from './data.js';
import { isMineOwned } from './mine.js';
import { $, fmtMoney } from './util.js';
import { currentEra, eraData, isRecipeUnlocked } from './progression.js';
import { ingredientHave } from './factories.js';
import { workersActive, getRevealedOreCounts, isResourceUnlocked } from './mine.js';
import { openModal, closeModal } from './modals.js';
import { MARKET_RAW_MULT, MARKET_PROD_MULT } from './market.js';
import { PROJECT_DEFS, availableProjects, canActivateProject, getProjectDef } from './projects.js';
import { statusWagons } from './wagon.js';
import { listAchievements } from './achievements.js';
import { currentSeason, currentYear, dayInSeason } from './seasons.js';
import { activeMine } from './mine.js';

function renderContract() {
  const box = $('contract-box');
  const list = state.contracts || [];
  if (list.length === 0) {
    box.className = 'contract';
    box.innerHTML = `<div class="contract-empty">Próximo pedido em ${Math.max(0, state.nextContractIn).toFixed(1)}s…</div>`;
    return;
  }
  box.className = 'contract contract-active';
  box.innerHTML = list.map((k, idx) => {
    const pPct = Math.round((k.delivered / k.need) * 100);
    const tLeft = Math.max(0, k.deadline - k.elapsed);
    const urgent = tLeft < 20 ? ' contract-urgent' : '';
    return `
      <div class="contract-item${urgent}">
        ${idx === 0 ? '' : '<hr class="contract-sep"/>'}
        <div class="contract-title">${k.city} pede <span style="color:${R[k.product].color}">${R[k.product].name}</span></div>
        <div class="contract-line"><span>Entregue</span><span>${k.delivered} / ${k.need}</span></div>
        <div class="contract-bar"><div class="contract-bar-fill" style="width:${pPct}%"></div></div>
        <div class="contract-line"><span>Tempo restante</span><span>${tLeft.toFixed(1)}s</span></div>
        <div class="contract-bar"><div class="contract-bar-fill contract-time-bar-fill" style="width:${(tLeft / k.deadline) * 100}%"></div></div>
      </div>
    `;
  }).join('');
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
  if (!cont) return; // tab removida em favor do modal de Upgrades
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
  if (!cont) return; // tab removida em favor do modal de Upgrades
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

// SVG sparkline simples — desenha polyline + label de início/fim
function sparklineSvg(values, label, color, formatVal = (v) => String(v)) {
  const w = 300, h = 70, pad = 24;
  if (!values || values.length < 2) {
    return `<div class="chart-empty">${label}: <em>aguardando dados (avance pelo menos 2 dias).</em></div>`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lastY = pad + (h - pad * 2) * (1 - (values[values.length - 1] - min) / range);
  const lastX = pad + (values.length - 1) * stepX;
  return `<div class="chart-row">
    <div class="chart-label">${label}</div>
    <svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="none">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="rgba(58,31,10,0.25)" stroke-dasharray="2 3"/>
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="${color}"/>
      <text x="${pad}" y="${pad - 4}" font-size="9" fill="rgba(58,31,10,0.6)">${formatVal(max)}</text>
      <text x="${pad}" y="${h - pad + 11}" font-size="9" fill="rgba(58,31,10,0.6)">${formatVal(min)}</text>
      <text x="${w - pad - 30}" y="${pad - 4}" font-size="10" font-weight="bold" fill="${color}">${formatVal(values[values.length - 1])}</text>
    </svg>
  </div>`;
}

function renderHistoryCharts() {
  const cont = $('stats-charts');
  if (!cont) return;
  const hist = state.history || [];
  if (hist.length < 2) {
    cont.innerHTML = '<div class="chart-empty">Aguardando histórico — avance pelo menos 2 dias.</div>';
    return;
  }
  const money = hist.map(h => h.money);
  const rp = hist.map(h => h.rp);
  const approval = hist.map(h => h.approval);
  const contracts = hist.map(h => h.contracts);
  cont.innerHTML =
    sparklineSvg(money, '💰 Dinheiro', '#5a9fc8', v => fmtMoney(v)) +
    sparklineSvg(approval, '⚖ Aprovação', '#a82e1c', v => v + '%') +
    sparklineSvg(rp, '🔬 PP', '#a868c8', v => v) +
    sparklineSvg(contracts, '📜 Contratos cumpridos', '#4d7c3a', v => v);
}

function renderStats() {
  renderHistoryCharts();
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
  // Lista de conquistas (todas, com desbloqueio destacado)
  const achEl = $('stats-achievements');
  if (achEl) {
    const items = listAchievements();
    const unlockedCount = items.filter(a => a.unlocked).length;
    const rows = items.map(a => {
      const cls = a.unlocked ? 'unlocked' : 'locked';
      return `<li class="ach ${cls}">
        <span class="ach-emoji">${a.unlocked ? a.emoji : '🔒'}</span>
        <span class="ach-body">
          <span class="ach-name">${a.name}</span>
          <span class="ach-desc">${a.desc}</span>
        </span>
      </li>`;
    }).join('');
    achEl.innerHTML = `<li class="ach-header"><strong>${unlockedCount}/${items.length}</strong> desbloqueadas</li>` + rows;
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

// Computa nível de atenção (0-1) pra cada elemento clicável do canvas.
// Usado em draw.js pra pulsar os nodos quando há ação relevante disponível.
// Exportado pra ser importado pelo draw.js.
export function mineNeedsAttention() {
  const free = (state.workersTotal || 0) - workersActive();
  if (free <= 0) return 0;
  const m = activeMine();
  if (!m || !m.grid) return 0;
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const t = m.grid[r][c];
      if (t && t.revealed && t.type === 'ore' && !t.worker) return 1;
    }
  }
  return 0;
}

export function cityCanDeliver() {
  // Considera todos os contratos ativos
  const ks = state.contracts || [];
  if (ks.length === 0) return 0;
  let hasPartial = false;
  for (const k of ks) {
    const have = state.products[k.product] || 0;
    const need = k.need - k.delivered;
    if (have >= need) return 1;
    if (have > 0) hasPartial = true;
  }
  return hasPartial ? 0.5 : 0;
}


export function marketNeedsAttention() {
  let nearFull = 0;
  for (const k in state.warehouse) {
    if (R[k] && R[k].free) continue;
    const stock = state.warehouse[k] || 0;
    const cap = (state.silos[k] && state.silos[k].cap) || SILO_DEFAULT_CAP;
    if (stock / cap >= 0.85) { nearFull++; if (nearFull >= 2) return 1; }
  }
  return nearFull > 0 ? 0.5 : 0;
}

export function researchNeedsAttention() {
  // Tem pesquisa ou equipamento disponível pra comprar
  for (const e of EQUIPMENT) {
    if (state.equipment[e.id]) continue;
    if (e.req && !state.equipment[e.req]) continue;
    if (state.money >= e.cost) return 1;
  }
  for (const r of RESEARCH) {
    if (state.research[r.id]) continue;
    if (r.req && !state.research[r.req]) continue;
    if ((state.rp || 0) >= r.cost) return 1;
  }
  return 0;
}

// Computa badges contextuais (contagem de "coisas pra fazer") por tab
function updateTabBadges() {
  const setBadge = (id, value, level = '') => {
    const el = $(`badge-${id}`);
    if (!el) return;
    if (value && value !== '0') {
      el.textContent = String(value);
      el.className = `tab-badge show ${level}`;
    } else {
      el.className = 'tab-badge';
    }
  };
  // Contrato: soma produtos prontos pra TODOS contratos ativos
  const ks = state.contracts || [];
  let readyForContract = 0;
  for (const k of ks) {
    const have = Math.floor(state.products[k.product] || 0);
    readyForContract += Math.min(have, k.need - k.delivered);
  }
  // Urgência: qualquer contrato com pouco tempo
  const urgent = ks.some(k => (k.deadline - k.elapsed) < 20);
  if (urgent) setBadge('contract', '!', 'warn');
  else setBadge('contract', readyForContract > 0 ? readyForContract : 0);
  // Mina: veios revelados sem worker (oportunidade) + mineradores livres
  const m = activeMine();
  let availableSpots = 0;
  if (m && m.grid) {
    for (let r = 0; r < MINE.rows; r++) {
      for (let c = 0; c < MINE.cols; c++) {
        const t = m.grid[r][c];
        if (t && t.revealed && t.type === 'ore' && !t.worker) availableSpots++;
      }
    }
  }
  const freeWorkers = (state.workersTotal || 0) - workersActive();
  setBadge('mine', freeWorkers > 0 && availableSpots > 0 ? Math.min(freeWorkers, availableSpots) : 0, 'info');
  // Fábricas: idles (sem brewing E sem produtos completos) — pode trocar receita
  const idle = (state.factories || []).filter(f => {
    if (f.brewing > 0) return false;
    const recipe = RECIPE_BY_ID[f.recipeId];
    if (!recipe) return true;
    // Falta ingrediente? idle
    for (const [ing, need] of Object.entries(recipe.in)) {
      if (R[ing].free) continue;
      const have = ingredientHave(ing);
      if (have < need) return true;
    }
    return false;
  }).length;
  setBadge('factory', idle, 'warn');
  // Mercado: silos muito cheios (>=80%) - empurrar venda
  let nearFull = 0;
  for (const k2 in state.warehouse) {
    if (R[k2] && R[k2].free) continue;
    const stock = state.warehouse[k2] || 0;
    const cap = (state.silos[k2] && state.silos[k2].cap) || SILO_DEFAULT_CAP;
    if (stock / cap >= 0.8) nearFull++;
  }
  setBadge('market', nearFull, 'warn');
  // Projetos: quantos podem ser iniciados (sem ativo, era ok, recursos ok)
  if (!state.projects.active) {
    const startable = availableProjects().filter(p => {
      if (!canActivateProject(p.id)) return false;
      for (const [res, need] of Object.entries(p.requirements)) {
        const have = R[res] && R[res].kind === 'raw' ? (state.warehouse[res] || 0) : (state.products[res] || 0);
        if (have < need) return false;
      }
      return true;
    }).length;
    setBadge('projects', startable);
  } else {
    setBadge('projects', 0);
  }
  // Stats: novas conquistas recentes (últimos 60s)
  const now = Date.now();
  const recent = listAchievements().filter(a => a.unlocked && (now - (a.timestamp || 0)) < 60000).length;
  setBadge('stats', recent, 'info');
  // Registro: sempre 0 (apenas remover badge)
  setBadge('log', 0);

  // Dot no botão Upgrades: pode comprar algo novo
  const upgDot = $('upgrades-dot');
  if (upgDot) {
    let canBuy = false;
    for (const e of EQUIPMENT) {
      if (state.equipment[e.id]) continue;
      if (e.req && !state.equipment[e.req]) continue;
      if (state.money >= e.cost) { canBuy = true; break; }
    }
    if (!canBuy) {
      for (const r of RESEARCH) {
        if (state.research[r.id]) continue;
        if (r.req && !state.research[r.req]) continue;
        if ((state.rp || 0) >= r.cost) { canBuy = true; break; }
      }
    }
    upgDot.hidden = !canBuy;
  }
}

export function syncUI() {
  $('stat-money').textContent = fmtMoney(state.money);
  $('stat-day').textContent = state.day;
  $('stat-rp').textContent = state.rp + ' PP';
  const pct = Math.round(state.approval);
  $('approval-fill').style.width = pct + '%';
  $('approval-text').textContent = pct + '%';
  const wagonEl = $('wagon-status');     if (wagonEl)  wagonEl.textContent  = statusWagons();
  const seasonEl = $('season-badge');
  if (seasonEl) {
    const s = currentSeason();
    seasonEl.textContent = `${s.emoji} ${s.name} · Ano ${currentYear()} · Dia ${dayInSeason()}/5`;
    seasonEl.title = `${s.name}: ${s.desc}`;
    seasonEl.style.background = `linear-gradient(135deg, ${s.color}33, rgba(20,10,5,0.4))`;
  }
  const diffEl = $('difficulty-badge');
  if (diffEl) {
    const d = state.difficulty || 'normal';
    const mode = state.gameMode || 'normal';
    const map = { easy: '🌿', normal: '⚖', hard: '🔥' };
    const lbl = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' };
    if (mode === 'sandbox') {
      diffEl.textContent = '🏖 Sandbox';
      diffEl.title = 'Modo Sandbox: sem game over, dinheiro extra inicial';
    } else if (mode === 'hardcore') {
      diffEl.textContent = '💀 Hardcore';
      diffEl.title = 'Modo Hardcore: save apagado se aprovação chegar a 0';
    } else {
      diffEl.textContent = `${map[d]} ${lbl[d]}`;
      diffEl.title = `Dificuldade: ${lbl[d]} (escolhida ao iniciar novo jogo)`;
    }
  }
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
  updateTabBadges();

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

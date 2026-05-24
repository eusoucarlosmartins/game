// wagon.js — uma carruagem por fábrica, cada uma com sua rota até a cidade.
// Cada wagon shuttle entre o centro da fábrica e a entrada da cidade carregando
// o produto que a fábrica produz. Se o produto bate com o contrato ativo,
// deliverProduct é chamado ao descarregar; senão, a carga volta pro estoque.
import { state } from './state.js';
import { wagonCapacity, wagonSpeed } from './progression.js';
import { CITY, factoryRect } from './geometry.js';
import { deliverProduct } from './contracts.js';

function ensureWagon(factory) {
  if (!factory.wagon) {
    factory.wagon = { pos: 0, dir: 0, product: null, load: 0, state: 'idle', timer: 0 };
  }
  return factory.wagon;
}

// Rota de cada fábrica: do canto direito do prédio ao canto esquerdo da cidade
function routeFor(idx) {
  const fr = factoryRect(idx);
  return {
    src: { x: fr.x + fr.w, y: fr.y + fr.h / 2 },
    dest: { x: CITY.x, y: CITY.y + CITY.h / 2 },
  };
}

function routeLen(idx) {
  const r = routeFor(idx);
  return Math.hypot(r.dest.x - r.src.x, r.dest.y - r.src.y);
}

export function updateWagon(dt) {
  for (let i = 0; i < state.factories.length; i++) {
    updateFactoryWagon(i, dt);
  }
}

function updateFactoryWagon(idx, dt) {
  const factory = state.factories[idx];
  if (!factory) return;
  const w = ensureWagon(factory);
  const cap = wagonCapacity();
  const spd = wagonSpeed();
  const roadLen = routeLen(idx);
  if (roadLen <= 1) return;

  switch (w.state) {
    case 'idle': {
      // Na fábrica (pos≈0): carrega se tem produto
      if (w.pos <= 0.01) {
        const have = state.products[factory.recipeId] || 0;
        if (have > 0) {
          w.product = factory.recipeId;
          w.state = 'loading';
          w.timer = 0.5;
        }
      }
      // Na cidade (pos≈1) descarregada: volta vazia
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
        // Soma a demanda total nos contratos ativos que pedem este produto
        let totalNeed = 0;
        const contracts = state.contracts || [];
        for (const k of contracts) {
          if (k.product === w.product) totalNeed += Math.max(0, k.need - k.delivered);
        }
        const needBy = totalNeed > 0 ? totalNeed : avail;
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
        // Tenta entregar pra qualquer contrato ativo que peça este produto
        const delivered = deliverProduct(w.load, w.product);
        const leftover = w.load - delivered;
        if (leftover > 0) {
          // Nenhum contrato pediu (ou já estavam preenchidos): devolve ao estoque
          state.products[w.product] = (state.products[w.product] || 0) + leftover;
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

// Para o footer "Carruagem: X ativa(s)"
export function statusWagons() {
  let active = 0, idle = 0;
  for (const f of state.factories) {
    const w = f.wagon;
    if (!w) { idle++; continue; }
    if (w.state === 'hauling' || w.state === 'loading' || w.state === 'unloading') active++;
    else idle++;
  }
  if (state.factories.length === 0) return 'sem fábricas';
  return `${active}/${state.factories.length} ativa(s)`;
}

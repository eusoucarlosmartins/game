// mine.js — depósitos e carrinho da mina
import { state, log } from './state.js';
import { R, DEP_BY_ID, CFG } from './data.js';
import { fmtMoney } from './util.js';
import { pileMax, mineRateMul, cartCapacity, cartSpeed } from './progression.js';
import { MINE_SHAFT } from './geometry.js';
import { closeModal } from './modals.js';

export function tryHire(slotIndex) {
  const d = state.deposits[slotIndex];
  if (!d || !d.resource) return;
  if (state.money < CFG.minerCost) return;
  state.money -= CFG.minerCost;
  d.miners++;
  log(`Minerador contratado em ${R[d.resource].name} (slot ${slotIndex + 1}).`);
}

export function tryFireMiner(slotIndex) {
  const d = state.deposits[slotIndex];
  if (!d || d.miners <= 0) return;
  d.miners--;
  state.money += Math.floor(CFG.minerCost * 0.3);
  log(`Minerador dispensado de ${R[d.resource].name}.`);
}

export function openDeposit(slotIndex, resourceId) {
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

export function updateDeposits(dt) {
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

export function totalMinePile() {
  let total = 0;
  for (const d of state.deposits) total += d.pile;
  return total;
}

export function warehouseTotal() {
  let total = 0;
  for (const k in state.warehouse) {
    if (R[k] && R[k].free) continue;
    total += state.warehouse[k];
  }
  return total;
}

export function updateCart(dt) {
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

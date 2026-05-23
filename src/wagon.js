// wagon.js — carruagem entre fábricas e cidade
import { state } from './state.js';
import { wagonCapacity, wagonSpeed } from './progression.js';
import { ROAD } from './geometry.js';
import { deliverProduct } from './contracts.js';

export function updateWagon(dt) {
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

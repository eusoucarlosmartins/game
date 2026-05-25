// factories.js — fábricas e produção
import { state, log } from './state.js';
import { R, RECIPE_BY_ID, CFG } from './data.js';
import { fmtMoney } from './util.js';
import { factSpdMul } from './progression.js';
import { closeModal } from './modals.js';
import { play } from './audio.js';

// Capacidade atual do estoque pronto por receita.
// Default = CFG.factoryStockMax. Cada upgrade adiciona +50.
export function recipeCap(recipeId) {
  if (!state.recipeCap) state.recipeCap = {};
  return state.recipeCap[recipeId] || CFG.factoryStockMax;
}

// Custo pra expandir: max(200, cap atual * 0.4)
export function recipeCapUpgradeCost(recipeId) {
  return Math.max(200, Math.round(recipeCap(recipeId) * 0.4));
}

// Aumenta cap da receita em +50 mediante pagamento
export function tryUpgradeRecipeCap(recipeId) {
  if (!RECIPE_BY_ID[recipeId]) return false;
  const cost = recipeCapUpgradeCost(recipeId);
  if (state.money < cost) {
    log(`Sem dinheiro pra expandir estoque de ${R[recipeId].name} ($${cost}).`, 'bad');
    return false;
  }
  if (!state.recipeCap) state.recipeCap = {};
  const cur = recipeCap(recipeId);
  state.money -= cost;
  state.recipeCap[recipeId] = cur + 50;
  log(`Estoque máximo de ${R[recipeId].name}: ${cur} → ${cur + 50} (-$${cost}).`, 'good');
  play('coin');
  return true;
}

export function buyFactory() {
  if (state.factories.length >= CFG.factorySlotsMax) return;
  const cost = CFG.factoryCosts[state.factories.length];
  if (state.money < cost) return;
  state.money -= cost;
  state.factories.push({
    recipeId: 'wood_plank', brewing: 0, output: 0,
    wagon: { pos: 0, dir: 0, product: null, load: 0, state: 'idle', timer: 0 },
  });
  log(`Nova fábrica construída por ${fmtMoney(cost)}.`, 'good');
}

export function setRecipe(factoryIndex, recipeId) {
  const f = state.factories[factoryIndex];
  if (!f || !RECIPE_BY_ID[recipeId]) return;
  f.recipeId = recipeId;
  f.brewing = 0;
  log(`Fábrica ${factoryIndex + 1} agora produz ${R[recipeId].name}.`);
  closeModal('modal-recipe');
}

export function ingredientHave(ing) {
  if (R[ing].free) return Infinity;
  if (R[ing].kind === 'raw') return state.warehouse[ing] || 0;
  return state.products[ing] || 0;
}
export function ingredientConsume(ing, n) {
  if (R[ing].free) return;
  if (R[ing].kind === 'raw') state.warehouse[ing] -= n;
  else state.products[ing] -= n;
}

export function updateFactories(dt) {
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
    if (f.brewing <= 0 && (state.products[f.recipeId] || 0) < recipeCap(f.recipeId)) {
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

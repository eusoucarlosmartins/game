// data.test.js — garante que todos os recursos referenciados em
// receitas/depósitos/eras existem em R e que os índices estão coerentes.
import { describe, it, expect } from 'vitest';
import {
  R,
  RECIPES,
  RECIPE_BY_ID,
  RECIPES_BY_TIER,
  DEPOSIT_TYPES,
  DEP_BY_ID,
  EQUIPMENT,
  EQ_BY_ID,
  RESEARCH,
  RES_BY_ID,
  ERAS,
} from '../src/data.js';

describe('R (dicionário de recursos)', () => {
  it('todo recurso tem name, color, kind, tier', () => {
    for (const id in R) {
      const r = R[id];
      expect(r.name, `${id}.name`).toBeTypeOf('string');
      expect(r.color, `${id}.color`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(['raw', 'prod'], `${id}.kind`).toContain(r.kind);
      expect([1, 2, 3, 4], `${id}.tier`).toContain(r.tier);
    }
  });
});

describe('RECIPES (cadeia produtiva)', () => {
  it('toda receita produz um recurso conhecido', () => {
    for (const r of RECIPES) {
      expect(R[r.id], `receita ${r.id}`).toBeDefined();
    }
  });

  it('todo ingrediente de receita é recurso conhecido', () => {
    for (const r of RECIPES) {
      for (const ing in r.in) {
        expect(R[ing], `receita ${r.id} → ingrediente ${ing}`).toBeDefined();
      }
    }
  });

  it('RECIPE_BY_ID indexa corretamente', () => {
    expect(Object.keys(RECIPE_BY_ID)).toHaveLength(RECIPES.length);
    for (const r of RECIPES) {
      expect(RECIPE_BY_ID[r.id]).toBe(r);
    }
  });

  it('toda receita tem tempo positivo', () => {
    for (const r of RECIPES) {
      expect(r.time, `receita ${r.id}`).toBeGreaterThan(0);
    }
  });

  it('RECIPES_BY_TIER particiona corretamente', () => {
    let total = 0;
    for (const t of [2, 3, 4]) {
      total += RECIPES_BY_TIER[t].length;
      for (const r of RECIPES_BY_TIER[t]) {
        expect(R[r.id].tier, `${r.id} no bucket ${t}`).toBe(t);
      }
    }
    expect(total).toBe(RECIPES.length);
  });
});

describe('DEPOSITS', () => {
  it('todo depósito existe em R como raw', () => {
    for (const d of DEPOSIT_TYPES) {
      expect(R[d.id], `${d.id}`).toBeDefined();
      expect(R[d.id].kind).toBe('raw');
    }
  });
  it('DEP_BY_ID indexa corretamente', () => {
    for (const d of DEPOSIT_TYPES) expect(DEP_BY_ID[d.id]).toBe(d);
  });
});

describe('EQUIPMENT', () => {
  it('todo equipamento tem id, name, cost, effect', () => {
    for (const e of EQUIPMENT) {
      expect(e.id).toBeTypeOf('string');
      expect(e.name).toBeTypeOf('string');
      expect(e.cost).toBeGreaterThan(0);
      expect(e.effect).toBeTypeOf('string');
    }
  });
  it('pré-requisitos referenciam equipamento existente', () => {
    for (const e of EQUIPMENT) {
      if (e.req) expect(EQ_BY_ID[e.req], `req de ${e.id}`).toBeDefined();
    }
  });
});

describe('RESEARCH', () => {
  it('pré-requisitos referenciam pesquisa existente', () => {
    for (const r of RESEARCH) {
      if (r.req) expect(RES_BY_ID[r.req], `req de ${r.id}`).toBeDefined();
    }
  });
});

describe('ERAS', () => {
  it('eras acumulam depósitos/receitas das anteriores', () => {
    for (let i = 1; i < ERAS.length; i++) {
      const prev = ERAS[i - 1];
      const cur = ERAS[i];
      for (const dep of prev.deposits) {
        expect(cur.deposits, `era ${i + 1} herda ${dep}`).toContain(dep);
      }
      for (const rec of prev.recipes) {
        expect(cur.recipes, `era ${i + 1} herda ${rec}`).toContain(rec);
      }
    }
  });

  it('contratos de era referenciam recursos existentes', () => {
    for (const era of ERAS) {
      for (const c of era.contracts) {
        expect(R[c], `era ${era.id} → contrato ${c}`).toBeDefined();
      }
    }
  });
});

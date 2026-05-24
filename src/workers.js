// workers.js — gestão de mineradores individuais.
// Cada worker tem nome, skill (0.6-1.4), fatigue (0-1) e salário diário.
// Antes era só um contador global; agora são entidades discretas.
import { state, log } from './state.js';
import { irand, rand, fmtMoney } from './util.js';

// Nomes brasileiros/luso/alemão/italiano refletindo imigração em SC 1850-1900
const FIRST_NAMES = [
  'João', 'Maria', 'Antônio', 'Pedro', 'José', 'Ana', 'Manuel', 'Joana',
  'Francisco', 'Rita', 'Carlos', 'Bento', 'Tomé', 'Luzia', 'Inácio', 'Marta',
  'Domingos', 'Conceição', 'Otília', 'Henrique', 'Adelaide', 'Augusto',
  'Eulália', 'Vicente', 'Cândida', 'Sebastião', 'Iolanda', 'Fritz', 'Hans',
  'Gretel', 'Hilda', 'Otto', 'Klaus', 'Gunther', 'Erika', 'Giuseppe', 'Pietro',
  'Lucia', 'Giulia', 'Salvatore', 'Marco',
];
const LAST_NAMES = [
  'da Silva', 'Souza', 'Pereira', 'Costa', 'Oliveira', 'Cardoso', 'Mendes',
  'Ferreira', 'Lima', 'Cunha', 'Santos', 'Almeida', 'Marques', 'Barbosa',
  'Rocha', 'Albuquerque', 'Schmidt', 'Müller', 'Werner', 'Hering', 'Konder',
  'Hoffmann', 'Bonotto', 'Sasse', 'Bertoldi', 'Ferri', 'Reis', 'Vieira',
  'Carvalho', 'Lopes',
];

let nextId = 1000;
function genId() { return ++nextId; }

function randomName() {
  return `${FIRST_NAMES[irand(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[irand(0, LAST_NAMES.length - 1)]}`;
}

/** Cria um worker novo com skill aleatória */
export function makeWorker(skillMin = 0.6, skillMax = 1.4) {
  const skill = Math.round((skillMin + Math.random() * (skillMax - skillMin)) * 100) / 100;
  return {
    id: genId(),
    name: randomName(),
    skill,
    fatigue: 0,
    salary: Math.round(8 + skill * 12), // 16-25 por dia dependendo de skill
  };
}

/** Inicialização: garante workers ao começar/migrar */
export function ensureWorkers() {
  if (!Array.isArray(state.workers)) state.workers = [];
  // Migração: se tem workersTotal mas array vazio, cria N workers padrão
  const target = state.workersTotal || 2;
  while (state.workers.length < target) {
    state.workers.push(makeWorker());
  }
  // Mantém ID alto pra não colidir
  for (const w of state.workers) {
    if (w.id >= nextId) nextId = w.id + 1;
  }
  state.workersTotal = state.workers.length;
}

/** Encontra worker pelo id, retorna null se não existir */
export function getWorker(id) {
  if (!Array.isArray(state.workers)) return null;
  return state.workers.find(w => w.id === id) || null;
}

/** Quantos workers estão alocados num tile (na mina ativa) */
export function workersAllocatedCount() {
  let n = 0;
  for (const mine of (state.mines || [])) {
    if (!mine.grid) continue;
    for (const row of mine.grid) {
      for (const t of row) {
        if (t.worker) n++;
      }
    }
  }
  return n;
}

/** Lista IDs alocados pra evitar duplicação */
export function allocatedWorkerIds() {
  const ids = new Set();
  for (const mine of (state.mines || [])) {
    if (!mine.grid) continue;
    for (const row of mine.grid) {
      for (const t of row) {
        if (t.worker) ids.add(typeof t.worker === 'number' ? t.worker : 0);
      }
    }
  }
  return ids;
}

/** Workers ociosos (não alocados) */
export function idleWorkers() {
  ensureWorkers();
  const allocated = allocatedWorkerIds();
  return state.workers.filter(w => !allocated.has(w.id));
}

/** Pega o próximo worker ocioso pra alocar */
export function takeIdleWorker() {
  const idles = idleWorkers();
  // Prefere o de maior skill (jogador esperto vê melhor uso)
  idles.sort((a, b) => b.skill - a.skill);
  return idles[0] || null;
}

// Geração de candidatos pra contratação (3 por padrão)
let candidates = null;
let candidatesGeneratedFor = -1;

export function getCandidates() {
  // Regenera a cada dia (uses state.day como cache key)
  if (candidates === null || candidatesGeneratedFor !== state.day) {
    candidates = [
      makeCandidate(0.6, 1.0),
      makeCandidate(0.8, 1.2),
      makeCandidate(1.0, 1.4),
    ];
    candidatesGeneratedFor = state.day;
  }
  return candidates;
}

function makeCandidate(skillMin, skillMax) {
  const w = makeWorker(skillMin, skillMax);
  // Custo de contratação proporcional à skill — mais acessível pra early game.
  // Antes: $108-172. Agora: $70-110, escalando com skill.
  w.hireCost = Math.round(40 + w.skill * 50);
  return w;
}

export function hireCandidate(id) {
  const list = getCandidates();
  const idx = list.findIndex(c => c.id === id);
  if (idx < 0) return false;
  const c = list[idx];
  if (state.money < c.hireCost) {
    log(`Sem dinheiro para contratar ${c.name}.`, 'bad');
    return false;
  }
  state.money -= c.hireCost;
  const cost = c.hireCost;
  delete c.hireCost;
  state.workers.push(c);
  state.workersTotal = state.workers.length;
  log(`Contratado: ${c.name} (skill ${c.skill}× · sal. ${fmtMoney(c.salary)}/dia) por ${fmtMoney(cost)}.`, 'good');
  // Remove dos candidatos (gera 1 novo no lugar)
  list.splice(idx, 1);
  list.push(makeCandidate(0.6, 1.4));
  return true;
}

/** Cobra salário diário de todos workers (chamado em updateDay) */
export function payDailySalaries() {
  ensureWorkers();
  if (state.workers.length === 0) return;
  let total = 0;
  for (const w of state.workers) total += w.salary;
  state.money -= total;
  if (state.money < 0) {
    // Workers se demitem se não recebem (perde os de menor skill primeiro)
    state.workers.sort((a, b) => a.skill - b.skill);
    while (state.money < 0 && state.workers.length > 0) {
      const gone = state.workers.shift();
      state.money += gone.salary;
      log(`⚠ ${gone.name} se demitiu por falta de pagamento.`, 'bad');
      // Remove esse worker dos tiles
      for (const mine of (state.mines || [])) {
        if (!mine.grid) continue;
        for (const row of mine.grid) {
          for (const t of row) {
            if (t.worker === gone.id) t.worker = false;
          }
        }
      }
    }
    state.workersTotal = state.workers.length;
    return;
  }
  // Reduz fatigue de quem não tá alocado, no dia novo
  const allocated = allocatedWorkerIds();
  for (const w of state.workers) {
    if (!allocated.has(w.id)) w.fatigue = Math.max(0, (w.fatigue || 0) - 0.3);
  }
  log(`Salários pagos: ${fmtMoney(total)} (${state.workers.length} trabalhadores).`);
}

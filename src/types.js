// types.js — tipos compartilhados via JSDoc.
// Não exporta runtime; serve apenas como referência pro TypeScript (checkJs).
// Editor e CI pegam erros sem precisar migrar .js → .ts.

/**
 * @typedef {'raw' | 'prod'} ResourceKind
 *
 * @typedef {object} Resource
 * @property {string} name
 * @property {string} color  HEX como '#aabbcc'
 * @property {ResourceKind} kind
 * @property {1|2|3|4} tier
 * @property {number} price
 * @property {boolean} [free]
 *
 * @typedef {object} Recipe
 * @property {string} id  Id do recurso produzido
 * @property {Record<string, number>} in  Ingredientes consumidos
 * @property {number} time  Segundos para produzir uma unidade
 *
 * @typedef {object} DepositType
 * @property {string} id
 * @property {number} cost   Custo de "abrir" o depósito (legado da mecânica antiga)
 * @property {number} rate   Taxa base de extração por minerador por segundo
 *
 * @typedef {object} Tile
 * @property {'dirt'|'stone'|'ore'|'air'} type
 * @property {string|null} resource  Id do recurso para tiles do tipo 'ore'
 * @property {number} amount  Quantidade restante (apenas ore)
 * @property {boolean} revealed
 * @property {boolean} worker  Minerador alocado nesse tile?
 *
 * @typedef {object} Mine
 * @property {Tile[][]|null} grid
 * @property {'pick'|'tnt'|'compass'|'miner'} tool
 * @property {{ r: number, c: number, t: number }|null} tntFx
 *
 * @typedef {object} Factory
 * @property {string} recipeId
 * @property {number} brewing   Tempo restante para o lote em andamento (s)
 * @property {number} output    Quantidade em estoque
 *
 * @typedef {object} Wagon
 * @property {number} pos  0..1 ao longo da estrada
 * @property {-1|0|1} dir
 * @property {string|null} product
 * @property {number} load
 * @property {'idle'|'loading'|'hauling'|'unloading'} state
 * @property {number} timer
 *
 * @typedef {object} Contract
 * @property {string} city
 * @property {string} product
 * @property {number} need
 * @property {number} delivered
 * @property {number} deadline
 * @property {number} elapsed
 *
 * @typedef {object} ActiveEvent
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {'good'|'bad'|'neutral'} kind
 * @property {number} timeLeft
 * @property {number} total
 *
 * @typedef {object} LogEntry
 * @property {string} msg
 * @property {'good'|'bad'|''} kind
 * @property {number} day
 *
 * @typedef {object} GameState
 * @property {number} money
 * @property {number} approval
 * @property {number} day
 * @property {number} dayTimer
 * @property {number} speed   0 = pausa, 1 = normal, 2 = rápido, 4 = muito rápido
 * @property {boolean} over
 * @property {Mine} mine
 * @property {number} workersTotal
 * @property {number} tilesDug
 * @property {Factory[]} factories
 * @property {Record<string, number>} warehouse
 * @property {Record<string, number>} products
 * @property {Record<string, { cap: number }>} silos
 * @property {Wagon} wagon
 * @property {Contract|null} contract
 * @property {string} currentCity
 * @property {number} nextContractIn
 * @property {number} contractsCompleted
 * @property {Record<string, boolean>} equipment
 * @property {Record<string, boolean>} research
 * @property {number} rp
 * @property {number} eraReached
 * @property {LogEntry[]} log
 * @property {number} mouseX
 * @property {number} mouseY
 * @property {ActiveEvent|null} activeEvent
 * @property {number} nextEventIn
 * @property {number} eventMineMul
 * @property {number} eventContractBonus
 */

export {};

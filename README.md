# Tapuia

Tycoon de mineração + indústria + governo ambientado em Santa Catarina.
Protótipo em HTML5 Canvas + ES modules.

## Stack

- **Runtime**: ES modules vanilla, sem framework
- **PWA**: instalável como app (ícone na home/desktop, fullscreen landscape, offline via Service Worker)
- **Build/Dev**: [Vite](https://vitejs.dev/) (HMR + bundle de produção)
- **Tipos**: TypeScript em modo `allowJs + checkJs` (JSDoc, sem migrar `.js` → `.ts`)
- **Testes**: [Vitest](https://vitest.dev/) com ambiente `happy-dom`
- **Lint/Format**: ESLint v9 (flat config) + Prettier
- **CI**: GitHub Actions roda lint + typecheck + testes + build em cada push

## Quickstart

```sh
npm install
npm run dev          # http://localhost:5173 com hot-reload
npm test             # roda os testes uma vez
npm run test:watch   # testes em modo watch
npm run typecheck    # checa tipos JSDoc com tsc
npm run lint         # ESLint
npm run build        # gera dist/ otimizado
npm run preview      # serve o build localmente
```

## Estrutura

```
.
├── index.html                  # entry HTML, carrega src/main.js como module
├── style.css                   # estilos globais e sidebar
├── package.json                # scripts + deps
├── vite.config.js              # config do dev server / build / test
├── tsconfig.json               # TS check em modo JSDoc
├── eslint.config.js            # ESLint flat config (v9)
├── .prettierrc.json
├── src/                        # 17 módulos ES6
│   ├── main.js                 # entry point: loop, eventos, init
│   ├── data.js                 # constantes (recursos, receitas, eras)
│   ├── state.js                # state object + log
│   ├── geometry.js             # coords do canvas
│   ├── progression.js          # era, modificadores
│   ├── save.js                 # localStorage (versionado)
│   ├── modals.js               # open/close modal
│   ├── mine.js                 # grid 2D, fog of war, ferramentas
│   ├── factories.js            # produção
│   ├── wagon.js                # transporte cidade
│   ├── contracts.js            # geração de contratos
│   ├── market.js               # venda de excedente
│   ├── events.js               # eventos aleatórios
│   ├── upgrades.js             # tela de upgrades em árvore
│   ├── ui.js                   # sidebar + modais
│   ├── draw.js                 # render do canvas
│   ├── types.js                # JSDoc typedefs compartilhados
│   └── util.js                 # helpers
├── tests/                      # testes Vitest
│   ├── data.test.js
│   ├── progression.test.js
│   ├── save.test.js
│   ├── mine.test.js
│   └── market.test.js
└── .github/workflows/ci.yml    # CI: test + build em cada push
```

## Conceitos do jogo

1. **Mina em grid 2D**: cave terra/pedra com a Picareta, descubra veios.
   Use Dinamite (3×3, $120) ou Bússola (revela neblina, $40).
2. **Mineradores**: contrate ($80), aloque clicando num veio descoberto.
3. **Silos por recurso**: capacidade 400 cada. Quando enche, mineração pausa.
4. **Fábricas**: consomem dos silos, produzem segundo a receita escolhida.
5. **Carruagem**: leva produtos para a cidade que demanda.
6. **Contratos**: cidades pedem produtos finais (tier 4) com prazo. Cumprir dá $$$, PP e aprovação.
7. **Eras**: 6 níveis de progressão. Cada era libera novos recursos/receitas.
8. **Upgrades**: equipamentos ($) e pesquisas (PP) em árvore visual.
9. **Mercado**: vende excedente por 60-70% do preço de contrato.
10. **Eventos aleatórios**: Festival, Greve, Descoberta etc. afetam o jogo temporariamente.

## Atalhos

| Tecla | Ação |
|---|---|
| `1` `2` `3` `4` | Picareta / TNT / Bússola / Minerador |
| `Espaço` | Pausa/play |
| `U` | Abre tela de Upgrades |

## Expansão futura

A arquitetura está preparada para:

- **Mais módulos**: dependências unidirecionais (sem ciclos), cada feature isolada em arquivo próprio.
- **Migração gradual para TypeScript**: `tsconfig.json` aceita `.js` e `.ts` lado a lado.
- **Migração pra Phaser/Pixi**: a separação `draw.js` (canvas) ↔ resto (lógica) facilita troca do renderer.
- **Empacotamento desktop (Electron/Tauri)**: bundle via Vite gera estático servível.
- **Asset pipeline**: pasta `public/` está reservada e configurada no Vite pra sprites/audio.

## Save

Save automático a cada 15 segundos em `localStorage` sob a chave `tapuia_save_v2`.
A versão muda quando o schema interno muda — saves antigos são ignorados (não corrompem).

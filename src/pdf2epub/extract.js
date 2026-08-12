/**
 * Extração de texto estruturado a partir das camadas de texto do PDF.
 *
 * O PDF não guarda parágrafos — guarda fragmentos de texto com posição
 * absoluta. Aqui reconstruímos a estrutura por heurística: agrupamos itens em
 * linhas, linhas em parágrafos, e promovemos a título o que parece título.
 *
 * As funções deste módulo são puras e trabalham sobre `TextItem`, sem depender
 * do pdf.js — é o que permite testá-las sem carregar um PDF de verdade.
 */

/**
 * @typedef {object} TextItem
 * @property {string} str
 * @property {number} x borda esquerda
 * @property {number} y linha de base (cresce pra cima, como no PDF)
 * @property {number} width
 * @property {number} fontSize
 */

/**
 * @typedef {object} Line
 * @property {string} text
 * @property {number} x
 * @property {number} endX
 * @property {number} y
 * @property {number} fontSize
 */

/** @typedef {import('./epub.js').Block} Block */
/** @typedef {import('./epub.js').Chapter} Chapter */

/** Marca onde cada bloco nasceu, pra fatiar por página quando não há títulos. */
/**
 * @typedef {object} PagedBlock
 * @property {'h1' | 'h2' | 'p'} type
 * @property {string} text
 * @property {number} page índice 1-based
 */

/** @param {number[]} values */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Valor mais frequente, com os números arredondados pra criar "baldes".
 * @param {number[]} values
 * @param {number} [precision]
 */
function mode(values, precision = 1) {
  /** @type {Map<number, number>} */
  const counts = new Map();
  let best = 0;
  let bestCount = 0;
  for (const value of values) {
    const key = Math.round(value / precision) * precision;
    const count = (counts.get(key) || 0) + 1;
    counts.set(key, count);
    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }
  return best;
}

/**
 * Agrupa itens soltos em linhas de texto.
 *
 * @param {TextItem[]} items
 * @returns {Line[]} ordenadas de cima pra baixo
 */
export function groupLines(items) {
  const usable = items.filter((item) => item.str && item.str.trim() !== '');
  if (!usable.length) return [];

  // Ordena de cima pra baixo (y decresce) e da esquerda pra direita.
  const sorted = [...usable].sort((a, b) => (b.y !== a.y ? b.y - a.y : a.x - b.x));

  /** @type {TextItem[][]} */
  const rows = [];
  for (const item of sorted) {
    const current = rows[rows.length - 1];
    // Duas frações da mesma linha raramente diferem mais que meia altura de fonte.
    const tolerance = Math.max(item.fontSize, 1) * 0.5;
    if (current && Math.abs(current[0].y - item.y) <= tolerance) {
      current.push(item);
    } else {
      rows.push([item]);
    }
  }

  return rows.map((row) => {
    const ordered = [...row].sort((a, b) => a.x - b.x);
    let text = '';
    let cursor = ordered[0].x;
    for (const item of ordered) {
      const gap = item.x - cursor;
      const needsSpace =
        text !== '' && !/\s$/.test(text) && !/^\s/.test(item.str) && gap > item.fontSize * 0.2;
      text += (needsSpace ? ' ' : '') + item.str;
      cursor = item.x + item.width;
    }
    return {
      text: text.replace(/\s+/g, ' ').trim(),
      x: ordered[0].x,
      endX: cursor,
      y: ordered[0].y,
      fontSize: mode(
        ordered.map((item) => item.fontSize),
        0.5,
      ),
    };
  });
}

/** @param {string} text */
function isPageNumber(text) {
  return /^[\s\-—–[(]*(\d{1,4}|[ivxlcdm]{1,7})[\s\-—–\])]*$/i.test(text);
}

/**
 * Normaliza pra comparar cabeçalhos entre páginas: números viram `#`, porque
 * "Capítulo 3 — pág. 41" e "Capítulo 3 — pág. 42" são o mesmo cabeçalho.
 * @param {string} text
 */
function normalizeRepeat(text) {
  return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

/**
 * Descobre cabeçalhos/rodapés recorrentes olhando as bordas de cada página.
 *
 * @param {Line[][]} pages
 * @param {number} [threshold] fração mínima de páginas pra considerar recorrente
 * @returns {Set<string>} textos normalizados a descartar
 */
export function detectRunningHeads(pages, threshold = 0.4) {
  const substantial = pages.filter((lines) => lines.length >= 4);
  if (substantial.length < 3) return new Set();

  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const lines of substantial) {
    // Só as duas primeiras e duas últimas linhas podem ser cabeçalho/rodapé.
    const edges = [...lines.slice(0, 2), ...lines.slice(-2)];
    // Cabeçalho é curto; a trava evita confundir corpo de texto com recorrência.
    const seen = new Set(
      edges.filter((line) => line.text.length <= 80).map((line) => normalizeRepeat(line.text)),
    );
    for (const key of seen) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const minimum = Math.max(3, Math.ceil(substantial.length * threshold));
  const repeats = new Set();
  for (const [key, count] of counts) {
    if (count >= minimum && key !== '') repeats.add(key);
  }
  return repeats;
}

/**
 * Decide se uma linha de borda é "mobiliário" da página (cabeçalho, rodapé,
 * fólio) em vez de conteúdo.
 *
 * Além da recorrência entre páginas, vale um sinal independente: cabeçalho e
 * rodapé costumam ser impressos em corpo menor que o texto. Exigimos também
 * que a linha seja curta, senão uma nota de rodapé — que também é miúda —
 * seria descartada junto.
 *
 * @param {Line} line
 * @param {number} bodySize
 * @param {Set<string>} runningHeads
 */
function isFurniture(line, bodySize, runningHeads) {
  if (isPageNumber(line.text)) return true;
  if (runningHeads.has(normalizeRepeat(line.text))) return true;
  return line.fontSize <= bodySize * 0.8 && line.text.length <= 80;
}

const HEADING_PATTERN =
  /^(cap[íi]tulo|chapter|parte|part|se[çc][ãa]o|section|ap[êe]ndice|appendix|pr[óo]logo|prologue|ep[íi]logo|epilogue|introdu[çc][ãa]o|introduction|conclus[ãa]o|conclusion|pref[áa]cio|preface|sum[áa]rio)\b/i;

/**
 * @param {Line} line
 * @param {number} bodySize
 */
function headingLevel(line, bodySize) {
  const { text, fontSize } = line;
  if (text.length > 90 || isPageNumber(text)) return null;

  if (fontSize >= bodySize * 1.35) return 'h1';
  if (fontSize >= bodySize * 1.12) return 'h2';
  if (HEADING_PATTERN.test(text) && text.length <= 60) return 'h1';
  // CAIXA ALTA curta e isolada costuma ser título de seção.
  if (text.length <= 60 && text === text.toUpperCase() && /[A-ZÀ-Þ]{3}/.test(text)) return 'h2';
  return null;
}

/**
 * Converte as linhas de um PDF inteiro em blocos semânticos.
 *
 * @param {Line[][]} pages linhas por página
 * @returns {PagedBlock[]}
 */
export function linesToBlocks(pages) {
  const allLines = pages.flat();
  if (!allLines.length) return [];

  const bodySize = mode(
    allLines.map((line) => line.fontSize),
    0.5,
  );
  const bodyLeft = mode(
    allLines.map((line) => line.x),
    2,
  );
  const bodyRight = median(allLines.map((line) => line.endX));
  const runningHeads = detectRunningHeads(pages);

  /** @type {PagedBlock[]} */
  const blocks = [];
  /** @type {{ text: string; page: number } | null} */
  let paragraph = null;

  const flush = () => {
    if (paragraph && paragraph.text.trim()) {
      blocks.push({ type: 'p', text: paragraph.text.trim(), page: paragraph.page });
    }
    paragraph = null;
  };

  pages.forEach((lines, pageIndex) => {
    const page = pageIndex + 1;
    const gaps = [];
    for (let i = 1; i < lines.length; i++) gaps.push(Math.abs(lines[i - 1].y - lines[i].y));
    const lineGap = median(gaps) || bodySize * 1.2;

    lines.forEach((line, index) => {
      const isEdge = index < 2 || index >= lines.length - 2;
      if (isEdge && isFurniture(line, bodySize, runningHeads)) return;
      if (!line.text) return;

      const level = headingLevel(line, bodySize);
      if (level) {
        flush();
        blocks.push({ type: level, text: line.text, page });
        return;
      }

      if (!paragraph) {
        paragraph = { text: line.text, page };
        return;
      }

      const previous = lines[index - 1];
      const verticalGap = previous ? Math.abs(previous.y - line.y) : 0;
      const startsNewParagraph =
        // Espaçamento maior que o normal entre linhas.
        (previous && verticalGap > lineGap * 1.5) ||
        // Recuo de primeira linha.
        line.x > bodyLeft + bodySize * 0.6 ||
        // Linha anterior terminou curta e com pontuação final.
        (previous &&
          previous.endX < bodyRight - bodySize * 2.5 &&
          /[.!?:"”»]$/.test(paragraph.text));

      if (startsNewParagraph) {
        flush();
        paragraph = { text: line.text, page };
        return;
      }

      // Junta desfazendo a hifenização de fim de linha.
      if (/[\p{Ll}]-$/u.test(paragraph.text) && /^[\p{Ll}]/u.test(line.text)) {
        paragraph.text = paragraph.text.slice(0, -1) + line.text;
      } else {
        paragraph.text += ' ' + line.text;
      }
    });
  });

  flush();
  return blocks;
}

/**
 * Agrupa blocos em capítulos.
 *
 * Com títulos `h1`, corta em cada um. Sem títulos (comum em PDFs de artigo ou
 * escaneados), fatia por faixa de páginas — um XHTML gigante trava o leitor.
 *
 * @param {PagedBlock[]} blocks
 * @param {object} [options]
 * @param {string} [options.fallbackTitle]
 * @param {number} [options.pagesPerChunk]
 * @returns {Chapter[]}
 */
export function blocksToChapters(blocks, options = {}) {
  const { fallbackTitle = 'Documento', pagesPerChunk = 10 } = options;
  if (!blocks.length) return [];

  const hasHeadings = blocks.some((block) => block.type === 'h1');

  /** @type {Chapter[]} */
  const chapters = [];

  if (hasHeadings) {
    /** @type {Chapter | null} */
    let current = null;
    for (const block of blocks) {
      if (block.type === 'h1') {
        current = { title: block.text, blocks: [{ type: 'h1', text: block.text }] };
        chapters.push(current);
        continue;
      }
      if (!current) {
        // Conteúdo antes do primeiro título (rosto, dedicatória, etc.).
        current = { title: 'Início', blocks: [] };
        chapters.push(current);
      }
      current.blocks.push({ type: block.type, text: block.text });
    }
    return chapters.filter((chapter) => chapter.blocks.length > 0);
  }

  /** @type {Chapter | null} */
  let current = null;
  let chunkStart = 0;
  for (const block of blocks) {
    const chunk = Math.floor((block.page - 1) / pagesPerChunk);
    if (!current || chunk !== chunkStart) {
      chunkStart = chunk;
      const from = chunk * pagesPerChunk + 1;
      const to = from + pagesPerChunk - 1;
      current = { title: `${fallbackTitle} — páginas ${from}–${to}`, blocks: [] };
      chapters.push(current);
    }
    current.blocks.push({ type: block.type, text: block.text });
  }
  return chapters.filter((chapter) => chapter.blocks.length > 0);
}

/**
 * Converte os itens brutos do pdf.js para o formato `TextItem`.
 *
 * @param {{ str?: string; transform?: number[]; width?: number; height?: number }[]} raw
 * @returns {TextItem[]}
 */
export function normalizeItems(raw) {
  /** @type {TextItem[]} */
  const items = [];
  for (const item of raw) {
    const transform = item.transform;
    if (!item.str || !transform) continue;
    // transform = [a, b, c, d, e, f]; a escala vertical dá o corpo da fonte.
    const fontSize = Math.hypot(transform[2], transform[3]) || item.height || 10;
    items.push({
      str: item.str,
      x: transform[4],
      y: transform[5],
      width: item.width ?? item.str.length * fontSize * 0.5,
      fontSize,
    });
  }
  return items;
}

/**
 * Conta caracteres úteis — serve pra detectar PDF escaneado (só imagem).
 * @param {Line[][]} pages
 */
export function textDensity(pages) {
  const chars = pages.reduce(
    (total, lines) => total + lines.reduce((sum, line) => sum + line.text.length, 0),
    0,
  );
  return pages.length ? chars / pages.length : 0;
}

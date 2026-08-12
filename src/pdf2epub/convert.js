/**
 * Cola entre o pdf.js e os módulos de extração/empacotamento.
 *
 * Tudo roda no navegador: o PDF nunca sai da máquina do usuário.
 */

import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';
import {
  groupLines,
  linesToBlocks,
  blocksToChapters,
  normalizeItems,
  textDensity,
} from './extract.js';
import { buildEpub } from './epub.js';
import { pickTitle } from './title.js';

pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();

/** Abaixo disso por página, o PDF quase certamente é escaneado (só imagem). */
const SCANNED_THRESHOLD = 80;

/**
 * @typedef {object} Analysis
 * @property {import('./epub.js').Chapter[]} chapters
 * @property {number} pageCount
 * @property {boolean} looksScanned
 * @property {{ title: string; author: string }} meta
 * @property {import('./epub.js').Cover} [cover]
 */

/**
 * Renderiza a primeira página como capa JPEG.
 *
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {number} [maxWidth]
 * @returns {Promise<import('./epub.js').Cover | undefined>}
 */
async function renderCover(page, maxWidth = 900) {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2, maxWidth / base.width) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  // Fundo branco: PDFs desenham sobre papel, não sobre transparência.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;

  /** @type {Blob | null} */
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) return undefined;
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    mime: 'image/jpeg',
    ext: 'jpg',
  };
}

/**
 * Lê o PDF e devolve a estrutura detectada, sem ainda gerar o arquivo.
 *
 * @param {File} file
 * @param {object} [options]
 * @param {boolean} [options.cover] renderizar a página 1 como capa
 * @param {number} [options.pagesPerChunk]
 * @param {(done: number, total: number) => void} [options.onProgress]
 * @returns {Promise<Analysis>}
 */
export async function analyzePdf(file, options = {}) {
  const { cover: wantCover = true, pagesPerChunk = 10, onProgress } = options;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;

  /** @type {import('./extract.js').Line[][]} */
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    pages.push(groupLines(normalizeItems(content.items)));
    // Sem isso, um PDF grande estoura a memória da aba.
    page.cleanup();
    onProgress?.(number, pdf.numPages);
  }

  const info = await pdf.getMetadata().catch(() => null);
  /** @type {any} */
  const rawInfo = info?.info || {};
  const fallbackTitle = file.name.replace(/\.pdf$/i, '');

  const cover = wantCover ? await renderCover(await pdf.getPage(1)) : undefined;

  const blocks = linesToBlocks(pages);
  const chapters = blocksToChapters(blocks, { fallbackTitle, pagesPerChunk });

  return {
    chapters,
    pageCount: pdf.numPages,
    looksScanned: textDensity(pages) < SCANNED_THRESHOLD,
    meta: {
      title: pickTitle(rawInfo.Title, fallbackTitle),
      author: (rawInfo.Author || '').trim(),
    },
    cover,
  };
}

export { buildEpub };

/**
 * Interface da página PDF → EPUB.
 *
 * Só cuida de DOM e estado da tela; a conversão vive em `convert.js`.
 */

import { analyzePdf, buildEpub } from './convert.js';

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`elemento #${id} não encontrado`);
  return node;
}

const dropZone = el('drop');
const fileInput = /** @type {HTMLInputElement} */ (el('file'));
const progressPanel = el('progress-panel');
const bar = /** @type {HTMLProgressElement} */ (el('bar'));
const status = el('status');
const resultPanel = el('result');
const scannedWarning = el('scanned');
const titleInput = /** @type {HTMLInputElement} */ (el('meta-title'));
const authorInput = /** @type {HTMLInputElement} */ (el('meta-author'));
const languageSelect = /** @type {HTMLSelectElement} */ (el('meta-language'));
const tocList = el('toc');
const tocSummary = el('toc-summary');
const downloadButton = /** @type {HTMLButtonElement} */ (el('download'));
const resetButton = el('reset');
const resultStatus = el('result-status');

/** @type {import('./convert.js').Analysis | null} */
let analysis = null;
/** @type {string | null} */
let objectUrl = null;

/** @param {string} name */
function baseName(name) {
  return name.replace(/\.pdf$/i, '') || 'livro';
}

/** @type {string} */
let currentName = 'livro';

function revokeDownload() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function showResult() {
  if (!analysis) return;

  const words = analysis.chapters.reduce(
    (total, chapter) =>
      total +
      chapter.blocks.reduce(
        (sum, block) => sum + block.text.split(/\s+/).filter(Boolean).length,
        0,
      ),
    0,
  );

  el('stat-pages').textContent = String(analysis.pageCount);
  el('stat-chapters').textContent = String(analysis.chapters.length);
  el('stat-words').textContent = words.toLocaleString('pt-BR');

  scannedWarning.classList.toggle('hidden', !analysis.looksScanned);

  titleInput.value = analysis.meta.title;
  authorInput.value = analysis.meta.author;

  tocSummary.textContent = `Capítulos detectados (${analysis.chapters.length})`;
  tocList.replaceChildren(
    ...analysis.chapters.map((chapter) => {
      const item = document.createElement('li');
      item.textContent = chapter.title;
      return item;
    }),
  );

  progressPanel.classList.add('hidden');
  resultPanel.classList.remove('hidden');
  downloadButton.disabled = analysis.chapters.length === 0;
  resultStatus.textContent =
    analysis.chapters.length === 0 ? 'Nenhum texto extraível encontrado.' : '';
}

/** @param {File} file */
async function handleFile(file) {
  if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    status.textContent = 'Isso não parece um PDF.';
    progressPanel.classList.remove('hidden');
    return;
  }

  revokeDownload();
  analysis = null;
  currentName = baseName(file.name);
  resultPanel.classList.add('hidden');
  progressPanel.classList.remove('hidden');
  bar.value = 0;
  status.textContent = 'Abrindo o PDF…';

  try {
    analysis = await analyzePdf(file, {
      onProgress: (done, total) => {
        bar.value = (done / total) * 100;
        status.textContent = `Extraindo texto — página ${done} de ${total}`;
      },
    });
    showResult();
  } catch (error) {
    progressPanel.classList.remove('hidden');
    status.textContent = `Falha ao ler o PDF: ${error instanceof Error ? error.message : error}`;
  }
}

async function download() {
  if (!analysis) return;

  downloadButton.disabled = true;
  resultStatus.textContent = 'Montando o EPUB…';

  try {
    const blob = await buildEpub(
      analysis.chapters,
      {
        title: titleInput.value.trim() || currentName,
        author: authorInput.value.trim(),
        language: languageSelect.value,
      },
      analysis.cover,
    );

    revokeDownload();
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${currentName}.epub`;
    link.click();

    const kb = Math.max(1, Math.round(blob.size / 1024));
    resultStatus.textContent = `Pronto — ${kb.toLocaleString('pt-BR')} KB.`;
  } catch (error) {
    resultStatus.textContent = `Falha ao gerar: ${error instanceof Error ? error.message : error}`;
  } finally {
    downloadButton.disabled = false;
  }
}

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

for (const type of ['dragenter', 'dragover']) {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
}

for (const type of ['dragleave', 'drop']) {
  dropZone.addEventListener(type, () => dropZone.classList.remove('dragging'));
}

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = /** @type {DragEvent} */ (event).dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

// Soltar o arquivo fora da zona não deve fazer o navegador abrir o PDF.
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());

downloadButton.addEventListener('click', download);

resetButton.addEventListener('click', () => {
  revokeDownload();
  analysis = null;
  fileInput.value = '';
  resultPanel.classList.add('hidden');
  progressPanel.classList.add('hidden');
});

/**
 * Escolha do título do livro a partir dos metadados do PDF.
 *
 * Módulo separado de propósito: assim dá pra testar a heurística sem carregar
 * o pdf.js junto.
 */

/**
 * Títulos que os geradores de PDF deixam para trás e não servem como nome do
 * livro: URLs, "sem título", e o caminho do arquivo de origem — o clássico
 * "Microsoft Word - versao_final_2.doc".
 */
const BOGUS_TITLE = [
  /^about:/i,
  /^https?:\/\//i,
  /^untitled\b/i,
  /^sem t[íi]tulo\b/i,
  /^(microsoft )?(word|powerpoint|excel|publisher)\b/i,
  /\.(docx?|pptx?|xlsx?|pdf|indd|pages|odt|tex|rtf)$/i,
];

/**
 * Aceita o título embutido no PDF só quando ele parece de verdade um título;
 * senão devolve o `fallback` (normalmente o nome do arquivo).
 *
 * @param {unknown} candidate
 * @param {string} fallback
 * @returns {string}
 */
export function pickTitle(candidate, fallback) {
  const title = typeof candidate === 'string' ? candidate.trim() : '';
  if (!title || BOGUS_TITLE.some((pattern) => pattern.test(title))) return fallback;
  return title;
}

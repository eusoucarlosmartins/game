/**
 * Monta um EPUB 3 a partir de capítulos já estruturados.
 *
 * Inclui `toc.ncx` além do `nav.xhtml` porque leitores antigos (Kindle via
 * conversão, ADE) ainda dependem do NCX pro sumário funcionar.
 */

import { makeZip } from './zip.js';

/**
 * @typedef {object} Block
 * @property {'h1' | 'h2' | 'p'} type
 * @property {string} text
 */

/**
 * @typedef {object} Chapter
 * @property {string} title
 * @property {Block[]} blocks
 */

/**
 * @typedef {object} EpubMeta
 * @property {string} title
 * @property {string} [author]
 * @property {string} [language]
 * @property {string} [identifier]
 * @property {string} [modified] ISO 8601 sem milissegundos
 */

/**
 * @typedef {object} Cover
 * @property {Uint8Array} data
 * @property {string} mime
 * @property {string} ext
 */

/** @param {string} value */
export function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Remove caracteres de controle que invalidam XML (aparecem em PDFs quebrados).
 * @param {string} value
 */
function sanitize(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

const STYLESHEET = `html { font-size: 100%; }
body {
  margin: 0 5%;
  line-height: 1.5;
  text-align: justify;
  hyphens: auto;
}
h1, h2 {
  text-align: left;
  line-height: 1.25;
  page-break-after: avoid;
  break-after: avoid;
}
h1 { font-size: 1.5em; margin: 1.6em 0 0.8em; }
h2 { font-size: 1.2em; margin: 1.4em 0 0.6em; }
p { margin: 0; text-indent: 1.2em; }
/* O primeiro parágrafo depois de um título não leva recuo. */
h1 + p, h2 + p { text-indent: 0; }
.cover { margin: 0; padding: 0; text-align: center; }
.cover img { max-width: 100%; max-height: 100%; }
`;

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

/**
 * @param {Chapter} chapter
 * @param {string} language
 */
function chapterXhtml(chapter, language) {
  const body = chapter.blocks
    .map((block) => `    <${block.type}>${escapeXml(sanitize(block.text))}</${block.type}>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
  <head>
    <title>${escapeXml(sanitize(chapter.title))}</title>
    <meta charset="utf-8"/>
    <link rel="stylesheet" type="text/css" href="../style.css"/>
  </head>
  <body>
${body}
  </body>
</html>
`;
}

/**
 * Gera um UUID v4. Usa `crypto.randomUUID` quando existe; senão, cai num
 * fallback baseado em `getRandomValues`.
 */
function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * @param {Chapter[]} chapters
 * @param {EpubMeta} meta
 * @param {Cover} [cover]
 * @returns {Promise<Blob>}
 */
export async function buildEpub(chapters, meta, cover) {
  const language = meta.language || 'pt-BR';
  const title = meta.title || 'Sem título';
  const identifier = meta.identifier || `urn:uuid:${uuid()}`;
  const modified = meta.modified || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const files = chapters.map((chapter, index) => ({
    id: `chap-${index + 1}`,
    href: `text/chap-${index + 1}.xhtml`,
    chapter,
  }));

  /** @type {import('./zip.js').ZipEntry[]} */
  const entries = [
    // Precisa ser a primeira entrada e sem compressão.
    { name: 'mimetype', data: 'application/epub+zip', store: true },
    { name: 'META-INF/container.xml', data: CONTAINER_XML },
    { name: 'OEBPS/style.css', data: STYLESHEET },
  ];

  const manifest = [
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '    <item id="css" href="style.css" media-type="text/css"/>',
  ];
  const spine = [];

  if (cover) {
    entries.push({ name: `OEBPS/images/cover.${cover.ext}`, data: cover.data });
    entries.push({
      name: 'OEBPS/cover.xhtml',
      data: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
  <head>
    <title>Capa</title>
    <meta charset="utf-8"/>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body class="cover">
    <img src="images/cover.${cover.ext}" alt="Capa"/>
  </body>
</html>
`,
    });
    manifest.push(
      `    <item id="cover-image" href="images/cover.${cover.ext}" media-type="${cover.mime}" properties="cover-image"/>`,
      '    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
    );
    spine.push('    <itemref idref="cover"/>');
  }

  for (const file of files) {
    entries.push({ name: `OEBPS/${file.href}`, data: chapterXhtml(file.chapter, language) });
    manifest.push(
      `    <item id="${file.id}" href="${file.href}" media-type="application/xhtml+xml"/>`,
    );
    spine.push(`    <itemref idref="${file.id}"/>`);
  }

  const navItems = files
    .map(
      (file) =>
        `        <li><a href="${file.href}">${escapeXml(sanitize(file.chapter.title))}</a></li>`,
    )
    .join('\n');

  entries.push({
    name: 'OEBPS/nav.xhtml',
    data: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
  <head>
    <title>Sumário</title>
    <meta charset="utf-8"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Sumário</h1>
      <ol>
${navItems}
      </ol>
    </nav>
  </body>
</html>
`,
  });

  const ncxItems = files
    .map(
      (file, index) => `    <navPoint id="nav-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(sanitize(file.chapter.title))}</text></navLabel>
      <content src="${file.href}"/>
    </navPoint>`,
    )
    .join('\n');

  entries.push({
    name: 'OEBPS/toc.ncx',
    data: `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(sanitize(title))}</text></docTitle>
  <navMap>
${ncxItems}
  </navMap>
</ncx>
`,
  });

  const author = meta.author?.trim();
  entries.push({
    name: 'OEBPS/content.opf',
    data: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(sanitize(title))}</dc:title>
    <dc:language>${escapeXml(language)}</dc:language>
${author ? `    <dc:creator id="creator">${escapeXml(sanitize(author))}</dc:creator>\n` : ''}    <meta property="dcterms:modified">${escapeXml(modified)}</meta>
${cover ? '    <meta name="cover" content="cover-image"/>\n' : ''}  </metadata>
  <manifest>
${manifest.join('\n')}
  </manifest>
  <spine toc="ncx">
${spine.join('\n')}
  </spine>
</package>
`,
  });

  return makeZip(entries);
}

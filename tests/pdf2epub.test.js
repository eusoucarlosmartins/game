import { describe, it, expect } from 'vitest';
import { inflateRawSync } from 'node:zlib';

import { crc32, makeZip } from '../src/pdf2epub/zip.js';
import { buildEpub, escapeXml } from '../src/pdf2epub/epub.js';
import { pickTitle } from '../src/pdf2epub/title.js';
import {
  groupLines,
  linesToBlocks,
  blocksToChapters,
  detectRunningHeads,
  normalizeItems,
  textDensity,
} from '../src/pdf2epub/extract.js';

/**
 * Lê um ZIP de volta pelo central directory — é assim que um leitor de EPUB
 * de verdade abre o arquivo, então serve como validação real do writer.
 *
 * @param {Uint8Array} bytes
 */
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // O EOCD fica no fim; varre de trás pra frente atrás da assinatura.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('EOCD não encontrado');

  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder();
  /** @type {{ name: string; method: number; data: Uint8Array; crc: number }[]} */
  const entries = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('header central inválido');
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compSize = view.getUint32(cursor + 20, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));

    // Salta o header local pra achar onde os dados começam.
    const localNameLen = view.getUint16(offset + 26, true);
    const localExtraLen = view.getUint16(offset + 28, true);
    const start = offset + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(start, start + compSize);

    entries.push({ name, method, crc, data: method === 8 ? inflateRawSync(raw) : raw });
    cursor += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/** @param {Blob} blob */
async function zipEntries(blob) {
  return readZip(new Uint8Array(await blob.arrayBuffer()));
}

/**
 * Atalho pra montar linhas nos testes.
 * @param {string} text
 * @param {object} opts
 * @param {number} opts.y
 * @param {number} [opts.x]
 * @param {number} [opts.size]
 * @param {number} [opts.endX]
 */
function line(text, { y, x = 50, size = 10, endX = 500 }) {
  return { text, x, endX, y, fontSize: size };
}

describe('zip', () => {
  it('calcula CRC-32 conforme a referência', () => {
    // Vetor canônico: crc32("123456789") === 0xCBF43926
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('escreve um arquivo legível pelo central directory', async () => {
    const blob = await makeZip([
      { name: 'a.txt', data: 'olá mundo' },
      { name: 'pasta/b.bin', data: new Uint8Array([1, 2, 3]) },
    ]);
    const entries = await zipEntries(blob);

    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'pasta/b.bin']);
    expect(new TextDecoder().decode(entries[0].data)).toBe('olá mundo');
    expect([...entries[1].data]).toEqual([1, 2, 3]);
    // O CRC gravado precisa bater com o conteúdo descomprimido.
    expect(entries[0].crc).toBe(crc32(new TextEncoder().encode('olá mundo')));
  });

  it('respeita `store` deixando a entrada sem compressão', async () => {
    const blob = await makeZip([{ name: 'mimetype', data: 'application/epub+zip', store: true }]);
    const [entry] = await zipEntries(blob);
    expect(entry.method).toBe(0);
  });
});

describe('groupLines', () => {
  it('junta fragmentos da mesma linha e separa linhas distintas', () => {
    const lines = groupLines([
      { str: 'Bom', x: 50, y: 700, width: 20, fontSize: 10 },
      { str: 'dia', x: 74, y: 700, width: 18, fontSize: 10 },
      { str: 'segunda linha', x: 50, y: 686, width: 70, fontSize: 10 },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('Bom dia');
    expect(lines[1].text).toBe('segunda linha');
  });

  it('ordena de cima pra baixo mesmo com itens fora de ordem', () => {
    const lines = groupLines([
      { str: 'baixo', x: 50, y: 100, width: 30, fontSize: 10 },
      { str: 'cima', x: 50, y: 700, width: 30, fontSize: 10 },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['cima', 'baixo']);
  });

  it('descarta itens vazios', () => {
    expect(groupLines([{ str: '   ', x: 0, y: 0, width: 0, fontSize: 10 }])).toEqual([]);
  });
});

describe('linesToBlocks', () => {
  it('detecta título, une parágrafo quebrado e desfaz hifenização', () => {
    const blocks = linesToBlocks([
      [
        line('MEU LIVRO', { y: 700, size: 20 }),
        line('Era uma vez uma pessoa que cami-', { y: 660, endX: 480 }),
        line('nhava pela estrada de terra.', { y: 646, endX: 300 }),
        line('12', { y: 50 }),
      ],
    ]);

    expect(blocks).toEqual([
      { type: 'h1', text: 'MEU LIVRO', page: 1 },
      { type: 'p', text: 'Era uma vez uma pessoa que caminhava pela estrada de terra.', page: 1 },
    ]);
  });

  it('separa parágrafos quando a linha anterior termina curta e pontuada', () => {
    const blocks = linesToBlocks([
      [
        line('Primeira frase que ocupa a largura toda', { y: 700, endX: 500 }),
        line('e termina aqui.', { y: 686, endX: 180 }),
        line('Novo parágrafo começa nesta linha', { y: 672, endX: 500 }),
        line('e continua normalmente', { y: 658, endX: 500 }),
      ],
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('Primeira frase que ocupa a largura toda e termina aqui.');
    expect(blocks[1].text).toBe('Novo parágrafo começa nesta linha e continua normalmente');
  });

  it('separa parágrafo por recuo de primeira linha', () => {
    const blocks = linesToBlocks([
      [
        line('linha um sem recuo', { y: 700 }),
        line('linha dois sem recuo', { y: 686 }),
        line('linha tres com recuo', { y: 672, x: 70 }),
      ],
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('linha um sem recuo linha dois sem recuo');
    expect(blocks[1].text).toBe('linha tres com recuo');
  });

  it('remove cabeçalho repetido e número de página, preservando o corpo', () => {
    // Corpo diferente a cada página, como num livro de verdade — só o
    // cabeçalho e o número se repetem.
    const corpo = [
      'o sertão virou mar e o mar virou sertão',
      'as águas desceram pela encosta ao amanhecer',
      'ninguém esperava aquela carta chegar tão cedo',
      'o trem apitou três vezes antes de partir',
      'a fábrica fechou as portas naquele inverno',
      'restava apenas o silêncio da praça vazia',
    ];
    const pages = corpo.map((texto, index) => [
      line('História do Brasil', { y: 750 }),
      line(texto, { y: 700 }),
      line('e a história seguiu seu curso.', { y: 686, endX: 200 }),
      line(String(index + 1), { y: 50 }),
    ]);

    const texts = linesToBlocks(pages).map((b) => b.text);

    expect(texts.some((t) => t.includes('História do Brasil'))).toBe(false);
    expect(texts.some((t) => /^\d+$/.test(t))).toBe(false);
    expect(texts.some((t) => t.includes('o trem apitou três vezes'))).toBe(true);
    expect(texts.some((t) => t.includes('a fábrica fechou as portas'))).toBe(true);
  });

  it('descarta cabeçalho em corpo menor mesmo sem repetição detectável', () => {
    // Documento curto demais pra estabelecer recorrência: sobra o sinal do
    // tamanho da fonte.
    const blocks = linesToBlocks([
      [
        line('O Vale do Carvão', { y: 780, size: 8 }),
        line('texto do corpo em tamanho normal', { y: 700, size: 12 }),
        line('seguindo na linha de baixo', { y: 684, size: 12 }),
        line('e fechando o parágrafo.', { y: 668, size: 12, endX: 200 }),
      ],
    ]);

    expect(blocks.map((b) => b.text)).toEqual([
      'texto do corpo em tamanho normal seguindo na linha de baixo e fechando o parágrafo.',
    ]);
  });

  it('preserva nota de rodapé longa, que também é miúda', () => {
    const nota =
      'Ver a respeito o levantamento completo publicado pelo instituto no ano seguinte, com dados por município.';
    const blocks = linesToBlocks([
      [
        line('corpo normal aqui', { y: 700, size: 12 }),
        line('mais corpo normal', { y: 684, size: 12 }),
        line('fim do parágrafo.', { y: 668, size: 12, endX: 200 }),
        line(nota, { y: 60, size: 8 }),
      ],
    ]);

    expect(blocks.some((b) => b.text.includes('instituto no ano seguinte'))).toBe(true);
  });
});

describe('detectRunningHeads', () => {
  it('trata variação de número como o mesmo cabeçalho', () => {
    const pages = Array.from({ length: 5 }, (_, index) => [
      line(`Capítulo 2 — página ${index + 10}`, { y: 750 }),
      line('corpo', { y: 700 }),
      line('corpo', { y: 686 }),
      line('corpo', { y: 672 }),
    ]);

    expect(detectRunningHeads(pages).has('capítulo # — página #')).toBe(true);
  });

  it('não marca nada em documentos curtos', () => {
    expect(detectRunningHeads([[line('a', { y: 1 })]]).size).toBe(0);
  });
});

describe('blocksToChapters', () => {
  it('corta um capítulo por h1', () => {
    const chapters = blocksToChapters([
      { type: 'h1', text: 'Um', page: 1 },
      { type: 'p', text: 'texto um', page: 1 },
      { type: 'h1', text: 'Dois', page: 2 },
      { type: 'p', text: 'texto dois', page: 2 },
    ]);

    expect(chapters.map((c) => c.title)).toEqual(['Um', 'Dois']);
    expect(chapters[0].blocks).toHaveLength(2);
  });

  it('guarda o conteúdo anterior ao primeiro título', () => {
    const chapters = blocksToChapters([
      { type: 'p', text: 'folha de rosto', page: 1 },
      { type: 'h1', text: 'Capítulo 1', page: 2 },
    ]);

    expect(chapters.map((c) => c.title)).toEqual(['Início', 'Capítulo 1']);
  });

  it('fatia por faixa de páginas quando não há títulos', () => {
    const blocks = Array.from({ length: 25 }, (_, index) => ({
      /** @type {'p'} */
      type: /** @type {const} */ ('p'),
      text: `parágrafo ${index}`,
      page: index + 1,
    }));

    const chapters = blocksToChapters(blocks, { fallbackTitle: 'Relatório', pagesPerChunk: 10 });

    expect(chapters).toHaveLength(3);
    expect(chapters[0].title).toBe('Relatório — páginas 1–10');
    expect(chapters[2].title).toBe('Relatório — páginas 21–30');
  });

  it('devolve vazio sem blocos', () => {
    expect(blocksToChapters([])).toEqual([]);
  });
});

describe('normalizeItems', () => {
  it('lê posição e corpo da fonte da matriz de transformação', () => {
    const [item] = normalizeItems([
      { str: 'oi', transform: [12, 0, 0, 12, 100, 700], width: 15, height: 12 },
    ]);

    expect(item).toMatchObject({ str: 'oi', x: 100, y: 700, width: 15 });
    expect(item.fontSize).toBeCloseTo(12);
  });

  it('ignora itens sem texto ou sem transform', () => {
    expect(normalizeItems([{ str: '' }, { transform: [1, 0, 0, 1, 0, 0] }])).toEqual([]);
  });
});

describe('textDensity', () => {
  it('fica baixa em PDF sem camada de texto', () => {
    expect(textDensity([[], [], []])).toBe(0);
  });

  it('mede a média de caracteres por página', () => {
    expect(textDensity([[line('abcde', { y: 1 })], [line('abcde', { y: 1 })]])).toBe(5);
  });
});

describe('pickTitle', () => {
  it('aceita um título de verdade', () => {
    expect(pickTitle('Grande Sertão: Veredas', 'arquivo')).toBe('Grande Sertão: Veredas');
  });

  it.each([
    ['about:blank'],
    ['https://exemplo.com/doc'],
    ['Untitled Document'],
    ['Sem título 1'],
    ['Microsoft Word - versao_final_2.doc'],
    ['relatorio-2025.pdf'],
    ['   '],
    [''],
  ])('rejeita o lixo %j e usa o fallback', (candidate) => {
    expect(pickTitle(candidate, 'meu-livro')).toBe('meu-livro');
  });

  it('rejeita valor ausente ou de outro tipo', () => {
    expect(pickTitle(undefined, 'meu-livro')).toBe('meu-livro');
    expect(pickTitle(42, 'meu-livro')).toBe('meu-livro');
  });

  it('não confunde um título que só menciona Word', () => {
    // A regra ancora no começo — "A Palavra..." não pode cair na peneira.
    expect(pickTitle('A Palavra e o Mundo', 'x')).toBe('A Palavra e o Mundo');
  });
});

describe('escapeXml', () => {
  it('escapa os cinco caracteres do XML', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;',
    );
  });
});

describe('buildEpub', () => {
  const chapters = [
    { title: 'Capítulo 1', blocks: [{ type: /** @type {const} */ ('h1'), text: 'Capítulo 1' }] },
    { title: 'Capítulo 2', blocks: [{ type: /** @type {const} */ ('p'), text: 'Conteúdo & cia' }] },
  ];

  it('põe o mimetype como primeira entrada e sem compressão', async () => {
    const entries = await zipEntries(await buildEpub(chapters, { title: 'Teste' }));

    expect(entries[0].name).toBe('mimetype');
    expect(entries[0].method).toBe(0);
    expect(new TextDecoder().decode(entries[0].data)).toBe('application/epub+zip');
  });

  it('inclui os arquivos obrigatórios de um EPUB 3', async () => {
    const names = (await zipEntries(await buildEpub(chapters, { title: 'Teste' }))).map(
      (e) => e.name,
    );

    expect(names).toEqual(
      expect.arrayContaining([
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/nav.xhtml',
        'OEBPS/toc.ncx',
        'OEBPS/style.css',
        'OEBPS/text/chap-1.xhtml',
        'OEBPS/text/chap-2.xhtml',
      ]),
    );
  });

  it('grava metadados e escapa o conteúdo', async () => {
    const entries = await zipEntries(
      await buildEpub(chapters, {
        title: 'Livro & Cia',
        author: 'Fulano',
        language: 'pt-BR',
        identifier: 'urn:uuid:fixo',
        modified: '2026-01-01T00:00:00Z',
      }),
    );
    const decoder = new TextDecoder();
    const opf = decoder.decode(entries.find((e) => e.name === 'OEBPS/content.opf').data);

    expect(opf).toContain('<dc:title>Livro &amp; Cia</dc:title>');
    expect(opf).toContain('<dc:creator id="creator">Fulano</dc:creator>');
    expect(opf).toContain('<dc:identifier id="pub-id">urn:uuid:fixo</dc:identifier>');
    expect(opf).toContain('<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>');

    const chapter = decoder.decode(entries.find((e) => e.name === 'OEBPS/text/chap-2.xhtml').data);
    expect(chapter).toContain('<p>Conteúdo &amp; cia</p>');
  });

  it('omite dc:creator quando não há autor', async () => {
    const entries = await zipEntries(await buildEpub(chapters, { title: 'Sem autor' }));
    const opf = new TextDecoder().decode(entries.find((e) => e.name === 'OEBPS/content.opf').data);
    expect(opf).not.toContain('dc:creator');
  });

  it('adiciona capa ao manifesto e à spine quando fornecida', async () => {
    const entries = await zipEntries(
      await buildEpub(
        chapters,
        { title: 'Com capa' },
        {
          data: new Uint8Array([0xff, 0xd8, 0xff]),
          mime: 'image/jpeg',
          ext: 'jpg',
        },
      ),
    );
    const names = entries.map((e) => e.name);
    expect(names).toContain('OEBPS/images/cover.jpg');
    expect(names).toContain('OEBPS/cover.xhtml');

    const opf = new TextDecoder().decode(entries.find((e) => e.name === 'OEBPS/content.opf').data);
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toContain('<itemref idref="cover"/>');
  });
});

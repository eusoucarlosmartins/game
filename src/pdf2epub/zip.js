/**
 * Escritor de ZIP mínimo (só o que o EPUB precisa).
 *
 * Um EPUB é um ZIP com duas regras chatas:
 *  1. a primeira entrada precisa ser `mimetype`, guardada SEM compressão;
 *  2. essa entrada não pode ter campos extras no header local.
 *
 * Nenhuma lib de zip generalista garante isso sem gambiarra, então escrevemos
 * os headers na mão. Suporta STORE (método 0) e DEFLATE (método 8, via
 * `CompressionStream` quando disponível).
 */

/** Data/hora DOS fixa (1980-01-01 00:00) — mantém o build determinístico. */
const DOS_DATE = 0x0021;
const DOS_TIME = 0x0000;

/** Bit 11 do general-purpose flag: nomes de arquivo em UTF-8. */
const FLAG_UTF8 = 0x0800;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * @param {Uint8Array} bytes
 * @returns {number} CRC-32 (unsigned)
 */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

/**
 * O TS 5.7 parametriza `Uint8Array` pelo tipo do buffer, e `BlobPart` só aceita
 * `ArrayBuffer` — nunca produzimos views sobre `SharedArrayBuffer` aqui, então
 * o cast é seguro e evita copiar os bytes só pra agradar o compilador.
 *
 * @param {Uint8Array[]} parts
 * @param {BlobPropertyBag} [options]
 */
function blobOf(parts, options) {
  return new Blob(/** @type {BlobPart[]} */ (/** @type {unknown} */ (parts)), options);
}

/**
 * @param {string | Uint8Array} data
 * @returns {Uint8Array}
 */
function toBytes(data) {
  return typeof data === 'string' ? encoder.encode(data) : data;
}

/**
 * Comprime com deflate cru (o que o método 8 do ZIP espera).
 * Cai pra STORE se o ambiente não tiver `CompressionStream` (ex.: happy-dom).
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array | null>} null = não deu, usa STORE
 */
async function deflateRaw(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = blobOf([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/** Escreve inteiros little-endian num buffer em crescimento. */
class ByteWriter {
  constructor() {
    /** @type {Uint8Array[]} */
    this.chunks = [];
    this.length = 0;
  }

  /** @param {Uint8Array} bytes */
  push(bytes) {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  /** @param {number} value */
  u16(value) {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  /** @param {number} value */
  u32(value) {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }
}

/**
 * @typedef {object} ZipEntry
 * @property {string} name caminho dentro do zip (sempre com `/`)
 * @property {string | Uint8Array} data
 * @property {boolean} [store] força STORE (sem compressão)
 */

/**
 * Monta o ZIP. A ordem das entradas é preservada — importante pro `mimetype`.
 *
 * @param {ZipEntry[]} entries
 * @returns {Promise<Blob>}
 */
export async function makeZip(entries) {
  const out = new ByteWriter();
  /** @type {{ name: Uint8Array; crc: number; comp: number; raw: number; method: number; offset: number }[]} */
  const central = [];

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const raw = toBytes(entry.data);
    const crc = crc32(raw);

    const deflated = entry.store ? null : await deflateRaw(raw);
    // Só vale comprimir se de fato encolheu.
    const useDeflate = deflated !== null && deflated.length < raw.length;
    const payload = useDeflate ? /** @type {Uint8Array} */ (deflated) : raw;
    const method = useDeflate ? 8 : 0;
    // `mimetype` precisa de flags zeradas; o resto marca UTF-8.
    const flags = entry.store ? 0 : FLAG_UTF8;

    central.push({
      name: nameBytes,
      crc,
      comp: payload.length,
      raw: raw.length,
      method,
      offset: out.length,
    });

    out.u32(0x04034b50); // assinatura do local file header
    out.u16(method === 8 ? 20 : 10); // versão necessária
    out.u16(flags);
    out.u16(method);
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(crc);
    out.u32(payload.length);
    out.u32(raw.length);
    out.u16(nameBytes.length);
    out.u16(0); // sem campos extras
    out.push(nameBytes);
    out.push(payload);
  }

  const centralOffset = out.length;
  for (const item of central) {
    out.u32(0x02014b50); // assinatura do central directory header
    out.u16(20); // versão que criou
    out.u16(item.method === 8 ? 20 : 10);
    out.u16(item.method === 8 ? FLAG_UTF8 : 0);
    out.u16(item.method);
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(item.crc);
    out.u32(item.comp);
    out.u32(item.raw);
    out.u16(item.name.length);
    out.u16(0); // extra
    out.u16(0); // comentário
    out.u16(0); // disco inicial
    out.u16(0); // atributos internos
    out.u32(0); // atributos externos
    out.u32(item.offset);
    out.push(item.name);
  }

  const centralSize = out.length - centralOffset;
  out.u32(0x06054b50); // assinatura do end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(central.length);
  out.u16(central.length);
  out.u32(centralSize);
  out.u32(centralOffset);
  out.u16(0); // comentário do arquivo

  return blobOf(out.chunks, { type: 'application/epub+zip' });
}

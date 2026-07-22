/**
 * Constructor de ZIP "stored" (sin compresión), sin dependencias.
 *
 * Los PNG ya vienen comprimidos, así que almacenar (método 0) da un archivo
 * válido y liviano sin necesidad de traer jszip/archiver. Suficiente para el
 * botón "Descargar ZIP" del panel de carruseles.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_TIME = 0;
const DOS_DATE = 0x21; // 1980-01-01, fecha fija (no exponemos hora real)

/**
 * @param {{name: string, data: Buffer|Uint8Array}[]} files
 * @returns {Buffer} contenido del ZIP
 */
export function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);
    const size = data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // firma local file header
    local.writeUInt16LE(20, 4);         // versión necesaria
    local.writeUInt16LE(0x0800, 6);     // flags: nombre en UTF-8
    local.writeUInt16LE(0, 8);          // método: store
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);      // tamaño comprimido
    local.writeUInt32LE(size, 22);      // tamaño sin comprimir
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);         // longitud de extra
    localParts.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // firma central dir header
    central.writeUInt16LE(20, 4);         // versión creadora
    central.writeUInt16LE(20, 6);         // versión necesaria
    central.writeUInt16LE(0x0800, 8);     // flags
    central.writeUInt16LE(0, 10);         // método
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);         // extra
    central.writeUInt16LE(0, 32);         // comentario
    central.writeUInt16LE(0, 34);         // disco
    central.writeUInt16LE(0, 36);         // atributos internos
    central.writeUInt32LE(0, 38);         // atributos externos
    central.writeUInt32LE(offset, 42);    // offset del local header
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);        // firma end of central dir
  end.writeUInt16LE(0, 4);                 // disco
  end.writeUInt16LE(0, 6);                 // disco con central dir
  end.writeUInt16LE(files.length, 8);      // entradas en este disco
  end.writeUInt16LE(files.length, 10);     // entradas totales
  end.writeUInt32LE(centralBuf.length, 12); // tamaño central dir
  end.writeUInt32LE(offset, 16);           // offset central dir
  end.writeUInt16LE(0, 20);                // comentario

  return Buffer.concat([...localParts, centralBuf, end]);
}

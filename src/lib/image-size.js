/**
 * Lector de dimensiones para PNG y JPEG, sin dependencias.
 * Suficiente para validar el ancho mínimo de las fotos de carrusel (>=1080px)
 * sin traer sharp/image-size. Devuelve { width, height, type } o null.
 */
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function imageDimensions(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);

  // PNG: IHDR va justo tras la firma; width/height son uint32 big-endian en 16/20.
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIG)) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: "png" };
  }

  // JPEG: recorrer segmentos hasta el marcador SOF (Start Of Frame).
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 1) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buf[offset + 1];
      // Bytes de relleno 0xFF
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      // Marcadores sin longitud (SOI, EOI, TEM, RSTn)
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      // SOF0..SOF15, excepto DHT(0xc4), JPG(0xc8) y DAC(0xcc)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        if (offset + 9 > buf.length) break;
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
          type: "jpeg",
        };
      }
      if (offset + 4 > buf.length) break;
      const len = buf.readUInt16BE(offset + 2);
      if (len < 2) break;
      offset += 2 + len;
    }
  }

  return null;
}

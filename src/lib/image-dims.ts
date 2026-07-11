// Leitor mínimo de dimensões de imagem (JPEG/PNG) direto do buffer — puro, sem lib.
// Usado no servidor de PDF para dimensionar cada foto na proporção real (evita o
// recorte do @react-pdf quando a moldura tem altura fixa).

export interface DimensoesImagem {
  larguraPx: number;
  alturaPx: number;
}

/** Devolve {larguraPx, alturaPx} de um JPEG ou PNG, ou null se não reconhecer. */
export function dimensoesImagem(buf: Uint8Array): DimensoesImagem | null {
  if (!buf || buf.length < 24) return null;

  // PNG: assinatura + IHDR com width/height big-endian nos bytes 16..23
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const larguraPx = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
    const alturaPx = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
    return larguraPx > 0 && alturaPx > 0 ? { larguraPx, alturaPx } : null;
  }

  // JPEG: percorre marcadores até um SOF (Start Of Frame), que carrega as dimensões
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      // Marcadores sem payload (SOI/EOI/RSTn/TEM): avança 2 bytes
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      // SOF0..SOF15 (exceto DHT=C4, JPG=C8, DAC=CC): dimensões após precisão
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const alturaPx = (buf[i + 5] << 8) | buf[i + 6];
        const larguraPx = (buf[i + 7] << 8) | buf[i + 8];
        return larguraPx > 0 && alturaPx > 0 ? { larguraPx, alturaPx } : null;
      }
      // Demais segmentos têm length (2 bytes) em i+2 — pula o segmento inteiro
      const len = (buf[i + 2] << 8) | buf[i + 3];
      if (len < 2) return null;
      i += 2 + len;
    }
  }

  return null;
}

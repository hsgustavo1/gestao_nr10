import { describe, expect, test } from "vitest";
import { dimensoesImagem } from "../image-dims";

// PNG: assinatura (8) + [len=13] + "IHDR" + width(4) + height(4) + resto
function pngFake(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // assinatura
  b.set([0x00, 0x00, 0x00, 0x0d], 8); // length do IHDR
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  b.set([(w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255], 16);
  b.set([(h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255], 20);
  return b;
}

// JPEG: FFD8 + SOF0 (FFC0) com precisão(1) altura(2) largura(2)
function jpegFake(w: number, h: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  b.set([(h >>> 8) & 255, h & 255, (w >>> 8) & 255, w & 255], 7);
  return b;
}

describe("dimensoesImagem", () => {
  test("lê dimensões de PNG (IHDR)", () => {
    expect(dimensoesImagem(pngFake(40, 25))).toEqual({ larguraPx: 40, alturaPx: 25 });
  });

  test("lê dimensões de JPEG (SOF0)", () => {
    expect(dimensoesImagem(jpegFake(60, 30))).toEqual({ larguraPx: 60, alturaPx: 30 });
  });

  test("pula segmentos APPn antes do SOF no JPEG", () => {
    // FFD8 + APP0 (len 4: 00 04 + 2 bytes) + SOF0
    const b = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0xaa, 0xbb, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c,
      0x00, 0xc8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    // altura 0x012c=300, largura 0x00c8=200
    expect(dimensoesImagem(b)).toEqual({ larguraPx: 200, alturaPx: 300 });
  });

  test("devolve null para buffer curto ou formato desconhecido", () => {
    expect(dimensoesImagem(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(dimensoesImagem(new Uint8Array(30))).toBeNull();
  });
});

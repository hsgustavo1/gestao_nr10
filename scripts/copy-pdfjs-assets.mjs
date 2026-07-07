// Copia os decoders WASM do pdf.js (jbig2/openjpeg/qcms/quickjs) de node_modules
// para public/pdfjs/wasm, para serem servidos em runtime (dev e build).
//
// Por que: PDFs de certificados escaneados usam compressão JBIG2 na camada de
// texto. O pdf.js v6 só decodifica JBIG2/JPEG2000 via WASM; sem esses arquivos
// servidos + `wasmUrl` apontado (ver admin.certificados.importar.tsx), o pdf.js
// descarta silenciosamente essas imagens — o nome do participante some da página
// renderizada e a leitura por IA lê o texto errado (ex.: o assinante do rodapé).
//
// Não commitamos os binários (public/pdfjs está no .gitignore) — este script roda
// no postinstall/predev/prebuild e mantém sincronia com a versão do pdfjs-dist.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/pdfjs-dist/wasm");
const dest = resolve(root, "public/pdfjs/wasm");

if (!existsSync(src)) {
  console.warn(`[copy-pdfjs-assets] Origem não encontrada: ${src} — pdfjs-dist instalado?`);
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-pdfjs-assets] wasm do pdf.js copiado para ${dest}`);

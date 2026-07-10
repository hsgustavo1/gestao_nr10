import { Font } from "@react-pdf/renderer";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HANKEN_400, HANKEN_600, HANKEN_800 } from "./fonts-data";

// Este módulo é usado SÓ no servidor (o PDF do RTI é gerado server-side — D-C7).
// Registra a Hanken Grotesk a partir dos bytes embarcados (fonts-data.ts), escritos
// em arquivos temporários — o caminho mais confiável no runtime Node do Vercel, sem
// depender de resolução de `?url` (Vite) nem de CDN externo em runtime.

let registered = false;

function escreveFonte(nome: string, b64: string): string {
  const dir = join(tmpdir(), "conforme-fonts");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = join(dir, nome);
  if (!existsSync(p)) writeFileSync(p, Buffer.from(b64, "base64"));
  return p;
}

/** Registra a Hanken Grotesk no @react-pdf uma única vez (idempotente). */
export function registerPdfFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Hanken Grotesk",
    fonts: [
      { src: escreveFonte("hanken-400.woff", HANKEN_400), fontWeight: 400 },
      { src: escreveFonte("hanken-600.woff", HANKEN_600), fontWeight: 600 },
      { src: escreveFonte("hanken-800.woff", HANKEN_800), fontWeight: 800 },
    ],
  });
  // Hifenização desligada: português fica melhor com quebra por palavra.
  Font.registerHyphenationCallback((word) => [word]);
}

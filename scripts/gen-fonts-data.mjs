// Gera src/components/rti/pdf/fonts-data.ts com a Hanken Grotesk (WOFF) embarcada em
// base64, para o render server-side do PDF do RTI não depender de CDN em runtime.
// Uso: node scripts/gen-fonts-data.mjs
import { readFileSync, writeFileSync } from "node:fs";

const dir = "node_modules/@fontsource/hanken-grotesk/files/";
const b64 = (peso) =>
  readFileSync(`${dir}hanken-grotesk-latin-${peso}-normal.woff`).toString("base64");

const out =
  "// GERADO automaticamente por scripts/gen-fonts-data.mjs — não editar à mão.\n" +
  "// Hanken Grotesk WOFF em base64, embarcada para o render server-side do PDF do RTI\n" +
  "// (sem dependência de CDN em runtime). Regenerar: node scripts/gen-fonts-data.mjs\n" +
  `export const HANKEN_400 = "${b64("400")}";\n` +
  `export const HANKEN_600 = "${b64("600")}";\n` +
  `export const HANKEN_800 = "${b64("800")}";\n`;

writeFileSync("src/components/rti/pdf/fonts-data.ts", out);
console.log(`fonts-data.ts gerado (${(out.length / 1024).toFixed(1)} KB).`);

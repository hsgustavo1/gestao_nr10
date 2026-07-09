import { Font } from "@react-pdf/renderer";
import hk400 from "@fontsource/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff?url";
import hk600 from "@fontsource/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff?url";
import hk800 from "@fontsource/hanken-grotesk/files/hanken-grotesk-latin-800-normal.woff?url";

let registered = false;

/** Registra a Hanken Grotesk no @react-pdf uma única vez (idempotente). */
export function registerPdfFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Hanken Grotesk",
    fonts: [
      { src: hk400, fontWeight: 400 },
      { src: hk600, fontWeight: 600 },
      { src: hk800, fontWeight: 800 },
    ],
  });
  // Hifenização desligada: português fica melhor com quebra por palavra.
  Font.registerHyphenationCallback((word) => [word]);
}

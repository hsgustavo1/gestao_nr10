import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "../public/icons/icon.svg");
const svg = readFileSync(svgPath, "utf8");

for (const size of [192, 512]) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  const png = resvg.render().asPng();
  const out = join(__dirname, `../public/icons/icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ icon-${size}.png`);
}

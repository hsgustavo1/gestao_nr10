import type { NbrRef } from "./types";

// NBRs frequentemente citadas em RTI de instalações elétricas.
// APENAS número/item + rótulo — o texto da norma é protegido (ABNT).
export const NBR_REFS: NbrRef[] = [
  { norma: "NBR 5410", item: "", descricao: "Instalações elétricas de baixa tensão" },
  { norma: "NBR 5410", item: "6.1.8.1", descricao: "Proteção contra choques — seccionamento" },
  { norma: "NBR 14039", item: "", descricao: "Instalações elétricas de média tensão (1,0 kV a 36,2 kV)" },
  { norma: "NBR 5419", item: "", descricao: "Proteção contra descargas atmosféricas (SPDA)" },
  { norma: "NBR IEC 60947", item: "", descricao: "Dispositivos de manobra e comando de baixa tensão" },
];

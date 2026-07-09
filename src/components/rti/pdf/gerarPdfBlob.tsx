import { pdf } from "@react-pdf/renderer";
import type { PdfModel } from "@/lib/rti-relatorio";
import { RtiPdfDocument } from "./RtiPdfDocument";

/** Renderiza o documento no navegador e devolve o Blob final (emissão — D-C2b). */
export async function gerarPdfBlob(model: PdfModel): Promise<Blob> {
  return pdf(<RtiPdfDocument model={model} />).toBlob();
}

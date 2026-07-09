import { PDFViewer } from "@react-pdf/renderer";
import type { PdfModel } from "@/lib/rti-relatorio";
import { RtiPdfDocument } from "./RtiPdfDocument";

// Default export para React.lazy — este módulo só carrega no client (etapa 4).
export default function PdfPreview({ model }: { model: PdfModel }) {
  return (
    <PDFViewer className="h-[75vh] w-full rounded-md border" showToolbar>
      <RtiPdfDocument model={model} />
    </PDFViewer>
  );
}

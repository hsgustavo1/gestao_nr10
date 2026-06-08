import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/nr10/")({
  component: NR10Page,
  head: () => ({ meta: [{ title: "NR-10 — Gestão NR-10" }] }),
});

function NR10Page() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">NR-10</h1>
        <p className="text-muted-foreground max-w-sm">
          Módulo em construção. Em breve: documentos, procedimentos e conformidade NR-10.
        </p>
      </div>
    </PageShell>
  );
}

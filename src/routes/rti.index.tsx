import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/rti/")({
  component: RTIPage,
  head: () => ({ meta: [{ title: "RTI — Gestão NR-10" }] }),
});

function RTIPage() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">RTI</h1>
        <p className="text-muted-foreground max-w-sm">
          Módulo em construção. Em breve: Relatórios de Teste de Isolamento.
        </p>
      </div>
    </PageShell>
  );
}

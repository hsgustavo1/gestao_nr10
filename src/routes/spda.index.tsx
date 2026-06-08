import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/spda/")({
  component: SPDAPage,
  head: () => ({ meta: [{ title: "SPDA — Gestão NR-10" }] }),
});

function SPDAPage() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <Zap className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">SPDA</h1>
        <p className="text-muted-foreground max-w-sm">
          Módulo em construção. Em breve: Sistema de Proteção contra Descargas Atmosféricas.
        </p>
      </div>
    </PageShell>
  );
}

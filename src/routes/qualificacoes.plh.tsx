import { createFileRoute } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/qualificacoes/plh")({
  component: PLHPage,
  head: () => ({ meta: [{ title: "PLH — Pessoas" }] }),
});

function PLHPage() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <BookMarked className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">PLH</h1>
        <p className="text-muted-foreground max-w-sm">Módulo em construção.</p>
      </div>
    </PageShell>
  );
}

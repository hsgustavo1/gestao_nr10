import { createFileRoute } from "@tanstack/react-router";
import { Thermometer } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/termografias/")({
  component: TermografiasPage,
  head: () => ({ meta: [{ title: "Termografias — Gestão NR-10" }] }),
});

function TermografiasPage() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <Thermometer className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Termografias</h1>
        <p className="text-muted-foreground max-w-sm">
          Módulo em construção. Em breve: registro e acompanhamento de inspeções termográficas.
        </p>
      </div>
    </PageShell>
  );
}

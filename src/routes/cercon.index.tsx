import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/cercon/")({
  component: CerconPage,
  head: () => ({ meta: [{ title: "Cercon — Gestão NR-10" }] }),
});

function CerconPage() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Cercon</h1>
        <p className="text-muted-foreground max-w-sm">
          Módulo em construção. Em breve: gestão de certificações e conformidade.
        </p>
      </div>
    </PageShell>
  );
}

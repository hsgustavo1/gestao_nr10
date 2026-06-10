import { createFileRoute } from "@tanstack/react-router";
import { InspecoesPage } from "@/components/inspecoes-page";

export const Route = createFileRoute("/termografias/")({
  component: TermografiasPage,
  head: () => ({ meta: [{ title: "Termografias — Gestão NR-10" }] }),
});

function TermografiasPage() {
  return <InspecoesPage type="termografia" />;
}

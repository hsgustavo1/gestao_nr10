import { createFileRoute } from "@tanstack/react-router";
import { InspecoesPage } from "@/components/inspecoes-page";

export const Route = createFileRoute("/cercon/")({
  component: CerconPage,
  head: () => ({ meta: [{ title: "Cercon — Gestão NR-10" }] }),
});

function CerconPage() {
  return <InspecoesPage type="cercon" />;
}

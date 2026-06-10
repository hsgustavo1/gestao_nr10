import { createFileRoute } from "@tanstack/react-router";
import { InspecoesPage } from "@/components/inspecoes-page";

export const Route = createFileRoute("/spda/")({
  component: SPDAPage,
  head: () => ({ meta: [{ title: "SPDA — Gestão NR-10" }] }),
});

function SPDAPage() {
  return <InspecoesPage type="spda" />;
}

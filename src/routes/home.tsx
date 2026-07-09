import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, CheckCircle2, FileCheck2, Gauge, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useComplianceReport } from "@/lib/conformidade";
import { cardsPendencias, type Severidade } from "@/lib/home-cliente";
import { useAllRtiNcs } from "@/lib/rti-queries";
import { useVencimentos } from "@/lib/vencimentos";
import { formatDatePtBR } from "@/lib/qualificacoes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/home")({
  component: HomeClientePage,
  head: () => ({ meta: [{ title: "Início — Conforme." }] }),
});

const SEV_CLASSES: Record<Severidade, string> = {
  critico: "text-destructive",
  atencao: "text-warning",
  ok: "text-primary",
};

function HomeClientePage() {
  const auth = useAuth();
  const { report, isLoading: loadingReport } = useComplianceReport();
  const vencimentos = useVencimentos(90);
  const ncs = useAllRtiNcs();

  const entregas = useQuery({
    queryKey: ["home_ultimas_entregas", auth.currentOrgId],
    enabled: !!auth.currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rti_reports")
        .select("id, titulo, entregue_em")
        .not("entregue_em", "is", null)
        .order("entregue_em", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as { id: string; titulo: string; entregue_em: string }[];
    },
  });

  const cards = useMemo(
    () =>
      cardsPendencias({
        vencimentos: vencimentos.items,
        ncs: (ncs.data ?? []).map((n) => ({
          prioridade: n.prioridade,
          status: n.status,
          prazo: n.prazo,
        })),
        hoje: new Date(),
      }),
    [vencimentos.items, ncs.data],
  );

  const carregando = loadingReport || vencimentos.isLoading || ncs.isLoading;

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">
            {auth.currentOrg?.nome ? `Olá, ${auth.currentOrg.nome}` : "Início"}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Sua conformidade NR-10 em um olhar — cada card leva direto à resolução.
          </p>
        </div>

        {carregando ? (
          <div className="flex items-center gap-2 p-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando sua situação…
          </div>
        ) : (
          <>
            {/* Índice de conformidade */}
            <Card className="overflow-hidden">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#34D399] to-[#059669] text-white shadow-brand">
                    <Gauge className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Índice de conformidade</p>
                    <p className="text-3xl font-bold">
                      {report ? `${report.overall}%` : "—"}
                    </p>
                  </div>
                </div>
                <Link
                  to="/relatorio"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Ver relatório completo <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            {/* Cards de pendência acionáveis */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <Link key={c.id} to={c.to} className="group block">
                  <Card className="h-full transition-shadow hover:shadow-card-soft">
                    <CardContent className="p-5">
                      <p className={cn("text-3xl font-bold", SEV_CLASSES[c.severidade])}>
                        {c.severidade === "ok" ? (
                          <CheckCircle2 className="h-8 w-8" />
                        ) : (
                          c.quantidade
                        )}
                      </p>
                      <p className="mt-2 font-semibold group-hover:text-primary">{c.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.descricao}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Últimas entregas */}
            <Card>
              <CardContent className="p-5">
                <p className="mb-3 flex items-center gap-2 font-semibold">
                  <FileCheck2 className="h-4 w-4 text-primary" /> Últimas entregas do consultor
                </p>
                {(entregas.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma entrega ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {entregas.data!.map((e) => (
                      <Link
                        key={e.id}
                        to="/rti/plano"
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <span>{e.titulo}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDatePtBR(e.entregue_em.slice(0, 10))}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}

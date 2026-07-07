import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GraduationCap, FileCheck2, FileText, Users, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTurmas,
  useNR10Trainings,
  useCertificateTrainingIds,
} from "@/lib/qualificacoes-queries";
import { turmaCompleteness } from "@/lib/turmas";
import { TRAINING_LABELS, formatDatePtBR } from "@/lib/qualificacoes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/qualificacoes/turmas")({
  component: TurmasPage,
  head: () => ({ meta: [{ title: "Turmas de treinamento — NR-10" }] }),
});

type Filtro = "todas" | "sem_art" | "cert_faltando";

function TurmasPage() {
  const { data: turmas = [], isLoading: loadingTurmas } = useTurmas();
  const { data: trainings = [] } = useNR10Trainings();
  const { data: comCert = new Set<string>() } = useCertificateTrainingIds();
  const [filtro, setFiltro] = useState<Filtro>("todas");

  // turma_id -> ids das participações (nr10_trainings) daquela turma.
  const participantesPorTurma = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of trainings) {
      if (!t.turma_id) continue;
      const arr = m.get(t.turma_id) ?? [];
      arr.push(t.id);
      m.set(t.turma_id, arr);
    }
    return m;
  }, [trainings]);

  const linhas = useMemo(
    () =>
      turmas.map((turma) => ({
        turma,
        c: turmaCompleteness(turma, participantesPorTurma.get(turma.id) ?? [], comCert),
      })),
    [turmas, participantesPorTurma, comCert],
  );

  const visiveis = useMemo(() => {
    if (filtro === "sem_art") return linhas.filter((l) => !l.c.hasArt);
    if (filtro === "cert_faltando") return linhas.filter((l) => !l.c.complete);
    return linhas;
  }, [linhas, filtro]);

  const filtros: { key: Filtro; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "sem_art", label: "Sem ART" },
    { key: "cert_faltando", label: "Certificados faltando" },
  ];

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Turmas de treinamento</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filtro === f.key ? "default" : "outline"}
            onClick={() => setFiltro(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loadingTurmas ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma turma para este filtro.
        </p>
      ) : (
        <div className="space-y-2">
          {visiveis.map(({ turma, c }) => (
            <Card key={turma.id} className={cn(c.complete && "border-emerald-200")}>
              <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {TRAINING_LABELS[turma.training_type]}
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {turma.category}
                    </Badge>
                    {c.complete && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Turma completa" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {turma.data ? formatDatePtBR(turma.data) : "sem data"}
                    {turma.instrutor ? ` · ${turma.instrutor}` : ""}
                  </p>
                </div>

                {/* Selo ART — neutro (ART é opcional, nem toda empresa usa) */}
                <div
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  title="ART é opcional"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {turma.art ? `ART ${turma.art}` : "sem ART"}
                </div>

                {/* Selo certificados */}
                <div className="flex items-center gap-1.5 text-xs">
                  <FileCheck2
                    className={cn(
                      "h-3.5 w-3.5",
                      c.complete ? "text-emerald-500" : "text-amber-500",
                    )}
                  />
                  <span className={cn(!c.complete && "text-amber-600")}>
                    {c.certs}/{c.total} certificados
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {c.total} participante{c.total !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

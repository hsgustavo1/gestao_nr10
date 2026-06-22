import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { BadgeCheck, CircleAlert, IdCard, Printer, ShieldX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  TRAINING_LABELS,
  TRAINING_TYPES,
  formatDatePtBR,
  trainingExpiryStatus,
  type Employee,
  type NR10Training,
  type TrainingType,
  type WorkAuthorization,
} from "@/lib/qualificacoes";
import { asoStatus, type ASO } from "@/lib/asos";
import { computeAptidao } from "@/lib/aptidao";

export const Route = createFileRoute("/carteirinha/$matricula")({
  component: CarteirinhaPage,
  head: () => ({
    meta: [
      { title: "Carteirinha Digital — Gestão NR-10" },
      {
        name: "description",
        content: "Verificação pública de autorização e capacitações NR-10 do eletricista.",
      },
    ],
  }),
});

type CarteirinhaData = {
  employee: Employee;
  authorization: WorkAuthorization | null;
  trainings: NR10Training[];
  aso: ASO | null;
};

function useCarteirinha(matricula: string) {
  return useQuery({
    queryKey: ["carteirinha", matricula],
    queryFn: async (): Promise<CarteirinhaData | null> => {
      const { data: employee, error } = await supabase
        .from("employees")
        .select("*")
        .eq("matricula", matricula)
        .maybeSingle();
      if (error) throw error;
      if (!employee) return null;

      const [authRes, trainRes, asoRes] = await Promise.all([
        supabase
          .from("work_authorizations")
          .select("*")
          .eq("employee_id", employee.id)
          .eq("is_current", true)
          .maybeSingle(),
        supabase.from("nr10_trainings").select("*").eq("employee_id", employee.id),
        supabase
          .from("asos")
          .select("*")
          .eq("employee_id", employee.id)
          .order("exam_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        employee: employee as unknown as Employee,
        authorization: (authRes.data as unknown as WorkAuthorization) ?? null,
        trainings: (trainRes.data ?? []) as unknown as NR10Training[],
        aso: (asoRes.data as unknown as ASO) ?? null,
      };
    },
  });
}

/** Data mais recente (formação ou reciclagem) por tipo de treinamento. */
function latestTrainingDate(trainings: NR10Training[], type: TrainingType): string | null {
  let latest: string | null = null;
  for (const t of trainings) {
    if (t.training_type !== type || !t.training_date) continue;
    if (!latest || t.training_date > latest) latest = t.training_date;
  }
  return latest;
}

function CarteirinhaPage() {
  const { matricula } = Route.useParams();
  const { data, isLoading } = useCarteirinha(matricula);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/carteirinha/${matricula}`;
    QRCode.toDataURL(url, { width: 180, margin: 1, color: { dark: "#0C3326" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [matricula]);

  const summary = useMemo(() => {
    if (!data) return null;
    const rows = TRAINING_TYPES.map((type) => {
      const date = latestTrainingDate(data.trainings, type);
      return { type, date, status: trainingExpiryStatus(date) };
    }).filter((r) => r.date !== null || r.type === "nr10_basico");
    // Motor de aptidão: autorização vigente + NR-10 Básico válido + ASO válido
    // + nenhuma reciclagem extraordinária pendente (NR-10 10.8).
    const aptidao = computeAptidao({
      employee: data.employee,
      trainings: data.trainings,
      authorization: data.authorization,
      aso: data.aso,
    });
    const asoSt = asoStatus(data.aso);
    return { rows, aptidao, asoSt };
  }, [data]);

  return (
    <PageShell>
      <div className="mx-auto max-w-md">
        {isLoading && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24" />
              <Skeleton className="h-32" />
            </CardContent>
          </Card>
        )}

        {!isLoading && !data && (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <ShieldX className="h-10 w-10 mx-auto text-destructive" />
              <h1 className="text-lg font-bold">Matrícula não encontrada</h1>
              <p className="text-sm text-muted-foreground">
                Não há colaborador cadastrado com a matrícula <strong>{matricula}</strong>.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && data && summary && (
          <>
            <div className="flex items-center justify-between mb-3 print:hidden">
              <h1 className="text-lg font-bold flex items-center gap-2">
                <IdCard className="h-5 w-5 text-primary" /> Carteirinha Digital NR-10
              </h1>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>

            <Card className="overflow-hidden">
              {/* Banner de situação (motor de aptidão) */}
              <div
                className={`px-5 py-3 flex items-center gap-2 text-white ${summary.aptidao.apto ? "bg-emerald-600" : "bg-red-600"}`}
              >
                {summary.aptidao.apto ? (
                  <BadgeCheck className="h-6 w-6" />
                ) : (
                  <CircleAlert className="h-6 w-6" />
                )}
                <div className="leading-tight">
                  <div className="font-bold text-base">
                    {summary.aptidao.apto ? "APTO" : "NÃO APTO PARA TRABALHO EM ELETRICIDADE"}
                  </div>
                  <div className="text-[11px] opacity-90">
                    {summary.aptidao.apto
                      ? "Autorização, capacitação e ASO em dia"
                      : summary.aptidao.bloqueantes.map((b) => b.label).join(" · ")}
                  </div>
                </div>
              </div>

              <CardContent className="p-5 space-y-4">
                {/* Identificação */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold leading-tight">{data.employee.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Matrícula {data.employee.matricula}
                      {data.employee.setor && <> · {data.employee.setor}</>}
                    </div>
                    {data.employee.funcao && (
                      <div className="text-sm text-muted-foreground">{data.employee.funcao}</div>
                    )}
                  </div>
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR code da carteirinha"
                      className="h-20 w-20 shrink-0"
                    />
                  )}
                </div>

                {/* Autorização */}
                <div className="rounded-md border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Autorização de trabalho (NR-10)
                  </div>
                  {data.authorization ? (
                    <div className="mt-1 flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-2xl font-bold">{data.authorization.level}</span>
                        {data.authorization.funcao && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            {data.authorization.funcao}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-sm font-semibold ${data.authorization.valid ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {data.authorization.valid ? "VÁLIDA" : "INVÁLIDA"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          desde {formatDatePtBR(data.authorization.authorization_date)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-red-600 font-semibold">
                      Sem autorização cadastrada
                    </div>
                  )}
                </div>

                {/* Capacitações */}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Capacitações NR-10 (validade 2 anos)
                  </div>
                  {TRAINING_TYPES.map((type) => {
                    const date = latestTrainingDate(data.trainings, type);
                    if (!date && type !== "nr10_basico") return null;
                    const status = trainingExpiryStatus(date);
                    const cls =
                      status === "ok"
                        ? "text-emerald-600"
                        : status === "expiring"
                          ? "text-amber-600"
                          : "text-red-600";
                    const label =
                      status === "ok"
                        ? "Em dia"
                        : status === "expiring"
                          ? "Vencendo"
                          : status === "expired"
                            ? "Vencido"
                            : "Não realizado";
                    return (
                      <div key={type} className="flex items-center justify-between gap-2 text-sm">
                        <span>{TRAINING_LABELS[type]}</span>
                        <span className="text-right whitespace-nowrap">
                          <span className={`font-semibold ${cls}`}>{label}</span>
                          {date && (
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              {formatDatePtBR(date)}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* ASO (saúde ocupacional) */}
                <div className="rounded-md border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    ASO — Saúde Ocupacional (NR-10 10.8.7)
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                    <span
                      className={`font-semibold ${
                        summary.asoSt === "ok"
                          ? "text-emerald-600"
                          : summary.asoSt === "expiring"
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {summary.asoSt === "ok"
                        ? "Em dia"
                        : summary.asoSt === "expiring"
                          ? "Vencendo"
                          : summary.asoSt === "expired"
                            ? "Vencido"
                            : summary.asoSt === "inapto"
                              ? "Inapto"
                              : "Sem ASO registrado"}
                    </span>
                    {data.aso && (
                      <span className="text-[11px] text-muted-foreground">
                        válido até {formatDatePtBR(data.aso.validity_date)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground text-center">
                  Verificação pública em tempo real · Gestão NR-10 ·{" "}
                  {new Date().toLocaleDateString("pt-BR")}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  FileText,
  IdCard,
  Printer,
  UserRound,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  useNR10Trainings,
  useAuthorizationHistory,
  useITTrainings,
  useCertificates,
} from "@/lib/qualificacoes-queries";
import {
  EMPLOYEE_STATUS_LABELS,
  IT_STATUS_LABELS,
  TRAINING_LABELS,
  TRAINING_TYPES,
  employeeStatusVariant,
  formatDatePtBR,
  trainingExpiryStatus,
  type Employee,
  type ITStatus,
  type WorkAuthorization,
  type WorkInstruction,
} from "@/lib/qualificacoes";
import { useASOs } from "@/lib/asos-queries";
import { asoFileUrl } from "@/lib/asos-queries";
import { ASO_RESULTADO_LABELS, ASO_TIPO_LABELS, asoStatus, ASO_STATUS_LABELS } from "@/lib/asos";
import { useEPIs, useEPITests } from "@/lib/epis-queries";
import { EPI_STATUS_LABELS, EPI_TYPE_LABELS, epiTestStatus, lastTestByEpi } from "@/lib/epis";
import { computeAptidao } from "@/lib/aptidao";

export const Route = createFileRoute("/qualificacoes/colaborador/$id")({
  component: ColaboradorDossiePage,
  head: () => ({ meta: [{ title: "Dossiê do Colaborador — Gestão NR-10" }] }),
});

function useEmployee(id: string) {
  return useQuery({
    queryKey: ["employees", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Employee) ?? null;
    },
  });
}

function useCurrentAuthorization(employeeId: string) {
  return useQuery({
    queryKey: ["work_authorizations", "current", employeeId],
    queryFn: async () => {
      const q = supabase.from("work_authorizations").select("*").eq("employee_id", employeeId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (q as any).eq("is_current", true).maybeSingle();
      if (error) throw error;
      return (data as unknown as WorkAuthorization) ?? null;
    },
  });
}

function ColaboradorDossiePage() {
  const { id } = Route.useParams();
  const { data: employee, isLoading: l1 } = useEmployee(id);
  const { data: trainings = [], isLoading: l2 } = useNR10Trainings(id);
  const { data: currentAuth = null, isLoading: l3 } = useCurrentAuthorization(id);
  const { data: authHistory = [] } = useAuthorizationHistory(id);
  const { data: itTrainings = [] } = useITTrainings(id);
  const { data: asos = [] } = useASOs(id);
  const { data: certificates = [] } = useCertificates(id);
  const { data: epis = [] } = useEPIs();
  const { data: epiTests = [] } = useEPITests();

  const isLoading = l1 || l2 || l3;

  const myEpis = useMemo(() => epis.filter((e) => e.employee_id === id), [epis, id]);
  const lastTests = useMemo(() => lastTestByEpi(epiTests), [epiTests]);
  const latestAso = asos[0] ?? null; // useASOs ordena por exam_date desc

  const aptidao = useMemo(() => {
    if (!employee) return null;
    return computeAptidao({
      employee,
      trainings,
      authorization: currentAuth,
      aso: latestAso,
    });
  }, [employee, trainings, currentAuth, latestAso]);

  const trainingRows = useMemo(() => {
    return TRAINING_TYPES.flatMap((type) =>
      (["formacao", "reciclagem"] as const).map((cat) => {
        const t = trainings.find((tr) => tr.training_type === type && tr.category === cat);
        return t
          ? {
              ...t,
              label: `${TRAINING_LABELS[type]} — ${cat === "formacao" ? "Formação" : "Reciclagem"}`,
            }
          : null;
      }),
    ).filter(Boolean) as Array<(typeof trainings)[number] & { label: string }>;
  }, [trainings]);

  if (isLoading) {
    return (
      <PageShell>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (!employee) {
    return (
      <PageShell>
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Colaborador não encontrado.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <UserRound className="h-5 w-5 shrink-0 text-primary" />
            Dossiê do Colaborador
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Histórico completo de qualificação, saúde ocupacional e equipamentos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link
              to="/carteirinha/$matricula"
              params={{ matricula: employee.matricula }}
              target="_blank"
            >
              <IdCard className="h-4 w-4" /> Carteirinha
            </Link>
          </Button>
          <Button
            onClick={() => window.print()}
            className="bg-brand-gradient text-white shadow-brand"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Identificação + aptidão */}
      <Card className="mt-4 overflow-hidden">
        {aptidao && (
          <div
            className={`px-5 py-2.5 flex items-center gap-2 text-white ${aptidao.apto ? "bg-emerald-600" : "bg-red-600"}`}
          >
            {aptidao.apto ? (
              <BadgeCheck className="h-5 w-5" />
            ) : (
              <CircleAlert className="h-5 w-5" />
            )}
            <span className="font-bold text-sm">
              {aptidao.apto
                ? "APTO PARA TRABALHO EM ELETRICIDADE"
                : "NÃO APTO PARA TRABALHO EM ELETRICIDADE"}
            </span>
            {!aptidao.apto && (
              <span className="text-[11px] opacity-90 truncate">
                {aptidao.bloqueantes.map((b) => b.label).join(" · ")}
              </span>
            )}
          </div>
        )}
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-bold">{employee.name}</div>
              <div className="text-sm text-muted-foreground">
                Matrícula {employee.matricula}
                {employee.setor && <> · {employee.setor}</>}
                {employee.funcao && <> · {employee.funcao}</>}
              </div>
              {employee.classificacao && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Classificação: {employee.classificacao}
                </div>
              )}
            </div>
            <div className="text-right space-y-1">
              <Badge variant={employeeStatusVariant(employee.status)}>
                {EMPLOYEE_STATUS_LABELS[employee.status]}
              </Badge>
              {employee.reciclagem_requerida && (
                <div className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Reciclagem requerida
                  {employee.reciclagem_motivo ? `: ${employee.reciclagem_motivo}` : ""}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Capacitações */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Capacitações NR-10</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trainingRows.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma capacitação registrada.</p>
            )}
            {trainingRows.map((t) => {
              // formação é perene — não vence; só reciclagem tem prazo bienal
              const st =
                t.category === "formacao"
                  ? (t.training_date ? ("ok" as const) : ("none" as const))
                  : trainingExpiryStatus(t.training_date);
              const certs = certificates.filter((c) => c.nr10_training_id === t.id);
              return (
                <div key={t.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span
                      className={`text-xs font-semibold ${st === "ok" ? "text-emerald-600" : st === "expiring" ? "text-amber-600" : "text-red-600"}`}
                    >
                      {st === "ok"
                        ? "Em dia"
                        : st === "expiring"
                          ? "Vencendo"
                          : st === "expired"
                            ? "Vencido"
                            : "Sem data"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {t.training_date && <>Realizado em {formatDatePtBR(t.training_date)}</>}
                    {t.carga_horaria != null && <> · {t.carga_horaria}h</>}
                    {t.entidade && <> · {t.entidade}</>}
                    {t.instrutor && <> · Instrutor: {t.instrutor}</>}
                    {t.responsavel_tecnico && <> · Resp. técnico: {t.responsavel_tecnico}</>}
                    {t.art && <> · ART {t.art}</>}
                  </div>
                  {certs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {certs.map((c) => (
                        <a
                          key={c.id}
                          href={c.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary underline"
                        >
                          <FileText className="h-3 w-3" /> {c.file_name ?? "Certificado"}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Autorização */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Autorização de trabalho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentAuth ? (
              <div className="rounded-md border p-3 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-2xl font-bold">{currentAuth.level}</span>
                  {currentAuth.funcao && (
                    <span className="ml-2 text-sm text-muted-foreground">{currentAuth.funcao}</span>
                  )}
                  {currentAuth.abrangencia && (
                    <div className="text-[11px] text-muted-foreground">
                      Abrangência: {currentAuth.abrangencia}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-semibold ${currentAuth.valid ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {currentAuth.valid ? "VÁLIDA" : "INVÁLIDA"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    desde {formatDatePtBR(currentAuth.authorization_date)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-600 font-semibold">Sem autorização vigente.</p>
            )}
            {authHistory.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Histórico</p>
                <div className="space-y-1">
                  {authHistory.map((h) => (
                    <div key={h.id} className="text-xs flex gap-3 text-muted-foreground">
                      <span className="font-mono font-semibold">{h.level}</span>
                      <span>{formatDatePtBR(h.authorization_date)}</span>
                      <span>{h.valid ? "Válida" : "Inválida"}</span>
                      <span className="truncate">{h.funcao ?? ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ASOs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ASOs — Saúde Ocupacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {asos.length === 0 && (
              <p className="text-sm text-red-600 font-semibold">Nenhum ASO registrado.</p>
            )}
            {asos.map((a, idx) => {
              const st = idx === 0 ? asoStatus(a) : null;
              return (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {formatDatePtBR(a.exam_date)} · {ASO_TIPO_LABELS[a.tipo]}
                    </span>
                    {st && (
                      <span
                        className={`text-xs font-semibold ${st === "ok" ? "text-emerald-600" : st === "expiring" ? "text-amber-600" : "text-red-600"}`}
                      >
                        {ASO_STATUS_LABELS[st]}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {ASO_RESULTADO_LABELS[a.resultado]}
                    {!a.apto_eletricidade && (
                      <span className="text-red-600 font-semibold">
                        {" "}
                        · sem aptidão p/ eletricidade
                      </span>
                    )}
                    {" · "}válido até {formatDatePtBR(a.validity_date)}
                    {a.medico && <> · {a.medico}</>}
                    {a.restricoes && <> · Restrições: {a.restricoes}</>}
                  </div>
                  {a.file_path && (
                    <a
                      href={asoFileUrl(a.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary underline"
                    >
                      <FileText className="h-3 w-3" /> Arquivo do ASO
                    </a>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ITs + EPIs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ITs e EPIs sob responsabilidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Instruções de Trabalho
              </p>
              {itTrainings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma IT registrada.</p>
              ) : (
                <div className="space-y-1">
                  {(
                    itTrainings as Array<{
                      id: string;
                      status: ITStatus;
                      conclusao_date: string | null;
                      work_instructions?: Pick<WorkInstruction, "code" | "title"> | null;
                    }>
                  ).map((it) => (
                    <div key={it.id} className="text-xs flex items-center justify-between gap-2">
                      <span>
                        {it.work_instructions
                          ? `IT ${it.work_instructions.code}${it.work_instructions.title ? ` — ${it.work_instructions.title}` : ""}`
                          : "IT"}
                      </span>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {it.conclusao_date ? formatDatePtBR(it.conclusao_date) : "—"} ·{" "}
                        <span
                          className={
                            it.status === "ok"
                              ? "text-emerald-600 font-semibold"
                              : it.status === "vencido"
                                ? "text-red-600 font-semibold"
                                : "text-amber-600 font-semibold"
                          }
                        >
                          {IT_STATUS_LABELS[it.status]}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">EPIs vinculados</p>
              {myEpis.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum EPI vinculado.</p>
              ) : (
                <div className="space-y-1">
                  {myEpis.map((e) => {
                    const st = epiTestStatus(e, lastTests.get(e.id) ?? null);
                    return (
                      <div key={e.id} className="text-xs flex items-center justify-between gap-2">
                        <span>
                          {EPI_TYPE_LABELS[e.epi_type]}
                          {e.serial_number ? ` (série ${e.serial_number})` : ""}
                        </span>
                        <span
                          className={`font-semibold ${st === "ok" ? "text-emerald-600" : st === "expiring" ? "text-amber-600" : "text-red-600"}`}
                        >
                          {EPI_STATUS_LABELS[st]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

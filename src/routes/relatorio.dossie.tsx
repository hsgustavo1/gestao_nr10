import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { FolderCheck, Printer } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployees, useNR10Trainings, useWorkAuthorizations } from "@/lib/qualificacoes-queries";
import { useNR10Documents } from "@/lib/prontuario-queries";
import { useInspections } from "@/lib/inspecoes-queries";
import { useEPIs, useEPITests } from "@/lib/epis-queries";
import { useASOs } from "@/lib/asos-queries";
import { useAllRtiNcs } from "@/lib/rti-queries";
import {
  TRAINING_LABELS,
  TRAINING_TYPES,
  formatDatePtBR,
  trainingExpiryStatus,
  reciclagemStatus,
  type NR10Training,
  type TrainingType,
  type WorkAuthorization,
} from "@/lib/qualificacoes";
import {
  PIE_CATEGORY_LABELS,
  PIE_CATEGORY_NORM_REF,
  PIE_REQUIRED_CATEGORIES,
  docExpiryStatus,
  DOC_STATUS_LABELS,
} from "@/lib/prontuario";
import { INSPECTION_TYPES, INSPECTION_TYPE_SHORT } from "@/lib/inspecoes";
import {
  EPI_TYPE_LABELS,
  epiTestStatus,
  EPI_STATUS_LABELS,
  lastTestByEpi,
  nextTestDate,
} from "@/lib/epis";
import { asoStatus, latestASOByEmployee, ASO_STATUS_LABELS } from "@/lib/asos";
import { computeAptidao } from "@/lib/aptidao";
import { useComplianceReport } from "@/lib/conformidade";
import { RTI_NC_STATUS_LABELS, type RtiNcStatus } from "@/lib/rti";

export const Route = createFileRoute("/relatorio/dossie")({
  component: DossiePage,
  head: () => ({
    meta: [
      { title: "Dossiê de Fiscalização — Gestão NR-10" },
      {
        name: "description",
        content:
          "Dossiê consolidado para apresentação à fiscalização do trabalho: prontuário, autorizados, laudos, EPIs e plano de ação.",
      },
    ],
  }),
});

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="text-base font-bold border-b pb-1 mb-2">{title}</h2>
      {subtitle && <p className="text-[11px] text-muted-foreground mb-2">{subtitle}</p>}
      {children}
    </section>
  );
}

function DossiePage() {
  const { report, isLoading: l0 } = useComplianceReport();
  const { data: employees = [], isLoading: l1 } = useEmployees("ativo");
  const { data: trainings = [], isLoading: l2 } = useNR10Trainings();
  const { data: authorizations = [], isLoading: l3 } = useWorkAuthorizations();
  const { data: documents = [], isLoading: l4 } = useNR10Documents();
  const { data: inspections = [], isLoading: l5 } = useInspections();
  const { data: epis = [], isLoading: l6 } = useEPIs();
  const { data: epiTests = [] } = useEPITests();
  const { data: asos = [] } = useASOs();
  const { data: rtiNcs = [] } = useAllRtiNcs();

  const isLoading = l0 || l1 || l2 || l3 || l4 || l5 || l6;

  const authByEmployee = useMemo(() => {
    const map = new Map<string, WorkAuthorization>();
    for (const a of authorizations)
      map.set((a as any).employee_id, a as unknown as WorkAuthorization);
    return map;
  }, [authorizations]);

  const trainingsByEmp = useMemo(() => {
    const map = new Map<string, NR10Training[]>();
    for (const t of trainings) {
      const arr = map.get(t.employee_id);
      if (arr) arr.push(t);
      else map.set(t.employee_id, [t]);
    }
    return map;
  }, [trainings]);

  const latestASOs = useMemo(() => latestASOByEmployee(asos), [asos]);
  const lastTests = useMemo(() => lastTestByEpi(epiTests), [epiTests]);

  // Autorizados (com autorização vigente), com aptidão computada
  const autorizados = useMemo(() => {
    return employees
      .filter((e) => authByEmployee.has(e.id))
      .map((e) => {
        const auth = authByEmployee.get(e.id)!;
        const aso = latestASOs.get(e.id) ?? null;
        const aptidao = computeAptidao({
          employee: e,
          trainings: trainingsByEmp.get(e.id) ?? [],
          authorization: auth,
          aso,
        });
        // Para cada tipo: data a exibir = reciclagem mais recente (ou formação como fallback)
        // Status = reciclagemStatus (formação é perene — nunca aparece como "Vencido")
        const latestByType: Partial<Record<TrainingType, { date: string | null; status: ReturnType<typeof reciclagemStatus> }>> = {};
        for (const type of TRAINING_TYPES) {
          let formDate: string | null = null;
          let recDate: string | null = null;
          for (const t of trainingsByEmp.get(e.id) ?? []) {
            if (t.training_type !== type || !t.training_date) continue;
            if (t.category === "formacao") {
              if (!formDate || t.training_date > formDate) formDate = t.training_date;
            } else {
              if (!recDate || t.training_date > recDate) recDate = t.training_date;
            }
          }
          latestByType[type] = { date: recDate ?? formDate, status: reciclagemStatus(recDate, formDate) };
        }
        return { emp: e, auth, aso, aptidao, latestByType };
      })
      .sort((a, b) => a.emp.name.localeCompare(b.emp.name));
  }, [employees, authByEmployee, trainingsByEmp, latestASOs]);

  // Documentos do prontuário agrupados por categoria obrigatória
  const docsByCategory = useMemo(() => {
    const map = new Map<string, typeof documents>();
    for (const d of documents) {
      const arr = map.get(d.category);
      if (arr) arr.push(d);
      else map.set(d.category, [d]);
    }
    return map;
  }, [documents]);

  // Laudos vigentes por tipo
  const laudosByType = useMemo(() => {
    return INSPECTION_TYPES.map((type) => ({
      type,
      items: inspections
        .filter((i) => i.inspection_type === type)
        .sort((a, b) => (b.inspection_date ?? "").localeCompare(a.inspection_date ?? "")),
    })).filter((g) => g.items.length > 0);
  }, [inspections]);

  // Resumo do plano de ação RTI
  const rtiResumo = useMemo(() => {
    const byStatus: Record<RtiNcStatus, number> = { pendente: 0, em_andamento: 0, concluida: 0 };
    for (const nc of rtiNcs) byStatus[nc.status as RtiNcStatus]++;
    return { total: rtiNcs.length, byStatus };
  }, [rtiNcs]);

  const hoje = new Date();

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <FolderCheck className="h-5 w-5 shrink-0 text-primary" />
            Dossiê de Fiscalização NR-10
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Documento consolidado para apresentação à fiscalização do trabalho.
          </p>
        </div>
        <Button
          onClick={() => window.print()}
          className="bg-brand-gradient text-white shadow-brand"
        >
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      {isLoading || !report ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="mt-4 text-sm">
          {/* Capa */}
          <div className="text-center border rounded-md p-6 print:border-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Gestão NR-10 — Segurança em Instalações e Serviços em Eletricidade
            </p>
            <h1 className="text-2xl font-bold mt-1">DOSSIÊ DE FISCALIZAÇÃO</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Emitido em {hoje.toLocaleDateString("pt-BR")} às{" "}
              {hoje.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <div className="mt-4 inline-flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Índice global de conformidade
              </span>
              <span
                className={`text-3xl font-bold tabular-nums ${report.overall >= 90 ? "text-emerald-600" : report.overall >= 70 ? "text-amber-600" : "text-red-600"}`}
              >
                {report.overall}%
              </span>
            </div>
          </div>

          {/* 1. Prontuário */}
          <Section
            title="1. Prontuário das Instalações Elétricas (10.2.3 / 10.2.4)"
            subtitle={`Completude: ${report.prontuario.percent}% das categorias obrigatórias com documento válido.`}
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="py-1.5 pr-3 font-medium">Categoria (referência)</th>
                  <th className="py-1.5 pr-3 font-medium">Documento</th>
                  <th className="py-1.5 pr-3 font-medium">Responsável / ART</th>
                  <th className="py-1.5 pr-3 font-medium">Validade</th>
                  <th className="py-1.5 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {PIE_REQUIRED_CATEGORIES.map((cat) => {
                  const docs = docsByCategory.get(cat) ?? [];
                  if (docs.length === 0) {
                    return (
                      <tr key={cat} className="border-b">
                        <td className="py-1.5 pr-3">
                          {PIE_CATEGORY_LABELS[cat]}
                          <span className="text-muted-foreground">
                            {" "}
                            ({PIE_CATEGORY_NORM_REF[cat]})
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 text-muted-foreground" colSpan={3}>
                          {cat === "qualificacao_trabalhadores"
                            ? "Gerenciado no módulo Pessoas (seção 2)"
                            : "—"}
                        </td>
                        <td className="py-1.5">
                          {cat === "qualificacao_trabalhadores" ? (
                            <span className="text-emerald-600 font-semibold">Atendida</span>
                          ) : (
                            <span className="text-red-600 font-semibold">Pendente</span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                  return docs.map((d, idx) => {
                    const st = docExpiryStatus(d.validity_date);
                    return (
                      <tr key={d.id} className="border-b">
                        <td className="py-1.5 pr-3">
                          {idx === 0 && (
                            <>
                              {PIE_CATEGORY_LABELS[cat]}
                              <span className="text-muted-foreground">
                                {" "}
                                ({PIE_CATEGORY_NORM_REF[cat]})
                              </span>
                            </>
                          )}
                        </td>
                        <td className="py-1.5 pr-3">{d.title}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {d.responsavel ?? "—"}
                          {d.art ? ` · ART ${d.art}` : ""}
                        </td>
                        <td className="py-1.5 pr-3">
                          {d.validity_date ? formatDatePtBR(d.validity_date) : "Permanente"}
                        </td>
                        <td
                          className={`py-1.5 font-semibold ${st === "expired" ? "text-red-600" : st === "expiring" ? "text-amber-600" : "text-emerald-600"}`}
                        >
                          {DOC_STATUS_LABELS[st]}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </Section>

          {/* 2. Trabalhadores autorizados */}
          <Section
            title="2. Trabalhadores autorizados (10.8)"
            subtitle={`${autorizados.length} trabalhadores com autorização vigente. Aptidão = autorização + NR-10 Básico válido + ASO válido.`}
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="py-1.5 pr-3 font-medium">Colaborador</th>
                  <th className="py-1.5 pr-3 font-medium">Nível</th>
                  {TRAINING_TYPES.map((t) => (
                    <th key={t} className="py-1.5 pr-3 font-medium">
                      {TRAINING_LABELS[t]}
                    </th>
                  ))}
                  <th className="py-1.5 pr-3 font-medium">ASO</th>
                  <th className="py-1.5 font-medium">Aptidão</th>
                </tr>
              </thead>
              <tbody>
                {autorizados.map(({ emp, auth, aso, aptidao, latestByType }) => (
                  <tr key={emp.id} className="border-b">
                    <td className="py-1.5 pr-3">
                      <span className="font-medium">{emp.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · Mat. {emp.matricula}
                        {emp.setor ? ` · ${emp.setor}` : ""}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 font-semibold">{auth.level}</td>
                    {TRAINING_TYPES.map((type) => {
                      const entry = latestByType[type];
                      const date = entry?.date ?? null;
                      const st = entry?.status ?? "none";
                      return (
                        <td key={type} className="py-1.5 pr-3 whitespace-nowrap">
                          {date ? (
                            <span
                              className={
                                st === "expired"
                                  ? "text-red-600"
                                  : st === "expiring"
                                    ? "text-amber-600"
                                    : "text-emerald-700"
                              }
                            >
                              {formatDatePtBR(date)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {(() => {
                        const st = asoStatus(aso);
                        return (
                          <span
                            className={
                              st === "ok"
                                ? "text-emerald-700"
                                : st === "expiring"
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }
                          >
                            {ASO_STATUS_LABELS[st]}
                            {aso ? ` (${formatDatePtBR(aso.validity_date)})` : ""}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-1.5">
                      {aptidao.apto ? (
                        <span className="font-semibold text-emerald-600">Apto</span>
                      ) : (
                        <span
                          className="font-semibold text-red-600"
                          title={aptidao.bloqueantes.map((b) => b.label).join(" · ")}
                        >
                          Bloqueado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* 3. Laudos */}
          <Section title="3. Laudos e inspeções (10.2.4 b/g)">
            {laudosByType.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum laudo registrado.</p>
            )}
            {laudosByType.map(({ type, items }) => (
              <div key={type} className="mb-3">
                <h3 className="text-sm font-semibold mb-1">
                  {INSPECTION_TYPE_SHORT[type]} — {items.length}{" "}
                  {items.length === 1 ? "laudo" : "laudos"}
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="py-1 pr-3 font-medium">Equipamento / local</th>
                      <th className="py-1 pr-3 font-medium">Data</th>
                      <th className="py-1 pr-3 font-medium">Validade</th>
                      <th className="py-1 pr-3 font-medium">Resultado</th>
                      <th className="py-1 font-medium">Responsável / ART</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => {
                      const st = docExpiryStatus(i.validity_date);
                      return (
                        <tr key={i.id} className="border-b">
                          <td className="py-1 pr-3">
                            {i.equipment}
                            {i.sector ? ` · ${i.sector}` : ""}
                          </td>
                          <td className="py-1 pr-3">{formatDatePtBR(i.inspection_date)}</td>
                          <td
                            className={`py-1 pr-3 ${st === "expired" ? "text-red-600 font-semibold" : st === "expiring" ? "text-amber-600" : ""}`}
                          >
                            {i.validity_date ? formatDatePtBR(i.validity_date) : "—"}
                          </td>
                          <td
                            className={`py-1 pr-3 ${i.result === "nao_conforme" ? "text-red-600 font-semibold" : ""}`}
                          >
                            {i.result === "conforme"
                              ? "Conforme"
                              : i.result === "conforme_com_ressalvas"
                                ? "Conforme c/ ressalvas"
                                : "Não conforme"}
                          </td>
                          <td className="py-1 text-muted-foreground">
                            {i.responsavel ?? "—"}
                            {i.art ? ` · ART ${i.art}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </Section>

          {/* 4. EPIs */}
          <Section
            title="4. EPIs e EPCs especiais (10.2.4 c/e)"
            subtitle={`${epis.length} itens ativos · ${report.epiOk} com ensaio em dia.`}
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="py-1.5 pr-3 font-medium">EPI</th>
                  <th className="py-1.5 pr-3 font-medium">Série / CA</th>
                  <th className="py-1.5 pr-3 font-medium">Vinculado a</th>
                  <th className="py-1.5 pr-3 font-medium">Último ensaio</th>
                  <th className="py-1.5 pr-3 font-medium">Próximo ensaio</th>
                  <th className="py-1.5 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {epis.map((e) => {
                  const last = lastTests.get(e.id) ?? null;
                  const st = epiTestStatus(e, last);
                  const next = last && last.result === "aprovado" ? nextTestDate(e, last) : null;
                  return (
                    <tr key={e.id} className="border-b">
                      <td className="py-1.5 pr-3">
                        {EPI_TYPE_LABELS[e.epi_type]}
                        {e.epi_class ? ` classe ${e.epi_class}` : ""}
                      </td>
                      <td className="py-1.5 pr-3">
                        {e.serial_number ?? "—"}
                        {e.ca ? ` · CA ${e.ca}` : ""}
                      </td>
                      <td className="py-1.5 pr-3">
                        {e.employees?.name ?? (e.sector ? `Setor ${e.sector}` : "Uso coletivo")}
                      </td>
                      <td className="py-1.5 pr-3">{last ? formatDatePtBR(last.test_date) : "—"}</td>
                      <td className="py-1.5 pr-3">{next ? formatDatePtBR(next) : "—"}</td>
                      <td
                        className={`py-1.5 font-semibold ${st === "ok" ? "text-emerald-600" : st === "expiring" ? "text-amber-600" : "text-red-600"}`}
                      >
                        {EPI_STATUS_LABELS[st]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          {/* 5. Plano de ação */}
          <Section
            title="5. Plano de ação (RTI)"
            subtitle="Tratamento das não conformidades identificadas no Relatório Técnico das Inspeções."
          >
            {rtiResumo.total === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma não conformidade registrada.</p>
            ) : (
              <div className="flex gap-6 text-sm flex-wrap">
                <div>
                  <span className="text-2xl font-bold tabular-nums">{rtiResumo.total}</span>{" "}
                  <span className="text-muted-foreground text-xs">NCs no total</span>
                </div>
                {(Object.keys(rtiResumo.byStatus) as RtiNcStatus[]).map((s) => (
                  <div key={s}>
                    <span
                      className={`text-2xl font-bold tabular-nums ${s === "concluida" ? "text-emerald-600" : s === "em_andamento" ? "text-amber-600" : "text-red-600"}`}
                    >
                      {rtiResumo.byStatus[s]}
                    </span>{" "}
                    <span className="text-muted-foreground text-xs">{RTI_NC_STATUS_LABELS[s]}</span>
                  </div>
                ))}
                <div>
                  <span className="text-2xl font-bold tabular-nums text-emerald-600">
                    {Math.round((rtiResumo.byStatus.concluida / rtiResumo.total) * 100)}%
                  </span>{" "}
                  <span className="text-muted-foreground text-xs">concluídas</span>
                </div>
              </div>
            )}
          </Section>

          <div className="mt-8 text-[10px] text-muted-foreground text-center border-t pt-3">
            Dossiê gerado automaticamente pelo sistema Gestão NR-10 em{" "}
            {hoje.toLocaleDateString("pt-BR")}. Os documentos digitalizados (certificados, laudos,
            ASOs, ensaios) estão arquivados no sistema e disponíveis para apresentação.
          </div>
        </div>
      )}
    </PageShell>
  );
}

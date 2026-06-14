import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, FileText, LayoutList, Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { formatDatePtBR } from "@/lib/qualificacoes";
import type { RtiReport } from "@/lib/rti";
import { useDeleteRtiReport, useRtiReports } from "@/lib/rti-queries";
import { useFieldInspections } from "@/lib/campo-queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rti/gestao")({
  component: RtiGestaoPage,
  head: () => ({ meta: [{ title: "Gestão de Relatórios RTI — Gestão NR-10" }] }),
});

function RtiGestaoPage() {
  const { isStaff } = useAuth();
  const { data: reports = [], isLoading } = useRtiReports();
  const { data: inspections = [] } = useFieldInspections();
  const [deletingReport, setDeletingReport] = useState<RtiReport | null>(null);

  const inspByReportId = new Map(
    inspections.filter((i) => i.report_id).map((i) => [i.report_id!, i]),
  );

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2 mb-1">
        <Link to="/rti">
          <ArrowLeft className="h-4 w-4" /> RTI
        </Link>
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight">
            <LayoutList className="h-5 w-5 shrink-0 text-primary" />
            Gestão de Relatórios RTI
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Visualize e exclua relatórios RTI e seus planos de ação.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : reports.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center">
            <LayoutList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum relatório RTI cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-5 space-y-3">
          {reports.map((report) => {
            const linked = inspByReportId.get(report.id);
            return (
              <Card key={report.id} className="transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold leading-tight">{report.titulo}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        {report.periodo_inicio && (
                          <span>
                            Auditoria: {formatDatePtBR(report.periodo_inicio)}
                            {report.periodo_fim ? ` a ${formatDatePtBR(report.periodo_fim)}` : ""}
                          </span>
                        )}
                        {linked && (
                          <span className="text-amber-600">
                            Vinculada à coleta: {linked.titulo}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link to="/rti/plano" search={{ report: report.id }}>
                          Ver plano
                        </Link>
                      </Button>
                      {isStaff && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingReport(report)}
                          title="Excluir relatório RTI"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {deletingReport && (
        <ExcluirRtiDialog
          report={deletingReport}
          linkedInspectionTitle={inspByReportId.get(deletingReport.id)?.titulo ?? null}
          linkedInspectionId={inspByReportId.get(deletingReport.id)?.id ?? null}
          onOpenChange={(o) => { if (!o) setDeletingReport(null); }}
        />
      )}
    </PageShell>
  );
}

function ExcluirRtiDialog({
  report,
  linkedInspectionTitle,
  linkedInspectionId,
  onOpenChange,
}: {
  report: RtiReport;
  linkedInspectionTitle: string | null;
  linkedInspectionId: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const deleteRti = useDeleteRtiReport();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      if (linkedInspectionId) {
        await supabase
          .from("field_inspections")
          .update({ report_id: null, status: "em_andamento" })
          .eq("id", linkedInspectionId);
        await qc.invalidateQueries({ queryKey: ["field_inspections"] });
      }
      await deleteRti.mutateAsync(report.id);
      toast.success("Relatório RTI excluído.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao excluir: " + (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-1rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Excluir relatório RTI
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Você está prestes a excluir permanentemente o relatório{" "}
                <strong>{report.titulo}</strong>, incluindo todas as suas não
                conformidades, histórico e evidências.
              </p>
              {linkedInspectionTitle && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  A coleta em campo <strong>{linkedInspectionTitle}</strong>{" "}
                  será desvinculada e voltará ao status <em>Em andamento</em>.
                </p>
              )}
              <p className="font-medium text-destructive">
                Esta ação não pode ser desfeita e os dados não poderão ser recuperados.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? "Excluindo..." : "Excluir permanentemente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

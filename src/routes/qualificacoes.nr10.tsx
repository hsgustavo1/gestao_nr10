import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useNR10Trainings } from "@/lib/qualificacoes-queries";
import { NR10TrainingDialog } from "@/components/nr10-training-dialog";
import { trainingExpiryStatus, formatDatePtBR, type TrainingType, type NR10Training } from "@/lib/qualificacoes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/qualificacoes/nr10")({
  component: NR10Page,
  head: () => ({ meta: [{ title: "Capacitações NR-10 — Pessoas" }] }),
});

const COLUMNS: { type: TrainingType; category: "formacao" | "reciclagem"; label: string }[] = [
  { type: "nr10_basico",              category: "formacao",   label: "NR-10 B.\nFormação" },
  { type: "nr10_basico",              category: "reciclagem", label: "NR-10 B.\nReciclagem" },
  { type: "nr10_areas_classificadas", category: "formacao",   label: "Áreas Class.\nFormação" },
  { type: "nr10_areas_classificadas", category: "reciclagem", label: "Áreas Class.\nReciclagem" },
  { type: "sep",                      category: "formacao",   label: "SEP\nFormação" },
  { type: "sep",                      category: "reciclagem", label: "SEP\nReciclagem" },
];

type DialogState = {
  employeeId: string;
  employeeName: string;
  type: TrainingType;
  category: "formacao" | "reciclagem";
  training?: NR10Training;
};

function StatusCell({ training, onClick, isRevalidatedByReciclagem }: {
  training?: NR10Training;
  onClick: () => void;
  isRevalidatedByReciclagem?: boolean;
}) {
  const { isStaff } = useAuth();
  const tdClass = cn("py-2 px-3 text-center", isStaff && "cursor-pointer hover:bg-muted/40");

  if (!training || !training.training_date) {
    return (
      <td onClick={isStaff ? onClick : undefined} className={tdClass}>
        <MinusCircle className="h-4 w-4 mx-auto text-muted-foreground/40" />
      </td>
    );
  }

  // If this formação is revalidated by a valid reciclagem, always show OK
  if (isRevalidatedByReciclagem) {
    return (
      <td onClick={isStaff ? onClick : undefined} className={tdClass} title={formatDatePtBR(training.training_date)}>
        <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500" />
      </td>
    );
  }

  const expiry = trainingExpiryStatus(training.training_date);
  return (
    <td onClick={isStaff ? onClick : undefined} className={tdClass} title={formatDatePtBR(training.training_date)}>
      {expiry === "ok" ? (
        <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500" />
      ) : expiry === "expiring" ? (
        <CheckCircle2 className="h-4 w-4 mx-auto text-amber-500" />
      ) : (
        <XCircle className="h-4 w-4 mx-auto text-destructive" />
      )}
    </td>
  );
}

function NR10Page() {
  const { isStaff } = useAuth();
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: trainings = [], isLoading: trLoading } = useNR10Trainings();
  const isLoading = empLoading || trLoading;
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const trainingMap = new Map<string, NR10Training>();
  for (const t of trainings) {
    trainingMap.set(`${t.employee_id}:${t.training_type}:${t.category}`, t);
  }

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Capacitações NR-10</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {isStaff ? "Clique em uma célula para registrar ou editar o treinamento." : "Visão geral dos treinamentos NR-10."}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="py-3 px-3 text-left font-medium text-muted-foreground min-w-[180px]">Colaborador</th>
              <th className="py-2 px-2 text-left font-medium text-muted-foreground w-16">Mat.</th>
              {COLUMNS.map((c) => (
                <th key={`${c.type}:${c.category}`} className="py-2 px-3 text-center font-medium text-muted-foreground whitespace-pre-line min-w-[80px]">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-3 px-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-2 px-2"><Skeleton className="h-4 w-12" /></td>
                    {COLUMNS.map((_, j) => (
                      <td key={j} className="py-2 px-3 text-center">
                        <Skeleton className="h-4 w-4 mx-auto rounded-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : employees.map((emp) => (
                  <tr key={emp.id} className="border-b hover:bg-muted/20">
                    <td className="py-3 px-3 font-medium">{emp.name}</td>
                    <td className="py-2 px-2 text-muted-foreground">{emp.matricula}</td>
                    {COLUMNS.map((col) => {
                      const training = trainingMap.get(`${emp.id}:${col.type}:${col.category}`);

                      let isRevalidatedByReciclagem = false;
                      if (col.category === "formacao") {
                        const reciclagem = trainingMap.get(`${emp.id}:${col.type}:reciclagem`);
                        if (reciclagem?.training_date) {
                          const recStatus = trainingExpiryStatus(reciclagem.training_date);
                          isRevalidatedByReciclagem = recStatus === "ok" || recStatus === "expiring";
                        }
                      }

                      return (
                        <StatusCell
                          key={`${col.type}:${col.category}`}
                          training={training}
                          isRevalidatedByReciclagem={isRevalidatedByReciclagem}
                          onClick={() => setDialog({
                            employeeId: emp.id,
                            employeeName: emp.name,
                            type: col.type,
                            category: col.category,
                            training,
                          })}
                        />
                      );
                    })}
                  </tr>
                ))
            }
          </tbody>
        </table>
        {!isLoading && employees.length === 0 && (
          <p className="py-12 text-center text-muted-foreground text-sm">
            Nenhum colaborador cadastrado. Importe a planilha ou adicione colaboradores manualmente.
          </p>
        )}
      </div>

      {dialog && (
        <NR10TrainingDialog
          open={!!dialog}
          onOpenChange={(v) => { if (!v) setDialog(null); }}
          employeeId={dialog.employeeId}
          employeeName={dialog.employeeName}
          defaultType={dialog.type}
          defaultCategory={dialog.category}
          training={dialog.training}
        />
      )}
    </PageShell>
  );
}

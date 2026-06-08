import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useWorkInstructions, useITTrainings } from "@/lib/qualificacoes-queries";
import { InstructionDialog } from "@/components/instruction-dialog";
import { ITTrainingDialog } from "@/components/it-training-dialog";
import type { WorkInstruction } from "@/lib/qualificacoes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/qualificacoes/instrucoes")({
  component: InstrucoesPage,
  head: () => ({ meta: [{ title: "Instruções de Trabalho — Qualificações" }] }),
});

function InstrucoesPage() {
  const { isStaff, isAdmin } = useAuth();
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: instructions = [], isLoading: instrLoading } = useWorkInstructions();
  const { data: itTrainings = [], isLoading: itLoading } = useITTrainings();
  const isLoading = empLoading || instrLoading || itLoading;

  const [instrDialog, setInstrDialog] = useState<{ open: boolean; instruction?: WorkInstruction }>({ open: false });
  const [itDialog, setItDialog] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    instructionId: string;
    instructionCode: string;
    currentStatus?: string;
    currentDate?: string;
  } | null>(null);

  // Map "employeeId:instructionId" → { status, conclusao_date }
  const itMap = new Map<string, { status: string; conclusao_date: string | null }>();
  for (const t of itTrainings as Array<{ employee_id: string; instruction_id: string; status: string; conclusao_date: string | null }>) {
    itMap.set(`${t.employee_id}:${t.instruction_id}`, { status: t.status, conclusao_date: t.conclusao_date });
  }

  return (
    <PageShell>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Instruções de Trabalho</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isStaff ? "Clique em uma célula para registrar a conclusão." : "Matriz de conclusão por colaborador."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInstrDialog({ open: true, instruction: undefined })} variant="outline">
            <Plus className="h-4 w-4" /> Nova IT
          </Button>
        )}
      </div>

      {/* IT chips */}
      {instructions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {instructions.map((it) => (
            <div key={it.id} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium bg-muted/30">
              <span className="font-mono">{it.code}</span>
              {it.title && <span className="text-muted-foreground">— {it.title}</span>}
              {isAdmin && (
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setInstrDialog({ open: true, instruction: it })}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Separator className="mb-4" />

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="py-3 px-3 text-left font-medium text-muted-foreground min-w-[180px]">Colaborador</th>
              <th className="py-2 px-2 text-left font-medium text-muted-foreground w-16">Mat.</th>
              {instructions.map((it) => (
                <th key={it.id} className="py-2 px-3 text-center font-medium text-muted-foreground min-w-[70px] font-mono">
                  {it.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-3 px-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-2 px-2"><Skeleton className="h-4 w-10" /></td>
                    {Array.from({ length: Math.max(instructions.length, 3) }).map((_, j) => (
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
                    {instructions.map((it) => {
                      const record = itMap.get(`${emp.id}:${it.id}`);
                      return (
                        <td
                          key={it.id}
                          className={cn(
                            "py-2 px-3 text-center",
                            isStaff && "cursor-pointer hover:bg-muted/40"
                          )}
                          title={record?.conclusao_date ?? "Sem registro"}
                          onClick={isStaff ? () => setItDialog({
                            open: true,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            instructionId: it.id,
                            instructionCode: it.code,
                            currentStatus: record?.status,
                            currentDate: record?.conclusao_date ?? undefined,
                          }) : undefined}
                        >
                          {!record || record.status === "pendente" ? (
                            <MinusCircle className="h-4 w-4 mx-auto text-muted-foreground/40" />
                          ) : record.status === "ok" ? (
                            <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 mx-auto text-destructive" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
            }
          </tbody>
        </table>
        {!isLoading && instructions.length === 0 && (
          <p className="py-12 text-center text-muted-foreground text-sm">
            {isAdmin
              ? "Nenhuma instrução cadastrada. Use \"Nova IT\" para adicionar ou importe a planilha."
              : "Nenhuma instrução de trabalho cadastrada."}
          </p>
        )}
      </div>

      <InstructionDialog
        open={instrDialog.open}
        onOpenChange={(v) => setInstrDialog((prev) => ({ ...prev, open: v }))}
        instruction={instrDialog.instruction}
      />

      {itDialog && (
        <ITTrainingDialog
          open={itDialog.open}
          onOpenChange={(v) => { if (!v) setItDialog(null); }}
          employeeId={itDialog.employeeId}
          employeeName={itDialog.employeeName}
          instructionId={itDialog.instructionId}
          instructionCode={itDialog.instructionCode}
          currentStatus={itDialog.currentStatus}
          currentDate={itDialog.currentDate}
        />
      )}
    </PageShell>
  );
}

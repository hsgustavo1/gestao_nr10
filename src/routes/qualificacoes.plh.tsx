import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookMarked, CheckCircle2, XCircle, Plus } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useEmployees,
  usePlhByOrg,
  useCreaAnuidadesByOrg,
} from "@/lib/qualificacoes-queries";
import {
  creaAnuidadeEmDia,
  creaAnuidadeValidadeAtual,
  formatDatePtBR,
  SETOR_FULL_NAMES,
  type Employee,
} from "@/lib/qualificacoes";
import { AnuidadeDialog } from "@/components/anuidade-dialog";

export const Route = createFileRoute("/qualificacoes/plh")({
  component: PLHPage,
  head: () => ({ meta: [{ title: "Habilitação — Pessoas" }] }),
});

function StatusBadge({ ok, okLabel, missingLabel }: { ok: boolean; okLabel: string; missingLabel: string }) {
  return ok ? (
    <Badge variant="outline" className="gap-1 text-[10px] text-emerald-700 border-emerald-300">
      <CheckCircle2 className="h-3 w-3" /> {okLabel}
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1 text-[10px] text-amber-800">
      <XCircle className="h-3 w-3" /> {missingLabel}
    </Badge>
  );
}

function PLHPage() {
  const { data: employees = [], isLoading } = useEmployees("ativo");
  const { data: plhByEmployee } = usePlhByOrg();
  const { data: anuidadesByEmployee } = useCreaAnuidadesByOrg();
  const [anuidadeEmployee, setAnuidadeEmployee] = useState<Employee | null>(null);

  const habilitados = employees.filter((e) => e.classificacao === "Habilitado");

  return (
    <PageShell>
      <div className="flex items-center gap-2">
        <BookMarked className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Habilitação</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Registro do PLH (Profissional Legalmente Habilitado): termo de nomeação, ART de cargo e função,
            registro no conselho de classe (CREA/CFT) e anuidades. A ficha do integrante (Pessoas → Qualificação)
            e esta tela lançam a mesma anuidade no mesmo lugar.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-left">
              <th className="py-2 pr-4 font-medium">Nome</th>
              <th className="py-2 pr-4 font-medium">Setor</th>
              <th className="py-2 pr-4 font-medium">CREA/CFT</th>
              <th className="py-2 pr-4 font-medium">Termo de nomeação</th>
              <th className="py-2 pr-4 font-medium">ART cargo/função</th>
              <th className="py-2 pr-4 font-medium">Anuidade</th>
              <th className="py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading &&
              habilitados.map((emp) => {
                const plh = plhByEmployee?.get(emp.id);
                const anuidades = anuidadesByEmployee?.get(emp.id) ?? [];
                const emDia = creaAnuidadeEmDia(anuidades);
                const validade = creaAnuidadeValidadeAtual(anuidades);
                return (
                  <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-medium">{emp.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {emp.setor ? (SETOR_FULL_NAMES[emp.setor] ?? emp.setor) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge ok={!!emp.crea_cft?.trim()} okLabel={emp.crea_cft ?? "OK"} missingLabel="Sem registro" />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge ok={!!plh?.termo_nomeacao_data} okLabel="Registrado" missingLabel="Pendente" />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge ok={!!plh?.art_cargo_funcao} okLabel="Registrada" missingLabel="Pendente" />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        ok={emDia}
                        okLabel={`Em dia até ${formatDatePtBR(validade)}`}
                        missingLabel="Pendente"
                      />
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setAnuidadeEmployee(emp)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Lançar anuidade atualizada
                      </Button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {!isLoading && habilitados.length === 0 && (
          <p className="py-12 text-center text-muted-foreground text-sm">
            Nenhum colaborador com classificação "Habilitado" cadastrado.
          </p>
        )}
      </div>

      {anuidadeEmployee && (
        <AnuidadeDialog
          open={!!anuidadeEmployee}
          onOpenChange={(v) => !v && setAnuidadeEmployee(null)}
          employee={anuidadeEmployee}
        />
      )}
    </PageShell>
  );
}

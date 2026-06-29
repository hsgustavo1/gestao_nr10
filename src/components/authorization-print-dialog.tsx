import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatDatePtBR } from "@/lib/qualificacoes";
import type { WorkAuthorization } from "@/lib/qualificacoes";

type Employee = { name: string; matricula: string; setor: string | null; funcao: string | null };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  authorization: WorkAuthorization;
  employee: Employee;
};

export function AuthorizationPrintDialog({ open, onOpenChange, authorization, employee }: Props) {
  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Autorização de Trabalho</DialogTitle>
        </DialogHeader>

        {/* Print content */}
        <div id="print-content" className="space-y-4 text-sm">
          <div className="text-center border-b pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Gestão NR-10
            </p>
            <h2 className="text-lg font-bold mt-1">AUTORIZAÇÃO DE TRABALHO</h2>
            <p className="text-xs text-muted-foreground">
              NR-10 — Segurança em Instalações e Serviços em Eletricidade
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px]">
                Colaborador
              </p>
              <p className="font-medium">{employee.name}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px]">Matrícula</p>
              <p>{employee.matricula}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px]">Setor</p>
              <p>{employee.setor ?? "—"}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px]">Nível</p>
              <p className="font-bold text-base">{authorization.level}</p>
            </div>
            <div className="col-span-2">
              <p className="font-semibold text-muted-foreground uppercase text-[10px]">Função</p>
              <p>{authorization.funcao ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="font-semibold text-muted-foreground uppercase text-[10px]">
                Abrangência
              </p>
              <p>{authorization.abrangencia ?? "—"}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px]">
                Data da Autorização
              </p>
              <p>{formatDatePtBR(authorization.authorization_date)}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px]">Situação</p>
              <p
                className={
                  authorization.valid
                    ? "text-emerald-600 font-semibold"
                    : "text-destructive font-semibold"
                }
              >
                {authorization.valid ? "VÁLIDA" : "INVÁLIDA"}
              </p>
            </div>
          </div>

          <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="border-t border-foreground mt-8 pt-1 text-[10px] text-muted-foreground">
                Assinatura do Colaborador
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-foreground mt-8 pt-1 text-[10px] text-muted-foreground">
                Responsável Técnico / Data
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

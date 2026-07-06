import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAddCreaAnuidade, useAttachAnuidadeDoc, useCreaAnuidades } from "@/lib/qualificacoes-queries";
import { creaAnuidadeValidoAte, type Employee } from "@/lib/qualificacoes";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee;
};

/**
 * Único ponto de lançamento de anuidade CREA/CFT — usado tanto no cadastro do
 * integrante quanto na tela de Habilitação, para os dois sempre gravarem no
 * mesmo lugar (`employee_crea_anuidades`) com o mesmo fluxo (data + comprovante juntos).
 */
export function AnuidadeDialog({ open, onOpenChange, employee }: Props) {
  const { data: anuidades = [] } = useCreaAnuidades(employee.id);
  const add = useAddCreaAnuidade();
  const attach = useAttachAnuidadeDoc();
  const anoSugerido = anuidades.length ? Math.max(...anuidades.map((a) => a.ano)) + 1 : new Date().getFullYear();

  const [ano, setAno] = useState(anoSugerido);
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const busy = add.isPending || attach.isPending;

  useEffect(() => {
    if (open) {
      setAno(anoSugerido);
      setDataPagamento(new Date().toISOString().slice(0, 10));
      setFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anoSugerido]);

  async function onSubmit() {
    if (!dataPagamento) {
      toast.error("Informe a data de pagamento.");
      return;
    }
    if (!file) {
      toast.error("Anexe o comprovante de pagamento.");
      return;
    }
    try {
      const registro = await add.mutateAsync({ employeeId: employee.id, ano, data_pagamento: dataPagamento });
      await attach.mutateAsync({ employee, anuidadeId: registro.id, ano, file });
      toast.success(`Anuidade ${ano} lançada — válida até ${formatValidade(ano)}.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Não foi possível lançar a anuidade. Detalhe: ${(err as Error).message}`);
    }
  }

  function formatValidade(a: number) {
    const [y, m, d] = creaAnuidadeValidoAte(a).split("-");
    return `${d}/${m}/${y}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Lançar anuidade CREA/CFT</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ano de referência</label>
            <Input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data de pagamento</label>
            <Input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Comprovante</label>
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-9"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Válida até {formatValidade(ano)}.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit} disabled={busy}>
            {busy ? "Salvando..." : "Lançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

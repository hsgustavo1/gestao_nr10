import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  contarNos,
  removerNo,
  renomearNo,
  validarArvore,
  type ArvoreNo,
} from "@/lib/estrutura-modelos";
import { useSaveModelo } from "@/lib/estrutura-modelos-queries";

export interface ModeloEditorInicial {
  id?: string;
  nome: string;
  segmento: string;
  descricao: string | null;
  arvore: ArvoreNo[];
  origem_inspecao_id?: string | null;
}

/**
 * Editor de generalização (D-A3/D-A6): passo OBRIGATÓRIO da promoção a modelo.
 * v1 = lista indentada com renomear/remover por nó (sem drag, sem adicionar —
 * nó novo se cria na inspeção de origem antes de promover).
 */
export function EstruturaModeloEditor({
  open,
  onOpenChange,
  inicial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  inicial: ModeloEditorInicial | null;
}) {
  const save = useSaveModelo();
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arvore, setArvore] = useState<ArvoreNo[]>([]);

  useEffect(() => {
    if (!inicial) return;
    setNome(inicial.nome);
    setSegmento(inicial.segmento);
    setDescricao(inicial.descricao ?? "");
    setArvore(inicial.arvore);
  }, [inicial]);

  if (!inicial) return null;
  const erros = validarArvore(arvore);

  async function salvar(publicado: boolean) {
    if (!nome.trim()) return toast.error("Dê um nome ao modelo.");
    if (!segmento.trim()) return toast.error("Informe o segmento industrial.");
    if (erros.length > 0) return toast.error(erros[0]);
    if (contarNos(arvore) === 0) return toast.error("O modelo ficou sem nenhum nó.");
    try {
      await save.mutateAsync({
        id: inicial!.id,
        nome: nome.trim(),
        segmento: segmento.trim(),
        descricao: descricao.trim() || null,
        arvore,
        publicado,
        origem_inspecao_id: inicial!.origem_inspecao_id ?? null,
      });
      toast.success(publicado ? "Modelo publicado." : "Rascunho salvo.");
      onOpenChange(false);
    } catch (err) {
      toast.error(`Falha ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function NoLinha({ no, caminho, nivel }: { no: ArvoreNo; caminho: number[]; nivel: number }) {
    return (
      <>
        <div className="flex items-center gap-1.5" style={{ paddingLeft: nivel * 20 }}>
          <Input
            value={no.nome}
            onChange={(e) => setArvore((a) => renomearNo(a, caminho, e.target.value))}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            title="Remover (com subitens)"
            onClick={() => setArvore((a) => removerNo(a, caminho))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {no.filhos.map((f, i) => (
          <NoLinha key={`${caminho.join(".")}-${i}`} no={f} caminho={[...caminho, i]} nivel={nivel + 1} />
        ))}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editor de generalização</DialogTitle>
          <DialogDescription className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            Remova nomes de linhas, produtos e referências identificáveis do cliente — o modelo
            publicado fica visível a todas as organizações.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="em-nome">Nome do modelo</Label>
              <Input id="em-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-segmento">Segmento industrial</Label>
              <Input
                id="em-segmento"
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                placeholder="Ex.: Papel e celulose"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em-desc">Descrição (opcional)</Label>
            <Textarea
              id="em-desc"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Estrutura ({contarNos(arvore)} {contarNos(arvore) === 1 ? "item" : "itens"})
            </Label>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
              {arvore.map((no, i) => (
                <NoLinha key={i} no={no} caminho={[i]} nivel={0} />
              ))}
              {arvore.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">Nenhum nó restante.</p>
              )}
            </div>
            {erros.length > 0 && <p className="text-xs text-destructive">{erros[0]}</p>}
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="outline" disabled={save.isPending} onClick={() => void salvar(false)}>
            Salvar rascunho
          </Button>
          <Button disabled={save.isPending} onClick={() => void salvar(true)}>
            {save.isPending ? "Salvando…" : "Salvar e publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

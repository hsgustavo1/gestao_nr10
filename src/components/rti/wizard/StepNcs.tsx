import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PRIORIDADE_LABEL, type NcParaPdf, type NcsOverrides } from "@/lib/rti-relatorio";

export function StepNcs({
  ncs,
  overrides,
  onChange,
}: {
  /** Ordem por numero, SEM overrides aplicados (edição sempre parte do original). */
  ncs: NcParaPdf[];
  overrides: NcsOverrides;
  onChange: (v: NcsOverrides) => void;
}) {
  const [idx, setIdx] = useState(0);
  if (ncs.length === 0)
    return <p className="text-sm text-muted-foreground">Este relatório não tem NCs.</p>;
  const nc = ncs[Math.min(idx, ncs.length - 1)];
  const o = overrides[nc.id] ?? {};
  const set = (patch: Partial<(typeof overrides)[string]>) =>
    onChange({ ...overrides, [nc.id]: { ...o, ...patch } });
  const excluidas = new Set(o.fotosExcluidas ?? []);
  const incluida = o.incluir !== false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">
            NC {String(nc.numero).padStart(3, "0")} · {PRIORIDADE_LABEL[nc.prioridade]} ·{" "}
            {nc.areaNome}
          </p>
          <p className="text-xs text-muted-foreground">
            {idx + 1} de {ncs.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="nc-incluir" className="text-sm">
            Incluir no relatório
          </Label>
          <Switch id="nc-incluir" checked={incluida} onCheckedChange={(v) => set({ incluir: v })} />
        </div>
      </div>

      <div className={cn("space-y-3", !incluida && "pointer-events-none opacity-40")}>
        <div className="space-y-1.5">
          <Label>Descrição (edição só no relatório — o registro técnico não muda)</Label>
          <Textarea
            rows={3}
            value={o.descricao ?? nc.descricao}
            onChange={(e) => set({ descricao: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Recomendação</Label>
          <Textarea
            rows={3}
            value={o.recomendacao ?? nc.recomendacao ?? ""}
            onChange={(e) => set({ recomendacao: e.target.value })}
          />
        </div>
        {nc.fotos.length > 0 && (
          <div>
            <Label className="mb-2 block">Fotos (clique para excluir/incluir no PDF)</Label>
            <div className="flex flex-wrap gap-2">
              {nc.fotos.map((f) => {
                const fora = excluidas.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={cn(
                      "relative overflow-hidden rounded-md border",
                      fora && "opacity-30 grayscale",
                    )}
                    onClick={() => {
                      const next = new Set(excluidas);
                      if (fora) next.delete(f.id);
                      else next.add(f.id);
                      set({ fotosExcluidas: [...next] });
                    }}
                  >
                    <img src={f.url} alt="" className="h-24 w-32 object-cover" loading="lazy" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ← NC anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={idx >= ncs.length - 1}
          onClick={() => setIdx(idx + 1)}
        >
          Próxima NC →
        </Button>
      </div>
    </div>
  );
}

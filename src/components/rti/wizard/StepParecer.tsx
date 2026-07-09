import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildParecerInput } from "@/lib/rti-parecer-ai";
import { sugerirParecer } from "@/lib/rti-parecer-ai-server";
import type { NcParaPdf, WizardIdentificacao } from "@/lib/rti-relatorio";

export function StepParecer({
  identificacao,
  ncs,
  parecer,
  resumoExecutivo,
  onChange,
}: {
  identificacao: WizardIdentificacao;
  /** Já com overrides aplicados (o parecer fala do que vai pro PDF). */
  ncs: NcParaPdf[];
  parecer: string;
  resumoExecutivo: string;
  onChange: (v: { parecer: string; resumoExecutivo: string }) => void;
}) {
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    try {
      const input = buildParecerInput(identificacao, ncs);
      const sugestao = await sugerirParecer({ data: { input } });
      onChange({ parecer: sugestao.parecer, resumoExecutivo: sugestao.resumoExecutivo });
      toast.success("Sugestão gerada — revise e edite antes de emitir.");
    } catch (err) {
      toast.error(
        `Falha ao gerar sugestão: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          A IA sugere um rascunho a partir das NCs. O texto é <strong>sempre seu</strong> — revise
          antes de emitir.
        </p>
        <Button variant="outline" size="sm" onClick={gerar} disabled={gerando || ncs.length === 0}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          {gerando ? "Gerando…" : parecer ? "Gerar de novo (substitui)" : "Sugerir com IA"}
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="parecer-resumo">Resumo executivo</Label>
        <Textarea
          id="parecer-resumo"
          rows={4}
          value={resumoExecutivo}
          onChange={(e) => onChange({ parecer, resumoExecutivo: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="parecer-texto">Parecer técnico</Label>
        <Textarea
          id="parecer-texto"
          rows={14}
          value={parecer}
          onChange={(e) => onChange({ parecer: e.target.value, resumoExecutivo })}
        />
      </div>
    </div>
  );
}

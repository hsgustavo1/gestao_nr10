import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WizardIdentificacao } from "@/lib/rti-relatorio";

const campos: { key: keyof WizardIdentificacao; label: string; tipo?: "date" }[] = [
  { key: "titulo", label: "Título do relatório" },
  { key: "clienteNome", label: "Cliente" },
  { key: "local", label: "Local / unidade" },
  { key: "periodoInicio", label: "Início da inspeção", tipo: "date" },
  { key: "periodoFim", label: "Fim da inspeção", tipo: "date" },
  { key: "responsavelTecnico", label: "Responsável técnico" },
  { key: "artNumero", label: "Nº da ART" },
  { key: "normas", label: "Referencial normativo" },
];

export function StepIdentificacao({
  value,
  onChange,
}: {
  value: WizardIdentificacao;
  onChange: (v: WizardIdentificacao) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {campos.map((c) => (
        <div key={c.key} className="space-y-1.5">
          <Label htmlFor={`ident-${c.key}`}>{c.label}</Label>
          <Input
            id={`ident-${c.key}`}
            type={c.tipo ?? "text"}
            value={(value[c.key] as string | null) ?? ""}
            onChange={(e) =>
              onChange({ ...value, [c.key]: e.target.value || (c.tipo === "date" ? null : "") })
            }
          />
        </div>
      ))}
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="ident-introducao">Introdução</Label>
        <Textarea
          id="ident-introducao"
          rows={4}
          value={value.introducao}
          onChange={(e) => onChange({ ...value, introducao: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="ident-metodologia">Metodologia</Label>
        <Textarea
          id="ident-metodologia"
          rows={4}
          value={value.metodologia}
          onChange={(e) => onChange({ ...value, metodologia: e.target.value })}
        />
      </div>
    </div>
  );
}

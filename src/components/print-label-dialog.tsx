import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Printer, Upload, Lock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  formatPhoneBR, colorLabel, colorSwatch, type Padlock,
} from "@/lib/padlocks";

/**
 * Etiqueta padrão de cadeado de bloqueio — 12cm x 7cm.
 * Permite upload de foto do dono e impressão direta.
 */
export function PrintLabelDialog({
  open, onOpenChange, padlock,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  padlock: Padlock;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isRed = padlock.color === "vermelho";

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Selecione um arquivo de imagem");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Imagem muito grande (máx. 5MB)");
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handlePrint() {
    window.print();
  }

  function reset() {
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl print:hidden">
        <DialogHeader>
          <DialogTitle>Imprimir etiqueta — {colorLabel[padlock.color]} #{padlock.number}</DialogTitle>
          <DialogDescription>
            Faça upload de uma foto do dono (opcional) e gere a etiqueta padrão 12 × 7 cm para impressão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isRed && (
            <div className="space-y-1.5">
              <Label htmlFor="photo">Foto do dono (opcional)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
                />
                {photo && (
                  <Button type="button" variant="ghost" size="sm" onClick={reset}>
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG ou PNG, até 5MB.</p>
            </div>
          )}

          <div>
            <Label className="mb-2 block">Prévia da etiqueta</Label>
            <div className="flex justify-center rounded-lg border bg-muted/30 p-4">
              <LabelCard padlock={padlock} photo={photo} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Camada de impressão — só aparece no @media print */}
      {open && (
        <div className="hidden print:block print-label-root">
          <LabelCard padlock={padlock} photo={photo} forPrint />
        </div>
      )}
    </Dialog>
  );
}

/* ============= Etiqueta 12 × 7 cm ============= */
function LabelCard({
  padlock, photo, forPrint = false,
}: {
  padlock: Padlock;
  photo: string | null;
  forPrint?: boolean;
}) {
  const isRed = padlock.color === "vermelho";
  return (
    <div
      className={`label-card ${forPrint ? "label-print" : ""} relative overflow-hidden rounded-md border-2 border-black bg-white text-black`}
      style={{ width: "12cm", height: "7cm" }}
    >
      {/* Faixa superior na cor do cadeado */}
      <div className={`flex items-center justify-between px-3 py-1.5 text-white ${colorSwatch[padlock.color]}`}>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Bloqueio de Energias Perigosas</span>
        </div>
        <span className="font-mono text-[11px] font-bold">Nº {padlock.number}</span>
      </div>

      {/* Corpo */}
      <div className="flex h-[calc(100%-1.85cm)] gap-3 p-3">
        {!isRed && (
          <div className="flex h-full w-[3.2cm] shrink-0 items-center justify-center overflow-hidden rounded border border-black/40 bg-gray-100">
            {photo ? (
              <img src={photo} alt="Foto do dono" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[9px] uppercase text-gray-500">Foto</span>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-600">Cor do cadeado</div>
            <div className="text-[12px] font-bold leading-tight">{colorLabel[padlock.color]}</div>
          </div>

          {!isRed ? (
            <div className="space-y-0.5">
              <Row label="Dono" value={padlock.owner_name} bold />
              <Row label="Matrícula" value={padlock.owner_registration} mono />
              <Row label="Função" value={padlock.owner_role} />
              <Row label="Setor / Empresa" value={padlock.owner_sector} />
              <Row label="Telefone" value={padlock.owner_phone ? formatPhoneBR(padlock.owner_phone) : null} mono />
            </div>
          ) : (
            <div className="space-y-0.5">
              <Row label="Setor / Empresa" value={padlock.owner_sector} bold />
              <div className="text-[9px] italic text-gray-600">
                Cadeado vermelho — uso em equipamento, sem dono pessoal.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-black/30 bg-gray-50 px-3 py-1">
        <span className="text-[8px] uppercase tracking-wider text-gray-700">Atvos · RAC</span>
        <span className="font-mono text-[8px] text-gray-700">{padlock.code}</span>
      </div>
    </div>
  );
}

function Row({
  label, value, mono, bold,
}: {
  label: string; value: string | null | undefined; mono?: boolean; bold?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5 leading-tight">
      <span className="text-[8px] font-semibold uppercase tracking-wider text-gray-600">{label}:</span>
      <span className={`truncate text-[11px] ${mono ? "font-mono" : ""} ${bold ? "font-bold" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

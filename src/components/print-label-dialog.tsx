import { useRef, useState, type ChangeEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "sonner";
import { Printer, Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { colorLabel, type Padlock } from "@/lib/padlocks";
import { EtiquetaLOTO, type EtiquetaCor } from "@/components/etiqueta-loto";

/**
 * Geração e impressão da Etiqueta LOTO 12x7 cm (frente + verso lado a lado).
 */
export function PrintLabelDialog({
  open, onOpenChange, padlock,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  padlock: Padlock;
}) {
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [etiquetaGerada, setEtiquetaGerada] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cadeado = {
    numero: padlock.number,
    cor: padlock.color as EtiquetaCor,
    setor: padlock.owner_sector ?? "",
    donoAtual: {
      nome: padlock.owner_name ?? undefined,
      matricula: padlock.owner_registration ?? undefined,
      telefone: padlock.owner_phone ?? undefined,
      funcao: padlock.owner_role ?? undefined,
      setor: padlock.owner_sector ?? undefined,
    },
  };

  function reset() {
    setFotoBase64(null);
    setEtiquetaGerada(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 5MB)");
    const reader = new FileReader();
    reader.onload = () => setFotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  function imprimirEtiqueta() {
    if (!etiquetaGerada) {
      toast.error("Gere a etiqueta primeiro.");
      return;
    }
    const etiquetaHTML = renderToStaticMarkup(
      <EtiquetaLOTO cadeado={cadeado} fotoSrc={fotoBase64} scale={1} />
    );
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Não foi possível abrir a janela de impressão. Verifique bloqueador de pop-ups.");
      return;
    }
    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiqueta — Cadeado nº ${padlock.number}</title>
  <style>
    @page { size: 12cm 7cm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  ${etiquetaHTML}
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`);
    win.document.close();
  }

  const donoNome = padlock.owner_name?.trim() || "(sem dono)";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl print:hidden">
        <DialogHeader>
          <DialogTitle>Etiqueta de Bloqueio LOTO</DialogTitle>
          <DialogDescription>
            Cadeado {colorLabel[padlock.color].split(" - ")[0]} nº {padlock.number} · {donoNome}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr,auto] sm:items-center">
          {/* Upload */}
          <div>
            <input
              ref={fileRef}
              id="foto-input"
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
            />
            <label
              htmlFor="foto-input"
              className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-muted-foreground/40 p-3 transition-colors hover:border-muted-foreground/70"
            >
              {fotoBase64 ? (
                <img
                  src={fotoBase64}
                  alt="Foto"
                  style={{ maxHeight: 80, maxWidth: 140, objectFit: "cover", borderRadius: 6 }}
                />
              ) : (
                <div className="flex h-[80px] w-[140px] items-center justify-center rounded bg-muted/50 text-xs text-muted-foreground">
                  <Upload className="mr-1 h-4 w-4" /> Foto do colaborador
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                Clique para enviar uma foto (opcional). JPG/PNG até 5MB.
              </span>
            </label>
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => setEtiquetaGerada(true)}
              className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
            >
              Gerar etiqueta
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={imprimirEtiqueta}
              title="Configure a impressora para tamanho personalizado 12cm × 7cm e sem margens."
            >
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>

        {etiquetaGerada && (
          <div
            style={{
              background: "#CBD2D8",
              padding: 20,
              borderRadius: 8,
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", gap: 0, justifyContent: "center" }}>
              <EtiquetaLOTO cadeado={cadeado} fotoSrc={fotoBase64} scale={1.8} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

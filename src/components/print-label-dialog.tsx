import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "sonner";
import { Printer, Upload, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { colorLabel, type Padlock } from "@/lib/padlocks";
import { EtiquetaLOTO, type EtiquetaCor } from "@/components/etiqueta-loto";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const BUCKET = "padlock-photos";
const photoPath = (padlockId: string) => `${padlockId}.jpg`;

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
  const { isStaff } = useAuth();
  const [fotoSrc, setFotoSrc] = useState<string | null>(null);
  const [etiquetaGerada, setEtiquetaGerada] = useState(false);
  const [loadingFoto, setLoadingFoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Ao abrir, tenta carregar foto já arquivada para este cadeado
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingFoto(true);
      setEtiquetaGerada(false);
      setFotoSrc(null);
      // Verifica se o objeto realmente existe no bucket (list ignora cache do CDN)
      const { data: list } = await supabase.storage
        .from(BUCKET)
        .list("", { search: photoPath(padlock.id), limit: 1 });
      const exists = !!list?.some((o) => o.name === photoPath(padlock.id));
      if (cancelled) return;
      if (!exists) {
        setLoadingFoto(false);
        return;
      }
      // Busca a imagem pela URL pública com cache-buster para evitar foto antiga
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(photoPath(padlock.id));
      try {
        const resp = await fetch(`${pub.publicUrl}?t=${Date.now()}`, { cache: "no-store" });
        if (!resp.ok) throw new Error("not found");
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = () => {
          if (cancelled) return;
          setFotoSrc(reader.result as string);
          setEtiquetaGerada(true);
          setLoadingFoto(false);
        };
        reader.readAsDataURL(blob);
      } catch {
        if (!cancelled) setLoadingFoto(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, padlock.id]);

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
    setFotoSrc(null);
    setEtiquetaGerada(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 5MB)");
    setUploading(true);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(photoPath(padlock.id), file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
    if (error) {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      return toast.error("Falha ao salvar a foto: " + error.message);
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFotoSrc(reader.result as string);
      setEtiquetaGerada(true);
      setUploading(false);
      toast.success("Foto arquivada para este cadeado");
    };
    reader.readAsDataURL(file);
  }

  function imprimirEtiqueta() {
    if (!etiquetaGerada) {
      toast.error("Gere a etiqueta primeiro.");
      return;
    }
    const etiquetaHTML = renderToStaticMarkup(
      <EtiquetaLOTO cadeado={cadeado} fotoSrc={fotoSrc} scale={1} />
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
  const temFotoArquivada = !!fotoSrc;

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
              disabled={!isStaff || uploading}
            />
            <label
              htmlFor="foto-input"
              className={`flex items-center gap-3 rounded-md border-2 border-dashed border-muted-foreground/40 p-3 transition-colors ${isStaff ? "cursor-pointer hover:border-muted-foreground/70" : "cursor-not-allowed opacity-70"}`}
            >
              {loadingFoto ? (
                <div className="flex h-[80px] w-[140px] items-center justify-center rounded bg-muted/50 text-xs text-muted-foreground">
                  Carregando...
                </div>
              ) : fotoSrc ? (
                <img
                  src={fotoSrc}
                  alt="Foto"
                  style={{ maxHeight: 80, maxWidth: 140, objectFit: "cover", borderRadius: 6 }}
                />
              ) : (
                <div className="flex h-[80px] w-[140px] items-center justify-center rounded bg-muted/50 text-xs text-muted-foreground">
                  <Upload className="mr-1 h-4 w-4" /> Foto do colaborador
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                {temFotoArquivada ? (
                  <>
                    Foto arquivada para este cadeado.
                    {isStaff && <> Clique para <strong>substituir</strong> a foto. <RefreshCw className="inline h-3 w-3 ml-1" /></>}
                  </>
                ) : isStaff ? (
                  <>Clique para enviar uma foto. JPG/PNG até 5MB. {uploading && "(enviando...)"}</>
                ) : (
                  <>Sem foto arquivada. Solicite à equipe para fazer o upload.</>
                )}
              </span>
            </label>
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-2">
            {!etiquetaGerada && (
              <Button
                type="button"
                onClick={() => setEtiquetaGerada(true)}
                className="bg-brand-gradient text-white shadow-brand hover:opacity-95"
              >
                Gerar etiqueta
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={imprimirEtiqueta}
              disabled={!etiquetaGerada}
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
              <EtiquetaLOTO cadeado={cadeado} fotoSrc={fotoSrc} scale={1.8} />
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

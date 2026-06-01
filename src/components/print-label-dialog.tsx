import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "sonner";
import { Printer, Upload, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { colorLabel, type Padlock } from "@/lib/padlocks";
import { EtiquetaLOTO, type EtiquetaCor } from "@/components/etiqueta-loto";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "padlock-photos";

function memberSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function photoPathFor(padlock: Padlock): string {
  const name = padlock.owner_name ? memberSlug(padlock.owner_name) : "";
  const reg = padlock.owner_registration ? memberSlug(padlock.owner_registration) : "";
  if (name && reg) return `members/${reg}_${name}.jpg`;
  return `${padlock.id}.jpg`;
}

export function PrintLabelDialog({
  open, onOpenChange, padlock,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  padlock: Padlock;
}) {
  const [fotoSrc, setFotoSrc] = useState<string | null>(null);
  const [etiquetaGerada, setEtiquetaGerada] = useState(false);
  const [loadingFoto, setLoadingFoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [siblings, setSiblings] = useState<Padlock[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingSiblings, setLoadingSiblings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Carrega foto arquivada
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingFoto(true);
      setEtiquetaGerada(false);
      setFotoSrc(null);
      const path = photoPathFor(padlock);
      const folder = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
      const filename = path.includes("/") ? path.substring(path.lastIndexOf("/") + 1) : path;
      const { data: list } = await supabase.storage
        .from(BUCKET)
        .list(folder, { search: filename, limit: 1 });
      const exists = !!list?.some((o) => o.name === filename);
      if (cancelled) return;
      if (!exists) { setLoadingFoto(false); return; }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
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
      } catch { if (!cancelled) setLoadingFoto(false); }
    })();
    return () => { cancelled = true; };
  }, [open, padlock.id, padlock.owner_name, padlock.owner_registration]);

  // Busca todos os cadeados do mesmo Integrante
  useEffect(() => {
    if (!open) return;
    if (!padlock.owner_registration) {
      setSiblings([padlock]);
      setSelected(new Set([padlock.id]));
      return;
    }
    setLoadingSiblings(true);
    supabase
      .from("padlocks")
      .select("*")
      .eq("owner_registration", padlock.owner_registration)
      .eq("cancelled", false)
      .neq("color", "vermelho")
      .order("color")
      .order("number")
      .then(({ data }) => {
        const list = (data ?? []) as Padlock[];
        const final = list.length ? list : [padlock];
        setSiblings(final);
        setSelected(new Set(final.map((p) => p.id)));
        setLoadingSiblings(false);
      });
  }, [open, padlock.owner_registration, padlock.id]);

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
    setSiblings([]);
    setSelected(new Set());
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 5MB)");
    setUploading(true);
    const path = photoPathFor(padlock);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
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
      toast.success("Foto arquivada para este integrante");
    };
    reader.readAsDataURL(file);
  }

  function toggleAll(selectAll: boolean) {
    setSelected(selectAll ? new Set(siblings.map((p) => p.id)) : new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function imprimirEtiqueta() {
    if (!etiquetaGerada) return toast.error("Gere a etiqueta primeiro.");
    const toPrint = siblings.filter((p) => selected.has(p.id));
    if (toPrint.length === 0) return toast.error("Selecione ao menos um cadeado.");

    const labelsHTML = toPrint.map((p) => {
      const cd = {
        numero: p.number,
        cor: p.color as EtiquetaCor,
        setor: p.owner_sector ?? "",
        donoAtual: {
          nome: p.owner_name ?? undefined,
          matricula: p.owner_registration ?? undefined,
          telefone: p.owner_phone ?? undefined,
          funcao: p.owner_role ?? undefined,
          setor: p.owner_sector ?? undefined,
        },
      };
      return `<div class="label">${renderToStaticMarkup(
        <EtiquetaLOTO cadeado={cd} fotoSrc={fotoSrc} scale={1} />
      )}</div>`;
    }).join("\n");

    const win = window.open("", "_blank");
    if (!win) return toast.error("Não foi possível abrir a janela de impressão. Verifique bloqueador de pop-ups.");
    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiquetas LOTO</title>
  <style>
    @page { size: A4 landscape; margin: 5mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { display: grid; grid-template-columns: repeat(2, 12cm); gap: 5mm; align-content: start; }
    .label { break-inside: avoid; page-break-inside: avoid; }
  </style>
</head>
<body>
  ${labelsHTML}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
    win.document.close();
  }

  const donoNome = padlock.owner_name?.trim() || "(sem dono)";
  const temFotoArquivada = !!fotoSrc;
  const showSiblings = siblings.length > 1;

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
              disabled={uploading}
            />
            <label
              htmlFor="foto-input"
              className="flex items-center gap-3 rounded-md border-2 border-dashed border-muted-foreground/40 p-3 transition-colors cursor-pointer hover:border-muted-foreground/70"
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
                    <> Clique para <strong>substituir</strong> a foto. <RefreshCw className="inline h-3 w-3 ml-1" /></>
                  </>
                ) : (
                  <>Clique para enviar uma foto. JPG/PNG até 5MB. {uploading && "(enviando...)"}</>
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
              disabled={!etiquetaGerada || selected.size === 0}
              title="Impressão em A4 paisagem. Múltiplas etiquetas por folha quando selecionado mais de uma."
            >
              <Printer className="h-4 w-4" />
              {selected.size <= 1 ? "Imprimir" : `Imprimir ${selected.size} etiquetas`}
            </Button>
          </div>
        </div>

        {/* Seleção de cadeados — apenas quando há mais de 1 */}
        {showSiblings && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Cadeados a imprimir
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {loadingSiblings ? "Carregando..." : `${selected.size} selecionado${selected.size !== 1 ? "s" : ""}`}
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => toggleAll(true)}>
                  Todos
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => toggleAll(false)}>
                  Nenhum
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {siblings.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-muted/30 rounded px-1"
                >
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                  />
                  <span className="text-sm flex-1">
                    {colorLabel[p.color]} #{p.number}
                    {p.id === padlock.id && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(este cadeado)</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {etiquetaGerada && (
          <div style={{ background: "#CBD2D8", padding: 16, borderRadius: 8, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <EtiquetaLOTO cadeado={cadeado} fotoSrc={fotoSrc} scale={1.25} />
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

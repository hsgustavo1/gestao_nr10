import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrgBrandingRow, useSetOrgBranding } from "@/lib/rti-relatorio-queries";

/** Identidade do consultor no PDF do relatório (white-label mínimo — D-C4). */
export function OrgBrandingDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const row = useOrgBrandingRow(open ? orgId : null);
  const save = useSetOrgBranding();
  const [razao, setRazao] = useState("");
  const [registro, setRegistro] = useState("");
  const [cor, setCor] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row.data) return;
    setRazao(row.data.razao_social_relatorio ?? "");
    setRegistro(row.data.registro_profissional ?? "");
    setCor(row.data.cor_primaria ?? "");
    setLogoFile(null);
  }, [row.data]);

  const logoAtualUrl = row.data?.logo_path
    ? supabase.storage.from("org-assets").getPublicUrl(row.data.logo_path).data.publicUrl
    : null;

  async function handleSave() {
    setSaving(true);
    try {
      // Sem arquivo novo, mantém o logo atual (nunca sobrescreve com null sem intenção).
      let path = row.data?.logo_path ?? null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        path = `${orgId}/logo-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("org-assets").upload(path, logoFile, {
          contentType: logoFile.type,
          upsert: false,
        });
        if (error) throw error;
      }
      await save.mutateAsync({
        orgId,
        logoPath: path,
        corPrimaria: cor.trim() || null,
        razaoSocial: razao.trim() || null,
        registroProfissional: registro.trim() || null,
      });
      toast.success("Identidade do relatório salva.");
      onOpenChange(false);
    } catch (err) {
      toast.error(`Falha ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Identidade do relatório (white-label)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="brand-razao">Razão social exibida no PDF</Label>
            <Input id="brand-razao" value={razao} onChange={(e) => setRazao(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-registro">
              Registro profissional (ex.: CREA-SP 0000000000)
            </Label>
            <Input
              id="brand-registro"
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-cor">Cor primária (hex, ex.: #0C3326)</Label>
            <Input
              id="brand-cor"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              placeholder="#0C3326"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-logo">Logo (PNG/JPG — fundo transparente fica melhor)</Label>
            {logoAtualUrl && !logoFile && (
              <img
                src={logoAtualUrl}
                alt="Logo atual"
                className="h-12 rounded border bg-white object-contain p-1"
              />
            )}
            <Input
              id="brand-logo"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

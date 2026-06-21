import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/db/dexie";
import { enqueue } from "@/sync/engine";
import { generateId } from "@/lib/uuid";
import { getActiveOrgId, getOperableOrgs, type OrgLite } from "@/lib/org";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";

type Props = { onClose: () => void };

export function CreateInspectionModal({ onClose }: Props) {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState(() => `Inspeção ${new Date().toISOString().slice(0, 10)}`);
  // Orgs-cliente para as quais o usuário pode criar inspeção (consultor → seus
  // clientes; cliente direto → a própria org). Cache offline-safe do último sync.
  const [orgs] = useState<OrgLite[]>(() => getOperableOrgs());
  // Cliente selecionado: respeita a org ativa cacheada se ainda for operável.
  const [orgId, setOrgId] = useState<string>(() => {
    const operable = getOperableOrgs();
    const active = getActiveOrgId();
    if (active && operable.some((o) => o.id === active)) return active;
    return operable[0]?.id ?? "";
  });
  // Fallback legado: sem cache de orgs (nunca sincronizou) → texto livre.
  const [clienteLivre, setClienteLivre] = useState("");
  const [local, setLocal] = useState("");
  const [engenheiro, setEngenheiro] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setEngenheiro(data.user?.user_metadata?.full_name ?? data.user?.email ?? "");
      } catch {
        // Offline or unauthenticated — silently degrade; engenheiro stays ''
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasOrgList = orgs.length > 0;
  const selectedOrg = orgs.find((o) => o.id === orgId) ?? null;

  async function handleCreate() {
    if (!titulo.trim() || saving) return;
    // Multi-org: exige escolher o cliente (senão a inspeção subiria na org errada).
    if (hasOrgList && !orgId) {
      setError("Selecione o cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = generateId();
      const now = new Date().toISOString();
      // org_id = cliente escolhido no drill-down. Sem lista (nunca sincronizou)
      // cai na org ativa cacheada; se undefined, a trigger resolve p/ single-org.
      const resolvedOrgId = hasOrgList ? orgId : getActiveOrgId();
      const clienteNome = hasOrgList ? (selectedOrg?.nome ?? null) : clienteLivre.trim() || null;
      const inspection = {
        id,
        ...(resolvedOrgId ? { org_id: resolvedOrgId } : {}),
        titulo: titulo.trim(),
        cliente: clienteNome,
        local: local.trim() || null,
        engenheiro: engenheiro || null,
        data_inspecao: now,
        status: "em_andamento" as const,
        report_id: null,
        notes: null,
        arquivada_campo: false,
        created_by_name: engenheiro || null,
        created_at: now,
        updated_at: now,
        _synced: false,
      };
      await db.inspections.add(inspection);
      await enqueue("inspections", "insert", inspection, id);
      navigate(`/inspecoes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar inspeção");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-insp-title"
        className="relative w-full bg-slate-900 rounded-t-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="create-insp-title" className="font-semibold text-lg">
            Nova inspeção
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-400">Título *</span>
            <input
              autoFocus
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          {hasOrgList ? (
            orgs.length === 1 ? (
              <label className="block">
                <span className="text-sm text-slate-400">Cliente</span>
                <input
                  type="text"
                  value={selectedOrg?.nome ?? ""}
                  readOnly
                  className="mt-1 w-full rounded-lg bg-slate-800/50 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                />
              </label>
            ) : (
              <label className="block">
                <span className="text-sm text-slate-400">Cliente *</span>
                <select
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Selecione o cliente…
                  </option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </label>
            )
          ) : (
            <label className="block">
              <span className="text-sm text-slate-400">Cliente</span>
              <input
                type="text"
                value={clienteLivre}
                onChange={(e) => setClienteLivre(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          )}
          <label className="block">
            <span className="text-sm text-slate-400">Local</span>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Engenheiro</span>
            <input
              type="text"
              value={engenheiro}
              readOnly
              className="mt-1 w-full rounded-lg bg-slate-800/50 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
            />
          </label>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={!titulo.trim() || saving}
          className="w-full flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 px-4 py-3.5 font-semibold transition-colors"
        >
          {saving ? "Criando..." : "Criar inspeção"}
        </button>
      </div>
    </div>
  );
}

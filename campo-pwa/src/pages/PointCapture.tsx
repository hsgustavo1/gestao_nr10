import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/db/dexie";
import type { LocalFinding, LocalPhoto } from "@/db/dexie";
import type { RtiModoFalha, RtiTipoExecucao } from "@/lib/types";
import { enqueue } from "@/sync/engine";
import { modosPorCategoria } from "@/lib/campo";
import { compressPhoto } from "@/lib/image";
import { ArrowLeft, Camera, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { generateId } from "@/lib/uuid";

type Params = { id: string; nodeId: string };

// ── Finding form ──────────────────────────────────────────────────────────────

function FindingForm({
  pointId,
  modos,
  onClose,
}: {
  pointId: string;
  modos: RtiModoFalha[];
  onClose: () => void;
}) {
  const [modoId, setModoId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState(3);
  const [tipoExecucao, setTipoExecucao] = useState<RtiTipoExecucao>("os");
  const [recomendacao, setRecomendacao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const porCategoria = modosPorCategoria(modos);

  function applyModo(id: string) {
    setModoId(id);
    const m = modos.find((x) => x.id === id);
    if (!m) return;
    setDescricao(m.descricao_padrao);
    setPrioridade(m.prioridade_sugerida);
    setTipoExecucao(m.tipo_execucao_sugerido);
    setRecomendacao(m.recomendacao_padrao ?? "");
  }

  async function handleSave() {
    if (!descricao.trim()) return;
    setSaving(true);
    const id = generateId();
    const now = new Date().toISOString();
    const finding: LocalFinding = {
      id,
      point_id: pointId,
      modo_falha_id: modoId || null,
      descricao: descricao.trim(),
      recomendacao: recomendacao.trim() || null,
      prioridade,
      tipo_execucao: tipoExecucao,
      observacao: observacao.trim() || null,
      created_at: now,
      updated_at: now,
      _synced: false,
    };
    await db.findings.add(finding);
    await enqueue("findings", "insert", finding, id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 overflow-y-auto">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <button onClick={onClose} className="p-2.5 -m-1 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-semibold flex-1">Nova não conformidade</h2>
        <button
          onClick={handleSave}
          disabled={saving || !descricao.trim()}
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm font-semibold"
        >
          Salvar
        </button>
      </header>

      <div className="flex-1 p-4 space-y-4">
        {porCategoria.size > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Modo de falha (opcional)
            </label>
            <select
              value={modoId}
              onChange={(e) => applyModo(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Selecionar modo de falha —</option>
              {Array.from(porCategoria.entries()).map(([cat, items]) => (
                <optgroup key={cat} label={cat}>
                  {items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Descrição *
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            placeholder="Descreva a não conformidade..."
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Prioridade (1–5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={prioridade}
              onChange={(e) => setPrioridade(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Tipo execução
            </label>
            <select
              value={tipoExecucao}
              onChange={(e) => setTipoExecucao(e.target.value as RtiTipoExecucao)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="os">O.S.</option>
              <option value="investimento">Investimento</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Recomendação
          </label>
          <textarea
            value={recomendacao}
            onChange={(e) => setRecomendacao(e.target.value)}
            rows={2}
            placeholder="Ação recomendada..."
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Observação
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Observações adicionais de campo..."
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
}

// ── Photo card ────────────────────────────────────────────────────────────────

function PhotoCard({ photo }: { photo: LocalPhoto }) {
  const src = photo.blob ? URL.createObjectURL(photo.blob) : (photo.file_path ?? "");

  async function handleDelete() {
    await db.photos.delete(photo.id);
    await enqueue("photos", "delete", { id: photo.id }, photo.id);
  }

  return (
    <div className="relative rounded-xl overflow-hidden aspect-square bg-slate-800">
      {src && <img src={src} alt={photo.legenda ?? ""} className="w-full h-full object-cover" />}
      <button
        onClick={handleDelete}
        className="absolute top-1 right-1 bg-black/70 rounded-full p-2 min-w-[36px] min-h-[36px] flex items-center justify-center"
        aria-label="Remover foto"
      >
        <Trash2 className="h-4 w-4 text-red-400" />
      </button>
    </div>
  );
}

// ── Finding card ──────────────────────────────────────────────────────────────

function FindingCard({ finding, modos }: { finding: LocalFinding; modos: RtiModoFalha[] }) {
  const modo = modos.find((m) => m.id === finding.modo_falha_id);

  async function handleDelete() {
    await db.findings.delete(finding.id);
    await enqueue("findings", "delete", { id: finding.id }, finding.id);
  }

  return (
    <div className="rounded-xl bg-slate-800 p-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {modo && <p className="text-xs text-blue-400">{modo.label}</p>}
          <p className="text-sm">{finding.descricao}</p>
        </div>
        <button onClick={handleDelete} className="p-1 shrink-0" aria-label="Remover não conformidade">
          <Trash2 className="h-4 w-4 text-red-400" />
        </button>
      </div>
      <div className="flex gap-2 text-xs text-slate-400">
        <span>P{finding.prioridade}</span>
        <span>·</span>
        <span>{finding.tipo_execucao === "os" ? "O.S." : "Investimento"}</span>
        {!finding._synced && <span className="text-yellow-500">● não sincronizado</span>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PointCapture() {
  const { id, nodeId } = useParams<Params>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFindingForm, setShowFindingForm] = useState(false);
  const [legendaInput, setLegendaInput] = useState("");
  const [askOrphan, setAskOrphan] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const point = useLiveQuery(() => (nodeId ? db.points.get(nodeId) : undefined), [nodeId]);
  const photos = useLiveQuery(
    () => (nodeId ? db.photos.where("point_id").equals(nodeId).sortBy("ordem") : []),
    [nodeId],
  );
  const findings = useLiveQuery(
    () => (nodeId ? db.findings.where("point_id").equals(nodeId).toArray() : []),
    [nodeId],
  );
  const modos = useLiveQuery(() => db.modos_falha.toArray(), []) ?? [];

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !nodeId) return;

    // Comprime antes de persistir: o original full-res fica só na galeria do aparelho;
    // o app e o Supabase guardam a versão leve. Falha de compressão cai no original.
    const blob = await compressPhoto(file);

    const photoId = generateId();
    const now = new Date().toISOString();
    const existingCount = await db.photos.where("point_id").equals(nodeId).count();
    const photo: LocalPhoto = {
      id: photoId,
      point_id: nodeId,
      file_path: null,
      file_name: file.name,
      legenda: legendaInput.trim() || null,
      ordem: existingCount,
      finding_id: null,
      gps_lat: null,
      gps_lng: null,
      gps_accuracy: null,
      blob,
      created_at: now,
      _synced: false,
    };
    await db.photos.add(photo);
    await enqueue("photos", "insert", photo, photoId);
    setLegendaInput("");
    // reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Primeira foto do ponto: abre o formulário de NC na hora, em vez de só
    // cobrar isso quando o técnico tenta sair (gate de saída continua como rede
    // de segurança para quem cancelar o formulário sem salvar).
    if ((findings ?? []).length === 0) {
      setShowFindingForm(true);
    }
  }

  // Remove o ponto e tudo abaixo (fotos/NCs) localmente; descarta inserts ainda
  // pendentes na fila (evita criar no servidor só pra deletar) e, para o que já foi
  // sincronizado, enfileira a deleção (a cascata no servidor cobre fotos/NCs).
  async function purgePoint() {
    if (!nodeId) return;
    const ptPhotos = await db.photos.where("point_id").equals(nodeId).toArray();
    const ptFindings = await db.findings.where("point_id").equals(nodeId).toArray();
    const pt = await db.points.get(nodeId);

    await db.findings.where("point_id").equals(nodeId).delete();
    await db.photos.where("point_id").equals(nodeId).delete();
    await db.points.delete(nodeId);

    const ids = new Set<string>([
      nodeId,
      ...ptPhotos.map((p) => p.id),
      ...ptFindings.map((f) => f.id),
    ]);
    const queued = await db.sync_queue.toArray();
    const removeIds = queued.filter((q) => ids.has(q.local_id)).map((q) => q.id);
    if (removeIds.length) await db.sync_queue.bulkDelete(removeIds);

    for (const f of ptFindings) {
      if (f._synced) await enqueue("findings", "delete", { id: f.id }, f.id);
    }
    for (const p of ptPhotos) {
      if (p._synced) await enqueue("photos", "delete", { id: p.id }, p.id);
    }
    if (pt?._synced) await enqueue("points", "delete", { id: nodeId }, nodeId);
  }

  async function handleBack() {
    if (leaving) return;
    const f = findings ?? [];
    const ph = photos ?? [];
    // Toda foto precisa virar uma não conformidade. Sem nenhuma NC, o ponto não pode
    // persistir com foto solta: ou se adiciona uma NC, ou apaga.
    if (f.length === 0) {
      if (ph.length === 0) {
        // Ponto vazio (sem foto e sem NC) — remove para não acumular pontos sem conteúdo.
        setLeaving(true);
        await purgePoint();
        navigate(`/inspecoes/${id}`);
        return;
      }
      setAskOrphan(true);
      return;
    }
    navigate(`/inspecoes/${id}`);
  }

  async function confirmDeleteOrphan() {
    if (leaving) return;
    setLeaving(true);
    await purgePoint();
    navigate(`/inspecoes/${id}`);
  }

  if (point === undefined) return null;

  if (!point) {
    return (
      <div className="p-8 text-center text-slate-400">
        Ponto não encontrado.{" "}
        <button onClick={() => navigate(`/inspecoes/${id}`)} className="text-blue-400 underline">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          onClick={handleBack}
          disabled={leaving}
          className="p-2.5 -m-1 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold flex-1 truncate">{point.titulo ?? "Ponto de coleta"}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Fotos */}
        <section className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fotos</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handlePhoto}
          />

          {photos && photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <PhotoCard key={p.id} photo={p} />
              ))}
            </div>
          )}

          <input
            value={legendaInput}
            onChange={(e) => setLegendaInput(e.target.value)}
            placeholder="Legenda da próxima foto (opcional)"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 active:scale-[0.98] transition-all h-12 text-base font-semibold"
          >
            <Camera className="h-5 w-5" />
            Tirar foto
          </button>
        </section>

        {/* Não conformidades */}
        <section className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Não conformidades
          </p>

          {findings?.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-2">
              Nenhuma não conformidade registrada.
            </p>
          )}

          {findings?.map((f) => (
            <FindingCard key={f.id} finding={f} modos={modos} />
          ))}

          <button
            onClick={() => setShowFindingForm(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-600 hover:border-slate-500 hover:bg-slate-800/60 active:bg-slate-800 active:scale-[0.98] transition-all h-12 text-sm font-semibold text-slate-300"
          >
            <Plus className="h-5 w-5" />
            Adicionar não conformidade
          </button>
        </section>
      </div>

      {showFindingForm && (
        <FindingForm pointId={nodeId!} modos={modos} onClose={() => setShowFindingForm(false)} />
      )}

      {askOrphan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-4">
            <h2 className="font-semibold">Foto sem não conformidade</h2>
            <p className="text-sm text-slate-300">
              Toda foto precisa de uma não conformidade. Adicione uma NC ou apague a foto para sair.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setAskOrphan(false);
                  setShowFindingForm(true);
                }}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-3 text-sm font-semibold"
              >
                Adicionar não conformidade
              </button>
              <button
                onClick={confirmDeleteOrphan}
                disabled={leaving}
                className="w-full rounded-lg border border-red-700/60 text-red-300 py-3 text-sm font-semibold disabled:opacity-40"
              >
                {leaving ? "Apagando…" : "Apagar foto e voltar"}
              </button>
              <button
                onClick={() => setAskOrphan(false)}
                disabled={leaving}
                className="w-full rounded-lg border border-slate-600 py-2.5 text-sm disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

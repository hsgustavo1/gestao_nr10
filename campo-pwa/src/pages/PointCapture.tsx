import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/db/dexie";
import type { LocalFinding, LocalPhoto } from "@/db/dexie";
import type { RtiModoFalha, RtiTipoExecucao } from "@/lib/types";
import { enqueue } from "@/sync/engine";
import { modosPorCategoria } from "@/lib/campo";
import { compressPhoto } from "@/lib/image";
import { ArrowLeft, Camera, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { generateId } from "@/lib/uuid";
import { saveResume } from "@/lib/resume";
import { getGpsCached, warmupGps } from "@/lib/geo";
import { contarUsoModos, maisUsados } from "@/lib/frequencia";

/** Vincula a foto à NC. Se a foto já sincronizou, enfileira o update; se ainda
 * está na fila, o uploadPhoto lê o registro atual do Dexie e o vínculo sobe junto. */
async function linkPhotoToFinding(photoId: string, findingId: string | null): Promise<void> {
  await db.photos.update(photoId, { finding_id: findingId });
  const p = await db.photos.get(photoId);
  if (p?._synced) {
    await enqueue("photos", "update", { id: photoId, finding_id: findingId }, photoId);
  }
}

type Params = { id: string; nodeId: string };

// ── Finding form ──────────────────────────────────────────────────────────────

function FindingForm({
  pointId,
  modos,
  linkPhotoId,
  onClose,
}: {
  pointId: string;
  modos: RtiModoFalha[];
  /** Foto recém-tirada que deve nascer vinculada à NC criada (spec §5.2). */
  linkPhotoId: string | null;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<RtiModoFalha | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [manual, setManual] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState(3);
  const [tipoExecucao, setTipoExecucao] = useState<RtiTipoExecucao>("os");
  const [recomendacao, setRecomendacao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  // "Mais usados no topo" — frequência local (spec §5.1).
  const allFindings = useLiveQuery(() => db.findings.toArray(), []) ?? [];
  const uso = contarUsoModos(allFindings);
  const top = maisUsados(modos, uso, 4);
  const porCategoria = modosPorCategoria(modos);

  function applyModo(m: RtiModoFalha) {
    setSelected(m);
    setManual(false);
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
      modo_falha_id: selected?.id ?? null,
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
    if (linkPhotoId) await linkPhotoToFinding(linkPhotoId, id);
    onClose();
  }

  const modoBtn = (m: RtiModoFalha) => (
    <button
      key={m.id}
      onClick={() => applyModo(m)}
      className={`w-full min-h-[56px] rounded-xl px-4 py-3 text-left text-base font-medium border transition-colors ${
        selected?.id === m.id
          ? "bg-blue-600 border-blue-400 text-white"
          : "bg-slate-800 border-slate-700 hover:border-slate-500"
      }`}
    >
      {m.label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <button
          onClick={onClose}
          className="p-2.5 -m-1 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-semibold flex-1">Nova não conformidade</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
        {top.length > 0 && !manual && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Mais usados
            </p>
            {top.map(modoBtn)}
          </div>
        )}

        {!manual &&
          Array.from(porCategoria.entries()).map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{cat}</p>
              {items.map(modoBtn)}
            </div>
          ))}

        {!manual && (
          <button
            onClick={() => {
              setManual(true);
              setSelected(null);
              setDescricao("");
              setRecomendacao("");
              setShowDetails(true);
            }}
            className="w-full min-h-[56px] rounded-xl border border-dashed border-slate-600 text-slate-300 text-base"
          >
            Descrever manualmente (sem modo de falha)
          </button>
        )}

        {(showDetails || manual) && (
          <div className="space-y-4 pt-2 border-t border-slate-800">
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
        )}
      </div>

      {/* Rodapé fixo: prioridade + tipo + salvar — operável com o polegar/luva */}
      {(selected || manual) && (
        <footer className="shrink-0 border-t border-slate-800 bg-slate-900 p-3 space-y-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setPrioridade(n)}
                className={`flex-1 min-h-[48px] rounded-lg text-base font-bold border ${
                  prioridade === n ? "bg-blue-600 border-blue-400" : "bg-slate-800 border-slate-700"
                }`}
              >
                P{n}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setTipoExecucao("os")}
              className={`flex-1 min-h-[44px] rounded-lg text-sm font-semibold border ${
                tipoExecucao === "os" ? "bg-blue-600 border-blue-400" : "bg-slate-800 border-slate-700"
              }`}
            >
              O.S.
            </button>
            <button
              onClick={() => setTipoExecucao("investimento")}
              className={`flex-1 min-h-[44px] rounded-lg text-sm font-semibold border ${
                tipoExecucao === "investimento"
                  ? "bg-blue-600 border-blue-400"
                  : "bg-slate-800 border-slate-700"
              }`}
            >
              Investimento
            </button>
          </div>
          <div className="flex gap-2">
            {selected && !manual && (
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="rounded-xl border border-slate-600 px-4 min-h-[52px] text-sm text-slate-300"
              >
                {showDetails ? "Ocultar ▴" : "Ajustar ▾"}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !descricao.trim()}
              className="flex-1 min-h-[52px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-base font-bold"
            >
              {saving ? "Salvando…" : "Salvar NC"}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

// ── Photo card ────────────────────────────────────────────────────────────────

function PhotoCard({ photo, findings }: { photo: LocalPhoto; findings: LocalFinding[] }) {
  const [linking, setLinking] = useState(false);
  const src = photo.blob ? URL.createObjectURL(photo.blob) : (photo.file_path ?? "");
  const linkedIdx = findings.findIndex((f) => f.id === photo.finding_id);

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
      {findings.length > 0 && (
        <button
          onClick={() => setLinking(true)}
          className="absolute bottom-1 left-1 right-1 bg-black/70 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-left"
        >
          {linkedIdx >= 0 ? `NC ${linkedIdx + 1} ✓` : "Vincular NC…"}
        </button>
      )}
      {linking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-2">
            <h2 className="font-semibold pb-1">Esta foto evidencia qual NC?</h2>
            {findings.map((f, i) => (
              <button
                key={f.id}
                onClick={async () => {
                  await linkPhotoToFinding(photo.id, f.id);
                  setLinking(false);
                }}
                className={`w-full min-h-[52px] rounded-lg border px-3 text-left text-sm ${
                  photo.finding_id === f.id
                    ? "bg-blue-600 border-blue-400"
                    : "bg-slate-700 border-slate-600"
                }`}
              >
                NC {i + 1} — {f.descricao.slice(0, 60)}
              </button>
            ))}
            <button
              onClick={async () => {
                await linkPhotoToFinding(photo.id, null);
                setLinking(false);
              }}
              className="w-full min-h-[44px] rounded-lg border border-slate-600 text-sm text-slate-300"
            >
              Sem vínculo (foto geral do ponto)
            </button>
            <button
              onClick={() => setLinking(false)}
              className="w-full py-2.5 text-sm text-slate-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
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
  // false = fechado; null = aberto sem foto a vincular; string = photoId a vincular
  const [findingFormPhoto, setFindingFormPhoto] = useState<string | null | false>(false);
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

  // GPS: aquece o fix ao abrir o ponto; a foto lê o cache sem esperar (spec §6.1).
  useEffect(() => {
    warmupGps();
  }, []);

  // Retomada de contexto: registra onde o técnico está trabalhando (spec §6.2).
  useEffect(() => {
    if (!point || !id || !nodeId) return;
    saveResume({
      inspectionId: id,
      label: point.titulo ?? "Ponto de coleta",
      path: `/inspecoes/${id}/ponto/${nodeId}`,
      at: new Date().toISOString(),
    });
  }, [point, id, nodeId]);

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
      gps_lat: getGpsCached()?.lat ?? null,
      gps_lng: getGpsCached()?.lng ?? null,
      gps_accuracy: getGpsCached()?.accuracy ?? null,
      blob,
      created_at: now,
      _synced: false,
    };
    await db.photos.add(photo);
    await enqueue("photos", "insert", photo, photoId);
    setLegendaInput("");
    // reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Renova o fix para a próxima foto (o técnico se move entre capturas).
    warmupGps();

    // Primeira foto do ponto: abre o formulário de NC na hora, já apontando o
    // vínculo foto↔NC (spec §5.2). Se o técnico cancelar, o gate de saída cobra.
    if ((findings ?? []).length === 0) {
      setFindingFormPhoto(photoId);
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
                <PhotoCard key={p.id} photo={p} findings={findings ?? []} />
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
            onClick={() => setFindingFormPhoto(null)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-600 hover:border-slate-500 hover:bg-slate-800/60 active:bg-slate-800 active:scale-[0.98] transition-all h-12 text-sm font-semibold text-slate-300"
          >
            <Plus className="h-5 w-5" />
            Adicionar não conformidade
          </button>
        </section>
      </div>

      {findingFormPhoto !== false && (
        <FindingForm
          pointId={nodeId!}
          modos={modos}
          linkPhotoId={findingFormPhoto}
          onClose={() => setFindingFormPhoto(false)}
        />
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
                  // Vincula a 1ª foto ainda sem NC à NC que vai nascer.
                  setFindingFormPhoto(photos?.find((p) => !p.finding_id)?.id ?? null);
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

import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db } from "@/db/dexie";
import type { LocalNode } from "@/db/dexie";
import { enqueue } from "@/sync/engine";
import { filhosDoNo, labelDoTipo, nodePath, proximoNivel, setorDoNo } from "@/lib/campo";
import { exportSetorFotos } from "@/lib/export-fotos";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Camera,
  ChevronRight,
  Download,
  FolderTree,
  Home,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { generateId } from "@/lib/uuid";
import { EditMetadataModal } from "@/components/EditMetadataModal";

type Params = { id: string };

function AddNodeModal({
  inspectionId,
  parentId,
  allNodes,
  onClose,
}: {
  inspectionId: string;
  parentId: string | null;
  allNodes: LocalNode[];
  onClose: () => void;
}) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const nivel = proximoNivel(
    parentId ? (allNodes.find((n) => n.id === parentId)?.nivel ?? null) : null,
  );
  if (!nivel) return null;

  async function handleSave() {
    if (!nome.trim()) return;
    setSaving(true);
    const id = generateId();
    const now = new Date().toISOString();
    const siblings = filhosDoNo(parentId, allNodes);
    const node = {
      id,
      inspection_id: inspectionId,
      parent_id: parentId,
      nivel: nivel as NonNullable<typeof nivel>,
      nome: nome.trim(),
      ordem: siblings.length,
      created_at: now,
      updated_at: now,
      _synced: false,
    };
    await db.nodes.add(node);
    await enqueue("nodes", "insert", node, id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-4">
        <h2 className="font-semibold">Adicionar {labelDoTipo(nivel)}</h2>
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={`Nome do ${labelDoTipo(nivel).toLowerCase()}`}
          className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-600 py-3 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !nome.trim()}
            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 text-sm font-semibold"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InspectionDetail() {
  const { id } = useParams<Params>();
  const navigate = useNavigate();
  // Nível atual persistido por inspeção: ao voltar do PointCapture (remontagem) o usuário
  // permanece no nível que estava tratando, em vez de cair na raiz (Setores).
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(() =>
    id ? sessionStorage.getItem(`campo-node-${id}`) : null,
  );
  const [showAddNode, setShowAddNode] = useState(false);
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [addingPoint, setAddingPoint] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Backup por setor: ao trocar de setor, sugere exportar as fotos zipadas para o
  // aparelho (backup alternativo). Não interfere no upload ao Supabase.
  const [exportPrompt, setExportPrompt] = useState<{ setorId: string; setorNome: string } | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [manualExportMsg, setManualExportMsg] = useState<string | null>(null);
  const prevSetorRef = useRef<string | null>(null);
  const promptedSetoresRef = useRef<Set<string>>(new Set());

  const inspection = useLiveQuery(() => (id ? db.inspections.get(id) : undefined), [id]);
  const allNodes = useLiveQuery(
    () => (id ? db.nodes.where("inspection_id").equals(id).toArray() : []),
    [id],
  );
  const allPoints =
    useLiveQuery(() => (id ? db.points.where("inspection_id").equals(id).toArray() : []), [id]) ??
    [];
  const allFindingsRaw = useLiveQuery(async () => {
    if (!id) return [];
    const pointIds = (await db.points.where("inspection_id").equals(id).primaryKeys()) as string[];
    if (pointIds.length === 0) return [];
    return db.findings.where("point_id").anyOf(pointIds).toArray();
  }, [id]);
  // Fallback estável: sem o useMemo, `?? []` criaria um array novo a cada render
  // enquanto a query carrega, recomputando findingsByPoint à toa.
  const allFindings = useMemo(() => allFindingsRaw ?? [], [allFindingsRaw]);

  const pendingSyncCount = useLiveQuery(
    async () => {
      if (!id) return 0;
      const unsyncedPoints = await db.points
        .where("inspection_id")
        .equals(id)
        .filter((p) => !p._synced)
        .count();
      if (unsyncedPoints > 0) return unsyncedPoints;
      const allPointIds = (await db.points
        .where("inspection_id")
        .equals(id)
        .primaryKeys()) as string[];
      if (allPointIds.length === 0) return 0;
      return db.findings
        .where("point_id")
        .anyOf(allPointIds)
        .filter((f) => !f._synced)
        .count();
    },
    [id],
    0,
  );

  const nodes = useMemo(() => allNodes ?? [], [allNodes]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Mapa pai → filhos, para varrer descendentes nas contagens agregadas.
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, LocalNode[]>();
    for (const n of nodes) {
      const k = n.parent_id ?? null;
      const arr = map.get(k);
      if (arr) arr.push(n);
      else map.set(k, [n]);
    }
    return map;
  }, [nodes]);

  const findingsByPoint = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of allFindings) m.set(f.point_id, (m.get(f.point_id) ?? 0) + 1);
    return m;
  }, [allFindings]);

  function descendentes(nodeId: string): Set<string> {
    const out = new Set<string>([nodeId]);
    const fila = [nodeId];
    while (fila.length) {
      const cur = fila.pop()!;
      for (const c of childrenByParent.get(cur) ?? []) {
        if (!out.has(c.id)) {
          out.add(c.id);
          fila.push(c.id);
        }
      }
    }
    return out;
  }

  function contagem(nodeId: string): { pontos: number; achados: number } {
    const ids = descendentes(nodeId);
    let pontos = 0;
    let achados = 0;
    for (const p of allPoints) {
      if (ids.has(p.node_id)) {
        pontos += 1;
        achados += findingsByPoint.get(p.id) ?? 0;
      }
    }
    return { pontos, achados };
  }

  const path = currentNodeId ? (nodePath(currentNodeId, nodes) as LocalNode[]) : [];
  const currentNode = currentNodeId ? (nodeById.get(currentNodeId) ?? null) : null;
  const childLevel = proximoNivel(currentNode?.nivel ?? null);
  const children = filhosDoNo(currentNodeId, nodes);
  const pontosAqui = allPoints
    .filter((p) => p.node_id === currentNodeId)
    .sort((a, b) => a.ordem - b.ordem);

  const isReadOnly = inspection?.status !== "em_andamento";
  const podeColetar = !!currentNodeId && !isReadOnly;

  // Setor (raiz do caminho) do nó atual. Ao mudar de setor, se o setor anterior
  // tinha fotos, sugere o backup zipado uma única vez por setor na sessão.
  const currentSetorId = currentNodeId ? (setorDoNo(currentNodeId, nodes)?.id ?? null) : null;
  useEffect(() => {
    const prev = prevSetorRef.current;
    prevSetorRef.current = currentSetorId;
    if (!prev || prev === currentSetorId) return;
    if (promptedSetoresRef.current.has(prev)) return;
    let cancelled = false;
    (async () => {
      const setorPointIds = allPoints
        .filter((p) => setorDoNo(p.node_id, nodes)?.id === prev)
        .map((p) => p.id);
      if (setorPointIds.length === 0) return;
      const count = await db.photos.where("point_id").anyOf(setorPointIds).count();
      if (cancelled || count === 0) return;
      promptedSetoresRef.current.add(prev);
      setExportResult(null);
      setExportPrompt({ setorId: prev, setorNome: nodes.find((n) => n.id === prev)?.nome ?? "setor" });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSetorId]);

  async function handleManualExport() {
    if (!currentSetorId || !inspection || exporting) return;
    setExporting(true);
    setManualExportMsg(null);
    try {
      const r = await exportSetorFotos({ inspection, setorNodeId: currentSetorId, allNodes: nodes });
      setManualExportMsg(
        `${r.fotos} foto${r.fotos !== 1 ? "s" : ""} exportada${r.fotos !== 1 ? "s" : ""}` +
          (r.faltando > 0 ? ` · ${r.faltando} indisponível(is)` : ""),
      );
    } catch {
      setManualExportMsg("Falha ao exportar. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportSetor() {
    if (!exportPrompt || !inspection || exporting) return;
    setExporting(true);
    setExportResult(null);
    try {
      const r = await exportSetorFotos({
        inspection,
        setorNodeId: exportPrompt.setorId,
        allNodes: nodes,
      });
      setExportResult(
        `${r.fotos} foto${r.fotos !== 1 ? "s" : ""} exportada${r.fotos !== 1 ? "s" : ""}` +
          (r.faltando > 0 ? ` · ${r.faltando} indisponível(is)` : ""),
      );
    } catch (e) {
      console.error("Falha ao exportar fotos do setor:", e);
      setExportResult("Falha ao exportar. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  // Persiste o nível atual para sobreviver à navegação de ida/volta ao PointCapture.
  useEffect(() => {
    if (!id) return;
    if (currentNodeId) sessionStorage.setItem(`campo-node-${id}`, currentNodeId);
    else sessionStorage.removeItem(`campo-node-${id}`);
  }, [currentNodeId, id]);

  // Se o nó persistido não existe mais (ex.: excluído), volta para a raiz.
  useEffect(() => {
    if (allNodes === undefined) return;
    if (currentNodeId && !allNodes.some((n) => n.id === currentNodeId)) {
      setCurrentNodeId(null);
    }
  }, [allNodes, currentNodeId]);

  async function handleAddPoint() {
    if (!id || !currentNodeId || addingPoint) return;
    setAddingPoint(true);
    try {
      const pointId = generateId();
      const now = new Date().toISOString();
      const existing = await db.points.where("node_id").equals(currentNodeId).count();
      const point = {
        id: pointId,
        inspection_id: id,
        node_id: currentNodeId,
        titulo: null,
        observacoes: null,
        ordem: existing,
        created_at: now,
        updated_at: now,
        _synced: false,
      };
      await db.points.add(point);
      await enqueue("points", "insert", point, pointId);
      navigate(`/inspecoes/${id}/ponto/${pointId}`);
    } finally {
      setAddingPoint(false);
    }
  }

  async function handleReopen() {
    if (!inspection || reopening) return;
    setReopening(true);
    try {
      const updated = { ...inspection, status: "em_andamento" as const, _synced: false };
      await db.inspections.put(updated);
      await enqueue("inspections", "update", updated, inspection.id);
    } finally {
      setReopening(false);
    }
  }

  async function handleArchiveInspection() {
    if (!id || archiving) return;
    setArchiving(true);
    try {
      const updated = { ...inspection!, arquivada_campo: true, _synced: false };
      await db.inspections.put(updated);
      await enqueue("inspections", "update", { id, arquivada_campo: true }, id);
      sessionStorage.removeItem(`campo-node-${id}`);
      navigate("/inspecoes", { replace: true });
    } catch (e) {
      console.error("Falha ao arquivar inspeção:", e);
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  }

  if (inspection === undefined || allNodes === undefined) return null;
  if (!inspection) {
    return (
      <div className="p-8 text-center text-slate-400">
        Inspeção não encontrada.{" "}
        <button onClick={() => navigate("/inspecoes")} className="text-blue-400 underline">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          type="button"
          onClick={() => navigate("/inspecoes")}
          className="p-2.5 -m-1 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{inspection.titulo}</h1>
          {(inspection.cliente || inspection.local) && (
            <p className="text-xs text-slate-400 truncate">
              {[inspection.cliente, inspection.local].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {isReadOnly ? (
          <button
            type="button"
            onClick={handleReopen}
            disabled={reopening}
            className="flex items-center gap-1 px-3 min-h-[44px] rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-semibold disabled:opacity-40 shrink-0"
            aria-label="Reabrir inspeção para edição"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reabrir
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowEditMeta(true)}
            className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 shrink-0 flex items-center justify-center"
            aria-label="Editar inspeção"
          >
            <Pencil className="h-5 w-5 text-slate-400" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowArchiveConfirm(true)}
          className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-400 shrink-0 flex items-center justify-center"
          aria-label="Arquivar no campo"
        >
          <Archive className="h-5 w-5" />
        </button>
        {!inspection._synced && (
          <span className="text-xs text-yellow-500 shrink-0">● não sync</span>
        )}
      </header>

      {isReadOnly && (pendingSyncCount ?? 0) > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/30 border-b border-amber-700/40 text-amber-300 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {pendingSyncCount} alteração{(pendingSyncCount ?? 0) > 1 ? "ões" : ""} pendente
            {(pendingSyncCount ?? 0) > 1 ? "s" : ""} não enviada
            {(pendingSyncCount ?? 0) > 1 ? "s" : ""} ao RTI. Reabra para sincronizar.
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Breadcrumb — drill up */}
        <nav className="flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap pb-1 min-h-[44px]">
          <button
            type="button"
            onClick={() => setCurrentNodeId(null)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 min-h-[40px] ${
              currentNodeId === null
                ? "font-semibold text-slate-100 bg-slate-800"
                : "text-slate-400 active:bg-slate-800"
            }`}
          >
            <Home className="h-4 w-4 shrink-0" /> Setores
          </button>
          {path.map((n, i) => {
            const ultimo = i === path.length - 1;
            return (
              <span key={n.id} className="inline-flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                <button
                  type="button"
                  onClick={() => setCurrentNodeId(n.id)}
                  className={`rounded-lg px-2.5 min-h-[40px] ${
                    ultimo
                      ? "font-semibold text-slate-100 bg-slate-800"
                      : "text-slate-400 active:bg-slate-800"
                  }`}
                  title={`${labelDoTipo(n.nivel)}: ${n.nome}`}
                >
                  {n.nome}
                </button>
              </span>
            );
          })}
        </nav>

        {/* Botão de backup manual de fotos — sempre visível dentro de um setor */}
        {currentSetorId && (
          <div className="space-y-1">
            <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
              <span className="text-xs text-slate-400">
                Setor:{" "}
                <span className="font-medium text-slate-300">
                  {nodes.find((n) => n.id === currentSetorId)?.nome ?? "—"}
                </span>
              </span>
              <button
                type="button"
                onClick={handleManualExport}
                disabled={exporting}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 active:text-blue-200 disabled:opacity-40 min-h-[36px] px-2"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Exportando…" : "Exportar fotos"}
              </button>
            </div>
            {manualExportMsg && (
              <p className="text-xs text-emerald-400 px-1">{manualExportMsg}</p>
            )}
          </div>
        )}

        {/* Ação primária — coletar no nó atual */}
        {!isReadOnly && (
          <div>
            {podeColetar ? (
              <button
                onClick={handleAddPoint}
                disabled={addingPoint}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 h-12 text-base font-semibold"
              >
                <Camera className="h-5 w-5" />
                {addingPoint ? "Criando…" : "Novo ponto de coleta aqui"}
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/40 p-3 text-center text-xs text-slate-400">
                Entre em um <strong className="text-slate-300">Setor</strong> (ou crie um abaixo)
                para começar a coletar.
              </div>
            )}
          </div>
        )}

        {/* Filhos do nó atual — drill down */}
        {childLevel && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {labelDoTipo(childLevel)}s{children.length > 0 ? ` (${children.length})` : ""}
              </h2>
            </div>

            <div className="space-y-2">
                {children.map((n) => {
                  const c = contagem(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setCurrentNodeId(n.id)}
                      className="w-full flex items-center gap-3 rounded-xl bg-slate-800 hover:bg-slate-700/70 active:bg-slate-700 active:scale-[0.98] transition-all p-3 text-left"
                    >
                      <FolderTree className="h-5 w-5 text-blue-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-tight truncate">{n.nome}</div>
                        <div className="text-xs text-slate-400">
                          {c.pontos} ponto{c.pontos !== 1 ? "s" : ""} · {c.achados} achado
                          {c.achados !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500 shrink-0" />
                    </button>
                  );
                })}
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => setShowAddNode(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 hover:border-blue-500 hover:bg-slate-800/60 active:bg-slate-800 py-3 text-sm font-medium text-slate-400 hover:text-blue-400 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar {labelDoTipo(childLevel)}
                </button>
              )}
          </section>
        )}

        {/* Pontos coletados no nó atual */}
        {currentNodeId && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Pontos coletados aqui{pontosAqui.length > 0 ? ` (${pontosAqui.length})` : ""}
            </h2>
            {pontosAqui.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 bg-slate-800/30 p-4 text-center text-xs text-slate-500">
                Nenhum ponto neste nível ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {pontosAqui.map((pt) => {
                  const nAchados = findingsByPoint.get(pt.id) ?? 0;
                  return (
                    <Link
                      key={pt.id}
                      to={`/inspecoes/${id}/ponto/${pt.id}`}
                      className="flex items-center gap-3 rounded-xl bg-slate-700 hover:bg-slate-600/70 active:bg-slate-600 active:scale-[0.98] transition-all p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-tight truncate">
                          {pt.titulo ?? `Ponto ${pt.ordem + 1}`}
                        </div>
                        <div className="text-xs text-slate-400">
                          {nAchados} achado{nAchados !== 1 ? "s" : ""}
                          {!pt._synced && <span className="text-yellow-500"> · não sync</span>}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {showAddNode && (
        <AddNodeModal
          inspectionId={id!}
          parentId={currentNodeId}
          allNodes={nodes}
          onClose={() => setShowAddNode(false)}
        />
      )}
      {showEditMeta && (
        <EditMetadataModal inspection={inspection} onClose={() => setShowEditMeta(false)} />
      )}
      {exportPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold">Fazer backup das fotos?</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Você saiu do setor{" "}
                  <span className="text-slate-200 font-medium">{exportPrompt.setorNome}</span>. Quer
                  exportar as fotos dele zipadas para o aparelho? É um backup à parte — o envio ao
                  RTI continua normal.
                </p>
                {exportResult && (
                  <p className="text-xs text-emerald-400 mt-2">{exportResult}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setExportPrompt(null)}
                disabled={exporting}
                className="flex-1 rounded-lg border border-slate-600 py-3 text-sm disabled:opacity-40"
              >
                {exportResult ? "Fechar" : "Agora não"}
              </button>
              {!exportResult && (
                <button
                  onClick={handleExportSetor}
                  disabled={exporting}
                  className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 text-sm font-semibold"
                >
                  {exporting ? "Exportando…" : "Exportar .zip"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Archive className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold">Arquivar no campo?</h2>
                <p className="text-sm text-slate-400 mt-1">
                  <span className="text-slate-200 font-medium">{inspection.titulo}</span> vai sair
                  da lista do celular, mas fica salva no servidor. Dá pra trazer de volta pelo app
                  quando necessário.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                disabled={archiving}
                className="flex-1 rounded-lg border border-slate-600 py-3 text-sm disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleArchiveInspection}
                disabled={archiving}
                className="flex-1 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 py-3 text-sm font-semibold"
              >
                {archiving ? "Arquivando…" : "Arquivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Portão de saída (spec cofre e portão §4): checklist automático sobre os dados
// locais. Função PURA — recebe projeções mínimas, devolve pendências tipadas.
// Consultivo, não bloqueante: a UI decide o que fazer com a lista.

export type RevisaoInput = {
  nodes: Array<{ id: string; parent_id: string | null; nivel: string; nome: string }>;
  points: Array<{ id: string; node_id: string; titulo: string | null }>;
  findings: Array<{ id: string; point_id: string; modo_falha_id: string | null; descricao: string }>;
  photos: Array<{
    id: string;
    point_id: string;
    finding_id?: string | null;
    blob: boolean;
    _synced: boolean;
  }>;
  queue: { pending: number; failed: number };
};

export type Pendencia =
  | { tipo: "setor_sem_ponto"; nodeId: string; nome: string }
  | { tipo: "ponto_sem_foto"; pointId: string; titulo: string | null }
  | { tipo: "foto_sem_vinculo"; pointId: string; titulo: string | null; count: number }
  | { tipo: "sync_pendente"; count: number }
  | { tipo: "sync_falha"; count: number }
  | { tipo: "so_no_aparelho"; fotos: number };

export function computePendencias(input: RevisaoInput): Pendencia[] {
  const out: Pendencia[] = [];
  const { nodes, points, findings, photos, queue } = input;

  // Setor sem ponto: nenhum ponto cujo caminho suba até este setor (raiz).
  const parentOf = new Map(nodes.map((n) => [n.id, n.parent_id]));
  const setorDe = (nodeId: string): string | null => {
    let cur: string | null = nodeId;
    let last: string | null = null;
    let guard = 0;
    while (cur && guard++ < 10) {
      last = cur;
      cur = parentOf.get(cur) ?? null;
    }
    return last;
  };
  const setoresComPonto = new Set(points.map((p) => setorDe(p.node_id)));
  for (const n of nodes) {
    if (n.parent_id === null && !setoresComPonto.has(n.id)) {
      out.push({ tipo: "setor_sem_ponto", nodeId: n.id, nome: n.nome });
    }
  }

  const photosByPoint = new Map<string, RevisaoInput["photos"]>();
  for (const ph of photos) {
    const arr = photosByPoint.get(ph.point_id) ?? [];
    arr.push(ph);
    photosByPoint.set(ph.point_id, arr);
  }
  const findingsByPoint = new Map<string, number>();
  for (const f of findings) {
    findingsByPoint.set(f.point_id, (findingsByPoint.get(f.point_id) ?? 0) + 1);
  }

  for (const p of points) {
    const phs = photosByPoint.get(p.id) ?? [];
    if (phs.length === 0) {
      out.push({ tipo: "ponto_sem_foto", pointId: p.id, titulo: p.titulo });
      continue;
    }
    // Vínculo foto↔NC só é cobrado quando há ambiguidade real (2+ NCs no ponto).
    if ((findingsByPoint.get(p.id) ?? 0) >= 2) {
      const soltas = phs.filter((ph) => !ph.finding_id).length;
      if (soltas > 0) {
        out.push({ tipo: "foto_sem_vinculo", pointId: p.id, titulo: p.titulo, count: soltas });
      }
    }
  }

  if (queue.pending > 0) out.push({ tipo: "sync_pendente", count: queue.pending });
  if (queue.failed > 0) out.push({ tipo: "sync_falha", count: queue.failed });

  const locais = photos.filter((ph) => ph.blob && !ph._synced).length;
  if (locais > 0) out.push({ tipo: "so_no_aparelho", fotos: locais });

  return out;
}

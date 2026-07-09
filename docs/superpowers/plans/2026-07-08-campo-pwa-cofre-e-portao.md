# Campo PWA — Cofre e Portão: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blindar a coleta offline do campo-pwa (persistência garantida, backup ZIP reimportável, portão de saída) e torná-la ergonômica para campo (modo luva, modo sol, GPS, retomada) — spec em [`docs/superpowers/specs/2026-07-08-campo-pwa-cofre-e-portao-design.md`](../specs/2026-07-08-campo-pwa-cofre-e-portao-design.md).

**Architecture:** Toda lógica nova nasce como função pura em `campo-pwa/src/lib/` (testável com vitest, sem aparelho), consumida por páginas/componentes React finos. Uma migration adiciona `finding_id` + GPS em `field_photos`; o Dexie sobe para v3. Nenhuma mudança no fluxo de sync existente além de campos novos no payload de foto.

**Tech Stack:** React 19 + react-router 7, Dexie 4 (IndexedDB), JSZip, vitest + fake-indexeddb (novo), Supabase (migration via MCP), Tailwind v4.

**Convenções do projeto que este plano respeita:** commits locais livres, **nunca `git push`** sem ordem explícita; migrations aplicadas via MCP do Supabase (`apply_migration`) **e** versionadas em `supabase/migrations/`; `types.ts` atualizado à mão; dev server na porta 57010 é do usuário (não parar/reiniciar).

---

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `campo-pwa/vitest.config.ts` (novo) | Config de teste (env node, alias `@`, fake-indexeddb) |
| `campo-pwa/src/lib/storage-health.ts` (novo) | `persist()`/`estimate()` + formatação |
| `campo-pwa/src/lib/resume.ts` (novo) | Retomada de contexto (localStorage, expiry 12h) |
| `campo-pwa/src/lib/frequencia.ts` (novo) | Ordenação de modos de falha por uso local |
| `campo-pwa/src/lib/geo.ts` (novo) | Cache de posição GPS (não bloqueante) |
| `campo-pwa/src/lib/revisao.ts` (novo) | `computePendencias()` — coração do portão de saída |
| `campo-pwa/src/lib/backup.ts` (novo) | Export/import do ZIP de backup (manifest + dados + blobs) |
| `campo-pwa/src/pages/RevisaoVisita.tsx` (novo) | Tela do portão de saída |
| `campo-pwa/src/hooks/useTheme.ts` (novo) | Toggle modo sol |
| `campo-pwa/src/db/dexie.ts` | v3: índice `finding_id` em photos |
| `campo-pwa/src/sync/engine.ts` | Payload de foto com `finding_id` + GPS |
| `campo-pwa/src/pages/PointCapture.tsx` | Modo luva, vínculo foto↔NC, GPS, retomada |
| `campo-pwa/src/pages/InspectionList.tsx` | Banner "Continuar" + botão Restaurar backup |
| `campo-pwa/src/pages/InspectionDetail.tsx` | Botões Revisão + Backup no header |
| `campo-pwa/src/components/SyncStatus.tsx` | Estado de proteção + volume local |
| `campo-pwa/src/components/Layout.tsx` | `ensurePersistentStorage()` no boot |
| `campo-pwa/src/main.tsx` | Rota `/inspecoes/:id/revisao` |
| `campo-pwa/src/index.css` | CSS do modo sol |
| `packages/campo-core/src/types.ts` | `FieldPhoto` + finding_id/GPS |
| `src/lib/campo.ts:141` | Cópia app do `FieldPhoto` (drift conhecido — manter em sincronia) |
| `src/integrations/supabase/types.ts` | `field_photos` Row/Insert/Update |
| `supabase/migrations/20260708100000_field_photos_finding_gps.sql` (novo) | Migration |

---

### Task 1: Infra de teste no campo-pwa (vitest + fake-indexeddb)

**Files:**
- Modify: `campo-pwa/package.json`
- Create: `campo-pwa/vitest.config.ts`
- Create: `campo-pwa/src/test/setup.ts`
- Create: `campo-pwa/src/lib/__tests__/smoke.test.ts`

- [ ] **Step 1: Instalar devDependencies**

```bash
cd campo-pwa && npm i -D vitest fake-indexeddb
```

- [ ] **Step 2: Adicionar script de teste em `campo-pwa/package.json`**

Em `"scripts"`, adicionar:

```json
"test": "vitest run"
```

- [ ] **Step 3: Criar `campo-pwa/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Criar `campo-pwa/src/test/setup.ts`**

```ts
// IndexedDB fake para testar código Dexie em Node.
import "fake-indexeddb/auto";
```

- [ ] **Step 5: Criar teste smoke `campo-pwa/src/lib/__tests__/smoke.test.ts`**

```ts
import { describe, expect, it } from "vitest";

describe("infra de teste", () => {
  it("roda vitest com indexedDB fake disponível", () => {
    expect(typeof indexedDB).toBe("object");
  });
});
```

- [ ] **Step 6: Rodar e verificar que passa**

Run: `cd campo-pwa && npm test`
Expected: `1 passed`

- [ ] **Step 7: Commit**

```bash
git add campo-pwa/package.json campo-pwa/package-lock.json campo-pwa/vitest.config.ts campo-pwa/src/test/setup.ts campo-pwa/src/lib/__tests__/smoke.test.ts
git commit -m "test(campo-pwa): infra vitest + fake-indexeddb"
```

---

### Task 2: Migration `field_photos.finding_id` + GPS, e tipos

**Files:**
- Create: `supabase/migrations/20260708100000_field_photos_finding_gps.sql`
- Modify: `packages/campo-core/src/types.ts` (tipo `FieldPhoto`)
- Modify: `src/lib/campo.ts:141` (cópia app de `FieldPhoto`)
- Modify: `src/integrations/supabase/types.ts` (`field_photos`)

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- Vínculo foto→achado (evidência certa na NC certa) + geolocalização da captura.
-- Spec: docs/superpowers/specs/2026-07-08-campo-pwa-cofre-e-portao-design.md §5.2, §6.1
-- finding_id é NULLABLE: fotos antigas e fotos "gerais do ponto" continuam válidas.
-- ON DELETE SET NULL: apagar a NC não apaga a foto (a evidência volta a ser do ponto).

ALTER TABLE public.field_photos
  ADD COLUMN IF NOT EXISTS finding_id uuid REFERENCES public.field_findings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gps_lat double precision,
  ADD COLUMN IF NOT EXISTS gps_lng double precision,
  ADD COLUMN IF NOT EXISTS gps_accuracy double precision;

CREATE INDEX IF NOT EXISTS idx_field_photos_finding_id ON public.field_photos(finding_id);
```

- [ ] **Step 2: Aplicar via MCP do Supabase**

Chamar `apply_migration` (projeto `fumwovtzyhxrjhkjzujs`) com nome `field_photos_finding_gps` e o SQL acima.
Expected: sucesso; conferir com `execute_sql`: `SELECT column_name FROM information_schema.columns WHERE table_name='field_photos';` deve listar `finding_id`, `gps_lat`, `gps_lng`, `gps_accuracy`.

- [ ] **Step 3: Atualizar `packages/campo-core/src/types.ts`**

No tipo `FieldPhoto`, após `ordem: number;`, adicionar:

```ts
  /** NC evidenciada por esta foto (null = foto geral do ponto ou pré-migração). */
  finding_id: string | null;
  /** Posição no momento da captura (null = GPS indisponível/negado). */
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
```

- [ ] **Step 4: Atualizar a cópia do app em `src/lib/campo.ts`** (tipo `FieldPhoto`, linha ~141)

Adicionar os mesmos 4 campos, idênticos ao Step 3.

- [ ] **Step 5: Atualizar `src/integrations/supabase/types.ts`**

Em `field_photos`: adicionar em `Row`:

```ts
          finding_id: string | null
          gps_lat: number | null
          gps_lng: number | null
          gps_accuracy: number | null
```

Em `Insert` e `Update`, as versões opcionais:

```ts
          finding_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          gps_accuracy?: number | null
```

E em `Relationships`, o novo FK:

```ts
          {
            foreignKeyName: "field_photos_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "field_findings"
            referencedColumns: ["id"]
          },
```

- [ ] **Step 6: Typecheck dos dois apps**

Run: `npx tsc -b --noEmit 2>$null; cd campo-pwa && npx tsc -b --noEmit`
Expected: 0 erros novos (erros pré-existentes do app principal são conhecidos — comparar antes/depois se houver dúvida).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260708100000_field_photos_finding_gps.sql packages/campo-core/src/types.ts src/lib/campo.ts src/integrations/supabase/types.ts
git commit -m "feat(campo): field_photos ganha finding_id + GPS (migration aplicada via MCP)"
```

---

### Task 3: Dexie v3 + payload de foto no engine

**Files:**
- Modify: `campo-pwa/src/db/dexie.ts`
- Modify: `campo-pwa/src/sync/engine.ts` (função `uploadPhoto`)

- [ ] **Step 1: Subir o schema local para v3 em `campo-pwa/src/db/dexie.ts`**

Manter o bloco `this.version(2).stores({...})` intacto (histórico de upgrade) e adicionar logo abaixo:

```ts
    this.version(3).stores({
      inspections: "id, _synced, status, responsavel_id, created_at",
      nodes: "id, inspection_id, parent_id, _synced",
      points: "id, inspection_id, node_id, _synced",
      findings: "id, point_id, _synced",
      photos: "id, point_id, finding_id, _synced",
      modos_falha: "id, categoria",
      sync_queue: "++id, created_at, attempts, table",
    });
```

(Campos novos não indexados — `gps_*` — não precisam constar no `stores`; Dexie é schemaless fora dos índices. Registros v2 existentes ficam com `finding_id === undefined`, tratado como "sem vínculo".)

- [ ] **Step 2: Incluir os campos novos no upsert de `uploadPhoto` em `engine.ts`**

No `supabase.from("field_photos").upsert({...})`, adicionar após `ordem: photo.ordem,`:

```ts
    finding_id: photo.finding_id ?? null,
    gps_lat: photo.gps_lat ?? null,
    gps_lng: photo.gps_lng ?? null,
    gps_accuracy: photo.gps_accuracy ?? null,
```

(`?? null` cobre registros criados antes do v3, onde os campos são `undefined`. `uploadPhoto` lê o registro **atual** do Dexie — vínculos feitos depois do enqueue e antes do upload sobem certos de graça.)

- [ ] **Step 3: Ajustar o `downloadInspectionsData` para baixar os campos novos**

No select de `field_photos` em `engine.ts`, trocar a lista de colunas por:

```ts
          .select("id, point_id, finding_id, gps_lat, gps_lng, gps_accuracy, file_path, file_name, legenda, ordem, created_at")
```

- [ ] **Step 4: Typecheck + build do PWA**

Run: `cd campo-pwa && npx tsc -b --noEmit && npm run build`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add campo-pwa/src/db/dexie.ts campo-pwa/src/sync/engine.ts
git commit -m "feat(campo-pwa): Dexie v3 + sync de finding_id/GPS em fotos"
```

---

### Task 4: `storage-health.ts` — persistência garantida + volume local

**Files:**
- Create: `campo-pwa/src/lib/storage-health.ts`
- Test: `campo-pwa/src/lib/__tests__/storage-health.test.ts`
- Modify: `campo-pwa/src/components/Layout.tsx`
- Modify: `campo-pwa/src/components/SyncStatus.tsx`

- [ ] **Step 1: Teste falhando para `formatBytes` e `storageWarning`**

```ts
import { describe, expect, it } from "vitest";
import { formatBytes, storageWarning } from "@/lib/storage-health";

describe("formatBytes", () => {
  it("formata MB e GB legíveis", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(180 * 1024 * 1024)).toBe("180 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2,5 GB");
  });
});

describe("storageWarning", () => {
  it("null quando há espaço de sobra", () => {
    expect(storageWarning({ usage: 100e6, quota: 10e9 })).toBeNull();
  });
  it("avisa quando resta menos de 500MB ou menos de 10% da cota", () => {
    expect(storageWarning({ usage: 9.8e9, quota: 10e9 })).toMatch(/quase cheio/i);
    expect(storageWarning({ usage: 0.95e9, quota: 1e9 })).toMatch(/quase cheio/i);
  });
  it("null quando estimate indisponível", () => {
    expect(storageWarning(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd campo-pwa && npm test`
Expected: FAIL — módulo `@/lib/storage-health` não existe.

- [ ] **Step 3: Implementar `campo-pwa/src/lib/storage-health.ts`**

```ts
// Saúde do armazenamento local: persistência garantida (anti-eviction do SO)
// e visibilidade do volume que existe SÓ no aparelho.
// Spec §3.1: nunca bloquear a coleta; degradar avisando.

export type StorageEstimateLite = { usage: number; quota: number };

const LOW_ABS_BYTES = 500 * 1024 * 1024; // 500 MB
const LOW_PCT = 0.1;

export function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1).replace(".", ",").replace(",0", "")} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Mensagem de alerta quando o aparelho está enchendo; null quando ok/desconhecido. */
export function storageWarning(est: StorageEstimateLite | null): string | null {
  if (!est || !est.quota) return null;
  const free = est.quota - est.usage;
  if (free < LOW_ABS_BYTES || free / est.quota < LOW_PCT) {
    return `Armazenamento quase cheio (${formatBytes(free)} livres) — faça backup e sincronize`;
  }
  return null;
}

/** Pede persistência ao SO. Retorna o estado final (true = protegido contra eviction). */
export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageEstimate(): Promise<StorageEstimateLite | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (usage == null || quota == null) return null;
    return { usage, quota };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Rodar testes, ver passar**

Run: `cd campo-pwa && npm test`
Expected: PASS.

- [ ] **Step 5: Chamar no boot (`Layout.tsx`)**

No `useEffect` que roda quando `checked` vira true, antes do `return startConnectivityWatcher();`:

```ts
  useEffect(() => {
    if (!checked) return;
    void ensurePersistentStorage();
    return startConnectivityWatcher();
  }, [checked]);
```

Com import: `import { ensurePersistentStorage } from "@/lib/storage-health";`

- [ ] **Step 6: Exibir saúde no `SyncStatus.tsx`**

Adicionar no topo do componente (após `counts`):

```ts
  const [health, setHealth] = useState<{ protegido: boolean; aviso: string | null }>({
    protegido: true, // otimista até a 1ª leitura, para não piscar aviso falso
    aviso: null,
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      const protegido = await ensurePersistentStorage();
      const aviso = storageWarning(await getStorageEstimate());
      if (alive) setHealth({ protegido, aviso });
    })();
    return () => {
      alive = false;
    };
  }, []);
  // Bytes de foto que existem SÓ no aparelho (blob ainda não sincronizado).
  const localBytes =
    useLiveQuery(async () => {
      const unsynced = await db.photos.where("_synced").equals(0).toArray();
      return unsynced.reduce((acc, p) => acc + (p.blob?.size ?? 0), 0);
    }, []) ?? 0;
```

Imports novos: `useEffect` (react), `ensurePersistentStorage, getStorageEstimate, storageWarning, formatBytes` de `@/lib/storage-health`.

**Atenção Dexie:** `where("_synced").equals(0)` não funciona com boolean — usar `db.photos.filter((p) => !p._synced && !!p.blob).toArray()` no lugar (booleans não são chaves indexáveis no IndexedDB; o filtro linear é aceitável no volume local).

No branch offline (`!isOnline`), acrescentar ao texto quando `localBytes > 0`: `· ${formatBytes(localBytes)} só neste aparelho`. Abaixo do banner (qualquer branch), quando `health.aviso` existir, renderizar:

```tsx
      {health.aviso && (
        <p className="px-3 py-1 bg-red-950/60 text-red-200 text-[11px]">{health.aviso}</p>
      )}
      {!health.protegido && (
        <p className="px-3 py-1 bg-yellow-950/60 text-yellow-200 text-[11px]">
          Armazenamento não protegido pelo sistema — instale o app na tela inicial e evite
          desinstalar o navegador com dados pendentes.
        </p>
      )}
```

(Envolver o retorno de cada branch num fragmento `<>` com o banner principal + esses avisos.)

- [ ] **Step 7: Typecheck + testes**

Run: `cd campo-pwa && npx tsc -b --noEmit && npm test`
Expected: verde.

- [ ] **Step 8: Commit**

```bash
git add campo-pwa/src/lib/storage-health.ts campo-pwa/src/lib/__tests__/storage-health.test.ts campo-pwa/src/components/Layout.tsx campo-pwa/src/components/SyncStatus.tsx
git commit -m "feat(campo-pwa): persistência garantida + saúde do armazenamento no banner"
```

---

### Task 5: Retomada de contexto

**Files:**
- Create: `campo-pwa/src/lib/resume.ts`
- Test: `campo-pwa/src/lib/__tests__/resume.test.ts`
- Modify: `campo-pwa/src/pages/PointCapture.tsx` (gravar posição)
- Modify: `campo-pwa/src/pages/InspectionList.tsx` (banner "Continuar")

- [ ] **Step 1: Teste falhando**

```ts
import { describe, expect, it } from "vitest";
import { saveResume, getResume, clearResume, type ResumePoint } from "@/lib/resume";

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const point: ResumePoint = {
  inspectionId: "i1",
  label: "Subestação 2 → QGBT-03",
  path: "/inspecoes/i1/ponto/p1",
  at: new Date("2026-07-08T10:00:00Z").toISOString(),
};

describe("resume", () => {
  it("salva e recupera dentro da janela de 12h", () => {
    const s = fakeStorage();
    saveResume(point, s);
    const got = getResume(new Date("2026-07-08T18:00:00Z").getTime(), s);
    expect(got?.path).toBe("/inspecoes/i1/ponto/p1");
  });
  it("expira após 12h", () => {
    const s = fakeStorage();
    saveResume(point, s);
    expect(getResume(new Date("2026-07-09T01:00:00Z").getTime(), s)).toBeNull();
  });
  it("clearResume remove", () => {
    const s = fakeStorage();
    saveResume(point, s);
    clearResume(s);
    expect(getResume(Date.now(), s)).toBeNull();
  });
  it("tolera JSON corrompido", () => {
    const s = fakeStorage();
    s.setItem("campo-resume", "{lixo");
    expect(getResume(Date.now(), s)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd campo-pwa && npm test` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `campo-pwa/src/lib/resume.ts`**

```ts
// Retomada de contexto: última posição de trabalho (inspeção→ponto), com expiry.
// Spec §6.2. Sem mudança de schema — localStorage basta.

const KEY = "campo-resume";
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h

export type ResumePoint = {
  inspectionId: string;
  /** Texto humano do banner: "Subestação 2 → QGBT-03". */
  label: string;
  /** Rota completa para navegar de volta. */
  path: string;
  at: string; // ISO
};

export function saveResume(p: ResumePoint, storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage cheio/indisponível — retomada é conveniência, nunca erro */
  }
}

export function getResume(now: number = Date.now(), storage: Storage = localStorage): ResumePoint | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ResumePoint;
    if (!p?.path || !p?.at) return null;
    if (now - Date.parse(p.at) > MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearResume(storage: Storage = localStorage): void {
  try {
    storage.removeItem(KEY);
  } catch {
    /* idem */
  }
}
```

- [ ] **Step 4: Rodar testes, ver passar** — `cd campo-pwa && npm test` → PASS.

- [ ] **Step 5: Gravar posição no `PointCapture.tsx`**

Adicionar `useEffect` (imports: `saveResume` de `@/lib/resume`, `useEffect` já importado):

```ts
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
```

- [ ] **Step 6: Banner "Continuar" no `InspectionList.tsx`**

No topo do componente da lista: `const resume = getResume();` (import de `@/lib/resume`; import `formatTimeAgo` de `@/hooks/useSyncStatus`). Logo abaixo do header da página, renderizar:

```tsx
      {resume && (
        <Link
          to={resume.path}
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-blue-900/40 border border-blue-700/50 px-4 py-3"
        >
          <RotateCcw className="h-5 w-5 text-blue-300 shrink-0" />
          <span className="text-sm text-blue-100 flex-1 min-w-0 truncate">
            Continuar: {resume.label}
            <span className="text-blue-300/80"> · {formatTimeAgo(new Date(resume.at))}</span>
          </span>
        </Link>
      )}
```

(Import `RotateCcw` de lucide-react e `Link` de react-router-dom se ainda não importados na página.)

- [ ] **Step 7: Typecheck + testes + verificação manual**

Run: `cd campo-pwa && npx tsc -b --noEmit && npm test`
Expected: verde. Manual (preview na 57010 se o usuário estiver com o PWA dev de pé, senão adiar pra bancada): abrir um ponto, voltar à lista → banner aparece.

- [ ] **Step 8: Commit**

```bash
git add campo-pwa/src/lib/resume.ts campo-pwa/src/lib/__tests__/resume.test.ts campo-pwa/src/pages/PointCapture.tsx campo-pwa/src/pages/InspectionList.tsx
git commit -m "feat(campo-pwa): retomada de contexto (banner Continuar)"
```

---

### Task 6: Ordenação de modos de falha por uso local

**Files:**
- Create: `campo-pwa/src/lib/frequencia.ts`
- Test: `campo-pwa/src/lib/__tests__/frequencia.test.ts`

- [ ] **Step 1: Teste falhando**

```ts
import { describe, expect, it } from "vitest";
import { contarUsoModos, maisUsados } from "@/lib/frequencia";
import type { RtiModoFalha } from "@/lib/types";

const modo = (id: string, label: string): RtiModoFalha => ({
  id,
  codigo: id,
  label,
  categoria: "Geral",
  descricao_padrao: "d",
  recomendacao_padrao: null,
  prioridade_sugerida: 3,
  tipo_execucao_sugerido: "os",
  normas: [],
  ativo: true,
  ordem: 0,
  created_at: "",
  updated_at: "",
});

const findings = [
  { modo_falha_id: "a" },
  { modo_falha_id: "a" },
  { modo_falha_id: "b" },
  { modo_falha_id: null },
];

describe("frequencia", () => {
  it("conta uso por modo, ignorando null", () => {
    const uso = contarUsoModos(findings);
    expect(uso.get("a")).toBe(2);
    expect(uso.get("b")).toBe(1);
    expect(uso.has("null")).toBe(false);
  });
  it("maisUsados retorna os top-N na ordem de uso, só modos existentes", () => {
    const modos = [modo("a", "A"), modo("b", "B"), modo("c", "C")];
    const top = maisUsados(modos, contarUsoModos(findings), 2);
    expect(top.map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("sem uso registrado, retorna vazio (não inventa destaque)", () => {
    expect(maisUsados([modo("a", "A")], new Map(), 4)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd campo-pwa && npm test` → FAIL.

- [ ] **Step 3: Implementar `campo-pwa/src/lib/frequencia.ts`**

```ts
// "Mais usados no topo": frequência local de modos de falha (spec §5.1).
// Conta sobre os achados existentes no Dexie — custo zero, sem telemetria.

import type { RtiModoFalha } from "@/lib/types";

export function contarUsoModos(findings: Array<{ modo_falha_id: string | null }>): Map<string, number> {
  const uso = new Map<string, number>();
  for (const f of findings) {
    if (!f.modo_falha_id) continue;
    uso.set(f.modo_falha_id, (uso.get(f.modo_falha_id) ?? 0) + 1);
  }
  return uso;
}

export function maisUsados(modos: RtiModoFalha[], uso: Map<string, number>, n: number): RtiModoFalha[] {
  return modos
    .filter((m) => (uso.get(m.id) ?? 0) > 0)
    .sort((a, b) => (uso.get(b.id) ?? 0) - (uso.get(a.id) ?? 0))
    .slice(0, n);
}
```

- [ ] **Step 4: Rodar testes, ver passar** — PASS.

- [ ] **Step 5: Commit**

```bash
git add campo-pwa/src/lib/frequencia.ts campo-pwa/src/lib/__tests__/frequencia.test.ts
git commit -m "feat(campo-pwa): frequência local de modos de falha"
```

---

### Task 7: GPS não bloqueante (`geo.ts`)

**Files:**
- Create: `campo-pwa/src/lib/geo.ts`
- Modify: `campo-pwa/src/pages/PointCapture.tsx` (warmup + carimbo na foto)

- [ ] **Step 1: Implementar `campo-pwa/src/lib/geo.ts`** (sem teste unitário — wrapper fino de API de browser; validação é de bancada/campo)

```ts
// GPS oportunista e NUNCA bloqueante (spec §6.1): warmup assíncrono alimenta um
// cache de módulo; a captura de foto lê o cache de forma síncrona. Se o fix ainda
// não chegou, a foto sai "sem localização" — jamais atrasa o disparo.

export type GpsFix = { lat: number; lng: number; accuracy: number; at: number };

const MAX_AGE_MS = 5 * 60_000; // técnico não anda 500m entre fotos
let cache: GpsFix | null = null;
let warming = false;

export function getGpsCached(now: number = Date.now()): GpsFix | null {
  if (cache && now - cache.at <= MAX_AGE_MS) return cache;
  return null;
}

/** Dispara (ou renova) o fix em background. Silencioso em erro/negado. */
export function warmupGps(): void {
  if (warming || !("geolocation" in navigator)) return;
  warming = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      cache = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: Date.now(),
      };
      warming = false;
    },
    () => {
      warming = false; // negado/timeout — segue sem GPS
    },
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
  );
}
```

- [ ] **Step 2: Warmup ao abrir o ponto e carimbo na foto (`PointCapture.tsx`)**

Import: `import { getGpsCached, warmupGps } from "@/lib/geo";`

No topo do componente `PointCapture` (junto dos hooks):

```ts
  // GPS: aquece o fix ao abrir o ponto; a foto lê o cache sem esperar.
  useEffect(() => {
    warmupGps();
  }, []);
```

Em `handlePhoto`, no objeto `photo` criado, adicionar após `ordem: existingCount,`:

```ts
      finding_id: null,
      gps_lat: getGpsCached()?.lat ?? null,
      gps_lng: getGpsCached()?.lng ?? null,
      gps_accuracy: getGpsCached()?.accuracy ?? null,
```

E ao final de `handlePhoto` (depois do `enqueue`), renovar o fix para a próxima: `warmupGps();`

- [ ] **Step 3: Typecheck** — `cd campo-pwa && npx tsc -b --noEmit` → verde.

- [ ] **Step 4: Commit**

```bash
git add campo-pwa/src/lib/geo.ts campo-pwa/src/pages/PointCapture.tsx
git commit -m "feat(campo-pwa): GPS oportunista por foto (nunca bloqueia a captura)"
```

---

### Task 8: Modo luva no formulário de NC + vínculo foto↔achado

**Files:**
- Modify: `campo-pwa/src/pages/PointCapture.tsx` (reescrita do `FindingForm`, `PhotoCard`, fluxo)

Meta de ergonomia (spec §5.1): caso comum = **foto → modo de falha → Salvar = 3 toques**, zero teclado.

- [ ] **Step 1: Reescrever `FindingForm` como seletor de botões grandes**

Substituir o componente `FindingForm` inteiro por:

```tsx
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
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-semibold flex-1">Nova não conformidade</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36">
        {top.length > 0 && !manual && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Mais usados</p>
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
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Descrição *</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                placeholder="Descreva a não conformidade..."
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recomendação</label>
              <textarea
                value={recomendacao}
                onChange={(e) => setRecomendacao(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Observação</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Rodapé fixo: prioridade + tipo + salvar — operável com o polegar */}
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
                tipoExecucao === "investimento" ? "bg-blue-600 border-blue-400" : "bg-slate-800 border-slate-700"
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
```

Imports novos no topo do arquivo: `useLiveQuery` já existe; adicionar `contarUsoModos, maisUsados` de `@/lib/frequencia`.

- [ ] **Step 2: Helper de vínculo foto↔achado (mesmo arquivo, acima do `FindingForm`)**

```ts
/** Vincula a foto à NC. Se a foto já sincronizou, enfileira o update; se ainda
 * está na fila, o uploadPhoto lê o registro atual do Dexie e o vínculo sobe junto. */
async function linkPhotoToFinding(photoId: string, findingId: string | null): Promise<void> {
  await db.photos.update(photoId, { finding_id: findingId });
  const p = await db.photos.get(photoId);
  if (p?._synced) {
    await enqueue("photos", "update", { id: photoId, finding_id: findingId }, photoId);
  }
}
```

- [ ] **Step 3: Fluxo — foto recém-tirada nasce vinculada**

Em `PointCapture`: trocar `const [showFindingForm, setShowFindingForm] = useState(false);` por

```ts
  const [findingFormPhoto, setFindingFormPhoto] = useState<string | null | false>(false);
  // false = fechado; null = aberto sem foto a vincular; string = photoId a vincular
```

Em `handlePhoto`, trocar o bloco final `if ((findings ?? []).length === 0) { setShowFindingForm(true); }` por:

```ts
    // Toda foto nova abre o formulário já apontando o vínculo (spec §5.2).
    // Se o técnico cancelar, o gate de saída continua cobrando.
    if ((findings ?? []).length === 0) {
      setFindingFormPhoto(photoId);
    }
```

No JSX, trocar `{showFindingForm && (<FindingForm ... onClose={() => setShowFindingForm(false)} />)}` por:

```tsx
      {findingFormPhoto !== false && (
        <FindingForm
          pointId={nodeId!}
          modos={modos}
          linkPhotoId={findingFormPhoto}
          onClose={() => setFindingFormPhoto(false)}
        />
      )}
```

E os dois botões que abriam o form (`Adicionar não conformidade` e o do modal `askOrphan`): `setShowFindingForm(true)` → `setFindingFormPhoto(null)` (no caso do `askOrphan`, vincular a 1ª foto sem NC: `setFindingFormPhoto(photos?.find((p) => !p.finding_id)?.id ?? null)`).

- [ ] **Step 4: Vincular foto extra com um toque (`PhotoCard`)**

Substituir `PhotoCard` por versão que mostra o vínculo e abre um seletor:

```tsx
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
                  photo.finding_id === f.id ? "bg-blue-600 border-blue-400" : "bg-slate-700 border-slate-600"
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
            <button onClick={() => setLinking(false)} className="w-full py-2.5 text-sm text-slate-400">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

No grid de fotos, passar findings: `<PhotoCard key={p.id} photo={p} findings={findings ?? []} />`.

- [ ] **Step 5: Typecheck + build** — `cd campo-pwa && npx tsc -b --noEmit && npm run build` → verde.

- [ ] **Step 6: Verificação manual no preview (porta 57010 do app principal NÃO — usar dev do PWA se disponível; senão registrar para bancada)**

Fluxo a conferir: tirar foto → form abre com "Mais usados" (vazio na 1ª vez — ok) → tocar um modo → rodapé aparece → Salvar → card da foto mostra "NC 1 ✓".

- [ ] **Step 7: Commit**

```bash
git add campo-pwa/src/pages/PointCapture.tsx
git commit -m "feat(campo-pwa): modo luva no form de NC + vínculo foto↔achado"
```

---

### Task 9: `computePendencias` — coração do portão de saída

**Files:**
- Create: `campo-pwa/src/lib/revisao.ts`
- Test: `campo-pwa/src/lib/__tests__/revisao.test.ts`

- [ ] **Step 1: Teste falhando**

```ts
import { describe, expect, it } from "vitest";
import { computePendencias, type RevisaoInput } from "@/lib/revisao";

const base: RevisaoInput = {
  nodes: [
    { id: "s1", parent_id: null, nivel: "setor", nome: "Subestação" },
    { id: "s2", parent_id: null, nivel: "setor", nome: "Caldeiraria" },
    { id: "a1", parent_id: "s1", nivel: "ativo", nome: "QGBT" },
  ],
  points: [{ id: "p1", node_id: "a1", titulo: "Painel 01" }],
  findings: [{ id: "f1", point_id: "p1", modo_falha_id: "m1", descricao: "x" }],
  photos: [{ id: "ph1", point_id: "p1", finding_id: "f1", blob: true, _synced: false }],
  queue: { pending: 0, failed: 0 },
};

describe("computePendencias", () => {
  it("aponta setor sem nenhum ponto", () => {
    const p = computePendencias(base);
    expect(p).toContainEqual({ tipo: "setor_sem_ponto", nodeId: "s2", nome: "Caldeiraria" });
  });
  it("aponta ponto sem foto", () => {
    const p = computePendencias({ ...base, photos: [] });
    expect(p).toContainEqual({ tipo: "ponto_sem_foto", pointId: "p1", titulo: "Painel 01" });
  });
  it("aponta foto sem NC vinculada quando o ponto tem 2+ NCs", () => {
    const input: RevisaoInput = {
      ...base,
      findings: [
        { id: "f1", point_id: "p1", modo_falha_id: "m1", descricao: "x" },
        { id: "f2", point_id: "p1", modo_falha_id: null, descricao: "y" },
      ],
      photos: [{ id: "ph1", point_id: "p1", finding_id: null, blob: true, _synced: false }],
    };
    const p = computePendencias(input);
    expect(p).toContainEqual({ tipo: "foto_sem_vinculo", pointId: "p1", titulo: "Painel 01", count: 1 });
  });
  it("NÃO cobra vínculo quando o ponto tem 1 NC só (implícito)", () => {
    const p = computePendencias({
      ...base,
      photos: [{ id: "ph1", point_id: "p1", finding_id: null, blob: true, _synced: false }],
    });
    expect(p.some((x) => x.tipo === "foto_sem_vinculo")).toBe(false);
  });
  it("resume estado da fila e blobs locais", () => {
    const p = computePendencias({ ...base, queue: { pending: 3, failed: 1 } });
    expect(p).toContainEqual({ tipo: "sync_pendente", count: 3 });
    expect(p).toContainEqual({ tipo: "sync_falha", count: 1 });
    expect(p).toContainEqual({ tipo: "so_no_aparelho", fotos: 1 });
  });
  it("inspeção redonda → sem pendências além do resumo local", () => {
    const ok = computePendencias({
      ...base,
      nodes: base.nodes.filter((n) => n.id !== "s2"),
      photos: [{ id: "ph1", point_id: "p1", finding_id: "f1", blob: false, _synced: true }],
    });
    expect(ok).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL.

- [ ] **Step 3: Implementar `campo-pwa/src/lib/revisao.ts`**

```ts
// Portão de saída (spec §4): checklist automático sobre os dados locais.
// Função PURA — recebe projeções mínimas, devolve pendências tipadas.
// Consultivo, não bloqueante: a UI decide o que fazer com a lista.

export type RevisaoInput = {
  nodes: Array<{ id: string; parent_id: string | null; nivel: string; nome: string }>;
  points: Array<{ id: string; node_id: string; titulo: string | null }>;
  findings: Array<{ id: string; point_id: string; modo_falha_id: string | null; descricao: string }>;
  photos: Array<{ id: string; point_id: string; finding_id?: string | null; blob: boolean; _synced: boolean }>;
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

  // Setor sem ponto: nenhum ponto cujo caminho suba até este setor.
  const parentOf = new Map(nodes.map((n) => [n.id, n.parent_id]));
  const setorDe = (nodeId: string): string | null => {
    let cur: string | null = nodeId;
    let last: string | null = null;
    while (cur) {
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
```

- [ ] **Step 4: Rodar testes, ver passar** — PASS.

- [ ] **Step 5: Commit**

```bash
git add campo-pwa/src/lib/revisao.ts campo-pwa/src/lib/__tests__/revisao.test.ts
git commit -m "feat(campo-pwa): computePendencias (portão de saída, função pura)"
```

---

### Task 10: Backup ZIP — export e import

**Files:**
- Create: `campo-pwa/src/lib/backup.ts`
- Test: `campo-pwa/src/lib/__tests__/backup.test.ts`

- [ ] **Step 1: Teste falhando (manifest + round-trip serialize/restore no fake-indexeddb)**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { buildManifest, validateManifest, serializeInspecao, restoreBackupData } from "@/lib/backup";
import { db } from "@/db/dexie";

const now = "2026-07-08T12:00:00.000Z";

async function seed() {
  await db.inspections.add({
    id: "i1",
    titulo: "Insp Teste",
    cliente: null,
    local: null,
    engenheiro: null,
    data_inspecao: "2026-07-08",
    status: "em_andamento",
    report_id: null,
    notes: null,
    created_by_name: null,
    arquivada_campo: false,
    created_at: now,
    updated_at: now,
    _synced: false,
  });
  await db.nodes.add({
    id: "n1", inspection_id: "i1", parent_id: null, nivel: "setor", nome: "Setor A",
    ordem: 0, created_at: now, updated_at: now, _synced: false,
  });
  await db.points.add({
    id: "p1", inspection_id: "i1", node_id: "n1", titulo: "Ponto 1", observacoes: null,
    ordem: 0, collected_by_user_id: null, collected_by_name: null,
    created_at: now, updated_at: now, _synced: false,
  });
  await db.findings.add({
    id: "f1", point_id: "p1", modo_falha_id: null, descricao: "NC teste", recomendacao: null,
    prioridade: 3, tipo_execucao: "os", observacao: null, created_at: now, updated_at: now, _synced: false,
  });
  await db.photos.add({
    id: "ph1", point_id: "p1", finding_id: "f1", gps_lat: -22.3, gps_lng: -47.8, gps_accuracy: 8,
    file_path: null, file_name: "a.jpg", legenda: null, ordem: 0,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    created_at: now, _synced: false,
  });
}

beforeEach(async () => {
  await Promise.all([
    db.inspections.clear(), db.nodes.clear(), db.points.clear(),
    db.findings.clear(), db.photos.clear(), db.sync_queue.clear(),
  ]);
});

describe("manifest", () => {
  it("valida o próprio manifest gerado", () => {
    const m = buildManifest({
      inspectionId: "i1", titulo: "X", usuario: null,
      contagens: { nodes: 1, points: 1, findings: 1, photos: 1, blobs: 1, queue: 0 },
    });
    expect(validateManifest(m)).toEqual({ ok: true });
  });
  it("rejeita formato desconhecido e versão de schema futura", () => {
    expect(validateManifest({ formato: "outro" }).ok).toBe(false);
    expect(validateManifest({ formato: "campo-backup", versao_schema: 99 }).ok).toBe(false);
  });
});

describe("serialize + restore (round-trip)", () => {
  it("restaura num banco vazio sem perder nada e sem duplicar em re-import", async () => {
    await seed();
    const data = await serializeInspecao("i1");
    expect(data.photos[0].finding_id).toBe("f1");

    const blobs = new Map<string, Blob>([["ph1", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })]]);

    // "Aparelho novo": limpa tudo e restaura duas vezes (idempotência).
    await Promise.all([
      db.inspections.clear(), db.nodes.clear(), db.points.clear(),
      db.findings.clear(), db.photos.clear(), db.sync_queue.clear(),
    ]);
    await restoreBackupData(data, blobs);
    await restoreBackupData(data, blobs);

    expect(await db.inspections.count()).toBe(1);
    expect(await db.points.count()).toBe(1);
    const ph = await db.photos.get("ph1");
    expect(ph?.blob).toBeTruthy();
    expect(ph?._synced).toBe(false);
    expect(ph?.gps_lat).toBe(-22.3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL.

- [ ] **Step 3: Implementar `campo-pwa/src/lib/backup.ts`**

```ts
// Backup completo da inspeção (spec §3.2–3.3): ZIP com manifest + dados + blobs
// ainda não sincronizados. Import = upsert por id (idempotente).
// Separação deliberada: serialize/restore são puros sobre o Dexie (testáveis);
// exportBackup/importBackup cuidam de ZIP + share/download (browser).

import { db } from "@/db/dexie";
import type { LocalFinding, LocalInspection, LocalNode, LocalPhoto, LocalPoint, SyncQueueItem } from "@/db/dexie";

export const BACKUP_FORMATO = "campo-backup";
export const BACKUP_SCHEMA = 1;

export type BackupManifest = {
  formato: typeof BACKUP_FORMATO;
  versao_schema: number;
  inspection_id: string;
  titulo: string;
  usuario: string | null;
  exported_at: string;
  contagens: { nodes: number; points: number; findings: number; photos: number; blobs: number; queue: number };
};

export type BackupData = {
  inspection: LocalInspection;
  nodes: LocalNode[];
  points: LocalPoint[];
  findings: LocalFinding[];
  /** Fotos SEM o blob (vai em arquivo separado no ZIP); has_blob marca quais têm. */
  photos: Array<Omit<LocalPhoto, "blob"> & { has_blob: boolean }>;
  queue: SyncQueueItem[];
};

export function buildManifest(args: {
  inspectionId: string;
  titulo: string;
  usuario: string | null;
  contagens: BackupManifest["contagens"];
}): BackupManifest {
  return {
    formato: BACKUP_FORMATO,
    versao_schema: BACKUP_SCHEMA,
    inspection_id: args.inspectionId,
    titulo: args.titulo,
    usuario: args.usuario,
    exported_at: new Date().toISOString(),
    contagens: args.contagens,
  };
}

export function validateManifest(m: unknown): { ok: true } | { ok: false; motivo: string } {
  const man = m as Partial<BackupManifest> | null;
  if (!man || man.formato !== BACKUP_FORMATO) {
    return { ok: false, motivo: "Arquivo não é um backup do Campo (manifest ausente ou formato desconhecido)." };
  }
  if (typeof man.versao_schema !== "number" || man.versao_schema > BACKUP_SCHEMA) {
    return { ok: false, motivo: `Backup de versão mais nova (${man.versao_schema}) — atualize o app antes de restaurar.` };
  }
  if (!man.inspection_id) return { ok: false, motivo: "Manifest sem inspection_id." };
  return { ok: true };
}

export async function serializeInspecao(inspectionId: string): Promise<BackupData> {
  const inspection = await db.inspections.get(inspectionId);
  if (!inspection) throw new Error("Inspeção não encontrada no aparelho.");
  const nodes = await db.nodes.where("inspection_id").equals(inspectionId).toArray();
  const points = await db.points.where("inspection_id").equals(inspectionId).toArray();
  const pointIds = points.map((p) => p.id);
  const findings = pointIds.length ? await db.findings.where("point_id").anyOf(pointIds).toArray() : [];
  const photosFull = pointIds.length ? await db.photos.where("point_id").anyOf(pointIds).toArray() : [];
  const photos = photosFull.map(({ blob, ...rest }) => ({ ...rest, has_blob: !!blob }));
  // Fila: só itens desta inspeção (local_id pertence ao conjunto exportado).
  const ids = new Set<string>([inspectionId, ...nodes.map((n) => n.id), ...pointIds, ...findings.map((f) => f.id), ...photosFull.map((p) => p.id)]);
  const queue = (await db.sync_queue.toArray()).filter((q) => ids.has(q.local_id));
  return { inspection, nodes, points, findings, photos, queue };
}

/** Blobs ainda só no aparelho (para o ZIP). */
export async function collectLocalBlobs(inspectionId: string): Promise<Map<string, Blob>> {
  const points = await db.points.where("inspection_id").equals(inspectionId).toArray();
  const pointIds = points.map((p) => p.id);
  const photos = pointIds.length ? await db.photos.where("point_id").anyOf(pointIds).toArray() : [];
  const map = new Map<string, Blob>();
  for (const p of photos) if (p.blob) map.set(p.id, p.blob);
  return map;
}

/** Upsert por id em todas as tabelas; reanexa blobs. Idempotente. */
export async function restoreBackupData(data: BackupData, blobs: Map<string, Blob>): Promise<void> {
  await db.transaction("rw", [db.inspections, db.nodes, db.points, db.findings, db.photos, db.sync_queue], async () => {
    await db.inspections.put(data.inspection);
    if (data.nodes.length) await db.nodes.bulkPut(data.nodes);
    if (data.points.length) await db.points.bulkPut(data.points);
    if (data.findings.length) await db.findings.bulkPut(data.findings);
    if (data.photos.length) {
      await db.photos.bulkPut(
        data.photos.map(({ has_blob, ...rest }) => ({
          ...rest,
          blob: has_blob ? (blobs.get(rest.id) ?? null) : null,
        })),
      );
    }
    if (data.queue.length) await db.sync_queue.bulkPut(data.queue);
  });
}

function sanitize(s: string): string {
  return (s || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 60);
}

export type BackupResult = { nomeArquivo: string; fotosNoZip: number };

/** Gera o ZIP e entrega via Web Share (fallback: download). */
export async function exportBackup(inspectionId: string, usuario: string | null): Promise<BackupResult> {
  const { default: JSZip } = await import("jszip");
  const data = await serializeInspecao(inspectionId);
  const blobs = await collectLocalBlobs(inspectionId);
  const manifest = buildManifest({
    inspectionId,
    titulo: data.inspection.titulo,
    usuario,
    contagens: {
      nodes: data.nodes.length,
      points: data.points.length,
      findings: data.findings.length,
      photos: data.photos.length,
      blobs: blobs.size,
      queue: data.queue.length,
    },
  });

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("inspecao.json", JSON.stringify(data));
  const fotos = zip.folder("fotos")!;
  for (const [photoId, blob] of blobs) {
    const photo = data.photos.find((p) => p.id === photoId);
    fotos.file(`${photo?.point_id ?? "sem-ponto"}/${photoId}.jpg`, blob);
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const nomeArquivo = `backup-${sanitize(data.inspection.titulo)}-${stamp}.zip`;
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });

  const file = new File([zipBlob], nomeArquivo, { type: "application/zip" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: nomeArquivo });
      return { nomeArquivo, fotosNoZip: blobs.size };
    } catch {
      /* cancelado — cai no download */
    }
  }
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { nomeArquivo, fotosNoZip: blobs.size };
}

export type ImportResult = { ok: true; titulo: string; fotos: number } | { ok: false; motivo: string };

/** Lê um ZIP de backup e restaura (upsert). */
export async function importBackup(file: File): Promise<ImportResult> {
  const { default: JSZip } = await import("jszip");
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return { ok: false, motivo: "Arquivo inválido (não é um ZIP legível)." };
  }
  const manifestRaw = await zip.file("manifest.json")?.async("string");
  if (!manifestRaw) return { ok: false, motivo: "ZIP sem manifest.json — não é um backup do Campo." };
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    return { ok: false, motivo: "manifest.json corrompido." };
  }
  const valid = validateManifest(manifest);
  if (!valid.ok) return { ok: false, motivo: valid.motivo };

  const dataRaw = await zip.file("inspecao.json")?.async("string");
  if (!dataRaw) return { ok: false, motivo: "ZIP sem inspecao.json." };
  const data = JSON.parse(dataRaw) as BackupData;

  const blobs = new Map<string, Blob>();
  const fotoFiles = zip.folder("fotos")?.filter(() => true) ?? [];
  for (const f of fotoFiles) {
    if (f.dir) continue;
    const photoId = f.name.split("/").pop()!.replace(/\.jpg$/i, "");
    blobs.set(photoId, await f.async("blob"));
  }

  await restoreBackupData(data, blobs);
  return { ok: true, titulo: data.inspection.titulo, fotos: blobs.size };
}
```

- [ ] **Step 4: Rodar testes, ver passar** — PASS.
(Se `zip.folder("fotos").filter` der problema de tipo, usar `zip.file(/^fotos\//)` que retorna `JSZipObject[]` — mesmo resultado.)

- [ ] **Step 5: Commit**

```bash
git add campo-pwa/src/lib/backup.ts campo-pwa/src/lib/__tests__/backup.test.ts
git commit -m "feat(campo-pwa): backup ZIP export/import com manifest e round-trip testado"
```

---

### Task 11: Tela Revisão da Visita + botões de entrada

**Files:**
- Create: `campo-pwa/src/pages/RevisaoVisita.tsx`
- Modify: `campo-pwa/src/main.tsx` (rota)
- Modify: `campo-pwa/src/pages/InspectionDetail.tsx` (botões no header)
- Modify: `campo-pwa/src/pages/InspectionList.tsx` (botão Restaurar backup)

- [ ] **Step 1: Criar `campo-pwa/src/pages/RevisaoVisita.tsx`**

```tsx
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Archive } from "lucide-react";
import { db } from "@/db/dexie";
import { computePendencias, type Pendencia } from "@/lib/revisao";
import { exportBackup, type BackupResult } from "@/lib/backup";
import { getActorName } from "@/lib/actor";
import { MAX_SYNC_ATTEMPTS } from "@/sync/engine";

export default function RevisaoVisita() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<BackupResult | null>(null);

  const dados = useLiveQuery(async () => {
    if (!id) return null;
    const [inspection, nodes, points] = await Promise.all([
      db.inspections.get(id),
      db.nodes.where("inspection_id").equals(id).toArray(),
      db.points.where("inspection_id").equals(id).toArray(),
    ]);
    if (!inspection) return null;
    const pointIds = points.map((p) => p.id);
    const [findings, photos, queueAll] = await Promise.all([
      pointIds.length ? db.findings.where("point_id").anyOf(pointIds).toArray() : [],
      pointIds.length ? db.photos.where("point_id").anyOf(pointIds).toArray() : [],
      db.sync_queue.toArray(),
    ]);
    return { inspection, nodes, points, findings, photos, queueAll };
  }, [id]);

  if (!id) return null;
  if (dados === undefined) return null;
  if (dados === null)
    return (
      <div className="p-8 text-center text-slate-400">
        Inspeção não encontrada.{" "}
        <Link to="/inspecoes" className="text-blue-400 underline">Voltar</Link>
      </div>
    );

  const { inspection, nodes, points, findings, photos, queueAll } = dados;
  const pendencias = computePendencias({
    nodes,
    points,
    findings,
    photos: photos.map((p) => ({ ...p, blob: !!p.blob })),
    queue: {
      pending: queueAll.filter((q) => q.attempts < MAX_SYNC_ATTEMPTS).length,
      failed: queueAll.filter((q) => q.attempts >= MAX_SYNC_ATTEMPTS).length,
    },
  });
  const fotosLocais = photos.filter((p) => p.blob && !p._synced).length;

  function linkDe(p: Pendencia): string {
    switch (p.tipo) {
      case "setor_sem_ponto":
        return `/inspecoes/${id}`;
      case "ponto_sem_foto":
      case "foto_sem_vinculo":
        return `/inspecoes/${id}/ponto/${p.pointId}`;
      default:
        return `/inspecoes/${id}/revisao`;
    }
  }
  function textoDe(p: Pendencia): string {
    switch (p.tipo) {
      case "setor_sem_ponto":
        return `Setor "${p.nome}" sem nenhum ponto coletado`;
      case "ponto_sem_foto":
        return `Ponto "${p.titulo ?? "sem título"}" sem foto`;
      case "foto_sem_vinculo":
        return `${p.count} foto(s) sem NC vinculada em "${p.titulo ?? "ponto"}"`;
      case "sync_pendente":
        return `${p.count} item(ns) aguardando envio (normal offline)`;
      case "sync_falha":
        return `${p.count} item(ns) com FALHA de envio — resolver antes de sair`;
      case "so_no_aparelho":
        return `${p.fotos} foto(s) existem SÓ neste aparelho — gere o backup abaixo`;
    }
  }

  async function encerrar() {
    setGerando(true);
    try {
      if (fotosLocais > 0 || queueAll.length > 0) {
        setResultado(await exportBackup(id!, getActorName()));
      } else {
        setResultado({ nomeArquivo: "", fotosNoZip: 0 });
      }
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          onClick={() => navigate(`/inspecoes/${id}`)}
          className="p-2.5 -m-1 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">Revisão da visita</h1>
          <p className="text-xs text-slate-400 truncate">{inspection.titulo}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-xl bg-slate-800 p-4 grid grid-cols-4 gap-2 text-center">
          {[
            [points.length, "pontos"],
            [findings.length, "NCs"],
            [photos.length, "fotos"],
            [fotosLocais, "só aqui"],
          ].map(([n, label]) => (
            <div key={label as string}>
              <p className="text-xl font-bold">{n}</p>
              <p className="text-[11px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        {pendencias.length === 0 ? (
          <div className="rounded-xl bg-green-900/30 border border-green-800 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-400 shrink-0" />
            <p className="text-sm text-green-200">Tudo conferido — nenhuma pendência encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Conferir antes de sair ({pendencias.length})
            </p>
            {pendencias.map((p, i) => (
              <Link
                key={i}
                to={linkDe(p)}
                className="flex items-center gap-3 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3"
              >
                <AlertTriangle
                  className={`h-5 w-5 shrink-0 ${p.tipo === "sync_falha" ? "text-red-400" : "text-yellow-400"}`}
                />
                <span className="text-sm flex-1">{textoDe(p)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-slate-800 p-4 space-y-2">
        <button
          onClick={encerrar}
          disabled={gerando}
          className="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-base font-bold"
        >
          <Archive className="h-5 w-5" />
          {gerando ? "Gerando backup…" : "Encerrar visita"}
        </button>
        <p className="text-[11px] text-slate-500 text-center">
          Gera um backup do que existe só neste aparelho. Não bloqueia nada — você decide quando sair.
        </p>
      </footer>

      {resultado && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-5 space-y-3">
            <h2 className="font-semibold">Visita encerrada</h2>
            <p className="text-sm text-slate-300">
              {points.length} pontos · {findings.length} NCs · {photos.length} fotos.
              {resultado.fotosNoZip > 0
                ? ` Backup "${resultado.nomeArquivo}" gerado com ${resultado.fotosNoZip} foto(s) — guarde-o fora deste aparelho (Drive/WhatsApp).`
                : " Tudo já sincronizado — backup não foi necessário."}
            </p>
            <button
              onClick={() => navigate("/inspecoes")}
              className="w-full min-h-[48px] rounded-xl bg-blue-600 text-sm font-semibold"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rota em `main.tsx`**

```tsx
import RevisaoVisita from "@/pages/RevisaoVisita";
// dentro do <Route path="/" element={<Layout />}>:
<Route path="inspecoes/:id/revisao" element={<RevisaoVisita />} />
```

- [ ] **Step 3: Botão "Revisão / Encerrar visita" no header do `InspectionDetail.tsx`**

Na linha de ações do header da inspeção (junto dos botões existentes de export/arquivar — localizar o header principal da página, onde estão os ícones `Download`/`Archive`), adicionar:

```tsx
          <Link
            to={`/inspecoes/${id}/revisao`}
            className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center"
            aria-label="Revisão da visita"
            title="Revisão da visita"
          >
            <ClipboardCheck className="h-5 w-5 text-green-400" />
          </Link>
```

Import `ClipboardCheck` de lucide-react.

- [ ] **Step 4: Botão "Restaurar backup" no `InspectionList.tsx`**

No header da lista, adicionar um input de arquivo escondido + botão:

```tsx
  const importRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const r = await importBackup(file);
      alert(r.ok ? `Backup "${r.titulo}" restaurado (${r.fotos} fotos).` : `Não restaurado: ${r.motivo}`);
    } finally {
      setImportando(false);
      if (importRef.current) importRef.current.value = "";
    }
  }
```

```tsx
          <input ref={importRef} type="file" accept=".zip,application/zip" className="sr-only" onChange={handleImport} />
          <button
            onClick={() => importRef.current?.click()}
            disabled={importando}
            className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center disabled:opacity-40"
            aria-label="Restaurar backup"
            title="Restaurar backup"
          >
            <FolderUp className="h-5 w-5" />
          </button>
```

Imports: `importBackup` de `@/lib/backup`, `FolderUp` de lucide-react, `useRef`/`useState` de react (se ausentes).

- [ ] **Step 5: Typecheck + build + testes** — `cd campo-pwa && npx tsc -b --noEmit && npm test && npm run build` → verde.

- [ ] **Step 6: Commit**

```bash
git add campo-pwa/src/pages/RevisaoVisita.tsx campo-pwa/src/main.tsx campo-pwa/src/pages/InspectionDetail.tsx campo-pwa/src/pages/InspectionList.tsx
git commit -m "feat(campo-pwa): tela Revisão da Visita (portão de saída) + restaurar backup"
```

---

### Task 12: Modo sol

**Files:**
- Create: `campo-pwa/src/hooks/useTheme.ts`
- Modify: `campo-pwa/src/index.css`
- Modify: `campo-pwa/src/pages/InspectionList.tsx` e `campo-pwa/src/pages/PointCapture.tsx` (botão toggle)

**Decisão de implementação (v1 pragmática):** inversão de cor via CSS (`filter: invert`) com contra-inversão em `img`/`video` — transforma o tema escuro inteiro em claro de alto contraste com ~10 linhas de CSS, sem retematizar centenas de classes slate. A validação de campo julga se basta; se não bastar, a v2 é tema por tokens (registrado na spec §5.3).

- [ ] **Step 1: Criar `campo-pwa/src/hooks/useTheme.ts`**

```ts
import { useCallback, useEffect, useState } from "react";

// Modo sol (spec §5.3): tema claro de alto contraste para leitura sob sol.
// v1: inversão CSS global com contra-inversão de mídia — barato e reversível.

const KEY = "campo-theme";
export type Theme = "dark" | "sun";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("sun", theme === "sun");
}

export function initTheme(): void {
  apply((localStorage.getItem(KEY) as Theme) ?? "dark");
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) ?? "dark");
  useEffect(() => apply(theme), [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "sun" ? "dark" : "sun";
      localStorage.setItem(KEY, next);
      return next;
    });
  }, []);
  return { theme, toggle };
}
```

- [ ] **Step 2: CSS em `campo-pwa/src/index.css`** (ao final)

```css
/* Modo sol: inverte o tema escuro para claro de alto contraste.
   Fotos/vídeos são contra-invertidos para manterem cores reais. */
html.sun {
  filter: invert(1) hue-rotate(180deg);
  background: #fff;
}
html.sun img,
html.sun video {
  filter: invert(1) hue-rotate(180deg);
}
```

- [ ] **Step 3: Aplicar no boot** — em `main.tsx`, antes de `createRoot`: `initTheme();` (import de `@/hooks/useTheme`).

- [ ] **Step 4: Botão toggle nos headers**

Em `InspectionList.tsx` e `PointCapture.tsx`, no header, adicionar:

```tsx
  const { theme, toggle } = useTheme();
```

```tsx
          <button
            onClick={toggle}
            className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center"
            aria-label={theme === "sun" ? "Modo escuro" : "Modo sol"}
            title={theme === "sun" ? "Modo escuro" : "Modo sol"}
          >
            {theme === "sun" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
```

Imports: `useTheme` de `@/hooks/useTheme`; `Sun, Moon` de lucide-react.

- [ ] **Step 5: Typecheck + build** — verde. Verificação visual: toggle inverte a UI, fotos permanecem com cores naturais.

- [ ] **Step 6: Commit**

```bash
git add campo-pwa/src/hooks/useTheme.ts campo-pwa/src/index.css campo-pwa/src/main.tsx campo-pwa/src/pages/InspectionList.tsx campo-pwa/src/pages/PointCapture.tsx
git commit -m "feat(campo-pwa): modo sol (tema claro de alto contraste)"
```

---

### Task 13: Verificação final + atualização do ROADMAP

**Files:**
- Modify: `docs/superpowers/plans/ROADMAP.md`

- [ ] **Step 1: Suíte completa dos dois apps**

Run: `cd campo-pwa && npm test && npx tsc -b --noEmit && npm run build; cd .. && npm test && npm run build`
Expected: tudo verde (erros tsc pré-existentes do app principal são conhecidos; testes do app principal não devem regredir).

- [ ] **Step 2: Checklist de bancada (spec §9 — manual, com o dev server do usuário)**

Registrar resultado de cada item (funciona/não funciona/observação):
1. Modo avião → criar pontos com fotos → matar aba → reabrir → dados presentes, banner "Continuar" aparece.
2. Portão de saída lista pendências corretas e cada link navega ao lugar certo.
3. "Encerrar visita" gera ZIP; extrair no PC e conferir manifest/inspecao.json/fotos.
4. Restaurar o ZIP num perfil de navegador limpo (aparelho novo simulado) → dados e fotos voltam.
5. Sair do modo avião → fila esvazia → foto no Supabase com `finding_id` e GPS preenchidos.
6. Modo sol legível, fotos com cores naturais.

- [ ] **Step 3: Atualizar `ROADMAP.md`**

Na seção "🎯 Prioridade atual", atualizar o item 2 (UX de captura): registrar que a trilha "Cofre e Portão" foi implementada (spec + plano 2026-07-08), pendente de validação em campo real conforme protocolo da spec §9.

- [ ] **Step 4: Commit final**

```bash
git add docs/superpowers/plans/ROADMAP.md
git commit -m "docs: ROADMAP — trilha cofre e portão implementada, aguardando validação em campo"
```

**NÃO fazer `git push`** — deploy para staging só com ordem explícita do usuário.

---

## Fora deste plano (registrado)

- Validação em campo real (protocolo spec §9) — feita pelo usuário após bancada.
- Trilhas C (wizard de relatório), A (curadoria de padrões), D (experiência do cliente) — spec §11.
- Login offline multiusuário; áudio por achado; medições estruturadas — spec §10.
- `comporRti` no app principal passar a usar `finding_id` para anexar evidência por NC (hoje anexa por ponto) — pertence à trilha C, mas o dado já estará sendo coletado.

# RTI-evidências: reestruturação de storage + exclusão confiável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o storage de evidências RTI em **um prefixo por relatório** (`{org}/{reportSlug}/nc-{n}-{i}.ext`), acabar com a duplicação de fotos na composição campo→RTI, e tornar toda exclusão **confiável e reference-aware** (nunca deixa órfão, nunca apaga arquivo ainda referenciado).

**Architecture:** Um módulo puro de nomes de path (`storage-paths.ts`, testável em unidade) + um helper de exclusão reference-aware em `upload.ts` que roda **depois** de apagar as linhas de negócio e remove do Storage só o que ficou sem referência. `uploadRtiFile` é substituído por `uploadRtiEvidencia`, que numera os arquivos por NC. `comporRti` passa a **referenciar** a foto de campo (já comprimida) em vez de copiá-la. Uma Edge Function agendada varre órfãos como rede de segurança.

**Tech Stack:** TanStack Start + React Query + Supabase JS, Vitest (testes), Supabase Edge Functions (Deno) + pg_cron.

**Decisões travadas (do §5 do [plano de análise](2026-07-02-rti-evidencias-storage-reestruturacao.md)):**
- **A** — `reportSlug = {slug(titulo)}-{id8}` (relatórios não têm coluna `numero`; adaptado). Fallback `rti-{id8}` se sem título.
- **B** — arquivo `nc-{ncNum}-{idx}.ext`; `idx` = maior índice existente no prefixo + 1; retry no conflito (`upsert:false`).
- **C** — `comporRti` **referencia** o `file_path` da foto de campo (já comprimida via PWA + `resizeImage 1024`), sem `.copy()`. **Garantia da versão compactada:** as fotos de campo já sobem comprimidas; a referência aponta exatamente para elas.
- **D** — varredura de órfãos por **Edge Function agendada** (pg_cron).

**Pré-condição já satisfeita:** Storage vazio (0 objetos) e `rti_nc_evidencias`/`field_photos` = 0 linhas → **sem migração de legado**.

**Verificação global (rodar ao fim de cada Task que toca código do app):**
- Typecheck: `npx tsc --noEmit -p tsconfig.json` — Esperado: apenas os erros pré-existentes de `training_certificates` (linhas ~421-456 de `qualificacoes-queries.ts`). Nenhum erro novo.
- Testes: `npx vitest run` — Esperado: verde (novos testes incluídos).

---

## File Structure

- **Create** `src/lib/storage-paths.ts` — funções puras de nome/prefixo de path (slug, prefixo por relatório, nome de arquivo por NC, parser de índice). Sem dependências de Supabase → testável isolado.
- **Create** `src/lib/storage-paths.test.ts` — testes unitários das funções puras.
- **Modify** `src/lib/upload.ts` — adiciona `removerArquivosOrfaos(paths)` (exclusão reference-aware, checa erro do `.remove()`).
- **Modify** `src/lib/rti-queries.ts` — `uploadRtiFile` → `uploadRtiEvidencia`; deletes (report/nc/evidencia) usam o helper + incluem `report_path`.
- **Modify** `src/lib/campo-queries.ts` — `comporRti` referencia em vez de copiar; deletes (inspection/node/point/photo) usam o helper.
- **Modify** `src/routes/rti.evidencias.tsx` e `src/routes/rti.nc.$ncId.tsx` — call sites do upload.
- **Create** `supabase/functions/orphan-sweep/index.ts` — Edge Function de varredura (service role).
- **Create** `supabase/migrations/<ts>_schedule_orphan_sweep.sql` — agenda pg_cron.

---

## Task 1: Módulo puro de paths (`storage-paths.ts`) + testes (TDD)

**Files:**
- Create: `src/lib/storage-paths.ts`
- Test: `src/lib/storage-paths.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/storage-paths.test.ts
import { describe, it, expect } from "vitest";
import {
  slugify,
  reportSlug,
  evidenciaFolder,
  evidenciaFileName,
  evidenciaPath,
  maiorIndiceEvidencia,
} from "./storage-paths";

describe("slugify", () => {
  it("remove acentos, baixa a caixa e troca não-alfanumérico por hífen", () => {
    expect(slugify("Inspeção Periódica — Área 3")).toBe("inspecao-periodica-area-3");
  });
  it("colapsa hífens e apara as pontas", () => {
    expect(slugify("  RTI  //  2026 ")).toBe("rti-2026");
  });
  it("string vazia vira vazio", () => {
    expect(slugify("")).toBe("");
  });
});

describe("reportSlug", () => {
  const id = "6d9ec4c6-902d-4fad-9297-e99646a47d4f";
  it("combina slug do título (máx 40) com os 8 primeiros do id", () => {
    expect(reportSlug({ id, titulo: "RTI - Inspeções periódicas" })).toBe(
      "rti-inspecoes-periodicas-6d9ec4c6",
    );
  });
  it("sem título usa fallback rti-<id8>", () => {
    expect(reportSlug({ id, titulo: null })).toBe("rti-6d9ec4c6");
  });
  it("título só com símbolos cai no fallback", () => {
    expect(reportSlug({ id, titulo: "!!!" })).toBe("rti-6d9ec4c6");
  });
});

describe("evidenciaFolder / evidenciaFileName / evidenciaPath", () => {
  const org = "c221b14e-72c9-4c63-99a6-2fbaf8b26763";
  const report = { id: "6d9ec4c6-902d-4fad-9297-e99646a47d4f", titulo: "RTI 1" };
  it("monta o prefixo por relatório", () => {
    expect(evidenciaFolder(org, report)).toBe(`${org}/rti-1-6d9ec4c6`);
  });
  it("nomeia por NC e índice", () => {
    expect(evidenciaFileName(2, 3, "jpg")).toBe("nc-2-3.jpg");
  });
  it("caminho completo", () => {
    expect(evidenciaPath(org, report, 2, 3, "jpg")).toBe(
      `${org}/rti-1-6d9ec4c6/nc-2-3.jpg`,
    );
  });
});

describe("maiorIndiceEvidencia", () => {
  it("retorna o maior índice da NC pedida, ignorando outras NCs e extensões", () => {
    const names = ["nc-1-1.jpg", "nc-1-2.jpeg", "nc-2-1.jpg", "nc-10-1.jpg"];
    expect(maiorIndiceEvidencia(names, 1)).toBe(2);
    expect(maiorIndiceEvidencia(names, 2)).toBe(1);
    expect(maiorIndiceEvidencia(names, 10)).toBe(1);
  });
  it("NC sem arquivos retorna 0", () => {
    expect(maiorIndiceEvidencia(["nc-1-1.jpg"], 9)).toBe(0);
  });
  it("nomes fora do padrão são ignorados", () => {
    expect(maiorIndiceEvidencia(["lixo.jpg", "nc-1-x.jpg", "nc-1-4.jpg"], 1)).toBe(4);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/lib/storage-paths.test.ts`
Expected: FAIL — "Failed to resolve import './storage-paths'".

- [ ] **Step 3: Implementar o módulo**

```ts
// src/lib/storage-paths.ts
// Nomes de path do bucket rti-evidencias. Puro (sem Supabase) — testável isolado.
// Esquema (2026-07-02): um prefixo por relatório, arquivo nomeado por NC e índice.
//   {orgId}/{reportSlug}/nc-{ncNum}-{idx}.{ext}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanumérico → hífen
    .replace(/^-+|-+$/g, ""); // apara hífens das pontas
}

/** Identificador de pasta do relatório: slug do título (≤40) + 8 primeiros do id. */
export function reportSlug(report: { id: string; titulo?: string | null }): string {
  const id8 = report.id.slice(0, 8);
  const base = slugify(report.titulo ?? "").slice(0, 40).replace(/-+$/, "");
  return base ? `${base}-${id8}` : `rti-${id8}`;
}

export function evidenciaFolder(
  orgId: string,
  report: { id: string; titulo?: string | null },
): string {
  return `${orgId}/${reportSlug(report)}`;
}

export function evidenciaFileName(ncNum: number, idx: number, ext: string): string {
  return `nc-${ncNum}-${idx}.${ext}`;
}

export function evidenciaPath(
  orgId: string,
  report: { id: string; titulo?: string | null },
  ncNum: number,
  idx: number,
  ext: string,
): string {
  return `${evidenciaFolder(orgId, report)}/${evidenciaFileName(ncNum, idx, ext)}`;
}

/** Maior índice já usado para uma NC, dado os nomes de arquivo do prefixo. 0 se nenhum. */
export function maiorIndiceEvidencia(names: string[], ncNum: number): number {
  const re = new RegExp(`^nc-${ncNum}-(\\d+)\\.`);
  let max = 0;
  for (const name of names) {
    const m = re.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/lib/storage-paths.test.ts`
Expected: PASS (todos os `describe`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage-paths.ts src/lib/storage-paths.test.ts
git commit -m "feat(storage): módulo puro de paths de evidência RTI por relatório"
```

---

## Task 2: Exclusão reference-aware (`removerArquivosOrfaos` em `upload.ts`)

**Por quê:** com a decisão C, um mesmo `file_path` pode ser referenciado por `field_photos` **e** por `rti_nc_evidencias`. Apagar cego quebraria a outra referência. Solução: **apagar as linhas de negócio primeiro**, depois chamar este helper com os paths candidatos — ele remove do Storage só os que sobraram sem nenhuma referência, e **checa o erro** do `.remove()`.

**Files:**
- Modify: `src/lib/upload.ts` (acrescentar ao final)

- [ ] **Step 1: Implementar o helper**

```ts
// src/lib/upload.ts  — acrescentar ao final do arquivo
import { supabase } from "@/integrations/supabase/client";

const BUCKET_EVIDENCIAS = "rti-evidencias";

/**
 * Remove do Storage os paths que NÃO são mais referenciados por nenhuma linha de
 * `field_photos` nem `rti_nc_evidencias`. Chamar DEPOIS de apagar as linhas de negócio.
 * Reference-aware: nunca apaga arquivo ainda em uso (fotos de campo compartilhadas com RTI).
 * Checa o erro do `.remove()` e o propaga (não deixa órfão em silêncio).
 */
export async function removerArquivosOrfaos(paths: string[]): Promise<void> {
  const unicos = [...new Set(paths.filter(Boolean))];
  if (unicos.length === 0) return;

  const referenciados = new Set<string>();
  for (let i = 0; i < unicos.length; i += 200) {
    const lote = unicos.slice(i, i + 200);
    const [ev, fp] = await Promise.all([
      supabase.from("rti_nc_evidencias").select("file_path").in("file_path", lote),
      supabase.from("field_photos").select("file_path").in("file_path", lote),
    ]);
    for (const r of ev.data ?? []) referenciados.add(r.file_path);
    for (const r of fp.data ?? []) referenciados.add(r.file_path);
  }

  const orfaos = unicos.filter((p) => !referenciados.has(p));
  for (let i = 0; i < orfaos.length; i += 100) {
    const { error } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .remove(orfaos.slice(i, i + 100));
    if (error) throw new Error(mensagemUploadAmigavel(error));
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: só os erros pré-existentes de `training_certificates`. Nenhum novo.

- [ ] **Step 3: Verificação manual (documentar o resultado no PR)**

Sem teste unitário automatizado (toca Supabase). Verificar em runtime, no app local (porta 57010), após a Task 3 ligar o helper aos deletes — ver a checklist da Task 7. Este passo fica registrado; a prova real vem na Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/lib/upload.ts
git commit -m "feat(storage): helper de exclusão reference-aware (removerArquivosOrfaos)"
```

---

## Task 3: Deletes confiáveis nos 7 fluxos + `report_path`

Trocar os 7 `.remove()` que ignoram erro por: **coletar paths → apagar linhas → `removerArquivosOrfaos(paths)`**. Inclui o `report_path` (PDF) que hoje nunca é removido.

**Files:**
- Modify: `src/lib/rti-queries.ts` (`useDeleteRtiReport` ~115, `useDeleteRtiNc` ~294, `useDeleteRtiEvidencia` ~418)
- Modify: `src/lib/campo-queries.ts` (`useDeleteFieldPhoto` ~699, `useDeleteFieldPoint` ~522, delete de nó ~296, delete de inspeção ~218)

- [ ] **Step 1: `rti-queries.ts` — importar o helper**

Acrescentar ao bloco de imports (perto de `import { mensagemUploadAmigavel } from "@/lib/upload";`):

```ts
import { mensagemUploadAmigavel, removerArquivosOrfaos } from "@/lib/upload";
```

(remover o `import { mensagemUploadAmigavel } from "@/lib/upload";` antigo para não duplicar.)

- [ ] **Step 2: `useDeleteRtiReport` — incluir `report_path` e usar o helper**

Substituir o corpo do `mutationFn` (linhas ~118-145) por:

```ts
    mutationFn: async (reportId: string) => {
      // 1. Coleta paths: PDF do relatório + evidências de todas as NCs
      const paths: string[] = [];
      const { data: rep } = await supabase
        .from("rti_reports")
        .select("report_path")
        .eq("id", reportId)
        .maybeSingle();
      if (rep?.report_path) paths.push(rep.report_path);

      const ncs = await fetchAllRows<{ id: string }>((from, to) =>
        supabase.from("rti_ncs").select("id").eq("report_id", reportId).range(from, to),
      );
      const ncIds = ncs.map((n) => n.id);
      for (let i = 0; i < ncIds.length; i += 200) {
        const { data } = await supabase
          .from("rti_nc_evidencias")
          .select("file_path")
          .in("nc_id", ncIds.slice(i, i + 200));
        for (const e of data ?? []) paths.push(e.file_path);
      }

      // 2. Apaga as linhas de negócio (cascade cuida das NCs/evidências)
      const { count, error } = await supabase
        .from("rti_reports")
        .delete({ count: "exact" })
        .eq("id", reportId);
      if (error) throw error;
      if ((count ?? 0) === 0)
        throw new Error(
          "Sem permissão para excluir este relatório. Relatórios entregues por consultor externo só podem ser removidos pelo próprio consultor.",
        );

      // 3. Remove do Storage só o que ficou sem referência
      await removerArquivosOrfaos(paths);
    },
```

- [ ] **Step 3: `useDeleteRtiNc` — usar o helper**

Substituir o corpo do `mutationFn` (linhas ~297-307) por:

```ts
    mutationFn: async (ncId: string) => {
      const { data } = await supabase
        .from("rti_nc_evidencias")
        .select("file_path")
        .eq("nc_id", ncId);
      const paths = (data ?? []).map((e) => e.file_path);
      const { error } = await supabase.from("rti_ncs").delete().eq("id", ncId);
      if (error) throw error;
      await removerArquivosOrfaos(paths);
    },
```

- [ ] **Step 4: `useDeleteRtiEvidencia` — usar o helper**

Substituir o corpo do `mutationFn` (linhas ~421-425) por:

```ts
    mutationFn: async (ev: { id: string; nc_id: string; file_path: string }) => {
      const { error } = await supabase.from("rti_nc_evidencias").delete().eq("id", ev.id);
      if (error) throw error;
      await removerArquivosOrfaos([ev.file_path]);
      return ev;
    },
```

- [ ] **Step 5: `campo-queries.ts` — importar o helper**

Acrescentar ao bloco de imports (perto de `import { mensagemUploadAmigavel } from "@/lib/upload";`):

```ts
import { mensagemUploadAmigavel, removerArquivosOrfaos } from "@/lib/upload";
```

(remover o import antigo de `mensagemUploadAmigavel` para não duplicar.)

- [ ] **Step 6: `useDeleteFieldPhoto` — usar o helper**

Substituir o corpo do `mutationFn` (linhas ~702-706) por:

```ts
    mutationFn: async (photo: { id: string; file_path: string; point_id: string }) => {
      const { error } = await supabase.from("field_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await removerArquivosOrfaos([photo.file_path]);
      return photo;
    },
```

- [ ] **Step 7: `useDeleteFieldPoint` — usar o helper**

Substituir o corpo do `mutationFn` (linhas ~525-534) por:

```ts
    mutationFn: async (point: { id: string; inspection_id: string }) => {
      const { data: photos } = await supabase
        .from("field_photos")
        .select("file_path")
        .eq("point_id", point.id);
      const paths = (photos ?? []).map((p) => p.file_path);
      const { error } = await supabase.from("field_points").delete().eq("id", point.id);
      if (error) throw error;
      await removerArquivosOrfaos(paths);
      return point;
    },
```

- [ ] **Step 8: Delete de nó (~296-308) — usar o helper**

Substituir o trecho:

```ts
      const pointIds = (descPoints ?? []).filter((p) => p.node_id === node.id).map((p) => p.id);
      if (pointIds.length > 0) {
        const { data: photos } = await supabase
          .from("field_photos")
          .select("file_path")
          .in("point_id", pointIds);
        const paths = (photos ?? []).map((p) => p.file_path);
        if (paths.length > 0) await supabase.storage.from("rti-evidencias").remove(paths);
      }
      const { error } = await supabase.from("field_nodes").delete().eq("id", node.id);
      if (error) throw error;
      return node;
```

por:

```ts
      const pointIds = (descPoints ?? []).filter((p) => p.node_id === node.id).map((p) => p.id);
      let paths: string[] = [];
      if (pointIds.length > 0) {
        const { data: photos } = await supabase
          .from("field_photos")
          .select("file_path")
          .in("point_id", pointIds);
        paths = (photos ?? []).map((p) => p.file_path);
      }
      const { error } = await supabase.from("field_nodes").delete().eq("id", node.id);
      if (error) throw error;
      await removerArquivosOrfaos(paths);
      return node;
```

- [ ] **Step 9: Delete de inspeção (~218-232) — usar o helper**

Substituir o trecho:

```ts
      if (pointIds.length > 0) {
        const paths: string[] = [];
        for (let i = 0; i < pointIds.length; i += 200) {
          const { data: photos } = await supabase
            .from("field_photos")
            .select("file_path")
            .in("point_id", pointIds.slice(i, i + 200));
          for (const ph of photos ?? []) paths.push(ph.file_path);
        }
        for (let i = 0; i < paths.length; i += 100) {
          await supabase.storage.from("rti-evidencias").remove(paths.slice(i, i + 100));
        }
      }
      const { error } = await supabase.from("field_inspections").delete().eq("id", inspectionId);
      if (error) throw error;
```

por:

```ts
      const paths: string[] = [];
      if (pointIds.length > 0) {
        for (let i = 0; i < pointIds.length; i += 200) {
          const { data: photos } = await supabase
            .from("field_photos")
            .select("file_path")
            .in("point_id", pointIds.slice(i, i + 200));
          for (const ph of photos ?? []) paths.push(ph.file_path);
        }
      }
      const { error } = await supabase.from("field_inspections").delete().eq("id", inspectionId);
      if (error) throw error;
      await removerArquivosOrfaos(paths);
```

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: só os erros pré-existentes de `training_certificates`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/rti-queries.ts src/lib/campo-queries.ts
git commit -m "fix(storage): exclusão confiável e reference-aware nos 7 fluxos de delete + report_path"
```

---

## Task 4: Novo esquema de path no upload manual/import (`uploadRtiEvidencia`)

Substituir `uploadRtiFile(file, prefix)` por `uploadRtiEvidencia(file, opts)`, que numera `nc-{ncNum}-{idx}` dentro do prefixo do relatório, com retry no conflito de índice.

**Files:**
- Modify: `src/lib/rti-queries.ts` (`uploadRtiFile` ~493-503)
- Modify: `src/routes/rti.nc.$ncId.tsx` (~743)
- Modify: `src/routes/rti.evidencias.tsx` (~182)

- [ ] **Step 1: `rti-queries.ts` — importar os helpers de path**

Acrescentar ao bloco de imports:

```ts
import { evidenciaFolder, evidenciaPath, maiorIndiceEvidencia } from "@/lib/storage-paths";
```

- [ ] **Step 2: `rti-queries.ts` — substituir `uploadRtiFile` por `uploadRtiEvidencia`**

Substituir a função (linhas ~493-503) por:

```ts
export type RtiEvidenciaUploadOpts = {
  orgId: string;
  reportId: string;
  reportTitulo: string | null;
  ncNum: number;
};

/**
 * Comprime e envia uma evidência para {org}/{reportSlug}/nc-{ncNum}-{idx}.{ext}.
 * O índice é o maior existente no prefixo + 1; em conflito de nome (corrida),
 * incrementa e tenta de novo. Retorna o file_path final gravado.
 */
export async function uploadRtiEvidencia(
  file: File,
  opts: RtiEvidenciaUploadOpts,
): Promise<string> {
  const resized = await resizeImage(file, 1024);
  const ext = resized.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const report = { id: opts.reportId, titulo: opts.reportTitulo };

  // Descobre o próximo índice olhando o que já existe no prefixo do relatório.
  const { data: listagem } = await supabase.storage
    .from("rti-evidencias")
    .list(evidenciaFolder(opts.orgId, report), { limit: 1000 });
  let idx = maiorIndiceEvidencia((listagem ?? []).map((o) => o.name), opts.ncNum) + 1;

  // Envia; se o nome colidir (outra sessão pegou o mesmo índice), incrementa e repete.
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const path = evidenciaPath(opts.orgId, report, opts.ncNum, idx, ext);
    const { error } = await supabase.storage
      .from("rti-evidencias")
      .upload(path, resized, { cacheControl: "3600", upsert: false });
    if (!error) return path;
    const raw = (error as Error).message?.toLowerCase() ?? "";
    const colisao = raw.includes("already exists") || raw.includes("duplicate");
    if (!colisao) throw new Error(mensagemUploadAmigavel(error));
    idx += 1;
  }
  throw new Error("Não foi possível salvar a evidência. Tente novamente em instantes.");
}
```

- [ ] **Step 3: `rti.nc.$ncId.tsx` — atualizar o call site (~743)**

Trocar a linha:

```ts
        const path = await uploadRtiFile(f, `nc-${nc.numero}`);
```

por:

```ts
        const path = await uploadRtiEvidencia(f, {
          orgId: nc.org_id,
          reportId: nc.report_id,
          reportTitulo: report?.titulo ?? null,
          ncNum: nc.numero,
        });
```

E atualizar o import no topo do arquivo (trocar `uploadRtiFile` por `uploadRtiEvidencia` na lista de imports de `@/lib/rti-queries`).

> Nota de dados: `nc.org_id`, `nc.report_id` e `nc.numero` já existem no tipo `RtiNc`. `report` é o relatório carregado na página; se não estiver disponível no escopo, passar `reportTitulo: null` (o path cai no fallback `rti-{id8}`, sem quebrar). Confirmar durante a execução qual variável de relatório existe na rota.

- [ ] **Step 4: `rti.evidencias.tsx` — atualizar o call site (~182)**

Trocar a linha:

```ts
        const path = await uploadRtiFile(item.row.file, `nc-${nc.numero}`);
```

por:

```ts
        const path = await uploadRtiEvidencia(item.row.file, {
          orgId: nc.org_id,
          reportId: nc.report_id,
          reportTitulo: nc.report_titulo ?? null,
          ncNum: nc.numero,
        });
```

E atualizar o import (`uploadRtiFile` → `uploadRtiEvidencia`).

> Nota de dados: confirmar durante a execução se o objeto `nc` desta tela expõe o título do relatório. Se não, usar `null` (fallback `rti-{id8}`) — não bloqueia.

- [ ] **Step 5: Confirmar que `uploadRtiFile` não é mais referenciado**

Run: `npx grep -rn "uploadRtiFile" src/` (ou usar a busca do editor)
Expected: **nenhum** resultado. Se sobrar algum, atualizar para `uploadRtiEvidencia`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: só os erros pré-existentes de `training_certificates`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rti-queries.ts src/routes/rti.nc.\$ncId.tsx src/routes/rti.evidencias.tsx
git commit -m "feat(storage): upload de evidência RTI numerado por NC no prefixo do relatório"
```

---

## Task 5: `comporRti` referencia a foto de campo em vez de copiar (Decisão C)

Hoje `comporRti` faz `.copy()` da foto de campo para `{org}/evidencias/uuid` → 2× storage. Passa a **referenciar** o `file_path` da foto de campo (já comprimida) direto na evidência.

**Files:**
- Modify: `src/lib/campo-queries.ts` (bloco de cópia ~1021-1047)

- [ ] **Step 1: Substituir a cópia por referência**

Substituir o trecho (dentro do `for (const ph of fotosDoPonto)`):

```ts
        for (const ph of fotosDoPonto) {
          const ext = ph.file_path.split(".").pop() ?? "jpg";
          // Path escopado por org (fallback ao legado `evidencias/…` se a inspeção
          // não tiver org_id — mantém compatibilidade sem regressão).
          const novoPath = inspection.org_id
            ? `${inspection.org_id}/evidencias/${crypto.randomUUID()}.${ext}`
            : `evidencias/${crypto.randomUUID()}.${ext}`;
          const { error: cpErr } = await supabase.storage
            .from("rti-evidencias")
            .copy(ph.file_path, novoPath);
          if (cpErr) throw cpErr;
          const { error: evErr } = await supabase.from("rti_nc_evidencias").insert({
            ...(orgId ? { org_id: orgId } : {}),
            nc_id: nc.id,
            tipo: "constatacao",
            file_path: novoPath,
            file_name: ph.file_name,
            mime_type: "image/jpeg",
            descricao: ph.legenda,
            created_by_name: actorName,
          } as never);
          if (evErr) throw evErr;
          fotosCopiadas += 1;
          done += 1;
          onProgress?.("Copiando fotos", done, totalEtapas);
        }
```

por:

```ts
        for (const ph of fotosDoPonto) {
          // Decisão C (2026-07-02): referencia a foto de campo (JÁ comprimida via
          // PWA + resizeImage 1024) em vez de copiar — 1× storage. A exclusão é
          // reference-aware (removerArquivosOrfaos), então o arquivo só some quando
          // NENHUMA linha (campo ou RTI) o referenciar mais.
          const { error: evErr } = await supabase.from("rti_nc_evidencias").insert({
            ...(orgId ? { org_id: orgId } : {}),
            nc_id: nc.id,
            tipo: "constatacao",
            file_path: ph.file_path,
            file_name: ph.file_name,
            mime_type: "image/jpeg",
            descricao: ph.legenda,
            created_by_name: actorName,
          } as never);
          if (evErr) throw evErr;
          fotosCopiadas += 1;
          done += 1;
          onProgress?.("Vinculando fotos", done, totalEtapas);
        }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: só os erros pré-existentes de `training_certificates`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/campo-queries.ts
git commit -m "perf(storage): comporRti referencia foto de campo comprimida em vez de copiar (metade do storage)"
```

---

## Task 6: Edge Function de varredura de órfãos + agendamento (Decisão D)

Rede de segurança: uma Function com service role que lista o bucket e remove objetos sem nenhuma linha em `rti_nc_evidencias`/`field_photos`/`rti_reports.report_path`. Roda por cron.

**Files:**
- Create: `supabase/functions/orphan-sweep/index.ts`
- Create: `supabase/migrations/<timestamp>_schedule_orphan_sweep.sql`

- [ ] **Step 1: Implementar a Function**

```ts
// supabase/functions/orphan-sweep/index.ts
// Varredura de órfãos do bucket rti-evidencias. Roda com service role (ignora RLS e o
// trigger protect_delete). Remove objetos SEM referência em rti_nc_evidencias / field_photos
// / rti_reports.report_path. Idempotente. Chamada por cron (ver migration de agendamento).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "rti-evidencias";

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${Deno.env.get("ORPHAN_SWEEP_SECRET")}`;
  if (auth !== expected) return new Response("unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Lista recursiva do bucket (prefixos por org/relatório + legado)
  const objetos: string[] = [];
  async function listar(prefix: string) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const o of data ?? []) {
      const full = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id === null) await listar(full); // pasta → desce
      else objetos.push(full);
    }
  }
  await listar("");

  // 2. Conjunto de paths referenciados
  const refs = new Set<string>();
  for (const tabela of ["rti_nc_evidencias", "field_photos"] as const) {
    const { data } = await supabase.from(tabela).select("file_path");
    for (const r of data ?? []) if (r.file_path) refs.add(r.file_path);
  }
  const { data: reports } = await supabase
    .from("rti_reports")
    .select("report_path")
    .not("report_path", "is", null);
  for (const r of reports ?? []) if (r.report_path) refs.add(r.report_path);

  // 3. Remove os órfãos
  const orfaos = objetos.filter((p) => !refs.has(p));
  let removidos = 0;
  for (let i = 0; i < orfaos.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(orfaos.slice(i, i + 100));
    if (error) throw error;
    removidos += orfaos.slice(i, i + 100).length;
  }

  return new Response(
    JSON.stringify({ objetos: objetos.length, referenciados: refs.size, removidos }),
    { headers: { "content-type": "application/json" } },
  );
});
```

- [ ] **Step 2: Deploy da Function (via Supabase MCP)**

Deploy `orphan-sweep` no projeto `fumwovtzyhxrjhkjzujs` (ferramenta `deploy_edge_function`). Definir os secrets `ORPHAN_SWEEP_SECRET` (gerar um token aleatório) e confirmar que `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` estão disponíveis no runtime (injetados pelo Supabase).
Expected: função ACTIVE.

- [ ] **Step 3: Rodar um dry-run manual e conferir**

Chamar a Function com o header `Authorization: Bearer <ORPHAN_SWEEP_SECRET>` e ver o JSON `{ objetos, referenciados, removidos }`. Com o bucket ainda vazio/consistente, `removidos` deve ser 0.
Expected: HTTP 200, `removidos: 0`.

- [ ] **Step 4: Agendar via pg_cron**

```sql
-- supabase/migrations/<timestamp>_schedule_orphan_sweep.sql
-- Varredura semanal de órfãos do bucket rti-evidencias (domingo 03:00 UTC).
-- Requer as extensões pg_cron e pg_net (já disponíveis no Supabase).
select cron.schedule(
  'orphan-sweep-semanal',
  '0 3 * * 0',
  $$
  select net.http_post(
    url     := 'https://fumwovtzyhxrjhkjzujs.supabase.co/functions/v1/orphan-sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.orphan_sweep_secret', true)
    )
  );
  $$
);
```

> Nota: definir `app.orphan_sweep_secret` como configuração do banco (ou embutir o secret direto no header do agendamento — decidir na execução conforme a política de secrets do projeto). Aplicar via `apply_migration` e versionar o `.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/orphan-sweep/index.ts supabase/migrations/
git commit -m "feat(storage): Edge Function orphan-sweep + agendamento semanal (rede de segurança)"
```

---

## Task 7: Verificação E2E manual (checklist) + self-review

Sem ambiente de teste automatizado ponta-a-ponta para Storage; verificar no app local (porta 57010, já rodando; **não** iniciar/parar) e no Supabase via MCP.

- [ ] **Upload numerado:** anexar 2 fotos na mesma NC de um relatório e conferir no Storage os paths `{org}/{reportSlug}/nc-{ncNum}-1.jpg` e `-2.jpg`. Anexar em outra NC → `nc-{outroNum}-1.jpg`. Rodar:
  `select file_path from rti_nc_evidencias order by created_at desc limit 5;` (via MCP) — confirmar o padrão.
- [ ] **Composição sem duplicar:** compor um RTI a partir de uma inspeção de campo com fotos; conferir que `rti_nc_evidencias.file_path` **é igual** ao `field_photos.file_path` (referência, não cópia) e que **não** surgiu objeto novo em `{org}/evidencias/`. Rodar:
  `select e.file_path = p.file_path as mesma from rti_nc_evidencias e join field_photos p on p.file_path = e.file_path limit 5;`
- [ ] **Exclusão reference-aware:** apagar a evidência RTI que referencia uma foto de campo → o arquivo **permanece** (ainda referenciado por `field_photos`). Depois apagar a foto de campo → aí o arquivo **some** do Storage. Confirmar contagem de objetos antes/depois via `select count(*) from storage.objects;`.
- [ ] **`report_path` limpo:** criar um relatório com PDF (`report_path`), apagá-lo, e confirmar que o objeto do PDF sumiu do Storage.
- [ ] **Órfão zero:** rodar a query de órfãos do plano de análise (objetos sem referência) e confirmar 0.
- [ ] **Self-review do plano:** revisar cobertura das decisões A–D, ausência de placeholders, e consistência de nomes (`uploadRtiEvidencia`, `removerArquivosOrfaos`, `evidenciaPath`, `reportSlug`).
- [ ] **Verificação final:** `npx tsc --noEmit -p tsconfig.json` (só erros pré-existentes) e `npx vitest run` (verde).

---

## Notas de risco / rollback

- **Ordem importa:** Task 3 (deletes reference-aware) **antes** da Task 5 (referência em vez de cópia) — assim, quando as fotos passam a ser compartilhadas, a exclusão já é segura.
- **Sem migração de dados:** tudo é código de escrita/leitura; o Storage está vazio. Rollback = reverter os commits; nenhum dado a restaurar.
- **`.list()` com limite 1000:** o cálculo de índice e a varredura assumem ≤1000 arquivos por prefixo de relatório — folga enorme para o caso real (dezenas de NCs). Se algum dia estourar, paginar o `list`.
- **Não commitar/deployar por conta própria:** seguir o fluxo do projeto (commits e deploy da Edge Function só sob comando do usuário).
```

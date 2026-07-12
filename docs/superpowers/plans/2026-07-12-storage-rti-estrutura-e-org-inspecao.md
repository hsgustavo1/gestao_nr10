# Plano — Estrutura de storage do RTI (move-on-compose) + org explícita na inspeção

**Goal:** Materializar a estrutura-alvo do bucket para dados novos (evidencias-importadas/,
campo/ via move-on-compose, staging por inspeção) e tornar a org explícita na criação de
inspeção no app principal.

**Base:** spec [`2026-07-12-storage-rti-estrutura-e-org-inspecao-design.md`](../specs/2026-07-12-storage-rti-estrutura-e-org-inspecao-design.md).

**Regra:** sem migração de dados, sem DDL. TDD nas funções puras. Move-on-compose com
salvaguarda (nunca quebra a composição).

---

### Task 1 — Path builders (puro, TDD) — `src/lib/storage-paths.ts`

- Add `evidenciasImportadasFolder`, alterar `evidenciaPath` (nível `evidencias-importadas/`),
  add `campoEvidenciaPath`, `inspecaoSlug`, `inspecaoStagingFolder`, `inspecaoStagingPath`.
- Test: `storage-paths.test.ts` — evidenciaPath agora sob `evidencias-importadas`;
  campoEvidenciaPath sob `campo`; inspecaoStagingPath sob `inspecoes/{slug}`.
- Verify: `npx vitest run src/lib/storage-paths.test.ts`.

### Task 2 — Evidência manual em `evidencias-importadas/` — `src/lib/rti-queries.ts`

- `uploadRtiEvidencia`: listar e gravar via `evidenciasImportadasFolder`/`evidenciaPath` novos.
- Verify: `tsc` + a suíte (path tests cobrem o formato).

### Task 3 — Staging da foto de campo no app — `src/lib/campo-queries.ts` + call sites

- `uploadFieldPhoto(file, ctx {orgId, orgNome, inspection})` → `inspecaoStagingPath`.
  Fallback: sem inspection/org → path legado `campo/`.
- Atualizar call sites (grep `uploadFieldPhoto(`).
- Verify: `tsc`.

### Task 4 — Staging da foto de campo no PWA — `campo-pwa/src/sync/engine.ts`

- Helper local puro (mirror de slugify/inspecaoSlug) em `campo-pwa/src/lib/storage-paths.ts`.
- `resolvePhotoStagingContext(pointId)` → `{orgId, orgNome, inspId, inspTitulo}` (ponto→org do
  cache `campo_orgs`; ponto→inspeção→título).
- `uploadPhoto`: grava em `{slug(org.nome)}-{orgId}/inspecoes/{inspecaoSlug}/{uuid}.ext`;
  cascata de fallback (`{orgId}/inspecoes/...` → `campo/...`).
- Verify: `tsc` do PWA (`npx tsc -p campo-pwa`), testes do PWA.

### Task 5 — Move-on-compose — `src/lib/campo-queries.ts` → `comporRti`

- Buscar `org.nome` (organizations) e, no modo existente, `rti_reports.titulo`.
- No laço de fotos da NC nova: computar alvo `campoEvidenciaPath`, `move` com
  idempotência (mapa `movidas`), atualizar `field_photos.file_path`, inserir evidência no path
  final. **Salvaguarda:** try/catch no move → degrada para `ph.file_path` original.
- Verify: `tsc`; smoke manual no 57010 (compor uma coleta pequena) na validação final.

### Task 6 — Org explícita na inspeção do app principal — `src/routes/campo.index.tsx` + `campo-queries.ts`

- `useUpsertFieldInspection`: `org_id: payload.org_id ?? currentOrgId` no create.
- Diálogo "Nova inspeção de campo": seletor de empresa (auth.orgs operáveis) definindo
  `org_id`; default currentOrg; single-org/PA = read-only mostrando a org; fallback texto-livre
  sem lista.
- Verify: `tsc`; validação visual no 57010.

### Task 7 — Validação final

- `npx vitest run` (tudo verde), `tsc` app + PWA, `eslint` nos arquivos tocados.
- Commits por task (mensagens claras). Sem push (regra do projeto).

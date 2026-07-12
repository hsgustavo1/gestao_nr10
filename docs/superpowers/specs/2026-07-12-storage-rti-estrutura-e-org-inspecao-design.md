# Spec — Estrutura de storage do RTI (move-on-compose) + org explícita na inspeção

**Data:** 2026-07-12
**Status:** design aprovado (founder). Implementa os **itens 1 e 2** conversados; o item 3
(arquivo de originais no OneDrive) fica **fora** de propósito.
**Base:** decisão [`2026-07-11-storage-rti-move-on-compose-decisao.md`](2026-07-11-storage-rti-move-on-compose-decisao.md)
(Cenário A). Parte da trilha S1 do H0.
**Não faz:** saneamento/migração dos objetos legados já no bucket (fica para depois) — nem DDL.

---

## Objetivo

1. **Estrutura-alvo do bucket `rti-evidencias`** para dados **novos**:
```
{slug(org.nome)}-{orgId}/                 nível 1 (empresa)
├── {reportSlug}/                         nível 2 (RTI; acumula por empresa)
│   ├── evidencias-importadas/ nc-XXXX-XX.jpg   (upload manual no RTI)
│   ├── campo/                 nc-XXXX-XX.jpg   (fotos de campo MOVIDAS na composição)
│   ├── art/                   art-{slug}.pdf
│   └── relatorios/            relatorio-vNN.pdf · _preview.pdf
└── inspecoes/
    └── {inspecaoSlug}/        {uuid}.jpg       (STAGING das fotos de campo, pré-composição)
```
2. **Org explícita na criação de inspeção no app principal** (hoje é a org ambiente do
   OrgSwitcher + um campo "Cliente/unidade" texto-livre que não define `org_id`).

## O que já existe (não reinventar)

- `storage-paths.ts` já monta `{slug(org.nome)}-{orgId}/{reportSlug}` e nomeia `nc-XXXX-XX`
  com zero-padding. ART e relatórios já ficam em `art/` e `relatorios/`.
- `uploadRtiEvidencia`/`uploadRtiArt` ([rti-queries.ts:536,578]) já usam esses helpers.
- Exclusão já é reference-aware (`removerArquivosOrfaos`) — foto some só quando NENHUMA
  linha (campo ou RTI) a referencia.
- PWA e app comprimem para 1024px antes de subir.

## Mudanças por área

### A. Path builders (`src/lib/storage-paths.ts`) — puro, TDD

- `evidenciasImportadasFolder(orgId, report, orgNome)` = `${evidenciaFolder(...)}/evidencias-importadas`.
- `evidenciaPath(...)` passa a devolver `.../evidencias-importadas/nc-XXXX-XX.ext` (era solto).
- `campoEvidenciaPath(orgId, report, ncNum, idx, ext, orgNome)` = `${evidenciaFolder(...)}/campo/nc-XXXX-XX.ext`.
- `inspecaoSlug(inspection {id,titulo})` — espelha `reportSlug` (`slug(titulo≤40)-{id8}`, fallback `insp-{id8}`).
- `inspecaoStagingFolder(orgId, inspection, orgNome)` = `${orgFolderName(...)}/inspecoes/${inspecaoSlug(...)}`.
- `inspecaoStagingPath(orgId, inspection, fileId, ext, orgNome)` = `${inspecaoStagingFolder(...)}/${fileId}.${ext}`.

> `art/` e `relatorios/` **não mudam**: continuam derivando de `evidenciaFolder`. Só a
> evidência manual ganha o nível `evidencias-importadas/`.

### B. Upload de evidência manual (`src/lib/rti-queries.ts`)

- `uploadRtiEvidencia` lista e grava em `evidenciasImportadasFolder(...)` (antes era o folder
  do relatório direto). Resto igual (retry por colisão de índice).

### C. Staging da foto de campo — app (`uploadFieldPhoto`) e PWA (`engine.ts`)

- **App** `uploadFieldPhoto(file, ctx)`: passa a receber `{ orgId, orgNome, inspection {id,titulo} }`
  e gravar em `inspecaoStagingPath`. Atualiza os call sites.
- **PWA** `uploadPhoto`: resolve org (id+nome do cache) e a inspeção (título) a partir do
  ponto; grava em `{slug(org.nome)}-{orgId}/inspecoes/{inspecaoSlug}/{uuid}.ext`. **Fallbacks
  em cascata, sem regressão:** sem nome de org → `{orgId}/inspecoes/...`; sem inspeção/org →
  path legado `campo/...`. Um helper puro local espelha `slugify`/`inspecaoSlug` do app
  (drift conhecido, como `campo.ts`).

### D. Move-on-compose (`src/lib/campo-queries.ts` → `comporRti`) — o núcleo

Para cada foto que vira **evidência de constatação** de uma NC nova:

1. Calcula `alvo = campoEvidenciaPath(orgId, {id:reportId, titulo:reportTitulo}, numero, idx, ext, orgNome)`.
2. `supabase.storage.from('rti-evidencias').move(ph.file_path, alvo)`.
3. **Idempotência + foto compartilhada:** mapa `movidas: Map<photoId, novoPath>`. Se a foto já
   foi movida nesta composição (foto solta reaproveitada por 2+ achados via
   `fotosParaAchado`), reusa `novoPath` e **não** move de novo. Se `ph.file_path` já está sob
   `.../campo/` (recomposição), trata como já no destino.
4. Atualiza `field_photos.file_path = alvo` (a foto de campo passa a apontar para o novo lar;
   exclusão reference-aware segue funcionando).
5. Insere `rti_nc_evidencias` com `file_path = alvo`.
6. **Salvaguarda (crítica):** se o `move` falhar (RLS de storage, arquivo já movido por corrida,
   offline), **degrada para o comportamento de hoje** — referencia `ph.file_path` original e
   segue. A composição **nunca** quebra por causa do move. Falha é logada, não propagada.

Pré-requisitos que `comporRti` passa a buscar: `org.nome` (query em `organizations`) e, no modo
"relatório existente", o `titulo` do relatório (query em `rti_reports`). `idx` = ordem da foto
dentro da NC (1..n).

### E. Org explícita na inspeção do app principal — item 2

- Diálogo "Nova inspeção de campo" ([campo.index.tsx]): troca o efeito ambíguo do campo
  "Cliente / unidade" por um **seletor de empresa** (as orgs operáveis do usuário) que define o
  `org_id`, espelhando o PWA. Default = org ativa (`currentOrg`). Platform admin / usuário
  single-org: campo somente-leitura mostrando a org. Mantém o texto-livre só como fallback
  quando não há lista de orgs.
- `useUpsertFieldInspection`: honra `payload.org_id` explícito (hoje o `currentOrgId` sempre
  sobrescreve no create). Passa a `org_id: payload.org_id ?? currentOrgId`.

## Fora de escopo

- Migração/saneamento dos objetos já no bucket (raízes órfãs `cce11347/campo`, `c221b14e/…`).
- Item 3 (originais no OneDrive).
- Setor no caminho do staging: **não** entra (staging é transitório e o setor pode não estar
  sincronizado no momento do upload; o agrupamento por inspeção já resolve a localização). O
  setor volta a aparecer como **área** dentro do RTI, na composição.

## Riscos & mitigação

- **RLS de storage pode barrar `move`** → salvaguarda D.6 (degrada para referência). Validar em
  execução se o move passa; se não passar, a estrutura de `campo/` só se materializa quando a
  RLS de storage for ajustada (item de saneamento), sem quebrar nada.
- **Escala (1.021 fotos)** → move é 1 chamada por foto, com `onProgress` já existente. Aceitável.
- **Compatibilidade com objetos legados** → nada migra; paths antigos continuam válidos (bucket
  público + `file_path` autoritativo no banco). Novo código conviverá com dados antigos.

## Aceite

- Testes das funções puras de path (evidencias-importadas, campo, staging) verdes.
- Suíte completa verde; `tsc` e `eslint` limpos.
- Nova evidência manual cai em `.../evidencias-importadas/`; nova inspeção no app principal
  grava o `org_id` **escolhido** (não o ambiente por acidente); `comporRti` move a foto para
  `.../campo/nc-XXXX-XX` (ou degrada para referência sem quebrar). Validação visual no 57010.

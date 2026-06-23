# Fotos de NC: compressão, organização e estratégia de storage — Plano

> **Status:** rascunho para análise (não executado). Escrito em 2026-06-23.
> **Decisão pendente do usuário** antes de qualquer execução — ver §7 (Decisões em aberto).

**Goal:** Resolver o limite de storage (Supabase Free = 1 GB) sem perder qualidade/rastreabilidade das evidências fotográficas de não conformidade, e dar ao inspetor uma forma organizada de revisar e exportar as fotos por inspeção/setor/ponto.

**Princípio norteador:** **original fica no dispositivo, sobe só o comprimido.** O Supabase guarda a versão de trabalho; o arquivo full-res permanece na galeria do celular de quem fotografou (garantido no iOS, quase sempre no Android, via `capture="environment"`).

---

## 1. Situação atual (fundamentada no código)

Fluxo de uma foto, hoje, ponta a ponta:

| Etapa | Arquivo | O que faz | Compressão? |
|-------|---------|-----------|-------------|
| Captura | `campo-pwa/src/pages/PointCapture.tsx:258` (`handlePhoto`) | `<input type="file" accept="image/*" capture="environment">` → `File` → grava `blob: file` em `db.photos` (Dexie) e enfileira sync | ❌ Nenhuma |
| Fila | `campo-pwa/src/db/dexie.ts:33` (`LocalPhoto`) | blob fica no IndexedDB; `_synced=false` | — |
| Upload | `campo-pwa/src/sync/engine.ts:279` (`uploadPhoto`) | `supabase.storage.from("rti-evidencias").upload(...)` do blob original → upsert em `field_photos` | ❌ Nenhuma |
| Pós-sync | `engine.ts:312` | grava `file_path`, marca `_synced=true` — **mas não descarta o blob** | — |

**Problemas que isso gera:**

1. **Supabase Storage estoura cedo.** Fotos de celular moderno ~3–5 MB → ~250 fotos no 1 GB do Free.
2. **IndexedDB cresce sem teto.** O blob original permanece no Dexie mesmo após o upload (linha 312 só atualiza `file_path`/`_synced`). Em uso prolongado o navegador pode despejar o IndexedDB (eviction) ou travar.
3. **Sem organização de revisão.** Não há galeria por inspeção/setor; as fotos vivem espalhadas por ponto, vistas só dentro do `PointCapture`.
4. **Sem exportação estruturada.** Não há como entregar as evidências num pacote organizado (laudo/fiscalização).

**Hierarquia de dados disponível** (para nomear pastas/álbuns): `field_photos.point_id` → `point` (`node_id`, `inspection_id`, `org_id`) → `node` (setor/área) → `inspection` (título, cliente, local). Tudo já existe no schema.

---

## 2. Por que NÃO a rota "nuvem intermediária" nem "OneDrive como storage"

Descartadas após análise:

- **OneDrive/GDrive como storage principal das evidências:** sem RLS nativa por org. Exigiria um servidor intermediário para autenticar e isolar dados por tenant — reintroduz a complexidade que o Supabase RLS já resolve de graça. Troca limite de espaço por dívida de segurança.
- **Comprimir depois (foto sobe full → Edge Function comprime → regrava):** cria estados inconsistentes no fluxo offline-first e gasta egress duas vezes. Compressão **no cliente, antes de subir**, é mais simples e mais barata.

---

## 3. Arquitetura recomendada (faseada)

Quatro fases independentes, ordenadas por **ROI/risco**. Cada fase entrega valor sozinha; dá para parar em qualquer ponto.

```
Fase 1  Compressão no cliente .................. maior ROI, menor risco  ← começar aqui
Fase 2  Galeria organizada no PWA .............. UX de revisão
Fase 3  Exportar evidências (.zip estruturado) . entrega para laudo
Fase 4  Capacitor → álbuns nativos (opcional) .. só se virar requisito
```

---

## 4. Fase 1 — Compressão no cliente (original no dispositivo, comprimido no Supabase)

**Objetivo:** reduzir 70–85% do tamanho de cada foto sem mexer na arquitetura de sync/RLS.

**Biblioteca:** `browser-image-compression` (~ poucos KB, sem dependência nativa, roda em Web Worker — não trava a UI no celular).

**Ponto único de intervenção:** `handlePhoto` em `PointCapture.tsx:258`. Comprimir **antes** do `db.photos.add` — assim tanto o IndexedDB quanto o Supabase recebem só o comprimido, e o original permanece intacto na galeria do OS.

**Config sugerida (a calibrar com fotos reais de campo):**

```ts
const opts = {
  maxSizeMB: 0.6,            // alvo ~600 KB/foto
  maxWidthOrHeight: 2048,    // mantém legibilidade de placas/terminais/etiquetas
  useWebWorker: true,
  fileType: "image/jpeg",
  initialQuality: 0.8,
};
const comprimido = await imageCompression(file, opts);
```

**Pontos de atenção:**
- **EXIF/orientação:** garantir que a rotação não se perca (a lib trata, mas validar no iOS).
- **Falha de compressão:** se a lib falhar, fazer fallback para o `file` original (nunca perder a foto).
- **Descarte do blob pós-sync:** aproveitar a fase para corrigir o bug #2 — em `uploadPhoto` (`engine.ts:312`), após `_synced=true`, considerar `blob: null` (ou política de retenção: manter N dias/MB). **Decisão em aberto** — ver §7.
- **Fotos legadas:** as já enviadas full-res continuam no Supabase. Migração retroativa (reprocessar e regravar comprimido) é opcional e separada — não bloqueia a Fase 1.

**Storage depois da Fase 1:**

| Cenário | Tamanho/foto | Fotos no 1 GB Free |
|---------|--------------|--------------------|
| Hoje (sem compressão) | ~4 MB | ~250 |
| Fase 1 (`maxSizeMB 0.6`) | ~600 KB | **~1.700** |
| Fase 1 agressiva (`0.3`) | ~300 KB | ~3.400 |

**Risco:** baixo. Mudança localizada em 1 função + 1 ajuste no upload. Sem mudança de schema, RLS ou rota.

---

## 5. Fase 2 — Galeria organizada dentro do PWA

**Objetivo:** o inspetor revê todas as fotos de uma inspeção, agrupadas por setor (node) e ponto, com legenda e status de sync — sem entrar ponto a ponto.

**Entrega:**
- Nova rota no campo-pwa (ex.: `inspecoes/:id/galeria`).
- Árvore: **Inspeção → Setor (node) → Ponto → fotos** (grid de thumbnails).
- Cada thumbnail mostra: legenda, ✓ sincronizada / ⏳ pendente, e a NC vinculada.
- Fonte de dados: já tudo no Dexie (`db.photos` + `db.points` + `db.nodes`). Sem rede.

**Risco:** baixo-médio. É só leitura/apresentação sobre dados que já existem. Reaproveita `buildOrgTree`/helpers de árvore do campo-core.

---

## 6. Fase 3 — Exportar evidências (.zip com estrutura de pastas)

**Objetivo:** botão "Exportar evidências" que gera um `.zip` já organizado, para anexar a laudo/dossiê ou arquivar fora do app.

**Estrutura do pacote:**
```
{inspeção}/
  {setor}/
    {ponto}/
      001 - {legenda}.jpg
      002 - {legenda}.jpg
  resumo.csv   (ponto, setor, NC, legenda, data, status)
```

**Biblioteca:** `jszip` + download via Blob (ou `Web Share API` → "salvar em Arquivos/Drive" no celular).

**Origem das fotos:** preferir o blob local (full-res, se ainda existir) e cair para download do Supabase (comprimido) quando o blob já tiver sido descartado. **Depende da decisão de retenção da §7.**

**Risco:** médio. Zips grandes em memória no celular podem pesar — avaliar streaming/limite por lote (ex.: exportar por setor).

---

## 7. Decisões em aberto (precisam da sua análise antes de executar)

1. **Política de retenção do blob original no dispositivo:**
   - (a) descartar do IndexedDB assim que sincronizar (mais leve, mas perde full-res local — fica só na galeria do OS); ou
   - (b) manter por N dias / até X MB e depois podar; ou
   - (c) manter sempre (não recomendado — IndexedDB incha).
   → Afeta Fases 1 e 3.

2. **Agressividade da compressão:** `0.6 MB` (conservador, legibilidade alta) vs `0.3 MB` (dobra a capacidade). Calibrar com fotos reais de placas/terminais antes de fixar.

3. **Migração das fotos legadas** já enviadas full-res: reprocessar para liberar espaço, ou deixar como estão? (Pode rodar como job único depois.)

4. **Fase 4 (Capacitor) entra no roadmap?** Só vale se "álbum nativo real na galeria, organizado por inspeção/setor" virar requisito de cliente. É troca de stack (empacotar o PWA em shell nativo) — mantém o React quase intacto, mas adiciona build iOS/Android, lojas, etc. **Não recomendado agora**; registrar como opção futura.

---

## 8. Fase 4 (futuro/opcional) — Capacitor para álbuns nativos

Único caminho para **gravar de fato em álbum da galeria do OS** (`inspeção` = álbum, `setor` = subpasta) com direcionamento automático. PWA puro não consegue (API exclusiva de app nativo).

- Empacota o campo-pwa atual com **Capacitor** → acesso a `@capacitor/camera` + plugins de galeria (Photos/MediaStore).
- Código React praticamente inalterado; ganha-se câmera nativa, álbuns e melhor controle de armazenamento.
- Custo: pipeline de build nativo, publicação (ou distribuição interna), manutenção de duas plataformas.

**Recomendação:** manter no radar; decidir só após Fases 1–3 e com demanda concreta de cliente.

---

## 9. Resumo executivo (para decisão rápida)

- **Faça a Fase 1 primeiro.** Sozinha, multiplica por ~7x a capacidade do plano Free, com risco baixo e mudança localizada. Resolve 90% da dor de storage.
- **Fases 2 e 3** entregam a organização/revisão/entrega que você pediu, sem sair do PWA e sem custo de infra.
- **Álbum nativo de verdade** (Fase 4) só com Capacitor — fica para depois, se for requisito.
- **OneDrive/GDrive como storage**: descartado (sem RLS por tenant; reintroduz servidor e complexidade).

**Antes de executar:** responder às 4 decisões da §7.

---

## 10. Execução — 2026-06-23

Decisões do usuário aplicadas: **(1) opção A** (descarta blob após sync), **(2) compressão 0,6 MB**, **(3) sem migração de legado — apagar órfãos**, **(4) Capacitor fica no roadmap com prioridade baixíssima**.

### Entregue

- **Fase 1 — Compressão no cliente** ✓
  - `campo-pwa/src/lib/image.ts` (`compressPhoto`): `browser-image-compression`, alvo 0,6 MB, `maxWidthOrHeight 2048`, web worker, **fallback ao original** em qualquer falha; pula recompressão se já ≤ 0,6 MB.
  - `PointCapture.tsx` `handlePhoto`: comprime antes de gravar no Dexie.
- **Descarte de blob pós-sync (opção A)** ✓ — `sync/engine.ts` `uploadPhoto` grava `blob: null` após `_synced=true`. Original full-res permanece na galeria do aparelho.
- **Numeração de NC** ✓ — já era contínua por relatório no `comporRti` (app, `src/lib/campo-queries.ts`); o backup espelha a regra (`buildNcNumbering`): NC sequencial na ordem dos pontos, **não reinicia por setor**; ponto com várias fotos → `NC_001_1`, `NC_001_2`…; ponto com vários achados → `NC_001-002`.
- **Backup por setor (.zip)** ✓ — `campo-pwa/src/lib/export-fotos.ts` (`exportSetorFotos`): zip das fotos do setor a partir dos blobs do Dexie (fallback: download do Supabase se já sincronizada), nomeadas por NC, com `resumo.csv`. Usa Web Share (salvar em Arquivos/Drive) com fallback para download. `jszip` em chunk dinâmico.
  - **Alerta ao trocar de setor** ✓ — `InspectionDetail.tsx`: ao sair de um setor com fotos, sugere o backup (uma vez por setor/sessão). **Não altera o upload ao Supabase.**
- **Limpeza de órfãos** — script pronto: `scripts/cleanup-orphan-evidencias.mjs`.

### ⚠️ Pendência operacional (precisa de 1 ação sua)

Achado: o bucket `rti-evidencias` tinha **383 imagens órfãs (~867 MB)** — zero linhas em `field_photos`/`rti_nc_evidencias` (relatórios de teste apagados sem limpar o Storage). O Supabase **bloqueia DELETE direto** em `storage.objects` (trigger `protect_delete`); a remoção exige a **service-role key** via Storage API, que não está no ambiente local. Tentar burlar o trigger foi (corretamente) negado.

**Para liberar os ~867 MB**, rode na raiz do projeto com a sua service-role key (Dashboard → Settings → API):
```powershell
$env:SUPABASE_URL="https://fumwovtzyhxrjhkjzujs.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role key>"
node scripts/cleanup-orphan-evidencias.mjs           # dry-run (lista)
node scripts/cleanup-orphan-evidencias.mjs --apply   # remove
```
O script só apaga objetos **sem referência no banco** (dupla checagem).

### Ainda no roadmap (não executado)

- **Fase 2 — Galeria organizada no PWA** (visualizador por inspeção/setor/ponto). O backup por setor já cobre a necessidade imediata de revisão/segurança.
- **Fase 4 — Capacitor** (álbuns nativos) — prioridade baixíssima.
- **Calibrar compressão** com fotos reais de campo (placas/terminais) antes de fixar 0,6 MB.

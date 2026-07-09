# Trilha C — Wizard de Relatório RTI (Motor 3, v1)

**Data:** 2026-07-09
**Status:** design elaborado com decisões tomadas pela IA em nome do founder — **auditar em
[`2026-07-09-decisoes-trilhas-c-a-d.md`](2026-07-09-decisoes-trilhas-c-a-d.md)** antes do plano.
**Ordem:** 2ª trilha (após validação em campo do B — spec cofre e portão).
**Objetivo de produto:** "cheguei do campo, o relatório está 80% pronto" — a maior alavanca
de valor percebido do roadmap (análise multi-NR §6, Horizonte 1).

---

## 1. Problema

Hoje o consultor coleta em campo, o `comporRti` monta o plano de ação no app — e o
**relatório entregável ao cliente continua sendo feito no Word dele**. O dossiê existente
exporta via `window.print()`, sem capa, sem identidade do consultor, sem ART, sem controle
de paginação de fotos. O gargalo de horas do consultor (a dor 2.2 do brainstorm) está aqui.

## 2. Escopo v1

**Entra:** wizard seriado no app principal para gerar o **Relatório Técnico de Inspeção
(RTI)** em PDF de alto padrão, a partir de um `rti_report` existente. Identidade visual
mínima do consultor. Sugestão de texto por IA (editável).

**Não entra (registrado):** dossiê composicional multi-norma (Motor 3 completo — H2);
white-label do app inteiro; transcrição de áudio (porta aberta do B, entra quando áudio
existir); relatórios de outros tipos de inspeção (termografia/SPDA — entram como conteúdo
quando o Motor 2 existir).

## 3. Fluxo do wizard

Rota nova `/rti/relatorio/$reportId/wizard`, acessível por botão "Gerar relatório" na tela
do plano de ação. **Cada etapa salva rascunho** (tabela `rti_report_wizard`, ver §6) — o
consultor pode parar e retomar.

| Etapa | Conteúdo | Pré-preenchido de |
|---|---|---|
| 1. Identificação | Cliente, local, período da inspeção, responsável técnico, nº ART, normas de referência | `field_inspections`, org, perfil |
| 2. Revisão de NCs | Lista seriada: uma NC por vez — descrição/recomendação editáveis, prioridade, **fotos vinculadas** (usa `field_photos.finding_id` entregue no B; fallback: fotos do ponto) | `rti_ncs` + evidências |
| 3. Parecer técnico | Conclusão do laudo — **texto sugerido por IA** (Groq, já integrado no projeto) a partir das NCs/prioridades/normas, sempre editável | IA + consultor |
| 4. Preview | Render do PDF na tela, paginado | — |
| 5. Emitir | Gera PDF final, anexa ao report (Storage), integra o **selo de entrega** existente (entregar = congela) | `fn_entregar_rti_report` |

Meta: relatório de 30 NCs revisado e emitido em **< 1 hora** (hoje: dias no Word).

## 4. Geração do PDF

**Decisão (D-C2): `@react-pdf/renderer` rodando server-side** numa rota server do app
(TanStack Start no Vercel Node) — layout declarativo em React, determinístico, sem
headless browser (Puppeteer = cold start pesado no Vercel). `pdf-lib` (já dependência)
continua para manipulação (merge/append), não para composição de layout.

Estrutura do documento: capa (logo do consultor + título + cliente + data + ART) →
sumário → introdução/metodologia (template + edições) → NCs numeradas com fotos, GPS e
autoria (dividendos do B) → quadro-resumo por prioridade/custo → parecer técnico →
página de assinatura. Numeração de página, cabeçalho/rodapé com identidade.

## 5. Identidade do consultor (white-label mínimo)

Colunas novas em `organizations` (ou tabela `org_branding` 1:1 se crescer): `logo_path`
(Storage), `cor_primaria`, `razao_social_relatorio`, `registro_profissional`. Usadas **só
no PDF** na v1. Editável em `/admin/empresas` pelo consultor admin.

## 6. Dados

- Tabela `rti_report_wizard` (`report_id` PK/FK, `etapa_atual`, `identificacao jsonb`,
  `parecer text`, `ncs_overrides jsonb` — edições de texto por NC que **não** alteram o
  registro técnico congelável até a emissão, `updated_at`). RLS espelha `rti_reports`.
- PDF emitido: Storage `rti-evidencias/{org}/relatorios/{reportId}-v{n}.pdf` + linha em
  `rti_report_pdfs` (report_id, versao, file_path, emitido_por, emitido_em). Reemissão
  gera versão nova (auditoria), nunca sobrescreve.
- **Decisão de foto (gap 8 do brainstorm):** v1 mantém compressão 1024px — validar no
  primeiro PDF real se o zoom de detalhe basta. Se não bastar: "foto de detalhe" opcional
  a 2048px no PWA (mudança pequena em `compressPhoto`), decidir com evidência.

## 7. IA (uso mínimo e revisável)

Reusa o padrão Groq de `certificados-ai-server.ts`: server function que recebe o resumo
estruturado das NCs e devolve rascunho de parecer + resumo executivo. Nunca emite sem
revisão humana; o texto da IA chega marcado como "sugestão". Custo por relatório ≈
centavos. (Futuro: transcrição de áudio de campo alimentando descrições — fase 2.)

## 8. Erros e testes

- PDF é gerado server-side com timeout folgado; falha → wizard mantém rascunho e mostra
  erro claro (nunca perde edição).
- Funções puras testáveis: montagem do modelo de dados do PDF (report+NCs+overrides →
  árvore de seções), numeração/agrupamento de NCs, merge de overrides. TDD nelas.
- Teste visual: snapshot do PDF de um report seed (contagem de páginas + textos-chave
  extraídos com pdf-lib).

## 9. Riscos

- Fidelidade tipográfica do @react-pdf (fontes: embutir Hanken Grotesk).
- Volume de fotos → PDF grande; mitigar com recompressão no server p/ inclusão (media
  ~200KB/foto no PDF).
- O wow depende do design do template — reservar iteração de design com 1 relatório real
  do consultor como referência lado a lado.

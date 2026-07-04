# H0 como sequência de sessões executáveis

**Data:** 2026-07-04
**Status:** pronto para execução — cada sessão abaixo é autossuficiente (pré-condições + entradas + aceite)
**Origem:** Horizonte 0 de [2026-07-03-analise-estrategica-multi-nr.md](2026-07-03-analise-estrategica-multi-nr.md), decomposto em sessões após conferência contra o estado real do repo.

## Correções contra a análise estratégica (estado real em 2026-07-04)

1. **"Dossiê + incidentes" JÁ ESTÁ ENTREGUE.** A seção "6. Incidentes e quase-acidentes elétricos" existe em [relatorio.dossie.tsx:557](../../../src/routes/relatorio.dossie.tsx) e a ponderação por gravidade já está no índice global (`incidentCompliancePercent`, [conformidade.ts:22-47](../../../src/lib/conformidade.ts)) e no payload de snapshot. O item sai do H0. Sobra só o follow-up P2 da spec (seção LOTO condicional — bloqueada pela desvinculação Lovable) e o "modo auditoria" (adiado de propósito).
2. O restante confere: trilha de storage especificada e **não executada**; bucket `certificates` inexistente; 6 buckets sem hardening; Lovable pendente; resíduo Cloudflare presente no `package.json`.

## Ordem e dependências

```
S1 (storage) ──► S2 (certificates + hardening)    [mesma família; S2 pode pegar carona]
S3 (prova campo→RTI)                              [independente; precisa de dados de teste]
S4 (Lovable)  ──► libera trilha LOTO (fora do H0)
S5 (limpeza Cloudflare)                           [qualquer hora; menor]
S6 (billing)  ◄── bloqueada pelo E5 (pricing) — NÃO iniciar antes
```

---

## S1 — Executar a trilha de storage (a janela está fechando)

- **Plano já pronto, task-by-task:** [2026-07-02-rti-evidencias-storage-execucao.md](2026-07-02-rti-evidencias-storage-execucao.md) — decisões A–D travadas (path por relatório `{org}/{reportSlug}/nc-{n}-{i}.ext`; deletes reference-aware; `comporRti` referencia em vez de duplicar; edge `orphan-sweep`).
- **Por que agora:** o bucket `rti-evidencias` está ≈ vazio desde 2026-07-02 — cada semana de uso real adiciona fotos no path antigo e transforma "trocar o esquema" em "migrar dados".
- **Pré-condições:** dev server do usuário na 57010; migrations via MCP (`apply_migration`) com `.sql` versionado; respeitar `protect_delete` e `fn_enforce_seal` (não burlar por SQL cru).
- **Aceite:** upload manual + upload via `comporRti` caem no path novo; storage não duplica foto de campo; excluir NC/relatório remove os objetos ou registra falha (sem órfão silencioso); `orphan-sweep` deployada e rodando; testes das funções puras verdes; validação visual no preview (57010).
- **Commit:** por task, conforme o plano. Sem push (regra do projeto).

## S2 — Bucket `certificates` + hardening dos demais buckets

- **Bug ativo:** `uploadCertificateFile` (qualificações) falha sempre porque o bucket não existe. É criação de bucket + policies (espelhar o padrão restaurado em `20260702000000_restore_rti_evidencias_storage_policies.sql`) + `file_size_limit`/`allowed_mime_types`.
- **Escopo:** criar `certificates`; aplicar limite/mime nos outros 6 buckets sem config; migração única via MCP + `.sql` versionado.
- **Aceite:** upload de certificado funciona na UI de qualificações (testar no preview); todos os buckets com limite e mime configurados; nenhuma regressão nos uploads existentes (foto campo, evidência RTI, ASO/EPI se houver).
- **Esforço:** pequeno — cabe na mesma sessão de S1 como fecho.

## S3 — Prova de integração campo→RTI (o coração do produto sem rede de proteção)

- **Problema:** o pipeline coleta offline → sync → `comporRti` → entrega é o diferencial do produto e não tem teste de integração; os 85+ testes atuais são de funções puras.
- **Decisão a tomar no início da sessão (brainstorm curto, 2 opções):**
  - **(a) Roteiro E2E manual versionado** (`docs/testes/roteiro-campo-rti.md`): passos numerados com os 3 usuários de teste reais (consultor/cliente A/cliente B), do login no PWA à entrega do RTI, com resultados esperados por passo (org_id herdado, visibilidade por entrega, selo). Barato, dá pra rodar a cada release manualmente.
  - **(b) Harness automatizado** (vitest + Supabase local + seed): caro (Supabase local, mock de IndexedDB/Dexie, fila de sync), alto valor a médio prazo.
  - **Recomendação: (a) agora, (b) quando o 2º consultor assinar.** O roteiro manual já destrava a "prova logado como Cliente A" pendente da Fase 2 do ROADMAP.
- **Aceite (opção a):** roteiro escrito, executado uma vez de ponta a ponta, com resultado registrado (incluindo a prova pendente do ROADMAP: RTI nasce com `org_id` = Cliente A via cascata).

## S4 — Desvinculação do @lovable.dev (item crítico, bloqueia LOTO)

- **Contexto:** memória do projeto marca como crítico; a trilha LOTO inteira (inclusive seção LOTO no dossiê, P2 da spec de 2026-06-30) está congelada até isso fechar.
- **Primeiro passo é inventário, não ação:** listar onde o Lovable ainda toca o projeto (remote git? webhook? domínio? branding no código? conta que hospeda algo?). Só depois definir os passos de corte — parte deles é ação manual do usuário (contas/painéis), não código.
- **Aceite:** inventário documentado + checklist de corte com dono por item (Claude vs usuário) + execução dos itens de código. Registrar no ROADMAP quando concluído para descongelar LOTO.

## S5 — Limpeza de resíduo Cloudflare

- Remover `@cloudflare/vite-plugin` do [package.json](../../../package.json) e `wrangler.jsonc`; rodar build + CI local para provar que nada usa.
- **Aceite:** `npm run build` (app) verde sem a dependência; commit isolado. Esforço: minutos — pode ser fecho de qualquer sessão.
- **Nota:** manter a convenção `types.ts` à mão (não trocar por `generate_typescript_types` sem decisão explícita — a convenção atual foi deliberada).

## S6 — Billing por org (Stripe) — GATED

- **Não iniciar** antes do E5 (modelo de pacotes/preços sobre `org_entitlements`). Implementar cobrança sem definição comercial gera retrabalho de webhook/portal.
- Quando o E5 fechar: brainstorm → spec no padrão da casa (produto: assinatura por org consultoria com N clientes? por org cliente? trial?).

---

## O que o H0 entrega quando essas sessões fecharem

Storage confiável e auditável (S1/S2), o fluxo-espinha-dorsal provado e reprovável (S3), o produto juridicamente/operacionalmente desamarrado do Lovable com a trilha LOTO livre (S4), higiene de build (S5) — e a base pronta para ligar cobrança (S6). Em paralelo, E1/E2 (Motor 1) já estão prontos como insumo do H2, e o E3 (PDF server-side) é o próximo desenho de produto depois do S1.

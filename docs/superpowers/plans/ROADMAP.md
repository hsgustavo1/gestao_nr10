# ROADMAP — gestão_nr10 (itens em aberto)

> **Este documento lista só o que falta fazer.** Tudo que já foi entregue (fundação
> multi-tenant, selo de entrega, visibilidade por entrega, snapshots, Cofre e Portão,
> wizard RTI, curadoria de padrões, home do cliente, laudo RTI profissional) saiu daqui
> e vive como histórico em
> [`ROADMAP-arquivo-2026-07-06.md`](ROADMAP-arquivo-2026-07-06.md) — consulte lá o
> detalhe de implementação, migrations aplicadas e decisões de cada entrega.
>
> **Última consolidação:** 2026-07-11.

## Onde estamos

A fundação multi-tenant está pronta e validada desde junho. Desde então o esforço foi
quase todo em **H1 — tornar o laudo RTI um entregável de padrão profissional**, porque o
consultor já usa o produto em trabalho real. O que ficou para trás foi a **fila de higiene
H0** (principalmente storage) — e a janela "bucket vazio" que barateava o S1 **já fechou**.
Este roadmap prioriza: fechar as validações do que já está no ar → resolver os itens de
higiene represados (com decisão consciente sobre os de janela fechada) → então avançar para
multi-NR / Motor 1.

---

## 1. Frente atual — Laudo RTI (fechar o que ficou aberto)

- [ ] **Item 7 — pipeline de normas na NC.** Ligar `comporRti` (`src/lib/campo-queries.ts`)
  para propagar `normas` + `titulo` para `rti_ncs`, mapeando as duas formas de `NormaRef`
  (`{norma,item}` de `campo.ts` → `{tipo,ref}` de `normas/types.ts`). Hoje a seção
  "Referência Normativa" existe no PDF mas **nunca recebe dado** — é gap de pipeline, não de
  render. Decidir também o backfill de NCs legadas. *(Adiado deliberadamente na sessão do
  refino 2.1.)*
- [ ] **Follow-ups do refino 2.1** que ficaram fora do escopo da fatia.

## 2. Em validação (codado e no ar, falta provar com dado real)

Risco de "achei que funcionava" — cada um precisa de uma passada real antes de ser dado como
fechado:

- [ ] **Cofre e Portão (PWA campo)** — rodar o protocolo de validação da spec §9 (bancada +
  visita real).
- [ ] **Wizard RTI** — emitir o **1º laudo com um relatório real** do consultor; comparar
  lado a lado com o Word atual; validar fonte WOFF no preview e zoom das fotos.
- [ ] **Trilha A** — o founder curar o **1º modelo real** a partir de uma inspeção.
- [ ] **Digest semanal (D2)** — **bloqueado por setup do founder:** criar conta Resend +
  secrets `RESEND_API_KEY` e `ALERT_FROM` (opcional `ALERT_EMAILS`) em Supabase → Edge
  Functions → Secrets. Sem a chave a função roda e loga "RESEND_API_KEY não configurada" sem
  marcar a semana como enviada.
- [ ] **Prova logado como Cliente A** — rodar o pipeline campo→RTI logado como usuário do
  Cliente A e confirmar que o RTI nasce com `org_id`=A (a cascata da fundação já garante;
  falta a prova viva).

## 3. Higiene H0 — fila represada

### ⚠️ 3.1 — S1: reestruturação de storage — JANELA FECHOU, precisa de decisão conjunta

O plano [`2026-07-02-rti-evidencias-storage-execucao.md`](2026-07-02-rti-evidencias-storage-execucao.md)
assumia **bucket vazio** (barato, sem migração). Como o consultor já gera laudos reais, o
`rti-evidencias` voltou a ter dados — agora é **migração de dados, não troca de esquema**.
Três problemas continuam de pé e independem de reestruturar os paths:

1. **Paths misturados** — RTIs e subpasta por NC no mesmo bucket sem prefixo por relatório
   (`{org}/{reportSlug}/nc-{n}-{i}.ext`).
2. **Deletes não confiáveis** — o `.remove()` ignora erro e esquece o `report_path` → gera
   **órfãos silenciosos**. (Respeitar `protect_delete` e `fn_enforce_seal` — não burlar por
   SQL cru.)
3. **`comporRti` duplica cada foto** (2× storage) em vez de referenciar a foto de campo já
   comprimida.

**Decisão a tomar juntos** (candidatas):
- **(A) Migração completa** — plano original + script de migração dos objetos existentes para
  o path novo. Mais caro agora, mas resolve os 3 de uma vez e não volta a doer.
- **(B) Só o essencial** — aceitar o path atual e atacar **só os deletes confiáveis** (item 2,
  o que causa dano real: órfãos + storage crescendo) + parar a duplicação (item 3). Deixar a
  reestruturação de path (item 1) como não-prioritária.
- **(C) Adiar tudo** — registrar e seguir; risco: cada semana adiciona mais dados a migrar.

> **Recomendação inicial: (B).** Órfãos e duplicação são dano contínuo; o path misturado é
> cosmético enquanto o volume for baixo. Discutir antes de executar.

### 3.2 — Demais itens de higiene

- [ ] **S2 — hardening dos buckets.** Bucket `certificates` já criado (2026-07-05). Falta
  aplicar `file_size_limit`/`allowed_mime_types` nos outros 6 buckets sem config (só
  `rti-evidencias` está endurecido). Migração única via MCP + `.sql` versionado.
- [ ] **S3 — prova de integração campo→RTI (E2E).** O pipeline coleta offline → sync →
  `comporRti` → entrega é o diferencial do produto e **não tem teste de integração** (os 272
  testes são de funções puras). Decisão no início: (a) roteiro E2E manual versionado
  (`docs/testes/roteiro-campo-rti.md`) com os 3 usuários de teste — barato, recomendado agora;
  (b) harness automatizado (Supabase local + mock Dexie) — quando o 2º consultor assinar.
- [ ] **S4 — desamarrar @lovable.dev.** Item crítico (memória do projeto); **bloqueia a trilha
  LOTO inteira** (incl. seção LOTO no dossiê). Primeiro passo é **inventário, não ação**:
  onde o Lovable ainda toca o projeto (remote git? webhook? domínio? branding? conta que
  hospeda algo?). Depois, checklist de corte com dono por item (Claude vs founder). Registrar
  aqui quando concluir, para descongelar LOTO.
- [ ] **S5 — limpar resíduo Cloudflare.** Remover `@cloudflare/vite-plugin` do `package.json`
  e `wrangler.jsonc`; `npm run build` verde sem a dependência; commit isolado. Minutos.
- [ ] **S6 — billing por org (Stripe).** ⛔ **Gated pelo E5 (modelo de preços/pacotes sobre
  `org_entitlements`).** Não iniciar antes de fechar a definição comercial.

## 4. Dívidas de schema / RLS (saneamento)

- [ ] **`nr10_documents` (Prontuário/PIE) ainda 100% `is_staff()`, sem `org_id`** — não
  migrada para multi-tenant. Se o Prontuário deve ser operável por consultor/cliente (hoje é,
  via `canViewGestao` no front, mas a tabela ignora org), precisa da mesma cirurgia já feita
  em `employees`/`nr10_trainings`.
- [ ] **Resíduo de RLS `is_staff()` em buckets de storage.** Corrigido em `nr10-docs`
  (`20260707100000`); **verificar os demais buckets** — mesma classe de bug (role global
  legada pré-multi-tenancy bloqueando consultor).
- [ ] **`GROQ_API_KEY` na Vercel** — configurar em staging + produção (hoje só no `.env`
  local); sem isso a importação por IA não funciona fora do ambiente local.
- [ ] **Replicar gates de entitlement aos demais módulos (fim da Fase 1.5).** RTI/Campo já
  libera por entitlement+papel (`getRtiCampoAccess`). NR-10/EPIs/qualificações/LOTO/
  incidentes/ASOs/prontuário ainda usam papel **global** (`isStaff`/`isAdmin`). Padrão: helper
  por recorte espelhando `getRtiCampoAccess` (ou `getModuleAccess(modulo, ctx)`).
- [ ] **Filtrar os demais `*-queries.ts` por `currentOrg.id`** (só RTI está filtrado):
  campo, qualificações, inspeções, EPIs, prontuário, ASOs, incidentes. RLS é a rede de
  segurança; o filtro é UX para usuário multi-org.
- [ ] **`types.ts` (à mão):** adicionar tabelas de tenancy/colunas `org_id` para remover o
  `sb as any` em `auth-context.tsx`.
- [ ] **Follow-ups de `/admin/empresas`** (inertes hoje): `fn_update_org` reconhece consultor
  só pela cadeia `managed_by`, não `parent` (unidade sob cliente gerido recusaria edição —
  falha fechada); `possiveisMaes` não filtra por `tipo` (permite unidade como mãe de outra).
- [ ] **Follow-up do Selo:** alinhar `getRecordAccess` (UI) ao banco em perfis legados raros —
  cosmético, o banco já é a barreira.

## 5. Estacionado com gatilho (multi-NR / Motor 1 — registrar, não construir)

- [ ] **NR-10:2026 (Portaria MTE 737/2026)** — norma **inteiramente reescrita**, **vigência
  01/06/2027**. Spec pronta ([`2026-07-06-nr10-portaria-737-adequacao.md`](../specs/2026-07-06-nr10-portaria-737-adequacao.md)).
  **Gatilho: iniciar até ~fev/2027.** Fase 1 (obrigatória): catálogo de treinamentos 3→6
  tipos, periódico bienal 16h, gatilhos de reciclagem, renumeração de referências, PIE
  reestruturado. Amarração natural com o Motor 1 — vira o 1º conteúdo *versionado por
  vigência*.
- [ ] **NR-13 (2ª norma) — decisão GO** (founder, 2026-07-03;
  [`2026-07-03-motor1-nr13-como-conteudo.md`](../specs/2026-07-03-motor1-nr13-como-conteudo.md)).
  Pré-requisito: entidade **`assets`** (equipamento com atributos técnicos) — independe do
  motor, pode nascer no desenho do módulo. Aposta comercial: **tanques metálicos** (obrigação
  vigente desde 04/07/2026) + inventário de vasos com categorização automática. Não construído.
- [ ] **Motor 1 (motor de conformidade versionado)** — E1/E2 desenhados como insumo; evolui com
  `validity_matrix` (N1), `context_modifiers` (N2), derivação de categoria (N3), prorrogação
  auditada (N5). Constrói quando NR-13 **ou** NR-10:2026 for priorizada.

## 6. Produto / UX — follow-ups menores (registrar)

- [ ] **UX de NC manual no RTI** (4 perguntas de escopo, refazer no momento oportuno):
  reaproveitar área/setor entre relatórios; selecionar modo de falha pré-existente na NC
  manual (`rti_ncs` não tem `modo_falha_id`); anexar evidência já na criação da NC; padronizar
  nomenclatura Área/Setor entre app e PWA.
- [ ] **Trilha D — D3 re-escopada:** importador de **ASOs por IA** (clonar
  `admin.certificados.importar.tsx` trocando o prompt; cuidado LGPD — gravar só datas/
  resultado apto-inapto) e **EPIs por planilha** (padrão `parseWorkbook`).
- [ ] **Home NR-10 dedicada** (cards de módulos + KPIs por papel) — só o redirect foi entregue
  no MVP; a home rica ficou adiada.
- [ ] **Modo auditoria (só conformes)** no dossiê — variante que esconde NCs/pendências,
  espelhando a vitrine sem login. Adiado para não inflar a v1 (status real).
- [ ] **Nível "cliente operador restrito"** — permissão **por campo** no RTI: cliente edita a
  operação mas prioridades/NCs curadas pelo consultor ficam read-only. Mapeia a `org_role`
  + travas de coluna/ação.
- [ ] **Vitrine sem login segura** — função `SECURITY DEFINER` que recebe `org_public_tokens.
  token` e retorna só indicadores **conformes** (nunca NCs). O "viewer mode" atual é
  client-side e **não serve** como vitrine para fiscal — substituir por endpoint server-side.
- [ ] **Botão "Entregar" da inspeção no PWA** — hoje a entrega da inspeção é só no app web.
- [ ] **Login offline multiusuário** (aparelho compartilhado: vários técnicos, sem sinal, cada
  um entrando após logout). Mexe em auth/segurança → **passar por brainstorming antes**
  (cache de sessões por usuário + `setSession` + PIN local).
- [ ] **Melhorar extração de certificados por IA (Groq)** — o prompt erra o tipo de
  treinamento às vezes (hoje contornado tornando a turma autoritativa). Melhorar para maior
  variabilidade de layouts. **Brainstorm antes** — prompt já calibrado com casos reais.

## 7. Futuro distante (registrar, sem gatilho ainda)

- **Entitlement `gestao_completa`** para venda direta a empresas (sem consultor).
- **Storage frio de fotos** + política de retenção (migrar de Supabase Storage para
  S3/Backblaze quando o volume crescer; path `{org_id}/…` já prepara).
- **UI mãe↔unidade** (consolidação multi-unidade) e **white-label do consultor** (logo/cores
  por `consultoria`).
- **Clustering automático de padrões** (3+ consultores) e **modelos por consultoria** —
  fora do escopo da trilha A.

---

## Riscos conhecidos / pontos de atenção

- **Desvinculação do @lovable.dev** é o item crítico paralelo que congela LOTO (ver S4).
- **Janela do S1 (storage) fechada** — quanto mais tempo, mais dados a migrar (ver 3.1).
- Hierarquia profunda (consultoria → cliente → unidade) cobre **1 nível** por caminho em
  `can_access_org`; transitividade total é melhoria futura.
- Erros tsc pré-existentes no repo são conhecidos (CLAUDE.md) — não reportar como bugs novos.

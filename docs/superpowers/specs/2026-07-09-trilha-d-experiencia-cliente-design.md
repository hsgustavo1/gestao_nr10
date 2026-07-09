# Trilha D — Experiência do Cliente ("o app tem vida")

**Data:** 2026-07-09
**Status:** design elaborado com decisões tomadas pela IA em nome do founder — **auditar em
[`2026-07-09-decisoes-trilhas-c-a-d.md`](2026-07-09-decisoes-trilhas-c-a-d.md)**.
**Ordem:** 4ª trilha. Dor 2.3 do brainstorm: o cliente não quer alimentar mais um
software — quer conformidade legal com o app **vindo até ele** com alertas e pendências
acionáveis, e quer subir a base legada sem sofrimento ("efeito UAU").

---

## 1. O que já existe (não redescobrir)

Dossiê de fiscalização, índice de conformidade, evolução mensal (snapshots pg_cron),
VencimentosBell, visibilidade por entrega, selo, planos de ação RTI geridos em conjunto,
**importação de certificados por IA** (Groq Vision — o padrão do "efeito UAU" já provado).

## 2. Escopo — três fatias, nesta ordem

### D1 — Home do cliente com KPIs e pendências acionáveis
Retoma a "home NR-10 dedicada" adiada em 2026-06-21. Ao logar, o admin do cliente vê:
- **Índice de conformidade** (número + tendência dos snapshots) em destaque.
- **Cards de pendência acionáveis** (cada um é um link para resolver): treinamentos a
  vencer em 30/60/90d, ASOs vencidos, NCs de prioridade alta paradas, ações de plano com
  prazo estourando, EPIs com teste vencido.
- **Últimas entregas** do consultor (relatórios/inspeções entregues — integra o selo).
Fonte: queries já existentes (vencimentos, conformidade, rti) — D1 é composição, não
infraestrutura nova. Substitui o redirect atual `/` → `/rti` para papel cliente.

### D2 — Digest de alertas por e-mail (o app "vem até o cliente")
- **Semanal** (edge function agendada via pg_cron/cron do Supabase, mesmo padrão dos
  snapshots): resumo por org — o que venceu, o que vence em 30d, ações atrasadas.
  Um e-mail por org, para os admins optantes (`profiles.digest_email boolean`).
- Provedor: **Resend** (API simples, tier grátis generoso, domínio do founder).
- Conteúdo espelha os cards da D1 (mesma função pura de "pendências da org" alimenta
  home e e-mail — uma fonte, duas superfícies).
- Anti-spam: só envia se houver pendência; rodapé com opt-out.

### D3 — Importação assistida de base legada (expansão do padrão certificados)
Generalizar o fluxo `admin/certificados/importar` (upload → IA extrai → usuário valida →
grava) para as outras entidades do onboarding:
- **Funcionários** (planilha RH → employees), **ASOs** (PDF/imagem → asos),
  **treinamentos históricos** (planilhas/certificados → nr10_trainings), **EPIs**
  (planilha → epis). Cada tipo = um "importador" com o mesmo shell de UI (dropzone →
  tabela de conferência com erros destacados → confirmar).
- IA (Groq) só onde há documento não-estruturado; planilha usa parser determinístico
  (padrão `parseWorkbook` existente) com mapeamento de colunas assistido.
- É a arma de onboarding do founder: "me dá sua pasta de PDFs e amanhã seu prontuário
  está de pé".

## 3. Fora de escopo (registrado)

- Notificação push/WhatsApp (avaliar depois do e-mail provar valor).
- Portal público por token (vitrine server-side — já no ROADMAP como item próprio).
- Gamificação/score comparativo entre unidades (H3).

## 4. LGPD (atenção herdada da análise estratégica §8.5)

ASOs são dado de saúde: o digest de e-mail **nunca** lista diagnóstico/resultado — só
"ASO de Fulano vence em X dias". Importadores de ASO gravam o mínimo estruturado
(datas/resultado apto-inapto) e o arquivo no Storage com RLS por org.

## 5. Erros e testes

- Função pura central `pendenciasDaOrg(dados) → Pendencia[]` (compartilhada D1/D2) —
  TDD, espelha o padrão `computePendencias` do PWA.
- Digest: idempotente por (org, semana) — tabela `digest_log` evita duplicado se o cron
  reexecutar; falha de envio não derruba o lote (log + segue).
- Importadores: parser puro por tipo com testes de planilhas reais anonimizadas;
  transação por lote; relatório de linhas rejeitadas (nunca importa silenciosamente).

## 6. Métricas

- % de logins de cliente que interagem com um card de pendência (D1).
- Taxa de abertura/clique do digest (D2 — Resend fornece).
- Tempo de onboarding de cliente novo: meta < 1 dia com D3 (hoje: manual).

# Análise estratégica — de gestão NR-10 a plataforma multi-NR

**Data:** 2026-07-03
**Natureza:** análise (founder + usuário) + roadmap de expansão. Não é spec de implementação.
**Fontes:** graphify (1.178 nós / 3.935 arestas / 67 comunidades), `ROADMAP.md`, specs em `docs/superpowers/`, estrutura de rotas/libs, CLAUDE.md.

---

## 1. O que o produto é hoje (leitura honesta)

Um SaaS multi-tenant de gestão de conformidade NR-10 com um app de coleta de
campo offline (PWA), organizado em três camadas que já funcionam de ponta a ponta:

| Camada | O que existe | Maturidade |
|---|---|---|
| **Coleta (campo-pwa)** | Árvore Setor→Ativo→Componente, pontos, achados com foto, catálogo de modos de falha com pré-preenchimento, fila de sync Dexie, compressão de imagem, autoria da coleta | Alta (validado em campo real) |
| **Gestão (app)** | RTI (NCs, custos, prazos, evidências, histórico), Qualificações (treinamentos, autorizações, ASOs, aptidão §10.8), EPIs/testes dielétricos, Incidentes, Inspeções, LOTO, Vencimentos | Alta no RTI/Qualificações; LOTO sob pendência Lovable |
| **Entrega de valor** | Dossiê de fiscalização (`/relatorio/dossie`), índice de conformidade (`conformidade.ts`), evolução mensal (snapshots pg_cron), selo de entrega (freeze do registro técnico), visibilidade por entrega | Média — o dossiê existe mas exporta via `window.print()` |

**Fundação (o que a maioria dos MVPs não tem):**
- Multi-tenancy com isolamento **validado por teste real** no banco (RLS + `can_access_org`), não no front.
- Modelo de canal embutido: consultoria gerencia clientes (`managed_by_org_id`) — go-to-market de revenda já é schema, não slide.
- Entitlements por org (`rti_pwa`, `gestao_completa`, `loto`) — o modelo de billing/pacotes já existe estruturalmente, falta só o Stripe.
- Governança de laudo: `created_by_org_id` server-set anti-spoof, `fn_enforce_seal`, visibilidade por entrega. Isso é infraestrutura de **responsabilidade técnica** (ART) que concorrente genérico de checklist não tem.

## 2. Diferenciais reais (o que defender e ampliar)

1. **Pipeline campo→relatório (`comporRti`)** — a coleta offline vira plano de
   ação com NC numerada, prioridade, custo e evidência. É o núcleo do "one stop
   shop": ninguém no mercado BR de checklist entrega *laudo técnico
   estruturado* na saída, entregam planilha/PDF de checklist.
2. **Catálogo de modos de falha com pré-preenchimento** — embrião do motor de
   conhecimento. Cada achado capturado enriquece um ativo proprietário
   (descrição/recomendação/prioridade por modo de falha). É o dado que, em
   escala, vira motor de relatório automático (e futuro fine-tuning/RAG).
3. **Selo de entrega + procedência** — congela o registro técnico após entrega;
   diferencia "opinião do consultor" de "dado operacional do cliente". Nenhum
   concorrente de checklist modela isso; é argumento direto para engenheiros
   com ART.
4. **Consultor como canal** — o 1º cliente é um consultor que *revende* o
   produto embutido no serviço dele. CAC próximo de zero por cliente final;
   white-label futuro multiplica isso.
5. **Dossiê de fiscalização** — "documento único para o fiscal" é a proposta de
   valor mais tangível para o comprador (medo de multa/interdição é o gatilho
   de compra em SST).
6. **Histórico de conformidade** (snapshots mensais) — vira defesa jurídica e
   dashboards de evolução; switching cost real.

## 3. Pontos críticos (por severidade)

### Bloqueiam a promessa do produto
1. **Relatório de alto padrão ainda é `window.print()`.** A promessa "consolida
   e gera relatório técnico automaticamente" exige PDF server-side com capa,
   sumário, numeração, fotos paginadas, identidade do consultor (white-label) e
   campo de assinatura/ART. Hoje o gargalo de horas do consultor continua no
   Word dele.
2. **Regras NR-10 hardcoded espalhadas.** `aptidao.ts` (§10.8),
   `conformidade.ts`, periodicidades de treinamento/ASO/teste de luva vivem em
   código. Para multi-NR isso precisa virar um **motor de requisitos
   configurável** (ver §5). Não é urgente refatorar — é urgente **parar de
   aumentar** o acoplamento em código novo.
3. **Bucket `certificates` não existe** → upload de certificado de
   qualificações **sempre falha** (levantado 2026-07-02, ainda aberto). Bug
   visível ao usuário em fluxo core.

### Dívidas que cobram juros em escala
4. **Rotas monolíticas** — `rti.plano.tsx` >1.100 linhas com diálogos inline;
   comunidades do grafo com cohesão 0.04–0.08 (Route Tree, LOTO, Auth) indicam
   código espalhado. Custa velocidade a cada feature.
5. **`types.ts` mantido à mão** — com o MCP do Supabase disponível
   (`generate_typescript_types`), manter à mão é risco de drift silencioso.
6. **Duplicação `campo.ts` app ↔ PWA** (drift conhecido) — consolidar de fato
   em `@gestao/campo-core`.
7. **Trilha storage não executada** — deletes que ignoram erro do `.remove()`
   (órfãos), `comporRti` duplicando foto (2× storage), 6 buckets sem
   limites/mime. Spec pronta, bucket vazio = momento ideal.
8. **Testes concentrados em funções puras** (85–125). O pipeline crítico
   campo→sync→comporRti→entrega não tem teste de integração/e2e. É o fluxo que,
   se quebrar, destrói a confiança do consultor em campo.
9. **LOTO sob desvinculação Lovable** — módulo congelado; decidir prazo para
   fechar essa pendência ou o módulo apodrece.
10. **`useAuth()` com 122 arestas** — god node inevitável, mas qualquer mudança
    em auth é mudança de sistema inteiro; exige disciplina de teste.

### Menores / higiene
11. Resíduos Cloudflare (`wrangler.jsonc`, `@cloudflare/vite-plugin`).
12. Hierarquia org cobre 1 nível (`fn_org_is_manager`) — unidade sob cliente
    gerido tem follow-ups conhecidos (`fn_update_org`).
13. Login offline multiusuário no PWA (tablet compartilhado) — necessidade real
    de campo, ainda não desenhado.

## 4. Leitura de mercado (founder)

- **Concorrentes BR:** SOC, Sesmt+ (ocupacional/eSocial, fortes em RH-SST,
  fracos em engenharia de campo); Checklist Fácil, Produttivo, Beeps
  (checklist genérico + OS, fortes em mobile, rasos em norma técnica e laudo).
- **Posição vencedora:** o corredor entre os dois — *profundidade técnica de
  engenharia* (laudo, ART, selo, catálogo de falhas) + *facilidade de checklist
  mobile*. É onde ninguém está bem.
- **Comprador e gatilho:** gestor industrial/SESMT comprando por medo de
  fiscalização/acidente; consultor comprando por produtividade (horas de
  relatório). Dois pitches, um produto.
- **Moat em ordem de força:** (1) dados — catálogo de achados + histórico de
  conformidade; (2) canal — rede de consultores white-label; (3) switching
  cost — dossiê/histórico preso na plataforma. Tecnologia é replicável;
  esses três não.
- **Pricing natural:** por org + pacote de entitlements (já modelado). Consultor
  paga plataforma e revende; cliente direto paga `gestao_completa`. Evitar
  pricing por usuário (mata o caso "vários técnicos num tablet").

## 5. Arquitetura-alvo para multi-NR: três motores

O insight central da expansão: o app já contém **três motores implícitos**,
todos hardcoded para NR-10/elétrica. Expandir para "todas as NRs" **não é
escrever um módulo por NR** — é tornar os motores configuráveis e cada NR vira
*conteúdo* (template + catálogo + requisitos), não *código*.

### Motor 1 — Requisitos de conformidade (quem/o quê precisa de quê, com validade)
Hoje: treinamento NR-10 (2 anos), ASO, autorização, teste de luva (6 meses) —
tudo em código. Alvo: entidade `requisito` (norma, alvo: pessoa | equipamento |
local, evidência exigida, periodicidade, bloqueante?, peso no índice).
`computeAptidao()` vira a *instância NR-10* de um avaliador genérico.
- NRs que mapeiam quase 1:1: **NR-35** (trabalho em altura: treinamento 2 anos +
  ASO + autorização — literalmente o mesmo shape da NR-10), **NR-33** (espaço
  confinado), **NR-06** (EPIs com CA/validade), **NR-12** (capacitação),
  **NR-13** (inspeções periódicas de vasos/caldeiras com prazos legais).

### Motor 2 — Inspeção de campo (template de árvore + checklist + catálogo de achados)
Hoje: árvore fixa Setor→Ativo→Componente + modos de falha elétricos. Alvo:
`inspection_template` (níveis da árvore, campos por ponto, catálogo de achados
da disciplina). As rotas stub `termografias`, `spda`, `cercon` já apontam essa
direção — são tipos de inspeção, não normas.
- O PWA quase não muda: a UI de árvore/captura é genérica; o que muda é o
  template baixado junto com a inspeção.

### Motor 3 — Relatório/dossiê (composição de seções + índice ponderado + PDF)
Hoje: dossiê com 5 seções hardcoded + `window.print()`. Alvo: composição de
seções por entitlement/norma + **geração de PDF server-side** com template
white-label. O índice global vira agregação ponderada dos motores 1 e 2 por
norma contratada.

**Regra de ouro da generalização:** não extrair motor genérico "no escuro".
Extrair **quando a 2ª norma concreta estiver contratada/validada** — mas desde
já parar de adicionar acoplamento novo (toda feature nova nos módulos de
conformidade deve perguntar "isso é motor ou é conteúdo NR-10?").

## 6. Roadmap proposto

### Horizonte 0 — Consolidar e cobrar (agora → ~2 meses)
Objetivo: 1º cliente pagante operando o ciclo completo sem fricção.
1. Fechar trilha Supabase Storage (spec pronta; inclui **criar bucket
   `certificates`** — bug ativo).
2. Dossiê + Incidentes Elétricos (spec pronta) — fecha o "documento único".
3. UX de captura de achado no PWA (quando houver janela de campo real).
4. Fechar desvinculação Lovable (destrava LOTO e o dossiê completo).
5. Higiene: `generate_typescript_types` via MCP no fluxo, remover resíduos
   Cloudflare, teste de integração do pipeline campo→RTI.
6. Billing mínimo (Stripe por org ↔ `org_entitlements`) quando surgir o 2º
   pagante — antes disso, contrato manual.

### Horizonte 1 — O relatório vira o produto (2–5 meses)
Objetivo: "cheguei do campo, o relatório está 80% pronto" — o wow do consultor.
1. **Geração de PDF server-side** (edge function; capa, sumário, NCs com fotos,
   gráficos de custo/prazo, campo ART/assinatura). Maior alavanca de valor
   percebido do roadmap inteiro.
2. **White-label do consultor** (logo/cores por org consultoria) no PDF e no app.
3. **Modo auditoria** (só conformes) + vitrine por token server-side (já
   especificado no ROADMAP como substituto do viewer client-side).
4. **Login offline multiusuário** no PWA (sessões cacheadas + PIN) — brainstorm
   de segurança antes, como já registrado.
5. Assistente IA no fechamento de NC: descrição/recomendação gerada de
   foto + modo de falha, revisável pelo técnico. Primeiro uso do catálogo como
   ativo de IA; barato de pilotar, diferencial alto.

### Horizonte 2 — Segunda norma como prova dos motores (4–8 meses)
Objetivo: provar que NR nova = conteúdo, não código.
1. Escolher a 2ª NR **por demanda do canal** (perguntar aos consultores).
   Aposta racional: **NR-35** primeiro (menor esforço: é quase só Motor 1 —
   treinamento/ASO/autorização — reusa toda a UI de Qualificações); **NR-12 ou
   NR-13** em seguida (exercitam o Motor 2 com inspeção de máquinas/vasos).
2. Extrair Motor 1 (requisitos configuráveis) migrando NR-10 para ele **sem
   mudança de UX** (teste de regressão: aptidão §10.8 idêntica antes/depois).
3. Templates de inspeção no PWA (Motor 2): árvore + checklist + catálogo por
   tipo; termografia/SPDA/Cercon saem de stub para tipos reais.
4. Dossiê composicional (Motor 3): seções por norma contratada, índice ponderado.
5. Nível "cliente operador restrito" (permissão por campo no RTI — já mapeado).

### Horizonte 3 — One-stop-shop SST (8–18 meses)
1. **NR-01/PGR/GRO como guarda-chuva:** inventário de riscos alimentado pelas
   inspeções de todas as NRs — transforma o app de "gestão por norma" em
   "gestão de risco ocupacional" (a categoria onde SOC/Sesmt+ jogam).
2. **eSocial (S-2220/S-2240)** — puxador de venda enorme no BR; entra quando
   houver massa de dados ocupacionais (ASOs/EPIs já existem no schema).
3. Marketplace/rede de consultores white-label (o canal vira produto).
4. API pública + integrações (ERP, CMMS/manutenção).
5. Storage frio + retenção (paths `{org_id}/…` já preparam).

## 7. Métricas que importam (norte de cada horizonte)

| Métrica | Por quê |
|---|---|
| Horas coleta→relatório entregue | O valor central; H1 deve derrubar isso 5–10× |
| Relatórios entregues/mês por org | Uso real, não login |
| % achados criados via catálogo (vs. digitação livre) | Saúde do moat de dados |
| Nº clientes finais por consultor | Prova do canal |
| Tempo para onboard de nova norma (H2+) | Prova dos motores |

## 8. Riscos estratégicos

1. **Generalizar cedo** — motor genérico sem 2ª norma real vira abstração
   errada. Mitigação: regra de ouro do §5.
2. **Virar "mais um checklist"** — se o PDF/laudo não sair excepcional, a
   comparação passa a ser com Checklist Fácil (guerra de preço). O laudo é o
   posicionamento.
3. **Dependência de um único consultor** como cliente-desenvolvedor — roadmap
   enviesado pelo workflow dele. Mitigação: 2º e 3º consultores cedo, mesmo em
   condições especiais.
4. **Pendência Lovable** — quanto mais tempo aberta, mais cara.
5. **Compliance de dados** (LGPD): dossiês contêm dados de saúde (ASO) —
   revisar retenção/anonimização antes de escalar vendas diretas.

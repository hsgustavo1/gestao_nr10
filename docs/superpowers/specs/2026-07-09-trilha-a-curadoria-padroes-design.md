# Trilha A — Curadoria de Padrões (estruturas por segmento)

**Data:** 2026-07-09
**Status:** design elaborado com decisões tomadas pela IA em nome do founder — **auditar em
[`2026-07-09-decisoes-trilhas-c-a-d.md`](2026-07-09-decisoes-trilhas-c-a-d.md)**.
**Ordem:** 3ª trilha (após C). É o início do **moat de dados** (dor 2.1 do brainstorm:
cadastros dos consultores viram ativo da plataforma, curado pelo founder).

---

## 1. Problema e visão

Cada RTI começa com o consultor cadastrando a árvore Setor→Ativo→Componente do zero.
O founder quer: (1) capturar esses cadastros como matéria-prima; (2) lapidar e publicar
padrões por segmento industrial; (3) o próximo consultor que atender "papel e celulose"
recebe uma sugestão de estrutura pronta, editável (fluxos 2.1, 3.2, 3.3 do brainstorm).

## 2. Escopo v1

**Entra:** modelos de **estrutura** (árvore de setores/ativos/componentes) por segmento;
painel de curadoria do platform admin; sugestão na criação de inspeção.

**Não entra (registrado):** agregação automática/clustering de cadastros similares
(YAGNI com 1 consultor — o founder cura manualmente; automatizar quando houver volume);
templates completos de inspeção com checklist/campos (Motor 2 — Horizonte 2); curadoria
de modos de falha (já existe mecanismo próprio de publicação por org, 2026-06-20).

## 3. Como um padrão nasce (funil de curadoria)

Correção do gargalo apontado no brainstorm (gap 6): **não** é uma fila de revisão de cada
cadastro — o founder cura de um painel que *lê* o que já existe:

1. **Origem:** painel `/admin/padroes` (só platform admin) lista as estruturas de
   inspeções existentes (agrupadas por org/segmento), com contagem de nós e data.
2. **Promoção:** botão "Promover a modelo" abre o **editor de generalização**: o founder
   renomeia/remove itens específicos do cliente, define `segmento` e nome do modelo.
3. **Publicação:** modelo publicado fica disponível a **todas** as orgs na criação de
   inspeção. Despublicar esconde de novos usos (cópias já aplicadas não são afetadas).

### Anonimização (gap 6b — obrigatório, LGPD/confidencialidade)
- O modelo publicado **não guarda vínculo** com o cliente de origem (sem org de origem
  exposta; apenas `origem_inspecao_id` interno, visível só ao platform admin, para
  rastreabilidade da curadoria).
- A promoção **sempre** passa pelo editor — não existe "publicar direto", forçando o
  olhar humano que remove nome de linha/máquina/produto identificável.
- Regra dura do sistema: **nenhum conteúdo de uma org é sugerido a outra sem passar pela
  curadoria da raiz** (mesma filosofia do `rti_modos_falha.publico`).

## 4. Como o consultor consome

Na criação de inspeção **no app principal** (fluxo 3.1–3.2: planejamento no PC):
- Campo novo `segmento` na inspeção (texto com autocomplete dos segmentos existentes).
- Se houver modelos para o segmento: "Começar de um modelo" → preview da árvore →
  aplicar. **Aplicar = copiar** (nunca referência): o consultor edita livremente e a
  edição não retroalimenta o modelo.
- No PWA nada muda (a estrutura baixa pelo sync como hoje). Criar/editar estrutura em
  campo continua livre (regra de merge do brainstorm, gap 7: **campo vence e edições são
  aditivas** — o campo nunca deleta o que o PC criou; marca "não encontrado" e acrescenta).

## 5. Dados

```
estrutura_modelos (
  id uuid PK,
  nome text NOT NULL,
  segmento text NOT NULL,           -- autocomplete sobre valores existentes (v1 sem enum)
  descricao text,
  arvore jsonb NOT NULL,            -- [{nome, nivel, filhos:[...]}] — snapshot, sem ids de origem
  publicado boolean DEFAULT false,
  origem_inspecao_id uuid NULL,     -- rastreabilidade interna (só platform admin lê)
  created_at/updated_at
)
```
- RLS: SELECT de publicados para qualquer autenticado; escrita só `is_platform_admin()`.
- `field_inspections.segmento text NULL` (novo, para agrupar no painel e sugerir).
- Aplicar modelo = função client-side que expande `arvore` em `field_nodes` (ids novos).

## 6. Métrica do moat

- % de inspeções novas que partem de modelo (meta: crescer com o catálogo).
- Nº de modelos publicados por segmento; segmentos cobertos.
(Alimenta o pitch do founder: "o app já conhece a estrutura típica do seu setor".)

## 7. Erros e testes

- Aplicar modelo em inspeção que já tem nós → soma (não substitui), com aviso.
- Editor de generalização valida árvore (níveis válidos setor→ativo→componente).
- Puras testáveis: `arvoreFromNodes()` (nós → jsonb do modelo), `nodesFromArvore()`
  (modelo → nós novos com ids), validador de níveis. TDD nelas.

## 8. Futuro registrado (não construir)

- Agregação automática: candidatos a modelo quando N estruturas similares (clustering
  por nome normalizado) — quando houver 3+ consultores ativos.
- Modelos por consultoria (camada intermediária, como modos de falha regra B).
- Motor 2: template completo (checklist + campos por ponto + catálogo por disciplina).

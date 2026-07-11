# Decisão — Storage do RTI: "move-on-compose" (revisa a Decisão C)

**Data:** 2026-07-11
**Status:** decisão tomada pelo founder (Gustavo). Ainda **não implementada** — estruturar
antes, sanear o legado depois.
**Contexto:** parte da trilha S1 (storage) do H0. **Supera a Decisão C** de
[`2026-07-02-rti-evidencias-storage-execucao.md`](../plans/2026-07-02-rti-evidencias-storage-execucao.md)
("`comporRti` referencia a foto de campo em vez de copiar").

---

## A pergunta de fundo

Quem é o **dono durável** da evidência fotográfica — a inspeção de campo ou o RTI?
Duas camadas foram separadas para decidir:

- **Rastreabilidade → vive no banco.** `field_photos → ponto → inspeção` e
  `rti_nc_evidencias → NC → relatório` apontam para o mesmo arquivo. O local físico do
  arquivo **não afeta** a rastreabilidade.
- **Organização → vive no Storage.** A pasta é para o humano (auditoria, arquivamento,
  storage frio, exclusão/retenção).

## Como funciona hoje (estado real, 2026-07-11)

- Fotos **sempre comprimidas** (1024px / ~0,6 MB / JPEG) antes de subir; a bruta fica só no
  aparelho. Não há bruta no Storage.
- Foto de campo nasce no sync em `{org_id}/campo/{uuid}.jpg` — **antes** de existir RTI e
  antes de haver número de NC. Path achatado, sem nome de empresa → por isso aparece como
  raiz órfã no nível 1 do bucket.
- `comporRti` **referencia** (não copia): `rti_nc_evidencias.file_path` = o mesmo path da
  foto de campo (1× storage). Exclusão é reference-aware (`removerArquivosOrfaos`).
- Evidência manual, ART e relatórios **já** usam o esquema por relatório
  (`{slug(org.nome)}-{orgId}/{reportSlug}/…`) via `storage-paths.ts`. O nome do nível 1 vem
  de `auth.currentOrg.nome`.

## Cenários avaliados

- **A — o RTI é dono da sua evidência (mover na composição).** Foto de campo é *staging* por
  inspeção enquanto não há RTI; ao compor, **move** (não copia) para dentro do RTI, renomeada
  `nc-XXXX-XX`.
- **B — a inspeção é dona do bruto; o RTI referencia (o de hoje).** Nada se move; a NC aponta
  para o arquivo em `inspecoes/`. Pasta do RTI não contém fisicamente a evidência de campo.

## DECISÃO: Cenário A — move-on-compose

Move (não copia), preservando 1× storage. Revisa a Decisão C de "referencia" para "move na
composição".

### Estrutura-alvo

**Antes de compor** (staging, organizado por inspeção → setor para localizar foto sem número
de NC):
```
{slug(org.nome)}-{orgId}/
└── inspecoes/
    └── {inspecao-slug}/            (setor no caminho ajuda a achar a foto no staging)
        ├── {uuid}.jpg
        └── …
```

**Depois de compor:**
```
{slug(org.nome)}-{orgId}/
├── {reportSlug}/                       (nível 2 — acumula RTIs da empresa)
│   ├── evidencias-importadas/  nc-XXXX-XX.jpg   (upload manual no RTI)
│   ├── campo/                  nc-XXXX-XX.jpg   (MOVIDAS do staging na composição)
│   ├── art/                    art-{slug}.pdf
│   └── relatorios/             relatorio-vNN.pdf · _preview.pdf
└── inspecoes/
    └── {inspecao-slug}/         (só sobram fotos que NÃO viraram NC, se houver)
```

Nível 1 = `{slug(org.nome)}-{orgId}`, sempre criado, seja qual for o 1º documento. As duas
subpastas `campo/` e `evidencias-importadas/` **são o sinal de proveniência** (campo vs
manual) — não é preciso manter cópia física na inspeção para "saber de onde veio".

### Racional (por que A, contrariando a Decisão C)

1. **O artefato durável é o RTI, não a inspeção.** O laudo é entregue, selado, versionado,
   guardado por anos e mostrado em fiscalização. Um artefato legal deve **possuir** sua prova,
   não tomá-la emprestada de um registro ainda mutável.
2. **A Decisão C evitava duplicação — e mover também é 1× storage.** Dá para ter o layout
   RTI-cêntrico sem reintroduzir cópia. A objeção original ("não duplicar") não se aplica a
   mover.
3. **Proveniência não se perde ao mover:** o nome da subpasta (`campo/` vs
   `evidencias-importadas/`) + o vínculo no banco já preservam a origem.
4. **`campo` muda de significado ao longo do ciclo:** antes de compor é um *lugar* (staging);
   depois de compor vira um *atributo* de proveniência dentro do RTI. Não deixa de fazer
   sentido — deixa de ser um lugar e vira um rótulo.

### Custo assumido (olhos abertos)

- Mover N arquivos na composição = N operações de storage (inspeção grande do teste de escala:
  ~1.021 fotos). Pontual, com barra de progresso. É o preço de A; B não paga.
- Idempotência na recomposição: foto já movida = "já está no destino, pula".
- Só movem as fotos que viram evidência de NC; fotos de achados sem NC ficam no staging.

### Premissas

- 1 inspeção → 1 RTI (o código já amarra: `comporRti` grava `inspection.report_id` e
  `status='importada'`; recompor atualiza o mesmo relatório). Sem ambiguidade de "qual RTI é
  dono".

## Detalhes de execução deixados para depois (não decididos aqui)

- Local exato do staging: por inspeção vs por inspeção→setor (preferência: incluir o setor no
  caminho, para achar a foto sem número de NC).
- Ordem de saneamento do legado (raízes órfãs `c221b14e-…` sem nome e `cce11347-…/campo`).
- `uploadFieldPhoto` passa a receber contexto de org com nome + inspeção (hoje só `{org_id}`).

## Ainda de pé da análise original (independente de A/B)

- **Deletes confiáveis / sem órfão silencioso** — já há `removerArquivosOrfaos`
  reference-aware; validar cobertura em todos os caminhos de exclusão.
- **Nome do nível 1 limpo:** vem de `org.nome` (editável em `/admin/empresas`); manter curto.

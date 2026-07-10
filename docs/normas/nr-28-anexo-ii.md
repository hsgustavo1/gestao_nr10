# NR-28 — Anexo II (linhas que classificam itens da NR-10)

> Tabela de gradação de multas. Cada linha associa item(ns) da NR-10 a um
> **código de infração**, uma **gravidade (1..4)** e a **área** (S = Segurança,
> M = Medicina do Trabalho). **Chaveada na numeração NR-10:2019.**
> Texto público. **Transcrever as linhas restantes** do PDF oficial da NR-28
> consolidada para `src/lib/normas/nr28-gravidade.ts`.

## Colunas

`itens da NR-10 | código | gravidade | S/M`

## Linhas verificadas nesta sessão (seed do catálogo)

| Itens NR-10 | Código | Gravidade | Área |
|---|---|---|---|
| 10.2.1 | — | 4 | S |
| 10.2.4 (alíneas a–g) | 210178-5 | 2 | S |
| 10.4.1 | — | 4 | S |
| 10.8.5 / 10.8.6 | — | 2 | S |

> A gravidade de uma NC é o **máximo** entre as linhas casadas pelos itens que
> ela cita (ver `gravidadeNR28`). Códigos ausentes (—) devem ser preenchidos na
> transcrição — não afetam a lógica, só a exibição (sub-spec 3).

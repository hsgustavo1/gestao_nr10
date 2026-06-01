## Objetivo

A pré-visualização da etiqueta LOTO no diálogo "Imprimir" está sendo renderizada em escala 1.8x e excede a largura do `DialogContent` (max-w-3xl), fazendo o conteúdo ser cortado à esquerda mesmo com `overflow: auto`.

## Mudança

Arquivo: `src/components/print-label-dialog.tsx`

- Reduzir a escala da pré-visualização de `scale={1.8}` para `scale={1.25}`, mantendo a etiqueta legível e 100% visível dentro do diálogo em desktop e mobile.
- Reduzir o padding do container de `20px` para `16px` para folga extra.
- Manter o `overflow: "auto"` como fallback para telas muito estreitas.

A escala usada na impressão real (`scale={1}` no `imprimirEtiqueta`) **não é alterada** — apenas a pré-visualização na tela.

## Fora de escopo

- Não alterar o componente `EtiquetaLOTO` em si.
- Não alterar layout/CSS de impressão.
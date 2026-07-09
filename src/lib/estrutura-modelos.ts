// Trilha A — árvore de modelo (jsonb) ⇄ nós/linhas de estrutura. Puro, TDD.
import type { EstruturaLinha } from "./campo";

export interface ArvoreNo {
  nome: string;
  filhos: ArvoreNo[];
}

/** nós do banco (field_nodes) → árvore aninhada por ordem; órfãos são ignorados. */
export function arvoreFromNodes(
  nodes: { id: string; parent_id: string | null; nome: string; ordem: number }[],
): ArvoreNo[] {
  const sorted = [...nodes].sort((a, b) => a.ordem - b.ordem);
  const noDe = new Map<string, ArvoreNo>();
  for (const n of sorted) noDe.set(n.id, { nome: n.nome, filhos: [] });
  const raiz: ArvoreNo[] = [];
  for (const n of sorted) {
    const eu = noDe.get(n.id)!;
    if (n.parent_id === null) raiz.push(eu);
    else noDe.get(n.parent_id)?.filhos.push(eu); // parent fora do conjunto → órfão ignorado
  }
  return raiz;
}

/** árvore → linhas para bulkCreateNodes (que deduplica e SOMA à árvore existente). */
export function linhasFromArvore(arvore: ArvoreNo[]): EstruturaLinha[] {
  const linhas: EstruturaLinha[] = [];
  for (const setor of arvore) {
    if (setor.filhos.length === 0) {
      linhas.push({ setor: setor.nome, ativo: null, componente: null });
      continue;
    }
    for (const ativo of setor.filhos) {
      if (ativo.filhos.length === 0) {
        linhas.push({ setor: setor.nome, ativo: ativo.nome, componente: null });
        continue;
      }
      for (const comp of ativo.filhos) {
        linhas.push({ setor: setor.nome, ativo: ativo.nome, componente: comp.nome });
      }
    }
  }
  return linhas;
}

export function contarNos(arvore: ArvoreNo[]): number {
  let n = 0;
  const walk = (nos: ArvoreNo[]) => {
    for (const x of nos) {
      n += 1;
      walk(x.filhos);
    }
  };
  walk(arvore);
  return n;
}

/** Erros humanos de validação (vazio = ok). Níveis: setor→ativo→componente (máx. 3). */
export function validarArvore(arvore: ArvoreNo[]): string[] {
  const erros: string[] = [];
  const walk = (nos: ArvoreNo[], profundidade: number, caminho: string) => {
    for (const x of nos) {
      const rotulo = caminho ? `${caminho} › ${x.nome}` : x.nome;
      if (!x.nome.trim()) erros.push(`Nó com nome vazio em "${caminho || "raiz"}"`);
      if (profundidade === 3 && x.filhos.length > 0)
        erros.push(`"${rotulo}" passa de 3 níveis (setor→ativo→componente)`);
      walk(x.filhos, profundidade + 1, rotulo);
    }
  };
  walk(arvore, 1, "");
  return erros;
}

/** Remove um nó pelo caminho de índices (ex.: [0,2] = 3º filho do 1º setor). Imutável. */
export function removerNo(arvore: ArvoreNo[], caminho: number[]): ArvoreNo[] {
  if (caminho.length === 0) return arvore;
  const [i, ...resto] = caminho;
  return arvore.flatMap((no, idx) => {
    if (idx !== i) return [no];
    if (resto.length === 0) return [];
    return [{ ...no, filhos: removerNo(no.filhos, resto) }];
  });
}

/** Renomeia um nó pelo caminho de índices. Imutável. */
export function renomearNo(arvore: ArvoreNo[], caminho: number[], nome: string): ArvoreNo[] {
  if (caminho.length === 0) return arvore;
  const [i, ...resto] = caminho;
  return arvore.map((no, idx) => {
    if (idx !== i) return no;
    if (resto.length === 0) return { ...no, nome };
    return { ...no, filhos: renomearNo(no.filhos, resto, nome) };
  });
}

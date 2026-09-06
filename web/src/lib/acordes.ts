/** Preparo dos dados do diagrama de acordes UF x UF (F6 leva 2, pendência 10a).
 *  Função pura, sem DOM/d3-chord: monta a matriz 27x27 ordenada por região (para que
 *  a coloração por grande região fique contígua no anel) e a partir da sigla alfabética
 *  dentro de cada região. */
import { REGIAO_DA_UF, REGIAO_ORDEM } from "./uf";

export interface UnidadeUF { codigo: string; nome: string; uf_sigla: string | null }
export interface FluxoUF { origem: string; destino: string; total: number }

export interface DadosAcordes {
  codigos: string[];
  siglas: string[];
  /** matriz[i][j] = total de i (origem) para j (destino) */
  matriz: number[][];
  /** índice (0..4) em REGIAO_ORDEM de cada posição da matriz */
  regiaoIdx: number[];
}

export function prepararMatrizAcordes(fluxos: FluxoUF[], unidades: UnidadeUF[]): DadosAcordes {
  const ordenadas = unidades.slice().sort((a, b) => {
    const ra = REGIAO_ORDEM.indexOf(REGIAO_DA_UF[a.codigo] as (typeof REGIAO_ORDEM)[number]);
    const rb = REGIAO_ORDEM.indexOf(REGIAO_DA_UF[b.codigo] as (typeof REGIAO_ORDEM)[number]);
    if (ra !== rb) return ra - rb;
    return (a.uf_sigla ?? a.nome).localeCompare(b.uf_sigla ?? b.nome, "pt-BR");
  });
  const codigos = ordenadas.map((u) => u.codigo);
  const siglas = ordenadas.map((u) => u.uf_sigla ?? u.codigo);
  const posicao = new Map(codigos.map((c, i) => [c, i]));
  const n = codigos.length;
  const matriz: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const f of fluxos) {
    const i = posicao.get(f.origem);
    const j = posicao.get(f.destino);
    if (i == null || j == null || i === j) continue;
    matriz[i][j] += f.total;
  }
  const regiaoIdx = codigos.map((c) => REGIAO_ORDEM.indexOf(REGIAO_DA_UF[c] as (typeof REGIAO_ORDEM)[number]));
  return { codigos, siglas, matriz, regiaoIdx };
}

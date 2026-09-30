/** Preparo das barras 100% de perfil (BarraPerfil): quais categorias aparecem e quanto vale
 *  cada uma em cada série. Função pura, sem React, para poder ser testada.
 *
 *  O denominador de uma barra é a soma de TODOS os valores positivos da série, não só os das
 *  categorias da paleta: a massa suprimida pelo pipeline (células com poucas observações)
 *  vem na categoria `outros`, que as paletas declaram como "Outros ou suprimido", e qualquer
 *  chave fora da paleta cai nesse mesmo residual. Descartá-las renormalizava as barras sobre
 *  o que sobrou e inflava todos os percentuais (setor de atividade pendular: mediana de 19% de
 *  massa escondida em 2022, 26,7% em 1980). */
import { CATEGORIA_OUTROS, type Categoria } from "./paletas";

export interface SerieComValores { valores: Record<string, number> }

export interface PerfilPreparado {
  /** categorias com valor > 0 em pelo menos uma série, na ordem da paleta (residual genérico
   *  por último, quando acrescentado) */
  usadas: Categoria[];
  /** valor da série na categoria; para `outros`, inclui as chaves fora da paleta */
  valor: (s: SerieComValores, c: Categoria) => number;
  /** soma de todos os valores positivos da série = denominador da barra (0 se vazia) */
  total: (s: SerieComValores) => number;
}

export function prepararPerfil(categorias: readonly Categoria[], series: readonly SerieComValores[]): PerfilPreparado {
  const chavesDaPaleta = new Set(categorias.map((c) => c.chave));
  /** massa da série em chaves que a paleta não conhece -- vai para o residual `outros` */
  const foraDaPaleta = (s: SerieComValores) =>
    Object.entries(s.valores).reduce(
      (acc, [chave, v]) => (chavesDaPaleta.has(chave) || !(v > 0) ? acc : acc + v), 0);
  // paleta sem `outros` (ex.: ocupação, que o agrupamento já resolve) + massa fora da paleta:
  // acrescenta o residual genérico, para o denominador não perder essa parcela
  const todas: readonly Categoria[] =
    !chavesDaPaleta.has("outros") && series.some((s) => foraDaPaleta(s) > 0)
      ? [...categorias, CATEGORIA_OUTROS] : categorias;
  const valor = (s: SerieComValores, c: Categoria) => {
    const v = s.valores[c.chave] ?? 0;
    return (v > 0 ? v : 0) + (c.chave === "outros" ? foraDaPaleta(s) : 0);
  };
  const usadas = todas.filter((c) => series.some((s) => valor(s, c) > 0));
  const total = (s: SerieComValores) => usadas.reduce((acc, c) => acc + valor(s, c), 0);
  return { usadas, valor, total };
}

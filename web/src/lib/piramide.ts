/** Preparo dos dados da pirâmide etária compacta (F6 leva 2, pendência 10b). Função pura:
 *  recebe as colunas de idade e sexo já publicadas (ver pipeline/disclosure_rules.py) e devolve,
 *  para as 5 faixas de FAIXAS_IDADE, o percentual de homens e de mulheres.
 *
 *  Base dos percentuais: o total do grupo INCLUINDO o residual. Toda célula de idade x sexo
 *  com poucas observações é suprimida pelo pipeline (R1) e somada à categoria `outros` da
 *  mesma dimensão (mais o sexo ignorado, `<faixa>_i`, que as colunas largas dos fluxos também
 *  jogam em `outros`). Antes, esse residual era descartado e as barras eram renormalizadas
 *  para somar 100%: um município com 30% da massa suprimida parecia ter uma pirâmide completa.
 *  Agora cada barra é a fração do TOTAL do grupo e a parcela que não chega às barras sai em
 *  `pctOutros`, para o componente mostrá-la ("outros ou suprimido"). */
import { FAIXAS_IDADE } from "./paletas";

export interface PontoPiramide {
  chave: string;
  rotulo: string;
  homens: number;
  mulheres: number;
  /** % do total do grupo (homens + mulheres das 5 faixas + residual) */
  pctHomens: number;
  pctMulheres: number;
}

export interface DadosPiramide {
  pontos: PontoPiramide[];
  /** homens + mulheres das 5 faixas (só o que aparece nas barras) */
  total: number;
  /** residual: `outros` (células suprimidas) + sexo ignorado -- não aparece nas barras */
  outros: number;
  /** total + outros: denominador dos percentuais */
  totalGeral: number;
  /** % do total do grupo que ficou fora das barras (0 quando não há residual) */
  pctOutros: number;
}

/** `valores` vem das colunas de idade e sexo SEM o prefixo "idade_sexo__", em qualquer uma
 *  das duas grafias publicadas: minúsculas nas colunas largas de `fluxos` ("05_14_m") e
 *  maiúsculas na categoria longa de `municipios_dim` ("05_14_M"/"05_14_F"/"05_14_I"). As chaves
 *  são normalizadas para minúsculas aqui, de modo que quem chama não precise saber de onde
 *  o dado veio. */
export function prepararPiramide(valores: Record<string, number>): DadosPiramide {
  const v: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(valores)) {
    if (typeof valor !== "number" || !Number.isFinite(valor)) continue;
    const k = chave.toLowerCase();
    v[k] = (v[k] ?? 0) + valor;
  }

  const pontosBrutos = FAIXAS_IDADE.map((f) => ({
    chave: f.chave,
    rotulo: f.rotulo,
    homens: v[`${f.chave}_m`] ?? 0,
    mulheres: v[`${f.chave}_f`] ?? 0,
  }));
  const total = pontosBrutos.reduce((acc, p) => acc + p.homens + p.mulheres, 0);
  const sexoIgnorado = FAIXAS_IDADE.reduce((acc, f) => acc + (v[`${f.chave}_i`] ?? 0), 0);
  const outros = (v["outros"] ?? 0) + sexoIgnorado;
  const totalGeral = total + outros;
  const pct = (x: number) => (totalGeral > 0 ? (x / totalGeral) * 100 : 0);
  const pontos = pontosBrutos.map((p) => ({
    ...p,
    pctHomens: pct(p.homens),
    pctMulheres: pct(p.mulheres),
  }));
  return { pontos, total, outros, totalGeral, pctOutros: pct(outros) };
}

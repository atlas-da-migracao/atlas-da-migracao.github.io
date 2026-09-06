/** Preparo dos dados da pirâmide etária compacta (F6 leva 2, pendência 10b). Função pura:
 *  recebe as colunas largas "idade_sexo__<faixa>_m"/"..._f" (já publicadas, ver
 *  pipeline/disclosure_rules.py) e devolve, para as 5 faixas de FAIXAS_IDADE, o percentual
 *  de homens e de mulheres sobre o total do grupo (M+F; "outros"/sexo ignorado, quando
 *  existir, não entra na base nem aparece nas barras). */
import { FAIXAS_IDADE } from "./paletas";

export interface PontoPiramide {
  chave: string;
  rotulo: string;
  homens: number;
  mulheres: number;
  pctHomens: number;
  pctMulheres: number;
}

export interface DadosPiramide {
  pontos: PontoPiramide[];
  total: number;
}

/** `valores` vem de uma coluna "idade_sexo__<faixa>_<m|f>" sem o prefixo "idade_sexo__"
 *  (mesmo formato usado por `doFluxo`/`perfilDoMunicipio` para as demais dimensões). */
export function prepararPiramide(valores: Record<string, number>): DadosPiramide {
  const pontosBrutos = FAIXAS_IDADE.map((f) => ({
    chave: f.chave,
    rotulo: f.rotulo,
    homens: valores[`${f.chave}_m`] ?? 0,
    mulheres: valores[`${f.chave}_f`] ?? 0,
  }));
  const total = pontosBrutos.reduce((acc, p) => acc + p.homens + p.mulheres, 0);
  const pontos = pontosBrutos.map((p) => ({
    ...p,
    pctHomens: total > 0 ? (p.homens / total) * 100 : 0,
    pctMulheres: total > 0 ? (p.mulheres / total) * 100 : 0,
  }));
  return { pontos, total };
}

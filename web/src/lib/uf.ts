/** Grande região de cada UF (divisão institucional do IBGE, conhecimento público --
 *  não depende de nenhum dado de acesso controlado). Usado para colorir a matriz de
 *  acordes UF x UF por região. */
import { pt, type Dicionario } from "../i18n/pt";

export const REGIAO_ORDEM = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"] as const;
export type Regiao = (typeof REGIAO_ORDEM)[number];

export const REGIAO_DA_UF: Record<string, Regiao> = {
  "11": "Norte", "12": "Norte", "13": "Norte", "14": "Norte", "15": "Norte", "16": "Norte", "17": "Norte",
  "21": "Nordeste", "22": "Nordeste", "23": "Nordeste", "24": "Nordeste", "25": "Nordeste",
  "26": "Nordeste", "27": "Nordeste", "28": "Nordeste", "29": "Nordeste",
  "31": "Sudeste", "32": "Sudeste", "33": "Sudeste", "35": "Sudeste",
  "41": "Sul", "42": "Sul", "43": "Sul",
  "50": "Centro-Oeste", "51": "Centro-Oeste", "52": "Centro-Oeste", "53": "Centro-Oeste",
};

/** Nome da macrorregião no idioma de `d`. As chaves de `REGIAO_ORDEM`/`REGIAO_DA_UF` são
 *  identificadores em português e não mudam. */
export const rotuloRegiao = (regiao: Regiao, d: Dicionario = pt): string => d.comum.regioes[regiao];

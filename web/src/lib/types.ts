export interface Municipio {
  cd_mun: string; nm_mun: string; uf: string; uf_sigla: string;
  cd_rgi: string | null; nm_rgi: string | null;
  cd_rgint: string | null; nm_rgint: string | null;
  cd_rm: string | null; nm_rm: string | null;
  pop: number; pop5: number;
  imig: number; imig_ni: number; imig_int: number; emig: number; saldo: number;
  tbi: number | null; tbe: number | null; tlm: number | null; iem: number | null;
  se_imig: number; se_emig: number; se_saldo: number;
  cv_imig: number | null; cv_emig: number | null;
  n_imig_faixa: string; n_emig_faixa: string;
  precisao_imig: string;
}

export interface Fluxo {
  origem: string; destino: string; total: number;
  se: number | null; cv: number | null; n_faixa: string; precisao: string;
  nm_origem?: string; nm_destino?: string;
  uf_origem?: string; uf_destino?: string;
  lon_o?: number; lat_o?: number; lon_d?: number; lat_d?: number;
}

export type Metrica = "saldo" | "tlm" | "imig" | "emig" | "iem";
export type Direcao = "entradas" | "saidas" | "ambos";

export interface Meta {
  versao_dados: string;
  fonte: string;
  salario_minimo_referencia: number;
  // min_domicilios é null nas edições cuja fonte não publica identificador de domicílio
  // (Censo 1980): o piso de R1 passa a ser só de pessoas, mais alto — ver docs/METODOLOGIA.md.
  revelacao: { min_pessoas: number; min_domicilios: number | null; min_pessoas_detalhe: number;
               arredondamento: number; cv_boa: number; cv_cautela: number };
  rotulos: Record<string, Record<string, string>>;
  citacao?: {
    autor: string; autor_orcid: string; doi_conceito: string; doi_versao: string;
    licenca: string; licenca_url: string; texto: string;
  };
  aviso: string;
  /** texto completo do selo "proxy de data fixa" (pipeline/build_meta.py); `null`/ausente em
   *  toda edição que tem quesito de data fixa direto -- ver `Edicao.proxyDataFixa` em
   *  lib/edicoes.ts e docs/METODOLOGIA.md, "Edição Censo 1980 e comparabilidade". */
  aviso_proxy?: string | null;
  /** resumo de uma linha do aviso acima, para o card fechado (AvisoProxy.tsx expande para o
   *  texto completo sob demanda) -- mesma condição de presença que `aviso_proxy`. */
  aviso_proxy_resumo?: string | null;
  /** unidades publicadas que NÃO são municípios: conjuntos de municípios do censo agregados
   *  numa unidade só, porque a fonte não distingue os municípios que os compõem. Hoje existe
   *  em uma edição só (Censo 1980, 'NORTEGO' -- os 52 municípios do norte de Goiás que em 1988
   *  formaram o Tocantins); ausente nas demais. O `codigo` é o `cd_mun` da unidade em
   *  municipios.parquet/municipios_ref.parquet e na malha, de modo que o front a trata como
   *  qualquer outra unidade e só acrescenta a `nota` -- ver AvisoUnidade.tsx e
   *  pipeline/unidades_agregadas_1980.py. */
  unidades_agregadas?: UnidadeAgregadaMeta[];
}

export interface UnidadeAgregadaMeta {
  /** código da unidade em municipios_ref/municipios/malha (ex.: "NORTEGO") */
  codigo: string;
  nome: string;
  nome_curto: string;
  /** quantos municípios do censo a unidade agrega */
  n_municipios: number;
  /** UF publicada para a unidade (código de 2 dígitos) */
  uf: string;
  /** UF a que o território pertencia na época do censo, quando diferente de `uf` */
  uf_censo?: string;
  /** frase pronta explicando ao leitor o que a unidade é e o que ela não distingue */
  nota: string;
}

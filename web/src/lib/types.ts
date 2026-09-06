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
  revelacao: { min_pessoas: number; min_domicilios: number; min_pessoas_detalhe: number;
               arredondamento: number; cv_boa: number; cv_cautela: number };
  rotulos: Record<string, Record<string, string>>;
  aviso: string;
}

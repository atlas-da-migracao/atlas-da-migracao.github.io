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
  /** só sob recorte (App.tsx, `municipiosVisiveis`): true quando o recorte não publica NENHUMA
   *  das três contagens para este município -- os zeros acima são ausência de dado, não zero. */
  semDado?: boolean;
}

export interface Fluxo {
  origem: string; destino: string; total: number;
  se: number | null; cv: number | null; n_faixa: string; precisao: string;
  nm_origem?: string; nm_destino?: string;
  uf_origem?: string; uf_destino?: string;
  lon_o?: number; lat_o?: number; lon_d?: number; lat_d?: number;
  /** F10: mesma origem/destino em metros, cônica equivalente de Albers -- é isto que o mapa
   *  usa (ArcLayer, coordinateSystem CARTESIAN); lon_o/lat_o continuam publicados para
   *  qualquer uso futuro fora do mapa (a Fase 6, satélite/Mercator, pode precisar deles). */
  x_o?: number; y_o?: number; x_d?: number; y_d?: number;
}

export type Metrica = "saldo" | "tlm" | "imig" | "emig" | "iem";
export type Direcao = "entradas" | "saidas" | "ambos";

export interface Meta {
  /** edição do Censo a que este meta.json pertence (pipeline/build_meta.py) -- usada para
   *  não misturar o texto de uma edição com o meta de outra durante a troca de censo. */
  edicao?: string;
  versao_dados: string;
  fonte: string;
  salario_minimo_referencia: number;
  /** F3 (mapa-representação): maior valor de `total` entre os fluxos municipais publicados
   *  desta edição -- base da escala de espessura ABSOLUTA dos arcos (ver
   *  pipeline/build_meta.py e web/src/map/MapaAtlas.tsx). Fixa por edição, não recalculada
   *  a partir da seleção em tela, para que a mesma espessura em pixels sempre valer o mesmo
   *  volume dentro de uma edição. */
  maior_fluxo: number;
  /** F10: bounds (metros, x/y) da malha de municípios já projetada na cônica equivalente de
   *  Albers (ver pipeline/build_meta.py e docs/METODOLOGIA.md, "Cartografia: projeção cônica
   *  equivalente de Albers"). Usado pelo mapa para o fitBounds cartesiano da vista nacional
   *  (OrthographicView) sem precisar decodificar o TopoJSON só para isso. Ausente só se a
   *  edição não tiver sido regerada depois da Fase 4 -- não deve acontecer em produção. */
  bounds_albers?: { x_min: number; x_max: number; y_min: number; y_max: number };
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
  /** aviso de universo do pendular de estudo (hoje só 1980: quesito aplicado a 10 anos ou
   *  mais); PainelPendular.tsx mostra quando presente, para o tipo "estudo". */
  aviso_pendular_estudo?: string | null;
  /** unidades publicadas que NÃO são municípios: conjuntos de municípios do censo agregados
   *  numa unidade só, com um `codigo` não numérico. Nenhuma edição a usa desde 1.1.0-1980
   *  (o norte de Goiás passou a ser publicado município a município); mecanismo genérico
   *  mantido inativo -- chave ausente = nada acontece. Quando presente, o `codigo` é o `cd_mun`
   *  da unidade em municipios.parquet/municipios_ref.parquet e na malha, de modo que o front a
   *  trata como qualquer outra unidade e só acrescenta a `nota` -- ver AvisoUnidade.tsx. */
  unidades_agregadas?: UnidadeAgregadaMeta[];
  /** UFs publicadas sob o código de HOJE que não existiam (ou tinham outro território) na época
   *  do censo -- hoje só o Tocantins em 1980 (52 municípios do norte de Goiás, mesmo precedente
   *  de Fernando de Noronha). Ausente nas edições em que toda UF publicada já existia. Gerado
   *  por pipeline/norte_goias_1980.py -> pipeline/build_meta.py; lido por `AvisoUnidadeUf`. */
  ufs_fora_da_epoca?: UfForaDaEpocaMeta[];
}

/** Uma UF do nível "uf" cujo território, na época do censo, pertencia a outra UF. */
export interface UfForaDaEpocaMeta {
  /** UF publicada (código de hoje, 2 dígitos) */
  uf: string;
  uf_sigla: string;
  /** UF a que o território pertencia na época do censo */
  uf_censo: string;
  uf_censo_sigla: string;
  n_municipios: number;
  /** frase pronta explicando o que a UF publicada é e como as trocas aparecem */
  nota: string;
}

/** Nenhuma edição a usa desde 1.1.0-1980; mecanismo genérico mantido inativo (ver
 *  `Meta.unidades_agregadas`). */
export interface UnidadeAgregadaMeta {
  /** código não numérico da unidade em municipios_ref/municipios/malha */
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

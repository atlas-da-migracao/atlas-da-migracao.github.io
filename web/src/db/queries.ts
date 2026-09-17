/** Consultas do atlas. Toda agregação roda no navegador, via DuckDB-WASM. */
import { consultar, consultarSerie, lit } from "./duckdb";
import type { Fluxo, Municipio } from "../lib/types";
import type { EdicaoSerie, NivelSerie } from "../lib/serie";

export const carregarMunicipios = () =>
  consultar<Municipio>(`
    SELECT cd_mun, nm_mun, uf, uf_sigla, cd_rgi, nm_rgi, cd_rgint, nm_rgint, cd_rm, nm_rm,
           pop, pop5, imig, imig_ni, imig_int, emig, saldo, tbi, tbe, tlm, iem,
           se_imig, se_emig, se_saldo, cv_imig, cv_emig,
           n_imig_faixa, n_emig_faixa, precisao_imig
    FROM municipios ORDER BY cd_mun`);

/** Principais fluxos de entrada e de saída de um município, já com coordenadas. */
export const fluxosDoMunicipio = (cd: string, topN: number) =>
  consultar<Fluxo & { direcao: "entrada" | "saida" }>(`
    WITH cent AS (SELECT cd_mun, lon, lat, x_albers, y_albers FROM read_parquet('geo/centroides.parquet')),
    entradas AS (
      SELECT 'entrada' AS direcao, f.origem, f.destino, f.total, f.se, f.cv, f.n_faixa, f.precisao
      FROM fluxos f WHERE f.destino = ${lit(cd)} ORDER BY f.total DESC LIMIT ${topN}
    ), saidas AS (
      SELECT 'saida' AS direcao, f.origem, f.destino, f.total, f.se, f.cv, f.n_faixa, f.precisao
      FROM fluxos f WHERE f.origem = ${lit(cd)} ORDER BY f.total DESC LIMIT ${topN}
    ), u AS (SELECT * FROM entradas UNION ALL SELECT * FROM saidas)
    SELECT u.*, ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d,
           co.x_albers AS x_o, co.y_albers AS y_o, cd_.x_albers AS x_d, cd_.y_albers AS y_d
    FROM u
    JOIN municipios_ref ro ON ro.cd_mun = u.origem
    JOIN municipios_ref rd ON rd.cd_mun = u.destino
    JOIN cent co ON co.cd_mun = u.origem
    JOIN cent cd_ ON cd_.cd_mun = u.destino
    ORDER BY u.total DESC`);

/** Maiores fluxos do país, para a primeira pintura do mapa. Com `coluna` (recorte
 *  "dimensao__categoria"), ordena e dimensiona pelo volume daquele subgrupo. */
export const maioresFluxos = (limite = 400, coluna: string | null = null) =>
  consultar<Fluxo>(`
    WITH cent AS (SELECT cd_mun, lon, lat, x_albers, y_albers FROM read_parquet('geo/centroides.parquet')),
    t AS (
      SELECT *, ${coluna ? `"${coluna}"` : "total"} AS volume FROM fluxos
      ${coluna ? `WHERE "${coluna}" > 0` : ""}
      ORDER BY volume DESC LIMIT ${limite}
    )
    SELECT t.origem, t.destino, t.volume AS total,
           ${coluna ? "NULL AS se, NULL AS cv, NULL AS n_faixa, NULL AS precisao" : "t.se, t.cv, t.n_faixa, t.precisao"},
           ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d,
           co.x_albers AS x_o, co.y_albers AS y_o, cd_.x_albers AS x_d, cd_.y_albers AS y_d
    FROM t
    JOIN municipios_ref ro ON ro.cd_mun = t.origem
    JOIN municipios_ref rd ON rd.cd_mun = t.destino
    JOIN cent co ON co.cd_mun = t.origem
    JOIN cent cd_ ON cd_.cd_mun = t.destino
    ORDER BY t.volume DESC`);

/** Perfil de um município por dimensão (imigrantes, emigrantes e residentes). */
export const perfilDoMunicipio = (cd: string, dimensao: string) =>
  consultar<{ direcao: string; categoria: string; valor: number; n_faixa: string }>(`
    SELECT direcao, categoria, valor, n_faixa FROM municipios_dim
    WHERE cd_mun = ${lit(cd)} AND dimensao = ${lit(dimensao)}
    ORDER BY direcao, valor DESC`);

// ================= F5: fluxo selecionado e perfis =================

export interface DetalheFluxo {
  origem: string; destino: string;
  nm_origem: string; uf_origem: string; nm_destino: string; uf_destino: string;
  total: number; se: number | null; cv: number | null;
  n_faixa: string; precisao: string; tem_detalhe: boolean;
  /** colunas largas de perfil: status__*, edu__*, renda__*, idade_sexo__* */
  [coluna: string]: unknown;
}

/** Um fluxo o->d com todo o seu perfil, mais o fluxo reverso d->o. */
export async function detalheDoFluxo(o: string, d: string) {
  const linhas = await consultar<DetalheFluxo>(`
    SELECT f.*, ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino
    FROM fluxos f
    JOIN municipios_ref ro ON ro.cd_mun = f.origem
    JOIN municipios_ref rd ON rd.cd_mun = f.destino
    WHERE (f.origem = ${lit(o)} AND f.destino = ${lit(d)})
       OR (f.origem = ${lit(d)} AND f.destino = ${lit(o)})`);
  return {
    ida: linhas.find((l) => l.origem === o && l.destino === d) ?? null,
    volta: linhas.find((l) => l.origem === d && l.destino === o) ?? null,
  };
}

/** Perfis de referência: imigrantes e residentes do destino, emigrantes da origem. */
export const referenciasDoPerfil = (origem: string, destino: string) =>
  consultar<{ cd_mun: string; direcao: string; dimensao: string; categoria: string; valor: number }>(`
    SELECT cd_mun, direcao, dimensao, categoria, valor FROM municipios_dim
    WHERE (cd_mun = ${lit(destino)} AND direcao IN ('imig', 'residente'))
       OR (cd_mun = ${lit(origem)} AND direcao = 'emig')`);

/** Fluxos filtrados por uma categoria de característica, para mapa e tabelas.
 *  A coluna larga correspondente vira o volume: assim o mapa responde ao filtro
 *  sem precisar de outra tabela. se/cv/precisão publicados são do fluxo total, não do
 *  subgrupo, por isso saem nulos. */
export const fluxosPorCategoria = (cd: string, coluna: string, topN: number) =>
  consultar<Fluxo & { direcao: "entrada" | "saida" }>(`
    WITH cent AS (SELECT cd_mun, lon, lat, x_albers, y_albers FROM read_parquet('geo/centroides.parquet')),
    entradas AS (
      SELECT 'entrada' AS direcao, origem, destino, "${coluna}" AS total,
             NULL AS se, NULL AS cv, NULL AS n_faixa, NULL AS precisao
      FROM fluxos WHERE destino = ${lit(cd)} AND "${coluna}" > 0 ORDER BY "${coluna}" DESC LIMIT ${topN}
    ), saidas AS (
      SELECT 'saida' AS direcao, origem, destino, "${coluna}" AS total,
             NULL AS se, NULL AS cv, NULL AS n_faixa, NULL AS precisao
      FROM fluxos WHERE origem = ${lit(cd)} AND "${coluna}" > 0 ORDER BY "${coluna}" DESC LIMIT ${topN}
    ), u AS (SELECT * FROM entradas UNION ALL SELECT * FROM saidas)
    SELECT u.*, ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d,
           co.x_albers AS x_o, co.y_albers AS y_o, cd_.x_albers AS x_d, cd_.y_albers AS y_d
    FROM u
    JOIN municipios_ref ro ON ro.cd_mun = u.origem
    JOIN municipios_ref rd ON rd.cd_mun = u.destino
    JOIN cent co ON co.cd_mun = u.origem
    JOIN cent cd_ ON cd_.cd_mun = u.destino
    ORDER BY u.total DESC`);

/** Saldo por município restrito a uma categoria (repinta o coroplético sob filtro). */
export const saldoPorCategoria = (coluna: string) =>
  consultar<{ cd_mun: string; imig: number; emig: number; saldo: number }>(`
    WITH e AS (SELECT destino AS cd_mun, SUM("${coluna}") v FROM fluxos GROUP BY 1),
         s AS (SELECT origem  AS cd_mun, SUM("${coluna}") v FROM fluxos GROUP BY 1)
    SELECT COALESCE(e.cd_mun, s.cd_mun) AS cd_mun,
           COALESCE(e.v, 0) AS imig, COALESCE(s.v, 0) AS emig,
           COALESCE(e.v, 0) - COALESCE(s.v, 0) AS saldo
    FROM e FULL OUTER JOIN s ON e.cd_mun = s.cd_mun`);

// ================= F6: níveis de agregação (RGI, RGInt, UF) =================
// Os fluxos por nível já vêm publicados (fluxos_rgi/rgint/uf, mesmo esquema de `fluxos`).
// Os indicadores agregados (I, E, saldo, TLM) são somados aqui a partir desses fluxos e de
// `municipios` (para pop5) -- não são uma nova estimativa com variância própria, por isso
// não têm erro-padrão: ver a nota "sem estimativa" na legenda e na página de metodologia.
export type NivelAgregado = "rgi" | "rgint" | "uf";

export interface UnidadeAgregada {
  codigo: string; nome: string; uf_sigla: string | null;
  pop5: number; imig: number; emig: number; saldo: number; tlm: number | null; iem: number | null;
}

/** Tabela de fluxos, coluna do código na malha/em municipios_ref, e arquivo de centroides
 *  (coluna "cd") de cada nível. UF usa o código numérico de 2 dígitos como identificador
 *  canônico em todo lugar -- o mesmo que já aparece em fluxos_uf/municipios.uf e no id
 *  (`cd_uf`) do uf.topojson -- para não precisar de tradução sigla<->código; uf_sigla é só
 *  um campo de exibição, como nos demais níveis. */
const CONFIG_NIVEL: Record<NivelAgregado, { fluxos: string; campo: string; nomeCol: string; centroides: string }> = {
  rgi: { fluxos: "fluxos_rgi", campo: "cd_rgi", nomeCol: "nm_rgi", centroides: "geo/centroides_rgi.parquet" },
  rgint: { fluxos: "fluxos_rgint", campo: "cd_rgint", nomeCol: "nm_rgint", centroides: "geo/centroides_rgint.parquet" },
  uf: { fluxos: "fluxos_uf", campo: "uf", nomeCol: "uf_nome", centroides: "geo/centroides_uf.parquet" },
};

/** NOTA (F9.9, edição 1980): `WHERE ${campo} IS NOT NULL` em todas as listas de unidade
 *  agregada abaixo. Uma UNIDADE AGREGADA de `municipios_ref` (hoje só 'NORTEGO', os 52
 *  municípios do norte de Goiás publicados como uma unidade só -- ver
 *  pipeline/unidades_agregadas_1980.py) cobre 11 RGIs e 3 RGInts de 2022 e não é de nenhuma,
 *  então sai com cd_rgi/cd_rgint nulos. Sem o filtro, o `SELECT DISTINCT` traria um código
 *  nulo como se fosse uma RGI/RGInt, que apareceria no seletor e no painel como uma unidade
 *  sem nome. No nível de UF o filtro é inócuo (a unidade TEM UF publicada, '17'), e nas
 *  demais edições também -- lá nenhum município fica sem recorte. A contrapartida geográfica
 *  do mesmo filtro está em geo/build.sh (`-filter "cd_rgi != null"` antes do -dissolve). */
/** Indicadores de todas as unidades de um nível, para o coroplético e os painéis. */
export function carregarUnidades(nivel: NivelAgregado) {
  const { fluxos, campo, nomeCol } = CONFIG_NIVEL[nivel];
  return consultar<UnidadeAgregada>(`
    WITH nomes AS (SELECT DISTINCT ${campo} AS codigo, ${nomeCol} AS nome, uf_sigla FROM municipios_ref WHERE ${campo} IS NOT NULL),
         pop AS (SELECT ${campo} AS codigo, SUM(pop5) AS pop5 FROM municipios GROUP BY 1),
         imig AS (SELECT destino AS codigo, SUM(total) AS imig FROM ${fluxos} GROUP BY 1),
         emig AS (SELECT origem AS codigo, SUM(total) AS emig FROM ${fluxos} GROUP BY 1)
    SELECT n.codigo, n.nome, n.uf_sigla, COALESCE(p.pop5, 0) AS pop5,
           COALESCE(im.imig, 0) AS imig, COALESCE(em.emig, 0) AS emig,
           COALESCE(im.imig, 0) - COALESCE(em.emig, 0) AS saldo,
           CASE WHEN COALESCE(p.pop5, 0) > 0
                THEN (COALESCE(im.imig, 0) - COALESCE(em.emig, 0)) / p.pop5 * 1000 END AS tlm,
           CASE WHEN COALESCE(im.imig, 0) + COALESCE(em.emig, 0) > 0
                THEN (COALESCE(im.imig, 0) - COALESCE(em.emig, 0)) / (COALESCE(im.imig, 0) + COALESCE(em.emig, 0)) END AS iem
    FROM nomes n LEFT JOIN pop p ON p.codigo = n.codigo
    LEFT JOIN imig im ON im.codigo = n.codigo LEFT JOIN emig em ON em.codigo = n.codigo`);
}

/** Principais fluxos de entrada e saída de uma unidade agregada, com coordenadas. */
export function fluxosDaUnidade(nivel: NivelAgregado, codigo: string, topN: number) {
  const { fluxos, campo, nomeCol, centroides } = CONFIG_NIVEL[nivel];
  return consultar<Fluxo & { direcao: "entrada" | "saida" }>(`
    WITH cent AS (SELECT cd, lon, lat, x_albers, y_albers FROM read_parquet('${centroides}')),
    nomes AS (SELECT DISTINCT ${campo} AS codigo, ${nomeCol} AS nome, uf_sigla FROM municipios_ref WHERE ${campo} IS NOT NULL),
    entradas AS (
      SELECT 'entrada' AS direcao, origem, destino, total, se, cv, n_faixa, precisao
      FROM ${fluxos} WHERE destino = ${lit(codigo)} ORDER BY total DESC LIMIT ${topN}
    ), saidas AS (
      SELECT 'saida' AS direcao, origem, destino, total, se, cv, n_faixa, precisao
      FROM ${fluxos} WHERE origem = ${lit(codigo)} ORDER BY total DESC LIMIT ${topN}
    ), u AS (SELECT * FROM entradas UNION ALL SELECT * FROM saidas)
    SELECT u.origem, u.destino, u.direcao, u.total, u.se, u.cv, u.n_faixa, u.precisao,
           no_.nome AS nm_origem, no_.uf_sigla AS uf_origem, nd.nome AS nm_destino, nd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d,
           co.x_albers AS x_o, co.y_albers AS y_o, cd_.x_albers AS x_d, cd_.y_albers AS y_d
    FROM u
    JOIN nomes no_ ON no_.codigo = u.origem
    JOIN nomes nd ON nd.codigo = u.destino
    JOIN cent co ON co.cd = u.origem
    JOIN cent cd_ ON cd_.cd = u.destino
    ORDER BY u.total DESC`);
}

/** Maiores fluxos do país num nível agregado, para a primeira pintura do mapa. */
export function maioresFluxosNivel(nivel: NivelAgregado, limite = 300) {
  const { fluxos, campo, nomeCol, centroides } = CONFIG_NIVEL[nivel];
  return consultar<Fluxo>(`
    WITH cent AS (SELECT cd, lon, lat, x_albers, y_albers FROM read_parquet('${centroides}')),
    nomes AS (SELECT DISTINCT ${campo} AS codigo, ${nomeCol} AS nome, uf_sigla FROM municipios_ref WHERE ${campo} IS NOT NULL),
    t AS (SELECT * FROM ${fluxos} ORDER BY total DESC LIMIT ${limite})
    SELECT t.origem, t.destino, t.total, t.se, t.cv, t.n_faixa, t.precisao,
           no_.nome AS nm_origem, no_.uf_sigla AS uf_origem, nd.nome AS nm_destino, nd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d,
           co.x_albers AS x_o, co.y_albers AS y_o, cd_.x_albers AS x_d, cd_.y_albers AS y_d
    FROM t
    JOIN nomes no_ ON no_.codigo = t.origem
    JOIN nomes nd ON nd.codigo = t.destino
    JOIN cent co ON co.cd = t.origem
    JOIN cent cd_ ON cd_.cd = t.destino`);
}

/** Centroides de um conjunto de unidades de um nível agregado (F6: enquadramento de um fluxo
 *  entre unidades). */
export function centroidesDeUnidades(nivel: NivelAgregado, codigos: string[]) {
  if (codigos.length === 0) return Promise.resolve([] as { cd_mun: string; lon: number; lat: number; x_albers: number; y_albers: number }[]);
  const { centroides } = CONFIG_NIVEL[nivel];
  return consultar<{ cd_mun: string; lon: number; lat: number; x_albers: number; y_albers: number }>(`
    SELECT cd AS cd_mun, lon, lat, x_albers, y_albers FROM read_parquet('${centroides}') WHERE cd IN (${codigos.map(lit).join(",")})`);
}

export interface DetalheFluxoUnidade {
  origem: string; destino: string; nm_origem: string; uf_origem: string | null;
  nm_destino: string; uf_destino: string | null; total: number; n_faixa: string; precisao: string;
}

/** Um par o->d de uma unidade agregada, com o fluxo reverso -- sem perfil (não existe nesse nível). */
export async function detalheFluxoUnidade(nivel: NivelAgregado, o: string, d: string) {
  const { fluxos, campo, nomeCol } = CONFIG_NIVEL[nivel];
  const linhas = await consultar<DetalheFluxoUnidade>(`
    WITH nomes AS (SELECT DISTINCT ${campo} AS codigo, ${nomeCol} AS nome, uf_sigla FROM municipios_ref WHERE ${campo} IS NOT NULL),
    par AS (
      SELECT origem, destino, total, n_faixa, precisao FROM ${fluxos}
      WHERE (origem = ${lit(o)} AND destino = ${lit(d)}) OR (origem = ${lit(d)} AND destino = ${lit(o)})
    )
    SELECT par.origem, par.destino, par.total, par.n_faixa, par.precisao,
           no_.nome AS nm_origem, no_.uf_sigla AS uf_origem, nd.nome AS nm_destino, nd.uf_sigla AS uf_destino
    FROM par
    JOIN nomes no_ ON no_.codigo = par.origem
    JOIN nomes nd ON nd.codigo = par.destino`);
  return {
    ida: linhas.find((l) => l.origem === o && l.destino === d) ?? null,
    volta: linhas.find((l) => l.origem === d && l.destino === o) ?? null,
  };
}

/** Centroides de um conjunto arbitrário de municípios (F6: enquadramento de um fluxo). */
export const centroidesDeMunicipios = (codigos: string[]) => {
  if (codigos.length === 0) return Promise.resolve([] as { cd_mun: string; lon: number; lat: number; x_albers: number; y_albers: number }[]);
  return consultar<{ cd_mun: string; lon: number; lat: number; x_albers: number; y_albers: number }>(`
    SELECT cd_mun, lon, lat, x_albers, y_albers FROM read_parquet('geo/centroides.parquet')
    WHERE cd_mun IN (${codigos.map(lit).join(",")})`);
};

// ================= F6 leva 2: capa nacional (painel vazio) =================

export interface CapaBrasil {
  total_migrantes: number; imig_ni: number; imig_int: number; pop5: number; n_pares: number;
  n_municipios: number;
}

/** Números do Brasil para a capa do painel vazio: soma dos indicadores municipais
 *  (imig com origem conhecida = emig, por construção) e a contagem de pares publicados
 *  em `fluxos`. Por edição (F4): `consultar` já usa a conexão da edição ativa. */
export const capaBrasil = () =>
  consultar<CapaBrasil>(`
    SELECT SUM(imig) AS total_migrantes, SUM(imig_ni) AS imig_ni, SUM(imig_int) AS imig_int,
           SUM(pop5) AS pop5, (SELECT COUNT(*) FROM fluxos) AS n_pares,
           COUNT(*) AS n_municipios
    FROM municipios`).then((r) => r[0] ?? null);

export interface AlcanceNacional { distancia_media: number | null; pct_interestadual: number | null }

/** Distância média ponderada e % interestadual do país inteiro (todos os pares de `fluxos`,
 *  exceto autoloop), na mesma fórmula de `pipeline/medidas.py::distancia_media_ponderada` e
 *  `pct_interestadual` -- aqui recalculada no navegador porque essas duas medidas só são
 *  publicadas por unidade (município etc.), não como agregado nacional único. Alimenta
 *  `lib/serie.ts::tipoFluxoPredominante` na capa nacional (mesma tipologia do Bloco 1 de
 *  "Ao longo dos censos"). `distancia_media` sai em METROS, como no restante do atlas. */
export const alcanceNacional = () =>
  consultar<AlcanceNacional>(`
    WITH cent AS (SELECT cd_mun, x_albers, y_albers FROM read_parquet('geo/centroides.parquet')),
    f AS (
      SELECT fl.total, ro.uf AS uf_o, rd.uf AS uf_d,
             SQRT(POWER(co.x_albers - cd_.x_albers, 2) + POWER(co.y_albers - cd_.y_albers, 2)) AS dist
      FROM fluxos fl
      JOIN municipios_ref ro ON ro.cd_mun = fl.origem
      JOIN municipios_ref rd ON rd.cd_mun = fl.destino
      JOIN cent co ON co.cd_mun = fl.origem
      JOIN cent cd_ ON cd_.cd_mun = fl.destino
      WHERE fl.origem <> fl.destino
    )
    SELECT SUM(total * dist) / NULLIF(SUM(total), 0) AS distancia_media,
           100.0 * SUM(CASE WHEN uf_o <> uf_d THEN total ELSE 0 END) / NULLIF(SUM(total), 0) AS pct_interestadual
    FROM f`).then((r) => r[0] ?? null);

/** Maiores fluxos entre UFs, para a matriz de acordes. */
export const fluxosEntreUFs = () =>
  consultar<{ origem: string; destino: string; total: number }>(`
    SELECT origem, destino, total FROM fluxos_uf WHERE origem <> destino ORDER BY total DESC`);

// ================= F5b: módulo metropolitano =================

export interface ResumoRM {
  cd_rm: string; nm_rm: string; tipo: string; nm_nucleo: string; nucleo_uf: string | null;
  n_municipios: number; pop: number;
  mig_intra: number; nucleo_periferia: number; periferia_nucleo: number; periferia_periferia: number;
  entradas_externas: number; saidas_externas: number; saldo_externo: number;
  ocupados: number; pendulares: number; pct_pendular: number | null; tempo_mediano: number | null;
  pct_coletivo: number | null; pct_diario: number | null;
}

const SQL_RESUMO_RM = `
  SELECT rr.*, n.uf_sigla AS nucleo_uf
  FROM rm_resumo rr
  LEFT JOIN rm n ON n.cd_rm = rr.cd_rm AND n.nucleo`;

/** Lista de RMs/RIDEs para o seletor, ordenada por população. */
export const listarRMs = () => consultar<ResumoRM>(`${SQL_RESUMO_RM} ORDER BY rr.pop DESC`);

export const resumoDaRM = (cd_rm: string) =>
  consultar<ResumoRM>(`${SQL_RESUMO_RM} WHERE rr.cd_rm = ${lit(cd_rm)}`).then((r) => r[0] ?? null);

export interface MunicipioRM { cd_mun: string; nm_mun: string; uf_sigla: string; nucleo: boolean; pop: number }

/** Municípios de uma RM, para o seletor de destaque e a legenda núcleo/periferia. */
export const municipiosDaRM = (cd_rm: string) =>
  consultar<MunicipioRM>(`
    SELECT cd_mun, nm_mun, uf_sigla, nucleo, pop FROM rm WHERE cd_rm = ${lit(cd_rm)} ORDER BY pop DESC`);

/** Centroides dos municípios de uma RM, para o enquadramento (fitBounds) do mapa. */
export const centroidesDaRM = (cd_rm: string) =>
  consultar<{ cd_mun: string; lon: number; lat: number; x_albers: number; y_albers: number }>(`
    SELECT c.cd_mun, c.lon, c.lat, c.x_albers, c.y_albers
    FROM read_parquet('geo/centroides.parquet') c
    JOIN rm r ON r.cd_mun = c.cd_mun
    WHERE r.cd_rm = ${lit(cd_rm)}`);

/** Todos os fluxos intra-RM (para arcos, matriz núcleo x periferia e ranking de saldo). */
export const fluxosIntraDaRM = (cd_rm: string) =>
  consultar<Fluxo & { tipologia: string; cd_rm: string }>(`
    WITH cent AS (SELECT cd_mun, lon, lat, x_albers, y_albers FROM read_parquet('geo/centroides.parquet'))
    SELECT f.cd_rm, f.origem, f.destino, f.tipologia, f.total, f.se, f.cv, f.n_faixa,
           ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d,
           co.x_albers AS x_o, co.y_albers AS y_o, cd_.x_albers AS x_d, cd_.y_albers AS y_d
    FROM rm_fluxos_intra f
    JOIN municipios_ref ro ON ro.cd_mun = f.origem
    JOIN municipios_ref rd ON rd.cd_mun = f.destino
    JOIN cent co ON co.cd_mun = f.origem
    JOIN cent cd_ ON cd_.cd_mun = f.destino
    WHERE f.cd_rm = ${lit(cd_rm)}
    ORDER BY f.total DESC`);

export interface FluxoPendularRM extends Fluxo {
  tem_detalhe: boolean; tempo_mediano: number | null; pct_diario: number | null; pct_coletivo: number | null;
  cruza: boolean;
}

/** Fluxos pendulares (trabalho ou estudo) com origem e destino na RM; com `cruzar`,
 *  inclui também os pares com exatamente uma ponta na RM (destacados como "cruza"). */
export function pendularDaRM(
  cd_rm: string, tabela: "pendular_trab" | "pendular_estudo", topN: number, cruzar: boolean,
) {
  const camposExtra = tabela === "pendular_trab"
    ? "p.tem_detalhe, p.tempo_mediano, p.pct_diario, p.pct_coletivo"
    : "p.tem_detalhe, NULL AS tempo_mediano, NULL AS pct_diario, NULL AS pct_coletivo";
  return consultar<FluxoPendularRM>(`
    WITH cent AS (SELECT cd_mun, lon, lat, x_albers, y_albers FROM read_parquet('geo/centroides.parquet')),
    rmset AS (SELECT cd_mun FROM rm WHERE cd_rm = ${lit(cd_rm)}),
    intra AS (
      SELECT p.origem, p.destino, p.total, p.se, p.cv, p.n_faixa, p.precisao, ${camposExtra}, false AS cruza
      FROM ${tabela} p
      WHERE p.origem IN (SELECT cd_mun FROM rmset) AND p.destino IN (SELECT cd_mun FROM rmset)
      ORDER BY p.total DESC LIMIT ${topN}
    )
    ${cruzar ? `
    , fronteira AS (
      SELECT p.origem, p.destino, p.total, p.se, p.cv, p.n_faixa, p.precisao, ${camposExtra}, true AS cruza
      FROM ${tabela} p
      WHERE (p.origem IN (SELECT cd_mun FROM rmset)) <> (p.destino IN (SELECT cd_mun FROM rmset))
      ORDER BY p.total DESC LIMIT ${topN}
    ), u AS (SELECT * FROM intra UNION ALL SELECT * FROM fronteira)
    ` : ", u AS (SELECT * FROM intra)"}
    SELECT u.*, ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d,
           co.x_albers AS x_o, co.y_albers AS y_o, cd_.x_albers AS x_d, cd_.y_albers AS y_d
    FROM u
    JOIN municipios_ref ro ON ro.cd_mun = u.origem
    JOIN municipios_ref rd ON rd.cd_mun = u.destino
    JOIN cent co ON co.cd_mun = u.origem
    JOIN cent cd_ ON cd_.cd_mun = u.destino
    ORDER BY u.total DESC`);
}

export interface DetalhePendular {
  origem: string; destino: string; nm_origem: string; uf_origem: string; nm_destino: string; uf_destino: string;
  total: number; se: number | null; cv: number | null; n_faixa: string; precisao: string; tem_detalhe: boolean;
  tempo_mediano: number | null; pct_diario: number | null; pct_coletivo: number | null;
}

/** Um par pendular o->d com o fluxo reverso, para o PainelPendular. */
export async function detalhePendular(o: string, d: string, tabela: "pendular_trab" | "pendular_estudo") {
  const camposExtra = tabela === "pendular_trab"
    ? "p.tempo_mediano, p.pct_diario, p.pct_coletivo"
    : "NULL AS tempo_mediano, NULL AS pct_diario, NULL AS pct_coletivo";
  const linhas = await consultar<DetalhePendular>(`
    SELECT p.origem, p.destino, p.total, p.se, p.cv, p.n_faixa, p.precisao, p.tem_detalhe, ${camposExtra},
           ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino
    FROM ${tabela} p
    JOIN municipios_ref ro ON ro.cd_mun = p.origem
    JOIN municipios_ref rd ON rd.cd_mun = p.destino
    WHERE (p.origem = ${lit(o)} AND p.destino = ${lit(d)}) OR (p.origem = ${lit(d)} AND p.destino = ${lit(o)})`);
  return {
    ida: linhas.find((l) => l.origem === o && l.destino === d) ?? null,
    volta: linhas.find((l) => l.origem === d && l.destino === o) ?? null,
  };
}

/** Dimensões de caracterização de um par pendular (formato longo). */
export const dimensoesPendular = (o: string, d: string, tabela: "pendular_trab_dim" | "pendular_estudo_dim") =>
  consultar<{ dimensao: string; categoria: string; valor: number; n_faixa: string }>(`
    SELECT dimensao, categoria, valor, n_faixa FROM ${tabela}
    WHERE origem = ${lit(o)} AND destino = ${lit(d)}`);

/** Indicadores municipais de pendularidade, para os rankings de saída e atração,
 *  restritos aos municípios de uma RM. */
export const municipiosPendularDaRM = (cd_rm: string) =>
  consultar<{
    cd_mun: string; nm_mun: string; uf_sigla: string;
    taxa_saida_pendular: number | null; indice_atracao: number | null; ocupados: number;
  }>(`
    SELECT mp.cd_mun, r.nm_mun, r.uf_sigla, mp.taxa_saida_pendular, mp.indice_atracao, mp.ocupados
    FROM municipios_pendular mp
    JOIN rm ON rm.cd_mun = mp.cd_mun AND rm.cd_rm = ${lit(cd_rm)}
    JOIN municipios_ref r ON r.cd_mun = mp.cd_mun`);

export interface MigPendularResumoRM {
  migrantes_intra: number; mig_ocupados: number; mig_pendulares: number;
  pendular_para_origem: number; pendular_para_nucleo: number; trabalha_onde_mora: number;
  mig_estudantes: number; mig_estud_pendulares: number;
}

/** KPIs somados sobre rm_mig_pendular_resumo, para o sub-painel "Migrantes e trabalho". */
export const migPendularResumoDaRM = (cd_rm: string) =>
  consultar<MigPendularResumoRM>(`
    SELECT SUM(migrantes_intra) AS migrantes_intra, SUM(mig_ocupados) AS mig_ocupados,
           SUM(mig_pendulares) AS mig_pendulares, SUM(pendular_para_origem) AS pendular_para_origem,
           SUM(pendular_para_nucleo) AS pendular_para_nucleo, SUM(trabalha_onde_mora) AS trabalha_onde_mora,
           SUM(mig_estudantes) AS mig_estudantes, SUM(mig_estud_pendulares) AS mig_estud_pendulares
    FROM rm_mig_pendular_resumo WHERE cd_rm = ${lit(cd_rm)}`).then((r): MigPendularResumoRM | null => r[0] ?? null);

/** Caminhos morava-em -> mora-em -> trabalha-em de uma RM, com destino_trab conhecido
 *  (classes origem/nucleo/outro), para o diagrama aluvial. */
export const caminhosPendularDaRM = (cd_rm: string) =>
  consultar<{ origem_mig: string; destino_mig: string; destino_trab: string; classe_trab: string;
             total: number; n_faixa: string }>(`
    SELECT origem_mig, destino_mig, destino_trab, classe_trab, total, n_faixa
    FROM rm_mig_pendular
    WHERE cd_rm = ${lit(cd_rm)} AND classe_trab IN ('origem', 'nucleo', 'outro')
    ORDER BY total DESC`);

/** Nomes de município usados para rotular os nós do diagrama aluvial. */
export const nomesDeMunicipios = (codigos: string[]) => {
  if (codigos.length === 0) return Promise.resolve([] as { cd_mun: string; nm_mun: string; uf_sigla: string }[]);
  return consultar<{ cd_mun: string; nm_mun: string; uf_sigla: string }>(`
    SELECT cd_mun, nm_mun, uf_sigla FROM municipios_ref WHERE cd_mun IN (${codigos.map(lit).join(",")})`);
};

/** Destinos de trabalho dos migrantes de um par o->d de uma RM (bloco do PainelFluxo). */
export const destinosTrabalhoDoFluxo = (cd_rm: string, o: string, d: string) =>
  consultar<{ destino_trab: string; nm_destino_trab: string; uf_destino_trab: string;
              classe_trab: string; total: number; n_faixa: string }>(`
    SELECT p.destino_trab, r.nm_mun AS nm_destino_trab, r.uf_sigla AS uf_destino_trab,
           p.classe_trab, p.total, p.n_faixa
    FROM rm_mig_pendular p
    LEFT JOIN municipios_ref r ON r.cd_mun = p.destino_trab
    WHERE p.cd_rm = ${lit(cd_rm)} AND p.origem_mig = ${lit(o)} AND p.destino_mig = ${lit(d)}
    ORDER BY p.total DESC`);

/** Estudantes pendulares da RM: soma de saida_estudo dos municípios da RM. */
export const estudoPendularDaRM = (cd_rm: string) =>
  consultar<{ saida_estudo: number; entrada_estudo: number }>(`
    SELECT SUM(mp.saida_estudo) AS saida_estudo, SUM(mp.entrada_estudo) AS entrada_estudo
    FROM municipios_pendular mp JOIN rm ON rm.cd_mun = mp.cd_mun AND rm.cd_rm = ${lit(cd_rm)}`)
    .then((r) => r[0] ?? { saida_estudo: 0, entrada_estudo: 0 });

/** Migração intra-RM que estuda em outro município (classe_estudo), para a aba de estudo. */
export const migEstudoDaRM = (cd_rm: string) =>
  consultar<{ classe_estudo: string; total: number }>(`
    SELECT classe_estudo, SUM(total) AS total FROM rm_mig_estudo
    WHERE cd_rm = ${lit(cd_rm)} GROUP BY 1`);

/** Dado o par o->d, a RM (se houver) à qual ambos pertencem -- usada pelo PainelFluxo
 *  para decidir se mostra o bloco "onde trabalham os que fizeram este percurso". */
export const rmDoPar = (o: string, d: string) =>
  consultar<{ cd_rm: string }>(`
    SELECT DISTINCT r1.cd_rm FROM rm r1 JOIN rm r2 ON r1.cd_rm = r2.cd_rm
    WHERE r1.cd_mun = ${lit(o)} AND r2.cd_mun = ${lit(d)}`).then((r) => r[0]?.cd_rm ?? null);

// ============ F12.5: "Ao longo dos censos" -- consultas na conexão "serie" ============
// Ver web/src/db/duckdb.ts (conectarSerie/consultarSerie) e web/src/lib/serie.ts (tipos e
// regras). Os cinco parquets (unidades_serie, pares_serie, perfil_serie, sistema_serie,
// loglinear_serie) são publicados uma única vez, fora do caminho por edição.

/** As cinco edições da unidade (nivel, codigo), na ordem cronológica 1980->2022, com
 *  posições ausentes preenchidas (a série é sempre completa em EDICOES_SERIE; a ausência
 *  vira `estado`/motivo do lado de `lib/serie.ts`, não da consulta). */
export const serieDaUnidade = (nivel: NivelSerie, codigo: string) =>
  consultarSerie<Record<string, unknown>>(`
    SELECT * FROM unidades_serie
    WHERE nivel = ${lit(nivel)} AND codigo = ${lit(codigo)}
    ORDER BY CASE edicao WHEN '1980' THEN 0 WHEN '1991' THEN 1 WHEN '2000' THEN 2
                         WHEN '2010' THEN 3 WHEN '2022' THEN 4 END`);

/** Top-10 de parceiros (origens ou destinos) de uma unidade nas cinco edições, mais
 *  qualquer parceiro que tenha estado no top-10 em alguma edição (seção 3.3-a).
 *
 *  `direcao` é o lado FIXO do par (a própria unidade selecionada): "destino" pede os
 *  parceiros que são ORIGEM dos fluxos que chegam nela ("de onde vieram"); "origem" pede os
 *  parceiros que são DESTINO dos fluxos que saem dela ("para onde foram"). `tipoFluxo`
 *  é a dimensão independente de `pares_serie.tipo` (migração/pendular-trabalho/pendular-
 *  estudo) -- as duas NÃO podem compartilhar um parâmetro, senão o filtro
 *  `WHERE tipo = <direção>` nunca casa com nenhuma linha (bug corrigido nesta revisão: a
 *  versão anterior usava `direcao` também como valor de `tipo`, e com a polaridade
 *  invertida). Devolve `nome`/`uf_sigla` do parceiro via `unidades_nomes` (registrada em
 *  `db/duckdb.ts::iniciarSerie`, fonte `municipios_ref` de 2022). */
export const serieDosPares = (
  nivel: NivelSerie, codigo: string, direcao: "origem" | "destino",
  tipoFluxo: "mig" | "trab" | "estudo" = "mig",
) => {
  const fixo = direcao;
  const variavel = direcao === "destino" ? "origem" : "destino";
  return consultarSerie<Record<string, unknown>>(`
    WITH base AS (
      SELECT * FROM pares_serie
      WHERE nivel = ${lit(nivel)} AND tipo = ${lit(tipoFluxo)} AND ${fixo} = ${lit(codigo)}
    ), destaque AS (
      SELECT DISTINCT ${variavel} AS parceiro
      FROM base WHERE posto IS NOT NULL AND posto <= 10
    )
    SELECT base.*, n.nome AS nome_parceiro FROM base
    JOIN destaque ON destaque.parceiro = base.${variavel}
    LEFT JOIN unidades_nomes n ON n.nivel = ${lit(nivel)} AND n.codigo = base.${variavel}
    ORDER BY base.edicao, base.posto`);
};

/** Série de um par origem->destino específico (bloco 3-c, "par selecionado"). */
export const serieDoPar = (nivel: NivelSerie, o: string, d: string) =>
  consultarSerie<Record<string, unknown>>(`
    SELECT * FROM pares_serie
    WHERE nivel = ${lit(nivel)} AND origem = ${lit(o)} AND destino = ${lit(d)}
    ORDER BY CASE edicao WHEN '1980' THEN 0 WHEN '1991' THEN 1 WHEN '2000' THEN 2
                         WHEN '2010' THEN 3 WHEN '2022' THEN 4 END`);

/** Perfil de uma unidade por dimensão, nas cinco edições (bloco 4). */
export const seriePerfil = (nivel: NivelSerie, codigo: string, dimensao: string) =>
  consultarSerie<{ nivel: string; codigo: string; edicao: EdicaoSerie; direcao: string;
                    dimensao: string; categoria: string; valor: number; n_faixa: string | null;
                    comparavel_com_ressalva: boolean }>(`
    SELECT * FROM perfil_serie
    WHERE nivel = ${lit(nivel)} AND codigo = ${lit(codigo)} AND dimensao = ${lit(dimensao)}
    ORDER BY CASE edicao WHEN '1980' THEN 0 WHEN '1991' THEN 1 WHEN '2000' THEN 2
                         WHEN '2010' THEN 3 WHEN '2022' THEN 4 END, direcao, categoria`);

/** Medidas do sistema (Bloco 2: CMI, SMI, MEI agregado, ANMR, β de Fielding, Duncan D). */
export const serieDoSistema = (nivel: NivelSerie) =>
  consultarSerie<Record<string, unknown>>(`
    SELECT * FROM sistema_serie WHERE nivel = ${lit(nivel)}
    ORDER BY CASE edicao WHEN '1980' THEN 0 WHEN '1991' THEN 1 WHEN '2000' THEN 2
                         WHEN '2010' THEN 3 WHEN '2022' THEN 4 END`);

/** Decomposição log-linear (T, O_i, D_j, OD_ij) de uma unidade, nas edições publicadas. */
export const serieLogLinear = (nivel: NivelSerie, codigo: string) =>
  consultarSerie<Record<string, unknown>>(`
    SELECT * FROM loglinear_serie
    WHERE nivel = ${lit(nivel)} AND codigo = ${lit(codigo)}
    ORDER BY CASE edicao WHEN '1980' THEN 0 WHEN '1991' THEN 1 WHEN '2000' THEN 2
                         WHEN '2010' THEN 3 WHEN '2022' THEN 4 END`);

/** Municípios cujo `cd_mun_mae` aponta para `codigo` -- ou seja, unidades que se
 *  desmembraram DESTE município em alguma edição (seção 1.4, aviso `municipio_mae`). */
export const serieFilhosDoMunicipio = (codigo: string) =>
  consultarSerie<{ codigo: string; nm_mun_mae: string }>(`
    SELECT DISTINCT codigo FROM unidades_serie
    WHERE nivel = 'mun' AND cd_mun_mae = ${lit(codigo)}`);

// ============ F12.5-cartografia/gráficos: mapa comparativo e Bloco 2 (GraficosSistema) ============

export interface LinhaMapaSerie {
  codigo: string; edicao: EdicaoSerie;
  iem: number | null; tlm: number | null; tbi: number | null; tbe: number | null;
  existia: boolean | null; estado_cobertura: string | null; rm_unitaria: boolean | null;
}

/** Todas as unidades de um nível, nas cinco edições, só as colunas que o mapa comparativo
 *  pinta (iem/tlm/tbi/tbe -- nunca volume, seção 4.1) e o estado de ausência de cada célula.
 *  Usada por `MapaSerieCensos.tsx`: uma consulta cobre os cinco painéis. */
export const serieMapa = (nivel: NivelSerie) =>
  consultarSerie<LinhaMapaSerie>(`
    SELECT codigo, edicao, iem, tlm, tbi, tbe, existia, estado_cobertura, rm_unitaria
    FROM unidades_serie WHERE nivel = ${lit(nivel)}`);

/** CMI de TODOS os níveis de uma mesma edição (figura de Courgeau, seção 3.2-c): a figura
 *  exige comparar níveis dentro da MESMA edição, a única vista da seção em que isso é
 *  permitido (ver docs/design_serie_censos.md, 1.1, "nível é contexto fixo da seção"). */
export const serieCourgeau = (edicao: EdicaoSerie) =>
  consultarSerie<{ nivel: NivelSerie; n_unidades: number; cmi: number | null }>(`
    SELECT nivel, n_unidades, cmi FROM sistema_serie
    WHERE edicao = ${lit(edicao)} AND nivel <> 'rm'
    ORDER BY n_unidades`);

// ============ F13.1: busca unificada do modo "Ao longo dos censos" ============

export interface UnidadeBusca {
  nivel: NivelSerie; codigo: string; nome: string; uf_sigla: string | null; peso: number;
}

let cacheUnidadesBusca: Promise<UnidadeBusca[]> | null = null;

/** Todas as unidades dos cinco níveis (base territorial 2022) para a busca unificada do modo
 *  "Ao longo dos censos". `peso` = imig+emig de 2022 (`unidades_serie` não publica população;
 *  o movimento total de 2022 é um proxy suficiente para ordenar resultados de busca). ~6,3 mil
 *  linhas, carregada uma única vez e memoizada; em erro o cache é zerado (mesmo padrão de
 *  `conectarSerie`). */
export function serieUnidadesParaBusca(): Promise<UnidadeBusca[]> {
  if (!cacheUnidadesBusca) {
    cacheUnidadesBusca = consultarSerie<UnidadeBusca>(`
      SELECT n.nivel, n.codigo, n.nome, n.uf_sigla,
             COALESCE(u.imig, 0) + COALESCE(u.emig, 0) AS peso
      FROM unidades_nomes n
      LEFT JOIN unidades_serie u ON u.nivel = n.nivel AND u.codigo = n.codigo AND u.edicao = '2022'
    `).catch((e: unknown) => {
      cacheUnidadesBusca = null;
      throw e;
    });
  }
  return cacheUnidadesBusca;
}

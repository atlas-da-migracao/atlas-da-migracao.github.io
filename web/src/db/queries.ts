/** Consultas do atlas. Toda agregação roda no navegador, via DuckDB-WASM. */
import { consultar, lit } from "./duckdb";
import type { Fluxo, Municipio } from "../lib/types";

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
    WITH cent AS (SELECT cd_mun, lon, lat FROM read_parquet('geo/centroides.parquet')),
    entradas AS (
      SELECT 'entrada' AS direcao, f.origem, f.destino, f.total, f.se, f.cv, f.n_faixa, f.precisao
      FROM fluxos f WHERE f.destino = ${lit(cd)} ORDER BY f.total DESC LIMIT ${topN}
    ), saidas AS (
      SELECT 'saida' AS direcao, f.origem, f.destino, f.total, f.se, f.cv, f.n_faixa, f.precisao
      FROM fluxos f WHERE f.origem = ${lit(cd)} ORDER BY f.total DESC LIMIT ${topN}
    ), u AS (SELECT * FROM entradas UNION ALL SELECT * FROM saidas)
    SELECT u.*, ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d
    FROM u
    JOIN municipios_ref ro ON ro.cd_mun = u.origem
    JOIN municipios_ref rd ON rd.cd_mun = u.destino
    JOIN cent co ON co.cd_mun = u.origem
    JOIN cent cd_ ON cd_.cd_mun = u.destino
    ORDER BY u.total DESC`);

/** Maiores fluxos do país, para a primeira pintura do mapa. */
export const maioresFluxos = (limite = 400) =>
  consultar<Fluxo>(`
    WITH cent AS (SELECT cd_mun, lon, lat FROM read_parquet('geo/centroides.parquet')),
    t AS (SELECT * FROM fluxos ORDER BY total DESC LIMIT ${limite})
    SELECT t.origem, t.destino, t.total, t.se, t.cv, t.n_faixa, t.precisao,
           ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d
    FROM t
    JOIN municipios_ref ro ON ro.cd_mun = t.origem
    JOIN municipios_ref rd ON rd.cd_mun = t.destino
    JOIN cent co ON co.cd_mun = t.origem
    JOIN cent cd_ ON cd_.cd_mun = t.destino`);

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
 *  sem precisar de outra tabela. */
export const fluxosPorCategoria = (cd: string, coluna: string, topN: number) =>
  consultar<Fluxo & { direcao: "entrada" | "saida" }>(`
    WITH cent AS (SELECT cd_mun, lon, lat FROM read_parquet('geo/centroides.parquet')),
    entradas AS (
      SELECT 'entrada' AS direcao, origem, destino, "${coluna}" AS total, se, cv, n_faixa, precisao
      FROM fluxos WHERE destino = ${lit(cd)} AND "${coluna}" > 0 ORDER BY "${coluna}" DESC LIMIT ${topN}
    ), saidas AS (
      SELECT 'saida' AS direcao, origem, destino, "${coluna}" AS total, se, cv, n_faixa, precisao
      FROM fluxos WHERE origem = ${lit(cd)} AND "${coluna}" > 0 ORDER BY "${coluna}" DESC LIMIT ${topN}
    ), u AS (SELECT * FROM entradas UNION ALL SELECT * FROM saidas)
    SELECT u.*, ro.nm_mun AS nm_origem, ro.uf_sigla AS uf_origem,
           rd.nm_mun AS nm_destino, rd.uf_sigla AS uf_destino,
           co.lon AS lon_o, co.lat AS lat_o, cd_.lon AS lon_d, cd_.lat AS lat_d
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

/** Maiores fluxos entre UFs, para a matriz de acordes. */
export const fluxosEntreUFs = () =>
  consultar<{ origem: string; destino: string; total: number }>(`
    SELECT origem, destino, total FROM fluxos_uf WHERE origem <> destino ORDER BY total DESC`);

/** DuckDB-WASM em worker -- uma instância (worker + banco + views) por edição do Censo.
 *
 *  O runtime (worker + .wasm) é servido de /duckdb como arquivo estático, copiado do
 *  node_modules por scripts/copy-duckdb.sh -- e não baixado do CDN jsDelivr. Assim o
 *  site não depende de terceiros, funciona offline, e o worker recebe URLs absolutas
 *  na mesma origem (passá-lo pelo empacotador cria um worker de origem opaca, em que
 *  as URLs relativas do .wasm não resolvem).
 *
 *  Os Parquet publicados são registrados por URL e lidos com range requests, então só as
 *  partes necessárias de cada arquivo trafegam: a matriz de fluxos nunca é baixada inteira.
 *
 *  Multi-edição (F4): cada `Censo` tem seu próprio `AsyncDuckDB` (worker isolado, registrado
 *  a partir de `basePath(censo)`) -- os nomes de view são os mesmos em todas as edições
 *  (`municipios`, `fluxos`, ...), então `queries.ts` não precisa saber qual edição está
 *  ativa: toda consulta é dirigida à conexão certa por `consultar()`, que por padrão usa a
 *  edição ativa no estado global (`useStore.getState().censo`) quando nenhuma é passada.
 */
import { useEffect, useState } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";
import { basePath, CENSO_PADRAO, edicao, type Censo } from "../lib/edicoes";
import { useStore } from "../state/store";

/** Tabelas de migração publicadas em todas as edições, mesmo sem deslocamento pendular. */
const TABELAS_BASE = [
  "municipios", "municipios_dim", "municipios_ref",
  "fluxos", "fluxos_rgi", "fluxos_rgint", "fluxos_uf",
] as const;
/** Deslocamento pendular (trabalho/estudo): só existe em edições com `recursos.pendular`
 *  (ver lib/edicoes.ts) -- ausente em 1991. */
const TABELAS_PENDULAR = [
  "municipios_pendular", "pendular_trab", "pendular_trab_dim", "pendular_estudo",
  "pendular_estudo_dim",
] as const;
/** Módulo metropolitano (F5b): só existe em edições com `recursos.rm` (ver lib/edicoes.ts). */
const TABELAS_RM = ["rm", "rm_resumo", "rm_fluxos_intra"] as const;
/** Cruzamento RM x deslocamento pendular: exige `recursos.rm && recursos.pendular`. */
const TABELAS_RM_PENDULAR = [
  "rm_mig_pendular", "rm_mig_pendular_resumo", "rm_mig_estudo",
] as const;

/** Arquivos geográficos (fora das views acima -- lidos por caminho, via read_parquet). */
const ARQUIVOS_GEO = [
  "geo/centroides.parquet", "geo/centroides_rgi.parquet", "geo/centroides_rgint.parquet",
  "geo/centroides_uf.parquet",
] as const;

// ============ F6: progresso da carga a frio (worker + wasm + registro das tabelas) ============
// A primeira pintura do mapa usa só municipios_mapa.json (~1s); tudo que depende do DuckDB
// (arcos, painéis) só fica pronto depois de baixar o motor (~1-2 MB de wasm) e registrar as
// views -- historicamente 5-6s sem nenhum sinal visual. Este pequeno emissor deixa a interface
// (componente EstadoDados) mostrar em que etapa a carga está. Por edição: trocar de censo tem
// sua própria carga a frio na primeira vez (conexões não são reaproveitadas entre edições).
export type EstagioCarga = "baixando" | "iniciando" | "registrando" | "pronto" | "erro";
export interface ProgressoDuckDB { estagio: EstagioCarga; mensagem: string; erro?: string }

type Ouvinte = (p: ProgressoDuckDB) => void;
const ouvintesPorEdicao = new Map<Censo, Set<Ouvinte>>();
const progressoPorEdicao = new Map<Censo, ProgressoDuckDB>();

function progressoDe(censo: Censo): ProgressoDuckDB {
  return progressoPorEdicao.get(censo) ?? { estagio: "baixando", mensagem: "baixando o motor…" };
}

function emitir(censo: Censo, p: ProgressoDuckDB) {
  progressoPorEdicao.set(censo, p);
  for (const o of ouvintesPorEdicao.get(censo) ?? []) o(p);
}

/** Estado mais recente de uma edição, para quem se inscreve depois do início da carga. */
export const progressoAtual = (censo: Censo = CENSO_PADRAO): ProgressoDuckDB => progressoDe(censo);

/** Inscreve-se nas mudanças de estágio de uma edição; chama `fn` já com o estado atual.
 *  Devolve o cancelamento. */
export function ouvirProgresso(fn: Ouvinte, censo: Censo = CENSO_PADRAO): () => void {
  let s = ouvintesPorEdicao.get(censo);
  if (!s) { s = new Set(); ouvintesPorEdicao.set(censo, s); }
  s.add(fn);
  fn(progressoDe(censo));
  return () => s!.delete(fn);
}

/** O worker do DuckDB resolve o .wasm contra a própria base. Servir os dois como
 *  arquivos estáticos em /duckdb (copiados por scripts/copy-duckdb.sh) mantém tudo
 *  same-origin e com URL absoluta, sem depender de como o empacotador trata workers. */
async function iniciar(censo: Censo): Promise<duckdb.AsyncDuckDBConnection> {
  emitir(censo, { estagio: "baixando", mensagem: "baixando o motor de consulta…" });
  const raiz = new URL("duckdb/", document.baseURI).href;
  // Só o build "eh" (exception handling) é distribuído: o build "mvp" pesa 41 MB e só
  // serviria a navegadores antigos, que de todo modo não rodam o WebGL2 exigido pelo mapa.
  const bundle = {
    mainModule: `${raiz}duckdb-eh.wasm`,
    mainWorker: `${raiz}duckdb-browser-eh.worker.js`,
    pthreadWorker: null,
  };
  const worker = new Worker(bundle.mainWorker);
  worker.addEventListener("error", (e) => console.error(`[duckdb:${censo}] erro no worker`, e.message));
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);

  emitir(censo, { estagio: "iniciando", mensagem: "iniciando o banco…" });
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const con = await db.connect();

  const base = new URL(basePath(censo), document.baseURI).href;
  const recursos = edicao(censo).recursos;
  const tabelas: readonly string[] = [
    ...TABELAS_BASE,
    ...(recursos.pendular ? TABELAS_PENDULAR : []),
    ...(recursos.rm ? TABELAS_RM : []),
    ...(recursos.rm && recursos.pendular ? TABELAS_RM_PENDULAR : []),
  ];
  for (const [i, t] of tabelas.entries()) {
    emitir(censo, { estagio: "registrando", mensagem: `registrando tabelas ${i + 1}/${tabelas.length}` });
    await db.registerFileURL(`${t}.parquet`, `${base}${t}.parquet`, duckdb.DuckDBDataProtocol.HTTP, false);
    await con.query(`CREATE OR REPLACE VIEW ${t} AS SELECT * FROM read_parquet('${t}.parquet')`);
  }
  // arquivos geográficos usados nas junções de coordenadas (por caminho, sem view)
  for (const arq of ARQUIVOS_GEO) {
    await db.registerFileURL(arq, `${base}${arq}`, duckdb.DuckDBDataProtocol.HTTP, false);
  }
  emitir(censo, { estagio: "pronto", mensagem: "pronto" });
  return con;
}

const conexoes = new Map<Censo, Promise<duckdb.AsyncDuckDBConnection>>();

export function conectar(censo: Censo = CENSO_PADRAO): Promise<duckdb.AsyncDuckDBConnection> {
  let p = conexoes.get(censo);
  if (!p) {
    p = iniciar(censo).catch((e: unknown) => {
      // permite tentar de novo: a próxima chamada a conectar() reinicia a carga
      conexoes.delete(censo);
      emitir(censo, { estagio: "erro", mensagem: "falha ao preparar os dados", erro: (e as Error).message });
      throw e;
    });
    conexoes.set(censo, p);
  }
  return p;
}

/** Executa SQL e devolve as linhas como objetos, na conexão da edição ativa (ou de `censo`,
 *  se passado explicitamente). `queries.ts` nunca precisa passar `censo`: como os nomes de
 *  view são os mesmos em todas as edições, a mesma string SQL funciona em qualquer uma. */
export async function consultar<T = Record<string, unknown>>(
  sql: string, censo: Censo = useStore.getState().censo,
): Promise<T[]> {
  const con = await conectar(censo);
  const res = await con.query(sql);
  return res.toArray().map((linha) => {
    const obj = linha.toJSON() as Record<string, unknown>;
    // Arrow devolve BigInt para inteiros de 64 bits; o front-end trabalha com number.
    for (const [k, v] of Object.entries(obj)) if (typeof v === "bigint") obj[k] = Number(v);
    return obj as T;
  });
}

/** Escapa um literal de texto para interpolação segura em SQL. */
export const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

// ============ F12.5: conexão "serie", independente das cinco conexões por edição ============
// A seção "Ao longo dos censos" lê data/series/*.parquet -- publicado UMA vez, fora do caminho
// data/<edicao>/ que as demais views usam (ver basePath em lib/edicoes.ts). É uma conexão
// própria porque a série não pertence a nenhuma edição: ela COMPARA as cinco. Registrada uma
// única vez e reaproveitada por toda consulta de lib/serie.ts / db/queries.ts.
const TABELAS_SERIE = [
  "unidades_serie", "pares_serie", "perfil_serie", "sistema_serie", "loglinear_serie",
] as const;

/** Caminho base dos parquets da série -- análogo a `basePath()`, mas fixo (a série não
 *  depende da edição ativa). Ver web/scripts/sync-data.sh: `data/processed/series/**`
 *  vira `web/public/data/series/**` (cópia recursiva de `data/processed`). */
export const basePathSerie = (): string => "data/series/";

let conexaoSerie: Promise<duckdb.AsyncDuckDBConnection> | null = null;

async function iniciarSerie(): Promise<duckdb.AsyncDuckDBConnection> {
  const raiz = new URL("duckdb/", document.baseURI).href;
  const bundle = {
    mainModule: `${raiz}duckdb-eh.wasm`,
    mainWorker: `${raiz}duckdb-browser-eh.worker.js`,
    pthreadWorker: null,
  };
  const worker = new Worker(bundle.mainWorker);
  worker.addEventListener("error", (e) => console.error("[duckdb:serie] erro no worker", e.message));
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const con = await db.connect();

  const base = new URL(basePathSerie(), document.baseURI).href;
  for (const t of TABELAS_SERIE) {
    await db.registerFileURL(`${t}.parquet`, `${base}${t}.parquet`, duckdb.DuckDBDataProtocol.HTTP, false);
    await con.query(`CREATE OR REPLACE VIEW ${t} AS SELECT * FROM read_parquet('${t}.parquet')`);
  }

  // Nomes das unidades para os cinco níveis, resolvidos a partir de `municipios_ref` de 2022
  // (a base territorial da série -- todo `codigo` em unidades_serie/pares_serie é um código de
  // 2022, ver plano F12 "Base territorial"). Registrado só aqui, na conexão `serie` -- as
  // conexões por edição (db/duckdb.ts::TABELAS_BASE) já resolvem nome por join direto com o
  // `municipios_ref` da própria edição, que não serve à série (ela cruza as cinco edições).
  const baseEdicao2022 = new URL("data/", document.baseURI).href;
  await db.registerFileURL(
    "municipios_ref_2022.parquet", `${baseEdicao2022}municipios_ref.parquet`,
    duckdb.DuckDBDataProtocol.HTTP, false,
  );
  // `uf_sigla` (F13.1): preenchida em mun/rgi/rgint/uf -- RGI e RGInt não cruzam UF, por isso
  // `ANY_VALUE` sobre o `GROUP BY` código/nome basta; UF já É a sigla. RM fica NULL: uma
  // RIDE pode cruzar UF, então não há uma sigla única para atribuir à unidade.
  await con.query(`
    CREATE OR REPLACE VIEW unidades_nomes AS
    SELECT 'mun' AS nivel, cd_mun AS codigo, nm_mun AS nome, uf_sigla FROM read_parquet('municipios_ref_2022.parquet')
    UNION ALL
    SELECT 'rgi', cd_rgi, nm_rgi, ANY_VALUE(uf_sigla) FROM read_parquet('municipios_ref_2022.parquet')
    WHERE cd_rgi IS NOT NULL GROUP BY cd_rgi, nm_rgi
    UNION ALL
    SELECT 'rgint', cd_rgint, nm_rgint, ANY_VALUE(uf_sigla) FROM read_parquet('municipios_ref_2022.parquet')
    WHERE cd_rgint IS NOT NULL GROUP BY cd_rgint, nm_rgint
    UNION ALL
    SELECT DISTINCT 'uf', uf, uf_nome, uf_sigla FROM read_parquet('municipios_ref_2022.parquet') WHERE uf IS NOT NULL
    UNION ALL
    SELECT DISTINCT 'rm', cd_rm, nm_rm, NULL FROM read_parquet('municipios_ref_2022.parquet') WHERE cd_rm IS NOT NULL
  `);
  return con;
}

/** Conexão DuckDB dedicada às cinco tabelas da série (memoizada: os parquets carregam uma
 *  única vez, mesmo que a seção seja aberta/fechada várias vezes). */
export function conectarSerie(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!conexaoSerie) {
    conexaoSerie = iniciarSerie().catch((e: unknown) => {
      conexaoSerie = null;
      throw e;
    });
  }
  return conexaoSerie;
}

/** Executa SQL na conexão "serie" e devolve as linhas como objetos (mesma conversão de
 *  BigInt -> number de `consultar()`). */
export async function consultarSerie<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const con = await conectarSerie();
  const res = await con.query(sql);
  return res.toArray().map((linha) => {
    const obj = linha.toJSON() as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) if (typeof v === "bigint") obj[k] = Number(v);
    return obj as T;
  });
}

/** true enquanto o motor da edição ATIVA não estiver pronto -- painéis usam para trocar
 *  "carregando fluxos…" por "preparando os dados…" durante a carga a frio. Acompanha a
 *  edição ativa automaticamente (troca de censo tem sua própria carga a frio). */
export function usarDuckDBPronto(): boolean {
  const censo = useStore((s) => s.censo);
  const [pronto, setPronto] = useState(() => progressoDe(censo).estagio === "pronto");
  useEffect(() => {
    setPronto(progressoDe(censo).estagio === "pronto");
    return ouvirProgresso((p) => setPronto(p.estagio === "pronto"), censo);
  }, [censo]);
  return pronto;
}

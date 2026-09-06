/** DuckDB-WASM em worker.
 *
 *  O runtime (worker + .wasm) é servido de /duckdb como arquivo estático, copiado do
 *  node_modules por scripts/copy-duckdb.sh -- e não baixado do CDN jsDelivr. Assim o
 *  site não depende de terceiros, funciona offline, e o worker recebe URLs absolutas
 *  na mesma origem (passá-lo pelo empacotador cria um worker de origem opaca, em que
 *  as URLs relativas do .wasm não resolvem).
 *
 *  Os Parquet publicados são registrados por URL e lidos com range requests, então só as
 *  partes necessárias de cada arquivo trafegam: a matriz de fluxos nunca é baixada inteira.
 */
import * as duckdb from "@duckdb/duckdb-wasm";

let conexao: Promise<duckdb.AsyncDuckDBConnection> | null = null;

/** Tabelas publicadas em /data, registradas como views. */
const TABELAS = [
  "municipios", "municipios_dim", "municipios_ref", "municipios_pendular",
  "fluxos", "fluxos_rgi", "fluxos_rgint", "fluxos_uf",
  "pendular_trab", "pendular_trab_dim", "pendular_estudo", "pendular_estudo_dim",
  "rm", "rm_resumo", "rm_fluxos_intra", "rm_mig_pendular", "rm_mig_pendular_resumo",
  "rm_mig_estudo",
] as const;

/** O worker do DuckDB resolve o .wasm contra a própria base. Servir os dois como
 *  arquivos estáticos em /duckdb (copiados por scripts/copy-duckdb.sh) mantém tudo
 *  same-origin e com URL absoluta, sem depender de como o empacotador trata workers. */
async function iniciar(): Promise<duckdb.AsyncDuckDBConnection> {
  const raiz = new URL("duckdb/", document.baseURI).href;
  // Só o build "eh" (exception handling) é distribuído: o build "mvp" pesa 41 MB e só
  // serviria a navegadores antigos, que de todo modo não rodam o WebGL2 exigido pelo mapa.
  const bundle = {
    mainModule: `${raiz}duckdb-eh.wasm`,
    mainWorker: `${raiz}duckdb-browser-eh.worker.js`,
    pthreadWorker: null,
  };
  const worker = new Worker(bundle.mainWorker);
  worker.addEventListener("error", (e) => console.error("[duckdb] erro no worker", e.message));
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const con = await db.connect();
  const base = new URL("data/", document.baseURI).href;
  for (const t of TABELAS) {
    await db.registerFileURL(`${t}.parquet`, `${base}${t}.parquet`, duckdb.DuckDBDataProtocol.HTTP, false);
    await con.query(`CREATE OR REPLACE VIEW ${t} AS SELECT * FROM read_parquet('${t}.parquet')`);
  }
  // arquivo geográfico usado nas junções de coordenadas
  await db.registerFileURL("geo/centroides.parquet", `${base}geo/centroides.parquet`,
                           duckdb.DuckDBDataProtocol.HTTP, false);
  return con;
}

export function conectar(): Promise<duckdb.AsyncDuckDBConnection> {
  conexao ??= iniciar();
  return conexao;
}

/** Executa SQL e devolve as linhas como objetos. */
export async function consultar<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const con = await conectar();
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

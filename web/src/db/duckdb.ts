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
import { useEffect, useState } from "react";
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

/** Arquivos geográficos (fora das views acima -- lidos por caminho, via read_parquet). */
const ARQUIVOS_GEO = [
  "geo/centroides.parquet", "geo/centroides_rgi.parquet", "geo/centroides_rgint.parquet",
  "geo/centroides_uf.parquet",
] as const;

// ============ F6: progresso da carga a frio (worker + wasm + registro das tabelas) ============
// A primeira pintura do mapa usa só municipios_mapa.json (~1s); tudo que depende do DuckDB
// (arcos, painéis) só fica pronto depois de baixar o motor (~1-2 MB de wasm) e registrar as
// views -- historicamente 5-6s sem nenhum sinal visual. Este pequeno emissor deixa a interface
// (componente EstadoDados) mostrar em que etapa a carga está.
export type EstagioCarga = "baixando" | "iniciando" | "registrando" | "pronto" | "erro";
export interface ProgressoDuckDB { estagio: EstagioCarga; mensagem: string; erro?: string }

type Ouvinte = (p: ProgressoDuckDB) => void;
const ouvintes = new Set<Ouvinte>();
let ultimoProgresso: ProgressoDuckDB = { estagio: "baixando", mensagem: "baixando o motor…" };

function emitir(p: ProgressoDuckDB) {
  ultimoProgresso = p;
  for (const o of ouvintes) o(p);
}

/** Estado mais recente, para quem se inscreve depois do início da carga. */
export const progressoAtual = (): ProgressoDuckDB => ultimoProgresso;

/** Inscreve-se nas mudanças de estágio; chama `fn` já com o estado atual. Devolve o cancelamento. */
export function ouvirProgresso(fn: Ouvinte): () => void {
  ouvintes.add(fn);
  fn(ultimoProgresso);
  return () => { ouvintes.delete(fn); };
}

/** O worker do DuckDB resolve o .wasm contra a própria base. Servir os dois como
 *  arquivos estáticos em /duckdb (copiados por scripts/copy-duckdb.sh) mantém tudo
 *  same-origin e com URL absoluta, sem depender de como o empacotador trata workers. */
async function iniciar(): Promise<duckdb.AsyncDuckDBConnection> {
  emitir({ estagio: "baixando", mensagem: "baixando o motor de consulta…" });
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

  emitir({ estagio: "iniciando", mensagem: "iniciando o banco…" });
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const con = await db.connect();

  const base = new URL("data/", document.baseURI).href;
  for (const [i, t] of TABELAS.entries()) {
    emitir({ estagio: "registrando", mensagem: `registrando tabelas ${i + 1}/${TABELAS.length}` });
    await db.registerFileURL(`${t}.parquet`, `${base}${t}.parquet`, duckdb.DuckDBDataProtocol.HTTP, false);
    await con.query(`CREATE OR REPLACE VIEW ${t} AS SELECT * FROM read_parquet('${t}.parquet')`);
  }
  // arquivos geográficos usados nas junções de coordenadas (por caminho, sem view)
  for (const arq of ARQUIVOS_GEO) {
    await db.registerFileURL(arq, `${base}${arq}`, duckdb.DuckDBDataProtocol.HTTP, false);
  }
  emitir({ estagio: "pronto", mensagem: "pronto" });
  return con;
}

export function conectar(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!conexao) {
    conexao = iniciar().catch((e: unknown) => {
      // permite tentar de novo: a próxima chamada a conectar() reinicia a carga
      conexao = null;
      emitir({ estagio: "erro", mensagem: "falha ao preparar os dados", erro: (e as Error).message });
      throw e;
    });
  }
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

/** true enquanto o motor não estiver pronto -- painéis usam para trocar "carregando
 *  fluxos…" por "preparando os dados…" durante a carga a frio. */
export function usarDuckDBPronto(): boolean {
  const [pronto, setPronto] = useState(ultimoProgresso.estagio === "pronto");
  useEffect(() => ouvirProgresso((p) => setPronto(p.estagio === "pronto")), []);
  return pronto;
}

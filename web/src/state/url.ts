/** Codec puro da URL do estado da aplicação (F13.2). Extraído de `store.ts` para ser testável
 *  em vitest `node`, sem `location`/`history`/`localStorage`/`window` -- ver plano F13, decisão 6.
 *
 *  `store.ts` continua sendo a fonte de verdade do estado em runtime; este módulo só
 *  serializa/desserializa. `daUrl`/`paraUrl` em `store.ts` chamam `lerUrl`/`montarQuery` e
 *  cuidam do `location`/`history` (efeito colateral que não cabe aqui).
 */
import type { AbaRM, Nivel } from "./store";
import type { Metrica } from "../lib/types";
import { DIMENSOES } from "../lib/paletas";
import { CENSOS, CENSO_PADRAO, edicao, type Censo } from "../lib/edicoes";
import {
  EDICOES_SERIE, MIN_EDICOES_SERIE, NIVEIS_SERIE, ordenarEdicoes,
  type EdicaoSerie, type NivelSerie,
} from "../lib/serie";

/** F13: modo binário -- ver plano F13, decisão arquitetural 1 (por que não um terceiro valor
 *  "rm": o modo RM continua sendo `rm != null` + `pedindoRM` local de App.tsx). */
export type Modo = "mapa" | "censos";

/** Território selecionado no modo "Ao longo dos censos": qualquer um dos 5 níveis de
 *  `NIVEIS_SERIE` (inclui "rm", que não é `Nivel` do mapa), independente de
 *  `nivel`/`municipio`/`selecao`/`rm` do mapa. */
export interface UnidadeSerieSel { nivel: NivelSerie; codigo: string }

const NIVEIS: Nivel[] = ["mun", "rgi", "rgint", "uf"];

// o recorte vira nome de coluna no SQL: só aceita pares dimensão__categoria conhecidos (a
// validação por edição -- ex.: "status__primeira_saida" não existe em 2010 -- fica a cargo de
// quem monta as opções do seletor (Filtro.tsx), não daqui; aqui só garante que é um par
// dimensão__categoria conhecido em ALGUMA edição, evitando SQL arbitrário vindo da URL)
const RECORTES = new Set(Object.entries(DIMENSOES).flatMap(([dim, d]) =>
  d.categorias.map((c) => `${dim}__${c.chave}`)));

const RE_CODIGO_SERIE = /^[0-9A-Z]{1,12}$/;

/** Todos os campos que `montarQuery` serializa e `lerUrl` desserializa. */
export interface EstadoUrl {
  censo: Censo;
  municipio: string | null;
  selecao: string | null;
  nivel: Nivel;
  origem: string | null;
  destino: string | null;
  metrica: Metrica;
  filtro: string | null;
  topN: number;
  rm: string | null;
  aba: AbaRM;
  cruzar: boolean;
  mostrarFluxos: boolean;
  mostrarSatelite: boolean;
  limiarFluxo: number;
  modo: Modo;
  unidadeSerie: UnidadeSerieSel | null;
  edicoesSerie: EdicaoSerie[];
}

/** "rgi:230010" -> {nivel:"rgi",codigo:"230010"}; null se o nível não é um dos 5 de
 *  `NIVEIS_SERIE` ou o código não casa `/^[0-9A-Z]{1,12}$/` (guarda contra SQL arbitrário
 *  vindo da URL, mesmo padrão de `RECORTES` acima). */
export function lerUnidadeSerie(s: string | null): UnidadeSerieSel | null {
  if (!s) return null;
  const i = s.indexOf(":");
  if (i < 0) return null;
  const nivel = s.slice(0, i);
  const codigo = s.slice(i + 1);
  if (!(NIVEIS_SERIE as readonly string[]).includes(nivel)) return null;
  if (!RE_CODIGO_SERIE.test(codigo)) return null;
  return { nivel: nivel as NivelSerie, codigo };
}

/** "2022,1980,1980,xx" -> ["1980","2022"] (cronológico, sem duplicatas, descarta valores que
 *  não são `EdicaoSerie`); menos de 2 válidas -> todas as 5 (mesma guarda de
 *  `MIN_EDICOES_SERIE`/`ordenarEdicoes`, ver lib/serie.ts). */
export function lerEdicoesSerie(s: string | null): EdicaoSerie[] {
  if (!s) return [...EDICOES_SERIE];
  const ordenadas = ordenarEdicoes(s.split(","));
  return ordenadas.length >= MIN_EDICOES_SERIE ? ordenadas : [...EDICOES_SERIE];
}

/** Lê o estado inteiro a partir da query string. Corpo idêntico ao antigo `daUrl()` de
 *  `store.ts`, mais `modo`/`unidadeSerie`/`edicoesSerie` (F13) e MENOS `serieExpandida`
 *  (removido -- `?serie=1` é ignorado). */
export function lerUrl(p: URLSearchParams): EstadoUrl {
  const m = p.get("m") as Metrica | null;
  const aba = p.get("aba") as AbaRM | null;
  const n = p.get("n") as Nivel | null;
  const censoUrl = p.get("censo") as Censo | null;
  const censo = (censoUrl && CENSOS.includes(censoUrl) ? censoUrl : CENSO_PADRAO) as Censo;
  const modoUrl = p.get("modo");
  return {
    censo,
    municipio: p.get("mun"),
    selecao: p.get("sel"),
    nivel: (n && NIVEIS.includes(n) ? n : "mun") as Nivel,
    origem: p.get("o"),
    destino: p.get("d"),
    // como ?rm=/?aba= abaixo: ignora ?f=renda__* vindo de um link para uma edição sem essa
    // dimensão (hoje só 1980, ver lib/edicoes.ts `recursos.renda`) -- a coluna larga
    // correspondente nem existe no parquet publicado dessa edição.
    filtro: RECORTES.has(p.get("f") ?? "") && (edicao(censo).recursos.renda || !p.get("f")?.startsWith("renda__"))
      ? p.get("f") : null,
    metrica: (m && ["saldo", "tlm", "imig", "emig", "iem"].includes(m) ? m : "tlm") as Metrica,
    topN: Number(p.get("top") ?? 15),
    // módulo metropolitano: ignora ?rm= vindo de um link para uma edição sem esse recurso
    // (ver lib/edicoes.ts) -- nunca chega a chamar as consultas de RM, que dariam erro de
    // "tabela não encontrada" na conexão DuckDB dessa edição (ver db/duckdb.ts).
    rm: edicao(censo).recursos.rm ? p.get("rm") : null,
    // como ?rm=, ignora ?aba=trab|estudo vindo de um link para uma edição sem deslocamento
    // pendular (ver lib/edicoes.ts) -- nunca chega a chamar as consultas pendulares, que
    // dariam erro de "tabela não encontrada" na conexão DuckDB dessa edição (ver db/duckdb.ts).
    aba: (edicao(censo).recursos.pendular && aba && ["mig", "trab", "estudo"].includes(aba)
      ? aba : "mig") as AbaRM,
    cruzar: p.get("cruzar") === "1",
    mostrarFluxos: p.get("fluxos") !== "0",
    mostrarSatelite: p.get("sat") === "1",
    limiarFluxo: Math.min(1, Math.max(0, Number(p.get("fmin") ?? 0) || 0)),
    modo: modoUrl === "censos" ? "censos" : "mapa",
    unidadeSerie: lerUnidadeSerie(p.get("u")),
    edicoesSerie: lerEdicoesSerie(p.get("ed")),
  };
}

/** Monta a query string a partir do estado inteiro. Corpo idêntico ao antigo `paraUrl()` de
 *  `store.ts` SEM o `replaceState` (devolve a string; quem chama decide o que fazer com ela) e
 *  SEM `serieExpandida`/`?serie=`. `modo=censos`/`u=`/`ed=` só existem dentro de
 *  `if (modo === "censos")`, no mesmo padrão de `aba`/`cruzar` dentro de `if (rm)` -- os
 *  parâmetros do mapa continuam sendo escritos em qualquer modo, para o mapa voltar como
 *  estava ao sair do modo censos. */
export function montarQuery(e: EstadoUrl): string {
  const p = new URLSearchParams();
  if (e.censo !== CENSO_PADRAO) p.set("censo", e.censo);
  if (e.rm) {
    p.set("rm", e.rm);
    if (e.aba !== "mig") p.set("aba", e.aba);
    if (e.cruzar) p.set("cruzar", "1");
  }
  if (e.nivel !== "mun") p.set("n", e.nivel);
  if (e.municipio) p.set("mun", e.municipio);
  if (e.selecao) p.set("sel", e.selecao);
  if (e.origem && e.destino) { p.set("o", e.origem); p.set("d", e.destino); }
  if (e.metrica !== "tlm") p.set("m", e.metrica);
  if (e.topN !== 15) p.set("top", String(e.topN));
  if (e.filtro) p.set("f", e.filtro);
  if (!e.mostrarFluxos) p.set("fluxos", "0");
  if (e.mostrarSatelite) p.set("sat", "1");
  if (e.limiarFluxo > 0) p.set("fmin", e.limiarFluxo.toFixed(2));
  if (e.modo === "censos") {
    p.set("modo", "censos");
    if (e.unidadeSerie) p.set("u", `${e.unidadeSerie.nivel}:${e.unidadeSerie.codigo}`);
    if (e.edicoesSerie.length < EDICOES_SERIE.length) p.set("ed", e.edicoesSerie.join(","));
  }
  return p.toString();
}

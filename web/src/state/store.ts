/** Estado da aplicação, espelhado na URL para permitir compartilhar uma vista. */
import { create } from "zustand";
import type { Metrica } from "../lib/types";
import { DIMENSOES } from "../lib/paletas";
import { CENSOS, CENSO_PADRAO, edicao, type Censo } from "../lib/edicoes";

export type AbaRM = "mig" | "trab" | "estudo";
/** F6: nível de agregação do mapa/painéis. "mun" (ausente na URL) é o padrão. */
export type Nivel = "mun" | "rgi" | "rgint" | "uf";
const NIVEIS: Nivel[] = ["mun", "rgi", "rgint", "uf"];
// o recorte vira nome de coluna no SQL: só aceita pares dimensão__categoria conhecidos (a
// validação por edição -- ex.: "status__primeira_saida" não existe em 2010 -- fica a cargo de
// quem monta as opções do seletor (Filtro.tsx), não daqui; aqui só garante que é um par
// dimensão__categoria conhecido em ALGUMA edição, evitando SQL arbitrário vindo da URL)
const RECORTES = new Set(Object.entries(DIMENSOES).flatMap(([dim, d]) =>
  d.categorias.map((c) => `${dim}__${c.chave}`)));

interface Estado {
  /** edição do Censo ativa; trocar reseta toda seleção (ver setCenso) -- os dados das duas
   *  edições nunca se cruzam (cada uma tem sua própria conexão DuckDB, ver db/duckdb.ts). */
  censo: Censo;
  municipio: string | null;      // município selecionado (nivel "mun")
  /** unidade selecionada nos níveis agregados (rgi/rgint/uf); município usa `municipio`, não este campo */
  selecao: string | null;
  nivel: Nivel;
  origem: string | null;         // fluxo selecionado (origem)
  destino: string | null;        // fluxo selecionado (destino)
  metrica: Metrica;
  /** filtro por característica: recorta mapa, arcos e tabelas a um subgrupo de migrantes.
   *  Só se aplica no nível município -- setNivel o limpa ao sair desse nível. */
  filtro: string | null;         // ex.: "edu__superior_completo"
  topN: number;                  // arcos exibidos por município/unidade
  tema: "claro" | "escuro" | "sistema";
  /** módulo metropolitano: RM ativa (cd_rm), aba do painel e se inclui fluxos transfronteiriços.
   *  Só existe no nível município. */
  rm: string | null;
  aba: AbaRM;
  cruzar: boolean;
  /** troca de edição do Censo; reseta toda seleção (município/unidade/fluxo/RM/recorte/nível) */
  setCenso: (censo: Censo) => void;
  selecionarMunicipio: (cd: string | null) => void;
  selecionarUnidade: (cd: string | null) => void;
  selecionarFluxo: (o: string | null, d: string | null) => void;
  /** true quando a troca limpou um recorte ativo (o chamador decide como avisar). */
  setNivel: (n: Nivel) => boolean;
  setMetrica: (m: Metrica) => void;
  setFiltro: (f: string | null) => void;
  setTopN: (n: number) => void;
  setTema: (t: "claro" | "escuro" | "sistema") => void;
  entrarModoRM: (cd_rm: string) => void;
  sairModoRM: () => void;
  setAba: (aba: AbaRM) => void;
  setCruzar: (v: boolean) => void;
  /** F6 leva 2: aplica várias peças de estado de uma vez (ex.: o link de um "achado-chave"
   *  da capa nacional, que precisa entrar em modo RM, trocar de aba E selecionar um fluxo
   *  na mesma navegação -- as ações individuais acima limpam campos umas das outras). */
  irPara: (patch: Partial<Pick<Estado,
    "municipio" | "selecao" | "nivel" | "origem" | "destino" | "rm" | "aba" | "cruzar">>) => void;
}

function daUrl() {
  const p = new URLSearchParams(location.search);
  const m = p.get("m") as Metrica | null;
  const aba = p.get("aba") as AbaRM | null;
  const n = p.get("n") as Nivel | null;
  const censoUrl = p.get("censo") as Censo | null;
  const censo = (censoUrl && CENSOS.includes(censoUrl) ? censoUrl : CENSO_PADRAO) as Censo;
  return {
    censo,
    municipio: p.get("mun"),
    selecao: p.get("sel"),
    nivel: (n && NIVEIS.includes(n) ? n : "mun") as Nivel,
    origem: p.get("o"),
    destino: p.get("d"),
    filtro: RECORTES.has(p.get("f") ?? "") ? p.get("f") : null,
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
  };
}

function paraUrl(e: Pick<Estado, "municipio" | "selecao" | "nivel" | "origem" | "destino" | "metrica" | "topN"
                              | "filtro" | "rm" | "aba" | "cruzar" | "censo">) {
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
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

const inicial = daUrl();

export const useStore = create<Estado>((set, get) => ({
  ...inicial,
  tema: (localStorage.getItem("tema") as Estado["tema"]) ?? "sistema",

  setCenso: (censo) => {
    const patch = {
      censo, nivel: "mun" as Nivel, municipio: null, selecao: null, origem: null,
      destino: null, rm: null, filtro: null, aba: "mig" as AbaRM,
    };
    set(patch);
    paraUrl({ ...get(), ...patch });
  },
  selecionarMunicipio: (cd) => {
    set({ municipio: cd, selecao: null, origem: null, destino: null });
    paraUrl({ ...get(), municipio: cd, selecao: null, origem: null, destino: null });
  },
  selecionarUnidade: (cd) => {
    set({ selecao: cd, municipio: null, origem: null, destino: null });
    paraUrl({ ...get(), selecao: cd, municipio: null, origem: null, destino: null });
  },
  selecionarFluxo: (o, d) => {
    set({ origem: o, destino: d });
    paraUrl({ ...get(), origem: o, destino: d });
  },
  setNivel: (nivel) => {
    const recorteLimpo = nivel !== "mun" && Boolean(get().filtro);
    const patch = {
      nivel, municipio: null, selecao: null, origem: null, destino: null,
      filtro: recorteLimpo ? null : get().filtro,
      rm: nivel !== "mun" ? null : get().rm,
    };
    set(patch);
    paraUrl({ ...get(), ...patch });
    return recorteLimpo;
  },
  setMetrica: (metrica) => { set({ metrica }); paraUrl({ ...get(), metrica }); },
  setFiltro: (filtro) => { set({ filtro }); paraUrl({ ...get(), filtro }); },
  setTopN: (topN) => { set({ topN }); paraUrl({ ...get(), topN }); },
  setTema: (tema) => {
    set({ tema });
    localStorage.setItem("tema", tema);
    const raiz = document.documentElement;
    if (tema === "sistema") raiz.removeAttribute("data-theme");
    else raiz.setAttribute("data-theme", tema === "escuro" ? "dark" : "light");
  },
  entrarModoRM: (cd_rm) => {
    set({ rm: cd_rm, aba: "mig", municipio: null, selecao: null, origem: null, destino: null });
    paraUrl({ ...get(), rm: cd_rm, aba: "mig", municipio: null, selecao: null, origem: null, destino: null });
  },
  sairModoRM: () => {
    set({ rm: null, municipio: null, origem: null, destino: null });
    paraUrl({ ...get(), rm: null, municipio: null, origem: null, destino: null });
  },
  setAba: (aba) => { set({ aba, origem: null, destino: null });
                     paraUrl({ ...get(), aba, origem: null, destino: null }); },
  setCruzar: (cruzar) => { set({ cruzar }); paraUrl({ ...get(), cruzar }); },
  irPara: (patch) => { set(patch); paraUrl({ ...get(), ...patch }); },
}));

/** true quando a interface está renderizando em modo escuro. */
export function usarModoEscuro(): boolean {
  const tema = useStore((s) => s.tema);
  if (tema === "escuro") return true;
  if (tema === "claro") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

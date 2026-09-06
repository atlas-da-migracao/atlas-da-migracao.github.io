/** Estado da aplicação, espelhado na URL para permitir compartilhar uma vista. */
import { create } from "zustand";
import type { Metrica } from "../lib/types";

export type AbaRM = "mig" | "trab" | "estudo";

interface Estado {
  municipio: string | null;      // município selecionado
  origem: string | null;         // fluxo selecionado (origem)
  destino: string | null;        // fluxo selecionado (destino)
  metrica: Metrica;
  /** filtro por característica: recorta mapa, arcos e tabelas a um subgrupo de migrantes */
  filtro: string | null;         // ex.: "edu__superior_completo"
  topN: number;                  // arcos exibidos por município
  tema: "claro" | "escuro" | "sistema";
  /** módulo metropolitano: RM ativa (cd_rm), aba do painel e se inclui fluxos transfronteiriços */
  rm: string | null;
  aba: AbaRM;
  cruzar: boolean;
  selecionarMunicipio: (cd: string | null) => void;
  selecionarFluxo: (o: string | null, d: string | null) => void;
  setMetrica: (m: Metrica) => void;
  setFiltro: (f: string | null) => void;
  setTopN: (n: number) => void;
  setTema: (t: "claro" | "escuro" | "sistema") => void;
  entrarModoRM: (cd_rm: string) => void;
  sairModoRM: () => void;
  setAba: (aba: AbaRM) => void;
  setCruzar: (v: boolean) => void;
}

function daUrl() {
  const p = new URLSearchParams(location.search);
  const m = p.get("m") as Metrica | null;
  const aba = p.get("aba") as AbaRM | null;
  return {
    municipio: p.get("mun"),
    origem: p.get("o"),
    destino: p.get("d"),
    filtro: p.get("f"),
    metrica: (m && ["saldo", "tlm", "imig", "emig", "iem"].includes(m) ? m : "tlm") as Metrica,
    topN: Number(p.get("top") ?? 15),
    rm: p.get("rm"),
    aba: (aba && ["mig", "trab", "estudo"].includes(aba) ? aba : "mig") as AbaRM,
    cruzar: p.get("cruzar") === "1",
  };
}

function paraUrl(e: Pick<Estado, "municipio" | "origem" | "destino" | "metrica" | "topN" | "filtro"
                              | "rm" | "aba" | "cruzar">) {
  const p = new URLSearchParams();
  if (e.rm) {
    p.set("rm", e.rm);
    if (e.aba !== "mig") p.set("aba", e.aba);
    if (e.cruzar) p.set("cruzar", "1");
  }
  if (e.municipio) p.set("mun", e.municipio);
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

  selecionarMunicipio: (cd) => {
    set({ municipio: cd, origem: null, destino: null });
    paraUrl({ ...get(), municipio: cd, origem: null, destino: null });
  },
  selecionarFluxo: (o, d) => {
    set({ origem: o, destino: d });
    paraUrl({ ...get(), origem: o, destino: d });
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
    set({ rm: cd_rm, aba: "mig", municipio: null, origem: null, destino: null });
    paraUrl({ ...get(), rm: cd_rm, aba: "mig", municipio: null, origem: null, destino: null });
  },
  sairModoRM: () => {
    set({ rm: null, municipio: null, origem: null, destino: null });
    paraUrl({ ...get(), rm: null, municipio: null, origem: null, destino: null });
  },
  setAba: (aba) => { set({ aba, origem: null, destino: null });
                     paraUrl({ ...get(), aba, origem: null, destino: null }); },
  setCruzar: (cruzar) => { set({ cruzar }); paraUrl({ ...get(), cruzar }); },
}));

/** true quando a interface está renderizando em modo escuro. */
export function usarModoEscuro(): boolean {
  const tema = useStore((s) => s.tema);
  if (tema === "escuro") return true;
  if (tema === "claro") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

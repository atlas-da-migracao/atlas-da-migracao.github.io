/** Estado da aplicação, espelhado na URL para permitir compartilhar uma vista. */
import { create } from "zustand";
import type { Metrica } from "../lib/types";
import { edicao, type Censo } from "../lib/edicoes";
import { MIN_EDICOES_SERIE, ordenarEdicoes, type EdicaoSerie } from "../lib/serie";
import { lerUrl, montarQuery, type EstadoUrl, type Modo, type UnidadeSerieSel } from "./url";

export type { Modo, UnidadeSerieSel };
export type AbaRM = "mig" | "trab" | "estudo";
/** F6: nível de agregação do mapa/painéis. "mun" (ausente na URL) é o padrão. */
export type Nivel = "mun" | "rgi" | "rgint" | "uf";

interface Estado {
  /** edição do Censo ativa; trocar PRESERVA o recorte territorial selecionado e limpa só o
   *  fluxo e o recorte por característica (ver setCenso) -- os dados das edições nunca se
   *  cruzam (cada uma tem sua própria conexão DuckDB, ver db/duckdb.ts). */
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
  /** F3 (mapa-representação): liga/desliga a camada de arcos O/D no mapa -- migração e
   *  pendular. Default true (não aparece na URL); `?fluxos=0` desliga. Não afeta as consultas
   *  (o painel lateral continua listando os fluxos normalmente), só a camada `ArcLayer`. */
  mostrarFluxos: boolean;
  /** F. mapa base de satélite: liga/desliga a camada raster de contexto (Blue Marble/NASA,
   *  pré-reprojetada em Albers, ver web/public/satelite/). Default false (não aparece na
   *  URL); `?sat=1` liga. Independente de edição/nível -- a mesma imagem cobre o Brasil
   *  inteiro em qualquer censo. */
  mostrarSatelite: boolean;
  /** Filtro de tamanho dos fluxos no mapa: fração (0-1) da FAIXA de volumes dos fluxos
   *  carregados na vista atual, abaixo da qual o fluxo não é desenhado. 0 (o padrão, ausente
   *  da URL) mostra todos; 1 deixa só o maior.
   *
   *  É fração da faixa, e não um número de pessoas, porque a mesma escala absoluta não serve
   *  às duas pontas do atlas: no mapa nacional os fluxos vão de ~4 mil a ~23 mil pessoas, e
   *  num município pequeno vão de poucas dezenas a algumas centenas. Guardado em absoluto, um
   *  corte escolhido no mapa nacional apagaria TODOS os fluxos ao entrar num município. A
   *  fração acompanha a vista; o controle mostra ao usuário o valor absoluto correspondente
   *  (ver `.filtro-fluxo` em App.tsx). Como o toggle de fluxos, não afeta as consultas nem o
   *  painel lateral -- só o que o mapa desenha. */
  limiarFluxo: number;
  /** F13: modo ativo da aplicação -- ver `state/url.ts` para por que é BINÁRIO
   *  ("mapa"|"censos") e não um enum de três valores ("brasil"|"rm"|"censos"): o modo RM
   *  continua sendo `rm != null` + `pedindoRM` (estado local de App.tsx), não um valor de
   *  `modo`. Um terceiro valor "rm" criaria estado inválido (`modo === "rm"` sem RM
   *  escolhida, ou `rm` preenchido com `modo !== "rm"`) -- duas fontes de verdade para a
   *  mesma coisa. `nivelEfetivo`, `setCenso`, `setNivel` e o cabeçalho continuam derivando só
   *  de `rm`/`pedindoRM`; `modo` só decide se a tela mostra o mapa ou a aba "Ao longo dos
   *  censos". */
  modo: Modo;
  /** F13: território escolhido na aba "Ao longo dos censos", independente de
   *  `nivel`/`municipio`/`selecao`/`rm` do mapa -- aceita `nivel: "rm"`, que não é um `Nivel`
   *  do mapa (o mapa nunca seleciona uma RM como unidade própria, só entra no módulo
   *  metropolitano). Trocar de modo não mexe aqui nem lá: voltar a "Brasil" preserva a
   *  seleção do mapa, e voltar a "Ao longo dos censos" preserva a unidade da série. */
  unidadeSerie: UnidadeSerieSel | null;
  /** F13: subconjunto de censos marcado na aba "Ao longo dos censos" -- sempre cronológico
   *  (`EDICOES_SERIE`), 2 a 5 edições, padrão as 5. Independente da edição ativa do mapa
   *  (`censo`): a série nunca muda com ela (docs/design_serie_censos.md, 1.1). */
  edicoesSerie: EdicaoSerie[];
  /** troca de edição do Censo; mantém nível, município, unidade, RM e aba, e limpa o fluxo
   *  selecionado e o recorte por característica (ver a implementação para o porquê) */
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
  setMostrarFluxos: (v: boolean) => void;
  setMostrarSatelite: (v: boolean) => void;
  setLimiarFluxo: (v: number) => void;
  setModo: (m: Modo) => void;
  /** F13: entra no modo "Ao longo dos censos". NÃO limpa `rm`/`municipio`/`selecao`/`nivel`
   *  do mapa -- ao voltar para "Brasil" o mapa continua exatamente como estava (ver
   *  `modo` acima). `edicoes` ausente MANTÉM o subconjunto já marcado (ex.: reabrir a aba
   *  depois de já ter desmarcado 1980); passe `EDICOES_SERIE` explicitamente para as 5
   *  (é o que o atalho "Ver a série completa" dos painéis faz). */
  entrarModoCensos: (unidade: UnidadeSerieSel | null, edicoes?: readonly EdicaoSerie[]) => void;
  setUnidadeSerie: (u: UnidadeSerieSel | null) => void;
  /** Ordena cronologicamente e remove duplicatas; IGNORA (não altera o estado) se o
   *  resultado tiver menos de `MIN_EDICOES_SERIE` -- a seção nunca fica com uma comparação
   *  impossível (mesma invariante de `alternarEdicao`, lib/serie.ts). */
  setEdicoesSerie: (eds: readonly EdicaoSerie[]) => void;
  /** F6 leva 2: aplica várias peças de estado de uma vez (ex.: o link de um "achado-chave"
   *  da capa nacional, que precisa entrar em modo RM, trocar de aba E selecionar um fluxo
   *  na mesma navegação -- as ações individuais acima limpam campos umas das outras). */
  irPara: (patch: Partial<Pick<Estado,
    "municipio" | "selecao" | "nivel" | "origem" | "destino" | "rm" | "aba" | "cruzar"
    | "modo" | "unidadeSerie" | "edicoesSerie">>) => void;
}

function daUrl(): EstadoUrl {
  return lerUrl(new URLSearchParams(location.search));
}

function paraUrl(e: EstadoUrl) {
  const qs = montarQuery(e);
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

const inicial = daUrl();

export const useStore = create<Estado>((set, get) => ({
  ...inicial,
  tema: (localStorage.getItem("tema") as Estado["tema"]) ?? "sistema",

  // Trocar de edição PRESERVA o recorte territorial em foco -- nível, município, unidade
  // agregada (RGI/RGInt/UF), RM e aba do módulo metropolitano --, porque comparar o MESMO
  // lugar entre censos é o uso principal do atlas: antes, trocar de ano jogava o usuário de
  // volta para o Brasil inteiro e ele tinha de refazer a navegação a cada edição.
  //
  // Manter o código é seguro mesmo quando ele não existe na edição de destino (os recortes
  // territoriais mudam entre censos: 1980 tem 3.940 municípios contra 5.570 em 2022, o
  // Tocantins não existia, e a lista de RMs é retroativa por edição). Esse caso já tinha
  // tratamento próprio e continua valendo: `municipioNaoEncontrado`/`unidadeNaoEncontrada`
  // em App.tsx alimentam a prop `naoEncontrado` dos painéis, e `PainelRM.tsx` tem o guard
  // equivalente -- o painel diz que aquela unidade não existe naquele ano em vez de ficar
  // vazio ou quebrar.
  //
  // Duas coisas continuam sendo limpas, por não serem o "lugar" selecionado:
  // - o FLUXO (origem/destino): um par origem-destino é uma seleção de outra natureza, e um
  //   par que existe num censo frequentemente não tem publicação no outro (o corte de
  //   revelação e o próprio volume mudam);
  // - o RECORTE por característica (`filtro`): as características disponíveis variam por
  //   edição (1980 não tem renda, por exemplo, ver `recursos` em lib/edicoes.ts), então
  //   carregá-lo adiante arriscaria um recorte inexistente na edição nova.
  setCenso: (censo) => {
    // As mesmas travas por RECURSO que `daUrl` aplica a um link colado: uma edição sem módulo
    // metropolitano (`recursos.rm`) ou sem deslocamento pendular (`recursos.pendular`, que
    // 1991 não tem) não tem as tabelas correspondentes na sua conexão DuckDB -- carregar a RM
    // ou a aba pendular adiante daria erro de "tabela não encontrada", não um painel vazio.
    // Só nesses casos a preservação cede; o município/unidade/nível seguem intactos.
    const recursos = edicao(censo).recursos;
    const atual = get();
    const patch = {
      censo, origem: null, destino: null, filtro: null,
      rm: recursos.rm ? atual.rm : null,
      aba: (recursos.pendular ? atual.aba : "mig") as AbaRM,
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
  setMostrarFluxos: (mostrarFluxos) => { set({ mostrarFluxos }); paraUrl({ ...get(), mostrarFluxos }); },
  setMostrarSatelite: (mostrarSatelite) => { set({ mostrarSatelite }); paraUrl({ ...get(), mostrarSatelite }); },
  setLimiarFluxo: (v) => {
    const limiarFluxo = Math.min(1, Math.max(0, v));
    set({ limiarFluxo });
    paraUrl({ ...get(), limiarFluxo });
  },
  irPara: (patch) => { set(patch); paraUrl({ ...get(), ...patch }); },
  setModo: (modo) => { set({ modo }); paraUrl({ ...get(), modo }); },
  entrarModoCensos: (unidade, edicoes) => {
    const patch = {
      modo: "censos" as Modo,
      unidadeSerie: unidade,
      edicoesSerie: edicoes ? ordenarEdicoes(edicoes) : get().edicoesSerie,
    };
    set(patch);
    paraUrl({ ...get(), ...patch });
  },
  setUnidadeSerie: (u) => { set({ unidadeSerie: u }); paraUrl({ ...get(), unidadeSerie: u }); },
  setEdicoesSerie: (eds) => {
    const edicoesSerie = ordenarEdicoes(eds);
    if (edicoesSerie.length < MIN_EDICOES_SERIE) return;
    set({ edicoesSerie });
    paraUrl({ ...get(), edicoesSerie });
  },
}));

/** true quando a interface está renderizando em modo escuro. */
export function usarModoEscuro(): boolean {
  const tema = useStore((s) => s.tema);
  if (tema === "escuro") return true;
  if (tema === "claro") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

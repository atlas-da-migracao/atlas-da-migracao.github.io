import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import type { Topology } from "topojson-specification";
import { MapaAtlas, type ValorMapa } from "./map/MapaAtlas";
import { PainelMunicipio } from "./components/PainelMunicipio";
import { PainelFluxo } from "./components/PainelFluxo";
import { CapaNacional } from "./components/CapaNacional";
import { Legenda } from "./components/Legenda";
import { EstadoDados } from "./components/EstadoDados";
import { tourJaVisto } from "./lib/tour";
import { Busca, type ItemBusca } from "./components/Busca";
import { Filtro } from "./components/Filtro";
import { SeletorRM } from "./components/SeletorRM";
import { carregarMunicipios, carregarUnidades, centroidesDaRM, centroidesDeMunicipios,
         centroidesDeUnidades, fluxosDaUnidade, fluxosDoMunicipio, fluxosEntreUFs, fluxosIntraDaRM,
         fluxosPorCategoria, listarRMs, maioresFluxos, maioresFluxosNivel, municipiosDaRM,
         pendularDaRM, saldoPorCategoria,
         type NivelAgregado, type ResumoRM, type UnidadeAgregada } from "./db/queries";
import { quebrasSimetricas } from "./lib/escalas";
import { bboxDeCentroides, bboxDeGeometria, prioridadeFoco, type Bbox } from "./lib/rm";
import type { FluxoUF } from "./lib/acordes";
import { hexParaRgb, TIPOLOGIA_INTRA_RM } from "./lib/paletas";
import { useStore, usarModoEscuro, type Nivel } from "./state/store";
import type { Fluxo, Meta, Metrica, Municipio } from "./lib/types";

// F6 leva 2: módulos fora do caminho crítico da primeira pintura viram chunks separados --
// o tour, a página de metodologia e o módulo metropolitano (que arrasta d3-sankey) só são
// baixados quando o usuário realmente os abre. Ver docs/qa/F6_leva2_relatorio.md para o
// tamanho do bundle antes/depois.
const Tour = lazy(() => import("./components/Tour").then((m) => ({ default: m.Tour })));
const PaginaMetodologia = lazy(() => import("./components/PaginaMetodologia").then((m) => ({ default: m.PaginaMetodologia })));
const PainelRM = lazy(() => import("./components/PainelRM").then((m) => ({ default: m.PainelRM })));
const PainelPendular = lazy(() => import("./components/PainelPendular").then((m) => ({ default: m.PainelPendular })));
// PainelUnidade carrega d3-chord/d3-shape (matriz de acordes UF x UF) -- só usado fora do
// nível "município" (não é o padrão), então também sai do caminho crítico da 1a pintura.
const PainelUnidade = lazy(() => import("./components/PainelUnidade").then((m) => ({ default: m.PainelUnidade })));
const PainelFluxoUnidade = lazy(() => import("./components/PainelFluxoUnidade").then((m) => ({ default: m.PainelFluxoUnidade })));

const CAMPO_ID: Record<Nivel, string> = { mun: "CD_MUN", rgi: "cd_rgi", rgint: "cd_rgint", uf: "cd_uf" };
const ROTULO_NIVEL: Record<Nivel, string> = {
  mun: "Município", rgi: "Reg. imediata", rgint: "Reg. intermediária", uf: "UF",
};
const PLACEHOLDER_BUSCA: Record<Nivel, string> = {
  mun: "Buscar município…", rgi: "Buscar região imediata…", rgint: "Buscar região intermediária…", uf: "Buscar UF…",
};

/** Arquivo enxuto usado só na primeira pintura do mapa. */
interface MunicipiosMapa {
  colunas: string[];
  linhas: [string, string, string, number, number, number, number,
           number | null, number | null, number | null][];
}
import "./styles/tokens.css";
import "./styles/app.css";

const METRICAS: { valor: Metrica; rotulo: string }[] = [
  { valor: "saldo", rotulo: "Saldo" },
  { valor: "tlm", rotulo: "Taxa líquida" },
  { valor: "imig", rotulo: "Imigrantes" },
  { valor: "emig", rotulo: "Emigrantes" },
  { valor: "iem", rotulo: "Eficácia" },
];

const CORES_TIPOLOGIA = new Map<string, [number, number, number]>(
  TIPOLOGIA_INTRA_RM.categorias.map((c) => [c.chave, hexParaRgb(c.cor.claro)]));

export default function App() {
  const [malha, setMalha] = useState<FeatureCollection | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [arcos, setArcos] = useState<(Fluxo & { direcao?: string; cruza?: boolean; corRgb?: [number, number, number] })[]>([]);
  const [carregandoFluxos, setCarregandoFluxos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { municipio, selecao, nivel, origem, destino, metrica, filtro, tema, rm, aba, cruzar, topN,
          selecionarMunicipio, selecionarUnidade, selecionarFluxo, setNivel, setMetrica, setFiltro, setTema,
          entrarModoRM, sairModoRM, setAba, setCruzar } = useStore();
  const [recorte, setRecorte] = useState<Map<string, { imig: number; emig: number; saldo: number }> | null>(null);
  const escuro = usarModoEscuro();

  // F6: níveis de agregação. `rm` sempre implica município (modo RM não existe nos demais
  // níveis); fora do modo RM, o nível efetivo é o escolhido pelo usuário.
  const nivelEfetivo: Nivel = rm ? "mun" : nivel;
  const [malhaNivel, setMalhaNivel] = useState<Partial<Record<NivelAgregado, FeatureCollection>>>({});
  const [unidadesNivel, setUnidadesNivel] = useState<Partial<Record<NivelAgregado, UnidadeAgregada[]>>>({});
  const [avisoNivel, setAvisoNivel] = useState<string | null>(null);

  // F6 leva 2 (10a): fluxos UF x UF para a matriz de acordes, carregados uma vez ao entrar no nível UF
  const [fluxosUF, setFluxosUF] = useState<FluxoUF[] | null>(null);
  useEffect(() => {
    if (nivelEfetivo !== "uf" || fluxosUF) return;
    fluxosEntreUFs().then(setFluxosUF).catch(() => {});
  }, [nivelEfetivo]); // eslint-disable-line react-hooks/exhaustive-deps

  // F6 leva 2: folha de filtros (busca/recorte/métrica) no mobile -- abre como bottom sheet
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  useEffect(() => {
    if (nivelEfetivo === "mun" || malhaNivel[nivelEfetivo]) return;
    const n = nivelEfetivo;
    fetch(`data/geo/${n}.topojson`).then((r) => r.json() as Promise<Topology>).then((topo) => {
      const chave = Object.keys(topo.objects)[0];
      const fc = feature(topo, topo.objects[chave]) as unknown as FeatureCollection;
      setMalhaNivel((m) => ({ ...m, [n]: fc }));
    }).catch((e) => setErro(`Falha ao carregar a malha (${n}): ${(e as Error).message}`));
  }, [nivelEfetivo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (nivelEfetivo === "mun" || unidadesNivel[nivelEfetivo]) return;
    const n = nivelEfetivo;
    carregarUnidades(n).then((u) => setUnidadesNivel((m) => ({ ...m, [n]: u })))
      .catch((e) => setErro(`Falha ao consultar as unidades (${n}): ${(e as Error).message}`));
  }, [nivelEfetivo]); // eslint-disable-line react-hooks/exhaustive-deps

  const aoMudarNivel = (n: Nivel) => {
    const limpou = setNivel(n);
    if (limpou) {
      setAvisoNivel("O recorte por característica só existe no nível município; foi limpo ao trocar de nível.");
      setTimeout(() => setAvisoNivel(null), 6000);
    }
  };

  // lista de RMs para o seletor do cabeçalho, carregada uma vez
  const [rmsCabecalho, setRmsCabecalho] = useState<ResumoRM[]>([]);
  useEffect(() => { listarRMs().then(setRmsCabecalho).catch(() => {}); }, []);
  // segmentado "Regiões metropolitanas" pedido, mas RM ainda não escolhida
  const [pedindoRM, setPedindoRM] = useState(false);

  // F6: tour de boas-vindas -- abre sozinho na primeira visita
  const [mostrarTour, setMostrarTour] = useState(() => !tourJaVisto());

  // F6: página de metodologia, roteada por ?pagina=metodologia (não afeta o resto da URL/estado)
  const [paginaMetodologia, setPaginaMetodologia] = useState(
    () => new URLSearchParams(location.search).get("pagina") === "metodologia",
  );
  const abrirMetodologia = () => {
    setPaginaMetodologia(true);
    const p = new URLSearchParams(location.search);
    p.set("pagina", "metodologia");
    history.pushState(null, "", `?${p.toString()}`);
  };
  const fecharMetodologia = () => {
    setPaginaMetodologia(false);
    const p = new URLSearchParams(location.search);
    p.delete("pagina");
    const qs = p.toString();
    history.pushState(null, "", qs ? `?${qs}` : location.pathname);
  };
  useEffect(() => {
    const aoNavegar = () => setPaginaMetodologia(new URLSearchParams(location.search).get("pagina") === "metodologia");
    window.addEventListener("popstate", aoNavegar);
    return () => window.removeEventListener("popstate", aoNavegar);
  }, []);

  // aplica o tema salvo antes da primeira pintura
  useEffect(() => { setTema(tema); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // F6 leva 2: Esc fecha a folha de filtros do mobile
  useEffect(() => {
    if (!filtrosAbertos) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") setFiltrosAbertos(false); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [filtrosAbertos]);

  // malha e metadados: caminho crítico da primeira pintura
  useEffect(() => {
    (async () => {
      try {
        const [topo, m, mapa] = await Promise.all([
          fetch("data/geo/municipios.topojson").then((r) => r.json() as Promise<Topology>),
          fetch("data/meta.json").then((r) => r.json() as Promise<Meta>),
          fetch("data/municipios_mapa.json").then((r) => r.json() as Promise<MunicipiosMapa>),
        ]);
        const chave = Object.keys(topo.objects)[0];
        setMalha(feature(topo, topo.objects[chave]) as unknown as FeatureCollection);
        setMeta(m);
        // pinta o coroplético imediatamente; o DuckDB completa os campos depois
        setMunicipios(mapa.linhas.map(([cd, nm, uf, pop, imig, emig, saldo, tlm, iem, cv]) => ({
          cd_mun: cd, nm_mun: nm, uf_sigla: uf, uf: cd.slice(0, 2),
          cd_rgi: null, nm_rgi: null, cd_rgint: null, nm_rgint: null, cd_rm: null, nm_rm: null,
          pop, pop5: pop, imig, imig_ni: 0, imig_int: 0, emig, saldo,
          tbi: null, tbe: null, tlm, iem,
          se_imig: 0, se_emig: 0, se_saldo: 0, cv_imig: cv, cv_emig: null,
          n_imig_faixa: "", n_emig_faixa: "", precisao_imig: "sem_estimativa",
        })));
      } catch (e) {
        setErro(`Falha ao carregar a malha: ${(e as Error).message}`);
      }
    })();
  }, []);

  // indicadores municipais e os maiores fluxos do país (DuckDB, em paralelo)
  useEffect(() => {
    (async () => {
      try {
        // só os indicadores: quem decide os arcos é o efeito dedicado abaixo, senão
        // esta resposta sobrescreveria os fluxos do município já selecionado
        setMunicipios(await carregarMunicipios());
      } catch (e) {
        console.error(e);
        setErro(`Falha ao consultar os dados: ${(e as Error).message}`);
      }
    })();
  }, []);

  // malha ativa: municipal por padrão, ou a do nível agregado escolhido
  const malhaAtiva = nivelEfetivo === "mun" ? malha : malhaNivel[nivelEfetivo] ?? null;
  const campoId = CAMPO_ID[nivelEfetivo];

  // ============ F6: enquadramento (zoom) da seleção — bbox por feição da malha ativa,
  // calculada uma única vez ao carregá-la, e bbox de um fluxo (par de centroides) sob demanda. ============
  const bboxPorFeicao = useMemo(() => {
    const m = new Map<string, Bbox>();
    if (!malhaAtiva) return m;
    for (const f of malhaAtiva.features) {
      const cd = (f.properties as Record<string, string> | null)?.[campoId];
      if (!cd || !f.geometry) continue;
      const bb = bboxDeGeometria(f.geometry as { type: string; coordinates: unknown });
      if (bb) m.set(cd, bb);
    }
    return m;
  }, [malhaAtiva, campoId]);

  const codigoSelecionado = nivelEfetivo === "mun" ? municipio : selecao;

  const [fluxoFoco, setFluxoFoco] = useState<Bbox | null>(null);
  useEffect(() => {
    if (!origem || !destino) { setFluxoFoco(null); return; }
    let vivo = true;
    const consulta = nivelEfetivo === "mun"
      ? centroidesDeMunicipios([origem, destino])
      : centroidesDeUnidades(nivelEfetivo as NivelAgregado, [origem, destino]);
    consulta.then((pts) => { if (vivo) setFluxoFoco(bboxDeCentroides(pts, 0.25)); })
      .catch(() => setFluxoFoco(null));
    return () => { vivo = false; };
  }, [origem, destino, nivelEfetivo]);

  const selecaoFoco = codigoSelecionado && !rm ? bboxPorFeicao.get(codigoSelecionado) ?? null : null;

  // ============ Módulo metropolitano: enquadramento do mapa (bbox, destaque, núcleo) ============
  const [rmFoco, setRmFoco] = useState<Bbox | null>(null);
  const [rmDestacar, setRmDestacar] = useState<Set<string> | null>(null);
  const [rmNucleo, setRmNucleo] = useState<string | null>(null);

  useEffect(() => {
    if (!rm) { setRmFoco(null); setRmDestacar(null); setRmNucleo(null); return; }
    let vivo = true;
    Promise.all([municipiosDaRM(rm), centroidesDaRM(rm)]).then(([muns, cent]) => {
      if (!vivo) return;
      setRmDestacar(new Set(muns.map((m) => m.cd_mun)));
      setRmNucleo(muns.find((m) => m.nucleo)?.cd_mun ?? null);
      setRmFoco(bboxDeCentroides(cent));
    }).catch((e) => setErro(`Falha ao carregar a RM: ${(e as Error).message}`));
    return () => { vivo = false; };
  }, [rm]);

  // fluxos exibidos no mapa: nacionais (modo Brasil) ou da RM ativa (modo metropolitano)
  const topNStore = topN;
  useEffect(() => {
    if (rm) {
      setCarregandoFluxos(true);
      const t0 = performance.now();
      const consulta = aba === "mig"
        ? fluxosIntraDaRM(rm).then((f) => f.slice(0, topNStore).map((x) => ({
            ...x, corRgb: CORES_TIPOLOGIA.get(x.tipologia),
          })))
        : pendularDaRM(rm, aba === "trab" ? "pendular_trab" : "pendular_estudo", topNStore, cruzar);
      consulta
        .then(setArcos)
        .catch((e) => setErro(`Falha ao consultar fluxos da RM: ${(e as Error).message}`))
        .finally(() => {
          setCarregandoFluxos(false);
          if (import.meta.env.DEV) {
            console.debug(`[F5b] troca de RM/aba em ${(performance.now() - t0).toFixed(0)} ms`);
          }
        });
      return;
    }
    if (nivelEfetivo !== "mun") {
      const n = nivelEfetivo as NivelAgregado;
      setCarregandoFluxos(true);
      const t0 = performance.now();
      const consulta = selecao ? fluxosDaUnidade(n, selecao, topNStore) : maioresFluxosNivel(n, 300);
      consulta
        .then(setArcos)
        .catch((e) => setErro(`Falha ao consultar fluxos (${n}): ${(e as Error).message}`))
        .finally(() => {
          setCarregandoFluxos(false);
          if (import.meta.env.DEV) {
            console.debug(`[F6] troca de nível (${n}) em ${(performance.now() - t0).toFixed(0)} ms`);
          }
        });
      return;
    }
    if (!municipio) {
      if (municipios.length) maioresFluxos(150).then(setArcos).catch(() => {});
      return;
    }
    setCarregandoFluxos(true);
    const consulta = filtro
      ? fluxosPorCategoria(municipio, filtro, topNStore)
      : fluxosDoMunicipio(municipio, topNStore);
    consulta
      .then(setArcos)
      .catch((e) => setErro(`Falha ao consultar fluxos: ${(e as Error).message}`))
      .finally(() => setCarregandoFluxos(false));
  }, [municipio, selecao, nivelEfetivo, topNStore, filtro, municipios.length, rm, aba, cruzar]);

  // sob recorte, o coroplético passa a mostrar o saldo daquele subgrupo
  useEffect(() => {
    if (!filtro || !municipios.length) { setRecorte(null); return; }
    saldoPorCategoria(filtro)
      .then((linhas) => setRecorte(new Map(
        linhas.map((l) => [l.cd_mun, { imig: l.imig, emig: l.emig, saldo: l.saldo }]))))
      .catch(() => setRecorte(null));
  }, [filtro, municipios.length]);

  // sob recorte, o mapa mostra o saldo do subgrupo em vez da métrica escolhida
  const municipiosVisiveis = useMemo(() => {
    if (!recorte) return municipios;
    // sob recorte, TODOS os indicadores passam a se referir ao subgrupo -- misturar
    // saldo do subgrupo com imigração total daria um painel internamente incoerente
    return municipios.map((m) => {
      const r = recorte.get(m.cd_mun) ?? { imig: 0, emig: 0, saldo: 0 };
      const soma = r.imig + r.emig;
      return {
        ...m, imig: r.imig, emig: r.emig, saldo: r.saldo,
        imig_ni: 0, imig_int: 0,
        tlm: m.pop5 > 0 ? (r.saldo / m.pop5) * 1000 : 0,
        tbi: m.pop5 > 0 ? (r.imig / m.pop5) * 1000 : 0,
        tbe: m.pop5 > 0 ? (r.emig / m.pop5) * 1000 : 0,
        iem: soma > 0 ? r.saldo / soma : null,
        // o erro-padrão publicado é do total, não do subgrupo: não seria correto reusá-lo
        se_imig: 0, se_emig: 0, se_saldo: 0, cv_imig: null, cv_emig: null,
        precisao_imig: "sem_estimativa",
      };
    });
  }, [municipios, recorte]);
  const porCodigo = useMemo(
    () => new Map(municipiosVisiveis.map((m) => [m.cd_mun, m])), [municipiosVisiveis]);

  // F6: indicadores da malha ativa -- municipais, ou das unidades do nível agregado escolhido
  const unidadesAtivas = nivelEfetivo === "mun" ? null : unidadesNivel[nivelEfetivo] ?? [];
  const porCodigoAtivo: Map<string, ValorMapa> = useMemo(() => {
    if (nivelEfetivo === "mun") return porCodigo;
    return new Map((unidadesAtivas ?? []).map((u) => [u.codigo, u]));
  }, [nivelEfetivo, porCodigo, unidadesAtivas]);

  const quebras = useMemo(() => {
    const valores: ValorMapa[] = nivelEfetivo === "mun" ? municipiosVisiveis : (unidadesAtivas ?? []);
    if (!valores.length) return [1, 2, 3];
    const vs = valores.map((m) =>
      metrica === "saldo" ? m.saldo : metrica === "tlm" ? (m.tlm ?? 0)
      : metrica === "imig" ? m.imig : metrica === "emig" ? -m.emig
      : (m.iem ?? 0) * 100);
    return quebrasSimetricas(vs);
  }, [municipiosVisiveis, unidadesAtivas, nivelEfetivo, metrica]);

  const selecionado = municipio ? porCodigo.get(municipio) ?? null : null;
  const unidadeSelecionada = nivelEfetivo !== "mun" && selecao
    ? (unidadesAtivas ?? []).find((u) => u.codigo === selecao) ?? null : null;
  const aoSelecionarFluxo = useCallback((o: string, d: string) => selecionarFluxo(o, d), [selecionarFluxo]);
  const aoSelecionarNoMapa = nivelEfetivo === "mun" ? selecionarMunicipio : selecionarUnidade;
  // rótulo da dica flutuante do mapa (nome/UF), pelo código da feição sob o cursor
  const rotuloDaFeicao = useCallback((cd: string): string | null => {
    if (nivelEfetivo === "mun") {
      const m = porCodigo.get(cd);
      return m ? `${m.nm_mun}/${m.uf_sigla}` : null;
    }
    const u = (unidadesAtivas ?? []).find((x) => x.codigo === cd);
    if (!u) return null;
    return u.uf_sigla && u.uf_sigla !== u.codigo ? `${u.nome}/${u.uf_sigla}` : u.nome;
  }, [nivelEfetivo, porCodigo, unidadesAtivas]);

  // F6: prioridade única de enquadramento — fluxo > seleção (município/unidade) > RM > Brasil.
  const foco = prioridadeFoco(fluxoFoco, selecaoFoco, rmFoco);
  const zoomMaximo = fluxoFoco ? undefined : selecaoFoco && nivelEfetivo === "mun" ? 9 : undefined;
  const rotuloReenquadrar = fluxoFoco ? "Ver o fluxo"
    : selecaoFoco ? `Ver ${nivelEfetivo === "mun" ? "o município" : nivelEfetivo === "uf" ? "a UF" : "a região"}`
    : rm ? "Ver a RM" : "Ver o Brasil";

  // F6 leva 2: título da aba reflete a seleção atual, para o histórico e leitores de tela
  useEffect(() => {
    const base = "Atlas da migração interna";
    if (origem && destino) {
      const o = porCodigo.get(origem)?.nm_mun ?? (unidadesAtivas ?? []).find((u) => u.codigo === origem)?.nome;
      const d = porCodigo.get(destino)?.nm_mun ?? (unidadesAtivas ?? []).find((u) => u.codigo === destino)?.nome;
      document.title = o && d ? `${o} → ${d} — ${base}` : base;
    } else if (selecionado) {
      document.title = `${selecionado.nm_mun}/${selecionado.uf_sigla} — ${base}`;
    } else if (unidadeSelecionada) {
      document.title = `${unidadeSelecionada.nome} — ${base}`;
    } else if (rm) {
      const nomeRM = rmsCabecalho.find((r) => r.cd_rm === rm)?.nm_rm;
      document.title = nomeRM ? `${nomeRM} — ${base}` : base;
    } else {
      document.title = base;
    }
  }, [origem, destino, selecionado, unidadeSelecionada, rm, rmsCabecalho, porCodigo, unidadesAtivas]);

  const fallbackPainel = <aside className="painel"><p className="muted">Carregando…</p></aside>;

  const painelDireita = rm ? (
    origem && destino ? (
      aba === "mig"
        ? <PainelFluxo origem={origem} destino={destino} escuro={escuro}
                       aoFechar={() => selecionarFluxo(null, null)} aoAbrirMunicipio={selecionarMunicipio} />
        : <Suspense fallback={fallbackPainel}>
            <PainelPendular origem={origem} destino={destino} tipo={aba} escuro={escuro}
                            aoFechar={() => selecionarFluxo(null, null)} />
          </Suspense>
    ) : (
      <Suspense fallback={fallbackPainel}>
        <PainelRM cdRm={rm} aba={aba} cruzar={cruzar} topN={topNStore} escuro={escuro}
                  aoMudarAba={setAba} aoMudarCruzar={setCruzar} aoSair={sairModoRM}
                  aoEscolherRM={entrarModoRM} aoSelecionarFluxo={aoSelecionarFluxo} />
      </Suspense>
    )
  ) : nivelEfetivo !== "mun" ? (
    <Suspense fallback={fallbackPainel}>
      {origem && destino ? (
        <PainelFluxoUnidade nivel={nivelEfetivo} origem={origem} destino={destino}
                            aoFechar={() => selecionarFluxo(null, null)} />
      ) : (
        <PainelUnidade nivel={nivelEfetivo} unidade={unidadeSelecionada} fluxos={arcos}
                      carregando={carregandoFluxos} aoSelecionarFluxo={aoSelecionarFluxo}
                      aoFechar={() => selecionarUnidade(null)}
                      fluxosUF={fluxosUF ?? undefined} unidadesUF={unidadesNivel.uf} escuro={escuro} />
      )}
    </Suspense>
  ) : origem && destino ? (
    <PainelFluxo origem={origem} destino={destino} escuro={escuro}
                 aoFechar={() => selecionarFluxo(null, null)} aoAbrirMunicipio={selecionarMunicipio} />
  ) : municipio ? (
    <PainelMunicipio municipio={selecionado} fluxos={arcos} carregando={carregandoFluxos}
                     escuro={escuro} recorte={filtro}
                     recorteCarregando={Boolean(filtro) && !recorte}
                     aoSelecionarFluxo={aoSelecionarFluxo}
                     aoFechar={() => selecionarMunicipio(null)} />
  ) : (
    <CapaNacional aoSelecionarFluxo={aoSelecionarFluxo} />
  );

  // F6: itens de busca e rótulo do campo, de acordo com o nível ativo
  const itensBusca: ItemBusca[] = nivelEfetivo === "mun"
    ? municipios.map((m) => ({ codigo: m.cd_mun, rotulo: `${m.nm_mun}/${m.uf_sigla}`, peso: m.pop }))
    : (unidadesAtivas ?? []).map((u) => ({
        codigo: u.codigo, rotulo: u.uf_sigla && u.uf_sigla !== u.codigo ? `${u.nome}/${u.uf_sigla}` : u.nome,
        peso: u.pop5,
      }));

  // F6 leva 2: descrição textual do mapa para quem não enxerga o canvas do deck.gl --
  // os mesmos números já estão nas tabelas do painel ao lado.
  const descricaoMapa = rm
    ? "Mapa da região metropolitana selecionada, com destaque para o núcleo e a periferia."
    : `Mapa coroplético do Brasil por ${nivelEfetivo === "mun" ? "município" : ROTULO_NIVEL[nivelEfetivo].toLowerCase()}, colorido pela métrica "${METRICAS.find((m) => m.valor === metrica)?.rotulo}", com arcos indicando os principais fluxos migratórios.`;

  return (
    <div className="app">
      <a className="pular-conteudo" href="#conteudo-principal">Pular para o conteúdo</a>

      <header className="cabecalho">
        <div className="cabecalho-linha1">
          <div className="marca">
            <h1>Atlas da migração interna no Brasil</h1>
            <span className="muted"> · Censo 2022, data fixa 2017–2022</span>
          </div>
          <div className="utilidades">
            <button className="link-util" onClick={abrirMetodologia}>Metodologia</button>
            <button className="link-util" onClick={() => setMostrarTour(true)}>Como usar</button>
            <button className="tema" onClick={() => setTema(escuro ? "claro" : "escuro")}
                    aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}>
              {escuro ? "☀" : "☾"}
            </button>
          </div>
        </div>

        <div className="cabecalho-linha2">
          <div className="barra-ferramentas" role="toolbar" aria-label="Modo e nível do mapa">
            <div className="segmentado" role="group" aria-label="Modo do atlas" data-tour="modo-rm">
              <button className={!rm ? "ativo" : ""} aria-pressed={!rm}
                      onClick={() => { setPedindoRM(false); sairModoRM(); }}>
                Brasil
              </button>
              <button className={rm ? "ativo" : ""} aria-pressed={Boolean(rm)}
                      onClick={() => setPedindoRM(true)}>
                Regiões metropolitanas
              </button>
            </div>
            {(pedindoRM || rm) && (
              <SeletorRM rms={rmsCabecalho} ativa={rm} aoEscolher={(cd) => { setPedindoRM(false); entrarModoRM(cd); }} />
            )}
            {!rm && (
              <div className="segmentado" role="group" aria-label="Nível de agregação">
                {(["mun", "rgi", "rgint", "uf"] as Nivel[]).map((n) => (
                  <button key={n} className={nivel === n ? "ativo" : ""} aria-pressed={nivel === n}
                          onClick={() => aoMudarNivel(n)}>
                    {ROTULO_NIVEL[n]}
                  </button>
                ))}
              </div>
            )}
            {!rm && (
              <button type="button" className="botao-filtros" onClick={() => setFiltrosAbertos(true)}
                      aria-haspopup="dialog" aria-expanded={filtrosAbertos} aria-controls="folha-filtros">
                Filtros{filtro ? " •" : ""}
              </button>
            )}
          </div>

          {!rm && (
            <>
              <div className={`filtros-backdrop${filtrosAbertos ? " aberto" : ""}`}
                   onClick={() => setFiltrosAbertos(false)} aria-hidden="true" />
              <div id="folha-filtros" className={`grupo-filtros${filtrosAbertos ? " aberto" : ""}`}
                   role="dialog" aria-modal="true" aria-label="Filtros do mapa">
                <button type="button" className="filtros-fechar" onClick={() => setFiltrosAbertos(false)}>
                  Fechar
                </button>
                <div className="separador-controle" aria-hidden="true" />
                <div data-tour="busca">
                  <Busca itens={itensBusca} placeholder={PLACEHOLDER_BUSCA[nivelEfetivo]}
                         aoEscolher={(cd) => { aoSelecionarNoMapa(cd); setFiltrosAbertos(false); }} />
                </div>
                {nivelEfetivo === "mun" && <Filtro valor={filtro} aoMudar={setFiltro} escuro={escuro} />}
                <div className="separador-controle" aria-hidden="true" />
                <div className="segmentado" role="group" aria-label="Métrica do mapa" data-tour="metrica">
                  {METRICAS.map((m) => (
                    <button key={m.valor} className={metrica === m.valor ? "ativo" : ""}
                            aria-pressed={metrica === m.valor} onClick={() => setMetrica(m.valor)}>
                      {m.rotulo}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      <EstadoDados />
      {avisoNivel && <div className="aviso-nivel" role="status">{avisoNivel}</div>}

      <main className="conteudo" id="conteudo-principal">
        <div className="mapa" data-tour="mapa">
          {!malhaAtiva && !erro && <div className="carregando">Carregando o mapa…</div>}
          {erro && <div className="erro" role="alert">{erro}</div>}
          <MapaAtlas
            malha={malhaAtiva} porCodigo={porCodigoAtivo} metrica={metrica} quebras={quebras}
            arcos={arcos} selecionado={codigoSelecionado} escuro={escuro}
            aoSelecionar={aoSelecionarNoMapa} aoSelecionarFluxo={aoSelecionarFluxo}
            foco={foco} zoomMaximo={zoomMaximo} rotuloReenquadrar={rotuloReenquadrar}
            destacar={rmDestacar} nucleo={rmNucleo} campoId={campoId} rotuloDaFeicao={rotuloDaFeicao}
            descricaoAcessivel={descricaoMapa}
          />
          {porCodigoAtivo.size > 0 && !rm && (
            <Legenda metrica={metrica} quebras={quebras} escuro={escuro}
                     notaNivel={nivelEfetivo !== "mun" ? ROTULO_NIVEL[nivelEfetivo] : undefined} />
          )}
        </div>
        {painelDireita}
      </main>

      <Suspense fallback={null}>
        {mostrarTour && <Tour aoFechar={() => setMostrarTour(false)} />}
        {paginaMetodologia && <PaginaMetodologia meta={meta} aoFechar={fecharMetodologia} />}
      </Suspense>

      {meta && (
        <footer className="rodape">
          {meta.aviso} Dados de {meta.versao_dados}. <button className="link-metodologia" onClick={abrirMetodologia}>Metodologia</button>
        </footer>
      )}
    </div>
  );
}

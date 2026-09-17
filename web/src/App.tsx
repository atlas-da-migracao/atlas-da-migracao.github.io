import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { feature, merge, mesh } from "topojson-client";
import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import type { GeometryCollection, MultiPolygon as TopoMultiPolygon, Polygon as TopoPolygon, Topology } from "topojson-specification";
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
import { num } from "./lib/format";
import { ANCORA_ESPIGA_MUNICIPIO } from "./lib/espigas";
import { bboxDeCentroides, bboxDeGeometria, prioridadeFoco, uniaoDeBboxes, type Bbox } from "./lib/rm";
import type { FluxoUF } from "./lib/acordes";
import { cor as corPaleta, FLUXO_MAPA, hexParaRgb, TIPOLOGIA_INTRA_RM } from "./lib/paletas";
import { useStore, usarModoEscuro, type Nivel } from "./state/store";
import { basePath, CENSOS, edicao } from "./lib/edicoes";
import type { Fluxo, Meta, Metrica, Municipio } from "./lib/types";

// F6 leva 2: módulos fora do caminho crítico da primeira pintura viram chunks separados --
// o tour, a página de metodologia e o módulo metropolitano (que arrasta d3-sankey) só são
// baixados quando o usuário realmente os abre. Ver docs/qa/F6_leva2_relatorio.md para o
// tamanho do bundle antes/depois.
const Tour = lazy(() => import("./components/Tour").then((m) => ({ default: m.Tour })));
const PaginaMetodologia = lazy(() => import("./components/PaginaMetodologia").then((m) => ({ default: m.PaginaMetodologia })));
// F12.5: "Ao longo dos censos" (?pagina=serie) -- mesma razão de ser um chunk separado.
const SerieCensos = lazy(() => import("./components/SerieCensos").then((m) => ({ default: m.SerieCensos })));
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
  const [topoMun, setTopoMun] = useState<Topology | null>(null);
  // filtro cruzado mapa <-> diagrama de acordes (nível UF)
  const [ufSobMapa, setUfSobMapa] = useState<string | null>(null);
  const [ufsRealcadas, setUfsRealcadas] = useState<Set<string> | null>(null);
  const aoRealcarUFs = useCallback((cds: string[] | null) => setUfsRealcadas(cds ? new Set(cds) : null), []);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [arcos, setArcos] = useState<(Fluxo & { direcao?: string; cruza?: boolean; corRgb?: [number, number, number] })[]>([]);
  const [carregandoFluxos, setCarregandoFluxos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { censo, municipio, selecao, nivel, origem, destino, metrica, filtro, tema, rm, aba, cruzar, topN,
          mostrarFluxos, mostrarSatelite, limiarFluxo, setLimiarFluxo, setCenso, selecionarMunicipio, selecionarUnidade, selecionarFluxo,
          setNivel, setMetrica, setFiltro, setTema, entrarModoRM, sairModoRM, setAba, setCruzar, setMostrarFluxos,
          setMostrarSatelite } = useStore();
  const recursos = edicao(censo).recursos;
  const [recorte, setRecorte] = useState<Map<string, { imig: number; emig: number; saldo: number }> | null>(null);
  const escuro = usarModoEscuro();

  // F6: níveis de agregação. `rm` sempre implica município (modo RM não existe nos demais
  // níveis); fora do modo RM, o nível efetivo é o escolhido pelo usuário.
  const nivelEfetivo: Nivel = rm ? "mun" : nivel;
  useEffect(() => { setUfSobMapa(null); setUfsRealcadas(null); }, [nivelEfetivo]);
  const [malhaNivel, setMalhaNivel] = useState<Record<string, FeatureCollection>>({});
  // F2 (mapa-representacao): topologia bruta por nível agregado, guardada além do
  // FeatureCollection já decodificado -- topojson.mesh() precisa do objeto topológico
  // (arcos + índices), não da geometria já expandida em feature(), para calcular fronteiras
  // únicas (sem duplicar arestas compartilhadas nem desenhar arestas internas de MultiPolygon).
  const [topoNivel, setTopoNivel] = useState<Record<string, Topology>>({});
  const [unidadesNivel, setUnidadesNivel] = useState<Record<string, UnidadeAgregada[]>>({});
  const [avisoNivel, setAvisoNivel] = useState<string | null>(null);

  // F6 leva 2 (10a): fluxos UF x UF para a matriz de acordes, carregados ao entrar no nível UF
  // -- por EDIÇÃO, como os caches acima (ver `chaveCache`).
  const [fluxosUFPorCenso, setFluxosUFPorCenso] = useState<Record<string, FluxoUF[]>>({});
  const fluxosUF = fluxosUFPorCenso[censo] ?? null;
  useEffect(() => {
    if (nivelEfetivo !== "uf" || fluxosUFPorCenso[censo]) return;
    const c = censo;
    fluxosEntreUFs().then((f) => setFluxosUFPorCenso((m) => ({ ...m, [c]: f }))).catch(() => {});
  }, [nivelEfetivo, censo]); // eslint-disable-line react-hooks/exhaustive-deps

  // F4: a malha e as unidades de um nível agregado são de UMA edição -- vêm de caminhos
  // `data/` e de uma conexão DuckDB próprios --, então a chave do cache inclui a edição.
  //
  // Antes o cache era indexado só pelo nível e um efeito separado o esvaziava quando `censo`
  // mudava. Isso quebrou quando a troca de edição passou a PRESERVAR o nível (ver `setCenso`
  // em state/store.ts): os dois efeitos rodam no mesmo commit, e o de carga ainda enxerga o
  // cache da edição ANTERIOR (o esvaziamento só vale do próximo render em diante), conclui
  // que já tem a malha e não busca nada; como suas dependências (`nivelEfetivo`, `censo`) já
  // tinham mudado, ele não roda de novo -- e o mapa ficava preso em "Carregando o mapa…".
  // Com a chave composta não existe estado intermediário errado para ler: a entrada da edição
  // nova simplesmente ainda não existe. De quebra, voltar para um ano já visitado é imediato.
  const chaveCache = (n: NivelAgregado) => `${censo}:${n}`;

  // F6 leva 2: folha de filtros (busca/recorte/métrica) no mobile -- abre como bottom sheet
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  useEffect(() => {
    if (nivelEfetivo === "mun" || malhaNivel[chaveCache(nivelEfetivo)]) return;
    const n = nivelEfetivo;
    const k = chaveCache(n);
    let vivo = true;
    // F10: malha em Albers (metros) -- a mesma que o mapa consome (COORDINATE_SYSTEM.CARTESIAN
    // em MapaAtlas.tsx). O front nunca reprojeta: o arquivo já vem em metros do pipeline.
    fetch(`${basePath(censo)}geo/${n}_albers.topojson`).then((r) => r.json() as Promise<Topology>).then((topo) => {
      if (!vivo) return;
      const chave = Object.keys(topo.objects)[0];
      const fc = feature(topo, topo.objects[chave]) as unknown as FeatureCollection;
      setMalhaNivel((m) => ({ ...m, [k]: fc }));
      setTopoNivel((t) => ({ ...t, [k]: topo }));
    }).catch((e) => { if (vivo) setErro(`Falha ao carregar a malha (${n}): ${(e as Error).message}`); });
    return () => { vivo = false; };
  }, [nivelEfetivo, censo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (nivelEfetivo === "mun" || unidadesNivel[chaveCache(nivelEfetivo)]) return;
    const n = nivelEfetivo;
    const k = chaveCache(n);
    let vivo = true;
    carregarUnidades(n).then((u) => { if (vivo) setUnidadesNivel((m) => ({ ...m, [k]: u })); })
      .catch((e) => { if (vivo) setErro(`Falha ao consultar as unidades (${n}): ${(e as Error).message}`); });
    return () => { vivo = false; };
  }, [nivelEfetivo, censo]); // eslint-disable-line react-hooks/exhaustive-deps

  const aoMudarNivel = (n: Nivel) => {
    const limpou = setNivel(n);
    if (limpou) {
      setAvisoNivel("O recorte por característica só existe no nível município; foi limpo ao trocar de nível.");
      setTimeout(() => setAvisoNivel(null), 6000);
    }
  };

  // lista de RMs para o seletor do cabeçalho -- só em edições com módulo metropolitano
  // (rm_resumo não é registrada na conexão DuckDB de uma edição sem esse recurso, ver
  // db/duckdb.ts; consultar mesmo assim daria erro "tabela não encontrada")
  const [rmsCabecalho, setRmsCabecalho] = useState<ResumoRM[]>([]);
  useEffect(() => {
    if (!recursos.rm) { setRmsCabecalho([]); return; }
    let vivo = true;
    listarRMs().then((r) => { if (vivo) setRmsCabecalho(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [censo]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // F12.5: seção completa "Ao longo dos censos", roteada por ?pagina=serie (mesmo padrão da
  // metodologia). O território/nível NÃO entram nesta URL própria -- continuam em ?n/?mun/?sel
  // (docs/design_serie_censos.md, 1.1): a seção lê a unidade selecionada no momento em que abre.
  const [paginaSerie, setPaginaSerie] = useState(
    () => new URLSearchParams(location.search).get("pagina") === "serie",
  );
  const abrirSerie = () => {
    setPaginaSerie(true);
    const p = new URLSearchParams(location.search);
    p.set("pagina", "serie");
    history.pushState(null, "", `?${p.toString()}`);
  };
  const fecharSerie = () => {
    setPaginaSerie(false);
    const p = new URLSearchParams(location.search);
    p.delete("pagina");
    const qs = p.toString();
    history.pushState(null, "", qs ? `?${qs}` : location.pathname);
  };
  useEffect(() => {
    const aoNavegar = () => setPaginaSerie(new URLSearchParams(location.search).get("pagina") === "serie");
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

  // malha e metadados: caminho crítico da primeira pintura. Reroda ao trocar de edição
  // (censo): cada edição tem sua própria malha/meta/indicadores, servidos de basePath(censo).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const base = basePath(censo);
        const [topo, m, mapa] = await Promise.all([
          // F10: malha em Albers (metros) -- ver comentário acima, no efeito de malhaNivel.
          fetch(`${base}geo/municipios_albers.topojson`).then((r) => r.json() as Promise<Topology>),
          fetch(`${base}meta.json`).then((r) => r.json() as Promise<Meta>),
          fetch(`${base}municipios_mapa.json`).then((r) => r.json() as Promise<MunicipiosMapa>),
        ]);
        if (!vivo) return;
        const chave = Object.keys(topo.objects)[0];
        setMalha(feature(topo, topo.objects[chave]) as unknown as FeatureCollection);
        setTopoMun(topo);
        setMeta(m);
        // pinta o coroplético imediatamente; o DuckDB completa os campos depois
        setMunicipios(mapa.linhas.map(([cd, nm, uf, pop, imig, emig, saldo, tlm, iem, cv]) => ({
          // uf: prefixo do código, que vale para todo município do IBGE. Uma UNIDADE AGREGADA
          // (código sintético não numérico, ex.: 'NORTEGO' no Censo 1980) não tem prefixo de
          // UF -- aqui ela fica com o lixo do slice até o DuckDB substituir a linha inteira
          // pelos dados de municipios.parquet, que traz a UF publicada da unidade. Nenhum
          // componente lê `uf` nesta janela (o painel usa uf_sigla, que vem correto do
          // arquivo), mas o CASE fica explícito para não parecer que o prefixo é confiável.
          cd_mun: cd, nm_mun: nm, uf_sigla: uf,
          uf: /^\d{7}$/.test(cd) ? cd.slice(0, 2) : "",
          cd_rgi: null, nm_rgi: null, cd_rgint: null, nm_rgint: null, cd_rm: null, nm_rm: null,
          pop, pop5: pop, imig, imig_ni: 0, imig_int: 0, emig, saldo,
          tbi: null, tbe: null, tlm, iem,
          se_imig: 0, se_emig: 0, se_saldo: 0, cv_imig: cv, cv_emig: null,
          n_imig_faixa: "", n_emig_faixa: "", precisao_imig: "sem_estimativa",
        })));
      } catch (e) {
        if (vivo) setErro(`Falha ao carregar a malha: ${(e as Error).message}`);
      }
    })();
    return () => { vivo = false; };
  }, [censo]);

  // indicadores municipais e os maiores fluxos do país (DuckDB, em paralelo)
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // só os indicadores: quem decide os arcos é o efeito dedicado abaixo, senão
        // esta resposta sobrescreveria os fluxos do município já selecionado
        const m = await carregarMunicipios();
        if (vivo) setMunicipios(m);
      } catch (e) {
        console.error(e);
        if (vivo) setErro(`Falha ao consultar os dados: ${(e as Error).message}`);
      }
    })();
    return () => { vivo = false; };
  }, [censo]);

  // F8 (SEO): a home publica um SearchAction (?q=...) no JSON-LD para a busca do Google --
  // preenche e seleciona o primeiro resultado assim que os municípios carregarem, com a
  // mesma normalização (sem acento, sem caixa) da busca da interface (Busca.tsx). Só roda
  // uma vez: `selecionarMunicipio` já reescreve a URL sem o `q` (paraUrl monta a query do
  // zero), então não há necessidade de limpar o parâmetro manualmente.
  const [qProcessado, setQProcessado] = useState(false);
  useEffect(() => {
    if (qProcessado || !municipios.length) return;
    const q = new URLSearchParams(location.search).get("q");
    setQProcessado(true);
    if (!q?.trim()) return;
    const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const alvo = normalizar(q.trim());
    const achado = municipios
      .map((m) => ({ m, chave: normalizar(`${m.nm_mun}/${m.uf_sigla}`) }))
      .filter((x) => x.chave.includes(alvo))
      .sort((a, b) => (a.chave.startsWith(alvo) === b.chave.startsWith(alvo)
        ? b.m.pop - a.m.pop : a.chave.startsWith(alvo) ? -1 : 1))[0];
    if (achado) selecionarMunicipio(achado.m.cd_mun);
  }, [municipios, qProcessado]); // eslint-disable-line react-hooks/exhaustive-deps

  // malha ativa: municipal por padrão, ou a do nível agregado escolhido
  const malhaAtiva = nivelEfetivo === "mun" ? malha : malhaNivel[chaveCache(nivelEfetivo)] ?? null;
  // topologia bruta correspondente (para o mesh de contornos -- ver contornosMalha abaixo)
  const topoAtivo = nivelEfetivo === "mun" ? topoMun : topoNivel[chaveCache(nivelEfetivo)] ?? null;
  const campoId = CAMPO_ID[nivelEfetivo];

  // F2 (mapa-representacao): contorno "normal" por malha de arestas -- topojson.mesh com o
  // filtro (a, b) => a !== b mantém só arestas na fronteira entre DUAS feições distintas
  // (some tanto a aresta interna de um MultiPolygon da mesma feição -- caso do NORTEGO --
  // quanto a duplicação de desenhar a mesma fronteira compartilhada duas vezes, uma por
  // município). O contorno de seleção/núcleo de RM continua por feição (ver MapaAtlas).
  const contornosMalha = useMemo<Feature | null>(() => {
    if (!topoAtivo) return null;
    const chave = Object.keys(topoAtivo.objects)[0];
    const objeto = topoAtivo.objects[chave] as GeometryCollection;
    return { type: "Feature", properties: {}, geometry: mesh(topoAtivo, objeto, (a, b) => a !== b) };
  }, [topoAtivo]);

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
    // F10: enquadramento em metros (Albers) -- x_albers/y_albers, não lon/lat.
    consulta.then((pts) => {
      if (vivo) setFluxoFoco(bboxDeCentroides(pts.map((p) => ({ lon: p.x_albers, lat: p.y_albers })), 0.25));
    }).catch(() => setFluxoFoco(null));
    return () => { vivo = false; };
  }, [origem, destino, nivelEfetivo]);

  const selecaoFoco = codigoSelecionado && !rm ? bboxPorFeicao.get(codigoSelecionado) ?? null : null;

  // F3 (mapa-representação): enquadramento inclui os destinos dos arcos exibidos -- antes,
  // selecionar um município enquadrava só o polígono selecionado e os arcos saíam cortados
  // da tela. União do bbox do polígono com o bbox dos centroides dos arcos (origem E destino
  // de cada um), só quando a camada de arcos está LIGADA (senão não há o que enquadrar) e não
  // há um fluxo específico focado (fluxoFoco, que já é mais preciso e tem prioridade abaixo).
  const bboxDosArcos = useMemo(() => {
    if (!mostrarFluxos || !selecaoFoco || arcos.length === 0) return null;
    // F3 (mapa-representação), ajuste pós-verificação visual: sem limite, o top-15 de um
    // município (ex. São Paulo) inclui destinos a 2 mil+ km (Recife, Salvador) e o
    // enquadramento afrouxava até cobrir metade do Brasil -- perde-se a leitura local que é
    // o ponto da vista de município. Raio de corte = o maior entre 220 km (cobre uma região
    // metropolitana) e 4x o tamanho do próprio polígono selecionado (municípios grandes, ex.
    // no Norte, ainda enquadram seus vizinhos próximos). Arcos com a ponta fora do raio
    // continuam desenhados (e listados no painel) -- só saem da tela, como antes desta fase;
    // não há perda de dado, só de enquadramento automático. F10: bbox/centro/raio em metros
    // (Albers) -- selecaoFoco já vem da malha projetada (ver bboxPorFeicao).
    const [minX, minY, maxX, maxY] = selecaoFoco;
    const centro = { lon: (minX + maxX) / 2, lat: (minY + maxY) / 2 };
    const tamanhoBase = Math.max(maxX - minX, maxY - minY);
    const raio = Math.max(220_000, tamanhoBase * 4);
    const pontos = arcos.flatMap((a) => [
      a.x_o != null && a.y_o != null ? { lon: a.x_o, lat: a.y_o } : null,
      a.x_d != null && a.y_d != null ? { lon: a.x_d, lat: a.y_d } : null,
    ]).filter((p): p is { lon: number; lat: number } => p != null
      && Math.hypot(p.lon - centro.lon, p.lat - centro.lat) <= raio);
    return bboxDeCentroides(pontos, 0.15);
  }, [mostrarFluxos, selecaoFoco, arcos]);
  const selecaoComArcosFoco = uniaoDeBboxes([selecaoFoco, bboxDosArcos]);

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
      // F10: enquadramento em metros (Albers).
      setRmFoco(bboxDeCentroides(cent.map((p) => ({ lon: p.x_albers, lat: p.y_albers }))));
    }).catch((e) => setErro(`Falha ao carregar a RM: ${(e as Error).message}`));
    return () => { vivo = false; };
  }, [rm]);

  // perímetro da RM: municípios dissolvidos na topologia (arcos compartilhados somem)
  const rmPerimetro = useMemo<Feature<MultiPolygon> | null>(() => {
    if (!topoMun || !rmDestacar || rmDestacar.size === 0) return null;
    const objeto = topoMun.objects[Object.keys(topoMun.objects)[0]] as GeometryCollection<Record<string, string>>;
    const geoms = objeto.geometries.filter((g): g is TopoPolygon | TopoMultiPolygon =>
      (g.type === "Polygon" || g.type === "MultiPolygon") && !!g.properties && rmDestacar.has(g.properties.CD_MUN));
    if (geoms.length === 0) return null;
    return { type: "Feature", properties: {}, geometry: merge(topoMun, geoms) };
  }, [topoMun, rmDestacar]);

  // F11 (mapa-representação): legenda do MODO METROPOLITANO. No modo Brasil a legenda explica
  // a métrica (faixas de cor ou espigas); dentro de uma RM o mapa não pinta a malha nem desenha
  // espigas -- os fluxos são o único dado em tela, e a cor deles muda de significado conforme a
  // aba, o que sem legenda ficava por adivinhar. Na aba de migração a cor é a TIPOLOGIA do
  // fluxo (as mesmas 3 categorias do painel lateral, CORES_TIPOLOGIA acima, que é por onde o
  // mapa pinta -- daí ler `cor.claro`, como ele, em vez de alternar por tema); nas abas de
  // pendular não há categoria: a cor é a monocromática do mapa (FLUXO_MAPA) e o que varia é o
  // alfa, reduzido nos deslocamentos que atravessam o limite da RM (`cruza` em MapaAtlas.tsx),
  // que só aparecem com o filtro "cruzar o limite" ligado.
  const legendaRM = useMemo(() => {
    if (aba === "mig") {
      return {
        titulo: "Migração dentro da região metropolitana",
        categorias: TIPOLOGIA_INTRA_RM.categorias.map((c) => ({ rotulo: c.rotulo, cor: c.cor.claro })),
        nota: "A cor identifica a posição das duas pontas na RM (núcleo ou periferia); a direção é lida pela forma.",
      };
    }
    const destino = aba === "trab" ? "trabalho" : "estudo";
    return {
      titulo: `Deslocamento pendular para ${destino}`,
      categorias: [{ rotulo: `Residência → ${destino}`, cor: corPaleta(FLUXO_MAPA, escuro) }],
      nota: cruzar
        ? "Cor única: todo fluxo vai da residência ao destino. Os fluxos esmaecidos atravessam o limite da RM."
        : "Cor única: todo fluxo vai da residência ao destino.",
    };
  }, [aba, cruzar, escuro]);

  /** Volumes dos fluxos carregados, em ordem -- base do slider de tamanho. */
  const volumesFluxo = useMemo(
    () => arcos.map((a) => a.total).sort((a, b) => a - b), [arcos]);
  const faixaFluxos = volumesFluxo.length
    ? { min: volumesFluxo[0], max: volumesFluxo[volumesFluxo.length - 1] } : null;

  /** Corte ABSOLUTO (em pessoas) que a posição do slider representa nesta vista. A posição
   *  não é lida como fração da FAIXA de volumes, e sim como QUANTIL: `limiarFluxo` = 0,5
   *  corta na mediana, deixando metade dos fluxos. A diferença é prática -- os volumes são
   *  muito assimétricos (poucos fluxos enormes, uma cauda longa de pequenos), e medido sobre
   *  a faixa o controle ficava inútil: metade do curso já apagava 136 dos 150 fluxos do mapa
   *  nacional, e o resto do curso não fazia quase nada. Por quantil, cada passo do slider
   *  tira aproximadamente o mesmo número de fluxos. O rótulo continua mostrando o corte em
   *  pessoas, que é o que o usuário precisa saber para interpretar o mapa. */
  const corteFluxo = volumesFluxo.length
    ? volumesFluxo[Math.min(volumesFluxo.length - 1,
        Math.floor(limiarFluxo * (volumesFluxo.length - 1)))]
    : 0;

  /** Fluxos que o mapa de fato desenha: os carregados, menos os menores que o corte do
   *  slider. Só a CAMADA é filtrada -- o painel lateral continua listando todos, como já
   *  acontece com o toggle "Fluxos" (ver `mostrarFluxos` em state/store.ts). */
  const arcosVisiveis = useMemo(
    () => (limiarFluxo > 0 ? arcos.filter((a) => a.total >= corteFluxo) : arcos),
    [arcos, limiarFluxo, corteFluxo]);

  /** Corte efetivo da camada de fluxos: o volume do MENOR fluxo em tela. O mapa desenha só os
   *  `topN` maiores pares da vista (`maioresFluxos`/`maioresFluxosNivel` em db/queries.ts), e
   *  sem esse número o leitor lê a ausência de um fluxo no mapa como ausência de migração. Sai
   *  dos próprios fluxos carregados, não de uma constante: muda com a edição (os volumes de
   *  1980 não são os de 2022), com o nível agregado e com o "top N" escolhido. */
  const menorFluxoExibido = useMemo(
    () => (arcosVisiveis.length ? Math.min(...arcosVisiveis.map((a) => a.total)) : null), [arcosVisiveis]);

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
        // pendular tem direção real e inequívoca (residência -> trabalho/estudo), mesmo sem
        // coluna própria de direção na consulta -- marcado como "saida" (mesma cor de quem sai
        // do município de origem) para não cair no neutro genérico que F3 reservou para
        // listas de maiores fluxos sem direção conhecida (ver MapaAtlas.tsx).
        : pendularDaRM(rm, aba === "trab" ? "pendular_trab" : "pendular_estudo", topNStore, cruzar)
            .then((f) => f.map((x) => ({ ...x, direcao: "saida" as const })));
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
      if (municipios.length) maioresFluxos(150, filtro).then(setArcos).catch(() => {});
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
  const unidadesAtivas = nivelEfetivo === "mun" ? null : unidadesNivel[chaveCache(nivelEfetivo)] ?? [];
  const porCodigoAtivo: Map<string, ValorMapa> = useMemo(() => {
    if (nivelEfetivo === "mun") return porCodigo;
    return new Map((unidadesAtivas ?? []).map((u) => [u.codigo, u]));
  }, [nivelEfetivo, porCodigo, unidadesAtivas]);

  // F5 (mapa-representação): centroide (metros, Albers) de cada unidade da malha ativa --
  // âncora das espigas bipolares (saldo/imigrantes/emigrantes, ver MapaAtlas.tsx). Reaproveita
  // as mesmas consultas já usadas para enquadrar um fluxo/uma RM (`centroidesDeMunicipios`/
  // `centroidesDeUnidades`), pedindo o conjunto inteiro de códigos da malha ativa em vez de só
  // origem+destino. Refeita ao trocar de nível ou de edição; os CÓDIGOS não mudam sob recorte
  // (só os valores), por isso a dependência é `municipios`/`unidadesAtivas`, não
  // `municipiosVisiveis`/`porCodigoAtivo`.
  const [centroidesAtivos, setCentroidesAtivos] = useState<Map<string, { x: number; y: number }>>(new Map());
  useEffect(() => {
    let vivo = true;
    const codigos = nivelEfetivo === "mun" ? municipios.map((m) => m.cd_mun) : (unidadesAtivas ?? []).map((u) => u.codigo);
    if (codigos.length === 0) { setCentroidesAtivos(new Map()); return; }
    const consulta = nivelEfetivo === "mun"
      ? centroidesDeMunicipios(codigos)
      : centroidesDeUnidades(nivelEfetivo as NivelAgregado, codigos);
    consulta
      .then((pts) => {
        if (vivo) setCentroidesAtivos(new Map(pts.map((p) => [p.cd_mun, { x: p.x_albers, y: p.y_albers }])));
      })
      .catch(() => { if (vivo) setCentroidesAtivos(new Map()); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivelEfetivo, censo, municipios.length, unidadesAtivas]);

  const quebras = useMemo(() => {
    const valores: ValorMapa[] = nivelEfetivo === "mun" ? municipiosVisiveis : (unidadesAtivas ?? []);
    if (!valores.length) return [1, 2, 3];
    const vs = valores.map((m) =>
      metrica === "saldo" ? m.saldo : metrica === "tlm" ? (m.tlm ?? 0)
      : metrica === "imig" ? m.imig : metrica === "emig" ? -m.emig
      : (m.iem ?? 0) * 100);
    return quebrasSimetricas(vs);
  }, [municipiosVisiveis, unidadesAtivas, nivelEfetivo, metrica]);

  // F5 (mapa-representação): âncora da escala das espigas, para a legenda mostrar os MESMOS
  // números que o mapa usa (MapaAtlas.tsx calcula isto de novo a partir de `porCodigo`/
  // `centroides`, que a legenda não tem acesso). `null` fora das métricas de contagem
  // (saldo/imig/emig) -- a legenda usa isso para decidir entre o texto genérico e os números.
  // No nível MUNICÍPIO, a âncora é FIXA entre as 5 edições (ANCORA_ESPIGA_MUNICIPIO, ver
  // lib/espigas.ts -- mesma correção e mesmo motivo documentados lá: normalizar cada edição
  // pelo próprio máximo fazia 1980 parecer muito mais cheia de espigas grandes que as demais).
  // Nos níveis agregados, continua o cálculo dinâmico por edição/nível.
  const maiorAbsolutoMetrica = useMemo(() => {
    if (metrica !== "saldo" && metrica !== "imig" && metrica !== "emig") return null;
    if (nivelEfetivo === "mun") return ANCORA_ESPIGA_MUNICIPIO[metrica];
    const valores: ValorMapa[] = unidadesAtivas ?? [];
    const abs = valores.map((m) => Math.abs(metrica === "saldo" ? m.saldo : metrica === "imig" ? m.imig : m.emig));
    return abs.length ? Math.max(1, ...abs) : null;
  }, [unidadesAtivas, nivelEfetivo, metrica]);

  const selecionado = municipio ? porCodigo.get(municipio) ?? null : null;
  const unidadeSelecionada = nivelEfetivo !== "mun" && selecao
    ? (unidadesAtivas ?? []).find((u) => u.codigo === selecao) ?? null : null;
  // F9.7-b: distingue "nada selecionado"/"ainda carregando" de "selecionado mas não existe nesta
  // edição" (ex.: link para um município/unidade que só existe em outra edição) -- só true depois
  // que os dados terminarem de carregar, para não piscar a mensagem durante a busca inicial via
  // URL. Ver PainelMunicipio/PainelUnidade (prop `naoEncontrado`) e o guard equivalente, já
  // autocontido, em PainelRM.tsx.
  const municipioNaoEncontrado = municipios.length > 0 && Boolean(municipio) && !selecionado;
  const unidadeNaoEncontrada = nivelEfetivo !== "mun" && unidadesNivel[chaveCache(nivelEfetivo)] != null
    && Boolean(selecao) && !unidadeSelecionada;
  const aoSelecionarFluxo = useCallback((o: string, d: string) => selecionarFluxo(o, d), [selecionarFluxo]);

  // F12.5: unidade que a seção "Ao longo dos censos" abre quando `abrirSerie()` é chamado --
  // deriva da seleção atual (município, unidade agregada ou RM), nunca da URL própria da seção.
  const serieUnidade = rm
    ? { nivel: "rm" as const, codigo: rm, nome: rmsCabecalho.find((r) => r.cd_rm === rm)?.nm_rm ?? rm }
    : nivelEfetivo !== "mun" && unidadeSelecionada
    ? { nivel: nivelEfetivo as "rgi" | "rgint" | "uf", codigo: unidadeSelecionada.codigo, nome: unidadeSelecionada.nome }
    : selecionado
    ? { nivel: "mun" as const, codigo: selecionado.cd_mun, nome: `${selecionado.nm_mun}/${selecionado.uf_sigla}` }
    : null;
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
  const foco = prioridadeFoco(fluxoFoco, selecaoComArcosFoco, rmFoco);
  // F10 (correção): zoom cartesiano = log2(pixels por metro) -- escala bem diferente do zoom
  // "tipo Mercator" de antes (0-20ish). O teto antigo (9) nunca segurava nada no esquema novo
  // (município minúsculo enchia a tela). Equivalente ao teto antigo de ~305 m/px (zoom 9 do
  // z/x/y clássico, 156543/2^9): log2(1/305) ≈ -8,25 -- não zoomar além da resolução em que a
  // malha (simplificada a 1%) ainda faz sentido.
  const ZOOM_MAXIMO_MUNICIPIO = -8.25;
  const zoomMaximo = fluxoFoco ? undefined : selecaoFoco && nivelEfetivo === "mun" ? ZOOM_MAXIMO_MUNICIPIO : undefined;
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
      aba === "mig" || !recursos.pendular
        ? <PainelFluxo origem={origem} destino={destino} escuro={escuro} meta={meta}
                       aoFechar={() => selecionarFluxo(null, null)} aoAbrirMunicipio={selecionarMunicipio} />
        : <Suspense fallback={fallbackPainel}>
            <PainelPendular origem={origem} destino={destino} tipo={aba} escuro={escuro} meta={meta}
                            aoFechar={() => selecionarFluxo(null, null)} />
          </Suspense>
    ) : (
      <Suspense fallback={fallbackPainel}>
        <PainelRM cdRm={rm} aba={aba} cruzar={cruzar} topN={topNStore} escuro={escuro} meta={meta}
                  aoMudarAba={setAba} aoMudarCruzar={setCruzar} aoSair={sairModoRM}
                  aoEscolherRM={entrarModoRM} aoSelecionarFluxo={aoSelecionarFluxo} />
      </Suspense>
    )
  ) : nivelEfetivo !== "mun" ? (
    <Suspense fallback={fallbackPainel}>
      {origem && destino ? (
        <PainelFluxoUnidade nivel={nivelEfetivo} origem={origem} destino={destino} meta={meta}
                            aoFechar={() => selecionarFluxo(null, null)} />
      ) : (
        <PainelUnidade nivel={nivelEfetivo} unidade={unidadeSelecionada} naoEncontrado={unidadeNaoEncontrada}
                      fluxos={arcos} carregando={carregandoFluxos} aoSelecionarFluxo={aoSelecionarFluxo}
                      aoFechar={() => selecionarUnidade(null)} meta={meta}
                      fluxosUF={fluxosUF ?? undefined} unidadesUF={unidadesNivel[`${censo}:uf`]} escuro={escuro}
                      ufSobMapa={ufSobMapa} aoSelecionarUF={selecionarUnidade} aoRealcarUFs={aoRealcarUFs}
                      aoAbrirSerie={abrirSerie} />
      )}
    </Suspense>
  ) : origem && destino ? (
    <PainelFluxo origem={origem} destino={destino} escuro={escuro} meta={meta}
                 aoFechar={() => selecionarFluxo(null, null)} aoAbrirMunicipio={selecionarMunicipio} />
  ) : municipio ? (
    <PainelMunicipio municipio={selecionado} naoEncontrado={municipioNaoEncontrado} fluxos={arcos}
                     carregando={carregandoFluxos} escuro={escuro} recorte={filtro}
                     recorteCarregando={Boolean(filtro) && !recorte}
                     aoSelecionarFluxo={aoSelecionarFluxo} meta={meta}
                     aoFechar={() => selecionarMunicipio(null)} aoAbrirSerie={abrirSerie} />
  ) : (
    <CapaNacional aoSelecionarFluxo={aoSelecionarFluxo} recorte={filtro} meta={meta} />
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
            <span className="muted marca-subtitulo-completo"> · {edicao(censo).subtitulo}</span>
            <span className="muted marca-subtitulo-curto"> · {edicao(censo).rotulo}</span>
          </div>
          <div className="utilidades">
            {CENSOS.length > 1 && (
              <div className="segmentado segmentado-censo" role="group" aria-label="Edição do Censo">
                {CENSOS.map((c) => (
                  <button key={c} className={censo === c ? "ativo" : ""} aria-pressed={censo === c}
                          onClick={() => setCenso(c)}>
                    {edicao(c).rotulo}
                  </button>
                ))}
              </div>
            )}
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
              {recursos.rm && (
                <button className={rm ? "ativo" : ""} aria-pressed={Boolean(rm)}
                        onClick={() => setPedindoRM(true)}>
                  Regiões metropolitanas
                </button>
              )}
            </div>
            {recursos.rm && (pedindoRM || rm) && (
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
            malha={malhaAtiva} contornos={contornosMalha} porCodigo={porCodigoAtivo} metrica={metrica} quebras={quebras}
            arcos={arcosVisiveis} selecionado={codigoSelecionado} escuro={escuro}
            aoSelecionar={aoSelecionarNoMapa} aoSelecionarFluxo={aoSelecionarFluxo}
            foco={foco} zoomMaximo={zoomMaximo} rotuloReenquadrar={rotuloReenquadrar}
            destacar={rmDestacar ?? (nivelEfetivo === "uf" ? ufsRealcadas : null)} perimetro={rmPerimetro} nucleo={rmNucleo} campoId={campoId} rotuloDaFeicao={rotuloDaFeicao}
            descricaoAcessivel={descricaoMapa}
            aoPassarFeicao={nivelEfetivo === "uf" ? setUfSobMapa : undefined}
            mostrarFluxos={mostrarFluxos} maiorFluxoEdicao={meta?.maior_fluxo ?? null}
            boundsNacional={meta?.bounds_albers ?? null} centroides={centroidesAtivos}
            mostrarSatelite={mostrarSatelite}
          />
          <div className="mapa-controles-baixo">
            <div className="mapa-controles-linha">
              <button type="button" className="botao-fluxos" aria-pressed={mostrarFluxos}
                      onClick={() => setMostrarFluxos(!mostrarFluxos)}>
                {mostrarFluxos ? "Fluxos: ligados" : "Fluxos: desligados"}
              </button>
              <button type="button" className="botao-fluxos" aria-pressed={mostrarSatelite}
                      onClick={() => setMostrarSatelite(!mostrarSatelite)}>
                {mostrarSatelite ? "Satélite: ligado" : "Satélite: desligado"}
              </button>
            </div>
            {/* Filtro de TAMANHO dos fluxos. Só aparece quando há fluxos desenhados e mais de
                um volume distinto -- com um fluxo só, ou todos iguais, o controle não teria o
                que separar. O slider anda na FRAÇÃO da faixa de volumes da vista (ver
                `limiarFluxo` em state/store.ts); o rótulo traduz a posição para o número de
                pessoas e diz quantos fluxos sobraram, que é o retorno que torna a escala
                compreensível mesmo com a distribuição bem assimétrica dos volumes. */}
            {mostrarFluxos && faixaFluxos && faixaFluxos.max > faixaFluxos.min && (
              <div className="filtro-fluxo">
                <label htmlFor="filtro-fluxo-slider">Tamanho mínimo do fluxo</label>
                <input id="filtro-fluxo-slider" type="range" min={0} max={1} step={0.01}
                       value={limiarFluxo}
                       onChange={(e) => setLimiarFluxo(Number(e.target.value))}
                       aria-valuetext={`a partir de ${num(Math.round(corteFluxo))} pessoas, `
                         + `${arcosVisiveis.length} de ${arcos.length} fluxos`} />
                <span className="filtro-fluxo-valor">
                  a partir de <strong>{num(Math.round(corteFluxo))}</strong> pessoas
                  {" "}· {num(arcosVisiveis.length)} de {num(arcos.length)} fluxos
                </span>
              </div>
            )}
            {mostrarSatelite && (
              <p className="atribuicao-satelite">
                Imagem de satélite: NASA Visible Earth, Blue Marble.
              </p>
            )}
            {porCodigoAtivo.size > 0 && !rm && (
              <Legenda metrica={metrica} quebras={quebras} escuro={escuro} maiorFluxo={meta?.maior_fluxo ?? null}
                       maiorAbsolutoMetrica={maiorAbsolutoMetrica}
                       notaNivel={nivelEfetivo !== "mun" ? ROTULO_NIVEL[nivelEfetivo] : undefined}
                       menorFluxo={menorFluxoExibido} qtdFluxos={arcosVisiveis.length || undefined} />
            )}
            {rm && (
              <Legenda metrica={metrica} quebras={quebras} escuro={escuro} maiorFluxo={meta?.maior_fluxo ?? null}
                       titulo={legendaRM.titulo} categoriasFluxo={legendaRM.categorias}
                       notaFluxo={legendaRM.nota} />
            )}
          </div>
        </div>
        {painelDireita}
      </main>

      <Suspense fallback={null}>
        {mostrarTour && <Tour aoFechar={() => setMostrarTour(false)} />}
        {paginaMetodologia && <PaginaMetodologia meta={meta} aoFechar={fecharMetodologia} />}
        {paginaSerie && serieUnidade && (
          <SerieCensos nivel={serieUnidade.nivel} codigo={serieUnidade.codigo} nome={serieUnidade.nome}
                       escuro={escuro} aoFechar={fecharSerie} />
        )}
      </Suspense>

      {meta && (
        <footer className="rodape">
          <p>{meta.aviso} Dados de {meta.versao_dados}. <button className="link-metodologia" onClick={abrirMetodologia}>Metodologia</button></p>
          {meta.citacao && (
            <p className="rodape-citacao">
              Como citar: {meta.citacao.autor} <em>(<a href={meta.citacao.autor_orcid}>ORCID</a>)</em>.
              Atlas da migração interna no Brasil. Dados do Censo Demográfico {edicao(censo).nome} (IBGE).
              DOI:{" "}
              <a href={`https://doi.org/${meta.citacao.doi_conceito}`}>{meta.citacao.doi_conceito}</a>.
            </p>
          )}
        </footer>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import type { Topology } from "topojson-specification";
import { MapaAtlas } from "./map/MapaAtlas";
import { PainelMunicipio } from "./components/PainelMunicipio";
import { PainelFluxo } from "./components/PainelFluxo";
import { PainelRM } from "./components/PainelRM";
import { PainelPendular } from "./components/PainelPendular";
import { Legenda } from "./components/Legenda";
import { Busca } from "./components/Busca";
import { Filtro } from "./components/Filtro";
import { SeletorRM } from "./components/SeletorRM";
import { carregarMunicipios, centroidesDaRM, fluxosDoMunicipio, fluxosIntraDaRM, fluxosPorCategoria,
         listarRMs, maioresFluxos, municipiosDaRM, pendularDaRM, saldoPorCategoria,
         type ResumoRM } from "./db/queries";
import { quebrasSimetricas } from "./lib/escalas";
import { bboxDeCentroides, type Bbox } from "./lib/rm";
import { hexParaRgb, TIPOLOGIA_INTRA_RM } from "./lib/paletas";
import { useStore, usarModoEscuro } from "./state/store";
import type { Fluxo, Meta, Metrica, Municipio } from "./lib/types";

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

  const { municipio, origem, destino, metrica, filtro, tema, rm, aba, cruzar, topN,
          selecionarMunicipio, selecionarFluxo, setMetrica, setFiltro, setTema,
          entrarModoRM, sairModoRM, setAba, setCruzar } = useStore();
  const [recorte, setRecorte] = useState<Map<string, { imig: number; emig: number; saldo: number }> | null>(null);
  const escuro = usarModoEscuro();

  // lista de RMs para o seletor do cabeçalho, carregada uma vez
  const [rmsCabecalho, setRmsCabecalho] = useState<ResumoRM[]>([]);
  useEffect(() => { listarRMs().then(setRmsCabecalho).catch(() => {}); }, []);
  // segmentado "Regiões metropolitanas" pedido, mas RM ainda não escolhida
  const [pedindoRM, setPedindoRM] = useState(false);

  // aplica o tema salvo antes da primeira pintura
  useEffect(() => { setTema(tema); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [municipio, topNStore, filtro, municipios.length, rm, aba, cruzar]);

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


  const quebras = useMemo(() => {
    if (!municipiosVisiveis.length) return [1, 2, 3];
    const valores = municipiosVisiveis.map((m) =>
      metrica === "saldo" ? m.saldo : metrica === "tlm" ? (m.tlm ?? 0)
      : metrica === "imig" ? m.imig : metrica === "emig" ? -m.emig
      : (m.iem ?? 0) * 100);
    return quebrasSimetricas(valores);
  }, [municipiosVisiveis, metrica]);

  const selecionado = municipio ? porCodigo.get(municipio) ?? null : null;
  const aoSelecionarFluxo = useCallback((o: string, d: string) => selecionarFluxo(o, d), [selecionarFluxo]);

  const painelDireita = rm ? (
    origem && destino ? (
      aba === "mig"
        ? <PainelFluxo origem={origem} destino={destino} escuro={escuro}
                       aoFechar={() => selecionarFluxo(null, null)} aoAbrirMunicipio={selecionarMunicipio} />
        : <PainelPendular origem={origem} destino={destino} tipo={aba} escuro={escuro}
                          aoFechar={() => selecionarFluxo(null, null)} />
    ) : (
      <PainelRM cdRm={rm} aba={aba} cruzar={cruzar} topN={topNStore} escuro={escuro}
                aoMudarAba={setAba} aoMudarCruzar={setCruzar} aoSair={sairModoRM}
                aoEscolherRM={entrarModoRM} aoSelecionarFluxo={aoSelecionarFluxo} />
    )
  ) : origem && destino ? (
    <PainelFluxo origem={origem} destino={destino} escuro={escuro}
                 aoFechar={() => selecionarFluxo(null, null)} aoAbrirMunicipio={selecionarMunicipio} />
  ) : (
    <PainelMunicipio municipio={selecionado} fluxos={arcos} carregando={carregandoFluxos}
                     escuro={escuro} recorte={filtro}
                     recorteCarregando={Boolean(filtro) && !recorte}
                     aoSelecionarFluxo={aoSelecionarFluxo}
                     aoFechar={() => selecionarMunicipio(null)} />
  );

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="marca">
          <strong>Atlas da migração interna no Brasil</strong>
          <span className="muted"> · Censo 2022, data fixa 2017–2022</span>
        </div>
        <div className="controles">
          <div className="segmentado" role="group" aria-label="Modo do atlas">
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
          {!rm && <Busca municipios={municipios} aoEscolher={selecionarMunicipio} />}
          {!rm && <Filtro valor={filtro} aoMudar={setFiltro} escuro={escuro} />}
          {!rm && (
            <div className="segmentado" role="group" aria-label="Métrica do mapa">
              {METRICAS.map((m) => (
                <button key={m.valor} className={metrica === m.valor ? "ativo" : ""}
                        aria-pressed={metrica === m.valor} onClick={() => setMetrica(m.valor)}>
                  {m.rotulo}
                </button>
              ))}
            </div>
          )}
          <button className="tema" onClick={() => setTema(escuro ? "claro" : "escuro")}
                  aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}>
            {escuro ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <main className="conteudo">
        <div className="mapa">
          {!malha && !erro && <div className="carregando">Carregando o mapa…</div>}
          {erro && <div className="erro" role="alert">{erro}</div>}
          <MapaAtlas
            malha={malha} porCodigo={porCodigo} metrica={metrica} quebras={quebras}
            arcos={arcos} selecionado={municipio} escuro={escuro}
            aoSelecionar={selecionarMunicipio} aoSelecionarFluxo={aoSelecionarFluxo}
            foco={rmFoco} destacar={rmDestacar} nucleo={rmNucleo}
          />
          {municipios.length > 0 && !rm && <Legenda metrica={metrica} quebras={quebras} escuro={escuro} />}
        </div>
        {painelDireita}
      </main>

      {meta && (
        <footer className="rodape">
          {meta.aviso} Dados de {meta.versao_dados}.
        </footer>
      )}
    </div>
  );
}

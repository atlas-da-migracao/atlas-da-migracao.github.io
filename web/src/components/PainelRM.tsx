/** Painel do modo "Regiões metropolitanas": cabeçalho da RM e três abas
 *  (migração intra-RM, pendular trabalho, pendular estudo), com o comparativo
 *  entre RMs ao final. */
import { Fragment, useEffect, useMemo, useState } from "react";
import type { AbaRM } from "../state/store";
import {
  caminhosPendularDaRM, estudoPendularDaRM, fluxosIntraDaRM, listarRMs, migEstudoDaRM,
  migPendularResumoDaRM, municipiosPendularDaRM, nomesDeMunicipios, pendularDaRM, resumoDaRM,
  type FluxoPendularRM, type MigPendularResumoRM, type ResumoRM,
} from "../db/queries";
import type { Fluxo, Meta } from "../lib/types";
import { calcularRankingSaldoIntraRM, prepararSankey, type CaminhoPendular } from "../lib/rm";
import {
  CLASSE_ESTUDO, CLASSE_TRAB, cor, rotuloClasseEstudo, rotuloClasseTrab, tipologiaIntraRM,
} from "../lib/paletas";
import { useT } from "../i18n";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { ResumoSerie } from "./ResumoSerie";
import { Sankey } from "./Sankey";
import { ComparativoRM } from "./ComparativoRM";
import { AvisoProxy } from "./AvisoProxy";
import { num, num1, sinal } from "../lib/format";
import { edicao, rotuloCenso, rotuloRetornoCenso } from "../lib/edicoes";
import { useStore } from "../state/store";
import { Termo } from "./Termo";

/** nº de caminhos individuais do Sankey; o restante vira um caminho agregado */
const TOP_SANKEY = 12;

interface Props {
  cdRm: string;
  aba: AbaRM;
  cruzar: boolean;
  topN: number;
  escuro: boolean;
  meta: Meta | null;
  /** "Comparativo entre as 20 maiores RMs" aberto: estado do App, não do painel -- o painel é
   *  remontado (`key` = edição + RM) a cada troca de RM, e escolher outra RM DENTRO do
   *  comparativo não pode fechá-lo. */
  comparativoAberto: boolean;
  aoAlternarComparativo: (aberto: boolean) => void;
  aoMudarAba: (a: AbaRM) => void;
  aoMudarCruzar: (v: boolean) => void;
  aoSair: () => void;
  aoEscolherRM: (cd_rm: string) => void;
  aoSelecionarFluxo: (o: string, d: string) => void;
  aoAbrirSerie?: () => void;
}

function Kpi({ rotulo, valor, detalhe }: { rotulo: React.ReactNode; valor: string; detalhe?: React.ReactNode }) {
  return (
    <div className="kpi">
      <div className="kpi-rotulo">{rotulo}</div>
      <div className="kpi-valor">{valor}</div>
      {detalhe && <div className="kpi-detalhe">{detalhe}</div>}
    </div>
  );
}

/** Tabela compacta de fluxos, dobrando como alternativa acessível aos arcos do mapa. */
function TabelaFluxosRM({ fluxos, aoClicar }: {
  fluxos: (Fluxo & { direcao?: string })[]; aoClicar: (o: string, d: string) => void;
}) {
  const d = useT();
  if (fluxos.length === 0) return <p className="muted">{d.rm.tabelaFluxos.vazio}</p>;
  const max = Math.max(...fluxos.map((f) => f.total));
  return (
    <table className="tabela-fluxos">
      <tbody>
        {fluxos.slice(0, 12).map((f) => (
          <tr key={`${f.origem}-${f.destino}`}>
            <td>
              <button className="link-fluxo" onClick={() => aoClicar(f.origem, f.destino)}>
                {f.nm_origem}<span className="uf">/{f.uf_origem}</span>
                <span className="seta"> → </span>
                {f.nm_destino}<span className="uf">/{f.uf_destino}</span>
              </button>
            </td>
            <td className="barra-cel">
              <span className="barra" style={{ width: `${(f.total / max) * 100}%`, background: "var(--arc-in)" }} />
            </td>
            <td className="valor-cel">{num(f.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Ranking divergente (saldo intra-RM, ou qualquer outra métrica com sinal). */
function RankingDivergente({ itens, rotuloValor }: {
  itens: { nome: string; valor: number }[]; rotuloValor: (v: number) => string;
}) {
  const d = useT();
  if (itens.length === 0) return <p className="muted">{d.rm.semDados}</p>;
  const max = Math.max(1, ...itens.map((i) => Math.abs(i.valor)));
  return (
    <ul className="ranking-divergente">
      {itens.map((i) => (
        <li key={i.nome}>
          <span className="ranking-nome">{i.nome}</span>
          <span className="ranking-barra">
            <span className={i.valor < 0 ? "neg" : "pos"} style={{ width: `${(Math.abs(i.valor) / max) * 100}%` }} />
          </span>
          <span className="ranking-valor">{rotuloValor(i.valor)}</span>
        </li>
      ))}
    </ul>
  );
}

export function PainelRM({
  cdRm, aba, cruzar, topN, escuro, meta, comparativoAberto, aoAlternarComparativo, aoMudarAba, aoMudarCruzar,
  aoSair, aoEscolherRM, aoSelecionarFluxo, aoAbrirSerie,
}: Props) {
  const d = useT();
  const censo = useStore((s) => s.censo);
  const ed = edicao(censo);
  const recursos = ed.recursos;
  const anoOrigem = ed.periodo.de.slice(0, 4);
  const anoDestino = ed.periodo.ate.slice(0, 4);
  const [resumo, setResumo] = useState<ResumoRM | null>(null);
  const [rms, setRms] = useState<ResumoRM[]>([]);
  const [fluxosIntra, setFluxosIntra] = useState<(Fluxo & { tipologia: string })[]>([]);
  const [migResumo, setMigResumo] = useState<MigPendularResumoRM | null>(null);
  // entrada bruta do Sankey; o diagrama (com os nós residuais no idioma ativo) sai do useMemo abaixo,
  // para a troca de idioma não refazer a consulta
  const [sankeyEntrada, setSankeyEntrada] = useState<{ caminhos: CaminhoPendular[]; nomes: Map<string, string> } | null>(null);
  const sankeyDados = useMemo(
    () => (sankeyEntrada ? prepararSankey(sankeyEntrada.caminhos, sankeyEntrada.nomes, TOP_SANKEY, d) : null),
    [sankeyEntrada, d]);
  const [pendularTrab, setPendularTrab] = useState<FluxoPendularRM[]>([]);
  const [pendularEstudo, setPendularEstudo] = useState<FluxoPendularRM[]>([]);
  const [rankingPendular, setRankingPendular] = useState<Awaited<ReturnType<typeof municipiosPendularDaRM>>>([]);
  const [estudoResumo, setEstudoResumo] = useState<{ saida_estudo: number; entrada_estudo: number } | null>(null);
  const [migEstudo, setMigEstudo] = useState<{ classe_estudo: string; total: number }[]>([]);
  // distingue "ainda buscando" de "buscou e não achou" (cdRm inexistente nesta edição), para não
  // travar em "Carregando…" para sempre -- ver achado do auditor F9.7-b sobre `?rm=<inexistente>`.
  const [carregado, setCarregado] = useState(false);

  // Todo dado aqui é de UMA edição e de UMA RM: a edição entra nas dependências de todos os
  // efeitos abaixo (as consultas vão para a conexão DuckDB da edição ativa) e, quando ela ou a
  // RM mudam, tudo é zerado ANTES de qualquer consulta nova -- senão o painel mostra os números
  // da edição anterior sob o título da nova, e os KPIs/Sankey/tabelas nunca recarregam. O App
  // também remonta o painel por `key={censo:rm}`; isto mantém o componente correto sozinho.
  // Este efeito vem antes dos de dados, então roda primeiro no mesmo commit; os `setX` das
  // consultas só chegam depois (assíncronos), sem risco de serem apagados por ele.
  useEffect(() => {
    setResumo(null); setCarregado(false); setFluxosIntra([]); setMigResumo(null); setSankeyEntrada(null);
    setPendularTrab([]); setPendularEstudo([]); setRankingPendular([]); setEstudoResumo(null);
    setMigEstudo([]);
  }, [censo, cdRm]);

  // dados que não dependem da aba
  useEffect(() => {
    let vivo = true;
    Promise.all([resumoDaRM(cdRm), fluxosIntraDaRM(cdRm)]).then(([r, f]) => {
      if (!vivo) return;
      setResumo(r); setFluxosIntra(f);
    }).catch((e) => { console.error(e); })
      .finally(() => { if (vivo) setCarregado(true); });
    return () => { vivo = false; };
  }, [cdRm, censo]);

  useEffect(() => {
    let vivo = true;
    setRms([]);
    listarRMs().then((r) => { if (vivo) setRms(r); }).catch((e) => { console.error(e); });
    return () => { vivo = false; };
  }, [censo]);

  // aba "mig": sub-painel migrantes e trabalho -- só existe em edições com deslocamento
  // pendular (ver lib/edicoes.ts); em 1991 as tabelas rm_mig_pendular* nem são registradas
  // na conexão DuckDB (ver db/duckdb.ts), então a consulta nem pode ser disparada.
  useEffect(() => {
    if (aba !== "mig" || !recursos.pendular) return;
    let vivo = true;
    migPendularResumoDaRM(cdRm).then((r) => { if (vivo) setMigResumo(r); })
      .catch((e) => { console.error(e); });
    caminhosPendularDaRM(cdRm).then(async (caminhos) => {
      const codigos = [...new Set(caminhos.flatMap((c) => [c.origem_mig, c.destino_mig, c.destino_trab]))];
      const nomes = await nomesDeMunicipios(codigos);
      const mapa = new Map(nomes.map((n) => [n.cd_mun, `${n.nm_mun}/${n.uf_sigla}`]));
      if (vivo) setSankeyEntrada({ caminhos, nomes: mapa });
    }).catch((e) => {
      // sem isto o diagrama ficaria em "Carregando…" para sempre; vazio cai no aviso de "insuficientes"
      console.error(e);
      if (vivo) setSankeyEntrada({ caminhos: [], nomes: new Map() });
    });
    return () => { vivo = false; };
  }, [cdRm, aba, censo, recursos.pendular]);

  // aba "trab"
  useEffect(() => {
    if (aba !== "trab") return;
    let vivo = true;
    Promise.all([pendularDaRM(cdRm, "pendular_trab", topN, cruzar), municipiosPendularDaRM(cdRm)])
      .then(([p, r]) => { if (vivo) { setPendularTrab(p); setRankingPendular(r); } })
      .catch((e) => { console.error(e); });
    return () => { vivo = false; };
  }, [cdRm, aba, topN, cruzar, censo]);

  // aba "estudo"
  useEffect(() => {
    if (aba !== "estudo") return;
    let vivo = true;
    Promise.all([pendularDaRM(cdRm, "pendular_estudo", topN, cruzar), estudoPendularDaRM(cdRm), migEstudoDaRM(cdRm)])
      .then(([p, r, e]) => { if (vivo) { setPendularEstudo(p); setEstudoResumo(r); setMigEstudo(e); } })
      .catch((e) => { console.error(e); });
    return () => { vivo = false; };
  }, [cdRm, aba, topN, cruzar, censo]);

  const rankingSaldo = useMemo(() => {
    const nomes = new Map<string, string>();
    for (const f of fluxosIntra) {
      nomes.set(f.origem, `${f.nm_origem}/${f.uf_origem}`);
      nomes.set(f.destino, `${f.nm_destino}/${f.uf_destino}`);
    }
    const r = calcularRankingSaldoIntraRM(fluxosIntra);
    const relevantes = r.filter((x) => x.saldo !== 0);
    return [...relevantes.slice(0, 6), ...relevantes.slice(-6)]
      .filter((x, i, arr) => arr.findIndex((y) => y.cd_mun === x.cd_mun) === i)
      .map((x) => ({ nome: nomes.get(x.cd_mun) ?? x.cd_mun, valor: x.saldo }))
      .sort((a, b) => b.valor - a.valor);
  }, [fluxosIntra]);

  const rankingTaxaSaida = useMemo(() =>
    [...rankingPendular].filter((r) => r.taxa_saida_pendular != null && r.ocupados >= 1000)
      .sort((a, b) => (b.taxa_saida_pendular ?? 0) - (a.taxa_saida_pendular ?? 0)).slice(0, 8),
  [rankingPendular]);
  const rankingAtracao = useMemo(() =>
    [...rankingPendular].filter((r) => r.indice_atracao != null)
      .sort((a, b) => (b.indice_atracao ?? 0) - (a.indice_atracao ?? 0)).slice(0, 8),
  [rankingPendular]);

  if (!resumo) {
    return (
      <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
        {carregado ? (
          <div className="vazio">
            <h2>{d.rm.painel.tituloVazio}</h2>
            <div className="aviso" role="note">
              <p>
                {d.rm.painel.naoExisteNaEdicao(<strong>{rotuloCenso(ed.nome, d)}</strong>)
                  .map((p, i) => <Fragment key={i}>{p}</Fragment>)}
              </p>
              <button type="button" className="link-metodologia" onClick={aoSair}>
                {d.rm.painel.voltarBrasil}
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">{d.rm.painel.carregando}</p>
        )}
      </aside>
    );
  }

  const totalIntra = resumo.mig_intra || 1;

  return (
    <aside className="painel painel-rm">
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">
            {resumo.tipo === "RIDE" ? <Termo chave="ride">RIDE</Termo> : d.comum.niveis.rm.titulo}
          </div>
          <h2>{resumo.nm_rm}</h2>
          <div className="muted">
            {d.rm.painel.linhaResumo(
              `${resumo.nm_nucleo}${resumo.nucleo_uf ? `/${resumo.nucleo_uf}` : ""}`, resumo.n_municipios, num(resumo.pop))}
          </div>
        </div>
        <button className="fechar" onClick={aoSair} aria-label={d.rm.painel.sairModoRM}>×</button>
      </header>

      {recursos.pendular && (
        <div className="segmentado abas-rm" role="group" aria-label={d.rm.painel.abasAria}>
          <button className={aba === "mig" ? "ativo" : ""} onClick={() => aoMudarAba("mig")}>
            {d.rm.painel.abas.mig}
          </button>
          <button className={aba === "trab" ? "ativo" : ""} onClick={() => aoMudarAba("trab")}>
            {d.rm.painel.abas.trab}
          </button>
          <button className={aba === "estudo" ? "ativo" : ""} onClick={() => aoMudarAba("estudo")}>
            {d.rm.painel.abas.estudo}
          </button>
        </div>
      )}

      {recursos.pendular && (aba === "trab" || aba === "estudo") && (
        <label className="checkbox-cruzar">
          <input type="checkbox" checked={cruzar} onChange={(e) => aoMudarCruzar(e.target.checked)} />
          {d.rm.painel.incluirCruzam}
        </label>
      )}

      {aba === "mig" && (
        <>
          <AvisoProxy meta={meta} />

          <div className="kpis">
            <Kpi rotulo={<Termo chave="rm_migracao_intra">{d.rm.mig.migrantesIntra}</Termo>} valor={num(resumo.mig_intra)} />
            <Kpi rotulo={<Termo chave="rm_saldo_externo">{d.rm.mig.saldoExterno}</Termo>} valor={sinal(resumo.saldo_externo)}
                 detalhe={d.rm.mig.entradasSaidas(num(resumo.entradas_externas), num(resumo.saidas_externas))} />
            <Kpi rotulo={<Termo chave="rm_nucleo_periferia">{d.comum.categorias.tipologia.nucleo_periferia}</Termo>} valor={d.rm.pct(num1((resumo.nucleo_periferia / totalIntra) * 100))}
                 detalhe={num(resumo.nucleo_periferia)} />
          </div>

          {aoAbrirSerie && (
            <ResumoSerie nivel="rm" codigo={cdRm} nome={resumo.nm_rm} aoAbrirSerieCompleta={aoAbrirSerie} />
          )}

          <h3 className="secao-titulo"><Termo chave="rm_nucleo_periferia">{d.rm.mig.matrizTitulo}</Termo></h3>
          <table className="matriz-np">
            <thead>
              <tr><th /><th>{d.rm.mig.destinoNucleo}</th><th>{d.rm.mig.destinoPeriferia}</th></tr>
            </thead>
            <tbody>
              <tr>
                <th>{d.rm.mig.origemNucleo}</th>
                <td className="valor-cel">—</td>
                <td className="valor-cel">
                  {num(resumo.nucleo_periferia)} <span className="muted-pequeno">
                    ({d.rm.pct(num1((resumo.nucleo_periferia / totalIntra) * 100))})</span>
                </td>
              </tr>
              <tr>
                <th>{d.rm.mig.origemPeriferia}</th>
                <td className="valor-cel">
                  {num(resumo.periferia_nucleo)} <span className="muted-pequeno">
                    ({d.rm.pct(num1((resumo.periferia_nucleo / totalIntra) * 100))})</span>
                </td>
                <td className="valor-cel">
                  {num(resumo.periferia_periferia)} <span className="muted-pequeno">
                    ({d.rm.pct(num1((resumo.periferia_periferia / totalIntra) * 100))})</span>
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="secao-titulo">{d.rm.mig.saldoPorMunicipio}</h3>
          <RankingDivergente itens={rankingSaldo} rotuloValor={sinal} />

          <h3 className="secao-titulo">{d.rm.mig.principaisFluxos}</h3>
          <p className="muted-pequeno explicacao">
            {d.rm.mig.cliquePerfil}
          </p>
          <TabelaFluxosRM fluxos={fluxosIntra} aoClicar={aoSelecionarFluxo} />
          <ul className="perfil-legenda">
            {tipologiaIntraRM(d).categorias.map((c) => (
              <li key={c.chave}>
                <span className="amostra pequena" style={{ background: cor(c.cor, escuro) }} /> {c.rotulo}
              </li>
            ))}
          </ul>

          {recursos.pendular && (
          <>
          <h3 className="secao-titulo">{d.rm.migTrab.titulo}</h3>
          {migResumo && (
            <div className="kpis">
              <Kpi rotulo={d.rm.migTrab.ocupados} valor={num(migResumo.mig_ocupados)} />
              <Kpi rotulo={d.rm.migTrab.fazemPendular}
                   valor={migResumo.mig_ocupados > 0
                     ? d.rm.pct(num1((migResumo.mig_pendulares / migResumo.mig_ocupados) * 100))
                     : "—"}
                   detalhe={num(migResumo.mig_pendulares)} />
              <Kpi rotulo={d.rm.migTrab.voltamOrigem}
                   valor={migResumo.mig_ocupados > 0
                     ? d.rm.pct(num1((migResumo.pendular_para_origem / migResumo.mig_ocupados) * 100)) : "—"} />
              <Kpi rotulo={d.rm.migTrab.trabalhamNucleo}
                   valor={migResumo.mig_ocupados > 0
                     ? d.rm.pct(num1((migResumo.pendular_para_nucleo / migResumo.mig_ocupados) * 100)) : "—"} />
              <Kpi rotulo={d.rm.migTrab.trabalhamOndeMoram}
                   valor={migResumo.mig_ocupados > 0
                     ? d.rm.pct(num1((migResumo.trabalha_onde_mora / migResumo.mig_ocupados) * 100)) : "—"} />
            </div>
          )}
          <p className="muted-pequeno explicacao">
            {d.rm.migTrab.explicacao(anoOrigem, anoDestino, TOP_SANKEY, d.comum.sankeyResidual.municipios)}
          </p>
          {sankeyDados && sankeyDados.links.length > 0 ? (
            <>
              <Sankey dados={sankeyDados} escuro={escuro} anoOrigem={anoOrigem} anoDestino={anoDestino} />
              <ul className="perfil-legenda">
                {(["origem", "nucleo", "outro"] as const).map((k) => (
                  <li key={k}>
                    <span className="amostra pequena" style={{ background: cor(CLASSE_TRAB[k].cor, escuro) }} />
                    {rotuloClasseTrab(k, d)}
                  </li>
                ))}
              </ul>
              <details className="tabela-alternativa">
                <summary>{d.rm.migTrab.verTabela}</summary>
                <table className="tabela-fluxos">
                  <thead>
                    <tr><th>{d.rm.migTrab.colOrigem(anoOrigem)}</th><th>{d.rm.migTrab.colResidencia(anoDestino)}</th>
                        <th>{d.rm.migTrab.colTrabalho(anoDestino)}</th>
                        <th>{d.rm.migTrab.colClasse}</th><th>{d.rm.migTrab.colTotal}</th><th>{d.rm.migTrab.colFaixaN}</th></tr>
                  </thead>
                  <tbody>
                    {sankeyDados.caminhos.map((c, i) => (
                      <tr key={i}>
                        <td>{c.origem}</td>
                        <td>{c.residencia}</td>
                        <td>{c.trabalho}</td>
                        <td>{rotuloClasseTrab(c.classe, d)}</td>
                        <td className="valor-cel">{num(c.total)}</td>
                        <td className="muted-pequeno">{c.n_faixa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : sankeyDados == null ? (
            <p className="muted">{d.rm.migTrab.carregandoDiagrama}</p>
          ) : (
            <p className="muted">{d.rm.migTrab.caminhosInsuficientes}</p>
          )}
          </>
          )}
        </>
      )}

      {recursos.pendular && aba === "trab" && (
        <>
          <div className="kpis">
            <Kpi rotulo={d.rm.trab.ocupados} valor={num(resumo.ocupados)} />
            <Kpi rotulo={<Termo chave="pendular_conceito">{d.rm.trab.pendulares}</Termo>} valor={num(resumo.pendulares)}
                 detalhe={resumo.pct_pendular != null ? d.rm.trab.pctDosOcupados(num1(resumo.pct_pendular)) : undefined} />
            {recursos.tempoMinutos && (
              <Kpi rotulo={<Termo chave="pendular_tempo_mediano">{d.rm.trab.tempoMediano}</Termo>} valor={resumo.tempo_mediano != null ? d.rm.min(num(resumo.tempo_mediano)) : "—"} />
            )}
            {ed.rotuloRetorno != null && (
              <Kpi rotulo={<Termo chave="pendular_retorno_diario">{d.rm.trab.retornoDiario}</Termo>} valor={resumo.pct_diario != null ? d.rm.pct(num1(resumo.pct_diario)) : "—"}
                   detalhe={rotuloRetornoCenso(ed.nome, d)} />
            )}
            {recursos.modo && (
              <Kpi rotulo={<Termo chave="pendular_pct_coletivo">{d.rm.trab.transporteColetivo}</Termo>} valor={resumo.pct_coletivo != null ? d.rm.pct(num1(resumo.pct_coletivo)) : "—"} />
            )}
          </div>

          <h3 className="secao-titulo"><Termo chave="pendular_taxa_saida">{d.rm.trab.maiorTaxaSaida}</Termo></h3>
          <RankingDivergente
            itens={rankingTaxaSaida.map((r) => ({ nome: `${r.nm_mun}/${r.uf_sigla}`, valor: r.taxa_saida_pendular ?? 0 }))}
            rotuloValor={(v) => d.rm.pct(num1(v))} />

          <h3 className="secao-titulo"><Termo chave="pendular_indice_atracao">{d.rm.trab.maiorIndiceAtracao}</Termo></h3>
          <RankingDivergente
            itens={rankingAtracao.map((r) => ({ nome: `${r.nm_mun}/${r.uf_sigla}`, valor: r.indice_atracao ?? 0 }))}
            rotuloValor={(v) => num1(v)} />

          <h3 className="secao-titulo">{d.rm.trab.principaisFluxos}</h3>
          <p className="muted-pequeno explicacao">{d.rm.trab.cliqueCaracterizacao}</p>
          <TabelaFluxosRM fluxos={pendularTrab.filter((f) => !f.cruza)} aoClicar={aoSelecionarFluxo} />
          {cruzar && pendularTrab.some((f) => f.cruza) && (
            <>
              <h4 className="muted-pequeno">{d.rm.painel.cruzamLimite}</h4>
              <TabelaFluxosRM fluxos={pendularTrab.filter((f) => f.cruza)} aoClicar={aoSelecionarFluxo} />
            </>
          )}
        </>
      )}

      {recursos.pendular && aba === "estudo" && (
        <>
          <div className="kpis">
            <Kpi rotulo={d.rm.estudo.estudantesPendulares} valor={num(estudoResumo?.saida_estudo ?? 0)} />
            <Kpi rotulo={d.rm.estudo.entradasPorEstudo} valor={num(estudoResumo?.entrada_estudo ?? 0)} />
          </div>

          {/* 2000 e 1980 têm um único quesito "trabalha ou estuda?", com precedência do
              trabalho: quem trabalha no próprio município e estuda em outro só aparece no fluxo
              de trabalho. O deslocamento por estudo é, portanto, um piso -- ver
              `Edicao.pendularCampoUnico` (lib/edicoes.ts) e docs/METODOLOGIA.md, "Edição Censo
              2000 e comparabilidade" / "Edição Censo 1980 e comparabilidade". */}
          {ed.pendularCampoUnico && (
            <p className="muted-pequeno explicacao">
              {d.rm.estudo.piso}
            </p>
          )}

          <h3 className="secao-titulo">{d.rm.estudo.principaisFluxos}</h3>
          <p className="muted-pequeno explicacao">{d.rm.trab.cliqueCaracterizacao}</p>
          <TabelaFluxosRM fluxos={pendularEstudo.filter((f) => !f.cruza)} aoClicar={aoSelecionarFluxo} />
          {cruzar && pendularEstudo.some((f) => f.cruza) && (
            <>
              <h4 className="muted-pequeno">{d.rm.painel.cruzamLimite}</h4>
              <TabelaFluxosRM fluxos={pendularEstudo.filter((f) => f.cruza)} aoClicar={aoSelecionarFluxo} />
            </>
          )}

          <h3 className="secao-titulo">{d.rm.estudo.migEstudamOutro}</h3>
          {migEstudo.length > 0 ? (
            <BarraPerfil
              titulo={d.rm.estudo.ondeEstudam}
              categorias={migEstudo.map((m) => ({
                chave: m.classe_estudo,
                rotulo: rotuloClasseEstudo(m.classe_estudo, d),
                cor: (CLASSE_ESTUDO as Record<string, { cor: { claro: string; escuro: string } }>)[m.classe_estudo]?.cor
                  ?? { claro: "#c3c2b7", escuro: "#52514e" },
              }))}
              series={[{
                rotulo: d.rm.estudo.migrantesQueEstudam,
                valores: Object.fromEntries(migEstudo.map((m) => [m.classe_estudo, m.total])),
                destaque: true,
              } satisfies SeriePerfil]}
              escuro={escuro}
            />
          ) : (
            <p className="muted">{d.rm.semDados}</p>
          )}
        </>
      )}

      <details className="comparativo-toggle" open={comparativoAberto}
                onToggle={(e) => aoAlternarComparativo((e.target as HTMLDetailsElement).open)}>
        <summary>{d.rm.painel.comparativoTitulo}</summary>
        {comparativoAberto && <ComparativoRM rms={rms} ativa={cdRm} censo={censo} aoEscolher={aoEscolherRM} />}
      </details>
    </aside>
  );
}

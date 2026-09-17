/** Painel do modo "Regiões metropolitanas": cabeçalho da RM e três abas
 *  (migração intra-RM, pendular trabalho, pendular estudo), com o comparativo
 *  entre RMs ao final. */
import { useEffect, useMemo, useState } from "react";
import type { AbaRM } from "../state/store";
import {
  caminhosPendularDaRM, estudoPendularDaRM, fluxosIntraDaRM, listarRMs, migEstudoDaRM,
  migPendularResumoDaRM, municipiosPendularDaRM, nomesDeMunicipios, pendularDaRM, resumoDaRM,
  type FluxoPendularRM, type MigPendularResumoRM, type ResumoRM,
} from "../db/queries";
import type { Fluxo, Meta } from "../lib/types";
import { calcularRankingSaldoIntraRM, prepararSankey } from "../lib/rm";
import { CLASSE_ESTUDO, CLASSE_TRAB, TIPOLOGIA_INTRA_RM, cor } from "../lib/paletas";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { ResumoSerie } from "./ResumoSerie";
import { Sankey } from "./Sankey";
import { ComparativoRM } from "./ComparativoRM";
import { AvisoProxy } from "./AvisoProxy";
import { num, num1, sinal } from "../lib/format";
import { edicao } from "../lib/edicoes";
import { useStore } from "../state/store";
import { Termo } from "./Termo";

interface Props {
  cdRm: string;
  aba: AbaRM;
  cruzar: boolean;
  topN: number;
  escuro: boolean;
  meta: Meta | null;
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
  if (fluxos.length === 0) return <p className="muted">Nenhum fluxo acima do limiar de divulgação.</p>;
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
  if (itens.length === 0) return <p className="muted">Sem dados suficientes.</p>;
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
  cdRm, aba, cruzar, topN, escuro, meta, aoMudarAba, aoMudarCruzar, aoSair, aoEscolherRM, aoSelecionarFluxo,
  aoAbrirSerie,
}: Props) {
  const censo = useStore((s) => s.censo);
  const ed = edicao(censo);
  const recursos = ed.recursos;
  const anoOrigem = ed.periodo.de.slice(0, 4);
  const anoDestino = ed.periodo.ate.slice(0, 4);
  const [resumo, setResumo] = useState<ResumoRM | null>(null);
  const [rms, setRms] = useState<ResumoRM[]>([]);
  const [fluxosIntra, setFluxosIntra] = useState<(Fluxo & { tipologia: string })[]>([]);
  const [migResumo, setMigResumo] = useState<MigPendularResumoRM | null>(null);
  const [sankeyDados, setSankeyDados] = useState<ReturnType<typeof prepararSankey> | null>(null);
  const [pendularTrab, setPendularTrab] = useState<FluxoPendularRM[]>([]);
  const [pendularEstudo, setPendularEstudo] = useState<FluxoPendularRM[]>([]);
  const [rankingPendular, setRankingPendular] = useState<Awaited<ReturnType<typeof municipiosPendularDaRM>>>([]);
  const [estudoResumo, setEstudoResumo] = useState<{ saida_estudo: number; entrada_estudo: number } | null>(null);
  const [migEstudo, setMigEstudo] = useState<{ classe_estudo: string; total: number }[]>([]);
  const [mostrarComparativo, setMostrarComparativo] = useState(false);
  // distingue "ainda buscando" de "buscou e não achou" (cdRm inexistente nesta edição), para não
  // travar em "Carregando…" para sempre -- ver achado do auditor F9.7-b sobre `?rm=<inexistente>`.
  const [carregado, setCarregado] = useState(false);

  // dados que não dependem da aba
  useEffect(() => {
    let vivo = true;
    setCarregado(false);
    Promise.all([resumoDaRM(cdRm), fluxosIntraDaRM(cdRm)]).then(([r, f]) => {
      if (!vivo) return;
      setResumo(r); setFluxosIntra(f);
    }).finally(() => { if (vivo) setCarregado(true); });
    return () => { vivo = false; };
  }, [cdRm]);

  useEffect(() => { listarRMs().then(setRms); }, []);

  // aba "mig": sub-painel migrantes e trabalho -- só existe em edições com deslocamento
  // pendular (ver lib/edicoes.ts); em 1991 as tabelas rm_mig_pendular* nem são registradas
  // na conexão DuckDB (ver db/duckdb.ts), então a consulta nem pode ser disparada.
  useEffect(() => {
    if (aba !== "mig" || !recursos.pendular) return;
    let vivo = true;
    migPendularResumoDaRM(cdRm).then((r) => { if (vivo) setMigResumo(r); });
    caminhosPendularDaRM(cdRm).then(async (caminhos) => {
      const codigos = [...new Set(caminhos.flatMap((c) => [c.origem_mig, c.destino_mig, c.destino_trab]))];
      const nomes = await nomesDeMunicipios(codigos);
      const mapa = new Map(nomes.map((n) => [n.cd_mun, `${n.nm_mun}/${n.uf_sigla}`]));
      if (vivo) setSankeyDados(prepararSankey(caminhos, mapa, 12));
    });
    return () => { vivo = false; };
  }, [cdRm, aba]);

  // aba "trab"
  useEffect(() => {
    if (aba !== "trab") return;
    let vivo = true;
    Promise.all([pendularDaRM(cdRm, "pendular_trab", topN, cruzar), municipiosPendularDaRM(cdRm)])
      .then(([p, r]) => { if (vivo) { setPendularTrab(p); setRankingPendular(r); } });
    return () => { vivo = false; };
  }, [cdRm, aba, topN, cruzar]);

  // aba "estudo"
  useEffect(() => {
    if (aba !== "estudo") return;
    let vivo = true;
    Promise.all([pendularDaRM(cdRm, "pendular_estudo", topN, cruzar), estudoPendularDaRM(cdRm), migEstudoDaRM(cdRm)])
      .then(([p, r, e]) => { if (vivo) { setPendularEstudo(p); setEstudoResumo(r); setMigEstudo(e); } });
    return () => { vivo = false; };
  }, [cdRm, aba, topN, cruzar]);

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
      <aside className="painel" aria-label="Painel de detalhes">
        {carregado ? (
          <div className="vazio">
            <h2>Atlas da migração interna</h2>
            <div className="aviso" role="note">
              <p>
                Esta região metropolitana não existe na edição <strong>{ed.rotulo}</strong>{" "}
                selecionada — edições antigas podem cobrir um território menor ou ter divisão
                administrativa diferente.
              </p>
              <button type="button" className="link-metodologia" onClick={aoSair}>
                Voltar para o Brasil
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">Carregando a região metropolitana…</p>
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
            {resumo.tipo === "RIDE" ? <Termo chave="ride">RIDE</Termo> : "Região metropolitana"}
          </div>
          <h2>{resumo.nm_rm}</h2>
          <div className="muted">
            Núcleo: {resumo.nm_nucleo}{resumo.nucleo_uf && `/${resumo.nucleo_uf}`} ·{" "}
            {resumo.n_municipios} {resumo.n_municipios === 1 ? "município" : "municípios"} · {num(resumo.pop)} habitantes
          </div>
        </div>
        <button className="fechar" onClick={aoSair} aria-label="Sair do modo RM">×</button>
      </header>

      {recursos.pendular && (
        <div className="segmentado abas-rm" role="group" aria-label="Aba do painel metropolitano">
          <button className={aba === "mig" ? "ativo" : ""} onClick={() => aoMudarAba("mig")}>
            Migração intra-RM
          </button>
          <button className={aba === "trab" ? "ativo" : ""} onClick={() => aoMudarAba("trab")}>
            Pendular trabalho
          </button>
          <button className={aba === "estudo" ? "ativo" : ""} onClick={() => aoMudarAba("estudo")}>
            Pendular estudo
          </button>
        </div>
      )}

      {recursos.pendular && (aba === "trab" || aba === "estudo") && (
        <label className="checkbox-cruzar">
          <input type="checkbox" checked={cruzar} onChange={(e) => aoMudarCruzar(e.target.checked)} />
          Incluir fluxos que cruzam o limite da RM
        </label>
      )}

      {aba === "mig" && (
        <>
          <AvisoProxy meta={meta} />

          <div className="kpis">
            <Kpi rotulo={<Termo chave="rm_migracao_intra">Migrantes intra-RM</Termo>} valor={num(resumo.mig_intra)} />
            <Kpi rotulo={<Termo chave="rm_saldo_externo">Saldo com o resto do país</Termo>} valor={sinal(resumo.saldo_externo)}
                 detalhe={`entradas ${num(resumo.entradas_externas)} · saídas ${num(resumo.saidas_externas)}`} />
            <Kpi rotulo={<Termo chave="rm_nucleo_periferia">Núcleo → periferia</Termo>} valor={`${num1((resumo.nucleo_periferia / totalIntra) * 100)}%`}
                 detalhe={num(resumo.nucleo_periferia)} />
          </div>

          {aoAbrirSerie && (
            <ResumoSerie nivel="rm" codigo={cdRm} nome={resumo.nm_rm} aoAbrirSerieCompleta={aoAbrirSerie} />
          )}

          <h3 className="secao-titulo"><Termo chave="rm_nucleo_periferia">Matriz núcleo × periferia</Termo></h3>
          <table className="matriz-np">
            <thead>
              <tr><th /><th>Destino núcleo</th><th>Destino periferia</th></tr>
            </thead>
            <tbody>
              <tr>
                <th>Origem núcleo</th>
                <td className="valor-cel">—</td>
                <td className="valor-cel">
                  {num(resumo.nucleo_periferia)} <span className="muted-pequeno">
                    ({num1((resumo.nucleo_periferia / totalIntra) * 100)}%)</span>
                </td>
              </tr>
              <tr>
                <th>Origem periferia</th>
                <td className="valor-cel">
                  {num(resumo.periferia_nucleo)} <span className="muted-pequeno">
                    ({num1((resumo.periferia_nucleo / totalIntra) * 100)}%)</span>
                </td>
                <td className="valor-cel">
                  {num(resumo.periferia_periferia)} <span className="muted-pequeno">
                    ({num1((resumo.periferia_periferia / totalIntra) * 100)}%)</span>
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="secao-titulo">Saldo intra-RM por município</h3>
          <RankingDivergente itens={rankingSaldo} rotuloValor={sinal} />

          <h3 className="secao-titulo">Principais fluxos intra-RM</h3>
          <p className="muted-pequeno explicacao">
            Clique em uma linha para ver o perfil completo dos migrantes deste par.
          </p>
          <TabelaFluxosRM fluxos={fluxosIntra} aoClicar={aoSelecionarFluxo} />
          <ul className="perfil-legenda">
            {TIPOLOGIA_INTRA_RM.categorias.map((c) => (
              <li key={c.chave}>
                <span className="amostra pequena" style={{ background: cor(c.cor, escuro) }} /> {c.rotulo}
              </li>
            ))}
          </ul>

          {recursos.pendular && (
          <>
          <h3 className="secao-titulo">Migrantes e trabalho</h3>
          {migResumo && (
            <div className="kpis">
              <Kpi rotulo="Migrantes ocupados" valor={num(migResumo.mig_ocupados)} />
              <Kpi rotulo="Fazem pendular"
                   valor={migResumo.mig_ocupados > 0
                     ? `${num1((migResumo.mig_pendulares / migResumo.mig_ocupados) * 100)}%`
                     : "—"}
                   detalhe={num(migResumo.mig_pendulares)} />
              <Kpi rotulo="Voltam a trabalhar na origem"
                   valor={migResumo.mig_ocupados > 0
                     ? `${num1((migResumo.pendular_para_origem / migResumo.mig_ocupados) * 100)}%` : "—"} />
              <Kpi rotulo="Trabalham no núcleo"
                   valor={migResumo.mig_ocupados > 0
                     ? `${num1((migResumo.pendular_para_nucleo / migResumo.mig_ocupados) * 100)}%` : "—"} />
              <Kpi rotulo="Trabalham onde moram"
                   valor={migResumo.mig_ocupados > 0
                     ? `${num1((migResumo.trabalha_onde_mora / migResumo.mig_ocupados) * 100)}%` : "—"} />
            </div>
          )}
          <p className="muted-pequeno explicacao">
            Morava em ({anoOrigem}) → mora em ({anoDestino}) → trabalha em ({anoDestino}), para os 12
            maiores caminhos da RM com destino de trabalho conhecido; o restante aparece agregado em
            "Outros municípios".
          </p>
          {sankeyDados && sankeyDados.links.length > 0 ? (
            <>
              <Sankey dados={sankeyDados} escuro={escuro} anoOrigem={anoOrigem} anoDestino={anoDestino} />
              <ul className="perfil-legenda">
                {(["origem", "nucleo", "outro"] as const).map((k) => (
                  <li key={k}>
                    <span className="amostra pequena" style={{ background: cor(CLASSE_TRAB[k].cor, escuro) }} />
                    {CLASSE_TRAB[k].rotulo}
                  </li>
                ))}
              </ul>
              <details className="tabela-alternativa">
                <summary>Ver como tabela</summary>
                <table className="tabela-fluxos">
                  <thead>
                    <tr><th>Origem ({anoOrigem})</th><th>Residência ({anoDestino})</th>
                        <th>Trabalho ({anoDestino})</th>
                        <th>Classe</th><th>Total</th><th>Faixa de n</th></tr>
                  </thead>
                  <tbody>
                    {sankeyDados.caminhos.map((c, i) => (
                      <tr key={i}>
                        <td>{c.origem}</td>
                        <td>{c.residencia}</td>
                        <td>{c.trabalho}</td>
                        <td>{(CLASSE_TRAB as Record<string, { rotulo: string }>)[c.classe]?.rotulo ?? c.classe}</td>
                        <td className="valor-cel">{num(c.total)}</td>
                        <td className="muted-pequeno">{c.n_faixa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <p className="muted">Caminhos insuficientes para o diagrama nesta RM.</p>
          )}
          </>
          )}
        </>
      )}

      {recursos.pendular && aba === "trab" && (
        <>
          <div className="kpis">
            <Kpi rotulo="Ocupados" valor={num(resumo.ocupados)} />
            <Kpi rotulo={<Termo chave="pendular_conceito">Pendulares</Termo>} valor={num(resumo.pendulares)}
                 detalhe={resumo.pct_pendular != null ? `${num1(resumo.pct_pendular)}% dos ocupados` : undefined} />
            {recursos.tempoMinutos && (
              <Kpi rotulo={<Termo chave="pendular_tempo_mediano">Tempo mediano</Termo>} valor={resumo.tempo_mediano != null ? `${num(resumo.tempo_mediano)} min` : "—"} />
            )}
            {ed.rotuloRetorno != null && (
              <Kpi rotulo={<Termo chave="pendular_retorno_diario">Retorno diário</Termo>} valor={resumo.pct_diario != null ? `${num1(resumo.pct_diario)}%` : "—"}
                   detalhe={ed.rotuloRetorno} />
            )}
            {recursos.modo && (
              <Kpi rotulo={<Termo chave="pendular_pct_coletivo">Transporte coletivo</Termo>} valor={resumo.pct_coletivo != null ? `${num1(resumo.pct_coletivo)}%` : "—"} />
            )}
          </div>

          <h3 className="secao-titulo"><Termo chave="pendular_taxa_saida">Maior taxa de saída pendular</Termo></h3>
          <RankingDivergente
            itens={rankingTaxaSaida.map((r) => ({ nome: `${r.nm_mun}/${r.uf_sigla}`, valor: r.taxa_saida_pendular ?? 0 }))}
            rotuloValor={(v) => `${num1(v)}%`} />

          <h3 className="secao-titulo"><Termo chave="pendular_indice_atracao">Maior índice de atração</Termo></h3>
          <RankingDivergente
            itens={rankingAtracao.map((r) => ({ nome: `${r.nm_mun}/${r.uf_sigla}`, valor: r.indice_atracao ?? 0 }))}
            rotuloValor={(v) => num1(v)} />

          <h3 className="secao-titulo">Principais fluxos pendulares</h3>
          <p className="muted-pequeno explicacao">Clique em uma linha para ver a caracterização do fluxo.</p>
          <TabelaFluxosRM fluxos={pendularTrab.filter((f) => !f.cruza)} aoClicar={aoSelecionarFluxo} />
          {cruzar && pendularTrab.some((f) => f.cruza) && (
            <>
              <h4 className="muted-pequeno">Fluxos que cruzam o limite da RM</h4>
              <TabelaFluxosRM fluxos={pendularTrab.filter((f) => f.cruza)} aoClicar={aoSelecionarFluxo} />
            </>
          )}
        </>
      )}

      {recursos.pendular && aba === "estudo" && (
        <>
          <div className="kpis">
            <Kpi rotulo="Estudantes pendulares da RM" valor={num(estudoResumo?.saida_estudo ?? 0)} />
            <Kpi rotulo="Entradas por estudo" valor={num(estudoResumo?.entrada_estudo ?? 0)} />
          </div>

          {/* 2000 e 1980 têm um único quesito "trabalha ou estuda?", com precedência do
              trabalho: quem trabalha no próprio município e estuda em outro só aparece no fluxo
              de trabalho. O deslocamento por estudo é, portanto, um piso -- ver
              `Edicao.pendularCampoUnico` (lib/edicoes.ts) e docs/METODOLOGIA.md, "Edição Censo
              2000 e comparabilidade" / "Edição Censo 1980 e comparabilidade". */}
          {ed.pendularCampoUnico && (
            <p className="muted-pequeno explicacao">
              Piso, não estimativa do total: esta edição tem um único quesito de trabalho/estudo,
              com precedência do trabalho, e por isso este fluxo cobre só estudantes não ocupados.
            </p>
          )}

          <h3 className="secao-titulo">Principais fluxos pendulares de estudo</h3>
          <p className="muted-pequeno explicacao">Clique em uma linha para ver a caracterização do fluxo.</p>
          <TabelaFluxosRM fluxos={pendularEstudo.filter((f) => !f.cruza)} aoClicar={aoSelecionarFluxo} />
          {cruzar && pendularEstudo.some((f) => f.cruza) && (
            <>
              <h4 className="muted-pequeno">Fluxos que cruzam o limite da RM</h4>
              <TabelaFluxosRM fluxos={pendularEstudo.filter((f) => f.cruza)} aoClicar={aoSelecionarFluxo} />
            </>
          )}

          <h3 className="secao-titulo">Migrantes intra-RM que estudam em outro município</h3>
          {migEstudo.length > 0 ? (
            <BarraPerfil
              titulo="Onde estudam"
              categorias={migEstudo.map((m) => ({
                chave: m.classe_estudo,
                rotulo: (CLASSE_ESTUDO as Record<string, { rotulo: string }>)[m.classe_estudo]?.rotulo ?? m.classe_estudo,
                cor: (CLASSE_ESTUDO as Record<string, { cor: { claro: string; escuro: string } }>)[m.classe_estudo]?.cor
                  ?? { claro: "#c3c2b7", escuro: "#52514e" },
              }))}
              series={[{
                rotulo: "Migrantes que estudam",
                valores: Object.fromEntries(migEstudo.map((m) => [m.classe_estudo, m.total])),
                destaque: true,
              } satisfies SeriePerfil]}
              escuro={escuro}
            />
          ) : (
            <p className="muted">Sem dados suficientes.</p>
          )}
        </>
      )}

      <details className="comparativo-toggle" open={mostrarComparativo}
                onToggle={(e) => setMostrarComparativo((e.target as HTMLDetailsElement).open)}>
        <summary>Comparativo entre as 20 maiores regiões metropolitanas</summary>
        {mostrarComparativo && <ComparativoRM rms={rms} ativa={cdRm} censo={censo} aoEscolher={aoEscolherRM} />}
      </details>
    </aside>
  );
}

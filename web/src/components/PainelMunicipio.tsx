import { useEffect, useState } from "react";
import type { Fluxo, Meta, Municipio } from "../lib/types";
import { ic95, num, num1, num2, rotuloPrecisao, sinal, sinal1 } from "../lib/format";
import { perfilDoMunicipio } from "../db/queries";
import { usarDuckDBPronto } from "../db/duckdb";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { PiramideIdadeSexo } from "./PiramideIdadeSexo";
import { dimensao, rotuloRecorte, type NomeDimensao } from "../lib/paletas";
import { edicao, rotuloCenso } from "../lib/edicoes";
import { useT } from "../i18n";
import { useStore } from "../state/store";
import { AvisoProxy } from "./AvisoProxy";
import { AvisoUnidade, unidadeAgregada } from "./AvisoUnidade";
import { classificarIem, nomeTipoIem, seIem } from "../lib/serie";
import { ResumoSerie } from "./ResumoSerie";
import { Termo } from "./Termo";

interface Props {
  municipio: Municipio | null;
  /** F9.7-b: true quando há um código selecionado (URL/estado), os municípios desta edição já
   *  carregaram, e mesmo assim ele não foi encontrado entre eles -- ex.: link para um município
   *  que só existe em outra edição (Palmas/TO em 1980, criado depois). Calculado em App.tsx, que
   *  já tem as duas informações (código selecionado e lista carregada); ver também PainelUnidade
   *  e PainelRM para o mesmo tratamento nos outros níveis. */
  naoEncontrado: boolean;
  fluxos: (Fluxo & { direcao?: string })[];
  carregando: boolean;
  escuro: boolean;
  /** chave do recorte ativo (ex.: "edu__superior_completo"), ou null */
  recorte: string | null;
  /** true enquanto os números do recorte ainda não chegaram */
  recorteCarregando: boolean;
  aoSelecionarFluxo: (o: string, d: string) => void;
  aoFechar: () => void;
  meta: Meta | null;
  /** F12.5: abre a seção completa "Ao longo dos censos" (?pagina=serie) para este município. */
  aoAbrirSerie?: () => void;
}

/** Perfil dos migrantes do município: quem chega, quem sai e quem já morava.
 *  Deixa visível a seletividade da migração -- o traço mais característico do fenômeno. */
function PerfilDoMunicipio({ cd, nome, escuro, recorte }: {
  cd: string; nome: string; escuro: boolean; recorte: string | null;
}) {
  const d = useT();
  const [dados, setDados] = useState<Record<string, Record<string, Record<string, number>>>>({});
  // sem renda em edições que não publicam essa dimensão (hoje só 1980, ver lib/edicoes.ts
  // `recursos.renda`) -- mesmo padrão usado em PainelPendular.tsx para "modo"/"tempo".
  const temRenda = edicao(useStore((s) => s.censo)).recursos.renda;
  const dims = (["status", "edu", "renda"] as NomeDimensao[]).filter((dim) => dim !== "renda" || temRenda);

  useEffect(() => {
    let vivo = true;
    const dimsBusca: Array<"status" | "edu" | "renda" | "idade_sexo"> = temRenda
      ? ["status", "edu", "renda", "idade_sexo"] : ["status", "edu", "idade_sexo"];
    Promise.all(dimsBusca.map(async (dim) => {
      const linhas = await perfilDoMunicipio(cd, dim);
      const porDirecao: Record<string, Record<string, number>> = {};
      for (const l of linhas) (porDirecao[l.direcao] ??= {})[l.categoria] = l.valor;
      return [dim, porDirecao] as const;
    })).then((pares) => { if (vivo) setDados(Object.fromEntries(pares)); }).catch(() => {});
    return () => { vivo = false; };
  }, [cd, temRenda]);

  if (Object.keys(dados).length === 0) return null;

  return (
    <>
      <h3 className="secao-titulo">{d.paineis.perfilMigrantes}</h3>
      {recorte && (
        <p className="muted-pequeno explicacao">
          {d.paineis.municipio.perfilRecorte.antes}<strong>{d.paineis.municipio.perfilRecorte.forte}</strong>
          {d.paineis.municipio.perfilRecorte.depois}
        </p>
      )}
      {dims.map((dim) => {
        const dd = dados[dim];
        if (!dd) return null;
        const series: SeriePerfil[] = [
          { rotulo: d.paineis.municipio.chegaramA(nome), valores: dd.imig ?? {}, destaque: true },
          { rotulo: d.paineis.municipio.sairamDe(nome), valores: dd.emig ?? {} },
        ];
        // status migratório não se aplica a quem não migrou
        if (dim !== "status") series.push({ rotulo: d.paineis.municipio.residentesDe(nome), valores: dd.residente ?? {} });
        const glossarioDim: Record<string, string> = {
          status: "status_migratorio", edu: "escolaridade", renda: "renda_domiciliar",
        };
        const chaveGlossario = glossarioDim[dim];
        const dimLocal = dimensao(dim, d);
        return (
          <BarraPerfil key={dim}
                       titulo={chaveGlossario ? <Termo chave={chaveGlossario}>{dimLocal.titulo}</Termo> : dimLocal.titulo}
                       nota={dimLocal.nota}
                       categorias={dimLocal.categorias} series={series} escuro={escuro} />
        );
      })}
      {dados.idade_sexo && (
        <PiramideIdadeSexo
          titulo={<Termo chave="idade_sexo">{d.paineis.termos.idadeSexo}</Termo>}
          rotuloGrupo={d.paineis.municipio.chegaramA(nome)}
          valoresGrupo={dados.idade_sexo.imig ?? {}}
          rotuloReferencia={d.paineis.municipio.residentesDe(nome)}
          valoresReferencia={dados.idade_sexo.residente ?? {}}
          escuro={escuro}
        />
      )}
    </>
  );
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

export function PainelMunicipio({ municipio: m, naoEncontrado, fluxos, carregando, escuro, recorte,
                                 recorteCarregando, aoSelecionarFluxo, aoFechar, meta, aoAbrirSerie }: Props) {
  // Hook chamado incondicionalmente, antes de qualquer "return" antecipado: `m` começa
  // null (dados do município ainda não chegaram) e vira truthy num re-render seguinte do
  // MESMO componente montado -- chamar o hook só no ramo `m truthy` violaria as regras dos
  // hooks (contagem de hooks diferente entre renders da mesma fibra), o que o React 19 acusa
  // como "Expected static flag was missing" em vez do aviso de dev mais usual.
  const duckdbPronto = usarDuckDBPronto();
  const d = useT();
  const ed = edicao(useStore((s) => s.censo));
  const { periodo, nome: censoNome } = ed;
  const naoExiste = d.paineis.naoExisteNaEdicao(d.comum.niveis.mun.demonstrativo);

  if (!m) {
    return (
      <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
        <div className="vazio">
          <h2>{d.paineis.tituloAtlas}</h2>
          {naoEncontrado ? (
            <div className="aviso" role="note">
              <p>
                {naoExiste.antes}<strong>{rotuloCenso(ed.nome, d)}</strong>{naoExiste.depois}
              </p>
              <button type="button" className="link-metodologia" onClick={aoFechar}>
                {d.paineis.limparSelecao}
              </button>
            </div>
          ) : (
            <>
              <p>
                {d.paineis.municipio.intro(periodo.de.slice(0, 4), periodo.ate.slice(0, 4), censoNome, ed.proxyDataFixa)}
              </p>
              <AvisoProxy meta={meta} />
              <p className="muted">{d.paineis.municipio.clique}</p>
            </>
          )}
        </div>
      </aside>
    );
  }

  const entradas = fluxos.filter((f) => f.direcao === "entrada");
  const saidas = fluxos.filter((f) => f.direcao === "saida");
  // null em todo município normal; preenchido só nas unidades agregadas declaradas em
  // meta.unidades_agregadas -- mecanismo genérico, hoje inativo (nenhuma edição declara uma
  // desde 1.1.0-1980). Ver AvisoUnidade.tsx.
  const agregada = unidadeAgregada(meta, m.cd_mun);

  return (
    <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
      <header className="painel-topo">
        <div>
          <h2>{m.nm_mun}<span className="uf">/{m.uf_sigla}</span></h2>
          <div className="muted">
            {/* F9.9: uma unidade agregada não tem RGI (cobre várias) -- no lugar dela,
                a contagem de municípios que a compõem, que é o que situa o leitor. */}
            {agregada
              ? <>{d.paineis.municipio.municipiosAgregados(agregada.n_municipios)}</>
              : m.nm_rgi}
            {" · "}{d.paineis.municipio.habitantes(num(m.pop))}
            {m.nm_rm && <> · {m.nm_rm}</>}
          </div>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label={d.comum.ui.fecharPainel}>×</button>
      </header>

      <AvisoUnidade meta={meta} codigo={m.cd_mun} />
      <AvisoProxy meta={meta} />

      {recorteCarregando ? (
        <p className="muted carregando-recorte">{d.paineis.municipio.aplicandoRecorte}</p>
      ) : m.semDado ? (
        // sob recorte, município sem nenhuma célula publicada para o subgrupo: os zeros que o
        // App preenche são ausência de dado, não zero -- dizer isso em vez de mostrar "0"
        <p className="muted carregando-recorte">{d.paineis.municipio.semDadoRecorte}</p>
      ) : (
      <div className="kpis">
        <Kpi rotulo={<Termo chave="saldo">{d.paineis.termos.saldoMigratorio}</Termo>} valor={sinal(m.saldo)}
             detalhe={<><Termo chave="ic95">{d.paineis.termos.ic95}</Termo>{d.paineis.dp} {ic95(m.saldo, m.se_saldo, false)}</>} />
        <Kpi rotulo={<Termo chave="taxa_liquida">{d.paineis.termos.taxaLiquida}</Termo>} valor={m.tlm != null ? `${sinal1(m.tlm)} ‰` : "—"}
             detalhe={d.paineis.municipio.taxaDetalhe} />
        <Kpi rotulo={<Termo chave="imigrantes">{d.paineis.termos.imigrantes}</Termo>} valor={num(m.imig)}
             detalhe={<><Termo chave="ic95">{d.paineis.termos.ic95}</Termo>{d.paineis.dp} {ic95(m.imig, m.se_imig)}</>} />
        <Kpi rotulo={<Termo chave="emigrantes">{d.paineis.termos.emigrantes}</Termo>} valor={num(m.emig)}
             detalhe={<><Termo chave="ic95">{d.paineis.termos.ic95}</Termo>{d.paineis.dp} {ic95(m.emig, m.se_emig)}</>} />
      </div>)}

      {recorte && !recorteCarregando && (
        <div className="aviso-recorte">
          {d.paineis.municipio.avisoRecorte.antes}<strong>{rotuloRecorte(recorte, d)}</strong>
          {d.paineis.municipio.avisoRecorte.depois}
        </div>
      )}

      {!recorte && <div className="nota-precisao">
        <Termo chave="precisao">{d.paineis.municipio.precisaoImigracao.termo}</Termo>{d.paineis.municipio.precisaoImigracao.depois}{d.paineis.dp} <strong>{rotuloPrecisao(m.precisao_imig, d)}</strong>
        {m.cv_imig != null && <> (<Termo chave="cv">{d.paineis.termos.coefVariacao}</Termo> {d.paineis.pct(num1(m.cv_imig))})</>}
        {m.imig_ni > 0 && <> · {d.paineis.municipio.imigNaoInformados(num(m.imig_ni), m.imig_ni)}</>}
        {m.imig_int > 0 && <> · {d.paineis.municipio.imigExterior(num(m.imig_int), m.imig_int)}</>}
      </div>}

      {m.iem != null && (() => {
        // F12.5: classificação pela tipologia de Baeninger (fonte única em lib/serie.ts,
        // limiares ±0,15/1/3 e guarda estatística), a MESMA usada pela seção "Ao longo dos
        // censos" -- antes este trecho classificava inline com limiar ±0,10, o que fazia
        // painel e série mostrarem classes diferentes para o mesmo município/edição (ver
        // docs/design_serie_censos.md, 4.5, item 2).
        const se = seIem(m.imig, m.emig, m.se_imig, m.se_emig);
        const tipo = classificarIem(m.iem, se);
        return (
          <div className="nota-precisao">
            <Termo chave="eficacia_iem">{d.paineis.termos.indiceEficacia}</Termo>{d.paineis.dp} <strong>{num2(m.iem)}</strong>{" "}
            <span className="muted">({tipo ? nomeTipoIem(tipo, d) : "—"})</span>
          </div>
        );
      })()}

      {aoAbrirSerie && (
        <ResumoSerie nivel="mun" codigo={m.cd_mun} nome={`${m.nm_mun}/${m.uf_sigla}`}
                     aoAbrirSerieCompleta={aoAbrirSerie} />
      )}

      {carregando ? (
        <p className="muted">{duckdbPronto ? d.comum.ui.carregandoFluxos : d.paineis.preparandoDados}</p>
      ) : (
        <>
          <TabelaFluxos titulo={d.paineis.principaisOrigens} cor="var(--arc-in)" fluxos={entradas}
                        campo="nm_origem" campoUf="uf_origem" aoClicar={aoSelecionarFluxo} />
          <TabelaFluxos titulo={d.paineis.principaisDestinos} cor="var(--arc-out)" fluxos={saidas}
                        campo="nm_destino" campoUf="uf_destino" aoClicar={aoSelecionarFluxo} />
          <PerfilDoMunicipio cd={m.cd_mun} nome={m.nm_mun} escuro={escuro} recorte={recorte} />
        </>
      )}
    </aside>
  );
}

function TabelaFluxos({ titulo, cor, fluxos, campo, campoUf, aoClicar }: {
  titulo: string; cor: string; fluxos: Fluxo[];
  campo: "nm_origem" | "nm_destino"; campoUf: "uf_origem" | "uf_destino";
  aoClicar: (o: string, d: string) => void;
}) {
  const d = useT();
  if (fluxos.length === 0) {
    return (
      <section className="secao">
        <h3><span className="ponto" style={{ background: cor }} /> {titulo}</h3>
        <p className="muted">{d.paineis.nenhumFluxo}</p>
      </section>
    );
  }
  const max = Math.max(...fluxos.map((f) => f.total));
  return (
    <section className="secao">
      <h3><span className="ponto" style={{ background: cor }} /> {titulo}</h3>
      <table className="tabela-fluxos">
        <tbody>
          {fluxos.map((f) => (
            <tr key={`${f.origem}-${f.destino}`}>
              <td>
                <button className="link-fluxo" onClick={() => aoClicar(f.origem, f.destino)}>
                  {f[campo]}<span className="uf">/{f[campoUf]}</span>
                </button>
              </td>
              <td className="barra-cel">
                <span className="barra" style={{ width: `${(f.total / max) * 100}%`, background: cor }} />
              </td>
              <td className="valor-cel">{num(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

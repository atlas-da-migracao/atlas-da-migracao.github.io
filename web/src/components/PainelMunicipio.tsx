import { useEffect, useState } from "react";
import type { Fluxo, Meta, Municipio } from "../lib/types";
import { ic95, num, num1, num2, rotuloPrecisao, sinal } from "../lib/format";
import { perfilDoMunicipio } from "../db/queries";
import { usarDuckDBPronto } from "../db/duckdb";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { PiramideIdadeSexo } from "./PiramideIdadeSexo";
import { DIMENSOES, rotuloRecorte, type NomeDimensao } from "../lib/paletas";
import { edicao } from "../lib/edicoes";
import { useStore } from "../state/store";
import { AvisoProxy } from "./AvisoProxy";
import { AvisoUnidade, unidadeAgregada } from "./AvisoUnidade";

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
}

/** Perfil dos migrantes do município: quem chega, quem sai e quem já morava.
 *  Deixa visível a seletividade da migração -- o traço mais característico do fenômeno. */
function PerfilDoMunicipio({ cd, nome, escuro, recorte }: {
  cd: string; nome: string; escuro: boolean; recorte: string | null;
}) {
  const [dados, setDados] = useState<Record<string, Record<string, Record<string, number>>>>({});
  // sem renda em edições que não publicam essa dimensão (hoje só 1980, ver lib/edicoes.ts
  // `recursos.renda`) -- mesmo padrão usado em PainelPendular.tsx para "modo"/"tempo".
  const temRenda = edicao(useStore((s) => s.censo)).recursos.renda;
  const dims = (["status", "edu", "renda"] as NomeDimensao[]).filter((d) => d !== "renda" || temRenda);

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
      <h3 className="secao-titulo">Perfil dos migrantes</h3>
      {recorte && (
        <p className="muted-pequeno explicacao">
          Composição de <strong>todos</strong> os migrantes do município: as barras não
          seguem o recorte ativo, que se aplica aos indicadores e aos fluxos acima.
        </p>
      )}
      {dims.map((dim) => {
        const d = dados[dim];
        if (!d) return null;
        const series: SeriePerfil[] = [
          { rotulo: `Chegaram a ${nome}`, valores: d.imig ?? {}, destaque: true },
          { rotulo: `Saíram de ${nome}`, valores: d.emig ?? {} },
        ];
        // status migratório não se aplica a quem não migrou
        if (dim !== "status") series.push({ rotulo: `Residentes de ${nome}`, valores: d.residente ?? {} });
        return (
          <BarraPerfil key={dim} titulo={DIMENSOES[dim].titulo} nota={DIMENSOES[dim].nota}
                       categorias={DIMENSOES[dim].categorias} series={series} escuro={escuro} />
        );
      })}
      {dados.idade_sexo && (
        <PiramideIdadeSexo
          titulo="Idade e sexo" rotuloGrupo={`Chegaram a ${nome}`}
          valoresGrupo={dados.idade_sexo.imig ?? {}}
          rotuloReferencia={`Residentes de ${nome}`}
          valoresReferencia={dados.idade_sexo.residente ?? {}}
          escuro={escuro}
        />
      )}
    </>
  );
}

function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-rotulo">{rotulo}</div>
      <div className="kpi-valor">{valor}</div>
      {detalhe && <div className="kpi-detalhe">{detalhe}</div>}
    </div>
  );
}

export function PainelMunicipio({ municipio: m, naoEncontrado, fluxos, carregando, escuro, recorte,
                                 recorteCarregando, aoSelecionarFluxo, aoFechar, meta }: Props) {
  // Hook chamado incondicionalmente, antes de qualquer "return" antecipado: `m` começa
  // null (dados do município ainda não chegaram) e vira truthy num re-render seguinte do
  // MESMO componente montado -- chamar o hook só no ramo `m truthy` violaria as regras dos
  // hooks (contagem de hooks diferente entre renders da mesma fibra), o que o React 19 acusa
  // como "Expected static flag was missing" em vez do aviso de dev mais usual.
  const duckdbPronto = usarDuckDBPronto();
  const ed = edicao(useStore((s) => s.censo));
  const { periodo, nome: censoNome } = ed;

  if (!m) {
    return (
      <aside className="painel" aria-label="Painel de detalhes">
        <div className="vazio">
          <h2>Atlas da migração interna</h2>
          {naoEncontrado ? (
            <div className="aviso" role="note">
              <p>
                Este município não existe na edição <strong>{ed.rotulo}</strong> selecionada —
                edições antigas podem cobrir um território menor ou ter divisão administrativa
                diferente.
              </p>
              <button type="button" className="link-metodologia" onClick={aoFechar}>
                Limpar seleção
              </button>
            </div>
          ) : (
            <>
              <p>
                Fluxos migratórios entre municípios brasileiros no quinquênio{" "}
                {periodo.de.slice(0, 4)}–{periodo.ate.slice(0, 4)},
                {ed.proxyDataFixa
                  ? ` a partir de um proxy de data fixa do Censo Demográfico ${censoNome} (ver aviso abaixo).`
                  : ` a partir do quesito de data fixa do Censo Demográfico ${censoNome}.`}
              </p>
              <AvisoProxy meta={meta} />
              <p className="muted">
                Clique em um município no mapa para ver seu saldo, os principais fluxos de entrada
                e de saída, e o perfil dos migrantes. Clique em um arco para detalhar um fluxo.
              </p>
            </>
          )}
        </div>
      </aside>
    );
  }

  const entradas = fluxos.filter((f) => f.direcao === "entrada");
  const saidas = fluxos.filter((f) => f.direcao === "saida");
  // null em todo município normal; preenchido só nas unidades agregadas declaradas em
  // meta.unidades_agregadas (hoje só 'NORTEGO' no Censo 1980) -- ver AvisoUnidade.tsx.
  const agregada = unidadeAgregada(meta, m.cd_mun);

  return (
    <aside className="painel" aria-label="Painel de detalhes">
      <header className="painel-topo">
        <div>
          <h2>{m.nm_mun}<span className="uf">/{m.uf_sigla}</span></h2>
          <div className="muted">
            {/* F9.9: uma unidade agregada não tem RGI (cobre várias) -- no lugar dela,
                a contagem de municípios que a compõem, que é o que situa o leitor. */}
            {agregada
              ? <>{agregada.n_municipios} municípios agregados</>
              : m.nm_rgi}
            {" · "}{num(m.pop)} habitantes
            {m.nm_rm && <> · {m.nm_rm}</>}
          </div>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      <AvisoUnidade meta={meta} codigo={m.cd_mun} />
      <AvisoProxy meta={meta} />

      {recorteCarregando ? (
        <p className="muted carregando-recorte">Aplicando o recorte…</p>
      ) : (
      <div className="kpis">
        <Kpi rotulo="Saldo migratório" valor={sinal(m.saldo)}
             detalhe={`IC 95%: ${ic95(m.saldo, m.se_saldo)}`} />
        <Kpi rotulo="Taxa líquida" valor={`${sinal(m.tlm)} ‰`}
             detalhe="por mil habitantes de 5+ anos" />
        <Kpi rotulo="Imigrantes" valor={num(m.imig)}
             detalhe={`IC 95%: ${ic95(m.imig, m.se_imig)}`} />
        <Kpi rotulo="Emigrantes" valor={num(m.emig)}
             detalhe={`IC 95%: ${ic95(m.emig, m.se_emig)}`} />
      </div>)}

      {recorte && !recorteCarregando && (
        <div className="aviso-recorte">
          Todos os números acima se referem apenas ao recorte ativo
          <strong> {rotuloRecorte(recorte)}</strong>. Sem o recorte, o painel mostra o total de migrantes.
        </div>
      )}

      {!recorte && <div className="nota-precisao">
        Precisão da estimativa de imigração: <strong>{rotuloPrecisao[m.precisao_imig] ?? m.precisao_imig}</strong>
        {m.cv_imig != null && <> (coeficiente de variação {num1(m.cv_imig)}%)</>}
        {m.imig_ni > 0 && <> · {num(m.imig_ni)} imigrantes com origem não informada</>}
        {m.imig_int > 0 && <> · {num(m.imig_int)} vindos do exterior</>}
      </div>}

      {m.iem != null && (
        <div className="nota-precisao">
          Índice de eficácia migratória: <strong>{num2(m.iem)}</strong>{" "}
          <span className="muted">
            ({m.iem > 0.1 ? "atração consolidada" : m.iem < -0.1 ? "evasão consolidada" : "trocas equilibradas"})
          </span>
        </div>
      )}

      {carregando ? (
        <p className="muted">{duckdbPronto ? "Carregando fluxos…" : "preparando os dados…"}</p>
      ) : (
        <>
          <TabelaFluxos titulo="Principais origens" cor="var(--arc-in)" fluxos={entradas}
                        campo="nm_origem" campoUf="uf_origem" aoClicar={aoSelecionarFluxo} />
          <TabelaFluxos titulo="Principais destinos" cor="var(--arc-out)" fluxos={saidas}
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
  if (fluxos.length === 0) {
    return (
      <section className="secao">
        <h3><span className="ponto" style={{ background: cor }} /> {titulo}</h3>
        <p className="muted">Nenhum fluxo acima do limiar de divulgação.</p>
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

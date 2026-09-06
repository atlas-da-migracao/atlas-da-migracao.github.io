import type { Fluxo, Municipio } from "../lib/types";
import { ic95, num, num1, num2, rotuloPrecisao, sinal } from "../lib/format";

interface Props {
  municipio: Municipio | null;
  fluxos: (Fluxo & { direcao?: string })[];
  carregando: boolean;
  aoSelecionarFluxo: (o: string, d: string) => void;
  aoFechar: () => void;
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

export function PainelMunicipio({ municipio: m, fluxos, carregando, aoSelecionarFluxo, aoFechar }: Props) {
  if (!m) {
    return (
      <aside className="painel">
        <div className="vazio">
          <h2>Atlas da migração interna</h2>
          <p>
            Fluxos migratórios entre os 5.570 municípios brasileiros no quinquênio 2017–2022,
            a partir do quesito de data fixa do Censo Demográfico 2022.
          </p>
          <p className="muted">
            Clique em um município no mapa para ver seu saldo, os principais fluxos de entrada
            e de saída, e o perfil dos migrantes. Clique em um arco para detalhar um fluxo.
          </p>
        </div>
      </aside>
    );
  }

  const entradas = fluxos.filter((f) => f.direcao === "entrada");
  const saidas = fluxos.filter((f) => f.direcao === "saida");

  return (
    <aside className="painel">
      <header className="painel-topo">
        <div>
          <h2>{m.nm_mun}<span className="uf">/{m.uf_sigla}</span></h2>
          <div className="muted">
            {m.nm_rgi} · {num(m.pop)} habitantes
            {m.nm_rm && <> · {m.nm_rm}</>}
          </div>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      <div className="kpis">
        <Kpi rotulo="Saldo migratório" valor={sinal(m.saldo)}
             detalhe={`IC 95%: ${ic95(m.saldo, m.se_saldo)}`} />
        <Kpi rotulo="Taxa líquida" valor={`${sinal(m.tlm)} ‰`}
             detalhe="por mil habitantes de 5+ anos" />
        <Kpi rotulo="Imigrantes" valor={num(m.imig)}
             detalhe={`IC 95%: ${ic95(m.imig, m.se_imig)}`} />
        <Kpi rotulo="Emigrantes" valor={num(m.emig)}
             detalhe={`IC 95%: ${ic95(m.emig, m.se_emig)}`} />
      </div>

      <div className="nota-precisao">
        Precisão da estimativa de imigração: <strong>{rotuloPrecisao[m.precisao_imig] ?? m.precisao_imig}</strong>
        {m.cv_imig != null && <> (coeficiente de variação {num1(m.cv_imig)}%)</>}
        {m.imig_ni > 0 && <> · {num(m.imig_ni)} imigrantes com origem não informada</>}
        {m.imig_int > 0 && <> · {num(m.imig_int)} vindos do exterior</>}
      </div>

      {m.iem != null && (
        <div className="nota-precisao">
          Índice de eficácia migratória: <strong>{num2(m.iem)}</strong>{" "}
          <span className="muted">
            ({m.iem > 0.1 ? "atração consolidada" : m.iem < -0.1 ? "evasão consolidada" : "trocas equilibradas"})
          </span>
        </div>
      )}

      {carregando ? (
        <p className="muted">Carregando fluxos…</p>
      ) : (
        <>
          <TabelaFluxos titulo="Principais origens" cor="var(--arc-in)" fluxos={entradas}
                        campo="nm_origem" campoUf="uf_origem" aoClicar={aoSelecionarFluxo} />
          <TabelaFluxos titulo="Principais destinos" cor="var(--arc-out)" fluxos={saidas}
                        campo="nm_destino" campoUf="uf_destino" aoClicar={aoSelecionarFluxo} />
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

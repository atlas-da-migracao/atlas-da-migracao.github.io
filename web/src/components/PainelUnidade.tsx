/** F6: painel de uma unidade num nível agregado (região imediata, região intermediária ou UF).
 *  Mais enxuto que o PainelMunicipio: só KPIs e as tabelas de fluxo -- sem perfil por
 *  característica (municipios_dim só existe por município) e sem erro-padrão (os indicadores
 *  agregados são somas de fluxos municipais publicados, não uma nova estimativa). */
import type { Fluxo } from "../lib/types";
import type { NivelAgregado, UnidadeAgregada } from "../db/queries";
import { num, num2, sinal } from "../lib/format";
import { exportarFluxosUnidade } from "../lib/exportar";
import { usarDuckDBPronto } from "../db/duckdb";
import { DiagramaAcordes } from "./DiagramaAcordes";
import type { FluxoUF, UnidadeUF } from "../lib/acordes";

const ROTULO_NIVEL: Record<NivelAgregado, string> = {
  rgi: "Região imediata", rgint: "Região intermediária", uf: "UF",
};

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

interface Props {
  nivel: NivelAgregado;
  unidade: UnidadeAgregada | null;
  fluxos: (Fluxo & { direcao?: string })[];
  carregando: boolean;
  aoSelecionarFluxo: (o: string, d: string) => void;
  aoFechar: () => void;
  /** F6 leva 2 (10a): dados da matriz de acordes UF x UF, só usados/necessários no nível "uf" */
  fluxosUF?: FluxoUF[];
  unidadesUF?: UnidadeUF[];
  escuro?: boolean;
}

export function PainelUnidade({ nivel, unidade, fluxos, carregando, aoSelecionarFluxo, aoFechar,
                                fluxosUF, unidadesUF, escuro = false }: Props) {
  const pronto = usarDuckDBPronto();
  const rotuloNivel = ROTULO_NIVEL[nivel];

  if (!unidade) {
    return (
      <aside className="painel" aria-label="Painel de detalhes">
        <div className="vazio">
          <h2>Atlas da migração interna</h2>
          <p>
            Nível: <strong>{rotuloNivel.toLowerCase()}</strong>. Clique numa unidade no mapa, ou
            busque pelo nome, para ver seus indicadores e principais fluxos.
          </p>
          <p className="muted">
            Migração entre municípios da mesma unidade não é contabilizada; pares abaixo do limiar
            de revelação ficam de fora da soma. Não há erro-padrão publicado neste nível
            (ver a página de Metodologia).
          </p>
        </div>
        {nivel === "uf" && fluxosUF && unidadesUF && (
          <section className="secao">
            <h3>Fluxos migratórios entre UFs</h3>
            <DiagramaAcordes fluxos={fluxosUF} unidades={unidadesUF} escuro={escuro}
                             aoSelecionarPar={aoSelecionarFluxo} />
          </section>
        )}
      </aside>
    );
  }

  const entradas = fluxos.filter((f) => f.direcao === "entrada");
  const saidas = fluxos.filter((f) => f.direcao === "saida");

  return (
    <aside className="painel" aria-label="Painel de detalhes">
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">{rotuloNivel}</div>
          <h2>{unidade.nome}{unidade.uf_sigla && unidade.uf_sigla !== unidade.nome ? <span className="uf">/{unidade.uf_sigla}</span> : null}</h2>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-rotulo">Imigrantes</div>
          <div className="kpi-valor">{num(unidade.imig)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">Emigrantes</div>
          <div className="kpi-valor">{num(unidade.emig)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">Saldo migratório</div>
          <div className="kpi-valor">{sinal(unidade.saldo)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">Taxa líquida (por mil)</div>
          <div className="kpi-valor">{unidade.tlm != null ? sinal(unidade.tlm) : "—"}</div>
        </div>
      </div>
      <p className="muted-pequeno explicacao">
        Indicadores agregados: soma dos fluxos municipais publicados; sem erro-padrão próprio.
      </p>

      {unidade.iem != null && (
        <div className="nota-precisao">
          Índice de eficácia migratória: <strong>{num2(unidade.iem)}</strong>{" "}
          <span className="muted">
            ({unidade.iem > 0.1 ? "atração consolidada" : unidade.iem < -0.1 ? "evasão consolidada" : "trocas equilibradas"})
          </span>
        </div>
      )}

      {nivel === "uf" && fluxosUF && unidadesUF && (
        <section className="secao">
          <h3>Fluxos migratórios entre UFs</h3>
          <DiagramaAcordes fluxos={fluxosUF} unidades={unidadesUF} escuro={escuro}
                           aoSelecionarPar={aoSelecionarFluxo} />
        </section>
      )}

      {carregando ? (
        <p className="muted">{pronto ? "Carregando fluxos…" : "preparando os dados…"}</p>
      ) : (
        <>
          <TabelaFluxos titulo="Principais origens" cor="var(--arc-in)" fluxos={entradas}
                        campo="nm_origem" campoUf="uf_origem" aoClicar={aoSelecionarFluxo} />
          <TabelaFluxos titulo="Principais destinos" cor="var(--arc-out)" fluxos={saidas}
                        campo="nm_destino" campoUf="uf_destino" aoClicar={aoSelecionarFluxo} />
          {fluxos.length > 0 && (
            <button className="exportar" onClick={() => exportarFluxosUnidade(rotuloNivel, unidade.nome, fluxos)}>
              Baixar estes fluxos em CSV
            </button>
          )}
        </>
      )}
    </aside>
  );
}

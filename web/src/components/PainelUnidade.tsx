/** F6: painel de uma unidade num nível agregado (região imediata, região intermediária ou UF).
 *  Mais enxuto que o PainelMunicipio: só KPIs e as tabelas de fluxo -- sem perfil por
 *  característica (municipios_dim só existe por município) e sem erro-padrão (os indicadores
 *  agregados são somas de fluxos municipais publicados, não uma nova estimativa). */
import type { Fluxo, Meta } from "../lib/types";
import type { NivelAgregado, UnidadeAgregada } from "../db/queries";
import { num, num2, sinal } from "../lib/format";
import { usarDuckDBPronto } from "../db/duckdb";
import { DiagramaAcordes } from "./DiagramaAcordes";
import { AvisoProxy } from "./AvisoProxy";
import { AvisoUnidadeUf } from "./AvisoUnidade";
import type { FluxoUF, UnidadeUF } from "../lib/acordes";
import { edicao } from "../lib/edicoes";
import { useStore } from "../state/store";

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
  /** F9.7-b: true quando há uma unidade selecionada (URL/estado), as unidades deste nível/edição
   *  já carregaram, e mesmo assim ela não foi encontrada -- ex.: link para uma região imediata
   *  de Tocantins numa edição anterior a 1988. Calculado em App.tsx; ver PainelMunicipio. */
  naoEncontrado: boolean;
  fluxos: (Fluxo & { direcao?: string })[];
  carregando: boolean;
  aoSelecionarFluxo: (o: string, d: string) => void;
  aoFechar: () => void;
  /** F6 leva 2 (10a): dados da matriz de acordes UF x UF, só usados/necessários no nível "uf" */
  fluxosUF?: FluxoUF[];
  unidadesUF?: UnidadeUF[];
  escuro?: boolean;
  /** filtro cruzado com o mapa (nível "uf"): UF sob o cursor no mapa, seleção e realce devolvido ao mapa */
  ufSobMapa?: string | null;
  aoSelecionarUF?: (cd: string | null) => void;
  aoRealcarUFs?: (cds: string[] | null) => void;
  meta: Meta | null;
}

export function PainelUnidade({ nivel, unidade, naoEncontrado, fluxos, carregando, aoSelecionarFluxo,
                                aoFechar, fluxosUF, unidadesUF, escuro = false, ufSobMapa = null,
                                aoSelecionarUF, aoRealcarUFs, meta }: Props) {
  const acordes = fluxosUF && unidadesUF && (
    <DiagramaAcordes fluxos={fluxosUF} unidades={unidadesUF} escuro={escuro}
                     aoSelecionarPar={aoSelecionarFluxo} selecionado={unidade?.codigo ?? null}
                     realceExterno={ufSobMapa} aoSelecionarUF={aoSelecionarUF} aoRealcar={aoRealcarUFs} />
  );
  const pronto = usarDuckDBPronto();
  const rotuloNivel = ROTULO_NIVEL[nivel];
  const ed = edicao(useStore((s) => s.censo));

  if (!unidade) {
    return (
      <aside className="painel" aria-label="Painel de detalhes">
        <div className="vazio">
          <h2>Atlas da migração interna</h2>
          {naoEncontrado ? (
            <div className="aviso" role="note">
              <p>
                Esta {rotuloNivel.toLowerCase()} não existe na edição <strong>{ed.rotulo}</strong>{" "}
                selecionada — edições antigas podem cobrir um território menor ou ter divisão
                administrativa diferente.
              </p>
              <button type="button" className="link-metodologia" onClick={aoFechar}>
                Limpar seleção
              </button>
            </div>
          ) : (
            <>
              <p>
                Nível: <strong>{rotuloNivel.toLowerCase()}</strong>. Clique numa unidade no mapa, ou
                busque pelo nome, para ver seus indicadores e principais fluxos.
              </p>
              <p className="muted">
                Migração entre municípios da mesma unidade não é contabilizada; pares abaixo do limiar
                de revelação ficam de fora da soma. Não há erro-padrão publicado neste nível
                (ver a página de Metodologia).
              </p>
              <AvisoProxy meta={meta} />
            </>
          )}
        </div>
        {!naoEncontrado && nivel === "uf" && acordes && (
          <section className="secao">
            <h3>Fluxos migratórios entre UFs</h3>
            {acordes}
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

      {nivel === "uf" && <AvisoUnidadeUf meta={meta} codigoUf={unidade.codigo} />}
      <AvisoProxy meta={meta} />

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

      {nivel === "uf" && acordes && (
        <section className="secao">
          <h3>Fluxos migratórios entre UFs</h3>
          {acordes}
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
        </>
      )}
    </aside>
  );
}

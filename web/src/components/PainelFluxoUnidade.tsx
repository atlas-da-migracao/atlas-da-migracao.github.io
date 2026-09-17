/** F6: painel de um fluxo selecionado entre duas unidades de um nível agregado (RGI/RGInt/UF).
 *  Mais enxuto que o PainelFluxo municipal: volume, fluxo inverso, saldo do par e precisão --
 *  sem perfil por característica, que só existe no nível município. */
import { useEffect, useState } from "react";
import { detalheFluxoUnidade, type DetalheFluxoUnidade, type NivelAgregado } from "../db/queries";
import { usarDuckDBPronto } from "../db/duckdb";
import { num, rotuloPrecisao, sinal } from "../lib/format";
import { AvisoProxy } from "./AvisoProxy";
import type { Meta } from "../lib/types";
import { Termo } from "./Termo";

const ROTULO_NIVEL: Record<NivelAgregado, string> = {
  rgi: "Região imediata", rgint: "Região intermediária", uf: "UF",
};

interface Props {
  nivel: NivelAgregado;
  origem: string;
  destino: string;
  aoFechar: () => void;
  meta: Meta | null;
}

export function PainelFluxoUnidade({ nivel, origem, destino, aoFechar, meta }: Props) {
  const [dados, setDados] = useState<{ ida: DetalheFluxoUnidade | null; volta: DetalheFluxoUnidade | null } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const pronto = usarDuckDBPronto();

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    detalheFluxoUnidade(nivel, origem, destino).then((d) => { if (vivo) setDados(d); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [nivel, origem, destino]);

  if (carregando) {
    return <aside className="painel" aria-label="Painel de detalhes"><p className="muted">{pronto ? "Carregando o fluxo…" : "preparando os dados…"}</p></aside>;
  }

  const ida = dados?.ida ?? null;
  const volta = dados?.volta ?? null;

  if (!ida) {
    return (
      <aside className="painel" aria-label="Painel de detalhes">
        <header className="painel-topo">
          <h2>Fluxo não publicado</h2>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        </header>
        <p className="muted">Este par ficou abaixo do limiar de divulgação e não é publicado individualmente.</p>
      </aside>
    );
  }

  const saldo = ida.total - (volta?.total ?? 0);
  const rotuloNivel = ROTULO_NIVEL[nivel];

  return (
    <aside className="painel" aria-label="Painel de detalhes">
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">{rotuloNivel}</div>
          <h2 className="titulo-fluxo">
            {ida.nm_origem}{ida.uf_origem && ida.uf_origem !== ida.nm_origem && <span className="uf">/{ida.uf_origem}</span>}
            <span className="seta">→</span>
            {ida.nm_destino}{ida.uf_destino && ida.uf_destino !== ida.nm_destino && <span className="uf">/{ida.uf_destino}</span>}
          </h2>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      <AvisoProxy meta={meta} />

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-rotulo">Migrantes neste fluxo</div>
          <div className="kpi-valor">{num(ida.total)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">Fluxo inverso</div>
          <div className="kpi-valor">{volta ? num(volta.total) : "—"}</div>
          <div className="kpi-detalhe">{volta ? `${ida.nm_destino} → ${ida.nm_origem}` : "abaixo do limiar"}</div>
        </div>
        <div className="kpi kpi-largo">
          <div className="kpi-rotulo">Saldo do par</div>
          <div className="kpi-valor">{sinal(saldo)}</div>
        </div>
      </div>

      <div className="nota-precisao">
        <Termo chave="precisao">Precisão</Termo>: <strong>{rotuloPrecisao[ida.precisao] ?? ida.precisao}</strong> ·{" "}
        <Termo chave="n_faixa">{ida.n_faixa === "<5" ? "menos de 5" : ida.n_faixa} observações</Termo> na amostra.
        Nível agregado: sem erro-padrão publicado.
      </div>

    </aside>
  );
}

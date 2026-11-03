/** F6: painel de um fluxo selecionado entre duas unidades de um nível agregado (RGI/RGInt/UF).
 *  Mais enxuto que o PainelFluxo municipal: volume, fluxo inverso, saldo do par e precisão --
 *  sem perfil por característica, que só existe no nível município. */
import { useEffect, useState } from "react";
import { detalheFluxoUnidade, type DetalheFluxoUnidade, type NivelAgregado } from "../db/queries";
import { usarDuckDBPronto } from "../db/duckdb";
import { num, rotuloPrecisao, sinal } from "../lib/format";
import { useT } from "../i18n";
import { AvisoProxy } from "./AvisoProxy";
import { AvisoUnidadeUf } from "./AvisoUnidade";
import type { Meta } from "../lib/types";
import { Termo } from "./Termo";

interface Props {
  nivel: NivelAgregado;
  origem: string;
  destino: string;
  aoFechar: () => void;
  meta: Meta | null;
}

export function PainelFluxoUnidade({ nivel, origem, destino, aoFechar, meta }: Props) {
  const d = useT();
  const [dados, setDados] = useState<{ ida: DetalheFluxoUnidade | null; volta: DetalheFluxoUnidade | null } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const pronto = usarDuckDBPronto();

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    detalheFluxoUnidade(nivel, origem, destino).then((det) => { if (vivo) setDados(det); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [nivel, origem, destino]);

  if (carregando) {
    return <aside className="painel" aria-label={d.comum.ui.painelDetalhes}><p className="muted">{pronto ? d.comum.ui.carregandoFluxo : d.paineis.preparandoDados}</p></aside>;
  }

  const ida = dados?.ida ?? null;
  const volta = dados?.volta ?? null;

  if (!ida) {
    return (
      <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
        <header className="painel-topo">
          <h2>{d.paineis.fluxo.naoPublicado}</h2>
          <button className="fechar" onClick={aoFechar} aria-label={d.comum.ui.fecharPainel}>×</button>
        </header>
        <p className="muted">{d.paineis.fluxoUnidade.naoPublicadoMotivo}</p>
      </aside>
    );
  }

  const saldo = ida.total - (volta?.total ?? 0);
  const rotuloNivel = d.comum.niveis[nivel].titulo;

  return (
    <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">{rotuloNivel}</div>
          <h2 className="titulo-fluxo">
            {ida.nm_origem}{ida.uf_origem && ida.uf_origem !== ida.nm_origem && <span className="uf">/{ida.uf_origem}</span>}
            <span className="seta">→</span>
            {ida.nm_destino}{ida.uf_destino && ida.uf_destino !== ida.nm_destino && <span className="uf">/{ida.uf_destino}</span>}
          </h2>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label={d.comum.ui.fecharPainel}>×</button>
      </header>

      <AvisoProxy meta={meta} />
      {/* UF que não existia na época do censo (hoje só o Tocantins em 1980): a nota do meta diz
          que as trocas com o restante de Goiás aparecem como interestaduais -- exatamente o número
          deste painel, que sem o aviso ficaria sem contexto. O componente devolve null para UFs
          reais na época; uma só vez quando as duas pontas são a mesma UF fora da época. */}
      {nivel === "uf" && <AvisoUnidadeUf meta={meta} codigoUf={origem} />}
      {nivel === "uf" && destino !== origem && <AvisoUnidadeUf meta={meta} codigoUf={destino} />}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-rotulo">{d.paineis.fluxoUnidade.migrantesNesteFluxo}</div>
          <div className="kpi-valor">{num(ida.total)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">{d.paineis.fluxoInverso}</div>
          <div className="kpi-valor">{volta ? num(volta.total) : "—"}</div>
          <div className="kpi-detalhe">{volta ? `${ida.nm_destino} → ${ida.nm_origem}` : d.paineis.fluxoUnidade.abaixoLimiar}</div>
        </div>
        <div className="kpi kpi-largo">
          <div className="kpi-rotulo">{d.paineis.fluxoUnidade.saldoPar}</div>
          <div className="kpi-valor">{sinal(saldo)}</div>
          <div className="kpi-detalhe">
            {saldo > 0
              ? d.paineis.ganhaNaTroca(ida.nm_destino, num(Math.abs(saldo)), Math.abs(saldo), ida.nm_origem)
              : saldo < 0
              ? d.paineis.ganhaNaTroca(ida.nm_origem, num(Math.abs(saldo)), Math.abs(saldo), ida.nm_destino)
              : d.paineis.trocaEquilibrada(d.comum.niveis[nivel].par)}
          </div>
        </div>
      </div>

      <div className="nota-precisao">
        <Termo chave="precisao">{d.paineis.termos.precisao}</Termo>{d.paineis.dp} <strong>{rotuloPrecisao(ida.precisao, d)}</strong> ·{" "}
        <Termo chave="n_faixa">{d.paineis.observacoes(ida.n_faixa)}</Termo>{d.paineis.fluxoUnidade.naAmostraAgregado}
      </div>

    </aside>
  );
}

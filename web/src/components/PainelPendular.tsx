/** Painel de um par pendular selecionado (trabalho ou estudo): volume com IC 95%,
 *  fluxo inverso, saldo pendular, precisão e caracterização em barras 100%,
 *  comparada com o fluxo inverso quando ele existir. */
import { useEffect, useState } from "react";
import { usarDuckDBPronto } from "../db/duckdb";
import { detalhePendular, dimensoesPendular, type DetalhePendular } from "../db/queries";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { DIMENSOES_PENDULAR, type NomeDimensaoPendular } from "../lib/paletas";
import { valoresPendular, type NomeDimensaoDados } from "../lib/rm";
import { ic95, num, num1, rotuloPrecisao, sinal } from "../lib/format";
import { edicao } from "../lib/edicoes";
import { useStore } from "../state/store";

interface Props {
  origem: string;
  destino: string;
  /** "trab" usa pendular_trab(_dim); "estudo" usa pendular_estudo(_dim) */
  tipo: "trab" | "estudo";
  escuro: boolean;
  aoFechar: () => void;
}

type LinhaDim = { dimensao: string; categoria: string; valor: number; n_faixa: string };

// dimensões como aparecem no dado publicado (coluna `dimensao`, fixa nas duas edições --
// ver lib/rm.ts, valoresPendular); a escolha de PALETA por edição é feita separadamente,
// só no momento de renderizar (ver `paletaDim` abaixo).
const DIMS_TRAB: NomeDimensaoDados[] = [
  "frequencia", "modo", "tempo", "posicao", "setor", "ocupacao", "renda_trab", "edu",
];
const DIMS_ESTUDO: NomeDimensaoDados[] = ["nivel"];

export function PainelPendular({ origem, destino, tipo, escuro, aoFechar }: Props) {
  const censo = useStore((s) => s.censo);
  const ed = edicao(censo);
  const recursos = ed.recursos;
  const tabela = tipo === "trab" ? "pendular_trab" : "pendular_estudo";
  const tabelaDim = tipo === "trab" ? "pendular_trab_dim" : "pendular_estudo_dim";
  // 2010 não tem "modo" (sem quesito de meio de transporte); frequência/tempo usam
  // vocabulário próprio (V0661/V0662 têm definição e faixas diferentes de 2022, ver
  // docs/METODOLOGIA.md), mas a CHAVE DE DADOS filtrada é sempre "frequencia"/"tempo" --
  // só a paleta de exibição muda (ed.vocabulario), nunca o filtro em valoresPendular.
  const dimsBase = tipo === "trab" ? DIMS_TRAB : DIMS_ESTUDO;
  const dims: NomeDimensaoDados[] = dimsBase.filter((d) => recursos.modo || d !== "modo");
  /** paleta (DIMENSOES_PENDULAR) a exibir para uma dimensão de dados: usa a variante "*2010"
   *  só no map de exibição, nunca para filtrar os dados. */
  const paletaDim = (d: NomeDimensaoDados): NomeDimensaoPendular => {
    if (d === "tempo") return ed.vocabulario.tempo;
    if (d === "frequencia") return ed.vocabulario.frequencia;
    return d;
  };

  const [dados, setDados] = useState<{ ida: DetalhePendular | null; volta: DetalhePendular | null } | null>(null);
  const [dimIda, setDimIda] = useState<LinhaDim[]>([]);
  const [dimVolta, setDimVolta] = useState<LinhaDim[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    Promise.all([
      detalhePendular(origem, destino, tabela),
      dimensoesPendular(origem, destino, tabelaDim),
      dimensoesPendular(destino, origem, tabelaDim),
    ]).then(([d, di, dv]) => {
      if (!vivo) return;
      setDados(d); setDimIda(di); setDimVolta(dv);
    }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [origem, destino, tabela, tabelaDim]);

  const pronto = usarDuckDBPronto();
  if (carregando) return <aside className="painel" aria-label="Painel de detalhes"><p className="muted">{pronto ? "Carregando o fluxo pendular…" : "preparando os dados…"}</p></aside>;

  const ida = dados?.ida ?? null;
  const volta = dados?.volta ?? null;

  if (!ida) {
    return (
      <aside className="painel" aria-label="Painel de detalhes">
        <header className="painel-topo">
          <h2>Fluxo pendular não publicado</h2>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        </header>
        <p className="muted">Este par ficou abaixo do limiar de divulgação e não é publicado individualmente.</p>
      </aside>
    );
  }

  const saldo = ida.total - (volta?.total ?? 0);

  return (
    <aside className="painel" aria-label="Painel de detalhes">
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">
            Deslocamento pendular de {tipo === "trab" ? "trabalho" : "estudo"}
          </div>
          <h2 className="titulo-fluxo">
            {ida.nm_origem}<span className="uf">/{ida.uf_origem}</span>
            <span className="seta">→</span>
            {ida.nm_destino}<span className="uf">/{ida.uf_destino}</span>
          </h2>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-rotulo">Pessoas neste fluxo</div>
          <div className="kpi-valor">{num(ida.total)}</div>
          <div className="kpi-detalhe">IC 95%: {ic95(ida.total, ida.se)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">Fluxo inverso</div>
          <div className="kpi-valor">{volta ? num(volta.total) : "—"}</div>
          <div className="kpi-detalhe">{volta ? `${ida.nm_destino} → ${ida.nm_origem}` : "abaixo do limiar"}</div>
        </div>
        <div className="kpi kpi-largo">
          <div className="kpi-rotulo">Saldo pendular do par</div>
          <div className="kpi-valor">{sinal(saldo)}</div>
        </div>
        {tipo === "trab" && (
          <>
            {recursos.tempoMinutos && (
              <div className="kpi">
                <div className="kpi-rotulo">Tempo mediano</div>
                <div className="kpi-valor">{ida.tempo_mediano != null ? `${num(ida.tempo_mediano)} min` : "—"}</div>
              </div>
            )}
            <div className="kpi">
              <div className="kpi-rotulo">Retorno diário</div>
              <div className="kpi-valor">{ida.pct_diario != null ? `${num1(ida.pct_diario)}%` : "—"}</div>
              <div className="kpi-detalhe">{ed.rotuloRetorno}</div>
            </div>
            {recursos.modo && (
              <div className="kpi">
                <div className="kpi-rotulo">Transporte coletivo</div>
                <div className="kpi-valor">{ida.pct_coletivo != null ? `${num1(ida.pct_coletivo)}%` : "—"}</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="nota-precisao">
        Precisão: <strong>{rotuloPrecisao[ida.precisao] ?? ida.precisao}</strong>
        {ida.cv != null && <> (coeficiente de variação {num1(ida.cv)}%)</>} ·{" "}
        {ida.n_faixa === "<5" ? "menos de 5" : ida.n_faixa} observações na amostra
      </div>

      {!ida.tem_detalhe ? (
        <p className="aviso">
          A caracterização deste fluxo não é publicada: com menos de 20 observações na amostra,
          o detalhamento individualizaria os informantes.
        </p>
      ) : (
        <>
          <p className="muted-pequeno explicacao">
            Não há referência publicada para deslocamento pendular: a única linha é a deste fluxo,
            comparada ao fluxo inverso quando ele também for publicável.
          </p>
          {dims.map((dim) => {
            const agrupar = ed.vocabulario.tempo === "tempo";
            const valoresIda = valoresPendular(dimIda, dim, agrupar);
            const series: SeriePerfil[] = [{ rotulo: "Neste fluxo", valores: valoresIda, destaque: true }];
            if (volta && dimVolta.length > 0) {
              series.push({ rotulo: "Fluxo inverso", valores: valoresPendular(dimVolta, dim, agrupar) });
            }
            const paleta = DIMENSOES_PENDULAR[paletaDim(dim)];
            return (
              <BarraPerfil key={dim} titulo={paleta.titulo} nota={paleta.nota}
                           categorias={paleta.categorias} series={series} escuro={escuro} />
            );
          })}
        </>
      )}
    </aside>
  );
}

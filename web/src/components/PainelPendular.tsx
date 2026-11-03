/** Painel de um par pendular selecionado (trabalho ou estudo): volume com IC 95%,
 *  fluxo inverso, saldo pendular, precisão e caracterização em barras 100%,
 *  comparada com o fluxo inverso quando ele existir. */
import { useEffect, useState } from "react";
import { usarDuckDBPronto } from "../db/duckdb";
import { detalhePendular, dimensoesPendular, type DetalhePendular } from "../db/queries";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { dimensaoPendular, type NomeDimensaoPendular } from "../lib/paletas";
import { useT } from "../i18n";
import { valoresPendular, type NomeDimensaoDados } from "../lib/rm";
import { ic95, num, num1, rotuloPrecisao, sinal } from "../lib/format";
import { edicao, rotuloRetornoCenso } from "../lib/edicoes";
import { useStore } from "../state/store";
import type { Meta } from "../lib/types";
import { Termo } from "./Termo";
import { textoDado } from "../i18n/dados";

interface Props {
  origem: string;
  destino: string;
  /** "trab" usa pendular_trab(_dim); "estudo" usa pendular_estudo(_dim) */
  tipo: "trab" | "estudo";
  escuro: boolean;
  aoFechar: () => void;
  meta: Meta | null;
}

type LinhaDim = { dimensao: string; categoria: string; valor: number; n_faixa: string };

// dimensões como aparecem no dado publicado (coluna `dimensao`, fixa nas duas edições --
// ver lib/rm.ts, valoresPendular); a escolha de PALETA por edição é feita separadamente,
// só no momento de renderizar (ver `paletaDim` abaixo).
const DIMS_TRAB: NomeDimensaoDados[] = [
  "frequencia", "modo", "tempo", "posicao", "setor", "ocupacao", "renda_trab", "edu",
];
const DIMS_ESTUDO: NomeDimensaoDados[] = ["nivel"];

export function PainelPendular({ origem, destino, tipo, escuro, aoFechar, meta }: Props) {
  const d = useT();
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
  // 2000 não tem "tempo" nem "frequencia" (nenhum quesito de deslocamento além do
  // município de trabalho/estudo, ver docs/METODOLOGIA.md): ed.vocabulario.tempo/frequencia
  // vêm undefined nessa edição, e a dimensão correspondente nem é publicada em
  // pendular_trab_dim_bruto.parquet (07_pendular.sql), então tem de ser filtrada aqui como
  // "modo" já era.
  // 1980 não publica renda (nem pessoal, nem do trabalho principal -- a fonte atual, censobr/
  // IPEA, traz rendimento, mas ele ainda não foi mapeado nem validado; ver docs/METODOLOGIA.md,
  // "Edição Censo 1980 e comparabilidade", item 7): mesmo `recursos.renda` que esconde a dimensão "renda" nos
  // outros painéis também esconde "renda_trab" aqui.
  // 1980 também não tem "posicao" (o questionário não distingue empregado com/sem carteira/
  // militar estatutário, os únicos valores que o vocabulário do atlas usa para essa dimensão
  // -- ver pipeline/sql/1980/MAPEAMENTO_02_classify.md §6.6): `pos_grupo` fica NULL em 100%
  // das linhas dessa edição, então a dimensão é filtrada aqui como "renda_trab" já é.
  const dims: NomeDimensaoDados[] = dimsBase.filter((dm) =>
    (recursos.modo || dm !== "modo") &&
    (recursos.renda || dm !== "renda_trab") &&
    (recursos.posicao || dm !== "posicao") &&
    (ed.vocabulario.tempo != null || dm !== "tempo") &&
    (ed.vocabulario.frequencia != null || dm !== "frequencia"));
  /** paleta (DIMENSOES_PENDULAR) a exibir para uma dimensão de dados: usa a variante "*2010"
   *  só no map de exibição, nunca para filtrar os dados. Os fallbacks abaixo nunca são
   *  exercitados na prática -- `dims` já filtrou "tempo"/"frequencia" quando ausentes --,
   *  só existem para manter o tipo de retorno não opcional. */
  const paletaDim = (dm: NomeDimensaoDados): NomeDimensaoPendular => {
    if (dm === "tempo") return ed.vocabulario.tempo ?? "tempo";
    if (dm === "frequencia") return ed.vocabulario.frequencia ?? "frequencia";
    return dm;
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
    ]).then(([det, di, dv]) => {
      if (!vivo) return;
      setDados(det); setDimIda(di); setDimVolta(dv);
    }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [origem, destino, tabela, tabelaDim]);

  const pronto = usarDuckDBPronto();
  if (carregando) return <aside className="painel" aria-label={d.comum.ui.painelDetalhes}><p className="muted">{pronto ? d.paineis.pendular.carregando : d.paineis.preparandoDados}</p></aside>;

  const ida = dados?.ida ?? null;
  const volta = dados?.volta ?? null;

  if (!ida) {
    return (
      <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
        <header className="painel-topo">
          <h2>{d.paineis.pendular.naoPublicado}</h2>
          <button className="fechar" onClick={aoFechar} aria-label={d.comum.ui.fecharPainel}>×</button>
        </header>
        <p className="muted">{d.paineis.pendular.naoPublicadoMotivo}</p>
      </aside>
    );
  }

  const saldo = ida.total - (volta?.total ?? 0);

  return (
    <aside className="painel" aria-label={d.comum.ui.painelDetalhes}>
      <header className="painel-topo">
        <div>
          <div className="muted-pequeno">
            <Termo chave="pendular_conceito">{d.paineis.pendular.deslocamento.termo}</Termo>{tipo === "trab" ? d.paineis.pendular.deslocamento.deTrabalho : d.paineis.pendular.deslocamento.deEstudo}
          </div>
          <h2 className="titulo-fluxo">
            {ida.nm_origem}<span className="uf">/{ida.uf_origem}</span>
            <span className="seta">→</span>
            {ida.nm_destino}<span className="uf">/{ida.uf_destino}</span>
          </h2>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label={d.comum.ui.fecharPainel}>×</button>
      </header>

      {/* universo do quesito (hoje só 1980, estudo: 10 anos ou mais) -- texto vem do meta,
          mesma nota que a série mostra (pend_estudo_universo_1980), nunca hardcoded aqui */}
      {tipo === "estudo" && meta?.aviso_pendular_estudo && (
        <div className="aviso aviso-unidade" role="note">
          <p><strong>{d.paineis.pendular.universoEdicao}</strong> {textoDado(`aviso_pendular_estudo.${meta.edicao}`, meta.aviso_pendular_estudo)}</p>
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-rotulo">{d.paineis.pendular.pessoasNesteFluxo}</div>
          <div className="kpi-valor">{num(ida.total)}</div>
          <div className="kpi-detalhe"><Termo chave="ic95">{d.paineis.termos.ic95}</Termo>{d.paineis.dp} {ic95(ida.total, ida.se)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">{d.paineis.fluxoInverso}</div>
          <div className="kpi-valor">{volta ? num(volta.total) : "—"}</div>
          <div className="kpi-detalhe">{volta ? `${ida.nm_destino} → ${ida.nm_origem}` : d.paineis.pendular.abaixoLimiar}</div>
        </div>
        <div className="kpi kpi-largo">
          <div className="kpi-rotulo">{d.paineis.pendular.saldoPendular}</div>
          <div className="kpi-valor">{sinal(saldo)}</div>
        </div>
        {tipo === "trab" && (
          <>
            {recursos.tempoMinutos && (
              <div className="kpi">
                <div className="kpi-rotulo"><Termo chave="pendular_tempo_mediano">{d.paineis.pendular.tempoMediano}</Termo></div>
                <div className="kpi-valor">{ida.tempo_mediano != null ? d.paineis.pendular.minutos(num(ida.tempo_mediano)) : "—"}</div>
              </div>
            )}
            {ed.rotuloRetorno != null && (
              <div className="kpi">
                <div className="kpi-rotulo"><Termo chave="pendular_retorno_diario">{d.paineis.pendular.retornoDiario}</Termo></div>
                <div className="kpi-valor">{ida.pct_diario != null ? d.paineis.pct(num1(ida.pct_diario)) : "—"}</div>
                <div className="kpi-detalhe">{rotuloRetornoCenso(ed.nome, d)}</div>
              </div>
            )}
            {recursos.modo && (
              <div className="kpi">
                <div className="kpi-rotulo"><Termo chave="pendular_pct_coletivo">{d.paineis.pendular.transporteColetivo}</Termo></div>
                <div className="kpi-valor">{ida.pct_coletivo != null ? d.paineis.pct(num1(ida.pct_coletivo)) : "—"}</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="nota-precisao">
        <Termo chave="precisao">{d.paineis.termos.precisao}</Termo>{d.paineis.dp} <strong>{rotuloPrecisao(ida.precisao, d)}</strong>
        {ida.cv != null && <> (<Termo chave="cv">{d.paineis.termos.coefVariacao}</Termo> {d.paineis.pct(num1(ida.cv))})</>} ·{" "}
        <Termo chave="n_faixa">{d.paineis.observacoes(ida.n_faixa)}</Termo>{d.paineis.naAmostra}
      </div>

      {!ida.tem_detalhe ? (
        <p className="aviso">
          {d.paineis.pendular.caracterizacaoNaoPublicada(meta?.revelacao.min_pessoas_detalhe ?? 20)}
        </p>
      ) : (
        <>
          <p className="muted-pequeno explicacao">{d.paineis.pendular.semReferencia}</p>
          {dims.map((dim) => {
            const agrupar = ed.vocabulario.tempo === "tempo";
            const valoresIda = valoresPendular(dimIda, dim, agrupar);
            const series: SeriePerfil[] = [{ rotulo: d.paineis.nesteFluxo, valores: valoresIda, destaque: true }];
            if (volta && dimVolta.length > 0) {
              series.push({ rotulo: d.paineis.fluxoInverso, valores: valoresPendular(dimVolta, dim, agrupar) });
            }
            const paleta = dimensaoPendular(paletaDim(dim), d);
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

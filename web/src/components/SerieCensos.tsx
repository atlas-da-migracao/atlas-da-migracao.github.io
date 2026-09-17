/** F12.5 -- Seção completa "Ao longo dos censos" (`?pagina=serie`), overlay de página inteira
 *  no mesmo padrão de `PaginaMetodologia.tsx` (foco no fechar, Esc, devolve foco ao gatilho).
 *  Ver docs/design_serie_censos.md, seções 1.2 (wireframe), 3 (blocos) e 6 (responsivo/teclado).
 *
 *  Desvios do documento de desenho, registrados no relatório de entrega (não decisão
 *  silenciosa): por limite de tempo desta fase, os gráficos do Bloco 2 (plano MEI×CMI com
 *  contornos de ANMR, dispersão de Fielding, figura de Courgeau) e o mapa comparativo do
 *  Bloco 1 NÃO foram implementados como visualização gráfica -- aparecem como tabela de
 *  números (mesmos dados, mesma fonte, sem a peça visual). `@observablehq/plot` já é
 *  dependência do projeto para isso ser completado depois sem nova biblioteca.
 */
import { useEffect, useRef, useState } from "react";
import {
  serieDaUnidade, serieDosPares, serieDoSistema, serieFilhosDoMunicipio, seriePerfil,
} from "../db/queries";
import {
  EDICOES_SERIE, classificarIem, fraseSintese, harmonizarStatus, rotuloEdicao, tramaDoEstado,
  PALAVRA_ESTADO,
  type EdicaoSerie, type EntradaFrase, type EstadoCelula, type NivelSerie, type PontoFrase,
} from "../lib/serie";
import { num, num1, num2, sinal } from "../lib/format";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { DIMENSOES } from "../lib/paletas";
import { MapaSerieCensos } from "./MapaSerieCensos";
import { GraficosSistema } from "./GraficosSistema";

const ROTULO_NIVEL: Record<NivelSerie, string> = {
  mun: "município", rgi: "região imediata", rgint: "região intermediária", uf: "UF", rm: "região metropolitana",
};

interface LinhaUnidadeSerie {
  edicao: EdicaoSerie;
  imig: number | null; emig: number | null; saldo: number | null;
  tbi: number | null; tbe: number | null; tlm: number | null;
  iem: number | null; se_iem: number | null;
  turnover: number | null; taxa_rotatividade: number | null;
  distancia_media: number | null; distancia_mediana: number | null; pct_interestadual: number | null;
  n_parceiros: number | null; gini_linha: number | null; gini_coluna: number | null;
  saida_trab: number | null; entrada_trab: number | null; pct_pendular: number | null;
  existia: boolean; estado_cobertura: string | null;
  cd_mun_mae: string | null; nm_mun_mae: string | null;
}

function estadoDoPonto(l: LinhaUnidadeSerie | undefined): EstadoCelula {
  if (!l) return "nao_medido";
  if (l.existia === false) return "nao_existia";
  if (l.estado_cobertura === "sem_cobertura") return "sem_cobertura";
  if (l.estado_cobertura === "insuficiente") return "cobertura_insuficiente";
  return "numero";
}

/** Célula de uma medida qualquer: número quando existe, palavra + trama quando não. */
function Celula({ valor, estado, formatar }: {
  valor: number | null; estado: EstadoCelula; formatar: (v: number) => string;
}) {
  if (estado !== "numero" || valor == null) {
    const trama = tramaDoEstado(estado);
    return (
      <td className={`serie-celula-vazia${trama ? ` trama-${trama}` : ""}`}>
        {PALAVRA_ESTADO[estado]}
      </td>
    );
  }
  return <td>{formatar(valor)}</td>;
}

function LinhaSpark({ valores }: { valores: (number | null)[] }) {
  const validos = valores.filter((v): v is number => v != null);
  if (validos.length === 0) return <td className="serie-spark-cel">—</td>;
  const min = Math.min(0, ...validos), max = Math.max(0, ...validos);
  const span = max - min || 1;
  const w = 70, h = 22, passo = w / (valores.length - 1 || 1);
  const y = (v: number) => h - ((v - min) / span) * h;
  return (
    <td className="serie-spark-cel">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
        <polyline
          points={valores.map((v, i) => (v == null ? null : `${i * passo},${y(v)}`)).filter(Boolean).join(" ")}
          fill="none" stroke="currentColor" strokeWidth={1.3} />
      </svg>
    </td>
  );
}

interface MedidaTabela {
  chave: string;
  rotulo: string;
  unidade: string;
  campo: keyof LinhaUnidadeSerie;
  formatar: (v: number) => string;
}

const MEDIDAS_BLOCO1: MedidaTabela[] = [
  { chave: "tlm", rotulo: "Taxa líquida de migração", unidade: "‰", campo: "tlm", formatar: (v) => `${sinal(v)}‰` },
  { chave: "iem", rotulo: "Índice de eficácia migratória", unidade: "", campo: "iem", formatar: (v) => (v > 0 ? "+" : "") + v.toFixed(2) },
  { chave: "tbi", rotulo: "Taxa bruta de imigração", unidade: "‰", campo: "tbi", formatar: num1 },
  { chave: "tbe", rotulo: "Taxa bruta de emigração", unidade: "‰", campo: "tbe", formatar: num1 },
  { chave: "imig", rotulo: "Imigrantes", unidade: "", campo: "imig", formatar: num },
  { chave: "emig", rotulo: "Emigrantes", unidade: "", campo: "emig", formatar: num },
  { chave: "saldo", rotulo: "Saldo", unidade: "", campo: "saldo", formatar: sinal },
  { chave: "turnover", rotulo: "Rotatividade (entr.+saíd.)", unidade: "", campo: "turnover", formatar: num },
  { chave: "distancia_media", rotulo: "Distância média (km)", unidade: "km", campo: "distancia_media", formatar: num },
  { chave: "pct_interestadual", rotulo: "% que cruza a UF", unidade: "%", campo: "pct_interestadual", formatar: (v) => `${num1(v)}%` },
  { chave: "gini_linha", rotulo: "Concentração origens (Gini)", unidade: "", campo: "gini_linha", formatar: num2 },
];

function BlocoUnidade({ nivel, codigo, linhas, escuro }: {
  nivel: NivelSerie; codigo: string; linhas: LinhaUnidadeSerie[]; escuro: boolean;
}) {
  const porEdicao = new Map(linhas.map((l) => [l.edicao, l]));
  return (
    <section className="secao serie-bloco" id="bloco-1" aria-labelledby="bloco-1-titulo">
      <h3 id="bloco-1-titulo">Bloco 1 · A migração de {ROTULO_NIVEL[nivel]}, censo a censo</h3>
      <div className="tabela-scroll">
        <table className="tabela-serie">
          <thead>
            <tr>
              <th>Medida</th>
              <th>tend.</th>
              {EDICOES_SERIE.map((e) => <th key={e}>{rotuloEdicao(e)}</th>)}
            </tr>
          </thead>
          <tbody>
            {MEDIDAS_BLOCO1.map((m) => {
              const valores = EDICOES_SERIE.map((e) => {
                const l = porEdicao.get(e);
                const estado = estadoDoPonto(l);
                const v = l ? (l[m.campo] as number | null) : null;
                return estado === "numero" ? v : null;
              });
              return (
                <tr key={m.chave}>
                  <td>{m.rotulo}</td>
                  <LinhaSpark valores={valores} />
                  {EDICOES_SERIE.map((e, i) => (
                    <Celula key={e} valor={valores[i]} estado={estadoDoPonto(porEdicao.get(e))}
                            formatar={m.formatar} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted-pequeno">
        Coluna "tend." = sparkline 1980→2022. 1980 leva o selo de proxy (ver aviso no topo da seção).
      </p>
      <MapaSerieCensos nivel={nivel} codigo={codigo} escuro={escuro} />
    </section>
  );
}

function BlocoSistema({ nivel }: { nivel: NivelSerie }) {
  const [linhas, setLinhas] = useState<Record<string, unknown>[] | null>(null);
  useEffect(() => {
    let vivo = true;
    serieDoSistema(nivel).then((r) => { if (vivo) setLinhas(r); }).catch(() => { if (vivo) setLinhas([]); });
    return () => { vivo = false; };
  }, [nivel]);
  if (!linhas) return <p className="muted">Carregando o sistema…</p>;
  return (
    <section className="secao serie-bloco" id="bloco-2" aria-labelledby="bloco-2-titulo">
      <h3 id="bloco-2-titulo">Bloco 2 · O sistema de {ROTULO_NIVEL[nivel]}s em que esta unidade está</h3>
      <p className="muted-pequeno">
        Estes números descrevem o conjunto de unidades do nível, não a unidade selecionada. Eles
        mudam com o número de unidades e só podem ser comparados dentro do mesmo nível.
      </p>
      {nivel !== "rm" && <GraficosSistema nivel={nivel} linhasSistema={linhas} />}
      {(() => {
        const duncans = linhas
          .filter((l) => l.duncan_d_ant != null)
          .map((l) => `${rotuloEdicao(l.edicao as EdicaoSerie)} ${num2(l.duncan_d_ant as number)}`);
        return duncans.length > 0 ? (
          <p className="muted-pequeno" title="Índice de Duncan D: fração dos fluxos que teria de mudar de par origem-destino para a estrutura de um censo ficar igual à do anterior.">
            Quanto a estrutura dos fluxos mudou entre censos (Duncan D, comparado à edição anterior): {duncans.join(" · ")}.
          </p>
        ) : null;
      })()}
      <div className="tabela-scroll">
        <table className="tabela-serie">
          <thead>
            <tr><th>Edição</th><th>n unidades</th><th>CMI (%)</th><th>SMI (%)</th>
                <th>MEI (%)</th><th>ANMR (%)</th><th>β Fielding</th><th>Duncan D (ant.)</th></tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={String(l.edicao)}>
                <td>{rotuloEdicao(l.edicao as EdicaoSerie)}</td>
                <td>{num(l.n_unidades as number)}</td>
                <td>{num1(l.cmi as number)}</td>
                <td>{num1(l.smi as number)}</td>
                <td>{num1(l.mei as number)}</td>
                <td>{num1(l.anmr as number)}</td>
                <td>{l.beta_fielding != null ? `${num2(l.beta_fielding as number)} ± ${num2(l.ep_beta as number)}` : "—"}</td>
                <td>{l.duncan_d_ant != null ? num2(l.duncan_d_ant as number) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Agrupa as linhas de `serieDosPares` por parceiro (código do outro lado do par), com o
 *  nome resolvido via `unidades_nomes` (join já feito na consulta -- `nome_parceiro`). */
function agruparPorParceiro(linhas: Record<string, unknown>[], ladoVariavel: "origem" | "destino") {
  const porParceiro = new Map<string, {
    nome: string; linhas: Record<EdicaoSerie, Record<string, unknown> | undefined>;
  }>();
  for (const l of linhas) {
    const chave = String(l[ladoVariavel]);
    if (!porParceiro.has(chave)) {
      porParceiro.set(chave, {
        nome: (l.nome_parceiro as string | null) ?? chave,
        linhas: {} as Record<EdicaoSerie, Record<string, unknown>>,
      });
    }
    porParceiro.get(chave)!.linhas[l.edicao as EdicaoSerie] = l;
  }
  return porParceiro;
}

function TabelaParceiros({ titulo, porParceiro }: {
  titulo: string;
  porParceiro: Map<string, { nome: string; linhas: Record<EdicaoSerie, Record<string, unknown> | undefined> }>;
}) {
  if (porParceiro.size === 0) return <p className="muted-pequeno">{titulo}: nenhum par publicado.</p>;
  return (
    <div className="tabela-scroll">
      <table className="tabela-serie">
        <thead>
          <tr><th>{titulo}</th>{EDICOES_SERIE.map((e) => <th key={e}>{rotuloEdicao(e)}</th>)}</tr>
        </thead>
        <tbody>
          {[...porParceiro.entries()].slice(0, 12).map(([codigoParceiro, { nome, linhas }]) => (
            <tr key={codigoParceiro}>
              <td>{nome}</td>
              {EDICOES_SERIE.map((e) => {
                const p = linhas[e];
                if (!p || p.posto == null) {
                  const motivo = p?.motivo_ausencia as string | undefined;
                  const rotuloMotivo = motivo === "suprimido" ? "▒ supr."
                    : motivo === "nao_existia" ? "░ não exist."
                    : motivo === "nao_medido" ? "não medido" : "—";
                  const trama = motivo === "suprimido" ? "trama-cruzada"
                    : motivo === "nao_medido" ? "trama-pontilhada" : "trama-diagonal";
                  return <td key={e} className={`serie-celula-vazia ${trama}`}>{rotuloMotivo}</td>;
                }
                return <td key={e}>{num(p.posto as number)}º · {num(p.total as number)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlocoFluxos({ nivel, codigo }: { nivel: NivelSerie; codigo: string }) {
  const [origens, setOrigens] = useState<Record<string, unknown>[] | null>(null);
  const [destinos, setDestinos] = useState<Record<string, unknown>[] | null>(null);
  useEffect(() => {
    let vivo = true;
    // "destino" = a unidade selecionada é o destino do fluxo -> o parceiro é a ORIGEM
    // (de onde vieram os imigrantes dela); "origem" = a unidade é a origem -> o parceiro é
    // o DESTINO (para onde foram os emigrantes dela). Ver docstring de `serieDosPares`.
    serieDosPares(nivel, codigo, "destino").then((r) => { if (vivo) setOrigens(r); })
      .catch(() => { if (vivo) setOrigens([]); });
    serieDosPares(nivel, codigo, "origem").then((r) => { if (vivo) setDestinos(r); })
      .catch(() => { if (vivo) setDestinos([]); });
    return () => { vivo = false; };
  }, [nivel, codigo]);
  if (!origens || !destinos) return <p className="muted">Carregando fluxos…</p>;
  const porOrigem = agruparPorParceiro(origens, "origem");
  const porDestino = agruparPorParceiro(destinos, "destino");
  return (
    <section className="secao serie-bloco" id="bloco-3" aria-labelledby="bloco-3-titulo">
      <h3 id="bloco-3-titulo">Bloco 3 · De onde vieram e para onde foram</h3>
      <TabelaParceiros titulo="Principais origens" porParceiro={porOrigem} />
      <TabelaParceiros titulo="Principais destinos" porParceiro={porDestino} />
      <p className="muted-pequeno">
        Posto (grande) e volume (pequeno) por edição, ordenado pela edição mais recente com número.
      </p>
    </section>
  );
}

function BlocoPerfil({ nivel, codigo, escuro }: { nivel: NivelSerie; codigo: string; escuro: boolean }) {
  const [linhas, setLinhas] = useState<Awaited<ReturnType<typeof seriePerfil>> | null>(null);
  useEffect(() => {
    let vivo = true;
    seriePerfil(nivel, codigo, "status").then((r) => { if (vivo) setLinhas(r); })
      .catch(() => { if (vivo) setLinhas([]); });
    return () => { vivo = false; };
  }, [nivel, codigo]);
  if (!linhas) return <p className="muted">Carregando perfil…</p>;

  const series: SeriePerfil[] = EDICOES_SERIE.map((edicao) => {
    const doAno = linhas.filter((l) => l.edicao === edicao && l.direcao === "imig");
    const brutos: Record<string, number | null> = {};
    for (const l of doAno) brutos[l.categoria] = l.valor;
    // Harmoniza o vocabulário de status: 2022 distingue primeira_saida/etapas_multiplas, as
    // demais edições (1980-2010) só têm nao_natural -- sem colapsar as duas categorias de
    // 2022, a série compararia peras com maçãs (ver docs/METODOLOGIA.md, "Comparação entre
    // censos (F12)", harmonização de status).
    const harmonizado = harmonizarStatus(brutos, edicao);
    const valores: Record<string, number> = {};
    for (const [k, v] of Object.entries(harmonizado)) if (v != null) valores[k] = v;
    return { rotulo: rotuloEdicao(edicao), valores };
  });

  return (
    <section className="secao serie-bloco" id="bloco-4" aria-labelledby="bloco-4-titulo">
      <h3 id="bloco-4-titulo">Bloco 4 · Quem migra (chegaram)</h3>
      <BarraPerfil
        titulo="Status migratório, por edição"
        categorias={DIMENSOES.status.categorias}
        series={series}
        escuro={escuro}
        motivoVazio={(s) => (s.rotulo.startsWith("1980") ? "não medido nesta edição" : "sem dado publicável")}
      />
    </section>
  );
}

interface Props {
  nivel: NivelSerie;
  codigo: string;
  nome: string;
  escuro: boolean;
  aoFechar: () => void;
}

export function SerieCensos({ nivel, codigo, nome, escuro, aoFechar }: Props) {
  const fecharRef = useRef<HTMLButtonElement>(null);
  const gatilho = useRef<Element | null>(null);
  const [linhas, setLinhas] = useState<LinhaUnidadeSerie[] | null>(null);
  const [filhos, setFilhos] = useState<string[]>([]);

  useEffect(() => {
    gatilho.current = document.activeElement;
    fecharRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      (gatilho.current as HTMLElement | null)?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let vivo = true;
    serieDaUnidade(nivel, codigo).then((r) => { if (vivo) setLinhas(r as unknown as LinhaUnidadeSerie[]); })
      .catch(() => { if (vivo) setLinhas([]); });
    if (nivel === "mun") {
      serieFilhosDoMunicipio(codigo).then((r) => { if (vivo) setFilhos(r.map((f) => f.codigo)); }).catch(() => {});
    }
    return () => { vivo = false; };
  }, [nivel, codigo]);

  const porEdicao = new Map((linhas ?? []).map((l) => [l.edicao, l]));
  const pontos: PontoFrase[] = EDICOES_SERIE.map((edicao) => {
    const l = porEdicao.get(edicao);
    const estado = l ? estadoDoPonto(l) : "nao_medido";
    return {
      edicao, estado: estado === "numero" ? "numero" : estado as PontoFrase["estado"],
      iem: estado === "numero" ? l!.iem : null,
      seIem: l?.se_iem ?? null,
      tipo: estado === "numero" ? classificarIem(l!.iem, l!.se_iem) : null,
      imig: estado === "numero" ? l!.imig : null,
      emig: estado === "numero" ? l!.emig : null,
      saldo: estado === "numero" ? l!.saldo : null,
      tlm: estado === "numero" ? l!.tlm : null,
      coberturaPop: null,
    };
  });
  const primeiraMae = (linhas ?? []).find((l) => l.cd_mun_mae);
  const entrada: EntradaFrase = {
    nome, nivel, pontos,
    mae: primeiraMae ? {
      nome: primeiraMae.nm_mun_mae ?? primeiraMae.cd_mun_mae!,
      edicoes: (linhas ?? []).filter((l) => l.cd_mun_mae).map((l) => l.edicao),
      agregada: primeiraMae.cd_mun_mae === "NORTEGO",
    } : undefined,
    filhos: filhos.length > 0 ? { nomes: filhos, ultimaEdicaoJunto: "2010" } : undefined,
  };
  const frase = linhas ? fraseSintese(entrada) : "";

  return (
    <div className="pagina-cheia" role="dialog" aria-modal="true" aria-labelledby="serie-titulo">
      <header className="pagina-cheia-topo">
        <h2 id="serie-titulo">Ao longo dos censos — {nome}</h2>
        <button ref={fecharRef} className="fechar" onClick={aoFechar} aria-label="Fechar a série completa">×</button>
      </header>
      <div className="pagina-cheia-corpo">
        <nav className="serie-indice" aria-label="Blocos da série">
          <a href="#bloco-1">Bloco 1</a><a href="#bloco-2">Bloco 2</a>
          <a href="#bloco-3">Bloco 3</a><a href="#bloco-4">Bloco 4</a>
        </nav>
        {linhas === null ? (
          <p className="muted">Carregando a série…</p>
        ) : linhas.length === 0 ? (
          <p className="muted">Não há série publicada para esta unidade.</p>
        ) : (
          <>
            <p className="serie-frase serie-frase-completa">{frase}</p>
            <BlocoUnidade nivel={nivel} codigo={codigo} linhas={linhas} escuro={escuro} />
            <BlocoSistema nivel={nivel} />
            <BlocoFluxos nivel={nivel} codigo={codigo} />
            <BlocoPerfil nivel={nivel} codigo={codigo} escuro={escuro} />
          </>
        )}
        <section className="secao">
          <h3>Glossário</h3>
          <dl className="serie-glossario">
            <dt id="gl-iem">IEM (MEI)</dt>
            <dd>Índice de eficácia migratória: diferença entre quem chegou e quem saiu, dividida
                pela soma dos dois. Vai de −1 (só saída) a +1 (só entrada).</dd>
            <dt id="gl-cmi">CMI</dt>
            <dd>Taxa bruta de intensidade migratória: % da população que mudou de município no
                período, no conjunto de unidades do nível.</dd>
            <dt id="gl-cv">CV</dt>
            <dd>Coeficiente de variação: erro-padrão dividido pela estimativa, em %. Acima de 25%
                o número é impreciso.</dd>
          </dl>
          <p className="muted-pequeno">
            Metodologia completa: <a href="?pagina=metodologia">ver ?pagina=metodologia</a>.
          </p>
        </section>
      </div>
    </div>
  );
}

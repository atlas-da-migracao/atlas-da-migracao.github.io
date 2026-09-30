/** F12.5 -- Seção completa "Ao longo dos censos" (`?pagina=serie`), overlay de página inteira
 *  no mesmo padrão de `PaginaMetodologia.tsx` (foco no fechar, Esc, devolve foco ao gatilho).
 *  Ver docs/design_serie_censos.md, seções 1.2 (wireframe), 3 (blocos) e 6 (responsivo/teclado).
 *
 *  Unidades: `pct_interestadual` chega de `unidades_serie` como FRAÇÃO (0-1) e é convertida para
 *  percentual UMA vez, na leitura (`normalizarLinhaUnidade`, lib/serie.ts) -- daí em diante tudo
 *  aqui lê percentual. `iem` é sempre o índice [-1, 1], formatado por `formatarIem`.
 *
 *  O Bloco 2 (gráficos MEI×CMI, Fielding, Courgeau) mora em `GraficosSistema.tsx` e o mapa
 *  comparativo do Bloco 1 em `MapaSerieCensos.tsx`; aqui ficam as tabelas, a frase e os Blocos 3-4.
 */
import { useEffect, useState } from "react";
import { GLOSSARIO } from "../lib/glossario";
import { Termo } from "./Termo";
import {
  serieDaUnidade, serieDosPares, serieDoSistema, serieFilhosDoMunicipio, seriePerfil,
} from "../db/queries";
import {
  carregarComparabilidade, edicaoAnterior, estadoDaCelula, filhosNoIntervalo, filtrarEdicoes,
  formatarIem, fraseSintese, geometriaSpark, maeDaSerie, normalizarLinhaUnidade,
  ordenarPorPostoRecente, perfilStatusDaEdicao, pontosDaSerie, ressalvasDoBloco, ROTULO_NIVEL_PLURAL, rotuloEdicao,
  rotuloIntervalo, tipoFluxoPredominante, tramaDoEstado, PALAVRA_ESTADO,
  type Comparabilidade, type EdicaoSerie, type EntradaFrase, type EstadoCelula,
  type FilhoMunicipio, type NivelSerie,
} from "../lib/serie";
import { num, num1, num2, sinal, sinal1 } from "../lib/format";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { DIMENSOES } from "../lib/paletas";
import { MapaSerieCensos } from "./MapaSerieCensos";
import { GraficosSistema } from "./GraficosSistema";

/** Termos do glossário exibidos ao fim da seção "Ao longo dos censos", nesta ordem.
 *  O conteúdo vem de `lib/glossario.ts` (fonte única do projeto) -- não duplicar texto aqui. */
const CHAVES_GLOSSARIO_SERIE = [
  "saldo", "taxa_liquida", "eficacia_iem", "rotatividade", "distancia_media",
  "pct_interestadual", "gini", "tipo_fluxo_predominante", "cmi", "smi", "mei_agregado", "anmr",
  "beta_fielding", "duncan_d", "n_unidades", "posto", "cv", "precisao", "n_faixa",
  "status_migratorio", "escolaridade", "renda_domiciliar", "idade_sexo",
] as const;


export const ROTULO_NIVEL: Record<NivelSerie, string> = {
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
  existia: boolean; estado_cobertura: string | null; cobertura_pop: number | null;
  cd_mun_mae: string | null; nm_mun_mae: string | null;
}

function estadoDoPonto(l: LinhaUnidadeSerie | undefined): EstadoCelula {
  if (!l) return "nao_medido";
  if (l.existia === false) return "nao_existia";
  if (l.estado_cobertura === "sem_cobertura") return "sem_cobertura";
  if (l.estado_cobertura === "insuficiente") return "cobertura_insuficiente";
  return "numero";
}

/** Ressalva de comparabilidade de UMA célula (`comparabilidade.json`): o selo "ⓘ" leva o texto da
 *  nota como tooltip. `nao_comparavel` nunca mostra número (invariante da F12.5-t). */
interface RessalvaCelula { estado: "comparavel_com_ressalva" | "nao_comparavel"; texto: string }

function MarcaRessalva({ texto }: { texto: string }) {
  return (
    <span role="img" aria-label={`Ressalva: ${texto}`} title={texto}
          style={{ cursor: "help", marginLeft: 3, fontSize: "0.85em", color: "var(--ink-muted-texto)" }}>
      ⓘ
    </span>
  );
}

/** Célula de uma medida qualquer: número quando existe, palavra + trama quando não.
 *
 *  `estado === "numero"` (a edição É comparável para esta unidade) com `valor == null` é um
 *  caso à parte: a MEDIDA específica não pôde ser calculada para esta linha (ex.: Gini de
 *  fluxos sem pares suficientes, distância média não computada em nível RM) -- não é a mesma
 *  coisa que a unidade não existir ou ter cobertura insuficiente. Bug encontrado na auditoria
 *  F12.6-aud: a versão anterior renderizava `PALAVRA_ESTADO.numero` (string vazia) sem trama
 *  nenhuma -- uma célula em branco, indistinguível de um erro de carregamento. Tratada aqui
 *  como "não publicado" com a trama cruzada (mesma família visual de "há dado, mas não pode
 *  ser mostrado" -- aqui por insuficiência estrutural, não por sigilo, mas o efeito para quem
 *  lê é o mesmo: nenhum número, e a razão está no tooltip). */
function Celula({ valor, estado, formatar, ressalva }: {
  valor: number | null; estado: EstadoCelula; formatar: (v: number) => string;
  ressalva?: RessalvaCelula | null;
}) {
  if (estado === "numero" && ressalva?.estado === "nao_comparavel") {
    return <td className="serie-celula-vazia" title={ressalva.texto}>{PALAVRA_ESTADO.nao_comparavel}</td>;
  }
  if (estado === "numero" && valor == null) {
    return <td className="serie-celula-vazia trama-cruzada" title="Não foi possível calcular esta medida para esta unidade/edição.">
      não publicado
    </td>;
  }
  if (estado !== "numero" || valor == null) {
    const trama = tramaDoEstado(estado);
    return (
      <td className={`serie-celula-vazia${trama ? ` trama-${trama}` : ""}`}>
        {PALAVRA_ESTADO[estado]}
      </td>
    );
  }
  return <td>{formatar(valor)}{ressalva && <MarcaRessalva texto={ressalva.texto} />}</td>;
}

const SPARK_W = 76, SPARK_H = 24;

/** Coluna "tend.": uma posição por edição marcada, sem interpolar. Segmentos só entre pontos
 *  contíguos (uma lacuna abre a linha), um ponto em cada valor -- inclusive quando só há um --
 *  e uma marca tracejada nas posições sem número. 1980 (proxy) é losango vazado, como no
 *  desenho (seção 1.1); o marcador depende da EDIÇÃO, não da posição (com o subconjunto
 *  [1991, 2022] o primeiro ponto é 1991, círculo cheio). */
function LinhaSpark({ valores, edicoes }: { valores: (number | null)[]; edicoes: readonly EdicaoSerie[] }) {
  const g = geometriaSpark(valores, SPARK_W, SPARK_H);
  return (
    <td className="serie-spark-cel">
      <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden>
        {g.segmentos.map((seg, i) => (
          <polyline key={i} points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none" stroke="currentColor" strokeWidth={1.3} />
        ))}
        {g.ausentes.map((a) => (
          <rect key={`a${a.i}`} x={a.x - 2} y={SPARK_H / 2 - 4} width={4} height={8} fill="none"
                stroke="var(--ink-muted)" strokeWidth={1} strokeDasharray="1.5 1.5" />
        ))}
        {g.pontos.map((p) => edicoes[p.i] === "1980" ? (
          <polygon key={p.i} fill="var(--plane)" stroke="currentColor" strokeWidth={1.2}
                   points={`${p.x},${p.y - 3.4} ${p.x + 3.4},${p.y} ${p.x},${p.y + 3.4} ${p.x - 3.4},${p.y}`} />
        ) : (
          <circle key={p.i} cx={p.x} cy={p.y} r={2} fill="currentColor" />
        ))}
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
  /** Chave em `GLOSSARIO`, quando há um termo correspondente. Nunca invente uma aproximada. */
  glossario?: string;
  /** Chave da medida em `comparabilidade.json` (`matriz[].medida`) -- nem sempre igual a `chave`
   *  (a coluna `turnover` é a medida `rotatividade`). */
  medidaComp: string;
}

const MEDIDAS_BLOCO1: MedidaTabela[] = [
  { chave: "tlm", rotulo: "Taxa líquida de migração", unidade: "‰", campo: "tlm", formatar: (v) => `${sinal1(v)}‰`, glossario: "taxa_liquida", medidaComp: "tlm" },
  { chave: "iem", rotulo: "Índice de eficácia migratória", unidade: "", campo: "iem", formatar: formatarIem, glossario: "eficacia_iem", medidaComp: "iem" },
  { chave: "tbi", rotulo: "Taxa bruta de imigração", unidade: "‰", campo: "tbi", formatar: num1, medidaComp: "tbi" },
  { chave: "tbe", rotulo: "Taxa bruta de emigração", unidade: "‰", campo: "tbe", formatar: num1, medidaComp: "tbe" },
  { chave: "imig", rotulo: "Imigrantes", unidade: "", campo: "imig", formatar: num, glossario: "imigrantes", medidaComp: "imig" },
  { chave: "emig", rotulo: "Emigrantes", unidade: "", campo: "emig", formatar: num, glossario: "emigrantes", medidaComp: "emig" },
  { chave: "saldo", rotulo: "Saldo", unidade: "", campo: "saldo", formatar: sinal, glossario: "saldo", medidaComp: "saldo" },
  { chave: "turnover", rotulo: "Rotatividade (entr.+saíd.)", unidade: "", campo: "turnover", formatar: num, glossario: "rotatividade", medidaComp: "rotatividade" },
  // `distancia_media`/`distancia_mediana` são gravadas em METROS (distância euclidiana em Albers
  // -- ver pipeline/medidas.py::distancia_media_ponderada); converte para km só na exibição.
  { chave: "distancia_media", rotulo: "Distância média (km)", unidade: "km", campo: "distancia_media", formatar: (v) => num(v / 1000), glossario: "distancia_media", medidaComp: "distancia_media" },
  // `pct_interestadual` já chega aqui em PERCENTUAL (0-100): `normalizarLinhaUnidade` converte a
  // fração do parquet uma única vez, na leitura.
  { chave: "pct_interestadual", rotulo: "% que cruza a UF", unidade: "%", campo: "pct_interestadual", formatar: (v) => `${num1(v)}%`, glossario: "pct_interestadual", medidaComp: "pct_interestadual" },
  // Correção: `gini_linha` mede a concentração dos DESTINOS de quem sai da unidade (agrupa por
  // origem = a própria unidade, Gini sobre os destinos) -- o rótulo antigo ("origens") estava
  // trocado com `gini_coluna`. Ver pipeline/medidas.py::gini_linha e comparabilidade_regras.py.
  { chave: "gini_linha", rotulo: "Concentração destinos (Gini)", unidade: "", campo: "gini_linha", formatar: num2, glossario: "gini", medidaComp: "gini_linha" },
];

function BlocoUnidade({ nivel, codigo, linhas, escuro, edicoes, comp }: {
  nivel: NivelSerie; codigo: string; linhas: LinhaUnidadeSerie[]; escuro: boolean;
  edicoes: readonly EdicaoSerie[]; comp: Comparabilidade | null;
}) {
  const porEdicao = new Map(linhas.map((l) => [l.edicao, l]));
  const edicoesComNumero = new Set(edicoes.filter((e) => estadoDoPonto(porEdicao.get(e)) === "numero"));
  /** Nota de ressalva da célula (medida x edição x nível), lida da matriz de comparabilidade. */
  const ressalvaDa = (medidaComp: string, e: EdicaoSerie): RessalvaCelula | null => {
    if (!comp) return null;
    const regra = estadoDaCelula(comp, medidaComp, e, nivel);
    if (!regra || regra.estado === "comparavel") return null;
    return { estado: regra.estado, texto: regra.nota ? (comp.notas[regra.nota] ?? regra.nota) : "Comparabilidade limitada nesta edição." };
  };
  const ressalvas = comp ? ressalvasDoBloco(comp, nivel, MEDIDAS_BLOCO1, edicoes, edicoesComNumero) : [];
  return (
    <section className="secao serie-bloco" id="bloco-1" aria-labelledby="bloco-1-titulo">
      <h3 id="bloco-1-titulo">Bloco 1 · A migração de {ROTULO_NIVEL[nivel]}, censo a censo</h3>
      <div className="tabela-scroll">
        <table className="tabela-serie">
          <thead>
            <tr>
              <th>Medida</th>
              <th>tend.</th>
              {edicoes.map((e) => <th key={e}>{rotuloEdicao(e)}</th>)}
            </tr>
          </thead>
          <tbody>
            {MEDIDAS_BLOCO1.map((m) => {
              const valores = edicoes.map((e) => {
                const l = porEdicao.get(e);
                const estado = estadoDoPonto(l);
                const v = l ? (l[m.campo] as number | null) : null;
                return estado === "numero" ? v : null;
              });
              return (
                <tr key={m.chave}>
                  <td>{m.glossario ? <Termo chave={m.glossario}>{m.rotulo}</Termo> : m.rotulo}</td>
                  <LinhaSpark valores={valores} edicoes={edicoes} />
                  {edicoes.map((e, i) => (
                    <Celula key={e} valor={valores[i]} estado={estadoDoPonto(porEdicao.get(e))}
                            formatar={m.formatar} ressalva={ressalvaDa(m.medidaComp, e)} />
                  ))}
                </tr>
              );
            })}
            <tr>
              <td><Termo chave="tipo_fluxo_predominante">Tipo de fluxo predominante</Termo></td>
              <td className="serie-spark-cel">—</td>
              {edicoes.map((e) => {
                const l = porEdicao.get(e);
                const estado = estadoDoPonto(l);
                if (estado !== "numero") {
                  const trama = tramaDoEstado(estado);
                  return (
                    <td key={e} className={`serie-celula-vazia${trama ? ` trama-${trama}` : ""}`}>
                      {PALAVRA_ESTADO[estado]}
                    </td>
                  );
                }
                const tipo = tipoFluxoPredominante(l?.distancia_media, l?.pct_interestadual);
                if (!tipo) {
                  return (
                    <td key={e} className="serie-celula-vazia trama-cruzada"
                        title="Não foi possível calcular esta medida para esta unidade/edição.">
                      não publicado
                    </td>
                  );
                }
                return <td key={e}>{tipo.rotulo}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted-pequeno">
        Coluna "tend." = sparkline {rotuloIntervalo(edicoes)}; posição tracejada = sem número naquela edição.
        {edicoes.includes("1980") && " 1980 leva o selo de proxy (ver aviso no topo da seção)."}
        {comp && ressalvas.length > 0 && " ⓘ = ressalva de comparabilidade (passe o mouse; o texto completo está abaixo)."}
      </p>
      {ressalvas.length > 0 && (
        <details className="serie-ressalvas">
          <summary>Ressalvas de comparabilidade ({ressalvas.length})</summary>
          <ul className="muted-pequeno">
            {ressalvas.map((r) => (
              <li key={r.nota}>
                <strong>{r.medidas.join(", ")} ({r.edicoes.map(rotuloEdicao).join(", ")}):</strong> {r.texto}
              </li>
            ))}
          </ul>
        </details>
      )}
      <MapaSerieCensos nivel={nivel} codigo={codigo} escuro={escuro} edicoes={edicoes} />
    </section>
  );
}

/** Blocos 2 e 3 não existem para região metropolitana: `sistema_serie` e `pares_serie` não
 *  publicam o nível `rm`. Em vez de uma tabela vazia (que parece erro de carregamento), o bloco
 *  diz o que falta. A âncora `#bloco-N` continua existindo -- o índice do topo não quebra. */
function BlocoNaoCalculado({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="secao serie-bloco" id={id} aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>{titulo}</h3>
      <p className="muted-pequeno">{children}</p>
    </section>
  );
}

function BlocoSistema({ nivel, edicoes }: { nivel: NivelSerie; edicoes: readonly EdicaoSerie[] }) {
  const [linhas, setLinhas] = useState<Record<string, unknown>[] | null>(null);
  useEffect(() => {
    let vivo = true;
    serieDoSistema(nivel).then((r) => { if (vivo) setLinhas(r); }).catch(() => { if (vivo) setLinhas([]); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, edicoes.join(",")]);
  if (!linhas) return <p className="muted">Carregando o sistema…</p>;
  const linhasFiltradas = filtrarEdicoes(
    linhas as (Record<string, unknown> & { edicao: string })[], edicoes,
  );
  return (
    <section className="secao serie-bloco" id="bloco-2" aria-labelledby="bloco-2-titulo">
      <h3 id="bloco-2-titulo">Bloco 2 · O sistema de {ROTULO_NIVEL_PLURAL[nivel]} em que esta unidade está</h3>
      <p className="muted-pequeno">
        Estes números descrevem o conjunto de unidades do nível, não a unidade selecionada. Eles
        mudam com o número de unidades e só podem ser comparados dentro do mesmo nível.
      </p>
      {nivel !== "rm" && <GraficosSistema nivel={nivel} linhasSistema={linhasFiltradas} edicoes={edicoes} />}
      {(() => {
        const duncans = linhasFiltradas
          .filter((l) => {
            const anterior = edicaoAnterior(l.edicao as EdicaoSerie);
            return l.duncan_d_ant != null && anterior != null && edicoes.includes(anterior);
          })
          .map((l) => `${rotuloEdicao(l.edicao as EdicaoSerie)} ${num2(l.duncan_d_ant as number)}`);
        return duncans.length > 0 ? (
          <p className="muted-pequeno">
            Quanto a estrutura dos fluxos mudou entre censos (<Termo chave="duncan_d">Duncan D</Termo>, comparado à edição anterior): {duncans.join(" · ")}.
          </p>
        ) : null;
      })()}
      <div className="tabela-scroll">
        <table className="tabela-serie">
          <thead>
            <tr><th>Edição</th><th><Termo chave="n_unidades">n unidades</Termo></th>
                <th><Termo chave="cmi">CMI</Termo> (%)</th><th><Termo chave="smi">SMI</Termo> (%)</th>
                <th><Termo chave="mei_agregado">MEI</Termo> (%)</th>
                <th><Termo chave="anmr">ANMR</Termo> (%)</th>
                <th><Termo chave="beta_fielding">β Fielding</Termo></th>
                <th><Termo chave="duncan_d">Duncan D</Termo> (ant.)</th></tr>
          </thead>
          <tbody>
            {linhasFiltradas.map((l) => {
              const anterior = edicaoAnterior(l.edicao as EdicaoSerie);
              const anteriorMarcada = anterior != null && edicoes.includes(anterior);
              return (
                <tr key={String(l.edicao)}>
                  <td>{rotuloEdicao(l.edicao as EdicaoSerie)}</td>
                  <td>{num(l.n_unidades as number)}</td>
                  <td>{num1(l.cmi as number)}</td>
                  <td>{num1(l.smi as number)}</td>
                  <td>{num1(l.mei as number)}</td>
                  <td>{num1(l.anmr as number)}</td>
                  <td>{l.beta_fielding != null ? `${num2(l.beta_fielding as number)} ± ${num2(l.ep_beta as number)}` : "—"}</td>
                  <td>{
                    l.duncan_d_ant == null ? "—"
                      : !anteriorMarcada
                        ? <span title={`A edição anterior (${anterior}) não está marcada.`}>—</span>
                        : num2(l.duncan_d_ant as number)
                  }</td>
                </tr>
              );
            })}
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

/** Quantos parceiros a tabela mostra por padrão; o resto fica atrás de "mostrar todos" (e o texto
 *  diz quantos são). */
const LIMITE_PARCEIROS = 12;

type Parceiros = Map<string, { nome: string; linhas: Record<EdicaoSerie, Record<string, unknown> | undefined> }>;

function TabelaParceiros({ titulo, porParceiro, edicoes }: {
  titulo: string; porParceiro: Parceiros; edicoes: readonly EdicaoSerie[];
}) {
  const [todos, setTodos] = useState(false);
  if (porParceiro.size === 0) return <p className="muted-pequeno">{titulo}: nenhum par publicado.</p>;
  // Ordena ANTES de cortar: pelo posto na edição mais recente marcada, desempatando pelas
  // anteriores (design 3.3-a). A ordem de chegada da consulta é edição mais antiga primeiro, e
  // cortar nela descartava o principal parceiro de 2022.
  const ordenados = ordenarPorPostoRecente(
    [...porParceiro.entries()].map(([codigo, v]) => ({ codigo, ...v })),
    edicoes, (p, e) => (p.linhas[e]?.posto as number | null | undefined) ?? null,
  );
  const visiveis = todos ? ordenados : ordenados.slice(0, LIMITE_PARCEIROS);
  const fora = ordenados.length - visiveis.length;
  return (
    <div className="tabela-scroll">
      <table className="tabela-serie">
        <thead>
          <tr><th>{titulo}</th>{edicoes.map((e) => <th key={e}>{rotuloEdicao(e)}</th>)}</tr>
        </thead>
        <tbody>
          {visiveis.map(({ codigo: codigoParceiro, nome, linhas }) => (
            <tr key={codigoParceiro}>
              <td>{nome}</td>
              {edicoes.map((e) => {
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
      {(fora > 0 || todos) && (
        <p className="muted-pequeno">
          {fora > 0
            ? `Mais ${num(fora)} parceiro${fora > 1 ? "s" : ""} que já esteve${fora > 1 ? "ram" : ""} entre os 10 primeiros em alguma edição não aparece${fora > 1 ? "m" : ""} aqui. `
            : ""}
          <button className="link-serie" onClick={() => setTodos(!todos)}>
            {todos ? `Mostrar só os ${LIMITE_PARCEIROS} primeiros` : "Mostrar todos"}
          </button>
        </p>
      )}
    </div>
  );
}

/** Mantém só os parceiros com `posto <= 10` em pelo menos uma das edições MARCADAS -- o
 *  destaque vindo do SQL considera as cinco edições fixas; aqui refiltra sobre o subconjunto
 *  exibido, para não listar parceiros que só se destacavam numa edição desmarcada. */
function filtrarParceirosDestaque(porParceiro: Parceiros, edicoes: readonly EdicaoSerie[]) {
  const saida: Parceiros = new Map();
  for (const [codigo, v] of porParceiro) {
    const destaque = edicoes.some((e) => {
      const p = v.linhas[e];
      return p != null && (p.posto as number | null) != null && (p.posto as number) <= 10;
    });
    if (destaque) saida.set(codigo, v);
  }
  return saida;
}

function BlocoFluxos({ nivel, codigo, edicoes }: { nivel: NivelSerie; codigo: string; edicoes: readonly EdicaoSerie[] }) {
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
  const origensFiltradas = filtrarEdicoes(origens as (Record<string, unknown> & { edicao: string })[], edicoes);
  const destinosFiltradas = filtrarEdicoes(destinos as (Record<string, unknown> & { edicao: string })[], edicoes);
  const porOrigem = filtrarParceirosDestaque(agruparPorParceiro(origensFiltradas, "origem"), edicoes);
  const porDestino = filtrarParceirosDestaque(agruparPorParceiro(destinosFiltradas, "destino"), edicoes);
  return (
    <section className="secao serie-bloco" id="bloco-3" aria-labelledby="bloco-3-titulo">
      <h3 id="bloco-3-titulo">Bloco 3 · De onde vieram e para onde foram</h3>
      <TabelaParceiros titulo="Principais origens" porParceiro={porOrigem} edicoes={edicoes} />
      <TabelaParceiros titulo="Principais destinos" porParceiro={porDestino} edicoes={edicoes} />
      <p className="muted-pequeno">
        <Termo chave="posto">Posto</Termo> e volume por edição, ordenado pelo posto em {rotuloEdicao(edicoes[edicoes.length - 1])}
        (a edição marcada mais recente), desempatando pelas anteriores.
      </p>
    </section>
  );
}

/** Texto no lugar da barra quando a edição não tem perfil desenhável. O motivo vem do ESTADO da
 *  unidade na edição (`unidades_serie`: existia / estado_cobertura) e do que o perfil publica --
 *  nunca do rótulo da edição (a versão anterior escrevia "não medido" para toda barra vazia de
 *  1980, embora o status migratório seja medido em todas as edições). */
const MOTIVO_VAZIO_PERFIL: Partial<Record<EstadoCelula, string>> = {
  nao_existia: "não existia nesta edição",
  sem_cobertura: "sem cobertura nesta edição",
  cobertura_insuficiente: "cobertura insuficiente nesta edição",
  suprimido: "suprimido (abaixo do limiar de divulgação)",
};

function BlocoPerfil({ nivel, codigo, escuro, edicoes, linhasUnidade }: {
  nivel: NivelSerie; codigo: string; escuro: boolean; edicoes: readonly EdicaoSerie[];
  linhasUnidade: readonly LinhaUnidadeSerie[];
}) {
  const [linhas, setLinhas] = useState<Awaited<ReturnType<typeof seriePerfil>> | null>(null);
  useEffect(() => {
    let vivo = true;
    seriePerfil(nivel, codigo, "status").then((r) => { if (vivo) setLinhas(r); })
      .catch(() => { if (vivo) setLinhas([]); });
    return () => { vivo = false; };
  }, [nivel, codigo]);
  if (!linhas) return <p className="muted">Carregando perfil…</p>;

  const unidadePorEdicao = new Map(linhasUnidade.map((l) => [l.edicao, l]));
  const motivos = new Map<string, string>();
  const series: SeriePerfil[] = edicoes.map((edicao) => {
    const doAno = linhas.filter((l) => l.edicao === edicao && l.direcao === "imig");
    const brutos: Record<string, number | null> = {};
    for (const l of doAno) brutos[l.categoria] = l.valor;
    // Harmoniza o vocabulário de status (2022 colapsa primeira_saida + etapas_multiplas em
    // nao_natural -- ver docs/METODOLOGIA.md, "Comparação entre censos (F12)") e decide se a barra
    // pode ser desenhada: com `nao_natural` suprimido (null em 2022) a barra NÃO é renormalizada
    // sobre o que sobrou, é marcada "suprimido" (`perfilStatusDaEdicao`).
    const { valores, motivo } = perfilStatusDaEdicao(
      brutos, edicao, estadoDoPonto(unidadePorEdicao.get(edicao)),
    );
    const rotulo = rotuloEdicao(edicao);
    if (motivo) motivos.set(rotulo, MOTIVO_VAZIO_PERFIL[motivo] ?? PALAVRA_ESTADO[motivo]);
    return { rotulo, valores };
  });

  return (
    <section className="secao serie-bloco" id="bloco-4" aria-labelledby="bloco-4-titulo">
      <h3 id="bloco-4-titulo">Bloco 4 · Quem migra (chegaram)</h3>
      <BarraPerfil
        titulo={<><Termo chave="status_migratorio">Status migratório</Termo>, por edição</>}
        categorias={DIMENSOES.status.categorias}
        series={series}
        escuro={escuro}
        motivoVazio={(s) => motivos.get(s.rotulo) ?? "sem dado publicável"}
      />
    </section>
  );
}

interface Props {
  nivel: NivelSerie;
  codigo: string;
  nome: string;
  escuro: boolean;
  aoAbrirMetodologia: () => void;
  edicoes: readonly EdicaoSerie[];
}

export function SerieCensos({ nivel, codigo, nome, escuro, aoAbrirMetodologia, edicoes }: Props) {
  const [linhas, setLinhas] = useState<LinhaUnidadeSerie[] | null>(null);
  // null = carregando. Só se monta a frase com as DUAS consultas terminadas: sem os filhos a
  // frase de município-mãe sairia sem o prefixo e trocaria de texto no meio da leitura.
  const [filhos, setFilhos] = useState<FilhoMunicipio[] | null>(nivel === "mun" ? null : []);
  const [comp, setComp] = useState<Comparabilidade | null>(null);

  useEffect(() => {
    let vivo = true;
    // `pct_interestadual` chega como fração (0-1): converte uma vez, aqui (lib/serie.ts).
    serieDaUnidade(nivel, codigo).then((r) => {
      if (vivo) setLinhas((r as unknown as LinhaUnidadeSerie[]).map(normalizarLinhaUnidade));
    }).catch(() => { if (vivo) setLinhas([]); });
    if (nivel === "mun") {
      // Contrato: `nome` e `ultima_edicao_ausente` por filho; sem eles a frase cai em `codigo`
      // e omite o "Até {ano}" (ver `filhosNoIntervalo`).
      serieFilhosDoMunicipio(codigo).then((r) => { if (vivo) setFilhos(r as unknown as FilhoMunicipio[]); })
        .catch(() => { if (vivo) setFilhos([]); });
    }
    return () => { vivo = false; };
  }, [nivel, codigo]);

  useEffect(() => {
    let vivo = true;
    carregarComparabilidade().then((c) => { if (vivo) setComp(c); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const pronto = linhas !== null && filhos !== null;
  const entrada: EntradaFrase | null = pronto ? {
    nome, nivel,
    pontos: pontosDaSerie(linhas, edicoes),
    mae: maeDaSerie(linhas, edicoes),
    filhos: filhosNoIntervalo(filhos, edicoes),
  } : null;
  const frase = entrada ? fraseSintese(entrada) : "";

  return (
    <div className="serie-conteudo">
      <nav className="serie-indice" aria-label="Blocos da série">
        <a href="#bloco-1">Bloco 1</a><a href="#bloco-2">Bloco 2</a>
        <a href="#bloco-3">Bloco 3</a><a href="#bloco-4">Bloco 4</a>
      </nav>
      {!pronto ? (
        <p className="muted">Carregando a série…</p>
      ) : linhas.length === 0 ? (
        <p className="muted">Não há série publicada para esta unidade.</p>
      ) : (
        <>
          {edicoes.includes("1980") && (
            <div className="aviso aviso-proxy" role="note">
              <p className="aviso-proxy-resumo">
                <strong>Selo proxy (1980).</strong>{" "}
                {comp?.notas.proxy_1980_volume
                  ?? "O Censo 1980 não tem quesito de data fixa: a migração publicada é estimada por um proxy calibrado, não medida diretamente."}
              </p>
            </div>
          )}
          <p className="serie-frase serie-frase-completa">{frase}</p>
          <BlocoUnidade nivel={nivel} codigo={codigo} linhas={linhas} escuro={escuro} edicoes={edicoes} comp={comp} />
          {nivel === "rm" ? (
            <BlocoNaoCalculado id="bloco-2" titulo="Bloco 2 · O sistema de regiões metropolitanas">
              Não calculado para regiões metropolitanas: a série publicada traz o sistema (CMI, MEI, ANMR,
              β de Fielding, Duncan D) só para municípios, regiões imediatas, regiões intermediárias e UFs.
            </BlocoNaoCalculado>
          ) : (
            <BlocoSistema nivel={nivel} edicoes={edicoes} />
          )}
          {nivel === "rm" ? (
            <BlocoNaoCalculado id="bloco-3" titulo="Bloco 3 · De onde vieram e para onde foram">
              Não calculado para regiões metropolitanas: os fluxos entre pares de unidades são publicados
              na série só para municípios, regiões imediatas, regiões intermediárias e UFs.
            </BlocoNaoCalculado>
          ) : (
            <BlocoFluxos nivel={nivel} codigo={codigo} edicoes={edicoes} />
          )}
          <BlocoPerfil nivel={nivel} codigo={codigo} escuro={escuro} edicoes={edicoes} linhasUnidade={linhas} />
        </>
      )}
      <section className="secao">
        <h3>Glossário</h3>
        <dl className="serie-glossario">
          {CHAVES_GLOSSARIO_SERIE.map((chave) => {
            const t = GLOSSARIO[chave];
            if (!t) return null;
            return (
              <div key={chave} className="serie-glossario-item">
                <dt id={`gl-${chave}`}>{t.termo}</dt>
                <dd>
                  {t.definicao} {t.interpretacao}
                  {t.limitacoes ? (
                    <span className="muted-pequeno"> {t.limitacoes}</span>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="muted-pequeno">
          Metodologia completa: <button className="link-serie" onClick={aoAbrirMetodologia}>metodologia completa</button>.
        </p>
      </section>
    </div>
  );
}

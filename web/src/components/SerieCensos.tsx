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
import { useT } from "../i18n";
import { Termo } from "./Termo";
import {
  serieDaUnidade, serieDosPares, serieDoSistema, serieFilhosDoMunicipio, seriePerfil,
} from "../db/queries";
import {
  carregarComparabilidade, edicaoAnterior, estadoDaCelula, filhosNoIntervalo, filtrarEdicoes,
  formatarIem, fraseSintese, geometriaSpark, maeDaSerie, normalizarLinhaUnidade, notaComparabilidade,
  ordenarPorPostoRecente, palavraEstado, perfilStatusDaEdicao, pontosDaSerie, ressalvasDoBloco,
  rotuloEdicao, rotuloIntervalo, tipoFluxoPredominante, tramaDoEstado,
  type Comparabilidade, type EdicaoSerie, type EntradaFrase, type EstadoCelula,
  type FilhoMunicipio, type NivelSerie,
} from "../lib/serie";
import { num, num1, num2, sinal, sinal1 } from "../lib/format";
import { BarraPerfil, type SeriePerfil } from "./BarraPerfil";
import { dimensao } from "../lib/paletas";
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
  const d = useT();
  return (
    <span role="img" aria-label={d.serie.celula.ariaRessalva(texto)} title={texto}
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
  const d = useT();
  if (estado === "numero" && ressalva?.estado === "nao_comparavel") {
    return <td className="serie-celula-vazia" title={ressalva.texto}>{palavraEstado("nao_comparavel", d)}</td>;
  }
  if (estado === "numero" && valor == null) {
    return <td className="serie-celula-vazia trama-cruzada" title={d.serie.celula.naoCalculavel}>
      {d.serie.celula.naoPublicado}
    </td>;
  }
  if (estado !== "numero" || valor == null) {
    const trama = tramaDoEstado(estado);
    return (
      <td className={`serie-celula-vazia${trama ? ` trama-${trama}` : ""}`}>
        {palavraEstado(estado, d)}
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
  /** Também a chave do nome da medida em `d.serie.medidas`. */
  chave: "tlm" | "iem" | "tbi" | "tbe" | "imig" | "emig" | "saldo" | "turnover" | "distancia_media"
    | "pct_interestadual" | "gini_linha";
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
  { chave: "tlm", unidade: "‰", campo: "tlm", formatar: (v) => `${sinal1(v)}‰`, glossario: "taxa_liquida", medidaComp: "tlm" },
  { chave: "iem", unidade: "", campo: "iem", formatar: formatarIem, glossario: "eficacia_iem", medidaComp: "iem" },
  { chave: "tbi", unidade: "‰", campo: "tbi", formatar: num1, medidaComp: "tbi" },
  { chave: "tbe", unidade: "‰", campo: "tbe", formatar: num1, medidaComp: "tbe" },
  { chave: "imig", unidade: "", campo: "imig", formatar: num, glossario: "imigrantes", medidaComp: "imig" },
  { chave: "emig", unidade: "", campo: "emig", formatar: num, glossario: "emigrantes", medidaComp: "emig" },
  { chave: "saldo", unidade: "", campo: "saldo", formatar: sinal, glossario: "saldo", medidaComp: "saldo" },
  { chave: "turnover", unidade: "", campo: "turnover", formatar: num, glossario: "rotatividade", medidaComp: "rotatividade" },
  // `distancia_media`/`distancia_mediana` são gravadas em METROS (distância euclidiana em Albers
  // -- ver pipeline/medidas.py::distancia_media_ponderada); converte para km só na exibição.
  { chave: "distancia_media", unidade: "km", campo: "distancia_media", formatar: (v) => num(v / 1000), glossario: "distancia_media", medidaComp: "distancia_media" },
  // `pct_interestadual` já chega aqui em PERCENTUAL (0-100): `normalizarLinhaUnidade` converte a
  // fração do parquet uma única vez, na leitura.
  { chave: "pct_interestadual", unidade: "%", campo: "pct_interestadual", formatar: (v) => `${num1(v)}%`, glossario: "pct_interestadual", medidaComp: "pct_interestadual" },
  // Correção: `gini_linha` mede a concentração dos DESTINOS de quem sai da unidade (agrupa por
  // origem = a própria unidade, Gini sobre os destinos) -- o rótulo antigo ("origens") estava
  // trocado com `gini_coluna`. Ver pipeline/medidas.py::gini_linha e comparabilidade_regras.py.
  { chave: "gini_linha", unidade: "", campo: "gini_linha", formatar: num2, glossario: "gini", medidaComp: "gini_linha" },
];

function BlocoUnidade({ nivel, codigo, linhas, escuro, edicoes, comp }: {
  nivel: NivelSerie; codigo: string; linhas: LinhaUnidadeSerie[]; escuro: boolean;
  edicoes: readonly EdicaoSerie[]; comp: Comparabilidade | null;
}) {
  const d = useT();
  const porEdicao = new Map(linhas.map((l) => [l.edicao, l]));
  const edicoesComNumero = new Set(edicoes.filter((e) => estadoDoPonto(porEdicao.get(e)) === "numero"));
  /** Nota de ressalva da célula (medida x edição x nível), lida da matriz de comparabilidade. */
  const ressalvaDa = (medidaComp: string, e: EdicaoSerie): RessalvaCelula | null => {
    if (!comp) return null;
    const regra = estadoDaCelula(comp, medidaComp, e, nivel);
    if (!regra || regra.estado === "comparavel") return null;
    return {
      estado: regra.estado,
      texto: regra.nota
        ? (notaComparabilidade(regra.nota, comp.notas, d) ?? regra.nota)
        : d.serie.celula.ressalvaPadrao,
    };
  };
  const ressalvas = comp
    ? ressalvasDoBloco(
        comp, nivel, MEDIDAS_BLOCO1.map((m) => ({ medidaComp: m.medidaComp, rotulo: d.serie.medidas[m.chave] })),
        edicoes, edicoesComNumero, d,
      )
    : [];
  const b1 = d.serie.bloco1;
  return (
    <section className="secao serie-bloco" id="bloco-1" aria-labelledby="bloco-1-titulo">
      <h3 id="bloco-1-titulo">{b1.titulo(d.comum.niveis[nivel].demonstrativo)}</h3>
      <div className="tabela-scroll">
        <table className="tabela-serie">
          <thead>
            <tr>
              <th>{b1.colMedida}</th>
              <th>{b1.colTendencia}</th>
              {edicoes.map((e) => <th key={e}>{rotuloEdicao(e, d)}</th>)}
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
                  <td>{m.glossario ? <Termo chave={m.glossario}>{d.serie.medidas[m.chave]}</Termo> : d.serie.medidas[m.chave]}</td>
                  <LinhaSpark valores={valores} edicoes={edicoes} />
                  {edicoes.map((e, i) => (
                    <Celula key={e} valor={valores[i]} estado={estadoDoPonto(porEdicao.get(e))}
                            formatar={m.formatar} ressalva={ressalvaDa(m.medidaComp, e)} />
                  ))}
                </tr>
              );
            })}
            <tr>
              <td><Termo chave="tipo_fluxo_predominante">{b1.tipoFluxo}</Termo></td>
              <td className="serie-spark-cel">—</td>
              {edicoes.map((e) => {
                const l = porEdicao.get(e);
                const estado = estadoDoPonto(l);
                if (estado !== "numero") {
                  const trama = tramaDoEstado(estado);
                  return (
                    <td key={e} className={`serie-celula-vazia${trama ? ` trama-${trama}` : ""}`}>
                      {palavraEstado(estado, d)}
                    </td>
                  );
                }
                const tipo = tipoFluxoPredominante(l?.distancia_media, l?.pct_interestadual, d);
                if (!tipo) {
                  return (
                    <td key={e} className="serie-celula-vazia trama-cruzada"
                        title={d.serie.celula.naoCalculavel}>
                      {d.serie.celula.naoPublicado}
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
        {[
          b1.notaTendencia(rotuloIntervalo(edicoes)),
          edicoes.includes("1980") && b1.nota1980,
          comp && ressalvas.length > 0 && b1.notaRessalva,
        ].filter(Boolean).join(" ")}
      </p>
      {ressalvas.length > 0 && (
        <details className="serie-ressalvas">
          <summary>{b1.ressalvasResumo(ressalvas.length)}</summary>
          <ul className="muted-pequeno">
            {ressalvas.map((r) => (
              <li key={r.nota}>
                <strong>{b1.ressalvaItem(r.medidas, r.edicoes.map((e) => rotuloEdicao(e, d)))}</strong> {r.texto}
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
  const d = useT();
  const [linhas, setLinhas] = useState<Record<string, unknown>[] | null>(null);
  useEffect(() => {
    let vivo = true;
    serieDoSistema(nivel).then((r) => { if (vivo) setLinhas(r); }).catch(() => { if (vivo) setLinhas([]); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, edicoes.join(",")]);
  if (!linhas) return <p className="muted">{d.serie.bloco2.carregando}</p>;
  const linhasFiltradas = filtrarEdicoes(
    linhas as (Record<string, unknown> & { edicao: string })[], edicoes,
  );
  return (
    <section className="secao serie-bloco" id="bloco-2" aria-labelledby="bloco-2-titulo">
      <h3 id="bloco-2-titulo">{d.serie.bloco2.titulo(d.comum.niveis[nivel].plural)}</h3>
      <p className="muted-pequeno">{d.serie.bloco2.nota}</p>
      {nivel !== "rm" && <GraficosSistema nivel={nivel} linhasSistema={linhasFiltradas} edicoes={edicoes} />}
      {(() => {
        const duncans = linhasFiltradas
          .filter((l) => {
            const anterior = edicaoAnterior(l.edicao as EdicaoSerie);
            return l.duncan_d_ant != null && anterior != null && edicoes.includes(anterior);
          })
          .map((l) => `${rotuloEdicao(l.edicao as EdicaoSerie, d)} ${num2(l.duncan_d_ant as number)}`);
        if (duncans.length === 0) return null;
        const frase = d.serie.bloco2.duncanFrase(duncans.join(" · "));
        return (
          <p className="muted-pequeno">
            {frase.antes}<Termo chave="duncan_d">{frase.termo}</Termo>{frase.depois}
          </p>
        );
      })()}
      <div className="tabela-scroll">
        <table className="tabela-serie">
          <thead>
            <tr><th>{d.serie.bloco2.colEdicao}</th><th><Termo chave="n_unidades">{d.serie.bloco2.colNUnidades}</Termo></th>
                <th><Termo chave="cmi">CMI</Termo> (%)</th><th><Termo chave="smi">SMI</Termo> (%)</th>
                <th><Termo chave="mei_agregado">MEI</Termo> (%)</th>
                <th><Termo chave="anmr">ANMR</Termo> (%)</th>
                <th><Termo chave="beta_fielding">β Fielding</Termo></th>
                <th><Termo chave="duncan_d">{d.serie.bloco2.colDuncan.termo}</Termo>{d.serie.bloco2.colDuncan.depois}</th></tr>
          </thead>
          <tbody>
            {linhasFiltradas.map((l) => {
              const anterior = edicaoAnterior(l.edicao as EdicaoSerie);
              const anteriorMarcada = anterior != null && edicoes.includes(anterior);
              return (
                <tr key={String(l.edicao)}>
                  <td>{rotuloEdicao(l.edicao as EdicaoSerie, d)}</td>
                  <td>{num(l.n_unidades as number)}</td>
                  <td>{num1(l.cmi as number)}</td>
                  <td>{num1(l.smi as number)}</td>
                  <td>{num1(l.mei as number)}</td>
                  <td>{num1(l.anmr as number)}</td>
                  <td>{l.beta_fielding != null ? `${num2(l.beta_fielding as number)} ± ${num2(l.ep_beta as number)}` : "—"}</td>
                  <td>{
                    l.duncan_d_ant == null ? "—"
                      : !anteriorMarcada
                        ? <span title={d.serie.bloco2.anteriorNaoMarcada(String(anterior))}>—</span>
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
  const d = useT();
  const b3 = d.serie.bloco3;
  const [todos, setTodos] = useState(false);
  if (porParceiro.size === 0) return <p className="muted-pequeno">{b3.nenhumPar(titulo)}</p>;
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
          <tr><th>{titulo}</th>{edicoes.map((e) => <th key={e}>{rotuloEdicao(e, d)}</th>)}</tr>
        </thead>
        <tbody>
          {visiveis.map(({ codigo: codigoParceiro, nome, linhas }) => (
            <tr key={codigoParceiro}>
              <td>{nome}</td>
              {edicoes.map((e) => {
                const p = linhas[e];
                if (!p || p.posto == null) {
                  const motivo = p?.motivo_ausencia as string | undefined;
                  const rotuloMotivo = motivo === "suprimido" ? b3.motivoSuprimido
                    : motivo === "nao_existia" ? b3.motivoNaoExistia
                    : motivo === "nao_medido" ? b3.motivoNaoMedido : b3.motivoOutro;
                  const trama = motivo === "suprimido" ? "trama-cruzada"
                    : motivo === "nao_medido" ? "trama-pontilhada" : "trama-diagonal";
                  return <td key={e} className={`serie-celula-vazia ${trama}`}>{rotuloMotivo}</td>;
                }
                return <td key={e}>{b3.postoTotal(num(p.posto as number), num(p.total as number))}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {(fora > 0 || todos) && (
        <p className="muted-pequeno">
          {fora > 0 ? `${b3.foraDaLista(fora, num(fora))} ` : ""}
          <button className="link-serie" onClick={() => setTodos(!todos)}>
            {todos ? b3.mostrarPrimeiros(LIMITE_PARCEIROS) : b3.mostrarTodos}
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
  const d = useT();
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
  if (!origens || !destinos) return <p className="muted">{d.comum.ui.carregandoFluxos}</p>;
  const origensFiltradas = filtrarEdicoes(origens as (Record<string, unknown> & { edicao: string })[], edicoes);
  const destinosFiltradas = filtrarEdicoes(destinos as (Record<string, unknown> & { edicao: string })[], edicoes);
  const porOrigem = filtrarParceirosDestaque(agruparPorParceiro(origensFiltradas, "origem"), edicoes);
  const porDestino = filtrarParceirosDestaque(agruparPorParceiro(destinosFiltradas, "destino"), edicoes);
  const nota = d.serie.bloco3.notaPosto(rotuloEdicao(edicoes[edicoes.length - 1], d));
  return (
    <section className="secao serie-bloco" id="bloco-3" aria-labelledby="bloco-3-titulo">
      <h3 id="bloco-3-titulo">{d.serie.bloco3.titulo}</h3>
      <TabelaParceiros titulo={d.serie.bloco3.origens} porParceiro={porOrigem} edicoes={edicoes} />
      <TabelaParceiros titulo={d.serie.bloco3.destinos} porParceiro={porDestino} edicoes={edicoes} />
      <p className="muted-pequeno">
        {nota.antes}<Termo chave="posto">{nota.termo}</Termo>{nota.depois}
      </p>
    </section>
  );
}

/** Texto no lugar da barra quando a edição não tem perfil desenhável (`d.serie.bloco4.motivoVazio`,
 *  com `palavraEstado` de reserva). O motivo vem do ESTADO da unidade na edição (`unidades_serie`:
 *  existia / estado_cobertura) e do que o perfil publica -- nunca do rótulo da edição (a versão
 *  anterior escrevia "não medido" para toda barra vazia de 1980, embora o status migratório seja
 *  medido em todas as edições). */

function BlocoPerfil({ nivel, codigo, escuro, edicoes, linhasUnidade }: {
  nivel: NivelSerie; codigo: string; escuro: boolean; edicoes: readonly EdicaoSerie[];
  linhasUnidade: readonly LinhaUnidadeSerie[];
}) {
  const d = useT();
  const [linhas, setLinhas] = useState<Awaited<ReturnType<typeof seriePerfil>> | null>(null);
  useEffect(() => {
    let vivo = true;
    seriePerfil(nivel, codigo, "status").then((r) => { if (vivo) setLinhas(r); })
      .catch(() => { if (vivo) setLinhas([]); });
    return () => { vivo = false; };
  }, [nivel, codigo]);
  if (!linhas) return <p className="muted">{d.serie.bloco4.carregando}</p>;

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
    const rotulo = rotuloEdicao(edicao, d);
    if (motivo) {
      const motivoVazio = d.serie.bloco4.motivoVazio as Partial<Record<EstadoCelula, string>>;
      motivos.set(rotulo, motivoVazio[motivo] ?? palavraEstado(motivo, d));
    }
    return { rotulo, valores };
  });

  return (
    <section className="secao serie-bloco" id="bloco-4" aria-labelledby="bloco-4-titulo">
      <h3 id="bloco-4-titulo">{d.serie.bloco4.titulo}</h3>
      <BarraPerfil
        titulo={<><Termo chave="status_migratorio">{dimensao("status", d).titulo}</Termo>{d.serie.bloco4.tituloBarraDepois}</>}
        categorias={dimensao("status", d).categorias}
        series={series}
        escuro={escuro}
        motivoVazio={(s) => motivos.get(s.rotulo) ?? d.serie.bloco4.semDado}
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
  const d = useT();
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
  const frase = entrada ? fraseSintese(entrada, d) : "";

  return (
    <div className="serie-conteudo">
      <nav className="serie-indice" aria-label={d.serie.secao.indiceAria}>
        <a href="#bloco-1">{d.serie.secao.bloco(1)}</a><a href="#bloco-2">{d.serie.secao.bloco(2)}</a>
        <a href="#bloco-3">{d.serie.secao.bloco(3)}</a><a href="#bloco-4">{d.serie.secao.bloco(4)}</a>
      </nav>
      {!pronto ? (
        <p className="muted">{d.comum.ui.carregandoSerie}</p>
      ) : linhas.length === 0 ? (
        <p className="muted">{d.serie.secao.semSerie}</p>
      ) : (
        <>
          {edicoes.includes("1980") && (
            <div className="aviso aviso-proxy" role="note">
              <p className="aviso-proxy-resumo">
                <strong>{d.serie.secao.selo1980}</strong>{" "}
                {notaComparabilidade("proxy_1980_volume", comp?.notas, d) ?? d.serie.secao.aviso1980Padrao}
              </p>
            </div>
          )}
          <p className="serie-frase serie-frase-completa">{frase}</p>
          <BlocoUnidade nivel={nivel} codigo={codigo} linhas={linhas} escuro={escuro} edicoes={edicoes} comp={comp} />
          {nivel === "rm" ? (
            <BlocoNaoCalculado id="bloco-2" titulo={d.serie.bloco2.tituloRM}>
              {d.serie.bloco2.naoCalculadoRM}
            </BlocoNaoCalculado>
          ) : (
            <BlocoSistema nivel={nivel} edicoes={edicoes} />
          )}
          {nivel === "rm" ? (
            <BlocoNaoCalculado id="bloco-3" titulo={d.serie.bloco3.titulo}>
              {d.serie.bloco3.naoCalculadoRM}
            </BlocoNaoCalculado>
          ) : (
            <BlocoFluxos nivel={nivel} codigo={codigo} edicoes={edicoes} />
          )}
          <BlocoPerfil nivel={nivel} codigo={codigo} escuro={escuro} edicoes={edicoes} linhasUnidade={linhas} />
        </>
      )}
      <section className="secao">
        <h3>{d.serie.secao.glossario}</h3>
        <dl className="serie-glossario">
          {CHAVES_GLOSSARIO_SERIE.map((chave) => {
            const t = d.glossario[chave];
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
          {d.serie.secao.metodologia.antes}
          <button className="link-serie" onClick={aoAbrirMetodologia}>{d.serie.secao.metodologia.botao}</button>
          {d.serie.secao.metodologia.depois}
        </p>
      </section>
    </div>
  );
}

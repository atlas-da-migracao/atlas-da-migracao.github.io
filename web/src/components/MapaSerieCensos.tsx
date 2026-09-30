/** F12.5-cartografia -- small multiples de mapa comparativo (5 painéis, um por edição), fim
 *  do Bloco 1 de `SerieCensos.tsx`. Ver docs/design_serie_censos.md, seção 4.
 *
 *  ESCOLHA DE IMPLEMENTAÇÃO (documentada aqui, como pedido pela especificação): este
 *  componente NÃO reaproveita `MapaAtlas.tsx`/deck.gl diretamente. `MapaAtlas` é uma vista
 *  interativa (pan/zoom, arcos, espigas, satélite, picking em WebGL) pensada para UM mapa por
 *  vez; os cinco painéis aqui são pequenos, estáticos (sem pan/zoom -- o enquadramento é fixo
 *  e igual nos cinco, por definição da seção 4.1) e precisam de UMA coisa que deck.gl não
 *  oferece nativamente: preenchimento por `<pattern>` SVG (as tramas de ausência, seção
 *  4.4). A projeção já está pronta nos arquivos (`*_albers.topojson`, coordenadas em metros,
 *  a mesma malha que `MapaAtlas` consome via `COORDINATE_SYSTEM.CARTESIAN`) -- então um mapa
 *  estático não precisa de WebGL: um `<path>` por feição, com uma transformação afim simples
 *  (mundo em metros -> pixels do painel, calculada uma vez a partir do bbox comum aos cinco
 *  painéis) resolvido em SVG puro. Isso dá de graça: `<pattern>` de verdade (exatamente o que
 *  a seção 4.4 pede), hover sincronizado via um único estado React (sem depender de picking
 *  de 5 contextos WebGL simultâneos) e foco/acessibilidade por elemento real do DOM.
 *  O que É reaproveitado de `MapaAtlas`/`lib/*`: `corDivergente`/`classeSequencial` (via os
 *  novos `corMedidaSerie`/`corSequencial` de `lib/escalas.ts`), `QUEBRAS_FIXAS` de
 *  `lib/serie.ts`, as rampas `AZUL`/`LARANJA` de `lib/paletas.ts`, e `Bbox`/
 *  `validarEExpandirBbox` de `lib/rm.ts`.
 *
 *  Simplificação de enquadramento (documentada, seção 4.1 exige "bbox da UF/RGInt que contém
 *  a unidade"): calcular a UF/RGInt que contém a seleção, por edição, exigiria cruzar a malha
 *  com uma tabela de pertencimento por edição (não publicada para o front). Em vez disso, o
 *  enquadramento é o bbox da PRÓPRIA unidade selecionada (na malha 2022, que compartilha a
 *  mesma projeção Albers das cinco edições -- ver comentário em MapaAtlas.tsx) expandido por
 *  um fator fixo (~4x maior lado), o mesmo bbox aplicado aos cinco painéis. No nível `uf`, o
 *  enquadramento é o Brasil, como pede a seção 4.1. O bbox usa só a MAIOR PARTE de um
 *  MultiPolygon: uma ilha oceânica (Trindade, Fernando de Noronha) inflaria o zoom até o
 *  mapa virar um ponto.
 *
 *  Cada painel tem três camadas: (1) a malha DA EDIÇÃO, pintada por valor/estado -- memoizada,
 *  não refaz o Brasil inteiro a cada movimento do mouse; (2) a sobreposição de "não existia/sem
 *  cobertura" sobre as unidades de 2022 sem polígono na malha da edição (um município criado
 *  depois não tem feição em 1980: sem isso o painel ficava em branco ou com a cor da mãe); (3)
 *  realce de hover e contorno da unidade selecionada, leves e sem estado pesado.
 */
import { memo, useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import { basePath, type Censo } from "../lib/edicoes";
import {
  estadoNoMapa, formatarQuebra, ordenarEdicoes, QUEBRAS_FIXAS, rotuloEdicao, tramaDoEstadoMapa,
  type EdicaoSerie, type NivelSerie, type TramaMapa,
} from "../lib/serie";
import { corMedidaSerie, corDoSlotLegenda, LEGENDA_MEDIDA_SERIE, type MedidaMapaSerie } from "../lib/escalas";
import { serieMapa, type LinhaMapaSerie } from "../db/queries";
import { validarEExpandirBbox, type Bbox } from "../lib/rm";

const ARQUIVO_NIVEL: Record<NivelSerie, string> = {
  mun: "municipios", rgi: "rgi", rgint: "rgint", uf: "uf", rm: "uf",
};
const CAMPO_ID: Record<NivelSerie, string> = {
  mun: "CD_MUN", rgi: "cd_rgi", rgint: "cd_rgint", uf: "cd_uf", rm: "cd_uf",
};

const LIMITES_BRASIL: Bbox = [-2_178_086, -2_385_699, 2_561_841, 1_902_805];

const MEDIDAS: { chave: MedidaMapaSerie; rotulo: string }[] = [
  { chave: "iem", rotulo: "Índice de eficácia migratória" },
  { chave: "tlm", rotulo: "Taxa líquida de migração" },
  { chave: "tbi", rotulo: "Taxa bruta de imigração" },
  { chave: "tbe", rotulo: "Taxa bruta de emigração" },
];

/** `se_iem` é o erro-padrão do IEM: com ele o mapa reconhece o estado `indefinido`
 *  (`classificarIem`). Opcional no tipo porque `serieMapa` (db/queries.ts) precisa trazê-lo na
 *  consulta; sem o campo a guarda estatística não atua e o painel pinta o IEM pelo valor. */
type LinhaMapa = LinhaMapaSerie & { se_iem?: number | null };

type Proj = (p: readonly [number, number]) => [number, number];

/** Opacidade do "véu" da cor da superfície sob a trama das unidades que não existiam: o
 *  território de um município criado depois cai dentro do polígono da mãe (que tem valor
 *  próprio), e sem o véu a cor da mãe passaria por baixo da hachura como se fosse dele. */
const VEU_SEM_NUMERO = 0.72;

/** Converte a geometria de uma feição (Polygon/MultiPolygon, coordenadas em metros) num `d`
 *  de `<path>`, via a projeção afim `proj`. Winding de anéis já vem correto do GeoJSON (anel
 *  externo anti-horário, buracos horário) -- `fill-rule: nonzero` (o default de SVG) já
 *  resolve buracos sem precisar de `evenodd`. */
function pathDaGeometria(geom: Geometry, proj: Proj): string {
  const anel = (r: number[][]) =>
    r.map((p, i) => `${i === 0 ? "M" : "L"}${proj([p[0], p[1]]).join(",")}`).join(" ") + "Z";
  if (geom.type === "Polygon") return (geom.coordinates as number[][][]).map(anel).join(" ");
  if (geom.type === "MultiPolygon") {
    return (geom.coordinates as number[][][][]).flatMap((poly) => poly.map(anel)).join(" ");
  }
  return "";
}

const idDaFeicao = (f: Feature, campoId: string): string =>
  String((f.properties as Record<string, string>)[campoId]);

/** Nome legível da feição (rótulo acessível): as malhas trazem `NM_MUN`, `nm_rgi`, `nm_rgint` ou
 *  só a sigla da UF, conforme o nível. */
function nomeDaFeicao(f: Feature, campoId: string): string {
  const p = (f.properties ?? {}) as Record<string, string | undefined>;
  return p.NM_MUN ?? p.nm_rgi ?? p.nm_rgint ?? p.uf_sigla ?? idDaFeicao(f, campoId);
}

/** `d` de cada feição projetada, por código -- memoizado por (malha, projeção, campo) num
 *  `WeakMap`: os cinco painéis e a geometria de 2022 (contorno/sobreposição) compartilham o
 *  mesmo cálculo, e carregar outra edição não refaz as que já estavam prontas. */
const cacheCaminhos = new WeakMap<FeatureCollection, { proj: Proj; campoId: string; mapa: Map<string, string> }>();
const SEM_CAMINHOS = new Map<string, string>();
function caminhosDaMalha(malha: FeatureCollection, proj: Proj, campoId: string): Map<string, string> {
  const c = cacheCaminhos.get(malha);
  if (c && c.proj === proj && c.campoId === campoId) return c.mapa;
  const mapa = new Map<string, string>();
  for (const f of malha.features) mapa.set(idDaFeicao(f, campoId), pathDaGeometria(f.geometry, proj));
  cacheCaminhos.set(malha, { proj, campoId, mapa });
  return mapa;
}

/** Área (shoelace) do anel externo: só para escolher a maior parte de um MultiPolygon. */
function areaDoAnel(anel: number[][]): number {
  let a = 0;
  for (let i = 0, n = anel.length; i < n; i++) {
    const [x1, y1] = anel[i], [x2, y2] = anel[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

/** bbox da MAIOR parte (pelo anel externo) da feição -- ilhas oceânicas de um MultiPolygon
 *  (Trindade em Vitória, Noronha em Pernambuco) ficam de fora do enquadramento. */
function bboxDaMaiorParte(f: Feature): Bbox | null {
  const g = f.geometry;
  const poligonos: number[][][][] =
    g.type === "Polygon" ? [g.coordinates as number[][][]]
    : g.type === "MultiPolygon" ? (g.coordinates as number[][][][])
    : [];
  let anelMaior: number[][] | null = null;
  let areaMaior = -1;
  for (const poli of poligonos) {
    const anel = poli[0];
    if (!anel || anel.length === 0) continue;
    const a = areaDoAnel(anel);
    if (a > areaMaior) { areaMaior = a; anelMaior = anel; }
  }
  if (!anelMaior) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of anelMaior) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

/** Expande um bbox em torno do centro por `fator` (>1), para dar contexto territorial em
 *  volta da unidade selecionada -- ver nota de simplificação no cabeçalho do arquivo. */
function expandirBbox([minX, minY, maxX, maxY]: Bbox, fator: number): Bbox {
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const dx = Math.max((maxX - minX) * fator, 20_000), dy = Math.max((maxY - minY) * fator, 20_000);
  return [cx - dx / 2, cy - dy / 2, cx + dx / 2, cy + dy / 2];
}

interface CachePorEdicao<T> { [edicao: string]: T | undefined }

/** Carrega a malha de um nível para as cinco edições (ou só a lista de edições pedida). */
function useMalhasPorEdicao(nivel: NivelSerie, edicoes: readonly EdicaoSerie[]) {
  const [malhas, setMalhas] = useState<CachePorEdicao<FeatureCollection>>({});
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    const arquivo = ARQUIVO_NIVEL[nivel];
    for (const e of edicoes) {
      if (malhas[e]) continue;
      const censo = e as Censo;
      fetch(`${basePath(censo)}geo/${arquivo}_albers.topojson`)
        .then((r) => {
          if (!r.ok) throw new Error(`malha ${e}: ${r.status}`);
          return r.json() as Promise<Topology>;
        })
        .then((topo) => {
          if (!vivo) return;
          const chave = Object.keys(topo.objects)[0];
          const fc = feature(topo, topo.objects[chave]) as unknown as FeatureCollection;
          setMalhas((m) => ({ ...m, [e]: fc }));
        })
        .catch((err: Error) => { if (vivo) setErro(err.message); });
    }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, edicoes.join(",")]);
  return { malhas, erro };
}

const LARGURA_PAINEL = 190, ALTURA_PAINEL = 190;

/** Uma feição já resolvida para desenho: só o que muda com edição/medida/tema. */
interface ItemMapa { cd: string; nome: string; d: string; fill: string; trama: TramaMapa | null }
interface SobreposicaoMapa { cd: string; d: string; trama: TramaMapa }

const SEM_VALORES = new Map<string, LinhaMapa>();

/** Camada de base: um `<path>` por feição. `memo` de propósito -- o hover (estado do pai) troca
 *  a cada célula que o mouse cruza, e refazer milhares de caminhos (nível municipal: 5,5 mil por
 *  painel) a cada troca travava a página. Só re-renderiza se os itens mudarem. */
const CamadaBase = memo(function CamadaBase({ itens, sobreposicoes, idBase }: {
  itens: ItemMapa[]; sobreposicoes: SobreposicaoMapa[]; idBase: string;
}) {
  return (
    <g>
      {itens.map((i) => (
        <g key={i.cd}>
          <path d={i.d} fill={i.fill} stroke="var(--hairline, #cfcdc2)" strokeWidth={0.4}
                data-cd={i.cd} tabIndex={0} role="button" aria-label={i.nome} />
          {i.trama && <path d={i.d} fill={`url(#${idBase}-${i.trama})`} pointerEvents="none" />}
        </g>
      ))}
      {sobreposicoes.map((o) => (
        <g key={`sem-${o.cd}`}>
          <path d={o.d} fill="var(--plane, #f9f9f7)" fillOpacity={VEU_SEM_NUMERO}
                stroke="var(--hairline, #cfcdc2)" strokeWidth={0.4} data-cd={o.cd} />
          <path d={o.d} fill={`url(#${idBase}-${o.trama})`} pointerEvents="none" />
        </g>
      ))}
    </g>
  );
});

function PainelMapaEdicao({
  edicao, malha, malha2022, valores, campoId, proj, selecionado, hover, aoPassarMouse, medida, escuro,
  carregando,
}: {
  edicao: EdicaoSerie; malha: FeatureCollection | null; malha2022: FeatureCollection | null;
  valores: Map<string, LinhaMapa>; campoId: string; proj: Proj;
  selecionado: string; hover: string | null;
  aoPassarMouse: (cd: string | null) => void;
  medida: MedidaMapaSerie; escuro: boolean;
  /** Dados da série (`serieMapa`) ainda chegando: não pinta "não medido" antes da hora. */
  carregando: boolean;
}) {
  const idBase = `serie-mapa-${edicao}`;
  const caminhos = useMemo(() => (malha ? caminhosDaMalha(malha, proj, campoId) : SEM_CAMINHOS),
    [malha, proj, campoId]);
  const caminhos2022 = useMemo(() => (malha2022 ? caminhosDaMalha(malha2022, proj, campoId) : SEM_CAMINHOS),
    [malha2022, proj, campoId]);

  const itens = useMemo<ItemMapa[]>(() => {
    if (!malha || carregando) return [];
    return malha.features.map((f) => {
      const cd = idDaFeicao(f, campoId);
      const linha = valores.get(cd);
      const valor = linha ? ((linha[medida] as number | null | undefined) ?? null) : null;
      const estado = estadoNoMapa(linha, medida, valor);
      return {
        cd, nome: nomeDaFeicao(f, campoId), d: caminhos.get(cd) ?? "",
        fill: estado === "numero" ? corMedidaSerie(medida, valor, escuro) : "transparent",
        trama: tramaDoEstadoMapa(estado),
      };
    });
  }, [malha, carregando, valores, medida, escuro, campoId, caminhos]);

  // Unidades de 2022 cujo estado na edição NÃO é número e que não têm feição na malha da edição
  // (município criado depois, região sem cobertura): desenhadas com a geometria de 2022 e a
  // trama do estado, por cima da malha da edição.
  const sobreposicoes = useMemo<SobreposicaoMapa[]>(() => {
    if (!malha || carregando) return [];
    const saida: SobreposicaoMapa[] = [];
    for (const [cd, linha] of valores) {
      if (caminhos.has(cd)) continue;
      const d = caminhos2022.get(cd);
      if (!d) continue;
      const valor = (linha[medida] as number | null | undefined) ?? null;
      const trama = tramaDoEstadoMapa(estadoNoMapa(linha, medida, valor));
      if (trama) saida.push({ cd, d, trama });
    }
    return saida;
  }, [malha, carregando, valores, medida, caminhos, caminhos2022]);

  if (!malha || carregando) {
    return (
      <div className="serie-mapa-painel serie-mapa-painel-vazio" style={{ width: LARGURA_PAINEL, height: ALTURA_PAINEL }}>
        <p className="muted-pequeno">carregando…</p>
      </div>
    );
  }

  // Realce e contorno: a geometria da edição quando o código existe nela, a de 2022 quando não
  // (o município selecionado não tem feição em 1980 -- o contorno aparece assim mesmo).
  const dDe = (cd: string | null) => (cd ? (caminhos.get(cd) ?? caminhos2022.get(cd) ?? null) : null);
  const dHover = hover && hover !== selecionado ? dDe(hover) : null;
  const dSelecionado = dDe(selecionado);
  const aoEntrar = (e: React.SyntheticEvent<SVGSVGElement>) => {
    const cd = (e.target as SVGElement).dataset?.cd;
    if (cd !== undefined) aoPassarMouse(cd);
  };

  return (
    <figure className="serie-mapa-painel">
      <figcaption>{rotuloEdicao(edicao)}</figcaption>
      <svg width={LARGURA_PAINEL} height={ALTURA_PAINEL} viewBox={`0 0 ${LARGURA_PAINEL} ${ALTURA_PAINEL}`}
           role="img" aria-label={`Mapa de ${medida.toUpperCase()} em ${rotuloEdicao(edicao)}`}
           onMouseOver={aoEntrar} onFocus={aoEntrar} onMouseLeave={() => aoPassarMouse(null)}>
        <defs>
          <pattern id={`${idBase}-diagonal`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={4} stroke="var(--ink-muted, #898781)" strokeWidth={1} />
          </pattern>
          <pattern id={`${idBase}-cruzada`} width={5} height={5} patternUnits="userSpaceOnUse">
            <line x1={0} y1={0} x2={5} y2={5} stroke="var(--ink-muted, #898781)" strokeWidth={1} />
            <line x1={5} y1={0} x2={0} y2={5} stroke="var(--ink-muted, #898781)" strokeWidth={1} />
          </pattern>
          <pattern id={`${idBase}-pontilhada`} width={4} height={4} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={0.6} fill="var(--ink-muted, #898781)" />
          </pattern>
          <pattern id={`${idBase}-horizontal`} width={4} height={4} patternUnits="userSpaceOnUse">
            <line x1={0} y1={1} x2={4} y2={1} stroke="var(--ink-muted, #898781)" strokeWidth={1} />
          </pattern>
        </defs>
        <CamadaBase itens={itens} sobreposicoes={sobreposicoes} idBase={idBase} />
        <g pointerEvents="none">
          {dHover && <path d={dHover} fill="none" stroke="var(--ink)" strokeWidth={1} />}
          {dSelecionado && <path d={dSelecionado} fill="none" stroke="var(--ink)" strokeWidth={1.6} />}
        </g>
      </svg>
    </figure>
  );
}

function Legenda({ medida, escuro }: { medida: MedidaMapaSerie; escuro: boolean }) {
  const classes = LEGENDA_MEDIDA_SERIE[medida];
  return (
    <div className="serie-mapa-legenda" aria-label="Legenda do mapa comparativo">
      <ul className="serie-mapa-legenda-classes">
        {classes.map((c) => (
          <li key={c.rotulo}>
            <span className="serie-mapa-amostra" style={{ background: corDoSlotLegenda(medida, c.cor, escuro) }} />
            {c.rotulo}
          </li>
        ))}
      </ul>
      <hr className="serie-mapa-legenda-separador" />
      <ul className="serie-mapa-legenda-tramas"
          aria-label="Diagonal: território não comparável. Cruzada: suprimido por sigilo. Pontilhada: não medido. Horizontal: indefinido, amostra pequena demais para classificar.">
        <li><span className="serie-mapa-amostra serie-mapa-amostra-diagonal" /> não comparável (não existia / cobertura insuficiente)</li>
        <li><span className="serie-mapa-amostra serie-mapa-amostra-cruzada" /> suprimido (sigilo)</li>
        <li><span className="serie-mapa-amostra serie-mapa-amostra-pontilhada" /> não medido (o censo não perguntou)</li>
        {medida === "iem" && (
          <li>
            <span className="serie-mapa-amostra"
                  style={{ backgroundImage: "repeating-linear-gradient(0deg, var(--ink-muted) 0 1px, transparent 1px 4px)" }} />
            {" "}indefinido (amostra pequena demais para classificar)
          </li>
        )}
      </ul>
    </div>
  );
}

interface Props {
  nivel: NivelSerie;
  codigo: string;
  escuro: boolean;
  edicoes: readonly EdicaoSerie[];
}

/** Estado da consulta `serieMapa`: `chave` = nível que a pediu (um resultado de outro nível não
 *  vale), `linhas` null enquanto carrega. */
interface DadosMapa { chave: string; linhas: LinhaMapa[] | null; erro: string | null }

/** Mapa comparativo do Bloco 1 -- small multiples, um por edição marcada, mesma medida/
 *  quebras/enquadramento entre eles (seção 4). No nível `mun`, carrega sob pedido (botão); nos
 *  demais níveis, carrega direto (malhas pequenas). Nível `rm` não tem mapa comparativo nesta
 *  fase (a malha de RM/RIDE não integra o conjunto de níveis do mapa principal -- ver CAMPO_ID
 *  em App.tsx, que também não inclui "rm"; documentado como fora de escopo, não omissão). */
export function MapaSerieCensos({ nivel, codigo, escuro, edicoes }: Props) {
  const [medida, setMedida] = useState<MedidaMapaSerie>("iem");
  const [hover, setHover] = useState<string | null>(null);
  const [pedidoMun, setPedidoMun] = useState(false);
  const carregar = nivel !== "mun" || pedidoMun;

  // A malha de 2022 é SEMPRE carregada -- o enquadramento (bbox) do mapa depende dela, e ela é a
  // geometria de contorno/sobreposição das unidades sem feição na edição; isso vale mesmo que
  // 2022 não esteja marcada para exibição.
  const edicoesComMalha = useMemo(() => ordenarEdicoes([...edicoes, "2022"]), [edicoes]);

  const [dadosMapa, setDadosMapa] = useState<DadosMapa | null>(null);
  useEffect(() => {
    if (nivel === "rm" || !carregar) return;
    let vivo = true;
    serieMapa(nivel)
      .then((linhas) => { if (vivo) setDadosMapa({ chave: nivel, linhas: linhas as LinhaMapa[], erro: null }); })
      .catch((e: unknown) => {
        if (vivo) setDadosMapa({ chave: nivel, linhas: null, erro: (e as Error).message ?? "erro desconhecido" });
      });
    return () => { vivo = false; };
  }, [nivel, carregar]);
  const dadosDoNivel = dadosMapa?.chave === nivel ? dadosMapa : null;
  const carregandoDados = carregar && nivel !== "rm" && dadosDoNivel === null;

  /** Agrupa uma única vez por edição -- cada painel lê o seu `Map`, sem refiltrar a lista
   *  inteira a cada render (importante no nível `mun`, até 5.570 x edições). */
  const valoresPorEdicaoENivel = useMemo(() => {
    const porEdicao = new Map<EdicaoSerie, Map<string, LinhaMapa>>();
    for (const e of edicoesComMalha) porEdicao.set(e, new Map());
    for (const l of dadosDoNivel?.linhas ?? []) porEdicao.get(l.edicao)?.set(l.codigo, l);
    return porEdicao;
  }, [dadosDoNivel, edicoesComMalha]);

  const { malhas, erro: erroMalha } = useMalhasPorEdicao(
    nivel === "rm" ? "uf" : nivel, carregar && nivel !== "rm" ? edicoesComMalha : [],
  );
  const malha2022 = malhas["2022"] ?? null;
  const campoId = CAMPO_ID[nivel];

  const bbox = useMemo<Bbox>(() => {
    if (nivel === "uf") return LIMITES_BRASIL;
    if (!malha2022) return LIMITES_BRASIL;
    // A unidade selecionada pode não existir em 2022 (unidade agregada de uma edição antiga,
    // ex.: `NORTEGO`): cai para a primeira malha carregada que a tenha.
    const candidatas = [malha2022, ...edicoesComMalha.map((e) => malhas[e]).filter(
      (m): m is FeatureCollection => m != null && m !== malha2022)];
    let f: Feature | undefined;
    for (const m of candidatas) {
      f = m.features.find((ft) => idDaFeicao(ft, campoId) === codigo);
      if (f) break;
    }
    const b = f && bboxDaMaiorParte(f);
    const expandido = b ? expandirBbox(b, 4) : null;
    return validarEExpandirBbox(expandido) ?? LIMITES_BRASIL;
  }, [nivel, malha2022, malhas, edicoesComMalha, codigo, campoId]);

  // A projeção só muda quando o bbox muda DE VALOR: `bbox` é recalculado (nova referência) cada
  // vez que uma malha chega, e uma projeção nova invalidaria todos os caminhos já calculados.
  const chaveBbox = bbox.join(",");
  const proj = useMemo<Proj>(() => {
    const [minX, minY, maxX, maxY] = chaveBbox.split(",").map(Number);
    const dx = Math.max(maxX - minX, 1), dy = Math.max(maxY - minY, 1);
    const pad = 6;
    const escala = Math.min((LARGURA_PAINEL - 2 * pad) / dx, (ALTURA_PAINEL - 2 * pad) / dy);
    return (p) => [
      pad + (p[0] - minX) * escala,
      ALTURA_PAINEL - pad - (p[1] - minY) * escala,
    ];
  }, [chaveBbox]);

  if (nivel === "rm") {
    return (
      <section className="secao serie-mapa" aria-label="Mapa comparativo">
        <p className="muted-pequeno">Mapa comparativo não publicado para região metropolitana nesta fase.</p>
      </section>
    );
  }

  const erro = dadosDoNivel?.erro ?? erroMalha;

  return (
    <section className="secao serie-mapa" aria-labelledby="serie-mapa-titulo">
      <h4 id="serie-mapa-titulo">Mapa comparativo, censo a censo</h4>
      <div className="serie-mapa-controles">
        <label>
          Medida:{" "}
          <select value={medida} onChange={(e) => setMedida(e.target.value as MedidaMapaSerie)}>
            {MEDIDAS.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
          </select>
        </label>
      </div>
      {!carregar ? (
        <button className="link-serie" onClick={() => setPedidoMun(true)}>
          Carregar os mapas municipais das {edicoes.length} edições marcadas
        </button>
      ) : erro ? (
        <p className="erro" role="alert">Não foi possível carregar o mapa comparativo: {erro}</p>
      ) : (
        <>
          <div className="serie-mapa-paineis">
            {edicoes.map((e) => (
              <PainelMapaEdicao
                key={e} edicao={e} malha={malhas[e] ?? null} malha2022={malha2022} campoId={campoId}
                proj={proj} selecionado={codigo} hover={hover} aoPassarMouse={setHover}
                medida={medida} escuro={escuro} carregando={carregandoDados}
                valores={valoresPorEdicaoENivel.get(e) ?? SEM_VALORES}
              />
            ))}
          </div>
          <Legenda medida={medida} escuro={escuro} />
          <p className="muted-pequeno">
            Quebras fixas (mesmas em todas as edições): {QUEBRAS_FIXAS[medida].map((q) => formatarQuebra(medida, q)).join(" · ")}
            {medida === "iem" ? " (índice, não %)" : " ‰"}.
          </p>
        </>
      )}
    </section>
  );
}

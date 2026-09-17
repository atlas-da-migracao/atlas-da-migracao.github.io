/** F12.5-cartografia -- small multiples de mapa comparativo (5 painéis, um por edição), fim
 *  do Bloco 1 de `SerieCensos.tsx`. Ver docs/design_serie_censos.md, seção 4.
 *
 *  ESCOLHA DE IMPLEMENTAÇÃO (documentada aqui, como pedido pela especificação): este
 *  componente NÃO reaproveita `MapaAtlas.tsx`/deck.gl diretamente. `MapaAtlas` é uma vista
 *  interativa (pan/zoom, arcos, espigas, satélite, picking em WebGL) pensada para UM mapa por
 *  vez; os cinco painéis aqui são pequenos, estáticos (sem pan/zoom -- o enquadramento é fixo
 *  e igual nos cinco, por definição da seção 4.1) e precisam de UMA coisa que deck.gl não
 *  oferece nativamente: preenchimento por `<pattern>` SVG (as três tramas de ausência, seção
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
 *  enquadramento é o Brasil, como pede a seção 4.1.
 */
import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import { basePath, type Censo } from "../lib/edicoes";
import {
  ordenarEdicoes, QUEBRAS_FIXAS, rotuloEdicao, tramaDoEstado,
  type EdicaoSerie, type NivelSerie,
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

/** Converte a geometria de uma feição (Polygon/MultiPolygon, coordenadas em metros) num `d`
 *  de `<path>`, via a projeção afim `proj`. Winding de anéis já vem correto do GeoJSON (anel
 *  externo anti-horário, buracos horário) -- `fill-rule: nonzero` (o default de SVG) já
 *  resolve buracos sem precisar de `evenodd`. */
function pathDaGeometria(geom: Geometry, proj: (p: readonly [number, number]) => [number, number]): string {
  const anel = (r: number[][]) =>
    r.map((p, i) => `${i === 0 ? "M" : "L"}${proj([p[0], p[1]]).join(",")}`).join(" ") + "Z";
  if (geom.type === "Polygon") return (geom.coordinates as number[][][]).map(anel).join(" ");
  if (geom.type === "MultiPolygon") {
    return (geom.coordinates as number[][][][]).flatMap((poly) => poly.map(anel)).join(" ");
  }
  return "";
}

function bboxDaFeicao(f: Feature): Bbox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const varre = (coords: unknown): void => {
    const arr = coords as unknown[];
    if (typeof arr[0] === "number") {
      const [x, y] = arr as [number, number];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    } else {
      for (const c of arr) varre(c);
    }
  };
  if ("coordinates" in f.geometry) varre(f.geometry.coordinates as unknown);
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
        .then((r) => r.json() as Promise<Topology>)
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

function PainelMapaEdicao({
  edicao, malha, valores, campoId, proj, selecionado, hover, aoPassarMouse, medida, escuro,
}: {
  edicao: EdicaoSerie; malha: FeatureCollection | null;
  valores: Map<string, LinhaMapaSerie>; campoId: string;
  proj: (p: readonly [number, number]) => [number, number];
  selecionado: string; hover: string | null;
  aoPassarMouse: (cd: string | null) => void;
  medida: MedidaMapaSerie; escuro: boolean;
}) {
  const idBase = `serie-mapa-${edicao}`;
  if (!malha) {
    return (
      <div className="serie-mapa-painel serie-mapa-painel-vazio" style={{ width: LARGURA_PAINEL, height: ALTURA_PAINEL }}>
        <p className="muted-pequeno">carregando…</p>
      </div>
    );
  }
  return (
    <figure className="serie-mapa-painel">
      <figcaption>{rotuloEdicao(edicao)}</figcaption>
      <svg width={LARGURA_PAINEL} height={ALTURA_PAINEL} viewBox={`0 0 ${LARGURA_PAINEL} ${ALTURA_PAINEL}`}
           role="img" aria-label={`Mapa de ${medida.toUpperCase()} em ${rotuloEdicao(edicao)}`}>
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
        </defs>
        {malha.features.map((f) => {
          const cd = String((f.properties as Record<string, string>)[campoId]);
          const linha = valores.get(cd);
          const estado = !linha ? "nao_medido"
            : linha.existia === false ? "nao_existia"
            : linha.estado_cobertura === "sem_cobertura" ? "sem_cobertura"
            : linha.estado_cobertura === "insuficiente" ? "cobertura_insuficiente"
            : linha.rm_unitaria ? "cobertura_insuficiente"
            : (linha[medida] == null) ? "suprimido"
            : "numero";
          const trama = tramaDoEstado(estado);
          const cor = estado === "numero" ? corMedidaSerie(medida, linha![medida], escuro) : "transparent";
          const d = pathDaGeometria(f.geometry, proj);
          const ehSelecionado = cd === selecionado;
          const ehHover = cd === hover;
          return (
            <g key={cd}>
              <path d={d} fill={cor} stroke="var(--hairline, #cfcdc2)" strokeWidth={0.4}
                    onMouseEnter={() => aoPassarMouse(cd)} onMouseLeave={() => aoPassarMouse(null)}
                    tabIndex={0} role="button" aria-label={cd}
                    onFocus={() => aoPassarMouse(cd)} />
              {trama && <path d={d} fill={`url(#${idBase}-${trama})`} pointerEvents="none" />}
              {(ehSelecionado || ehHover) && (
                <path d={d} fill="none" stroke="var(--ink)" strokeWidth={ehSelecionado ? 1.6 : 1} pointerEvents="none" />
              )}
            </g>
          );
        })}
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
      <ul className="serie-mapa-legenda-tramas" aria-label="Diagonal: território não comparável. Cruzada: suprimido por sigilo. Pontilhada: não medido.">
        <li><span className="serie-mapa-amostra serie-mapa-amostra-diagonal" /> não comparável (não existia / cobertura insuficiente)</li>
        <li><span className="serie-mapa-amostra serie-mapa-amostra-cruzada" /> suprimido (sigilo)</li>
        <li><span className="serie-mapa-amostra serie-mapa-amostra-pontilhada" /> não medido (o censo não perguntou)</li>
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

  // A malha de 2022 é SEMPRE carregada -- o enquadramento (bbox) do mapa depende dela, mesmo
  // que 2022 não esteja marcada para exibição (ver `bbox` abaixo).
  const edicoesComMalha = useMemo(() => ordenarEdicoes([...edicoes, "2022"]), [edicoes]);

  const [linhasSerie, setLinhasSerie] = useState<LinhaMapaSerie[]>([]);
  useEffect(() => {
    if (nivel === "rm" || !carregar) return;
    let vivo = true;
    serieMapa(nivel).then((linhas) => { if (vivo) setLinhasSerie(linhas); })
      .catch(() => { if (vivo) setLinhasSerie([]); });
    return () => { vivo = false; };
  }, [nivel, carregar]);

  /** Agrupa uma única vez por edição -- cada painel lê o seu `Map`, sem refiltrar a lista
   *  inteira a cada render (importante no nível `mun`, até 5.570 x edições). */
  const valoresPorEdicaoENivel = useMemo(() => {
    const porEdicao = new Map<EdicaoSerie, Map<string, LinhaMapaSerie>>();
    for (const e of edicoesComMalha) porEdicao.set(e, new Map());
    for (const l of linhasSerie) porEdicao.get(l.edicao)?.set(l.codigo, l);
    return porEdicao;
  }, [linhasSerie, edicoesComMalha]);

  const { malhas } = useMalhasPorEdicao(nivel === "rm" ? "uf" : nivel, carregar ? edicoesComMalha : []);
  const malha2022 = malhas["2022"] ?? null;
  const campoId = CAMPO_ID[nivel];

  const bbox = useMemo<Bbox>(() => {
    if (nivel === "uf") return LIMITES_BRASIL;
    if (!malha2022) return LIMITES_BRASIL;
    const f = malha2022.features.find((ft) => String((ft.properties as Record<string, string>)[campoId]) === codigo);
    const b = f && bboxDaFeicao(f);
    const expandido = b ? expandirBbox(b, 4) : null;
    return validarEExpandirBbox(expandido) ?? LIMITES_BRASIL;
  }, [nivel, malha2022, codigo, campoId]);

  const proj = useMemo(() => {
    const [minX, minY, maxX, maxY] = bbox;
    const dx = Math.max(maxX - minX, 1), dy = Math.max(maxY - minY, 1);
    const pad = 6;
    const escala = Math.min((LARGURA_PAINEL - 2 * pad) / dx, (ALTURA_PAINEL - 2 * pad) / dy);
    return (p: readonly [number, number]): [number, number] => [
      pad + (p[0] - minX) * escala,
      ALTURA_PAINEL - pad - (p[1] - minY) * escala,
    ];
  }, [bbox]);

  if (nivel === "rm") {
    return (
      <section className="secao serie-mapa" aria-label="Mapa comparativo">
        <p className="muted-pequeno">Mapa comparativo não publicado para região metropolitana nesta fase.</p>
      </section>
    );
  }

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
      ) : (
        <>
          <div className="serie-mapa-paineis">
            {edicoes.map((e) => (
              <PainelMapaEdicao
                key={e} edicao={e} malha={malhas[e] ?? null} campoId={campoId} proj={proj}
                selecionado={codigo} hover={hover} aoPassarMouse={setHover}
                medida={medida} escuro={escuro}
                valores={valoresPorEdicaoENivel.get(e) ?? new Map()}
              />
            ))}
          </div>
          <Legenda medida={medida} escuro={escuro} />
          <p className="muted-pequeno">
            Quebras fixas (mesmas em todas as edições): {QUEBRAS_FIXAS[medida].join(" · ")}
            {medida === "iem" ? " (índice, não %)" : " ‰"}.
          </p>
        </>
      )}
    </section>
  );
}

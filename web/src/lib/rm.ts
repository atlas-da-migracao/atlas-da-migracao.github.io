/** Funções puras do módulo metropolitano (F5b): enquadramento do mapa, agrupamento de
 *  categorias em classes mais legíveis e preparação dos dados do diagrama aluvial.
 *  Mantidas separadas de queries.ts e dos componentes para poder testar sem DuckDB/DOM. */

// F10: desde a projeção Albers (vista padrão do mapa), toda bbox usada para enquadramento
// (fitBounds cartesiano) vem de coordenadas já projetadas em METROS, não graus -- os nomes
// dos campos (lon/lat) e do tipo (Bbox) ficaram, por não valer a pena renomear toda a
// superfície pública só por causa disso (nenhuma das funções abaixo faz matemática
// específica de longitude/latitude; são só min/max e margem relativa), mas os valores
// default de "achatamento"/fallback abaixo foram recalibrados de graus para metros -- ver
// cada comentário. Ver docs/METODOLOGIA.md, "Cartografia: projeção cônica equivalente de
// Albers (F10)".
export type Bbox = [number, number, number, number]; // [minX, minY, maxX, maxY], em metros (Albers)

/** Bbox dos centroides de uma RM, com margem relativa (padrão 8%) para o fitBounds. */
export function bboxDeCentroides(pontos: { lon: number; lat: number }[], margem = 0.08): Bbox | null {
  if (pontos.length === 0) return null;
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const p of pontos) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  // F10: fallback (todos os pontos coincidem) recalibrado de 0,5° (~55km) para 55km em metros.
  const dx = maxLon - minLon || 55_000;
  const dy = maxLat - minLat || 55_000;
  return [minLon - dx * margem, minLat - dy * margem, maxLon + dx * margem, maxLat + dy * margem];
}

/** Bbox de uma geometria GeoJSON (Polygon ou MultiPolygon), com margem relativa. */
export function bboxDeGeometria(geom: { type: string; coordinates: unknown }, margem = 0.12): Bbox | null {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const visitar = (coords: unknown): void => {
    if (!Array.isArray(coords) || coords.length === 0) return;
    if (typeof coords[0] === "number") {
      const [lon, lat] = coords as [number, number];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const c of coords) visitar(c);
  };
  visitar(geom.coordinates);
  if (!Number.isFinite(minLon)) return null;
  // F10: fallback (geometria degenerada) recalibrado de 0,05° (~5,5km) para 5,5km em metros.
  const dx = maxLon - minLon || 5_500;
  const dy = maxLat - minLat || 5_500;
  return [minLon - dx * margem, minLat - dy * margem, maxLon + dx * margem, maxLat + dy * margem];
}

/** União de duas ou mais bboxes (menor retângulo que contém todas). */
export function uniaoDeBboxes(bboxes: (Bbox | null)[]): Bbox | null {
  const validas = bboxes.filter((b): b is Bbox => b != null);
  if (validas.length === 0) return null;
  return [
    Math.min(...validas.map((b) => b[0])),
    Math.min(...validas.map((b) => b[1])),
    Math.max(...validas.map((b) => b[2])),
    Math.max(...validas.map((b) => b[3])),
  ];
}

/** Mapeia as 9 categorias publicadas de tempo de deslocamento em 5 classes ordinais
 *  mais "não se desloca"/"ignorado" neutros, somando os valores de cada linha. */
const MAPA_TEMPO: Record<string, string> = {
  ate_5min: "ate_15min", de_6_a_15min: "ate_15min",
  de_16_a_30min: "de_16_a_30min",
  de_31min_a_1h: "de_31min_a_1h",
  de_1_a_2h: "de_1_a_2h",
  de_2_a_4h: "mais_de_2h", mais_de_4h: "mais_de_2h",
  nao_se_desloca: "outros", ignorado: "outros",
};

export function agruparTempo(linhas: { categoria: string; valor: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas) {
    const chave = MAPA_TEMPO[l.categoria] ?? "outros";
    out[chave] = (out[chave] ?? 0) + l.valor;
  }
  return out;
}

/** Mapeia os 11 grandes grupos ocupacionais (códigos '01'..'11') em 8 classes,
 *  agrupando pares de conteúdo semelhante conforme a spec. */
const MAPA_OCUPACAO: Record<string, string> = {
  "01": "dirigentes_profissionais", "02": "dirigentes_profissionais",
  "03": "tecnicos_administrativo", "04": "tecnicos_administrativo",
  "05": "servicos_vendedores",
  "06": "agropecuaria",
  "07": "industria_operadores", "08": "industria_operadores",
  "09": "elementares",
  "10": "forcas_seguranca",
  "11": "mal_definidas",
};

export function agruparOcupacao(linhas: { categoria: string; valor: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas) {
    const chave = MAPA_OCUPACAO[l.categoria] ?? "mal_definidas";
    out[chave] = (out[chave] ?? 0) + l.valor;
  }
  return out;
}

/** Nomes de dimensão como aparecem no dado publicado (coluna `dimensao`), sempre os mesmos
 *  nas duas edições -- ver pipeline/sql/07_pendular.sql e pipeline/sql/2010/07_pendular.sql,
 *  que gravam 'frequencia'/'tempo' independentemente da edição. A escolha de qual PALETA
 *  usar para exibir cada dimensão (ed.vocabulario.tempo/frequencia, "tempo" vs. "tempo2010")
 *  é responsabilidade de quem chama esta função, não do filtro dos dados. */
export type NomeDimensaoDados =
  | "frequencia" | "modo" | "tempo" | "posicao" | "setor" | "ocupacao" | "renda_trab" | "edu" | "nivel";

/** Filtra as linhas de uma dimensão pendular pela chave de DADOS (sempre fixa, nunca a
 *  variante "*2010" de paletas.ts) e aplica os agrupamentos que reduzem as categorias
 *  brutas publicadas a classes mais legíveis:
 *  - "ocupacao": sempre agrupa (agruparOcupacao), nas duas edições.
 *  - "tempo": só agrupa (agruparTempo, 9 categorias -> 5 classes) quando `agruparTempoFino`
 *    é true -- ou seja, quando a edição usa o vocabulário de 2022 (ed.vocabulario.tempo ===
 *    "tempo"). Em 2010 (`agruparTempoFino` false) as 6 categorias de tempo2010 já vêm na
 *    granularidade final e são devolvidas cruas, sem reagrupar.
 *  - demais dimensões: soma direta por categoria. */
export function valoresPendular(
  linhas: { dimensao: string; categoria: string; valor: number }[],
  dimDados: NomeDimensaoDados,
  agruparTempoFino: boolean,
): Record<string, number> {
  const doDim = linhas.filter((l) => l.dimensao === dimDados);
  if (dimDados === "tempo" && agruparTempoFino) return agruparTempo(doDim);
  if (dimDados === "ocupacao") return agruparOcupacao(doDim);
  const out: Record<string, number> = {};
  for (const l of doDim) out[l.categoria] = (out[l.categoria] ?? 0) + l.valor;
  return out;
}

// ================= F6: níveis de agregação (RGI, RGInt, UF) =================

/** Saldo, TLM e IEM de uma unidade agregada a partir de imig/emig/pop5 -- a mesma fórmula
 *  usada em queries.ts (SQL), extraída aqui como função pura para poder ser testada sem
 *  DuckDB. Indicadores agregados são somas diretas dos fluxos municipais publicados, sem
 *  erro-padrão próprio (ver metodologia). */
export function indicadoresAgregados(imig: number, emig: number, pop5: number) {
  const saldo = imig - emig;
  const tlm = pop5 > 0 ? (saldo / pop5) * 1000 : null;
  const iem = imig + emig > 0 ? saldo / (imig + emig) : null;
  return { saldo, tlm, iem };
}

/** Valida um bbox para enquadramento (fitBounds) e, se degenerado (largura ou altura
 *  efetivamente zero -- um município minúsculo, um par de centroides coincidente),
 *  expande-o para uma largura/altura mínima. F10: o fit passou a ser cartesiano
 *  (`fitBoundsCartesiano` abaixo), calculado à mão -- mas a mesma guarda continua
 *  necessária: um bbox de área zero produziria um `zoom` infinito (divisão por um intervalo
 *  nulo). Retorna null se o bbox não puder ser tornado válido (coordenada não finita, ou
 *  mínimo maior que o máximo). Margem mínima default recalibrada de 0,02° (~2,2km) para
 *  2,2km em metros (F10). */
export function validarEExpandirBbox(bbox: Bbox | null | undefined, margemMinMetros = 2_200): Bbox | null {
  if (!bbox) return null;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null;
  if (minLon > maxLon || minLat > maxLat) return null;
  const achataLon = maxLon - minLon < margemMinMetros;
  const achataLat = maxLat - minLat < margemMinMetros;
  if (!achataLon && !achataLat) return bbox;
  const cx = (minLon + maxLon) / 2, cy = (minLat + maxLat) / 2;
  return [
    achataLon ? cx - margemMinMetros / 2 : minLon,
    achataLat ? cy - margemMinMetros / 2 : minLat,
    achataLon ? cx + margemMinMetros / 2 : maxLon,
    achataLat ? cy + margemMinMetros / 2 : maxLat,
  ];
}

/** Vista cartesiana (OrthographicView + COORDINATE_SYSTEM.CARTESIAN) que enquadra um bbox em
 *  metros dentro de um viewport de `largura`x`altura` px, com `padding` px de margem em cada
 *  lado -- o equivalente cartesiano de `WebMercatorViewport.fitBounds`, que não existe em
 *  modo Orthographic (ver docs/METODOLOGIA.md, F10, e web/src/map/MapaAtlas.tsx). `zoom: 0`
 *  no OrthographicView do deck.gl mapeia 1 unidade de mundo (aqui, 1 metro) a 1 px; dobrar o
 *  zoom em 1 dobra a escala -- por isso `zoom = log2(escala)`. Nunca acessa `window`/DOM:
 *  função pura, testável sem o deck.gl montado. */
export function fitBoundsCartesiano(
  bbox: Bbox, largura: number, altura: number, padding = 48,
): { target: [number, number, number]; zoom: number } {
  const [minX, minY, maxX, maxY] = bbox;
  const dx = Math.max(maxX - minX, 1);
  const dy = Math.max(maxY - minY, 1);
  const larguraUtil = Math.max(largura - 2 * padding, 1);
  const alturaUtil = Math.max(altura - 2 * padding, 1);
  const escala = Math.min(larguraUtil / dx, alturaUtil / dy);
  return { target: [(minX + maxX) / 2, (minY + maxY) / 2, 0], zoom: Math.log2(escala) };
}

/** Prioridade única de enquadramento do mapa: fluxo selecionado > seleção (município ou
 *  unidade agregada) > RM ativa > Brasil. Extraída do App para poder ser testada sem React. */
export function prioridadeFoco<T>(fluxoFoco: T | null, selecaoFoco: T | null, rmFoco: T | null): T | null {
  return fluxoFoco ?? selecaoFoco ?? rmFoco ?? null;
}

/** Saldo intra-RM de cada município: Σ entradas − Σ saídas nos fluxos intra-RM. */
export interface SaldoIntraRM { cd_mun: string; entradas: number; saidas: number; saldo: number }

export function calcularRankingSaldoIntraRM(
  fluxos: { origem: string; destino: string; total: number }[],
): SaldoIntraRM[] {
  const m = new Map<string, { entradas: number; saidas: number }>();
  const pega = (cd: string) => {
    let r = m.get(cd);
    if (!r) { r = { entradas: 0, saidas: 0 }; m.set(cd, r); }
    return r;
  };
  for (const f of fluxos) {
    pega(f.destino).entradas += f.total;
    pega(f.origem).saidas += f.total;
  }
  return [...m.entries()]
    .map(([cd_mun, r]) => ({ cd_mun, entradas: r.entradas, saidas: r.saidas, saldo: r.entradas - r.saidas }))
    .sort((a, b) => b.saldo - a.saldo);
}

// ================= Diagrama aluvial (morava em -> mora em -> trabalha em) =================

export interface CaminhoPendular {
  origem_mig: string; destino_mig: string; destino_trab: string; classe_trab: string; total: number;
  n_faixa?: string;
}

export interface NoSankey { id: string; rotulo: string }
export interface LinkSankey { source: string; target: string; value: number; classe: string }
/** Uma linha da tabela acessível: um dos `top` caminhos originais, ou o agrupamento
 *  "outros" sintético que soma tudo além dele. */
export interface CaminhoSankeyResolvido {
  origem: string; residencia: string; trabalho: string; classe: string; total: number; n_faixa: string;
}
export interface DadosSankey { nodes: NoSankey[]; links: LinkSankey[]; caminhos: CaminhoSankeyResolvido[] }

/** Prepara nós e links do diagrama de 3 colunas a partir dos caminhos
 *  origem_mig -> destino_mig -> destino_trab, mantendo os `top` maiores caminhos e
 *  agregando TODO o restante num único caminho sintético "outros" (não um por linha
 *  restante -- isso é o que mantém o diagrama em no máximo `top + 1` caminhos e
 *  2*(top + 1) links, em vez de crescer com o tamanho da RM).
 *  `nomes` traduz códigos de município em rótulos legíveis; entradas sem nome mapeado
 *  usam o próprio código. As colunas recebem prefixo (o: origem, r: residência,
 *  t: trabalho) para que o mesmo município possa aparecer, sem colisão de id, em
 *  mais de uma coluna. */
export function prepararSankey(
  caminhos: CaminhoPendular[],
  nomes: Map<string, string>,
  top = 12,
): DadosSankey {
  const nome = (cd: string) => nomes.get(cd) ?? cd;
  const ordenados = [...caminhos].sort((a, b) => b.total - a.total);
  const principais = ordenados.slice(0, top);
  const resto = ordenados.slice(top);

  const nodes = new Map<string, NoSankey>();
  const links = new Map<string, LinkSankey>(); // chave "source|target|classe"
  const caminhosResolvidos: CaminhoSankeyResolvido[] = [];

  const addNode = (id: string, rotulo: string) => { if (!nodes.has(id)) nodes.set(id, { id, rotulo }); };
  const addLink = (source: string, target: string, value: number, classe: string) => {
    const chave = `${source}|${target}|${classe}`;
    const existente = links.get(chave);
    if (existente) existente.value += value;
    else links.set(chave, { source, target, value, classe });
  };

  for (const c of principais) {
    const o = `o:${c.origem_mig}`, r = `r:${c.destino_mig}`, t = `t:${c.destino_trab}`;
    addNode(o, nome(c.origem_mig));
    addNode(r, nome(c.destino_mig));
    addNode(t, nome(c.destino_trab));
    addLink(o, r, c.total, "residencia");
    addLink(r, t, c.total, c.classe_trab);
    caminhosResolvidos.push({
      origem: nome(c.origem_mig), residencia: nome(c.destino_mig), trabalho: nome(c.destino_trab),
      classe: c.classe_trab, total: c.total, n_faixa: c.n_faixa ?? "",
    });
  }

  if (resto.length > 0) {
    const o = "o:outros", r = "r:outros", t = "t:outros";
    const totalResto = resto.reduce((soma, c) => soma + c.total, 0);
    addNode(o, "Outras origens");
    addNode(r, "Outras residências");
    addNode(t, "Outros municípios");
    addLink(o, r, totalResto, "residencia");
    addLink(r, t, totalResto, "outros");
    caminhosResolvidos.push({
      origem: "Outras origens", residencia: "Outras residências", trabalho: "Outros municípios",
      classe: "outros", total: totalResto, n_faixa: "—",
    });
  }

  return { nodes: [...nodes.values()], links: [...links.values()], caminhos: caminhosResolvidos };
}

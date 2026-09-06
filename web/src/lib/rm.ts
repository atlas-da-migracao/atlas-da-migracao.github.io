/** Funções puras do módulo metropolitano (F5b): enquadramento do mapa, agrupamento de
 *  categorias em classes mais legíveis e preparação dos dados do diagrama aluvial.
 *  Mantidas separadas de queries.ts e dos componentes para poder testar sem DuckDB/DOM. */

export type Bbox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

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
  const dx = maxLon - minLon || 0.5;
  const dy = maxLat - minLat || 0.5;
  return [minLon - dx * margem, minLat - dy * margem, maxLon + dx * margem, maxLat + dy * margem];
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

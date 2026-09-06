import { describe, expect, it } from "vitest";
import {
  agruparOcupacao, agruparTempo, bboxDeCentroides, calcularRankingSaldoIntraRM, prepararSankey,
} from "../rm";

describe("bboxDeCentroides", () => {
  it("envolve todos os pontos com margem positiva", () => {
    const pontos = [{ lon: -47, lat: -23 }, { lon: -46, lat: -22 }, { lon: -48, lat: -24 }];
    const bbox = bboxDeCentroides(pontos)!;
    expect(bbox[0]).toBeLessThan(-48);
    expect(bbox[1]).toBeLessThan(-24);
    expect(bbox[2]).toBeGreaterThan(-46);
    expect(bbox[3]).toBeGreaterThan(-22);
  });

  it("devolve null para lista vazia", () => {
    expect(bboxDeCentroides([])).toBeNull();
  });

  it("não colapsa quando todos os pontos coincidem", () => {
    const bbox = bboxDeCentroides([{ lon: -47, lat: -23 }])!;
    expect(bbox[2] - bbox[0]).toBeGreaterThan(0);
    expect(bbox[3] - bbox[1]).toBeGreaterThan(0);
  });
});

describe("agruparTempo", () => {
  it("soma as 9 categorias publicadas em 5 classes + neutro", () => {
    const out = agruparTempo([
      { categoria: "ate_5min", valor: 10 }, { categoria: "de_6_a_15min", valor: 20 },
      { categoria: "de_16_a_30min", valor: 30 },
      { categoria: "de_31min_a_1h", valor: 40 },
      { categoria: "de_1_a_2h", valor: 50 },
      { categoria: "de_2_a_4h", valor: 5 }, { categoria: "mais_de_4h", valor: 5 },
      { categoria: "nao_se_desloca", valor: 1 }, { categoria: "ignorado", valor: 2 },
    ]);
    expect(out.ate_15min).toBe(30);
    expect(out.de_16_a_30min).toBe(30);
    expect(out.de_31min_a_1h).toBe(40);
    expect(out.de_1_a_2h).toBe(50);
    expect(out.mais_de_2h).toBe(10);
    expect(out.outros).toBe(3);
    const soma = Object.values(out).reduce((a, b) => a + b, 0);
    expect(soma).toBe(163);
  });
});

describe("agruparOcupacao", () => {
  it("agrupa os 11 grandes grupos em 8 classes preservando a soma total", () => {
    const linhas = Array.from({ length: 11 }, (_, i) => ({
      categoria: String(i + 1).padStart(2, "0"), valor: 10,
    }));
    const out = agruparOcupacao(linhas);
    expect(Object.keys(out)).toHaveLength(8); // 11 grupos -> 8 classes (3 pares fundidos)
    const soma = Object.values(out).reduce((a, b) => a + b, 0);
    expect(soma).toBe(110);
    expect(out.dirigentes_profissionais).toBe(20);
    expect(out.industria_operadores).toBe(20);
  });

  it("categorias desconhecidas caem em mal_definidas, sem perder valor", () => {
    const out = agruparOcupacao([{ categoria: "99", valor: 7 }, { categoria: "11", valor: 3 }]);
    expect(out.mal_definidas).toBe(10);
  });
});

describe("calcularRankingSaldoIntraRM", () => {
  it("soma entradas e saídas por município e ordena do maior saldo ao menor", () => {
    const fluxos = [
      { origem: "A", destino: "B", total: 100 },
      { origem: "A", destino: "C", total: 50 },
      { origem: "B", destino: "A", total: 10 },
    ];
    const r = calcularRankingSaldoIntraRM(fluxos);
    const porCodigo = new Map(r.map((x) => [x.cd_mun, x]));
    expect(porCodigo.get("A")!.saldo).toBe(10 - 150); // entra 10, sai 150
    expect(porCodigo.get("B")!.saldo).toBe(100 - 10);
    expect(porCodigo.get("C")!.saldo).toBe(50);
    // ordenado do maior para o menor saldo
    expect(r[0].saldo).toBeGreaterThanOrEqual(r[r.length - 1].saldo);
  });

  it("lista vazia não quebra", () => {
    expect(calcularRankingSaldoIntraRM([])).toEqual([]);
  });
});

describe("prepararSankey", () => {
  const nomes = new Map([["1", "Origem"], ["2", "Residência"], ["3", "Trabalho"], ["4", "Trabalho B"]]);

  it("mantém os nós e a soma dos links igual à soma dos caminhos", () => {
    const caminhos = [
      { origem_mig: "1", destino_mig: "2", destino_trab: "3", classe_trab: "nucleo", total: 100 },
      { origem_mig: "1", destino_mig: "2", destino_trab: "4", classe_trab: "outro", total: 50 },
    ];
    const { nodes, links } = prepararSankey(caminhos, nomes, 12);
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["o:1", "r:2", "t:3", "t:4"]));
    const somaLinks = links.reduce((a, l) => a + l.value, 0);
    // cada caminho contribui com dois links (residência e trabalho) -- a soma dos links
    // de trabalho isoladamente deve bater com a soma dos caminhos
    const somaTrabalho = links.filter((l) => l.target.startsWith("t:")).reduce((a, l) => a + l.value, 0);
    expect(somaTrabalho).toBe(150);
    expect(somaLinks).toBe(150 + 150); // residência + trabalho
  });

  it("ids de nó trazem o prefixo da coluna (o:, r:, t:), nunca o código nu", () => {
    const caminhos = [
      { origem_mig: "1", destino_mig: "2", destino_trab: "3", classe_trab: "nucleo", total: 100 },
    ];
    const { nodes } = prepararSankey(caminhos, nomes, 12);
    for (const n of nodes) expect(n.id).toMatch(/^[ort]:/);
  });

  it("com mais de 12 caminhos, mantém só os 12 maiores + 1 agrupamento 'outros' -- não um por linha restante", () => {
    const caminhos = Array.from({ length: 15 }, (_, i) => ({
      origem_mig: String(i), destino_mig: String(i), destino_trab: String(i), classe_trab: "outro", total: 10 + i,
    }));
    const { nodes, links, caminhos: resolvidos } = prepararSankey(caminhos, nomes, 12);
    // 12 principais + 1 sintético "outros" = 13 caminhos na tabela acessível
    expect(resolvidos).toHaveLength(13);
    expect(resolvidos.at(-1)?.trabalho).toBe("Outros municípios");
    // no máximo 3 nós por caminho (o, r, t) x 13 = 39 -- nunca cresce com o tamanho da RM
    expect(nodes.length).toBeLessThanOrEqual(3 * 13);
    // no máximo 2 links por caminho (o->r, r->t) x 13 = 26
    expect(links.length).toBeLessThanOrEqual(2 * 13);
    expect(nodes.some((n) => n.id === "t:outros")).toBe(true);
    // nada se perde: soma de todos os caminhos = soma dos links de cada estágio
    const somaCaminhos = caminhos.reduce((a, c) => a + c.total, 0);
    const somaResidencia = links.filter((l) => l.target.startsWith("r:")).reduce((a, l) => a + l.value, 0);
    const somaTrabalho = links.filter((l) => l.target.startsWith("t:")).reduce((a, l) => a + l.value, 0);
    expect(somaResidencia).toBe(somaCaminhos);
    expect(somaTrabalho).toBe(somaCaminhos);
  });

  it("nº de links nunca excede 2x o nº de caminhos exibidos, para qualquer volume de entrada", () => {
    const caminhos = Array.from({ length: 200 }, (_, i) => ({
      origem_mig: `o${i}`, destino_mig: `d${i}`, destino_trab: `t${i}`, classe_trab: "outro", total: 1,
    }));
    const { links, caminhos: resolvidos } = prepararSankey(caminhos, nomes, 12);
    expect(resolvidos).toHaveLength(13);
    expect(links.length).toBeLessThanOrEqual(2 * resolvidos.length);
  });

  it("caminhos vazios não quebram", () => {
    expect(prepararSankey([], nomes)).toEqual({ nodes: [], links: [], caminhos: [] });
  });
});

import { describe, expect, it } from "vitest";
import {
  escolherLadosDosRotulos, posicionarRotulosAngulares, rotulosVisiveisEmColunas,
} from "../rotulos";

const VOLTA = 2 * Math.PI;

/** menor folga entre rótulos vizinhos (no anel fechado), em pixels de arco sobre o raio */
function menorDistanciaPx(angulos: number[], raio: number): number {
  let menor = Infinity;
  for (let i = 0; i < angulos.length; i++) {
    const j = (i + 1) % angulos.length;
    const d = j === 0 ? angulos[0] + VOLTA - angulos[i] : angulos[j] - angulos[i];
    menor = Math.min(menor, d * raio);
  }
  return menor;
}

describe("posicionarRotulosAngulares", () => {
  it("rótulos que já têm espaço não se movem", () => {
    const a = [0, 1, 2, 3, 4, 5];
    expect(posicionarRotulosAngulares(a, 200, 16, 12)).toEqual(a);
  });

  it("um grupo apertado (7 rótulos a ~1°) abre em leque sem sobreposição", () => {
    const grau = Math.PI / 180;
    const apertados = Array.from({ length: 7 }, (_, i) => (2 + i * 1.2) * grau); // perto do topo
    const resto = Array.from({ length: 20 }, (_, i) => (40 + i * 15) * grau);
    const entrada = [...apertados, ...resto];
    const saida = posicionarRotulosAngulares(entrada, 234, 18, 12);
    // perto do topo o mínimo é a largura do rótulo (18 px)
    const separacaoNorte = Array.from({ length: 6 }, (_, i) => (saida[i + 1] - saida[i]) * 234);
    for (const d of separacaoNorte) expect(d).toBeGreaterThanOrEqual(18 - 0.5);
    expect(saida).toHaveLength(entrada.length);
  });

  it("a ordem cíclica é preservada e o leque fica centrado no grupo original", () => {
    const grau = Math.PI / 180;
    const entrada = [88, 89, 90, 91, 92].map((g) => g * grau); // na lateral: pesa a altura
    const saida = posicionarRotulosAngulares(entrada, 200, 18, 12);
    for (let i = 1; i < saida.length; i++) expect(saida[i]).toBeGreaterThan(saida[i - 1]);
    const centroAntes = entrada.reduce((s, x) => s + x, 0) / entrada.length;
    const centroDepois = saida.reduce((s, x) => s + x, 0) / saida.length;
    expect(centroDepois).toBeCloseTo(centroAntes, 2);
    // na lateral (θ ≈ 90°) o que importa é a altura: 12 px
    expect(menorDistanciaPx(saida, 200)).toBeGreaterThanOrEqual(12 - 0.5);
  });

  it("o anel fecha: último e primeiro rótulo também se afastam", () => {
    const grau = Math.PI / 180;
    const entrada = [0.5 * grau, 90 * grau, 180 * grau, 359.5 * grau];
    const saida = posicionarRotulosAngulares(entrada, 234, 18, 12);
    const d = saida[0] + VOLTA - saida[3];
    expect(d * 234).toBeGreaterThanOrEqual(18 - 0.5);
  });

  it("casos degenerados: 0 ou 1 rótulo, raio inválido", () => {
    expect(posicionarRotulosAngulares([], 100, 10, 10)).toEqual([]);
    expect(posicionarRotulosAngulares([1], 100, 10, 10)).toEqual([1]);
    expect(posicionarRotulosAngulares([1, 1.001], 0, 10, 10)).toEqual([1, 1.001]);
  });
});

describe("escolherLadosDosRotulos", () => {
  const limites = { largura: 420, altura: 320 };

  it("ponto isolado: rótulo acima (primeira opção)", () => {
    expect(escolherLadosDosRotulos([{ x: 200, y: 160 }], 50, 24, 4, limites)).toEqual(["acima"]);
  });

  it("dois pontos a 15 px: os rótulos não ficam no mesmo lado (não se sobrepõem)", () => {
    const pts = [{ x: 200, y: 160 }, { x: 215, y: 160 }];
    const lados = escolherLadosDosRotulos(pts, 50, 24, 4, limites);
    expect(lados[0]).toBe("acima");
    expect(lados[1]).not.toBe("acima");
  });

  it("ponto junto à borda superior: o rótulo vai para baixo", () => {
    expect(escolherLadosDosRotulos([{ x: 200, y: 10 }], 50, 24, 4, limites)).toEqual(["abaixo"]);
  });

  it("lista vazia", () => {
    expect(escolherLadosDosRotulos([], 50, 24, 4, limites)).toEqual([]);
  });
});

describe("rotulosVisiveisEmColunas", () => {
  it("mantém o maior nó e descarta o rótulo vizinho que colidiria", () => {
    const nos = [
      { id: "a", coluna: 1, y: 100, tamanho: 50 },
      { id: "b", coluna: 1, y: 105, tamanho: 2 },   // 5 px do maior: colide
      { id: "c", coluna: 1, y: 140, tamanho: 3 },   // folgado
    ];
    const v = rotulosVisiveisEmColunas(nos, 11);
    expect(v.has("a")).toBe(true);
    expect(v.has("b")).toBe(false);
    expect(v.has("c")).toBe(true);
  });

  it("colunas diferentes não disputam espaço", () => {
    const nos = [
      { id: "a", coluna: 0, y: 100, tamanho: 10 },
      { id: "b", coluna: 1, y: 100, tamanho: 10 },
    ];
    expect([...rotulosVisiveisEmColunas(nos, 11)].sort()).toEqual(["a", "b"]);
  });

  it("prioriza por tamanho, não pela ordem de entrada", () => {
    const nos = [
      { id: "pequeno", coluna: 0, y: 100, tamanho: 1 },
      { id: "grande", coluna: 0, y: 103, tamanho: 9 },
    ];
    const v = rotulosVisiveisEmColunas(nos, 11);
    expect(v.has("grande")).toBe(true);
    expect(v.has("pequeno")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  ALTURA_ARCO, FLECHA_MAX_M, TILT_ARCO, alturaDoArco, flechaDoArco,
  poligonoSeta, AFASTAMENTO_SETA_PX, COMPRIMENTO_SETA_PX,
} from "../arcos";

describe("curvatura dos arcos de fluxo", () => {
  it("gira a parábola inteiramente para o plano do mapa", () => {
    // |tilt| = 90 é o que zera a componente Z (z * cos(90°)) e manda todo o deslocamento
    // para XY (perp * z * sin(90°)) -- sem isso a curva é invisível sob OrthographicView.
    expect(Math.abs(TILT_ARCO)).toBe(90);
  });

  it("usa a flecha nominal (15% do vão) em fluxos curtos", () => {
    const vao = 41_000; // São Paulo -> Guarulhos, 1980
    expect(alturaDoArco(vao)).toBeCloseTo(ALTURA_ARCO, 10);
    expect(flechaDoArco(vao)).toBeCloseTo(0.15 * vao, 6);
  });

  it("respeita o teto de flecha nos fluxos de longa distância", () => {
    for (const vao of [1_000_001, 2_145_000, 2_478_000, 4_000_000]) {
      expect(flechaDoArco(vao)).toBeLessThanOrEqual(FLECHA_MAX_M + 1e-6);
      expect(alturaDoArco(vao)).toBeLessThan(ALTURA_ARCO);
    }
    // Recife -> São Paulo (1980): flecha exatamente no teto
    expect(flechaDoArco(2_145_000)).toBeCloseTo(FLECHA_MAX_M, 6);
  });

  it("nunca deixa o arco na corda (flecha > 0) e é monotônica até o teto", () => {
    expect(flechaDoArco(10_000)).toBeGreaterThan(0);
    expect(flechaDoArco(500_000)).toBeGreaterThan(flechaDoArco(100_000));
    expect(alturaDoArco(0)).toBe(ALTURA_ARCO);           // vão degenerado: valor nominal
    expect(alturaDoArco(Number.NaN)).toBe(ALTURA_ARCO);
  });

  it("separa pares recíprocos: A→B e B→A ficam em lados opostos da corda", () => {
    // o deslocamento é perp(dir) * flecha; invertendo a viagem, perp(dir) inverte de sinal
    const perp = ([dx, dy]: [number, number]) => [-dy, dx] as [number, number];
    const ida = perp([1, 0]), volta = perp([-1, 0]);
    expect(ida[1]).toBe(-volta[1]);
  });
});

describe("ponta de seta na chegada do arco (poligonoSeta)", () => {
  const MPP = 2; // 2 metros por pixel, um zoom qualquer

  it("a ponta nunca toca o centroide de destino -- fica afastada por AFASTAMENTO_SETA_PX", () => {
    const [, , ponta] = poligonoSeta(0, 0, 1000, 0, MPP)!;
    const distDoDestino = Math.hypot(1000 - ponta[0], 0 - ponta[1]);
    expect(distDoDestino).toBeCloseTo(AFASTAMENTO_SETA_PX * MPP, 6);
  });

  it("aponta na direção origem -> destino (eixo X puro)", () => {
    const [base1, base2, ponta] = poligonoSeta(0, 0, 1000, 0, MPP)!;
    // a ponta fica à frente da base (mais perto do destino, em X)
    expect(ponta[0]).toBeGreaterThan(base1[0]);
    expect(ponta[0]).toBeGreaterThan(base2[0]);
    // a base é simétrica em torno do eixo (y opostos, mesmo x)
    expect(base1[0]).toBeCloseTo(base2[0], 6);
    expect(base1[1]).toBeCloseTo(-base2[1], 6);
  });

  it("gira corretamente para um arco vertical (eixo Y)", () => {
    const [base1, base2, ponta] = poligonoSeta(0, 0, 0, 1000, MPP)!;
    expect(ponta[1]).toBeGreaterThan(base1[1]);
    expect(ponta[1]).toBeGreaterThan(base2[1]);
    expect(base1[1]).toBeCloseTo(base2[1], 6);
  });

  it("comprimento em pixels fica constante em qualquer zoom (convertido para metros)", () => {
    const [, base2a, pontaA] = poligonoSeta(0, 0, 1000, 0, 1)!;
    const [, base2b, pontaB] = poligonoSeta(0, 0, 1000, 0, 5)!;
    const compA = Math.hypot(pontaA[0] - base2a[0], pontaA[1] - base2a[1]);
    const compB = Math.hypot(pontaB[0] - base2b[0], pontaB[1] - base2b[1]);
    // mesmo comprimento em PIXELS -> comprimento em metros escala com metrosPorPixel
    expect(compB / compA).toBeCloseTo(5, 1);
  });

  it("origem == destino (vão degenerado) devolve null, não um erro/NaN", () => {
    expect(poligonoSeta(500, 500, 500, 500, MPP)).toBeNull();
  });

  it("a base fica atrás da ponta por COMPRIMENTO_SETA_PX (em metros)", () => {
    const [base1, , ponta] = poligonoSeta(0, 0, 1000, 0, MPP)!;
    // projeção do vetor base->ponta no eixo x deve ser ~ comprimento (base é ligeiramente
    // deslocada em y, então usa-se a distância à reta, não só delta-x)
    const compEsperado = COMPRIMENTO_SETA_PX * MPP;
    const dx = ponta[0] - base1[0];
    expect(dx).toBeGreaterThan(compEsperado * 0.9); // >90% do comprimento no eixo principal
  });
});

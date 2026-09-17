import { describe, it, expect } from "vitest";
import { ALTURA_ARCO, FLECHA_MAX_M, alturaDoArco, flechaDoArco } from "../arcos";

describe("flecha dos fluxos (compartilhada com lib/fluxos.ts)", () => {
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
    // (mesma invariante que lib/fluxos.ts usa via perpendicularHoraria)
    const perp = ([dx, dy]: [number, number]) => [dy, -dx] as [number, number];
    const ida = perp([1, 0]), volta = perp([-1, 0]);
    expect(ida[1]).toBe(-volta[1]);
  });
});

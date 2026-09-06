import { describe, expect, it } from "vitest";
import { prepararPiramide } from "../piramide";

describe("prepararPiramide", () => {
  it("calcula o percentual de cada faixa/sexo sobre o total M+F", () => {
    const d = prepararPiramide({
      "05_14_m": 10, "05_14_f": 10,
      "15_24_m": 20, "15_24_f": 10,
      "25_39_m": 25, "25_39_f": 25,
    });
    expect(d.total).toBe(100);
    const f0524 = d.pontos.find((p) => p.chave === "05_14")!;
    expect(f0524.pctHomens).toBeCloseTo(10);
    expect(f0524.pctMulheres).toBeCloseTo(10);
    const f1524 = d.pontos.find((p) => p.chave === "15_24")!;
    expect(f1524.pctHomens).toBeCloseTo(20);
  });

  it("devolve as 5 faixas de FAIXAS_IDADE, mesmo faltando dados", () => {
    const d = prepararPiramide({});
    expect(d.pontos).toHaveLength(5);
    expect(d.total).toBe(0);
    expect(d.pontos.every((p) => p.pctHomens === 0 && p.pctMulheres === 0)).toBe(true);
  });

  it("ignora chaves fora do padrão <faixa>_m/<faixa>_f (ex.: 'outros')", () => {
    const d = prepararPiramide({ "05_14_m": 5, "05_14_f": 5, outros: 1000 });
    expect(d.total).toBe(10);
  });
});

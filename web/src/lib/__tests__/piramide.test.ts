import { describe, expect, it } from "vitest";
import { prepararPiramide } from "../piramide";

describe("prepararPiramide", () => {
  it("calcula o percentual de cada faixa/sexo sobre o total do grupo", () => {
    const d = prepararPiramide({
      "05_14_m": 10, "05_14_f": 10,
      "15_24_m": 20, "15_24_f": 10,
      "25_39_m": 25, "25_39_f": 25,
    });
    expect(d.total).toBe(100);
    expect(d.outros).toBe(0);
    expect(d.pctOutros).toBe(0);
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
    expect(d.totalGeral).toBe(0);
    expect(d.pctOutros).toBe(0);
    expect(d.pontos.every((p) => p.pctHomens === 0 && p.pctMulheres === 0)).toBe(true);
  });

  it("aceita as chaves MAIÚSCULAS de municipios_dim (05_14_M / 05_14_F)", () => {
    // municipios_dim publica a categoria de idade_sexo como "05_14_M", "05_14_F", "05_14_I"
    const d = prepararPiramide({
      "05_14_M": 10, "05_14_F": 10, "15_24_M": 30, "15_24_F": 20, "60_mais_M": 15, "60_mais_F": 15,
    });
    expect(d.total).toBe(100);
    expect(d.pontos.find((p) => p.chave === "05_14")!.homens).toBe(10);
    expect(d.pontos.find((p) => p.chave === "15_24")!.pctHomens).toBeCloseTo(30);
    expect(d.pontos.find((p) => p.chave === "60_mais")!.mulheres).toBe(15);
  });

  it("minúsculas (fluxos) e maiúsculas (municipios_dim) dão o mesmo resultado", () => {
    const minusc = prepararPiramide({ "25_39_m": 7, "25_39_f": 9, "40_59_m": 4, "40_59_f": 5, outros: 3 });
    const maiusc = prepararPiramide({ "25_39_M": 7, "25_39_F": 9, "40_59_M": 4, "40_59_F": 5, outros: 3 });
    expect(maiusc).toEqual(minusc);
  });

  it("o residual `outros` entra no denominador: as barras NÃO são renormalizadas", () => {
    // 10 + 10 nas barras e 80 suprimidos: cada barra vale 10% do total (e não 50%)
    const d = prepararPiramide({ "05_14_m": 10, "05_14_f": 10, outros: 80 });
    expect(d.total).toBe(20);
    expect(d.outros).toBe(80);
    expect(d.totalGeral).toBe(100);
    expect(d.pctOutros).toBeCloseTo(80);
    const f = d.pontos.find((p) => p.chave === "05_14")!;
    expect(f.pctHomens).toBeCloseTo(10);
    expect(f.pctMulheres).toBeCloseTo(10);
    // barras + residual = 100%
    const somaBarras = d.pontos.reduce((a, p) => a + p.pctHomens + p.pctMulheres, 0);
    expect(somaBarras + d.pctOutros).toBeCloseTo(100);
  });

  it("sexo ignorado (<faixa>_I de municipios_dim) soma ao residual", () => {
    const d = prepararPiramide({ "05_14_M": 45, "05_14_F": 45, "05_14_I": 5, outros: 5 });
    expect(d.total).toBe(90);
    expect(d.outros).toBe(10);
    expect(d.pctOutros).toBeCloseTo(10);
    expect(d.pontos.find((p) => p.chave === "05_14")!.pctHomens).toBeCloseTo(45);
  });

  it("ignora valores não numéricos/não finitos", () => {
    const d = prepararPiramide({ "05_14_m": 5, "05_14_f": Number.NaN, outros: Number.POSITIVE_INFINITY });
    expect(d.total).toBe(5);
    expect(d.outros).toBe(0);
  });

  it("só residual (tudo suprimido): total 0, pctOutros 100", () => {
    const d = prepararPiramide({ outros: 50 });
    expect(d.total).toBe(0);
    expect(d.pctOutros).toBeCloseTo(100);
  });
});

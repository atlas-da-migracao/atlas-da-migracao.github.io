import { describe, expect, it } from "vitest";
import { ic95, sinal, sinal1 } from "../format";

describe("sinal", () => {
  it("usa o sinal tipográfico e separador de milhar pt-BR", () => {
    expect(sinal(1234)).toBe("+1.234");
    expect(sinal(-1234)).toBe("−1.234");
  });

  it("decide o sinal depois de arredondar: nada de +0/−0", () => {
    expect(sinal(0)).toBe("0");
    expect(sinal(0.4)).toBe("0");
    expect(sinal(-0.4)).toBe("0");
    expect(sinal(-0.49)).toBe("0");
  });

  it("arredonda a metade para longe do zero, com o sinal correspondente", () => {
    expect(sinal(0.5)).toBe("+1");
    expect(sinal(-0.5)).toBe("−1");
    expect(sinal(-1.6)).toBe("−2");
  });

  it("null/undefined/não finito viram travessão", () => {
    expect(sinal(null)).toBe("—");
    expect(sinal(undefined)).toBe("—");
    expect(sinal(Number.NaN)).toBe("—");
  });
});

describe("sinal1", () => {
  it("1 casa decimal com vírgula e sinal tipográfico", () => {
    expect(sinal1(3.14)).toBe("+3,1");
    expect(sinal1(-12.34)).toBe("−12,3");
    expect(sinal1(1234.5)).toBe("+1.234,5");
  });

  it("sem sinal quando o valor arredondado é 0,0 (TLM entre −0,05 e 0,05)", () => {
    expect(sinal1(0)).toBe("0,0");
    expect(sinal1(0.04)).toBe("0,0");
    expect(sinal1(-0.04)).toBe("0,0");
  });

  it("mantém o sinal em 0,1 e −0,1", () => {
    expect(sinal1(0.1)).toBe("+0,1");
    expect(sinal1(-0.1)).toBe("−0,1");
  });

  it("null/undefined/não finito viram travessão", () => {
    expect(sinal1(null)).toBe("—");
    expect(sinal1(undefined)).toBe("—");
    expect(sinal1(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("ic95", () => {
  it("sem erro-padrão (0, nulo, não finito): travessão", () => {
    expect(ic95(1000, 0)).toBe("—");
    expect(ic95(1000, null)).toBe("—");
    expect(ic95(1000, undefined)).toBe("—");
    expect(ic95(1000, Number.NaN)).toBe("—");
  });

  it("valor ± 1,96·se, arredondado", () => {
    expect(ic95(1000, 100)).toBe("804 a 1.196");
  });

  it("contagem: o limite inferior negativo é truncado em 0", () => {
    // 100 − 1,96·80 = −56,8 -> 0
    expect(ic95(100, 80)).toBe("0 a 257");
    expect(ic95(0, 10)).toBe("0 a 20");
  });

  it("saldo (contagem = false): mantém o limite negativo, com o sinal tipográfico", () => {
    expect(ic95(100, 80, false)).toBe("−57 a 257");
    expect(ic95(-500, 100, false)).toBe("−696 a −304");
  });
});

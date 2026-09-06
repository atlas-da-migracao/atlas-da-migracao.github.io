import { describe, expect, it } from "vitest";
import { corDivergente, quebrasSimetricas, DIVERGENTE } from "../escalas";
import { ic95, sinal } from "../format";

describe("quebrasSimetricas", () => {
  it("devolve três quebras crescentes e positivas", () => {
    const q = quebrasSimetricas([-100, -50, -10, 0, 10, 50, 100, 500, 1000]);
    expect(q).toHaveLength(3);
    expect(q[0]).toBeLessThan(q[1]);
    expect(q[1]).toBeLessThan(q[2]);
    expect(q[0]).toBeGreaterThan(0);
  });

  it("não quebra com lista vazia ou só zeros", () => {
    expect(quebrasSimetricas([])).toHaveLength(3);
    expect(quebrasSimetricas([0, 0, 0])).toHaveLength(3);
  });
});

describe("corDivergente", () => {
  const q = [100, 500, 2000];

  it("é simétrica: ganho e perda de mesma magnitude têm a mesma intensidade", () => {
    const nivelGanho = DIVERGENTE.claro.pos.findIndex(
      (c) => c.join() === corDivergente(800, q, false).join());
    const nivelPerda = DIVERGENTE.claro.neg.findIndex(
      (c) => c.join() === corDivergente(-800, q, false).join());
    expect(nivelGanho).toBe(nivelPerda);
    expect(nivelGanho).toBeGreaterThanOrEqual(0);
  });

  it("usa o cinza neutro perto de zero", () => {
    expect(corDivergente(50, q, false)).toEqual(DIVERGENTE.claro.zero);
    expect(corDivergente(-50, q, false)).toEqual(DIVERGENTE.claro.zero);
    expect(corDivergente(null, q, false)).toEqual(DIVERGENTE.claro.zero);
  });

  it("distingue ganho de perda", () => {
    expect(corDivergente(3000, q, false)).toEqual(DIVERGENTE.claro.pos[2]);
    expect(corDivergente(-3000, q, false)).toEqual(DIVERGENTE.claro.neg[2]);
  });

  it("tem paleta própria para o modo escuro", () => {
    expect(corDivergente(3000, q, true)).toEqual(DIVERGENTE.escuro.pos[2]);
    expect(corDivergente(3000, q, true)).not.toEqual(corDivergente(3000, q, false));
  });
});

describe("formatação", () => {
  it("mostra o sinal do saldo com o menos tipográfico", () => {
    expect(sinal(1234)).toBe("+1.234");
    expect(sinal(-1234)).toBe("−1.234");
    expect(sinal(0)).toBe("0");
    expect(sinal(null)).toBe("—");
  });

  it("calcula o intervalo de confiança de 95%", () => {
    expect(ic95(1000, 0)).toBe("—");
    expect(ic95(1000, 100)).toBe("804 a 1.196");   // 1000 ± 1,96 × 100
  });
});

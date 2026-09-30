import { describe, expect, it } from "vitest";
import { prepararPerfil } from "../perfil";
import { DIMENSOES, DIMENSOES_PENDULAR } from "../paletas";

describe("prepararPerfil", () => {
  it("setor pendular: a massa `outros` (suprimida) entra no denominador", () => {
    const cats = DIMENSOES_PENDULAR.setor.categorias;
    const serie = { valores: { industria: 50, comercio: 30, outros: 20 } };
    const p = prepararPerfil(cats, [serie]);
    expect(p.total(serie)).toBe(100);
    const industria = p.usadas.find((c) => c.chave === "industria")!;
    // 50% do total, e não 62,5% (50 / 80) como quando `outros` era descartado
    expect(p.valor(serie, industria) / p.total(serie)).toBeCloseTo(0.5);
    expect(p.usadas.map((c) => c.chave)).toContain("outros");
  });

  it("modo de transporte 2022: `outros` aparece com rótulo que admite a supressão", () => {
    const cats = DIMENSOES_PENDULAR.modo.categorias;
    const serie = { valores: { automovel_taxi: 60, outros: 40 } };
    const p = prepararPerfil(cats, [serie]);
    const outros = p.usadas.find((c) => c.chave === "outros")!;
    expect(outros.rotulo).toMatch(/suprimido/i);
    expect(p.total(serie)).toBe(100);
  });

  it("toda dimensão pendular (exceto ocupação, que agrupa em `mal_definidas`) declara `outros`", () => {
    for (const [nome, dim] of Object.entries(DIMENSOES_PENDULAR)) {
      if (nome === "ocupacao") continue;
      expect(dim.categorias.some((c) => c.chave === "outros"), `dimensão ${nome}`).toBe(true);
    }
  });

  it("chave fora da paleta cai no residual (acrescentado quando a paleta não tem `outros`)", () => {
    const cats = DIMENSOES_PENDULAR.ocupacao.categorias; // não declara `outros`
    const serie = { valores: { elementares: 70, categoria_nova: 30 } };
    const p = prepararPerfil(cats, [serie]);
    expect(p.total(serie)).toBe(100);
    const outros = p.usadas.find((c) => c.chave === "outros")!;
    expect(p.valor(serie, outros)).toBe(30);
  });

  it("chave fora da paleta soma ao `outros` da paleta quando ele existe", () => {
    const serie = { valores: { retorno_natal: 40, outros: 10, categoria_nova: 50 } };
    const p = prepararPerfil(DIMENSOES.status.categorias, [serie]);
    const outros = p.usadas.find((c) => c.chave === "outros")!;
    expect(p.valor(serie, outros)).toBe(60);
    expect(p.total(serie)).toBe(100);
  });

  it("série vazia tem total 0 e categoria sem valor em nenhuma série não entra em `usadas`", () => {
    const vazia = { valores: {} };
    const cheia = { valores: { industria: 10 } };
    const p = prepararPerfil(DIMENSOES_PENDULAR.setor.categorias, [vazia, cheia]);
    expect(p.total(vazia)).toBe(0);
    expect(p.usadas.map((c) => c.chave)).toEqual(["industria"]);
  });
});

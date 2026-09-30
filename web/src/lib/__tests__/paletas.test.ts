import { describe, expect, it } from "vitest";
import { DIMENSOES, DIMENSOES_PENDULAR, separarRecorte } from "../paletas";

describe("separarRecorte", () => {
  it("divide dimensao__categoria", () => {
    expect(separarRecorte("edu__superior_completo")).toEqual({ dim: "edu", cat: "superior_completo" });
    expect(separarRecorte("status__retorno_natal")).toEqual({ dim: "status", cat: "retorno_natal" });
    expect(separarRecorte("renda__de_1_4_a_1_2_sm")).toEqual({ dim: "renda", cat: "de_1_4_a_1_2_sm" });
  });

  it("divide só no primeiro __", () => {
    expect(separarRecorte("a__b__c")).toEqual({ dim: "a", cat: "b__c" });
  });

  it("sem __ devolve a categoria vazia", () => {
    expect(separarRecorte("edu")).toEqual({ dim: "edu", cat: "" });
  });
});

describe("cores das paletas de perfil", () => {
  const todas = [
    ...Object.entries(DIMENSOES).map(([n, d]) => [`DIMENSOES.${n}`, d.categorias] as const),
    ...Object.entries(DIMENSOES_PENDULAR).map(([n, d]) => [`DIMENSOES_PENDULAR.${n}`, d.categorias] as const),
  ];

  it("`outros` tem cor própria: nenhuma outra categoria da mesma dimensão usa o mesmo cinza", () => {
    for (const [nome, cats] of todas) {
      const outros = cats.find((c) => c.chave === "outros");
      if (!outros) continue;
      for (const c of cats) {
        if (c.chave === "outros") continue;
        expect(c.cor.claro, `${nome}: ${c.chave} x outros (claro)`).not.toBe(outros.cor.claro);
        expect(c.cor.escuro, `${nome}: ${c.chave} x outros (escuro)`).not.toBe(outros.cor.escuro);
      }
    }
  });

  it("escolaridade: `nao_determinado` e `outros` têm cinzas diferentes", () => {
    const cats = DIMENSOES.edu.categorias;
    const nd = cats.find((c) => c.chave === "nao_determinado")!;
    const outros = cats.find((c) => c.chave === "outros")!;
    expect(nd.cor.claro).not.toBe(outros.cor.claro);
    expect(nd.cor.escuro).not.toBe(outros.cor.escuro);
  });

  it("nenhuma categoria de uma dimensão pendular repete a cor de outra (mesma dimensão)", () => {
    for (const [nome, cats] of todas.filter(([n]) => n.startsWith("DIMENSOES_PENDULAR"))) {
      const vistas = new Map<string, string>();
      for (const c of cats) {
        const k = `${c.cor.claro}|${c.cor.escuro}`;
        expect(vistas.has(k), `${nome}: ${c.chave} repete a cor de ${vistas.get(k)}`).toBe(false);
        vistas.set(k, c.chave);
      }
    }
  });
});

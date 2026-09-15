import { describe, expect, it } from "vitest";
import { basePath, CENSO_PADRAO, CENSOS, edicao, EDICOES } from "../edicoes";

describe("edicoes", () => {
  it("2022 é a edição padrão e fica na raiz de data/", () => {
    expect(CENSO_PADRAO).toBe("2022");
    expect(basePath("2022")).toBe("data/");
  });

  it("2010 fica em subpasta própria, com módulo metropolitano mas sem modo/tempoMinutos", () => {
    expect(basePath("2010")).toBe("data/2010/");
    expect(edicao("2010").recursos.rm).toBe(true);
    expect(edicao("2022").recursos.rm).toBe(true);
    expect(edicao("2010").recursos.modo).toBe(false);
    expect(edicao("2010").recursos.tempoMinutos).toBe(false);
  });

  it("vocabulário de tempo/frequência difere por edição (chaves de paletas.ts, não de dados)", () => {
    expect(edicao("2022").vocabulario).toEqual({ tempo: "tempo", frequencia: "frequencia" });
    expect(edicao("2010").vocabulario).toEqual({ tempo: "tempo2010", frequencia: "frequencia2010" });
  });

  it("rotuloRetorno muda de definição entre edições", () => {
    expect(edicao("2022").rotuloRetorno).toBe("Retorna 3+ dias/semana");
    expect(edicao("2010").rotuloRetorno).toBe("Retorna diariamente");
  });

  it("toda edição tem período de referência coerente (de < ate)", () => {
    for (const c of CENSOS) {
      const { de, ate } = edicao(c).periodo;
      expect(new Date(de).getTime()).toBeLessThan(new Date(ate).getTime());
    }
  });

  it("statusCategorias de 2010 não inclui primeira_saida/etapas_multiplas", () => {
    const cats = edicao("2010").statusCategorias;
    expect(cats).not.toContain("primeira_saida");
    expect(cats).not.toContain("etapas_multiplas");
    expect(cats).toContain("nao_natural");
  });

  it("EDICOES tem exatamente as chaves de CENSOS", () => {
    expect(Object.keys(EDICOES).sort()).toEqual([...CENSOS].sort());
  });

  it("1991 tem módulo metropolitano mas nenhum deslocamento pendular", () => {
    expect(edicao("1991").recursos.rm).toBe(true);
    expect(edicao("1991").recursos.pendular).toBe(false);
    expect(edicao("1991").recursos.modo).toBe(false);
    expect(edicao("1991").recursos.tempoMinutos).toBe(false);
    expect(edicao("1991").vocabulario).toEqual({});
    expect(edicao("1991").rotuloRetorno).toBeNull();
  });

  it("edições sem deslocamento pendular não publicam vocabulário de dimensão pendular", () => {
    // tempo/frequencia (paletas.ts) só existem como recorte de deslocamento pendular --
    // ver 07_pendular.sql; uma edição com recursos.pendular === false não deveria ter chave
    // nenhuma nesse vocabulário.
    for (const c of CENSOS) {
      if (!edicao(c).recursos.pendular) {
        expect(Object.keys(edicao(c).vocabulario)).toEqual([]);
      }
    }
  });
});

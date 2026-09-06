import { describe, expect, it } from "vitest";
import { contraste, corTextoLegivel } from "../contraste";
import { DIMENSOES, FAIXAS_IDADE, CATEGORICO_8 } from "../paletas";

describe("contraste / corTextoLegivel", () => {
  it("razão de contraste entre preto e branco é 21:1", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("escolhe branco para fundo escuro e preto para fundo claro", () => {
    expect(corTextoLegivel("#0d366b")).toBe("#ffffff");
    expect(corTextoLegivel("#f2c4b4")).toBe("#000000");
  });

  it("para toda cor de dado usada em BarraPerfil, a melhor escolha de texto passa 4.5:1 " +
     "(rótulos de segmento em cima da paleta categórica/sequencial, F6 leva 2)", () => {
    const cores = new Set<string>();
    for (const dim of Object.values(DIMENSOES)) {
      for (const c of dim.categorias) { cores.add(c.cor.claro); cores.add(c.cor.escuro); }
    }
    for (const f of FAIXAS_IDADE) { cores.add(f.cor.claro); cores.add(f.cor.escuro); }
    for (const c of CATEGORICO_8) { cores.add(c.claro); cores.add(c.escuro); }

    for (const fundo of cores) {
      const texto = corTextoLegivel(fundo);
      expect(contraste(fundo, texto), `fundo ${fundo} x texto ${texto}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/** Defeitos do texto de referência em português corrigidos na revisão do i18n (os tradutores
 *  já os contornavam em en/fr/es): travessão em vez de "--", listas de edições com "e",
 *  singular/plural, título do Bloco 1 e a nota de desenvolvimento que ia ao ar. */
import { describe, expect, it } from "vitest";
import { pt } from "../pt";

const s = pt.serie;

describe("texto PT de referência", () => {
  it('nenhum "--" literal no texto visível', () => {
    expect(pt.capa.recorteExplicacao).not.toContain("--");
    expect(pt.capa.achados.superior("75,1")).not.toContain("--");
    expect(pt.tour.passos.modoCensos.texto).not.toContain("--");
  });

  it("a nota do gráfico de Fielding não expõe nota de desenvolvimento", () => {
    for (const proxy of [false, true]) {
      const nota = pt.graficos.fielding.nota(proxy);
      expect(nota).not.toMatch(/data\/processed|fora de escopo|front/);
    }
  });

  it("título do Bloco 1 concorda com o nível", () => {
    expect(s.bloco1.titulo(pt.comum.niveis.mun.demonstrativo))
      .toBe("Bloco 1 · A migração neste município, censo a censo");
    expect(s.bloco1.titulo(pt.comum.niveis.uf.demonstrativo))
      .toBe("Bloco 1 · A migração nesta UF, censo a censo");
  });

  it('listas de edições com "e" e vírgula depois da lista', () => {
    expect(s.frase.coberturaInsuficiente(["1980"])).toMatch(/^Em 1980, menos de 90%/);
    expect(s.frase.coberturaInsuficiente(["1980", "1991"])).toMatch(/^Em 1980 e 1991, menos de 90%/);
    expect(s.frase.rmUnitaria(["1980", "1991", "2000"])).toMatch(/^Em 1980, 1991 e 2000, a região/);
  });

  it("singular e plural", () => {
    expect(pt.paineis.municipio.municipiosAgregados(1)).toBe("1 município agregado");
    expect(pt.paineis.municipio.municipiosAgregados(3)).toBe("3 municípios agregados");
    expect(s.bloco3.foraDaLista(1, "1")).toContain("parceiro que já esteve");
    expect(s.bloco3.foraDaLista(3, "3")).toContain("parceiros que já estiveram");
    expect(pt.mapa.fluxoClique("1", 1)).toMatch(/^1 pessoa ·/);
  });
});

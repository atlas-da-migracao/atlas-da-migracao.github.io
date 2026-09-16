import { describe, it, expect } from "vitest";
import {
  BASE_ESPIGA_PX, TETO_ESPIGA_PX, alturaEspigaPx, metrosPorPixel, poligonoEspiga,
  fatorAlturaPorZoom, ZOOM_REFERENCIA_ESPIGA,
} from "../espigas";

describe("escala em pixels das espigas (metrosPorPixel)", () => {
  it("zoom 0 (log2(1)): 1 px de tela = 1 metro de mundo", () => {
    expect(metrosPorPixel(0)).toBeCloseTo(1, 10);
  });

  it("zoom positivo (mais perto): 1 px cobre menos metros", () => {
    expect(metrosPorPixel(4)).toBeCloseTo(1 / 16, 10);
  });

  it("zoom negativo (vista Brasil, mais longe): 1 px cobre mais metros", () => {
    expect(metrosPorPixel(-10)).toBeCloseTo(1024, 6);
  });
});

describe("altura da espiga (alturaEspigaPx)", () => {
  it("o maior |valor| da métrica sempre bate no teto", () => {
    expect(alturaEspigaPx(479_395, 479_395)).toBeCloseTo(TETO_ESPIGA_PX, 10);
  });

  it("cresce com a raiz quadrada do valor, não linearmente", () => {
    // um quarto do maior valor -> metade da altura (√(1/4) = 1/2)
    expect(alturaEspigaPx(479_395 / 4, 479_395)).toBeCloseTo(TETO_ESPIGA_PX / 2, 6);
  });

  it("valor 0 dá altura 0", () => {
    expect(alturaEspigaPx(0, 479_395)).toBe(0);
  });

  it("usa só a magnitude -- saldo negativo tem a mesma altura que o positivo equivalente", () => {
    expect(alturaEspigaPx(-100_000, 400_000)).toBeCloseTo(alturaEspigaPx(100_000, 400_000), 10);
  });

  it("sem âncora (maiorAbsoluto <= 0) ou entrada não finita: 0, nunca NaN/Infinity", () => {
    expect(alturaEspigaPx(1_000, 0)).toBe(0);
    expect(alturaEspigaPx(1_000, -5)).toBe(0);
    expect(alturaEspigaPx(Number.NaN, 1_000)).toBe(0);
  });

  it("respeita o teto explícito passado pelo chamador", () => {
    expect(alturaEspigaPx(1_000, 1_000, 60)).toBeCloseTo(60, 10);
  });
});

describe("polígono da espiga (poligonoEspiga)", () => {
  it("a base tem sempre BASE_ESPIGA_PX de largura EM PIXELS, convertida para metros do zoom", () => {
    const zoom = 3; // 1 px = 1/8 m
    const [p1, p2] = poligonoEspiga(0, 0, 50, zoom, 1);
    const larguraMetros = p2[0] - p1[0];
    expect(larguraMetros).toBeCloseTo(BASE_ESPIGA_PX * metrosPorPixel(zoom), 10);
  });

  it("a base fica centrada no centroide e no mesmo y do centroide", () => {
    const [p1, p2] = poligonoEspiga(1_000, 2_000, 40, 0, 1);
    expect(p1[1]).toBe(2_000);
    expect(p2[1]).toBe(2_000);
    expect((p1[0] + p2[0]) / 2).toBeCloseTo(1_000, 10);
  });

  it("direção 1 (ganho/entrada): o ápice fica ACIMA do centroide (y maior)", () => {
    const [, , apice] = poligonoEspiga(0, 0, 50, 0, 1);
    expect(apice[1]).toBeGreaterThan(0);
  });

  it("direção -1 (perda): o ápice fica ABAIXO do centroide (y menor) -- espiga bipolar", () => {
    const [, , apice] = poligonoEspiga(0, 0, 50, 0, -1);
    expect(apice[1]).toBeLessThan(0);
  });

  it("mesma altura em pixels, ganho e perda têm o mesmo comprimento em metros (só o sinal muda)", () => {
    const [, , apiceGanho] = poligonoEspiga(0, 0, 50, 2, 1);
    const [, , apicePerda] = poligonoEspiga(0, 0, 50, 2, -1);
    expect(apiceGanho[1]).toBeCloseTo(-apicePerda[1], 10);
  });

  it("altura 0 (sem dado publicado) dá um triângulo degenerado no centroide, não um erro", () => {
    const [, , apice] = poligonoEspiga(500, 500, 0, 1, 1);
    expect(apice).toEqual([500, 500]);
  });

  it("o vão em metros cresce quando o zoom se afasta (metrosPorPixel maior)", () => {
    const [, , apicePerto] = poligonoEspiga(0, 0, 100, 4, 1);
    const [, , apiceLonge] = poligonoEspiga(0, 0, 100, -4, 1);
    expect(apiceLonge[1]).toBeGreaterThan(apicePerto[1]);
  });
});

describe("fatorAlturaPorZoom -- espigas crescem em pixels ao aproximar", () => {
  it("é 1 (sem crescimento) na vista Brasil e mais afastado", () => {
    expect(fatorAlturaPorZoom(ZOOM_REFERENCIA_ESPIGA)).toBe(1);
    expect(fatorAlturaPorZoom(ZOOM_REFERENCIA_ESPIGA - 3)).toBe(1);
  });

  it("cresce monotonicamente ao aproximar (zoom maior)", () => {
    const a = fatorAlturaPorZoom(ZOOM_REFERENCIA_ESPIGA + 1);
    const b = fatorAlturaPorZoom(ZOOM_REFERENCIA_ESPIGA + 3);
    const c = fatorAlturaPorZoom(ZOOM_REFERENCIA_ESPIGA + 6);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("tem um teto -- não cresce sem limite num zoom extremo (município sozinho na tela)", () => {
    expect(fatorAlturaPorZoom(ZOOM_REFERENCIA_ESPIGA + 30)).toBeLessThanOrEqual(6);
  });

  it("zoom não finito cai de volta a 1 (sem crescimento), nunca quebra", () => {
    expect(fatorAlturaPorZoom(Number.NaN)).toBe(1);
    expect(fatorAlturaPorZoom(Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(6);
  });

  it("aplicado em alturaEspigaPx, aumenta a altura final proporcionalmente", () => {
    const semZoom = alturaEspigaPx(300, 1000, 120, 1);
    const comZoom = alturaEspigaPx(300, 1000, 120, fatorAlturaPorZoom(ZOOM_REFERENCIA_ESPIGA + 4));
    expect(comZoom).toBeGreaterThan(semZoom);
  });
});

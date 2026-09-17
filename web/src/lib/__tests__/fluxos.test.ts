import { describe, it, expect } from "vitest";
import {
  poligonoFluxo, pontosCurva, N_AMOSTRAS_CURVA, RAIO_NO_PX, COMPRIMENTO_SETA_FLUXO_PX,
  FRACAO_LARGURA_FINAL,
} from "../fluxos";

const MPP = 2; // metros por pixel, zoom qualquer

describe("poligonoFluxo", () => {
  it("origem == destino (vão degenerado) devolve null, não um erro/NaN", () => {
    expect(poligonoFluxo(500, 500, 500, 500, 6, MPP)).toBeNull();
  });

  it("devolve um polígono fechado com a contagem de vértices esperada (2N + 3)", () => {
    const poli = poligonoFluxo(0, 0, 100_000, 0, 6, MPP)!;
    expect(poli).not.toBeNull();
    expect(poli.length).toBe(2 * N_AMOSTRAS_CURVA + 3);
    // todo vértice é um par de números finitos
    for (const [x, y] of poli) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it("a ponta da seta fica a RAIO_NO_PX (em metros) do destino, eixo X puro", () => {
    const poli = poligonoFluxo(0, 0, 100_000, 0, 6, MPP)!;
    const ponta = poli[N_AMOSTRAS_CURVA + 1]; // esquerda(N) + baseEsquerda(1) -> ponta
    const dist = Math.hypot(100_000 - ponta[0], 0 - ponta[1]);
    // a busca por comprimento de arco é por amostragem fina (RESOLUCAO_COMPRIMENTO), não uma
    // forma fechada -- tolerância de 1% cobre o erro de discretização sem mascarar um erro de
    // geometria (que seria bem maior que isso).
    expect(dist).toBeCloseTo(RAIO_NO_PX * MPP, 0);
    expect(Math.abs(dist - RAIO_NO_PX * MPP) / (RAIO_NO_PX * MPP)).toBeLessThan(0.01);
  });

  it("a ponta da seta fica a RAIO_NO_PX (em metros) do destino, eixo Y puro", () => {
    const poli = poligonoFluxo(0, 0, 0, 100_000, 6, MPP)!;
    const ponta = poli[N_AMOSTRAS_CURVA + 1];
    const dist = Math.hypot(0 - ponta[0], 100_000 - ponta[1]);
    expect(Math.abs(dist - RAIO_NO_PX * MPP) / (RAIO_NO_PX * MPP)).toBeLessThan(0.01);
  });

  it("a seta aponta para o destino (eixo X): a ponta fica mais perto do destino que a base", () => {
    const poli = poligonoFluxo(0, 0, 100_000, 0, 6, MPP)!;
    const baseEsquerda = poli[N_AMOSTRAS_CURVA];
    const baseDireita = poli[N_AMOSTRAS_CURVA + 2];
    const ponta = poli[N_AMOSTRAS_CURVA + 1];
    const distPontaDestino = Math.hypot(100_000 - ponta[0], 0 - ponta[1]);
    const distBaseEsqDestino = Math.hypot(100_000 - baseEsquerda[0], 0 - baseEsquerda[1]);
    const distBaseDirDestino = Math.hypot(100_000 - baseDireita[0], 0 - baseDireita[1]);
    expect(distPontaDestino).toBeLessThan(distBaseEsqDestino);
    expect(distPontaDestino).toBeLessThan(distBaseDirDestino);
  });

  it("a seta aponta para o destino (eixo Y): a ponta fica mais perto do destino que a base", () => {
    const poli = poligonoFluxo(0, 0, 0, 100_000, 6, MPP)!;
    const baseEsquerda = poli[N_AMOSTRAS_CURVA];
    const baseDireita = poli[N_AMOSTRAS_CURVA + 2];
    const ponta = poli[N_AMOSTRAS_CURVA + 1];
    const distPontaDestino = Math.hypot(0 - ponta[0], 100_000 - ponta[1]);
    const distBaseEsqDestino = Math.hypot(0 - baseEsquerda[0], 100_000 - baseEsquerda[1]);
    const distBaseDirDestino = Math.hypot(0 - baseDireita[0], 100_000 - baseDireita[1]);
    expect(distPontaDestino).toBeLessThan(distBaseEsqDestino);
    expect(distPontaDestino).toBeLessThan(distBaseDirDestino);
  });

  it("afunila de forma monotônica: a largura da fita (esquerda-direita) nunca cresce ao longo do trecho amostrado", () => {
    const poli = poligonoFluxo(0, 0, 300_000, 0, 10, MPP)!;
    const larguras: number[] = [];
    for (let i = 0; i < N_AMOSTRAS_CURVA; i++) {
      const esq = poli[i];
      const dir = poli[2 * N_AMOSTRAS_CURVA + 2 - i]; // índice espelhado do lado direito
      larguras.push(Math.hypot(esq[0] - dir[0], esq[1] - dir[1]));
    }
    for (let i = 1; i < larguras.length; i++) {
      expect(larguras[i]).toBeLessThanOrEqual(larguras[i - 1] + 1e-9);
    }
    // e de fato afina (não fica constante) -- a fração final é < 1
    expect(larguras[larguras.length - 1]).toBeLessThan(larguras[0]);
    expect(FRACAO_LARGURA_FINAL).toBeLessThan(1);
  });

  it("largura na origem é a largura cheia pedida (larguraPx), convertida para metros", () => {
    const larguraPx = 8;
    const poli = poligonoFluxo(0, 0, 200_000, 0, larguraPx, MPP)!;
    const esq0 = poli[0];
    const dir0 = poli[2 * N_AMOSTRAS_CURVA + 2]; // último índice = espelho de i=0
    const largura = Math.hypot(esq0[0] - dir0[0], esq0[1] - dir0[1]);
    expect(largura).toBeCloseTo(larguraPx * MPP, 3);
  });

  it("tamanho em pixels constante em qualquer zoom: dobrar metrosPorPixelAtual dobra as medidas em metros", () => {
    const poliA = poligonoFluxo(0, 0, 100_000, 0, 6, 1)!;
    const poliB = poligonoFluxo(0, 0, 100_000, 0, 6, 2)!;
    // distância da ponta ao destino (raio do nó, em metros) dobra
    const pontaA = poliA[N_AMOSTRAS_CURVA + 1], pontaB = poliB[N_AMOSTRAS_CURVA + 1];
    const distA = Math.hypot(100_000 - pontaA[0], 0 - pontaA[1]);
    const distB = Math.hypot(100_000 - pontaB[0], 0 - pontaB[1]);
    expect(distB / distA).toBeCloseTo(2, 1);
    // largura na origem dobra
    const largA = Math.hypot(poliA[0][0] - poliA[2 * N_AMOSTRAS_CURVA + 2][0], poliA[0][1] - poliA[2 * N_AMOSTRAS_CURVA + 2][1]);
    const largB = Math.hypot(poliB[0][0] - poliB[2 * N_AMOSTRAS_CURVA + 2][0], poliB[0][1] - poliB[2 * N_AMOSTRAS_CURVA + 2][1]);
    expect(largB / largA).toBeCloseTo(2, 1);
  });

  it("a curva não colapsa na corda reta (mesma convenção de flecha de lib/arcos.ts)", () => {
    const pontos = pontosCurva([0, 0], [50_000, 15_000], [100_000, 0], 5);
    // ponto médio (t=0.5) não deve estar sobre y=0 (a corda, no eixo X puro)
    const meio = pontos[Math.floor(pontos.length / 2)];
    expect(Math.abs(meio[1])).toBeGreaterThan(0);
  });

  it("respeita o comprimento da seta: a distância entre ponta e base da seta é ~COMPRIMENTO_SETA_FLUXO_PX em metros", () => {
    const poli = poligonoFluxo(0, 0, 100_000, 0, 6, MPP)!;
    const baseEsquerda = poli[N_AMOSTRAS_CURVA];
    const ponta = poli[N_AMOSTRAS_CURVA + 1];
    // aproximação: como o fluxo é reto (eixo X), a distância ao longo do eixo X entre a base
    // e a ponta deve ficar perto do comprimento nominal da seta (a curvatura é desprezível
    // nesse trecho curto perto do destino).
    const dx = Math.abs(ponta[0] - baseEsquerda[0]);
    expect(dx).toBeGreaterThan(COMPRIMENTO_SETA_FLUXO_PX * MPP * 0.5);
  });

  describe("fluxo curto em zoom distante (regressão: cunhas gigantes ao selecionar uma RM)", () => {
    // Relato do usuário: ao selecionar uma RM, os fluxos intra-metropolitanos apareciam como
    // cunhas cinzentas enormes e só ficavam certos depois de recarregar a página. Causa: os
    // fluxos chegam enquanto a vista ainda está no zoom NACIONAL, onde a seta (15px) e a fita
    // (6px), fixas em pixels, valem 106 km e 43 km -- muito mais que os 10-20 km do próprio
    // fluxo. Medido antes da correção: um fluxo de 15 km virava um polígono de 24x67 km.
    // Invariante que fecha o caso: o polígono nunca é maior que o próprio vão que representa,
    // em nenhum zoom -- assim nenhuma ordem de chegada dos dados produz a cunha.
    const casos: Array<[string, number, number]> = [
      ["zoom da RM (o caso normal)", 15_000, 200],
      ["zoom nacional (a corrida que causou o relato)", 15_000, 7_100],
      ["fluxo muito curto em zoom nacional", 6_000, 7_100],
      ["fluxo longo em zoom nacional (não deve mudar)", 900_000, 7_100],
    ];
    for (const [nome, vao, mpp] of casos) {
      it(`cabe no próprio vão -- ${nome}`, () => {
        const poli = poligonoFluxo(0, 0, vao, vao / 5, 6, mpp)!;
        const xs = poli.map((p) => p[0]);
        const ys = poli.map((p) => p[1]);
        const diagonal = Math.hypot(
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        );
        // 1,15 dá folga para a flecha da curva (que legitimamente sai da corda) sem admitir
        // nada perto do 4,7x que a cunha do relato alcançava.
        expect(diagonal).toBeLessThan(1.15 * Math.hypot(vao, vao / 5));
      });
    }
  });
});

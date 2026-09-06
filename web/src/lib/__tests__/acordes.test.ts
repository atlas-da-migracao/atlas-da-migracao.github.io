import { describe, expect, it } from "vitest";
import { prepararMatrizAcordes } from "../acordes";

const UNIDADES = [
  { codigo: "35", nome: "São Paulo", uf_sigla: "SP" },   // Sudeste
  { codigo: "33", nome: "Rio de Janeiro", uf_sigla: "RJ" }, // Sudeste
  { codigo: "11", nome: "Rondônia", uf_sigla: "RO" },     // Norte
];

describe("prepararMatrizAcordes", () => {
  it("ordena por região (Norte antes de Sudeste) e por sigla dentro da região", () => {
    const d = prepararMatrizAcordes([], UNIDADES);
    expect(d.codigos).toEqual(["11", "33", "35"]); // RO (Norte), depois RJ, SP (Sudeste, alfabético)
    expect(d.siglas).toEqual(["RO", "RJ", "SP"]);
  });

  it("preenche a matriz na posição [origem][destino] e ignora a diagonal", () => {
    const d = prepararMatrizAcordes(
      [
        { origem: "35", destino: "33", total: 100 },
        { origem: "33", destino: "35", total: 40 },
        { origem: "35", destino: "35", total: 999 }, // diagonal: deve ser ignorada
      ],
      UNIDADES,
    );
    const iRJ = d.codigos.indexOf("33");
    const iSP = d.codigos.indexOf("35");
    expect(d.matriz[iSP][iRJ]).toBe(100);
    expect(d.matriz[iRJ][iSP]).toBe(40);
    expect(d.matriz[iSP][iSP]).toBe(0);
  });

  it("soma fluxos repetidos para o mesmo par e ignora UFs desconhecidas", () => {
    const d = prepararMatrizAcordes(
      [
        { origem: "35", destino: "11", total: 10 },
        { origem: "35", destino: "11", total: 5 },
        { origem: "35", destino: "99", total: 1000 }, // UF fora da lista: ignorada
      ],
      UNIDADES,
    );
    const iSP = d.codigos.indexOf("35");
    const iRO = d.codigos.indexOf("11");
    expect(d.matriz[iSP][iRO]).toBe(15);
    expect(d.matriz.flat().reduce((a, b) => a + b, 0)).toBe(15);
  });

  it("regiaoIdx acompanha a ordem de codigos", () => {
    const d = prepararMatrizAcordes([], UNIDADES);
    // RO é Norte (índice 0 em REGIAO_ORDEM), RJ e SP são Sudeste (índice 2)
    expect(d.regiaoIdx[d.codigos.indexOf("11")]).toBe(0);
    expect(d.regiaoIdx[d.codigos.indexOf("33")]).toBe(2);
    expect(d.regiaoIdx[d.codigos.indexOf("35")]).toBe(2);
  });
});

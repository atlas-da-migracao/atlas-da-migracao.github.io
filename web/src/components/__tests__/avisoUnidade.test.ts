/** `unidadeAgregada` é o predicado que o painel usa para decidir se a unidade selecionada é um
 *  município comum ou uma UNIDADE AGREGADA da edição (hoje só 'NORTEGO' no Censo 1980 -- ver
 *  pipeline/unidades_agregadas_1980.py). O que se testa aqui é justamente o que não pode
 *  regredir: o componente não conhece nenhum código, e uma edição sem a chave em meta.json
 *  (todas menos 1980) nunca mostra o aviso. */
import { describe, expect, it } from "vitest";
import { unidadeAgregada } from "../AvisoUnidade";
import type { Meta, UnidadeAgregadaMeta } from "../../lib/types";

const NORTEGO: UnidadeAgregadaMeta = {
  codigo: "NORTEGO",
  nome: "Norte de Goiás (atual Tocantins)",
  nome_curto: "Norte de Goiás",
  n_municipios: 52,
  uf: "17",
  uf_censo: "52",
  nota: "Não é um município: é a agregação dos 52 municípios do norte de Goiás.",
};
const meta = (unidades?: UnidadeAgregadaMeta[]) =>
  ({ unidades_agregadas: unidades } as unknown as Meta);

describe("unidadeAgregada", () => {
  it("reconhece a unidade agregada declarada em meta.json", () => {
    const u = unidadeAgregada(meta([NORTEGO]), "NORTEGO");
    expect(u?.n_municipios).toBe(52);
    expect(u?.nota).toContain("Não é um município");
  });

  it("não marca um município comum", () => {
    expect(unidadeAgregada(meta([NORTEGO]), "5208707")).toBeNull();
  });

  it("é inerte nas edições sem unidades agregadas e antes do meta.json chegar", () => {
    expect(unidadeAgregada(meta(undefined), "NORTEGO")).toBeNull();
    expect(unidadeAgregada(null, "NORTEGO")).toBeNull();
    expect(unidadeAgregada(meta([NORTEGO]), null)).toBeNull();
  });
});

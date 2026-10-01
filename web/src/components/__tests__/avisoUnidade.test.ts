/** `unidadeAgregada` é o predicado genérico que o painel usa para decidir se a unidade
 *  selecionada é um município comum ou uma UNIDADE AGREGADA da edição (código não numérico que
 *  reúne vários municípios). Nenhuma edição declara uma desde 1.1.0-1980 -- o mecanismo segue
 *  inativo, e é isso que se testa aqui, com uma fixture sintética: o componente não conhece
 *  nenhum código, e uma edição sem a chave em meta.json (todas) nunca mostra o aviso.
 *
 *  `ufForaDaEpoca` / `AvisoUnidadeUf` são o aviso do nível "uf" (Tocantins em 1980, publicado
 *  sob o código de hoje: `meta.ufs_fora_da_epoca`). */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AvisoUnidade, AvisoUnidadeUf, unidadeAgregada, ufForaDaEpoca,
} from "../AvisoUnidade";
import type { Meta, UfForaDaEpocaMeta, UnidadeAgregadaMeta } from "../../lib/types";

/** Unidade agregada sintética (não é nenhum território real): só exercita o mecanismo genérico. */
const AGREG01: UnidadeAgregadaMeta = {
  codigo: "AGREG01",
  nome: "Território sintético de teste",
  nome_curto: "Sintético",
  n_municipios: 3,
  uf: "99",
  nota: "Reúne 3 municípios do censo, publicados como uma unidade só.",
};
const meta = (unidades?: UnidadeAgregadaMeta[]) =>
  ({ unidades_agregadas: unidades } as unknown as Meta);

describe("unidadeAgregada", () => {
  it("reconhece a unidade agregada declarada em meta.json", () => {
    const u = unidadeAgregada(meta([AGREG01]), "AGREG01");
    expect(u?.n_municipios).toBe(3);
    expect(u?.nota).toContain("Reúne 3 municípios");
  });

  it("não marca um município comum", () => {
    expect(unidadeAgregada(meta([AGREG01]), "5208707")).toBeNull();
  });

  it("é inerte nas edições sem unidades agregadas e antes do meta.json chegar", () => {
    expect(unidadeAgregada(meta(undefined), "AGREG01")).toBeNull();
    expect(unidadeAgregada(null, "AGREG01")).toBeNull();
    expect(unidadeAgregada(meta([AGREG01]), null)).toBeNull();
  });
});

describe("AvisoUnidade (renderização)", () => {
  it("escreve o rótulo em negrito uma vez só, seguido da nota da unidade -- sem repeti-la", () => {
    const html = renderToStaticMarkup(
      createElement(AvisoUnidade, { meta: meta([AGREG01]), codigo: "AGREG01" }),
    );
    expect(html).toContain("<strong>Não é um município.</strong>");
    expect(html).toContain(AGREG01.nota);
    // o rótulo fixo do componente e a nota vêm de fontes distintas: a frase não sai duplicada
    expect(html.match(/Não é um município/g)).toHaveLength(1);
    expect(html.match(/Reúne 3 municípios/g)).toHaveLength(1);
  });

  it("não renderiza nada para um município comum nem sem a chave no meta", () => {
    expect(renderToStaticMarkup(
      createElement(AvisoUnidade, { meta: meta([AGREG01]), codigo: "5208707" }))).toBe("");
    expect(renderToStaticMarkup(
      createElement(AvisoUnidade, { meta: meta(undefined), codigo: "AGREG01" }))).toBe("");
  });
});

/** Tocantins em 1980: mesma forma do que `pipeline/build_meta.py` emite em `ufs_fora_da_epoca`
 *  (texto sintetizado aqui, não o do meta.json real). */
const TO_1980: UfForaDaEpocaMeta = {
  uf: "17",
  uf_sigla: "TO",
  uf_censo: "52",
  uf_censo_sigla: "GO",
  n_municipios: 52,
  nota: "O Tocantins foi criado em 1988. Em 1980 este território eram 52 municípios do norte de "
    + "Goiás, publicados aqui sob o código de UF de hoje.",
};
const metaUf = (ufs?: UfForaDaEpocaMeta[]) =>
  ({ ufs_fora_da_epoca: ufs } as unknown as Meta);

/** O nível "uf" do mapa de 1980 mostrava "Tocantins" com números normais, sem nenhum aviso de
 *  que o Tocantins não existia como estado em 1980 -- achado do usuário, que este aviso cobre. */
describe("ufForaDaEpoca", () => {
  it("reconhece a UF publicada que não existia na época do censo", () => {
    const u = ufForaDaEpoca(metaUf([TO_1980]), "17");
    expect(u?.uf_censo_sigla).toBe("GO");
    expect(u?.n_municipios).toBe(52);
  });

  it("não marca uma UF de verdade da época", () => {
    expect(ufForaDaEpoca(metaUf([TO_1980]), "35")).toBeNull();
    expect(ufForaDaEpoca(metaUf([TO_1980]), "52")).toBeNull();
  });

  it("é inerte nas edições sem a chave e antes do meta.json chegar", () => {
    expect(ufForaDaEpoca(metaUf(undefined), "17")).toBeNull();
    expect(ufForaDaEpoca(metaUf([]), "17")).toBeNull();
    expect(ufForaDaEpoca(null, "17")).toBeNull();
    expect(ufForaDaEpoca(metaUf([TO_1980]), null)).toBeNull();
  });

  it("não lê `unidades_agregadas`: uma unidade agregada com `uf` igual não dispara o aviso de UF", () => {
    const so = { unidades_agregadas: [{ ...AGREG01, uf: "17", uf_censo: "52" }] } as unknown as Meta;
    expect(ufForaDaEpoca(so, "17")).toBeNull();
  });
});

describe("AvisoUnidadeUf (renderização)", () => {
  it("abre com o rótulo em negrito e traz a nota do meta, sem texto fixo sobre agregação", () => {
    const html = renderToStaticMarkup(
      createElement(AvisoUnidadeUf, { meta: metaUf([TO_1980]), codigoUf: "17" }),
    );
    expect(html).toContain("<strong>Esta UF não existia na época do censo.</strong>");
    expect(html).toContain("O Tocantins foi criado em 1988.");
    expect(html.match(/Esta UF não existia/g)).toHaveLength(1);
    expect(html).not.toContain("unidade agregada");
    expect(html).not.toContain("não distingue");
  });

  it("não renderiza nada para uma UF da época nem sem a chave no meta", () => {
    expect(renderToStaticMarkup(
      createElement(AvisoUnidadeUf, { meta: metaUf([TO_1980]), codigoUf: "35" }))).toBe("");
    expect(renderToStaticMarkup(
      createElement(AvisoUnidadeUf, { meta: metaUf(undefined), codigoUf: "17" }))).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import {
  lerUrl, montarQuery, lerUnidadeSerie, lerEdicoesSerie,
  type EstadoUrl,
} from "../url";
import { CENSO_PADRAO } from "../../lib/edicoes";
import { EDICOES_SERIE } from "../../lib/serie";

/** Helper para criar um EstadoUrl padrão com overrides, semelhante ao padrão do mapa. */
const estadoPadrao = (overrides?: Partial<EstadoUrl>): EstadoUrl => ({
  censo: CENSO_PADRAO,
  municipio: null,
  selecao: null,
  nivel: "mun",
  origem: null,
  destino: null,
  metrica: "tlm",
  filtro: null,
  topN: 15,
  rm: null,
  aba: "mig",
  cruzar: false,
  mostrarFluxos: true,
  mostrarSatelite: false,
  limiarFluxo: 0,
  modo: "mapa",
  unidadeSerie: null,
  edicoesSerie: Array.from(EDICOES_SERIE),
  ...overrides,
});

describe("lerUrl", () => {
  it("lê modo censos, unidade série e edições ordenadas cronologicamente", () => {
    const params = new URLSearchParams("modo=censos&u=rgi:230010&ed=2022,1980");
    const resultado = lerUrl(params);
    expect(resultado.modo).toBe("censos");
    expect(resultado.unidadeSerie).toEqual({ nivel: "rgi", codigo: "230010" });
    expect(resultado.edicoesSerie).toEqual(["1980", "2022"]);
  });

  it("ed=2022 sozinho (uma edição só) → todas as 5 completas", () => {
    const params = new URLSearchParams("ed=2022");
    const resultado = lerUrl(params);
    expect(resultado.edicoesSerie).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("ed= ausente → todas as 5 completas", () => {
    const params = new URLSearchParams("");
    const resultado = lerUrl(params);
    expect(resultado.edicoesSerie).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("u=xx:1 (nível inválido) → unidadeSerie: null", () => {
    const params = new URLSearchParams("u=xx:1");
    const resultado = lerUrl(params);
    expect(resultado.unidadeSerie).toBeNull();
  });

  it("u=mun: (código vazio) → unidadeSerie: null", () => {
    const params = new URLSearchParams("u=mun:");
    const resultado = lerUrl(params);
    expect(resultado.unidadeSerie).toBeNull();
  });

  it("u=mun:DROP TABLE (código com caracteres inválidos) → unidadeSerie: null", () => {
    const params = new URLSearchParams("u=mun:DROP TABLE");
    const resultado = lerUrl(params);
    expect(resultado.unidadeSerie).toBeNull();
  });

  it("u=mun:1234567 (código válido, 7 dígitos) → objeto correto", () => {
    const params = new URLSearchParams("u=mun:1234567");
    const resultado = lerUrl(params);
    expect(resultado.unidadeSerie).toEqual({ nivel: "mun", codigo: "1234567" });
  });

  it("modo=banana (valor desconhecido) → modo: 'mapa'", () => {
    const params = new URLSearchParams("modo=banana");
    const resultado = lerUrl(params);
    expect(resultado.modo).toBe("mapa");
  });

  it("modo ausente → modo: 'mapa'", () => {
    const params = new URLSearchParams("");
    const resultado = lerUrl(params);
    expect(resultado.modo).toBe("mapa");
  });
});

describe("montarQuery", () => {
  it("round-trip modo censos com unidadeSerie e 3 edições (subconjunto)", () => {
    const estadoOriginal = estadoPadrao({
      modo: "censos",
      unidadeSerie: { nivel: "rgi", codigo: "230010" },
      edicoesSerie: ["1980", "2010", "2022"],
    });

    const query = montarQuery(estadoOriginal);
    const params = new URLSearchParams(query);
    const estadoLido = lerUrl(params);

    expect(estadoLido.modo).toBe("censos");
    expect(estadoLido.unidadeSerie).toEqual({ nivel: "rgi", codigo: "230010" });
    expect(estadoLido.edicoesSerie).toEqual(["1980", "2010", "2022"]);
  });

  it("round-trip com todas as 5 edições OMITE o parâmetro ed=", () => {
    const estadoOriginal = estadoPadrao({
      modo: "censos",
      unidadeSerie: { nivel: "mun", codigo: "3500105" },
      edicoesSerie: Array.from(EDICOES_SERIE),
    });

    const query = montarQuery(estadoOriginal);
    expect(query).not.toContain("ed=");

    // Confirma round-trip mesmo com ed ausente
    const params = new URLSearchParams(query);
    const estadoLido = lerUrl(params);
    expect(estadoLido.edicoesSerie).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("modo=censos NUNCA inclui u= nem ed= quando em modo mapa", () => {
    const estadoOriginal = estadoPadrao({
      modo: "mapa",
      unidadeSerie: { nivel: "rgi", codigo: "230010" },
      edicoesSerie: ["1980", "2022"],
    });

    const query = montarQuery(estadoOriginal);
    expect(query).not.toContain("u=");
    expect(query).not.toContain("ed=");
  });

  it("nunca escreve serie= em nenhuma query", () => {
    const casos = [
      estadoPadrao({ modo: "censos", unidadeSerie: { nivel: "mun", codigo: "3500105" }, edicoesSerie: ["2022"] }),
      estadoPadrao({ modo: "mapa" }),
      estadoPadrao({ modo: "censos", unidadeSerie: { nivel: "uf", codigo: "35" }, edicoesSerie: [...EDICOES_SERIE] }),
    ];

    for (const estado of casos) {
      const query = montarQuery(estado);
      expect(query).not.toContain("serie=");
    }
  });

  it("regressão: rm=901&aba=trab round-trip preserva exatamente", () => {
    const params = new URLSearchParams("rm=901&aba=trab");
    const estado = lerUrl(params);
    expect(estado.rm).toBe("901");
    expect(estado.aba).toBe("trab");

    const query = montarQuery(estado);
    expect(query).toBe("rm=901&aba=trab");
  });

  it("regressão: n=rgi&sel=230010&m=saldo round-trip preserva", () => {
    const params = new URLSearchParams("n=rgi&sel=230010&m=saldo");
    const estado = lerUrl(params);
    expect(estado.nivel).toBe("rgi");
    expect(estado.selecao).toBe("230010");
    expect(estado.metrica).toBe("saldo");

    const query = montarQuery(estado);
    const paramsRoundTrip = new URLSearchParams(query);
    const estadoRoundTrip = lerUrl(paramsRoundTrip);

    expect(estadoRoundTrip.nivel).toBe("rgi");
    expect(estadoRoundTrip.selecao).toBe("230010");
    expect(estadoRoundTrip.metrica).toBe("saldo");
  });
});

describe("lerUnidadeSerie (testes unitários)", () => {
  it("parseia 'rgi:230010' corretamente", () => {
    expect(lerUnidadeSerie("rgi:230010")).toEqual({ nivel: "rgi", codigo: "230010" });
  });

  it("parseia 'mun:1234567' corretamente", () => {
    expect(lerUnidadeSerie("mun:1234567")).toEqual({ nivel: "mun", codigo: "1234567" });
  });

  it("parseia 'rm:ABC1234' (12 caracteres alfanuméricos) corretamente", () => {
    expect(lerUnidadeSerie("rm:ABC1234XYZ")).toEqual({ nivel: "rm", codigo: "ABC1234XYZ" });
  });

  it("rejeita null", () => {
    expect(lerUnidadeSerie(null)).toBeNull();
  });

  it("rejeita '' (string vazia)", () => {
    expect(lerUnidadeSerie("")).toBeNull();
  });

  it("rejeita nível inválido", () => {
    expect(lerUnidadeSerie("xpto:123")).toBeNull();
  });

  it("rejeita código vazio após :", () => {
    expect(lerUnidadeSerie("mun:")).toBeNull();
  });

  it("rejeita código com espaços", () => {
    expect(lerUnidadeSerie("mun:12 34567")).toBeNull();
  });

  it("rejeita código com caracteres especiais", () => {
    expect(lerUnidadeSerie("mun:123@456")).toBeNull();
  });

  it("rejeita código com mais de 12 caracteres", () => {
    expect(lerUnidadeSerie("mun:12345678901234")).toBeNull();
  });

  it("aceita no máximo 12 caracteres (alfanuméricos e 0-9)", () => {
    expect(lerUnidadeSerie("mun:123456789012")).toEqual({ nivel: "mun", codigo: "123456789012" });
  });

  it("rejeita quando não há :", () => {
    expect(lerUnidadeSerie("mun123456")).toBeNull();
  });
});

describe("lerEdicoesSerie (testes unitários)", () => {
  it("null → todas as 5", () => {
    expect(lerEdicoesSerie(null)).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("'' (string vazia) → todas as 5", () => {
    expect(lerEdicoesSerie("")).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("'2022,1980' → ['1980', '2022'] (cronológico)", () => {
    expect(lerEdicoesSerie("2022,1980")).toEqual(["1980", "2022"]);
  });

  it("'2022,1980,1980' → ['1980', '2022'] (sem duplicatas)", () => {
    expect(lerEdicoesSerie("2022,1980,1980")).toEqual(["1980", "2022"]);
  });

  it("'2022' (uma só) → todas as 5 (menos de 2 válidas)", () => {
    expect(lerEdicoesSerie("2022")).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("'2022,xx' (uma válida + uma inválida) → todas as 5", () => {
    expect(lerEdicoesSerie("2022,xx")).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("'xx,yy' (nenhuma válida) → todas as 5", () => {
    expect(lerEdicoesSerie("xx,yy")).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("'1980,1991,2000,2010,2022' → todas as 5 em ordem", () => {
    expect(lerEdicoesSerie("1980,1991,2000,2010,2022")).toEqual(["1980", "1991", "2000", "2010", "2022"]);
  });

  it("'2022,2010,2000' (3 edições em ordem reversa) → cronológico", () => {
    expect(lerEdicoesSerie("2022,2010,2000")).toEqual(["2000", "2010", "2022"]);
  });
});

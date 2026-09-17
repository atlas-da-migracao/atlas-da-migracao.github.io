import { describe, expect, it } from "vitest";
import {
  classificarIem, seIem, harmonizarStatus, fraseSintese, tramaDoEstado,
  classeSequencial, QUEBRAS_FIXAS, type EntradaFrase, type PontoFrase, type EdicaoSerie,
} from "../serie";

const ponto = (p: Partial<PontoFrase> & { edicao: EdicaoSerie }): PontoFrase => ({
  estado: "numero", iem: null, seIem: null, tipo: null, imig: null, emig: null,
  saldo: null, tlm: null, coberturaPop: 1, ...p,
});

describe("classificarIem", () => {
  it("classifica rotatividade abaixo do limiar de 0,15", () => {
    expect(classificarIem(0.1)).toBe("rotatividade");
    expect(classificarIem(-0.1)).toBe("rotatividade");
  });
  it("classifica absorção/evasão entre 0,15 e 1/3", () => {
    expect(classificarIem(0.2)).toBe("absorcao");
    expect(classificarIem(-0.2)).toBe("evasao");
  });
  it("classifica forte a partir de 1/3", () => {
    expect(classificarIem(0.4)).toBe("absorcao_forte");
    expect(classificarIem(-0.4)).toBe("evasao_forte");
  });
  it("indefinido quando a margem (z*se) supera o valor acima do limiar", () => {
    // T4: iem = 0,20 e se = 0,15 -> z*se = 0,294 > 0,20
    expect(classificarIem(0.2, 0.15)).toBe("indefinido");
  });
  it("sem se (1980): classifica sem guarda", () => {
    expect(classificarIem(0.2, null)).toBe("absorcao");
  });
  it("null quando iem é null", () => {
    expect(classificarIem(null)).toBeNull();
  });
});

describe("seIem", () => {
  it("null quando falta algum se", () => {
    expect(seIem(100, 50, null, 1)).toBeNull();
  });
  it("positivo quando os dois se existem", () => {
    const v = seIem(100, 50, 5, 5);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(0);
  });
});

describe("harmonizarStatus", () => {
  it("2022 soma primeira_saida + etapas_multiplas em nao_natural", () => {
    const out = harmonizarStatus({ primeira_saida: 10, etapas_multiplas: 5, outros: 2 }, "2022");
    expect(out.nao_natural).toBe(15);
    expect(out.primeira_saida).toBeUndefined();
    expect(out.etapas_multiplas).toBeUndefined();
    expect(out.outros).toBe(2);
  });
  it("suprime (null) quando alguma parcela está suprimida", () => {
    const out = harmonizarStatus({ primeira_saida: null, etapas_multiplas: 5 }, "2022");
    expect(out.nao_natural).toBeNull();
  });
  it("edições != 2022 não mudam", () => {
    const out = harmonizarStatus({ nao_natural: 30 }, "2010");
    expect(out).toEqual({ nao_natural: 30 });
  });
});

describe("QUEBRAS_FIXAS", () => {
  it("iem tem os limiares da tipologia mais o corte superior de 0,60", () => {
    expect(QUEBRAS_FIXAS.iem).toEqual([0.15, 1 / 3, 0.6]);
  });
  it("tbi e tbe compartilham as mesmas quebras", () => {
    expect(QUEBRAS_FIXAS.tbi).toEqual(QUEBRAS_FIXAS.tbe);
  });
});

describe("classeSequencial", () => {
  it("devolve 0 para valores abaixo da primeira quebra e cresce com o valor", () => {
    const q = [25, 50, 80, 130];
    expect(classeSequencial(10, q)).toBe(0);
    expect(classeSequencial(200, q)).toBe(4);
  });
});

describe("tramaDoEstado", () => {
  it("diagonal para não existia/sem cobertura/cobertura insuficiente", () => {
    expect(tramaDoEstado("nao_existia")).toBe("diagonal");
    expect(tramaDoEstado("sem_cobertura")).toBe("diagonal");
    expect(tramaDoEstado("cobertura_insuficiente")).toBe("diagonal");
  });
  it("cruzada para suprimido", () => {
    expect(tramaDoEstado("suprimido")).toBe("cruzada");
  });
  it("pontilhada para não medido", () => {
    expect(tramaDoEstado("nao_medido")).toBe("pontilhada");
  });
  it("nenhuma trama para número ou não comparável", () => {
    expect(tramaDoEstado("numero")).toBeNull();
    expect(tramaDoEstado("nao_comparavel")).toBeNull();
  });
});

describe("fraseSintese", () => {
  const base = (pontos: PontoFrase[]): EntradaFrase => ({ nome: "Sobral", nivel: "mun", pontos });

  it("T1 -- absorção para rotatividade", () => {
    const entrada = base([
      ponto({ edicao: "1980", iem: 0.24, tipo: "absorcao", imig: 7900, emig: 4800 }),
      ponto({ edicao: "2022", iem: 0.03, tipo: "rotatividade", imig: 10000, emig: 9400 }),
    ]);
    const frase = fraseSintese(entrada);
    expect(frase).toContain("passou de absorção");
    expect(frase).toContain("rotatividade");
    expect(frase).toContain("proxy");
  });

  it("T1 -- evasão forte para evasão", () => {
    const entrada = base([
      ponto({ edicao: "1991", iem: -0.5, tipo: "evasao_forte", imig: 100, emig: 900 }),
      ponto({ edicao: "2022", iem: -0.2, tipo: "evasao", imig: 400, emig: 700 }),
    ]);
    expect(fraseSintese(entrada)).toContain("passou de evasão forte");
  });

  it("T2 -- manteve a classe, sem a ressalva de proxy quando ini != 1980", () => {
    const entrada = base([
      ponto({ edicao: "1991", iem: 0.2, tipo: "absorcao", imig: 500, emig: 300 }),
      ponto({ edicao: "2022", iem: 0.22, tipo: "absorcao", imig: 600, emig: 350 }),
    ]);
    const frase = fraseSintese(entrada);
    expect(frase).toContain("está em absorção desde 1991");
    expect(frase).not.toContain("proxy");
  });

  it("T2 -- variante 'mais perto do equilíbrio' quando |delta iem| >= 0,10", () => {
    const entrada = base([
      ponto({ edicao: "1980", iem: 0.52, tipo: "absorcao_forte", imig: 900, emig: 300 }),
      ponto({ edicao: "2022", iem: 0.36, tipo: "absorcao_forte", imig: 1200, emig: 500 }),
    ]);
    const frase = fraseSintese(entrada);
    expect(frase).toContain("mais perto do equilíbrio");
  });

  it("T3 -- truncado, com mãe comum", () => {
    const entrada: EntradaFrase = {
      nome: "Mojuí dos Campos", nivel: "mun",
      pontos: [
        ponto({ edicao: "2010", estado: "nao_existia" }),
        ponto({ edicao: "2022", iem: -0.21, tipo: "evasao", imig: 480, emig: 740 }),
      ],
      mae: { nome: "Santarém", edicoes: ["2010"], agregada: false },
    };
    const frase = fraseSintese(entrada);
    expect(frase).toContain("foi criado depois de 2010");
    expect(frase).toContain("Santarém");
  });

  it("T3 -- truncado, com NORTEGO (unidade agregada)", () => {
    const entrada: EntradaFrase = {
      nome: "Palmas", nivel: "mun",
      pontos: [
        ponto({ edicao: "1980", estado: "nao_existia" }),
        ponto({ edicao: "1991", iem: 0.52, tipo: "absorcao_forte", imig: 900, emig: 300 }),
        ponto({ edicao: "2022", iem: 0.36, tipo: "absorcao_forte", imig: 1200, emig: 500 }),
      ],
      mae: { nome: "Norte de Goiás (atual Tocantins)", edicoes: ["1980"], agregada: true },
    };
    const frase = fraseSintese(entrada);
    expect(frase).toContain("unidade agregada");
    expect(frase).toContain("Norte de Goiás");
  });

  it("T4 -- iem = 0,20 e se = 0,15 é indefinido (margem maior que o valor)", () => {
    const entrada = base([
      ponto({ edicao: "1980", iem: 0.2, seIem: 0.15, tipo: classificarIem(0.2, 0.15) }),
      ponto({ edicao: "2022", iem: 0.3, tipo: "absorcao" }),
    ]);
    const frase = fraseSintese(entrada);
    expect(frase).toContain("amostra é pequena demais");
  });

  it("T5 -- município criado em 2013 (só uma edição com número)", () => {
    const entrada: EntradaFrase = {
      nome: "Mojuí dos Campos", nivel: "mun",
      pontos: [
        ponto({ edicao: "2010", estado: "nao_existia" }),
        ponto({ edicao: "2022", iem: -0.21, tipo: "evasao", imig: 480, emig: 740 }),
      ],
    };
    const frase = fraseSintese(entrada);
    expect(frase).toContain("Só há dado para Mojuí dos Campos em 2022");
    expect(frase).not.toContain("0,00");
  });

  it("T6 -- RGI vazia em 1980 (nenhuma edição com número)", () => {
    const entrada: EntradaFrase = {
      nome: "Região imediata teste", nivel: "rgi",
      pontos: [ponto({ edicao: "1980", estado: "sem_cobertura" })],
    };
    const frase = fraseSintese(entrada);
    expect(frase).toContain("Não há série");
  });

  it("ressalva de proxy ausente quando ini = 1991", () => {
    const entrada = base([
      ponto({ edicao: "1991", iem: 0.1, tipo: "rotatividade", imig: 100, emig: 90 }),
      ponto({ edicao: "2022", iem: 0.05, tipo: "rotatividade", imig: 120, emig: 110 }),
    ]);
    expect(fraseSintese(entrada)).not.toContain("proxy");
  });

  it("nenhuma frase contém 0,00 como resultado de célula ausente", () => {
    const entrada = base([
      ponto({ edicao: "2010", estado: "suprimido" }),
      ponto({ edicao: "2022", iem: 0.12, tipo: "rotatividade", imig: 50, emig: 40 }),
    ]);
    expect(fraseSintese(entrada)).not.toContain("0,00");
  });
});

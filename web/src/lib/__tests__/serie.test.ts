import { describe, expect, it } from "vitest";
import {
  classificarIem, seIem, harmonizarStatus, fraseSintese, tramaDoEstado,
  classeSequencial, QUEBRAS_FIXAS, ordenarEdicoes, alternarEdicao, filtrarEdicoes,
  edicaoAnterior, slotEdicao, rotuloIntervalo, tipoFluxoPredominante, fracaoParaPct,
  normalizarLinhaUnidade, formatarIem, formatarQuebra, maeDaSerie, filhosNoIntervalo,
  pontosDaSerie, perfilStatusDaEdicao, estadoNoMapa, tramaDoEstadoMapa, ordenarPorPostoRecente,
  geometriaSpark, ressalvasDoBloco,
  type Comparabilidade, type EntradaFrase, type PontoFrase, type EdicaoSerie, type LinhaSerieFrase,
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

  it("T3 -- truncado, município criado depois de 1980 (Palmas, mãe Porto Nacional)", () => {
    const entrada: EntradaFrase = {
      nome: "Palmas", nivel: "mun",
      pontos: [
        ponto({ edicao: "1980", estado: "nao_existia" }),
        ponto({ edicao: "1991", iem: 0.52, tipo: "absorcao_forte", imig: 900, emig: 300 }),
        ponto({ edicao: "2022", iem: 0.36, tipo: "absorcao_forte", imig: 1200, emig: 500 }),
      ],
      mae: { nome: "Porto Nacional", edicoes: ["1980"], agregada: false },
    };
    const frase = fraseSintese(entrada);
    expect(frase).toContain("foi criado depois de 1980; até então seu território fazia parte de Porto Nacional");
    expect(frase).not.toContain("publicado agregado");
  });

  // O mecanismo de unidade agregada está INATIVO (nenhuma edição declara uma desde 1.1.0-1980),
  // mas segue no código: estes testes o mantêm coberto com uma mãe sintética de código não numérico.
  it("T3 -- mãe agregada (código não numérico): 'publicado agregado em', sem afirmar criação posterior", () => {
    const entrada: EntradaFrase = {
      nome: "Município X", nivel: "mun",
      pontos: [
        ponto({ edicao: "1980", estado: "nao_existia" }),
        ponto({ edicao: "1991", iem: 0.52, tipo: "absorcao_forte", imig: 900, emig: 300 }),
        ponto({ edicao: "2022", iem: 0.36, tipo: "absorcao_forte", imig: 1200, emig: 500 }),
      ],
      mae: { nome: "Unidade agregada sintética", codigo: "AGREG01", edicoes: ["1980"], agregada: true },
    };
    const frase = fraseSintese(entrada);
    // o território é PUBLICADO (junto com outros): a frase não afirma criação posterior
    expect(frase).toContain("publicado agregado em Unidade agregada sintética");
    expect(frase).toContain("Em 1980");
    expect(frase).not.toContain("foi criado depois");
  });

  it("T5 -- mãe agregada: 'Nas demais edições' diz que o território é publicado agregado", () => {
    const entrada: EntradaFrase = {
      nome: "Município X", nivel: "mun",
      pontos: [
        ponto({ edicao: "1980", estado: "nao_existia" }),
        ponto({ edicao: "2022", iem: 0.36, tipo: "absorcao_forte", imig: 1200, emig: 500 }),
      ],
      mae: { nome: "Unidade agregada sintética", codigo: "AGREG01", edicoes: ["1980"], agregada: true },
    };
    const frase = fraseSintese(entrada);
    expect(frase).toContain("Nas demais edições, o território é publicado agregado em Unidade agregada sintética.");
  });

  it("T6 -- mãe agregada: 'Abra a série' diz 'em que o território está agregado'", () => {
    const entrada: EntradaFrase = {
      nome: "Município X", nivel: "mun",
      pontos: [ponto({ edicao: "1980", estado: "nao_existia" })],
      mae: { nome: "Unidade agregada sintética", codigo: "AGREG01", edicoes: ["1980"], agregada: true },
    };
    const frase = fraseSintese(entrada);
    expect(frase).toContain("em que o território está agregado");
    expect(frase).not.toContain("fazia parte");
  });

  it("T3 -- usa a edição mais recente sem existir (mae.ultimaEdicaoAusente), não a primeira", () => {
    const entrada: EntradaFrase = {
      nome: "Município X", nivel: "mun",
      pontos: [
        ponto({ edicao: "1980", estado: "nao_existia" }),
        ponto({ edicao: "1991", estado: "nao_existia" }),
        ponto({ edicao: "2022", iem: 0.3, tipo: "absorcao", imig: 500, emig: 200 }),
      ],
      mae: { nome: "Mãe Y", edicoes: ["1980", "1991"], agregada: false, ultimaEdicaoAusente: "1991" },
    };
    expect(fraseSintese(entrada)).toContain("foi criado depois de 1991");
  });

  it("T7 -- município-mãe: complemento por taxas e sufixo de fronteira só quando as taxas existem", () => {
    const base: Omit<EntradaFrase, "pontos"> = {
      nome: "Santarém", nivel: "mun",
      filhos: { nomes: ["Mojuí dos Campos"], ultimaEdicaoJunto: "2010" },
    };
    // volumes caem, mas as TAXAS ficam estáveis: o complemento é por taxa, não por volume
    const comTaxas = fraseSintese({
      ...base,
      pontos: [
        ponto({ edicao: "1991", iem: 0.4, tipo: "absorcao_forte", imig: 900, emig: 300, tbi: 80, tbe: 30 }),
        ponto({ edicao: "2022", iem: 0.05, tipo: "rotatividade", imig: 500, emig: 300, tbi: 82, tbe: 31 }),
      ],
    });
    expect(comTaxas).toContain("Até 2010, Santarém incluía o território que hoje é Mojuí dos Campos");
    expect(comTaxas).toContain("entradas e saídas mudaram pouco");
    expect(comTaxas).toContain("pelas taxas, que descontam em parte a mudança de fronteira");
    // sem taxas nas pontas: volta aos volumes e NÃO afirma desconto nenhum
    const semTaxas = fraseSintese({
      ...base,
      pontos: [
        ponto({ edicao: "1991", iem: 0.4, tipo: "absorcao_forte", imig: 900, emig: 300 }),
        ponto({ edicao: "2022", iem: 0.05, tipo: "rotatividade", imig: 500, emig: 300 }),
      ],
    });
    expect(semTaxas).toContain("chega menos gente do que antes");
    expect(semTaxas).not.toContain("descontam");
    expect(semTaxas).not.toContain("descontada");
  });

  it("T7 -- sem ano confiável dos filhos, a frase não inventa 'Até {ano}'", () => {
    const frase = fraseSintese({
      nome: "Santarém", nivel: "mun",
      filhos: { nomes: ["Mojuí dos Campos"] },
      pontos: [
        ponto({ edicao: "1991", iem: 0.2, tipo: "absorcao", imig: 500, emig: 300 }),
        ponto({ edicao: "2022", iem: 0.22, tipo: "absorcao", imig: 600, emig: 350 }),
      ],
    });
    expect(frase).toContain("Antes, Santarém incluía o território que hoje é Mojuí dos Campos");
    expect(frase).not.toContain("Até ");
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

  it("com subconjunto [1991, 2000, 2022] T1 mudança: contém 'Entre' com intervalo", () => {
    const entrada = base([
      ponto({ edicao: "1991", iem: 0.4, tipo: "absorcao_forte", imig: 500, emig: 300 }),
      ponto({ edicao: "2000", iem: 0.4, tipo: "absorcao_forte", imig: 550, emig: 320 }),
      ponto({ edicao: "2022", iem: 0.03, tipo: "rotatividade", imig: 600, emig: 350 }),
    ]);
    const frase = fraseSintese(entrada);
    expect(frase).not.toContain("proxy");
    expect(frase).toContain("Entre 1991 e 2022");
  });

  it("com subconjunto [1980, 2022] e Δ IEM < 0,10: T8 dispara mesmo em subconjunto", () => {
    const entrada = base([
      ponto({ edicao: "1980", iem: 0.18, tipo: "absorcao", imig: 500, emig: 320 }),
      ponto({ edicao: "2022", iem: 0.24, tipo: "absorcao", imig: 600, emig: 350 }),
    ]);
    const frase = fraseSintese(entrada);
    expect(frase).toContain("proxy");
    expect(frase).toContain("não é seguro afirmar tendência");
  });

  it("com subconjunto [2000, 2010] mesma classe T2: sem 1980 nem proxy", () => {
    const entrada = base([
      ponto({ edicao: "2000", iem: 0.2, tipo: "absorcao", imig: 400, emig: 250 }),
      ponto({ edicao: "2010", iem: 0.22, tipo: "absorcao", imig: 450, emig: 280 }),
    ]);
    const frase = fraseSintese(entrada);
    expect(frase).not.toContain("1980");
    expect(frase).not.toContain("proxy");
    expect(frase).toContain("2000");
    expect(frase).toContain("absorção");
  });
});

describe("ordenarEdicoes", () => {
  it("ordena cronologicamente e remove duplicatas", () => {
    const resultado = ordenarEdicoes(["2022", "1980", "1980", "2010"]);
    expect(resultado).toEqual(["1980", "2010", "2022"]);
  });

  it("remove valores inválidos", () => {
    const resultado = ordenarEdicoes(["2022", "1980", "x", "2000"]);
    expect(resultado).toEqual(["1980", "2000", "2022"]);
  });

  it("array vazio devolve array vazio", () => {
    expect(ordenarEdicoes([])).toEqual([]);
  });

  it("um único valor válido", () => {
    expect(ordenarEdicoes(["2010"])).toEqual(["2010"]);
  });
});

describe("alternarEdicao", () => {
  it("marcar uma edição ausente a adiciona e reordena cronologicamente", () => {
    const atuais: EdicaoSerie[] = ["1991", "2022"];
    const resultado = alternarEdicao(atuais, "2010");
    expect(resultado).toEqual(["1991", "2010", "2022"]);
  });

  it("desmarcar uma edição presente a remove", () => {
    const atuais: EdicaoSerie[] = ["1991", "2010", "2022"];
    const resultado = alternarEdicao(atuais, "2010");
    expect(resultado).toEqual(["1991", "2022"]);
  });

  it("desmarcar quando restariam MIN_EDICOES_SERIE devolve a MESMA REFERÊNCIA", () => {
    const atuais: EdicaoSerie[] = ["1980", "2022"];
    const resultado = alternarEdicao(atuais, "2022");
    expect(resultado).toBe(atuais);
    expect(resultado).toEqual(atuais);
  });

  it("resultado sempre cronológico mesmo marcando fora de ordem", () => {
    const atuais: EdicaoSerie[] = ["2022"];
    const resultado = alternarEdicao(atuais, "1980");
    expect(resultado).toEqual(["1980", "2022"]);
  });

  it("marcar múltiplas edições em sequência mantém ordem cronológica", () => {
    let atuais: EdicaoSerie[] = ["2022"];
    atuais = alternarEdicao(atuais, "1980");
    atuais = alternarEdicao(atuais, "2010");
    atuais = alternarEdicao(atuais, "1991");
    expect(atuais).toEqual(["1980", "1991", "2010", "2022"]);
  });
});

describe("filtrarEdicoes", () => {
  it("preserva ordem de entrada das linhas", () => {
    const linhas = [
      { edicao: "2022", valor: 10 },
      { edicao: "1980", valor: 5 },
      { edicao: "2010", valor: 8 },
    ];
    const resultado = filtrarEdicoes(linhas, ["1980", "2022"]);
    expect(resultado).toEqual([
      { edicao: "2022", valor: 10 },
      { edicao: "1980", valor: 5 },
    ]);
  });

  it("remove linhas cuja edicao não está no subconjunto", () => {
    const linhas = [
      { edicao: "1980", valor: 5 },
      { edicao: "1991", valor: 6 },
      { edicao: "2022", valor: 10 },
    ];
    const resultado = filtrarEdicoes(linhas, ["1980", "2022"]);
    expect(resultado).toEqual([
      { edicao: "1980", valor: 5 },
      { edicao: "2022", valor: 10 },
    ]);
  });

  it("array vazio de edições devolve resultado vazio", () => {
    const linhas = [
      { edicao: "2022", valor: 10 },
      { edicao: "1980", valor: 5 },
    ];
    const resultado = filtrarEdicoes(linhas, []);
    expect(resultado).toEqual([]);
  });

  it("linhas vazio devolve vazio", () => {
    const resultado = filtrarEdicoes([], ["1980", "2022"]);
    expect(resultado).toEqual([]);
  });
});

describe("edicaoAnterior", () => {
  it("1980 devolve null", () => {
    expect(edicaoAnterior("1980")).toBeNull();
  });

  it("1991 devolve 1980", () => {
    expect(edicaoAnterior("1991")).toBe("1980");
  });

  it("2000 devolve 1991", () => {
    expect(edicaoAnterior("2000")).toBe("1991");
  });

  it("2010 devolve 2000", () => {
    expect(edicaoAnterior("2010")).toBe("2000");
  });

  it("2022 devolve 2010", () => {
    expect(edicaoAnterior("2022")).toBe("2010");
  });
});

describe("slotEdicao", () => {
  it("1980 tem slot 0", () => {
    expect(slotEdicao("1980")).toBe(0);
  });

  it("1991 tem slot 1", () => {
    expect(slotEdicao("1991")).toBe(1);
  });

  it("2000 tem slot 2", () => {
    expect(slotEdicao("2000")).toBe(2);
  });

  it("2010 tem slot 3", () => {
    expect(slotEdicao("2010")).toBe(3);
  });

  it("2022 tem slot 4", () => {
    expect(slotEdicao("2022")).toBe(4);
  });

  it("índice não muda com qualquer subconjunto", () => {
    const slot2022 = slotEdicao("2022");
    expect(slot2022).toBe(4);
    // Confirmar que mesmo filtrando por subconjunto menor, slotEdicao retorna o mesmo
    const resultado = slotEdicao("2022");
    expect(resultado).toBe(slot2022);
  });
});

describe("rotuloIntervalo", () => {
  it("intervalo [1991, 2000, 2022] devolve '1991→2022'", () => {
    expect(rotuloIntervalo(["1991", "2000", "2022"])).toBe("1991→2022");
  });

  it("uma só edição [2022] devolve '2022'", () => {
    expect(rotuloIntervalo(["2022"])).toBe("2022");
  });

  it("array vazio devolve string vazia", () => {
    expect(rotuloIntervalo([])).toBe("");
  });

  it("duas edições [1980, 2010] devolve '1980→2010'", () => {
    expect(rotuloIntervalo(["1980", "2010"])).toBe("1980→2010");
  });

  it("todas as cinco edições", () => {
    expect(rotuloIntervalo(["1980", "1991", "2000", "2010", "2022"])).toBe("1980→2022");
  });
});


describe("pct_interestadual (fração 0-1 -> percentual)", () => {
  it("fracaoParaPct converte uma vez; null continua null", () => {
    expect(fracaoParaPct(0.66)).toBeCloseTo(66, 10);
    expect(fracaoParaPct(0.007)).toBeCloseTo(0.7, 10);
    expect(fracaoParaPct(null)).toBeNull();
    expect(fracaoParaPct(undefined)).toBeNull();
  });

  it("normalizarLinhaUnidade converte só pct_interestadual e não muta a linha original", () => {
    const l = { edicao: "2022", pct_interestadual: 0.66, imig: 10 };
    const n = normalizarLinhaUnidade(l);
    expect(n.pct_interestadual).toBeCloseTo(66, 10);
    expect(n.imig).toBe(10);
    expect(l.pct_interestadual).toBe(0.66);
  });

  it("tipoFluxoPredominante: 0,66 convertido (66%) é interestadual; 0,66 cru nunca seria", () => {
    const longa = tipoFluxoPredominante(300_000, 0.66 * 100);
    expect(longa?.chave).toBe("longa_inter");
    const curta = tipoFluxoPredominante(50_000, 0.66 * 100);
    expect(curta?.chave).toBe("curta_inter");
    // o bug original: a fração crua (0,66) ficava sempre abaixo do limiar de 50
    expect(tipoFluxoPredominante(300_000, 0.66)?.chave).toBe("longa_intra");
  });

  it("tipoFluxoPredominante: 30% -> intraestadual", () => {
    expect(tipoFluxoPredominante(300_000, 0.3 * 100)?.chave).toBe("longa_intra");
  });
});

describe("formatação", () => {
  it("formatarIem: pt-BR, sinal tipográfico, duas casas", () => {
    expect(formatarIem(0.14)).toBe("+0,14");
    expect(formatarIem(-0.04)).toBe("−0,04");
    expect(formatarIem(0)).toBe("0,00");
    expect(formatarIem(-0.001)).toBe("0,00");
    expect(formatarIem(null)).toBe("—");
  });

  it("formatarQuebra: IEM com 2 casas em pt-BR (nunca 0.3333333333333333); ‰ inteiro", () => {
    expect(QUEBRAS_FIXAS.iem.map((q) => formatarQuebra("iem", q))).toEqual(["0,15", "0,33", "0,60"]);
    expect(QUEBRAS_FIXAS.tbi.map((q) => formatarQuebra("tbi", q))).toEqual(["25", "50", "80", "130"]);
  });
});

describe("maeDaSerie", () => {
  const lin = (edicao: EdicaoSerie, existia: boolean, cd?: string, nm?: string) =>
    ({ edicao, existia, cd_mun_mae: cd ?? null, nm_mun_mae: nm ?? null });
  const TODAS: EdicaoSerie[] = ["1980", "1991", "2000", "2010", "2022"];

  it("escolhe a mãe da edição MAIS RECENTE sem existir, não a primeira cronológica", () => {
    // criado depois de 1991: em 1980 a mãe era B; em 1991 (já desmembrada de B) a mãe é A
    const mae = maeDaSerie([
      lin("1980", false, "1111111", "B"), lin("1991", false, "2222222", "A"),
      lin("2000", true), lin("2010", true), lin("2022", true),
    ], TODAS);
    expect(mae?.nome).toBe("A");
    expect(mae?.codigo).toBe("2222222");
    expect(mae?.ultimaEdicaoAusente).toBe("1991");
    expect(mae?.agregada).toBe(false);
    expect(mae?.edicoes).toEqual(["1991"]);
  });

  it("undefined quando nenhuma edição MARCADA é 'não existia' (série marcada completa)", () => {
    const mae = maeDaSerie([
      lin("1980", false, "1111111", "B"), lin("2000", true), lin("2022", true),
    ], ["2000", "2022"]);
    expect(mae).toBeUndefined();
  });

  it("mãe de código não numérico (unidade agregada sintética) = agregada", () => {
    const mae = maeDaSerie([
      lin("1980", false, "AGREG01", "Unidade agregada sintética"),
      lin("1991", true), lin("2022", true),
    ], TODAS);
    expect(mae?.agregada).toBe(true);
    expect(mae?.codigo).toBe("AGREG01");
    expect(mae?.edicoes).toEqual(["1980"]);
  });
});

describe("filhosNoIntervalo", () => {
  const f = (codigo: string, nome: string, ultima?: string) =>
    ({ codigo, nome, ultima_edicao_ausente: ultima ?? null });

  it("só entram filhos cuja separação cai dentro das edições marcadas", () => {
    const filhos = [f("a", "A", "1980"), f("b", "B", "2010")];
    // [1991, 2022]: A foi criado entre 1980 e 1991 (antes da janela) -> fora; B entre 2010 e 2022 -> dentro
    expect(filhosNoIntervalo(filhos, ["1991", "2022"])?.nomes).toEqual(["B"]);
    // [1980, 2022]: ambos dentro
    expect(filhosNoIntervalo(filhos, ["1980", "2022"])?.nomes).toEqual(["A", "B"]);
    // [1980, 2000]: B (2010) foi criado depois da janela -> fora
    expect(filhosNoIntervalo(filhos, ["1980", "2000"])?.nomes).toEqual(["A"]);
  });

  it("ultimaEdicaoJunto = menor edição ausente do grupo; usa nome, não código", () => {
    const r = filhosNoIntervalo([f("x", "Xis", "2010"), f("y", "Ípsilon", "1991")], ["1980", "2022"]);
    expect(r?.ultimaEdicaoJunto).toBe("1991");
    expect(r?.nomes).toContain("Xis");
    expect(r?.nomes).not.toContain("x");
  });

  it("undefined quando nenhum filho cai na janela; sem edição na fonte o filho entra", () => {
    expect(filhosNoIntervalo([f("a", "A", "1980")], ["1991", "2022"])).toBeUndefined();
    const r = filhosNoIntervalo([f("a", "A")], ["1991", "2022"]);
    expect(r?.nomes).toEqual(["A"]);
    expect(r?.ultimaEdicaoJunto).toBeUndefined();
  });

  it("sem nome cai no código", () => {
    const r = filhosNoIntervalo([{ codigo: "1234567", ultima_edicao_ausente: "2010" }], ["2000", "2022"]);
    expect(r?.nomes).toEqual(["1234567"]);
  });
});

describe("pontosDaSerie", () => {
  const linha = (edicao: EdicaoSerie, extra: Partial<LinhaSerieFrase> = {}): LinhaSerieFrase => ({
    edicao, imig: 100, emig: 50, saldo: 50, tlm: 5, tbi: 10, tbe: 5, iem: 0.33, se_iem: null,
    existia: true, estado_cobertura: "plena", ...extra,
  });

  it("um ponto por edição marcada, em ordem; edição sem linha = nao_medido", () => {
    const p = pontosDaSerie([linha("1991"), linha("2022")], ["1980", "1991", "2022"]);
    expect(p.map((x) => x.edicao)).toEqual(["1980", "1991", "2022"]);
    expect(p[0].estado).toBe("nao_medido");
    expect(p[1].estado).toBe("numero");
    expect(p[1].tbi).toBe(10);
  });

  it("não existia / cobertura insuficiente / iem nulo zeram os números", () => {
    const p = pontosDaSerie([
      linha("1980", { existia: false }),
      linha("1991", { estado_cobertura: "insuficiente" }),
      linha("2000", { iem: null }),
    ], ["1980", "1991", "2000"]);
    expect(p.map((x) => x.estado)).toEqual(["nao_existia", "cobertura_insuficiente", "suprimido"]);
    expect(p.every((x) => x.iem == null && x.imig == null && x.tipo == null)).toBe(true);
  });
});

describe("perfilStatusDaEdicao (Bloco 4)", () => {
  it("2022 com nao_natural suprimido (parcela ausente): 'suprimido', sem renormalizar", () => {
    // etapas_multiplas ausente -> harmonização devolve nao_natural = null
    const r = perfilStatusDaEdicao({ primeira_saida: 50, retorno_natal: 30, outros: 5 }, "2022", "numero");
    expect(r.motivo).toBe("suprimido");
    expect(r.valores).toEqual({});
  });

  it("2022 completo: soma as duas parcelas, sem motivo", () => {
    const r = perfilStatusDaEdicao(
      { primeira_saida: 50, etapas_multiplas: 20, retorno_natal: 30 }, "2022", "numero");
    expect(r.motivo).toBeNull();
    expect(r.valores.nao_natural).toBe(70);
    expect(r.valores.retorno_natal).toBe(30);
  });

  it("o motivo vem do estado da unidade, não do rótulo da edição", () => {
    expect(perfilStatusDaEdicao({ nao_natural: 10 }, "1980", "nao_existia").motivo).toBe("nao_existia");
    expect(perfilStatusDaEdicao({ nao_natural: 10 }, "2010", "cobertura_insuficiente").motivo)
      .toBe("cobertura_insuficiente");
    expect(perfilStatusDaEdicao({ nao_natural: 10 }, "1991", "sem_cobertura").motivo).toBe("sem_cobertura");
    // 1980 medido e publicado: desenha normalmente
    const r1980 = perfilStatusDaEdicao({ nao_natural: 10, retorno_natal: 5 }, "1980", "numero");
    expect(r1980.motivo).toBeNull();
    expect(r1980.valores).toEqual({ nao_natural: 10, retorno_natal: 5 });
  });

  it("nenhuma linha de perfil na edição (unidade existe): 'suprimido'", () => {
    expect(perfilStatusDaEdicao({}, "2000", "numero").motivo).toBe("suprimido");
  });
});

describe("estadoNoMapa", () => {
  const ok = { existia: true, estado_cobertura: "plena", rm_unitaria: null, se_iem: null };

  it("sem linha = nao_medido; existia=false = nao_existia; cobertura; RM unitária", () => {
    expect(estadoNoMapa(undefined, "iem", null)).toBe("nao_medido");
    expect(estadoNoMapa({ ...ok, existia: false }, "iem", null)).toBe("nao_existia");
    expect(estadoNoMapa({ ...ok, estado_cobertura: "sem_cobertura" }, "iem", 0.5)).toBe("sem_cobertura");
    expect(estadoNoMapa({ ...ok, estado_cobertura: "insuficiente" }, "iem", 0.5)).toBe("cobertura_insuficiente");
    expect(estadoNoMapa({ ...ok, rm_unitaria: true }, "iem", 0.5)).toBe("cobertura_insuficiente");
  });

  it("valor nulo = suprimido; valor = numero", () => {
    expect(estadoNoMapa(ok, "tlm", null)).toBe("suprimido");
    expect(estadoNoMapa(ok, "tlm", 12)).toBe("numero");
  });

  it("IEM com margem maior que o valor = indefinido (trama própria, sem cor de valor)", () => {
    // iem 0,20, se 0,15 -> z*se = 0,29 > 0,20 (mesmo caso de T4)
    expect(estadoNoMapa({ ...ok, se_iem: 0.15 }, "iem", 0.2)).toBe("indefinido");
    expect(tramaDoEstadoMapa("indefinido")).toBe("horizontal");
    // a guarda só vale para o IEM
    expect(estadoNoMapa({ ...ok, se_iem: 0.15 }, "tlm", 0.2)).toBe("numero");
    // sem se (1980, ou campo fora da consulta): sem guarda
    expect(estadoNoMapa(ok, "iem", 0.2)).toBe("numero");
    // abaixo do limiar de rotatividade o valor é rotatividade mesmo com margem grande
    expect(estadoNoMapa({ ...ok, se_iem: 0.15 }, "iem", 0.1)).toBe("numero");
  });

  it("as tramas dos demais estados continuam as mesmas", () => {
    expect(tramaDoEstadoMapa("nao_existia")).toBe("diagonal");
    expect(tramaDoEstadoMapa("suprimido")).toBe("cruzada");
    expect(tramaDoEstadoMapa("nao_medido")).toBe("pontilhada");
    expect(tramaDoEstadoMapa("numero")).toBeNull();
  });
});

describe("ordenarPorPostoRecente (Bloco 3)", () => {
  type P = { nome: string; postos: Partial<Record<EdicaoSerie, number | null>> };
  const postoEm = (p: P, e: EdicaoSerie) => p.postos[e];
  const EDS: EdicaoSerie[] = ["1980", "1991", "2022"];

  it("ordena pelo posto na edição mais recente marcada, desempatando pelas anteriores", () => {
    const itens: P[] = [
      { nome: "Antigo", postos: { "1980": 1, "1991": 1 } },               // sem 2022
      { nome: "Segundo", postos: { "1980": 5, "1991": 4, "2022": 2 } },
      { nome: "Primeiro", postos: { "1980": 9, "1991": 9, "2022": 1 } },  // o principal de 2022
      { nome: "Empatado", postos: { "1980": 3, "1991": 2, "2022": 2 } },  // empata em 2022, vence em 1991
    ];
    expect(ordenarPorPostoRecente(itens, EDS, postoEm).map((p) => p.nome))
      .toEqual(["Primeiro", "Empatado", "Segundo", "Antigo"]);
  });

  it("o principal parceiro de 2022 não some ao cortar, mesmo vindo por último na consulta", () => {
    // consulta em ordem de edição antiga: 12 parceiros fortes em 1980 e o de 2022 por último
    const itens: P[] = Array.from({ length: 12 }, (_, i) => (
      { nome: `Antigo ${i}`, postos: { "1980": i + 1 } } as P));
    itens.push({ nome: "Principal 2022", postos: { "2022": 1 } });
    expect(ordenarPorPostoRecente(itens, EDS, postoEm).slice(0, 12).map((p) => p.nome))
      .toContain("Principal 2022");
  });

  it("posto ausente vale +infinito; não muta a entrada; desempate final por nome", () => {
    const itens: P[] = [
      { nome: "B", postos: { "2022": 3 } }, { nome: "A", postos: { "2022": 3 } },
      { nome: "Sem", postos: { "2022": null } },
    ];
    const copia = [...itens];
    const ord = ordenarPorPostoRecente(itens, EDS, postoEm);
    expect(ord.map((p) => p.nome)).toEqual(["A", "B", "Sem"]);
    expect(itens).toEqual(copia);
  });
});

describe("geometriaSpark", () => {
  it("lacuna abre a linha: segmentos só entre pontos contíguos", () => {
    const g = geometriaSpark([1, null, 3, 4, null, 5], 100, 20);
    expect(g.segmentos).toHaveLength(1);          // só o trecho [3, 4]; os isolados não formam segmento
    expect(g.segmentos[0]).toHaveLength(2);
    expect(g.pontos.map((p) => p.i)).toEqual([0, 2, 3, 5]);
    expect(g.ausentes.map((a) => a.i)).toEqual([1, 4]);
  });

  it("um único valor: ponto sem segmento, e as demais posições marcadas como ausentes", () => {
    const g = geometriaSpark([null, null, null, null, 7], 100, 20);
    expect(g.segmentos).toHaveLength(0);
    expect(g.pontos).toHaveLength(1);
    expect(g.ausentes).toHaveLength(4);
  });

  it("tudo nulo: nenhuma linha nem ponto, todas as posições ausentes", () => {
    const g = geometriaSpark([null, null, null], 100, 20);
    expect(g.pontos).toHaveLength(0);
    expect(g.segmentos).toHaveLength(0);
    expect(g.ausentes).toHaveLength(3);
  });

  it("posições equidistantes dentro da largura; zero sempre na escala (valor 0 na base)", () => {
    const g = geometriaSpark([0, 10], 100, 20, 0);
    expect(g.pontos[0].x).toBe(0);
    expect(g.pontos[1].x).toBe(100);
    expect(g.pontos[0].y).toBe(20);   // 0 = base
    expect(g.pontos[1].y).toBe(0);    // máximo = topo
  });
});

describe("ressalvasDoBloco", () => {
  const comp = {
    matriz: [
      { medida: "imig", edicao: "1980", nivel: "mun", estado: "comparavel_com_ressalva", nota: "proxy_1980_volume" },
      { medida: "emig", edicao: "1980", nivel: "mun", estado: "comparavel_com_ressalva", nota: "proxy_1980_volume" },
      { medida: "emig", edicao: "2022", nivel: "mun", estado: "comparavel", nota: null },
      { medida: "gini_linha", edicao: "2022", nivel: "mun", estado: "comparavel_com_ressalva", nota: "gini_supressao" },
    ],
    notas: { proxy_1980_volume: "Texto do proxy.", gini_supressao: "Texto do Gini." },
  } as unknown as Comparabilidade;
  const medidas = [
    { medidaComp: "imig", rotulo: "Imigrantes" }, { medidaComp: "emig", rotulo: "Emigrantes" },
    { medidaComp: "gini_linha", rotulo: "Gini" },
  ];

  it("agrupa por nota, junta medidas e edições, na ordem das medidas", () => {
    const r = ressalvasDoBloco(comp, "mun", medidas, ["1980", "2022"], new Set<EdicaoSerie>(["1980", "2022"]));
    expect(r.map((x) => x.nota)).toEqual(["proxy_1980_volume", "gini_supressao"]);
    expect(r[0].medidas).toEqual(["Imigrantes", "Emigrantes"]);
    expect(r[0].edicoes).toEqual(["1980"]);
    expect(r[0].texto).toBe("Texto do proxy.");
  });

  it("ignora edições em que a unidade não tem número (não existia) e as não marcadas", () => {
    expect(ressalvasDoBloco(comp, "mun", medidas, ["1980", "2022"], new Set<EdicaoSerie>(["2022"])).map((x) => x.nota))
      .toEqual(["gini_supressao"]);
    expect(ressalvasDoBloco(comp, "mun", medidas, ["2022"], new Set<EdicaoSerie>(["1980", "2022"])).map((x) => x.nota))
      .toEqual(["gini_supressao"]);
  });
});

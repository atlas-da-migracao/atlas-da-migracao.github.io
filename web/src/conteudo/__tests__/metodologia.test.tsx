/** A página de metodologia é *por edição* (F9.7-b): até a edição 1980 ela estava fixada no
 *  texto do Censo 2022 e contradizia o rodapé nas outras quatro ("acesso controlado" e
 *  "31/07/2017" ao lado de "Censo Demográfico 1980 (IBGE, dados públicos)"). Estes testes
 *  renderizam o componente uma vez por edição e checam as afirmações que não podem vazar de
 *  uma edição para outra.
 *
 *  Como a edição ativa vem do store (`useStore(s => s.censo)`) e o store lê a URL no import,
 *  cada edição é renderizada num registro de módulos limpo (`vi.resetModules()`) com
 *  `?censo=<edição>` -- é também o caminho que o `useSyncExternalStore` usa na renderização
 *  estática (snapshot inicial), então mudar o store depois do import não teria efeito aqui. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Censo } from "../../lib/edicoes";
import type { Meta } from "../../lib/types";

/** Mesma forma do meta.json gerado por pipeline/build_meta.py (só os campos que a página lê).
 *  `acesso` e os limiares acompanham o que cada edição realmente publicou: 1980 não tem chave
 *  de domicílio, então `min_domicilios` é null e os pisos de pessoas são mais altos. */
const SALARIO_MINIMO: Record<Censo, number> = {
  "2022": 1212, "2010": 510, "2000": 151, "1991": 36161.6, "1980": 4149.6,
};

function fakeMeta(censo: Censo): Meta {
  const publico = censo !== "2022";
  const semChaveDomicilio = censo === "1980";
  // `edicao` já vem no meta.json real (pipeline/build_meta.py), mas ainda não está no tipo Meta
  return {
    edicao: censo,
    versao_dados: `1.0.0-${censo}`,
    fonte: `IBGE, Censo Demográfico ${censo}, microdados da amostra `
      + `(${publico ? "dados públicos" : "acesso controlado"})`,
    salario_minimo_referencia: SALARIO_MINIMO[censo],
    maior_fluxo: 23425,
    revelacao: {
      min_pessoas: semChaveDomicilio ? 20 : 5,
      min_domicilios: semChaveDomicilio ? null : 3,
      min_pessoas_detalhe: semChaveDomicilio ? 50 : 20,
      arredondamento: 5,
      cv_boa: 15,
      cv_cautela: 30,
    },
    rotulos: { status: { nao_natural: "Não nasceu no município nem no exterior" } },
    citacao: {
      autor: "Daniel Pessini Sobreira", autor_orcid: "https://orcid.org/0000-0002-6632-3991",
      doi_conceito: "10.5281/zenodo.22469791", doi_versao: "10.5281/zenodo.22469792",
      licenca: "CC BY 4.0", licenca_url: "https://creativecommons.org/licenses/by/4.0/deed.pt-br",
      texto: "",
    },
    aviso: `Estimativas ... Censo Demográfico ${censo} (IBGE, ...)`,
    aviso_proxy: semChaveDomicilio ? "Esta edição não tem quesito de data fixa: ..." : null,
    aviso_proxy_resumo: semChaveDomicilio ? "O Censo 1980 não perguntou ..." : null,
  } as Meta;
}

/** `meta` permite simular o meta de OUTRA edição ainda em uso durante a troca de censo. */
async function renderizar(censo: Censo, meta: Meta = fakeMeta(censo)): Promise<string> {
  vi.resetModules();
  vi.stubGlobal("location", { search: `?censo=${censo}`, pathname: "/", href: "/" });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  const { Metodologia } = await import("../metodologia");
  return renderToStaticMarkup(createElement(Metodologia, { meta }));
}

afterEach(() => vi.unstubAllGlobals());

describe("página de metodologia por edição", () => {
  it("2022: quesito direto de data fixa, vocabulário completo de status e acesso controlado", async () => {
    const html = await renderizar("2022");
    expect(html).toContain("acesso controlado");
    expect(html).toContain("31/07/2017");
    expect(html).toContain("31/07/2022");
    expect(html).toContain("primeira saída do município natal");
    expect(html).toContain("Escolaridade e renda");
    expect(html).toContain("Censo Demográfico 2022 (IBGE)");
  });

  it("2010: data fixa 2005–2010, dados públicos e vocabulário reduzido de status", async () => {
    const html = await renderizar("2010");
    expect(html).not.toContain("acesso controlado");
    expect(html).not.toContain("31/07/2017");
    expect(html).toContain("31/07/2005");
    expect(html).toContain("31/07/2010");
    expect(html).not.toContain("primeira saída do município natal</strong>");
    // o texto cita o rótulo que os gráficos mostram (lib/paletas.ts), não o de meta.rotulos
    expect(html).toContain("Não natural do destino");
    expect(html).not.toContain("Não nasceu no município nem no exterior");
    expect(html).toContain("Censo Demográfico 2010 (IBGE)");
  });

  it("2000: data fixa 1995–2000 e o piso do pendular de estudo (quesito único)", async () => {
    const html = await renderizar("2000");
    expect(html).not.toContain("acesso controlado");
    expect(html).toContain("31/07/1995");
    expect(html).toContain("31/07/2000");
    expect(html).toContain("único quesito");
    expect(html).toContain("Censo Demográfico 2000 (IBGE)");
  });

  it("1991: data fixa 1986–1991, precisão aproximada e sem módulo pendular", async () => {
    const html = await renderizar("1991");
    expect(html).not.toContain("acesso controlado");
    expect(html).toContain("01/09/1986");
    expect(html).toContain("01/09/1991");
    expect(html).toContain("aproximada e conservadora");
    // sem quesito de município de trabalho/estudo: o módulo RM tem uma peça só
    expect(html).toContain("o modo RM tem uma peça só");
    expect(html).not.toContain("dimensões pendulares");
  });

  it("1980: proxy no lugar de data fixa, sem renda, sem erro amostral e fonte secundária", async () => {
    const html = await renderizar("1980");
    expect(html).not.toContain("acesso controlado");
    expect(html).not.toContain("31/07/2017");
    expect(html).toContain("Migração estimada por proxy");
    // fonte vigente (1.1.0-1980) nomeada; a anterior aparece só como histórico
    expect(html).toContain("censobr/IPEA");
    expect(html).toContain("Base dos Dados");
    expect(html).toContain("Esta edição não publica renda");
    expect(html).toContain("Esta edição não publica erro amostral");
    // limiares efetivos da edição (meta.revelacao), não os das outras: o piso é de pessoas, e
    // a página não pode prometer um piso de domicílios que o gate não aplicou aqui
    expect(html).toContain("menos de 20 pessoas");
    expect(html).not.toContain("domicílios amostrados;");
    expect(html).toContain("Censo Demográfico 1980 (IBGE)");
  });

  it("1980: os 52 municípios do norte de Goiás entram com o código de 2022, não como uma unidade agregada", async () => {
    const html = await renderizar("1980");
    expect(html).toContain("Os 52 municípios que em 1988 formaram o Tocantins");
    expect(html).toContain("17xxxxx");
    expect(html).toContain("aparecem como interestaduais");
    expect(html).toContain("10 continuam sem nenhum município em 1980");
    // o texto da versão anterior (unidade única 'Norte de Goiás', sem RGI, 21 RGIs vazias)
    expect(html).not.toContain("UMA unidade");
    expect(html).not.toContain("NORTEGO");
    expect(html).not.toContain("21 regiões imediatas");
    // as demais edições não herdam a limitação
    expect(await renderizar("2010")).not.toContain("norte de Goiás");
  });

  it("o piso de revelação é sobre registros AMOSTRADOS, não sobre estimativa ponderada", async () => {
    const html = await renderizar("2022");
    expect(html).toContain("menos de 5 pessoas amostradas ou menos de 3 domicílios amostrados");
    expect(html).not.toContain("estimativa ponderada");
  });

  it("o DOI de versão é rotulado com a versão vigente do atlas (não mais \"v1.0.0\")", async () => {
    const html = await renderizar("2022");
    expect(html).toContain("10.5281/zenodo.22469792</a> (v2.1.0)");
    expect(html).not.toContain("v1.0.0");
  });

  it("salário mínimo de referência com duas casas e a moeda da edição", async () => {
    const nbsp = "\u00a0";
    expect(await renderizar("2022")).toContain(`(R$${nbsp}1.212,00)`);
    expect(await renderizar("2010")).toContain(`(R$${nbsp}510,00)`);
    expect(await renderizar("2000")).toContain(`(R$${nbsp}151,00)`);
    expect(await renderizar("1991")).toContain(`(Cr$${nbsp}36.161,60)`);
    // 1980 não publica renda: o salário mínimo nem é mencionado
    expect(await renderizar("1980")).not.toContain("salário mínimo de referência");
  });

  it("meta de outra edição ainda em uso (troca de censo) mostra \"carregando\" em vez de misturar", async () => {
    const html = await renderizar("2010", fakeMeta("2022"));
    expect(html).toContain("Carregando a metodologia do Censo 2010");
    expect(html).not.toContain("acesso controlado");
    expect(html).not.toContain("Censo Demográfico 2022");
    expect(html).not.toContain("10.5281/zenodo");
  });

  it("nenhuma edição pública alega acesso controlado, e toda edição cita a si mesma", async () => {
    for (const censo of ["2022", "2010", "2000", "1991", "1980"] as Censo[]) {
      const html = await renderizar(censo);
      expect(html).toContain(`Censo Demográfico ${censo} (IBGE)`);
      if (censo !== "2022") expect(html).not.toContain("acesso controlado");
    }
  });
});

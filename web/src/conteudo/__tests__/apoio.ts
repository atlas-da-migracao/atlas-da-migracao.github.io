/** Apoio compartilhado pelos testes da página de metodologia: um meta.json falso por edição e a
 *  renderização num registro de módulos limpo.
 *
 *  Como a edição ativa vem do store (`useStore(s => s.censo)`) e o store lê a URL no import,
 *  cada renderização acontece num registro de módulos limpo (`vi.resetModules()`) com
 *  `?censo=<edição>` -- é também o caminho que o `useSyncExternalStore` usa na renderização
 *  estática (snapshot inicial), então mudar o store depois do import não teria efeito. */
import { vi } from "vitest";
import type { Censo } from "../../lib/edicoes";
import type { Meta } from "../../lib/types";

/** Mesma forma do meta.json gerado por pipeline/build_meta.py (só os campos que a página lê).
 *  `acesso` e os limiares acompanham o que cada edição realmente publicou: 1980 não tem chave
 *  de domicílio, então `min_domicilios` é null e os pisos de pessoas são mais altos. */
const SALARIO_MINIMO: Record<Censo, number> = {
  "2022": 1212, "2010": 510, "2000": 151, "1991": 36161.6, "1980": 4149.6,
};

export function fakeMeta(censo: Censo): Meta {
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

/** Registro de módulos limpo com `?censo=<edição>` (e sem idioma salvo). Depois disto, os
 *  `import()` dinâmicos do teste pegam módulos novos, que leem essa URL. */
export function prepararModulos(censo: Censo): void {
  vi.resetModules();
  vi.stubGlobal("location", { search: `?censo=${censo}`, pathname: "/", href: "/" });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
}

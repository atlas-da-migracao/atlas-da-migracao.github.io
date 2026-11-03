/** Lógica compartilhada pelas quatro versões da página de metodologia (pt, en, fr, es).
 *
 *  A página é *por edição* (F9.7-b) e *por idioma* (i18n). Três fontes alimentam o texto,
 *  nesta ordem de preferência:
 *    1. `meta` (pipeline/build_meta.py), para tudo que o gate/pipeline já carimba -- fonte,
 *       limiares efetivos, salário mínimo, avisos. A prosa que vem do meta (fonte, aviso,
 *       aviso_proxy) é lida num ponto só, `textosDoMeta`, que é onde a camada de tradução dos
 *       dados (`i18n/dados.json`) deve entrar;
 *    2. `edicao(censo)` (lib/edicoes.ts) e `ESTRUTURA` abaixo, para os fatos estruturais --
 *       período, proxy de data fixa, recursos ausentes, vocabulário de status, acesso, base do
 *       erro-padrão. Não dependem de idioma, por isso ficam aqui e não em cada arquivo de idioma;
 *    3. o mapa `TEXTO: Record<Censo, TextoEdicao>` de cada idioma (pt.tsx, en.tsx...), só para a
 *       prosa que depende do questionário de cada censo e que não existe em nenhum dos dois.
 *  `ESTRUTURA` e cada `TEXTO` são `Record<Censo, ...>` de propósito: uma edição nova quebra o
 *  build até que alguém escreva a metodologia dela nos quatro idiomas -- foi exatamente a falta
 *  desse travamento que deixou quatro edições publicadas com o texto de 2022. */
import type { ReactNode } from "react";
import { edicao, type Censo, type Edicao } from "../../lib/edicoes";
import { localeNumeros } from "../../lib/format";
import { textoDado } from "../../i18n/dados";
import type { Meta } from "../../lib/types";
import { useStore } from "../../state/store";
import { useIdioma } from "../../i18n";
import { LOCALE_NUMEROS, type Lang } from "../../i18n/tipos";

/** Versão do atlas a que o DOI de versão de "Como citar" se refere. Mesma versão que
 *  pipeline/build_paginas.py usa ao lado de `DOI_VERSAO` ("v2.1.0"). Fica aqui, e não em
 *  `meta.citacao`, porque pipeline/build_meta.py ainda não publica `citacao.versao` -- só
 *  `doi_versao`; quando publicar, troque esta constante pelo campo do meta e o rótulo nunca mais
 *  diverge do DOI (era "(v1.0.0)" fixo ao lado do DOI da v2.0.0). */
export const VERSAO_ATLAS = "v2.1.0";

export type Moeda = "R$" | "Cr$";

/** Moeda em que o salário mínimo de referência de cada edição está expresso. `meta.json` traz só o
 *  número (`salario_minimo_referencia`), sem a moeda: 1991 e 1980 são em cruzeiros (Cr$), as
 *  demais em reais -- o valor de 1991, por exemplo, aparecia como "(36.161,6)", sem unidade.
 *  A moeda nunca muda com o idioma (TERMINOLOGIA.md, §3): só o formato do número. */
export const MOEDA_SALARIO: Record<Censo, Moeda> = {
  "2022": "R$", "2010": "R$", "2000": "R$", "1991": "Cr$", "1980": "Cr$",
};

/** "Cr$ 36.161,60" / "R$ 1.212,00" em português, "R$ 1,212.00" em inglês...: sempre duas casas,
 *  separadores do idioma ativo (`localeNumeros()`, o mesmo locale de `num`/`sinal`). Agrupamento
 *  forçado pela mesma razão de lib/format.ts (es-ES não agrupa 4 dígitos por padrão). */
export function salarioMinimo(valor: number, censo: Censo, locale: string = localeNumeros()): string {
  const n = new Intl.NumberFormat(locale, {
    useGrouping: "always", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(valor);
  return `${MOEDA_SALARIO[censo]}\u00a0${n}`;
}

/** Data de referência da edição ("2017-07-31") no formato de cada idioma (TERMINOLOGIA.md, §3):
 *  "31/07/2017" em português, francês e espanhol; por extenso em inglês ("July 31, 2017"),
 *  porque a forma numérica é ambígua para o leitor americano. Em UTC, para a data ISO nunca
 *  escorregar um dia pelo fuso de quem lê. */
export function dataEdicao(iso: string, lang: Lang): string {
  const [a, m, d] = iso.split("-");
  if (lang === "en") {
    return new Intl.DateTimeFormat(LOCALE_NUMEROS.en, {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    }).format(new Date(Date.UTC(Number(a), Number(m) - 1, Number(d))));
  }
  return `${d}/${m}/${a}`;
}

/** Base do erro-padrão publicado pela edição. "area_ponderacao" é o caso das edições com o
 *  desenho amostral completo (domicílio como UPA, área de ponderação como estrato);
 *  "estrato_aproximado", o das que não têm área de ponderação e usam um substituto mais
 *  heterogêneo (Censo 1991, ver docs/METODOLOGIA.md, item 9 daquela seção); "ausente", o das
 *  que não publicam `se`/`cv` nenhum porque a fonte não tem chave de domicílio (Censo 1980,
 *  item 8.1). O pipeline declara o mesmo fato em `pipeline/edicoes.py` (`chave_domicilio`), e
 *  ele chega ao front também em `meta.revelacao.min_domicilios` (null <=> sem chave). */
export type BasePrecisao = "area_ponderacao" | "estrato_aproximado" | "ausente";

/** Fatos estruturais de cada edição que a página usa para escolher o texto -- iguais em todos
 *  os idiomas. */
export interface EstruturaEdicao {
  /** espelha `Edicao.acesso` de pipeline/edicoes.py; a mesma informação aparece em prosa
   *  dentro de `meta.fonte` ("acesso controlado" / "dados públicos"). */
  acesso: "controlado" | "publico";
  precisao: BasePrecisao;
}

export const ESTRUTURA: Record<Censo, EstruturaEdicao> = {
  "2022": { acesso: "controlado", precisao: "area_ponderacao" },
  "2010": { acesso: "publico", precisao: "area_ponderacao" },
  "2000": { acesso: "publico", precisao: "area_ponderacao" },
  "1991": { acesso: "publico", precisao: "estrato_aproximado" },
  "1980": { acesso: "publico", precisao: "ausente" },
};

/** Prosa que depende do questionário de cada censo, escrita em cada idioma. `ReactNode` para
 *  as traduções poderem pôr um termo em itálico (ex.: a glosa "municipalité (*município*)" do
 *  francês); o português usa só strings. */
export interface TextoEdicao {
  /** quem respondeu o quesito que sustenta a migração desta edição (seção "Fonte e universo"). */
  universo: ReactNode;
  /** procedência, quando ela não é a cópia distribuída pelo IBGE (só 1980). */
  fonteNota: ReactNode | null;
  /** primeira frase sobre origem não informada: com o número quando ele está documentado em
   *  docs/METODOLOGIA.md, genérica quando não (o painel de cada município mostra o valor). */
  origemNaoInformada: ReactNode;
  /** limitações próprias da edição, somadas às gerais; vazio quando não há nenhuma além das
   *  que as outras seções já explicam. Resumos de docs/METODOLOGIA.md, "Limitações conhecidas".
   *  Strings (servem de `key`). */
  limitacoes: string[];
}

/** Prosa vinda do meta.json -- hoje em português em qualquer idioma. */
export interface TextosMeta {
  /** `null` quando não há meta: cada idioma usa o próprio texto de reserva. */
  fonte: string | null;
  aviso: string | null;
  avisoProxy: string | null;
}

/** PONTO ÚNICO de leitura da prosa de `meta.json` (fonte, aviso, aviso_proxy) pela página de
 *  metodologia. Por enquanto devolve o texto do meta como veio (português), em qualquer idioma;
 *  a tradução desses textos (overlay de `i18n/dados.json`, por outro agente) deve entrar aqui,
 *  usando `lang`, sem tocar nos componentes de cada idioma. */
export function textosDoMeta(meta: Meta | null, lang: Lang): TextosMeta {
  // o idioma da prosa dos dados vem de `textoDado` (i18n/dados.ts), que já segue o idioma
  // aplicado; `lang` fica na assinatura para os chamadores recalcularem na troca
  void lang;
  const ed = meta?.edicao;
  return {
    fonte: textoDado(`fonte.${ed}`, meta?.fonte) ?? null,
    aviso: textoDado(`aviso.${ed}`, meta?.aviso) ?? null,
    avisoProxy: textoDado(`aviso_proxy.${ed}`, meta?.aviso_proxy) ?? null,
  };
}

export interface PropsMetodologia {
  meta: Meta | null;
}

/** Tudo que as quatro versões calculam igual a partir da edição ativa e do meta. */
export interface ContextoMetodologia {
  censo: Censo;
  ed: Edicao;
  est: EstruturaEdicao;
  /** Durante a troca de edição o meta da anterior pode continuar em uso até o novo chegar: sem
   *  esta guarda o texto da edição nova saía com fonte, limiares e citação da velha. Quando
   *  `true`, cada idioma mostra só o "carregando". */
  metaDeOutraEdicao: boolean;
  r: Meta["revelacao"] | undefined;
  sm: number | undefined;
  anoDe: string;
  anoAte: string;
  textos: TextosMeta;
}

export function useContextoMetodologia(meta: Meta | null, lang: Lang): ContextoMetodologia {
  const censo = useStore((s) => s.censo);
  const ed = edicao(censo);
  const edicaoDoMeta = meta?.edicao;
  return {
    censo,
    ed,
    est: ESTRUTURA[censo],
    metaDeOutraEdicao: !!(meta && edicaoDoMeta && edicaoDoMeta !== censo),
    r: meta?.revelacao,
    sm: meta?.salario_minimo_referencia,
    anoDe: ed.periodo.de.slice(0, 4),
    anoAte: ed.periodo.ate.slice(0, 4),
    textos: textosDoMeta(meta, lang),
  };
}

/** Título e rótulo do botão de fechar da página (components/PaginaMetodologia.tsx). Ficam aqui,
 *  num mapa dos quatro idiomas, e não nos arquivos de cada idioma, porque estes são carregados
 *  sob demanda: o cabeçalho da página precisa do texto já na primeira pintura. */
export interface RotulosPagina {
  titulo: string;
  fechar: string;
}

export const ROTULOS_PAGINA: Record<Lang, RotulosPagina> = {
  "pt-BR": { titulo: "Metodologia", fechar: "Fechar metodologia" },
  en: { titulo: "Methodology", fechar: "Close methodology" },
  fr: { titulo: "Méthodologie", fechar: "Fermer la méthodologie" },
  es: { titulo: "Metodología", fechar: "Cerrar metodología" },
};

export function useRotulosPagina(): RotulosPagina {
  return ROTULOS_PAGINA[useIdioma()];
}

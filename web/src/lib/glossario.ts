/**
 * Dicionário central de termos do atlas — fonte única dos tooltips explicativos.
 *
 * O TEXTO mora em `src/i18n/glossario/<lang>.json` (português em `pt.json`; en/fr/es no mesmo
 * formato), exposto no dicionário de idioma como `d.glossario` (ver `i18n/pt/index.ts`). Este
 * módulo guarda só os tipos, a lista de chaves e o acesso `termo(chave, d)`. O formato JSON é
 * simples de propósito (chave -> { termo, definicao, interpretacao, limitacoes? }): o gerador de
 * páginas de SEO (`pipeline/build_paginas.py`) pode lê-lo sem passar pelo TypeScript.
 *
 * Cada entrada tem três (opcionalmente quatro) campos: `termo` (título curto/sigla exibido),
 * `definicao` (o que é, com a fórmula quando ela ajuda), `interpretacao` (como ler o número:
 * domínio de valores, o que significa alto/baixo/positivo/negativo) e `limitacoes` (ressalva
 * real e documentada — quando NÃO comparar, o que a medida não captura, qual aproximação foi
 * assumida). `limitacoes` é opcional de propósito: termo sem ressalva documentada não recebe
 * uma limitação genérica só para preencher o campo.
 *
 * As definições são as de `docs/METODOLOGIA.md` (fonte de verdade metodológica), reescritas em
 * linguagem de leitor, e os limiares numéricos vêm de `pipeline/disclosure_rules.py`
 * (`CV_BOA = 15`, `CV_CAUTELA = 30`, `FAIXAS_N`) e de `pipeline/comparabilidade_regras.py`
 * (`IEM_LIMIAR_ROTATIVIDADE = 0,15`, `IEM_LIMIAR_FORTE = 1/3`, `MIN_UNIDADES_MEI = 20`).
 * Ao alterar qualquer limiar em Python, alterar o texto nos JSON de `i18n/glossario/` (todos os idiomas) — não há geração automática.
 *
 * Regra de redação: nenhuma sigla é usada dentro de uma explicação sem ser expandida na própria
 * explicação (ou na entrada correspondente, quando o texto remete a ela).
 */

import glossarioPt from "../i18n/glossario/pt.json";
import { pt, type Dicionario } from "../i18n/pt";

export interface TermoGlossario {
  /** Nome curto/sigla exibido como título do tooltip. */
  termo: string;
  /** O que é, 1-3 frases, com a fórmula quando fizer sentido. */
  definicao: string;
  /** Como ler o número: domínio de valores e o que significa alto/baixo/positivo/negativo. */
  interpretacao: string;
  /** Ressalvas documentadas. Ausente quando não há uma ressalva real. */
  limitacoes?: string;
}

/** Chaves do glossário (as de `pt.json`, que é a referência dos demais idiomas). */
export type ChaveGlossario = keyof typeof glossarioPt;

/** Termo do glossário no idioma de `d` (padrão: português), ou `undefined` quando a chave não
 *  existe. */
export function termo(chave: string, d: Dicionario = pt): TermoGlossario | undefined {
  return (d.glossario as Record<string, TermoGlossario | undefined>)[chave];
}

/** Chaves do glossário, em ordem de declaração. */
export const CHAVES_GLOSSARIO = Object.keys(glossarioPt) as ChaveGlossario[];

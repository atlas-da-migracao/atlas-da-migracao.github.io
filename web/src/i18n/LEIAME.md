# i18n do atlas — convenções

O atlas está em português (padrão e texto de referência), inglês, francês e espanhol. Não usa biblioteca de i18n: a camada própria fica em `src/i18n/`.

| Arquivo | O que é |
|---|---|
| `tipos.ts` | `Lang`, `IDIOMAS`, `lerLang`, locale dos números. Puro: sem React, sem `window`. |
| `index.ts` | `useT()` (hook), `t()` (acesso não reativo), `aplicarIdioma(lang)`. |
| `pt/<namespace>.ts` | Os textos em português, um arquivo por área da interface. Agregados em `pt/index.ts`, que define `type Dicionario = typeof pt`. |
| `en/`, `fr/`, `es/` | Mesmo formato, tipados como `Dicionario`. Se faltar uma chave, o `tsc -b` falha. Carregados sob demanda. |
| `pt/comum.ts` | Textos compartilhados (níveis, precisão, categorias dos gráficos de perfil, edições, legendas, regiões). O cabeçalho do arquivo lista os helpers de `lib/` que os expõem. |
| `glossario/<lang>.json` | O glossário (37 termos). É lido também pelo gerador de páginas de SEO (`pipeline/build_paginas.py`). |
| `dados.json` | Traduções da prosa que vem dos dados publicados (`meta.json`, `series/comparabilidade.json`). Cada entrada guarda o texto PT de `origem`, e um teste acusa quando o pipeline muda o texto. |
| `TERMINOLOGIA.md` | Base terminológica PT → EN/FR/ES. Toda tradução segue esta base. |

O idioma ativo mora na store (`lang`, espelhado em `?lang=` e salvo no `localStorage`). `setLang` chama `aplicarIdioma`.

## Regras para mover texto para o dicionário

1. **Tudo que o usuário vê ou ouve** vai para `pt/<ns>.ts`, com o texto **idêntico** ao atual. Em português, nada muda na tela. Isso inclui:
   - texto de JSX;
   - `aria-label`, `title`, `placeholder` e `alt`;
   - `document.title`;
   - rótulos de eixo e de marca de gráficos;
   - tooltips do deck.gl;
   - mensagens de estado ("Carregando…").
   
   Comentários de código continuam em português, no código.
2. **Componentes:** `const d = useT();` (de `../i18n`) e depois `d.<ns>.<chave>`. Se um `useMemo` ou `useCallback` produz texto, `d` entra nas dependências.
3. **Frases com valores viram funções no dicionário,** como `saldoDe: (nome: string, valor: string) => \`Saldo de ${nome}: ${valor}\``.
   - Nunca concatenar pedaços no componente presumindo a ordem das palavras do português. Gênero, artigo, plural ("o município" / "a UF", "1 observação" / "2 observações") e caixa são decididos **dentro** da função de cada idioma.
   - Os argumentos chegam já formatados (`num(v)` etc. de `lib/format.ts`) ou como números crus que a função formata. Os arquivos `pt/*.ts` **não importam nada de `lib/`** além de tipos (`import type`): são dados puros.
4. **Funções puras de `lib/`** que produzem texto recebem o dicionário como **último parâmetro opcional**: `d: Dicionario = pt`, com `import { pt, type Dicionario } from "../i18n/pt"`. Importe do `pt` puro, nunca de `../i18n` (o `index.ts` puxa zustand).
   - Assim os testes existentes continuam passando sem mudança.
   - Os componentes passam o `d` de `useT()`.
5. **Não se traduz:**
   - nomes próprios: municípios, UFs, RMs, regiões do IBGE, capitais, nomes de colunas e chaves de dados;
   - siglas do atlas (TLM, IEM, CMI, MEI, ANMR, RGI, RGInt, RM, RIDE), que ficam iguais em todos os idiomas;
   - códigos.
   
   Rótulos de categoria, níveis territoriais e nomes de macrorregião **se traduzem**.
6. **Números:** use sempre `num`/`num1`/`num2`/`sinal`/`sinal1`/`ic95` de `lib/format.ts`, que seguem o idioma ativo. Para um formatador próprio (eixos do Plot, moeda), use `localeNumeros()`. Não crie `new Intl.NumberFormat("pt-BR")`.
7. **Chaves:**
   - em português, curtas e descritivas, em camelCase (`fecharPainel`, `semDados`);
   - textos repetidos em várias áreas vão para `comum`, e não se duplicam.
8. **Testes:** os testes que conferem texto em português continuam valendo como estão. Se uma assinatura mudar, só se acrescenta parâmetro opcional no fim.

# Licença dos dados e do conteúdo

Este arquivo cobre os **dados agregados publicados** (`data/processed/*.parquet`,
`data/processed/*.json`, `data/processed/geo/*`), as **páginas estáticas geradas**
(`web/dist/**`, exceto o próprio código-fonte que as gera) e o **conteúdo textual** do
Atlas da migração interna no Brasil (metodologia, achados, glossário, "sobre").
O código-fonte do projeto tem uma licença separada -- ver `LICENSE` (MIT).

## Licença: CC BY 4.0

Os dados e o conteúdo listados acima estão sob a licença
**[Creative Commons Atribuição 4.0 Internacional (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.pt-br)**.

Isso significa que qualquer pessoa pode copiar, redistribuir, adaptar e usar esses
dados para qualquer finalidade, inclusive comercial, **desde que dê a atribuição
apropriada**, indique se houve alterações, e forneça um link para a licença.

### Como atribuir

Texto de atribuição padrão (usado em todas as páginas do site):

> Fonte primária: IBGE, Censo Demográfico 2022, microdados da amostra (acesso
> controlado). Estimativas: Daniel Pessini Sobreira, Atlas da migração interna no Brasil.

Para citação formal, ver `CITATION.cff` e a seção "Como citar" do `README.md`.

## Os microdados originais NÃO estão incluídos

**Importante**: esta licença cobre apenas os **agregados publicados** (tabelas
Parquet já arredondadas, suprimidas e aprovadas pelo gate de revelação R1-R9 -- ver
`docs/METODOLOGIA.md`). Os **microdados da amostra do Censo Demográfico 2022** usados
para calculá-los:

- são de **acesso controlado** do IBGE (Instituto Brasileiro de Geografia e
  Estatística);
- **não estão neste repositório** (nunca saíram do ambiente controlado do titular do
  acesso -- ver `CLAUDE.md` e `docs/CHECKLIST_PUBLICACAO.md`);
- permanecem sujeitos integralmente aos **termos de uso e confidencialidade do
  IBGE**, que regem quem pode acessá-los e sob quais condições;
- **não são redistribuídos, cedidos ou compartilhados** por este projeto sob
  nenhuma licença -- qualquer pessoa que queira acessar os microdados originais deve
  solicitar seu próprio acesso ao IBGE.

A licença CC BY 4.0 acima não outorga, e não pode outorgar, nenhum direito sobre os
microdados originais -- apenas sobre os resultados agregados, arredondados e
estatisticamente controlados que este projeto publica.

## Por que os agregados podem ser publicados livremente

Todas as tabelas em `data/processed` passaram por um controle estatístico de
revelação (regras R1-R9, ver `docs/METODOLOGIA.md` e
`docs/relatorio_revelacao_<versão>.md`): supressão de células com poucas observações,
arredondamento a múltiplos de 5, contagens amostrais publicadas apenas em faixas, e
supressão complementar. Essas regras foram desenhadas para que nenhuma célula
publicada permita identificar uma pessoa ou um domicílio individual.

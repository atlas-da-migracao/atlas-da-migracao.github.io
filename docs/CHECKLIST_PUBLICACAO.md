# Checklist de publicação

Checklist para o **titular do acesso aos microdados** (Daniel Pessini) assinar (marcar e
datar) antes do **primeiro push** para o repositório público e a cada **atualização de
dados**. Ver `CLAUDE.md`, `docs/METODOLOGIA.md` (seção "Conformidade com a política de
acesso controlado do IBGE") e o plano aprovado
(`~/.claude/plans/atue-como-um-dem-grafo-polished-crescent.md`).

Nenhum item aqui é verificável por uma sessão do Claude Code sozinha -- vários dependem de
uma decisão ou de um documento que só o titular do acesso possui (termos assinados,
e-mail de concessão do IBGE, confirmação de finalidade). Marcar um item como concluído é
uma declaração do titular, não uma checagem automática.

## Antes do primeiro push (repositório se torna público)

- [ ] **Finalidade declarada ao IBGE cobre divulgação pública de agregados.** Reli o Termo
      de Uso e Finalidade da minha concessão de acesso; ele menciona explicitamente (ou foi
      aditado para mencionar) a publicação de resultados agregados em formato de atlas/
      dashboard público. Se não cobria, solicitei o aditamento pelo mesmo canal da
      concessão e recebi confirmação por escrito.
- [ ] **Termos e e-mail de concessão arquivados.** Cópia do Termo de Compromisso de
      Confidencialidade e Responsabilidade, do Termo de Uso e Finalidade, e do e-mail de
      concessão (e do eventual aditamento acima) estão salvos em `docs/termos/`
      (gitignored -- nunca são commitados; confirmar com `git status` que nada em
      `docs/termos/` aparece como rastreável, exceto `docs/termos/README.md`).
- [ ] **Gate de revelação aprovado e relatório arquivado.** Rodei
      `python pipeline/disclosure_check.py --versao <versão>` na máquina com acesso aos
      microdados; ele terminou com "GATE APROVADO" e gerou
      `docs/relatorio_revelacao_<versão>.md`.
- [ ] **`verify_gate.py` verde.** Rodei `python pipeline/verify_gate.py` (não precisa dos
      microdados) e ele terminou com "VERIFY_GATE APROVADO".
- [ ] **`gitleaks` verde no histórico completo.** Rodei
      `gitleaks detect --source . --redact` (ou deixei o job `verificar` do CI confirmar)
      e não há segredo algum no histórico do git.
- [ ] **Nenhum arquivo de `data/raw`/`data/interim` no histórico do git.** Conferi com
      `git log --all --name-only | sort -u | grep -E '^(data/raw/|data/interim/)|\.(csv|CSV)$'`
      (excluindo `pipeline/rm_nucleo.csv`) -- lista vazia. Se o repositório já teve algum
      desses arquivos commitado em algum momento (mesmo removido depois), o histórico
      precisa ser reescrito (`git filter-repo` ou equivalente) **antes** de tornar o
      repositório público, porque remover num commit novo não apaga do histórico.
- [ ] **E-mail no-reply nos commits.** O autor Git configurado usa o e-mail público
      `129672935+Damnielps@users.noreply.github.com` (ou outro e-mail no-reply do GitHub),
      não um e-mail pessoal.
- [ ] **Rodapé/aviso de fonte em todas as páginas.** Amostrei páginas de município, UF,
      RM, home e `/dados/`: todas trazem a atribuição ao IBGE e o aviso padrão de
      `data/processed/meta.json` (regra R9).
- [ ] **Licenças no lugar.** `LICENSE` (MIT, código), `LICENSE-DADOS.md` (CC BY 4.0, dados
      e conteúdo) e `CITATION.cff` existem na raiz e refletem a autoria e as licenças
      corretas. **Confirmação da licença de código**: o orquestrador propôs MIT para o
      código; eu, titular do projeto, confirmo essa escolha antes do push (ou troco antes
      de publicar).
- [ ] **`SITE_URL` correto.** O workflow de CI usa
      `SITE_URL=https://atlas-da-migracao.github.io` (ver `.github/workflows/publicar.yml`
      e `docs/SEO.md`); o repositório de destino é
      `atlas-da-migracao/atlas-da-migracao.github.io` na organização `atlas-da-migracao`.
- [ ] **`git status` mostra só o esperado.** Antes do primeiro push, conferi que os
      arquivos novos/alterados são exatamente os documentados no relatório da sessão que
      implementou F7 (dados de `data/processed`, workflow, licenças, README etc.) -- nada
      de `data/raw`, `data/interim`, `.env`, chaves ou outro segredo.

## Depois do primeiro deploy

- [ ] **GitHub Pages com HTTPS** ativo em `https://atlas-da-migracao.github.io` (Settings
      → Pages do repositório).
- [ ] **Google Search Console**: propriedade verificada (de preferência por DNS, mais
      robusto que meta tag) e `sitemap.xml` enviado.
- [ ] **Bing Webmaster Tools**: propriedade verificada e `sitemap.xml` enviado.
- [ ] **Descrição e tópicos do repositório GitHub** preenchidos (`about`, `topics`) com
      palavras-chave como `censo-2022`, `migracao-interna`, `ibge`, `demografia`,
      `brasil`.
- [ ] **DOI no Zenodo**: gerada uma release do repositório e conectada ao Zenodo (ou
      depósito manual dos dados agregados); atualizado o placeholder "DOI a ser atribuído
      no Zenodo" em `CITATION.cff`, `/dados/` e nas páginas de município (variável
      `DOI_PLACEHOLDER` em `pipeline/build_paginas.py`) com o DOI real.

## Procedimento de atualização de dados (a cada nova versão)

Repetir sempre que os microdados forem reprocessados (nova extração, correção
metodológica, nova versão do IBGE etc.):

1. Rodar o pipeline completo na máquina com acesso aos microdados:
   `python pipeline/run.py` (ou as etapas relevantes).
2. Rodar o gate de revelação com a nova versão:
   `python pipeline/disclosure_check.py --versao <AAAA-MM-DD ou vN>`.
   Conferir que terminou em "GATE APROVADO" e que
   `docs/relatorio_revelacao_<versão>.md` foi gerado.
3. Rodar a verificação independente: `python pipeline/verify_gate.py`. Só prosseguir se
   "VERIFY_GATE APROVADO".
4. Revisar o checklist "Antes do primeiro push" acima nos itens que mudam com os dados
   (finalidade ainda válida, rodapé/aviso ainda corretos, `docs/relatorio_revelacao_*.md`
   novo arquivado).
5. `git add data/processed docs/relatorio_revelacao_<versão>.md` e qualquer outro arquivo
   alterado (código, README, metodologia). O hook `pre-commit` roda
   `pipeline/verify_gate.py` automaticamente e bloqueia o commit se o gate não estiver
   íntegro.
6. `git commit` e `git push` para `main` -- o workflow `publicar.yml` reconstrói e publica
   o site automaticamente.
7. Atualizar `version` em `CITATION.cff` e, se o Zenodo estiver conectado, considerar uma
   nova release/DOI para a nova versão dos dados.

---

Assinatura do titular do acesso: **Daniel Pessini** — data: ______________

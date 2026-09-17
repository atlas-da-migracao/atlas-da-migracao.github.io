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
      **Análise da sessão em 2026-09-06** (Termo de Compromisso de Confidencialidade e
      Responsabilidade, Microdados da Amostra do Censo 2022, assinado via gov.br em
      31/08/2026 -- CPF e e-mail institucional do titular omitidos deste registro por
      sigilo): finalidade declarada é **"Pesquisa acadêmica"**, área temática "Migrações".
      As cláusulas de sigilo/não compartilhamento (2), uso restrito (3), não reidentificação
      (4), rastreabilidade (5) e auditoria (6) tratam do **arquivo de microdados**, nunca
      publicado por este projeto -- satisfeitas pelo desenho do pipeline (gate de
      revelação + `verify_gate.py`). **O termo é omisso** sobre divulgação em formato de
      site público interativo, dataset sob licença aberta (CC BY 4.0), indexação ativa em
      buscadores e depósito com DOI -- não veda, mas também não autoriza explicitamente.
      **Resposta do IBGE recebida em 2026-09-17** (protocolo nº 20260906003, Grupo de
      Trabalho de Sigilo de Microdados, em resposta à solicitação enviada em 31/08/2026):
      > "\[...\] não é permitido o compartilhamento dos microdados do Censo Demográfico 2022
      > em repositórios de dados de pesquisa externos ao IBGE. Portanto, esse
      > compartilhamento fere o termo de compromisso disponibilizado. \[...\] Com relação aos
      > dados agregados por municípios, não há impedimento de sua disseminação, inclusive
      > com o uso de mapas. Nesse caso, recomenda-se a utilização de técnicas de Controle
      > Estatístico de Confidencialidade que, segundo o relato, já está em andamento, para
      > que não haja risco de revelação por cruzamentos rarefeitos em domínios pequenos."

      **Leitura da sessão**: a resposta cobre exatamente os dois lados da pergunta. (a) O
      que é vedado -- compartilhar os microdados em si em repositório externo -- **nunca é
      feito por este projeto** (`data/raw`/`data/interim` nunca saem da máquina, nunca são
      commitados; ver regras de sigilo em `CLAUDE.md`). (b) O que o atlas de fato publica --
      agregados por município, com mapas -- está **explicitamente autorizado**, condicionado
      ao controle estatístico de confidencialidade, que o IBGE reconhece que "já está em
      andamento" (o gate de revelação R1-R9, `pipeline/disclosure_check.py` +
      `pipeline/verify_gate.py`, descrito na solicitação original). Isso resolve a lacuna
      que o Termo de Uso e Finalidade deixava em aberto sobre o formato de divulgação
      (site público, DOI, indexação) -- a resposta não fala desses termos por nome, mas
      autoriza sem ressalva a "disseminação" de agregados municipais com mapas, que é
      exatamente essa divulgação.
      **Item permanece com a caixa em branco de propósito**: a leitura acima é da sessão,
      não uma checagem automática -- quem decide se essa resposta satisfaz o item, e marca
      a caixa, é o titular.
      **Ponto correlato, ainda em aberto, fora do escopo desta resposta do IBGE**: a
      autorização de acesso está vinculada ao vínculo institucional do titular declarado no
      Termo; o atlas publicado está em nome pessoal, sem menção a essa instituição -- vale
      confirmar internamente se a autorização concedida contemplava esse uso e essa forma
      de divulgação. Este segundo ponto não foi perguntado ao IBGE e a resposta acima não o
      resolve.
- [ ] **Termos e e-mail de concessão arquivados.** Cópia do Termo de Compromisso de
      Confidencialidade e Responsabilidade, do Termo de Uso e Finalidade, e do e-mail de
      concessão (e do eventual aditamento acima) estão salvos em `docs/termos/`
      (gitignored -- nunca são commitados; confirmar com `git status` que nada em
      `docs/termos/` aparece como rastreável, exceto `docs/termos/README.md`).
      **Verificado pela sessão em 2026-09-06:** `docs/termos/` só contém o `README.md` --
      nenhum termo foi arquivado ainda. Este item continua genuinamente pendente.
- [x] **Gate de revelação aprovado e relatório arquivado.** Rodei
      `python pipeline/disclosure_check.py --versao <versão>` na máquina com acesso aos
      microdados; ele terminou com "GATE APROVADO" e gerou
      `docs/relatorio_revelacao_<versão>.md`.
      **Verificado pela sessão em 2026-09-06:** `disclosure_check.py --versao 2026-09-06` rodou com "GATE APROVADO"; `docs/relatorio_revelacao_2026-09-06.md` existe e está commitado.

- [x] **`verify_gate.py` verde.** Rodei `python pipeline/verify_gate.py` (não precisa dos
      microdados) e ele terminou com "VERIFY_GATE APROVADO".
      **Verificado pela sessão em 2026-09-06:** "VERIFY_GATE APROVADO" — 29 arquivos conferem exatamente com o carimbo SHA-256.

- [x] **`gitleaks` verde no histórico completo.** Rodei
      `gitleaks detect --source . --redact` (ou deixei o job `verificar` do CI confirmar)
      e não há segredo algum no histórico do git.
      **Verificado pela sessão em 2026-09-06:** `gitleaks detect --source . --redact` sobre todo o histórico: "no leaks found" (a exceção em `.gitleaks.toml` cobre só os SHA-256 do `.gate_ok`, restrita por caminho).

- [x] **Nenhum arquivo de `data/raw`/`data/interim` no histórico do git.** Conferi com
      `git log --all --name-only | sort -u | grep -E '^(data/raw/|data/interim/)|\.(csv|CSV)$'`
      (excluindo `pipeline/rm_nucleo.csv` e `pipeline/genealogia_municipios.csv`, esta
      última derivada só de malhas municipais públicas do IBGE, sem microdado algum --
      ver `docs/genealogia.md` e `pipeline/build_genealogia.py`) -- lista vazia. Se o
      repositório já teve algum desses arquivos commitado em algum momento (mesmo
      removido depois), o histórico precisa ser reescrito (`git filter-repo` ou
      equivalente) **antes** de tornar o repositório público, porque remover num commit
      novo não apaga do histórico.
      **Verificado pela sessão em 2026-09-06:** busca no histórico completo (`git log --all --name-only`) sem nenhum arquivo em `data/raw/`, `data/interim/` ou `*.csv` (exceto `pipeline/rm_nucleo.csv`); o job `verificar` do CI repete essa checagem a cada push.
      **Atualizado pela sessão em 2026-09-17 (branch `comparacao-censos`):** a F12.1 acrescentou `pipeline/genealogia_municipios.csv` como segunda exceção documentada (`.gitignore`, hook `pre-commit` e job `verificar` do CI atualizados juntos) -- checagem repetida no histórico completo, sem nenhum outro arquivo de dado bruto/intermediário fora das duas exceções.

- [x] **E-mail no-reply nos commits.** O autor Git configurado usa o e-mail público
      `129672935+Damnielps@users.noreply.github.com` (ou outro e-mail no-reply do GitHub),
      não um e-mail pessoal.
      **Verificado pela sessão em 2026-09-06:** os 21 commits do histórico usam `129672935+Damnielps@users.noreply.github.com` como autor e committer (reescrito antes do primeiro push).

- [x] **Rodapé/aviso de fonte em todas as páginas.** Amostrei páginas de município, UF,
      RM, home e `/dados/`: todas trazem a atribuição ao IBGE e o aviso padrão de
      `data/processed/meta.json` (regra R9).
      **Verificado pela sessão em 2026-09-06:** `pipeline/tests/test_paginas.py` verifica automaticamente a atribuição ao IBGE e o aviso padrão em toda página gerada (73 testes, todos verdes); amostrado ao vivo em município, RM, home e `/dados/`.

- [x] **Licenças no lugar.** `LICENSE` (MIT, código), `LICENSE-DADOS.md` (CC BY 4.0, dados
      e conteúdo) e `CITATION.cff` existem na raiz e refletem a autoria e as licenças
      corretas. **Confirmação da licença de código**: o orquestrador propôs MIT para o
      código; eu, titular do projeto, confirmo essa escolha antes do push (ou troco antes
      de publicar).
      **Verificado pela sessão em 2026-09-06:** `LICENSE` (MIT), `LICENSE-DADOS.md` (CC BY 4.0) e `CITATION.cff` na raiz, com a licença de código confirmada pelo titular em 2026-09-06 ("pode enviar"). Nota: a página do repositório no GitHub mostra `NOASSERTION` no campo de licença detectada automaticamente — cosmético, comum quando há mais de um arquivo de licença no repositório; não afeta os termos reais, que estão no texto de `LICENSE`.

- [x] **`SITE_URL` correto.** O workflow de CI usa
      `SITE_URL=https://atlas-da-migracao.github.io` (ver `.github/workflows/publicar.yml`
      e `docs/SEO.md`); o repositório de destino é
      `atlas-da-migracao/atlas-da-migracao.github.io` na organização `atlas-da-migracao`.
      **Verificado pela sessão em 2026-09-06:** confirmado ao vivo: canônica, `sitemap.xml` e JSON-LD em `https://atlas-da-migracao.github.io/` usam essa URL exata.

- [x] **`git status` mostra só o esperado.** Antes do primeiro push, conferi que os
      arquivos novos/alterados são exatamente os documentados no relatório da sessão que
      implementou F7 (dados de `data/processed`, workflow, licenças, README etc.) -- nada
      de `data/raw`, `data/interim`, `.env`, chaves ou outro segredo.
      **Verificado pela sessão em 2026-09-06:** conferido com `git add -n` antes de cada commit da F7 em diante; `data/processed` tem exatamente 30 arquivos (~11 MB) versionados, nada de bruto/intermediário.

## Depois do primeiro deploy

- [x] **GitHub Pages com HTTPS** ativo em `https://atlas-da-migracao.github.io` (Settings
      → Pages do repositório).
      **Verificado pela sessão em 2026-09-06:** o site responde em `https://atlas-da-migracao.github.io/` com HSTS (`Strict-Transport-Security: max-age=31556952`); domínios `*.github.io` sem domínio próprio são servidos em HTTPS por padrão, então esta opção não se aplica/já é forçada.

- [ ] **Google Search Console**: propriedade verificada (tag `google-site-verification`
      publicada e confirmada pelo titular em 2026-09-06). **Falta:** confirmar em
      *Sitemaps* que `sitemap.xml` foi enviado -- a sessão não tem acesso ao painel para
      checar isso.
- [ ] **Bing Webmaster Tools**: propriedade verificada (tag `msvalidate.01` publicada e
      confirmada pelo titular em 2026-09-06). **Falta:** confirmar em *Sitemaps* que
      `sitemap.xml` está listado (a importação do Search Console costuma trazer
      automaticamente).
- [ ] **Descrição e tópicos do repositório GitHub.** Descrição já preenchida
      ("Atlas da migração interna no Brasil"). **Falta:** `homepage` (aponta para
      `https://atlas-da-migracao.github.io`, hoje vazio) e `topics` (hoje vazio) --
      a sessão não tem um token com permissão de escrita no repositório para fazer
      isso via API; é um ajuste de 1 minuto na engrenagem "About" da página do
      repositório.
- [x] **DOI no Zenodo**: gerada uma release do repositório e conectada ao Zenodo (ou
      depósito manual dos dados agregados); atualizado o placeholder "DOI a ser atribuído
      no Zenodo" em `CITATION.cff`, `/dados/` e nas páginas de município (variável
      `DOI_PLACEHOLDER` em `pipeline/build_paginas.py`) com o DOI real.
      **Verificado pela sessão em 2026-09-06:** release `v1.0.0` publicada e arquivada pelo Zenodo: DOI conceitual `10.5281/zenodo.22469791` (todas as versões) e DOI da versão `10.5281/zenodo.22469792`, com ORCID do autor (`0000-0002-6632-3991`) vinculado. Propagado a `CITATION.cff`, README, JSON-LD da home e das 6.331 páginas de município.

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

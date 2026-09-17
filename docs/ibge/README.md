# Documentação técnica e correspondência com o IBGE (não versionado)

Guarde aqui, fora do controle de versão (`.gitignore` bloqueia tudo em `docs/ibge/` exceto
este README, e o hook `pre-commit` recusa o commit):

- `Documentacao_Tecnica_Atlas_Migracao_IBGE.html` — fonte editável da documentação técnica
  que acompanha a consulta ao IBGE (versão 2, 06/09/2026). Contém CPF e protocolo do titular.
- `Documentacao_Tecnica_Atlas_Migracao_IBGE.pdf` — PDF gerado a partir do HTML.
- Cópias da consulta enviada e das respostas do IBGE.

Para regerar o PDF depois de editar o HTML (Chrome headless, sem dependência Python):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-pdf-header-footer --print-to-pdf="$PWD/Documentacao_Tecnica_Atlas_Migracao_IBGE.pdf" \
  "file://$PWD/docs/ibge/Documentacao_Tecnica_Atlas_Migracao_IBGE.html"
```

O inventário do Anexo A e o relatório do Anexo B devem ser atualizados a cada nova versão dos
dados (ver `docs/relatorio_revelacao_<versão>.md` e `data/processed/.gate_ok`).

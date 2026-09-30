# pipeline/assets

Arquivos estáticos usados pelos geradores do pipeline. Nada aqui é dado do Censo.

## Fontes (imagem OG, `pipeline/build_paginas.py`)

`gerar_og_image()` desenha `og.png` (1200x630) com Pillow. Antes usava fontes do macOS
(`/System/Library/Fonts/Supplemental/Arial*.ttf`), que não existem no runner Linux do CI: o
`except OSError` caía em `ImageFont.load_default()` (bitmap de ~10 px, sem os glifos do português)
e a imagem de produção saía com o texto minúsculo e incompleto. As duas TTFs abaixo são carregadas
por caminho relativo à raiz do repositório e funcionam igual em qualquer sistema.

| arquivo | uso | SHA-256 |
|---|---|---|
| `DejaVuSans-Bold.ttf` | título | `e6476c1b80502924294eed40894c5b18e06c181444ca953e5334262df9c27724` |
| `DejaVuSans.ttf` | subtítulo | `7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954` |

- Família: DejaVu Sans, versão 2.37 (30/07/2016), sem modificação.
- Origem: release oficial `version_2_37` de <https://github.com/dejavu-fonts/dejavu-fonts>,
  asset `dejavu-fonts-ttf-2.37.tar.bz2` (SHA-256 do tarball:
  `fa9ca4d13871dd122f61258a80d01751d603b4d3ee14095d65453b4e846e17d7`), pasta `ttf/`.
- Licença: Bitstream Vera Fonts Copyright + domínio público para as alterações do DejaVu —
  permite uso, cópia, redistribuição e venda junto com outro software, desde que o aviso de
  direitos e a licença acompanhem as cópias. O texto integral está em `LICENSE-DejaVu.txt`.
  As fontes não podem ser alteradas e redistribuídas com o nome "Bitstream" ou "Vera"; por isso
  ficam aqui exatamente como foram distribuídas.
- Cobertura: Latin-1 e Latin Extended completos (acentos do português), `·` (U+00B7) e `–`.

Se precisar trocar de fonte, registre aqui a origem, a licença e o SHA-256 antes de commitar.

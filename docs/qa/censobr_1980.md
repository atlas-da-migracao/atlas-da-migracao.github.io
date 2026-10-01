# censobr/IPEA v1.0.0 como fonte da edição Censo 1980 — gates de identidade

Gerado por `scripts/prep_1980_censobr.py` em 2026-10-01. Só agregados; nenhuma linha individual foi lida ou impressa.

- Entrada: `1980_population_v1.0.0.parquet` (https://github.com/ipea/censobr_prep_data/releases/tag/v1.0.0), SHA-256 `0bb8cdf0001aa7e830933bb47ee29fe8fcb28392bfa1083c272788df51e89616`.
- Referência: os Parquet extraídos da Base dos Dados (`scripts/extract_1980_bd.py`, F9.1), guardados em `data/raw1980/bd/`.
- Tolerância declarada: 1 registro por UF em G1-G4 (2 linhas divergentes, uma de cada lado). Casos que a consomem: MS (peso 14 na BD, 4 no censobr e na cópia DBF do IBGE), PI (um registro com `v517` diferente) e MT (um registro com `v211` diferente) -- colunas identificadas por marginais, causa não investigada (sigilo). G5/G5b não têm tolerância.

Colunas de cada gate: G1 `v604`; G2 núcleo (`v598`, `v211`, `v501`, `v503`, `v509`, `v511`, `v512`, `v513`, `v514`, `v515`, `v516`, `v517`, `v604`, `v606`); G3 escolaridade (`v520`, `v521`, `v522`, `v523`, `v524`, 5 anos ou mais) e trabalho (`v528`, `v529`, `v530`, `v532`, `v533`, `v527`, 10 anos ou mais); G4 núcleo + `v518` (BD normalizada: NULL → '0000000'; Ceará 6 dígitos → 6 + dígito verificador); G5 código de município onde a BD o tem. 'Divergentes' = registros em grupos cuja contagem difere entre as duas fontes.

| UF | n BD | n censobr | Σ peso BD | Σ peso censobr | G1 | G2 | G3 edu | G3 trab | G4 | G5 | BD sem município | códigos só no censobr (registros) | ok |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| RO | 116.536 | 116.536 | 491.025 | 491.025 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| AC | 70.503 | 70.503 | 301.276 | 301.276 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| AM | 338.052 | 338.052 | 1.430.528 | 1.430.528 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| RR | 18.323 | 18.323 | 79.121 | 79.121 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| PA | 828.740 | 828.740 | 3.403.498 | 3.403.498 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| AP | 42.752 | 42.752 | 175.258 | 175.258 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| FN | 298 | 298 | 1.274 | 1.274 | 0 | 0 | 0 | 0 | 0 | 0 | 298 | 1 (298) | sim |
| MA | 973.793 | 973.793 | 3.996.444 | 3.996.444 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| PI | 514.497 | 514.497 | 2.139.196 | 2.139.196 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 (0) | sim |
| CE | 1.307.351 | 1.307.351 | 5.288.429 | 5.288.429 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| RN | 472.982 | 472.982 | 1.898.835 | 1.898.835 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| PB | 699.007 | 699.007 | 2.770.346 | 2.770.346 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| PE | 1.521.170 | 1.521.170 | 6.142.229 | 6.142.229 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| AL | 490.216 | 490.216 | 1.982.915 | 1.982.915 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| SE | 292.409 | 292.409 | 1.140.379 | 1.140.379 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| BA | 2.345.216 | 2.345.216 | 9.455.392 | 9.455.392 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| MG | 3.329.884 | 3.329.884 | 13.380.105 | 13.380.105 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| ES | 501.651 | 501.651 | 2.023.338 | 2.023.338 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| RJ | 2.779.456 | 2.779.456 | 11.291.631 | 11.291.631 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| SP | 6.206.465 | 6.206.465 | 25.042.074 | 25.042.074 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| PR | 1.876.014 | 1.876.014 | 7.629.849 | 7.629.849 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| SC | 891.701 | 891.701 | 3.628.292 | 3.628.292 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| RS | 1.925.700 | 1.925.700 | 7.773.849 | 7.773.849 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |
| MS | 328.244 | 328.244 | 1.369.779 | 1.369.769 | 2 | 2 | 2 | 2 | 2 | 0 | 0 | 0 (0) | sim |
| MT | 264.639 | 264.639 | 1.138.918 | 1.138.918 | 0 | 2 | 2 | 2 | 2 | 0 | 0 | 0 (0) | sim |
| GO | 953.137 | 953.137 | 3.860.174 | 3.860.174 | 0 | 0 | 0 | 0 | 0 | 0 | 178.338 | 52 (178.338) | sim |
| DF | 290.017 | 290.017 | 1.176.908 | 1.176.908 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (0) | sim |

Totais: BD 29.378.753 registros / Σ peso 119.011.062; censobr 29.378.753 / 119.011.052.

## O que difere, por construção

- **Município de residência**: a BD não o tem em 178.636 registros (52 municípios do norte de Goiás + Fernando de Noronha); o censobr traz `code_muni` na malha de 1980 para todos (`52xxxxx` e `2000107`), recodificados no pipeline por `pipeline/norte_goias_1980.py`.
- **Universos**: o censobr, como a cópia DBF pública do IBGE, zera a escolaridade (`v520`-`v524`) de menores de 5 anos e deixa NULL o trabalho (`v528`-`v533`) e o município de trabalho/estudo (`v527`) de menores de 10; a BD trazia os valores brutos. O pipeline já restringia ocupação a 10 anos ou mais; o efeito real é que o deslocamento pendular de estudo de 1980 passa a cobrir só quem tem 10 anos ou mais, e `freq_escolar` de menores de 5 anos passa a 'não frequenta'.
- **`numero_ordem`** (V500) não existe no censobr e sai NULL; a edição não a usa.
- **Renda** (`v607`-`v613`, `v680`-`v682`): a BD só a tem no Ceará; o censobr a traz em todas as UFs. A edição continua sem publicar renda (fora dos gates).
- **Um registro de MS** com peso 14 na BD e 4 no censobr; a cópia DBF do IBGE dá 4 (Σ PESOP de MS = 1.369.769, igual ao censobr).


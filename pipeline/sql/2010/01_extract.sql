-- F2 (edição Censo 2010): Extração das 27 UFs (Pessoas + Domicílios), com os 14 municípios de
-- áreas de ponderação redefinidas SUBSTITUÍDOS pelo pacote próprio, para Parquet intermediário.
-- Override de pipeline/sql/01_extract.sql. Lê apenas colunas necessárias às fases seguintes;
-- nunca materializa linhas individuais em log.
--
-- Os arquivos são TXT de largura fixa (não CSV): lidos com read_csv(delim=chr(1), quote='')
-- para virar uma única coluna VARCHAR por linha (truque padrão para largura fixa no DuckDB --
-- nenhum byte chr(1) ocorre nos dados, então nunca há split). Posições 1-based, extraídas com
-- SUBSTR(linha, posição_inicial, tamanho), verificadas contra pipeline/layout_2010.py.
--
-- Os 14 municípios com áreas de ponderação redefinidas (ver
-- "Notas Metodológicas - Microdados da Amostra-2010_14 municípios.pdf") têm pesos recalibrados
-- num pacote PARALELO (mesmas posições de byte, V0010/V0011 renomeadas para V0014/V0015 só na
-- documentação): os registros desses 14 códigos são EXCLUÍDOS do pacote por UF e substituídos
-- pelo pacote `_14munic`, para não contar a população duas vezes (ver plano, decisão 7).
--
-- Mapeamento de variáveis, decisões de recode e ressalvas de comparabilidade com 2022: ver
-- pipeline/sql/2010/02_classify.sql (cabeçalho) e a seção "Edição Censo 2010 e comparabilidade"
-- de docs/METODOLOGIA.md.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

COPY (
    WITH linhas AS (
        SELECT linha
        FROM read_csv('data/raw2010/*/Amostra_Pessoas_*.txt',
                       delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        WHERE SUBSTR(linha, 1, 7) NOT IN (
            '2105302', '2408102', '2910800', '2927408', '3304557', '4115200', '4119905',
            '4305108', '4313409', '4314407', '4314902', '4315602', '4316907', '4323002'
        )
        UNION ALL
        SELECT linha
        FROM read_csv(
            'data/raw2010/microdados_ 14_municipios_com_areas_redefinidas/Dados/Amostra_Pessoas_14munic.txt',
            delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    )
    SELECT
        SUBSTR(linha, 1, 2)                                        AS uf,
        SUBSTR(linha, 1, 7)                                        AS cd_mun,
        SUBSTR(linha, 8, 13)                                       AS cd_apond,
        -- controle = área de ponderação || controle (V0300 sozinho não tem unicidade nacional
        -- documentada; ver plano/relatório do metodólogo, decisão D2)
        SUBSTR(linha, 8, 13) || SUBSTR(linha, 21, 8)                AS controle,
        CAST(SUBSTR(linha, 29, 16) AS DOUBLE) / 1e13                AS peso,
        TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 58, 1)), '') AS INTEGER) AS sexo,
        TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 62, 3)), '') AS INTEGER) AS idade,
        -- nasc_local recodificado para o vocabulário de P0480 (1 neste município / 2 outro
        -- município do Brasil / 3 exterior), combinando V0618 (nasceu neste município) com
        -- V0622 (UF ou país estrangeiro, só preenchido quando V0618=3)
        CASE
            WHEN SUBSTR(linha, 74, 1) IN ('1', '2')                        THEN '1'
            WHEN SUBSTR(linha, 74, 1) = '3' AND SUBSTR(linha, 81, 1) = '2' THEN '3'
            WHEN SUBSTR(linha, 74, 1) = '3'                                THEN '2'
        END                                                         AS nasc_local,
        -- nasc_uf: a própria UF de residência quando nasceu no município/UF atual (V6222 fica
        -- em branco nesses casos); senão, os 2 primeiros dígitos de V6222 (formato UF||'00000')
        CASE
            WHEN SUBSTR(linha, 74, 1) IN ('1', '2') THEN SUBSTR(linha, 1, 2)
            WHEN SUBSTR(linha, 75, 1) IN ('1', '2') THEN SUBSTR(linha, 1, 2)
            WHEN SUBSTR(linha, 81, 1) = '1'          THEN SUBSTR(linha, 82, 2)
        END                                                         AS nasc_uf,
        CAST(NULL AS VARCHAR)                                       AS nasc_mun,   -- inexistente em 2010
        CAST(NULL AS VARCHAR)                                       AS nasc_pais,  -- não usado a jusante
        NULLIF(TRIM(SUBSTR(linha, 76, 1)), '')                      AS nacionalidade,
        -- df_local recodificado para o vocabulário de P0600 (1 neste município / 2 outro
        -- município do Brasil / 3 exterior); branco = não migrante (mora 6+ anos, ou <5 anos).
        -- V0626='1' sozinho NÃO implica migrante: V0624 ("tempo de moradia no município") conta
        -- anos DESDE O ÚLTIMO RETORNO, não o tempo total -- alguém que sempre morou aqui, saiu e
        -- voltou há <6 anos responde ao quesito e pode legitimamente reportar 2005 no PRÓPRIO
        -- município (antes de sair). Por isso só vira migrante quando o município reportado
        -- (V6264) é conhecido e DIFERENTE do atual; achado e corrigido a partir da auditoria do
        -- checkpoint F2 (ver docs/METODOLOGIA.md, "Edição Censo 2010 e comparabilidade").
        CASE
            WHEN SUBSTR(linha, 124, 1) = '1' AND SUBSTR(linha, 132, 7) = SUBSTR(linha, 1, 7) THEN '1'
            WHEN SUBSTR(linha, 124, 1) = '1'                                                 THEN '2'
            WHEN SUBSTR(linha, 124, 1) = '2'                                                 THEN '3'
        END                                                          AS df_local,
        NULLIF(TRIM(SUBSTR(linha, 125, 2)), '')                     AS df_uf,
        NULLIF(TRIM(SUBSTR(linha, 132, 7)), '')                     AS df_mun,
        CAST(NULL AS VARCHAR)                                       AS df_pais,     -- não usado a jusante
        NULLIF(TRIM(SUBSTR(linha, 147, 1)), '')                     AS freq_escolar,
        NULLIF(TRIM(SUBSTR(linha, 148, 2)), '')                     AS curso,
        CAST(NULL AS VARCHAR)                                       AS nivel_instr_7, -- não usado a jusante
        NULLIF(TRIM(SUBSTR(linha, 158, 1)), '')                     AS nivel_instr_4,
        CAST(NULL AS INTEGER)                                       AS anos_estudo,   -- não usado a jusante
        NULLIF(TRIM(SUBSTR(linha, 168, 1)), '')                     AS estudo_local,
        NULLIF(TRIM(SUBSTR(linha, 169, 2)), '')                     AS estudo_uf,
        NULLIF(TRIM(SUBSTR(linha, 176, 7)), '')                     AS estudo_mun,
        CAST(NULL AS VARCHAR)                                       AS estudo_pais,  -- não usado a jusante
        NULLIF(TRIM(SUBSTR(linha, 393, 1)), '')                     AS ocupado_10,   -- V6920
        NULLIF(TRIM(SUBSTR(linha, 394, 1)), '')                     AS pos_ocup,     -- V6930
        NULLIF(TRIM(SUBSTR(linha, 204, 5)), '')                     AS atividade,    -- V6471 (CNAE-DOM 2.0)
        NULLIF(TRIM(SUBSTR(linha, 200, 4)), '')                     AS grande_grupo, -- V6461 (COD 2010)
        -- renda_trab já em salários mínimos (V6514, 4 int + 2 dec) -- ver 02_classify.sql
        TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 225, 6)), '') AS DOUBLE) / 1e2 AS renda_trab,
        CAST(NULL AS DOUBLE)                                        AS renda_todas_fontes, -- não usado a jusante
        NULLIF(TRIM(SUBSTR(linha, 328, 1)), '')                     AS trab_local,
        NULLIF(TRIM(SUBSTR(linha, 329, 2)), '')                     AS trab_uf,
        NULLIF(TRIM(SUBSTR(linha, 336, 7)), '')                     AS trab_mun,
        CAST(NULL AS VARCHAR)                                       AS trab_pais,    -- não usado a jusante
        NULLIF(TRIM(SUBSTR(linha, 350, 1)), '')                     AS retorna_3dias, -- V0661 (definição diferente, ver 02_classify)
        CAST(NULL AS VARCHAR)                                       AS transporte,   -- inexistente em 2010
        NULLIF(TRIM(SUBSTR(linha, 351, 1)), '')                     AS tempo_desloc_cat, -- V0662, 5 faixas próprias
        CAST(NULL AS INTEGER)                                       AS tempo_desloc_min, -- inexistente em 2010
        CAST(NULL AS VARCHAR)                                       AS imp_df_local, -- marcas de imputação: não usadas a jusante
        CAST(NULL AS VARCHAR)                                       AS imp_df_mun,
        CAST(NULL AS VARCHAR)                                       AS imp_trab_mun
    FROM linhas
) TO 'data/interim/2010/pessoas.parquet' (FORMAT PARQUET);

COPY (
    WITH linhas AS (
        SELECT linha
        FROM read_csv('data/raw2010/*/Amostra_Domicilios_*.txt',
                       delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        WHERE SUBSTR(linha, 1, 7) NOT IN (
            '2105302', '2408102', '2910800', '2927408', '3304557', '4115200', '4119905',
            '4305108', '4313409', '4314407', '4314902', '4315602', '4316907', '4323002'
        )
        UNION ALL
        SELECT linha
        FROM read_csv(
            'data/raw2010/microdados_ 14_municipios_com_areas_redefinidas/Dados/Amostra_Domicilios_14munic.txt',
            delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    )
    SELECT
        SUBSTR(linha, 1, 2)                          AS uf,
        SUBSTR(linha, 1, 7)                           AS cd_mun,
        SUBSTR(linha, 8, 13)                          AS cd_apond,
        SUBSTR(linha, 8, 13) || SUBSTR(linha, 21, 8)  AS controle,
        CAST(NULL AS VARCHAR)                         AS tipo_domicilio, -- não usado a jusante
        -- renda per capita já em salários mínimos (V6532, registro de domicílios: 4 int + 5 dec)
        TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 134, 9)), '') AS DOUBLE) / 1e5 AS renda_pc
    FROM linhas
) TO 'data/interim/2010/domicilios.parquet' (FORMAT PARQUET);

COPY (
    SELECT cd_apond, COUNT(*) AS n_h
    FROM read_parquet('data/interim/2010/domicilios.parquet')
    GROUP BY cd_apond
) TO 'data/interim/2010/domicilios_apond.parquet' (FORMAT PARQUET);

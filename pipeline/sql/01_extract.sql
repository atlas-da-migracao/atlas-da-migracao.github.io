-- F1: Extração das 27 UFs (Pessoas + Domicílios) para Parquet intermediário.
-- Lê apenas colunas necessárias às fases seguintes; nunca materializa linhas individuais em log.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

COPY (
    SELECT
        P0020                                   AS uf,
        P0080                                   AS cd_mun,
        P0090                                   AS cd_apond,
        P0100                                   AS controle,
        CAST(P0111 AS DOUBLE)                   AS peso,
        TRY_CAST(P0150 AS INTEGER)               AS sexo,
        TRY_CAST(P0181 AS INTEGER)               AS idade,
        P0480                                   AS nasc_local,
        P0490                                   AS nasc_uf,
        P0500                                   AS nasc_mun,
        P0510                                   AS nasc_pais,
        P0520                                   AS nacionalidade,
        P0600                                   AS df_local,
        P0610                                   AS df_uf,
        P0620                                   AS df_mun,
        P0630                                   AS df_pais,
        P0650                                   AS freq_escolar,
        P0660                                   AS curso,
        P0760                                   AS nivel_instr_7,
        P0770                                   AS nivel_instr_4,
        TRY_CAST(NULLIF(P0790, '') AS INTEGER)   AS anos_estudo,
        P0800                                   AS estudo_local,
        P0810                                   AS estudo_uf,
        P0820                                   AS estudo_mun,
        P0830                                   AS estudo_pais,
        P0960                                   AS ocupado_10,
        P1020                                   AS pos_ocup,
        P1030                                   AS atividade,
        P1040                                   AS grande_grupo,
        TRY_CAST(NULLIF(P1080, '') AS DOUBLE)    AS renda_trab,
        TRY_CAST(NULLIF(P1110, '') AS DOUBLE)    AS renda_todas_fontes,
        P1120                                   AS trab_local,
        P1130                                   AS trab_uf,
        P1140                                   AS trab_mun,
        P1150                                   AS trab_pais,
        P1160                                   AS retorna_3dias,
        P1170                                   AS transporte,
        P1180                                   AS tempo_desloc_cat,
        TRY_CAST(NULLIF(P1190, '') AS INTEGER)   AS tempo_desloc_min,
        MP0600                                  AS imp_df_local,
        MP0620                                  AS imp_df_mun,
        MP1140                                  AS imp_trab_mun
    FROM read_csv(
        'data/raw/*/Pessoas_*_controlado.csv',
        sep = ';', header = true, all_varchar = true, union_by_name = true
    )
) TO 'data/interim/pessoas.parquet' (FORMAT PARQUET);

COPY (
    SELECT
        D0020                                  AS uf,
        D0080                                  AS cd_mun,
        D0090                                  AS cd_apond,
        D0100                                  AS controle,
        D0130                                  AS tipo_domicilio,
        TRY_CAST(NULLIF(D0360, '') AS DOUBLE)  AS renda_pc
    FROM read_csv(
        'data/raw/*/Domicilios_*_controlado.csv',
        sep = ';', header = true, all_varchar = true, union_by_name = true
    )
) TO 'data/interim/domicilios.parquet' (FORMAT PARQUET);

COPY (
    SELECT cd_apond, COUNT(*) AS n_h
    FROM read_parquet('data/interim/domicilios.parquet')
    GROUP BY cd_apond
) TO 'data/interim/domicilios_apond.parquet' (FORMAT PARQUET);

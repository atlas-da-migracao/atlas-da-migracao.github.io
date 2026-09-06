"""Gera data/processed/meta.json: rótulos, cortes, limiares e versão dos dados.

Consolida as constantes usadas no pipeline (disclosure_rules.py) para que o front-end
não precise duplicá-las.
"""
import datetime as dt
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import disclosure_rules as R  # noqa: E402

SALARIO_MINIMO_2022 = 1212.00

ROTULOS = {
    "status": {
        "retorno_natal": "Retorno ao município natal",
        "primeira_saida": "Primeira saída do município natal",
        "etapas_multiplas": "Migração de etapas múltiplas",
        "nascido_exterior": "Nascido no exterior, migrante interno",
        "internacional_brasileiro": "Retorno do exterior (brasileiro)",
        "internacional_estrangeiro": "Imigração internacional (estrangeiro)",
        "origem_nao_informada": "Origem não informada",
        "outros": "Outros / suprimido",
    },
    "edu": {
        "sem_instr_fund_incompleto": "Sem instrução ou fundamental incompleto",
        "fund_completo_medio_incompleto": "Fundamental completo, médio incompleto",
        "medio_completo_superior_incompleto": "Médio completo, superior incompleto",
        "superior_completo": "Superior completo",
        "nao_determinado": "Não determinado",
        "outros": "Outros / suprimido",
    },
    "renda": {
        "ate_1_4_sm": "Até 1/4 de salário mínimo",
        "de_1_4_a_1_2_sm": "De 1/4 a 1/2 salário mínimo",
        "de_1_2_a_1_sm": "De 1/2 a 1 salário mínimo",
        "de_1_a_2_sm": "De 1 a 2 salários mínimos",
        "mais_de_2_sm": "Mais de 2 salários mínimos",
        "nao_aplicavel": "Não aplicável (domicílio coletivo)",
        "outros": "Outros / suprimido",
    },
    "idade_sexo": {
        "05_14_M": "5 a 14 anos, masculino", "05_14_F": "5 a 14 anos, feminino",
        "15_24_M": "15 a 24 anos, masculino", "15_24_F": "15 a 24 anos, feminino",
        "25_39_M": "25 a 39 anos, masculino", "25_39_F": "25 a 39 anos, feminino",
        "40_59_M": "40 a 59 anos, masculino", "40_59_F": "40 a 59 anos, feminino",
        "60_mais_M": "60 anos ou mais, masculino", "60_mais_F": "60 anos ou mais, feminino",
        "outros": "Outros / suprimido",
    },
    "frequencia": {"retorno_diario": "Retorna 3+ dias/semana", "semanal_longa": "Retorno semanal ou mais longo"},
    "modo": {
        "a_pe_bicicleta": "A pé ou bicicleta", "motocicleta": "Motocicleta ou mototáxi",
        "automovel_taxi": "Automóvel ou táxi", "onibus_van_brt": "Ônibus, van ou BRT",
        "trem_metro": "Trem ou metrô", "outros": "Outros",
    },
    "posicao": {
        "empregado_com_carteira": "Empregado com carteira", "empregado_sem_carteira": "Empregado sem carteira",
        "militar_estatutario": "Militar ou estatutário", "empregador": "Empregador",
        "conta_propria_familiar": "Conta própria ou familiar",
    },
    "setor": {
        "agropecuaria": "Agropecuária", "industria": "Indústria", "construcao": "Construção",
        "comercio": "Comércio", "transporte_logistica": "Transporte e logística",
        "servicos_empresariais": "Serviços empresariais", "admin_educacao_saude": "Administração, educação e saúde",
        "outros_servicos": "Outros serviços",
    },
    "renda_trab": {
        "sem_declaracao": "Sem declaração", "ate_1_sm": "Até 1 salário mínimo",
        "de_1_a_2_sm": "De 1 a 2 salários mínimos", "de_2_a_3_sm": "De 2 a 3 salários mínimos",
        "de_3_a_5_sm": "De 3 a 5 salários mínimos", "mais_de_5_sm": "Mais de 5 salários mínimos",
    },
    "nivel": {
        "infantil_fundamental": "Infantil ou fundamental", "medio": "Médio",
        "graduacao": "Graduação", "pos_graduacao": "Pós-graduação",
    },
}


def main() -> None:
    meta = {
        "versao_dados": dt.date.today().isoformat(),
        "gerado_em": dt.datetime.now().isoformat(timespec="seconds"),
        "fonte": "IBGE, Censo Demográfico 2022, microdados da amostra (acesso controlado)",
        "periodo_referencia": {"de": "2017-07-31", "ate": "2022-07-31"},
        "salario_minimo_referencia": SALARIO_MINIMO_2022,
        "revelacao": {
            "min_pessoas": R.MIN_PESSOAS,
            "min_domicilios": R.MIN_DOMICILIOS,
            "min_pessoas_detalhe": R.MIN_PESSOAS_DETALHE,
            "arredondamento": R.ARREDONDAMENTO,
            "cv_boa": R.CV_BOA,
            "cv_cautela": R.CV_CAUTELA,
        },
        "rotulos": ROTULOS,
        "aviso": (
            "Estimativas elaboradas pelo autor a partir dos microdados da amostra do "
            "Censo Demográfico 2022 (IBGE, acesso controlado), sujeitas a erro amostral "
            "e a controle estatístico de revelação; podem divergir das tabulações "
            "oficiais do IBGE (SIDRA)."
        ),
    }
    dest = pathlib.Path("data/processed/meta.json")
    dest.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"meta.json: {dest.stat().st_size} bytes")


if __name__ == "__main__":
    main()

"""Regras de comparabilidade entre as cinco edições do atlas (F12.2) — fonte única.

Este módulo é a **fonte única** das decisões metodológicas da seção "Ao longo dos censos":
para cada combinação (medida, edição, nível) ele devolve um `Estado` — `comparavel`,
`comparavel_com_ressalva` ou `nao_comparavel` — e uma `nota` (chave curta de texto, resolvida
em `NOTAS`), que o front usa para escolher o tooltip. Também concentra:

- a **regra dura de escala** (Courgeau/MAUP): quais medidas podem ser lidas entre níveis
  territoriais diferentes e quais só podem ser lidas *dentro* de um nível;
- o **limiar de cobertura populacional** das agregações (RGI, RGInt, UF, RM) e os estados de
  cobertura de uma célula;
- os **fatores de calibração do proxy de 1980**;
- a **harmonização de vocabulário** (`status`, `idade_sexo`, `edu`, `renda`) entre edições;
- a **tipologia de Baeninger** sobre o índice de eficácia migratória (IEM).

`pipeline/build_series.py` (F12.4) importa daqui e grava `data/processed/series/
comparabilidade.json` chamando `payload()`. Nada neste módulo lê dado: são só regras.
A justificativa, os números da calibração e as referências estão em `docs/METODOLOGIA.md`,
seção "Comparação entre censos (F12)".

Regra de sigilo: este módulo não toca `data/raw*` nem `data/interim*`; os limiares que ele
declara foram calibrados sobre `data/processed/**`, que é agregado já aprovado no gate.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

# --------------------------------------------------------------------------------------
# Eixos
# --------------------------------------------------------------------------------------

#: Edições da série, da mais nova para a mais antiga (ordem de exibição do atlas).
EDICOES: tuple[str, ...] = ("2022", "2010", "2000", "1991", "1980")

#: Níveis territoriais da série. `mun` inclui a unidade agregada `NORTEGO` em 1980.
NIVEIS: tuple[str, ...] = ("mun", "rgi", "rgint", "uf", "rm")

#: Níveis de agregação, os únicos em que a cobertura territorial é uma questão (o nível
#: municipal não tem cobertura parcial: ou o município existe na edição, ou não existe).
NIVEIS_AGREGADOS: tuple[str, ...] = ("rgi", "rgint", "uf", "rm")


class Estado(str, Enum):
    """Estado de comparabilidade de uma célula (medida × edição × nível)."""

    COMPARAVEL = "comparavel"
    COM_RESSALVA = "comparavel_com_ressalva"
    NAO_COMPARAVEL = "nao_comparavel"


@dataclass(frozen=True)
class Regra:
    estado: Estado
    nota: str | None = None

    def dict(self) -> dict[str, str | None]:
        return {"estado": self.estado.value, "nota": self.nota}


# --------------------------------------------------------------------------------------
# O que cada edição mede (resumo operacional; a prosa está em docs/METODOLOGIA.md)
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Capacidades:
    """O que a edição mede, no vocabulário de que as regras precisam.

    `erro_amostral`: 'publicado' (área de ponderação real), 'aproximado' (estrato substituto,
    1991) ou 'ausente' (1980, sem chave de domicílio).
    `status`: 'completo' (2022, separa primeira saída de etapas múltiplas) ou 'reduzido'.
    `estudo`: 'total', 'piso' (quesito único com precedência do trabalho) ou None.
    `limiar_revelacao`: 'padrao' (n>=5 e >=3 domicílios) ou 'elevado' (n>=20, sem domicílio).
    """

    migracao: str  # 'data_fixa' | 'proxy_ultima_etapa'
    pendular: bool
    pendular_tempo: bool
    pendular_frequencia: bool
    pendular_modo: bool
    pendular_posicao: bool
    estudo: str | None
    renda: bool
    erro_amostral: str
    status: str
    limiar_revelacao: str


CAPACIDADES: dict[str, Capacidades] = {
    "2022": Capacidades(
        migracao="data_fixa", pendular=True, pendular_tempo=True, pendular_frequencia=True,
        pendular_modo=True, pendular_posicao=True, estudo="total", renda=True,
        erro_amostral="publicado", status="completo", limiar_revelacao="padrao",
    ),
    "2010": Capacidades(
        migracao="data_fixa", pendular=True, pendular_tempo=True, pendular_frequencia=True,
        pendular_modo=False, pendular_posicao=True, estudo="total", renda=True,
        erro_amostral="publicado", status="reduzido", limiar_revelacao="padrao",
    ),
    "2000": Capacidades(
        migracao="data_fixa", pendular=True, pendular_tempo=False, pendular_frequencia=False,
        pendular_modo=False, pendular_posicao=True, estudo="piso", renda=True,
        erro_amostral="publicado", status="reduzido", limiar_revelacao="padrao",
    ),
    "1991": Capacidades(
        migracao="data_fixa", pendular=False, pendular_tempo=False, pendular_frequencia=False,
        pendular_modo=False, pendular_posicao=False, estudo=None, renda=True,
        erro_amostral="aproximado", status="reduzido", limiar_revelacao="padrao",
    ),
    "1980": Capacidades(
        migracao="proxy_ultima_etapa", pendular=True, pendular_tempo=False,
        pendular_frequencia=False, pendular_modo=False, pendular_posicao=False, estudo="piso",
        renda=False, erro_amostral="ausente", status="reduzido", limiar_revelacao="elevado",
    ),
}

# --------------------------------------------------------------------------------------
# Catálogo de medidas
# --------------------------------------------------------------------------------------

#: Requisitos que uma medida pode ter. Um requisito não atendido pela edição já decide a
#: célula (ver `regra()`), sem precisar de exceção explícita medida a medida.
REQUISITOS = (
    "migracao",          # matriz/volumes de migração (todas as edições têm)
    "pendular",          # módulo de deslocamento pendular (1991 não tem)
    "pendular_tempo",
    "pendular_frequencia",
    "pendular_modo",
    "pendular_posicao",
    "estudo",            # fluxo pendular para estudo
    "renda",             # qualquer dimensão de renda (1980 não tem)
    "erro_amostral",     # se/cv publicados
    "fluxos_publicados",  # depende do conjunto de pares que sobrevive a R1/R2
    "composicao_interna",  # depende da partição municipal *dentro* da unidade
)


@dataclass(frozen=True)
class Medida:
    """Definição formal de uma medida da série.

    `entre_niveis`: True quando a medida pode ser lida comparando níveis territoriais
    diferentes (município × RGI × UF). False quando a leitura entre níveis é proibida pela
    regra dura de escala — ver `ESCALA`, `docs/METODOLOGIA.md` e Rees et al. (2017).
    `excecoes`: desvio explícito do padrão para uma edição, `edicao -> Regra`.
    """

    chave: str
    rotulo: str
    bloco: int                      # 1 unidade | 2 sistema | 3 fluxos | 4 perfil
    formula: str
    referencia: str
    niveis: tuple[str, ...] = NIVEIS
    entre_niveis: bool = False
    requer: tuple[str, ...] = ("migracao",)
    excecoes: dict[str, Regra] = field(default_factory=dict)
    #: quando a medida é de nível (volume/taxa) e tem fator de calibração em 1980
    calibracao_1980: str | None = None


def _r(estado: Estado, nota: str | None = None) -> Regra:
    return Regra(estado, nota)


_COM = Estado.COM_RESSALVA
_NAO = Estado.NAO_COMPARAVEL

# Exceções que se repetem: 1980 é proxy de data fixa e o erro do proxy tem direção conhecida.
_PROXY_VOLUME = {"1980": _r(_COM, "proxy_1980_volume")}
_PROXY_SALDO = {"1980": _r(_COM, "proxy_1980_saldo")}
_PROXY_RAZAO = {"1980": _r(_COM, "proxy_1980_razao")}

MEDIDAS: tuple[Medida, ...] = (
    # ---------------- Bloco 1 — medidas da unidade -------------------------------------
    Medida(
        "imig", "Imigração", 1, "D = Σ_j M_ji (entradas na unidade, origem informada)",
        "Bell et al. (2002), JRSS-A 165(3):435–464",
        calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "emig", "Emigração", 1, "O = Σ_j M_ij", "Bell et al. (2002)",
        calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "saldo", "Saldo migratório", 1, "N = D − O", "Bell et al. (2002)",
        calibracao_1980="saldo", excecoes=dict(_PROXY_SALDO),
    ),
    Medida(
        "rotatividade", "Rotatividade (turnover)", 1, "T = D + O", "Bell et al. (2002)",
        calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "tbi", "Taxa bruta de imigração", 1, "1000 · D / pop5", "Bell et al. (2002)",
        calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "tbe", "Taxa bruta de emigração", 1, "1000 · O / pop5", "Bell et al. (2002)",
        calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "tlm", "Taxa líquida de migração", 1, "1000 · N / pop5", "Bell et al. (2002)",
        calibracao_1980="saldo", excecoes=dict(_PROXY_SALDO),
    ),
    Medida(
        "taxa_rotatividade", "Taxa de rotatividade", 1, "1000 · T / pop5",
        "Bell et al. (2002)", calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "iem", "Índice de eficácia migratória (IEM/MEI)", 1, "(D − O) / (D + O) ∈ [−1, 1]",
        "IBGE, errata de migração do Censo 2010; Baeninger (2012), REMHU 20(39)",
        entre_niveis=True, excecoes=dict(_PROXY_RAZAO),
    ),
    Medida(
        "distancia_media", "Distância média da migração", 1,
        "MMD = Σ M_ij · d_ij / Σ M_ij, com d_ij entre centroides publicados",
        "Stillwell et al. (2016), EPA 48(8)",
        requer=("migracao", "fluxos_publicados"),
        excecoes={"1980": _r(_COM, "proxy_1980_distancia")},
    ),
    Medida(
        "distancia_mediana", "Distância mediana da migração", 1,
        "mediana ponderada de d_ij pelos M_ij", "Stillwell et al. (2016)",
        requer=("migracao", "fluxos_publicados"),
        excecoes={"1980": _r(_COM, "proxy_1980_distancia")},
    ),
    Medida(
        "pct_interestadual", "% da migração que cruza a UF", 1,
        "Σ M_ij · [uf_i ≠ uf_j] / Σ M_ij", "Bell et al. (2002)",
        requer=("migracao", "fluxos_publicados"),
        calibracao_1980="interestadual",
        excecoes={"1980": _r(_COM, "proxy_1980_interestadual")},
    ),
    Medida(
        "conectividade", "Conectividade (parceiros distintos)", 1,
        "nº de unidades com pelo menos um fluxo publicado com a unidade",
        "Bell et al. (2002)", requer=("migracao", "fluxos_publicados"),
        excecoes={
            "2022": _r(_COM, "conectividade_supressao"),
            "2010": _r(_COM, "conectividade_supressao"),
            "2000": _r(_COM, "conectividade_supressao"),
            "1991": _r(_COM, "conectividade_supressao"),
            "1980": _r(_NAO, "conectividade_limiar_1980"),
        },
    ),
    Medida(
        # Correção (achada ao escrever o glossário de tooltips do front): o rótulo estava
        # trocado com o de `gini_coluna`. `pipeline/build_series.py::_gini_batch` agrupa por
        # `origem` para calcular `gini_linha` -- ou seja, mede a concentração dos M_ij que SAEM
        # da unidade (para poucos ou muitos destinos), não das origens que chegam. Ver o
        # docstring de `pipeline/medidas.py::gini_linha`, que já descrevia isso corretamente.
        "gini_linha", "Concentração dos destinos (Gini de linha)", 1,
        "Gini das M_ij que saem da unidade", "Plane & Mulligan (1997), Demography 34(2)",
        requer=("migracao", "fluxos_publicados"),
        excecoes={
            "2022": _r(_COM, "gini_supressao"), "2010": _r(_COM, "gini_supressao"),
            "2000": _r(_COM, "gini_supressao"), "1991": _r(_COM, "gini_supressao"),
            "1980": _r(_COM, "gini_limiar_1980"),
        },
    ),
    Medida(
        "gini_coluna", "Concentração das origens (Gini de coluna)", 1,
        "Gini das M_ji que chegam à unidade", "Plane & Mulligan (1997)",
        requer=("migracao", "fluxos_publicados"),
        excecoes={
            "2022": _r(_COM, "gini_supressao"), "2010": _r(_COM, "gini_supressao"),
            "2000": _r(_COM, "gini_supressao"), "1991": _r(_COM, "gini_supressao"),
            "1980": _r(_COM, "gini_limiar_1980"),
        },
    ),
    Medida(
        "precisao", "Erro amostral publicado (se/cv)", 1,
        "estimador de conglomerados últimos (domicílio como UPA)",
        "docs/METODOLOGIA.md, notas de desenho amostral de cada edição",
        entre_niveis=True, requer=("erro_amostral",),
    ),
    # ---------------- Bloco 1 — pendular ------------------------------------------------
    Medida(
        "pend_trab_saida", "Saída pendular para trabalho", 1,
        "Σ pessoas ocupadas que trabalham em outro município", "IBGE, quesito de deslocamento",
        requer=("pendular",),
        excecoes={"1980": _r(_COM, "proxy_1980_pendular_contexto")},
    ),
    Medida(
        "pend_trab_entrada", "Entrada pendular para trabalho", 1,
        "Σ pessoas que vêm trabalhar na unidade", "IBGE, quesito de deslocamento",
        requer=("pendular",),
        excecoes={"1980": _r(_COM, "proxy_1980_pendular_contexto")},
    ),
    Medida(
        "pend_estudo_saida", "Saída pendular para estudo", 1,
        "Σ pessoas que estudam em outro município", "IBGE, quesito de deslocamento",
        requer=("pendular", "estudo"),
    ),
    Medida(
        "pend_estudo_entrada", "Entrada pendular para estudo", 1,
        "Σ pessoas que vêm estudar na unidade", "IBGE, quesito de deslocamento",
        requer=("pendular", "estudo"),
    ),
    Medida(
        "pct_pendular", "% de ocupados com deslocamento pendular", 1,
        "pendulares de trabalho / ocupados", "IBGE, quesito de deslocamento",
        entre_niveis=True, requer=("pendular",),
    ),
    Medida(
        "pend_tempo", "Tempo de deslocamento", 1, "distribuição do tempo declarado",
        "IBGE, quesito de tempo de deslocamento", requer=("pendular", "pendular_tempo"),
        excecoes={"2010": _r(_NAO, "tempo_vocabulario_2010")},
    ),
    Medida(
        "pend_frequencia", "Frequência de retorno", 1, "distribuição da frequência declarada",
        "IBGE, quesito de retorno", requer=("pendular", "pendular_frequencia"),
        excecoes={"2010": _r(_COM, "frequencia_definicao_2010")},
    ),
    Medida(
        "pend_modo", "Meio de transporte", 1, "distribuição do modo declarado",
        "IBGE, quesito de meio de transporte", requer=("pendular", "pendular_modo"),
    ),
    Medida(
        "pend_posicao", "Posição na ocupação do pendular", 1,
        "distribuição da posição na ocupação", "IBGE, quesito de posição na ocupação",
        requer=("pendular", "pendular_posicao"),
    ),
    # ---------------- Bloco 1 — RM (intrametropolitano) ---------------------------------
    Medida(
        "rm_mig_intra", "Migração intrametropolitana", 1,
        "Σ fluxos entre municípios da mesma RM", "IBGE, recorte metropolitano de 2022",
        niveis=("rm",), requer=("migracao", "composicao_interna"),
        excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "rm_tipologia", "Tipologia núcleo × periferia", 1,
        "decomposição núcleo→periferia, periferia→núcleo e periferia→periferia",
        "docs/METODOLOGIA.md, módulo metropolitano", niveis=("rm",),
        requer=("migracao", "composicao_interna"), excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "rm_pendular_intra", "Pendularidade intrametropolitana", 1,
        "pendulares cuja origem e destino são da mesma RM", "IBGE, quesito de deslocamento",
        niveis=("rm",), requer=("pendular", "composicao_interna"),
        excecoes={"1980": _r(_COM, "proxy_1980_pendular_contexto")},
    ),
    # ---------------- Bloco 2 — medidas do sistema --------------------------------------
    Medida(
        "cmi", "Intensidade migratória (CMI)", 2, "100 · M / P, no conjunto de unidades da edição",
        "Bell et al. (2002); Rees et al. (2017), PSP 23(6):e2036",
        requer=("migracao",), calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "smi", "Intensidade padronizada por idade (SMI)", 2,
        "CMI padronizada por idade sobre as faixas publicadas, população de 2022 como padrão",
        "Stillwell, Bell & Shuttleworth (2017)", requer=("migracao",),
        calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "mei_agregado", "Eficácia migratória do sistema (MEI)", 2,
        "100 · 0,5 · Σ_i |N_i| / M", "Bell et al. (2002); Rees et al. (2017)",
        entre_niveis=True, requer=("migracao",), excecoes=dict(_PROXY_RAZAO),
    ),
    Medida(
        "anmr", "Migração líquida agregada (ANMR)", 2, "ANMR = CMI × MEI / 100",
        "Bell et al. (2002)", requer=("migracao",), calibracao_1980="saldo",
        excecoes=dict(_PROXY_SALDO),
    ),
    Medida(
        "beta_fielding", "β de Fielding (contraurbanização)", 2,
        "NMR_i = α + β · log₁₀(densidade_i), MQO ponderado por população",
        "Fielding (1989), Geogr. J. 155(1):60–69; Rowe et al. (2019), CPoS 44",
        requer=("migracao",), excecoes=dict(_PROXY_SALDO),
    ),
    Medida(
        "duncan_d", "Duncan D entre edições consecutivas", 2,
        "D = 0,5 · Σ_ij |M_ij^t/M^t − M_ij^{t+1}/M^{t+1}| sobre a MATRIZ COMUM às duas edições",
        "Duncan & Duncan (1955), ASR 20(2):210–217",
        requer=("migracao", "fluxos_publicados"),
        excecoes={
            "2022": _r(_COM, "duncan_matriz_comum"), "2010": _r(_COM, "duncan_matriz_comum"),
            "2000": _r(_COM, "duncan_matriz_comum"), "1991": _r(_COM, "duncan_matriz_comum"),
            "1980": _r(_COM, "duncan_matriz_comum_1980"),
        },
    ),
    Medida(
        "loglinear", "Decomposição log-linear (T, O_i, D_j, OD_ij)", 2,
        "n_ij = T · O_i · D_j · OD_ij, ajustado por IPF sobre a matriz comum",
        "Willekens (1983); Rogers, Willekens, Little et al. (2002)",
        requer=("migracao", "fluxos_publicados"),
        excecoes={
            "2022": _r(_COM, "loglinear_matriz_comum"),
            "2010": _r(_COM, "loglinear_matriz_comum"),
            "2000": _r(_COM, "loglinear_matriz_comum"),
            "1991": _r(_COM, "loglinear_matriz_comum"),
            "1980": _r(_COM, "loglinear_matriz_comum_1980"),
        },
    ),
    # ---------------- Bloco 3 — fluxos ---------------------------------------------------
    Medida(
        "par_total", "Volume de um par origem→destino", 3, "M_ij publicado",
        "docs/METODOLOGIA.md, regras R1–R9", requer=("migracao", "fluxos_publicados"),
        calibracao_1980="volume", excecoes=dict(_PROXY_VOLUME),
    ),
    Medida(
        "par_posto", "Posto do parceiro no ranking da unidade", 3,
        "posição de M_ij na ordenação decrescente dos fluxos da unidade",
        "Bell et al. (2002)", entre_niveis=True,
        requer=("migracao", "fluxos_publicados"),
        excecoes={
            "1980": _r(_COM, "posto_supressao_1980"),
        },
    ),
    Medida(
        "estabilidade_ranking", "Estabilidade do top-10 entre edições", 3,
        "|top10_t ∩ top10_{t+1}| / 10", "Bell et al. (2002)", entre_niveis=True,
        requer=("migracao", "fluxos_publicados"),
        excecoes={"1980": _r(_COM, "posto_supressao_1980")},
    ),
    # ---------------- Bloco 4 — perfil ---------------------------------------------------
    Medida(
        "perfil_status", "Composição por status migratório", 4,
        "participação de cada categoria de `status` entre imigrantes/emigrantes",
        "docs/METODOLOGIA.md, status migratório por edição", entre_niveis=True,
        excecoes={"2022": _r(_COM, "status_colapsado_2022"),
                  "1980": _r(_COM, "status_retorno_1980")},
    ),
    Medida(
        "perfil_edu", "Composição por escolaridade", 4,
        "participação de cada classe de `nivel_instr_4`, excluída `nao_determinado`",
        "docs/METODOLOGIA.md, escolaridade por edição", entre_niveis=True,
        excecoes={
            "2000": _r(_COM, "edu_anos_estudo"), "1991": _r(_COM, "edu_anos_estudo"),
            "1980": _r(_COM, "edu_reconstruida_1980"),
        },
    ),
    Medida(
        "perfil_renda", "Composição por classe de renda", 4,
        "participação de cada faixa de salário mínimo da própria edição",
        "docs/METODOLOGIA.md, salário mínimo de referência por edição",
        entre_niveis=True, requer=("renda",),
        excecoes={"1991": _r(_COM, "sm_implicito_1991")},
    ),
    Medida(
        "perfil_idade_sexo", "Composição por idade e sexo", 4,
        "participação de cada faixa etária × sexo; sexo I fora do denominador de sexo",
        "docs/METODOLOGIA.md, harmonização de idade_sexo", entre_niveis=True,
        excecoes={"2022": _r(_COM, "sexo_indeterminado_2022")},
    ),
    Medida(
        "idade_mediana", "Idade mediana do migrante", 4,
        "mediana interpolada sobre as cinco faixas etárias publicadas",
        "Bernard, Bell & Charles-Edwards (2014), Population Studies 68(2):179–195",
        entre_niveis=True,
        excecoes={
            "2022": _r(_COM, "faixas_largas"), "2010": _r(_COM, "faixas_largas"),
            "2000": _r(_COM, "faixas_largas"), "1991": _r(_COM, "faixas_largas"),
            "1980": _r(_COM, "faixas_largas"),
        },
    ),
    Medida(
        "razao_sexo", "Razão de sexo dos migrantes", 4, "100 · M / F",
        "docs/METODOLOGIA.md, harmonização de idade_sexo", entre_niveis=True,
        excecoes={"2022": _r(_COM, "sexo_indeterminado_2022")},
    ),
    Medida(
        "idade_pico", "Idade no pico e intensidade no pico", 4,
        "faixa etária de maior taxa de migração e o valor dessa taxa",
        "Bernard, Bell & Charles-Edwards (2014); Rogers & Castro (1981), IIASA RR-81-30",
        entre_niveis=True,
        excecoes={
            "2022": _r(_COM, "faixas_largas"), "2010": _r(_COM, "faixas_largas"),
            "2000": _r(_COM, "faixas_largas"), "1991": _r(_COM, "faixas_largas"),
            "1980": _r(_COM, "faixas_largas"),
        },
    ),
    Medida(
        "seletividade_edu", "Seletividade migratória por escolaridade", 4,
        "OR = (mig_sup/mig_não-sup) / (res_sup/res_não-sup)",
        "Bernard & Bell (2018), Demographic Research 39(29):835–854", entre_niveis=True,
        excecoes={
            "2022": _r(_COM, "seletividade_fim_do_periodo"),
            "2010": _r(_COM, "seletividade_fim_do_periodo"),
            "2000": _r(_COM, "seletividade_fim_do_periodo"),
            "1991": _r(_COM, "seletividade_fim_do_periodo"),
            "1980": _r(_COM, "seletividade_1980"),
        },
    ),
    Medida(
        "seletividade_renda", "Seletividade migratória por renda", 4,
        "OR entre migrantes e residentes nas faixas de renda", "Bernard & Bell (2018)",
        entre_niveis=True, requer=("renda",),
        excecoes={
            "2022": _r(_COM, "seletividade_fim_do_periodo"),
            "2010": _r(_COM, "seletividade_fim_do_periodo"),
            "2000": _r(_COM, "seletividade_fim_do_periodo"),
            "1991": _r(_COM, "sm_implicito_1991"),
        },
    ),
)

MEDIDAS_POR_CHAVE: dict[str, Medida] = {m.chave: m for m in MEDIDAS}

# --------------------------------------------------------------------------------------
# Regra dura de escala (Courgeau / MAUP)
# --------------------------------------------------------------------------------------

#: Medidas que NÃO podem ser comparadas entre níveis territoriais diferentes, ainda que
#: sejam comparáveis entre edições dentro de um mesmo nível. Derivado de `Medida.entre_niveis`
#: — declarado aqui como conjunto para o front poder bloquear a leitura sem reler o catálogo.
ESCALA_PRESA_AO_NIVEL: tuple[str, ...] = tuple(
    m.chave for m in MEDIDAS if not m.entre_niveis
)
ESCALA_LIVRE: tuple[str, ...] = tuple(m.chave for m in MEDIDAS if m.entre_niveis)

#: Número mínimo de unidades para que o MEI agregado seja estável o suficiente para leitura
#: entre níveis (Rees et al. 2017: o MEI é estável em geografias com 20+ unidades).
MIN_UNIDADES_MEI = 20

# --------------------------------------------------------------------------------------
# Cobertura territorial das agregações
# --------------------------------------------------------------------------------------

#: Limiar único de cobertura populacional das agregações (RGI, RGInt, UF, RM). Abaixo dele a
#: célula não mostra número: mostra "cobertura insuficiente". Calibração em
#: `docs/METODOLOGIA.md`, seção "Comparação entre censos (F12)", item 3.
LIMIAR_COBERTURA = 0.90

#: Piso de municípios para que uma RM tenha indicador intrametropolitano (núcleo↔periferia,
#: migração e pendularidade intra-RM). Uma RM reduzida a um município tem esses indicadores
#: zerados POR CONSTRUÇÃO, não por medida.
MIN_MUNICIPIOS_RM_INTRA = 2


class Cobertura(str, Enum):
    PLENA = "plena"
    PARCIAL = "parcial"
    INSUFICIENTE = "insuficiente"
    SEM_COBERTURA = "sem_cobertura"


def estado_cobertura(
    *,
    cobertura_pop: float | None,
    cobertura_cod: float | None = None,
    n_mun_edicao: int = 0,
    intra_unidade: bool = False,
    rm_unitaria: bool = False,
    nucleo_divergente: bool = False,
) -> Cobertura:
    """Estado de cobertura de uma célula de agregação.

    Duas coberturas, porque medem coisas diferentes (ver `docs/METODOLOGIA.md`, item 3):

    - `cobertura_pop` — cobertura **territorial**: fração da população de 2022 da unidade cujo
      território está representado, naquela edição, por alguma unidade **da mesma unidade de
      2022** (o próprio município, se existir na edição; senão o município-mãe, quando ele
      pertence à mesma unidade; em 1980, a unidade agregada `NORTEGO` cobre o território dos
      52 municípios no nível de UF e não cobre em RGI/RGInt/RM, onde ela é `NULL`). É o que
      gate as medidas que atravessam a fronteira da unidade — imigração, emigração, saldo,
      taxas, IEM, distância, conectividade, Gini.
    - `cobertura_cod` — cobertura de **observação direta**: fração da população de 2022 em
      municípios que existem individualmente na edição. É o que gate as medidas que dependem
      da partição interna (`intra_unidade=True`): migração e pendularidade intra-RM, tipologia
      núcleo × periferia.

    `rm_unitaria` e `nucleo_divergente` forçam `INSUFICIENTE` nos indicadores
    intrametropolitanos, incondicionalmente e independentemente do limiar geral.
    """
    # A guarda de topo depende só de `cobertura_pop` (cobertura TERRITORIAL), não de
    # `n_mun_edicao` (município individualmente codificado): uma unidade agregada como
    # NORTEGO (1980) cobre 100% do território de uma UF sem NENHUM município codificado
    # individualmente (`n_mun_edicao=0`) -- e ainda assim tem `imig`/`emig`/`iem` publicáveis
    # nessa UF, porque essas medidas atravessam a fronteira da unidade e não dependem da
    # partição interna. `n_mun_edicao` só entra como critério dentro de `intra_unidade`
    # (medidas que dependem de município individual, como migração intra-RM), logo abaixo.
    if not cobertura_pop:
        return Cobertura.SEM_COBERTURA
    if intra_unidade:
        if rm_unitaria or n_mun_edicao < MIN_MUNICIPIOS_RM_INTRA or nucleo_divergente:
            return Cobertura.INSUFICIENTE
        base = cobertura_cod if cobertura_cod is not None else cobertura_pop
        if base < LIMIAR_COBERTURA:
            return Cobertura.INSUFICIENTE
        return Cobertura.PLENA if base >= 0.999 else Cobertura.PARCIAL
    if cobertura_pop < LIMIAR_COBERTURA:
        return Cobertura.INSUFICIENTE
    plena = cobertura_pop >= 0.999 and (cobertura_cod is None or cobertura_cod >= 0.999)
    return Cobertura.PLENA if plena else Cobertura.PARCIAL


def publica_numero(cobertura: Cobertura) -> bool:
    """A célula mostra número? (`plena` e `parcial` mostram; as outras duas, não.)"""
    return cobertura in (Cobertura.PLENA, Cobertura.PARCIAL)


# --------------------------------------------------------------------------------------
# Calibração do proxy de 1980
# --------------------------------------------------------------------------------------

#: Fatores de calibração do proxy de data fixa de 1980, medidos contra a data fixa verdadeira
#: do Censo 1991 (docs/METODOLOGIA.md, seção de 1980, item 2). O valor calibrado é
#: `bruto / fator`; ele é EXIBIDO AO LADO do valor bruto, nunca o substitui, e nunca entra no
#: cálculo de nenhum indicador derivado. `aplicar=False` significa: o fator é documentado, mas
#: a interface não oferece o valor corrigido (é deslocamento aditivo de uma participação, não
#: um fator de escala de um volume).
CALIBRACAO_1980: dict[str, dict[str, object]] = {
    "volume": {
        "fator": 1.073,
        "por_nivel": {},
        "tipo": "divisor",
        "aplicar": True,
        "origem": "volume total de migrantes do proxy é +7,3% frente à data fixa verdadeira "
                  "(1991); os falsos positivos são migração de ida-e-volta e entram dos dois "
                  "lados, sem alterar o saldo",
        "sentido": "o valor bruto de 1980 SUPERESTIMA o volume",
    },
    "saldo": {
        "fator": 0.941,
        # A regressão da taxa líquida do proxy sobre a verdadeira (1991) dá 0,941 no nível
        # municipal e 0,912 no nível de UF. Os níveis intermediários não foram medidos e usam
        # o coeficiente municipal, que é o mais conservador dos dois (corrige menos).
        "por_nivel": {"uf": 0.912},
        "tipo": "divisor",
        "aplicar": True,
        "origem": "coeficiente da regressão da taxa líquida do proxy sobre a verdadeira "
                  "(1991): 0,941 por município, 0,912 por UF",
        "sentido": "o valor bruto de 1980 ATENUA o saldo (encolhe 6% a 9%); o sinal do saldo "
                   "se inverte em 5,4% dos municípios, quase todos pequenos",
    },
    "interestadual": {
        "fator": 0.0211,
        "por_nivel": {},
        "tipo": "deslocamento_pp",
        "aplicar": False,
        "origem": "a participação da migração interestadual cai de 35,07% (verdade) para "
                  "32,96% (proxy) em 1991: −2,11 p.p.",
        "sentido": "o valor bruto de 1980 SUBESTIMA a migração de longa distância",
    },
}

#: A calibração foi feita em 1991, não em 1980: ela mede o erro do CONCEITO, não o erro desta
#: edição. Se a migração de retorno e de etapas múltiplas foi mais intensa em 1975–1980 do que
#: em 1986–1991, as correções acima são um PISO. É por isso que o valor calibrado é sempre
#: apresentado como faixa/estimativa derivada, e nunca substitui o bruto.
CALIBRACAO_1980_E_PISO = True

#: As três correções são pontuais e independentes: aplicar volume ÷1,073 a `imig`/`emig` e
#: saldo ÷0,941 a `saldo` NÃO preserva a identidade saldo = imig − emig. Os valores calibrados
#: formam um trio internamente inconsistente, de propósito — cada um é a melhor correção da
#: sua própria grandeza —, e por isso nenhum indicador derivado é recalculado a partir deles.
CALIBRACAO_1980_NAO_FECHA_IDENTIDADE = True


def calibrar_1980(valor: float | None, medida: str, nivel: str = "mun") -> float | None:
    """Valor calibrado de uma medida de nível em 1980, ou None quando não há calibração."""
    m = MEDIDAS_POR_CHAVE.get(medida)
    if m is None or m.calibracao_1980 is None or valor is None:
        return None
    cal = CALIBRACAO_1980[m.calibracao_1980]
    if not cal["aplicar"]:
        return None
    fator = dict(cal["por_nivel"]).get(nivel, cal["fator"])  # type: ignore[arg-type]
    return valor / float(fator)


# --------------------------------------------------------------------------------------
# Harmonização de vocabulário entre edições
# --------------------------------------------------------------------------------------

#: `status`: 2022 é a única edição que separa quem saiu do município natal pela primeira vez
#: (`primeira_saida`) de quem já morava fora dele antes do período (`etapas_multiplas`). As
#: outras quatro colapsam as duas em `nao_natural`, por ausência do município de nascimento no
#: questionário. Na série, 2022 é rebaixada ao vocabulário comum.
HARMONIZACAO_STATUS = {
    "alvo": "nao_natural",
    "parcelas_2022": ("primeira_saida", "etapas_multiplas"),
    "edicoes_com_vocabulario_completo": ("2022",),
    "quando": "sempre que a comparação inclui alguma edição ≤ 2010 — ou seja, sempre, na "
              "seção 'Ao longo dos censos'. Os painéis de uma edição só continuam exibindo o "
              "vocabulário completo de 2022.",
    "formula": "nao_natural(2022) = primeira_saida + etapas_multiplas",
    "regra_nulo": "se qualquer das duas parcelas estiver suprimida (NULL), a célula "
                  "harmonizada é NULL com motivo 'suprimido' — nunca 0, nunca a soma parcial",
    "categorias_comuns": ("nao_natural", "retorno_natal", "nascido_exterior", "outros"),
}

#: `idade_sexo`: o sexo `I` (indeterminado) só existe em 2022 e pesa entre 0,0003% (imigrantes)
#: e 0,02% (emigrantes) da massa. Ele NÃO é somado a `outros` — `outros` é o resíduo da
#: supressão complementar R3, e misturar uma categoria medida com um resíduo de supressão faria
#: `outros` significar duas coisas. A regra depende da medida derivada, não da categoria.
HARMONIZACAO_IDADE_SEXO = {
    "categoria_exclusiva_2022": "I",
    "em_medidas_de_idade": "somado ao total da faixa etária (`05_14`, `15_24`, …): a faixa é "
                           "comparável entre as cinco edições",
    "em_medidas_de_sexo": "fora do denominador em TODAS as edições (razão de sexo e pirâmide "
                          "usam M + F), com o peso de `I` declarado ao lado",
    "nunca": "somar `I` a `outros`",
    "peso_2022": {"imig": 3e-6, "emig": 1.3e-5, "residente": 2.4e-4},
}

#: `edu`: `nao_determinado` existe em 1980–2010 e não em 2022. As participações da série são
#: calculadas sobre o total EXCLUÍDA essa categoria, em todas as edições, e `nao_determinado`
#: é reportado à parte como "sem declaração" (≤ 0,07% em qualquer edição).
HARMONIZACAO_EDU = {
    "categoria_ausente_2022": "nao_determinado",
    "regra": "denominador comum = soma das quatro classes substantivas; `nao_determinado` "
             "reportado à parte, nunca como classe da distribuição",
    "categorias_comuns": (
        "sem_instr_fund_incompleto", "fund_completo_medio_incompleto",
        "medio_completo_superior_incompleto", "superior_completo",
    ),
}

#: `renda`: 1980 não publica renda (nenhuma faixa). As faixas de 1991–2022 são relativas ao
#: salário mínimo de cada censo, que é o que as torna comparáveis apesar da moeda e da
#: inflação; em 1991 o divisor é o SM implícito nas faixas do IBGE, não o SM legal.
HARMONIZACAO_RENDA = {
    "edicoes_sem_renda": ("1980",),
    "regra": "faixas relativas ao salário mínimo de referência da própria edição",
    "ressalva_1991": "sm_implicito_1991",
}


def harmonizar_status(
    valores: dict[str, float | None], edicao: str
) -> dict[str, float | None]:
    """Reduz o vocabulário de `status` de uma edição ao vocabulário comum às cinco.

    Só 2022 muda: `primeira_saida` + `etapas_multiplas` → `nao_natural`. Se qualquer das duas
    parcelas for None (suprimida), o resultado é None — a soma parcial seria um número errado
    apresentado como certo.
    """
    if edicao not in HARMONIZACAO_STATUS["edicoes_com_vocabulario_completo"]:
        return dict(valores)
    out = {k: v for k, v in valores.items()
           if k not in HARMONIZACAO_STATUS["parcelas_2022"]}
    parcelas = [valores.get(p) for p in HARMONIZACAO_STATUS["parcelas_2022"]]
    if any(p is None for p in parcelas) and any(p in valores for p in HARMONIZACAO_STATUS["parcelas_2022"]):
        out[HARMONIZACAO_STATUS["alvo"]] = None
    elif parcelas:
        out[HARMONIZACAO_STATUS["alvo"]] = sum(p or 0.0 for p in parcelas)
    return out


# --------------------------------------------------------------------------------------
# Tipologia de Baeninger sobre o IEM
# --------------------------------------------------------------------------------------

#: Limiares da tipologia de rotatividade migratória de Baeninger (2012), REMHU 20(39),
#: operacionalizados sobre o IEM publicado. Ancoragem em razão entre os dois fluxos:
#:   |IEM| = 0,15  ⟺  D/O ≈ 4/3 (o fluxo maior supera o menor em um terço)
#:   |IEM| = 1/3   ⟺  D/O = 2   (o fluxo maior é o dobro do menor)
IEM_LIMIAR_ROTATIVIDADE = 0.15
IEM_LIMIAR_FORTE = 1.0 / 3.0


class TipoIEM(str, Enum):
    ROTATIVIDADE = "rotatividade"
    ABSORCAO = "absorcao"
    ABSORCAO_FORTE = "absorcao_forte"
    EVASAO = "evasao"
    EVASAO_FORTE = "evasao_forte"
    INDEFINIDO = "indefinido"


def se_iem(imig: float, emig: float, se_imig: float | None, se_emig: float | None) -> float | None:
    """Erro-padrão do IEM pelo método delta, tratando D e O como independentes.

    ∂IEM/∂D = 2O/(D+O)², ∂IEM/∂O = −2D/(D+O)²  ⇒
    se(IEM) = 2·√(O²·se(D)² + D²·se(O)²) / (D+O)²
    """
    if se_imig is None or se_emig is None:
        return None
    t = imig + emig
    if t <= 0:
        return None
    return 2.0 * ((emig * se_imig) ** 2 + (imig * se_emig) ** 2) ** 0.5 / (t * t)


def classificar_iem(
    iem: float | None, se: float | None = None, z: float = 1.96
) -> TipoIEM | None:
    """Tipologia de Baeninger, com guarda estatística.

    A classificação substantiva vem dos limiares acima. A guarda evita chamar de absorção ou
    evasão o que é ruído amostral: se |IEM| ≥ limiar mas |IEM| < z·se(IEM), a unidade sai como
    `indefinido` — e **não** como rotatividade, porque a incerteza não é evidência de
    equilíbrio. Se |IEM| < limiar, a leitura é rotatividade de qualquer forma (o valor é
    pequeno e compatível com zero), e a guarda não se aplica.

    Em 1980 `se` é sempre None (a edição não publica erro amostral): a tipologia é publicada
    sem guarda, com o selo de proxy e a nota `iem_sem_guarda_1980`.
    """
    if iem is None:
        return None
    a = abs(iem)
    if a < IEM_LIMIAR_ROTATIVIDADE:
        return TipoIEM.ROTATIVIDADE
    if se is not None and a < z * se:
        return TipoIEM.INDEFINIDO
    forte = a >= IEM_LIMIAR_FORTE
    if iem > 0:
        return TipoIEM.ABSORCAO_FORTE if forte else TipoIEM.ABSORCAO
    return TipoIEM.EVASAO_FORTE if forte else TipoIEM.EVASAO


# --------------------------------------------------------------------------------------
# Notas (chaves de texto que o front resolve em tooltip)
# --------------------------------------------------------------------------------------

NOTAS: dict[str, str] = {
    # 1980 — proxy de data fixa
    "proxy_1980_volume":
        "1980 não pergunta onde a pessoa morava há cinco anos: a migração é um proxy (última "
        "etapa + tempo de residência). Calibrado contra 1991, o proxy infla o volume em ~7,3% "
        "(migração de ida-e-volta). O valor bruto é publicado; a estimativa calibrada aparece "
        "ao lado, como piso de correção.",
    "proxy_1980_saldo":
        "O proxy de 1980 atenua o saldo: a regressão contra a data fixa verdadeira de 1991 dá "
        "coeficiente 0,941 por município e 0,912 por UF, e o sinal do saldo se inverte em 5,4% "
        "dos municípios, quase todos pequenos.",
    "proxy_1980_razao":
        "Razão entre entradas e saídas: é a família de medida menos sensível ao proxy, porque "
        "os falsos positivos entram dos dois lados. Ainda assim o proxy a atenua em direção a "
        "zero — 1980 tende a parecer mais 'de rotatividade' do que foi.",
    "proxy_1980_distancia":
        "A migração em etapas transfere fluxo longo para fluxo curto: em 1991, o proxy reduz a "
        "participação interestadual de 35,07% para 32,96%. 1980 subestima a distância "
        "percorrida, em magnitude não medida.",
    "proxy_1980_interestadual":
        "Medido na calibração de 1991: o proxy subestima a participação interestadual em 2,11 "
        "pontos percentuais (35,07% → 32,96%).",
    "proxy_1980_pendular_contexto":
        "O módulo pendular de 1980 é medido, não é proxy — o selo de proxy da edição vale para "
        "a migração. A ressalva aqui é outra: 1980 publica quatro dimensões do pendular (sem "
        "posição na ocupação e sem renda) e o fluxo de estudo é um piso.",
    "status_retorno_1980":
        "Em 1980, `retorno_natal` é subestimado no território do atual Tocantins: quem nasceu "
        "lá declarava 'Goiás' como naturalidade, e a unidade agregada `NORTEGO` não é "
        "reconhecível como município natal.",
    "sem_renda_1980":
        "A edição 1980 não publica nenhuma variável de renda: na fonte, os rendimentos estão "
        "preenchidos só na partição do Ceará e vazios nas outras 26 unidades da federação.",
    "sem_estimativa_1980":
        "A edição 1980 não publica erro amostral: a fonte não traz chave de domicílio e os "
        "domicílios não são reconstruíveis, então não há unidade primária de amostragem. "
        "`se` e `cv` são nulos e a precisão é declarada como 'sem estimativa'.",
    "conectividade_limiar_1980":
        "O número de parceiros publicados depende do limiar de revelação, e 1980 é a única "
        "edição com limiar próprio (n ≥ 20 em vez de n ≥ 5, por não ter chave de domicílio): "
        "ela publica 11,0% dos pares da amostra, contra 16,2%–20,4% nas demais. A contagem de "
        "parceiros de 1980 não é comparável com a das outras edições.",
    "gini_limiar_1980":
        "Concentração calculada sobre os pares publicados, com o limiar próprio de 1980 "
        "(n ≥ 20). A cobertura de volume é equivalente à das demais edições (70,7%, contra "
        "67,6%–71,6%), então a concentração da massa publicada é comparável; a contagem de "
        "pares não é.",
    "posto_supressao_1980":
        "O ranking de 1980 é montado sobre menos pares publicados (limiar n ≥ 20): parceiros "
        "pequenos podem estar ausentes do ranking por supressão, não por não existirem.",
    "duncan_matriz_comum_1980":
        "Duncan D calculado sobre a matriz comum às duas edições. Entre 1980 e 1991 a "
        "interseção é a menor da série (1.634 municípios de 2022 não existem em 1980, e o "
        "território do atual Tocantins entra como uma unidade agregada), e o índice mede "
        "mudança de estrutura apenas nessa interseção.",
    "loglinear_matriz_comum_1980":
        "Decomposição ajustada sobre a matriz comum às duas edições, a menor da série. Os "
        "parâmetros O, D e OD são livres de escala, mas o conjunto de unidades sobre o qual "
        "foram ajustados é menor que o de 2022.",
    "iem_sem_guarda_1980":
        "A tipologia de 1980 é publicada sem guarda estatística: a edição não estima erro "
        "amostral, então não há como distinguir eficácia pequena de ruído.",
    "edu_reconstruida_1980":
        "A escolaridade de 1980 é reconstruída do par 'última série concluída' × 'grau', com a "
        "lista de graus do dicionário do IBGE corrigida de um deslocamento de código. É uma "
        "aproximação declarada: quem estava estudando tem o nível subestimado, e o fim do "
        "curso superior é uma faixa, não um ponto.",
    "seletividade_1980":
        "Razão de chances entre migrantes e residentes em 1980: além da ressalva geral (a "
        "característica é medida no fim do período), a escolaridade da edição é reconstruída "
        "e a migração é um proxy.",
    "unidade_agregada_1980":
        "Em 1980, os 52 municípios do norte de Goiás (hoje Tocantins) são publicados como uma "
        "única unidade, `NORTEGO`. No nível de UF ela cobre o território; em RGI, RGInt e RM "
        "ela não participa, e as regiões correspondentes ficam sem cobertura.",
    # 1991
    "sem_pendular_1991":
        "O questionário da amostra de 1991 não pergunta em que município a pessoa trabalha ou "
        "estuda: a edição não tem módulo de deslocamento pendular. A ausência é do "
        "questionário, não do atlas — a célula não é zero, é não medida.",
    "precisao_aproximada_1991":
        "1991 não tem área de ponderação: o estrato do estimador de variância é um substituto "
        "(município × situação urbano/rural), mais heterogêneo que a área real. O CV mediano "
        "fica 5% a 20% acima do de 2000 em pares de mesmo tamanho amostral — leia `se` e `cv` "
        "de 1991 como conservadores, não como comparáveis ponto a ponto.",
    "sm_implicito_1991":
        "Em 1991 o divisor de salário mínimo é o valor implícito nas faixas de rendimento do "
        "próprio IBGE (Cr$ 36.161,60, que reproduz 24 de 24 limites de faixa), e não o mínimo "
        "legal vigente. É o que faz os cortes relativos coincidirem com as tabulações oficiais "
        "da época.",
    # 2000
    "estudo_piso":
        "O deslocamento pendular para estudo é um piso, não uma estimativa do total: o censo "
        "tem um quesito único de trabalho/estudo com precedência do trabalho, e quem trabalha "
        "no próprio município e estuda em outro assinala 'neste município'. Comparável em "
        "composição e direção, nunca em nível.",
    "sem_tempo_freq_modo":
        "O bloco de deslocamento desta edição tem só o município de destino: não há tempo "
        "gasto, frequência de retorno nem meio de transporte. A célula não é zero, é não "
        "medida.",
    "ocup_elementares":
        "A classe 'ocupações elementares' não é comparável nesta edição: em 2000 ela é "
        "estruturalmente vazia (a CBO-Domiciliar 2000 distribui essa massa por três outras "
        "classes) e em 1980 ela existe, mas mais estreita que o grande grupo da ISCO-08.",
    # 2010
    "sem_modo_2010":
        "O questionário de 2010 não tem quesito de meio de transporte: a dimensão 'modo' não "
        "existe nesta edição.",
    "tempo_vocabulario_2010":
        "As cinco faixas de tempo de deslocamento de 2010 não são aninhadas nas oito de 2022 "
        "(a segunda faixa de 2010 atravessa duas de 2022), e 2010 não mede minutos. As "
        "distribuições não formam série; cada edição publica o próprio vocabulário.",
    "frequencia_definicao_2010":
        "2010 pergunta se a pessoa retorna do trabalho para casa DIARIAMENTE; 2022 pergunta se "
        "retorna TRÊS OU MAIS DIAS POR SEMANA. Os códigos coincidem, as definições não: "
        "comparável em ordem de grandeza, não como série.",
    # 2022
    "status_colapsado_2022":
        "Só 2022 separa quem saiu do município natal pela primeira vez de quem já morava fora "
        "dele. Para comparar com as outras quatro edições, as duas categorias são somadas em "
        "'não natural do município' — a distinção fina continua disponível no painel da edição "
        "de 2022.",
    "sexo_indeterminado_2022":
        "O sexo 'indeterminado' só existe em 2022 e pesa menos de 0,03% da massa. Ele entra no "
        "total da faixa etária e fica fora do denominador da razão de sexo, em todas as "
        "edições, para que a comparação use a mesma base.",
    # transversais
    "conectividade_supressao":
        "O número de parceiros conta pares publicados: pares pequenos são suprimidos pelas "
        "regras de revelação e não aparecem. Como o tamanho da amostra varia entre censos, a "
        "contagem mede em parte a supressão, não só a conectividade — e também cai quando o "
        "território da unidade ainda não estava subdividido como hoje.",
    "gini_supressao":
        "Concentração calculada sobre os fluxos publicados; a cauda suprimida (cerca de 30% do "
        "volume, em todas as edições) não entra na conta.",
    "duncan_matriz_comum":
        "Calculado sobre a matriz comum às duas edições comparadas, com as duas matrizes "
        "renormalizadas nesse conjunto: sem isso, o índice mediria criação de município como "
        "se fosse mudança de padrão migratório.",
    "loglinear_matriz_comum":
        "Ajustado sobre a matriz comum às duas edições. Todos os parâmetros exceto T são "
        "livres de escala, de modo que a razão entre dois censos mede mudança de estrutura, "
        "não de volume.",
    "edu_anos_estudo":
        "Nesta edição o nível de instrução é derivado de 'anos de estudo': uma graduação de "
        "três anos soma 14 anos e cai em 'médio completo/superior incompleto', o que "
        "subestima ligeiramente 'superior completo' frente a 2010 e 2022.",
    "faixas_largas":
        "Calculada sobre as cinco faixas etárias publicadas (5–14, 15–24, 25–39, 40–59, 60+). "
        "A granularidade não permite ajustar um perfil de Rogers-Castro nem detectar "
        "deslocamentos da idade do pico menores que a largura da faixa.",
    "seletividade_fim_do_periodo":
        "Razão de chances entre migrantes e residentes. Dados de transição medem a "
        "característica no FIM do período: não se sabe se a escolaridade (ou a renda) é causa "
        "ou consequência da migração.",
    "n_unidades_variavel":
        "Medida do sistema calculada sobre as unidades existentes naquela edição, que são "
        "menos que as de 2022. A intensidade migratória cresce com o número de unidades "
        "(efeito Courgeau): parte da variação entre censos é de recorte, não de "
        "comportamento. O número de unidades é publicado ao lado de cada ponto.",
    "escala_cmi":
        "Intensidade e migração líquida agregada dependem do número de unidades do nível: "
        "comparar o valor de um município com o de uma UF não tem significado. A série é "
        "sempre lida dentro de um mesmo nível territorial.",
    "mei_estavel":
        "O índice de eficácia é uma razão entre saldo e volume e é estável a partir de ~20 "
        "unidades: pode ser lido entre níveis territoriais diferentes.",
    "cobertura_insuficiente":
        "Nesta edição, menos de 90% da população de 2022 desta unidade está coberta pelo "
        "território dos municípios existentes: a unidade não é mais a mesma e o número não é "
        "publicado.",
    "rm_unitaria":
        "Nesta edição a região metropolitana tem um único município: fluxo entre núcleo e "
        "periferia e pendularidade interna são zero por construção, não por medida.",
    "nucleo_divergente":
        "O núcleo metropolitano desta edição não é o mesmo das demais (o município-núcleo "
        "ainda não existia e o atlas usa o mais populoso presente): a decomposição núcleo × "
        "periferia não forma série.",
    "municipio_nao_existia":
        "O município não existia nesta edição. Seu território fazia parte do município de "
        "origem do desmembramento, cuja série pode ser aberta ao lado — as duas nunca são "
        "somadas nem emendadas.",
    "municipio_mae":
        "Nesta edição o município era territorialmente maior: parte da área que ele ocupa aqui "
        "é hoje de outro município. A queda de volume entre censos inclui, portanto, um degrau "
        "de fronteira que não é migração.",
}

# --------------------------------------------------------------------------------------
# Resolução da regra
# --------------------------------------------------------------------------------------

#: Quando um requisito não é atendido pela edição, a célula é `nao_comparavel` com esta nota.
_NOTA_POR_REQUISITO_AUSENTE: dict[str, dict[str, str]] = {
    "pendular": {"1991": "sem_pendular_1991"},
    "pendular_tempo": {"2000": "sem_tempo_freq_modo", "1980": "sem_tempo_freq_modo",
                       "1991": "sem_pendular_1991"},
    "pendular_frequencia": {"2000": "sem_tempo_freq_modo", "1980": "sem_tempo_freq_modo",
                            "1991": "sem_pendular_1991"},
    "pendular_modo": {"2010": "sem_modo_2010", "2000": "sem_tempo_freq_modo",
                      "1980": "sem_tempo_freq_modo", "1991": "sem_pendular_1991"},
    "pendular_posicao": {"1980": "sem_tempo_freq_modo", "1991": "sem_pendular_1991"},
    "renda": {"1980": "sem_renda_1980"},
    "erro_amostral": {"1980": "sem_estimativa_1980"},
}


def _requisito_atendido(req: str, cap: Capacidades) -> bool:
    if req in ("migracao", "fluxos_publicados", "composicao_interna"):
        return True
    if req == "estudo":
        return cap.estudo is not None
    if req == "erro_amostral":
        return cap.erro_amostral != "ausente"
    return bool(getattr(cap, req))


def regra(medida: str, edicao: str, nivel: str) -> Regra:
    """Estado de comparabilidade de (medida, edição, nível), com a nota do tooltip.

    Ordem de precedência, da mais forte para a mais fraca:
    1. a medida não existe naquele nível → `nao_comparavel` (sem nota: não é ausência de
       comparabilidade, é ausência da medida);
    2. a edição não mede o requisito → `nao_comparavel`, com a nota do requisito;
    3. exceção declarada no catálogo para aquela edição;
    4. ressalvas transversais da edição (proxy de 1980, precisão aproximada de 1991, piso do
       fluxo de estudo em 2000 e 1980);
    5. `comparavel`.
    """
    m = MEDIDAS_POR_CHAVE[medida]
    cap = CAPACIDADES[edicao]
    if nivel not in m.niveis:
        return Regra(Estado.NAO_COMPARAVEL, None)
    for req in m.requer:
        if not _requisito_atendido(req, cap):
            nota = _NOTA_POR_REQUISITO_AUSENTE.get(req, {}).get(edicao)
            return Regra(Estado.NAO_COMPARAVEL, nota)
    if edicao in m.excecoes:
        return m.excecoes[edicao]
    if "estudo" in m.requer and cap.estudo == "piso":
        return Regra(Estado.COM_RESSALVA, "estudo_piso")
    if "erro_amostral" in m.requer and cap.erro_amostral == "aproximado":
        return Regra(Estado.COM_RESSALVA, "precisao_aproximada_1991")
    return Regra(Estado.COMPARAVEL, None)


def regra_entre_niveis(medida: str) -> Regra:
    """Regra dura de escala: a medida pode ser lida ATRAVESSANDO níveis territoriais?

    Rees et al. (2017) mediram que a intensidade migratória cresce linearmente com o log do
    número de unidades, enquanto o índice de eficácia é estável a partir de ~20 unidades. Por
    isso CMI, SMI, ANMR, volumes, taxas brutas, distâncias, conectividade, Gini, Duncan D e os
    parâmetros do log-linear são `nao_comparavel` entre níveis — e comparáveis entre edições
    DENTRO de um nível. IEM/MEI e as medidas de composição e razão são livres de escala.
    """
    m = MEDIDAS_POR_CHAVE[medida]
    if m.entre_niveis:
        return Regra(Estado.COMPARAVEL, "mei_estavel" if m.chave in ("iem", "mei_agregado") else None)
    return Regra(Estado.NAO_COMPARAVEL, "escala_cmi")


def estado_bloco2(
    medida: str, edicao: str, nivel: str, n_unidades: int, n_unidades_2022: int
) -> Regra:
    """Regra do Bloco 2, que depende do número de unidades existentes na edição.

    As medidas do sistema são calculadas sobre as unidades PRESENTES em cada edição (5.570 →
    3.940 municípios), e a própria CMI se move por efeito Courgeau. Quando `n_unidades` difere
    do de 2022, a célula desce para `comparavel_com_ressalva` com a nota `n_unidades_variavel`,
    e `build_series.py` publica `n_unidades` ao lado do ponto.
    """
    base = regra(medida, edicao, nivel)
    if base.estado is Estado.NAO_COMPARAVEL:
        return base
    if medida == "mei_agregado" and n_unidades < MIN_UNIDADES_MEI:
        return Regra(Estado.COM_RESSALVA, "n_unidades_variavel")
    if n_unidades != n_unidades_2022 and medida in ("cmi", "smi", "anmr", "beta_fielding"):
        return Regra(Estado.COM_RESSALVA, "n_unidades_variavel")
    return base


def matriz() -> list[dict[str, object]]:
    """Todas as combinações (medida × edição × nível), para `comparabilidade.json`."""
    linhas: list[dict[str, object]] = []
    for m in MEDIDAS:
        for edicao in EDICOES:
            for nivel in NIVEIS:
                if nivel not in m.niveis:
                    continue
                r = regra(m.chave, edicao, nivel)
                linhas.append({
                    "medida": m.chave, "edicao": edicao, "nivel": nivel,
                    "estado": r.estado.value, "nota": r.nota,
                })
    return linhas


def payload() -> dict[str, object]:
    """Conteúdo de `data/processed/series/comparabilidade.json` (gravado pela F12.4)."""
    return {
        "edicoes": list(EDICOES),
        "niveis": list(NIVEIS),
        "medidas": [
            {
                "chave": m.chave, "rotulo": m.rotulo, "bloco": m.bloco, "formula": m.formula,
                "referencia": m.referencia, "niveis": list(m.niveis),
                "entre_niveis": m.entre_niveis, "requer": list(m.requer),
                "calibracao_1980": m.calibracao_1980,
            }
            for m in MEDIDAS
        ],
        "matriz": matriz(),
        "entre_niveis": {
            "livres": list(ESCALA_LIVRE),
            "presas_ao_nivel": list(ESCALA_PRESA_AO_NIVEL),
            "nota": "escala_cmi",
            "min_unidades_mei": MIN_UNIDADES_MEI,
        },
        "cobertura": {
            "limiar": LIMIAR_COBERTURA,
            "min_municipios_rm_intra": MIN_MUNICIPIOS_RM_INTRA,
            "estados": [c.value for c in Cobertura],
            "niveis_agregados": list(NIVEIS_AGREGADOS),
        },
        "calibracao_1980": CALIBRACAO_1980,
        "calibracao_1980_e_piso": CALIBRACAO_1980_E_PISO,
        "harmonizacao": {
            "status": HARMONIZACAO_STATUS,
            "idade_sexo": HARMONIZACAO_IDADE_SEXO,
            "edu": HARMONIZACAO_EDU,
            "renda": HARMONIZACAO_RENDA,
        },
        "tipologia_iem": {
            "limiar_rotatividade": IEM_LIMIAR_ROTATIVIDADE,
            "limiar_forte": IEM_LIMIAR_FORTE,
            "guarda_z": 1.96,
            "classes": [t.value for t in TipoIEM],
            "referencia": "Baeninger, R. (2012), REMHU 20(39):77–100",
        },
        "notas": NOTAS,
    }


def validar() -> None:
    """Consistência interna: toda nota citada existe, toda medida tem nível e requisito válidos.

    Chamada pelos testes da F12.4-t e pelo `__main__` deste módulo.
    """
    for m in MEDIDAS:
        assert m.niveis, f"{m.chave}: sem níveis"
        assert set(m.niveis) <= set(NIVEIS), f"{m.chave}: nível desconhecido"
        assert set(m.requer) <= set(REQUISITOS), f"{m.chave}: requisito desconhecido"
        assert m.calibracao_1980 in (None, *CALIBRACAO_1980), f"{m.chave}: calibração inválida"
        for edicao, r in m.excecoes.items():
            assert edicao in EDICOES, f"{m.chave}: edição desconhecida {edicao}"
            assert r.nota is None or r.nota in NOTAS, f"{m.chave}/{edicao}: nota {r.nota}"
    for linha in matriz():
        nota = linha["nota"]
        assert nota is None or nota in NOTAS, f"nota inexistente: {nota}"
    usadas = {l["nota"] for l in matriz() if l["nota"]}
    # notas de cobertura/escala/território não aparecem na matriz: são de estado de célula
    fora_da_matriz = {
        "escala_cmi", "mei_estavel", "n_unidades_variavel", "cobertura_insuficiente",
        "rm_unitaria", "nucleo_divergente", "municipio_nao_existia", "municipio_mae",
        "unidade_agregada_1980", "iem_sem_guarda_1980", "ocup_elementares",
    }
    orfas = set(NOTAS) - usadas - fora_da_matriz
    assert not orfas, f"notas declaradas e nunca usadas: {sorted(orfas)}"


if __name__ == "__main__":  # pragma: no cover
    validar()
    linhas = matriz()
    from collections import Counter

    c = Counter(l["estado"] for l in linhas)
    print(f"{len(MEDIDAS)} medidas, {len(linhas)} células: {dict(c)}")

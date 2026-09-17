"""Rótulos e tabelas de códigos do Censo 2010 (divisão territorial).

Gerado a partir de:
  data/raw2010/Documentação/Divisão Territorial do Brasil/
    Unidades da Federação, Mesorregiões, microrregiões e municípios 2010.ods

Estrutura:
  MUNICIPIOS_2010: dict[str, dict] com 5.565 municípios
    Chave: código de 7 dígitos (string)
    Valor: {'nome': str, 'uf': str (2 dígitos), 'uf_cod': str (2 dígitos),
            'cod_meso': str, 'nome_meso': str, 'cod_micro': str, 'nome_micro': str}

Não contém microdados individuais. Não editar à mão — rode o gerador novamente.
"""

import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


# Tabela de siglas de UF (cópia de pipeline/build_ref.py)
_UF_SIGLA = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
    "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
    "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}


def _parse_municipios_ods(filepath):
    """Parse arquivo ODS de divisão territorial.

    Uso interno durante geração do módulo.
    """
    NS = {
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
    }

    municipios = {}

    with zipfile.ZipFile(filepath) as z:
        root = ET.fromstring(z.read("content.xml"))

        for tbl in root.iter(f"{{{NS['table']}}}table"):
            nome_aba = tbl.get(f"{{{NS['table']}}}name")
            if nome_aba != "Município":
                continue

            rows_data = []
            for row in tbl.iter(f"{{{NS['table']}}}table-row"):
                celulas = []
                for c in row.findall("table:table-cell", NS):
                    rep = int(c.get(f"{{{NS['table']}}}number-columns-repeated", "1"))
                    txt = " ".join("".join(p.itertext()) for p in c.findall("text:p", NS)).strip()
                    celulas.extend([txt] * min(rep, 12))
                rows_data.append(celulas)

            # Linha 0: título mesclado
            # Linha 1: vazia
            # Linha 2: cabeçalho (UF, Nome_UF, Mesorregião, Nome_Mesorregião, etc.)
            # Linhas 3+: dados

            for row_idx in range(3, len(rows_data)):
                row = rows_data[row_idx]
                if len(row) >= 8:
                    uf_cod = row[0].strip()
                    uf_nome = row[1].strip()
                    cod_meso = row[2].strip()
                    nome_meso = row[3].strip()
                    cod_micro = row[4].strip()
                    nome_micro = row[5].strip()
                    cod_mun = row[6].strip()
                    nome_mun = row[7].strip()

                    if uf_cod and cod_mun and nome_mun:
                        # Garante que os códigos têm o tamanho certo
                        uf_cod = uf_cod.zfill(2)
                        cod_mun = cod_mun.zfill(7)
                        cod_meso = cod_meso.zfill(4) if cod_meso else ""
                        cod_micro = cod_micro.zfill(5) if cod_micro else ""

                        municipios[cod_mun] = {
                            "nome": nome_mun,
                            "uf": uf_cod,
                            "uf_cod": uf_cod,
                            "cod_meso": cod_meso,
                            "nome_meso": nome_meso,
                            "cod_micro": cod_micro,
                            "nome_micro": nome_micro,
                        }

    return municipios


# Caminho do arquivo ODS -- fonte pública do IBGE (divisão territorial, não microdado), mas
# vive dentro do symlink `data/raw2010`, presente só na máquina do titular do acesso. Em
# qualquer outro clone (CI, colaborador sem os microdados) o arquivo não existe: o parse
# fica vazio em vez de derrubar o import, e quem usa `MUNICIPIOS_2010` decide o que fazer
# (ver `pipeline/tests/test_edicao_2010.py`, que pula os testes quando o dicionário está vazio).
_div_ods = Path(__file__).parent.parent / "data/raw2010/Documentaá∆o/Divis∆o Territorial do Brasil/Unidades da Federaá∆o, Mesorregi‰es, microrregi‰es e munic°pios 2010.ods"
try:
    MUNICIPIOS_2010 = _parse_municipios_ods(_div_ods)
except FileNotFoundError:
    MUNICIPIOS_2010 = {}
"""Dicionário de municípios do Censo 2010. Mapeamento: cod_7dig -> info_dict. Vazio se
`data/raw2010` não estiver disponível nesta máquina."""


if __name__ == "__main__":
    print(f"Total de municípios: {len(MUNICIPIOS_2010)}")
    print()

    # Primeiras 3 e últimas 3 entradas por ordem de inserção
    items_list = list(MUNICIPIOS_2010.items())

    print("Primeiras 3 entradas:")
    for cod, info in items_list[:3]:
        print(f"  {cod}: {info}")

    print()
    print("Últimas 3 entradas:")
    for cod, info in items_list[-3:]:
        print(f"  {cod}: {info}")

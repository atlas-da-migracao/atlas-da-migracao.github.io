"""Layout de posições das variáveis do Censo 2010 (Amostra).

Gerado a partir de:
  data/raw2010/Documentação/Layout/Layout_microdados_Amostra.ods

Estrutura:
  Cada dicionário mapeia nome da variável (ex. "V0002") para
  (posição_inicial, tamanho, tipo) onde:
    - posição_inicial: posição 1-based (compatível com SUBSTR() do SQL)
    - tamanho: número de caracteres (= posição_final - posição_inicial + 1)
    - tipo: "A" (alfanumérico) ou "N" (numérico)

IMPORTANTE: As posições são 1-based conforme o layout original do IBGE.
Se usar com str[i:j] do Python (que é 0-based), subtraia 1 de posição_inicial.
Para SQL SUBSTR(coluna, pos, len), use diretamente: SUBSTR(coluna, posição_inicial, tamanho).

Referência: cada variável tem significado descrito em
  data/raw2010/Documentação/Layout/Descrição das variáveis - Microdados da amostra do Censo Demográfico 2010.pdf
"""

import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


def _parse_layout_ods(filepath, sheet_names):
    """Parse layout ODS e retorna dict com layouts por aba.

    Uso interno durante geração do módulo.
    """
    NS = {
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
    }

    layouts = {}

    with zipfile.ZipFile(filepath) as z:
        root = ET.fromstring(z.read("content.xml"))

        for tbl in root.iter(f"{{{NS['table']}}}table"):
            nome_aba = tbl.get(f"{{{NS['table']}}}name")

            if nome_aba not in sheet_names:
                continue

            rows_data = []
            for row in tbl.iter(f"{{{NS['table']}}}table-row"):
                celulas = []
                for c in row.findall("table:table-cell", NS):
                    rep = int(c.get(f"{{{NS['table']}}}number-columns-repeated", "1"))
                    txt = " ".join("".join(p.itertext()) for p in c.findall("text:p", NS)).strip()
                    celulas.extend([txt] * min(rep, 12))
                rows_data.append(celulas)

            # Skip header rows (0 e 1), process data from row 2 onwards
            layout_dict = {}
            for row_idx in range(2, len(rows_data)):
                row = rows_data[row_idx]
                if len(row) >= 7 and row[0].strip():
                    var = row[0].strip()
                    pos_inicial_str = row[2].strip()
                    pos_final_str = row[3].strip()
                    tipo = row[6].strip()

                    if var and pos_inicial_str and pos_final_str and tipo:
                        try:
                            pos_inicial = int(pos_inicial_str)
                            pos_final = int(pos_final_str)
                            tamanho = pos_final - pos_inicial + 1
                            layout_dict[var] = (pos_inicial, tamanho, tipo)
                        except ValueError:
                            pass

            layouts[nome_aba] = layout_dict

    return layouts


# Caminho do arquivo ODS (relativo ao repo, via symlink data/raw2010)
_layout_ods = Path(__file__).parent.parent / "data/raw2010/Documentaá∆o/Layout/Layout_microdados_Amostra.ods"
_layouts = _parse_layout_ods(_layout_ods, ["PESS", "DOMI"])

# Dicionários públicos
LAYOUT_PESSOAS = _layouts.get("PESS", {})
"""Layout das variáveis de Pessoas. Mapeamento: var_name -> (pos_inicial, tamanho, tipo)."""

LAYOUT_DOMICILIOS = _layouts.get("DOMI", {})
"""Layout das variáveis de Domicílios. Mapeamento: var_name -> (pos_inicial, tamanho, tipo)."""


if __name__ == "__main__":
    print(f"Total de variáveis em LAYOUT_PESSOAS: {len(LAYOUT_PESSOAS)}")
    print(f"Total de variáveis em LAYOUT_DOMICILIOS: {len(LAYOUT_DOMICILIOS)}")
    print()

    # Variáveis para verificação manual
    vars_check = ['V0002', 'V0010', 'V0011', 'V0300', 'V0626', 'V6264', 'V6400', 'V6532', 'V0662', 'V0661', 'V0660', 'V1004', 'V1006']

    for var in vars_check:
        in_pess = var in LAYOUT_PESSOAS
        in_domi = var in LAYOUT_DOMICILIOS

        if in_pess:
            pos_i, tam, tipo = LAYOUT_PESSOAS[var]
            print(f"{var} (PESS): pos={pos_i}, tamanho={tam}, tipo={tipo}")
        if in_domi:
            pos_i, tam, tipo = LAYOUT_DOMICILIOS[var]
            print(f"{var} (DOMI): pos={pos_i}, tamanho={tam}, tipo={tipo}")
        if not in_pess and not in_domi:
            print(f"{var}: NÃO ENCONTRADA")

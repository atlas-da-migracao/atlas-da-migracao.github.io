#!/usr/bin/env python3
"""Gerador de módulos layout_2000.py e labels_2000.py a partir da documentação pública do Censo 2000.

Requer: pandas (lê CSV convertido de XLS via LibreOffice)
Não lê microdados: apenas arquivos de documentação pública (SAS, XLS, TXT).

Gerado em: 2026-09-14
Censo: 2000 (Amostra)
"""

import re
import sys
import tempfile
import subprocess
from pathlib import Path
from io import StringIO
from datetime import datetime
from typing import Dict, Tuple, List, Set

def read_sas_file(filepath: Path, encoding: str = 'latin1') -> str:
    """Lê arquivo SAS em latin1."""
    with open(filepath, 'r', encoding=encoding) as f:
        return f.read()

def parse_sas_layout(sas_content: str) -> Dict[str, Tuple[int, int, str, int]]:
    """
    Parse arquivo SAS e extrai variáveis e suas posições.
    Formato esperado: @POS VARNAME FMT. /* descrição */
    Retorna: dict[varname] = (pos_inicial_1based, tamanho, tipo, decimais)
    """
    layout = {}

    # Regex para linhas do INPUT do SAS
    # @POS VARNAME FMT
    # FMT pode ser: $N. (alfanumérico), N. (inteiro), N.D (decimal com D casas)
    pattern = r'^@(\d+)\s+([A-Z0-9_]+)\s+(\$?)(\d+)(?:\.(\d+))?'

    for line in sas_content.split('\n'):
        line = line.strip()
        match = re.match(pattern, line)
        if match:
            pos_inicial = int(match.group(1))  # 1-based
            varname = match.group(2)
            is_alpha = match.group(3) == '$'
            tamanho = int(match.group(4))
            decimais = int(match.group(5)) if match.group(5) else 0

            tipo = 'A' if is_alpha else 'N'
            layout[varname] = (pos_inicial, tamanho, tipo, decimais)

    return layout

def xls_to_csv(xls_path: Path, sheet_name: int = 0) -> str:
    """
    Converte arquivo XLS para CSV usando LibreOffice e retorna conteúdo CSV.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)

        # Converter XLS para CSV via soffice
        cmd = [
            '/opt/homebrew/bin/soffice',
            '--headless',
            '--convert-to', 'csv',
            '--outdir', str(tmppath),
            str(xls_path)
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                raise RuntimeError(f"soffice falhou: {result.stderr}")
        except FileNotFoundError:
            raise RuntimeError("LibreOffice (soffice) não encontrado. Instale com: brew install libreoffice")

        # Encontrar arquivo CSV gerado
        csv_files = list(tmppath.glob('*.csv'))
        if not csv_files:
            raise RuntimeError(f"Nenhum CSV gerado em {tmppath}")

        csv_file = csv_files[0]
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

def parse_csv_municipios_v4250(csv_content: str) -> Dict[str, str]:
    """Parse CSV da tabela V4250 (CODIGO, NOME).
    Retorna: dict[codigo_7dig] = nome"""
    municipios = {}
    lines = csv_content.strip().split('\n')

    # Skip header (primeira linha)
    for line in lines[1:]:
        parts = line.split(',', 1)
        if len(parts) < 2:
            continue
        try:
            codigo = parts[0].strip().strip('"')
            nome = parts[1].strip().strip('"')

            # Garante 7 dígitos
            if codigo and codigo.isdigit() and len(codigo) <= 7:
                codigo = codigo.zfill(7)
                municipios[codigo] = nome
        except Exception:
            pass

    return municipios

def parse_csv_municipios_v4276(csv_content: str) -> Tuple[Dict[str, str], Set[str]]:
    """Parse CSV da tabela V4276 (CODIGO, NOME).
    Retorna: (dict[codigo] = nome, set[codigo_paises])"""
    municipios_e_paises = {}
    paises_codes = set()

    lines = csv_content.strip().split('\n')
    for line in lines[1:]:  # Skip header
        parts = line.split(',', 1)
        if len(parts) < 2:
            continue
        try:
            codigo = parts[0].strip().strip('"')
            nome = parts[1].strip().strip('"')

            if codigo and codigo.isdigit():
                codigo = codigo.zfill(7)
                municipios_e_paises[codigo] = nome

                # Detecta se é país (começa com 80)
                if codigo.startswith('80'):
                    paises_codes.add(codigo)
        except Exception:
            pass

    return municipios_e_paises, paises_codes

def parse_csv_dtb(csv_content: str) -> Tuple[Dict[str, Dict], Set[str]]:
    """Parse CSV da Divisão Territorial Brasileira.
    Esperado: UF, Nome_UF, Mesorregião, Nome_Mesorregião, Microrregião, Nome_Microrregião,
              Código do Município, Nome do Município, Código do Distrito, Nome do Distrito,
              Código do Subdistrito, Nome do Subdistrito

    Retorna dict deduplicated por município (não include distrito/subdistrito).
    Também retorna set de códigos "SEM ESPECIFICACAO".
    """
    municipios_dtb = {}
    sem_especificacao = set()
    lines = csv_content.strip().split('\n')

    # Parse linhas (skip header). Este CSV (Divisão Territorial Brasileira) tem UMA única
    # linha de cabeçalho -- ao contrário de outras planilhas auxiliares (ex.: Estrutura
    # Migração) que têm título+linha vazia+cabeçalho. Um lines[3:] aqui descartaria
    # silenciosamente os 2 primeiros municípios do arquivo (Alta Floresta D'Oeste e
    # Ariquemes, RO), que ficariam sem meso/micro -- bug encontrado e corrigido em 2026-09-14.
    for line in lines[1:]:
        # CSV quoteado
        parts = [p.strip().strip('"') for p in line.split(',')]
        if len(parts) < 8:
            continue

        try:
            uf_cod = parts[0]
            uf_nome = parts[1]
            cod_meso = parts[2]
            nome_meso = parts[3]
            cod_micro = parts[4]
            nome_micro = parts[5]
            cod_mun = parts[6]
            nome_mun = parts[7]

            if uf_cod and cod_mun and nome_mun:
                uf_cod = uf_cod.zfill(2)
                cod_mun = cod_mun.zfill(7)
                cod_meso = cod_meso.zfill(4) if cod_meso else ""
                cod_micro = cod_micro.zfill(5) if cod_micro else ""

                # Detecta se é "SEM ESPECIFICACAO"
                if "SEM ESPECIFICACAO" in nome_mun.upper():
                    sem_especificacao.add(cod_mun)

                # Deduplica por código de município (só a primeira ocorrência)
                if cod_mun not in municipios_dtb:
                    municipios_dtb[cod_mun] = {
                        'nome': nome_mun,
                        'uf': uf_cod,
                        'uf_cod': uf_cod,
                        'cod_meso': cod_meso,
                        'nome_meso': nome_meso,
                        'cod_micro': cod_micro,
                        'nome_micro': nome_micro,
                    }
        except Exception:
            pass

    return municipios_dtb, sem_especificacao

def parse_csv_uf_seq(csv_content: str, csv_separator: str = ',') -> Dict[str, str]:
    """Parse CSV de estrutura de migração (sequencial 2-dígitos -> nome UF/país).
    Formato esperado: CODIGO,UNIDADE DA FEDERACAO (header na linha 2, skip linhas 0-1)
    Retorna: dict[codigo_seq] = codigo_ibge_2dig (ou None para países)
    """
    # Mapeamento de nomes de UF para códigos IBGE 2 dígitos
    uf_nome_to_ibge = {
        "RONDÔNIA": "11", "RONDONIA": "11",
        "ACRE": "12",
        "AMAZONAS": "13",
        "RORAIMA": "14",
        "PARÁ": "15", "PARA": "15",
        "AMAPÁ": "16", "AMAPA": "16",
        "TOCANTINS": "17",
        "MARANHÃO": "21", "MARANHAO": "21",
        "PIAUÍ": "22", "PIAUI": "22",
        "CEARÁ": "23", "CEARA": "23",
        "RIO GRANDE DO NORTE": "24",
        "PARAÍBA": "25", "PARAIBA": "25",
        "PERNAMBUCO": "26",
        "ALAGOAS": "27",
        "SERGIPE": "28",
        "BAHIA": "29",
        "MINAS GERAIS": "31",
        "ESPÍRITO SANTO": "32", "ESPIRITO SANTO": "32",
        "RIO DE JANEIRO": "33",
        "SÃO PAULO": "35", "SAO PAULO": "35",
        "PARANÁ": "41", "PARANA": "41",
        "SANTA CATARINA": "42",
        "RIO GRANDE DO SUL": "43",
        "MATO GROSSO DO SUL": "50",
        "MATO GROSSO": "51",
        "GOIÁS": "52", "GOIAS": "52",
        "DISTRITO FEDERAL": "53",
    }

    result = {}
    lines = csv_content.strip().split('\n')

    # Skip primeiras 3 linhas (cabeçalho começando em linha 2)
    for line in lines[3:]:
        line = line.strip()
        if not line:
            continue

        parts = [p.strip().strip('"').upper() for p in line.split(csv_separator)]
        if len(parts) < 2:
            continue

        try:
            seq_code = parts[0]
            nome = parts[1]

            if seq_code.isdigit() and len(seq_code) <= 2:
                seq_code = seq_code.zfill(2)

                # Tenta mapear para código IBGE
                if nome in uf_nome_to_ibge:
                    result[seq_code] = uf_nome_to_ibge[nome]
                else:
                    # Se não for UF conhecida, é país/especial -> None
                    result[seq_code] = None
        except Exception:
            pass

    return result

def enrich_municipios_com_dtb(municipios_v4250: Dict[str, str], municipios_dtb: Dict[str, Dict]) -> Dict[str, Dict]:
    """Enriquece V4250 com dados de DTB quando disponível.
    Retorna dict[cod] = {nome, uf, uf_cod, cod_meso, nome_meso, cod_micro, nome_micro}
    """
    municipios_enriquecidos = {}

    for cod, nome in municipios_v4250.items():
        info = {
            'nome': nome,
            'uf': cod[:2],  # Primeiros 2 dígitos = UF
            'uf_cod': cod[:2],
            'cod_meso': '',
            'nome_meso': '',
            'cod_micro': '',
            'nome_micro': '',
        }

        # Se existe em DTB, copia os dados territoriais -- e o NOME também: a Divisão
        # Territorial Brasileira preserva capitalização e acentos ("Alta Floresta D'Oeste"),
        # enquanto a planilha V4250 vem toda em caixa alta sem acento ("ALTA FLORESTA
        # D'OESTE"), inconsistente com os nomes de município de 2022/2010 -- achado do
        # checkpoint do auditor em 2026-09-14.
        if cod in municipios_dtb:
            dtb_info = municipios_dtb[cod]
            info['nome'] = dtb_info['nome']
            info['cod_meso'] = dtb_info['cod_meso']
            info['nome_meso'] = dtb_info['nome_meso']
            info['cod_micro'] = dtb_info['cod_micro']
            info['nome_micro'] = dtb_info['nome_micro']

        municipios_enriquecidos[cod] = info

    return municipios_enriquecidos

def parse_txt_v1004(txt_content: str) -> Dict[str, str]:
    """Parse arquivo V1004.txt (Região Metropolitana)."""
    rm = {}

    for line in txt_content.split('\n'):
        line = line.strip()
        if not line or line.startswith('V1004') or line.startswith('CENSO'):
            continue

        # Formato: NN- Nome
        match = re.match(r'^(\d{2})[- ]+(.*)$', line)
        if match:
            codigo = match.group(1)
            nome = match.group(2).strip()
            rm[codigo] = nome

    return rm

def generate_layout_2000(sas_pessoas: str, sas_domic: str, lrecl_pessoas: int, lrecl_domic: int) -> Tuple[Dict, Dict]:
    """Gera os dicionários de layout a partir dos conteúdos SAS."""
    layout_pessoas = parse_sas_layout(sas_pessoas)
    layout_domic = parse_sas_layout(sas_domic)

    # Ordenar por posição
    layout_pessoas = dict(sorted(layout_pessoas.items(), key=lambda x: x[1][0]))
    layout_domic = dict(sorted(layout_domic.items(), key=lambda x: x[1][0]))

    return layout_pessoas, layout_domic

def main():
    """Orquestrador principal."""
    base_path = Path('/Volumes/Zeitmaschine/Microdados_Censo_Demografico_2000_Amostra')
    doc_path = base_path / '1_Documentacao_20170908'
    sas_path = doc_path / 'SAS'
    aux_path = doc_path / 'Arquivos Auxiliares'

    print("[1/10] Lendo arquivos SAS...")
    sas_pessoas = read_sas_file(sas_path / 'LE PESSOAS.sas')
    sas_domic = read_sas_file(sas_path / 'LE DOMIC.sas')

    print("[2/10] Parsing layouts SAS...")
    layout_pessoas, layout_domic = generate_layout_2000(sas_pessoas, sas_domic, 390, 170)

    print(f"  - Pessoas: {len(layout_pessoas)} variáveis (LRECL=390)")
    print(f"  - Domicílios: {len(layout_domic)} variáveis (LRECL=170)")

    # Validação de sanidade
    print("[3/10] Verificando sanidades do layout...")
    sanidade_checks = [
        ('V1103', layout_pessoas, (12, 7, 'A', 0)),
        ('V0300', layout_pessoas, (39, 8, 'N', 0)),
        ('AREAP', layout_pessoas, (51, 13, 'A', 0)),
        ('V0415', layout_pessoas, (103, 1, 'A', 0)),
        ('V0424', layout_pessoas, (128, 1, 'A', 0)),
        ('V4250', layout_pessoas, (130, 7, 'A', 0)),
        ('V4276', layout_pessoas, (141, 7, 'A', 0)),
        ('P001', layout_pessoas, (335, 11, 'N', 8)),
        ('V0103', layout_domic, (12, 7, 'A', 0)),
        ('AREAP', layout_domic, (52, 13, 'A', 0)),
        ('P001', layout_domic, (157, 11, 'N', 8)),
    ]

    sanidade_falhas = []
    for var_name, layout_dict, expected in sanidade_checks:
        if var_name in layout_dict:
            actual = layout_dict[var_name]
            if actual == expected:
                print(f"  ✓ {var_name}: {actual}")
            else:
                msg = f"  ✗ {var_name}: esperado {expected}, obtido {actual}"
                print(msg)
                sanidade_falhas.append(msg)
        else:
            msg = f"  ✗ {var_name}: não encontrada"
            print(msg)
            sanidade_falhas.append(msg)

    # Lê tabelas de códigos
    print("[4/10] Convertendo Municipios-V4250.xls para CSV...")
    municipios_v4250 = {}
    uf_sem_espec_v4250 = set()
    try:
        csv_v4250 = xls_to_csv(aux_path / 'Municipios-V4250.xls')
        municipios_v4250 = parse_csv_municipios_v4250(csv_v4250)

        # Extrai "sem especificação"
        for cod, nome in municipios_v4250.items():
            if 'SEM ESPECIFICACAO' in nome.upper():
                uf_sem_espec_v4250.add(cod)

        print(f"  - {len(municipios_v4250)} códigos")
        print(f"  - {len(uf_sem_espec_v4250)} SEM ESPECIFICACAO")
    except Exception as e:
        print(f"  ! Erro ao ler V4250: {e}")
        municipios_v4250 = {}

    print("[5/10] Convertendo Municipios e Pais Estrangeiro - V4276.xls para CSV...")
    try:
        csv_v4276 = xls_to_csv(aux_path / 'Municipios e Pais Estrangeiro - V4276.xls')
        municipios_v4276, paises_v4276 = parse_csv_municipios_v4276(csv_v4276)
        print(f"  - {len(municipios_v4276)} códigos (municípios + países)")
        print(f"  - {len(paises_v4276)} países (80xxxxx)")
    except Exception as e:
        print(f"  ! Erro ao ler V4276: {e}")
        municipios_v4276 = {}
        paises_v4276 = set()

    print("[6/10] Convertendo Divisão Territorial Brasileira.xls para CSV...")
    try:
        csv_dtb = xls_to_csv(aux_path / 'Divisao Territorial Brasileira.xls')
        municipios_dtb, _ = parse_csv_dtb(csv_dtb)
        print(f"  - {len(municipios_dtb)} municípios (deduplicados por código)")
    except Exception as e:
        print(f"  ! Erro ao ler DTB: {e}")
        municipios_dtb = {}

    print("[7/10] Convertendo Estrutura de Migração...")
    try:
        csv_v4210 = xls_to_csv(aux_path / 'Estrutura Migracao V4210, V4260.xls')
        uf_seq_v4210 = parse_csv_uf_seq(csv_v4210)
        print(f"  - V4210/V4260: {len(uf_seq_v4210)} sequenciais mapeados")
    except Exception as e:
        print(f"  ! Erro ao ler V4210/V4260: {e}")
        uf_seq_v4210 = {}

    try:
        csv_v4230 = xls_to_csv(aux_path / 'Estrutura Migracao V4230.xls')
        uf_seq_v4230 = parse_csv_uf_seq(csv_v4230)
        print(f"  - V4230: {len(uf_seq_v4230)} sequenciais mapeados")
    except Exception as e:
        print(f"  ! Erro ao ler V4230: {e}")
        uf_seq_v4230 = {}

    print("[8/10] Lendo V1004.txt (Regiões Metropolitanas)...")
    v1004_content = (aux_path / 'V1004.txt').read_text(encoding='latin1')
    rm_2000 = parse_txt_v1004(v1004_content)
    print(f"  - {len(rm_2000)} RMs")

    # Enriquecer V4250 com dados de DTB
    print("[6.5/10] Enriquecendo municípios com dados territoriais...")
    municipios_final = enrich_municipios_com_dtb(municipios_v4250, municipios_dtb)
    print(f"  - {len(municipios_final)} municípios + códigos especiais")

    # Sanidades para labels
    print("[9/10] Verificando sanidades dos labels...")

    label_sanidades = []

    # Usar UFs sem especificação detectadas em V4250
    uf_sem_espec = uf_sem_espec_v4250

    print(f"  - UF sem especificação: {len(uf_sem_espec)} (esperado 27)")
    if len(uf_sem_espec) != 27:
        label_sanidades.append(f"Esperado 27 UFs sem especificação, obtido {len(uf_sem_espec)}")

    # V4250 tem 5534 total, menos 27 "sem especificação" = 5507 municípios reais.
    # MUNICIPIOS_2000 é um dicionário de MUNICÍPIOS -- os códigos "sem especificação" (um
    # por UF, ex.: "RONDONIA - SEM ESPECIFICACAO") são pseudo-códigos usados só nas
    # variáveis de migração (V4250/V4276) para indicar origem/destino não informado, não
    # município; ficam disponíveis via UF_SEM_ESPECIFICACAO_2000, não em MUNICIPIOS_2000
    # (bug encontrado em 2026-09-14: estavam sendo incluídos com meso/micro vazios).
    municipios_final = {cod: info for cod, info in municipios_final.items() if cod not in uf_sem_espec}
    municipios_reais = len(municipios_final)
    print(f"  - Municípios (V4250 total: {len(municipios_v4250)}, reais: {municipios_reais}, sem espec: {len(uf_sem_espec)})")
    if municipios_reais != 5507:
        label_sanidades.append(f"Esperado 5507 municípios reais em MUNICIPIOS_2000, obtido {municipios_reais}")
    sem_meso = [cod for cod, info in municipios_final.items() if not info.get("cod_meso") or not info.get("nome_meso")]
    if sem_meso:
        label_sanidades.append(f"{len(sem_meso)} município(s) em MUNICIPIOS_2000 sem meso/micro (sem par na DTB): {sem_meso[:10]}")

    print(f"  - UFs mapeadas (V4210): {sum(1 for v in uf_seq_v4210.values() if v)} (esperado 27)")

    # Gerar módulo layout_2000.py
    print("[10/10] Gerando módulos...")

    layout_2000_code = generate_layout_2000_module(layout_pessoas, layout_domic)
    labels_2000_code = generate_labels_2000_module(
        municipios_final, uf_sem_espec, paises_v4276,
        uf_seq_v4210, uf_seq_v4230, rm_2000
    )

    repo_root = Path('/Users/danielpessini/Documents/Code/estudos-pesquisa/atlas-migração')
    layout_file = repo_root / 'pipeline' / 'layout_2000.py'
    labels_file = repo_root / 'pipeline' / 'labels_2000.py'

    layout_file.write_text(layout_2000_code)
    labels_file.write_text(labels_2000_code)

    print(f"  ✓ layout_2000.py ({len(layout_2000_code)} bytes, {len(layout_pessoas) + len(layout_domic)} variáveis)")
    print(f"  ✓ labels_2000.py ({len(labels_2000_code)} bytes)")

    # Relatório final
    print("\n=== RELATÓRIO FINAL ===")
    print(f"Variáveis (Pessoas): {len(layout_pessoas)}")
    print(f"Variáveis (Domicílios): {len(layout_domic)}")
    print(f"MUNICIPIOS_2000 (municípios reais, sem os códigos 'sem especificação'): {municipios_reais}")
    print(f"  - SEM ESPECIFICACAO: {len(uf_sem_espec)}")
    print(f"Países (V4276): {len(paises_v4276)}")
    print(f"Regiões Metropolitanas: {len(rm_2000)}")
    print(f"UFs mapeadas (V4210/V4260): {sum(1 for v in uf_seq_v4210.values() if v)}")
    print(f"Sanidades de layout: {len(layout_pessoas) + len(layout_domic) - len(sanidade_falhas)}/{len(layout_pessoas) + len(layout_domic)}")

    if sanidade_falhas or label_sanidades:
        print("\nSanidades com FALHA:")
        for msg in sanidade_falhas + label_sanidades:
            print(f"  {msg}")
        return 1

    print("\nTodas as sanidades verificadas OK!")
    return 0

def generate_layout_2000_module(layout_pessoas: Dict, layout_domic: Dict) -> str:
    """Gera conteúdo do módulo layout_2000.py."""
    timestamp = datetime.now().isoformat()

    code = f'''"""Layout de posições das variáveis do Censo 2000 (Amostra).

Gerado por pipeline/gen_edicao_2000.py em {timestamp}; não editar à mão.

Estrutura:
  LAYOUT_PESSOAS: dict[str, tuple[int, int, str, int]]
    var → (posição_inicial, tamanho, tipo, decimais)
  LAYOUT_DOMICILIOS: idem

As posições são 1-based (compatível com SUBSTR() do SQL).
Para str[i:j] do Python (0-based), subtraia 1 de posição_inicial.
"""

LRECL_PESSOAS = 390
LRECL_DOMICILIOS = 170

LAYOUT_PESSOAS = {{
'''

    for var, (pos, tam, tipo, dec) in sorted(layout_pessoas.items(), key=lambda x: x[1][0]):
        code += f"    {var!r}: ({pos}, {tam}, {tipo!r}, {dec}),\n"

    code += f'''}}\n
"""Dicionário de layout para Pessoas (Censo 2000). Total: {len(layout_pessoas)} variáveis."""

LAYOUT_DOMICILIOS = {{
'''

    for var, (pos, tam, tipo, dec) in sorted(layout_domic.items(), key=lambda x: x[1][0]):
        code += f"    {var!r}: ({pos}, {tam}, {tipo!r}, {dec}),\n"

    code += f'''}}\n
"""Dicionário de layout para Domicílios (Censo 2000). Total: {len(layout_domic)} variáveis."""
'''

    return code

def generate_labels_2000_module(
    municipios: Dict,
    uf_sem_espec: Set[str],
    paises: Set[str],
    uf_seq_v4210: Dict,
    uf_seq_v4230: Dict,
    rm: Dict
) -> str:
    """Gera conteúdo do módulo labels_2000.py."""
    timestamp = datetime.now().isoformat()

    code = f'''"""Rótulos e tabelas de códigos do Censo 2000 (Amostra).

Gerado por pipeline/gen_edicao_2000.py em {timestamp}; não editar à mão.

Estrutura:
  MUNICIPIOS_2000: dict[str, dict]
    Chave: código 7-dígitos; valor: {{nome, uf, uf_cod, cod_meso, nome_meso, cod_micro, nome_micro}}
  UF_SEQ_2000: dict[str, str | None]
    Sequencial 2-dígitos (V4210/V4260) → código IBGE 2-dígitos ou None
  V4230_SEQ_2000: dict[str, str | None]
    Sequencial 2-dígitos (V4230) → código IBGE 2-dígitos ou None
  CODIGOS_ESPECIAIS_2000: dict
  UF_SEM_ESPECIFICACAO_2000: frozenset[str]
  PAISES_V4276_2000: frozenset[str]
  RM_2000: dict[str, str]
"""

MUNICIPIOS_2000 = {{
'''

    # Serializar municípios
    for cod, info in sorted(municipios.items()):
        code += f"    {cod!r}: {{\n"
        code += f"        'nome': {info['nome']!r},\n"
        code += f"        'uf': {info['uf']!r},\n"
        code += f"        'uf_cod': {info['uf_cod']!r},\n"
        code += f"        'cod_meso': {info['cod_meso']!r},\n"
        code += f"        'nome_meso': {info['nome_meso']!r},\n"
        code += f"        'cod_micro': {info['cod_micro']!r},\n"
        code += f"        'nome_micro': {info['nome_micro']!r},\n"
        code += f"    }},\n"

    code += f'''}}\n
"""Total: {len(municipios)} municípios."""

UF_SEQ_2000 = {{
'''

    for seq, codigo_ibge in sorted(uf_seq_v4210.items()):
        if codigo_ibge:  # Só UFs
            code += f"    {seq!r}: {codigo_ibge!r},\n"

    code += f'''}}\n
"""Sequencial (V4210/V4260) → Código IBGE UF. Total UFs: {sum(1 for v in uf_seq_v4210.values() if v)}."""

V4230_SEQ_2000 = {{
'''

    for seq, codigo_ibge in sorted(uf_seq_v4230.items()):
        if codigo_ibge:  # Só UFs
            code += f"    {seq!r}: {codigo_ibge!r},\n"

    code += f'''}}\n
"""Sequencial (V4230) → Código IBGE UF. (Se idêntico a UF_SEQ_2000, copiar referência.)"""

CODIGOS_ESPECIAIS_2000 = {{
    'neste_municipio': '0100008',
    'nao_trabalha_nem_estuda': '0200006',
    'brasil_sem_especificacao': '5400007',
    'pais_sem_especificacao': '8000002',
}}

UF_SEM_ESPECIFICACAO_2000 = frozenset([
'''

    for cod in sorted(uf_sem_espec):
        code += f"    {cod!r},\n"

    code += f'''])\n
"""Total: {len(uf_sem_espec)} UFs sem especificação."""

PAISES_V4276_2000 = frozenset([
'''

    for cod in sorted(paises):
        code += f"    {cod!r},\n"

    code += f'''])\n
"""Códigos 80xxxxx de países estrangeiros em V4276. Total: {len(paises)}."""

RM_2000 = {{
'''

    for cod, nome in sorted(rm.items()):
        code += f"    {cod!r}: {nome!r},\n"

    code += f'''}}\n
"""Regiões Metropolitanas (V1004). Total: {len(rm)}."""
'''

    return code

if __name__ == '__main__':
    sys.exit(main())

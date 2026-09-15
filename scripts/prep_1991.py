#!/usr/bin/env python3
"""
Processa os 27 arquivos DBF do Censo 1991.

Lê cada DBF, decodifica registros (descartando deletados), calcula controle
de domicílio via PESSOAN, e escreve arquivos TXT em data/interim/1991/raw_txt/.

Uso:
  python scripts/prep_1991.py [--uf <codigo>] [--check] [--entrada DIR]

Exemplos:
  python scripts/prep_1991.py --uf 14 --check     # Processa RR com validação
  python scripts/prep_1991.py --check              # Processa todas as 27 UFs
"""

import struct
import sys
from pathlib import Path
from typing import Dict, Tuple
from dataclasses import dataclass

# scripts/ não está no mesmo pacote que pipeline/ -- quando este script roda como
# `python scripts/prep_1991.py`, sys.path[0] é `scripts/`, não a raiz do repo, e
# `from pipeline.layout_1991 import LAYOUT_PESSOAS` falharia silenciosamente (ImportError
# engolido por get_pessoan_position) e caía no fallback hardcoded ERRADO. Bug real, achado
# pelo agente metodologo em 2026-09-15: com o fallback, `controle` (a chave de domicílio) saía
# de PESSOAN mal lido, dando 1.726.116 domicílios em vez dos 4.024.553 corretos.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


@dataclass
class DBFFileConfig:
    """Configuração de um arquivo DBF."""
    uf_code: str
    uf_name: str
    region: str
    arquivo_dbf: str


# Mapeamento de código UF para informações
UF_CONFIGS: Dict[str, DBFFileConfig] = {
    "11": DBFFileConfig("11", "RO", "Região Norte", "CD91AMOUP11.DBF"),
    "12": DBFFileConfig("12", "AC", "Região Norte", "CD91AMOUP12.DBF"),
    "13": DBFFileConfig("13", "AM", "Região Norte", "CD91AMOUP13.DBF"),
    "14": DBFFileConfig("14", "RR", "Região Norte", "CD91AMOUP14.DBF"),
    "15": DBFFileConfig("15", "PA", "Região Norte", "CD91AMOUP15.DBF"),
    "16": DBFFileConfig("16", "AP", "Região Norte", "CD91AMOUP16.DBF"),
    "17": DBFFileConfig("17", "TO", "Região Norte", "CD91AMOUP17.DBF"),
    "21": DBFFileConfig("21", "MA", "Região Nordeste", "CD91AMOUP21.DBF"),
    "22": DBFFileConfig("22", "PI", "Região Nordeste", "CD91AMOUP22.DBF"),
    "23": DBFFileConfig("23", "CE", "Região Nordeste", "CD91AMOUP23.DBF"),
    "24": DBFFileConfig("24", "RN", "Região Nordeste", "CD91AMOUP24.DBF"),
    "25": DBFFileConfig("25", "PB", "Região Nordeste", "CD91AMOUP25.DBF"),
    "26": DBFFileConfig("26", "PE", "Região Nordeste", "CD91AMOUP26.DBF"),
    "27": DBFFileConfig("27", "AL", "Região Nordeste", "CD91AMOUP27.DBF"),
    "28": DBFFileConfig("28", "SE", "Região Nordeste", "CD91AMOUP28.DBF"),
    "29": DBFFileConfig("29", "BA", "Região Nordeste", "CD91AMOUP29.DBF"),
    "31": DBFFileConfig("31", "MG", "Região Sudeste", "CD91AMOUP31.DBF"),
    "32": DBFFileConfig("32", "ES", "Região Sudeste", "CD91AMOUP32.DBF"),
    "33": DBFFileConfig("33", "RJ", "Região Sudeste", "CD91AMOUP33.DBF"),
    "35": DBFFileConfig("35", "SP", "Região Sudeste", "CD91AMOUP35.DBF"),
    "41": DBFFileConfig("41", "PR", "Região Sul", "CD91AMOUP41.DBF"),
    "42": DBFFileConfig("42", "SC", "Região Sul", "CD91AMOUP42.DBF"),
    "43": DBFFileConfig("43", "RS", "Região Sul", "CD91AMOUP43.DBF"),
    "50": DBFFileConfig("50", "MS", "Região Centro Oeste", "CD91AMOUP50.DBF"),
    "51": DBFFileConfig("51", "MT", "Região Centro Oeste", "CD91AMOUP51.DBF"),
    "52": DBFFileConfig("52", "GO", "Região Centro Oeste", "CD91AMOUP52.DBF"),
    "53": DBFFileConfig("53", "DF", "Região Centro Oeste", "CD91AMOUP53.DBF"),
}

# Mapeamento de UF para pasta (com acentos corretos para listagem do disco)
_PASTA_OVERRIDE = {
    "11": "Região Norte",
    "12": "Região Norte",
    "13": "Região Norte",
    "14": "Região Norte",
    "15": "Região Norte",
    "16": "Região Norte",
    "17": "Região Norte",
    "21": "Região Nordeste",
    "22": "Região Nordeste",
    "23": "Região Nordeste",
    "24": "Região Nordeste",
    "25": "Região Nordeste",
    "26": "Região Nordeste",
    "27": "Região Nordeste",
    "28": "Região Nordeste",
    "29": "Região Nordeste",
    "31": "Região Sudeste",
    "32": "Região Sudeste",
    "33": "Região Sudeste",
    "35": "Região Sudeste",
    "41": "Região Sul",
    "42": "Região Sul",
    "43": "Região Sul",
    "50": "Região Centro Oeste",
    "51": "Região Centro Oeste",
    "52": "Região Centro Oeste",
    "53": "Região Centro Oeste",
}


def read_dbf_header(dbf_path: Path) -> Tuple[int, int, int]:
    """
    Lê metadados do header dBase.

    Retorna: (nrec, headerlen, reclen)
    """
    with open(dbf_path, 'rb') as f:
        header = f.read(12)

    nrec = struct.unpack('<I', header[4:8])[0]
    headerlen = struct.unpack('<H', header[8:10])[0]
    reclen = struct.unpack('<H', header[10:12])[0]

    return nrec, headerlen, reclen


def get_pessoan_position() -> Tuple[int, int]:
    """
    Extrai posição do campo PESSOAN do layout_1991.

    Retorna: (posição_1based, tamanho)
    """
    from pipeline.layout_1991 import LAYOUT_PESSOAS
    if 'PESSOAN' not in LAYOUT_PESSOAS:
        raise RuntimeError(
            "pipeline/layout_1991.py não tem a entrada 'PESSOAN' -- não há fallback seguro "
            "para a posição desse campo (um fallback hardcoded já causou um bug real: ver "
            "docs/EDICOES.md / pipeline/sql/1991/CABECALHO_02_classify.txt, item 15e). "
            "Regenere layout_1991.py com pipeline/gen_edicao_1991.py antes de continuar."
        )
    pos, tam, _, _ = LAYOUT_PESSOAS['PESSOAN']
    return pos, tam


def process_dbf_file(dbf_path: Path, uf_code: str, check: bool = False) -> Dict:
    """
    Processa um arquivo DBF e escreve saída em data/interim/1991/raw_txt/.

    Retorna: {nrec, deletados, escritos}
    """

    nrec, headerlen, reclen = read_dbf_header(dbf_path)

    # Criar diretório de saída
    out_dir = Path('/Users/danielpessini/Documents/Code/estudos-pesquisa/atlas-migração/data/interim/1991/raw_txt')
    out_dir.mkdir(parents=True, exist_ok=True)

    # Nome do arquivo de saída
    out_filename = f"CD91AMOUP{uf_code}.txt"
    out_path = out_dir / out_filename

    pessoan_pos, pessoan_len = get_pessoan_position()
    pessoan_pos_0based = pessoan_pos - 1  # Converter para 0-based para indexação em Python

    deletados = 0
    escritos = 0
    controle_global = int(uf_code) * 10000000  # Prefixo: uf_code (2 dígitos) + sequencial (7)

    with open(dbf_path, 'rb') as infile:
        # Pular header
        infile.seek(headerlen)

        with open(out_path, 'w', encoding='latin1') as outfile:
            for i in range(nrec):
                # Ler record (reclen bytes)
                record_bytes = infile.read(reclen)

                if len(record_bytes) < reclen:
                    break

                # Byte 0: flag de exclusão
                flag = record_bytes[0:1]

                # Registros deletados têm '*' (0x2A)
                if flag == b'*':
                    deletados += 1
                    continue

                # Extrair dados (bytes 1 até fim)
                data_bytes = record_bytes[1:]

                # Decodificar como latin1 (preservando padding)
                try:
                    data_str = data_bytes.decode('latin1', errors='ignore')
                except:
                    continue

                # Extrair PESSOAN para determinar se é novo domicílio
                if pessoan_pos_0based < len(data_str):
                    pessoan_str = data_str[pessoan_pos_0based:pessoan_pos_0based+pessoan_len].strip()
                    try:
                        pessoan = int(pessoan_str)
                        if pessoan == 1:
                            # Novo domicílio: incrementar controle
                            controle_global += 1
                    except ValueError:
                        pass

                # Formatar controle: 9 dígitos zero-padded
                controle_str = str(controle_global % 1000000000).zfill(9)

                # Escrever: dados (492 bytes) + controle (9 dígitos) + newline
                linha = data_str + controle_str + '\n'
                outfile.write(linha)
                escritos += 1

    return {
        'nrec': nrec,
        'deletados': deletados,
        'escritos': escritos,
    }


def main():
    """Orquestrador principal."""
    import argparse

    parser = argparse.ArgumentParser(description='Processa DBFs do Censo 1991')
    parser.add_argument('--uf', type=str, default=None, help='Código UF específico (ex: 14 para RR)')
    parser.add_argument('--check', action='store_true', help='Validar ao final')
    parser.add_argument('--entrada', type=str,
                        default='/Volumes/Zeitmaschine/Microdados_Censo_Demografico_1991_Amostra',
                        help='Caminho do diretório de entrada')

    args = parser.parse_args()

    base_path = Path(args.entrada)

    # Selecionar UFs a processar
    if args.uf:
        uf_codes = [args.uf.zfill(2)]
    else:
        uf_codes = sorted(UF_CONFIGS.keys())

    # Verificar se UFs são válidas
    invalid_ufs = [uf for uf in uf_codes if uf not in UF_CONFIGS]
    if invalid_ufs:
        print(f"Erro: UFs inválidas: {invalid_ufs}")
        return 1

    print(f"Processando {len(uf_codes)} UF(s)...")

    resultados = {}
    for uf_code in uf_codes:
        import os
        config = UF_CONFIGS[uf_code]

        # Encontrar a pasta de região (pode ter caracteres especiais)
        dados_path = base_path / "Dados"
        region_folders = [item for item in os.listdir(dados_path)
                         if (dados_path / item).is_dir()]

        # Procurar pasta que contenha o padrão da região
        region_pattern = config.region.replace("Região ", "")
        matching_folders = [f for f in region_folders if region_pattern in f]

        if not matching_folders:
            print(f"✗ {config.uf_name} ({uf_code}): pasta de região não encontrada: {config.region}")
            return 1

        region_folder = matching_folders[0]
        dbf_path = dados_path / region_folder / config.arquivo_dbf

        if not dbf_path.exists():
            print(f"✗ {config.uf_name} ({uf_code}): arquivo não encontrado: {dbf_path}")
            return 1

        print(f"  {config.uf_name} ({uf_code})...", end='', flush=True)

        try:
            stats = process_dbf_file(dbf_path, uf_code, check=args.check)
            resultados[uf_code] = stats
            print(f" nrec={stats['nrec']:7d} del={stats['deletados']:6d} escritos={stats['escritos']:7d}")
        except Exception as e:
            print(f" ✗ ERRO: {e}")
            return 1

    # Resumo e validação
    if args.check:
        print("\n=== VALIDAÇÃO ===")
        total_nrec = 0
        total_deletados = 0
        total_escritos = 0

        for uf_code in sorted(resultados.keys()):
            config = UF_CONFIGS[uf_code]
            stats = resultados[uf_code]

            esperado_escritos = stats['nrec'] - stats['deletados']
            if stats['escritos'] != esperado_escritos:
                print(f"✗ {config.uf_name}: escritos {stats['escritos']} != esperado {esperado_escritos}")
            else:
                print(f"✓ {config.uf_name}: {stats['escritos']} linhas escritas")

            total_nrec += stats['nrec']
            total_deletados += stats['deletados']
            total_escritos += stats['escritos']

        print(f"\nTOTAL:")
        print(f"  nrec: {total_nrec:,}")
        print(f"  deletados: {total_deletados:,}")
        print(f"  escritos: {total_escritos:,}")

        # Verificar totais esperados
        esperado_total = 17045712
        if total_nrec != esperado_total:
            print(f"\n⚠ Aviso: nrec total {total_nrec:,} != esperado {esperado_total:,}")

    return 0


if __name__ == '__main__':
    sys.exit(main())

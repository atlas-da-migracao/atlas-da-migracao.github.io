/** Selo/aviso "esta unidade não é um município": mostrado no painel sempre que a unidade
 *  selecionada for uma UNIDADE AGREGADA da edição ativa -- um conjunto de municípios do censo
 *  publicado como uma unidade só, porque a fonte não distingue os municípios que o compõem.
 *
 *  Hoje existe exatamente um caso em todo o atlas: 'NORTEGO' no Censo 1980, os 52 municípios
 *  do norte de Goiás que em 1988 formaram o Tocantins e que a Base dos Dados não geocodifica
 *  (ver pipeline/unidades_agregadas_1980.py e docs/METODOLOGIA.md, item 4 da seção de 1980).
 *
 *  Mesmo padrão de AvisoProxy.tsx, e pelo mesmo motivo: o componente é genérico e não conhece
 *  nenhum código nem nenhuma edição -- a lista de unidades e o texto de cada uma vêm de
 *  `meta.unidades_agregadas` (pipeline/build_meta.py), para que a explicação metodológica
 *  tenha uma fonte só. Se uma edição futura agregar outro território, basta declará-lo lá.
 *
 *  O aviso é deliberadamente forte (não é um `<details>` fechado como o selo proxy): quem
 *  clica nessa forma no mapa precisa saber, ANTES de ler os números, que está olhando uma
 *  unidade do tamanho de um estado e não um município. */
import type { Meta, UnidadeAgregadaMeta } from "../lib/types";

/** A unidade agregada de `codigo`, ou null se ele for um município normal. */
export function unidadeAgregada(meta: Meta | null, codigo: string | null | undefined):
  UnidadeAgregadaMeta | null {
  if (!meta?.unidades_agregadas || !codigo) return null;
  return meta.unidades_agregadas.find((u) => u.codigo === codigo) ?? null;
}

export function AvisoUnidade({ meta, codigo }: { meta: Meta | null; codigo: string | null }) {
  const u = unidadeAgregada(meta, codigo);
  if (!u) return null;
  return (
    <div className="aviso aviso-unidade" role="note">
      <p>
        <strong>Não é um município.</strong> {u.nota}
      </p>
    </div>
  );
}

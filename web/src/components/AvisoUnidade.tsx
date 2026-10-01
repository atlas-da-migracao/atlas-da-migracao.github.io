/** Selo/aviso "esta unidade não é um município": mostrado no painel sempre que a unidade
 *  selecionada for uma UNIDADE AGREGADA da edição ativa -- um conjunto de municípios do censo
 *  publicado como uma unidade só, com um código não numérico.
 *
 *  Nenhuma edição declara unidade agregada desde 1.1.0-1980: o norte de Goiás (hoje Tocantins),
 *  que era o único caso, passou a ser publicado município a município (ver
 *  pipeline/norte_goias_1980.py). O mecanismo continua aqui, INATIVO -- sem a chave
 *  `meta.unidades_agregadas`, nada aparece -- para que uma edição futura que precise agregar
 *  um território só tenha de declará-lo.
 *
 *  Mesmo padrão de AvisoProxy.tsx, e pelo mesmo motivo: o componente é genérico e não conhece
 *  nenhum código nem nenhuma edição -- a lista de unidades e o texto de cada uma vêm de
 *  `meta.unidades_agregadas` (pipeline/build_meta.py), para que a explicação metodológica
 *  tenha uma fonte só.
 *
 *  O aviso é deliberadamente forte (não é um `<details>` fechado como o selo proxy): quem
 *  clica nessa forma no mapa precisa saber, ANTES de ler os números, que está olhando uma
 *  unidade que reúne vários municípios e não um município. */
import type { Meta, UfForaDaEpocaMeta, UnidadeAgregadaMeta } from "../lib/types";

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

/** A UF publicada `codigoUf` quando, na época do censo, ela não existia como UF (ou tinha outro
 *  território) -- hoje só o Tocantins em 1980: os 52 municípios do norte de Goiás são publicados
 *  sob `17` (precedente de Fernando de Noronha, ver docs/METODOLOGIA.md) para que a série de UF
 *  compare o mesmo território nas cinco edições, mas o Tocantins só foi criado em 1988. Lê
 *  `meta.ufs_fora_da_epoca` (pipeline/build_meta.py), que já traz a sigla da UF da época e o
 *  texto pronto. `null` se `codigoUf` for uma UF de verdade na época -- a imensa maioria dos
 *  casos -- ou se a edição não declara nenhuma (chave ausente). */
export function ufForaDaEpoca(meta: Meta | null, codigoUf: string | null | undefined):
  UfForaDaEpocaMeta | null {
  if (!meta?.ufs_fora_da_epoca || !codigoUf) return null;
  return meta.ufs_fora_da_epoca.find((u) => u.uf === codigoUf) ?? null;
}

export function AvisoUnidadeUf({ meta, codigoUf }: { meta: Meta | null; codigoUf: string | null }) {
  const u = ufForaDaEpoca(meta, codigoUf);
  if (!u) return null;
  return (
    <div className="aviso aviso-unidade" role="note">
      <p>
        <strong>Esta UF não existia na época do censo.</strong> {u.nota}
      </p>
    </div>
  );
}

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

/** Sigla das 27 UFs pelo código IBGE de 2 dígitos -- só para nomear a UF da ÉPOCA do censo
 *  em `AvisoUnidadeUf` (ex.: "52" -> "GO"), quando ela difere da UF publicada hoje
 *  (`unidade.uf`). Não depende de nenhum dado de acesso controlado -- é a mesma tabela
 *  pública de código de UF usada em `pipeline/labels.py`. */
const SIGLA_DA_UF: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
  "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

/** A unidade agregada cujo campo `uf` (o código PUBLICADO hoje) é `codigoUf` -- o caso em que
 *  uma UF inteira, no nível agregado "uf" do mapa, é (ou inclui) uma unidade agregada. Hoje só
 *  o Tocantins em 1980: 'NORTEGO' é publicada sob `uf: "17"` (precedente de Fernando de
 *  Noronha, ver docs/METODOLOGIA.md), mas o Tocantins só foi criado em 1988 -- o "TO/17" que
 *  aparece no nível UF de 1980 não é o estado histórico, é a agregação de 52 municípios do
 *  norte de Goiás publicada sob o código de hoje. `null` se `codigoUf` for uma UF de verdade
 *  na época (`uf_censo` ausente ou igual a `uf` -- ver `pipeline/build_meta.py`), inclusive
 *  quando ela também tem uma unidade agregada normal dentro dela mas não É a unidade agregada
 *  inteira (não é o caso hoje, mas a checagem `uf_censo` cobre isso corretamente). */
export function unidadeAgregadaPorUf(meta: Meta | null, codigoUf: string | null | undefined):
  UnidadeAgregadaMeta | null {
  if (!meta?.unidades_agregadas || !codigoUf) return null;
  return meta.unidades_agregadas.find((u) => u.uf === codigoUf && u.uf_censo && u.uf_censo !== u.uf) ?? null;
}

export function AvisoUnidadeUf({ meta, codigoUf }: { meta: Meta | null; codigoUf: string | null }) {
  const u = unidadeAgregadaPorUf(meta, codigoUf);
  if (!u) return null;
  const siglaEpoca = u.uf_censo ? SIGLA_DA_UF[u.uf_censo] ?? u.uf_censo : null;
  return (
    <div className="aviso aviso-unidade" role="note">
      <p>
        <strong>Esta UF não existia na época do censo.</strong> O território mostrado é
        inteiramente a unidade agregada {u.nome_curto} ({u.n_municipios} municípios),
        publicada sob o código de UF de hoje porque a fonte não distingue os municípios que a
        compõem.{siglaEpoca && <> No censo, esse território pertencia a <strong>{siglaEpoca}</strong>.</>}
        {" "}Mudanças de município dentro dela não aparecem como migração.
      </p>
    </div>
  );
}

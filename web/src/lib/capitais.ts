/** As 27 capitais estaduais (26 estados + Distrito Federal), para o rótulo sempre visível no
 *  mapa nacional (pedido do usuário: "exiba sempre os nomes das capitais dos estados").
 *
 *  Código municipal (`cd_mun`) na convenção do IBGE 2022, a mesma usada pela malha e pelos
 *  centroides publicados (ver `pipeline/build_ref.py`). Não é um dado por edição -- é uma
 *  referência estática, como `UF_SIGLA` em `pipeline/labels.py` -- então o componente que
 *  desenha o rótulo precisa filtrar pelas capitais presentes no `centroides` da edição ativa
 *  (ver `MapaAtlas.tsx`): Palmas/TO (criada em 1989) não existe nas edições 1980/1991, e
 *  Boa Vista/RR só existe como capital de estado a partir de 1988 (Roraima era território
 *  federal antes disso) -- filtrar por presença no mapa de centroides, em vez de assumir uma
 *  lista fixa de 27, resolve isso sem precisar de uma lista por edição.
 */
export interface Capital {
  cd_mun: string;
  nome: string;
  uf: string;
}

export const CAPITAIS: Capital[] = [
  { cd_mun: "1200401", nome: "Rio Branco", uf: "AC" },
  { cd_mun: "2704302", nome: "Maceió", uf: "AL" },
  { cd_mun: "1600303", nome: "Macapá", uf: "AP" },
  { cd_mun: "1302603", nome: "Manaus", uf: "AM" },
  { cd_mun: "2927408", nome: "Salvador", uf: "BA" },
  { cd_mun: "2304400", nome: "Fortaleza", uf: "CE" },
  { cd_mun: "5300108", nome: "Brasília", uf: "DF" },
  { cd_mun: "3205309", nome: "Vitória", uf: "ES" },
  { cd_mun: "5208707", nome: "Goiânia", uf: "GO" },
  { cd_mun: "2111300", nome: "São Luís", uf: "MA" },
  { cd_mun: "5103403", nome: "Cuiabá", uf: "MT" },
  { cd_mun: "5002704", nome: "Campo Grande", uf: "MS" },
  { cd_mun: "3106200", nome: "Belo Horizonte", uf: "MG" },
  { cd_mun: "1501402", nome: "Belém", uf: "PA" },
  { cd_mun: "2507507", nome: "João Pessoa", uf: "PB" },
  { cd_mun: "4106902", nome: "Curitiba", uf: "PR" },
  { cd_mun: "2611606", nome: "Recife", uf: "PE" },
  { cd_mun: "2211001", nome: "Teresina", uf: "PI" },
  { cd_mun: "3304557", nome: "Rio de Janeiro", uf: "RJ" },
  { cd_mun: "2408102", nome: "Natal", uf: "RN" },
  { cd_mun: "4314902", nome: "Porto Alegre", uf: "RS" },
  { cd_mun: "1100205", nome: "Porto Velho", uf: "RO" },
  { cd_mun: "1400100", nome: "Boa Vista", uf: "RR" },
  { cd_mun: "4205407", nome: "Florianópolis", uf: "SC" },
  { cd_mun: "3550308", nome: "São Paulo", uf: "SP" },
  { cd_mun: "2800308", nome: "Aracaju", uf: "SE" },
  { cd_mun: "1721000", nome: "Palmas", uf: "TO" },
];

# Base terminológica PT → EN / FR / ES

Toda tradução do atlas (interface `src/i18n/<lang>/`, glossário `glossario/<lang>.json`, prosa dos
dados `dados.json`, metodologia e páginas de SEO de `pipeline/build_paginas.py`) segue esta base.
Para mudar um termo, mude-o **aqui primeiro** e depois nos quatro dicionários.

Fontes dos termos: `docs/METODOLOGIA.md`, `docs/EDICOES.md`, `src/lib/glossario.ts`,
`src/conteudo/metodologia/pt.tsx`, `src/lib/paletas.ts`, `src/lib/serie.ts`,
`src/components/SerieCensos.tsx`, `pipeline/build_paginas.py` e `data/processed/meta.json`
(`rotulos`, `aviso`, `aviso_proxy`).

---

## 1. Princípios

1. **O português é a versão de referência.** As traduções não acrescentam, não omitem e não
   "corrigem" informação: limiares, ressalvas, edições e números são os do PT. Se o texto em PT
   parecer errado, a tradução continua fiel a ele, e o problema é registrado para corrigir o PT.
2. **Tom.** É o mesmo do PT: técnico, mas acessível a quem não é especialista. As frases são
   curtas e na voz ativa, sem jargão que não esteja no glossário. Não se "eleva" o registro: o
   texto não fica mais acadêmico que o original.
3. **Variedade de cada língua.**
   - **EN:** inglês americano (*standardized*, *center*), coerente com o locale `en-US`.
   - **FR:** francês da França, seguindo as convenções do INSEE e do INED.
   - **ES:** espanhol neutro, com o léxico da CEPAL/CELADE onde a América Latina e a Espanha
     divergem. A formatação numérica é a de `es-ES`; ver §3.
4. **Rótulos curtos e longos.** Quando o PT tem as duas formas (paleta × `meta.rotulos`), a
   tradução também tem as duas. Não se unifica o que o PT distingue: "Primeira saída do natal"
   e "Primeira saída do município natal" continuam sendo dois textos.
5. **O que não se traduz:**
   - nomes próprios: municípios, UFs, RMs, RIDEs, regiões imediatas e intermediárias, com os
     diacríticos (*São Paulo*, nunca *Sao Paulo*);
   - nomes de fontes e instituições: IBGE, SIDRA, IPEA, censobr, Base dos Dados;
   - códigos, chaves de dados, nomes de colunas e de arquivos;
   - os nomes das regras de revelação (R1–R9) e o termo *gate*.

   Os nomes das macrorregiões **se traduzem**, conforme a tabela 2.4.

### 1.1 Siglas

**Regra.** Há dois tipos de sigla, com tratamentos diferentes.

- **Siglas do atlas** ficam **idênticas nos quatro idiomas**. São as dos indicadores e dos níveis
  territoriais: TLM, IEM, MEI (agregado), CMI, SMI, ANMR, UF, RGI, RGInt, RM, RIDE e AMC.
  - A sigla é expandida na primeira menção de cada tela, tooltip ou página, com o termo usado
    pela literatura de cada idioma.
  - A expansão **não** precisa corresponder às letras da sigla. "TLM (*net migration rate*)" está
    certo; não se cria NMR.
- **Siglas de convenção estatística internacional** seguem a forma usual de cada língua:

  | PT | EN | FR | ES |
  |---|---|---|---|
  | IC | CI | IC | IC |
  | UPA | PSU | UP | UPM |
  | ISCO-08 | ISCO-08 | CITP-08 | CIUO-08 |

  CV e MAUP ficam iguais em todos os idiomas.
- **Siglas institucionais** (IBGE, SIDRA, IPEA) nunca são traduzidas. Elas são expandidas uma
  vez por página.

**Expansão de cada sigla e gênero gramatical** (o gênero importa para os artigos em FR e ES):

| Sigla | PT | EN | FR (gênero) | ES (gênero) |
|---|---|---|---|---|
| TLM | taxa líquida de migração | net migration rate | taux net de migration (m.) | tasa neta de migración (f.) |
| IEM | índice de eficácia migratória | migration effectiveness index | indice d'efficacité migratoire (m.) | índice de eficacia migratoria (m.) |
| MEI agregado | eficácia migratória do sistema | aggregate MEI (aggregate migration effectiveness index) | MEI agrégé (m.) — efficacité migratoire du système | MEI agregado (m.) — eficacia migratoria del sistema |
| CMI | intensidade migratória (bruta) | crude migration intensity | intensité migratoire brute (f.) | intensidad migratoria bruta (f.) |
| SMI | intensidade migratória padronizada por idade | age-standardized migration intensity | intensité migratoire standardisée par âge (f.) | intensidad migratoria estandarizada por edad (f.) |
| ANMR | migração líquida agregada | aggregate net migration rate | taux net de migration agrégé (m.) | tasa neta de migración agregada (f.) |
| UF | unidade da federação | Federation Unit (state) | unité fédérative (f.) | unidad federativa (f.) |
| RGI | região (geográfica) imediata | immediate (geographic) region | région (géographique) immédiate (f.) | región (geográfica) inmediata (f.) |
| RGInt | região (geográfica) intermediária | intermediate (geographic) region | région (géographique) intermédiaire (f.) | región (geográfica) intermedia (f.) |
| RM | região metropolitana | metropolitan region | région métropolitaine (f.) | región metropolitana (f.) |
| RIDE | Região Integrada de Desenvolvimento Econômico | Integrated Economic Development Region | Région intégrée de développement économique (f.) | Región Integrada de Desarrollo Económico (f.) |
| AMC | áreas mínimas comparáveis | minimum comparable areas | aires minimales comparables (f. pl.) | áreas mínimas comparables (f. pl.) |
| SIDRA | Sistema IBGE de Recuperação Automática | IBGE Automatic Retrieval System (IBGE's official tables database) | système de consultation des tableaux officiels de l'IBGE (m.) | Sistema IBGE de Recuperación Automática (m.) |
| IPEA | Instituto de Pesquisa Econômica Aplicada | Institute for Applied Economic Research | Institut de recherche économique appliquée (m.) | Instituto de Investigación Económica Aplicada (m.) |
| IBGE | Instituto Brasileiro de Geografia e Estatística | Brazilian Institute of Geography and Statistics | Institut brésilien de géographie et de statistique (m.) | Instituto Brasileño de Geografía y Estadística (m.) |

Exemplo de primeira menção:
- EN: "IEM (migration effectiveness index)"
- FR: "IEM (indice d'efficacité migratoire)"
- ES: "IEM (índice de eficacia migratoria)"

### 1.2 Conflitos de sigla resolvidos

- **IEM × MEI.** No PT, IEM é o índice **de uma unidade** e "MEI agregado" é o índice **do
  sistema**. Isso se mantém nos quatro idiomas.
  - Em FR e ES, IEM coincide com a sigla natural da língua.
  - Em EN, a literatura chama as duas medidas de MEI. Por isso, o termo do glossário "IEM —
    índice de eficácia migratória (também MEI)" vira "IEM — migration effectiveness index
    (MEI in the English-language literature)".
  - "MEI" **nunca** aparece sozinho como nome da medida da unidade. A medida do sistema é
    sempre "aggregate MEI" / "MEI agrégé" / "MEI agregado".
- **MEI × microempreendedor individual.** O conflito existe só em PT e o contexto já o desfaz,
  porque o atlas sempre escreve "MEI agregado". Não se muda nada.
- **TLM × NMR / TNM / TMN.** Fica TLM nos quatro idiomas. O leitor anglófono espera NMR, então a
  expansão traz "net migration rate" na primeira menção de cada tela.
- **IC × CI.** IC 95 % não é sigla do atlas, e sim notação estatística. Em EN, "95% CI" / "95%
  confidence interval".
- **UF.** A sigla UF fica nos quatro idiomas, nos rótulos compactos e no seletor de nível:
  - EN "State (UF)"
  - FR "État (UF)"
  - ES "Estado (UF)"

  Na prosa, prefira state / État / estado e os adjetivos interstate / interétatique /
  interestatal. Na primeira menção da metodologia, explique que as 27 UFs são 26 estados e o
  Distrito Federal (EN "Federal District", FR "District fédéral", ES "Distrito Federal").

---

## 2. Tabela de termos

Notas de uso vêm na coluna final quando a escolha não é óbvia. "—" significa sem nota.

### 2.1 Migração: conceitos e medidas

| PT | EN | FR | ES | Nota |
|---|---|---|---|---|
| migração interna | internal migration | migration interne (pl. *migrations internes* em títulos) | migración interna | — |
| migrante interno / internacional | internal / international migrant | migrant interne / international | migrante interno / internacional | — |
| não migrante; residentes não migrantes | non-migrant; non-migrant residents | non-migrant ; résidents non migrants | no migrante; residentes no migrantes | — |
| imigrantes (chegadas) | in-migrants (arrivals) | entrants (arrivées) | inmigrantes (llegadas) | Em EN e FR, *immigrant/emigrant* sugere migração internacional; a literatura de migração interna usa *in-/out-migrants* e *entrants/sortants*. Em ES, *inmigrante/emigrante* é o uso consagrado da CELADE também para migração interna. |
| emigrantes (saídas) | out-migrants (departures) | sortants (départs) | emigrantes (salidas) | Mesma nota. |
| imigração / emigração | in-migration / out-migration | entrées / sorties (migratoires) | inmigración / emigración | — |
| saldo migratório | net migration | solde migratoire | saldo migratorio | EN: o número é "net migration"; o adjetivo é "net migration gain/loss". |
| taxa líquida de migração (TLM), por mil hab. | net migration rate (TLM), per 1,000 population | taux net de migration (TLM), pour 1 000 habitants | tasa neta de migración (TLM), por cada 1.000 habitantes | — |
| taxa bruta de imigração / emigração | crude in-migration / out-migration rate | taux brut d'entrée / de sortie | tasa bruta de inmigración / emigración | — |
| índice de eficácia migratória (IEM) | migration effectiveness index (IEM) | indice d'efficacité migratoire (IEM) | índice de eficacia migratoria (IEM) | Ver §1.2. |
| rotatividade (volume: imigrantes + emigrantes) | turnover (in + out) | rotation (entrées + sorties) | rotación (entradas + salidas) | É o mesmo termo da classe da tipologia (2.6), como no PT. Forma curta: "Turnover (in+out)" / "Rotation (entr.+sort.)" / "Rotación (entr.+sal.)". |
| fluxo (migratório) | (migration) flow | flux (migratoire) | flujo (migratorio) | — |
| origem / destino | origin / destination | origine / destination | origen / destino | — |
| matriz origem→destino; par | origin–destination matrix; pair | matrice origine–destination ; couple | matriz origen–destino; par | — |
| parceiro (no ranking de fluxos) | partner | partenaire | contraparte | — |
| posto no ranking | rank | rang | posición en el ranking | — |
| principais origens / destinos | top origins / destinations | principales origines / destinations | principales orígenes / destinos | — |
| origem não informada | origin not reported | origine non déclarée | origen no declarado | — |
| distância média da migração | mean migration distance | distance moyenne de migration | distancia media de la migración | — |
| % da migração que cruza a UF | % of migration crossing state lines | % de la migration qui franchit les limites de l'État | % de la migración que cruza el límite estatal | Forma curta: "% interstate" / "% interétatique" / "% interestatal". |
| concentração dos fluxos (índice de Gini) | flow concentration (Gini index) | concentration des flux (indice de Gini) | concentración de los flujos (índice de Gini) | — |
| tipo de fluxo predominante | predominant flow type | type de flux prédominant | tipo de flujo predominante | — |
| curta / longa distância | short- / long-distance | courte / longue distance | corta / larga distancia | — |
| intraestadual / interestadual | intrastate / interstate | intra-étatique / interétatique | intraestatal / interestatal | — |
| intensidade migratória (CMI) | crude migration intensity (CMI) | intensité migratoire brute (CMI) | intensidad migratoria bruta (CMI) | — |
| medidas da unidade / do sistema | unit-level / system-level measures | mesures de l'unité / du système | medidas de la unidad / del sistema | — |
| número de unidades da edição | number of units in the edition | nombre d'unités de l'édition | número de unidades de la edición | — |
| efeito Courgeau | Courgeau effect | effet Courgeau | efecto Courgeau | — |
| problema da unidade de área modificável (MAUP) | modifiable areal unit problem (MAUP) | problème des unités spatiales modifiables (MAUP) | problema de la unidad de área modificable (MAUP) | — |
| β de Fielding | Fielding's β | β de Fielding | β de Fielding | — |
| concentração / desconcentração; metropolitanização; contraurbanização | concentration / deconcentration; metropolitanization; counterurbanization | concentration / déconcentration ; métropolisation ; contre-urbanisation | concentración / desconcentración; metropolización; contraurbanización | — |
| D de Duncan (índice de dissimilaridade) | Duncan's D (dissimilarity index) | D de Duncan (indice de dissimilarité) | D de Duncan (índice de disimilitud) | — |
| decomposição log-linear; conectividade | log-linear decomposition; connectivity | décomposition log-linéaire ; connectivité | descomposición log-lineal; conectividad | — |
| seletividade migratória | migration selectivity | sélectivité migratoire | selectividad migratoria | — |
| projeção cônica equivalente de Albers | Albers equal-area conic projection | projection conique équivalente d'Albers | proyección cónica equivalente de Albers | — |

### 2.2 Quesito, período e proxy

| PT | EN | FR | ES | Nota |
|---|---|---|---|---|
| data fixa; migrante de data fixa | fixed-date; fixed-date migrant | date fixe ; migrant à date fixe | fecha fija; migrante de fecha fija | O quesito é "residência em data fixa" = *place of residence at a fixed date* / *résidence à une date fixe* / *residencia en una fecha fija*. |
| quinquênio | five-year period | période quinquennale | quinquenio | FR: nunca *quinquennat*, que é mandato. |
| período de referência | reference period | période de référence | período de referencia | — |
| última etapa (município de residência anterior) | last previous residence (last move) | dernière résidence antérieure | última residencia anterior (última etapa) | — |
| tempo de residência no município | duration of residence in the municipality | durée de résidence dans la municipalité | tiempo de residencia en el municipio | — |
| proxy de data fixa; selo proxy | fixed-date proxy; proxy badge | proxy de date fixe ; mention « proxy » | proxy de fecha fija; distintivo «proxy» | A palavra *proxy* fica nas três línguas: é o selo da interface. Na prosa FR, pode-se glosar como "estimation approchée". |
| calibrado contra 1991 | calibrated against 1991 | calibré sur 1991 | calibrado con 1991 | — |
| quesito; questionário da amostra | (census) question; long-form (sample) questionnaire | question ; questionnaire de l'échantillon | pregunta; cuestionario ampliado (de la muestra) | — |
| universo (do quesito) | universe (population in scope) | champ | universo | — |
| migrante de retorno | return migrant | migrant de retour | migrante de retorno | — |
| migração de ida e volta | round-trip migration | migration aller-retour | migración de ida y vuelta | — |

### 2.3 Deslocamento pendular

| PT | EN | FR | ES | Nota |
|---|---|---|---|---|
| deslocamento pendular (trabalho / estudo) | commuting (to work / to school) | mobilité pendulaire ; navettes domicile-travail / domicile-études | movilidad pendular (por trabajo / estudio) | O atlas insiste que pendular **não é** migração. Por isso, em FR **evite** *migrations alternantes* e *migrations pendulares*, e em ES evite *migración pendular*. Pessoas: commuters / navetteurs / personas en movilidad pendular (ou "trabajadores/estudiantes pendulares"). |
| fluxo pendular; saldo pendular | commuting flow; net commuting | flux pendulaire ; solde des navettes | flujo pendular; saldo pendular | — |
| taxa de saída pendular | out-commuting rate | taux de navettes sortantes | tasa de salida pendular | — |
| índice de atração pendular | commuting attraction index | indice d'attraction pendulaire | índice de atracción pendular | — |
| município-dormitório | commuter (dormitory) town | ville-dortoir | ciudad dormitorio | — |
| tempo mediano de deslocamento | median commuting time | durée médiane du trajet | tiempo mediano de desplazamiento | — |
| % que usa transporte coletivo | % using public transport | % en transports en commun | % que usa transporte público | — |
| % com retorno diário; frequência de retorno | % returning home daily; return frequency | % de retour quotidien ; fréquence de retour | % con retorno diario; frecuencia de retorno | — |
| ocupados (10 anos ou mais) | employed persons (aged 10 and over) | personnes en emploi (10 ans ou plus) | ocupados (10 años o más) | — |
| frequenta escola ou creche | attends school or daycare | fréquente un établissement scolaire ou une crèche | asiste a la escuela o a una guardería | — |
| quesito único de trabalho ou estudo, com precedência do trabalho; piso | single work-or-study question, work taking precedence; lower bound | question unique travail ou études, le travail primant ; plancher (borne inférieure) | pregunta única de trabajo o estudio, con precedencia del trabajo; piso (cota inferior) | — |

### 2.4 Território

| PT | EN | FR | ES | Nota |
|---|---|---|---|---|
| município | municipality | municipalité | municipio | FR: não use *commune*, que evoca a escala francesa (comuna mediana de cerca de 450 habitantes); na primeira menção, "municipalité (*município*)". Adjetivos: municipal / intermunicipal. Município-mãe = parent municipality / municipalité mère / municipio madre. |
| unidade da federação (UF); estado | Federation Unit (UF); state | unité fédérative (UF) ; État | unidad federativa (UF); estado | Ver §1.2. FR: *État* com maiúscula. |
| região imediata (RGI) | immediate region (RGI) | région immédiate (RGI) | región inmediata (RGI) | Nome oficial do IBGE: "Região Geográfica Imediata", em EN *Immediate Geographic Region*. Use a forma longa só na primeira menção da metodologia. |
| região intermediária (RGInt) | intermediate region (RGInt) | région intermédiaire (RGInt) | región intermedia (RGInt) | Idem; ES usa *intermedia*, não *intermediaria*. |
| região metropolitana (RM) | metropolitan region (RM) | région métropolitaine (RM) | región metropolitana (RM) | EN: não use *metropolitan area*, que é outro conceito. |
| RIDE | RIDE | RIDE | RIDE | Ver §1.1. |
| núcleo / periferia (da RM) | core / periphery | centre / périphérie | núcleo / periferia | Setas: "Core → periphery" / "Centre → périphérie" / "Núcleo → periferia". |
| migração intrametropolitana (intra-RM) | intra-metropolitan migration (intra-RM) | migration intramétropolitaine (intra-RM) | migración intrametropolitana (intra-RM) | — |
| saldo da RM com o resto do país (saldo externo) | net migration with the rest of the country (external net) | solde avec le reste du pays (solde externe) | saldo con el resto del país (saldo externo) | — |
| macrorregiões: Norte, Nordeste, Sudeste, Sul, Centro-Oeste | North, Northeast, Southeast, South, Central-West | Nord, Nordeste, Sud-Est, Sud, Centre-Ouest | Norte, Nordeste, Sudeste, Sur, Centro-Oeste | EN segue o IBGE (*Central-West*). FR mantém *Nordeste*, forma consagrada ("le Nordeste"). Genérico: major region / grande région / gran región. |
| nível territorial / de agregação | territorial level / aggregation level | niveau territorial / d'agrégation | nivel territorial / de agregación | — |
| recorte (territorial) | delineation (boundary set) | découpage | delimitación | **Ambíguo no PT**: o recorte territorial é diferente do recorte analítico (2.7). |
| recorte de 2022 aplicado retroativamente | 2022 delineation applied retroactively | découpage de 2022 appliqué rétroactivement | delimitación de 2022 aplicada retroactivamente | — |
| malha municipal | municipal boundary map | maillage municipal | malla municipal | — |
| genealogia municipal | municipal genealogy | généalogie municipale | genealogía municipal | — |
| emancipação / desmembramento | municipal split (creation of a new municipality) | création par scission | emancipación / desmembramiento | — |
| viés (degrau) de fronteira | boundary-change bias (step) | biais (rupture) de changement de limites | sesgo (salto) por cambio de límites | — |
| UF que não existia na época | state that did not exist at the time | État qui n'existait pas à l'époque | estado que no existía en la época | — |
| fronteira agrícola | agricultural frontier | front pionnier agricole | frontera agrícola | — |

### 2.5 Amostra, precisão e sigilo

| PT | EN | FR | ES | Nota |
|---|---|---|---|---|
| microdados da amostra | sample microdata | microdonnées de l'échantillon | microdatos de la muestra | — |
| acesso controlado / dados públicos | controlled access / public data | accès contrôlé / données publiques | acceso controlado / datos públicos | EN: *controlled*, não *restricted*, para não confundir com a Sala de Acesso Restrito do IBGE. |
| peso amostral; estimativa ponderada | sample weight; weighted estimate | poids de sondage ; estimation pondérée | peso muestral (factor de expansión); estimación ponderada | — |
| erro amostral; erro-padrão | sampling error; standard error | erreur d'échantillonnage ; erreur type | error muestral; error estándar | — |
| intervalo de confiança de 95% (IC 95%) | 95% confidence interval (95% CI) | intervalle de confiance à 95 % (IC à 95 %) | intervalo de confianza del 95 % (IC 95 %) | Separador do intervalo (`comum.separadorIntervalo`): "a" / "to" / "à" / "a". |
| coeficiente de variação (CV) | coefficient of variation (CV) | coefficient de variation (CV) | coeficiente de variación (CV) | — |
| precisão da estimativa | estimate precision | précision de l'estimation | precisión de la estimación | — |
| boa | good | bonne | buena | — |
| usar com cautela | use with caution | à utiliser avec prudence | usar con cautela | O PT tem uma variante, "razoável, use com cautela" (metodologia). Traduza fiel: "fair, use with caution" / "acceptable, à utiliser avec prudence" / "aceptable, usar con cautela". |
| baixa precisão | low precision | faible précision | baja precisión | — |
| sem estimativa | no estimate | sans estimation | sin estimación | Não é "imprecisa": a precisão simplesmente não é calculável. |
| sem classificação | not classified | non classé | sin clasificación | — |
| observações amostrais (n); faixa do tamanho da amostra | sample observations (n); sample size band | observations de l'échantillon (n) ; tranche d'effectif de l'échantillon | observaciones muestrales (n); rango del tamaño muestral | — |
| área de ponderação; estrato; UPA | weighting area; stratum; PSU | zone de pondération ; strate ; UP | área de ponderación; estrato; UPM | — |
| chave (identificador) de domicílio; domicílio amostrado | household identifier; sampled household | identifiant de ménage ; ménage échantillonné | identificador de hogar; hogar muestreado | — |
| controle (estatístico) de revelação | (statistical) disclosure control | contrôle de la divulgation statistique (secret statistique) | control de divulgación estadística | — |
| supressão; suprimido | suppression; suppressed | masquage ; masqué | supresión; suprimido | FR: *supprimé* soa como "apagado"; o INSEE diz *masqué* (secret statistique). |
| abaixo do limiar de divulgação | below the disclosure threshold | sous le seuil de diffusion | por debajo del umbral de divulgación | — |
| piso de revelação | disclosure floor (minimum cell size) | seuil minimal de diffusion | piso de divulgación | — |
| arredondamento a múltiplos de 5 | rounding to multiples of 5 | arrondi au multiple de 5 | redondeo a múltiplos de 5 | — |
| tabulações oficiais (SIDRA) | official tabulations (SIDRA) | tableaux officiels (SIDRA) | tabulados oficiales (SIDRA) | — |
| universo × amostra | full count (universe) × sample | recensement exhaustif × échantillon | universo × muestra | — |

### 2.6 Comparação entre censos

| PT | EN | FR | ES | Nota |
|---|---|---|---|---|
| Ao longo dos censos | Across the censuses | Au fil des recensements | A lo largo de los censos | — |
| edição (do atlas, por censo): edição 2010 | edition: 2010 edition | édition : édition 2010 | edición: edición 2010 | — |
| Censo 2022, data fixa 2017–2022 | 2022 Census, fixed date 2017–2022 | Recensement 2022, date fixe 2017–2022 | Censo 2022, fecha fija 2017–2022 | — |
| Censo 1980, proxy de data fixa 1975–1980 | 1980 Census, fixed-date proxy 1975–1980 | Recensement 1980, proxy de date fixe 1975–1980 | Censo 1980, proxy de fecha fija 1975–1980 | — |
| comparabilidade; comparável / comparável com ressalva / não comparável | comparability; comparable / comparable with caveats / not comparable | comparabilité ; comparable / comparable sous réserve / non comparable | comparabilidad; comparable / comparable con salvedades / no comparable | — |
| ressalva | caveat | réserve | salvedad | — |
| cobertura: plena / parcial / insuficiente / sem cobertura | coverage: full / partial / insufficient / no coverage | couverture : complète / partielle / insuffisante / sans couverture | cobertura: plena / parcial / insuficiente / sin cobertura | — |
| não existia / não medido / suprimido / não comparável | did not exist / not measured / suppressed / not comparable | n'existait pas / non mesuré / masqué / non comparable | no existía / no medido / suprimido / no comparable | São os estados de célula; nunca se traduzem como "zero". |
| harmonização de vocabulários | harmonization of category sets | harmonisation des nomenclatures | armonización de las categorías | — |
| município criado depois de {ano} | municipality created after {year} | municipalité créée après {année} | municipio creado después de {año} | — |
| frase-síntese | summary sentence | phrase de synthèse | frase de síntesis | — |
| tend. (tendência) | trend | tend. | tend. | — |
| Bloco 1–4 | Part 1–4 | Partie 1–4 | Bloque 1–4 | — |

**Tipologia do IEM (Baeninger, 2012)**

| PT | EN | FR | ES | Nota |
|---|---|---|---|---|
| rotatividade (migratória) | (migratory) turnover | rotation (migratoire) | rotación (migratoria) | O artigo de Baeninger se chama "Rotatividade migratória"; cite o título no original. |
| absorção / absorção forte / muito forte | absorption / strong / very strong absorption | absorption / forte / très forte absorption | absorción / absorción fuerte / muy fuerte | — |
| evasão / evasão forte / muito forte | depletion / strong / very strong depletion | répulsion / forte / très forte répulsion | expulsión / expulsión fuerte / muy fuerte | EN: *evasion* é falso cognato, e *expulsion* sugere coerção. *Depletion* fica simétrico a *absorption*. Em ES, "áreas de expulsión" é o uso consagrado da CEPAL; em FR, "zones répulsives". |
| situação indefinida (amostra pequena) | undetermined (small sample) | indéterminé (petit échantillon) | indefinido (muestra pequeña) | Não é equilíbrio: incerteza não é evidência de equilíbrio. |
| quase equilíbrio (±10‰); ganho / perda de 10 a 30‰ | near balance (±10‰); gain / loss of 10 to 30‰ | quasi-équilibre (±10 ‰) ; gain / perte de 10 à 30 ‰ | casi equilibrio (±10 ‰); ganancia / pérdida de 10 a 30 ‰ | Legenda da TLM. |

### 2.7 Recortes e categorias (`paletas.ts`, `meta.rotulos`)

"Recorte" analítico (filtro): breakdown, filter / ventilation, filtre / desagregación, filtro.

| PT | EN | FR | ES | Nota |
|---|---|---|---|---|
| **Status migratório** | **Migrant type** | **Type de migrant** | **Tipo de migrante** | *Migration status*, *statut migratoire* e *estatus/condición migratoria* sugerem situação **legal**; aqui a categoria é a trajetória em relação ao local de nascimento. |
| Retorno ao município natal | Return to municipality of birth | Retour dans la municipalité de naissance | Retorno al municipio natal | — |
| Primeira saída do (município) natal | First move from (municipality of) birth | Premier départ du lieu (de la municipalité) de naissance | Primera salida del (municipio) natal | — |
| (Migração de) etapas múltiplas | Multi-step (migration) | (Migration par) étapes multiples | (Migración por) etapas múltiples | — |
| Nascido no exterior (, migrante interno) | Born abroad (, internal migrant) | Né à l'étranger (, migrant interne) | Nacido en el exterior (, migrante interno) | — |
| Não natural do destino | Not born in the destination | Non natif de la destination | No natural del destino | Variante de `meta`: "Não nasceu no município nem no exterior" = "Born neither in the municipality nor abroad" / "Né ni dans la municipalité ni à l'étranger" / "No nació en el municipio ni en el exterior". |
| Retorno do exterior (brasileiro) | Return from abroad (Brazilian) | Retour de l'étranger (Brésilien) | Retorno del exterior (brasileño) | — |
| Imigração internacional (estrangeiro) | International immigration (foreign national) | Immigration internationale (étranger) | Inmigración internacional (extranjero) | — |
| **Escolaridade (nível de instrução)**, pessoas de 25 anos ou mais | **Educational attainment**, people aged 25 and over | **Niveau d'instruction**, personnes de 25 ans ou plus | **Nivel educativo**, personas de 25 años o más | Ensino fundamental = 9 anos (CITE 1–2), médio = 3 anos (CITE 3). Explique isso uma vez no glossário EN/FR/ES. |
| Sem instrução ou fundamental incompleto | No schooling or incomplete elementary | Sans instruction ou fondamental incomplet | Sin instrucción o básica incompleta | — |
| Fundamental completo (, médio incompleto) | Completed elementary (, incomplete high school) | Fondamental achevé (, secondaire incomplet) | Básica completa (, media incompleta) | — |
| Médio completo (, superior incompleto) | Completed high school (, incomplete higher education) | Secondaire achevé (, supérieur incomplet) | Media completa (, superior incompleta) | — |
| Superior completo | Completed higher education | Supérieur achevé | Superior completa | — |
| **Renda domiciliar per capita**, em salários mínimos | **Household income per capita**, in minimum wages | **Revenu du ménage par personne**, en salaires minimums | **Ingreso del hogar per cápita**, en salarios mínimos | — |
| Até ¼ / De ¼ a ½ / De ½ a 1 / De 1 a 2 / Mais de 2 | Up to ¼ / ¼ to ½ / ½ to 1 / 1 to 2 / More than 2 | Jusqu'à ¼ / De ¼ à ½ / De ½ à 1 / De 1 à 2 / Plus de 2 | Hasta ¼ / De ¼ a ½ / De ½ a 1 / De 1 a 2 / Más de 2 | — |
| Domicílio coletivo (Não aplicável) | Collective dwelling (not applicable) | Résidence collective (sans objet) | Vivienda colectiva (no aplica) | — |
| salário mínimo (vigente na data de referência) | minimum wage (in force on the reference date) | salaire minimum (en vigueur à la date de référence) | salario mínimo (vigente en la fecha de referencia) | — |
| **Perfil por idade e sexo**; 5 a 14 … 60 ou mais | **Age and sex profile**; 5–14 … 60 and over | **Profil par âge et sexe** ; 5–14 … 60 et plus | **Perfil por edad y sexo**; 5–14 … 60 y más | — |
| masculino / feminino / indeterminado | male / female / undetermined | hommes / femmes / indéterminé | hombres / mujeres / indeterminado | — |
| **Frequência de retorno** | **Return frequency** | **Fréquence de retour** | **Frecuencia de retorno** | — |
| Retorna 3+ dias/semana / Retorno semanal ou mais longo | Returns 3+ days/week / Weekly or longer return | Retour 3+ jours/semaine / Retour hebdomadaire ou plus espacé | Retorna 3+ días/semana / Retorno semanal o más espaciado | — |
| Retorna diariamente / Não retorna diariamente (2010) | Returns daily / Does not return daily | Retour quotidien / Pas de retour quotidien | Retorna diariamente / No retorna diariamente | — |
| **Modo de transporte** | **Mode of transport** | **Mode de transport** | **Modo de transporte** | — |
| A pé ou bicicleta | On foot or by bicycle | À pied ou à vélo | A pie o en bicicleta | — |
| Motocicleta ou mototáxi | Motorcycle or motorcycle taxi | Moto ou moto-taxi | Motocicleta o mototaxi | — |
| Automóvel ou táxi | Car or taxi | Voiture ou taxi | Automóvil o taxi | — |
| Ônibus, van ou BRT | Bus, van or BRT | Bus, minibus ou BRT | Autobús, van o BRT | BRT fica como sigla nas três línguas. |
| Trem ou metrô | Train or subway | Train ou métro | Tren o metro | — |
| Outros meios ou suprimido | Other modes or suppressed | Autres modes ou masqué | Otros medios o suprimido | — |
| **Tempo de deslocamento**: Até 15 min / 16 a 30 min / 31 min a 1 h / 1 a 2 h / Mais de 2 h | **Commuting time**: Up to 15 min / 16–30 min / 31 min to 1 h / 1–2 h / More than 2 h | **Durée du trajet** : Jusqu'à 15 min / 16 à 30 min / 31 min à 1 h / 1 à 2 h / Plus de 2 h | **Tiempo de desplazamiento**: Hasta 15 min / 16 a 30 min / 31 min a 1 h / 1 a 2 h / Más de 2 h | — |
| Não se desloca, ignorado ou suprimido | Does not commute, unknown or suppressed | Pas de trajet, inconnu ou masqué | No se desplaza, ignorado o suprimido | — |
| **Posição na ocupação** | **Status in employment** | **Statut dans l'emploi** | **Situación en el empleo** | Termos da OIT/ICSE. |
| Empregado com / sem carteira | Employee with / without a formal contract | Salarié avec / sans contrat formel | Asalariado con / sin contrato formal | Glosa na primeira menção: *carteira de trabalho assinada*, isto é, contrato registrado. |
| Militar ou estatutário | Military or statutory civil servant | Militaire ou fonctionnaire statutaire | Militar o funcionario de carrera | — |
| Empregador | Employer | Employeur | Empleador | — |
| Conta própria ou familiar | Own-account or contributing family worker | À son compte ou aide familial | Cuenta propia o trabajador familiar auxiliar | — |
| **Setor de atividade** | **Industry (sector of activity)** | **Secteur d'activité** | **Sector de actividad** | — |
| Agropecuária | Agriculture and livestock | Agriculture et élevage | Agropecuaria | — |
| Indústria | Industry | Industrie | Industria | — |
| Construção | Construction | Construction | Construcción | — |
| Comércio | Trade | Commerce | Comercio | — |
| Transporte e logística | Transport and logistics | Transport et logistique | Transporte y logística | — |
| Serviços empresariais | Business services | Services aux entreprises | Servicios empresariales | — |
| Administração, educação e saúde | Public administration, education and health | Administration publique, enseignement et santé | Administración pública, educación y salud | — |
| Outros serviços | Other services | Autres services | Otros servicios | — |
| **Grupo ocupacional** | **Occupational group** | **Groupe professionnel** | **Grupo ocupacional** | Nomes inspirados nos grandes grupos da ISCO-08 / CITP-08 / CIUO-08. |
| Dirigentes e profissionais | Managers and professionals | Dirigeants et professions intellectuelles | Directores y profesionales | — |
| Técnicos e apoio administrativo | Technicians and clerical support | Professions intermédiaires et employés administratifs | Técnicos y personal de apoyo administrativo | — |
| Serviços e vendedores | Service and sales workers | Personnel des services et vendeurs | Trabajadores de los servicios y vendedores | — |
| Agropecuária (ocupação) | Agricultural workers | Agriculteurs et ouvriers agricoles | Trabajadores agropecuarios | O rótulo ocupacional é diferente do rótulo de setor. |
| Indústria, construção e operadores | Craft, construction and machine operators | Métiers de l'industrie, du bâtiment et conducteurs de machines | Oficiales, operarios y operadores de máquinas | — |
| Ocupações elementares | Elementary occupations | Professions élémentaires | Ocupaciones elementales | — |
| Forças armadas, polícia e bombeiros | Armed forces, police and firefighters | Forces armées, police et pompiers | Fuerzas armadas, policía y bomberos | — |
| Mal definidas, ignorado ou suprimido | Ill-defined, unknown or suppressed | Mal définies, inconnu ou masqué | Mal definidas, ignorado o suprimido | — |
| **Rendimento do trabalho**: Até 1 / De 1 a 2 / … / Mais de 5 salários mínimos | **Earnings from work**: Up to 1 / 1 to 2 / … / More than 5 minimum wages | **Revenu du travail** : Jusqu'à 1 / De 1 à 2 / … / Plus de 5 salaires minimums | **Ingreso laboral**: Hasta 1 / De 1 a 2 / … / Más de 5 salarios mínimos | — |
| **Nível de estudo** (pendular) | **Level of study** | **Niveau d'études** | **Nivel de estudio** | — |
| Infantil ou fundamental | Preschool or elementary | Préscolaire ou fondamental | Inicial o básica | — |
| Médio | High school | Secondaire | Media | — |
| Pré-vestibular (só 2000) | University entrance prep course | Préparation à l'entrée à l'université | Preuniversitario | — |
| Graduação | Undergraduate | Premier cycle universitaire (licence) | Pregrado | — |
| Pós-graduação | Graduate studies | Master ou doctorat | Posgrado | — |
| **Tipologia do fluxo intra-RM** | **Intra-RM flow type** | **Type de flux intra-RM** | **Tipo de flujo intra-RM** | — |
| Voltou a trabalhar (estudar) na origem | Went back to working (studying) in the origin municipality | Retourne travailler (étudier) dans la municipalité d'origine | Volvió a trabajar (estudiar) en el origen | — |
| Passou a trabalhar (estudar) no núcleo | Now works (studies) in the core | Travaille (étudie) désormais dans le centre | Pasó a trabajar (estudiar) en el núcleo | — |
| Trabalha (estuda) em outro município da RM | Works (studies) in another RM municipality | Travaille (étudie) dans une autre municipalité de la RM | Trabaja (estudia) en otro municipio de la RM | — |
| Trabalha (estuda) no próprio município | Works (studies) in own municipality | Travaille (étudie) dans sa municipalité | Trabaja (estudia) en su propio municipio | — |
| Vários municípios / Exterior | Several municipalities / Abroad | Plusieurs municipalités / Étranger | Varios municipios / Exterior | — |
| **Residuais** | | | | |
| Outros ou suprimido (Outros / suprimido) | Other or suppressed | Autres ou masqué | Otros o suprimido | — |
| Ignorado / Não informado | Unknown / Not reported | Inconnu / Non déclaré | Ignorado / No declarado | — |
| Não determinado / Sem declaração | Undetermined / Not declared | Indéterminé / Non déclaré | No determinado / Sin declaración | — |

### 2.8 Interface e páginas de SEO

| PT | EN | FR | ES |
|---|---|---|---|
| Atlas da migração interna no Brasil | Atlas of internal migration in Brazil | Atlas des migrations internes au Brésil | Atlas de la migración interna en Brasil |
| Migração em {lugar} (2017-2022) | Migration in {place} (2017–2022) | Migrations à/dans {lieu} (2017–2022) | Migración en {lugar} (2017–2022) |
| Indicadores; Estimativa; Participação; Amostra | Indicators; Estimate; Share; Sample | Indicateurs ; Estimation ; Part ; Échantillon | Indicadores; Estimación; Participación; Muestra |
| Perfil dos migrantes e dos residentes | Profile of migrants and residents | Profil des migrants et des résidents | Perfil de los migrantes y de los residentes |
| Migrantes e trabalho | Migrants and work | Migrants et emploi | Migrantes y trabajo |
| Nota metodológica; Metodologia; Glossário | Methodological note; Methodology; Glossary | Note méthodologique ; Méthodologie ; Glossaire | Nota metodológica; Metodología; Glosario |
| Como citar (esta página); Aviso padrão | How to cite (this page); Standard notice | Comment citer (cette page) ; Avertissement standard | Cómo citar (esta página); Aviso estándar |
| Métrica do mapa; Busca; Carregando… | Map metric; Search; Loading… | Indicateur de la carte ; Recherche ; Chargement… | Métrica del mapa; Búsqueda; Cargando… |

FR: a preposição antes de {lieu} varia com o tipo de lugar. Por isso, a frase é uma função no
dicionário, e não uma concatenação no componente.

---

## 3. Convenções de formato

| Item | PT (referência) | EN | FR | ES |
|---|---|---|---|---|
| Locale `Intl` | pt-BR | en-US | fr-FR | es-ES (com `useGrouping: "always"`) |
| Milhar / decimal | 1.234,5 | 1,234.5 | 1 234,5 (espaço fino inseparável U+202F, gerado pelo `Intl`) | 1.234,5 (inclusive 4 dígitos: o atlas força o agrupamento) |
| Sinal | "+" e "−" (U+2212) explícitos, decididos após arredondar | igual | igual | igual |
| Percentual | 12,5% | 12.5% | 12,5 % (espaço inseparável) | 12,5 % (espaço inseparável, como o `Intl`) |
| Por mil | 12,3‰ | 12.3‰ | 12,3 ‰ | 12,3 ‰ |
| Unidades | 31 min, 1 h, 200 km | igual (com espaço) | igual | igual |
| Faixa de anos | 2017–2022 | 2017–2022 | 2017–2022 | 2017–2022 |
| Data por extenso | 31 de julho de 2022 | July 31, 2022 | 31 juillet 2022 | 31 de julio de 2022 |
| Data numérica | 31/07/2022 | **evite**; use a data por extenso ou ISO 2022-07-31 | 31/07/2022 | 31/07/2022 |
| Aspas | “ ” (internas ‘ ’) | “ ” (internas ‘ ’) | « » com espaço inseparável dentro | « » (RAE; internas “ ”) |
| Pontuação alta | — | — | espaço inseparável antes de : ; ! ? | ¿…? ¡…! |
| Maiúsculas em títulos | sentence case | sentence case (nunca Title Case) | sentence case; *État* e nomes de região com maiúscula | sentence case; meses e *estado* em minúscula |

- **Números sempre via `lib/format.ts`** (`num`, `num1`, `num2`, `sinal`, `sinal1`, `ic95`).
  Nunca escreva números formatados à mão nos dicionários.
- **Moeda.**
  - Mantém o símbolo original: R$ (2022, 2010, 2000) e Cr$ (1991, 1980).
  - O número segue o locale (ex.: EN "R$ 1,212.00").
  - Na primeira menção da metodologia, glose: EN "(Brazilian reais, BRL)" / FR "(réaux
    brésiliens, BRL)" / ES "(reales brasileños, BRL)". Para Cr$: cruzeiros / cruzeiros /
    cruceiros.
  - Nunca converta para USD ou EUR: as faixas são em salários mínimos justamente para não
    depender da moeda.
- **IBGE e nome do censo.**
  - IBGE nunca se traduz; expanda-o uma vez por página (§1.1).
  - EN: "2022 Demographic Census" (na interface, "2022 Census").
  - FR: "Recensement démographique 2022" (na interface, "Recensement 2022").
  - ES: "Censo Demográfico 2022".
  - Em citação bibliográfica, mantenha o título original entre parênteses ou em itálico: "IBGE,
    2022 Demographic Census (*Censo Demográfico 2022*), sample microdata (controlled access)".
- **Título do atlas em citações e DOI.** Fica sempre no original, *Atlas da migração interna no
  Brasil*, com a tradução entre colchetes quando ajudar: "[Atlas of internal migration in
  Brazil]". Na interface (cabeçalho, `<title>`) usa-se o título traduzido.
- **Termos estrangeiros mantidos no texto** (*proxy*, *gate*, *carteira*, *município* na glosa)
  vão em itálico quando o meio permitir, nunca entre aspas.

---

## 4. Avisos legais e de fonte (frases-modelo)

**Aviso de tradução.** Vai no rodapé de todas as páginas EN/FR/ES e no topo da metodologia.

- **EN:** This is a translation of the Portuguese original, which is the reference version. In
  case of any discrepancy, the Portuguese text prevails; estimates, caveats and IBGE notices
  apply as worded in the original.
- **FR :** Ceci est une traduction de l'original en portugais, qui est la version de référence.
  En cas de divergence, le texte portugais fait foi ; les estimations, les réserves et les
  avertissements de l'IBGE s'appliquent dans leur rédaction originale.
- **ES:** Esta es una traducción del original en portugués, que es la versión de referencia. En
  caso de discrepancia, prevalece el texto en portugués; las estimaciones, las salvedades y los
  avisos del IBGE rigen en su redacción original.

**Aviso padrão (`meta.aviso`, edição 2022).** É o modelo para as outras edições. Troque o ano e
"controlled access" por "public data" quando for o caso. Em 1980, acrescente a cláusula sobre a
ausência de erro amostral.

- **EN:** Estimates produced by the author from the sample microdata of the 2022 Demographic
  Census (IBGE, controlled access), subject to statistical disclosure control and sampling error;
  they may differ from IBGE's official tabulations (SIDRA).
- **FR :** Estimations établies par l'auteur à partir des microdonnées de l'échantillon du
  Recensement démographique 2022 (IBGE, accès contrôlé), soumises au contrôle de la divulgation
  statistique et à l'erreur d'échantillonnage ; elles peuvent différer des tableaux officiels de
  l'IBGE (SIDRA).
- **ES:** Estimaciones elaboradas por el autor a partir de los microdatos de la muestra del Censo
  Demográfico 2022 (IBGE, acceso controlado), sujetas a control de divulgación estadística y a
  error muestral; pueden diferir de los tabulados oficiales del IBGE (SIDRA).

**Linha de fonte das páginas de SEO.**

- **EN:** Primary source: IBGE, 2022 Demographic Census, sample microdata (controlled access).
  Estimates: Daniel Pessini Sobreira, *Atlas da migração interna no Brasil*.
- **FR :** Source primaire : IBGE, Recensement démographique 2022, microdonnées de l'échantillon
  (accès contrôlé). Estimations : Daniel Pessini Sobreira, *Atlas da migração interna no Brasil*.
- **ES:** Fuente primaria: IBGE, Censo Demográfico 2022, microdatos de la muestra (acceso
  controlado). Estimaciones: Daniel Pessini Sobreira, *Atlas da migração interna no Brasil*.

# Relatório de QA — F5 (Características e fluxo selecionado)

Gerado em 2026-09-05. Verificação feita no navegador, com o servidor de desenvolvimento.

## Entregue

- **Painel do fluxo selecionado**: clicar num arco do mapa ou numa linha das tabelas fixa o par origem–destino e abre um painel com volume, intervalo de confiança, faixa de observações, o fluxo inverso, o saldo do par e o perfil dos migrantes daquele percurso.
- **Perfil comparado**: barras 100% empilhadas confrontam quem fez o percurso com três referências — todos os que chegaram ao destino, todos os que saíram da origem e a população residente no destino.
- **Perfil dos migrantes do município**, no painel municipal, com a mesma leitura.
- **Recorte por característica**: um seletor no cabeçalho restringe mapa, arcos, tabelas e indicadores a um subgrupo (status migratório, escolaridade ou faixa de renda).
- **Exportação em CSV** dos fluxos exibidos, com atribuição de fonte e registro do recorte aplicado.
- Estado do recorte e do fluxo refletido na URL, o que torna qualquer vista compartilhável.

## Critérios de aceite do plano

| Critério | Resultado |
|---|---|
| Clique no arco abre o painel em menos de 200 ms | **18 ms** (`detalheDoFluxo`, com o DuckDB aquecido) |
| Cada filtro recalcula em menos de 200 ms | **17 ms** para repintar o mapa, **16 ms** para arcos e tabelas |
| Perfil do fluxo soma ao total do fluxo | verificado: as barras usam as próprias colunas do fluxo, normalizadas a 100% |
| Supressão e avisos de CV respeitados | fluxos abaixo do limiar mostram mensagem própria; fluxos com menos de 20 observações não exibem perfil, com explicação |

O primeiro carregamento leva cerca de 25 s em desenvolvimento, dominado pela inicialização do DuckDB-WASM. Depois disso toda interação é instantânea. Em produção o tempo cai, mas vale medir de novo na F7.

## O que a comparação revela

O caso Rio de Janeiro → São Paulo é uma demonstração limpa de seletividade migratória. Entre as pessoas de 25 anos ou mais:

| Grupo | Superior completo |
|---|---:|
| **Neste fluxo (Rio → São Paulo)** | **75,1%** |
| Todos os imigrantes de São Paulo | 54,9% |
| Todos os emigrantes do Rio de Janeiro | 37,5% |
| Residentes de São Paulo | 29,2% |

O fluxo entre as duas metrópoles é muito mais escolarizado que qualquer uma das referências — inclusive que o conjunto dos imigrantes que São Paulo recebe. É exatamente o tipo de leitura que o painel de três referências foi desenhado para produzir, e que um número isolado de volume não mostraria.

O painel também traz o fluxo inverso e o saldo do par: São Paulo recebe 17.655 pessoas do Rio e devolve 6.820, um saldo de +10.835 na troca entre as duas cidades.

## Decisões de implementação

- **Escolaridade e renda usam rampas ordinais, não cores categóricas.** São níveis ordenados, então recebem rampa de matiz único — azul para escolaridade, laranja para renda, seguindo a regra da skill `dataviz` para dois contextos sequenciais simultâneos. Status migratório é nominal e recebe os slots categóricos. Todas as rampas foram validadas com o validador da skill nos dois modos: claridade monotônica, salto entre passos e contraste do extremo claro, todos aprovados.
- **Idade e sexo ficaram fora das barras de perfil.** Combinar faixa etária (ordinal) com sexo (nominal) em uma única barra exigiria dez cores concorrentes, o que a skill desaconselha. Os dados estão publicados e entram na F6 com forma adequada.
- **Status migratório não é comparado com residentes.** Quem não migrou não tem status migratório; a linha foi removida dessa dimensão em vez de exibir "sem dado".
- **O recorte se aplica a todos os indicadores.** Sob recorte, imigrantes, emigrantes, saldo, taxas e índice de eficácia passam a se referir ao subgrupo, e um aviso explícito diz isso. Mostrar saldo do subgrupo ao lado de imigração total daria um painel internamente incoerente.
- **O erro-padrão não é reaproveitado sob recorte.** O valor publicado é do total, não do subgrupo; exibi-lo ao lado de números filtrados seria incorreto. O painel mostra "sem estimativa" enquanto o recorte está ativo.
- **Barras de perfil em HTML puro**, não em biblioteca de gráficos: são barras 100% empilhadas simples, e o HTML dá elementos reais para leitores de tela, com rótulo acessível carregando todos os percentuais.
- **Montagem do CSV separada do download**, para poder ser testada sem DOM.

## Problemas encontrados e resolvidos

1. **Corrida no estado dos arcos.** O efeito de montagem sobrescrevia os fluxos do município selecionado pelos maiores fluxos nacionais, deixando as tabelas vazias enquanto o mapa mostrava arcos alheios. A responsabilidade pelo estado passou a ser de um único efeito.
2. **Painel mentia durante a carga do recorte.** Com o recorte ativo mas os dados ainda não chegados, o painel exibia os totais sob o aviso de que os números eram do subgrupo. Agora bloqueia os indicadores e mostra "Aplicando o recorte…".
3. **Erro de ordem de declaração** entre `porCodigo` e `municipiosVisiveis`, que derrubava a aplicação na primeira renderização.
4. **Escopo do perfil sob recorte.** As barras mostram a composição de todos os migrantes, não a do subgrupo; sem aviso, ficariam ambíguas ao lado de indicadores filtrados. Uma nota explicita o escopo.

## Testes

- Front-end (`vitest`): **14 aprovados** (8 anteriores + 6 novos) — rampas ordinais sem cor repetida e sem colisão entre si, slots categóricos distintos, cor definida nos dois modos para toda categoria, escape de separador e aspas no CSV, presença obrigatória da atribuição de fonte, registro do recorte nas notas.
- Pipeline (`pytest`): **41 aprovados**, sem regressão.

## Pendências

- **Níveis de agregação por região geográfica** (imediata e intermediária) ficaram de fora: exigem malhas próprias em TopoJSON, que a F3 não gerou. Fica para a F6, junto da decisão de gerar essas malhas ou agregar só tabelas e arcos.
- **Matriz de acordes entre UFs**: a consulta está pronta (`fluxosEntreUFs`), falta o componente.
- **Idade e sexo** nas barras de perfil, com forma adequada.
- O mapa ainda não aproxima no município ou no fluxo selecionado.

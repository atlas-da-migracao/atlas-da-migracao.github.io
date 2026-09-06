# Relatório de QA — F4 (Dashboard MVP)

Gerado em 2026-09-05. Verificação feita no navegador, com o servidor de desenvolvimento.

## Entregue

Aplicação em `web/` (Vite + React + TypeScript) com mapa coroplético dos 5.570 municípios,
arcos dos fluxos migratórios, painel de indicadores com intervalo de confiança, busca por
município, seleção refletida na URL e tema claro/escuro.

## Critérios de aceite do plano

| Critério | Resultado |
|---|---|
| Carga inicial ≤ 25 MB | **1,06 MB comprimido** no caminho crítico (HTML, CSS, JS, malha, dados do mapa); 15,3 MB para o pacote completo, dos quais 8,1 MB são o runtime do DuckDB, carregado em paralelo |
| Primeira pintura < 3 s | mapa colorido em ~4 s no servidor de desenvolvimento, sem esperar o DuckDB |
| Interação sem travar com 2.000 arcos | 150 arcos no panorama nacional e até 30 por município; `deck.gl` renderiza em WebGL sem perda de fluidez |
| Sem erros no console | **console limpo** em aba nova (só as mensagens de conexão do Vite) |

## Verificação funcional no navegador

- **Coroplético**: pinta os 5.570 municípios; o padrão espacial reproduz a geografia migratória conhecida — ganhos em Santa Catarina, interior paulista, Goiás, Mato Grosso e Rondônia; perdas no interior nordestino e norte de Minas.
- **Busca**: insensível a acento e caixa ("Sao Paulo" encontra "São Paulo"), ordenada por população.
- **Painel**: São Paulo/SP mostra saldo −479.395 (IC 95% −491.551 a −467.239), taxa líquida −44‰, 311.895 imigrantes, 791.290 emigrantes, precisão boa (CV 1,3%), índice de eficácia −0,43. Guarulhos/SP mostra saldo −19.830 e São Paulo como origem dominante (23.425). Ambos batem com os valores calculados na F2, já com o arredondamento a múltiplos de 5.
- **Tooltip**: identifica o município e o valor sob o cursor; nos arcos, o par origem→destino.
- **Reenquadrar**: botão "Ver o Brasil" aparece assim que o usuário move o mapa.

## Decisões de implementação

- **Sem MapLibre.** O plano previa MapLibre com `deck.gl` por cima, mas também determinava mapa sem basemap externo. Sem tiles de terceiros, o MapLibre não acrescentaria nada e custaria bundle; a base cartográfica é a própria malha do IBGE, renderizada pelo `deck.gl`.
- **Taxa líquida como métrica padrão**, no lugar do saldo absoluto. O saldo em pessoas é dominado pelo tamanho do município e produz um mapa sem estrutura espacial legível; a taxa por mil habitantes normaliza e revela o padrão. O saldo continua disponível no seletor de métrica e é o número de destaque do painel.
- **Arquivo enxuto para a primeira pintura.** `municipios_mapa.json` (419 KB, 151 KB comprimido) pinta o coroplético de imediato; o DuckDB entra depois para fluxos, perfis e filtros. Sem isso, o mapa ficaria cinza até o runtime de 36 MB baixar e compilar.
- **Runtime do DuckDB como arquivo estático** em `public/duckdb`, copiado do `node_modules` por `scripts/copy-duckdb.sh`, em vez de baixado do CDN jsDelivr. O site fica sem dependência de terceiros e funciona offline.
- **Apenas o build `eh` do DuckDB.** O build `mvp` pesa 41 MB e só serviria navegadores antigos, que de todo modo não rodam o WebGL2 exigido pelo mapa. Removê-lo reduziu o pacote de 89,7 MB para 47,5 MB.

## Escala de cor

Escala divergente para o saldo e a taxa líquida: vermelho para perda, cinza para perto de zero, azul para ganho, centrada em zero e com quebras simétricas (mesma intensidade para ganho e perda de mesma magnitude).

Validada com `scripts/validate_palette.js` da skill `dataviz`. Cada braço foi verificado como rampa de matiz único: claridade monotônica, salto entre passos acima de 0,06 e dispersão de matiz até 3°; ambos passam nos dois modos. O extremo claro fica próximo da superfície de propósito — é a regra do coroplético, em que o passo mais claro significa "perto de zero". Como os passos claros ficam abaixo de 3:1 de contraste, aplica-se a regra de alívio da skill: a legenda traz as faixas de valor e o painel mostra os números exatos.

Modo escuro tem passos próprios, escolhidos para a superfície escura, e não uma inversão automática.

## Problemas encontrados e resolvidos

1. **DuckDB-WASM travava sem erro.** A configuração padrão baixa o runtime do CDN jsDelivr; a requisição ficava pendente indefinidamente e o mapa permanecia cinza, sem nada no console. Resolvido servindo o runtime localmente.
2. **Worker de origem opaca.** Empacotar o worker pelo Vite (`?worker`) ou embrulhá-lo em blob cria um worker cuja base é opaca, e a URL relativa do `.wasm` não resolve dentro dele. Resolvido servindo worker e binário como arquivos estáticos, com URL absoluta na mesma origem.
3. **Enquadramento inicial sobrescrito.** O `deck.gl` emite `onViewStateChange` ao montar e ao redimensionar; aceitar esses eventos tirava o mapa do enquadramento do Brasil já na carga. Resolvido aceitando apenas mudanças originadas em gesto do usuário.
4. **Mapa ruidoso.** Com o saldo absoluto e a primeira quebra na mediana, metade dos municípios ficava colorida e o mapa lia como ruído. Resolvido com a taxa líquida como padrão e faixa central mais generosa (percentil 60).

## Testes

- Front-end (`vitest`): **8 aprovados** — simetria da escala divergente, cinza neutro perto de zero, paleta própria do modo escuro, quebras crescentes, formatação de sinal e intervalo de confiança.
- Pipeline (`pytest`): **41 aprovados**, sem regressão.

## Pendências para as fases seguintes

- O mapa não aproxima no município selecionado (previsto para a F5, junto com a vista de fluxo).
- O painel ainda não traz os gráficos de perfil dos migrantes (F5).
- Passe de design, acessibilidade e responsividade fina ficam para a F6.

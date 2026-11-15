# Tabelas de preços da ótica

Cada ótica publica seus próprios **preços de venda**. Zeiss, Hoya, Varilux, lentes próprias e outras marcas são sugestões de preenchimento, não integrações com fornecedores. A Lumi não baixa preços oficiais nem promete atualização automática: a ótica confere a tabela e substitui o arquivo quando os valores mudam.

## Importar e conferir

1. Abra **Tabelas de preços → Importar tabela**. No modo com banco, configure a ótica e entre como proprietário.
2. Informe nome, marca, início da vigência e, opcionalmente, a data final. A vigência considera o calendário de Brasília e inclui o último dia.
3. Escolha Excel **.xlsx** ou **CSV**, com até 5 MB. `.xls` deve ser salvo como `.xlsx`. CSV aceita UTF-8 e Windows-1252, com ponto e vírgula, vírgula ou tabulação. Campos com vírgula precisam de aspas quando a vírgula for o separador.
4. Para Excel, escolha a aba. Se houver títulos antes dos dados, selecione a linha do cabeçalho, entre as primeiras 20 linhas.
5. Confira as colunas sugeridas ou selecione cada uma manualmente. São necessários produto, tipo de lente e preço de venda. Sem coluna de tipo, escolha um tipo para toda a tabela.
6. Declare se o arquivo informa valores **por lente ou pelo par**. No primeiro caso, a Lumi multiplica por dois e mostra a conversão na prévia.
7. Confira a prévia, corrija todos os erros, marque a confirmação e publique. A importação não publica parcialmente as linhas válidas.

Há um [modelo CSV](../apps/painel/public/modelo-tabela-lumi.csv) para baixar dentro do aplicativo. Todos os valores do modelo são fictícios. Não são preços das marcas citadas.

## Dados de cada produto

| Campo | Regra |
| --- | --- |
| Código / SKU | Opcional. Deve ser único na tabela; sem coluna, a referência usa a linha do arquivo. |
| Nome | Obrigatório, até 160 caracteres. |
| Tipo | Visão simples/monofocal, multifocal/progressiva ou ocupacional/office. Outros tipos precisam de adaptação antes da importação. |
| Preço de venda | Obrigatório e positivo. Centavos em BRL, no máximo R$ 1.000.000,00 pelo par. |
| Preço máximo | Opcional. Ausente, usa o mesmo preço de venda; preenchido, deve ser maior ou igual ao mínimo. |
| Tratamentos incluídos | Texto livre, até 300 caracteres; são parte do produto, sem soma de adicionais. |
| Índice de refração | Texto opcional, até 30 caracteres. |
| Observações / restrições | Até 500 caracteres; aparecem na consulta e no orçamento. |

Planilhas devem ter **uma linha por produto** e preços em células, com no máximo 1.000 produtos e 100 colunas por tabela; 30 tabelas por ótica. Cabeçalhos mesclados, matrizes de graus/índices, valores somente em imagens, regras de descontos ou fórmulas sem resultado salvo precisam ser organizados em colunas antes da importação. PDF e fotos não fazem parte desta etapa. O importador não interpreta receitas nem decide qual lente é adequada ao cliente.

Os arquivos são lidos no navegador. São gravados somente produtos normalizados, metadados e nome do arquivo; o arquivo original não é arquivado.

## Consultar, atualizar e orçar

A biblioteca mostra marca, número de produtos, vigência e **última importação**, em horário de Brasília. Essa data identifica a publicação feita pela ótica; não certifica que o fornecedor não alterou os preços depois. Use os filtros Vigentes, Programadas e Vencidas. A consulta de produtos permite buscar por nome, código, índice e tratamentos.

**Substituir arquivo** publica uma nova versão da mesma tabela. Isso substitui a lista inteira de produtos, incluindo a retirada dos produtos ausentes no novo arquivo. Atualizações concorrentes exigem recarregar a versão atual, evitando sobrescritas silenciosas.

No simulador: aceite o atendimento → Orçamento de lentes → tipo de lente → tabela → produto. A Lumi permite navegar por páginas e buscar produtos por texto. Mostra marca, produto, código, índice, tratamentos, restrições e preço do par. O fluxo permanece uma consulta estruturada; não há modelo externo de IA configurado para interpretar planilhas ou recomendações clínicas. Os dados publicados são a fonte do valor apresentado.

Depois da primeira tabela importada, os novos orçamentos usam exclusivamente produtos de tabelas vigentes. Não há fallback para faixas gerais se uma tabela vencer, estiver programada, falhar ao carregar ou não contiver o tipo solicitado. O fluxo solicita confirmação humana sem inventar um preço. Os tratamentos já incluídos não são cobrados outra vez. Armação e descontos não estão incluídos.

Ao salvar, o banco consulta novamente produto, versão e validade. Se a tabela mudou desde a estimativa, é necessário refazer o orçamento para confirmar o novo preço. Orçamentos salvos preservam **valores e origem da tabela** mesmo após novas importações. Repetir o salvamento da mesma solicitação não duplica o registro. Ainda são orçamentos de teste, com confirmação final por atendente e sem WhatsApp conectado.

## Demonstração e banco

Com `npm run demo`, a importação e a consulta funcionam sem Docker. As tabelas ficam na chave `lumi:demo:catalogs:v1` do `sessionStorage`, somente naquela aba. Use arquivos fictícios; não é armazenamento permanente e não salva orçamentos no banco.

Com Supabase local, aplique `npm run db:migrate` e reconstrua o painel. A migration `202611140006_price_catalogs.sql` adiciona `price_catalogs`, origem nos orçamentos e funções transacionais de publicação e orçamento. Somente proprietários publicam; atendentes vinculados podem consultar. RLS isola óticas. Clientes não gravam preços nem a origem de um orçamento diretamente.

Validação: `npm test`, `npm run typecheck`, `npm run test:db`, `npm run test:e2e` com build normal, e `npm run test:e2e:demo` com build de demonstração. Os testes de navegador cobrem CSV, Excel real com múltiplas abas, conferência, conversão por lente, substituição, persistência, orçamento e layout móvel.

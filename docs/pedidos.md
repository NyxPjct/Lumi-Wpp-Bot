# Pedidos de teste e consulta de status

O painel **Pedidos** acompanha pedidos fictícios da própria ótica. A opção **Status do pedido** do simulador consulta o código no Supabase local. Nenhuma mensagem é enviada pelo WhatsApp nesta entrega.

## Cadastrar

Entre na conta, configure a ótica e abra **Pedidos**. Informe:

- **Código do pedido**: único na ótica, de 3 a 30 caracteres, com letras, números e hífens. Exemplo: `LUM-001`. Espaços nas extremidades são removidos e letras convertidas para maiúsculas. Segmentos vazios não são aceitos.
- **Nome fictício do cliente**: de 2 a 80 caracteres. Use somente dados de teste, sem telefone, receita ou informações de saúde.

Comandos do bot, como `MENU`, `VOLTAR`, `ATENDENTE`, `HUMANO` e `PESSOA`, não podem ser usados como códigos; palavras de transbordo separadas por hífen também são reservadas. Isso evita conflito entre consultar um código e pedir um atendente.

O pedido começa **Em produção**. Repetir uma criação com a mesma chave e os mesmos dados recupera o registro sem duplicá-lo. Um código pode existir em óticas diferentes, mas não pode ser repetido dentro da mesma ótica. Código e nome não são editáveis pelo painel nesta versão.

## Acompanhar e registrar a retirada

As transições são progressivas:

1. **Em produção → Pronto para retirar**: clique em **Marcar pronto para retirar**.
2. **Pronto para retirar → Retirado**: clique em **Registrar retirada** e confirme. Você pode desistir na confirmação sem alterar o pedido.

Não é possível pular diretamente de produção para retirado nem reverter uma retirada. O banco verifica o estado esperado para evitar que uma tela desatualizada desfaça a alteração de outro operador. Repetir uma mudança que já chegou ao estado solicitado não duplica efeitos.

O painel mostra os últimos 100 pedidos e permite filtrar esse conjunto por estado. Proprietários e atendentes vinculados podem registrar e acompanhar pedidos. Não há exclusão pelo painel nesta etapa.

## Rascunho de aviso de óculos prontos

Ao marcar um pedido como pronto, a mesma transação grava um único registro em `order_notifications` com o nome de template `oculos_prontos`, `is_demo=true` e estado `blocked`.

**Isso é um rascunho durável, não uma mensagem enviada nem uma fila pronta para disparo.** Não há telefone, credencial Meta, template aprovado ou worker de envio associados. O banco só aceita os estados `blocked` e `cancelled` para esses rascunhos, sem estado de enviado.

Quando a retirada é registrada, o rascunho bloqueado é cancelado na mesma transação. Esses registros de teste não devem ser enviados automaticamente ao conectar o WhatsApp. Uma integração futura precisará separar dados reais de teste e validar destinatário, vínculo com o pedido, template, autorização e regras de envio antes de produzir notificações reais.

## Consultar pelo simulador

Aceite o aviso inicial e escolha **Status do pedido** (opção 4). Informe o código cadastrado. A Lumi responde somente com código e estado:

- Em produção: a ótica ainda precisa confirmar a previsão; o bot não inventa uma data.
- Pronto para retirar: orienta combinar a retirada com a ótica.
- Retirado: informa que a retirada já foi registrada.

O nome do cliente e os dados internos do rascunho não são retornados pela função de consulta. Um código ausente gera uma resposta de não encontrado. Uma falha de conexão gera indisponibilidade, com opções de tentar novamente, informar outro código ou voltar ao menu; não é apresentada como pedido inexistente.

A consulta exige a conta autenticada do operador e fica limitada à sua ótica por RLS. O código **não autentica um cliente real**. Antes de oferecer consulta no WhatsApp, será necessário verificar no servidor a identidade do contato e seu vínculo com o pedido, sem expor um endpoint público baseado apenas em códigos adivinháveis. A consulta por telefone ainda não foi implementada.

## Banco e testes

A migration `202611140005_orders.sql` cria `orders` e `order_notifications`. Todas as alterações passam por funções autenticadas; o navegador não pode editar diretamente estado, ótica ou rascunhos. Um vínculo composto garante que pedido e aviso pertencem à mesma ótica.

- `npm test`: normalização de código, consentimento, estados da consulta, repetição e ausência de respostas fictícias.
- `npm run test:db`: criação concorrente idempotente, códigos por ótica, transições, aviso bloqueado único, cancelamento após retirada, consulta mínima e RLS.
- `npm run test:e2e`: cadastro no painel, consulta de cada estado, falha de rede diferente de ausência, retirada com confirmação, atualização concorrente, filtro e layout mobile.
- `npm run test:e2e:demo`: modo sem banco informa que não consulta pedidos, sem inventar estados ou envios.

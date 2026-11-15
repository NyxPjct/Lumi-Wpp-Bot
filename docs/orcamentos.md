# Preços e orçamentos de teste

A Lumi estima o valor para o **par de lentes** com base nos dados publicados pela ótica. Não interpreta receita, não recomenda tratamentos e não confirma um valor final. Não envia mensagens ao WhatsApp.

**Tabelas de produtos:** agora é possível importar Excel e CSV em **Tabelas de preços**. Depois da primeira importação, os novos orçamentos usam exclusivamente produtos vigentes dessas tabelas. Veja [o guia de tabelas](tabelas-de-precos.md) para publicação, validade, atualização e orçamento com origem preservada. O restante deste documento descreve as faixas gerais anteriores, disponíveis em `/precos` enquanto não houver tabela importada.

## Configurar preços

No modo Supabase local, entre na conta e configure a ótica antes de abrir **Tabelas de preços → Faixas gerais de preços**. As faixas começam vazias; não há valores automáticos para uma ótica real.

Preencha todas as seis faixas:

- Base: visão simples, multifocal e ocupacional.
- Adicionais: antirreflexo, filtro de luz azul e fotossensível.

Os valores são em reais, com vírgula para centavos e sem separador de milhar, por exemplo `250,00`. O mínimo deve ser menor ou igual ao máximo. Use `0,00` para um adicional gratuito que a ótica oferece. Cada faixa aceita até R$ 1.000.000,00. Somente o proprietário pode alterar preços. Salvar a tabela é uma operação atômica: não há atualização parcial se um campo for inválido.

A regra de cálculo desta versão é **base do par + adicionais selecionados**. Não inclui armação, descontos, combos ou regras específicas da receita. Se a ótica usa pacotes, é necessário adaptar a regra antes do atendimento real.

## Experimentar o orçamento

1. No simulador, aceite o aviso inicial.
2. Escolha **Orçamento de lentes** (opção 1).
3. Escolha o tipo: 1 para visão simples, 2 para multifocal, 3 para ocupacional.
4. Informe os tratamentos por números separados por vírgula, por exemplo `1,2`, ou `0` para nenhum.
5. Confira a faixa estimada. A conversa passa para atendimento humano e o bot pausa.
6. No modo Supabase, use **Salvar orçamento de teste**. O banco recalcula o valor com a tabela atual, sem aceitar valores enviados pelo navegador.

Se a tabela mudar entre a estimativa e o salvamento, o resumo informa o novo valor confirmado pelo banco. Repetir o salvamento da mesma solicitação não cria outro registro. Uma alteração de preços não modifica os valores dos orçamentos já salvos. Se faltar preço para a combinação escolhida, o fluxo encaminha para humano sem inventar um valor e sem gerar orçamento numérico.

`menu` cancela as preferências e volta ao início. As palavras `atendente`, `humano` ou `pessoa` interrompem o fluxo. Três respostas inválidas consecutivas também pausam o bot para atendimento humano. Dados de conversa e consentimento do simulador continuam somente na memória da página.

## Acompanhar registros

Em **Orçamentos**, aparecem os últimos 50 registros de teste da própria ótica. O filtro aplica-se a esses registros. Os estados disponíveis são **Novo**, **Em atendimento**, **Fechado** e **Perdido**. Proprietários e atendentes vinculados à ótica podem atualizar o status; essa ação não envia mensagem ao cliente.

Todos os registros atuais têm `is_demo=true`. Não há cliente, telefone, receita ou conversa persistida vinculados. São registros para desenvolver e validar o produto, não leads reais de WhatsApp. A lista usa horário de Brasília.

## Modo sem banco

`npm run dev:demo` usa valores fictícios explicitamente identificados como demonstração. Os preços editados ficam na chave `lumi:demo:prices:v1` do `sessionStorage`. A configuração da ótica usa outra chave. Esse modo não salva orçamentos no banco nem mostra um registro como salvo.

## Banco e testes

A migration `202611140002_quotes.sql` cria `lens_prices`, `treatment_prices` e `quotes`, com RLS por ótica. Clientes autenticados só leem dados da própria ótica; não têm permissão de inserir preços ou orçamentos diretamente nem de alterar valores, tenant ou indicador de teste. As funções `set_price_table` e `create_quote` verificam o vínculo autenticado. A chave de reenvio é única por ótica e o banco guarda a faixa calculada no momento da criação.

- `npm test`: conversão de moeda, cálculo e estados da conversa, além das verificações anteriores.
- `npm run test:db`: cálculo no servidor, isolamento entre óticas, permissões, validação, atualização atômica e reenvios simultâneos.
- `npm run test:e2e`: cadastro/login e o fluxo de preços → orçamento → salvamento → listagem/status, incluindo persistência e recálculo após mudança de tabela.
- `npm run test:e2e:demo`: simulador e onboarding no build demo, incluindo cálculo sem falsa persistência.

O envio de receitas exigirá uma etapa própria de armazenamento privado, consentimento persistente, controle de acesso e retenção antes de qualquer uso com clientes reais.

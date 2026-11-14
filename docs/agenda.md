# Agenda de teste da Lumi

O painel oferece uma agenda por ótica para exames, ajustes e retiradas. Essa entrega funciona no Supabase local e grava somente registros de teste (`is_demo=true`). Não há integração com calendário externo, reserva pela conversa, cliente real associado ou lembrete pelo WhatsApp.

## Abrir horários

1. Entre na conta e configure a ótica.
2. Abra **Agenda**.
3. Em **Abrir um horário**, informe data e hora de Brasília, tipo de atendimento e duração (15, 30 ou 60 minutos).
4. Clique em **Criar horário**. O horário precisa estar no futuro e nos próximos 365 dias.

O proprietário pode criar e retirar horários. Uma única agenda é compartilhada pelos três tipos de atendimento: dois horários ativos não podem se sobrepor, mesmo quando os tipos são diferentes. Horários adjacentes são permitidos. Uma vaga reservada não pode ser retirada antes de cancelar seu agendamento.

As datas são armazenadas como instantes UTC e exibidas no fuso `America/Sao_Paulo`. O formulário interpreta a entrada como horário de Brasília, mesmo quando o navegador está em outro fuso. Essa versão assume a regra atual UTC-03:00 e não tem configuração de fuso por ótica.

## Reservar

1. Escolha um **Horário livre**.
2. Preencha **Nome fictício para teste**, entre 2 e 80 caracteres após remover espaços nas extremidades.
3. Clique em **Confirmar agendamento de teste**.

A confirmação só aparece após o banco aceitar a reserva. Uma vaga só pode ter uma reserva confirmada, inclusive quando duas pessoas tentam reservar simultaneamente. Repetir uma solicitação que continua confirmada com a mesma chave não duplica o registro. Solicitações já canceladas ou remarcadas exigem recarregar e iniciar uma nova operação; não são recriadas automaticamente.

## Cancelar ou remarcar

Em **Agendamentos de teste**:

- **Cancelar agendamento** pede confirmação. A reserva permanece no histórico como cancelada e o horário volta a ficar livre, se ainda estiver no futuro.
- Para remarcar, escolha **Novo horário** e clique em **Remarcar**. A nova vaga pode ser de outro tipo de atendimento, identificado na lista. O registro mantém a mesma referência, passa para a nova vaga e libera a anterior.
- Se a nova vaga estiver ocupada, cancelada, no passado ou pertencer a outra ótica, a remarcação falha e a reserva anterior permanece intacta.
- **Retirar horário**, na lista de horários, impede novas reservas nessa vaga. Há confirmação antes da retirada.

As alterações ficam no banco. Recarregar a página recupera os dados atuais. O botão **Atualizar agenda** permite buscar alterações feitas por outro operador; o painel não tem atualização em tempo real nesta etapa. A decisão final de disponibilidade sempre é do banco.

## Escopo e permissões

- Proprietário: cria/retira horários e gerencia reservas.
- Atendente vinculado: consulta a agenda e reserva, cancela ou remarca atendimentos.
- Usuário sem vínculo ou anônimo: não acessa os dados da ótica.

A tela mostra até 100 horários futuros (livres, reservados ou retirados) e os últimos 100 agendamentos, com os dados do horário vinculado. Não há gerenciamento de equipe no painel ainda; os testes verificam as permissões usando vínculos preparados exclusivamente para a execução local.

Use somente nomes fictícios. Não informe telefone, receita ou informações de saúde. Agendar um exame não fornece orientação médica. Alterações no painel não enviam mensagens nem lembretes.

## Banco e validação

A migration `202611140003_agenda.sql` cria `appointment_slots` e `appointments`, protegidas por RLS. Todas as mutações passam por funções autenticadas que conferem o vínculo com a ótica. As operações da mesma agenda são serializadas, e um índice único parcial impede duas reservas confirmadas por vaga. A ligação composta entre horário e ótica impede associar uma reserva ao horário de outro tenant.

- `npm test`: conversão de fuso, rejeição de datas inexistentes e validação do nome de teste, além das verificações anteriores.
- `npm run test:db`: disputas concorrentes por horários/vagas, remarcação atômica, cancelamento, permissões e isolamento entre óticas.
- `npm run test:e2e`: fluxo real no painel com navegador em `Asia/Tokyo`, para verificar que a agenda continua usando Brasília, mais persistência e layout mobile.

O fluxo de agendamento pelo bot e os lembretes de utilidade da Meta ficam para uma próxima entrega.

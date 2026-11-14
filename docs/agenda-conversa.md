# Agendamento pelo simulador de conversa

A opção **Agendar exame ou ajuste** do simulador usa a agenda real do Supabase local. As reservas continuam sendo de teste, com nomes fictícios. Não há envio ao WhatsApp nem lembrete automático.

## Preparar

1. Inicie o Supabase local (`npm run db:start`), que aplica também a migration `202611140004_conversation_agenda.sql`.
2. Entre na conta e configure a ótica.
3. No painel **Agenda**, abra horários futuros de exame, ajuste ou retirada.
4. Volte ao simulador e aceite o aviso inicial.

## Reservar na conversa

Escolha **Agendar exame ou ajuste** → **Novo agendamento** → tipo de atendimento → horário → nome fictício → **Sim, confirmar**.

A Lumi mostra no máximo cinco opções por página, usando os próximos 100 horários livres consultados. Use os botões de próximas/opções anteriores quando houver mais vagas. Os horários são de Brasília. A numeração continua apontando para os horários originalmente exibidos; atualizar a disponibilidade não troca a escolha por outra vaga.

A seleção de um horário e a apresentação do resumo ainda não reservam nada. A confirmação só aparece depois de o banco aceitar a operação. Se a vaga já tiver sido ocupada, a conversa não confirma a reserva nem escolhe uma alternativa automaticamente.

## Cancelar ou remarcar

Na agenda da conversa, escolha **Cancelar agendamento** ou **Remarcar agendamento**, selecione uma reserva de teste futura e confirme explicitamente a alteração.

- A remarcação oferece vagas do mesmo tipo de atendimento.
- Se a nova vaga estiver indisponível, a anterior permanece válida.
- Cancelar libera a vaga, mantendo o registro cancelado no banco.
- Responder **não** no resumo não solicita alteração.
- `menu` volta ao menu principal. `atendente`, `humano` ou `pessoa` pausam o bot. Três respostas inválidas consecutivas também encaminham para humano.

## Sessão de teste e recuperação

O navegador guarda apenas um identificador de simulação em `sessionStorage`, separado por usuário autenticado e ótica, na chave `lumi:simulation:<user-id>:<optic-id>`. Os agendamentos ficam no banco, ligados a esse identificador.

Recarregar a página ou reiniciar a conversa não cancela reservas. Após aceitar novamente o aviso inicial, você pode consultar, cancelar ou remarcar os registros da mesma sessão da aba. O histórico da conversa e seu consentimento demonstrativo continuam em memória; não são registros de consentimento de produção.

Reservas feitas manualmente no painel ou com outro identificador de simulação não aparecem nas opções da conversa. O painel Agenda continua mostrando todos os registros da ótica autorizada. A consulta da conversa considera os últimos 50 registros da sessão e oferece apenas os futuros confirmados para gerenciamento.

O identificador é um **agrupamento local de demonstração, não autenticação de clientes**. O operador conectado continua tendo as permissões de sua ótica. Para WhatsApp real, a identidade do contato e o vínculo da conversa deverão ser determinados e verificados no servidor. O comportamento de `sessionStorage` ao abrir abas a partir de outra pode variar conforme o navegador; esse agrupamento não deve ser usado como barreira de autorização.

## Falhas e repetição

As consultas e operações têm limite de espera de 15 segundos por requisição. Se o resultado não puder ser confirmado, a Lumi apresenta a incerteza e permite **Tentar novamente**. Reservas reutilizam a mesma chave de solicitação para recuperar o resultado sem duplicar o registro. Cancelamento e remarcação podem ser repetidos sem criar outra reserva.

Uma falha de resposta pode acontecer depois de o banco já ter concluído a ação. Por isso, reiniciar a conversa ou voltar ao menu não desfaz operações em andamento ou confirmadas. Consulte a própria sessão ou o painel Agenda para verificar o estado atual.

Falhas de conexão não são apresentadas como agenda vazia. O modo demo sem Supabase informa que não cria reservas e não oferece confirmações fictícias.

## Testes

- `npm test`: estados do fluxo, confirmação explícita, paginação, cancelamento do rascunho, transbordo e conservação do comando de repetição.
- `npm run test:db`: agrupamento por simulação, bloqueio de reassociação de reservas, permissões/RLS e restrição de remarcação ao mesmo tipo.
- `npm run test:e2e`: reserva, recuperação na aba, separação entre sessões, remarcação/cancelamento, resposta perdida após persistência, repetição sem duplicação e disputa de vaga sem troca automática.
- `npm run test:e2e:demo`: informa indisponibilidade de agendamento no modo sem banco, preservando os demais fluxos.

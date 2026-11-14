# Lumi

Atendimento pelo WhatsApp para óticas. Cada ótica conectará seu próprio número dentro do aplicativo pelo fluxo oficial da Meta.

## Estado atual

- Cadastro, login e logout com Supabase Auth local.
- Onboarding da ótica e configurações persistidas em PostgreSQL.
- RLS para isolar as configurações de cada ótica; criação transacional da ótica e do vínculo com o proprietário.
- Tabela de preços editável, cálculo de orçamento por tipo de lente e tratamentos, com valores em centavos.
- Lista de orçamentos de teste persistidos, filtro por status e atualização do acompanhamento.
- Agenda do painel: criar e retirar horários, reservar, cancelar e remarcar agendamentos de teste.
- Painel responsivo com simulador: consentimento demonstrativo, menu, FAQ personalizada e transferência para humano.
- Esqueleto do webhook com assinatura HMAC, verificação Meta e filtro de números autorizados.
- Modo de demonstração independente do banco, disponível com `npm run dev:demo`.

**É um ambiente de desenvolvimento, não um MVP de produção.** O WhatsApp ainda não está conectado. Orçamentos atuais são de teste, sem cliente ou receita associados. Agendamento pela conversa, lembretes pelo WhatsApp, pedidos, conversas persistidas e armazenamento de receitas seguem pendentes. Use dados fictícios e credenciais de teste.

## Desenvolvimento com Supabase local

Requer Node.js 22+, npm e Docker em execução (Linux, macOS ou WSL2). No ambiente da nuvem, use o checkout existente; não é necessário criar worktrees.

```bash
git clone https://github.com/NyxPjct/Lumi-Wpp-Bot.git
cd Lumi-Wpp-Bot
npm ci
npm run db:start
npm run dev
```

O helper inicia o Supabase local, aplica migrations pendentes e gera a configuração pública em `apps/painel/.env.local`, ignorado pelo Git. Não utiliza a cota de projetos hospedados. Reinicie ou reconstrua o painel depois de alterar essa configuração.

No painel, abra **Entrar ou criar conta**, cadastre uma conta de teste e configure sua ótica. Salve os dados e teste a FAQ no simulador. Saia e entre novamente para recuperar a configuração. O banco permite uma ótica por conta nesta versão.

Veja o [guia completo do Supabase local](docs/supabase-local.md) para componentes, persistência, proxy, testes, retomada e limitações.

```bash
npm test
npm run typecheck
npm run test:db
npm run build
npm run start --workspace=@lumi/painel
# Com painel e Supabase iniciados:
npm run test:e2e
```

`npm run db:stop` para os serviços preservando os dados locais. Não use reset ou remoção de volumes em uma atualização normal.

## WhatsApp e próximos passos

A própria ótica fará a autorização do WhatsApp comercial dentro da Lumi via Meta Embedded Signup. Ainda precisamos implementar o aplicativo Meta, a troca de credenciais no servidor, o vínculo do número ao tenant, fila durável e envio pela Cloud API. O botão de conexão permanece desativado. Não será necessário que a ótica edite tokens ou variáveis do servidor. Elegibilidade e coexistência com o WhatsApp Business dependem das regras vigentes da Meta.

O webhook separado é iniciado por `npm run dev:api`, com `WA_APP_SECRET`, `WA_VERIFY_TOKEN` e `WA_PHONE_NUMBER_IDS` no processo (veja `.env.example`). O script não carrega `.env` automaticamente. Até existir o adaptador de fila durável, mensagens reais para números autorizados retornam **503**, permitindo nova tentativa da Meta. Não conecte um número real ainda.

O [documento de produto](docs/produto.md) descreve o destino do projeto, não as funcionalidades concluídas. Preços, versões e políticas citadas precisam de validação oficial antes de publicação.

## Orçamentos de lentes

Abra **Tabela de preços**, cadastre as faixas e teste a opção 1 do simulador. Salve o orçamento de teste e acompanhe seu status em **Orçamentos**. O valor final precisa de confirmação humana. Veja [o guia de preços e orçamentos](docs/orcamentos.md) para cálculo, limitações e testes.

## Validação automática

O GitHub Actions está configurado para executar testes de lógica/webhook, checagem de tipos e build demonstrativo em pushes e pull requests. Os testes de banco e navegador são executados separadamente com a stack local, conforme os guias acima.

## Agenda da ótica

Em **Agenda**, crie horários de exame, ajuste ou retirada em horário de Brasília. Reserve usando nomes fictícios e teste cancelamento e remarcação. O banco impede sobreposição de horários e dupla reserva. Esta etapa funciona apenas no painel com Supabase local; não envia lembretes nem agenda pela conversa. Veja o [guia da agenda](docs/agenda.md).

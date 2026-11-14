# Supabase local da Lumi

O ambiente usa o CLI Supabase instalado pelo lockfile npm e containers Docker locais. Não cria projeto hospedado, não utiliza a cota free da conta e não exige token de acesso da sua conta Supabase.

## Iniciar

Com Docker funcionando e Node.js 22+:

```bash
cd /workspace/Lumi-Wpp-Bot
npm ci
npm run db:start
npm run dev
```

`db:start` inicia a stack do projeto `lumi-local`, aplica migrations locais pendentes sem resetar o banco e gera `apps/painel/.env.local` com a URL e a chave pública local. A primeira execução baixa as imagens e pode levar vários minutos. O CLI grava seus arquivos auxiliares em `.local/supabase-home`, dentro do workspace.

O helper não imprime chaves nem grava a chave administrativa. Preserva um `.env.local` preexistente que não tenha sido criado pelo próprio helper. Se houver conflito, revise esse arquivo manualmente; nunca substitua uma conexão existente sem verificar a origem. Os nomes esperados são `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Apenas a chave pública `anon` deve ir para o painel, nunca `service_role` ou uma chave secreta.

Depois de gerar ou alterar essas variáveis, reinicie o servidor de desenvolvimento. Builds de produção precisam ser gerados novamente porque Next.js incorpora variáveis `NEXT_PUBLIC_*` no build.

Para um build local de produção:

```bash
npm run build
npm run start --workspace=@lumi/painel
```

## Usar a Lumi

1. Abra **Entrar ou criar conta** no painel.
2. Cadastre um e-mail de teste e uma senha de teste com pelo menos oito caracteres. Neste ambiente local a confirmação de e-mail está desativada; não há envio de e-mail real.
3. Em **Configurar minha ótica**, preencha nome, endereço e respostas de atendimento.
4. Salve na última etapa. O WhatsApp continua desconectado.
5. Teste a FAQ no simulador; saia e entre novamente para recuperar as configurações do banco.

Esta primeira versão permite uma ótica por conta. Criar a ótica e associar o proprietário é uma única transação SQL. O painel pode editar as informações, mas não oferece exclusão de óticas nem gerenciamento de equipe ainda. Conversas, consentimento demonstrativo e mensagens do simulador continuam sem persistência no banco.

## Componentes e isolamento

- API local em 54321, PostgreSQL em 54322 e caixa de e-mail de teste em 54324.
- Auth, PostgREST e gateway habilitados.
- Studio, Storage, Realtime, Edge Runtime e Analytics desativados porque não são necessários nesta etapa.
- Tabelas `optics`, `optic_memberships`, `lens_prices`, `treatment_prices`, `quotes`, `appointment_slots` e `appointments` protegidas por RLS.
- Preços editados pelo proprietário e orçamentos de teste recalculados no banco, com reenvio idempotente. Veja [orçamentos](orcamentos.md).
- Agenda do painel e do simulador com vagas reais, reservas de teste, cancelamento/remarcação e validação de concorrência. Veja [agenda](agenda.md) e [conversa](agenda-conversa.md).
- Criação de vínculo exclusivamente pela função autenticada `create_optic`, que usa a identidade da sessão. O navegador não escolhe o tenant.
- Usuários anônimos não têm acesso às configurações; proprietários só podem editar as colunas permitidas de sua ótica. Novas políticas serão necessárias quando o gerenciamento de atendentes for implementado.

O código não utiliza chave administrativa para o funcionamento do painel. Os testes de integração usam a chave administrativa **somente da stack local**, em memória, para limpar as contas e óticas que os próprios testes criam. Recusam URLs de banco hospedado.

## Validar

Com a stack iniciada:

```bash
npm test
npm run typecheck
npm run test:db
# Verificação serial de parada/retomada (não rode junto de outros testes):
npm run test:db:restart
```

Com o painel também iniciado em modo Supabase:

```bash
npm run test:e2e
```

O teste de banco exercita cadastro, login, persistência, validação SQL, tentativa de acesso/edição entre contas e proibição de manipular vínculos. Os testes de agenda validam sobreposição, disputa por vagas, remarcação que falha sem perder a reserva, permissões e conversão de fuso. Os testes de navegador exercitam cadastro real, configuração, FAQ, logout/login, senha incorreta, recarga, edição, largura mobile e o fluxo de preços/orçamentos com status persistido.

## Parar e retomar

```bash
npm run db:stop
npm run db:start
```

Os comandos preservam os dados locais do CLI/Docker. Não rode `docker system prune --volumes`, `supabase db reset`, nem remova volumes para uma atualização rotineira. Use `npm run db:migrate` para aplicar migrations locais pendentes e `npm run db:configure` para regenerar somente a configuração pública do painel.

Processos e containers precisam ser iniciados novamente depois de reiniciar o ambiente. Parar e iniciar nesta instância foi testado com uma conta e uma ótica temporárias, que permaneceram recuperáveis. A restauração em outra tarefa ainda precisa ser verificada; os volumes locais não são um backup externo e a stack não é uma hospedagem de produção.

## Docker e proxy neste ambiente

O daemon local foi validado pelo socket `/var/run/docker.sock`. Os health checks do Supabase usam HTTP de loopback dentro dos containers. A configuração do cliente Docker precisa preservar os proxies existentes e incluir `localhost`, `127.0.0.1` e `::1` em `proxies.default.noProxy`; sem isso, o health check pode ir ao proxy externo e receber 403 apesar de a aplicação ter iniciado. Essa exceção foi adicionada ao cliente Docker deste ambiente sem alterar proxy externo ou credenciais. O BusyBox wget da imagem GoTrue ignora essas variáveis; por isso o helper usa `scripts/docker-local.cjs` como adaptador do CLI Docker apenas durante os comandos Supabase. Ele acrescenta `-Y off` exclusivamente ao health check exato `http://127.0.0.1:9999/health`, preservando a verificação HTTP e todas as outras requisições/argumentos. Esse ajuste tem testes próprios e não modifica a imagem nem as dependências instaladas. Containers preexistentes precisam ser recriados pelo CLI para receber o ajuste.

Mantenha a verificação TLS e as configurações de proxy para downloads externos. Não instale outro daemon nem desative os health checks para contornar falhas.

## Modo de demonstração sem banco

O modo anterior continua disponível de forma explícita:

```bash
npm run dev:demo
```

Nesse modo, a configuração fica no `sessionStorage` da aba e não exige login. Para validar o modo demo de produção, pare o painel, gere `NEXT_PUBLIC_LUMI_MODE=demo npm run build`, inicie com a mesma variável e execute `npm run test:e2e:demo`. Depois gere novamente o build normal para voltar ao Supabase. Não execute builds concorrentes no mesmo diretório `.next`.

## Antes de produção

Ainda serão necessários hospedagem, HTTPS, confirmação de e-mail/SMTP real, recuperação de senha, backups externos, revisão de limites e políticas, além da integração oficial da Meta. Os containers e parâmetros de autenticação locais não devem ser publicados como configuração de produção.

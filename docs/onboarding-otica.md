# Configurar uma ótica na Lumi

O fluxo principal agora usa Supabase local: crie ou entre na conta em **Entrar ou criar conta** e depois configure a ótica. A configuração é salva no banco, vinculada à conta autenticada. Veja [Supabase local](supabase-local.md). O WhatsApp continua desconectado.

## Referência do modo demo sem banco

As instruções abaixo descrevem apenas o modo explícito `npm run dev:demo`.

Esta entrega permite testar a personalização do atendimento. Não cria conta, tenant ou conexão com o WhatsApp. Use somente informações fictícias; não informe senhas, tokens, receitas ou dados de clientes.

## Experimentar o fluxo

1. Abra **Configurar minha ótica** no painel.
2. Em **Sua ótica**, informe o nome e endereço de exemplo.
3. Em **Atendimento**, preencha horários, formas de pagamento e prazo dos óculos. As respostas serão usadas literalmente, sem estimativas adicionais.
4. Em **WhatsApp**, conheça o fluxo previsto para autorizar o número da própria ótica. **Conectar meu WhatsApp** permanece desativado nesta versão.
5. Escolha **Salvar e testar demonstração** e depois **Testar atendimento**.
6. Aceite o aviso inicial, escolha **Dúvidas frequentes** e selecione a pergunta. Confira a resposta que você cadastrou; o endereço é a opção 4 da FAQ personalizada.

Você pode voltar às etapas sem perder o preenchimento. Para salvar, todos os campos precisam ter ao menos dois caracteres válidos após remover espaços nas extremidades. O nome permite até 80 caracteres; os demais campos, até 300.

## Onde ficam os dados

A configuração é armazenada no `sessionStorage`, na chave versionada `lumi:demo:settings:v1`. Ela é compartilhada apenas pelas páginas da Lumi nesta aba, sem transmissão para banco ou para a Meta. A conversa e o consentimento demonstrativo ficam somente na memória da página e reiniciam ao recarregar ou sair do simulador.

Para editar, retorne a **Configurar minha ótica** e salve novamente. Para excluir a configuração, use **Apagar configuração desta aba** e confirme a exclusão. Cancelar preserva os dados. Isso não apaga dados de sistemas externos, pois a demonstração não está conectada a eles.

Se o navegador impedir o armazenamento, o painel informa a falha e não apresenta a configuração como salva. Registros corrompidos ou incompatíveis são ignorados com um aviso, permitindo preencher novamente.

## O que falta para o onboarding real

- Supabase Auth, criação transacional da ótica e RLS já são implementados no modo local; hospedagem e requisitos de autenticação de produção seguem pendentes.
- Persistência vinculada à conta autenticada já existe no modo Supabase local.
- Aplicativo Meta configurado para o fluxo oficial Embedded Signup, conforme requisitos vigentes.
- Autorização e troca de credenciais no servidor, validação e vínculo do número ao tenant, armazenamento seguro das credenciais e estados de conexão verificáveis.
- Fila durável/idempotência, envio de mensagens e gestão dos templates e janela de atendimento.

A própria ótica fará a autorização com a conta comercial dela. Ela não deverá editar variáveis de servidor nem enviar tokens manualmente à Lumi. A coexistência com o WhatsApp Business existente depende da elegibilidade do número e das regras vigentes da Meta.

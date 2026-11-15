# Abrir a Lumi no seu Windows

`localhost` e `127.0.0.1` apontam para o computador em que o navegador está aberto. A Lumi executada no ambiente da nuvem não substitui um aplicativo que já esteja na porta 3000 do seu Windows.

## Demonstração com Node.js, sem Docker

Requisito: Node.js 22 ou mais recente e internet para instalar dependências na primeira abertura. Não precisa de Git se usar o ZIP.

1. Baixe o [ZIP atualizado da Lumi](https://github.com/NyxPjct/Lumi-Wpp-Bot/archive/refs/heads/main.zip).
2. Clique com o botão direito no ZIP e use **Extrair tudo**. Extraia para uma pasta própria; não misture com outro projeto.
3. Entre na pasta extraída `Lumi-Wpp-Bot-main`, onde está o `package.json`.
4. Dê dois cliques em **Abrir-Lumi-Demo.cmd**.
5. Aguarde a mensagem **LUMI CONFIRMADA**. O navegador será aberto no endereço confirmado pelo iniciador.

Mantenha a janela do iniciador aberta. Para parar essa instância da Lumi, pressione Ctrl+C nela. Caso o navegador não abra automaticamente, use o endereço mostrado depois de **LUMI CONFIRMADA**, no próprio Windows onde executou o arquivo.

O arquivo `.cmd` verifica Node.js, instala as dependências se necessário e executa `scripts/start-demo.mjs`. O iniciador procura uma porta livre entre 3010 e 3020 e verifica a resposta HTTP identificada como Lumi antes de abrir o navegador. Não encerra outro projeto que esteja usando uma porta.

A configuração e as respostas de demonstração ficam apenas nesta aba do navegador. Você pode testar:

- Configuração da ótica e perguntas frequentes.
- Simulador de conversa e consentimento de demonstração.
- Tabela de preços fictícia e cálculo do orçamento.
- Importação Excel (.xlsx) e CSV em **Tabelas de preços**, com consulta dos produtos e uso no orçamento. Use arquivos fictícios: as tabelas ficam somente nesta aba. Veja [o guia de tabelas](tabelas-de-precos.md).

**Sem Docker, a agenda e os pedidos persistidos continuam indisponíveis.** O modo demo não cria reservas, não consulta pedidos reais e não envia mensagens ao WhatsApp. A conta Supabase também não é necessária para essa demonstração.

## Se aparecer um erro

- Node.js abaixo de 22: atualize para uma versão compatível e abra o arquivo novamente.
- Falha ao instalar dependências: copie a mensagem da janela para diagnóstico. Não é necessário alterar configurações de segurança ou desabilitar verificação TLS.
- Dependências antigas em uma pasta já usada: execute `npm ci` nessa pasta, ou extraia uma cópia nova do ZIP em outra pasta.
- Outra instância da mesma pasta aberta: feche a janela anterior da Lumi antes de abrir novamente. Não rode duas instâncias de desenvolvimento na mesma pasta `.next`.
- Para suporte, informe a mensagem do terminal; não envie senhas nem chaves de configuração.

O mecanismo Node.js foi executado e validado no ambiente Linux da nuvem, com testes do modo demo. O arquivo `.cmd` e a abertura do navegador Windows foram preparados para esse sistema, mas não foram executados no seu computador.

## Testes completos com banco

Agenda, pedidos, login e gravação no banco precisam do Supabase local. O caminho completo documentado do projeto usa Docker em Linux, macOS ou WSL2. Consulte [Supabase local](supabase-local.md). No Windows, instalar Docker Desktop é um pré-requisito adicional; a demonstração acima não instala nem configura Docker automaticamente.

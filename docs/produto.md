# Lumi — Atendente de WhatsApp para Óticas

> Bot de atendimento no WhatsApp feito para óticas: responde na hora, faz orçamento de lentes a partir da receita, agenda exames e ajustes, avisa quando os óculos ficam prontos e passa para um atendente humano quando precisa.

---

## 1. Visão geral

| Item | Definição |
|---|---|
| **Produto** | SaaS multi-ótica (multi-tenant) de atendimento automático no WhatsApp |
| **Cliente** | Óticas pequenas e médias no Brasil |
| **Usuário final** | Clientes da ótica que chamam no WhatsApp |
| **Canal** | WhatsApp Cloud API oficial da Meta (sem bibliotecas não oficiais) |
| **Modelo de negócio** | Taxa de implantação + mensalidade (Básico / Pro); mensagens da Meta repassadas |
| **Integração futura** | Sistema open source de gestão para óticas (bot vira o módulo de atendimento) |

### Onboarding e conexão do WhatsApp

- A própria ótica cria sua conta na Lumi e conecta o WhatsApp comercial dela dentro do aplicativo, durante o onboarding.
- O painel deve oferecer “Conectar meu WhatsApp”, usando o fluxo oficial de cadastro incorporado da Meta (Embedded Signup), sujeito aos requisitos e permissões vigentes da plataforma.
- Após a autorização, o backend deve validar e vincular a conta comercial e o `phone_number_id` ao tenant autenticado, com referência segura às credenciais. A ótica não deve precisar editar variáveis do servidor ou informar tokens manualmente.
- O painel deve mostrar o estado da conexão e permitir iniciar reconexão ou desconexão com autorização da conta da ótica.
- O aplicativo Meta, seu webhook, a troca de credenciais e o roteamento das mensagens continuam sendo responsabilidade da plataforma Lumi. O cadastro incorporado não elimina essa implementação.
- A elegibilidade do número e a possibilidade de uso conjunto com o WhatsApp Business existente precisam ser verificadas com as regras atuais da Meta; não prometer coexistência universal.

O Supabase será configurado em uma etapa posterior, com o proprietário do projeto. A implementação de autenticação, banco, RLS e Storage pode ser preparada no repositório; a conexão real depende do projeto e dos acessos disponibilizados com segurança. O ambiente de desenvolvimento usa Supabase local com Docker, sem criar projeto hospedado nem consumir a cota free. Autenticação e configurações da ótica são a primeira etapa integrada; os demais módulos deste documento seguem como planejamento.

### Problema
Óticas recebem as mesmas perguntas o dia todo (preço de lente, prazo, convênios, horário) e demoram para responder, principalmente em horário de pico e fora do expediente. Cliente que espera vai para a concorrente.

### Solução
Um bot com fluxos específicos de ótica, que resolve o repetitivo em segundos e entrega para o vendedor só o que precisa de humano, já com a receita e as preferências do cliente coletadas.

---

## 2. Funcionalidades

### 2.1 MVP (v1)

- **Boas-vindas + aviso de privacidade** (consentimento LGPD na primeira mensagem)
- **Menu principal**
  1. Orçamento de lentes
  2. Armações
  3. Agendar exame / ajuste
  4. Status do pedido
  5. Dúvidas frequentes
  6. Falar com atendente
- **Orçamento de lentes**
  - Recebe foto/PDF da receita
  - Pergunta tipo de lente: visão simples, multifocal, ocupacional
  - Pergunta tratamentos: antirreflexo, filtro de luz azul, fotossensível
  - Calcula **faixa estimada** a partir da tabela da ótica
  - Cria lead e encaminha ao vendedor para confirmar o valor
- **Agendamento**
  - Lista horários livres da agenda da ótica
  - Confirma e envia lembrete 24h antes (template de utilidade)
  - Permite cancelar/remarcar
- **Status do pedido**
  - Cliente consulta pelo número do pedido ou telefone
  - Ótica marca "pronto" no painel → bot avisa o cliente (template de utilidade)
- **FAQ**: endereço, horário, pagamento, convênios, garantia, prazo médio
- **Transbordo humano**: palavra-chave, botão ou fluxo fora do roteiro → conversa vai para a fila do painel e o bot pausa
- **Painel web da ótica**
  - Caixa de conversas (assumir / devolver ao bot)
  - Editar tabela de preços, FAQ, horários e agenda
  - Lista de pedidos e botão "pronto para retirar"
  - Leads de orçamento

### 2.2 v2

- IA para entender texto livre, **restrita aos assuntos da ótica** (classificação de intenção + respostas baseadas no conteúdo cadastrado)
- Catálogo de armações com fotos e faixa de preço
- Lembrete anual de revisão da vista
- Campanhas de marketing **somente com opt-in**
- Métricas: conversas, tempo de resposta, orçamentos, agendamentos, conversão
- Integração com o sistema open source para óticas (clientes, pedidos, estoque)

### 2.3 Fora de escopo (regras fixas)

- O bot **não interpreta receita** nem dá orientação de saúde; só registra e encaminha
- Nada de assistente de IA de uso geral (proibido pela política da API do WhatsApp desde 15/01/2026)
- Nada de disparo em massa sem opt-in

---

## 3. Arquitetura

```
Cliente (WhatsApp)
      │
      ▼
Meta WhatsApp Cloud API ──webhook──▶ API (Node/TS)
                                      │  ├─ verifica assinatura X-Hub-Signature-256
                                      │  ├─ identifica tenant pelo phone_number_id
                                      │  ├─ enfileira mensagem
                                      ▼
                                   Worker de fluxos
                                      │  ├─ máquina de estados por conversa
                                      │  ├─ (v2) classificador de intenção com IA
                                      │  └─ envia resposta pela Cloud API
                                      ▼
                                   Postgres (Supabase) + Storage (receitas)
                                      ▲
                                      │
                               Painel web da ótica (Next.js)
```

### Stack sugerida

| Camada | Tecnologia |
|---|---|
| API / webhook | Node.js + TypeScript (Fastify ou Hono) |
| Fila | pg-boss (Postgres) ou BullMQ (Redis) |
| Banco | Postgres (Supabase) com Row Level Security por tenant |
| Arquivos | Supabase Storage (bucket privado, criptografado) |
| Painel | Next.js + Tailwind |
| Auth do painel | Supabase Auth |
| IA (v2) | API de LLM só para classificação/FAQ |
| Hospedagem | Railway, Fly.io ou Cloudflare Workers |
| Protótipo rápido (opcional) | n8n + Cloud API para validar o 1º piloto |

---

## 4. Modelo de dados

```sql
-- Cada ótica é um tenant
tenants (
  id uuid pk,
  nome text,
  cnpj text,
  wa_phone_number_id text unique,   -- id do número na Cloud API
  wa_token_ref text,                -- referência ao segredo, nunca o token em texto
  plano text check (plano in ('basico','pro')),
  ativo boolean default true,
  criado_em timestamptz default now()
)

usuarios_painel (
  id uuid pk,
  tenant_id uuid fk -> tenants,
  nome text,
  email text,
  papel text check (papel in ('dono','atendente'))
)

contatos (
  id uuid pk,
  tenant_id uuid fk,
  telefone text,
  nome text,
  consentiu_lgpd_em timestamptz,
  opt_in_marketing boolean default false,
  unique (tenant_id, telefone)
)

conversas (
  id uuid pk,
  tenant_id uuid fk,
  contato_id uuid fk,
  estado text,                -- estado atual da máquina de fluxos
  contexto jsonb,             -- respostas coletadas no fluxo
  modo text check (modo in ('bot','humano')),
  atendente_id uuid null,
  janela_expira_em timestamptz,  -- janela de 24h da Meta
  atualizado_em timestamptz
)

mensagens (
  id uuid pk,
  tenant_id uuid fk,
  conversa_id uuid fk,
  direcao text check (direcao in ('in','out')),
  tipo text,                  -- text, image, document, interactive, template
  conteudo jsonb,
  wa_message_id text,
  criado_em timestamptz
)

receitas (
  id uuid pk,
  tenant_id uuid fk,
  contato_id uuid fk,
  arquivo_path text,          -- caminho no storage privado
  expira_em timestamptz,      -- exclusão automática (LGPD)
  criado_em timestamptz
)

tabela_precos (
  id uuid pk,
  tenant_id uuid fk,
  tipo_lente text,            -- visao_simples, multifocal, ocupacional
  tratamento text,            -- antirreflexo, filtro_azul, fotossensivel, nenhum
  preco_min numeric,
  preco_max numeric
)

orcamentos (
  id uuid pk,
  tenant_id uuid fk,
  contato_id uuid fk,
  receita_id uuid fk null,
  tipo_lente text,
  tratamentos text[],
  faixa_min numeric,
  faixa_max numeric,
  status text check (status in ('novo','em_atendimento','fechado','perdido'))
)

agenda_slots (
  id uuid pk,
  tenant_id uuid fk,
  inicio timestamptz,
  fim timestamptz,
  tipo text check (tipo in ('exame','ajuste','retirada')),
  contato_id uuid null,
  status text check (status in ('livre','reservado','cancelado'))
)

pedidos (
  id uuid pk,
  tenant_id uuid fk,
  contato_id uuid fk,
  codigo text,
  status text check (status in ('em_producao','pronto','retirado')),
  avisado_em timestamptz null
)

faq (
  id uuid pk,
  tenant_id uuid fk,
  pergunta text,
  resposta text,
  ordem int
)
```

Toda tabela tem `tenant_id` e política de **Row Level Security**: um usuário do painel só enxerga os dados da própria ótica.

---

## 5. Fluxos (máquina de estados)

```
INICIO
  └─ sem consentimento? → PRIVACIDADE → (aceita) → MENU
                                       → (recusa) → encerra com contato humano

MENU
  ├─ 1 → ORC_RECEITA → ORC_TIPO → ORC_TRATAMENTOS → ORC_RESULTADO → HUMANO
  ├─ 2 → ARMACOES (v1: link/fotos; v2: catálogo) → MENU | HUMANO
  ├─ 3 → AGENDA_TIPO → AGENDA_DIA → AGENDA_HORARIO → AGENDA_CONFIRMA → MENU
  ├─ 4 → PEDIDO_BUSCA → PEDIDO_STATUS → MENU
  ├─ 5 → FAQ_LISTA → FAQ_RESPOSTA → MENU
  └─ 6 → HUMANO

HUMANO
  └─ bot pausado até o atendente devolver no painel ou 12h sem resposta
```

Regras gerais:
- Palavras "atendente", "humano", "pessoa" em qualquer estado → `HUMANO`
- 3 respostas inválidas seguidas → `HUMANO`
- Usar mensagens interativas (botões/listas) sempre que possível
- Fora da janela de 24h, só enviar **templates aprovados** pela Meta

### Templates necessários (aprovar na Meta)

| Nome | Categoria | Uso |
|---|---|---|
| `lembrete_agendamento` | Utilidade | 24h antes do exame/ajuste |
| `oculos_prontos` | Utilidade | Pedido marcado como pronto |
| `retorno_orcamento` | Utilidade | Vendedor retoma orçamento fora da janela |
| `revisao_anual` (v2) | Marketing | Lembrete anual, só com opt-in |

---

## 6. Segurança e LGPD

Foto de receita é **dado de saúde**, que a LGPD trata como dado pessoal sensível.

- [ ] Aviso de privacidade + consentimento registrado (`consentiu_lgpd_em`)
- [ ] Ótica = controladora, plataforma = operadora (em contrato)
- [ ] Receitas em bucket privado, URLs assinadas de curta duração, exclusão automática em `expira_em`
- [ ] Tokens da Meta em gerenciador de segredos; nunca no banco em texto puro
- [ ] Verificação da assinatura `X-Hub-Signature-256` em todo webhook
- [ ] RLS por tenant em todas as tabelas; testes automatizados de isolamento
- [ ] Logs sem conteúdo de mensagens nem dados sensíveis
- [ ] Rate limit no webhook e no painel
- [ ] Backups diários + plano de resposta a incidentes
- [ ] Direito do titular: exportar e apagar dados de um contato pelo painel

---

## 7. Variáveis de ambiente

```env
# Meta
WA_VERIFY_TOKEN=          # token de verificação do webhook
WA_APP_SECRET=            # para validar X-Hub-Signature-256
WA_API_VERSION=v21.0

# Banco
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Storage
RECEITAS_BUCKET=receitas
RECEITAS_RETENCAO_DIAS=90

# IA (v2)
LLM_API_KEY=
LLM_MODEL=

# App
PAINEL_URL=
NODE_ENV=production
```

Tokens de cada número ficam em segredos por tenant (`wa_token_ref`), não em variável global.

---

## 8. Estrutura de pastas

```
lumi/
├─ apps/
│  ├─ api/            # webhook, envio de mensagens, jobs
│  │  ├─ src/
│  │  │  ├─ webhook/
│  │  │  ├─ flows/    # um arquivo por fluxo (orcamento, agenda, pedido, faq)
│  │  │  ├─ whatsapp/ # cliente da Cloud API + templates
│  │  │  ├─ jobs/     # lembretes, exclusão de receitas
│  │  │  └─ security/ # assinatura, rate limit
│  │  └─ tests/
│  └─ painel/         # Next.js
├─ packages/
│  ├─ db/             # migrations SQL + tipos gerados
│  └─ shared/         # tipos e utilitários
├─ docs/
│  ├─ privacidade.md
│  └─ onboarding-otica.md
└─ README.md
```

---

## 9. Roadmap

| Semana | Entrega |
|---|---|
| 1 | Entrevistar 5 óticas, fechar fluxos e textos |
| 2–3 | MVP: webhook, fluxos, painel básico, número de teste |
| 4 | Demo em vídeo, teste de cliente oculto, primeiras abordagens |
| 5–6 | 1–2 pilotos, ajustes, primeiro contrato pago |
| Depois | v2 (IA, catálogo, métricas) + site do produto |

### Critérios de pronto do MVP

- [ ] Ótica conecta o número e configura preços/FAQ/agenda sozinha pelo painel
- [ ] Cliente faz orçamento completo enviando a receita
- [ ] Agendamento com lembrete automático funcionando
- [ ] Aviso de "óculos prontos" disparado pelo painel
- [ ] Transbordo para humano e devolução ao bot
- [ ] Isolamento entre óticas testado
- [ ] Receitas apagadas automaticamente após o prazo

---

## 10. Planos e preços (referência)

| Plano | Inclui | Preço sugerido |
|---|---|---|
| Implantação | Número, fluxos, tabela, treinamento | R$ 500 – 1.500 (uma vez) |
| Básico | Menu, FAQ, orçamento, agendamento, pedido pronto | R$ 149 – 199/mês |
| Pro | Básico + IA, lembrete anual, campanhas, métricas | R$ 299 – 399/mês |

Custos da Meta (Brasil, desde 01/10/2026): serviço com 1.000 grátis/mês por número e depois R$ 0,035; utilidade R$ 0,035; marketing R$ 0,3217. Conferir a tabela oficial antes de fechar preço.

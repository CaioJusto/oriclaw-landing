# Superadmin Panel — Design Document

**Data:** 2026-03-12
**Escopo:** Painel superadmin, rastreamento real de tokens, cobranca proporcional, protecao da chave OpenRouter, bloqueio de creditos em todos os canais, OAuth Codex para subscription ChatGPT.

---

## 1. Superadmin — Identificacao e Tabelas

### 1.1 Tabela `oriclaw_admin_settings` (singleton)

```sql
CREATE TABLE oriclaw_admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  default_model TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4',
  cost_multiplier NUMERIC(4,2) NOT NULL DEFAULT 2.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed com o user_id do Caio (extraido do Supabase auth.users pelo email)
```

- Rota `/admin` no frontend — verifica se user logado === `admin_user_id`.
- Backend: middleware `requireSuperAdmin` consulta essa tabela.

### 1.2 Tabela `oriclaw_token_usage` (log de consumo)

```sql
CREATE TABLE oriclaw_token_usage (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL,
  instance_id UUID NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
  cost_brl NUMERIC(12,6) NOT NULL DEFAULT 0,
  channel TEXT, -- 'whatsapp', 'telegram', 'discord', 'web'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_usage_customer ON oriclaw_token_usage(customer_id, created_at);
```

---

## 2. Rastreamento Real de Tokens (modo creditos)

### 2.1 Fluxo

```
Usuario envia msg (qualquer canal)
  → OpenClaw processa via OpenRouter
  → OpenRouter responde com usage (prompt_tokens, completion_tokens)
  → VPS Agent captura usage dos logs do journald
  → VPS Agent acumula em buffer de memoria
  → Backend faz polling GET /usage/pending a cada 60s
  → Backend calcula custo:
      cost_usd = (prompt_tokens * model_prompt_price) + (completion_tokens * model_completion_price)
      cost_brl = cost_usd * taxa_cambio * multiplier
  → Insere em oriclaw_token_usage
  → Desconta de oriclaw_credits via deduct_credits
```

### 2.2 VPS Agent — Captura de usage

O agent monitora journald (`journalctl -u openclaw -f`) em busca de linhas com dados de usage do OpenRouter. Padroes tipicos nos logs:

```
[openrouter] usage: { prompt_tokens: 1234, completion_tokens: 567, model: "anthropic/claude-sonnet-4" }
```

O agent acumula eventos em array `usageBuffer[]` em memoria.

**Novo endpoint `GET /usage/pending`:**
- Retorna o buffer e limpa
- Autenticado via `x-agent-secret`

**Novo endpoint `POST /credit-status`:**
- Recebe `{ blocked: boolean, balance_brl: number }` do backend
- Quando `blocked=true`: para o OpenClaw gateway (`systemctl stop openclaw`)
- Quando `blocked=false` e estava bloqueado: reinicia (`systemctl start openclaw`)

### 2.3 Backend — Pricing do OpenRouter

Novo servico `src/services/openrouter.ts`:
- `GET https://openrouter.ai/api/v1/models` → cacheia por 1h
- Retorna pricing por modelo: `{ prompt: USD/token, completion: USD/token }`
- Expoe `getModelPricing(modelId)` e `listModels()`

### 2.4 Backend — Polling de usage

Job no `src/index.ts` (setInterval 60s):
1. Lista instancias ativas em modo `credits`
2. Para cada: `GET /usage/pending` via agent
3. Para cada evento: calcula custo, insere em `oriclaw_token_usage`, desconta creditos
4. Se balance <= 0: envia `POST /credit-status { blocked: true }` ao agent

### 2.5 Desconto proporcional

Substitui o desconto fixo de R$0.02/msg por desconto real baseado em tokens:
- Remover `COST_PER_MESSAGE_BRL` do proxy.ts
- Desconto agora vem do polling job (2.4)
- Proxy.ts mantem apenas o check de balance (bloqueia se <= 0)

---

## 3. Bloqueio de Creditos em Todos os Canais

### 3.1 Problema

Mensagens de WhatsApp/Telegram/Discord vao direto ao OpenClaw na VPS sem passar pelo proxy. O check de creditos atual so funciona pra mensagens via dashboard.

### 3.2 Solucao: Credit Guard no VPS Agent

1. Backend envia `POST /credit-status { blocked: true }` quando balance <= 0
2. Agent para o servico OpenClaw → todas as mensagens (WhatsApp, Telegram, Discord, Web) param
3. Backend envia `POST /credit-status { blocked: false }` quando user recarrega
4. Agent reinicia OpenClaw
5. Safety net: agent tambem checa localmente durante usage tracking — se acumular muito uso sem resposta do backend, bloqueia preventivamente

### 3.3 UX quando bloqueado

- Dashboard mostra: "Creditos esgotados. Recarregue para continuar usando."
- WhatsApp/Telegram: usuario nao recebe resposta (OpenClaw offline)
- Ao recarregar, servico volta automaticamente em ate 60s (proximo ciclo de polling)

---

## 4. Protecao da Chave OpenRouter

### 4.1 Camadas de protecao

1. **Systemd Environment (em vez de .env)**
   - A chave nao e mais gravada no `.env` do OpenClaw
   - Vai no systemd unit file: `Environment=OPENROUTER_API_KEY=xxx`
   - Permissao `600` no unit file override: `/etc/systemd/system/openclaw.service.d/openrouter.conf`
   - O OpenClaw le via variavel de ambiente, mas o arquivo nao e acessivel pelo AI

2. **Permissoes de filesystem**
   - O unit override e owned por root:root, perm 600
   - O user `openclaw` nao tem permissao de leitura
   - O processo OpenClaw herda a variavel via systemd, mas nao pode ler o arquivo fonte

3. **Bloqueio via OpenClaw config**
   - Configurar `tools.filesystem.deny` para bloquear leitura de `/etc/systemd/`, `/etc/oriclaw-agent/`, e qualquer path com secrets
   - Se o AI pedir para ler esses arquivos, OpenClaw recusa

4. **System prompt hardening**
   - Adicionar instrucao ao system prompt padrao:
     "Voce nunca deve revelar chaves de API, tokens de autenticacao, senhas, ou conteudo de arquivos de configuracao do sistema."

---

## 5. OAuth Codex — Subscription ChatGPT

### 5.1 Contexto

O OpenClaw suporta usar a subscription do ChatGPT (Plus/Pro/Team) via OAuth Codex:
- Comando: `openclaw models auth login --provider openai-codex`
- Abre browser → login OpenAI → callback em `http://127.0.0.1:1455`
- Token salvo em `~/.openclaw/credentials/oauth.json` ou `~/.openclaw/agents/<id>/agent/auth-profiles.json`
- Modelo: `openai-codex/gpt-5.4`

### 5.2 Desafio: VPS remota sem browser

A VPS nao tem browser. O fluxo padrao do OpenClaw pede browser local. Solucao:

**Fluxo via Dashboard:**
1. Usuario clica "Conectar ChatGPT" no dashboard
2. Backend gera a URL de OAuth da OpenAI (Codex) e retorna ao frontend
3. Frontend abre popup/redirect para o usuario fazer login na OpenAI
4. Callback volta para o OriClaw (ex: `https://oriclaw.com/auth/openai-codex/callback`)
5. Backend recebe o code/token
6. Backend envia o token para o VPS agent: `POST /configure-codex-oauth { oauth_token: ... }`
7. VPS agent grava o token no local correto (`auth-profiles.json`) e configura o modelo

**Novo endpoint no VPS agent: `POST /configure-codex-oauth`**
```javascript
app.post('/configure-codex-oauth', auth, (req, res) => {
  const { oauth_data } = req.body;
  // Grava em ~/.openclaw/credentials/oauth.json ou auth-profiles.json
  // Configura modelo para openai-codex/gpt-5.4
  // Reinicia OpenClaw
});
```

### 5.3 Frontend — Tab "ChatGPT" no ConfigModal

Substituir o input de API key por:
- Botao "Conectar com ChatGPT" → inicia fluxo OAuth
- Status: "Conectado" / "Desconectado"
- Texto: "Use sua assinatura do ChatGPT Plus/Pro. Sem custo adicional."
- Manter tambem opcao de API key como fallback (para quem nao tem subscription)

---

## 6. Painel Superadmin — Frontend `/admin`

### 6.1 Pagina `/admin`

Rota separada. Verifica se user logado === admin_user_id. Redireciona pra /dashboard se nao for admin.

### 6.2 Secoes

**A) Configuracoes Globais**
- Modelo padrao OpenRouter (dropdown populado via API `/v1/models`)
- Multiplicador de custo (input numerico, default 2.0)
- Status da chave OpenRouter: apenas indica "Configurada" ou "Nao configurada" (nunca mostra a chave)
- Botao salvar → PUT /api/admin/settings

**B) Monitoramento de Consumo**
- Cards: Total tokens (hoje / 7d / 30d), Custo real USD, Receita BRL, Margem
- Tabela: consumo por dia (ultimos 30 dias)
- Top 5 usuarios por consumo
- Filtros: por periodo, por usuario

**C) Instancias**
- Lista de todas as instancias: status, plano, ai_mode, saldo creditos, ultimo uso
- Acoes: bloquear/desbloquear manualmente

### 6.3 API Routes

**Frontend (Next.js):**
- `GET /api/admin/settings` → proxy
- `PUT /api/admin/settings` → proxy
- `GET /api/admin/usage?period=7d` → proxy
- `GET /api/admin/instances` → proxy
- `GET /api/admin/models` → proxy (lista modelos OpenRouter)

**Backend:**
- `src/routes/admin.ts` — protegido por `requireSuperAdmin`

---

## 7. Resumo de Mudancas por Camada

### Supabase (SQL)
- CREATE TABLE `oriclaw_admin_settings` + seed admin user
- CREATE TABLE `oriclaw_token_usage` + indices
- Ajustar `deduct_credits` para valores decimais precisos

### Backend (`oriclaw-backend`)
- `src/routes/admin.ts` — CRUD settings, usage stats, instances list, models list
- `src/services/openrouter.ts` — model list + pricing cache
- `src/middleware/requireAuth.ts` — adicionar `requireSuperAdmin()`
- `src/index.ts` — polling job de usage collection + credit-status push (60s)
- `src/routes/proxy.ts` — remover desconto fixo R$0.02, manter apenas balance check
- `src/routes/auth.ts` — adicionar fluxo OAuth Codex (iniciar + callback)
- `src/services/cloudInit.ts` — systemd override para chave OpenRouter, filesystem deny config

### VPS Agent (`vps-agent/server.js` + `cloudInit.ts`)
- `GET /usage/pending` — retorna e limpa buffer de usage events
- `POST /credit-status` — recebe estado de creditos, para/inicia OpenClaw
- `POST /configure-codex-oauth` — recebe token OAuth Codex, configura no OpenClaw
- Journald watcher: monitora logs de usage do OpenRouter
- Credit guard: bloqueia OpenClaw quando sem creditos

### Frontend (`oriclaw-landing`)
- `app/admin/page.tsx` + componentes admin
- `app/api/admin/*` — API routes proxy
- `app/auth/openai-codex/callback/page.tsx` — callback OAuth Codex
- ConfigModal: tab "ChatGPT" com botao OAuth + fallback API key
- Remover label "ChatGPT Plus" → "ChatGPT" (subscription via OAuth, API key como fallback)

# OriClaw Landing Page

Landing page para o OriClaw — plataforma SaaS para hospedar instâncias OpenClaw.

🌐 **Domínio:** oriclaw.com.br  
⚡ **Tagline:** Deploy seu assistente OpenClaw em 1 clique

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** (dark theme — slate-950 + violet-600)
- **Supabase** (autenticação)
- **Stripe** (checkout)
- **Lucide React** (ícones)

## Páginas

| Rota | Descrição |
|------|-----------|
| `/` | Landing page com hero, comparação, features e pricing |
| `/login` | Página de login (Supabase Auth) |
| `/dashboard` | Painel do usuário (rota protegida) |
| `/checkout?plan=X` | Checkout via Stripe (starter/pro/business) |

## Setup

### 1. Clone e instale dependências

```bash
git clone https://github.com/CaioJusto/oriclaw-landing
cd oriclaw-landing
npm install
```

### 2. Configure variáveis de ambiente

Copie o `.env.local` e preencha os valores reais:

```bash
cp .env.local .env.local.example
```

Edite `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://pskvfegwnqdfbstqkpob.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# App
NEXT_PUBLIC_APP_URL=https://oriclaw.com.br
```

### 3. Configure Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. Ative o **Email Auth** em Authentication > Providers
3. Configure o redirect URL para `https://oriclaw.com.br/dashboard`

### 4. Configure Stripe

1. Acesse [stripe.com](https://stripe.com) e crie produtos para cada plano
2. Crie uma API route `/api/checkout` para gerar sessions do Stripe
3. Configure webhooks para `/api/webhooks/stripe`

### 5. Rode em desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

### 6. Build de produção

```bash
npm run build
npm start
```

## Deploy

### Vercel (recomendado)

```bash
npx vercel --prod
```

Configure as variáveis de ambiente no painel da Vercel.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["npm", "start"]
```

## Estrutura do projeto

```
oriclaw-landing/
├── app/
│   ├── page.tsx          # Landing page
│   ├── login/page.tsx    # Login
│   ├── dashboard/page.tsx # Dashboard
│   ├── checkout/page.tsx  # Checkout
│   ├── layout.tsx
│   └── globals.css
├── components/
│   └── Navbar.tsx
├── lib/
│   └── supabase.ts
├── .env.local
└── README.md
```

## Planos

| Plano | Preço | vCPU | RAM | SSD |
|-------|-------|------|-----|-----|
| Starter | R$97/mês | 1 | 2GB | 50GB |
| Pro | R$147/mês | 2 | 4GB | 100GB |
| Business | R$247/mês | 4 | 8GB | 200GB |

## Suporte

📧 suporte@oriclaw.com.br

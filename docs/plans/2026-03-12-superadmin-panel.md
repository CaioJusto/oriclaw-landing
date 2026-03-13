# Superadmin Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a superadmin panel with real token tracking, proportional credit deduction, credit blocking across all channels, OpenRouter key protection, and ChatGPT subscription OAuth via OpenClaw Codex.

**Architecture:** New Supabase tables for admin settings and token usage. Backend gets admin routes, OpenRouter pricing service, and a polling job for usage collection. VPS agent gets usage tracking from journald, credit guard, and Codex OAuth support. Frontend gets `/admin` page and updated ConfigModal with OAuth flow.

**Tech Stack:** TypeScript, Express, Next.js 14, Supabase (PostgreSQL), OpenRouter API, OpenClaw Codex OAuth

---

### Task 1: Supabase — Create Tables and Functions

**Files:**
- Create: `supabase/migrations/001_admin_settings.sql` (run manually via Supabase SQL editor)

**Step 1: Run SQL in Supabase SQL Editor**

```sql
-- Admin settings singleton
CREATE TABLE IF NOT EXISTS oriclaw_admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  default_model TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4',
  cost_multiplier NUMERIC(4,2) NOT NULL DEFAULT 2.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Token usage log
CREATE TABLE IF NOT EXISTS oriclaw_token_usage (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL,
  instance_id UUID NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
  cost_brl NUMERIC(12,6) NOT NULL DEFAULT 0,
  channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_customer ON oriclaw_token_usage(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_instance ON oriclaw_token_usage(instance_id, created_at);

-- Seed admin user (replace UUID with actual user_id from auth.users)
-- First find the user_id:
-- SELECT id FROM auth.users WHERE email = 'caio@email.com' LIMIT 1;
-- Then insert:
-- INSERT INTO oriclaw_admin_settings (admin_user_id) VALUES ('THE_UUID_HERE');
```

**Step 2: Find Caio's user_id and seed admin**

Run in Supabase SQL Editor:
```sql
SELECT id, email FROM auth.users ORDER BY created_at LIMIT 10;
```
Then insert with the correct UUID.

**Step 3: Commit migration file**

```bash
git add supabase/
git commit -m "feat: add admin_settings and token_usage tables"
```

---

### Task 2: Backend — OpenRouter Pricing Service

**Files:**
- Create: `src/services/openrouter.ts`

**Step 1: Create the service**

```typescript
// src/services/openrouter.ts
import axios from 'axios';

interface ModelPricing {
  id: string;
  name: string;
  pricing: {
    prompt: number;   // USD per token
    completion: number; // USD per token
  };
}

let modelsCache: ModelPricing[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchModels(): Promise<ModelPricing[]> {
  if (modelsCache.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return modelsCache;
  }

  try {
    const { data } = await axios.get('https://openrouter.ai/api/v1/models', {
      timeout: 10_000,
    });

    modelsCache = (data.data ?? []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      name: (m.name as string) ?? m.id,
      pricing: {
        prompt: parseFloat(String((m.pricing as Record<string, unknown>)?.prompt ?? '0')),
        completion: parseFloat(String((m.pricing as Record<string, unknown>)?.completion ?? '0')),
      },
    }));
    cacheTimestamp = Date.now();
    console.log(`[openrouter] Cached ${modelsCache.length} models`);
  } catch (err) {
    console.error('[openrouter] Failed to fetch models:', err instanceof Error ? err.message : err);
    // Return stale cache if available
  }

  return modelsCache;
}

export async function getModelPricing(modelId: string): Promise<{ prompt: number; completion: number } | null> {
  const models = await fetchModels();
  const model = models.find(m => m.id === modelId);
  return model?.pricing ?? null;
}

export async function getAdminSettings() {
  // Lazy import to avoid circular dependency
  const { supabase } = await import('./supabase');
  const { data } = await supabase
    .from('oriclaw_admin_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  return data as { admin_user_id: string; default_model: string; cost_multiplier: number; updated_at: string } | null;
}
```

**Step 2: Commit**

```bash
git add src/services/openrouter.ts
git commit -m "feat: add OpenRouter pricing service with model cache"
```

---

### Task 3: Backend — Admin Middleware

**Files:**
- Modify: `src/middleware/requireAuth.ts`

**Step 1: Add requireSuperAdmin function**

Add to the end of `src/middleware/requireAuth.ts`:

```typescript
import { supabase as supabaseClient } from '../services/supabase';

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const { data: settings } = await supabaseClient
    .from('oriclaw_admin_settings')
    .select('admin_user_id')
    .limit(1)
    .maybeSingle();

  if (!settings || (settings as { admin_user_id: string }).admin_user_id !== user.id) {
    res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    return;
  }

  req.user = { id: user.id, email: user.email ?? undefined };
  next();
}
```

**Step 2: Commit**

```bash
git add src/middleware/requireAuth.ts
git commit -m "feat: add requireSuperAdmin middleware"
```

---

### Task 4: Backend — Admin Routes

**Files:**
- Create: `src/routes/admin.ts`
- Modify: `src/index.ts` (register route)

**Step 1: Create admin routes**

```typescript
// src/routes/admin.ts
import { Router, Request, Response } from 'express';
import { requireSuperAdmin } from '../middleware/requireAuth';
import { supabase } from '../services/supabase';
import { fetchModels } from '../services/openrouter';

const router = Router();

// All routes require superadmin
router.use(requireSuperAdmin);

// GET /api/admin/settings
router.get('/settings', async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('oriclaw_admin_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) { res.status(500).json({ error: error.message }); return; }

  const settings = data as Record<string, unknown> | null;
  res.json({
    default_model: settings?.default_model ?? 'anthropic/claude-sonnet-4',
    cost_multiplier: settings?.cost_multiplier ?? 2.0,
    openrouter_key_configured: !!process.env.ORICLAW_OPENROUTER_KEY,
    updated_at: settings?.updated_at,
  });
});

// PUT /api/admin/settings
router.put('/settings', async (req: Request, res: Response): Promise<void> => {
  const { default_model, cost_multiplier } = req.body as {
    default_model?: string;
    cost_multiplier?: number;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (default_model) updates.default_model = default_model;
  if (cost_multiplier !== undefined) {
    if (cost_multiplier < 1 || cost_multiplier > 10) {
      res.status(400).json({ error: 'Multiplicador deve estar entre 1.0 e 10.0' });
      return;
    }
    updates.cost_multiplier = cost_multiplier;
  }

  const { data: existing } = await supabase
    .from('oriclaw_admin_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!existing) {
    res.status(404).json({ error: 'Admin settings not found' });
    return;
  }

  const { error } = await supabase
    .from('oriclaw_admin_settings')
    .update(updates)
    .eq('id', (existing as { id: string }).id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

// GET /api/admin/models — list OpenRouter models with pricing
router.get('/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    const models = await fetchModels();
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch models' });
  }
});

// GET /api/admin/usage?period=7d
router.get('/usage', async (req: Request, res: Response): Promise<void> => {
  const period = (req.query.period as string) ?? '7d';
  const days = period === '30d' ? 30 : period === '1d' ? 1 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('oriclaw_token_usage')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const rows = (data ?? []) as Array<{
    customer_id: string; model: string;
    prompt_tokens: number; completion_tokens: number; total_tokens: number;
    cost_usd: number; cost_brl: number; created_at: string;
  }>;

  const totals = {
    total_tokens: rows.reduce((s, r) => s + r.total_tokens, 0),
    cost_usd: rows.reduce((s, r) => s + Number(r.cost_usd), 0),
    cost_brl: rows.reduce((s, r) => s + Number(r.cost_brl), 0),
    messages: rows.length,
  };

  // Group by day
  const byDay: Record<string, { tokens: number; cost_usd: number; cost_brl: number; messages: number }> = {};
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { tokens: 0, cost_usd: 0, cost_brl: 0, messages: 0 };
    byDay[day].tokens += r.total_tokens;
    byDay[day].cost_usd += Number(r.cost_usd);
    byDay[day].cost_brl += Number(r.cost_brl);
    byDay[day].messages++;
  }

  // Top users
  const byUser: Record<string, { tokens: number; cost_brl: number; messages: number }> = {};
  for (const r of rows) {
    if (!byUser[r.customer_id]) byUser[r.customer_id] = { tokens: 0, cost_brl: 0, messages: 0 };
    byUser[r.customer_id].tokens += r.total_tokens;
    byUser[r.customer_id].cost_brl += Number(r.cost_brl);
    byUser[r.customer_id].messages++;
  }
  const topUsers = Object.entries(byUser)
    .sort(([, a], [, b]) => b.cost_brl - a.cost_brl)
    .slice(0, 10)
    .map(([customer_id, stats]) => ({ customer_id, ...stats }));

  res.json({ totals, byDay, topUsers, period: `${days}d` });
});

// GET /api/admin/instances — list all instances with credit balances
router.get('/instances', async (_req: Request, res: Response): Promise<void> => {
  const { data: instances, error } = await supabase
    .from('oriclaw_instances')
    .select('id, customer_id, email, plan, status, droplet_ip, created_at, metadata')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Fetch credit balances
  const { data: credits } = await supabase
    .from('oriclaw_credits')
    .select('customer_id, balance_brl');

  const creditMap: Record<string, number> = {};
  for (const c of (credits ?? []) as Array<{ customer_id: string; balance_brl: number }>) {
    creditMap[c.customer_id] = c.balance_brl;
  }

  const result = ((instances ?? []) as Array<Record<string, unknown>>).map(inst => ({
    id: inst.id,
    email: inst.email,
    plan: inst.plan,
    status: inst.status,
    ai_mode: (inst.metadata as Record<string, unknown>)?.ai_mode ?? 'byok',
    balance_brl: creditMap[inst.customer_id as string] ?? 0,
    droplet_ip: inst.droplet_ip,
    created_at: inst.created_at,
  }));

  res.json({ instances: result });
});

export default router;
```

**Step 2: Register route in index.ts**

Add to `src/index.ts` after line 13:
```typescript
import adminRoutes from './routes/admin';
```

Add after line 136 (`app.use('/api/billing', billingRoutes);`):
```typescript
app.use('/api/admin', adminRoutes);
```

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/routes/admin.ts src/index.ts
git commit -m "feat: add admin routes for settings, usage, instances, models"
```

---

### Task 5: VPS Agent — Usage Tracking from Journald

**Files:**
- Modify: `vps-agent/server.js`
- Modify: `src/services/cloudInit.ts` (sync)

**Step 1: Add journald watcher and usage buffer to server.js**

Add after the existing variable declarations (around line 25):

```javascript
// ── Usage tracking ─────────────────────────────────────────────────────────
const usageBuffer = [];
let creditBlocked = false;

// Monitor journald for OpenRouter usage data
const { spawn } = require('child_process');
function startUsageWatcher() {
  const journal = spawn('journalctl', ['-u', 'openclaw', '-f', '-o', 'cat', '--no-pager'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  let partial = '';
  journal.stdout.on('data', (chunk) => {
    partial += chunk.toString();
    const lines = partial.split('\n');
    partial = lines.pop() || '';

    for (const line of lines) {
      // Look for OpenRouter usage patterns in logs
      // Pattern: {"usage":{"prompt_tokens":N,"completion_tokens":N},"model":"..."}
      try {
        const usageMatch = line.match(/"usage"\s*:\s*\{[^}]+\}/);
        const modelMatch = line.match(/"model"\s*:\s*"([^"]+)"/);
        if (usageMatch) {
          const usageStr = '{' + usageMatch[0] + '}';
          const parsed = JSON.parse(usageStr);
          const usage = parsed.usage;
          if (usage && typeof usage.prompt_tokens === 'number') {
            usageBuffer.push({
              model: modelMatch ? modelMatch[1] : 'unknown',
              prompt_tokens: usage.prompt_tokens || 0,
              completion_tokens: usage.completion_tokens || 0,
              total_tokens: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch { /* not a usage line */ }
    }
  });

  journal.on('exit', () => {
    // Restart watcher if it dies
    setTimeout(startUsageWatcher, 5000);
  });
}

// Start watcher after a delay to ensure openclaw service exists
setTimeout(startUsageWatcher, 10000);
```

**Step 2: Add GET /usage/pending endpoint**

Add before the `/logs` endpoint:

```javascript
// GET /usage/pending → return and clear usage buffer
app.get('/usage/pending', auth, (req, res) => {
  const events = [...usageBuffer];
  usageBuffer.length = 0; // clear
  res.json({ events, credit_blocked: creditBlocked });
});
```

**Step 3: Add POST /credit-status endpoint**

```javascript
// POST /credit-status → receive credit state from backend
app.post('/credit-status', auth, (req, res) => {
  const { blocked, balance_brl } = req.body || {};

  if (blocked === true && !creditBlocked) {
    creditBlocked = true;
    console.log('[credit-guard] Credits depleted — stopping OpenClaw');
    exec('sudo systemctl stop openclaw', { timeout: 15000 }, (err) => {
      if (err) console.error('[credit-guard] Failed to stop openclaw:', err.message);
    });
  } else if (blocked === false && creditBlocked) {
    creditBlocked = false;
    console.log('[credit-guard] Credits restored — starting OpenClaw');
    exec('sudo systemctl start openclaw', { timeout: 15000 }, (err) => {
      if (err) console.error('[credit-guard] Failed to start openclaw:', err.message);
    });
  }

  res.json({ credit_blocked: creditBlocked, balance_brl });
});
```

**Step 4: Sync cloudInit.ts with the same changes**

Apply identical changes to the embedded agent code in `src/services/cloudInit.ts`.

**Step 5: Deploy updated server.js to live VPS**

```bash
scp -i ~/.ssh/id_rsa vps-agent/server.js root@134.209.67.16:/opt/oriclaw-agent/server.js
ssh -i ~/.ssh/id_rsa root@134.209.67.16 "systemctl restart oriclaw-agent"
```

**Step 6: Commit**

```bash
git add vps-agent/server.js src/services/cloudInit.ts
git commit -m "feat: add usage tracking, credit guard, and usage/pending endpoint to VPS agent"
```

---

### Task 6: Backend — Usage Polling Job

**Files:**
- Modify: `src/index.ts`
- Modify: `src/routes/proxy.ts` (remove fixed R$0.02 deduction)

**Step 1: Add polling job to index.ts**

Add after `retryPendingDeletions();` (around line 211):

```typescript
import { getModelPricing, getAdminSettings } from './services/openrouter';

// ── Usage collection polling (every 60s) ─────────────────────────────────────
async function collectUsageFromAgents() {
  try {
    const settings = await getAdminSettings();
    const multiplier = settings?.cost_multiplier ?? 2.0;

    // USD to BRL approximate rate (could be fetched from API in future)
    const USD_TO_BRL = 5.5;

    // Get all active credit-mode instances
    const { data: instances } = await supabase
      .from('oriclaw_instances')
      .select('id, customer_id, droplet_ip, metadata')
      .in('status', ['running', 'needs_config']);

    if (!instances || instances.length === 0) return;

    const https = await import('https');
    const axiosLib = await import('axios');
    const { decrypt: decryptFn } = await import('./services/crypto');
    const vpsAgent = new https.Agent({ rejectUnauthorized: false });

    for (const inst of instances) {
      const meta = (inst.metadata ?? {}) as Record<string, unknown>;
      if (meta.ai_mode !== 'credits') continue;
      if (!inst.droplet_ip) continue;

      const agentSecretEnc = meta.agent_secret as string | undefined;
      if (!agentSecretEnc) continue;

      let agentSecret: string;
      try { agentSecret = decryptFn(agentSecretEnc); } catch { continue; }

      try {
        // Collect usage events
        const { data: usageData } = await axiosLib.default.get(
          `https://${inst.droplet_ip}:8080/usage/pending`,
          { headers: { 'x-agent-secret': agentSecret }, timeout: 10_000, httpsAgent: vpsAgent }
        );

        const events = usageData?.events ?? [];
        for (const evt of events) {
          const pricing = await getModelPricing(evt.model);
          const promptCost = (pricing?.prompt ?? 0) * (evt.prompt_tokens ?? 0);
          const completionCost = (pricing?.completion ?? 0) * (evt.completion_tokens ?? 0);
          const costUsd = promptCost + completionCost;
          const costBrl = costUsd * USD_TO_BRL * multiplier;

          // Insert usage record
          await supabase.from('oriclaw_token_usage').insert({
            customer_id: inst.customer_id,
            instance_id: inst.id,
            model: evt.model ?? 'unknown',
            prompt_tokens: evt.prompt_tokens ?? 0,
            completion_tokens: evt.completion_tokens ?? 0,
            total_tokens: evt.total_tokens ?? 0,
            cost_usd: costUsd,
            cost_brl: costBrl,
          });

          // Deduct credits
          if (costBrl > 0) {
            await supabase.rpc('deduct_credits', {
              p_customer_id: inst.customer_id,
              p_amount: costBrl,
            });
          }
        }

        // Check balance and send credit status
        const { data: creditsRow } = await supabase
          .from('oriclaw_credits')
          .select('balance_brl')
          .eq('customer_id', inst.customer_id)
          .maybeSingle();
        const balance = (creditsRow as { balance_brl: number } | null)?.balance_brl ?? 0;

        await axiosLib.default.post(
          `https://${inst.droplet_ip}:8080/credit-status`,
          { blocked: balance <= 0, balance_brl: balance },
          { headers: { 'x-agent-secret': agentSecret, 'Content-Type': 'application/json' }, timeout: 10_000, httpsAgent: vpsAgent }
        ).catch(() => {}); // non-fatal

      } catch (err) {
        // Non-fatal — agent may be offline
      }
    }
  } catch (err) {
    console.error('[usage-poll] Error:', err instanceof Error ? err.message : err);
  }
}

// Run every 60 seconds
setInterval(collectUsageFromAgents, 60_000);
// Run once on startup after 30s delay
setTimeout(collectUsageFromAgents, 30_000);
```

**Step 2: Remove fixed R$0.02 deduction from proxy.ts**

In `src/routes/proxy.ts`, remove the `COST_PER_MESSAGE_BRL` constant (line 22) and remove the per-message deduction block in the `ai/*` catch-all route (lines 476-487). Keep the balance check at the top (lines 52-68).

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/index.ts src/routes/proxy.ts
git commit -m "feat: add usage polling job, remove fixed per-message deduction"
```

---

### Task 7: VPS Agent — Protect OpenRouter Key

**Files:**
- Modify: `vps-agent/server.js` (configure endpoint)
- Modify: `src/services/cloudInit.ts` (systemd override + filesystem deny)

**Step 1: Modify cloudInit.ts — systemd override for OpenRouter key**

In the cloud-init script, after the OpenClaw systemd service unit, add:

```bash
# Protect OpenRouter key — store in systemd override instead of .env
mkdir -p /etc/systemd/system/openclaw.service.d
cat > /etc/systemd/system/openclaw.service.d/openrouter.conf << 'OREOF'
[Service]
# OpenRouter key injected at configure time by VPS agent
# This file is root:root 600 — openclaw user cannot read it directly
# The process inherits the variable via systemd
OREOF
chmod 600 /etc/systemd/system/openclaw.service.d/openrouter.conf
chown root:root /etc/systemd/system/openclaw.service.d/openrouter.conf
```

**Step 2: Modify VPS agent configure endpoint**

In server.js, change the OpenRouter key handling in `/configure` to write to systemd override instead of `.env`:

```javascript
// Instead of: if (openrouter_key) envUpdates.OPENROUTER_API_KEY = openrouter_key;
// Write to systemd override:
if (openrouter_key) {
  try {
    const override = `[Service]\nEnvironment=OPENROUTER_API_KEY=${openrouter_key}\n`;
    require('fs').writeFileSync('/etc/systemd/system/openclaw.service.d/openrouter.conf', override, { mode: 0o600 });
    runCmd('systemctl daemon-reload');
  } catch (err) {
    console.error('[configure] Failed to write OpenRouter key to systemd override:', err.message);
    // Fallback to .env
    envUpdates.OPENROUTER_API_KEY = openrouter_key;
  }
}
```

**Step 3: Add sudoers for systemd override write**

In cloudInit.ts sudoers section, add:
```bash
oriclaw-agent ALL=(root) NOPASSWD: /bin/systemctl daemon-reload
```

Note: The agent runs as `oriclaw-agent` user, so writing to `/etc/systemd/system/` needs sudo or the writeFileSync needs to be via `runCmd('sudo tee ...')`.

**Step 4: Sync cloudInit.ts and commit**

```bash
git add vps-agent/server.js src/services/cloudInit.ts
git commit -m "feat: protect OpenRouter key via systemd override instead of .env"
```

---

### Task 8: VPS Agent — Codex OAuth Support

**Files:**
- Modify: `vps-agent/server.js`
- Modify: `src/services/cloudInit.ts` (sync)

**Step 1: Add POST /configure-codex-oauth endpoint**

```javascript
// POST /configure-codex-oauth → receive OAuth token from backend, configure OpenClaw for Codex
app.post('/configure-codex-oauth', auth, (req, res) => {
  const { oauth_data } = req.body || {};
  if (!oauth_data) {
    return res.status(400).json({ error: 'oauth_data is required' });
  }

  try {
    // Write OAuth credentials to OpenClaw auth profiles
    const authDir = path.join(OPENCLAW_CONFIG_DIR, 'credentials');
    runCmd(`sudo -u openclaw mkdir -p '${authDir}'`);

    const oauthPath = path.join(authDir, 'oauth.json');
    const oauthContent = JSON.stringify(oauth_data, null, 2);
    // Write via sudo to ensure correct ownership
    runCmd(`echo '${oauthContent.replace(/'/g, "'\\''")}' | sudo -u openclaw tee '${oauthPath}' > /dev/null`);
    runCmd(`sudo -u openclaw chmod 600 '${oauthPath}'`);

    // Update OpenClaw config to use openai-codex model
    writeConfig({ model: 'openai-codex/gpt-5.4', ai_mode: 'chatgpt' });

    // Restart OpenClaw to pick up new auth
    exec('sudo systemctl restart openclaw', { timeout: 30000 }, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to restart: ' + err.message });
      }
      res.json({ success: true, model: 'openai-codex/gpt-5.4' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 2: Sync cloudInit.ts and commit**

```bash
git add vps-agent/server.js src/services/cloudInit.ts
git commit -m "feat: add Codex OAuth endpoint to VPS agent"
```

---

### Task 9: Backend — Codex OAuth Flow (Auth Routes)

**Files:**
- Modify: `src/routes/auth.ts`

**Step 1: Add Codex OAuth initiation endpoint**

```typescript
// POST /api/auth/openai-codex/init — starts OAuth flow
router.post('/openai-codex/init', async (req: Request, res: Response): Promise<void> => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Não autorizado.' }); return; }

  const callbackUrl = `${process.env.APP_URL}/auth/openai-codex/callback`;

  // Generate PKCE code_verifier and code_challenge
  const crypto = await import('crypto');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  // Store code_verifier in instance metadata for later exchange
  const instance = await getInstanceByCustomerId(userId);
  if (!instance) { res.status(404).json({ error: 'Instância não encontrada.' }); return; }

  const existingMeta = (instance.metadata ?? {}) as Record<string, unknown>;
  await updateInstance(instance.id, {
    metadata: { ...existingMeta, codex_code_verifier: encrypt(codeVerifier) },
  });

  const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  res.json({ auth_url: authUrl });
});

// POST /api/auth/openai-codex/exchange — exchange code for key
router.post('/openai-codex/exchange', async (req: Request, res: Response): Promise<void> => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Não autorizado.' }); return; }

  const { code } = req.body as { code?: string };
  if (!code) { res.status(400).json({ error: 'code é obrigatório.' }); return; }

  const instance = await getInstanceByCustomerId(userId);
  if (!instance) { res.status(404).json({ error: 'Instância não encontrada.' }); return; }

  const meta = (instance.metadata ?? {}) as Record<string, unknown>;
  const codeVerifierEnc = meta.codex_code_verifier as string | undefined;
  if (!codeVerifierEnc) { res.status(400).json({ error: 'OAuth flow not initiated.' }); return; }

  let codeVerifier: string;
  try { codeVerifier = decrypt(codeVerifierEnc); } catch {
    res.status(500).json({ error: 'Failed to decrypt code verifier.' }); return;
  }

  try {
    // Exchange code for API key at OpenRouter
    const { data } = await axios.post('https://openrouter.ai/api/v1/auth/keys', {
      code,
      code_verifier: codeVerifier,
      code_challenge_method: 'S256',
    });

    const apiKey = data?.key;
    if (!apiKey) { res.status(500).json({ error: 'No key returned from OpenRouter.' }); return; }

    // Send OAuth data to VPS agent
    const agentSecretEnc = meta.agent_secret as string;
    const agentSecret = decrypt(agentSecretEnc);

    const vpsHttpsAgent = new (await import('https')).Agent({ rejectUnauthorized: false });
    await axios.post(
      `https://${instance.droplet_ip}:8080/configure-codex-oauth`,
      { oauth_data: { key: apiKey, provider: 'openai-codex' } },
      { headers: { 'x-agent-secret': agentSecret, 'Content-Type': 'application/json' }, timeout: 30_000, httpsAgent: vpsHttpsAgent }
    );

    // Update instance metadata
    await updateInstance(instance.id, {
      metadata: {
        ...meta,
        ai_mode: 'chatgpt',
        chatgpt_connected: true,
        codex_code_verifier: undefined, // cleanup
      },
    });

    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth exchange failed';
    console.error('[auth/codex/exchange]', msg);
    res.status(500).json({ error: msg });
  }
});
```

**Step 2: Build and commit**

```bash
npm run build
git add src/routes/auth.ts
git commit -m "feat: add Codex OAuth init and exchange endpoints"
```

---

### Task 10: Frontend — Admin Page

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/api/admin/[...path]/route.ts`

**Step 1: Create admin API proxy**

```typescript
// app/api/admin/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function handler(req: NextRequest, { params }: { params: { path: string[] } }): Promise<NextResponse> {
  const pathStr = params.path.join('/');
  const targetUrl = `${BACKEND_URL}/api/admin/${pathStr}`;
  const authHeader = req.headers.get('authorization') ?? '';

  const init: RequestInit = {
    method: req.method,
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    if (body) init.body = body;
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    return NextResponse.json({ error: 'Admin proxy error' }, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as PUT };
```

**Step 2: Create admin page**

Create `app/admin/page.tsx` — a full admin dashboard with:
- Settings section (model dropdown, multiplier input)
- Usage monitoring (totals, by-day table, top users)
- Instances list (status, plan, balance, ai_mode)
- Auth check: redirect to /dashboard if not admin (403 from API)

This will be a large component similar to MainDashboard.tsx but focused on admin operations. Use the same design system (slate/red theme, rounded cards).

**Step 3: Commit**

```bash
git add app/admin/ app/api/admin/
git commit -m "feat: add admin page and API proxy"
```

---

### Task 11: Frontend — Update ConfigModal with Codex OAuth

**Files:**
- Modify: `app/dashboard/components/MainDashboard.tsx`
- Create: `app/auth/openai-codex/callback/page.tsx`

**Step 1: Update ChatGPT tab in ConfigModal**

Replace the `OpenAIConnectButton` usage in the "chatgpt" tab with two options:
1. "Conectar com ChatGPT" button (OAuth Codex flow)
2. "Usar API Key" fallback (existing input)

The OAuth flow:
1. Call `POST /api/auth/openai-codex/init` → get `auth_url`
2. Open `auth_url` in popup/new tab
3. User logs in at OpenRouter → redirected to callback
4. Callback page extracts `code` from URL and calls `POST /api/auth/openai-codex/exchange`

**Step 2: Create callback page**

```typescript
// app/auth/openai-codex/callback/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CodexCallback() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const code = params.get('code');
    if (!code) { setStatus('error'); return; }

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus('error'); return; }

      const res = await fetch('/api/auth/openai-codex/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        setStatus('success');
        // Close popup or redirect
        setTimeout(() => { window.close(); window.location.href = '/dashboard'; }, 2000);
      } else {
        setStatus('error');
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        {status === 'loading' && <p className="text-white">Conectando sua conta ChatGPT...</p>}
        {status === 'success' && <p className="text-green-400">ChatGPT conectado com sucesso! Redirecionando...</p>}
        {status === 'error' && <p className="text-red-400">Erro ao conectar. Tente novamente pelo dashboard.</p>}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/dashboard/components/MainDashboard.tsx app/auth/openai-codex/
git commit -m "feat: add Codex OAuth flow to ChatGPT tab and callback page"
```

---

### Task 12: Deploy and Test

**Step 1: Deploy backend to DigitalOcean App Platform**

```bash
cd /Users/caiojusto/Documents/oriclaw/oriclaw-backend
git push origin main
```

**Step 2: Deploy frontend to Vercel**

```bash
cd /Users/caiojusto/Documents/oriclaw/oriclaw-landing
git push origin main
npx vercel --prod
```

**Step 3: Deploy updated VPS agent**

```bash
scp -i ~/.ssh/id_rsa vps-agent/server.js root@134.209.67.16:/opt/oriclaw-agent/server.js
ssh -i ~/.ssh/id_rsa root@134.209.67.16 "systemctl restart oriclaw-agent"
```

**Step 4: Run SQL migrations in Supabase**

**Step 5: Verify admin access at /admin**

**Step 6: Test credit deduction flow end-to-end**

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  MessageCircle,
  Send,
  Hash,
  ChevronRight,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Bot,
  Key,
  CreditCard,
  Zap,
  ChevronDown,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type Channel = "whatsapp" | "telegram" | "discord";
type AIMode = "byok" | "credits" | "chatgpt";
type BYOKProvider = "anthropic" | "openai" | "google" | "openrouter";

interface Instance {
  id: string;
  status: string;
  droplet_ip: string | null;
  plan: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// ── Channel options ──────────────────────────────────────────────────────────
const CHANNELS = [
  {
    id: "whatsapp" as Channel,
    label: "WhatsApp",
    icon: MessageCircle,
    description: "O mensageiro mais popular do Brasil. Recomendado para iniciantes.",
    recommended: true,
    color: "text-green-400",
    border: "border-green-500/40",
    bg: "bg-green-500/10",
  },
  {
    id: "telegram" as Channel,
    label: "Telegram",
    icon: Send,
    description: "Plataforma rápida com suporte a grupos e canais.",
    color: "text-sky-400",
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
  },
  {
    id: "discord" as Channel,
    label: "Discord",
    icon: Hash,
    description: "Ideal para comunidades e servidores.",
    color: "text-indigo-400",
    border: "border-indigo-500/40",
    bg: "bg-indigo-500/10",
  },
] as const;

// ── BYOK provider options ────────────────────────────────────────────────────
const BYOK_PROVIDERS: {
  id: BYOKProvider;
  label: string;
  company: string;
  placeholder: string;
  keyHint: string;
  model: string;
  howToGet: string;
  link: string;
}[] = [
  {
    id: "anthropic",
    label: "Claude",
    company: "Anthropic",
    placeholder: "sk-ant-api03-...",
    keyHint: "Começa com sk-ant-",
    model: "claude-sonnet-4-5",
    howToGet: "Acesse console.anthropic.com → API Keys → Create Key",
    link: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    label: "GPT-4",
    company: "OpenAI",
    placeholder: "sk-proj-...",
    keyHint: "Começa com sk-",
    model: "gpt-4o",
    howToGet: "Acesse platform.openai.com → API Keys → Create new secret key",
    link: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    label: "Gemini",
    company: "Google",
    placeholder: "AIza...",
    keyHint: "Começa com AIza",
    model: "gemini-1.5-pro",
    howToGet: "Acesse aistudio.google.com → Obter chave de API",
    link: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openrouter",
    label: "Qualquer modelo",
    company: "OpenRouter",
    placeholder: "sk-or-v1-...",
    keyHint: "Começa com sk-or-v1-",
    model: "openai/gpt-4o",
    howToGet: "Acesse openrouter.ai → Keys → Create Key",
    link: "https://openrouter.ai/keys",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

async function proxyCall(
  method: "GET" | "POST",
  instanceId: string,
  action: string,
  body?: Record<string, unknown>,
  token?: string
) {
  const res = await fetch(`/api/proxy/${instanceId}/${action}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── Progress dots ─────────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i < current
              ? "w-6 bg-violet-600"
              : i === current
              ? "w-8 bg-violet-400"
              : "w-2 bg-slate-700"
          }`}
        />
      ))}
    </div>
  );
}

// ── OpenAI API Key Input (Bug fix #6: replaced removed OAuth flow with BYOK API key) ─
// The OAuth endpoints were removed in round 11. This replaces the old OAuth button
// with the same API key input pattern used in MainDashboard.tsx.
function OpenAIConnectButton({
  instanceId,
  token,
  connected,
  onConnected,
}: {
  instanceId: string;
  token: string;
  connected: boolean;
  onConnected: () => void;
}) {
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveOpenAIKey = async () => {
    if (!openaiApiKey.startsWith("sk-") || openaiApiKey.length < 20) {
      setError('Chave inválida. Deve começar com "sk-".');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/openai/key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instance_id: instanceId, api_key: openaiApiKey }),
      });
      const data = await res.json();
      if (data.error) throw new Error(String(data.error));
      onConnected();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao salvar chave OpenAI");
    } finally {
      setLoading(false);
    }
  };

  if (connected) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
        <div>
          <p className="text-green-400 font-medium text-sm">OpenAI API Key configurada ✅</p>
          <p className="text-slate-500 text-xs">Sua chave OpenAI está vinculada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-400">
        Cole sua OpenAI API Key abaixo. Encontre em{" "}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400 hover:text-violet-300 underline"
        >
          platform.openai.com/api-keys
        </a>
      </div>
      <input
        type="password"
        value={openaiApiKey}
        onChange={(e) => setOpenaiApiKey(e.target.value)}
        placeholder="sk-..."
        className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-600 transition-colors"
      />
      {error && (
        <p className="text-red-400 text-xs flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
      <button
        onClick={handleSaveOpenAIKey}
        disabled={loading || !openaiApiKey}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold text-sm transition-all"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Salvar API Key
      </button>
    </div>
  );
}

// ── Purchase Modal ─────────────────────────────────────────────────────────────
function PurchaseModal({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const [selectedAmount, setSelectedAmount] = useState<20 | 50 | 100 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plans: { amount: 20 | 50 | 100; msgs: string; label: string }[] = [
    { amount: 20, msgs: "1.000 msgs", label: "R$20" },
    { amount: 50, msgs: "3.000 msgs", label: "R$50" },
    { amount: 100, msgs: "7.000 msgs", label: "R$100" },
  ];

  const handlePurchase = async () => {
    if (!selectedAmount) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_brl: selectedAmount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.payment_url) {
        // Redirect to Stripe Hosted Checkout
        window.location.href = data.payment_url;
      } else {
        setError("Erro ao iniciar pagamento. Tente novamente.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">Comprar créditos</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">Processado via OpenRouter. Créditos não expiram.</p>

        <div className="space-y-2 mb-5">
          {plans.map((p) => (
            <button
              key={p.amount}
              onClick={() => setSelectedAmount(p.amount)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                selectedAmount === p.amount
                  ? "bg-violet-600/20 border-violet-500 border-2"
                  : "bg-slate-800 border-slate-700 hover:border-slate-600"
              }`}
            >
              <span className="text-white font-semibold">{p.label}</span>
              <span className="text-slate-400 text-sm">{p.msgs}</span>
              {selectedAmount === p.amount && <CheckCircle className="w-4 h-4 text-violet-400 ml-2" />}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <p className="text-slate-500 text-xs text-center mb-3">
          Após o pagamento, seus créditos serão adicionados automaticamente.
        </p>
        <button
          onClick={handlePurchase}
          disabled={!selectedAmount || loading}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecionando...</>
            : "Pagar com Stripe"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Channel>("whatsapp");

  // AI mode selection
  const [aiMode, setAIMode] = useState<AIMode | null>(null);
  // BYOK sub-state
  const [byokProvider, setByokProvider] = useState<BYOKProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [showKeyHint, setShowKeyHint] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  // Credits sub-state
  const [creditBalance, setCreditBalance] = useState(0);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  // ChatGPT Plus sub-state
  const [chatgptConnected, setChatgptConnected] = useState(false);

  const [assistantName, setAssistantName] = useState("Ori");
  const [personality, setPersonality] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrConnected, setQrConnected] = useState(false);
  const [qrTimeout, setQrTimeout] = useState(false);
  const [qrConnectionError, setQrConnectionError] = useState(false);
  const qrAttemptRef = useRef(0);
  const qrConsecErrorsRef = useRef(0);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const provisioningPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist step in localStorage when instance is known
  useEffect(() => {
    if (instance?.id) {
      localStorage.setItem(`oriclaw_onboarding_step_${instance.id}`, String(step));
    }
  }, [step, instance?.id]);

  // Telegram/Discord channel config state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [discordToken, setDiscordToken] = useState('');
  const [discordGuildId, setDiscordGuildId] = useState('');
  const [discordConfigured, setDiscordConfigured] = useState(false);

  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth check + instance fetch ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);

      const fetchInstance = async () => {
        const res = await fetch(`/api/instances/${session.user.id}`, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
        });
        if (res.ok) {
          const inst = await res.json() as Instance;
          setInstance(inst);
          if (inst.status === "running") { router.push("/dashboard"); return; }
          if (inst.metadata?.chatgpt_connected) setChatgptConnected(true);

          // Restore saved onboarding step
          if (inst.id) {
            const savedStep = parseInt(localStorage.getItem(`oriclaw_onboarding_step_${inst.id}`) || '0', 10);
            if (savedStep > 0 && savedStep < 4) setStep(savedStep);
          }

          if (inst.status === "provisioning") {
            setIsProvisioning(true);
            // Start polling every 8s until status changes
            if (provisioningPollRef.current) clearInterval(provisioningPollRef.current);
            provisioningPollRef.current = setInterval(async () => {
              try {
                const r2 = await fetch(`/api/instances/${session.user.id}`, {
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                  },
                });
                if (r2.ok) {
                  const updated = await r2.json() as Instance;
                  setInstance(updated);
                  if (updated.status !== "provisioning") {
                    if (provisioningPollRef.current) clearInterval(provisioningPollRef.current);
                    if (updated.status === 'suspended' || updated.status === 'deletion_failed') {
                      setIsProvisioning(false);
                      setProvisioningError(
                        (updated.metadata as { error?: string })?.error ||
                        'Falha ao criar seu servidor. Entre em contato com o suporte em suporte@oriclaw.com.br'
                      );
                      return;
                    }
                    setIsProvisioning(false);
                    if (updated.status === "running") router.push("/dashboard");
                  }
                }
              } catch { /* keep polling */ }
            }, 8000);
          } else {
            setIsProvisioning(false);
          }
        }
      };

      await fetchInstance();
    })();

    return () => { if (provisioningPollRef.current) clearInterval(provisioningPollRef.current); };
  }, [router]);

  // ── Fetch credit balance when credits mode selected ────────────────────────
  useEffect(() => {
    if (aiMode === "credits" && token) {
      fetch("/api/credits", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => { if (!d.error) setCreditBalance(d.balance_brl ?? 0); })
        .catch(() => {});
    }
  }, [aiMode, token]);

  // ── QR polling ────────────────────────────────────────────────────────────
  const MAX_QR_ATTEMPTS = 60; // 60 × 3s = 3 minutes
  const MAX_CONSEC_ERRORS = 10;

  const startQRPolling = useCallback(() => {
    if (!instance?.id || !token) return;
    qrAttemptRef.current = 0;
    qrConsecErrorsRef.current = 0;
    setQrTimeout(false);
    setQrConnectionError(false);

    const poll = async () => {
      qrAttemptRef.current += 1;

      // Timeout after max attempts
      if (qrAttemptRef.current > MAX_QR_ATTEMPTS) {
        if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
        setQrTimeout(true);
        return;
      }

      try {
        const data = await proxyCall("GET", instance.id, "qr", undefined, token);
        qrConsecErrorsRef.current = 0; // reset on success
        if (data.connected) {
          setQrConnected(true);
          if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
          setTimeout(() => setStep(4), 1500);
        } else if (data.qr) {
          setQrData(data.qr);
        }
      } catch {
        qrConsecErrorsRef.current += 1;
        if (qrConsecErrorsRef.current >= MAX_CONSEC_ERRORS) {
          setQrConnectionError(true);
        }
      }
    };
    poll();
    qrIntervalRef.current = setInterval(poll, 3000);
  }, [instance?.id, token]);

  useEffect(() => {
    if (step === 3) startQRPolling();
    return () => { if (qrIntervalRef.current) clearInterval(qrIntervalRef.current); };
  }, [step, startQRPolling]);

  // ── Step handlers ──────────────────────────────────────────────────────────
  const handleConfigure = async () => {
    if (!instance?.id || !token || !aiMode) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        channel,
        assistant_name: assistantName,
        ...(personality ? { system_prompt: personality } : {}),
      };

      if (aiMode === "byok") {
        const prov = BYOK_PROVIDERS.find((p) => p.id === byokProvider)!;
        body.model = prov.model;
        if (byokProvider === "anthropic") body.anthropic_key = apiKey;
        else if (byokProvider === "openai") body.openai_key = apiKey;
        else if (byokProvider === "google") body.google_key = apiKey;
        else if (byokProvider === "openrouter") body.openrouter_key = apiKey;
      } else if (aiMode === "credits") {
        body.credits_mode = true;
        body.model = "claude-3-5-haiku-latest";
      } else if (aiMode === "chatgpt") {
        body.chatgpt_mode = true;
        body.model = "gpt-4o";
      }

      const result = await proxyCall("POST", instance.id, "configure", body, token);
      if (result.error) throw new Error(result.error);
      setStep(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao configurar");
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureTelegram = async () => {
    if (!instance?.id || !token || !telegramToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await proxyCall("POST", instance.id, "channels/telegram", { token: telegramToken.trim() }, token);
      if (result.success || result.status === 'ok') {
        setTelegramConfigured(true);
      } else {
        setError(result.error || 'Erro ao configurar Telegram.');
      }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureDiscord = async () => {
    if (!instance?.id || !token || !discordToken || !discordGuildId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await proxyCall("POST", instance.id, "channels/discord", { token: discordToken.trim(), guild_id: discordGuildId.trim() }, token);
      if (result.success || result.status === 'ok') {
        setDiscordConfigured(true);
      } else {
        setError(result.error || 'Erro ao configurar Discord.');
      }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = () => {
    if (!aiMode) return false;
    if (aiMode === "byok") {
      const key = apiKey.trim();
      if (!key || key.length < 20) return false;
      // Validate key prefix matches the selected provider
      const prefixes: Record<BYOKProvider, string> = {
        anthropic: "sk-ant-",
        openai: "sk-",
        google: "AIza",
        openrouter: "sk-or-v1-",
      };
      return key.startsWith(prefixes[byokProvider]);
    }
    if (aiMode === "credits") return true; // can proceed with R$0
    if (aiMode === "chatgpt") return chatgptConnected;
    return false;
  };

  const selectedByokProvider = BYOK_PROVIDERS.find((p) => p.id === byokProvider)!;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">O</span>
        </div>
        <span className="text-white font-bold text-xl">OriClaw</span>
      </div>

      <div className="w-full max-w-xl">

        {/* ── Provisioning wait screen ── */}
        {isProvisioning && (
          <div className="animate-fade-in text-center py-8">
            {provisioningError ? (
              <div className="text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                <h2 className="text-xl font-bold text-white">Falha no provisionamento</h2>
                <p className="text-gray-400">{provisioningError}</p>
                <a href="mailto:suporte@oriclaw.com.br" className="text-violet-400 underline">
                  Falar com suporte
                </a>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-white mb-3">Preparando seu servidor...</h1>
                <p className="text-slate-400 mb-8">Isso pode levar até 20 minutos na primeira vez</p>
                {/* Animated progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-violet-500"
                    style={{
                      animation: "provisioningProgress 900s linear forwards",
                      width: "0%",
                    }}
                  />
                </div>
                <style>{`
                  @keyframes provisioningProgress {
                    from { width: 0%; }
                    to { width: 95%; }
                  }
                `}</style>
                <p className="text-slate-500 text-lg">☕ Aproveite para preparar um café</p>
                <div className="flex items-center justify-center gap-2 mt-8 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando a cada 8 segundos...</span>
                </div>
              </>
            )}
          </div>
        )}

        {!isProvisioning && <StepDots current={step} total={5} />}

        {/* ── Step 0: Escolha seu canal ── */}
        {!isProvisioning && step === 0 && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white text-center mb-2">Escolha seu canal</h1>
            <p className="text-slate-400 text-center mb-8">
              Por onde seu assistente vai atender as pessoas?
            </p>
            <div className="space-y-3">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChannel(c.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    channel === c.id
                      ? `${c.bg} ${c.border} border-2`
                      : "bg-slate-900 border-slate-800 hover:border-slate-600"
                  }`}
                >
                  <div className={`p-2 rounded-xl ${c.bg}`}>
                    <c.icon className={`w-5 h-5 ${c.color}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{c.label}</span>
                      {"recommended" in c && c.recommended && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5">{c.description}</p>
                  </div>
                  {channel === c.id && (
                    <CheckCircle className={`w-5 h-5 ${c.color} flex-shrink-0`} />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full mt-6 py-3 px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
            >
              Próximo <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ── Step 1: Como você quer usar a IA? ── */}
        {!isProvisioning && step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white text-center mb-2">Como usar a IA?</h1>
            <p className="text-slate-400 text-center mb-6">
              Escolha como seu assistente vai se conectar à inteligência artificial.
            </p>

            <div className="space-y-3 mb-6">
              {/* ── Option A: BYOK ── */}
              <div className={`rounded-2xl border-2 transition-all overflow-hidden ${
                aiMode === "byok"
                  ? "border-violet-500 bg-violet-600/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-600"
              }`}>
                <button
                  className="w-full flex items-start gap-4 p-4 text-left"
                  onClick={() => setAIMode(aiMode === "byok" ? null : "byok")}
                >
                  <div className="p-2.5 rounded-xl bg-slate-800 flex-shrink-0">
                    <Key className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">Usar minha chave de API</p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      Traga sua própria chave Anthropic, OpenAI, Google ou OpenRouter. Você controla os custos.
                    </p>
                  </div>
                  {aiMode === "byok" ? (
                    <CheckCircle className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {aiMode === "byok" && (
                  <div className="px-4 pb-4 space-y-3 border-t border-violet-500/20 pt-4">
                    {/* Provider dropdown */}
                    <div className="relative">
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Provedor</label>
                      <button
                        onClick={() => setShowProviderDropdown((v) => !v)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm hover:border-slate-600 transition-colors"
                      >
                        <span>
                          {selectedByokProvider.label}
                          <span className="text-slate-400 ml-1">({selectedByokProvider.company})</span>
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                      {showProviderDropdown && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                          {BYOK_PROVIDERS.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { setByokProvider(p.id); setApiKey(""); setShowProviderDropdown(false); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-700 transition-colors ${
                                byokProvider === p.id ? "text-violet-400" : "text-white"
                              }`}
                            >
                              {byokProvider === p.id && <CheckCircle className="w-3.5 h-3.5 text-violet-400" />}
                              {byokProvider !== p.id && <div className="w-3.5 h-3.5" />}
                              <span>{p.label}</span>
                              <span className="text-slate-400">({p.company})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* API Key input */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Chave de API</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={selectedByokProvider.placeholder}
                        className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 border text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 text-sm transition-colors ${
                          apiKey && !canProceedStep1() ? "border-red-500/60" : "border-slate-700"
                        }`}
                      />
                      {apiKey.trim() && !canProceedStep1() ? (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {selectedByokProvider.keyHint} (formato inválido)
                        </p>
                      ) : (
                        <p className="text-slate-500 text-xs mt-1">{selectedByokProvider.keyHint}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowKeyHint(true)}
                      className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs transition-colors"
                    >
                      Como obter minha chave <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Option B: OriClaw Credits ── */}
              <div className={`rounded-2xl border-2 transition-all overflow-hidden ${
                aiMode === "credits"
                  ? "border-violet-500 bg-violet-600/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-600"
              }`}>
                <button
                  className="w-full flex items-start gap-4 p-4 text-left"
                  onClick={() => setAIMode(aiMode === "credits" ? null : "credits")}
                >
                  <div className="p-2.5 rounded-xl bg-slate-800 flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold">Usar créditos OriClaw</p>
                      <span className="text-xs bg-violet-600/20 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/30">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5">
                      Sem conta de IA necessária. Compre créditos e pague conforme usa. A partir de R$20.
                    </p>
                  </div>
                  {aiMode === "credits" ? (
                    <CheckCircle className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {aiMode === "credits" && (
                  <div className="px-4 pb-4 border-t border-violet-500/20 pt-4 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800">
                      <span className="text-slate-400 text-sm">Seu saldo atual</span>
                      <span className="text-white font-semibold">
                        R$ {creditBalance.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowPurchaseModal(true)}
                      className="w-full py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 text-sm font-medium hover:bg-violet-600/30 transition-all"
                    >
                      Comprar créditos agora
                    </button>
                    <p className="text-slate-500 text-xs text-center">
                      Você pode comprar créditos agora ou depois no painel. Não expiram.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Option C: ChatGPT Plus ── */}
              <div className={`rounded-2xl border-2 transition-all overflow-hidden ${
                aiMode === "chatgpt"
                  ? "border-violet-500 bg-violet-600/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-600"
              }`}>
                <button
                  className="w-full flex items-start gap-4 p-4 text-left"
                  onClick={() => setAIMode(aiMode === "chatgpt" ? null : "chatgpt")}
                >
                  <div className="p-2.5 rounded-xl bg-slate-800 flex-shrink-0">
                    <Zap className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">Usar minha assinatura ChatGPT Plus</p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      Se você já tem ChatGPT Plus, conecte sua conta OpenAI diretamente.
                    </p>
                  </div>
                  {aiMode === "chatgpt" ? (
                    <CheckCircle className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {aiMode === "chatgpt" && instance?.id && token && (
                  <div className="px-4 pb-4 border-t border-violet-500/20 pt-4 space-y-3">
                    <OpenAIConnectButton
                      instanceId={instance.id}
                      token={token}
                      connected={chatgptConnected}
                      onConnected={() => setChatgptConnected(true)}
                    />
                    {!chatgptConnected && (
                      <p className="text-slate-500 text-xs text-center">
                        Requer plano pago na OpenAI. Uma janela de autorização será aberta.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1()}
                className="flex-1 py-3 px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
              >
                Próximo <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Nome do assistente ── */}
        {!isProvisioning && step === 2 && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              Dê um nome ao seu assistente
            </h1>
            <p className="text-slate-400 text-center mb-8">Como você quer que ele se chame?</p>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome do assistente</label>
                <input
                  type="text"
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  placeholder="Ori"
                  maxLength={32}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 text-sm transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Personalidade{" "}
                  <span className="text-slate-500 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Sou seu assistente pessoal. Sou prestativo, direto e amigável."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 text-sm transition-colors resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleConfigure}
                disabled={loading || !assistantName.trim()}
                className="flex-1 py-3 px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Configurando...</>
                ) : (
                  <>Configurar <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Conectar canal ── */}
        {!isProvisioning && step === 3 && (
          <div className="animate-fade-in text-center">
            {/* ── WhatsApp: QR code flow ── */}
            {channel === "whatsapp" && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Conectar WhatsApp</h1>
                <p className="text-slate-400 mb-2">Escaneie o QR code com seu celular</p>
                <p className="text-slate-500 text-sm mb-8">
                  Abra o WhatsApp → Menu (⋮) → Dispositivos Conectados → Conectar dispositivo
                </p>

                <div className="flex justify-center mb-6">
                  {qrConnected ? (
                    <div className="w-64 h-64 rounded-2xl bg-green-500/10 border-2 border-green-500/40 flex flex-col items-center justify-center gap-3">
                      <CheckCircle className="w-16 h-16 text-green-400" />
                      <p className="text-green-400 font-semibold text-lg">WhatsApp conectado!</p>
                    </div>
                  ) : qrTimeout ? (
                    <div className="w-64 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col items-center justify-center gap-3 p-6">
                      <AlertCircle className="w-10 h-10 text-red-400" />
                      <p className="text-red-400 font-semibold text-sm text-center">Não foi possível gerar o QR Code. O servidor pode estar iniciando ainda.</p>
                      <button
                        onClick={() => startQRPolling()}
                        className="mt-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : qrConnectionError ? (
                    <div className="w-64 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex flex-col items-center justify-center gap-3 p-6">
                      <AlertCircle className="w-10 h-10 text-yellow-400" />
                      <p className="text-yellow-400 font-semibold text-sm text-center">Problema de conexão com o servidor. Verifique se o VPS está online.</p>
                    </div>
                  ) : qrData ? (
                    <div className="p-3 bg-white rounded-2xl shadow-2xl shadow-violet-600/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrData} alt="QR Code WhatsApp" className="w-56 h-56 rounded-xl" />
                    </div>
                  ) : (
                    <div className="w-64 h-64 rounded-2xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
                      <p className="text-slate-400 text-sm">Aguardando QR code...</p>
                      <p className="text-slate-500 text-xs px-4">O assistente está iniciando, pode levar até 1 minuto</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 text-sm">
                  {qrConnected ? (
                    <span className="text-green-400 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Conectado! Redirecionando...
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Aguardando conexão...
                    </span>
                  )}
                </div>

                {!qrConnected && (
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="mt-6 text-slate-500 hover:text-slate-300 text-sm underline transition-colors"
                  >
                    Pular por agora →
                  </button>
                )}
              </>
            )}

            {/* ── Telegram: token form + confirmation ── */}
            {channel === "telegram" && !telegramConfigured && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Configurar Telegram</h1>
                <p className="text-slate-400 mb-8">
                  Cole o token do seu bot Telegram (obtenha em @BotFather).
                </p>

                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-6 text-left space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Token do Bot</label>
                    <input
                      type="text"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 text-sm transition-colors"
                    />
                    <p className="text-slate-500 text-xs mt-1">
                      Inicie @BotFather no Telegram → /newbot → copie o token
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}

                <button
                  onClick={handleConfigureTelegram}
                  disabled={!telegramToken.trim() || loading}
                  className="w-full py-3 px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                  ) : (
                    <>Conectar Telegram <ChevronRight className="w-5 h-5" /></>
                  )}
                </button>
              </>
            )}
            {channel === "telegram" && telegramConfigured && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Telegram conectado!</h1>
                <p className="text-slate-400 mb-8">Seu bot Telegram está pronto para receber mensagens.</p>

                <div className="w-64 h-40 rounded-2xl bg-green-500/10 border-2 border-green-500/40 flex flex-col items-center justify-center gap-3 mx-auto mb-8">
                  <CheckCircle className="w-14 h-14 text-green-400" />
                  <p className="text-green-400 font-semibold text-lg">✅ Bot Telegram configurado!</p>
                </div>

                <p className="text-slate-400 text-sm mb-8">
                  Envie uma mensagem para seu bot no Telegram para testar o assistente.
                </p>

                <button
                  onClick={() => setStep(4)}
                  className="w-full py-3 px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
                >
                  Próximo <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* ── Discord: token + guild_id form + confirmation ── */}
            {channel === "discord" && !discordConfigured && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Configurar Discord</h1>
                <p className="text-slate-400 mb-8">
                  Insira o token do bot e o ID do servidor Discord.
                </p>

                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-6 text-left space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Token do Bot</label>
                    <input
                      type="text"
                      value={discordToken}
                      onChange={(e) => setDiscordToken(e.target.value)}
                      placeholder="MTI3NjM4..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 text-sm transition-colors"
                    />
                    <p className="text-slate-500 text-xs mt-1">
                      Discord Developer Portal → seu app → Bot → Token
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">ID do Servidor (Guild ID)</label>
                    <input
                      type="text"
                      value={discordGuildId}
                      onChange={(e) => setDiscordGuildId(e.target.value)}
                      placeholder="123456789012345678"
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 text-sm transition-colors"
                    />
                    <p className="text-slate-500 text-xs mt-1">
                      Clique direito no servidor no Discord → Copiar ID (modo desenvolvedor deve estar ativo)
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}

                <button
                  onClick={handleConfigureDiscord}
                  disabled={!discordToken.trim() || !discordGuildId.trim() || loading}
                  className="w-full py-3 px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                  ) : (
                    <>Conectar Discord <ChevronRight className="w-5 h-5" /></>
                  )}
                </button>
              </>
            )}
            {channel === "discord" && discordConfigured && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Discord conectado!</h1>
                <p className="text-slate-400 mb-8">Seu bot Discord está pronto para ser adicionado ao servidor.</p>

                <div className="w-64 h-40 rounded-2xl bg-green-500/10 border-2 border-green-500/40 flex flex-col items-center justify-center gap-3 mx-auto mb-8">
                  <CheckCircle className="w-14 h-14 text-green-400" />
                  <p className="text-green-400 font-semibold text-lg">✅ Bot Discord configurado!</p>
                </div>

                <p className="text-slate-400 text-sm mb-8">
                  Convide o bot para seu servidor e envie uma mensagem para testar o assistente.
                </p>

                <button
                  onClick={() => setStep(4)}
                  className="w-full py-3 px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
                >
                  Próximo <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Pronto! ── */}
        {!isProvisioning && step === 4 && (
          <div className="animate-fade-in text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="text-3xl font-bold text-white mb-3">Seu assistente está no ar!</h1>
            <p className="text-slate-400 mb-2">
              <strong className="text-white">{assistantName}</strong> está pronto para responder no{" "}
              {channel === "whatsapp" ? "WhatsApp" : channel}.
            </p>
            <p className="text-slate-500 text-sm mb-10">
              Mande uma mensagem de teste agora para ver ele em ação.
            </p>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-left mb-8">
              <div className="flex items-center gap-3 mb-3">
                <Bot className="w-5 h-5 text-violet-400" />
                <p className="text-slate-300 font-medium">Exemplo de conversa</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-end">
                  <div className="bg-violet-600/20 border border-violet-500/30 rounded-xl px-4 py-2 text-white text-sm max-w-xs">
                    Olá! Quem é você?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-xl px-4 py-2 text-slate-200 text-sm max-w-xs">
                    Olá! Sou <strong>{assistantName}</strong>, seu assistente de IA pessoal. Como posso te ajudar hoje? 😊
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (instance?.id) localStorage.removeItem(`oriclaw_onboarding_step_${instance.id}`);
                router.push("/dashboard");
              }}
              className="w-full py-4 px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
            >
              Ir para o painel <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* ── API Key hint modal ── */}
      {showKeyHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Como obter sua chave</h3>
              <button
                onClick={() => setShowKeyHint(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {BYOK_PROVIDERS.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border ${
                    byokProvider === p.id
                      ? "bg-violet-600/10 border-violet-500/40"
                      : "bg-slate-800/50 border-slate-700"
                  }`}
                >
                  <p className="text-white font-medium text-sm mb-1">{p.label} ({p.company})</p>
                  <p className="text-slate-400 text-sm mb-2">{p.howToGet}</p>
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-1 transition-colors"
                  >
                    Abrir {p.company} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Purchase modal ── */}
      {showPurchaseModal && token && (
        <PurchaseModal
          token={token}
          onClose={() => setShowPurchaseModal(false)}
        />
      )}
    </main>
  );
}

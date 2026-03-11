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

// ── OpenAI OAuth button ───────────────────────────────────────────────────────
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
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    setWaiting(true);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/proxy/${instanceId}/openai-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.connected) {
          if (pollRef.current) clearInterval(pollRef.current);
          setWaiting(false);
          onConnected();
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [instanceId, token, onConnected]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/openai/url/${instanceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Open OAuth URL in a new tab
      window.open(data.url, "_blank", "width=600,height=700,noopener");
      startPolling();
    } catch (e: unknown) {
      console.error("OAuth error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (connected) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
        <div>
          <p className="text-green-400 font-medium text-sm">ChatGPT Plus conectado!</p>
          <p className="text-slate-500 text-xs">Sua conta OpenAI está vinculada.</p>
        </div>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-white font-medium text-sm">Aguardando autorização...</p>
            <p className="text-slate-400 text-xs">Aprovação pendente na janela da OpenAI.</p>
          </div>
        </div>
        <button
          onClick={handleConnect}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Abrir janela novamente
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-xl bg-white hover:bg-gray-50 disabled:opacity-60 border border-gray-200 text-gray-800 font-semibold text-sm transition-all shadow-sm"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
      ) : (
        /* OpenAI logo mark SVG */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387 2.019-1.165a.076.076 0 0 1 .072 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.412-.666zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
            fill="currentColor"
          />
        </svg>
      )}
      Continuar com OpenAI
    </button>
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
  const [instance, setInstance] = useState<Instance | null>(null);
  const [token, setToken] = useState<string | null>(null);

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
      if (!session) { router.push("/login"); return; }
      setToken(session.access_token);

      const res = await fetch(`/api/instances/${session.user.id}`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      if (res.ok) {
        const inst = await res.json() as Instance;
        setInstance(inst);
        if (inst.status === "running") router.push("/dashboard");
        // Restore chatgpt_connected if already done
        if (inst.metadata?.chatgpt_connected) setChatgptConnected(true);
      }
    })();
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
  const startQRPolling = useCallback(() => {
    if (!instance?.id || !token) return;
    const poll = async () => {
      try {
        const data = await proxyCall("GET", instance.id, "qr", undefined, token);
        if (data.connected) {
          setQrConnected(true);
          if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
          setTimeout(() => setStep(4), 1500);
        } else if (data.qr) {
          setQrData(data.qr);
        }
      } catch { /* ignore */ }
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
        ...(personality ? { personality } : {}),
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
    if (aiMode === "byok") return apiKey.trim().length > 0;
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
        <StepDots current={step} total={5} />

        {/* ── Step 0: Escolha seu canal ── */}
        {step === 0 && (
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
        {step === 1 && (
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
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 text-sm transition-colors"
                      />
                      <p className="text-slate-500 text-xs mt-1">{selectedByokProvider.keyHint}</p>
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
        {step === 2 && (
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
        {step === 3 && (
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
        {step === 4 && (
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
              onClick={() => router.push("/dashboard")}
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

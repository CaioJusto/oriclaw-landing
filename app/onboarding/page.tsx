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
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type Channel = "whatsapp" | "telegram" | "discord";
type AIProvider = "anthropic" | "openai" | "google";

interface Instance {
  id: string;
  status: string;
  droplet_ip: string | null;
  plan: string;
  created_at: string;
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

// ── AI Provider options ──────────────────────────────────────────────────────
const AI_PROVIDERS = [
  {
    id: "anthropic" as AIProvider,
    label: "Claude",
    company: "Anthropic",
    placeholder: "sk-ant-api03-...",
    keyHint: "Começa com sk-ant-",
    model: "claude-sonnet-4-5",
    howToGet: "Acesse console.anthropic.com → API Keys → Create Key",
    link: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai" as AIProvider,
    label: "GPT-4",
    company: "OpenAI",
    placeholder: "sk-proj-...",
    keyHint: "Começa com sk-",
    model: "gpt-4o",
    howToGet: "Acesse platform.openai.com → API Keys → Create new secret key",
    link: "https://platform.openai.com/api-keys",
  },
  {
    id: "google" as AIProvider,
    label: "Gemini",
    company: "Google",
    placeholder: "AIza...",
    keyHint: "Começa com AIza",
    model: "gemini-1.5-pro",
    howToGet: "Acesse aistudio.google.com → Obter chave de API",
    link: "https://aistudio.google.com/app/apikey",
  },
] as const;

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

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [provider, setProvider] = useState<AIProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [assistantName, setAssistantName] = useState("Ori");
  const [personality, setPersonality] = useState("");
  const [showKeyHint, setShowKeyHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrConnected, setQrConnected] = useState(false);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth check + instance fetch ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) { router.push("/login"); return; }
      setToken(session.access_token);

      // Fetch instance
      const res = await fetch(`/api/instances/${session.user.id}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const inst = await res.json() as Instance;
        setInstance(inst);
        // If already running, skip to dashboard
        if (inst.status === "running") {
          router.push("/dashboard");
        }
      }
    })();
  }, [router]);

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
      } catch {
        // ignore polling errors
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
    if (!instance?.id || !token) return;
    setLoading(true);
    setError(null);
    try {
      const prov = AI_PROVIDERS.find((p) => p.id === provider)!;
      const body: Record<string, string> = {
        channel,
        model: prov.model,
        assistant_name: assistantName,
      };
      if (provider === "anthropic") body.anthropic_key = apiKey;
      else if (provider === "openai") body.openai_key = apiKey;
      else body.openai_key = apiKey; // Google uses openai-compat for now

      const result = await proxyCall("POST", instance.id, "configure", body, token);
      if (result.error) throw new Error(result.error);
      setStep(3); // go to QR step
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao configurar");
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = AI_PROVIDERS.find((p) => p.id === provider)!;

  // ── Render steps ───────────────────────────────────────────────────────────
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

        {/* ── Step 1: Escolha seu modelo de IA ── */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white text-center mb-2">Escolha sua IA</h1>
            <p className="text-slate-400 text-center mb-8">
              Qual modelo de inteligência artificial você quer usar?
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p.id); setApiKey(""); }}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                    provider === p.id
                      ? "bg-violet-600/20 border-violet-500 border-2"
                      : "bg-slate-900 border-slate-800 hover:border-slate-600"
                  }`}
                >
                  <span className="text-2xl">
                    {p.id === "anthropic" ? "🟠" : p.id === "openai" ? "⚫" : "🔵"}
                  </span>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">{p.label}</p>
                    <p className="text-slate-400 text-xs">{p.company}</p>
                  </div>
                  {provider === p.id && (
                    <CheckCircle className="w-4 h-4 text-violet-400" />
                  )}
                </button>
              ))}
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Cole sua chave de API aqui
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedProvider.placeholder}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 text-sm transition-colors"
              />
              <p className="text-slate-500 text-xs mt-2">{selectedProvider.keyHint}</p>
              <button
                onClick={() => setShowKeyHint(true)}
                className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-sm mt-3 transition-colors"
              >
                Como obter minha chave <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(0)}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!apiKey.trim()}
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
            <p className="text-slate-400 text-center mb-8">
              Como você quer que ele se chame?
            </p>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome do assistente
                </label>
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
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
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

        {/* ── Step 3: Conectar WhatsApp (QR) ── */}
        {step === 3 && (
          <div className="animate-fade-in text-center">
            <h1 className="text-3xl font-bold text-white mb-2">
              {channel === "whatsapp" ? "Conectar WhatsApp" : `Conectar ${channel}`}
            </h1>
            <p className="text-slate-400 mb-2">
              Escaneie o QR code com seu celular
            </p>
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
          </div>
        )}

        {/* ── Step 4: Pronto! ── */}
        {step === 4 && (
          <div className="animate-fade-in text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="text-3xl font-bold text-white mb-3">Seu assistente está no ar!</h1>
            <p className="text-slate-400 mb-2">
              <strong className="text-white">{assistantName}</strong> está pronto para responder no {channel === "whatsapp" ? "WhatsApp" : channel}.
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
              {AI_PROVIDERS.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border ${
                    provider === p.id
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
    </main>
  );
}

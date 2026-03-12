"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  CreditCard,
  RefreshCw,
  Eye,
  Settings,
  RotateCcw,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Server,
  LogOut,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Send,
  Hash,
  Zap,
  Key,
  ExternalLink,
  Trash2,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Instance {
  id: string;
  status: string;
  droplet_ip: string | null;
  plan: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface HealthData {
  status: string;
  openclaw: "running" | "stopped";
  uptime: number;
}

interface DetailedHealthData {
  openclaw: "running" | "stopped" | "crashed";
  uptime_seconds: number;
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  last_message_at: string | null;
  restart_count: number;
}

interface ChatUrlData {
  url: string;
  available: boolean;
}

type ChannelStatus = "connected" | "disconnected" | "not_configured" | "configured";

interface ChannelsData {
  whatsapp: { status: ChannelStatus; phone: string | null };
  telegram: { status: ChannelStatus; username: string | null };
  discord: { status: ChannelStatus; guild: string | null };
}

interface Props {
  instance: Instance;
  userEmail: string;
  token: string;
  onLogout: () => void;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function proxyCall(
  method: "GET" | "POST" | "DELETE",
  instanceId: string,
  action: string,
  token: string,
  body?: Record<string, unknown>
) {
  const res = await fetch(`/api/proxy/${instanceId}/${action}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ChannelStatus }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
        Conectado
      </span>
    );
  }
  if (status === "configured") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-400">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
        Configurado (verificar)
      </span>
    );
  }
  if (status === "disconnected") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Desconectado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
      Não configurado
    </span>
  );
}

// ── QR Modal (WhatsApp) ────────────────────────────────────────────────────────
const MAX_QR_ATTEMPTS_DASHBOARD = 60; // 60 × 3s = 3 minutes

function QRModal({
  instanceId,
  token,
  onClose,
}: {
  instanceId: string;
  token: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [qrGeneratedAt, setQrGeneratedAt] = useState<number | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrDashboardAttemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchQR = useCallback(async () => {
    qrDashboardAttemptsRef.current += 1;

    if (qrDashboardAttemptsRef.current > MAX_QR_ATTEMPTS_DASHBOARD) {
      stopPolling();
      setTimedOut(true);
      return;
    }

    try {
      const data = await proxyCall("GET", instanceId, "qr", token);
      if (data.connected) {
        setConnected(true);
        stopPolling();
      } else if (data.qr) {
        setQr(data.qr);
        setQrGeneratedAt(data.generated_at ?? Date.now());
        setQrExpired(false);
        setError(null);
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Erro ao buscar QR code");
    }
  }, [instanceId, token, stopPolling]);

  const retryPolling = useCallback(() => {
    qrDashboardAttemptsRef.current = 0;
    setTimedOut(false);
    setError(null);
    fetchQR();
    intervalRef.current = setInterval(fetchQR, 3000);
  }, [fetchQR]);

  useEffect(() => {
    fetchQR();
    intervalRef.current = setInterval(fetchQR, 3000);
    return () => stopPolling();
  }, [fetchQR, stopPolling]);

  useEffect(() => {
    if (connected) {
      const t = setTimeout(onClose, 2000);
      return () => clearTimeout(t);
    }
  }, [connected, onClose]);

  useEffect(() => {
    if (!qrGeneratedAt) return;
    const age = Date.now() - qrGeneratedAt;
    const remaining = 25_000 - age; // 25s de margem
    if (remaining <= 0) {
      setQrExpired(true);
      return;
    }
    setQrExpired(false);
    const timer = setTimeout(() => setQrExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [qrGeneratedAt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-semibold text-lg">Conectar WhatsApp</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-1">
          Abra o WhatsApp → Menu <span className="font-mono">⋮</span> → Dispositivos conectados → Conectar dispositivo
        </p>
        <p className="text-slate-500 text-xs mb-4">
          O QR code atualiza automaticamente a cada 3 segundos.
        </p>

        <div className="flex justify-center mb-4">
          {connected ? (
            <div className="w-56 h-56 rounded-2xl bg-green-500/10 border-2 border-green-500/40 flex flex-col items-center justify-center gap-3">
              <CheckCircle className="w-14 h-14 text-green-400" />
              <p className="text-green-400 font-semibold">✅ Conectado!</p>
            </div>
          ) : timedOut ? (
            <div className="w-56 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col items-center justify-center gap-2 px-4 py-6">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-red-400 text-sm text-center">Não foi possível carregar o QR Code. Tente novamente.</p>
              <button onClick={retryPolling} className="mt-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all">
                Tentar novamente
              </button>
            </div>
          ) : qr ? (
            <div className="flex flex-col items-center">
              <div className="p-2 bg-white rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code" className="w-52 h-52 rounded-lg" />
              </div>
              {qrExpired && (
                <p className="text-yellow-400 text-sm text-center mt-2">
                  ⚠️ QR expirado — aguardando novo código...
                </p>
              )}
            </div>
          ) : error ? (
            <div className="w-56 h-56 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-2 px-4">
              <AlertCircle className="w-10 h-10 text-slate-500" />
              <p className="text-slate-400 text-sm text-center">{error}</p>
              <button onClick={retryPolling} className="text-violet-400 text-sm hover:text-violet-300">
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="w-56 h-56 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
              <p className="text-slate-400 text-sm">Aguardando leitura...</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm">
          {connected ? (
            <span className="text-green-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Conectado! Fechando...
            </span>
          ) : (
            <span className="text-slate-500 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Aguardando leitura...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Telegram Modal ─────────────────────────────────────────────────────────────
function TelegramModal({
  instanceId,
  token,
  onClose,
  onConnected,
}: {
  instanceId: string;
  token: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [botToken, setBotToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!botToken.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await proxyCall("POST", instanceId, "channels/telegram", token, { token: botToken.trim() });
      if (result.error) throw new Error(result.error);
      setSuccess(true);
      setTimeout(() => { onConnected(); onClose(); }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao conectar Telegram");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-400" />
            <h3 className="text-white font-semibold text-lg">Conectar Telegram</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-800/60 rounded-xl p-3 mb-4 text-sm text-slate-400 leading-relaxed">
          <p className="font-medium text-slate-300 mb-1">Como criar um bot Telegram:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Abra o Telegram e procure por <span className="text-sky-400">@BotFather</span></li>
            <li>Envie <code className="bg-slate-700 px-1 rounded">/newbot</code> e siga as instruções</li>
            <li>Copie o <strong className="text-white">token</strong> que o BotFather enviar</li>
          </ol>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Token do bot Telegram</label>
          <input
            type="text"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456789:AAxxxxxx..."
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm transition-colors"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={!botToken.trim() || loading || success}
          className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
            : success ? <><CheckCircle className="w-4 h-4" /> Conectado!</>
            : "Conectar bot"}
        </button>
      </div>
    </div>
  );
}

// ── Discord Modal ──────────────────────────────────────────────────────────────
function DiscordModal({
  instanceId,
  token,
  onClose,
  onConnected,
}: {
  instanceId: string;
  token: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [botToken, setBotToken] = useState("");
  const [guildId, setGuildId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!botToken.trim()) return;
    if (!guildId?.trim()) {
      setError('ID do servidor (Guild ID) é obrigatório.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await proxyCall("POST", instanceId, "channels/discord", token, {
        token: botToken.trim(),
        guild_id: guildId.trim(),
      });
      if (result.error) throw new Error(result.error);
      setSuccess(true);
      setTimeout(() => { onConnected(); onClose(); }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao conectar Discord");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-indigo-400" />
            <h3 className="text-white font-semibold text-lg">Conectar Discord</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-800/60 rounded-xl p-3 mb-4 text-sm text-slate-400 leading-relaxed">
          <p className="font-medium text-slate-300 mb-1">Como criar um bot Discord:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Acesse <a href="https://discord.com/developers" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">discord.com/developers</a></li>
            <li>Crie uma aplicação → seção <strong className="text-white">Bot</strong> → gere o token</li>
            <li>Em <strong className="text-white">OAuth2</strong>, adicione o bot ao seu servidor</li>
            <li>Cole o <strong className="text-white">Token</strong> abaixo</li>
          </ol>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Token do bot Discord</label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="MTxxxxxx.xxxxxx..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ID do Servidor
            </label>
            <input
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="1234567890123456789"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-colors"
            />
            <p className="text-slate-500 text-xs mt-1">
              Clique com botão direito no servidor → Copiar ID do servidor
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={!botToken.trim() || loading || success}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
            : success ? <><CheckCircle className="w-4 h-4" /> Conectado!</>
            : "Conectar bot"}
        </button>
      </div>
    </div>
  );
}

// ── OpenAI OAuth button (reusable in Config modal) ────────────────────────────
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
      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-green-400 text-sm font-medium">ChatGPT Plus conectado</span>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          <span className="text-slate-300 text-sm">Aguardando autorização na janela OpenAI...</span>
        </div>
        <button onClick={handleConnect} className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1">
          <ExternalLink className="w-3 h-3" /> Abrir janela novamente
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-gray-50 disabled:opacity-60 border border-gray-200 text-gray-800 font-semibold text-sm transition-all shadow-sm"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387 2.019-1.165a.076.076 0 0 1 .072 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.412-.666zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor"/>
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
  const [selected, setSelected] = useState<20 | 50 | 100 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plans: { amount: 20 | 50 | 100; msgs: string }[] = [
    { amount: 20, msgs: "≈ 1.000 mensagens" },
    { amount: 50, msgs: "≈ 3.000 mensagens" },
    { amount: 100, msgs: "≈ 7.000 mensagens" },
  ];

  const handlePurchase = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_brl: selected }),
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
              onClick={() => setSelected(p.amount)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                selected === p.amount
                  ? "bg-violet-600/20 border-violet-500 border-2"
                  : "bg-slate-800 border-slate-700 hover:border-slate-600"
              }`}
            >
              <span className="text-white font-bold">R${p.amount}</span>
              <span className="text-slate-400 text-sm">{p.msgs}</span>
              {selected === p.amount && <CheckCircle className="w-4 h-4 text-violet-400 ml-2 flex-shrink-0" />}
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
          disabled={!selected || loading}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecionando...</>
            : "Pagar com Stripe"}
        </button>
      </div>
    </div>
  );
}

// ── Log Drawer ────────────────────────────────────────────────────────────────
function LogDrawer({ instanceId, token, onClose }: { instanceId: string; token: string; onClose: () => void }) {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    const data = await proxyCall("GET", instanceId, "logs", token);
    if (data.logs) {
      setLogs(data.logs);
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [instanceId, token]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-slate-900 rounded-t-2xl border border-slate-800 h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
          <h3 className="text-white font-semibold">Logs do Assistente</h3>
          <div className="flex gap-2">
            <button onClick={fetchLogs} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
          ) : (
            <pre className="text-green-400 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
              {logs || "Nenhum log disponível"}
            </pre>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// ── Health Metric Card ────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: "green" | "yellow" | "red" | "slate" }) {
  const colors = {
    green: "bg-green-500/10 border-green-500/30 text-green-400",
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    slate: "bg-slate-800/60 border-slate-700 text-slate-300",
  };
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1 ${colors[color]}`}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-lg font-bold">{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

function getMetricColor(value: number, warn = 70, crit = 90): "green" | "yellow" | "red" {
  if (value >= crit) return "red";
  if (value >= warn) return "yellow";
  return "green";
}

// ── Persona Config Modal ──────────────────────────────────────────────────────
function PersonaModal({
  instanceId,
  token,
  onClose,
}: {
  instanceId: string;
  token: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"personalidade" | "idioma" | "fuso">("personalidade");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [language, setLanguage] = useState("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (tab === "personalidade" && systemPrompt) body.system_prompt = systemPrompt;
      if (tab === "idioma") body.language = language;
      if (tab === "fuso") body.timezone = timezone;

      const result = await proxyCall("POST", instanceId, "configure", token, body);
      if (result.error) throw new Error(result.error);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "personalidade" as const, label: "Personalidade" },
    { id: "idioma" as const, label: "Idioma" },
    { id: "fuso" as const, label: "Fuso horário" },
  ];

  const languages = [
    { value: "pt-BR", label: "Português (BR)" },
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
  ];

  const timezones = [
    { value: "America/Sao_Paulo", label: "Brasília (UTC-3)" },
    { value: "America/Manaus", label: "Manaus (UTC-4)" },
    { value: "America/Belem", label: "Belém (UTC-3)" },
    { value: "America/Fortaleza", label: "Fortaleza (UTC-3)" },
    { value: "America/Recife", label: "Recife (UTC-3)" },
    { value: "America/Bahia", label: "Salvador (UTC-3)" },
    { value: "America/Cuiaba", label: "Cuiabá (UTC-4)" },
    { value: "America/Porto_Velho", label: "Porto Velho (UTC-4)" },
    { value: "America/Rio_Branco", label: "Rio Branco (UTC-5)" },
    { value: "America/Noronha", label: "Fernando de Noronha (UTC-2)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">⚙️ Configurar Assistente</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 p-1 bg-slate-800 rounded-xl mb-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null); setSuccess(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {tab === "personalidade" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Personalidade / Prompt do sistema
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                placeholder="Você é Ori, um assistente amigável e direto. Responda sempre em português..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 text-sm resize-none"
              />
              <p className="text-slate-500 text-xs mt-1">
                Define a personalidade e comportamento do seu assistente.
              </p>
            </div>
          )}

          {tab === "idioma" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Idioma padrão</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-600 text-sm"
              >
                {languages.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          )}

          {tab === "fuso" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Fuso horário</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-600 text-sm"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mt-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading || success}
          className="w-full mt-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-all"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : success ? <><CheckCircle className="w-4 h-4" /> Salvo!</>
            : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ── Config Modal ──────────────────────────────────────────────────────────────
function ConfigModal({
  instanceId,
  token,
  currentAiMode,
  onClose,
  onSaved,
}: {
  instanceId: string;
  token: string;
  currentAiMode?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"byok" | "credits" | "chatgpt">(
    currentAiMode === "credits" ? "credits" : currentAiMode === "chatgpt" ? "chatgpt" : "byok"
  );
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [chatgptConnected, setChatgptConnected] = useState(currentAiMode === "chatgpt");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelOptions = {
    anthropic: ["claude-sonnet-4-5", "claude-3-5-haiku-latest", "claude-opus-4-5"],
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};

      if (tab === "byok") {
        if (apiKey) body[provider === "anthropic" ? "anthropic_key" : "openai_key"] = apiKey;
        if (model) body.model = model;
      } else if (tab === "credits") {
        body.credits_mode = true;
        if (model) body.model = model;
      } else if (tab === "chatgpt") {
        body.chatgpt_mode = true;
        if (model) body.model = model;
      }

      const result = await proxyCall("POST", instanceId, "configure", token, body);
      if (result.error) throw new Error(result.error);
      setSuccess(true);
      setTimeout(() => { onSaved(); onClose(); }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "byok" as const, label: "Chave de API", icon: Key },
    { id: "credits" as const, label: "Créditos OriClaw", icon: CreditCard },
    { id: "chatgpt" as const, label: "ChatGPT Plus", icon: Zap },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">Trocar modelo / IA</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-800 rounded-xl mb-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* BYOK tab */}
          {tab === "byok" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Provedor de IA</label>
                <div className="flex gap-2">
                  {(["anthropic", "openai"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setProvider(p); setModel(""); }}
                      className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all border ${
                        provider === p
                          ? "bg-violet-600/20 border-violet-500 text-violet-300"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      {p === "anthropic" ? "Claude (Anthropic)" : "GPT (OpenAI)"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nova chave de API{" "}
                  <span className="text-slate-500 font-normal">(deixe em branco para manter)</span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Por segurança, sua chave atual não é exibida. Insira uma nova chave para substituir.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Modelo</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-600 text-sm"
                >
                  <option value="">Manter atual</option>
                  {modelOptions[provider].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Credits tab */}
          {tab === "credits" && (
            <div className="p-4 rounded-xl bg-violet-600/10 border border-violet-500/30">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-violet-400" />
                <p className="text-violet-300 font-medium text-sm">Créditos OriClaw</p>
              </div>
              <p className="text-slate-400 text-sm">
                Sem conta de IA necessária. O OriClaw usa nosso OpenRouter para você.
                Compre créditos no painel após salvar.
              </p>
            </div>
          )}

          {/* ChatGPT Plus tab */}
          {tab === "chatgpt" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-400">
                Conecte sua conta OpenAI com ChatGPT Plus para usar o GPT-4 sem chave de API.
              </div>
              <OpenAIConnectButton
                instanceId={instanceId}
                token={token}
                connected={chatgptConnected}
                onConnected={() => setChatgptConnected(true)}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mt-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading || success || (tab === "chatgpt" && !chatgptConnected)}
          className="w-full mt-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-all"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : success ? <><CheckCircle className="w-4 h-4" /> Salvo!</>
            : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}

// ── Channel Card ───────────────────────────────────────────────────────────────
function ChannelCard({
  name,
  icon: Icon,
  iconColor,
  status,
  info,
  onConfigure,
  onReconnect,
  onDisconnect,
}: {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  status: ChannelStatus;
  info: string | null;
  onConfigure: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-white font-medium text-sm">{name}</span>
      </div>

      <StatusBadge status={status} />

      {info && (
        <p className="text-slate-400 text-xs font-mono truncate">{info}</p>
      )}

      <div className="mt-auto">
        {(status === "connected" || status === "configured") ? (
          <button
            onClick={onDisconnect}
            className="w-full py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-all flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Desconectar
          </button>
        ) : status === "disconnected" ? (
          <button
            onClick={onReconnect}
            className="w-full py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs font-medium hover:bg-violet-600/30 transition-all"
          >
            Reconectar
          </button>
        ) : (
          <button
            onClick={onConfigure}
            className="w-full py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs font-medium hover:bg-violet-600/30 transition-all"
          >
            Configurar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function MainDashboard({ instance, userEmail, token, onLogout }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [detailedHealth, setDetailedHealth] = useState<DetailedHealthData | null>(null);
  const [chatUrlData, setChatUrlData] = useState<ChatUrlData | null>(null);
  const [chatEmbedOpen, setChatEmbedOpen] = useState(false);
  const [channels, setChannels] = useState<ChannelsData | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  const [showQR, setShowQR] = useState(false);
  const [showTelegram, setShowTelegram] = useState(false);
  const [showDiscord, setShowDiscord] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [pollingPaused, setPollingPaused] = useState(false);

  const [restarting, setRestarting] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [restartStatus, setRestartStatus] = useState<"idle" | "restarting" | "success" | "failed">("idle");
  const [showInstanceInfo, setShowInstanceInfo] = useState(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureCountRef = useRef(0);
  const pollIntervalMsRef = useRef(30_000);
  const pollingStoppedRef = useRef(false);

  const aiMode = (instance.metadata?.ai_mode as string | undefined) ?? "byok";
  const isCreditsMode = aiMode === "credits";
  const modelLabel = (instance.metadata?.model as string | undefined) ?? (
    aiMode === "credits" ? "OpenRouter" : aiMode === "chatgpt" ? "ChatGPT Plus" : "Claude"
  );

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const fetchHealth = useCallback(async (): Promise<boolean> => {
    try {
      const data = await proxyCall("GET", instance.id, "health", token);
      if (data?.error) {
        setHealth(null);
        return false;
      }
      setHealth(data);
      return true;
    } catch {
      setHealth(null);
      return false;
    }
    finally { setHealthLoading(false); }
  }, [instance.id, token]);

  const fetchDetailedHealth = useCallback(async () => {
    try {
      const data = await proxyCall("GET", instance.id, "health/detailed", token);
      if (!data.error) setDetailedHealth(data as DetailedHealthData);
    } catch { /* ignore */ }
  }, [instance.id, token]);

  const fetchChatUrl = useCallback(async () => {
    try {
      const data = await proxyCall("GET", instance.id, "chat-url", token);
      if (!data.error) setChatUrlData(data as ChatUrlData);
    } catch { /* ignore */ }
  }, [instance.id, token]);

  const fetchChannels = useCallback(async () => {
    try {
      const data = await proxyCall("GET", instance.id, "channels", token);
      if (!data.error) setChannels(data as ChannelsData);
    } catch { /* VPS may not have channels endpoint yet */ }
  }, [instance.id, token]);

  const fetchCredits = useCallback(async () => {
    if (!isCreditsMode) return;
    try {
      const res = await fetch("/api/credits", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.error) setCredits(data.balance_brl ?? 0);
    } catch { /* ignore */ }
  }, [isCreditsMode, token]);

  const clearPollingTimer = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const runHealthPollingCycle = useCallback(async () => {
    if (pollingStoppedRef.current) return;

    const healthOk = await fetchHealth();
    if (healthOk) {
      failureCountRef.current = 0;
      pollIntervalMsRef.current = 30_000;
      setPollingPaused(false);
      fetchDetailedHealth();
      fetchChannels();
    } else {
      failureCountRef.current += 1;

      if (failureCountRef.current >= 5) {
        pollingStoppedRef.current = true;
        setPollingPaused(true);
        clearPollingTimer();
        return;
      }

      if (failureCountRef.current >= 3) {
        pollIntervalMsRef.current = 60_000;
      }
    }

    pollTimeoutRef.current = setTimeout(runHealthPollingCycle, pollIntervalMsRef.current);
  }, [clearPollingTimer, fetchChannels, fetchDetailedHealth, fetchHealth]);

  const restartHealthPolling = useCallback(() => {
    pollingStoppedRef.current = false;
    failureCountRef.current = 0;
    pollIntervalMsRef.current = 30_000;
    setPollingPaused(false);
    clearPollingTimer();
    runHealthPollingCycle();
  }, [clearPollingTimer, runHealthPollingCycle]);

  useEffect(() => {
    fetchChatUrl();
    fetchCredits();
    restartHealthPolling();

    return () => {
      pollingStoppedRef.current = true;
      clearPollingTimer();
    };
  }, [fetchChatUrl, fetchCredits, restartHealthPolling, clearPollingTimer]);

  // ── Disconnect channel ─────────────────────────────────────────────────────
  const disconnectChannel = async (ch: string) => {
    await proxyCall("DELETE", instance.id, `channels/${ch}`, token);
    setTimeout(fetchChannels, 1000);
  };

  // ── Restart ────────────────────────────────────────────────────────────────
  const handleRestart = async () => {
    setRestarting(true);
    setRestartConfirm(false);
    setRestartStatus("restarting");
    try {
      const result = await proxyCall("POST", instance.id, "restart", token);
      if (result.error) throw new Error(result.error);

      // Poll health every 2s for up to 30s
      let attempts = 0;
      const maxAttempts = 15;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const h = await proxyCall("GET", instance.id, "health", token);
          if (h.openclaw === "running") {
            clearInterval(poll);
            setHealth(h);
            setRestartStatus("success");
            setRestarting(false);
            setTimeout(() => setRestartStatus("idle"), 4000);
            fetchDetailedHealth();
            return;
          }
        } catch { /* keep polling */ }
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setRestartStatus("failed");
          setRestarting(false);
          setTimeout(() => setRestartStatus("idle"), 6000);
        }
      }, 2000);
    } catch {
      setRestartStatus("failed");
      setRestarting(false);
      setTimeout(() => setRestartStatus("idle"), 6000);
    }
  };

  const isOnline = health?.openclaw === "running";

  return (
    <>
      {/* ── Navbar ── */}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">O</span>
            </div>
            <span className="text-white font-bold text-lg">OriClaw</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sair</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Status header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Painel</h1>
            <div className="flex items-center gap-2 mt-1">
              {healthLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400 shadow-sm shadow-green-400" : "bg-red-400"}`} />
              )}
              <span className={`text-sm ${isOnline ? "text-green-400" : "text-slate-400"}`}>
                {healthLoading ? "Verificando..." : isOnline
                  ? `Assistente online${health?.uptime ? ` · Uptime: ${formatUptime(health.uptime)}` : ""}`
                  : "Assistente offline"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPersona(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4" /> Configurar
            </button>
            <button
              onClick={() => setShowLogs(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition-colors"
            >
              <Eye className="w-4 h-4" /> Logs
            </button>
            <button
              onClick={() => setRestartConfirm(true)}
              disabled={restarting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition-colors disabled:opacity-50"
            >
              {restarting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RotateCcw className="w-4 h-4" />}
              {restarting ? "Reiniciando..." : "Reiniciar"}
            </button>
          </div>
        </div>

        {pollingPaused && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <span className="text-sm font-medium">
              Não foi possível conectar ao servidor. Clique para tentar novamente.
            </span>
            <button
              onClick={restartHealthPolling}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-sm font-medium transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── Restart toast ── */}
        {restartStatus === "success" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">✅ Assistente online!</span>
          </div>
        )}
        {restartStatus === "failed" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">❌ Falha ao reiniciar. Entre em contato com o suporte.</span>
          </div>
        )}
        {restartStatus === "restarting" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
            <span className="font-medium">Reiniciando... aguarde alguns segundos.</span>
          </div>
        )}

        {/* ── Main grid: Channels + AI ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Canais Conectados ── */}
          <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-slate-400" />
              <h2 className="text-white font-semibold">Canais Conectados</h2>
            </div>

            {channels ? (
              <div className="grid grid-cols-3 gap-3">
                <ChannelCard
                  name="WhatsApp"
                  icon={MessageCircle}
                  iconColor="text-green-400"
                  status={channels.whatsapp.status}
                  info={channels.whatsapp.phone}
                  onConfigure={() => setShowQR(true)}
                  onReconnect={() => setShowQR(true)}
                  onDisconnect={() => disconnectChannel("whatsapp")}
                />
                <ChannelCard
                  name="Telegram"
                  icon={Send}
                  iconColor="text-sky-400"
                  status={channels.telegram.status}
                  info={channels.telegram.username}
                  onConfigure={() => setShowTelegram(true)}
                  onReconnect={() => setShowTelegram(true)}
                  onDisconnect={() => disconnectChannel("telegram")}
                />
                <ChannelCard
                  name="Discord"
                  icon={Hash}
                  iconColor="text-indigo-400"
                  status={channels.discord.status}
                  info={channels.discord.guild}
                  onConfigure={() => setShowDiscord(true)}
                  onReconnect={() => setShowDiscord(true)}
                  onDisconnect={() => disconnectChannel("discord")}
                />
              </div>
            ) : (
              /* Fallback while channels API is loading or unavailable */
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <MessageCircle className="w-4 h-4 text-green-400" />
                  <span className="text-white text-sm">WhatsApp</span>
                  <button
                    onClick={() => setShowQR(true)}
                    className="ml-auto px-3 py-1 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-600/30 transition-all"
                  >
                    Reconectar
                  </button>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <Send className="w-4 h-4 text-sky-400" />
                  <span className="text-white text-sm">Telegram</span>
                  <button
                    onClick={() => setShowTelegram(true)}
                    className="ml-auto px-3 py-1 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-600/30 transition-all"
                  >
                    Configurar
                  </button>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <Hash className="w-4 h-4 text-indigo-400" />
                  <span className="text-white text-sm">Discord</span>
                  <button
                    onClick={() => setShowDiscord(true)}
                    className="ml-auto px-3 py-1 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-600/30 transition-all"
                  >
                    Configurar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Inteligência Artificial ── */}
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-slate-400" />
              <h2 className="text-white font-semibold">Inteligência Artificial</h2>
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Modo</span>
                <span className="text-white text-sm font-medium capitalize">
                  {aiMode === "byok" ? "Chave própria" : aiMode === "credits" ? "Créditos OriClaw" : "ChatGPT Plus"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Modelo</span>
                <span className="text-white text-sm font-mono">{modelLabel}</span>
              </div>

              {isCreditsMode && (
                <div className="p-3 rounded-xl bg-violet-600/10 border border-violet-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-xs">Créditos restantes</span>
                    <span className="text-violet-300 font-semibold text-sm">
                      {credits !== null
                        ? `R$ ${credits.toFixed(2).replace(".", ",")}`
                        : <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowPurchase(true)}
                    className="w-full py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs font-medium hover:bg-violet-600/30 transition-all"
                  >
                    💳 Comprar mais créditos
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowConfig(true)}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Settings className="w-4 h-4" /> Trocar modelo / chave
            </button>
          </div>
        </div>

        {/* ── Saúde da Instância ── */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h2 className="text-white font-semibold">Saúde da Instância</h2>
            </div>
            {detailedHealth && (
              <div className="flex items-center gap-2">
                {detailedHealth.openclaw === "running" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> 🟢 Rodando
                  </span>
                ) : detailedHealth.openclaw === "crashed" || detailedHealth.restart_count > 3 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded-full">
                    ⚠️ Travado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-1 rounded-full">
                    🔴 Parado
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Crash/stuck warning banner */}
          {detailedHealth && (detailedHealth.openclaw === "crashed" || detailedHealth.restart_count > 3) && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 mb-4">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Seu assistente pode estar com problemas ({detailedHealth.restart_count} reinicializações)</span>
              </div>
              <button
                onClick={() => setRestartConfirm(true)}
                disabled={restarting}
                className="px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-medium hover:bg-yellow-500/30 transition-all flex-shrink-0 ml-3"
              >
                Reiniciar agora
              </button>
            </div>
          )}

          {detailedHealth ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="CPU"
                value={`${detailedHealth.cpu_percent}%`}
                color={getMetricColor(detailedHealth.cpu_percent)}
              />
              <MetricCard
                label="RAM"
                value={`${detailedHealth.ram_used_mb} MB`}
                sub={`de ${detailedHealth.ram_total_mb} MB`}
                color={getMetricColor(detailedHealth.ram_total_mb > 0 ? (detailedHealth.ram_used_mb / detailedHealth.ram_total_mb) * 100 : 0)}
              />
              <MetricCard
                label="Disco"
                value={`${detailedHealth.disk_used_gb.toFixed(1)} GB`}
                sub={`de ${detailedHealth.disk_total_gb.toFixed(1)} GB`}
                color={getMetricColor(detailedHealth.disk_total_gb > 0 ? (detailedHealth.disk_used_gb / detailedHealth.disk_total_gb) * 100 : 0)}
              />
              <MetricCard
                label="Uptime"
                value={formatUptime(detailedHealth.uptime_seconds)}
                sub={`${detailedHealth.restart_count} reinic.`}
                color={detailedHealth.restart_count > 3 ? "yellow" : "slate"}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["CPU", "RAM", "Disco", "Uptime"].map((l) => (
                <div key={l} className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 animate-pulse">
                  <div className="h-3 w-10 bg-slate-700 rounded mb-2" />
                  <div className="h-5 w-16 bg-slate-700 rounded" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Chat Direto ── */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-slate-400" />
            <h2 className="text-white font-semibold">💬 Chat com seu assistente</h2>
          </div>

          {chatUrlData?.available ? (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Converse diretamente com o Ori pelo navegador, sem WhatsApp.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={chatUrlData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all"
                >
                  <ExternalLink className="w-4 h-4" /> Abrir chat →
                </a>
                <button
                  onClick={() => setChatEmbedOpen((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium transition-all"
                >
                  {chatEmbedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {chatEmbedOpen ? "▲ Fechar" : "▼ Abrir aqui"}
                </button>
              </div>
              {chatEmbedOpen && (
                <div className="rounded-xl overflow-hidden border border-slate-700">
                  <iframe
                    src={chatUrlData.url}
                    className="w-full h-[600px]"
                    title="OpenClaw Chat"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Interface de chat não disponível. Inicie o assistente primeiro.
            </div>
          )}
        </div>

        {/* ── Instance info ── */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <button
            onClick={() => setShowInstanceInfo((v) => !v)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Server className="w-4 h-4 text-slate-400" />
              <h2 className="text-white font-semibold">Informações da instância</h2>
            </div>
            {showInstanceInfo ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showInstanceInfo && (
            <div className="border-t border-slate-800 p-6">
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <dt className="text-slate-500 text-xs mb-1">IP</dt>
                  <dd className="text-white font-mono text-sm">{instance.droplet_ip ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs mb-1">Plano</dt>
                  <dd className="text-violet-400 text-sm capitalize">{instance.plan}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs mb-1">Criado em</dt>
                  <dd className="text-white text-sm">{formatDate(instance.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs mb-1">Uptime</dt>
                  <dd className="text-white text-sm">
                    {health?.uptime !== undefined ? formatUptime(health.uptime) : "–"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* ── Restart confirm dialog ── */}
      {restartConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              <h3 className="text-white font-semibold">Reiniciar o assistente?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Ele ficará offline por ~10 segundos enquanto reinicia.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRestartConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all">
                Cancelar
              </button>
              <button onClick={handleRestart} className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 font-medium transition-all">
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showQR && (
        <QRModal instanceId={instance.id} token={token} onClose={() => { setShowQR(false); fetchChannels(); }} />
      )}
      {showTelegram && (
        <TelegramModal
          instanceId={instance.id}
          token={token}
          onClose={() => setShowTelegram(false)}
          onConnected={fetchChannels}
        />
      )}
      {showDiscord && (
        <DiscordModal
          instanceId={instance.id}
          token={token}
          onClose={() => setShowDiscord(false)}
          onConnected={fetchChannels}
        />
      )}
      {showLogs && (
        <LogDrawer instanceId={instance.id} token={token} onClose={() => setShowLogs(false)} />
      )}
      {showConfig && (
        <ConfigModal
          instanceId={instance.id}
          token={token}
          currentAiMode={aiMode}
          onClose={() => setShowConfig(false)}
          onSaved={fetchHealth}
        />
      )}
      {showPersona && (
        <PersonaModal
          instanceId={instance.id}
          token={token}
          onClose={() => setShowPersona(false)}
        />
      )}
      {showPurchase && (
        <PurchaseModal
          token={token}
          onClose={() => setShowPurchase(false)}
        />
      )}
    </>
  );
}

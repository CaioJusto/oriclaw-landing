"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  Wifi,
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

interface Props {
  instance: Instance;
  userEmail: string;
  token: string;
  onLogout: () => void;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function proxyCall(
  method: "GET" | "POST",
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

// ── QR Modal ───────────────────────────────────────────────────────────────────
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQR = useCallback(async () => {
    try {
      const data = await proxyCall("GET", instanceId, "qr", token);
      if (data.connected) {
        setConnected(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else if (data.qr) {
        setQr(data.qr);
        setError(null);
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Erro ao buscar QR code");
    }
  }, [instanceId, token]);

  useEffect(() => {
    fetchQR();
    intervalRef.current = setInterval(fetchQR, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchQR]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Conectar WhatsApp</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Abra o WhatsApp → Menu → Dispositivos Conectados → Conectar dispositivo
        </p>

        <div className="flex justify-center mb-4">
          {connected ? (
            <div className="w-56 h-56 rounded-2xl bg-green-500/10 border-2 border-green-500/40 flex flex-col items-center justify-center gap-3">
              <CheckCircle className="w-14 h-14 text-green-400" />
              <p className="text-green-400 font-semibold">Conectado!</p>
            </div>
          ) : qr ? (
            <div className="p-2 bg-white rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Code" className="w-52 h-52 rounded-lg" />
            </div>
          ) : error ? (
            <div className="w-56 h-56 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-2 px-4">
              <AlertCircle className="w-10 h-10 text-slate-500" />
              <p className="text-slate-400 text-sm text-center">{error}</p>
              <button
                onClick={fetchQR}
                className="text-violet-400 text-sm hover:text-violet-300"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="w-56 h-56 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
              <p className="text-slate-400 text-sm">Carregando QR...</p>
            </div>
          )}
        </div>

        <p className="text-slate-500 text-xs text-center">
          O QR code atualiza automaticamente a cada 3 segundos
        </p>
      </div>
    </div>
  );
}

// ── Log Drawer ────────────────────────────────────────────────────────────────
function LogDrawer({
  instanceId,
  token,
  onClose,
}: {
  instanceId: string;
  token: string;
  onClose: () => void;
}) {
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
            <button
              onClick={fetchLogs}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
            >
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

// ── Config Modal ──────────────────────────────────────────────────────────────
function ConfigModal({
  instanceId,
  token,
  onClose,
  onSaved,
}: {
  instanceId: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
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
      const body: Record<string, string> = {};
      if (apiKey) body[provider === "anthropic" ? "anthropic_key" : "openai_key"] = apiKey;
      if (model) body.model = model;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold text-lg">Configurações</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
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

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={loading || success}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-all"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : success ? (
              <><CheckCircle className="w-4 h-4" /> Salvo!</>
            ) : (
              "Salvar configurações"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function MainDashboard({ instance, userEmail, token, onLogout }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [showInstanceInfo, setShowInstanceInfo] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await proxyCall("GET", instance.id, "health", token);
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, [instance.id, token]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleRestart = async () => {
    setRestarting(true);
    setRestartConfirm(false);
    try {
      await proxyCall("POST", instance.id, "restart", token);
      setTimeout(fetchHealth, 3000);
    } catch {
      // ignore
    } finally {
      setRestarting(false);
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
        <div>
          <h1 className="text-2xl font-bold text-white">Painel</h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie seu assistente de IA</p>
        </div>

        {/* ── Status cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Status card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-slate-400" />
              <p className="text-slate-400 text-sm">Status</p>
            </div>
            {healthLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                <span className="text-slate-400 text-sm">Verificando...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-green-400 shadow-sm shadow-green-400" : "bg-red-400"}`} />
                  <span className={`font-semibold ${isOnline ? "text-green-400" : "text-red-400"}`}>
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </div>
                {health?.uptime !== undefined && isOnline && (
                  <p className="text-slate-500 text-xs">Uptime: {formatUptime(health.uptime)}</p>
                )}
                {!isOnline && (
                  <button
                    onClick={() => setRestartConfirm(true)}
                    disabled={restarting}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs font-medium hover:bg-violet-600/30 transition-all disabled:opacity-50"
                  >
                    {restarting ? "Reiniciando..." : "Reiniciar"}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Canal card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="w-4 h-4 text-slate-400" />
              <p className="text-slate-400 text-sm">Canal</p>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-white font-semibold">WhatsApp</span>
            </div>
            <button
              onClick={() => setShowQR(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
            >
              Reconectar
            </button>
          </div>

          {/* Plano card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <p className="text-slate-400 text-sm">Plano</p>
            </div>
            <p className="text-violet-400 font-semibold capitalize mb-3">{instance.plan}</p>
            <button className="px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs font-medium hover:bg-violet-600/30 transition-all">
              Fazer upgrade
            </button>
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="text-white font-semibold mb-4">Ações rápidas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setShowQR(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all group"
            >
              <Wifi className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
              <span className="text-slate-300 text-sm text-center">Reconectar WhatsApp</span>
            </button>

            <button
              onClick={() => setShowConfig(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all group"
            >
              <Settings className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
              <span className="text-slate-300 text-sm text-center">Trocar modelo de IA</span>
            </button>

            <button
              onClick={() => setShowLogs(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all group"
            >
              <Eye className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
              <span className="text-slate-300 text-sm text-center">Ver logs</span>
            </button>

            <button
              onClick={() => setRestartConfirm(true)}
              disabled={restarting}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all group disabled:opacity-50"
            >
              {restarting ? (
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              ) : (
                <RotateCcw className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-slate-300 text-sm text-center">Reiniciar assistente</span>
            </button>
          </div>
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
            {showInstanceInfo ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
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
              <h3 className="text-white font-semibold">Reiniciar assistente?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              O assistente ficará indisponível por alguns segundos enquanto reinicia.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRestartConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestart}
                className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 font-medium transition-all"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showQR && (
        <QRModal instanceId={instance.id} token={token} onClose={() => setShowQR(false)} />
      )}
      {showLogs && (
        <LogDrawer instanceId={instance.id} token={token} onClose={() => setShowLogs(false)} />
      )}
      {showConfig && (
        <ConfigModal
          instanceId={instance.id}
          token={token}
          onClose={() => setShowConfig(false)}
          onSaved={fetchHealth}
        />
      )}
    </>
  );
}

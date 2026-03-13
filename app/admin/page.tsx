"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Activity,
  Server,
  Loader2,
  Save,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  Zap,
  DollarSign,
  BarChart3,
  CheckCircle,
  XCircle,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────
interface AdminSettings {
  default_model: string;
  cost_multiplier: number;
  openrouter_key_configured: boolean;
  updated_at: string | null;
}

interface UsageTotals {
  total_tokens: number;
  cost_usd: number;
  cost_brl: number;
  messages: number;
}

interface UsageByDay {
  [day: string]: { tokens: number; cost_usd: number; cost_brl: number; messages: number };
}

interface TopUser {
  customer_id: string;
  tokens: number;
  cost_brl: number;
  messages: number;
}

interface UsageData {
  totals: UsageTotals;
  byDay: UsageByDay;
  topUsers: TopUser[];
  period: string;
}

interface AdminInstance {
  id: string;
  email: string;
  plan: string;
  status: string;
  ai_mode: string;
  balance_brl: number;
  droplet_ip: string | null;
  created_at: string;
}

interface ModelOption {
  id: string;
  name: string;
  pricing: { prompt: number; completion: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function statusColor(status: string): string {
  switch (status) {
    case "running": return "text-green-400";
    case "provisioning": return "text-yellow-400";
    case "suspended": return "text-red-400";
    case "error": return "text-red-500";
    default: return "text-slate-400";
  }
}

function aiModeLabel(mode: string): string {
  switch (mode) {
    case "credits": return "Creditos OriClaw";
    case "byok": return "BYOK";
    case "chatgpt": return "ChatGPT";
    default: return mode || "\u2014";
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "usage" | "instances">("settings");

  // Settings state
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [editModel, setEditModel] = useState("");
  const [editMultiplier, setEditMultiplier] = useState("2.0");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Usage state
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usagePeriod, setUsagePeriod] = useState("7d");

  // Instances state
  const [instances, setInstances] = useState<AdminInstance[]>([]);

  // ── Auth — session check + listener ────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login?next=/admin");
      } else if (event === "TOKEN_REFRESHED" && session) {
        setToken(session.access_token);
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?next=/admin");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?next=/admin");
        return;
      }
      setUserEmail(session.user.email ?? null);
      setToken(session.access_token);
    })();
  }, [router]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    await supabase.auth.signOut();
    router.replace("/login?next=/admin");
  };

  // ── API helper ────────────────────────────────────────────────────────────
  const adminFetch = useCallback(
    async (path: string, opts?: RequestInit) => {
      if (!token) return null;
      const res = await fetch(`/api/admin/${path}`, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(opts?.headers ?? {}),
        },
      });
      if (res.status === 403) {
        setForbidden(true);
        return null;
      }
      if (!res.ok) return null;
      return res.json();
    },
    [token]
  );

  // ── Load settings + models ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    (async () => {
      const [s, m] = await Promise.all([adminFetch("settings"), adminFetch("models")]);
      if (s) {
        setSettings(s);
        setEditModel(s.default_model);
        setEditMultiplier(String(s.cost_multiplier));
      }
      if (m?.models) setModels(m.models);
      setLoading(false);
    })();
  }, [token, adminFetch]);

  // ── Load usage ────────────────────────────────────────────────────────────
  const loadUsage = useCallback(async () => {
    const data = await adminFetch(`usage?period=${usagePeriod}`);
    if (data) setUsage(data);
  }, [adminFetch, usagePeriod]);

  useEffect(() => {
    if (activeTab === "usage" && token) loadUsage();
  }, [activeTab, token, loadUsage]);

  // ── Load instances ────────────────────────────────────────────────────────
  const loadInstances = useCallback(async () => {
    const data = await adminFetch("instances");
    if (data?.instances) setInstances(data.instances);
  }, [adminFetch]);

  useEffect(() => {
    if (activeTab === "instances" && token) loadInstances();
  }, [activeTab, token, loadInstances]);

  // ── Save settings ─────────────────────────────────────────────────────────
  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    await adminFetch("settings", {
      method: "PUT",
      body: JSON.stringify({
        default_model: editModel,
        cost_multiplier: parseFloat(editMultiplier),
      }),
    });
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // ── Forbidden — not superadmin ─────────────────────────────────────────────
  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-950">
        {/* Navbar even on forbidden — so user can logout */}
        <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">🦀</span>
              <span className="text-white font-bold text-lg">OriClaw</span>
            </Link>
            <div className="flex items-center gap-3">
              {userEmail && (
                <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>
              )}
              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm transition-colors"
              >
                {logoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span className="hidden sm:block">Sair</span>
              </button>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 4rem)" }}>
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h1>
            <p className="text-slate-400 mb-6">Apenas o superadmin pode acessar esta pagina.</p>
            <Link href="/dashboard" className="text-red-400 hover:text-red-300 underline">
              Voltar ao Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { key: "settings" as const, label: "Configuracoes", icon: Settings },
    { key: "usage" as const, label: "Consumo", icon: BarChart3 },
    { key: "instances" as const, label: "Instancias", icon: Server },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar — same style as dashboard */}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">🦀</span>
              <span className="text-white font-bold text-lg">OriClaw</span>
            </Link>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-red-400">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>
            )}
            <Link
              href="/dashboard"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors hidden sm:block"
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm transition-colors"
            >
              {logoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              <span className="hidden sm:block">Sair</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-red-500 text-red-400"
                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Settings Tab ─────────────────────────────────────────────────── */}
        {activeTab === "settings" && settings && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-red-400" />
                Configuracoes Globais
              </h2>

              <div className="space-y-5">
                {/* Model selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Modelo Padrao OpenRouter
                  </label>
                  <select
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {models.length > 0 ? (
                      models
                        .filter((m) => m.pricing.prompt > 0)
                        .sort((a, b) => a.id.localeCompare(b.id))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — ${(m.pricing.prompt * 1_000_000).toFixed(2)}/M prompt
                          </option>
                        ))
                    ) : (
                      <option value={editModel}>{editModel}</option>
                    )}
                  </select>
                </div>

                {/* Cost multiplier */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Multiplicador de Custo
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="0.1"
                      value={editMultiplier}
                      onChange={(e) => setEditMultiplier(e.target.value)}
                      className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <span className="text-sm text-slate-400">
                      Custo real x{editMultiplier} = preco cobrado do usuario
                    </span>
                  </div>
                </div>

                {/* OpenRouter key status */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Chave OpenRouter
                  </label>
                  <div className="flex items-center gap-2">
                    {settings.openrouter_key_configured ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm">Configurada</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 text-sm">Nao configurada</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Save button */}
                <div className="pt-2">
                  <button
                    onClick={saveSettings}
                    disabled={savingSettings}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                  >
                    {savingSettings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar
                  </button>
                  {settingsSaved && (
                    <p className="text-green-400 text-sm mt-2">Configuracoes salvas!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Usage Tab ────────────────────────────────────────────────────── */}
        {activeTab === "usage" && (
          <div className="space-y-6">
            {/* Period selector + refresh */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {["1d", "7d", "30d"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setUsagePeriod(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      usagePeriod === p
                        ? "bg-red-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p === "1d" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
                  </button>
                ))}
              </div>
              <button
                onClick={loadUsage}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>
            </div>

            {usage ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <Zap className="w-4 h-4" />
                      Tokens
                    </div>
                    <p className="text-2xl font-bold">{formatNumber(usage.totals.total_tokens)}</p>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <Activity className="w-4 h-4" />
                      Mensagens
                    </div>
                    <p className="text-2xl font-bold">{formatNumber(usage.totals.messages)}</p>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <DollarSign className="w-4 h-4" />
                      Custo Real (USD)
                    </div>
                    <p className="text-2xl font-bold">{formatUSD(usage.totals.cost_usd)}</p>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <TrendingUp className="w-4 h-4" />
                      Receita (BRL)
                    </div>
                    <p className="text-2xl font-bold text-green-400">
                      {formatBRL(usage.totals.cost_brl)}
                    </p>
                  </div>
                </div>

                {/* Margin card */}
                {usage.totals.cost_usd > 0 && (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <TrendingUp className="w-4 h-4" />
                      Margem estimada
                    </div>
                    <p className="text-xl font-bold text-green-400">
                      {formatBRL(usage.totals.cost_brl - usage.totals.cost_usd * 5.5)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Receita BRL - Custo real convertido (USD x 5.5)
                    </p>
                  </div>
                )}

                {/* Usage by day table */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="font-medium flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-red-400" />
                      Consumo por Dia
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="text-left px-4 py-3 font-medium">Data</th>
                          <th className="text-right px-4 py-3 font-medium">Mensagens</th>
                          <th className="text-right px-4 py-3 font-medium">Tokens</th>
                          <th className="text-right px-4 py-3 font-medium">Custo USD</th>
                          <th className="text-right px-4 py-3 font-medium">Receita BRL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(usage.byDay)
                          .sort(([a], [b]) => b.localeCompare(a))
                          .map(([day, d]) => (
                            <tr key={day} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-mono">{day}</td>
                              <td className="px-4 py-3 text-right">{formatNumber(d.messages)}</td>
                              <td className="px-4 py-3 text-right">{formatNumber(d.tokens)}</td>
                              <td className="px-4 py-3 text-right">{formatUSD(d.cost_usd)}</td>
                              <td className="px-4 py-3 text-right text-green-400">
                                {formatBRL(d.cost_brl)}
                              </td>
                            </tr>
                          ))}
                        {Object.keys(usage.byDay).length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                              Nenhum consumo registrado no periodo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top users */}
                {usage.topUsers.length > 0 && (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800">
                      <h3 className="font-medium flex items-center gap-2">
                        <Users className="w-4 h-4 text-red-400" />
                        Top Usuarios por Consumo
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800">
                            <th className="text-left px-4 py-3 font-medium">#</th>
                            <th className="text-left px-4 py-3 font-medium">Customer ID</th>
                            <th className="text-right px-4 py-3 font-medium">Mensagens</th>
                            <th className="text-right px-4 py-3 font-medium">Tokens</th>
                            <th className="text-right px-4 py-3 font-medium">Gasto BRL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usage.topUsers.map((u, i) => (
                            <tr key={u.customer_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                              <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                              <td className="px-4 py-3 font-mono text-xs">{u.customer_id.slice(0, 8)}...</td>
                              <td className="px-4 py-3 text-right">{formatNumber(u.messages)}</td>
                              <td className="px-4 py-3 text-right">{formatNumber(u.tokens)}</td>
                              <td className="px-4 py-3 text-right text-green-400">{formatBRL(u.cost_brl)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* ── Instances Tab ────────────────────────────────────────────────── */}
        {activeTab === "instances" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Server className="w-5 h-5 text-red-400" />
                Todas as Instancias
              </h2>
              <button
                onClick={loadInstances}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="text-left px-4 py-3 font-medium">Email</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Plano</th>
                      <th className="text-left px-4 py-3 font-medium">Modo IA</th>
                      <th className="text-right px-4 py-3 font-medium">Saldo</th>
                      <th className="text-left px-4 py-3 font-medium">IP</th>
                      <th className="text-left px-4 py-3 font-medium">Criado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.map((inst) => (
                      <tr key={inst.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3">{inst.email || "\u2014"}</td>
                        <td className={`px-4 py-3 font-medium ${statusColor(inst.status)}`}>
                          {inst.status}
                        </td>
                        <td className="px-4 py-3 capitalize">{inst.plan}</td>
                        <td className="px-4 py-3">{aiModeLabel(inst.ai_mode)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatBRL(inst.balance_brl)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">
                          {inst.droplet_ip || "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {new Date(inst.created_at).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                    {instances.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Nenhuma instancia encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

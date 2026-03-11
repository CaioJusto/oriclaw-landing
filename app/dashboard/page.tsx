"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Server,
  Wifi,
  Key,
  Activity,
  MessageCircle,
  X,
  LogOut,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

type InstanceStatus = "Running" | "Provisioning" | "Stopped";

const statusColors: Record<InstanceStatus, string> = {
  Running: "text-green-400 bg-green-400/10 border-green-400/20",
  Provisioning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Stopped: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

const mockInstance = {
  name: "minha-instancia-openclaw",
  status: "Running" as InstanceStatus,
  ip: "167.71.42.100",
  plan: "Pro",
};

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState("anthropic");
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUserEmail(session.user.email ?? null);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000));
    setSavingKey(false);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950">
      {/* Top navbar */}
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
              onClick={handleLogout}
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
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie sua instância OpenClaw</p>
        </div>

        {/* Instance status card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-violet-400" />
            <h2 className="text-white font-semibold">Sua Instância</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-500 text-xs mb-1">Nome</p>
              <p className="text-white text-sm font-medium">{mockInstance.name}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Status</p>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[mockInstance.status]}`}
              >
                {mockInstance.status}
              </span>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">IP</p>
              <p className="text-white text-sm font-medium font-mono">{mockInstance.ip}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Plano</p>
              <p className="text-violet-400 text-sm font-medium">{mockInstance.plan}</p>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => setShowQRModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all shadow-lg shadow-violet-600/20"
            >
              <Wifi className="w-4 h-4" />
              Conectar WhatsApp
            </button>
          </div>
        </div>

        {/* API Key section */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-violet-400" />
            <h2 className="text-white font-semibold">Sua Chave de API</h2>
          </div>

          <form onSubmit={handleSaveKey} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Provedor</label>
              <select
                value={apiProvider}
                onChange={(e) => setApiProvider(e.target.value)}
                className="w-full sm:w-48 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-600 text-sm"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Chave de API</label>
              <div className="flex gap-3">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiProvider === "anthropic" ? "sk-ant-..." : apiProvider === "openai" ? "sk-..." : "AIza..."}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 text-sm transition-colors"
                />
                <button
                  type="submit"
                  disabled={savingKey || !apiKey}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center gap-2"
                >
                  {savingKey ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : keySaved ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Salvo!
                    </>
                  ) : (
                    "Salvar"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Server status */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-violet-400" />
            <h2 className="text-white font-semibold">Status do Servidor</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <p className="text-slate-400 text-xs mb-1">Uptime</p>
              <p className="text-white text-xl font-bold">99.9%</p>
              <p className="text-slate-500 text-xs mt-1">Últimos 30 dias</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <p className="text-slate-400 text-xs mb-1">RAM em uso</p>
              <div className="flex items-end gap-2">
                <p className="text-white text-xl font-bold">1.2 GB</p>
                <p className="text-slate-400 text-sm mb-0.5">/ 4 GB</p>
              </div>
              <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full w-[30%] bg-violet-600 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-violet-400" />
              <div>
                <h2 className="text-white font-semibold">Suporte</h2>
                <p className="text-slate-400 text-sm mt-0.5">Precisa de ajuda? Fale com a gente.</p>
              </div>
            </div>
            <a
              href="mailto:suporte@oriclaw.com.br"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors border border-slate-700"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir ticket
            </a>
          </div>
        </div>
      </div>

      {/* WhatsApp QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-lg">Conectar WhatsApp</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 text-sm mb-6">
              Escaneie o QR code abaixo com o WhatsApp para conectar sua instância.
            </p>

            {/* QR placeholder */}
            <div className="aspect-square bg-white rounded-xl flex items-center justify-center mb-6">
              <div className="text-center">
                <div className="w-32 h-32 bg-slate-200 rounded-lg mx-auto flex items-center justify-center">
                  <AlertCircle className="w-12 h-12 text-slate-400" />
                </div>
                <p className="text-slate-500 text-xs mt-2">QR Code (placeholder)</p>
              </div>
            </div>

            <p className="text-slate-500 text-xs text-center">
              O QR code expira em 60 segundos. Recarregue se necessário.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

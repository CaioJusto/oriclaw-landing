"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, Server, Clock } from "lucide-react";
import dynamic from "next/dynamic";

const MainDashboard = dynamic(() => import("./components/MainDashboard"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Instance {
  id: string;
  status: string;
  droplet_ip: string | null;
  plan: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// ── Provisioning Screen ───────────────────────────────────────────────────────
function ProvisioningScreen() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-6">
          <Server className="w-8 h-8 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Preparando seu servidor</h1>
        <p className="text-slate-400 mb-8">
          Estamos criando e configurando sua instância na nuvem. Isso leva entre 1 e 3 minutos.
        </p>

        {/* Animated progress bar */}
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-violet-600 rounded-full animate-[progress_2s_ease-in-out_infinite]" />
        </div>

        <div className="space-y-3 text-left bg-slate-900 rounded-2xl border border-slate-800 p-5">
          {[
            { label: "Criando servidor", done: true },
            { label: "Instalando OpenClaw", done: true },
            { label: "Configurando serviços", done: false },
            { label: "Aguardando sua configuração", done: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {step.done ? (
                <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3 h-3 text-slate-500" />
                </div>
              )}
              <span className={`text-sm ${step.done ? "text-slate-300" : "text-slate-500"}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-slate-500 text-sm mt-6 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Esta página atualiza automaticamente
        </p>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </main>
  );
}

// ── Dashboard Page (router) ───────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const fetchInstance = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/instances/${userId}`);
      if (res.ok) return await res.json() as Instance;
    } catch {}
    return null;
  }, []);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      setUserEmail(session.user.email ?? null);
      setToken(session.access_token);

      const inst = await fetchInstance(session.user.id);
      setInstance(inst);
      setLoading(false);

      // Route based on status
      if (!inst) {
        router.push("/"); // no instance — back to landing
        return;
      }

      if (inst.status === "needs_config") {
        router.push("/onboarding");
        return;
      }

      // Poll while provisioning
      if (inst.status === "provisioning") {
        pollInterval = setInterval(async () => {
          const updated = await fetchInstance(session.user.id);
          if (updated && updated.status !== "provisioning") {
            if (pollInterval) clearInterval(pollInterval);
            setInstance(updated);
            if (updated.status === "needs_config") {
              router.push("/onboarding");
            }
          }
        }, 10_000);
      }
    };

    init();
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [router, fetchInstance]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </main>
    );
  }

  if (!instance || instance.status === "provisioning") {
    return <ProvisioningScreen />;
  }

  if (instance.status === "running" || instance.status === "suspended") {
    return (
      <main className="min-h-screen bg-slate-950">
        <MainDashboard
          instance={instance}
          userEmail={userEmail ?? ""}
          token={token ?? ""}
          onLogout={handleLogout}
        />
      </main>
    );
  }

  // Fallback
  return <ProvisioningScreen />;
}

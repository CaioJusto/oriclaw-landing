"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, Server, Clock, AlertTriangle, Settings } from "lucide-react";
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

// ── Checkout Processing Screen ────────────────────────────────────────────────
function CheckoutProcessingScreen({ timedOut }: { timedOut: boolean }) {
  if (timedOut) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Problema ao processar</h1>
          <p className="text-slate-400">
            Houve um problema ao processar seu pagamento. Entre em contato:{" "}
            <a href="mailto:suporte@oriclaw.com.br" className="text-violet-400 hover:text-violet-300 transition-colors">
              suporte@oriclaw.com.br
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Processando seu pagamento...</h1>
        <p className="text-slate-400">
          Aguarde enquanto confirmamos sua compra. Isso pode levar alguns segundos.
        </p>
      </div>
    </main>
  );
}

// ── Suspended Screen ──────────────────────────────────────────────────────────
function SuspendedScreen({ title, message, showSupportButton = true, extraAction }: {
  title: string;
  message: string;
  showSupportButton?: boolean;
  extraAction?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-yellow-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex flex-col gap-3">
          {extraAction}
          {showSupportButton && (
            <a
              href="mailto:suporte@oriclaw.com.br"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all shadow-lg shadow-violet-600/25"
            >
              Falar com suporte
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Deletion Failed Screen ────────────────────────────────────────────────────
function DeletionFailedScreen() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Problema ao cancelar</h1>
        <p className="text-slate-400 mb-6">
          Houve um problema ao cancelar sua conta. Nossa equipe foi notificada. Contato:{" "}
          <a href="mailto:suporte@oriclaw.com.br" className="text-violet-400 hover:text-violet-300 transition-colors">
            suporte@oriclaw.com.br
          </a>
        </p>
      </div>
    </main>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm shadow-xl flex items-center gap-3">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-slate-400 hover:text-white transition-colors">✕</button>
    </div>
  );
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <p className="text-red-400 text-lg font-medium">Algo deu errado</p>
            <p className="text-gray-500 text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── fetchInstance with retry ──────────────────────────────────────────────────
async function fetchInstanceWithRetry(userId: string, token: string, maxRetries = 3): Promise<Instance | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`/api/instances/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) return null; // genuinamente sem instância
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      if (i === maxRetries - 1) return null; // última tentativa falhou
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // backoff 1s, 2s
    }
  }
  return null;
}

// ── Dashboard Page (router) ───────────────────────────────────────────────────
// Wrapped in Suspense because useSearchParams() requires it in Next.js 14 App Router
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Bug fix #9: show config banner instead of redirecting to onboarding
  const [showConfigBanner, setShowConfigBanner] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Post-checkout polling state
  const [checkoutPolling, setCheckoutPolling] = useState(false);
  const [checkoutTimedOut, setCheckoutTimedOut] = useState(false);

  const checkoutParam = searchParams.get("checkout");
  const creditsParam = searchParams.get("credits");

  const sessionRef = useRef<{ userId: string; accessToken: string } | null>(null);

  const fetchInstance = useCallback(async (userId: string, accessToken: string) => {
    return fetchInstanceWithRetry(userId, accessToken);
  }, []);

  // ── Auth state listener — kick user out on signout; refresh token on rotation ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Keep the token state in sync so API calls don't fail with 401
        setToken(session.access_token);
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      setUserEmail(session.user.email ?? null);
      setToken(session.access_token);
      sessionRef.current = { userId: session.user.id, accessToken: session.access_token };

      const inst = await fetchInstance(session.user.id, session.access_token);
      setInstance(inst);
      setLoading(false);

      // ── Post-checkout polling ─────────────────────────────────────────────
      if (!inst && checkoutParam === "success") {
        // Webhook may not have processed yet — poll for up to 60s
        setCheckoutPolling(true);
        const deadline = Date.now() + 60_000;

        pollInterval = setInterval(async () => {
          const updated = await fetchInstance(session.user.id, session.access_token);
          if (updated) {
            if (pollInterval) clearInterval(pollInterval);
            setCheckoutPolling(false);
            setInstance(updated);

            // Bug fix #9: show config banner instead of redirecting
            if (updated.status === "needs_config") {
              setShowConfigBanner(true);
            }
          } else if (Date.now() >= deadline) {
            if (pollInterval) clearInterval(pollInterval);
            setCheckoutPolling(false);
            setCheckoutTimedOut(true);
          }
        }, 3_000);

        return;
      }

      // ── credits=cancelled toast ───────────────────────────────────────────
      if (creditsParam === "cancelled") {
        setToast("Compra cancelada.");
      }

      // ── credits=success: show toast after instance confirmed ──────────────
      if (creditsParam === "success" && inst) {
        setToast("Créditos adicionados com sucesso!");
      }

      // ── Route based on status ─────────────────────────────────────────────
      if (!inst) {
        router.push("/"); // no instance — back to landing
        return;
      }

      // Bug fix #9: Instead of hard redirect, show dashboard with a config banner.
      // This preserves access to logs/restart and prevents losing context on device change.
      if (inst.status === "needs_config") {
        setInstance(inst);
        setShowConfigBanner(true);
        setLoading(false);
        return;
      }

      // Poll while provisioning
      if (inst.status === "provisioning") {
        pollInterval = setInterval(async () => {
          const updated = await fetchInstance(session.user.id, session.access_token);
          if (updated && updated.status !== "provisioning") {
            if (pollInterval) clearInterval(pollInterval);
            setInstance(updated);
            // Bug fix #9: show config banner instead of redirecting
            if (updated.status === "needs_config") {
              setShowConfigBanner(true);
            }
          }
        }, 10_000);
      }
    };

    init();
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [router, fetchInstance, checkoutParam, creditsParam]);

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    await supabase.auth.signOut();
    // Use replace so the dashboard is removed from browser history —
    // prevents the back-button from replaying the session after logout.
    router.replace("/login");
  };

  const handleBillingPortal = async () => {
    if (!token || billingLoading) return;
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        setToast("Erro ao abrir portal de pagamento. Tente novamente.");
      }
    } catch {
      setToast("Erro ao abrir portal de pagamento. Tente novamente.");
    } finally {
      setBillingLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </main>
    );
  }

  // ── Post-checkout polling screen ──────────────────────────────────────────
  if (checkoutPolling || checkoutTimedOut) {
    return <CheckoutProcessingScreen timedOut={checkoutTimedOut} />;
  }

  if (!instance || instance.status === "provisioning") {
    return <ProvisioningScreen />;
  }

  // ── Suspended with error metadata ─────────────────────────────────────────
  if (instance.status === "suspended" && instance.metadata?.error) {
    return (
      <SuspendedScreen
        title="Sua instância foi suspensa"
        message={String(instance.metadata.error)}
        showSupportButton={true}
      />
    );
  }

  // ── Suspended without error = payment suspension ──────────────────────────
  if (instance.status === "suspended") {
    return (
      <SuspendedScreen
        title="Assinatura suspensa"
        message="Sua assinatura foi suspensa. Atualize seu pagamento para continuar usando o OriClaw."
        showSupportButton={false}
        extraAction={
          <button
            onClick={handleBillingPortal}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all shadow-lg shadow-violet-600/25"
          >
            Atualizar pagamento
          </button>
        }
      />
    );
  }

  // ── Deletion failed ───────────────────────────────────────────────────────
  if (instance.status === "deletion_failed") {
    return <DeletionFailedScreen />;
  }

  // ── Deleted ───────────────────────────────────────────────────────────────
  if (instance.status === "deleted") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4 p-8 max-w-md">
          <h2 className="text-xl font-bold text-white">Assinatura encerrada</h2>
          <p className="text-gray-400 text-sm">
            Sua assinatura foi cancelada e o servidor foi removido.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
          >
            Contratar novamente
          </a>
        </div>
      </div>
    );
  }

  // Bug fix #9: Show MainDashboard with a config banner for needs_config status
  // instead of hard redirect to /onboarding — preserves logs/restart access
  if (instance.status === "needs_config" || (instance.status === "running" && showConfigBanner)) {
    return (
      <>
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
        {showConfigBanner && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/95 border-b border-amber-400 px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-amber-900 flex-shrink-0" />
              <span className="text-amber-900 font-semibold text-sm">
                ⚠️ Configure sua IA para começar a usar o OriClaw
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/onboarding"
                className="px-4 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-800 text-amber-100 font-semibold text-sm transition-colors"
              >
                Configurar agora
              </a>
              <button
                onClick={() => setShowConfigBanner(false)}
                className="text-amber-800 hover:text-amber-900 text-lg leading-none ml-1"
                aria-label="Fechar aviso"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <main className={`min-h-screen bg-slate-950 ${showConfigBanner ? "pt-12" : ""}`}>
          <ErrorBoundary>
            <MainDashboard
              instance={instance}
              userEmail={userEmail ?? ""}
              token={token ?? ""}
              onLogout={handleLogout}
              onBillingPortal={handleBillingPortal}
              billingLoading={billingLoading}
              logoutLoading={logoutLoading}
            />
          </ErrorBoundary>
        </main>
      </>
    );
  }

  if (instance.status === "running") {
    return (
      <>
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
        <main className="min-h-screen bg-slate-950">
          <ErrorBoundary>
            <MainDashboard
              instance={instance}
              userEmail={userEmail ?? ""}
              token={token ?? ""}
              onLogout={handleLogout}
              onBillingPortal={handleBillingPortal}
              billingLoading={billingLoading}
              logoutLoading={logoutLoading}
            />
          </ErrorBoundary>
        </main>
      </>
    );
  }

  // Fallback
  return <ProvisioningScreen />;
}

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </main>
      }
    >
      <DashboardContent />
    </React.Suspense>
  );
}

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Check, ArrowLeft, Lock, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const planDetails: Record<string, {
  name: string;
  price: string;
  specs: string[];
  features: string[];
}> = {
  starter: {
    name: "Starter",
    price: "R$97/mês",
    specs: ["1 vCPU", "2GB RAM", "50GB SSD"],
    features: [
      "WhatsApp + Telegram + Discord",
      "BYOK (traga sua chave de API)",
      "Deploy em 60 segundos",
      "Suporte por email",
    ],
  },
  pro: {
    name: "Pro",
    price: "R$147/mês",
    specs: ["2 vCPU", "4GB RAM", "100GB SSD"],
    features: [
      "Tudo do Starter",
      "Suporte prioritário",
      "Uptime garantido 99.9%",
      "Backups automáticos",
    ],
  },
  business: {
    name: "Business",
    price: "R$247/mês",
    specs: ["4 vCPU", "8GB RAM", "200GB SSD"],
    features: [
      "Tudo do Pro",
      "Onboarding call 1:1",
      "SLA dedicado",
      "Configuração personalizada",
    ],
  },
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planSlug = searchParams.get("plan") ?? "pro";
  const plan = planDetails[planSlug] ?? planDetails.pro;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      // Validate user server-side first, then get session for the token
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const res = await fetch(`/api/checkout/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planSlug, email: session.user.email, supabase_user_id: session.user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Erro ao iniciar checkout. Tente novamente.");
        setLoading(false);
      }
    } catch {
      setError("Erro ao iniciar checkout. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back link */}
        <Link
          href="/#pricing"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos planos
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <span className="text-white font-bold text-xl">OriClaw</span>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          {/* Plan summary */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm">Plano selecionado</p>
                <h2 className="text-white font-bold text-2xl">{plan.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-xl">{plan.price}</p>
                <p className="text-slate-400 text-xs mt-0.5">Cancele quando quiser</p>
              </div>
            </div>

            {/* Specs */}
            <div className="flex gap-2 flex-wrap">
              {plan.specs.map((spec) => (
                <span
                  key={spec}
                  className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700"
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="p-6 border-b border-slate-800">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-3">
              Incluído no plano
            </p>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Checkout button */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Redirecionando para o Stripe...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Pagar com segurança
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 mt-4">
              <Lock className="w-3 h-3 text-slate-500" />
              <p className="text-slate-500 text-xs text-center">
                Pagamento seguro via Stripe. Seus dados estão protegidos.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Ao continuar, você concorda com nossos termos de serviço.
        </p>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

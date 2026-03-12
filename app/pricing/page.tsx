"use client";

import Link from "next/link";
import { Check, ArrowLeft } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "R$120",
    period: "/mês",
    specs: ["1 vCPU", "2GB RAM", "50GB SSD"],
    features: [
      "WhatsApp + Telegram + Discord",
      "BYOK (traga sua chave de API)",
      "Deploy em 60 segundos",
      "Suporte por email",
    ],
    slug: "starter",
    popular: false,
  },
  {
    name: "Pro",
    price: "R$240",
    period: "/mês",
    specs: ["2 vCPU", "4GB RAM", "100GB SSD"],
    features: [
      "Tudo do Starter",
      "Suporte prioritário",
      "Uptime garantido 99.9%",
      "Backups automáticos",
    ],
    slug: "pro",
    popular: true,
  },
  {
    name: "Business",
    price: "R$480",
    period: "/mês",
    specs: ["4 vCPU", "8GB RAM", "200GB SSD"],
    features: [
      "Tudo do Pro",
      "Onboarding call 1:1",
      "SLA dedicado",
      "Configuração personalizada",
    ],
    slug: "business",
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao painel
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Escolha seu plano
          </h1>
          <p className="text-slate-400 text-lg">
            Sem taxas escondidas. Cancele quando quiser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className={`relative p-6 rounded-2xl border transition-colors ${
                plan.popular
                  ? "bg-red-500/10 border-red-500/50 shadow-lg shadow-red-500/10"
                  : "bg-slate-900 border-slate-800 hover:border-slate-700"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-red-500 text-white text-xs font-semibold">
                    Mais popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-white font-bold text-xl mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
              </div>

              <div className="flex gap-2 mb-6 flex-wrap">
                {plan.specs.map((spec) => (
                  <span
                    key={spec}
                    className="px-2 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700"
                  >
                    {spec}
                  </span>
                ))}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/checkout?plan=${plan.slug}`}
                className={`block w-full text-center py-3 px-6 rounded-xl font-semibold transition-all ${
                  plan.popular
                    ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:-translate-y-0.5"
                    : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                }`}
              >
                Começar
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

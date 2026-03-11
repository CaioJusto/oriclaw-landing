import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Check, X, Zap, Server, Key } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "R$97",
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
    price: "R$147",
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
    price: "R$247",
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

const features = [
  {
    icon: Server,
    title: "Instância dedicada",
    description: "VPS exclusiva, sem compartilhar recursos. Sua instância OpenClaw roda isolada com desempenho garantido.",
  },
  {
    icon: Key,
    title: "Sua chave de API",
    description: "Use Claude, GPT ou Gemini com sua própria chave de API. Você controla seus custos e modelos.",
  },
  {
    icon: Zap,
    title: "Deploy em 60 segundos",
    description: "Preenche um formulário, recebe o link. Sem terminal, sem Docker, sem dor de cabeça.",
  },
];

const comparison = [
  { item: "Tempo de setup", traditional: "60+ minutos", oriclaw: "< 1 minuto" },
  { item: "Conhecimento técnico", traditional: "Linux, Docker, SSH", oriclaw: "Nenhum" },
  { item: "Manutenção do servidor", traditional: "Você mesmo", oriclaw: "Nós cuidamos" },
  { item: "Updates automáticos", traditional: "Manual", oriclaw: "✓ Automático" },
  { item: "Suporte", traditional: "Stack Overflow", oriclaw: "Equipe dedicada" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[800px] h-[400px] bg-violet-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600/10 border border-violet-600/20 text-violet-400 text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            Deploy em menos de 1 minuto
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6">
            Deploy seu{" "}
            <span className="gradient-text">OpenClaw</span>
            <br />
            em 1 clique
          </h1>

          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Seu assistente de IA no WhatsApp, Telegram ou Discord —<br className="hidden sm:block" />
            sem configurar servidor. Sem complicação.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/checkout?plan=pro"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-lg transition-all shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 hover:-translate-y-0.5"
            >
              Começar agora →
            </Link>
            <Link
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-lg transition-colors border border-slate-700"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="py-6 border-y border-slate-800 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm sm:text-base">
            <span className="text-slate-300 font-medium">Powered by</span>{" "}
            <span className="text-violet-400">Claude</span> ·{" "}
            <span className="text-violet-400">GPT-4</span> ·{" "}
            <span className="text-violet-400">Gemini</span>
            <span className="mx-4 text-slate-600">|</span>
            <span className="text-slate-300 font-medium">Disponível no</span>{" "}
            <span className="text-violet-400">WhatsApp</span> ·{" "}
            <span className="text-violet-400">Telegram</span> ·{" "}
            <span className="text-violet-400">Discord</span>
          </p>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Método tradicional vs OriClaw
            </h2>
            <p className="text-slate-400 text-lg">Por que perder horas quando você pode começar agora?</p>
          </div>

          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-900 border-b border-slate-800">
              <div className="p-4 text-slate-400 text-sm font-medium"></div>
              <div className="p-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <X className="w-4 h-4 text-red-400" />
                  <span className="text-slate-300 font-semibold">Método tradicional</span>
                </div>
              </div>
              <div className="p-4 text-center bg-violet-600/5">
                <div className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-violet-400" />
                  <span className="text-violet-400 font-semibold">OriClaw</span>
                </div>
              </div>
            </div>

            {comparison.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 border-b border-slate-800 last:border-0 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}
              >
                <div className="p-4 text-slate-300 text-sm font-medium">{row.item}</div>
                <div className="p-4 text-center text-red-400 text-sm">{row.traditional}</div>
                <div className="p-4 text-center text-violet-400 text-sm font-medium bg-violet-600/5">
                  {row.oriclaw}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Tudo que você precisa
            </h2>
            <p className="text-slate-400 text-lg">Infraestrutura profissional, simplicidade total</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-violet-600/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center mb-4 group-hover:bg-violet-600/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Planos simples e transparentes
            </h2>
            <p className="text-slate-400 text-lg">Sem taxas escondidas. Cancele quando quiser.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.slug}
                className={`relative p-6 rounded-2xl border transition-colors ${
                  plan.popular
                    ? "bg-violet-600/10 border-violet-600/50 shadow-lg shadow-violet-600/10"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-violet-600 text-white text-xs font-semibold">
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

                {/* Specs */}
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

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/checkout?plan=${plan.slug}`}
                  className={`block w-full text-center py-3 px-6 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 hover:-translate-y-0.5"
                      : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                  }`}
                >
                  Começar
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-10 rounded-2xl bg-gradient-to-br from-violet-600/20 to-slate-900 border border-violet-600/20">
            <h2 className="text-3xl font-bold text-white mb-4">
              Pronto para começar?
            </h2>
            <p className="text-slate-300 mb-8">
              Deploy seu OpenClaw agora e tenha seu assistente rodando em menos de 1 minuto.
            </p>
            <Link
              href="/checkout?plan=pro"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-lg transition-all shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 hover:-translate-y-0.5"
            >
              Começar agora →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">O</span>
            </div>
            <span className="text-slate-400 text-sm">OriClaw © 2026</span>
          </div>
          <a
            href="mailto:suporte@oriclaw.com.br"
            className="text-slate-400 hover:text-violet-400 text-sm transition-colors"
          >
            suporte@oriclaw.com.br
          </a>
        </div>
      </footer>
    </main>
  );
}

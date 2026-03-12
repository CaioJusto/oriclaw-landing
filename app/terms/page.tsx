import Link from "next/link";

export const metadata = {
  title: "Termos de Serviço — OriClaw",
  description: "Termos de Serviço da plataforma OriClaw.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          ← Voltar ao início
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Termos de Serviço</h1>
        <p className="text-slate-500 text-sm mb-10">Última atualização: março de 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou usar a plataforma OriClaw, você concorda em ficar vinculado a estes
              Termos de Serviço. Se você não concordar com qualquer parte destes termos, não poderá
              usar nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Descrição do Serviço</h2>
            <p>
              O OriClaw é uma plataforma SaaS que provisiona agentes de IA em servidores VPS
              dedicados, permitindo integração com canais de comunicação como WhatsApp, Telegram e
              Discord. O serviço é cobrado mediante assinatura mensal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Responsabilidades do Usuário</h2>
            <p>Você é responsável por:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Manter a segurança de sua conta e credenciais de acesso.</li>
              <li>Garantir que o uso do serviço está em conformidade com a legislação aplicável.</li>
              <li>Não utilizar o serviço para fins ilegais ou prejudiciais a terceiros.</li>
              <li>Cumprir os Termos de Uso das plataformas integradas (WhatsApp, OpenAI, etc.).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Pagamentos e Cancelamento</h2>
            <p>
              As assinaturas são cobradas mensalmente via Stripe. Você pode cancelar a qualquer
              momento pelo painel. O cancelamento encerra o acesso ao serviço ao final do período
              pago e os servidores VPS associados serão desativados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Limitação de Responsabilidade</h2>
            <p>
              O OriClaw é fornecido "como está", sem garantias de disponibilidade contínua. Não nos
              responsabilizamos por danos indiretos, lucros cessantes ou perda de dados decorrentes
              do uso ou impossibilidade de uso do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações
              significativas serão comunicadas por e-mail com antecedência mínima de 30 dias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contato</h2>
            <p>
              Para dúvidas sobre estes termos, entre em contato:{" "}
              <a href="mailto:contato@oriclaw.com.br" className="text-violet-400 hover:text-violet-300">
                contato@oriclaw.com.br
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

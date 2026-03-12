import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade — OriClaw",
  description: "Política de Privacidade da plataforma OriClaw.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-violet-400 hover:text-violet-300 text-sm mb-8 inline-block">
          ← Voltar ao início
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
        <p className="text-slate-500 text-sm mb-10">Última atualização: março de 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Dados que Coletamos</h2>
            <p>Coletamos as seguintes informações para operar o serviço:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Endereço de e-mail (para autenticação e comunicação).</li>
              <li>Informações de pagamento (processadas pelo Stripe — não armazenamos dados de cartão).</li>
              <li>Chaves de API fornecidas por você (armazenadas criptografadas com AES-256).</li>
              <li>Logs de uso do assistente de IA (para diagnóstico e suporte).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Como Usamos os Dados</h2>
            <p>Seus dados são usados exclusivamente para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Provisionar e operar sua instância de agente de IA.</li>
              <li>Processar pagamentos e gerenciar sua assinatura.</li>
              <li>Enviar comunicações essenciais do serviço (confirmações, alertas).</li>
              <li>Melhorar a plataforma com base em métricas agregadas e anônimas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Compartilhamento de Dados</h2>
            <p>
              Não vendemos nem compartilhamos seus dados pessoais com terceiros, exceto:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li><strong>Stripe</strong> — para processamento de pagamentos.</li>
              <li><strong>DigitalOcean</strong> — para hospedagem do seu servidor VPS.</li>
              <li><strong>Supabase</strong> — para armazenamento seguro dos dados da conta.</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">
              Todos os subprocessadores operam em conformidade com o GDPR e a LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Segurança dos Dados</h2>
            <p>
              Aplicamos medidas técnicas e organizacionais para proteger seus dados:
              criptografia AES-256 para chaves de API, HTTPS em todas as comunicações,
              autenticação segura via Supabase Auth e isolamento de dados por usuário com
              Row Level Security (RLS).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Retenção de Dados</h2>
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Após o cancelamento,
              os dados são retidos por 30 dias para fins de recuperação, após os quais são
              excluídos permanentemente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Seus Direitos (LGPD)</h2>
            <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
              <li>Acessar os dados pessoais que temos sobre você.</li>
              <li>Solicitar a correção de dados incompletos ou incorretos.</li>
              <li>Solicitar a exclusão dos seus dados.</li>
              <li>Revogar seu consentimento a qualquer momento.</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, entre em contato:{" "}
              <a href="mailto:privacidade@oriclaw.com.br" className="text-violet-400 hover:text-violet-300">
                privacidade@oriclaw.com.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Cookies</h2>
            <p>
              Utilizamos apenas cookies essenciais para autenticação e funcionamento do serviço.
              Não utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Contato</h2>
            <p>
              Para dúvidas sobre esta política:{" "}
              <a href="mailto:privacidade@oriclaw.com.br" className="text-violet-400 hover:text-violet-300">
                privacidade@oriclaw.com.br
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console (not exposed to user)
    console.error("[OriClaw] Unhandled error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Algo deu errado</h1>
        <p className="text-slate-400 mb-8">
          Ocorreu um erro inesperado. Por favor, tente novamente ou entre em contato com o suporte.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all shadow-lg shadow-violet-600/25"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all"
          >
            Voltar ao início
          </Link>
        </div>
        <p className="text-slate-600 text-xs mt-6">
          Se o problema persistir:{" "}
          <a
            href="mailto:suporte@oriclaw.com.br"
            className="text-slate-500 hover:text-slate-400 transition-colors"
          >
            suporte@oriclaw.com.br
          </a>
        </p>
      </div>
    </main>
  );
}

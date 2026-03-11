"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const instanceId = searchParams.get("state");

    if (!code || !instanceId) {
      setStatus("error");
      setErrorMsg("Parâmetros OAuth ausentes. Feche esta aba e tente novamente.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/openai/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            instance_id: instanceId,
            redirect_uri: `${window.location.origin}/auth/openai/callback`,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(String(data.error));
        setStatus("success");
        // Close the popup tab after a short delay
        setTimeout(() => window.close(), 3000);
      } catch (e: unknown) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Falha na autenticação com OpenAI");
      }
    })();
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">O</span>
        </div>
        <span className="text-white font-bold text-xl">OriClaw</span>
      </div>

      <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-4" />
            <h2 className="text-white font-semibold text-lg mb-2">Conectando ChatGPT Plus...</h2>
            <p className="text-slate-400 text-sm">Aguarde enquanto verificamos sua conta OpenAI.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">ChatGPT Plus conectado! ✅</h2>
            <p className="text-slate-400 text-sm mb-4">
              Sua conta OpenAI foi vinculada com sucesso. Esta aba vai fechar automaticamente.
            </p>
            <p className="text-slate-500 text-xs">Você pode fechar esta aba agora.</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Falha na conexão</h2>
            <p className="text-slate-400 text-sm mb-4">{errorMsg}</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
            >
              Fechar aba
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function OpenAICallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

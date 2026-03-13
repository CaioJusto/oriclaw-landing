"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

function CallbackContent() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = params.get("code");
    if (!code) {
      setStatus("error");
      setErrorMsg("Codigo de autorizacao nao encontrado.");
      return;
    }

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setStatus("error");
          setErrorMsg("Sessao expirada. Faca login novamente.");
          return;
        }

        const res = await fetch("/api/auth/openai-codex/exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Falha na troca do codigo OAuth.");
        }

        setStatus("success");
        // Close popup or redirect after 2s
        setTimeout(() => {
          if (window.opener) {
            window.opener.location.reload();
            window.close();
          } else {
            window.location.href = "/dashboard";
          }
        }, 2000);
      } catch (e: unknown) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Erro desconhecido.");
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-medium">Conectando sua conta ChatGPT...</p>
            <p className="text-slate-400 text-sm mt-2">Aguarde enquanto finalizamos a autenticacao.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-green-400 text-lg font-medium">ChatGPT conectado com sucesso!</p>
            <p className="text-slate-400 text-sm mt-2">Redirecionando para o dashboard...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-400 text-lg font-medium">Erro ao conectar</p>
            <p className="text-slate-400 text-sm mt-2">{errorMsg}</p>
            <a
              href="/dashboard"
              className="inline-block mt-4 text-red-400 hover:text-red-300 underline text-sm"
            >
              Voltar ao Dashboard
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function CodexCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

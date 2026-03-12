"use client";

/**
 * OpenAI OAuth callback page — DEPRECATED.
 *
 * Bug fix #2: OpenAI does NOT offer public OAuth for ChatGPT Plus.
 * The endpoints https://auth.openai.com/authorize and
 * https://auth.openai.com/oauth/token do not exist.
 *
 * The OAuth flow has been replaced with a simple API Key input in the
 * dashboard. This page now redirects users back to the dashboard.
 *
 * Bug fix #1 (original): the useEffect was calling POST /api/auth/openai/exchange
 * without an Authorization header, causing 401 errors. That endpoint no longer
 * exists, but the fix is preserved in comments below for reference.
 */

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const router = useRouter();

  useEffect(() => {
    // OAuth flow has been removed. Redirect to dashboard.
    // Original fix #1: would have fetched supabase.auth.getSession() here
    // and included Authorization: Bearer ${session.access_token} in fetch headers.
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2 mb-10">
        <span className="text-2xl">🦀</span>
        <span className="text-white font-bold text-xl">OriClaw</span>
      </div>

      <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
        <Loader2 className="w-10 h-10 text-red-400 animate-spin mx-auto mb-4" />
        <h2 className="text-white font-semibold text-lg mb-2">Redirecionando...</h2>
        <p className="text-slate-400 text-sm">
          Esta página foi atualizada. Você será redirecionado para o painel.
        </p>
      </div>
    </main>
  );
}

export default function OpenAICallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-red-400 animate-spin" />
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

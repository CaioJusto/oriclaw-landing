"use client";
import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only act on explicit auth events, not the initial session check.
      // Redirecting on INITIAL_SESSION (null) would abort email/OAuth flows
      // before the URL hash token has been processed by Supabase.
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset-password");
      } else if (event === "SIGNED_IN" && session) {
        router.replace("/dashboard");
      } else if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
      // INITIAL_SESSION is intentionally ignored here so the hash-based
      // token exchange can complete before we decide where to redirect.
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <CallbackContent />
    </Suspense>
  );
}

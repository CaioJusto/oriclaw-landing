"use client";
import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset-password");
      } else if (session) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
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

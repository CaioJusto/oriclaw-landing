import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OriClaw — Deploy seu OpenClaw em 1 clique",
  description: "Seu assistente de IA no WhatsApp, Telegram ou Discord — sem configurar servidor. Deploy em 60 segundos.",
  keywords: ["OpenClaw", "assistente IA", "WhatsApp bot", "Telegram bot", "Discord bot", "deploy fácil"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  );
}

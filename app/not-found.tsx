import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-400 mb-4">404</h1>
        <p className="text-slate-400 mb-8">Página não encontrada</p>
        <Link
          href="/"
          className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl font-medium transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

"use client";

import { createClient } from "../../lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    if (error) {
      setError("Errore nell'invio dell'email. Verifica l'indirizzo e riprova.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">Password dimenticata</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">Inserisci la tua email e ti invieremo un link per reimpostare la password</p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        {sent ? (
          <div>
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 text-center">
              Email inviata! Controlla la tua casella di posta (anche lo spam) e clicca il link per reimpostare la password.
            </div>
            <div className="text-center">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800">
                Torna al login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@ristorante.it" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? "Invio in corso..." : "Invia link di reset"}
            </button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
                Torna al login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
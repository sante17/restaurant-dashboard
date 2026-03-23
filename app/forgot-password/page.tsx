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
 <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-8 w-full max-w-sm">
 <h1 className="text-xl font-bold text-[#1c1917] mb-1 text-center">Password dimenticata</h1>
 <p className="text-sm text-[#a8a29e] mb-6 text-center">Inserisci la tua email e ti invieremo un link per reimpostare la password</p>

 {error && <div className="mb-4 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

 {sent ? (
 <div>
 <div className="mb-4 p-4 bg-[#f0fdf4] border border-green-200 rounded-lg text-sm text-green-700 text-center">
 Email inviata! Controlla la tua casella di posta (anche lo spam) e clicca il link per reimpostare la password.
 </div>
 <div className="text-center">
 <Link href="/login" className="text-sm text-[#c2410c] hover:text-[#9a3412]">
 Torna al login
 </Link>
 </div>
 </div>
 ) : (
 <form onSubmit={handleReset} className="space-y-4">
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Email</label>
 <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@ristorante.it" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <button type="submit" disabled={loading} className="bg-[#c2410c] hover:bg-[#9a3412] w-full py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
 {loading ? "Invio in corso..." : "Invia link di reset"}
 </button>
 <div className="text-center">
 <Link href="/login" className="text-sm text-[#a8a29e] hover:text-[#44403c]">
 Torna al login
 </Link>
 </div>
 </form>
 )}
 </div>
 </div>
 );
}
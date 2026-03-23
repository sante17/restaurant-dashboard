"use client";

import { createClient } from "../../lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [loading, setLoading] = useState(false);
 const [success, setSuccess] = useState(false);
 const [error, setError] = useState("");
 const [ready, setReady] = useState(false);
 const router = useRouter();
 const supabase = createClient();

 useEffect(() => {
 // Supabase invia il token nell'URL hash — il client lo gestisce automaticamente
 // Aspettiamo che la sessione sia pronta
 supabase.auth.onAuthStateChange((event) => {
 if (event === "PASSWORD_RECOVERY") {
 setReady(true);
 }
 });

 // Fallback: controlla se c'è già una sessione
 supabase.auth.getSession().then(({ data }) => {
 if (data.session) setReady(true);
 });
 }, []);

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 setError("");

 if (password.length < 6) {
 setError("La password deve avere almeno 6 caratteri");
 return;
 }

 if (password !== confirmPassword) {
 setError("Le password non corrispondono");
 return;
 }

 setLoading(true);

 const { error } = await supabase.auth.updateUser({ password });

 if (error) {
 setError("Errore nel cambio password: " + error.message);
 setLoading(false);
 return;
 }

 setSuccess(true);
 setLoading(false);
 setTimeout(() => router.push("/dashboard"), 2000);
 }

 return (
 <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-8 w-full max-w-sm">
 <h1 className="text-xl font-bold text-[#1c1917] mb-1 text-center">Nuova password</h1>
 <p className="text-sm text-[#a8a29e] mb-6 text-center">Scegli la tua nuova password</p>

 {error && <div className="mb-4 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

 {success ? (
 <div>
 <div className="mb-4 p-4 bg-[#f0fdf4] border border-green-200 rounded-lg text-sm text-green-700 text-center">
 Password aggiornata con successo! Reindirizzamento alla dashboard...
 </div>
 </div>
 ) : !ready ? (
 <div>
 <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 text-center">
 Caricamento in corso... Se questa pagina non si aggiorna, il link potrebbe essere scaduto.
 </div>
 <div className="text-center">
 <Link href="/forgot-password" className="text-sm text-[#c2410c] hover:text-[#9a3412]">
 Richiedi un nuovo link
 </Link>
 </div>
 </div>
 ) : (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Nuova password</label>
 <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Minimo 6 caratteri" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Conferma password</label>
 <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Ripeti la password" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <button type="submit" disabled={loading} className="bg-[#c2410c] hover:bg-[#9a3412] w-full py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
 {loading ? "Aggiornamento..." : "Imposta nuova password"}
 </button>
 </form>
 )}
 </div>
 </div>
 );
}
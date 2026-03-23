"use client";

import { createClient } from "../../lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);
 const router = useRouter();
 const supabase = createClient();

 async function handleLogin(e: React.FormEvent) {
 e.preventDefault();
 setLoading(true);
 setError("");
 const { error } = await supabase.auth.signInWithPassword({ email, password });
 if (error) { setError("Email o password non validi"); setLoading(false); return; }
 router.push("/dashboard");
 }

 return (
 <div className="min-h-screen flex" style={{ background: "#faf8f5" }}>
 {/* Left panel - branding */}
 <div className="hidden lg:flex lg:w-[480px] flex-col justify-between p-12" style={{ background: "#c2410c" }}>
 <div>
 <div className="flex items-center gap-3 mb-16">
 <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/>
 </svg>
 </div>
 <span className="bg-[#c2410c] text-xl font-semibold text-white">RestoAI</span>
 </div>
 <h1 className="bg-[#c2410c] text-3xl font-bold text-white leading-tight mb-4">
 Gestisci il tuo ristorante con l&apos;intelligenza artificiale
 </h1>
 <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
 Prenotazioni automatiche, agente vocale AI, analitiche clienti. Tutto in un&apos;unica piattaforma.
 </p>
 </div>
 <div>
 <div className="flex items-center gap-3 mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
 <span className="text-sm">Agente AI che risponde al telefono 24/7</span>
 </div>
 <div className="flex items-center gap-3 mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
 <span className="text-sm">Dashboard per gestire menu, orari e tavoli</span>
 </div>
 <div className="flex items-center gap-3" style={{ color: "rgba(255,255,255,0.6)" }}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
 <span className="text-sm">Analitiche per conoscere i tuoi clienti migliori</span>
 </div>
 </div>
 </div>

 {/* Right panel - login form */}
 <div className="flex-1 flex items-center justify-center p-6">
 <div className="w-full max-w-sm">
 {/* Mobile logo */}
 <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
 <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#c2410c" }}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/>
 </svg>
 </div>
 <span className="text-xl font-semibold" style={{ color: "#292524" }}>RestoAI</span>
 </div>

 <h2 className="text-2xl font-bold mb-1" style={{ color: "#1c1917" }}>Bentornato</h2>
 <p className="text-sm mb-8" style={{ color: "#a8a29e" }}>Accedi per gestire il tuo ristorante</p>

 {error && (
 <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
 {error}
 </div>
 )}

 <form onSubmit={handleLogin} className="space-y-4">
 <div>
 <label className="block text-sm mb-1.5 font-medium" style={{ color: "#44403c" }}>Email</label>
 <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@ristorante.it"
 className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
 style={{ background: "white", border: "1px solid #d6d3d1", color: "#1c1917" }}
 onFocus={(e) => { e.target.style.borderColor = "#c2410c"; e.target.style.boxShadow = "0 0 0 3px rgba(194,65,12,0.1)"; }}
 onBlur={(e) => { e.target.style.borderColor = "#d6d3d1"; e.target.style.boxShadow = "none"; }} />
 </div>
 <div>
 <label className="block text-sm mb-1.5 font-medium" style={{ color: "#44403c" }}>Password</label>
 <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Inserisci la password"
 className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
 style={{ background: "white", border: "1px solid #d6d3d1", color: "#1c1917" }}
 onFocus={(e) => { e.target.style.borderColor = "#c2410c"; e.target.style.boxShadow = "0 0 0 3px rgba(194,65,12,0.1)"; }}
 onBlur={(e) => { e.target.style.borderColor = "#d6d3d1"; e.target.style.boxShadow = "none"; }} />
 </div>
 <button type="submit" disabled={loading}
 className="bg-[#c2410c] hover:bg-[#9a3412] w-full py-2.5 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
 style={{ background: "#c2410c" }}
 onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#9a3412"; }}
 onMouseLeave={(e) => { e.currentTarget.style.background = "#c2410c"; }}>
 {loading ? "Accesso in corso..." : "Accedi"}
 </button>
 </form>

 <div className="mt-5 text-center">
 <Link href="/forgot-password" className="text-sm font-medium" style={{ color: "#c2410c" }}>
 Password dimenticata?
 </Link>
 </div>
 </div>
 </div>
 </div>
 );
}
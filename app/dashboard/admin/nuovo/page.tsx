"use client";

import { createClient } from "../../../../lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NuovoRistorantePage() {
 const [isAdmin, setIsAdmin] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const [success, setSuccess] = useState("");
 const [form, setForm] = useState({
 name: "",
 slug: "",
 address: "",
 phone: "",
 transfer_phone: "",
 parking_info: "",
 vapi_assistant_id: "",
 vapi_api_key: "",
 google_sheet_id: "",
 n8n_base_url: "",
 owner_email: "",
 owner_password: "",
 });
 const supabase = createClient();
 const router = useRouter();

 useEffect(() => { checkAdmin(); }, []);

 async function checkAdmin() {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) { router.push("/login"); return; }
 const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
 if (data?.role !== "admin") { router.push("/dashboard"); return; }
 setIsAdmin(true);
 }

 function generateSlug(name: string) {
 return name
 .toLowerCase()
 .replace(/[^a-z0-9\s-]/g, "")
 .replace(/\s+/g, "-")
 .replace(/-+/g, "-")
 .trim();
 }

 function handleNameChange(name: string) {
 setForm({ ...form, name, slug: generateSlug(name) });
 }

 async function handleSubmit() {
 if (!form.name.trim() || !form.slug.trim()) {
 setError("Nome e slug sono obbligatori");
 return;
 }
 if (!form.owner_email.trim() || !form.owner_password.trim()) {
 setError("Email e password del proprietario sono obbligatori");
 return;
 }
 if (form.owner_password.length < 6) {
 setError("La password deve essere di almeno 6 caratteri");
 return;
 }

 setSaving(true);
 setError("");

 try {
 // 1. Crea il ristorante
 const { data: restaurant, error: restError } = await supabase
 .from("restaurants")
 .insert({
 name: form.name.trim(),
 slug: form.slug.trim(),
 address: form.address.trim() || null,
 phone: form.phone.trim() || null,
 transfer_phone: form.transfer_phone.trim() || null,
 parking_info: form.parking_info.trim() || null,
 vapi_assistant_id: form.vapi_assistant_id.trim() || null,
 vapi_api_key: form.vapi_api_key.trim() || null,
 google_sheet_id: form.google_sheet_id.trim() || null,
 n8n_base_url: form.n8n_base_url.trim() || null,
 })
 .select()
 .single();

 if (restError) {
 if (restError.message.includes("duplicate")) {
 setError("Esiste gia un ristorante con questo slug. Scegline un altro.");
 } else {
 setError("Errore creazione ristorante: " + restError.message);
 }
 setSaving(false);
 return;
 }

 // 2. Crea gli orari di default (tutti aperti tranne domenica)
 const defaultHours = [];
 for (let day = 0; day <= 6; day++) {
 defaultHours.push({
 restaurant_id: restaurant.id,
 day_of_week: day,
 is_closed: day === 0,
 lunch_open: day === 0 ? null : "12:00",
 lunch_close: day === 0 ? null : "14:30",
 dinner_open: day === 0 ? null : "19:00",
 dinner_close: day === 0 ? null : "23:00",
 });
 }
 await supabase.from("opening_hours").insert(defaultHours);

 // 3. Crea info allergeni di default
 await supabase.from("allergen_info").insert({
 restaurant_id: restaurant.id,
 allergens_in_kitchen: "",
 gluten_free_note: "",
 vegetarian_note: "",
 vegan_note: "",
 });

 // 4. Crea l'utente proprietario via API
 const signUpRes = await fetch("/api/admin/create-user", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 email: form.owner_email.trim(),
 password: form.owner_password,
 restaurant_id: restaurant.id,
 }),
 });

 const signUpData = await signUpRes.json();
 if (signUpData.error) {
 setError("Ristorante creato ma errore nella creazione utente: " + signUpData.error);
 setSaving(false);
 return;
 }

 setSuccess("Ristorante '" + form.name + "' creato con successo! Utente: " + form.owner_email);
 setTimeout(() => router.push("/dashboard/admin"), 2000);
 } catch (e: any) {
 setError("Errore: " + e.message);
 }

 setSaving(false);
 }

 if (!isAdmin) return null;

 return (
 <div>
 <div className="mb-8">
 <button onClick={() => router.push("/dashboard/admin")} className="text-sm text-[#c2410c] hover:text-[#9a3412] mb-2 inline-block">
 &larr; Torna alla lista
 </button>
 <h1 className="text-2xl font-bold text-[#1c1917]">Nuovo Ristorante</h1>
 <p className="text-[#a8a29e] mt-1">Configura un nuovo ristorante nel sistema</p>
 </div>

 {error && (
 <div className="mb-4 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700">
 {error}
 </div>
 )}

 {success && (
 <div className="mb-4 p-3 bg-[#f0fdf4] border border-green-200 rounded-lg text-sm text-green-700">
 {success}
 </div>
 )}

 <div className="space-y-6">
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-6">
 <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Informazioni base</h2>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Nome ristorante *</label>
 <input type="text" value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="es. Osteria Il Ponte" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Slug (URL) *</label>
 <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="es. osteria-il-ponte" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Indirizzo</label>
 <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Telefono</label>
 <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Telefono trasferimento</label>
 <input type="tel" value={form.transfer_phone} onChange={(e) => setForm({ ...form, transfer_phone: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Info parcheggio</label>
 <input type="text" value={form.parking_info} onChange={(e) => setForm({ ...form, parking_info: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-[#e8e0d8] p-6">
 <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Configurazione tecnica</h2>
 <p className="text-[#a8a29e] text-sm mb-4">Questi campi possono essere compilati anche dopo</p>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Vapi Assistant ID</label>
 <input type="text" value={form.vapi_assistant_id} onChange={(e) => setForm({ ...form, vapi_assistant_id: e.target.value })} placeholder="es. 9a820563-609b-..." className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Vapi API Key</label>
 <input type="password" value={form.vapi_api_key} onChange={(e) => setForm({ ...form, vapi_api_key: e.target.value })} placeholder="Private key" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Google Sheet ID</label>
 <input type="text" value={form.google_sheet_id} onChange={(e) => setForm({ ...form, google_sheet_id: e.target.value })} placeholder="ID dalla URL del foglio" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">n8n Base URL</label>
 <input type="text" value={form.n8n_base_url} onChange={(e) => setForm({ ...form, n8n_base_url: e.target.value })} placeholder="es. https://xxx.app.n8n.cloud" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-[#e8e0d8] p-6">
 <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Utente proprietario</h2>
 <p className="text-[#a8a29e] text-sm mb-4">Credenziali per il login del ristorante</p>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Email proprietario *</label>
 <input type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} placeholder="email@ristorante.it" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div>
 <label className="block text-sm text-[#78716c] mb-1">Password *</label>
 <input type="password" value={form.owner_password} onChange={(e) => setForm({ ...form, owner_password: e.target.value })} placeholder="Minimo 6 caratteri" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 </div>
 </div>

 <div className="flex gap-3">
 <button onClick={handleSubmit} disabled={saving} className="bg-[#c2410c] hover:bg-[#9a3412] px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
 {saving ? "Creazione in corso..." : "Crea ristorante"}
 </button>
 <button onClick={() => router.push("/dashboard/admin")} className="px-6 py-2.5 text-[#78716c] text-sm rounded-lg hover:bg-[#f5f0eb] transition-colors">
 Annulla
 </button>
 </div>
 </div>
 </div>
 );
}
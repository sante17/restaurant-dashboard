"use client";

import { createClient } from "../../../lib/supabase/client";
import { useEffect, useState } from "react";

const DAYS = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];

interface OpeningHour {
 id: string; day_of_week: number; is_closed: boolean;
 breakfast_open: string | null; breakfast_close: string | null;
 lunch_open: string | null; lunch_close: string | null;
 dinner_open: string | null; dinner_close: string | null;
}

interface Closure {
 id: string; start_date: string; end_date: string; reason: string | null;
}

export default function OrariPage() {
 const [hours, setHours] = useState<OpeningHour[]>([]);
 const [closures, setClosures] = useState<Closure[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);
 const [syncing, setSyncing] = useState(false);
 const [restaurantId, setRestaurantId] = useState<string | null>(null);
 const [showAddClosure, setShowAddClosure] = useState(false);
 const [newClosure, setNewClosure] = useState({ start_date: "", end_date: "", reason: "" });
 const supabase = createClient();

 useEffect(() => { loadData(); }, []);

 async function getRestaurantId() {
 if (restaurantId) return restaurantId;
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return null;
 const { data } = await supabase.from("users").select("restaurant_id").eq("id", user.id).single();
 if (data?.restaurant_id) { setRestaurantId(data.restaurant_id); return data.restaurant_id; }
 return null;
 }

 async function syncAll() {
 setSyncing(true);
 try {
 await Promise.all([
 fetch("/api/sync-vapi", { method: "POST" }),
 fetch("/api/sync-chiusure", { method: "POST" }),
 ]);
 } catch (e) { console.error("Sync error:", e); }
 setSyncing(false);
 }

 async function loadData() {
 const rid = await getRestaurantId();
 if (!rid) return;
 const [hoursRes, closuresRes] = await Promise.all([
 supabase.from("opening_hours").select("*").eq("restaurant_id", rid).order("day_of_week"),
 supabase.from("closures").select("*").eq("restaurant_id", rid).order("start_date"),
 ]);
 setHours(hoursRes.data || []);
 setClosures(closuresRes.data || []);
 setLoading(false);
 }

 function updateHour(dayIndex: number, field: string, value: string | boolean) {
 setHours((prev) => prev.map((h) => h.day_of_week === dayIndex ? { ...h, [field]: value } : h));
 setSaved(false);
 }

 function toggleMeal(dayIndex: number, meal: "breakfast" | "lunch" | "dinner") {
 setHours((prev) => prev.map((h) => {
 if (h.day_of_week !== dayIndex) return h;
 const openKey = meal + "_open" as keyof OpeningHour;
 const closeKey = meal + "_close" as keyof OpeningHour;
 const isCurrentlyOpen = h[openKey] !== null;
 if (isCurrentlyOpen) {
 return { ...h, [openKey]: null, [closeKey]: null };
 } else {
 const defaults: Record<string, [string, string]> = {
 breakfast: ["07:30", "10:30"],
 lunch: ["12:00", "14:30"],
 dinner: ["19:00", "23:00"],
 };
 return { ...h, [openKey]: defaults[meal][0], [closeKey]: defaults[meal][1] };
 }
 }));
 setSaved(false);
 }

 async function saveAll() {
 setSaving(true);
 for (const h of hours) {
 await supabase.from("opening_hours").update({
 is_closed: h.is_closed,
 breakfast_open: h.is_closed ? null : h.breakfast_open,
 breakfast_close: h.is_closed ? null : h.breakfast_close,
 lunch_open: h.is_closed ? null : h.lunch_open,
 lunch_close: h.is_closed ? null : h.lunch_close,
 dinner_open: h.is_closed ? null : h.dinner_open,
 dinner_close: h.is_closed ? null : h.dinner_close,
 }).eq("id", h.id);
 }
 setSaving(false); setSaved(true);
 await syncAll();
 setTimeout(() => setSaved(false), 3000);
 }

 async function addClosure() {
 if (!newClosure.start_date || !newClosure.end_date) return;
 const rid = await getRestaurantId();
 if (!rid) return;
 await supabase.from("closures").insert({
 restaurant_id: rid, start_date: newClosure.start_date,
 end_date: newClosure.end_date, reason: newClosure.reason || null,
 });
 setNewClosure({ start_date: "", end_date: "", reason: "" });
 setShowAddClosure(false);
 loadData(); await syncAll();
 }

 async function deleteClosure(id: string) {
 if (!confirm("Rimuovere questa chiusura?")) return;
 await supabase.from("closures").delete().eq("id", id);
 loadData(); await syncAll();
 }

 function formatDate(dateStr: string) {
 const d = new Date(dateStr + "T00:00:00");
 return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
 }

 if (loading) return <div className="flex items-center justify-center h-64"><p className="text-[#a8a29e]">Caricamento...</p></div>;

 return (
 <div>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
 <div>
 <h1 className="text-2xl font-bold text-[#1c1917]">Orari di Apertura</h1>
 <p className="text-[#a8a29e] mt-1 text-sm">Imposta gli orari per ogni giorno della settimana</p>
 </div>
 <div className="flex items-center gap-3">
 {saved && <span className="text-sm text-green-600 font-medium">Salvato!</span>}
 {syncing && <span className="text-sm text-[#c2410c] font-medium">Sync agente...</span>}
 <button onClick={saveAll} disabled={saving || syncing} className="bg-[#c2410c] hover:bg-[#9a3412] w-full sm:w-auto px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
 {saving ? "Salvataggio..." : syncing ? "Sync agente..." : "Salva tutto"}
 </button>
 </div>
 </div>

 <div className="space-y-3 mb-10">
 {hours.map((hour) => (
 <div key={hour.id} className={"bg-white rounded-xl border border-[#e8e0d8] p-4 transition-opacity " + (hour.is_closed ? "opacity-60" : "")}>
 <div className="flex items-center justify-between mb-3">
 <p className="font-semibold text-[#1c1917]">{DAYS[hour.day_of_week]}</p>
 <label className="flex items-center gap-2 cursor-pointer">
 <input type="checkbox" checked={hour.is_closed} onChange={(e) => updateHour(hour.day_of_week, "is_closed", e.target.checked)} className="w-4 h-4 text-red-600 rounded border-[#d6cfc7]" />
 <span className="text-sm text-[#78716c]">Chiuso tutto il giorno</span>
 </label>
 </div>

 {!hour.is_closed && (
 <div className="space-y-3">
 {/* Colazione */}
 <div className="flex flex-col sm:flex-row sm:items-center gap-2">
 <div className="flex items-center justify-between sm:justify-start gap-2 sm:w-40">
 <span className="text-xs text-[#a8a29e] font-medium">Colazione</span>
 <label className="flex items-center gap-1 cursor-pointer">
 <input type="checkbox" checked={hour.breakfast_open !== null} onChange={() => toggleMeal(hour.day_of_week, "breakfast")} className="w-3.5 h-3.5 rounded border-[#d6cfc7] text-[#c2410c]" />
 <span className="text-xs text-[#d6cfc7]">{hour.breakfast_open !== null ? "Aperto" : "Chiuso"}</span>
 </label>
 </div>
 {hour.breakfast_open !== null && (
 <div className="flex items-center gap-2 flex-1">
 <input type="time" value={hour.breakfast_open || ""} onChange={(e) => updateHour(hour.day_of_week, "breakfast_open", e.target.value)} className="flex-1 px-2 py-1.5 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 <span className="text-[#d6cfc7]">-</span>
 <input type="time" value={hour.breakfast_close || ""} onChange={(e) => updateHour(hour.day_of_week, "breakfast_close", e.target.value)} className="flex-1 px-2 py-1.5 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 </div>
 )}
 </div>

 {/* Pranzo */}
 <div className="flex flex-col sm:flex-row sm:items-center gap-2">
 <div className="flex items-center justify-between sm:justify-start gap-2 sm:w-40">
 <span className="text-xs text-[#a8a29e] font-medium">Pranzo</span>
 <label className="flex items-center gap-1 cursor-pointer">
 <input type="checkbox" checked={hour.lunch_open !== null} onChange={() => toggleMeal(hour.day_of_week, "lunch")} className="w-3.5 h-3.5 rounded border-[#d6cfc7] text-[#c2410c]" />
 <span className="text-xs text-[#d6cfc7]">{hour.lunch_open !== null ? "Aperto" : "Chiuso"}</span>
 </label>
 </div>
 {hour.lunch_open !== null && (
 <div className="flex items-center gap-2 flex-1">
 <input type="time" value={hour.lunch_open || ""} onChange={(e) => updateHour(hour.day_of_week, "lunch_open", e.target.value)} className="flex-1 px-2 py-1.5 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 <span className="text-[#d6cfc7]">-</span>
 <input type="time" value={hour.lunch_close || ""} onChange={(e) => updateHour(hour.day_of_week, "lunch_close", e.target.value)} className="flex-1 px-2 py-1.5 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 </div>
 )}
 </div>

 {/* Cena */}
 <div className="flex flex-col sm:flex-row sm:items-center gap-2">
 <div className="flex items-center justify-between sm:justify-start gap-2 sm:w-40">
 <span className="text-xs text-[#a8a29e] font-medium">Cena</span>
 <label className="flex items-center gap-1 cursor-pointer">
 <input type="checkbox" checked={hour.dinner_open !== null} onChange={() => toggleMeal(hour.day_of_week, "dinner")} className="w-3.5 h-3.5 rounded border-[#d6cfc7] text-[#c2410c]" />
 <span className="text-xs text-[#d6cfc7]">{hour.dinner_open !== null ? "Aperto" : "Chiuso"}</span>
 </label>
 </div>
 {hour.dinner_open !== null && (
 <div className="flex items-center gap-2 flex-1">
 <input type="time" value={hour.dinner_open || ""} onChange={(e) => updateHour(hour.day_of_week, "dinner_open", e.target.value)} className="flex-1 px-2 py-1.5 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 <span className="text-[#d6cfc7]">-</span>
 <input type="time" value={hour.dinner_close || ""} onChange={(e) => updateHour(hour.day_of_week, "dinner_close", e.target.value)} className="flex-1 px-2 py-1.5 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
 <div>
 <h2 className="text-xl font-bold text-[#1c1917]">Chiusure Straordinarie</h2>
 <p className="text-[#a8a29e] mt-1 text-sm">Ferie, festivi, chiusure temporanee</p>
 </div>
 <button onClick={() => setShowAddClosure(!showAddClosure)} className="bg-[#c2410c] hover:bg-[#9a3412] w-full sm:w-auto px-4 py-2 text-white text-sm font-medium rounded-lg">
 + Aggiungi chiusura
 </button>
 </div>

 {showAddClosure && (
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-4 mb-4">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
 <div>
 <label className="block text-xs text-[#78716c] mb-1">Data inizio</label>
 <input type="date" value={newClosure.start_date} onChange={(e) => setNewClosure({ ...newClosure, start_date: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 </div>
 <div>
 <label className="block text-xs text-[#78716c] mb-1">Data fine</label>
 <input type="date" value={newClosure.end_date} onChange={(e) => setNewClosure({ ...newClosure, end_date: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 </div>
 <div>
 <label className="block text-xs text-[#78716c] mb-1">Motivo (opzionale)</label>
 <input type="text" value={newClosure.reason} onChange={(e) => setNewClosure({ ...newClosure, reason: e.target.value })} placeholder="es. Ferie estive" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 </div>
 </div>
 <div className="flex gap-2">
 <button onClick={addClosure} className="bg-[#c2410c] hover:bg-[#9a3412] flex-1 sm:flex-none px-4 py-2 text-white text-sm rounded-lg ">Aggiungi</button>
 <button onClick={() => setShowAddClosure(false)} className="flex-1 sm:flex-none px-4 py-2 text-[#78716c] text-sm rounded-lg hover:bg-[#f5f0eb] border border-[#e8e0d8]">Annulla</button>
 </div>
 </div>
 )}

 <div className="bg-white rounded-xl border border-[#e8e0d8] overflow-hidden">
 {closures.length > 0 ? (
 <div>
 <div className="sm:hidden divide-y divide-gray-100">
 {closures.map((c) => (
 <div key={c.id} className="p-4 flex justify-between items-start">
 <div>
 <p className="text-sm text-[#1c1917]">{c.start_date === c.end_date ? formatDate(c.start_date) : formatDate(c.start_date) + " - " + formatDate(c.end_date)}</p>
 {c.reason && <p className="text-xs text-[#a8a29e] mt-1">{c.reason}</p>}
 </div>
 <button onClick={() => deleteClosure(c.id)} className="text-sm text-red-600 hover:text-red-800 font-medium shrink-0 ml-2">Rimuovi</button>
 </div>
 ))}
 </div>
 <table className="w-full hidden sm:table">
 <thead>
 <tr className="bg-[#faf7f5] border-b border-[#e8e0d8]">
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Periodo</th>
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Motivo</th>
 <th className="text-right text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Azioni</th>
 </tr>
 </thead>
 <tbody>
 {closures.map((c) => (
 <tr key={c.id} className="border-b border-[#f0ebe5] last:border-0">
 <td className="px-6 py-3 text-sm text-[#1c1917]">{c.start_date === c.end_date ? formatDate(c.start_date) : formatDate(c.start_date) + " -> " + formatDate(c.end_date)}</td>
 <td className="px-6 py-3 text-sm text-[#78716c]">{c.reason || "---"}</td>
 <td className="px-6 py-3 text-right"><button onClick={() => deleteClosure(c.id)} className="text-sm text-red-600 hover:text-red-800 font-medium">Rimuovi</button></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <p className="px-6 py-8 text-sm text-[#d6cfc7] text-center">Nessuna chiusura straordinaria programmata</p>
 )}
 </div>
 </div>
 );
}
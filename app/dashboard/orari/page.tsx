"use client";

import { createClient } from "../../../lib/supabase/client";
import { useEffect, useState } from "react";

const DAYS = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];

interface OpeningHour {
  id: string; day_of_week: number; is_closed: boolean;
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

  async function saveAll() {
    setSaving(true);
    for (const h of hours) {
      await supabase.from("opening_hours").update({
        is_closed: h.is_closed,
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
      restaurant_id: rid,
      start_date: newClosure.start_date,
      end_date: newClosure.end_date,
      reason: newClosure.reason || null,
    });
    setNewClosure({ start_date: "", end_date: "", reason: "" });
    setShowAddClosure(false);
    loadData();
    await syncAll();
  }

  async function deleteClosure(id: string) {
    if (!confirm("Rimuovere questa chiusura?")) return;
    await supabase.from("closures").delete().eq("id", id);
    loadData();
    await syncAll();
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Caricamento...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orari di Apertura</h1>
          <p className="text-gray-500 mt-1">Imposta gli orari per ogni giorno della settimana</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600 font-medium">Salvato e agente aggiornato!</span>}
          {syncing && <span className="text-sm text-blue-600 font-medium">Aggiornamento agente...</span>}
          <button onClick={saveAll} disabled={saving || syncing} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? "Salvataggio..." : syncing ? "Sync agente..." : "Salva tutto"}
          </button>
        </div>
      </div>

      <div className="space-y-4 mb-10">
        {hours.map((hour) => (
          <div key={hour.id} className={"bg-white rounded-xl border border-gray-200 p-5 transition-opacity " + (hour.is_closed ? "opacity-60" : "")}>
            <div className="flex items-center gap-6">
              <div className="w-28"><p className="font-semibold text-gray-900">{DAYS[hour.day_of_week]}</p></div>
              <label className="flex items-center gap-2 cursor-pointer w-32">
                <input type="checkbox" checked={hour.is_closed} onChange={(e) => updateHour(hour.day_of_week, "is_closed", e.target.checked)} className="w-4 h-4 text-red-600 rounded border-gray-300" />
                <span className="text-sm text-gray-600">Chiuso</span>
              </label>
              {!hour.is_closed && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium w-14">Pranzo</span>
                    <input type="time" value={hour.lunch_open || ""} onChange={(e) => updateHour(hour.day_of_week, "lunch_open", e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
                    <span className="text-gray-400">-</span>
                    <input type="time" value={hour.lunch_close || ""} onChange={(e) => updateHour(hour.day_of_week, "lunch_close", e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium w-14">Cena</span>
                    <input type="time" value={hour.dinner_open || ""} onChange={(e) => updateHour(hour.day_of_week, "dinner_open", e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
                    <span className="text-gray-400">-</span>
                    <input type="time" value={hour.dinner_close || ""} onChange={(e) => updateHour(hour.day_of_week, "dinner_close", e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Chiusure Straordinarie</h2>
          <p className="text-gray-500 mt-1">Ferie, festivi, chiusure temporanee</p>
        </div>
        <button onClick={() => setShowAddClosure(!showAddClosure)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          + Aggiungi chiusura
        </button>
      </div>

      {showAddClosure && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Data inizio</label>
              <input type="date" value={newClosure.start_date} onChange={(e) => setNewClosure({ ...newClosure, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Data fine</label>
              <input type="date" value={newClosure.end_date} onChange={(e) => setNewClosure({ ...newClosure, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Motivo (opzionale)</label>
              <input type="text" value={newClosure.reason} onChange={(e) => setNewClosure({ ...newClosure, reason: e.target.value })} placeholder="es. Ferie estive" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addClosure} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Aggiungi</button>
            <button onClick={() => setShowAddClosure(false)} className="px-4 py-1.5 text-gray-600 text-sm rounded-lg hover:bg-gray-100">Annulla</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {closures.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Periodo</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Motivo</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-6 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {closures.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {c.start_date === c.end_date
                      ? formatDate(c.start_date)
                      : formatDate(c.start_date) + " -> " + formatDate(c.end_date)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.reason || "---"}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => deleteClosure(c.id)} className="text-sm text-red-600 hover:text-red-800 font-medium">Rimuovi</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">Nessuna chiusura straordinaria programmata</p>
        )}
      </div>
    </div>
  );
}
"use client";

import { createClient } from "../../../lib/supabase/client";
import { useEffect, useState } from "react";

interface RestaurantInfo { name: string; address: string; phone: string; transfer_phone: string; parking_info: string; }

export default function ImpostazioniPage() {
  const [info, setInfo] = useState<RestaurantInfo>({ name: "", address: "", phone: "", transfer_phone: "", parking_info: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
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

  async function loadData() {
    const rid = await getRestaurantId();
    if (!rid) return;
    const { data: restData } = await supabase
      .from("restaurants")
      .select("name, address, phone, transfer_phone, parking_info")
      .eq("id", rid)
      .single();
    if (restData) setInfo({
      name: restData.name || "",
      address: restData.address || "",
      phone: restData.phone || "",
      transfer_phone: restData.transfer_phone || "",
      parking_info: restData.parking_info || "",
    });
    setLoading(false);
  }

  async function saveAll() {
    setSaving(true);
    const rid = await getRestaurantId();
    if (!rid) return;
    await supabase.from("restaurants").update({
      name: info.name, address: info.address, phone: info.phone,
      transfer_phone: info.transfer_phone, parking_info: info.parking_info,
    }).eq("id", rid);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  async function syncVapi() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync-vapi", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncResult("Errore: " + data.error);
      } else {
        setSyncResult("Agente AI aggiornato con successo!");
      }
    } catch (e) {
      setSyncResult("Errore di connessione");
    }
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 5000);
  }

  async function saveAndSync() {
    await saveAll();
    await syncVapi();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Caricamento...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
          <p className="text-gray-500 mt-1">Informazioni generali del ristorante</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600 font-medium">Salvato!</span>}
          <button onClick={saveAll} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? "Salvataggio..." : "Salva tutto"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Ristorante</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nome ristorante</label>
              <input type="text" value={info.name} onChange={(e) => { setInfo({ ...info, name: e.target.value }); setSaved(false); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Indirizzo</label>
              <input type="text" value={info.address} onChange={(e) => { setInfo({ ...info, address: e.target.value }); setSaved(false); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Telefono ristorante</label>
              <input type="tel" value={info.phone} onChange={(e) => { setInfo({ ...info, phone: e.target.value }); setSaved(false); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Telefono trasferimento (per agente AI)</label>
              <input type="tel" value={info.transfer_phone} onChange={(e) => { setInfo({ ...info, transfer_phone: e.target.value }); setSaved(false); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Informazioni parcheggio</label>
              <textarea value={info.parking_info} onChange={(e) => { setInfo({ ...info, parking_info: e.target.value }); setSaved(false); }} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Agente AI Vocale</h2>
          <p className="text-gray-500 text-sm mb-4">
            Quando modifichi menu, orari, tavoli o informazioni del ristorante, aggiorna l'agente AI per applicare le modifiche alle chiamate telefoniche.
          </p>

          {syncResult && (
            <div className={"mb-4 p-3 rounded-lg text-sm " + (syncResult.startsWith("Errore") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700")}>
              {syncResult}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={syncVapi} disabled={syncing} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {syncing ? "Aggiornamento in corso..." : "Aggiorna Agente AI"}
            </button>
            <button onClick={saveAndSync} disabled={saving || syncing} className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving || syncing ? "..." : "Salva tutto + Aggiorna Agente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
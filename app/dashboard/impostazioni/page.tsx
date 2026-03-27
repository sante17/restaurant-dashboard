"use client";

import { createClient } from "../../../lib/supabase/client";
import { useEffect, useState } from "react";

interface RestaurantInfo { name: string; address: string; phone: string; transfer_phone: string; parking_info: string; }

export default function ImpostazioniPage() {
  const [info, setInfo] = useState<RestaurantInfo>({ name: "", address: "", phone: "", transfer_phone: "", parking_info: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
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
    const { data } = await supabase
      .from("restaurants")
      .select("name, address, phone, transfer_phone, parking_info")
      .eq("id", rid)
      .single();
    if (data) setInfo({
      name: data.name || "",
      address: data.address || "",
      phone: data.phone || "",
      transfer_phone: data.transfer_phone || "",
      parking_info: data.parking_info || "",
    });
    setLoading(false);
  }

  async function salva() {
    setSaving(true);
    setSaveResult(null);
    try {
      const rid = await getRestaurantId();
      if (!rid) throw new Error("Ristorante non trovato");

      const { error: dbError } = await supabase.from("restaurants").update({
        name: info.name, address: info.address, phone: info.phone,
        transfer_phone: info.transfer_phone, parking_info: info.parking_info,
      }).eq("id", rid);
      if (dbError) throw new Error("Errore salvataggio: " + dbError.message);

      const res = await fetch("/api/sync-vapi", { method: "POST" });
      const vapiData = await res.json();
      if (vapiData.error) throw new Error("Errore agente AI: " + vapiData.error);

      setSaveResult({ ok: true, msg: "Salvato!" });
    } catch (e: any) {
      setSaveResult({ ok: false, msg: e.message || "Errore sconosciuto" });
    }
    setSaving(false);
    setTimeout(() => setSaveResult(null), 4000);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-[#a8a29e]">Caricamento...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1c1917]">Impostazioni</h1>
          <p className="text-[#a8a29e] mt-1">Informazioni generali del ristorante</p>
        </div>
        <div className="flex items-center gap-3">
          {saveResult && (
            <span className={"text-sm font-medium " + (saveResult.ok ? "text-green-600" : "text-red-600")}>
              {saveResult.msg}
            </span>
          )}
          <button onClick={salva} disabled={saving} className="bg-[#c2410c] hover:bg-[#9a3412] px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {saving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e8e0d8] p-6">
        <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Informazioni Ristorante</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#78716c] mb-1">Nome ristorante</label>
            <input type="text" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
          </div>
          <div>
            <label className="block text-sm text-[#78716c] mb-1">Indirizzo</label>
            <input type="text" value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
          </div>
          <div>
            <label className="block text-sm text-[#78716c] mb-1">Telefono ristorante</label>
            <input type="tel" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
          </div>
          <div>
            <label className="block text-sm text-[#78716c] mb-1">Telefono trasferimento (agente AI)</label>
            <input type="tel" value={info.transfer_phone} onChange={(e) => setInfo({ ...info, transfer_phone: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-[#78716c] mb-1">Informazioni parcheggio</label>
            <textarea value={info.parking_info} onChange={(e) => setInfo({ ...info, parking_info: e.target.value })} rows={2} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none resize-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
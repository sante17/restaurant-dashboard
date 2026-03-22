"use client";

import { createClient } from "../../lib/supabase/client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [stats, setStats] = useState({ breakfast: 0, lunch: 0, dinner: 0, tables: 0, menuItems: 0, categories: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: userData } = await supabase.from("users").select("restaurant_id").eq("id", user.id).single();
    if (!userData?.restaurant_id) return;
    const rid = userData.restaurant_id;

    const [tablesRes, itemsRes, catsRes] = await Promise.all([
      supabase.from("tables").select("id", { count: "exact" }).eq("restaurant_id", rid).eq("is_active", true),
      supabase.from("menu_items").select("id", { count: "exact" }).eq("restaurant_id", rid).eq("is_available", true),
      supabase.from("menu_categories").select("id", { count: "exact" }).eq("restaurant_id", rid),
    ]);

    let breakfast = 0, lunch = 0, dinner = 0;
    try {
      const res = await fetch("/api/prenotazioni");
      const data = await res.json();
      if (!data.error && data.prenotazioni) {
        const today = new Date().toISOString().split("T")[0];
        const todayBookings = data.prenotazioni.filter((p: any) => p.Data === today && p.Stato === "Confermata");
        for (const b of todayBookings) {
          const hour = parseInt(b.OraInizio.split(":")[0], 10);
          if (hour < 11) breakfast++;
          else if (hour < 17) lunch++;
          else dinner++;
        }
      }
    } catch {}

    setStats({
      breakfast,
      lunch,
      dinner,
      tables: tablesRes.count || 0,
      menuItems: itemsRes.count || 0,
      categories: catsRes.count || 0,
    });
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Caricamento...</p></div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panoramica</h1>
        <p className="text-gray-500 mt-1 text-sm">Riepilogo del tuo ristorante per oggi</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Colazione oggi</p>
          <p className="text-3xl font-bold text-gray-900">{stats.breakfast}</p>
          <p className="text-xs text-gray-400 mt-1">prenotazioni</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Pranzo oggi</p>
          <p className="text-3xl font-bold text-gray-900">{stats.lunch}</p>
          <p className="text-xs text-gray-400 mt-1">prenotazioni</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Cena oggi</p>
          <p className="text-3xl font-bold text-gray-900">{stats.dinner}</p>
          <p className="text-xs text-gray-400 mt-1">prenotazioni</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Tavoli attivi</p>
          <p className="text-3xl font-bold text-gray-900">{stats.tables}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Piatti nel menu</p>
          <p className="text-3xl font-bold text-gray-900">{stats.menuItems}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Categorie menu</p>
          <p className="text-3xl font-bold text-gray-900">{stats.categories}</p>
        </div>
      </div>
    </div>
  );
}
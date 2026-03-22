"use client";

import { createClient } from "../../lib/supabase/client";
import { useEffect, useState } from "react";

interface Stats {
  tables: number;
  menuItems: number;
  categories: number;
  restaurantName: string;
  lunchBookings: number;
  dinnerBookings: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadStats() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("restaurant_id")
        .eq("id", user.id)
        .single();

      if (!userData?.restaurant_id) return;
      const rid = userData.restaurant_id;

      const [restaurant, tables, menuItems, categories] = await Promise.all([
        supabase.from("restaurants").select("name").eq("id", rid).single(),
        supabase.from("tables").select("id", { count: "exact" }).eq("restaurant_id", rid).eq("is_active", true),
        supabase.from("menu_items").select("id", { count: "exact" }).eq("restaurant_id", rid).eq("is_available", true),
        supabase.from("menu_categories").select("id", { count: "exact" }).eq("restaurant_id", rid),
      ]);

      // Carica prenotazioni di oggi dal Google Sheet
      let lunchBookings = 0;
      let dinnerBookings = 0;
      try {
        const res = await fetch("/api/prenotazioni");
        const data = await res.json();
        if (data.prenotazioni) {
          const today = new Date().toISOString().split("T")[0];
          const todayBookings = data.prenotazioni.filter(
            (p: any) => p.Data === today && p.Stato === "Confermata"
          );
          todayBookings.forEach((p: any) => {
            const hour = parseInt(p.OraInizio.split(":")[0]);
            if (hour < 16) {
              lunchBookings++;
            } else {
              dinnerBookings++;
            }
          });
        }
      } catch (e) {
        console.error("Errore caricamento prenotazioni:", e);
      }

      setStats({
        restaurantName: restaurant.data?.name || "Ristorante",
        tables: tables.count || 0,
        menuItems: menuItems.count || 0,
        categories: categories.count || 0,
        lunchBookings,
        dinnerBookings,
      });
      setLoading(false);
    }
    loadStats();
  }, []);

  function formatToday() {
    const d = new Date();
    const days = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    return days[d.getDay()] + " " + d.getDate() + " " + months[d.getMonth()];
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Caricamento...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Benvenuto, {stats?.restaurantName}!
        </h1>
        <p className="text-gray-500 mt-1">Ecco un riepilogo del tuo ristorante</p>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Prenotazioni di oggi — {formatToday()}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-3xl mb-2">☀️</div>
            <p className="text-sm text-gray-500">Pranzo</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.lunchBookings}</p>
            <p className="text-xs text-gray-400 mt-1">prenotazioni confermate</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-3xl mb-2">🌙</div>
            <p className="text-sm text-gray-500">Cena</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.dinnerBookings}</p>
            <p className="text-xs text-gray-400 mt-1">prenotazioni confermate</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Il tuo ristorante</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-3xl mb-2">🪑</div>
            <p className="text-sm text-gray-500">Tavoli attivi</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.tables}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-3xl mb-2">🍽️</div>
            <p className="text-sm text-gray-500">Piatti nel menu</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.menuItems}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm text-gray-500">Categorie menu</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.categories}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { createClient } from "../../lib/supabase/client";
import { useEffect, useState } from "react";

interface Prenotazione {
  ID: string; Nome: string; OraInizio: string; OraFine: string;
  Tavolo: string; Persone: string; Stato: string; Data: string;
  Presentato?: string;
}

interface Tavolo { name: string; seats: number; location?: string; }

export default function DashboardPage() {
  const [stats, setStats] = useState({ breakfast: 0, lunch: 0, dinner: 0, tables: 0, activeTables: 0, menuItems: 0, categories: 0, calls: 0 });
  const [nextBookings, setNextBookings] = useState<Prenotazione[]>([]);
  const [activeBookings, setActiveBookings] = useState<Prenotazione[]>([]);
  const [tavoli, setTavoli] = useState<Tavolo[]>([]);
  const [occupiedTables, setOccupiedTables] = useState<Set<string>>(new Set());
  const [presentatoStates, setPresentatoStates] = useState<Record<string, string>>({});
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
      supabase.from("tables").select("name, seats, is_active, location").eq("restaurant_id", rid),
      supabase.from("menu_items").select("id", { count: "exact" }).eq("restaurant_id", rid).eq("is_available", true),
      supabase.from("menu_categories").select("id", { count: "exact" }).eq("restaurant_id", rid),
    ]);

    const allTables = tablesRes.data || [];
    const activeTables = allTables.filter(t => t.is_active);
    setTavoli(activeTables.map(t => ({ name: t.name, seats: t.seats, location: t.location || "interno" })));

    let breakfast = 0, lunch = 0, dinner = 0;
    let upcoming: Prenotazione[] = [];
    let active: Prenotazione[] = [];
    const occupied = new Set<string>();
    const initialPresentato: Record<string, string> = {};

    try {
      const res = await fetch("/api/prenotazioni");
      const data = await res.json();
      if (!data.error && data.prenotazioni) {
        const today = new Date().toISOString().split("T")[0];
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const todayBookings = data.prenotazioni.filter((p: any) => p.Data === today && p.Stato === "Confermata");

        for (const b of todayBookings) {
          const hour = parseInt(b.OraInizio.split(":")[0], 10);
          if (hour < 11) breakfast++;
          else if (hour < 17) lunch++;
          else dinner++;

          const [startH, startM] = b.OraInizio.split(":").map(Number);
          const [endH, endM] = b.OraFine.split(":").map(Number);
          const startMin = startH * 60 + startM;
          const endMin = endH * 60 + endM;

          if (currentMinutes >= startMin && currentMinutes < endMin) {
            occupied.add(b.Tavolo);
            active.push(b);
            // Default Sì — salviamo solo quando l'utente cambia
            initialPresentato[b.ID] = b.Presentato || "Sì";
          }

          if (startMin > currentMinutes) {
            upcoming.push(b);
          }
        }

        active.sort((a, b) => a.OraInizio.localeCompare(b.OraInizio));
        upcoming.sort((a: any, b: any) => a.OraInizio.localeCompare(b.OraInizio));
        upcoming = upcoming.slice(0, 5);
      }
    } catch {}

    let callCount = 0;
    try {
      const callRes = await fetch("/api/chiamate?limit=50");
      const callData = await callRes.json();
      if (!callData.error && callData.calls) {
        const today = new Date().toISOString().split("T")[0];
        callCount = callData.calls.filter((c: any) => c.startedAt && c.startedAt.startsWith(today)).length;
      }
    } catch {}

    setOccupiedTables(occupied);
    setNextBookings(upcoming);
    setActiveBookings(active);
    setPresentatoStates(initialPresentato);
    setStats({
      breakfast, lunch, dinner,
      tables: allTables.length,
      activeTables: activeTables.length,
      menuItems: itemsRes.count || 0,
      categories: catsRes.count || 0,
      calls: callCount,
    });
    setLoading(false);
  }

  async function segnaPresenza(id: string, nuovoValore: "Sì" | "No") {
    setPresentatoStates(prev => ({ ...prev, [id]: nuovoValore }));
    try {
      await fetch("/api/prenotazioni", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "presentato", updates: { valore: nuovoValore } }),
      });
    } catch {
      setPresentatoStates(prev => ({ ...prev, [id]: nuovoValore === "Sì" ? "No" : "Sì" }));
    }
  }

  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  const avatarColors = ["#fef3c7", "#e0e7ff", "#d1fae5", "#fce7f3", "#e0f2fe", "#fef9c3"];
  const avatarTextColors = ["#92400e", "#3730a3", "#065f46", "#9d174d", "#075985", "#854d0e"];

  if (loading) return <div className="flex items-center justify-center h-64"><p style={{ color: "#a8a29e" }}>Caricamento...</p></div>;

  const totalToday = stats.breakfast + stats.lunch + stats.dinner;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1c1917" }}>Panoramica</h1>
        <p className="text-sm mt-1" style={{ color: "#a8a29e" }}>
          {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {" — "}{totalToday} prenotazioni oggi
        </p>
      </div>

      {/* Banner Presentato — visibile solo durante il servizio */}
      {activeBookings.length > 0 && (
        <div className="mb-6 bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #fca97a" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: "#fff7ed", borderBottom: "1px solid #fca97a" }}>
            <div className="w-2 h-2 rounded-full bg-[#c2410c] animate-pulse" />
            <p className="text-sm font-semibold" style={{ color: "#c2410c" }}>Servizio in corso — conferma presenze</p>
          </div>
          <div>
            {activeBookings.map((b, i) => {
              const stato = presentatoStates[b.ID] || "Sì";
              return (
                <div key={b.ID} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
                  style={{ borderBottom: i < activeBookings.length - 1 ? "1px solid #f5f0eb" : "none" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ background: "#fff7ed", color: "#c2410c" }}>
                      {getInitials(b.Nome)}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#1c1917" }}>{b.Nome}</p>
                      <p className="text-xs" style={{ color: "#a8a29e" }}>{b.OraInizio}–{b.OraFine} · {b.Persone} pers. · {b.Tavolo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-12 sm:ml-0">
                    <span className="text-xs font-medium" style={{ color: stato === "Sì" ? "#15803d" : "#dc2626" }}>
                      {stato === "Sì" ? "Presentato" : "Non presentato"}
                    </span>
                    <button
                      onClick={() => segnaPresenza(b.ID, stato === "Sì" ? "No" : "Sì")}
                      className={"relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"}
                      style={{ background: stato === "Sì" ? "#22c55e" : "#f87171" }}
                    >
                      <span className={"inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform " + (stato === "Sì" ? "translate-x-4" : "translate-x-1")} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e8e0d8", borderLeft: "3px solid #c2410c" }}>
          <p className="text-xs" style={{ color: "#a8a29e" }}>Colazione</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.breakfast}</p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e8e0d8", borderLeft: "3px solid #d97706" }}>
          <p className="text-xs" style={{ color: "#a8a29e" }}>Pranzo</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.lunch}</p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e8e0d8", borderLeft: "3px solid #7c3aed" }}>
          <p className="text-xs" style={{ color: "#a8a29e" }}>Cena</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.dinner}</p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e8e0d8", borderLeft: "3px solid #0891b2" }}>
          <p className="text-xs" style={{ color: "#a8a29e" }}>Chiamate oggi</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.calls}</p>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5" style={{ border: "1px solid #e8e0d8" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#1c1917" }}>Prossime prenotazioni</h2>
          {nextBookings.length > 0 ? (
            <div>
              {nextBookings.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-3"
                  style={{ borderBottom: i < nextBookings.length - 1 ? "1px solid #f5f0eb" : "none" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ background: avatarColors[i % avatarColors.length], color: avatarTextColors[i % avatarTextColors.length] }}>
                      {getInitials(b.Nome)}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#1c1917" }}>{b.Nome}</p>
                      <p className="text-xs" style={{ color: "#a8a29e" }}>{b.Persone} pers. — {b.Tavolo}</p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#fff7ed", color: "#c2410c" }}>
                    {b.OraInizio}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm py-6 text-center" style={{ color: "#d6d3d1" }}>Nessuna prenotazione imminente</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #e8e0d8" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#1c1917" }}>Stato tavoli</h2>
          <div className="grid grid-cols-2 gap-2">
            {tavoli.map((t) => {
              const isOccupied = occupiedTables.has(t.name);
              return (
                <div key={t.name} className="rounded-lg p-3 text-center"
                  style={{ background: isOccupied ? "#fff7ed" : "#f0fdf4" }}>
                  <p className="text-xs font-semibold" style={{ color: isOccupied ? "#9a3412" : "#166534" }}>{t.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: isOccupied ? "#c2410c" : "#15803d" }}>
                    {isOccupied ? "Occupato" : "Libero"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#a8a29e" }}>{t.seats}p</p>
                  <span className={"inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full font-medium " + (t.location === "esterno" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}>
                    {t.location === "esterno" ? "Est." : "Int."}
                  </span>
                </div>
              );
            })}
          </div>
          {tavoli.length === 0 && <p className="text-sm py-4 text-center" style={{ color: "#d6d3d1" }}>Nessun tavolo attivo</p>}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e8e0d8" }}>
          <p className="text-xs" style={{ color: "#a8a29e" }}>Tavoli attivi</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.activeTables}</p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e8e0d8" }}>
          <p className="text-xs" style={{ color: "#a8a29e" }}>Piatti nel menu</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.menuItems}</p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e8e0d8" }}>
          <p className="text-xs" style={{ color: "#a8a29e" }}>Categorie menu</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.categories}</p>
        </div>
      </div>
    </div>
  );
}
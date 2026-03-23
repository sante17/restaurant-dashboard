"use client";

import { createClient } from "../../lib/supabase/client";
import { useEffect, useState } from "react";

interface Prenotazione {
 Nome: string; OraInizio: string; OraFine: string; Tavolo: string; Persone: string; Stato: string; Data: string;
}

interface Tavolo { name: string; seats: number; }

export default function DashboardPage() {
 const [stats, setStats] = useState({ breakfast: 0, lunch: 0, dinner: 0, tables: 0, activeTables: 0, menuItems: 0, categories: 0, calls: 0 });
 const [nextBookings, setNextBookings] = useState<Prenotazione[]>([]);
 const [tavoli, setTavoli] = useState<Tavolo[]>([]);
 const [occupiedTables, setOccupiedTables] = useState<Set<string>>(new Set());
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
 supabase.from("tables").select("name, seats, is_active").eq("restaurant_id", rid),
 supabase.from("menu_items").select("id", { count: "exact" }).eq("restaurant_id", rid).eq("is_available", true),
 supabase.from("menu_categories").select("id", { count: "exact" }).eq("restaurant_id", rid),
 ]);

 const allTables = tablesRes.data || [];
 const activeTables = allTables.filter(t => t.is_active);
 setTavoli(activeTables.map(t => ({ name: t.name, seats: t.seats })));

 let breakfast = 0, lunch = 0, dinner = 0;
 let upcoming: Prenotazione[] = [];
 const occupied = new Set<string>();

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

 // Check if currently occupied
 const [startH, startM] = b.OraInizio.split(":").map(Number);
 const [endH, endM] = b.OraFine.split(":").map(Number);
 const startMin = startH * 60 + startM;
 const endMin = endH * 60 + endM;
 if (currentMinutes >= startMin && currentMinutes < endMin) {
 occupied.add(b.Tavolo);
 }

 // Upcoming = starts in the future
 if (startMin > currentMinutes) {
 upcoming.push(b);
 }
 }

 upcoming.sort((a: any, b: any) => a.OraInizio.localeCompare(b.OraInizio));
 upcoming = upcoming.slice(0, 5);
 }
 } catch {}

 // Try to get call count
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

 {/* Stats cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
 <div className="bg-white rounded-xl p-4" style={{ borderLeft: "3px solid #c2410c", border: "1px solid #e8e0d8", borderLeftWidth: "3px", borderLeftColor: "#c2410c" }}>
 <p className="text-xs" style={{ color: "#a8a29e" }}>Colazione</p>
 <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.breakfast}</p>
 </div>
 <div className="bg-white rounded-xl p-4" style={{ borderLeft: "3px solid #d97706", border: "1px solid #e8e0d8", borderLeftWidth: "3px", borderLeftColor: "#d97706" }}>
 <p className="text-xs" style={{ color: "#a8a29e" }}>Pranzo</p>
 <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.lunch}</p>
 </div>
 <div className="bg-white rounded-xl p-4" style={{ borderLeft: "3px solid #7c3aed", border: "1px solid #e8e0d8", borderLeftWidth: "3px", borderLeftColor: "#7c3aed" }}>
 <p className="text-xs" style={{ color: "#a8a29e" }}>Cena</p>
 <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.dinner}</p>
 </div>
 <div className="bg-white rounded-xl p-4" style={{ borderLeft: "3px solid #0891b2", border: "1px solid #e8e0d8", borderLeftWidth: "3px", borderLeftColor: "#0891b2" }}>
 <p className="text-xs" style={{ color: "#a8a29e" }}>Chiamate oggi</p>
 <p className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>{stats.calls}</p>
 </div>
 </div>

 {/* Two columns: bookings + tables */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
 {/* Next bookings */}
 <div className="lg:col-span-2 bg-white rounded-xl p-5" style={{ border: "1px solid #e8e0d8" }}>
 <h2 className="text-sm font-semibold mb-4" style={{ color: "#1c1917" }}>Prossime prenotazioni</h2>
 {nextBookings.length > 0 ? (
 <div className="space-y-0">
 {nextBookings.map((b, i) => (
 <div key={i} className="flex items-center justify-between py-3" style={{ borderBottom: i < nextBookings.length - 1 ? "1px solid #f5f0eb" : "none" }}>
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

 {/* Table status */}
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
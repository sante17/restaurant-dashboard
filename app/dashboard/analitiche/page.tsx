"use client";

import { useEffect, useState } from "react";

interface Prenotazione {
  ID: string; Data: string; OraInizio: string; OraFine: string;
  Tavolo: string; Nome: string; Telefono: string; Email: string;
  Persone: string; Stato: string;
}

interface CustomerStats {
  nome: string;
  telefono: string;
  email: string;
  totalBookings: number;
  totalPersone: number;
  avgPersone: number;
  firstBooking: string;
  lastBooking: string;
  avgDaysBetween: number | null;
  dates: string[];
}

export default function AnalitichePage() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<"bookings" | "persone" | "recent">("bookings");
  const [period, setPeriod] = useState<"all" | "3months" | "6months" | "year">("all");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/prenotazioni");
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setPrenotazioni(data.prenotazioni || []);
    } catch { setError("Errore nel caricamento"); }
    setLoading(false);
  }

  function getFilteredBookings(): Prenotazione[] {
    let filtered = prenotazioni.filter(p => p.Stato === "Confermata" && p.Nome && p.Nome.trim());
    if (period !== "all") {
      const now = new Date();
      let cutoff = new Date();
      if (period === "3months") cutoff.setMonth(now.getMonth() - 3);
      if (period === "6months") cutoff.setMonth(now.getMonth() - 6);
      if (period === "year") cutoff.setFullYear(now.getFullYear() - 1);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      filtered = filtered.filter(p => p.Data >= cutoffStr);
    }
    return filtered;
  }

  function buildCustomerStats(): CustomerStats[] {
    const bookings = getFilteredBookings();
    const map = new Map<string, { nome: string; telefono: string; email: string; bookings: Prenotazione[] }>();

    for (const p of bookings) {
      // Raggruppa per telefono (se disponibile) o per nome normalizzato
      const key = p.Telefono && p.Telefono.trim()
        ? p.Telefono.trim().replace(/\s+/g, "")
        : p.Nome.trim().toLowerCase();

      if (!map.has(key)) {
        map.set(key, { nome: p.Nome.trim(), telefono: p.Telefono || "", email: p.Email || "", bookings: [] });
      }
      const entry = map.get(key)!;
      entry.bookings.push(p);
      // Aggiorna nome/email con la versione più recente
      if (p.Data > (entry.bookings[entry.bookings.length - 2]?.Data || "")) {
        entry.nome = p.Nome.trim();
        if (p.Email) entry.email = p.Email;
      }
    }

    const stats: CustomerStats[] = [];
    for (const [, entry] of map) {
      const sorted = entry.bookings.sort((a, b) => a.Data.localeCompare(b.Data));
      const persone = sorted.map(b => parseInt(b.Persone, 10) || 1);
      const totalPersone = persone.reduce((s, p) => s + p, 0);
      const dates = sorted.map(b => b.Data);

      let avgDays: number | null = null;
      if (dates.length >= 2) {
        const dayDiffs: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          const d1 = new Date(dates[i - 1]);
          const d2 = new Date(dates[i]);
          dayDiffs.push(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
        }
        avgDays = Math.round(dayDiffs.reduce((s, d) => s + d, 0) / dayDiffs.length);
      }

      stats.push({
        nome: entry.nome,
        telefono: entry.telefono,
        email: entry.email,
        totalBookings: sorted.length,
        totalPersone,
        avgPersone: Math.round((totalPersone / sorted.length) * 10) / 10,
        firstBooking: dates[0],
        lastBooking: dates[dates.length - 1],
        avgDaysBetween: avgDays,
        dates,
      });
    }

    // Ordina
    if (sortBy === "bookings") stats.sort((a, b) => b.totalBookings - a.totalBookings);
    else if (sortBy === "persone") stats.sort((a, b) => b.totalPersone - a.totalPersone);
    else if (sortBy === "recent") stats.sort((a, b) => b.lastBooking.localeCompare(a.lastBooking));

    return stats;
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "---";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  }

  function getFrequencyLabel(avgDays: number | null) {
    if (avgDays === null) return "Prima visita";
    if (avgDays <= 7) return "Settimanale";
    if (avgDays <= 14) return "Bisettimanale";
    if (avgDays <= 35) return "Mensile";
    if (avgDays <= 70) return "Bimestrale";
    return "Occasionale";
  }

  function getFrequencyColor(avgDays: number | null) {
    if (avgDays === null) return "bg-gray-100 text-gray-600";
    if (avgDays <= 14) return "bg-green-100 text-green-700";
    if (avgDays <= 35) return "bg-blue-100 text-blue-700";
    if (avgDays <= 70) return "bg-amber-100 text-amber-700";
    return "bg-gray-100 text-gray-600";
  }

  const bookings = getFilteredBookings();
  const customers = buildCustomerStats();
  const repeatCustomers = customers.filter(c => c.totalBookings > 1);
  const totalGuests = bookings.reduce((s, b) => s + (parseInt(b.Persone, 10) || 1), 0);

  // Distribuzione oraria
  const hourDistribution: Record<string, number> = {};
  for (const b of bookings) {
    const hour = b.OraInizio?.split(":")[0];
    if (hour) hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
  }
  const topHours = Object.entries(hourDistribution).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Distribuzione giorno settimana
  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const dayDistribution: Record<number, number> = {};
  for (const b of bookings) {
    if (b.Data) {
      const day = new Date(b.Data + "T00:00:00").getDay();
      dayDistribution[day] = (dayDistribution[day] || 0) + 1;
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Caricamento analitiche...</p></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analitiche</h1>
          <p className="text-gray-500 mt-1 text-sm">Insights sui tuoi clienti e prenotazioni</p>
        </div>
        <button onClick={loadData} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Aggiorna</button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Filtro periodo */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([["all", "Tutto"], ["3months", "3 mesi"], ["6months", "6 mesi"], ["year", "12 mesi"]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setPeriod(val)}
            className={"px-4 py-2 text-sm font-medium rounded-lg transition-colors " + (period === val ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>
            {label}
          </button>
        ))}
      </div>

      {/* Stats generali */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Prenotazioni</p>
          <p className="text-2xl font-bold text-gray-900">{bookings.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Clienti unici</p>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Clienti abituali</p>
          <p className="text-2xl font-bold text-gray-900">{repeatCustomers.length}</p>
          <p className="text-xs text-gray-400">{customers.length > 0 ? Math.round(repeatCustomers.length / customers.length * 100) : 0}% del totale</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Ospiti totali</p>
          <p className="text-2xl font-bold text-gray-900">{totalGuests}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Media persone</p>
          <p className="text-2xl font-bold text-gray-900">{bookings.length > 0 ? (totalGuests / bookings.length).toFixed(1) : "---"}</p>
        </div>
      </div>

      {/* Distribuzione giorno e ora */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Prenotazioni per giorno</h3>
          <div className="space-y-2">
            {dayNames.map((name, i) => {
              const count = dayDistribution[i] || 0;
              const maxCount = Math.max(...Object.values(dayDistribution), 1);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-8">{name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: (count / maxCount * 100) + "%" }} />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Orari piu richiesti</h3>
          {topHours.length > 0 ? (
            <div className="space-y-2">
              {topHours.map(([hour, count]) => {
                const maxCount = topHours[0][1] as number;
                return (
                  <div key={hour} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-12">{hour}:00</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: ((count as number) / (maxCount as number) * 100) + "%" }} />
                    </div>
                    <span className="text-xs text-gray-600 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Nessun dato disponibile</p>
          )}
        </div>
      </div>

      {/* Classifica clienti */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Classifica clienti</h2>
          <div className="flex gap-2">
            {([["bookings", "Visite"], ["persone", "Ospiti"], ["recent", "Recenti"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setSortBy(val)}
                className={"px-3 py-1 text-xs font-medium rounded-lg transition-colors " + (sortBy === val ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {customers.length > 0 ? (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {customers.slice(0, 50).map((c, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {i < 3 && <span className="text-sm">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>}
                        <p className="text-sm font-semibold text-gray-900">{c.nome}</p>
                      </div>
                      {c.telefono && <p className="text-xs text-gray-500 font-mono mt-0.5">{c.telefono}</p>}
                    </div>
                    <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + getFrequencyColor(c.avgDaysBetween)}>
                      {getFrequencyLabel(c.avgDaysBetween)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Visite</span>
                      <p className="font-semibold text-gray-900">{c.totalBookings}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Media pers.</span>
                      <p className="font-semibold text-gray-900">{c.avgPersone}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Ultima</span>
                      <p className="font-semibold text-gray-900">{formatDate(c.lastBooking)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabella */}
            <table className="w-full hidden sm:table">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">#</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Telefono</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-4 py-3">Visite</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-4 py-3">Ospiti tot.</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-4 py-3">Media pers.</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Frequenza</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Prima visita</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Ultima visita</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 50).map((c, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                      {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{c.telefono || "---"}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center font-semibold">{c.totalBookings}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">{c.totalPersone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">{c.avgPersone}</td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + getFrequencyColor(c.avgDaysBetween)}>
                        {getFrequencyLabel(c.avgDaysBetween)}
                      </span>
                      {c.avgDaysBetween !== null && <span className="text-xs text-gray-400 ml-1">({c.avgDaysBetween}gg)</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.firstBooking)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.lastBooking)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">Nessuna prenotazione trovata per questo periodo</p>
        )}
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";

interface Prenotazione {
  ID: string; Data: string; OraInizio: string; OraFine: string;
  Tavolo: string; Nome: string; Telefono: string; Email: string;
  Persone: string; Stato: string; Fonte: string; Presentato: string;
  TimestampConferma: string; Posizione: string;
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
  presenteCount: number;
  noShowCount: number;
  attendanceRate: number | null;
  dates: string[];
}

// ─── Pie chart ───────────────────────────────────────────────────────────────

interface PieSlice { label: string; value: number; color: string }

function PieChart({ data }: { data: PieSlice[] }) {
  const active = data.filter((d) => d.value > 0);
  const total = active.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-sm text-[#d6cfc7] text-center py-6">Nessun dato disponibile</p>;

  const cx = 80, cy = 80, r = 62, ir = 36;
  let angle = -Math.PI / 2;

  const slices = active.map((d) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const start = angle;
    angle += sweep;
    const end = angle;
    const large = sweep > Math.PI ? 1 : 0;
    const isFull = sweep >= 2 * Math.PI - 0.0001;
    return { ...d, sweep, start, end, large, isFull, pct: Math.round((d.value / total) * 100) };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160" className="flex-shrink-0">
        {slices.map((s, i) =>
          s.isFull ? (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} fill={s.color} />
              <circle cx={cx} cy={cy} r={ir} fill="#ffffff" />
            </g>
          ) : (
            <path key={i} fill={s.color} d={[
              `M${cx + r * Math.cos(s.start)},${cy + r * Math.sin(s.start)}`,
              `A${r},${r} 0 ${s.large} 1 ${cx + r * Math.cos(s.end)},${cy + r * Math.sin(s.end)}`,
              `L${cx + ir * Math.cos(s.end)},${cy + ir * Math.sin(s.end)}`,
              `A${ir},${ir} 0 ${s.large} 0 ${cx + ir * Math.cos(s.start)},${cy + ir * Math.sin(s.start)}`,
              "Z",
            ].join(" ")} />
          )
        )}
      </svg>
      <div className="space-y-2.5 w-full">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-sm text-[#78716c] flex-1">{s.label}</span>
            <span className="text-sm font-semibold text-[#1c1917]">{s.value}</span>
            <span className="text-xs text-[#a8a29e] w-9 text-right">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FONTE_COLORS: Record<string, string> = {
  Telefono: "#c2410c",
  WhatsApp: "#16a34a",
  Dashboard: "#6366f1",
  Manuale: "#6366f1",
};

function getFonteColor(label: string) {
  return FONTE_COLORS[label] ?? "#a8a29e";
}

function isPresente(val: string) {
  return val.trim().toLowerCase().startsWith("s");
}
function isNoShow(val: string) {
  return val.trim().toLowerCase().startsWith("n");
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
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
  if (avgDays === null) return "bg-[#f5f0eb] text-[#78716c]";
  if (avgDays <= 14) return "bg-green-100 text-green-700";
  if (avgDays <= 35) return "bg-[#fff7ed] text-[#c2410c]";
  if (avgDays <= 70) return "bg-amber-100 text-amber-700";
  return "bg-[#f5f0eb] text-[#78716c]";
}

function getAttendanceBadge(rate: number | null): string {
  if (rate === null) return "bg-[#f5f0eb] text-[#78716c]";
  if (rate >= 80) return "bg-green-100 text-green-700";
  if (rate >= 50) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-600";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    let filtered = prenotazioni.filter((p) => p.Stato === "Confermata" && p.Nome?.trim());
    if (period !== "all") {
      const now = new Date();
      const cutoff = new Date(now);
      if (period === "3months") cutoff.setMonth(now.getMonth() - 3);
      if (period === "6months") cutoff.setMonth(now.getMonth() - 6);
      if (period === "year") cutoff.setFullYear(now.getFullYear() - 1);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      filtered = filtered.filter((p) => p.Data >= cutoffStr);
    }
    return filtered;
  }

  function buildCustomerStats(): CustomerStats[] {
    const bookings = getFilteredBookings();
    const map = new Map<string, { nome: string; telefono: string; email: string; bookings: Prenotazione[] }>();

    for (const p of bookings) {
      const key = p.Telefono?.trim().replace(/\s+/g, "") || p.Nome.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { nome: p.Nome.trim(), telefono: p.Telefono || "", email: p.Email || "", bookings: [] });
      const entry = map.get(key)!;
      entry.bookings.push(p);
      if (p.Data > (entry.bookings[entry.bookings.length - 2]?.Data || "")) {
        entry.nome = p.Nome.trim();
        if (p.Email) entry.email = p.Email;
      }
    }

    const stats: CustomerStats[] = [];
    for (const [, entry] of map) {
      const sorted = entry.bookings.sort((a, b) => a.Data.localeCompare(b.Data));
      const persone = sorted.map((b) => parseInt(b.Persone, 10) || 1);
      const totalPersone = persone.reduce((s, p) => s + p, 0);
      const dates = sorted.map((b) => b.Data);

      let avgDays: number | null = null;
      if (dates.length >= 2) {
        const diffs: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          diffs.push(Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000));
        }
        avgDays = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
      }

      const withPresence = sorted.filter((b) => b.Presentato?.trim());
      const presenteCount = withPresence.filter((b) => isPresente(b.Presentato)).length;
      const noShowCount = withPresence.filter((b) => isNoShow(b.Presentato)).length;

      stats.push({
        nome: entry.nome, telefono: entry.telefono, email: entry.email,
        totalBookings: sorted.length, totalPersone,
        avgPersone: Math.round((totalPersone / sorted.length) * 10) / 10,
        firstBooking: dates[0], lastBooking: dates[dates.length - 1],
        avgDaysBetween: avgDays, dates,
        presenteCount, noShowCount,
        attendanceRate: withPresence.length > 0 ? Math.round((presenteCount / withPresence.length) * 100) : null,
      });
    }

    if (sortBy === "bookings") stats.sort((a, b) => b.totalBookings - a.totalBookings);
    else if (sortBy === "persone") stats.sort((a, b) => b.totalPersone - a.totalPersone);
    else if (sortBy === "recent") stats.sort((a, b) => b.lastBooking.localeCompare(a.lastBooking));

    return stats;
  }

  const bookings = getFilteredBookings();
  const customers = buildCustomerStats();
  const repeatCustomers = customers.filter((c) => c.totalBookings > 1);
  const totalGuests = bookings.reduce((s, b) => s + (parseInt(b.Persone, 10) || 1), 0);

  // Fonte distribution
  const fonteMap = new Map<string, number>();
  for (const b of bookings) {
    const f = b.Fonte?.trim() || "Non specificata";
    fonteMap.set(f, (fonteMap.get(f) || 0) + 1);
  }
  const fonteData: PieSlice[] = Array.from(fonteMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: getFonteColor(label) }));

  // Presenze globali
  const bookingsWithPresence = bookings.filter((b) => b.Presentato?.trim());
  const totalPresenti = bookingsWithPresence.filter((b) => isPresente(b.Presentato)).length;
  const totalNoShow = bookingsWithPresence.filter((b) => isNoShow(b.Presentato)).length;
  const globalAttendanceRate = bookingsWithPresence.length > 0
    ? Math.round((totalPresenti / bookingsWithPresence.length) * 100)
    : null;

  // No-show table: customers con almeno un dato presenza, ordinati per tasso presenza asc
  const noShowCustomers = customers
    .filter((c) => c.attendanceRate !== null)
    .sort((a, b) => (a.attendanceRate ?? 100) - (b.attendanceRate ?? 100))
    .slice(0, 20);

  // Distribuzione oraria
  const hourDist: Record<string, number> = {};
  for (const b of bookings) {
    const h = b.OraInizio?.split(":")[0];
    if (h) hourDist[h] = (hourDist[h] || 0) + 1;
  }
  const topHours = Object.entries(hourDist).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Distribuzione giorni
  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const dayDist: Record<number, number> = {};
  for (const b of bookings) {
    if (b.Data) {
      const day = new Date(b.Data + "T00:00:00").getDay();
      dayDist[day] = (dayDist[day] || 0) + 1;
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-[#a8a29e]">Caricamento analitiche...</p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1c1917]">Analitiche</h1>
          <p className="text-[#a8a29e] mt-1 text-sm">Insights su clienti, presenze e sorgenti</p>
        </div>
        <button onClick={loadData} className="bg-[#c2410c] hover:bg-[#9a3412] w-full sm:w-auto px-4 py-2 text-white text-sm font-medium rounded-lg">
          Aggiorna
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Filtro periodo */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([["all", "Tutto"], ["3months", "3 mesi"], ["6months", "6 mesi"], ["year", "12 mesi"]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setPeriod(val)}
            className={"px-4 py-2 text-sm font-medium rounded-lg transition-colors " + (period === val ? "bg-[#c2410c] text-white" : "bg-white border border-[#e8e0d8] text-[#78716c] hover:bg-[#faf7f5]")}>
            {label}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Prenotazioni</p>
          <p className="text-2xl font-bold text-[#1c1917]">{bookings.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Clienti unici</p>
          <p className="text-2xl font-bold text-[#1c1917]">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Clienti abituali</p>
          <p className="text-2xl font-bold text-[#1c1917]">{repeatCustomers.length}</p>
          <p className="text-xs text-[#d6cfc7]">{customers.length > 0 ? Math.round((repeatCustomers.length / customers.length) * 100) : 0}% del totale</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Ospiti totali</p>
          <p className="text-2xl font-bold text-[#1c1917]">{totalGuests}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Media persone</p>
          <p className="text-2xl font-bold text-[#1c1917]">{bookings.length > 0 ? (totalGuests / bookings.length).toFixed(1) : "—"}</p>
        </div>
      </div>

      {/* Fonte + Presenze */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <h3 className="text-sm font-semibold text-[#1c1917] mb-4">Sorgente prenotazioni</h3>
          <PieChart data={fonteData} />
        </div>

        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <h3 className="text-sm font-semibold text-[#1c1917] mb-4">Presenze</h3>
          {bookingsWithPresence.length === 0 ? (
            <p className="text-sm text-[#d6cfc7] text-center py-6">Nessun dato presenza registrato</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#faf7f5] rounded-lg p-3 text-center">
                  <p className="text-xs text-[#a8a29e] mb-1">Tasso presenza</p>
                  <p className="text-xl font-bold text-[#1c1917]">{globalAttendanceRate ?? "—"}{globalAttendanceRate !== null ? "%" : ""}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-[#a8a29e] mb-1">Presenti</p>
                  <p className="text-xl font-bold text-green-700">{totalPresenti}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-[#a8a29e] mb-1">No-show</p>
                  <p className="text-xl font-bold text-red-600">{totalNoShow}</p>
                </div>
              </div>
              {/* Barra visuale */}
              {bookingsWithPresence.length > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-[#a8a29e] mb-1">
                    <span>Presenti</span>
                    <span>No-show</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-[#f5f0eb]">
                    <div className="bg-green-500 h-full transition-all" style={{ width: `${Math.round((totalPresenti / bookingsWithPresence.length) * 100)}%` }} />
                    <div className="bg-red-400 h-full transition-all" style={{ width: `${Math.round((totalNoShow / bookingsWithPresence.length) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-[#d6cfc7] mt-1 text-right">{bookingsWithPresence.length} prenotazioni con dato registrato</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Distribuzione giorno e ora */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Prenotazioni per giorno</h3>
          <div className="space-y-2">
            {dayNames.map((name, i) => {
              const count = dayDist[i] || 0;
              const maxCount = Math.max(...Object.values(dayDist), 1);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-[#a8a29e] w-8">{name}</span>
                  <div className="flex-1 bg-[#f5f0eb] rounded-full h-5 overflow-hidden">
                    <div className="bg-[#c2410c] h-full rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-[#78716c] w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Orari più richiesti</h3>
          {topHours.length > 0 ? (
            <div className="space-y-2">
              {topHours.map(([hour, count]) => {
                const maxCount = topHours[0][1] as number;
                return (
                  <div key={hour} className="flex items-center gap-3">
                    <span className="text-xs text-[#a8a29e] w-12">{hour}:00</span>
                    <div className="flex-1 bg-[#f5f0eb] rounded-full h-5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${((count as number) / (maxCount as number)) * 100}%` }} />
                    </div>
                    <span className="text-xs text-[#78716c] w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#d6cfc7] text-center py-4">Nessun dato disponibile</p>
          )}
        </div>
      </div>

      {/* No-show clienti */}
      {noShowCustomers.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e8e0d8] overflow-hidden mb-6">
          <div className="p-4 border-b border-[#e8e0d8]">
            <h2 className="text-sm font-semibold text-[#1c1917]">Presenze per cliente</h2>
            <p className="text-xs text-[#a8a29e] mt-0.5">Clienti con dato presenza registrato, ordinati per tasso crescente</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#faf7f5] border-b border-[#e8e0d8]">
                  <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Cliente</th>
                  <th className="text-center text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Presenti</th>
                  <th className="text-center text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">No-show</th>
                  <th className="text-center text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Tasso</th>
                </tr>
              </thead>
              <tbody>
                {noShowCustomers.map((c, i) => (
                  <tr key={i} className="border-b border-[#f0ebe5] last:border-0 hover:bg-[#faf7f5]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#1c1917]">{c.nome}</p>
                      {c.telefono && <p className="text-xs text-[#a8a29e] font-mono">{c.telefono}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-green-700">{c.presenteCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-red-500">{c.noShowCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + getAttendanceBadge(c.attendanceRate)}>
                        {c.attendanceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Classifica clienti */}
      <div className="bg-white rounded-xl border border-[#e8e0d8] overflow-hidden">
        <div className="p-4 border-b border-[#e8e0d8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#1c1917]">Classifica clienti</h2>
          <div className="flex gap-2">
            {([["bookings", "Visite"], ["persone", "Ospiti"], ["recent", "Recenti"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setSortBy(val)}
                className={"px-3 py-1 text-xs font-medium rounded-lg transition-colors " + (sortBy === val ? "bg-[#c2410c] text-white" : "bg-[#f5f0eb] text-[#78716c] hover:bg-gray-200")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {customers.length > 0 ? (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-[#f0ebe5]">
              {customers.slice(0, 50).map((c, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {i < 3 && <span className="text-sm">{["🥇", "🥈", "🥉"][i]}</span>}
                        <p className="text-sm font-semibold text-[#1c1917]">{c.nome}</p>
                      </div>
                      {c.telefono && <p className="text-xs text-[#a8a29e] font-mono mt-0.5">{c.telefono}</p>}
                    </div>
                    <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + getFrequencyColor(c.avgDaysBetween)}>
                      {getFrequencyLabel(c.avgDaysBetween)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-[#d6cfc7]">Visite</span><p className="font-semibold text-[#1c1917]">{c.totalBookings}</p></div>
                    <div><span className="text-[#d6cfc7]">Media pers.</span><p className="font-semibold text-[#1c1917]">{c.avgPersone}</p></div>
                    <div><span className="text-[#d6cfc7]">Ultima</span><p className="font-semibold text-[#1c1917]">{formatDate(c.lastBooking)}</p></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabella */}
            <table className="w-full hidden sm:table">
              <thead>
                <tr className="bg-[#faf7f5] border-b border-[#e8e0d8]">
                  <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">#</th>
                  <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Telefono</th>
                  <th className="text-center text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Visite</th>
                  <th className="text-center text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Ospiti tot.</th>
                  <th className="text-center text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Media pers.</th>
                  <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Frequenza</th>
                  <th className="text-center text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Presenza</th>
                  <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Ultima visita</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 50).map((c, i) => (
                  <tr key={i} className="border-b border-[#f0ebe5] last:border-0 hover:bg-[#faf7f5]">
                    <td className="px-4 py-3 text-sm text-[#d6cfc7]">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#1c1917]">{c.nome}</p>
                      {c.email && <p className="text-xs text-[#d6cfc7]">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#78716c] font-mono">{c.telefono || "—"}</td>
                    <td className="px-4 py-3 text-sm text-[#1c1917] text-center font-semibold">{c.totalBookings}</td>
                    <td className="px-4 py-3 text-sm text-[#78716c] text-center">{c.totalPersone}</td>
                    <td className="px-4 py-3 text-sm text-[#78716c] text-center">{c.avgPersone}</td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + getFrequencyColor(c.avgDaysBetween)}>
                        {getFrequencyLabel(c.avgDaysBetween)}
                      </span>
                      {c.avgDaysBetween !== null && <span className="text-xs text-[#d6cfc7] ml-1">({c.avgDaysBetween}gg)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.attendanceRate !== null ? (
                        <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + getAttendanceBadge(c.attendanceRate)}>
                          {c.attendanceRate}%
                        </span>
                      ) : (
                        <span className="text-xs text-[#d6cfc7]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#78716c]">{formatDate(c.lastBooking)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="px-6 py-8 text-sm text-[#d6cfc7] text-center">Nessuna prenotazione trovata per questo periodo</p>
        )}
      </div>
    </div>
  );
}
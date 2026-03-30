"use client";

import { useEffect, useState, useMemo } from "react";

interface Prenotazione {
  ID: string; Data: string; OraInizio: string; OraFine: string;
  Tavolo: string; Nome: string; Telefono: string; Email: string;
  Persone: string; Stato: string; Fonte: string; Presentato: string;
  TimestampConferma: string; Posizione: string;
}

interface CustomerData {
  key: string; nome: string; telefono: string; email: string;
  totalBookings: number; totalPersone: number;
  lastBooking: string; firstBooking: string;
  presenteCount: number; noShowCount: number;
  attendanceRate: number | null; nota: string;
}

type SortField = "nome" | "telefono" | "lastBooking" | "totalBookings" | "totalPersone" | "attendanceRate";
type SortDir = "asc" | "desc";

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconSort = ({ active, dir }: { active: boolean; dir: SortDir }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    className={active ? "text-white" : "text-[#d6cfc7]"}>
    {dir === "asc" || !active ? <path d="M12 5v14M5 12l7-7 7 7" /> : <path d="M12 19V5M5 12l7 7 7-7" />}
  </svg>
);

function isPresente(v: string) { return v.trim().toLowerCase().startsWith("s"); }
function isNoShow(v: string) { return v.trim().toLowerCase().startsWith("n"); }

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function getAttendanceBadge(rate: number | null) {
  if (rate === null) return "bg-[#f5f0eb] text-[#78716c]";
  if (rate >= 80) return "bg-green-100 text-green-700";
  if (rate >= 50) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-600";
}

export default function ClientiPage() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastBooking");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [presRes, notesRes] = await Promise.all([
        fetch("/api/prenotazioni"),
        fetch("/api/clienti/notes"),
      ]);
      const presData = await presRes.json();
      const notesData = await notesRes.json();
      if (presData.error) { setError(presData.error); setLoading(false); return; }
      setPrenotazioni(presData.prenotazioni || []);
      const map: Record<string, string> = {};
      for (const n of notesData.notes || []) map[n.telefono] = n.nota;
      setNotes(map);
    } catch { setError("Errore nel caricamento"); }
    setLoading(false);
  }

  const allCustomers = useMemo<CustomerData[]>(() => {
    const confirmed = prenotazioni.filter((p) => p.Stato === "Confermata" && p.Nome?.trim());
    const map = new Map<string, { nome: string; telefono: string; email: string; bookings: Prenotazione[] }>();

    for (const p of confirmed) {
      const key = p.Telefono?.trim().replace(/\s+/g, "") || p.Nome.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { nome: p.Nome.trim(), telefono: p.Telefono || "", email: p.Email || "", bookings: [] });
      const entry = map.get(key)!;
      entry.bookings.push(p);
      if (p.Data >= (entry.bookings.at(-2)?.Data ?? "")) {
        entry.nome = p.Nome.trim();
        if (p.Email) entry.email = p.Email;
      }
    }

    const result: CustomerData[] = [];
    for (const [key, entry] of map) {
      const sorted = [...entry.bookings].sort((a, b) => a.Data.localeCompare(b.Data));
      const totalPersone = sorted.reduce((s, b) => s + (parseInt(b.Persone) || 1), 0);
      const withPresence = sorted.filter((b) => b.Presentato?.trim());
      const presenteCount = withPresence.filter((b) => isPresente(b.Presentato)).length;
      const noShowCount = withPresence.filter((b) => isNoShow(b.Presentato)).length;
      result.push({
        key, nome: entry.nome, telefono: entry.telefono, email: entry.email,
        totalBookings: sorted.length, totalPersone,
        lastBooking: sorted.at(-1)!.Data, firstBooking: sorted[0].Data,
        presenteCount, noShowCount,
        attendanceRate: withPresence.length > 0 ? Math.round((presenteCount / withPresence.length) * 100) : null,
        nota: notes[key] ?? "",
      });
    }
    return result;
  }, [prenotazioni, notes]);

  const displayCustomers = useMemo(() => {
    let filtered = allCustomers;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = allCustomers.filter((c) =>
        c.nome.toLowerCase().includes(q) || c.telefono.includes(q) || c.email.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "nome") cmp = a.nome.localeCompare(b.nome, "it");
      else if (sortField === "telefono") cmp = a.telefono.localeCompare(b.telefono);
      else if (sortField === "lastBooking") cmp = a.lastBooking.localeCompare(b.lastBooking);
      else if (sortField === "totalBookings") cmp = a.totalBookings - b.totalBookings;
      else if (sortField === "totalPersone") cmp = a.totalPersone - b.totalPersone;
      else if (sortField === "attendanceRate") cmp = (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allCustomers, search, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function startEdit(key: string, currentNota: string) { setEditingKey(key); setEditText(currentNota); }

  async function saveNote(key: string) {
    setSavingNote(true);
    try {
      const res = await fetch("/api/clienti/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: key, nota: editText }),
      });
      if (res.ok) setNotes((prev) => ({ ...prev, [key]: editText }));
    } catch { /* silent */ }
    setSavingNote(false);
    setEditingKey(null);
  }

  function cancelEdit() { setEditingKey(null); setEditText(""); }

  function SortTh({ field, label, center }: { field: SortField; label: string; center?: boolean }) {
    const active = sortField === field;
    return (
      <th
        className={"text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3 cursor-pointer select-none " + (center ? "text-center" : "text-left")}
        onClick={() => toggleSort(field)}
      >
        <span className={"inline-flex items-center gap-1.5 " + (center ? "justify-center" : "")}>
          <span className={active ? "text-[#c2410c]" : ""}>{label}</span>
          <IconSort active={active} dir={sortDir} />
        </span>
      </th>
    );
  }

  const totalGuests = allCustomers.reduce((s, c) => s + c.totalPersone, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-[#a8a29e]">Caricamento clienti...</p>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1c1917]">Clienti</h1>
          <p className="text-[#a8a29e] mt-1 text-sm">Anagrafica e storico prenotazioni</p>
        </div>
        <button onClick={loadData} className="bg-[#c2410c] hover:bg-[#9a3412] w-full sm:w-auto px-4 py-2 text-white text-sm font-medium rounded-lg">
          Aggiorna
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Clienti totali</p>
          <p className="text-2xl font-bold text-[#1c1917]">{allCustomers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Clienti abituali</p>
          <p className="text-2xl font-bold text-[#1c1917]">{allCustomers.filter((c) => c.totalBookings > 1).length}</p>
          <p className="text-xs text-[#d6cfc7]">{allCustomers.length > 0 ? Math.round((allCustomers.filter((c) => c.totalBookings > 1).length / allCustomers.length) * 100) : 0}% del totale</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Ospiti totali</p>
          <p className="text-2xl font-bold text-[#1c1917]">{totalGuests}</p>
        </div>
      </div>

      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]"><IconSearch /></span>
        <input
          type="text"
          placeholder="Cerca per nome, telefono o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e8e0d8] rounded-lg text-sm text-[#1c1917] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl border border-[#e8e0d8] overflow-hidden">
        {displayCustomers.length === 0 ? (
          <p className="px-6 py-12 text-sm text-[#d6cfc7] text-center">
            {search ? "Nessun cliente trovato per questa ricerca" : "Nessun cliente disponibile"}
          </p>
        ) : (
          <>
            {/* Mobile */}
            <div className="lg:hidden divide-y divide-[#f0ebe5]">
              {displayCustomers.map((c) => (
                <div key={c.key} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#1c1917]">{c.nome}</p>
                      {c.telefono && <p className="text-xs text-[#a8a29e] font-mono mt-0.5">{c.telefono}</p>}
                      {c.email && <p className="text-xs text-[#d6cfc7] mt-0.5">{c.email}</p>}
                    </div>
                    {c.attendanceRate !== null && (
                      <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + getAttendanceBadge(c.attendanceRate)}>
                        {c.attendanceRate}%
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-[#d6cfc7]">Visite</span><p className="font-semibold text-[#1c1917]">{c.totalBookings}</p></div>
                    <div><span className="text-[#d6cfc7]">Ospiti tot.</span><p className="font-semibold text-[#1c1917]">{c.totalPersone}</p></div>
                    <div><span className="text-[#d6cfc7]">Ultima</span><p className="font-semibold text-[#1c1917]">{formatDate(c.lastBooking)}</p></div>
                  </div>
                  {editingKey === c.key ? (
                    <div className="space-y-2">
                      <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} rows={3}
                        className="w-full text-sm border border-[#e8e0d8] rounded-lg px-3 py-2 text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#c2410c] resize-none"
                        placeholder="Aggiungi una nota..." />
                      <div className="flex gap-2">
                        <button onClick={() => saveNote(c.key)} disabled={savingNote}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c2410c] text-white text-xs font-medium rounded-lg disabled:opacity-60">
                          <IconCheck />{savingNote ? "Salvo..." : "Salva"}
                        </button>
                        <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f0eb] text-[#78716c] text-xs font-medium rounded-lg">
                          <IconX />Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(c.key, c.nota)}
                      className="flex items-center gap-2 text-xs text-[#a8a29e] hover:text-[#c2410c] transition-colors group w-full text-left">
                      <span className="group-hover:text-[#c2410c]"><IconEdit /></span>
                      <span className={c.nota ? "text-[#78716c]" : "italic"}>{c.nota || "Aggiungi nota..."}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#faf7f5] border-b border-[#e8e0d8]">
                    <SortTh field="nome" label="Cliente" />
                    <SortTh field="telefono" label="Telefono" />
                    <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Email</th>
                    <SortTh field="lastBooking" label="Ultima visita" />
                    <SortTh field="totalBookings" label="Visite" center />
                    <SortTh field="totalPersone" label="Ospiti tot." center />
                    <SortTh field="attendanceRate" label="No-Show" center />
                    <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {displayCustomers.map((c) => (
                    <tr key={c.key} className="border-b border-[#f0ebe5] last:border-0 hover:bg-[#faf7f5] align-top">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#1c1917]">{c.nome}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#78716c] font-mono">{c.telefono || "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#78716c]">{c.email || "—"}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#78716c]">{formatDate(c.lastBooking)}</p>
                        <p className="text-xs text-[#d6cfc7]">Prima: {formatDate(c.firstBooking)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#1c1917] text-center">{c.totalBookings}</td>
                      <td className="px-4 py-3 text-sm text-[#78716c] text-center">{c.totalPersone}</td>
                      <td className="px-4 py-3 text-center">
                        {c.noShowCount > 0 ? (
                          <span className="text-sm font-semibold text-red-500">
                            {c.noShowCount}
                            <span className="text-xs font-normal text-[#a8a29e] ml-1">
                              ({Math.round((c.noShowCount / c.totalBookings) * 100)}%)
                            </span>
                          </span>
                        ) : c.presenteCount > 0 ? (
                          <span className="text-sm text-[#a8a29e]">0</span>
                        ) : (
                          <span className="text-xs text-[#d6cfc7]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {editingKey === c.key ? (
                          <div className="space-y-1.5">
                            <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} rows={2}
                              className="w-full text-xs border border-[#e8e0d8] rounded-lg px-2.5 py-1.5 text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#c2410c] resize-none"
                              placeholder="Aggiungi una nota..."
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(c.key); } if (e.key === "Escape") cancelEdit(); }}
                            />
                            <div className="flex gap-1.5">
                              <button onClick={() => saveNote(c.key)} disabled={savingNote}
                                className="flex items-center gap-1 px-2.5 py-1 bg-[#c2410c] text-white text-xs font-medium rounded-md disabled:opacity-60">
                                <IconCheck />{savingNote ? "..." : "Salva"}
                              </button>
                              <button onClick={cancelEdit}
                                className="flex items-center gap-1 px-2.5 py-1 bg-[#f5f0eb] text-[#78716c] text-xs font-medium rounded-md">
                                <IconX />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(c.key, c.nota)}
                            className="flex items-start gap-1.5 text-xs text-[#a8a29e] hover:text-[#c2410c] transition-colors group w-full text-left">
                            <span className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><IconEdit /></span>
                            <span className={c.nota ? "text-[#78716c] line-clamp-2" : "italic"}>
                              {c.nota || "Aggiungi nota..."}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-[#f0ebe5] text-xs text-[#a8a29e]">
              {displayCustomers.length} clienti{search ? ` trovati su ${allCustomers.length}` : ""}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
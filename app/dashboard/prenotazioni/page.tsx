"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Prenotazione {
  ID: string;
  Data: string;
  OraInizio: string;
  OraFine: string;
  Tavolo: string;
  Nome: string;
  Telefono: string;
  Email: string;
  Persone: string;
  Stato: string;
}

interface Tavolo {
  name: string;
  seats: number;
}

const HOURS = [
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30"
];

export default function PrenotazioniPage() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [tavoli, setTavoli] = useState<Tavolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const lastKnownCount = useRef(0);
  const isUserBusy = useRef(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Prenotazione | null>(null);
  const [form, setForm] = useState({
    data: "", ora: "", tavolo: "", nome: "", telefono: "", email: "", persone: "2",
  });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/prenotazioni");
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPrenotazioni(data.prenotazioni || []);
      setTavoli(data.tavoli || []);
      const confirmedCount = (data.prenotazioni || []).filter((p: Prenotazione) => p.Stato === "Confermata").length;
      lastKnownCount.current = confirmedCount;
      setNewBookingsCount(0);
    } catch (e: any) {
      setError("Errore nel caricamento");
    }
  }, []);

  // Caricamento iniziale
  useEffect(() => {
    loadData().then(() => setLoading(false));
  }, [loadData]);

  // Controllo silenzioso ogni 30 secondi
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isUserBusy.current) return;
      try {
        const res = await fetch("/api/prenotazioni");
        const data = await res.json();
        if (data.error) return;
        const confirmedCount = (data.prenotazioni || []).filter((p: Prenotazione) => p.Stato === "Confermata").length;
        const diff = confirmedCount - lastKnownCount.current;
        if (diff > 0) {
          setNewBookingsCount(diff);
        }
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Segna utente come "occupato" quando sta usando un form
  useEffect(() => {
    isUserBusy.current = showAddForm || editingId !== null;
  }, [showAddForm, editingId]);

  async function refreshData() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    setNewBookingsCount(0);
  }

  function getDatePrenotazioni() {
    return prenotazioni.filter(
      (p) => p.Data === selectedDate && p.Stato === "Confermata"
    );
  }

  function getBookingForSlot(tavoloName: string, hour: string): Prenotazione | null {
    const dayBookings = getDatePrenotazioni();
    return dayBookings.find((p) => {
      if (p.Tavolo !== tavoloName) return false;
      const [bH, bM] = p.OraInizio.split(":").map(Number);
      const [eH, eM] = p.OraFine.split(":").map(Number);
      const [sH, sM] = hour.split(":").map(Number);
      const bookStart = bH * 60 + bM;
      const bookEnd = eH * 60 + eM;
      const slotStart = sH * 60 + sM;
      return slotStart >= bookStart && slotStart < bookEnd;
    }) || null;
  }

  function isBookingStart(tavoloName: string, hour: string): boolean {
    const dayBookings = getDatePrenotazioni();
    return dayBookings.some((p) => p.Tavolo === tavoloName && p.OraInizio === hour);
  }

  function getBookingSpan(booking: Prenotazione): number {
    const [bH, bM] = booking.OraInizio.split(":").map(Number);
    const [eH, eM] = booking.OraFine.split(":").map(Number);
    const durationMinutes = (eH * 60 + eM) - (bH * 60 + bM);
    return durationMinutes / 30;
  }

  async function handleAdd() {
    if (!form.nome.trim() || !form.data || !form.ora || !form.tavolo) {
      setError("Compila tutti i campi obbligatori: nome, data, ora e tavolo");
      return;
    }
    try {
      const res = await fetch("/api/prenotazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: form.data, ora: form.ora, tavolo: form.tavolo,
          nome: form.nome, telefono: form.telefono, email: form.email, persone: form.persone,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setShowAddForm(false);
      setSuccessMsg("Prenotazione creata! Codice: " + data.id);
      setTimeout(() => setSuccessMsg(""), 5000);
      resetForm();
      setSelectedDate(form.data);
      await new Promise((r) => setTimeout(r, 1500));
      await loadData();
    } catch { setError("Errore nel salvataggio"); }
  }

  async function handleUpdate() {
    if (!editingId) return;
    try {
      const res = await fetch("/api/prenotazioni", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId, action: "modifica",
          updates: { data: form.data, ora: form.ora, tavolo: form.tavolo, nome: form.nome, telefono: form.telefono, email: form.email, persone: form.persone },
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setEditingId(null);
      setSelectedBooking(null);
      setSuccessMsg("Prenotazione modificata!");
      setTimeout(() => setSuccessMsg(""), 3000);
      resetForm();
      await new Promise((r) => setTimeout(r, 1500));
      await loadData();
    } catch { setError("Errore nella modifica"); }
  }

  async function handleCancel(id: string) {
    if (!confirm("Sei sicuro di voler cancellare questa prenotazione?")) return;
    try {
      const res = await fetch("/api/prenotazioni", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancella" }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setSelectedBooking(null);
      setSuccessMsg("Prenotazione cancellata!");
      setTimeout(() => setSuccessMsg(""), 3000);
      await new Promise((r) => setTimeout(r, 1500));
      await loadData();
    } catch { setError("Errore nella cancellazione"); }
  }

  function resetForm() {
    setForm({ data: selectedDate, ora: "", tavolo: "", nome: "", telefono: "", email: "", persone: "2" });
  }

  function openAddForm(tavolo?: string, ora?: string) {
    setEditingId(null);
    setSelectedBooking(null);
    setForm({ data: selectedDate, ora: ora || "", tavolo: tavolo || "", nome: "", telefono: "", email: "", persone: "2" });
    setShowAddForm(true);
  }

  function openEditForm(booking: Prenotazione) {
    setShowAddForm(false);
    setEditingId(booking.ID);
    setSelectedBooking(booking);
    setForm({
      data: booking.Data, ora: booking.OraInizio, tavolo: booking.Tavolo,
      nome: booking.Nome, telefono: booking.Telefono, email: booking.Email, persone: booking.Persone,
    });
  }

  function changeDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const days = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    return days[d.getDay()] + " " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  const dayBookingsCount = getDatePrenotazioni().length;

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Caricamento prenotazioni...</p></div>;

  return (
    <div>
      {newBookingsCount > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {newBookingsCount === 1 ? "1 nuova prenotazione trovata" : newBookingsCount + " nuove prenotazioni trovate"}
          </span>
          <button onClick={refreshData} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            Aggiorna ora
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prenotazioni</h1>
          <p className="text-gray-500 mt-1">{dayBookingsCount} prenotazioni per {formatDate(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refreshData} disabled={refreshing} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            {refreshing ? "Aggiornamento..." : "Controlla nuove prenotazioni"}
          </button>
          <button onClick={() => openAddForm()} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            + Nuova prenotazione
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium">x</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => changeDate(-1)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Ieri</button>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
        <button onClick={() => changeDate(1)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Domani</button>
        <button onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm hover:bg-gray-200 font-medium">Oggi</button>
      </div>

      {(showAddForm || editingId) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            {editingId ? "Modifica prenotazione: " + editingId : "Nuova prenotazione manuale"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Ora</label>
              <select value={form.ora} onChange={(e) => setForm({ ...form, ora: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
                <option value="">Seleziona...</option>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tavolo</label>
              <select value={form.tavolo} onChange={(e) => setForm({ ...form, tavolo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
                <option value="">Seleziona...</option>
                {tavoli.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.seats} posti)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Persone</label>
              <input type="number" value={form.persone} onChange={(e) => setForm({ ...form, persone: e.target.value })} min="1" max="20" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nome</label>
              <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Telefono</label>
              <input type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="+39..." />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="Opzionale" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={editingId ? handleUpdate : handleAdd} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              {editingId ? "Salva modifiche" : "Crea prenotazione"}
            </button>
            <button onClick={() => { setShowAddForm(false); setEditingId(null); setSelectedBooking(null); resetForm(); }} className="px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100">
              Annulla
            </button>
            {editingId && (
              <button onClick={() => handleCancel(editingId)} className="px-4 py-2 text-red-600 text-sm rounded-lg hover:bg-red-50 ml-auto">
                Cancella prenotazione
              </button>
            )}
          </div>
        </div>
      )}

      {selectedBooking && !editingId && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Prenotazione: {selectedBooking.ID}</h2>
            <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-gray-600">x</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <div><span className="text-gray-500">Nome:</span> <span className="font-medium text-gray-900">{selectedBooking.Nome}</span></div>
            <div><span className="text-gray-500">Persone:</span> <span className="font-medium text-gray-900">{selectedBooking.Persone}</span></div>
            <div><span className="text-gray-500">Orario:</span> <span className="font-medium text-gray-900">{selectedBooking.OraInizio} - {selectedBooking.OraFine}</span></div>
            <div><span className="text-gray-500">Tavolo:</span> <span className="font-medium text-gray-900">{selectedBooking.Tavolo}</span></div>
            <div><span className="text-gray-500">Telefono:</span> <span className="font-medium text-gray-900">{selectedBooking.Telefono || "—"}</span></div>
            <div><span className="text-gray-500">Email:</span> <span className="font-medium text-gray-900">{selectedBooking.Email || "—"}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openEditForm(selectedBooking)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Modifica</button>
            <button onClick={() => handleCancel(selectedBooking.ID)} className="px-3 py-1.5 text-red-600 text-xs rounded-lg hover:bg-red-50 border border-red-200">Cancella</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase min-w-[100px]">
                Tavolo
              </th>
              {HOURS.map((hour, i) => (
                <th key={hour} className={"border-b border-gray-200 px-2 py-3 text-center text-xs font-semibold text-gray-500 min-w-[70px] " + (i === 6 ? "border-l-2 border-l-gray-300" : "")}>
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tavoli.map((tavolo) => (
              <tr key={tavolo.name} className="border-b border-gray-100 last:border-0">
                <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{tavolo.name}</div>
                  <div className="text-xs text-gray-400">{tavolo.seats} posti</div>
                </td>
                {HOURS.map((hour, i) => {
                  const booking = getBookingForSlot(tavolo.name, hour);
                  const isStart = booking && isBookingStart(tavolo.name, hour);

                  if (booking && !isStart) return null;

                  if (booking && isStart) {
                    const span = Math.min(getBookingSpan(booking), HOURS.length - i);
                    return (
                      <td key={hour} colSpan={span} className={"px-1 py-1 " + (i === 6 ? "border-l-2 border-l-gray-300" : "")}>
                        <button
                          onClick={() => { setSelectedBooking(booking); setEditingId(null); setShowAddForm(false); }}
                          className={"w-full h-full px-2 py-2 rounded-lg text-left transition-colors " + (selectedBooking?.ID === booking.ID ? "bg-blue-600 text-white" : "bg-blue-100 hover:bg-blue-200 text-blue-900")}
                        >
                          <div className="text-xs font-semibold truncate">{booking.Nome}</div>
                          <div className={"text-xs truncate " + (selectedBooking?.ID === booking.ID ? "text-blue-100" : "text-blue-600")}>
                            {booking.Persone}p - {booking.OraInizio}-{booking.OraFine}
                          </div>
                        </button>
                      </td>
                    );
                  }

                  return (
                    <td key={hour} className={"px-1 py-1 " + (i === 6 ? "border-l-2 border-l-gray-300" : "")}>
                      <button
                        onClick={() => openAddForm(tavolo.name, hour)}
                        className="w-full h-full min-h-[48px] rounded-lg border border-transparent hover:border-blue-300 hover:bg-blue-50 transition-colors"
                        title={"Prenota " + tavolo.name + " alle " + hour}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {getDatePrenotazioni().length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Lista prenotazioni — {formatDate(selectedDate)}</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">ID</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">Nome</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">Orario</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">Tavolo</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">Persone</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">Telefono</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {getDatePrenotazioni()
                .sort((a, b) => a.OraInizio.localeCompare(b.OraInizio))
                .map((p) => (
                  <tr key={p.ID} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">{p.ID}</td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.Nome}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{p.OraInizio} - {p.OraFine}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{p.Tavolo}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{p.Persone}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{p.Telefono || "—"}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={() => openEditForm(p)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Modifica</button>
                      <button onClick={() => handleCancel(p.ID)} className="text-xs text-red-600 hover:text-red-800 font-medium">Cancella</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

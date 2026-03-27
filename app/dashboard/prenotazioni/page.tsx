"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Prenotazione {
  ID: string; Data: string; OraInizio: string; OraFine: string;
  Tavolo: string; Nome: string; Telefono: string; Email: string;
  Persone: string; Stato: string; Presentato?: string;
}

interface Tavolo { name: string; seats: number; location?: string; }

const HOURS = [
  "07:30","08:00","08:30","09:00","09:30","10:00","10:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30"
];

const FORM_HOURS = [
  "07:30","07:45","08:00","08:15","08:30","08:45","09:00","09:15","09:30","09:45","10:00","10:15","10:30",
  "12:00","12:15","12:30","12:45","13:00","13:15","13:30","13:45","14:00","14:15","14:30",
  "19:00","19:15","19:30","19:45","20:00","20:15","20:30","20:45","21:00","21:15","21:30","21:45","22:00","22:15","22:30"
];

const LUNCH_START = 7;
const DINNER_START = 13;

export default function PrenotazioniPage() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [tavoli, setTavoli] = useState<Tavolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const lastKnownCount = useRef(0);
  const isUserBusy = useRef(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Prenotazione | null>(null);
  const [form, setForm] = useState({ data: "", ora: "", tavolo: "", nome: "", telefono: "", email: "", persone: "2" });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [presentatoStates, setPresentatoStates] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/prenotazioni");
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPrenotazioni(data.prenotazioni || []);
      setTavoli(data.tavoli || []);
      const cc = (data.prenotazioni || []).filter((p: Prenotazione) => p.Stato === "Confermata").length;
      lastKnownCount.current = cc;
      setNewBookingsCount(0);
      // Inizializza presentato da Google Sheet
      const states: Record<string, string> = {};
      for (const p of data.prenotazioni || []) {
        if (p.ID) states[p.ID] = p.Presentato || "Sì";
      }
      setPresentatoStates(states);
    } catch { setError("Errore nel caricamento"); }
  }, []);

  useEffect(() => { loadData().then(() => setLoading(false)); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (isUserBusy.current) return;
      try {
        const res = await fetch("/api/prenotazioni");
        const data = await res.json();
        if (data.error) return;
        const cc = (data.prenotazioni || []).filter((p: Prenotazione) => p.Stato === "Confermata").length;
        if (cc - lastKnownCount.current > 0) setNewBookingsCount(cc - lastKnownCount.current);
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { isUserBusy.current = showAddForm || editingId !== null; }, [showAddForm, editingId]);

  async function refreshData() { setRefreshing(true); await loadData(); setRefreshing(false); setNewBookingsCount(0); }

  function getDatePrenotazioni() { return prenotazioni.filter(p => p.Data === selectedDate && p.Stato === "Confermata"); }

  function hasSovrapposizione(tavolo: string, data: string, ora: string, escludiId?: string): boolean {
    const [h, m] = ora.split(":").map(Number);
    const newStart = h * 60 + m;
    const newEnd = newStart + 120;
    return prenotazioni.some(p => {
      if (p.Tavolo !== tavolo) return false;
      if (p.Data !== data) return false;
      if (p.Stato !== "Confermata") return false;
      if (escludiId && p.ID === escludiId) return false;
      const [pH, pM] = p.OraInizio.split(":").map(Number);
      const [eH, eM] = p.OraFine.split(":").map(Number);
      const existStart = pH * 60 + pM;
      const existEnd = eH * 60 + eM;
      return newStart < existEnd && newEnd > existStart;
    });
  }

  function calcolaOraFine(ora: string): string {
    const [h, m] = ora.split(":").map(Number);
    const fine = h * 60 + m + 120;
    return String(Math.floor(fine / 60)).padStart(2, "0") + ":" + String(fine % 60).padStart(2, "0");
  }

  function isOrarioValido(ora: string): boolean {
    const [, m] = ora.split(":").map(Number);
    return m === 0 || m === 15 || m === 30 || m === 45;
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

  function getBookingForSlot(tn: string, h: string): Prenotazione | null {
    const [sH, sM] = h.split(":").map(Number);
    const slotMin = sH * 60 + sM;
    return getDatePrenotazioni().find(p => {
      if (p.Tavolo !== tn) return false;
      const [bH, bM] = p.OraInizio.split(":").map(Number);
      const [eH, eM] = p.OraFine.split(":").map(Number);
      const bookStart = bH * 60 + bM;
      const bookEnd = eH * 60 + eM;
      const roundedStart = Math.floor(bookStart / 30) * 30;
      return slotMin >= roundedStart && slotMin < bookEnd;
    }) || null;
  }

  function isBookingStart(tn: string, h: string): boolean {
    const [sH, sM] = h.split(":").map(Number);
    const slotMin = sH * 60 + sM;
    return getDatePrenotazioni().some(p => {
      if (p.Tavolo !== tn) return false;
      const [bH, bM] = p.OraInizio.split(":").map(Number);
      const bookStart = bH * 60 + bM;
      const roundedStart = Math.floor(bookStart / 30) * 30;
      return slotMin === roundedStart;
    });
  }

  function getBookingSpan(b: Prenotazione): number {
    const [bH, bM] = b.OraInizio.split(":").map(Number);
    const [eH, eM] = b.OraFine.split(":").map(Number);
    const bookStart = bH * 60 + bM;
    const bookEnd = eH * 60 + eM;
    const roundedStart = Math.floor(bookStart / 30) * 30;
    const roundedEnd = Math.ceil(bookEnd / 30) * 30;
    return (roundedEnd - roundedStart) / 30;
  }

  async function handleAdd() {
    if (!form.nome.trim() || !form.data || !form.ora || !form.tavolo) {
      setError("Compila tutti i campi obbligatori"); return;
    }
    if (!isOrarioValido(form.ora)) {
      setError("❌ Orario non valido. Scegli un orario a ore piene, e un quarto, e mezza o e tre quarti.");
      return;
    }
    if (hasSovrapposizione(form.tavolo, form.data, form.ora)) {
      setError("❌ " + form.tavolo + " è già occupato dalle " + form.ora + " alle " + calcolaOraFine(form.ora) + ". Scegli un altro tavolo o un altro orario.");
      return;
    }
    try {
      const res = await fetch("/api/prenotazioni", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: form.data, ora: form.ora, tavolo: form.tavolo, nome: form.nome, telefono: form.telefono, email: form.email, persone: form.persone }) });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setShowAddForm(false); setSuccessMsg("Prenotazione creata! Codice: " + data.id);
      setTimeout(() => setSuccessMsg(""), 5000); resetForm(); setSelectedDate(form.data);
      await new Promise(r => setTimeout(r, 1500)); await loadData();
    } catch { setError("Errore nel salvataggio"); }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!isOrarioValido(form.ora)) {
      setError("❌ Orario non valido. Scegli un orario a ore piene, e un quarto, e mezza o e tre quarti.");
      return;
    }
    if (hasSovrapposizione(form.tavolo, form.data, form.ora, editingId)) {
      setError("❌ " + form.tavolo + " è già occupato in quella fascia oraria. Scegli un altro tavolo o orario.");
      return;
    }
    try {
      const res = await fetch("/api/prenotazioni", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, action: "modifica", updates: { data: form.data, ora: form.ora, tavolo: form.tavolo, nome: form.nome, telefono: form.telefono, email: form.email, persone: form.persone } }) });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setEditingId(null); setSelectedBooking(null); setSuccessMsg("Prenotazione modificata!");
      setTimeout(() => setSuccessMsg(""), 3000); resetForm();
      await new Promise(r => setTimeout(r, 1500)); await loadData();
    } catch { setError("Errore nella modifica"); }
  }

  async function handleCancel(id: string) {
    if (!confirm("Sei sicuro di voler cancellare questa prenotazione?")) return;
    try {
      const res = await fetch("/api/prenotazioni", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancella" }) });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setSelectedBooking(null); setSuccessMsg("Prenotazione cancellata!");
      setTimeout(() => setSuccessMsg(""), 3000);
      await new Promise(r => setTimeout(r, 1500)); await loadData();
    } catch { setError("Errore nella cancellazione"); }
  }

  function resetForm() { setForm({ data: selectedDate, ora: "", tavolo: "", nome: "", telefono: "", email: "", persone: "2" }); }

  function openAddForm(tavolo?: string, ora?: string) {
    setEditingId(null); setSelectedBooking(null);
    setForm({ data: selectedDate, ora: ora || "", tavolo: tavolo || "", nome: "", telefono: "", email: "", persone: "2" });
    setShowAddForm(true);
  }

  function openEditForm(b: Prenotazione) {
    setShowAddForm(false); setEditingId(b.ID); setSelectedBooking(b);
    setForm({ data: b.Data, ora: b.OraInizio, tavolo: b.Tavolo, nome: b.Nome, telefono: b.Telefono, email: b.Email, persone: b.Persone });
  }

  function changeDate(d: number) { const dt = new Date(selectedDate); dt.setDate(dt.getDate() + d); setSelectedDate(dt.toISOString().split("T")[0]); }

  function formatDate(s: string) {
    const d = new Date(s + "T00:00:00");
    const days = ["Domenica","Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato"];
    const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
    return days[d.getDay()] + " " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  const isToday = selectedDate === new Date().toISOString().split("T")[0];
  const dayCount = getDatePrenotazioni().length;

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-[#a8a29e]">Caricamento prenotazioni...</p></div>;

  return (
    <div>
      {newBookingsCount > 0 && (
        <div className="mb-4 p-3 bg-[#fff7ed] border border-[#c2410c]/20 rounded-lg flex items-center justify-between gap-2">
          <span className="text-sm text-[#c2410c]">{newBookingsCount === 1 ? "1 nuova prenotazione" : newBookingsCount + " nuove prenotazioni"}</span>
          <button onClick={refreshData} className="bg-[#c2410c] hover:bg-[#9a3412] px-3 py-1 text-white text-sm rounded-lg whitespace-nowrap">Aggiorna</button>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1c1917]">Prenotazioni</h1>
        <p className="text-[#a8a29e] mt-1 text-sm">{dayCount} prenotazioni per {formatDate(selectedDate)}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={refreshData} disabled={refreshing} className="bg-[#c2410c] hover:bg-[#9a3412] flex-1 sm:flex-none px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {refreshing ? "Aggiornamento..." : "Controlla nuove"}
          </button>
          <button onClick={() => openAddForm()} className="bg-[#c2410c] hover:bg-[#9a3412] flex-1 sm:flex-none px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors">
            + Nuova prenotazione
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-2 font-medium">x</button>
        </div>
      )}
      {successMsg && <div className="mb-4 p-3 bg-[#f0fdf4] border border-green-200 rounded-lg text-sm text-green-700">{successMsg}</div>}

      {/* Navigazione data */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => changeDate(-1)} className="px-3 py-2 bg-white border border-[#e8e0d8] rounded-lg text-sm text-[#44403c] hover:bg-[#faf7f5] font-medium">←</button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="flex-1 px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] min-w-[140px]" />
        <button onClick={() => changeDate(1)} className="px-3 py-2 bg-white border border-[#e8e0d8] rounded-lg text-sm text-[#44403c] hover:bg-[#faf7f5] font-medium">→</button>
        <button onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
          className={"px-4 py-2 text-sm font-semibold rounded-lg transition-colors " + (isToday ? "bg-[#c2410c] text-white" : "bg-[#fff7ed] text-[#c2410c] hover:bg-[#ffedd5]")}>
          Oggi
        </button>
      </div>

      {/* Form */}
      {(showAddForm || editingId) && (
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4 sm:p-5 mb-6">
          <h2 className="text-sm font-semibold text-[#1c1917] mb-4">
            {editingId ? "Modifica: " + editingId : "Nuova prenotazione manuale"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs text-[#78716c] mb-1">Data</label>
              <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
            </div>
            <div>
              <label className="block text-xs text-[#78716c] mb-1">Ora</label>
              <select value={form.ora} onChange={e => setForm({ ...form, ora: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]">
                <option value="">Seleziona...</option>
                {FORM_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#78716c] mb-1">Tavolo</label>
              <select value={form.tavolo} onChange={e => setForm({ ...form, tavolo: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]">
                <option value="">Seleziona...</option>
                {tavoli.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.seats}p · {t.location === "esterno" ? "Esterno" : "Interno"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#78716c] mb-1">Persone</label>
              <input type="number" value={form.persone} onChange={e => setForm({ ...form, persone: e.target.value })} min="1" max="20" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
            </div>
            <div>
              <label className="block text-xs text-[#78716c] mb-1">Nome</label>
              <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-xs text-[#78716c] mb-1">Telefono</label>
              <input type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" placeholder="+39..." />
            </div>
            <div>
              <label className="block text-xs text-[#78716c] mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" placeholder="Opzionale" />
            </div>
          </div>

          {form.tavolo && form.data && form.ora && hasSovrapposizione(form.tavolo, form.data, form.ora, editingId || undefined) && (
            <div className="mb-3 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ {form.tavolo} è già occupato dalle {form.ora} alle {calcolaOraFine(form.ora)}. Cambia tavolo o orario.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={editingId ? handleUpdate : handleAdd} className="bg-[#c2410c] hover:bg-[#9a3412] flex-1 sm:flex-none px-4 py-2 text-white text-sm rounded-lg">
              {editingId ? "Salva modifiche" : "Crea prenotazione"}
            </button>
            <button onClick={() => { setShowAddForm(false); setEditingId(null); setSelectedBooking(null); resetForm(); }} className="flex-1 sm:flex-none px-4 py-2 text-[#78716c] text-sm rounded-lg hover:bg-[#f5f0eb] border border-[#e8e0d8]">
              Annulla
            </button>
            {editingId && (
              <button onClick={() => handleCancel(editingId)} className="flex-1 sm:flex-none px-4 py-2 text-red-600 text-sm rounded-lg hover:bg-[#fef2f2] border border-red-200">
                Cancella prenotazione
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dettaglio prenotazione */}
      {selectedBooking && !editingId && (
        <div className="bg-white rounded-xl border border-[#c2410c]/20 p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#1c1917]">Prenotazione: {selectedBooking.ID}</h2>
            <button onClick={() => setSelectedBooking(null)} className="text-[#d6cfc7] hover:text-[#78716c]">x</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div><span className="text-[#a8a29e]">Nome:</span> <span className="font-medium text-[#1c1917]">{selectedBooking.Nome}</span></div>
            <div><span className="text-[#a8a29e]">Persone:</span> <span className="font-medium text-[#1c1917]">{selectedBooking.Persone}</span></div>
            <div><span className="text-[#a8a29e]">Orario:</span> <span className="font-medium text-[#1c1917]">{selectedBooking.OraInizio} - {selectedBooking.OraFine}</span></div>
            <div><span className="text-[#a8a29e]">Tavolo:</span> <span className="font-medium text-[#1c1917]">{selectedBooking.Tavolo}</span></div>
            <div><span className="text-[#a8a29e]">Telefono:</span> <span className="font-medium text-[#1c1917]">{selectedBooking.Telefono || "---"}</span></div>
            <div><span className="text-[#a8a29e]">Email:</span> <span className="font-medium text-[#1c1917]">{selectedBooking.Email || "---"}</span></div>
          </div>

          {/* Toggle presentato */}
          <div className="flex items-center justify-between py-3 mb-3 border-t border-b border-[#f5f0eb]">
            <span className="text-sm text-[#78716c]">Cliente presentato</span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium" style={{ color: (presentatoStates[selectedBooking.ID] ?? "Sì") === "Sì" ? "#15803d" : "#dc2626" }}>
                {(presentatoStates[selectedBooking.ID] ?? "Sì") === "Sì" ? "Sì" : "No"}
              </span>
              <button
                onClick={() => {
                  const current = presentatoStates[selectedBooking.ID] ?? "Sì";
                  segnaPresenza(selectedBooking.ID, current === "Sì" ? "No" : "Sì");
                }}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                style={{ background: (presentatoStates[selectedBooking.ID] ?? "Sì") === "Sì" ? "#22c55e" : "#f87171" }}
              >
                <span className={"inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform " + ((presentatoStates[selectedBooking.ID] ?? "Sì") === "Sì" ? "translate-x-4" : "translate-x-1")} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => openEditForm(selectedBooking)} className="bg-[#c2410c] hover:bg-[#9a3412] flex-1 sm:flex-none px-3 py-1.5 text-white text-xs rounded-lg">Modifica</button>
            <button onClick={() => handleCancel(selectedBooking.ID)} className="flex-1 sm:flex-none px-3 py-1.5 text-red-600 text-xs rounded-lg hover:bg-[#fef2f2] border border-red-200">Cancella</button>
          </div>
        </div>
      )}

      {/* Griglia */}
      <div className="bg-white rounded-xl border border-[#e8e0d8] overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#faf7f5] border-b border-r border-[#e8e0d8] px-3 sm:px-4 py-3 text-left text-xs font-semibold text-[#a8a29e] uppercase min-w-[80px] sm:min-w-[110px]">Tavolo</th>
              {HOURS.map((h, i) => (
                <th key={h} className={"border-b border-[#e8e0d8] px-1 sm:px-2 py-3 text-center text-xs font-semibold text-[#a8a29e] min-w-[60px] sm:min-w-[70px] " + (i === LUNCH_START ? "border-l-2 border-l-gray-300" : "") + (i === DINNER_START ? " border-l-2 border-l-gray-300" : "")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tavoli.map(tavolo => (
              <tr key={tavolo.name} className="border-b border-[#f0ebe5] last:border-0">
                <td className="sticky left-0 z-10 bg-white border-r border-[#e8e0d8] px-3 sm:px-4 py-3">
                  <div className="text-xs sm:text-sm font-medium text-[#1c1917]">{tavolo.name}</div>
                  <div className="text-xs text-[#d6cfc7]">{tavolo.seats}p</div>
                  <span className={"inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium " + (tavolo.location === "esterno" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}>
                    {tavolo.location === "esterno" ? "Est." : "Int."}
                  </span>
                </td>
                {HOURS.map((h, i) => {
                  const bk = getBookingForSlot(tavolo.name, h);
                  const isS = bk && isBookingStart(tavolo.name, h);
                  if (bk && !isS) return null;
                  if (bk && isS) {
                    const span = Math.min(getBookingSpan(bk), HOURS.length - i);
                    return (
                      <td key={h} colSpan={span} className={"px-1 py-1 " + (i === LUNCH_START ? "border-l-2 border-l-gray-300" : "") + (i === DINNER_START ? " border-l-2 border-l-gray-300" : "")}>
                        <button onClick={() => { setSelectedBooking(bk); setEditingId(null); setShowAddForm(false); }}
                          className={"w-full h-full px-1 sm:px-2 py-2 rounded-lg text-left transition-colors " + (selectedBooking?.ID === bk.ID ? "bg-[#c2410c] text-white" : "bg-[#fff7ed] hover:bg-[#ffedd5] text-[#9a3412]")}>
                          <div className="text-xs font-semibold truncate">{bk.Nome}</div>
                          <div className={"text-xs truncate " + (selectedBooking?.ID === bk.ID ? "text-[#fed7aa]" : "text-[#c2410c]")}>{bk.Persone}p - {bk.OraInizio}</div>
                        </button>
                      </td>
                    );
                  }
                  return (
                    <td key={h} className={"px-1 py-1 " + (i === LUNCH_START ? "border-l-2 border-l-gray-300" : "") + (i === DINNER_START ? " border-l-2 border-l-gray-300" : "")}>
                      <button onClick={() => openAddForm(tavolo.name, h)} className="w-full h-full min-h-[48px] rounded-lg border border-transparent hover:border-blue-300 hover:bg-[#fff7ed] transition-colors" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista */}
      {getDatePrenotazioni().length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-[#e8e0d8] overflow-hidden">
          <div className="p-4 border-b border-[#e8e0d8]">
            <h2 className="text-sm font-semibold text-[#1c1917]">Lista prenotazioni — {formatDate(selectedDate)}</h2>
          </div>
          <div className="sm:hidden divide-y divide-gray-100">
            {getDatePrenotazioni().sort((a, b) => a.OraInizio.localeCompare(b.OraInizio)).map(pr => (
              <div key={pr.ID} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-[#1c1917]">{pr.Nome}</p>
                    <p className="text-xs text-[#a8a29e]">{pr.OraInizio} - {pr.OraFine} | {pr.Tavolo} | {pr.Persone}p</p>
                  </div>
                  <p className="text-xs text-[#d6cfc7] font-mono">{pr.ID}</p>
                </div>
                {pr.Telefono && <p className="text-xs text-[#a8a29e] mb-2">Tel: {pr.Telefono}</p>}
                <div className="flex gap-2">
                  <button onClick={() => openEditForm(pr)} className="bg-[#c2410c] hover:bg-[#9a3412] flex-1 px-3 py-1.5 text-white text-xs rounded-lg">Modifica</button>
                  <button onClick={() => handleCancel(pr.ID)} className="flex-1 px-3 py-1.5 text-red-600 text-xs rounded-lg hover:bg-[#fef2f2] border border-red-200">Cancella</button>
                </div>
              </div>
            ))}
          </div>
          <table className="w-full hidden sm:table">
            <thead>
              <tr className="bg-[#faf7f5] border-b border-[#e8e0d8]">
                <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-2">ID</th>
                <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-2">Nome</th>
                <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-2">Orario</th>
                <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-2">Tavolo</th>
                <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-2">Persone</th>
                <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-2">Telefono</th>
                <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-2">Presente</th>
                <th className="text-right text-xs font-semibold text-[#a8a29e] uppercase px-4 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {getDatePrenotazioni().sort((a, b) => a.OraInizio.localeCompare(b.OraInizio)).map(pr => {
                const stato = presentatoStates[pr.ID] ?? "Sì";
                return (
                  <tr key={pr.ID} className="border-b border-[#f0ebe5] last:border-0">
                    <td className="px-4 py-2 text-xs text-[#a8a29e] font-mono">{pr.ID}</td>
                    <td className="px-4 py-2 text-sm font-medium text-[#1c1917]">{pr.Nome}</td>
                    <td className="px-4 py-2 text-sm text-[#78716c]">{pr.OraInizio} - {pr.OraFine}</td>
                    <td className="px-4 py-2 text-sm text-[#78716c]">{pr.Tavolo}</td>
                    <td className="px-4 py-2 text-sm text-[#78716c]">{pr.Persone}</td>
                    <td className="px-4 py-2 text-sm text-[#78716c]">{pr.Telefono || "---"}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => segnaPresenza(pr.ID, stato === "Sì" ? "No" : "Sì")}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                        style={{ background: stato === "Sì" ? "#22c55e" : "#f87171" }}
                      >
                        <span className={"inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform " + (stato === "Sì" ? "translate-x-4" : "translate-x-1")} />
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={() => openEditForm(pr)} className="text-xs text-[#c2410c] hover:text-[#9a3412] font-medium">Modifica</button>
                      <button onClick={() => handleCancel(pr.ID)} className="text-xs text-red-600 hover:text-red-800 font-medium">Cancella</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
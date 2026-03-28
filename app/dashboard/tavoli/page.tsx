"use client";

import { createClient } from "../../../lib/supabase/client";
import { useEffect, useState } from "react";

interface Table {
  id: string;
  name: string;
  seats: number;
  is_active: boolean;
  is_outdoor: boolean;
}

export default function TavoliPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSeats, setNewSeats] = useState(4);
  const [newIsOutdoor, setNewIsOutdoor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSeats, setEditSeats] = useState(4);
  const [editIsOutdoor, setEditIsOutdoor] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  // Periodo dehors
  const [outdoorFrom, setOutdoorFrom] = useState("");
  const [outdoorTo, setOutdoorTo] = useState("");
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [periodSaved, setPeriodSaved] = useState(false);
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

  async function syncAll() {
    setSyncing(true);
    try {
      await Promise.all([
        fetch("/api/sync-tavoli", { method: "POST" }),
        fetch("/api/sync-vapi", { method: "POST" }),
        fetch("/api/sync-configurazione", { method: "POST" }),
      ]);
    } catch (e) { console.error("Sync error:", e); }
    setSyncing(false);
  }

  async function loadData() {
    const rid = await getRestaurantId();
    if (!rid) return;
    const [tablesRes, restaurantRes] = await Promise.all([
      supabase.from("tables").select("*").eq("restaurant_id", rid).order("name"),
      supabase.from("restaurants").select("outdoor_from, outdoor_to").eq("id", rid).single(),
    ]);
    setTables(tablesRes.data || []);
    if (restaurantRes.data) {
      setOutdoorFrom(restaurantRes.data.outdoor_from || "");
      setOutdoorTo(restaurantRes.data.outdoor_to || "");
    }
    setLoading(false);
  }

  async function savePeriod() {
  const rid = await getRestaurantId();
  if (!rid) return;
  setSavingPeriod(true);
  await supabase.from("restaurants").update({
    outdoor_from: outdoorFrom || null,
    outdoor_to: outdoorTo || null,
  }).eq("id", rid);
  await fetch("/api/sync-configurazione", { method: "POST" }); // ← questa riga
  setSavingPeriod(false);
  setPeriodSaved(true);
  setTimeout(() => setPeriodSaved(false), 3000);
}

  async function removePeriod() {
    const rid = await getRestaurantId();
    if (!rid) return;
    setSavingPeriod(true);
    await supabase.from("restaurants").update({
      outdoor_from: null,
      outdoor_to: null,
    }).eq("id", rid);
    setOutdoorFrom("");
    setOutdoorTo("");
    await fetch("/api/sync-configurazione", { method: "POST" });
    setSavingPeriod(false);
  }

  async function addTable() {
    if (!newName.trim()) return;
    const rid = await getRestaurantId();
    if (!rid) return;
    await supabase.from("tables").insert({
      restaurant_id: rid,
      name: newName.trim(),
      seats: newSeats,
      is_active: true,
      is_outdoor: newIsOutdoor,
    });
    setNewName(""); setNewSeats(4); setNewIsOutdoor(false);
    loadData(); await syncAll();
  }

  async function updateTable(id: string) {
    await supabase.from("tables").update({
      name: editName.trim(),
      seats: editSeats,
      is_outdoor: editIsOutdoor,
    }).eq("id", id);
    setEditingId(null);
    loadData(); await syncAll();
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await supabase.from("tables").update({ is_active: !currentActive }).eq("id", id);
    loadData(); await syncAll();
  }

  async function deleteTable(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questo tavolo?")) return;
    await supabase.from("tables").delete().eq("id", id);
    loadData(); await syncAll();
  }

  // Calcola stato periodo dehors
  function getPeriodStatus() {
    if (!outdoorFrom || !outdoorTo) return null;
    const today = new Date().toISOString().split("T")[0];
    if (today < outdoorFrom) return "non ancora attivo";
    if (today > outdoorTo) return "terminato";
    return "attivo";
  }

  function formatDate(d: string) {
    if (!d) return "";
    const [y, m, g] = d.split("-");
    return `${g}/${m}/${y}`;
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-[#a8a29e]">Caricamento...</p>
    </div>
  );

  const interni = tables.filter(t => !t.is_outdoor);
  const esterni = tables.filter(t => t.is_outdoor);
  const periodStatus = getPeriodStatus();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1c1917]">Gestione Tavoli</h1>
          <p className="text-[#a8a29e] mt-1 text-sm">Aggiungi, modifica o rimuovi i tavoli del ristorante</p>
        </div>
        {syncing && <span className="text-sm text-[#c2410c] font-medium">Sync in corso...</span>}
      </div>

      {/* Aggiungi tavolo */}
      <div className="bg-white rounded-xl border border-[#e8e0d8] p-4 sm:p-6 mb-6">
        <h2 className="text-sm font-semibold text-[#1c1917] mb-4">Aggiungi nuovo tavolo</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm text-[#78716c] mb-1">Nome</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="es. Tavolo7"
              className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none"
            />
          </div>
          <div className="w-full sm:w-28">
            <label className="block text-sm text-[#78716c] mb-1">Posti</label>
            <input
              type="number"
              value={newSeats}
              onChange={(e) => setNewSeats(parseInt(e.target.value) || 1)}
              min={1} max={20}
              className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-sm text-[#78716c] mb-1">Posizione</label>
            <select
              value={newIsOutdoor ? "esterno" : "interno"}
              onChange={(e) => setNewIsOutdoor(e.target.value === "esterno")}
              className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none bg-white"
            >
              <option value="interno">Interno</option>
              <option value="esterno">Esterno</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={addTable}
              className="bg-[#c2410c] hover:bg-[#9a3412] w-full sm:w-auto px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Aggiungi
            </button>
          </div>
        </div>
      </div>

      {/* Banner Tavoli esterni */}
      <div className="bg-white rounded-xl border border-[#e8e0d8] p-4 sm:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1c1917]">Tavoli esterni</h2>
            {outdoorFrom && outdoorTo ? (
              <p className="text-xs text-[#a8a29e] mt-0.5">
                Periodo impostato: {formatDate(outdoorFrom)} → {formatDate(outdoorTo)}{" "}
                <span className={`font-medium ${
                  periodStatus === "attivo" ? "text-green-600" :
                  periodStatus === "terminato" ? "text-red-500" : "text-[#a8a29e]"
                }`}>
                  ({periodStatus})
                </span>
              </p>
            ) : (
              <p className="text-xs text-[#a8a29e] mt-0.5">Nessun periodo dehors impostato — i tavoli esterni non saranno mai disponibili</p>
            )}
          </div>
          {periodSaved && <span className="text-xs text-green-600 font-medium shrink-0">Salvato</span>}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div>
            <label className="block text-xs text-[#78716c] mb-1">Dal</label>
            <input
              type="date"
              value={outdoorFrom}
              onChange={(e) => setOutdoorFrom(e.target.value)}
              className="px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-[#78716c] mb-1">Al</label>
            <input
              type="date"
              value={outdoorTo}
              onChange={(e) => setOutdoorTo(e.target.value)}
              className="px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={savePeriod}
              disabled={savingPeriod || !outdoorFrom || !outdoorTo}
              className="bg-[#c2410c] hover:bg-[#9a3412] disabled:opacity-50 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingPeriod ? "Salvataggio..." : "Salva periodo"}
            </button>
            {(outdoorFrom || outdoorTo) && (
              <button
                onClick={removePeriod}
                disabled={savingPeriod}
                className="px-4 py-2 text-sm text-[#78716c] hover:text-[#1c1917] border border-[#e8e0d8] rounded-lg transition-colors"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sezione tavoli interni */}
      {interni.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#78716c] uppercase tracking-wide mb-3 px-1">
            Tavoli interni
          </h2>
          <TableList
            tables={interni}
            editingId={editingId}
            editName={editName}
            editSeats={editSeats}
            editIsOutdoor={editIsOutdoor}
            setEditingId={setEditingId}
            setEditName={setEditName}
            setEditSeats={setEditSeats}
            setEditIsOutdoor={setEditIsOutdoor}
            onUpdate={updateTable}
            onToggle={toggleActive}
            onDelete={deleteTable}
          />
        </div>
      )}

      {/* Sezione tavoli esterni */}
      <div>
        <h2 className="text-sm font-semibold text-[#78716c] uppercase tracking-wide mb-3 px-1">
          Tavoli esterni
        </h2>
        {esterni.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e8e0d8] px-6 py-8 text-center">
            <p className="text-sm text-[#d6cfc7]">Nessun tavolo esterno. Aggiungine uno impostando la posizione su "Esterno".</p>
          </div>
        ) : (
          <TableList
            tables={esterni}
            editingId={editingId}
            editName={editName}
            editSeats={editSeats}
            editIsOutdoor={editIsOutdoor}
            setEditingId={setEditingId}
            setEditName={setEditName}
            setEditSeats={setEditSeats}
            setEditIsOutdoor={setEditIsOutdoor}
            onUpdate={updateTable}
            onToggle={toggleActive}
            onDelete={deleteTable}
          />
        )}
      </div>
    </div>
  );
}

function TableList({
  tables, editingId, editName, editSeats, editIsOutdoor,
  setEditingId, setEditName, setEditSeats, setEditIsOutdoor,
  onUpdate, onToggle, onDelete,
}: {
  tables: Table[];
  editingId: string | null;
  editName: string;
  editSeats: number;
  editIsOutdoor: boolean;
  setEditingId: (id: string | null) => void;
  setEditName: (v: string) => void;
  setEditSeats: (v: number) => void;
  setEditIsOutdoor: (v: boolean) => void;
  onUpdate: (id: string) => void;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:block bg-white rounded-xl border border-[#e8e0d8] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#faf7f5] border-b border-[#e8e0d8]">
              <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Nome</th>
              <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Posti</th>
              <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Posizione</th>
              <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Stato</th>
              <th className="text-right text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <tr key={table.id} className="border-b border-[#f0ebe5] last:border-0">
                {editingId === table.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 border border-[#d6cfc7] rounded text-sm text-[#1c1917] outline-none focus:border-[#c2410c]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editSeats}
                        onChange={(e) => setEditSeats(parseInt(e.target.value) || 1)}
                        min={1} max={20}
                        className="w-20 px-2 py-1 border border-[#d6cfc7] rounded text-sm text-[#1c1917] outline-none focus:border-[#c2410c]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editIsOutdoor ? "esterno" : "interno"}
                        onChange={(e) => setEditIsOutdoor(e.target.value === "esterno")}
                        className="px-2 py-1 border border-[#d6cfc7] rounded text-sm text-[#1c1917] outline-none focus:border-[#c2410c] bg-white"
                      >
                        <option value="interno">Interno</option>
                        <option value="esterno">Esterno</option>
                      </select>
                    </td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onUpdate(table.id)}
                          className="text-sm text-[#c2410c] hover:text-[#9a3412] font-medium"
                        >
                          Salva
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-sm text-[#a8a29e] hover:text-[#78716c]"
                        >
                          Annulla
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-3 text-sm font-medium text-[#1c1917]">{table.name}</td>
                    <td className="px-6 py-3 text-sm text-[#78716c]">{table.seats} posti</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        table.is_outdoor ? "bg-sky-50 text-sky-700" : "bg-[#f5f0eb] text-[#78716c]"
                      }`}>
                        {table.is_outdoor ? "Esterno" : "Interno"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        table.is_active ? "bg-green-50 text-green-700" : "bg-[#f5f0eb] text-[#a8a29e]"
                      }`}>
                        {table.is_active ? "Attivo" : "Disattivo"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            setEditingId(table.id);
                            setEditName(table.name);
                            setEditSeats(table.seats);
                            setEditIsOutdoor(table.is_outdoor);
                          }}
                          className="text-sm text-[#78716c] hover:text-[#1c1917]"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => onToggle(table.id, table.is_active)}
                          className={`text-sm font-medium ${
                            table.is_active ? "text-amber-600 hover:text-amber-800" : "text-green-600 hover:text-green-800"
                          }`}
                        >
                          {table.is_active ? "Disattiva" : "Attiva"}
                        </button>
                        <button
                          onClick={() => onDelete(table.id)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          Elimina
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="sm:hidden space-y-3">
        {tables.map((table) => (
          <div key={table.id} className="bg-white rounded-xl border border-[#e8e0d8] p-4">
            {editingId === table.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#c2410c]"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={editSeats}
                    onChange={(e) => setEditSeats(parseInt(e.target.value) || 1)}
                    min={1} max={20}
                    className="w-24 px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#c2410c]"
                  />
                  <select
                    value={editIsOutdoor ? "esterno" : "interno"}
                    onChange={(e) => setEditIsOutdoor(e.target.value === "esterno")}
                    className="flex-1 px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] outline-none bg-white"
                  >
                    <option value="interno">Interno</option>
                    <option value="esterno">Esterno</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUpdate(table.id)}
                    className="flex-1 bg-[#c2410c] text-white text-sm py-2 rounded-lg"
                  >
                    Salva
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 border border-[#e8e0d8] text-[#78716c] text-sm py-2 rounded-lg"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1c1917]">{table.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-[#a8a29e]">{table.seats} posti</p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                      table.is_outdoor ? "bg-sky-50 text-sky-700" : "bg-[#f5f0eb] text-[#78716c]"
                    }`}>
                      {table.is_outdoor ? "Esterno" : "Interno"}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                      table.is_active ? "bg-green-50 text-green-700" : "bg-[#f5f0eb] text-[#a8a29e]"
                    }`}>
                      {table.is_active ? "Attivo" : "Disattivo"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setEditingId(table.id);
                      setEditName(table.name);
                      setEditSeats(table.seats);
                      setEditIsOutdoor(table.is_outdoor);
                    }}
                    className="text-sm text-[#78716c]"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => onToggle(table.id, table.is_active)}
                    className={`text-sm font-medium ${
                      table.is_active ? "text-amber-600" : "text-green-600"
                    }`}
                  >
                    {table.is_active ? "Disattiva" : "Attiva"}
                  </button>
                  <button onClick={() => onDelete(table.id)} className="text-sm text-red-500">
                    Elimina
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
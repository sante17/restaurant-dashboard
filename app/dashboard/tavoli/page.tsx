"use client";

import { createClient } from "../../../lib/supabase/client";
import { useEffect, useState } from "react";

interface Table {
 id: string; name: string; seats: number; is_active: boolean;
}

export default function TavoliPage() {
 const [tables, setTables] = useState<Table[]>([]);
 const [loading, setLoading] = useState(true);
 const [newName, setNewName] = useState("");
 const [newSeats, setNewSeats] = useState(4);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editName, setEditName] = useState("");
 const [editSeats, setEditSeats] = useState(4);
 const [restaurantId, setRestaurantId] = useState<string | null>(null);
 const [syncing, setSyncing] = useState(false);
 const supabase = createClient();

 useEffect(() => { loadTables(); }, []);

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
 ]);
 } catch (e) { console.error("Sync error:", e); }
 setSyncing(false);
 }

 async function loadTables() {
 const rid = await getRestaurantId();
 if (!rid) return;
 const { data } = await supabase.from("tables").select("*").eq("restaurant_id", rid).order("name");
 setTables(data || []);
 setLoading(false);
 }

 async function addTable() {
 if (!newName.trim()) return;
 const rid = await getRestaurantId();
 if (!rid) return;
 await supabase.from("tables").insert({ restaurant_id: rid, name: newName.trim(), seats: newSeats, is_active: true });
 setNewName(""); setNewSeats(4);
 loadTables(); await syncAll();
 }

 async function updateTable(id: string) {
 await supabase.from("tables").update({ name: editName.trim(), seats: editSeats }).eq("id", id);
 setEditingId(null);
 loadTables(); await syncAll();
 }

 async function toggleActive(id: string, currentActive: boolean) {
 await supabase.from("tables").update({ is_active: !currentActive }).eq("id", id);
 loadTables(); await syncAll();
 }

 async function deleteTable(id: string) {
 if (!confirm("Sei sicuro di voler eliminare questo tavolo?")) return;
 await supabase.from("tables").delete().eq("id", id);
 loadTables(); await syncAll();
 }

 if (loading) return <div className="flex items-center justify-center h-64"><p className="text-[#a8a29e]">Caricamento...</p></div>;

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
 <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="es. Tavolo7" className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div className="w-full sm:w-32">
 <label className="block text-sm text-[#78716c] mb-1">Posti</label>
 <input type="number" value={newSeats} onChange={(e) => setNewSeats(parseInt(e.target.value) || 1)} min={1} max={20} className="w-full px-3 py-2 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917] focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] outline-none" />
 </div>
 <div className="flex items-end">
 <button onClick={addTable} className="bg-[#c2410c] hover:bg-[#9a3412] w-full sm:w-auto px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors">Aggiungi</button>
 </div>
 </div>
 </div>

 {/* Desktop: tabella */}
 <div className="hidden sm:block bg-white rounded-xl border border-[#e8e0d8] overflow-hidden">
 <table className="w-full">
 <thead>
 <tr className="bg-[#faf7f5] border-b border-[#e8e0d8]">
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Nome</th>
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Posti</th>
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Stato</th>
 <th className="text-right text-xs font-semibold text-[#a8a29e] uppercase px-6 py-3">Azioni</th>
 </tr>
 </thead>
 <tbody>
 {tables.map((table) => (
 <tr key={table.id} className="border-b border-[#f0ebe5] last:border-0">
 {editingId === table.id ? (
 <>
 <td className="px-6 py-3"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 border border-[#d6cfc7] rounded text-sm text-[#1c1917]" /></td>
 <td className="px-6 py-3"><input type="number" value={editSeats} onChange={(e) => setEditSeats(parseInt(e.target.value) || 1)} min={1} max={20} className="w-20 px-2 py-1 border border-[#d6cfc7] rounded text-sm text-[#1c1917]" /></td>
 <td className="px-6 py-3" />
 <td className="px-6 py-3 text-right space-x-2">
 <button onClick={() => updateTable(table.id)} className="text-sm text-[#c2410c] hover:text-[#9a3412] font-medium">Salva</button>
 <button onClick={() => setEditingId(null)} className="text-sm text-[#a8a29e] hover:text-[#44403c]">Annulla</button>
 </td>
 </>
 ) : (
 <>
 <td className="px-6 py-3 text-sm font-medium text-[#1c1917]">{table.name}</td>
 <td className="px-6 py-3 text-sm text-[#78716c]">{table.seats} posti</td>
 <td className="px-6 py-3">
 <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + (table.is_active ? "bg-green-100 text-green-700" : "bg-[#f5f0eb] text-[#a8a29e]")}>
 {table.is_active ? "Attivo" : "Disattivato"}
 </span>
 </td>
 <td className="px-6 py-3 text-right space-x-3">
 <button onClick={() => { setEditingId(table.id); setEditName(table.name); setEditSeats(table.seats); }} className="text-sm text-[#c2410c] hover:text-[#9a3412] font-medium">Modifica</button>
 <button onClick={() => toggleActive(table.id, table.is_active)} className="text-sm text-amber-600 hover:text-amber-800 font-medium">{table.is_active ? "Disattiva" : "Attiva"}</button>
 <button onClick={() => deleteTable(table.id)} className="text-sm text-red-600 hover:text-red-800 font-medium">Elimina</button>
 </td>
 </>
 )}
 </tr>
 ))}
 {tables.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-[#a8a29e]">Nessun tavolo. Aggiungine uno!</td></tr>}
 </tbody>
 </table>
 </div>

 {/* Mobile: cards */}
 <div className="sm:hidden space-y-3">
 {tables.map((table) => (
 <div key={table.id} className={"bg-white rounded-xl border border-[#e8e0d8] p-4 " + (!table.is_active ? "opacity-60" : "")}>
 {editingId === table.id ? (
 <div>
 <div className="flex gap-3 mb-3">
 <div className="flex-1">
 <label className="block text-xs text-[#78716c] mb-1">Nome</label>
 <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1.5 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 </div>
 <div className="w-20">
 <label className="block text-xs text-[#78716c] mb-1">Posti</label>
 <input type="number" value={editSeats} onChange={(e) => setEditSeats(parseInt(e.target.value) || 1)} min={1} max={20} className="w-full px-2 py-1.5 border border-[#d6cfc7] rounded-lg text-sm text-[#1c1917]" />
 </div>
 </div>
 <div className="flex gap-2">
 <button onClick={() => updateTable(table.id)} className="bg-[#c2410c] hover:bg-[#9a3412] flex-1 px-3 py-1.5 text-white text-sm rounded-lg ">Salva</button>
 <button onClick={() => setEditingId(null)} className="flex-1 px-3 py-1.5 text-[#78716c] text-sm rounded-lg hover:bg-[#f5f0eb] border border-[#e8e0d8]">Annulla</button>
 </div>
 </div>
 ) : (
 <div>
 <div className="flex items-center justify-between mb-3">
 <div>
 <p className="text-sm font-semibold text-[#1c1917]">{table.name}</p>
 <p className="text-xs text-[#a8a29e]">{table.seats} posti</p>
 </div>
 <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + (table.is_active ? "bg-green-100 text-green-700" : "bg-[#f5f0eb] text-[#a8a29e]")}>
 {table.is_active ? "Attivo" : "Disattivato"}
 </span>
 </div>
 <div className="flex gap-2">
 <button onClick={() => { setEditingId(table.id); setEditName(table.name); setEditSeats(table.seats); }} className="flex-1 px-3 py-1.5 text-[#c2410c] text-xs font-medium rounded-lg border border-[#c2410c]/20 hover:bg-[#fff7ed]">Modifica</button>
 <button onClick={() => toggleActive(table.id, table.is_active)} className="flex-1 px-3 py-1.5 text-amber-600 text-xs font-medium rounded-lg border border-amber-200 hover:bg-amber-50">{table.is_active ? "Disattiva" : "Attiva"}</button>
 <button onClick={() => deleteTable(table.id)} className="flex-1 px-3 py-1.5 text-red-600 text-xs font-medium rounded-lg border border-red-200 hover:bg-[#fef2f2]">Elimina</button>
 </div>
 </div>
 )}
 </div>
 ))}
 {tables.length === 0 && (
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-8 text-center">
 <p className="text-sm text-[#a8a29e]">Nessun tavolo. Aggiungine uno!</p>
 </div>
 )}
 </div>
 </div>
 );
}
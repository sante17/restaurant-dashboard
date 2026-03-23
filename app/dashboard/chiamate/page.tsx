"use client";

import { useEffect, useState } from "react";

interface CallSummary {
 id: string; type: string; status: string; startedAt: string; endedAt: string;
 duration: number; cost: string | null; customerPhone: string | null;
 endedReason: string | null; summary: string | null;
 outcome: "prenotazione" | "modifica" | "cancellazione" | "trasferita" | "nessuna";
}

interface CallDetail extends CallSummary {
 transcript: string; messages: any[];
}

type OutcomeFilter = "all" | "prenotazione" | "modifica" | "cancellazione" | "trasferita" | "nessuna";
type TimeFilter = "all" | "today" | "week";

const OUTCOME_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
 prenotazione: { label: "Prenotazione", color: "bg-green-100 text-green-700", icon: "✅" },
 modifica: { label: "Modifica", color: "bg-[#fff7ed] text-[#c2410c]", icon: "✏️" },
 cancellazione: { label: "Cancellazione", color: "bg-red-100 text-red-700", icon: "❌" },
 trasferita: { label: "Trasferita", color: "bg-amber-100 text-amber-700", icon: "👤" },
 nessuna: { label: "Solo info", color: "bg-[#f5f0eb] text-[#78716c]", icon: "💬" },
};

export default function ChiamatePage() {
 const [calls, setCalls] = useState<CallSummary[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
 const [callDetail, setCallDetail] = useState<CallDetail | null>(null);
 const [loadingDetail, setLoadingDetail] = useState(false);
 const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
 const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

 useEffect(() => { loadCalls(); }, []);

 async function loadCalls() {
 setLoading(true); setError("");
 try {
 const res = await fetch("/api/chiamate?limit=100");
 const data = await res.json();
 if (data.error) { setError(data.error); setLoading(false); return; }
 setCalls(data.calls || []);
 } catch { setError("Errore nel caricamento"); }
 setLoading(false);
 }

 async function loadCallDetail(callId: string) {
 if (selectedCallId === callId) { setSelectedCallId(null); setCallDetail(null); return; }
 setSelectedCallId(callId); setCallDetail(null); setLoadingDetail(true);
 try {
 const res = await fetch("/api/chiamate?callId=" + callId);
 const data = await res.json();
 if (data.error) { setError(data.error); setLoadingDetail(false); return; }
 setCallDetail(data.call);
 } catch { setError("Errore nel caricamento dettaglio"); }
 setLoadingDetail(false);
 }

 function formatDateTime(d: string) { if (!d) return "---"; const dt = new Date(d); return dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + dt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); }
 function formatDate(d: string) { if (!d) return "---"; return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }); }
 function formatTime(d: string) { if (!d) return ""; return new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); }
 function formatDuration(s: number) { if (!s || s <= 0) return "0s"; const m = Math.floor(s / 60); const sec = s % 60; return m === 0 ? sec + "s" : m + "m " + sec + "s"; }
 function formatPhone(p: string | null) { return p || "Sconosciuto"; }

 function parseTranscriptMessages(detail: CallDetail) {
 if (detail.messages && detail.messages.length > 0) {
 return detail.messages
 .filter((m: any) => m.role === "assistant" || m.role === "user" || m.role === "bot" || m.role === "customer")
 .map((m: any) => ({
 role: (m.role === "assistant" || m.role === "bot") ? "Agente" : "Cliente",
 text: m.content || m.message || m.transcript || "",
 isAgent: m.role === "assistant" || m.role === "bot",
 }))
 .filter((m: any) => m.text.trim());
 }
 if (detail.transcript) {
 return detail.transcript.split("\n").filter((l: string) => l.trim()).map((line: string) => {
 const isAgent = line.toLowerCase().startsWith("ai:") || line.toLowerCase().startsWith("assistant:") || line.toLowerCase().startsWith("bot:");
 return { role: isAgent ? "Agente" : "Cliente", text: line.replace(/^(AI|Assistant|Bot|User|Human|Customer):\s*/i, ""), isAgent };
 });
 }
 return [];
 }

 // Apply filters
 const filteredCalls = calls.filter((call) => {
 // Time filter
 if (timeFilter !== "all") {
 const callDate = new Date(call.startedAt);
 const now = new Date();
 if (timeFilter === "today" && callDate.toDateString() !== now.toDateString()) return false;
 if (timeFilter === "week") {
 const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
 if (callDate < weekAgo) return false;
 }
 }
 // Outcome filter
 if (outcomeFilter !== "all" && call.outcome !== outcomeFilter) return false;
 return true;
 });

 const totalCost = filteredCalls.reduce((sum, c) => sum + (c.cost ? parseFloat(c.cost) : 0), 0);

 // Outcome counts for filter badges
 const outcomeCounts: Record<string, number> = { prenotazione: 0, modifica: 0, cancellazione: 0, trasferita: 0, nessuna: 0 };
 const timeFilteredCalls = calls.filter((call) => {
 if (timeFilter === "all") return true;
 const callDate = new Date(call.startedAt);
 const now = new Date();
 if (timeFilter === "today") return callDate.toDateString() === now.toDateString();
 const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
 return callDate >= weekAgo;
 });
 for (const c of timeFilteredCalls) outcomeCounts[c.outcome]++;

 if (loading) return <div className="flex items-center justify-center h-64"><p className="text-[#a8a29e]">Caricamento chiamate...</p></div>;

 return (
 <div>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
 <div>
 <h1 className="text-2xl font-bold text-[#1c1917]">Chiamate</h1>
 <p className="text-[#a8a29e] mt-1 text-sm">{filteredCalls.length} chiamate</p>
 </div>
 <button onClick={loadCalls} className="bg-[#c2410c] hover:bg-[#9a3412] w-full sm:w-auto px-4 py-2 text-white text-sm font-medium rounded-lg">Aggiorna</button>
 </div>

 {error && <div className="mb-4 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

 {/* Filtri tempo */}
 <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 mb-3">
 {(["all", "today", "week"] as const).map((f) => (
 <button key={f} onClick={() => setTimeFilter(f)}
 className={"px-4 py-2 text-sm font-medium rounded-lg transition-colors text-center " + (timeFilter === f ? "bg-[#c2410c] text-white" : "bg-white border border-[#e8e0d8] text-[#78716c] hover:bg-[#faf7f5]")}>
 {f === "all" ? "Tutte" : f === "today" ? "Oggi" : "Settimana"}
 </button>
 ))}
 </div>

 {/* Filtri esito */}
 <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-6">
 <button onClick={() => setOutcomeFilter("all")}
 className={"col-span-2 sm:col-span-1 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-colors text-center " + (outcomeFilter === "all" ? "bg-[#292524] text-white" : "bg-white border border-[#e8e0d8] text-[#78716c] hover:bg-[#faf7f5]")}>
 Tutti gli esiti
 </button>
 {(Object.keys(OUTCOME_CONFIG) as OutcomeFilter[]).map((key) => {
 const cfg = OUTCOME_CONFIG[key];
 const count = outcomeCounts[key] || 0;
 return (
 <button key={key} onClick={() => setOutcomeFilter(outcomeFilter === key ? "all" : key)}
 className={"px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 " + (outcomeFilter === key ? cfg.color + " ring-2 ring-offset-1 ring-[#d6cfc7]" : "bg-white border border-[#e8e0d8] text-[#78716c] hover:bg-[#faf7f5]")}>
 <span>{cfg.icon}</span>
 <span>{cfg.label}</span>
 <span className="text-xs opacity-60">({count})</span>
 </button>
 );
 })}
 </div>

 {/* Stats */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
 <p className="text-xs text-[#a8a29e]">Chiamate</p>
 <p className="text-2xl font-bold text-[#1c1917]">{filteredCalls.length}</p>
 </div>
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
 <p className="text-xs text-[#a8a29e]">Durata media</p>
 <p className="text-2xl font-bold text-[#1c1917]">
 {filteredCalls.length > 0 ? formatDuration(Math.round(filteredCalls.reduce((s, c) => s + c.duration, 0) / filteredCalls.length)) : "---"}
 </p>
 </div>
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
 <p className="text-xs text-[#a8a29e]">Prenotazioni create</p>
 <p className="text-2xl font-bold text-[#1c1917]">{filteredCalls.filter(c => c.outcome === "prenotazione").length}</p>
 </div>
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
 <p className="text-xs text-[#a8a29e]">Costo totale</p>
 <p className="text-2xl font-bold text-[#1c1917]">${totalCost.toFixed(2)}</p>
 </div>
 </div>

 {/* Dettaglio chiamata */}
 {selectedCallId && (
 <div className="bg-white rounded-xl border border-[#c2410c]/20 p-4 sm:p-5 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-sm font-semibold text-[#1c1917]">Dettaglio chiamata</h2>
 <button onClick={() => { setSelectedCallId(null); setCallDetail(null); }} className="text-[#d6cfc7] hover:text-[#78716c] text-lg">x</button>
 </div>
 {loadingDetail ? (
 <div className="py-8 text-center"><p className="text-sm text-[#a8a29e]">Caricamento conversazione completa...</p></div>
 ) : callDetail ? (
 <>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
 <div><span className="text-[#a8a29e] text-xs">Data</span><p className="font-medium text-[#1c1917]">{formatDate(callDetail.startedAt)}</p></div>
 <div><span className="text-[#a8a29e] text-xs">Orario</span><p className="font-medium text-[#1c1917]">{formatTime(callDetail.startedAt)} - {formatTime(callDetail.endedAt)}</p></div>
 <div><span className="text-[#a8a29e] text-xs">Durata</span><p className="font-medium text-[#1c1917]">{formatDuration(callDetail.duration)}</p></div>
 <div><span className="text-[#a8a29e] text-xs">Costo</span><p className="font-medium text-[#1c1917]">{callDetail.cost ? "$" + callDetail.cost : "---"}</p></div>
 <div><span className="text-[#a8a29e] text-xs">Telefono</span><p className="font-medium text-[#1c1917]">{formatPhone(callDetail.customerPhone)}</p></div>
 <div>
 <span className="text-[#a8a29e] text-xs">Esito</span>
 <p><span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium " + OUTCOME_CONFIG[callDetail.outcome].color}>
 {OUTCOME_CONFIG[callDetail.outcome].icon} {OUTCOME_CONFIG[callDetail.outcome].label}
 </span></p>
 </div>
 </div>
 {callDetail.summary && (
 <div className="mb-4 p-3 bg-[#faf7f5] rounded-lg">
 <p className="text-xs text-[#a8a29e] mb-1">Riepilogo AI</p>
 <p className="text-sm text-[#44403c]">{callDetail.summary}</p>
 </div>
 )}
 <div>
 <p className="text-xs text-[#a8a29e] mb-2 font-medium">Conversazione completa</p>
 <div className="space-y-2 max-h-[500px] overflow-y-auto">
 {parseTranscriptMessages(callDetail).length > 0 ? (
 parseTranscriptMessages(callDetail).map((msg: any, i: number) => (
 <div key={i} className={"flex " + (msg.isAgent ? "justify-start" : "justify-end")}>
 <div className={"max-w-[85%] px-3 py-2 rounded-xl text-sm " + (msg.isAgent ? "bg-[#fff7ed] text-[#9a3412]" : "bg-[#f5f0eb] text-[#1c1917]")}>
 <p className={"text-xs font-medium mb-0.5 " + (msg.isAgent ? "text-[#c2410c]" : "text-[#a8a29e]")}>{msg.role}</p>
 <p>{msg.text}</p>
 </div>
 </div>
 ))
 ) : (
 <p className="text-sm text-[#d6cfc7] text-center py-4">Nessun transcript disponibile</p>
 )}
 </div>
 </div>
 </>
 ) : (
 <div className="py-8 text-center"><p className="text-sm text-[#d6cfc7]">Errore nel caricamento</p></div>
 )}
 </div>
 )}

 {/* Lista chiamate */}
 <div className="bg-white rounded-xl border border-[#e8e0d8] overflow-hidden">
 {filteredCalls.length > 0 ? (
 <>
 {/* Mobile */}
 <div className="sm:hidden divide-y divide-gray-100">
 {filteredCalls.map((call) => {
 const cfg = OUTCOME_CONFIG[call.outcome];
 return (
 <button key={call.id} onClick={() => loadCallDetail(call.id)}
 className={"w-full text-left p-4 transition-colors " + (selectedCallId === call.id ? "bg-[#fff7ed]" : "hover:bg-[#faf7f5]")}>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-sm font-medium text-[#1c1917]">{formatPhone(call.customerPhone)}</span>
 <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium " + cfg.color}>
 {cfg.icon} {cfg.label}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-[#a8a29e]">{formatDateTime(call.startedAt)}</span>
 <span className="text-xs text-[#a8a29e]">{formatDuration(call.duration)}{call.cost ? " - $" + call.cost : ""}</span>
 </div>
 </button>
 );
 })}
 </div>

 {/* Desktop */}
 <table className="w-full hidden sm:table">
 <thead>
 <tr className="bg-[#faf7f5] border-b border-[#e8e0d8]">
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Data / Ora</th>
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Telefono</th>
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Durata</th>
 <th className="text-left text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Esito</th>
 <th className="text-right text-xs font-semibold text-[#a8a29e] uppercase px-4 py-3">Costo</th>
 </tr>
 </thead>
 <tbody>
 {filteredCalls.map((call) => {
 const cfg = OUTCOME_CONFIG[call.outcome];
 return (
 <tr key={call.id} onClick={() => loadCallDetail(call.id)}
 className={"border-b border-[#f0ebe5] last:border-0 cursor-pointer transition-colors " + (selectedCallId === call.id ? "bg-[#fff7ed]" : "hover:bg-[#faf7f5]")}>
 <td className="px-4 py-3 text-sm text-[#1c1917]">{formatDateTime(call.startedAt)}</td>
 <td className="px-4 py-3 text-sm text-[#78716c] font-mono">{formatPhone(call.customerPhone)}</td>
 <td className="px-4 py-3 text-sm text-[#78716c]">{formatDuration(call.duration)}</td>
 <td className="px-4 py-3">
 <span className={"inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium " + cfg.color}>
 {cfg.icon} {cfg.label}
 </span>
 </td>
 <td className="px-4 py-3 text-sm text-[#78716c] text-right">{call.cost ? "$" + call.cost : "---"}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </>
 ) : (
 <p className="px-6 py-8 text-sm text-[#d6cfc7] text-center">
 {outcomeFilter !== "all" ? "Nessuna chiamata con esito '" + OUTCOME_CONFIG[outcomeFilter].label + "'" : "Nessuna chiamata trovata"}
 </p>
 )}
 </div>
 </div>
 );
}
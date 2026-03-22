"use client";

import { useEffect, useState } from "react";

interface CallSummary {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  endedAt: string;
  duration: number;
  cost: string | null;
  customerPhone: string | null;
  endedReason: string | null;
  summary: string | null;
}

interface CallDetail extends CallSummary {
  transcript: string;
  messages: any[];
}

export default function ChiamatePage() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [callDetail, setCallDetail] = useState<CallDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "week">("all");

  useEffect(() => { loadCalls(); }, []);

  async function loadCalls() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/chiamate?limit=100");
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setCalls(data.calls || []);
    } catch { setError("Errore nel caricamento"); }
    setLoading(false);
  }

  async function loadCallDetail(callId: string) {
    if (selectedCallId === callId) {
      setSelectedCallId(null);
      setCallDetail(null);
      return;
    }
    setSelectedCallId(callId);
    setCallDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch("/api/chiamate?callId=" + callId);
      const data = await res.json();
      if (data.error) { setError(data.error); setLoadingDetail(false); return; }
      setCallDetail(data.call);
    } catch { setError("Errore nel caricamento dettaglio"); }
    setLoadingDetail(false);
  }

  function formatDateTime(dateStr: string) {
    if (!dateStr) return "---";
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "---";
    return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatTime(dateStr: string) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDuration(seconds: number) {
    if (!seconds || seconds <= 0) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return s + "s";
    return m + "m " + s + "s";
  }

  function formatPhone(phone: string | null) {
    return phone || "Sconosciuto";
  }

  function getStatusLabel(call: CallSummary) {
    if (call.endedReason === "customer-ended-call" || call.endedReason === "assistant-ended-call") return "Completata";
    if (call.endedReason === "customer-did-not-answer") return "Non risposta";
    if (call.endedReason === "voicemail") return "Segreteria";
    if (call.endedReason === "silence-timed-out") return "Timeout";
    if (call.endedReason === "max-duration-reached") return "Durata max";
    if (call.endedReason === "assistant-forwarded-call") return "Trasferita";
    if (call.status === "in-progress") return "In corso";
    return "Terminata";
  }

  function getStatusColor(call: CallSummary) {
    if (call.endedReason === "assistant-forwarded-call") return "bg-amber-100 text-amber-700";
    if (call.endedReason === "customer-did-not-answer") return "bg-red-100 text-red-700";
    if (call.endedReason === "silence-timed-out") return "bg-gray-100 text-gray-600";
    if (call.status === "in-progress") return "bg-blue-100 text-blue-700";
    return "bg-green-100 text-green-700";
  }

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
      const lines = detail.transcript.split("\n").filter((l: string) => l.trim());
      return lines.map((line: string) => {
        const isAgent = line.toLowerCase().startsWith("ai:") || line.toLowerCase().startsWith("assistant:") || line.toLowerCase().startsWith("bot:");
        const cleanLine = line.replace(/^(AI|Assistant|Bot|User|Human|Customer):\s*/i, "");
        return { role: isAgent ? "Agente" : "Cliente", text: cleanLine, isAgent };
      });
    }
    return [];
  }

  const filteredCalls = calls.filter((call) => {
    if (filter === "all") return true;
    const callDate = new Date(call.startedAt);
    const now = new Date();
    if (filter === "today") return callDate.toDateString() === now.toDateString();
    if (filter === "week") {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      return callDate >= weekAgo;
    }
    return true;
  });

  const totalCost = filteredCalls.reduce((sum, c) => sum + (c.cost ? parseFloat(c.cost) : 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Caricamento chiamate...</p></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chiamate</h1>
          <p className="text-gray-500 mt-1 text-sm">{filteredCalls.length} chiamate {filter === "today" ? "di oggi" : filter === "week" ? "questa settimana" : "totali"}</p>
        </div>
        <button onClick={loadCalls} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Aggiorna</button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "today", "week"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={"px-4 py-2 text-sm font-medium rounded-lg transition-colors " + (filter === f ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>
            {f === "all" ? "Tutte" : f === "today" ? "Oggi" : "Questa settimana"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Chiamate</p>
          <p className="text-2xl font-bold text-gray-900">{filteredCalls.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Durata media</p>
          <p className="text-2xl font-bold text-gray-900">
            {filteredCalls.length > 0 ? formatDuration(Math.round(filteredCalls.reduce((s, c) => s + c.duration, 0) / filteredCalls.length)) : "---"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Trasferite</p>
          <p className="text-2xl font-bold text-gray-900">{filteredCalls.filter(c => c.endedReason === "assistant-forwarded-call").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Costo totale</p>
          <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
        </div>
      </div>

      {/* Dettaglio chiamata */}
      {selectedCallId && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Dettaglio chiamata</h2>
            <button onClick={() => { setSelectedCallId(null); setCallDetail(null); }} className="text-gray-400 hover:text-gray-600 text-lg">x</button>
          </div>

          {loadingDetail ? (
            <div className="py-8 text-center"><p className="text-sm text-gray-500">Caricamento conversazione completa...</p></div>
          ) : callDetail ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                <div><span className="text-gray-500 text-xs">Data</span><p className="font-medium text-gray-900">{formatDate(callDetail.startedAt)}</p></div>
                <div><span className="text-gray-500 text-xs">Orario</span><p className="font-medium text-gray-900">{formatTime(callDetail.startedAt)} - {formatTime(callDetail.endedAt)}</p></div>
                <div><span className="text-gray-500 text-xs">Durata</span><p className="font-medium text-gray-900">{formatDuration(callDetail.duration)}</p></div>
                <div><span className="text-gray-500 text-xs">Costo</span><p className="font-medium text-gray-900">{callDetail.cost ? "$" + callDetail.cost : "---"}</p></div>
                <div><span className="text-gray-500 text-xs">Telefono</span><p className="font-medium text-gray-900">{formatPhone(callDetail.customerPhone)}</p></div>
                <div><span className="text-gray-500 text-xs">Stato</span><p className="font-medium text-gray-900">{getStatusLabel(callDetail)}</p></div>
              </div>

              {callDetail.summary && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Riepilogo AI</p>
                  <p className="text-sm text-gray-700">{callDetail.summary}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Conversazione completa</p>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {parseTranscriptMessages(callDetail).length > 0 ? (
                    parseTranscriptMessages(callDetail).map((msg: any, i: number) => (
                      <div key={i} className={"flex " + (msg.isAgent ? "justify-start" : "justify-end")}>
                        <div className={"max-w-[85%] px-3 py-2 rounded-xl text-sm " + (msg.isAgent ? "bg-blue-50 text-blue-900" : "bg-gray-100 text-gray-900")}>
                          <p className={"text-xs font-medium mb-0.5 " + (msg.isAgent ? "text-blue-600" : "text-gray-500")}>{msg.role}</p>
                          <p>{msg.text}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">Nessun transcript disponibile per questa chiamata</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center"><p className="text-sm text-gray-400">Errore nel caricamento</p></div>
          )}
        </div>
      )}

      {/* Lista chiamate */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredCalls.length > 0 ? (
          <>
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredCalls.map((call) => (
                <button key={call.id} onClick={() => loadCallDetail(call.id)}
                  className={"w-full text-left p-4 transition-colors " + (selectedCallId === call.id ? "bg-blue-50" : "hover:bg-gray-50")}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{formatPhone(call.customerPhone)}</span>
                    <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + getStatusColor(call)}>
                      {getStatusLabel(call)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{formatDateTime(call.startedAt)}</span>
                    <span className="text-xs text-gray-500">{formatDuration(call.duration)}{call.cost ? " - $" + call.cost : ""}</span>
                  </div>
                </button>
              ))}
            </div>

            <table className="w-full hidden sm:table">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Data / Ora</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Telefono</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Durata</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Stato</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Costo</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map((call) => (
                  <tr key={call.id} onClick={() => loadCallDetail(call.id)}
                    className={"border-b border-gray-100 last:border-0 cursor-pointer transition-colors " + (selectedCallId === call.id ? "bg-blue-50" : "hover:bg-gray-50")}>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDateTime(call.startedAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{formatPhone(call.customerPhone)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDuration(call.duration)}</td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + getStatusColor(call)}>
                        {getStatusLabel(call)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{call.cost ? "$" + call.cost : "---"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">Nessuna chiamata trovata</p>
        )}
      </div>
    </div>
  );
}
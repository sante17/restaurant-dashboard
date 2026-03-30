"use client";

import { useEffect, useState } from "react";

interface WaMessage {
  role: "user" | "assistant";
  message: string;
  created_at: string;
}

interface WaConversation {
  id: string;
  whatsapp_number: string;
  nome_cliente: string | null;
  stato: string;
  intento: string | null;
  intento_finale: string | null;
  dati_prenotazione: any;
  created_at: string | null;
  updated_at: string;
  messages: WaMessage[];
  message_count: number;
}

const INTENTO_LABEL: Record<string, string> = {
  nuova_prenotazione: "Prenotazione",
  modifica_prenotazione: "Modifica",
  cancellazione: "Cancellazione",
  info: "Info",
};

const INTENTO_COLOR: Record<string, string> = {
  nuova_prenotazione: "bg-green-100 text-green-700",
  modifica_prenotazione: "bg-blue-100 text-blue-700",
  cancellazione: "bg-red-100 text-red-600",
  info: "bg-[#f5f0eb] text-[#78716c]",
};

const IconWhatsApp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={"transition-transform " + (open ? "rotate-180" : "")}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

function formatDateTime(str: string | null) {
  if (!str) return "—";
  return new Date(str).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTime(str: string) {
  return new Date(str).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/whatsapp-log");
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setConversations(data.conversations || []);
    } catch { setError("Errore nel caricamento"); }
    setLoading(false);
  }

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.whatsapp_number.includes(q) ||
      (c.nome_cliente || "").toLowerCase().includes(q)
    );
  });

  const intento = (c: WaConversation) => c.intento_finale || c.intento || "";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-[#a8a29e]">Caricamento conversazioni...</p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1c1917]">WhatsApp</h1>
          <p className="text-[#a8a29e] mt-1 text-sm">Conversazioni e transcript</p>
        </div>
        <button onClick={loadData} className="bg-[#c2410c] hover:bg-[#9a3412] w-full sm:w-auto px-4 py-2 text-white text-sm font-medium rounded-lg">
          Aggiorna
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-[#fef2f2] border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Conversazioni totali</p>
          <p className="text-2xl font-bold text-[#1c1917]">{conversations.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Prenotazioni</p>
          <p className="text-2xl font-bold text-green-700">
            {conversations.filter((c) => intento(c) === "nuova_prenotazione").length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Modifiche</p>
          <p className="text-2xl font-bold text-blue-700">
            {conversations.filter((c) => intento(c) === "modifica_prenotazione").length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e0d8] p-4">
          <p className="text-xs text-[#a8a29e]">Messaggi totali</p>
          <p className="text-2xl font-bold text-[#1c1917]">
            {conversations.reduce((s, c) => s + c.message_count, 0)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Cerca per numero o nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e8e0d8] rounded-lg text-sm text-[#1c1917] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent"
        />
      </div>

      {/* Lista conversazioni */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e8e0d8] px-6 py-12 text-center">
            <p className="text-sm text-[#d6cfc7]">
              {search ? "Nessuna conversazione trovata" : "Nessuna conversazione registrata"}
            </p>
            {!search && (
              <p className="text-xs text-[#d6cfc7] mt-1">Le nuove conversazioni appariranno qui dopo le modifiche a n8n</p>
            )}
          </div>
        ) : (
          filtered.map((c) => {
            const isOpen = expanded === c.id;
            const intentoKey = intento(c);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-[#e8e0d8] overflow-hidden">
                {/* Riga principale */}
                <button
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="w-full text-left px-4 py-4 flex items-center gap-4 hover:bg-[#faf7f5] transition-colors"
                >
                  {/* Icona WA */}
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                    <IconWhatsApp />
                  </div>

                  {/* Info principale */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#1c1917]">
                        {c.nome_cliente || "Cliente sconosciuto"}
                      </span>
                      {intentoKey && (
                        <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + (INTENTO_COLOR[intentoKey] ?? "bg-[#f5f0eb] text-[#78716c]")}>
                          {INTENTO_LABEL[intentoKey] ?? intentoKey}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#a8a29e] font-mono mt-0.5">{c.whatsapp_number}</p>
                  </div>

                  {/* Meta destra */}
                  <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-[#a8a29e]">{formatDateTime(c.updated_at)}</span>
                    <span className="text-xs text-[#d6cfc7]">{c.message_count} messaggi</span>
                  </div>

                  <div className="text-[#a8a29e] flex-shrink-0 ml-2">
                    <IconChevron open={isOpen} />
                  </div>
                </button>

                {/* Transcript espanso */}
                {isOpen && (
                  <div className="border-t border-[#e8e0d8]">
                    {/* Dati prenotazione se presenti */}
                    {c.dati_prenotazione && Object.keys(c.dati_prenotazione).length > 0 && (
                      <div className="px-4 py-3 bg-[#faf7f5] border-b border-[#e8e0d8]">
                        <p className="text-xs font-semibold text-[#a8a29e] uppercase mb-2">Dati raccolti</p>
                        <div className="flex flex-wrap gap-3">
                          {c.dati_prenotazione.nome_cliente && (
                            <span className="text-xs text-[#78716c]">
                              <span className="text-[#a8a29e]">Nome:</span> {c.dati_prenotazione.nome_cliente}
                            </span>
                          )}
                          {c.dati_prenotazione.data && (
                            <span className="text-xs text-[#78716c]">
                              <span className="text-[#a8a29e]">Data:</span> {c.dati_prenotazione.data}
                            </span>
                          )}
                          {c.dati_prenotazione.ora && (
                            <span className="text-xs text-[#78716c]">
                              <span className="text-[#a8a29e]">Ora:</span> {c.dati_prenotazione.ora}
                            </span>
                          )}
                          {c.dati_prenotazione.num_persone && (
                            <span className="text-xs text-[#78716c]">
                              <span className="text-[#a8a29e]">Persone:</span> {c.dati_prenotazione.num_persone}
                            </span>
                          )}
                          {c.dati_prenotazione.posizione && (
                            <span className="text-xs text-[#78716c]">
                              <span className="text-[#a8a29e]">Posizione:</span> {c.dati_prenotazione.posizione}
                            </span>
                          )}
                          {c.dati_prenotazione.tavolo && (
                            <span className="text-xs text-[#78716c]">
                              <span className="text-[#a8a29e]">Tavolo:</span> {c.dati_prenotazione.tavolo}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Messaggi */}
                    <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                      {c.messages.length === 0 ? (
                        <p className="text-sm text-[#d6cfc7] text-center py-4">
                          Transcript non disponibile — attivo solo per le nuove conversazioni
                        </p>
                      ) : (
                        c.messages.map((m, i) => (
                          <div key={i} className={"flex " + (m.role === "user" ? "justify-start" : "justify-end")}>
                            <div className={"max-w-[75%] " + (m.role === "user" ? "" : "")}>
                              <div className={"px-3 py-2 rounded-2xl text-sm " + (
                                m.role === "user"
                                  ? "bg-[#f5f0eb] text-[#1c1917] rounded-tl-sm"
                                  : "bg-[#c2410c] text-white rounded-tr-sm"
                              )}>
                                {m.message}
                              </div>
                              <p className={"text-xs text-[#d6cfc7] mt-0.5 " + (m.role === "user" ? "text-left" : "text-right")}>
                                {formatTime(m.created_at)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-[#d6cfc7] text-center mt-4">
          {filtered.length} conversazioni{search ? ` trovate su ${conversations.length}` : ""}
        </p>
      )}
    </div>
  );
}
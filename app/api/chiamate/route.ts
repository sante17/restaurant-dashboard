import { createClient } from "../../../lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getVapiCredentials(supabase: any, userId: string) {
  const { data: userData } = await supabase.from("users").select("restaurant_id").eq("id", userId).single();
  if (!userData?.restaurant_id) return null;
  const { data: restaurant } = await supabase.from("restaurants").select("vapi_assistant_id, vapi_api_key").eq("id", userData.restaurant_id).single();
  if (!restaurant?.vapi_assistant_id || !restaurant?.vapi_api_key) return null;
  return restaurant;
}

function determineOutcome(call: any): string {
  // 1. Check endedReason for transfer
  if (call.endedReason === "assistant-forwarded-call") return "trasferita";

  // 2. Check messages for tool calls
  const messages = call.messages || [];
  let hasCrea = false;
  let hasModifica = false;
  let hasCancella = false;

  for (const msg of messages) {
    // Check tool_calls in assistant messages
    if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
      for (const tc of msg.toolCalls) {
        const name = tc.function?.name || tc.name || "";
        if (name === "crea_prenotazione") hasCrea = true;
        if (name === "modifica_prenotazione") {
          const args = tc.function?.arguments || {};
          if (args.azione === "cancella") hasCancella = true;
          else if (args.azione === "modifica") hasModifica = true;
          else if (args.azione === "cerca") { /* just a search, check if followed by modify/cancel */ }
        }
      }
    }
    // Also check role=tool_calls or type=tool_calls
    if (msg.role === "tool_calls" || msg.type === "tool_calls") {
      const toolCalls = msg.toolCalls || msg.tool_calls || [];
      for (const tc of toolCalls) {
        const name = tc.function?.name || tc.name || "";
        if (name === "crea_prenotazione") hasCrea = true;
        if (name === "modifica_prenotazione") {
          const args = tc.function?.arguments || {};
          if (args.azione === "cancella") hasCancella = true;
          else if (args.azione === "modifica") hasModifica = true;
        }
      }
    }
  }

  // 3. Fallback: check transcript text for keywords
  const transcript = (call.transcript || "").toLowerCase();
  if (!hasCrea && !hasModifica && !hasCancella) {
    if (transcript.includes("prenotazione confermata") || transcript.includes("codice:") || transcript.includes("ho prenotato")) hasCrea = true;
    if (transcript.includes("modifica eseguita") || transcript.includes("ho modificato")) hasModifica = true;
    if (transcript.includes("cancellazione eseguita") || transcript.includes("ho cancellato") || transcript.includes("cancellata")) hasCancella = true;
  }

  // Priority: cancella > modifica > crea (if multiple happened, show the most significant)
  if (hasCrea) return "prenotazione";
  if (hasModifica) return "modifica";
  if (hasCancella) return "cancellazione";

  return "nessuna";
}

function mapCall(call: any, includeTranscript: boolean) {
  const base: any = {
    id: call.id,
    type: call.type || "inboundPhoneCall",
    status: call.status || "ended",
    startedAt: call.startedAt || call.createdAt,
    endedAt: call.endedAt,
    duration: call.startedAt && call.endedAt
      ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
      : 0,
    cost: call.cost != null ? Number(call.cost).toFixed(4) : null,
    customerPhone: call.customer?.number || call.phoneNumber?.number || null,
    endedReason: call.endedReason || null,
    summary: call.analysis?.summary || null,
    outcome: determineOutcome(call),
  };

  if (includeTranscript) {
    base.transcript = call.transcript || "";
    base.messages = call.messages || [];
  }

  return base;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const restaurant = await getVapiCredentials(supabase, user.id);
    if (!restaurant) return NextResponse.json({ error: "Credenziali Vapi non configurate" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");

    // Dettaglio singola chiamata
    if (callId) {
      const vapiRes = await fetch("https://api.vapi.ai/call/" + callId, {
        headers: { "Authorization": "Bearer " + restaurant.vapi_api_key },
      });
      if (!vapiRes.ok) {
        return NextResponse.json({ error: "Errore Vapi: " + await vapiRes.text() }, { status: 500 });
      }
      const call = await vapiRes.json();
      return NextResponse.json({ call: mapCall(call, true) });
    }

    // Lista chiamate
    const limit = searchParams.get("limit") || "50";
    const vapiUrl = "https://api.vapi.ai/call?assistantId=" + restaurant.vapi_assistant_id + "&limit=" + limit;

    const vapiRes = await fetch(vapiUrl, {
      headers: { "Authorization": "Bearer " + restaurant.vapi_api_key },
    });
    if (!vapiRes.ok) {
      return NextResponse.json({ error: "Errore Vapi: " + await vapiRes.text() }, { status: 500 });
    }

    const calls = await vapiRes.json();
    const mapped = (Array.isArray(calls) ? calls : []).map((c: any) => mapCall(c, false));

    return NextResponse.json({ calls: mapped });
  } catch (error: any) {
    console.error("Chiamate API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
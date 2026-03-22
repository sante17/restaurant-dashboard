import { createClient } from "../../../lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getVapiCredentials(supabase: any, userId: string) {
  const { data: userData } = await supabase.from("users").select("restaurant_id").eq("id", userId).single();
  if (!userData?.restaurant_id) return null;
  const { data: restaurant } = await supabase.from("restaurants").select("vapi_assistant_id, vapi_api_key").eq("id", userData.restaurant_id).single();
  if (!restaurant?.vapi_assistant_id || !restaurant?.vapi_api_key) return null;
  return restaurant;
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

    // Se callId presente, ritorna il dettaglio completo di una singola chiamata
    if (callId) {
      const vapiRes = await fetch("https://api.vapi.ai/call/" + callId, {
        headers: { "Authorization": "Bearer " + restaurant.vapi_api_key },
      });

      if (!vapiRes.ok) {
        const errText = await vapiRes.text();
        return NextResponse.json({ error: "Errore Vapi: " + errText }, { status: 500 });
      }

      const call = await vapiRes.json();

      return NextResponse.json({
        call: {
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
          transcript: call.transcript || "",
          messages: call.messages || [],
          summary: call.analysis?.summary || null,
        }
      });
    }

    // Altrimenti, ritorna la lista chiamate (senza transcript per risparmiare banda)
    const limit = searchParams.get("limit") || "50";
    const vapiUrl = "https://api.vapi.ai/call?assistantId=" + restaurant.vapi_assistant_id + "&limit=" + limit;

    const vapiRes = await fetch(vapiUrl, {
      headers: { "Authorization": "Bearer " + restaurant.vapi_api_key },
    });

    if (!vapiRes.ok) {
      const errText = await vapiRes.text();
      return NextResponse.json({ error: "Errore Vapi: " + errText }, { status: 500 });
    }

    const calls = await vapiRes.json();

    const mapped = (Array.isArray(calls) ? calls : []).map((call: any) => ({
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
    }));

    return NextResponse.json({ calls: mapped });
  } catch (error: any) {
    console.error("Chiamate API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("id", user.id)
      .single();
    if (!userData?.restaurant_id) return NextResponse.json({ error: "Ristorante non trovato" }, { status: 400 });

    const restaurantId = userData.restaurant_id;

    // Conversazioni
    const { data: conversations, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("id, whatsapp_number, nome_cliente, stato, intento, intento_finale, dati_prenotazione, created_at, updated_at")
      .eq("restaurant_id", restaurantId)
      .order("updated_at", { ascending: false });

    if (convError) throw convError;

    // Messaggi
    const { data: messages, error: msgError } = await supabase
      .from("whatsapp_messages")
      .select("whatsapp_number, role, message, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: true });

    if (msgError) throw msgError;

    // Raggruppa messaggi per numero
    const msgMap: Record<string, { role: string; message: string; created_at: string }[]> = {};
    for (const m of messages || []) {
      if (!msgMap[m.whatsapp_number]) msgMap[m.whatsapp_number] = [];
      msgMap[m.whatsapp_number].push({ role: m.role, message: m.message, created_at: m.created_at });
    }

    const result = (conversations || []).map((c) => ({
      ...c,
      messages: msgMap[c.whatsapp_number] || [],
      message_count: (msgMap[c.whatsapp_number] || []).length,
    }));

    return NextResponse.json({ conversations: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
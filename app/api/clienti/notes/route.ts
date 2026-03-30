import { createClient } from "../../../../lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getRestaurantId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("restaurant_id")
    .eq("id", userId)
    .single();
  return data?.restaurant_id ?? null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const restaurantId = await getRestaurantId(supabase, user.id);
    if (!restaurantId) return NextResponse.json({ error: "Ristorante non trovato" }, { status: 400 });

    const { data: notes, error } = await supabase
      .from("customer_notes")
      .select("telefono, nota")
      .eq("restaurant_id", restaurantId);

    if (error) throw error;
    return NextResponse.json({ notes: notes ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const restaurantId = await getRestaurantId(supabase, user.id);
    if (!restaurantId) return NextResponse.json({ error: "Ristorante non trovato" }, { status: 400 });

    const { telefono, nota } = await request.json();
    if (!telefono) return NextResponse.json({ error: "Identificatore cliente mancante" }, { status: 400 });

    const { error } = await supabase
      .from("customer_notes")
      .upsert(
        { restaurant_id: restaurantId, telefono, nota: nota ?? "", updated_at: new Date().toISOString() },
        { onConflict: "restaurant_id,telefono" }
      );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
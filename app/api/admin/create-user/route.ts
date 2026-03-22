import { createClient } from "../../../../lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Verifica che chi chiama sia admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Solo gli admin possono creare utenti" }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, restaurant_id } = body;

    if (!email || !password || !restaurant_id) {
      return NextResponse.json({ error: "Email, password e restaurant_id sono obbligatori" }, { status: 400 });
    }

    // Usa il service role client per creare l'utente (bypassa le restrizioni)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Crea l'utente auth
    const { data: newUser, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: "Errore nella creazione utente" }, { status: 500 });
    }

    // Inserisci nella tabella users
    const { error: insertError } = await serviceClient
      .from("users")
      .insert({
        id: newUser.user.id,
        email: email,
        restaurant_id: restaurant_id,
        role: "restaurant",
      });

    if (insertError) {
      return NextResponse.json({ error: "Utente auth creato ma errore nell'inserimento: " + insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user_id: newUser.user.id });
  } catch (error: any) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
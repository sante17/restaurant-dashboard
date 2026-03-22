import { google } from "googleapis";
import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";

async function getSheetClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.split("\\n").join("\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("id", user.id)
      .single();
    if (!userData?.restaurant_id) return NextResponse.json({ error: "Nessun ristorante" }, { status: 400 });

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("google_sheet_id")
      .eq("id", userData.restaurant_id)
      .single();
    if (!restaurant?.google_sheet_id) return NextResponse.json({ error: "Google Sheet non configurato" }, { status: 400 });

    // Prendi tavoli attivi da Supabase
    const { data: tavoli } = await supabase
      .from("tables")
      .select("name, seats")
      .eq("restaurant_id", userData.restaurant_id)
      .eq("is_active", true)
      .order("name");

    if (!tavoli) return NextResponse.json({ error: "Nessun tavolo trovato" }, { status: 400 });

    const sheets = await getSheetClient();
    const sheetId = restaurant.google_sheet_id;

    // Pulisci il tab Tavoli (mantieni header)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: "Tavoli!A2:B100",
    });

    // Scrivi i tavoli aggiornati
    if (tavoli.length > 0) {
      const rows = tavoli.map((t) => [t.name, t.seats]);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Tavoli!A2:B${rows.length + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }

    return NextResponse.json({ success: true, count: tavoli.length });
  } catch (error: any) {
    console.error("Sync tavoli error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { google } from "googleapis";
import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";

async function getSheetClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
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

    const rid = userData.restaurant_id;

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("google_sheet_id")
      .eq("id", rid)
      .single();
    if (!restaurant?.google_sheet_id) return NextResponse.json({ error: "Google Sheet non configurato" }, { status: 400 });

    // Carica giorni di chiusura settimanale e chiusure straordinarie
    const [hoursRes, closuresRes] = await Promise.all([
      supabase.from("opening_hours").select("day_of_week, is_closed").eq("restaurant_id", rid).order("day_of_week"),
      supabase.from("closures").select("start_date, end_date, reason").eq("restaurant_id", rid).order("start_date"),
    ]);

    const DAYS = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];

    const sheets = await getSheetClient();
    const sheetId = restaurant.google_sheet_id;

    // Verifica se il tab "Chiusure" esiste, altrimenti crealo
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const chiusureTab = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === "Chiusure"
    );

    if (!chiusureTab) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: "Chiusure" }
            }
          }]
        }
      });
      // Scrivi header
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Chiusure!A1:D1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["Tipo", "DataInizio", "DataFine", "Motivo"]] },
      });
    }

    // Pulisci i dati (mantieni header)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: "Chiusure!A2:D200",
    });

    // Prepara le righe
    const rows: string[][] = [];

    // Giorni di chiusura settimanale
    const closedDays = (hoursRes.data || []).filter((h: any) => h.is_closed);
    for (const day of closedDays) {
      rows.push(["Settimanale", DAYS[day.day_of_week], "", "Chiusura settimanale"]);
    }

    // Chiusure straordinarie
    const extraClosures = closuresRes.data || [];
    for (const c of extraClosures) {
      rows.push(["Straordinaria", c.start_date, c.end_date, c.reason || ""]);
    }

    // Scrivi nel foglio
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Chiusure!A2:D" + (rows.length + 1),
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }

    return NextResponse.json({ success: true, weeklyClosures: closedDays.length, extraClosures: extraClosures.length });
  } catch (error: any) {
    console.error("Sync chiusure error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
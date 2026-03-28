import { google } from "googleapis";
import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";

async function getSheetClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.includes("-----BEGIN")
      ? process.env.GOOGLE_PRIVATE_KEY
      : process.env.GOOGLE_PRIVATE_KEY?.split("\\n").join("\n"),
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
    if (!userData?.restaurant_id)
      return NextResponse.json({ error: "Nessun ristorante" }, { status: 400 });

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("google_sheet_id, outdoor_from, outdoor_to")
      .eq("id", userData.restaurant_id)
      .single();
    if (!restaurant?.google_sheet_id)
      return NextResponse.json({ error: "Google Sheet non configurato" }, { status: 400 });

    const sheets = await getSheetClient();
    const sheetId = restaurant.google_sheet_id;

    // Verifica/crea tab "Configurazione"
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabEsiste = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === "Configurazione"
    );
    if (!tabEsiste) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "Configurazione" } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Configurazione!A1:B1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["Chiave", "Valore"]] },
      });
    }

    // Scrivi outdoor_from e outdoor_to
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: "Configurazione!A2:B10",
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "Configurazione!A2:B3",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ["outdoor_from", restaurant.outdoor_from || ""],
          ["outdoor_to", restaurant.outdoor_to || ""],
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Sync configurazione error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { google } from "googleapis";
import { createClient } from "../../../lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getSheetClient() {
 const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.includes("-----BEGIN") ? process.env.GOOGLE_PRIVATE_KEY : process.env.GOOGLE_PRIVATE_KEY?.split("\\n").join("\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function getRestaurantData(supabase: any, userId: string) {
  const { data: userData } = await supabase
    .from("users")
    .select("restaurant_id")
    .eq("id", userId)
    .single();
  if (!userData?.restaurant_id) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("google_sheet_id")
    .eq("id", userData.restaurant_id)
    .single();

  return { restaurantId: userData.restaurant_id, sheetId: restaurant?.google_sheet_id };
}

// GET: leggi prenotazioni dal Google Sheet
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const data = await getRestaurantData(supabase, user.id);
    if (!data?.sheetId) return NextResponse.json({ error: "Google Sheet non configurato" }, { status: 400 });

    const sheets = await getSheetClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: data.sheetId,
      range: "Prenotazioni!A:J",
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return NextResponse.json({ prenotazioni: [] });

    const headers = rows[0];
    const prenotazioni = rows.slice(1).map((row) => {
      const obj: any = {};
      headers.forEach((h: string, i: number) => {
        obj[h] = row[i] || "";
      });
      return obj;
    });

    // Prendi anche i tavoli da Supabase
    const { data: tavoli } = await supabase
      .from("tables")
      .select("name, seats")
      .eq("restaurant_id", data.restaurantId)
      .eq("is_active", true)
      .order("name");

    return NextResponse.json({ prenotazioni, tavoli: tavoli || [] });
  } catch (error: any) {
    console.error("GET prenotazioni error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: crea prenotazione manuale
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const data = await getRestaurantData(supabase, user.id);
    if (!data?.sheetId) return NextResponse.json({ error: "Google Sheet non configurato" }, { status: 400 });

    const body = await request.json();
    const { data: prenotazione, ora, tavolo, nome, telefono, email, persone } = body;

    // Genera ID tipo "pizza luna 42"
    const parole = ["pizza", "pasta", "gelato", "sole", "luna", "mare", "stella", "fiore", "vento", "cielo"];
    const id = `${parole[Math.floor(Math.random() * parole.length)]} ${parole[Math.floor(Math.random() * parole.length)]} ${Math.floor(Math.random() * 99) + 1}`;

    // Calcola OraFine (+2 ore)
    const [h, m] = ora.split(":").map(Number);
    const oraFine = `${String(h + 2).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const sheets = await getSheetClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: data.sheetId,
      range: "Prenotazioni!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[id, prenotazione, ora, oraFine, tavolo, nome, telefono || "", email || "", persone, "Confermata"]],
      },
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("POST prenotazione error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: modifica/cancella prenotazione
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const data = await getRestaurantData(supabase, user.id);
    if (!data?.sheetId) return NextResponse.json({ error: "Google Sheet non configurato" }, { status: 400 });

    const body = await request.json();
    const { id, action, updates } = body;

    const sheets = await getSheetClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: data.sheetId,
      range: "Prenotazioni!A:J",
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });

    if (action === "cancella") {
      rows[rowIndex][9] = "Cancellata";
    } else if (action === "modifica") {
      if (updates.data) rows[rowIndex][1] = updates.data;
      if (updates.ora) {
        rows[rowIndex][2] = updates.ora;
        const [h, m] = updates.ora.split(":").map(Number);
        rows[rowIndex][3] = `${String(h + 2).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
      if (updates.tavolo) rows[rowIndex][4] = updates.tavolo;
      if (updates.nome) rows[rowIndex][5] = updates.nome;
      if (updates.telefono) rows[rowIndex][6] = updates.telefono;
      if (updates.email) rows[rowIndex][7] = updates.email;
      if (updates.persone) rows[rowIndex][8] = updates.persone;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: data.sheetId,
      range: `Prenotazioni!A${rowIndex + 1}:J${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rows[rowIndex]] },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT prenotazione error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
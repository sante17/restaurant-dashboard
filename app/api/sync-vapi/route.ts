import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";

function generateSystemPrompt(data: any): string {
  const { restaurant, hours, categories, items, allergenInfo, tables, closures } = data;

  const DAYS = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];

  const closedDays = hours
    .filter((h: any) => h.is_closed)
    .map((h: any) => DAYS[h.day_of_week].toUpperCase());

  const closedDayStr = closedDays.length > 0 ? closedDays.join(", ") : "NESSUNO";

  let orariStr = "";
  const openDays = hours.filter((h: any) => !h.is_closed);
  if (openDays.length > 0) {
    const sample = openDays[0];
    if (sample.breakfast_open) {
      orariStr += "- Colazione: [" + (sample.breakfast_open?.slice(0,5) || "07:30") + " - " + (sample.breakfast_close?.slice(0,5) || "10:30") + "]\n";
    }
    if (sample.lunch_open) {
      orariStr += "- Pranzo: [" + (sample.lunch_open?.slice(0,5) || "12:00") + " - " + (sample.lunch_close?.slice(0,5) || "14:30") + "]\n";
    }
    if (sample.dinner_open) {
      orariStr += "- Cena: [" + (sample.dinner_open?.slice(0,5) || "19:00") + " - " + (sample.dinner_close?.slice(0,5) || "23:00") + "]";
    }
  }

  let menuStr = "";
  for (const cat of categories) {
    const catItems = items.filter((i: any) => i.category_id === cat.id && i.is_available);
    if (catItems.length === 0) continue;
    menuStr += "\n" + cat.name.toUpperCase() + ":\n";
    for (const item of catItems) {
      let line = "- [" + item.name;
      if (item.is_gluten_free) line += " (SENZA GLUTINE)";
      line += " - " + Number(item.price).toFixed(0) + " euro]";
      menuStr += line + "\n";
    }
  }

  // Tavoli interni sempre disponibili, esterni solo nel periodo dehors
  const tavoliInterni = tables.filter((t: any) => t.is_active && t.location !== "esterno");
  const tavoliEsterni = tables.filter((t: any) => t.is_active && t.location === "esterno");

  const tavoliInterniStr = tavoliInterni.map((t: any) => t.name + ": " + t.seats + " posti (interno)").join(", ");
  const tavoliEsterniStr = tavoliEsterni.map((t: any) => t.name + ": " + t.seats + " posti (esterno)").join(", ");

  const maxSeats = Math.max(...tables.filter((t: any) => t.is_active).map((t: any) => t.seats));
  const parkingStr = restaurant.parking_info || "Informazioni non disponibili";

  // Periodo dehors
  const outdoorFrom = restaurant.outdoor_from || null;
  const outdoorTo = restaurant.outdoor_to || null;
  let dehorsStr = "";
  if (outdoorFrom && outdoorTo && tavoliEsterni.length > 0) {
    dehorsStr = "DEHORS (tavoli esterni): disponibili dal " + outdoorFrom + " al " + outdoorTo + ".\n" +
      "Se la data richiesta dal cliente cade in questo periodo, chiedi se preferisce sedersi all'interno o all'esterno.\n" +
      "Passa la preferenza al tool check_disponibilita nel parametro 'posizione' (valori: 'interno' o 'esterno').\n" +
      "Se la data NON cade in questo periodo, NON chiedere la preferenza — prenota solo tavoli interni.";
  } else {
    dehorsStr = "DEHORS: non configurato o non attivo. Prenota sempre tavoli interni.";
  }

  let allergenStr = "";
  if (allergenInfo) {
    allergenStr = "\nOPZIONI SENZA GLUTINE: " + (allergenInfo.gluten_free_note || "Chiedere al personale");
    allergenStr += "\n\nALLERGENI PRESENTI IN CUCINA: " + (allergenInfo.allergens_in_kitchen || "Chiedere al personale");
    allergenStr += "\n\nOPZIONI VEGETARIANE: " + (allergenInfo.vegetarian_note || "Chiedere al personale");
    allergenStr += "\n\nOPZIONI VEGANE: " + (allergenInfo.vegan_note || "Chiedere al personale");
  }

  let chiusureStr = "Nessuna chiusura straordinaria programmata.";
  if (closures && closures.length > 0) {
    const futureClosures = closures.filter((c: any) => {
      const endDate = new Date(c.end_date);
      return endDate >= new Date();
    });
    if (futureClosures.length > 0) {
      chiusureStr = "ATTENZIONE - CHIUSURE STRAORDINARIE:\n";
      for (const c of futureClosures) {
        if (c.start_date === c.end_date) {
          chiusureStr += "- Chiuso il " + c.start_date;
        } else {
          chiusureStr += "- Chiuso dal " + c.start_date + " al " + c.end_date;
        }
        if (c.reason) chiusureStr += " (" + c.reason + ")";
        chiusureStr += "\n";
      }
      chiusureStr += "Se il cliente chiede di prenotare in una di queste date, NON chiamare il tool. Di subito che il ristorante e chiuso in quelle date e proponi una data alternativa.";
    }
  }

  const transferPhone = restaurant.transfer_phone || "+393289790104";

  const lines = [
    "SEI L'ASSISTENTE VOCALE DEL RISTORANTE " + restaurant.name.toUpperCase() + ". RISPONDI SEMPRE E SOLO IN ITALIANO.",
    "",
    "===============================================",
    "IDENTITA",
    "===============================================",
    "Il tuo nome e DEMETRIO. Sei l'assistente virtuale del ristorante.",
    "Dai del TU ai clienti. Sei simpatico, diretto, alla mano.",
    "Non sei formale. Parli come un amico che lavora al ristorante.",
    "Risposte CORTE: massimo 2 frasi per volta. Mai monologhi.",
    "Non dire mai che sei un'intelligenza artificiale a meno che non te lo chiedano direttamente.",
    "",
    "===============================================",
    "REGOLE ASSOLUTE -- PRIORITA MASSIMA",
    "===============================================",
    "LEGGI QUESTE REGOLE PRIMA DI OGNI RISPOSTA. SONO OBBLIGATORIE.",
    "",
    "DATA E ORA:",
    '1. La data di oggi e: {{"now" | date: "%A %d %B %Y", "Europe/Rome"}}',
    '2. L\'ora attuale e: {{"now" | date: "%H:%M", "Europe/Rome"}}',
    "3. FIDATI SOLO di questa data. NON inventare mai una data diversa.",
    '4. Se il cliente chiede \"che giorno e oggi\", rispondi SOLO con la data indicata sopra.',
    '5. \"domani\" = la data di oggi + 1 giorno. Calcola la data esatta in YYYY-MM-DD.',
    '6. \"dopodomani\" = la data di oggi + 2 giorni.',
    '7. \"venerdi prossimo\" = il prossimo venerdi a partire dalla data di oggi.',
    "8. Il ristorante e CHIUSO IL " + closedDayStr + ". Se la data calcolata cade di " + closedDayStr.toLowerCase() + ', NON prenotare. Di: \"Mi dispiace, il ' + closedDayStr.toLowerCase() + ' siamo chiusi! Vuoi un altro giorno?\"',
    "9. Converti SEMPRE le date in formato YYYY-MM-DD prima di chiamare qualsiasi tool.",
    "10. Converti SEMPRE gli orari in formato 24 ore HH:MM prima di chiamare qualsiasi tool.",
    "",
    "TOOL E RISULTATI:",
    "11. NON INVENTARE MAI NIENTE. Mai. Per nessun motivo.",
    "12. Quando chiami un tool, ASPETTA la risposta. Leggi ESATTAMENTE cosa dice.",
    '13. I tool restituiscono un JSON con un campo \"status\". LEGGI IL CAMPO STATUS.',
    "14. FIDATI SOLO del campo status nella risposta del tool. MAI della tua immaginazione.",
    "15. QUESTE REGOLE HANNO PRIORITA MASSIMA SU TUTTO IL RESTO DEL PROMPT.",
    "",
    "TOOL CALL — COMPORTAMENTO:",
    "16. PRIMA di chiamare un tool, devi dire UNA frase breve tipo 'Un attimo che controllo' o 'Vediamo subito'. Poi chiama il tool.",
    "17. Mentre aspetti la risposta del tool, NON aggiungere altre frasi. Hai gia detto che stai controllando.",
    "18. APPENA RICEVI la risposta del tool, RISPONDI IMMEDIATAMENTE al cliente. Non restare in silenzio.",
    "19. Se check_disponibilita risponde, COMUNICA SUBITO tavolo e orario. Se crea_prenotazione risponde, CONFERMA SUBITO.",
    "20. REGOLA CRITICA: dopo aver ricevuto la risposta di un tool, DEVI parlare. Mai silenzio dopo un risultato.",
    "===============================================",
    "STILE DI CONVERSAZIONE",
    "===============================================",
    '- Frasi brevi. Mai piu di 2 frasi di fila.',
    '- Dai del TU: \"Ciao! Per quanti siete?\" non \"Buonasera, per quante persone desidera?\"',
    '- Sii naturale: \"Perfetto!\", \"Fatto!\", \"Ci vediamo!\", \"Nessun problema!\"',
    "- Non ripetere mai tutti i dettagli. Conferma solo il minimo necessario.",
    '- Se non capisci: \"Scusa, non ho capito. Puoi ripetere?\"',
    '- Quando stai per cercare disponibilita: aspetta in silenzio, poi rispondi con il risultato.',
    '- Quando stai per salvare: aspetta in silenzio, poi conferma il risultato.',
    "- Le date vanno SEMPRE dette in italiano, mai in inglese.",
    "",
    "===============================================",
    "INFORMAZIONI SUL RISTORANTE",
    "===============================================",
    "",
    "NOME: " + restaurant.name.toUpperCase(),
    "INDIRIZZO: " + (restaurant.address || "Non specificato"),
    "TELEFONO: " + (restaurant.phone || "Non specificato"),
    "",
    "ORARI DI APERTURA:",
    orariStr,
    "",
    "GIORNO DI CHIUSURA SETTIMANALE:",
    "Il ristorante e CHIUSO il " + closedDayStr + ".",
    "",
    chiusureStr,
    "",
    "PARCHEGGIO PIU VICINO:",
    parkingStr,
    "",
    "TAVOLI DISPONIBILI:",
    tavoliInterniStr || "Nessun tavolo interno configurato.",
    tavoliEsterni.length > 0 ? "\nTAVOLI ESTERNI: " + tavoliEsterniStr : "",
    "Capienza massima per tavolo: " + maxSeats + " posti.",
    "",
    "===============================================",
    "DEHORS E TAVOLI ESTERNI",
    "===============================================",
    dehorsStr,
    "",
    "===============================================",
    "MENU",
    "===============================================",
    menuStr,
    "===============================================",
    "ALLERGENI E DIETE SPECIALI",
    "===============================================",
    allergenStr,
    "",
    "===============================================",
    "GESTIONE PRENOTAZIONI",
    "===============================================",
    "",
    "DURATA: Le prenotazioni sono da 2 ore.",
    "Quando trovi disponibilita, di' SEMPRE: 'Le prenotazioni sono da 2 ore, quindi dalle [ORA_INIZIO] alle [ORA_FINE].'",
    "",
    "NUMERO DI TELEFONO DEL CLIENTE:",
    "- Il numero del chiamante e gia disponibile: {{customer.number}}",
    "- USA SEMPRE questo numero automaticamente — non chiederlo al cliente.",
    "- Leggilo cifra per cifra per conferma: 'Il tuo numero e [cifra per cifra], giusto?'",
    "- Aspetta conferma (Si/Esatto/Giusto) prima di procedere.",
    "- Se il cliente dice che e sbagliato, chiedi il numero corretto cifra per cifra e riconferma.",
    "",
    "FLUSSO PER NUOVA PRENOTAZIONE:",
    "1. Chiedi: data, ora, numero di persone.",
    "2. Se la data cade nel periodo dehors (" + (outdoorFrom || "non configurato") + " - " + (outdoorTo || "non configurato") + "), chiedi: 'Preferisci sederti all'interno o all'esterno?'",
    "3. Chiama check_disponibilita con: data (YYYY-MM-DD), ora (HH:MM), persone, posizione ('interno' o 'esterno').",
    "4. Se disponibile: comunica tavolo e orario (es. 'dalle 20:00 alle 22:00'). Chiedi solo il nome.",
    "5. Leggi {{customer.number}} cifra per cifra e chiedi conferma.",
    "6. Chiama crea_prenotazione solo dopo conferma del numero.",
    "7. Se non disponibile: proponi orari alternativi.",
    "",
    "FLUSSO PER MODIFICA:",
    "1. Chiedi NOME e DATA della prenotazione.",
    "2. Chiama modifica_prenotazione con azione 'cerca'.",
    "3. Se non trova: chiedi CODICE o TELEFONO.",
    "",
    "FLUSSO PER CANCELLAZIONE:",
    "1. Cerca la prenotazione come sopra.",
    "2. Chiedi conferma, poi chiama con azione 'cancella'.",
    "",
    "TRASFERIMENTO A OPERATORE:",
    "Se il cliente chiede di parlare con una persona:",
    "- Chiama transfer_call_tool con destinazione " + transferPhone,
    "",
    "===============================================",
    "ARGOMENTI FUORI TEMA",
    "===============================================",
    "Se il cliente chiede cose non relative al ristorante:",
    "\"Posso aiutarti solo con prenotazioni, menu, orari e indicazioni. Serve qualcosa?\"",
  ];

  return lines.join("\n");
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { data: userData } = await supabase.from("users").select("restaurant_id").eq("id", user.id).single();
    if (!userData?.restaurant_id) return NextResponse.json({ error: "Nessun ristorante" }, { status: 400 });

    const rid = userData.restaurant_id;

    const [restaurantRes, hoursRes, categoriesRes, itemsRes, allergenRes, tablesRes, closuresRes] = await Promise.all([
      supabase.from("restaurants").select("*").eq("id", rid).single(),
      supabase.from("opening_hours").select("*").eq("restaurant_id", rid).order("day_of_week"),
      supabase.from("menu_categories").select("*").eq("restaurant_id", rid).order("sort_order"),
      supabase.from("menu_items").select("*").eq("restaurant_id", rid).order("sort_order"),
      supabase.from("allergen_info").select("*").eq("restaurant_id", rid).single(),
      supabase.from("tables").select("*").eq("restaurant_id", rid).eq("is_active", true).order("name"),
      supabase.from("closures").select("*").eq("restaurant_id", rid).order("start_date"),
    ]);

    const restaurant = restaurantRes.data;
    if (!restaurant) return NextResponse.json({ error: "Ristorante non trovato" }, { status: 404 });

    if (!restaurant.vapi_assistant_id || !restaurant.vapi_api_key) {
      return NextResponse.json({ error: "Credenziali Vapi non configurate" }, { status: 400 });
    }

    const getResponse = await fetch(
      "https://api.vapi.ai/assistant/" + restaurant.vapi_assistant_id,
      { method: "GET", headers: { "Authorization": "Bearer " + restaurant.vapi_api_key } }
    );

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      return NextResponse.json({ error: "Errore lettura agente Vapi: " + errorText }, { status: 500 });
    }

    const currentAssistant = await getResponse.json();
    const currentModel = currentAssistant.model;

    if (!currentModel) {
      return NextResponse.json({ error: "Configurazione modello non trovata" }, { status: 500 });
    }

    const prompt = generateSystemPrompt({
      restaurant,
      hours: hoursRes.data || [],
      categories: categoriesRes.data || [],
      items: itemsRes.data || [],
      allergenInfo: allergenRes.data,
      tables: tablesRes.data || [],
      closures: closuresRes.data || [],
    });

    const updatedModel = { ...currentModel, messages: [{ role: "system", content: prompt }] };

    const patchBody: any = {
      model: updatedModel,
      // -------------------------------------------------------
      // BLOCCO 5 — Fix tool call silence
      // Aumenta la soglia "no punctuation" per evitare che
      // l'agente inizi a parlare mentre il tool è in esecuzione.
      // -------------------------------------------------------
      startSpeakingPlan: {
        waitSeconds: 0.4,
        smartEndpointingEnabled: true,
        transcriptionEndpointingPlan: {
          onPunctuationSeconds: 0.1,
          onNoPunctuationSeconds: 1.5, // era default 0.5 — alzato per evitare falsi start
          onNumberSeconds: 0.5,
        },
      },
      // Riduce il rumore di fondo durante le chiamate
      backgroundDenoisingEnabled: true,
    };

    const patchResponse = await fetch(
      "https://api.vapi.ai/assistant/" + restaurant.vapi_assistant_id,
      {
        method: "PATCH",
        headers: { "Authorization": "Bearer " + restaurant.vapi_api_key, "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      }
    );

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      return NextResponse.json({ error: "Errore aggiornamento Vapi: " + errorText }, { status: 500 });
    }

    return NextResponse.json({ success: true, promptLength: prompt.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// app/api/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";

type BookingPayload = {
  nome?: string;
  telefono?: string;
  tipo?: "ASPORTO" | "CONSEGNA" | "TAVOLO";
  data?: string; // YYYY-MM-DD oppure DD/MM/YYYY
  ora?: string; // HH:mm (accetto anche 12.30 o 12)
  ordine?: string;

  indirizzo?: string;
  persone?: string;
  pagamento?: string;
  allergeni?: string; // testo tipo "Senza glutine, Senza lattosio"
  note?: string;

  negozio?: string;
  canale?: string; // "APP"
  honeypot?: string; // anti-spam
};

function normalizeDate(v: string) {
  const s = (v ?? "").toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // accetta DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return s;
}

function normalizeTime(v: string) {
  const s = (v ?? "").toString().trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;

  // accetta 12.30
  const dot = s.match(/^(\d{1,2})\.(\d{2})$/);
  if (dot) return `${dot[1].padStart(2, "0")}:${dot[2]}`;

  // accetta 12  -> 12:00
  const hh = s.match(/^(\d{1,2})$/);
  if (hh) return `${hh[1].padStart(2, "0")}:00`;

  return s;
}

function isValidDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function isValidTime(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

export async function POST(req: NextRequest) {
  try {
    const BOOKING_WEBAPP_URL = process.env.BOOKING_WEBAPP_URL;

    if (!BOOKING_WEBAPP_URL) {
      return NextResponse.json(
        {
          error:
            "BOOKING_WEBAPP_URL mancante (configura su .env.local e su Vercel).",
        },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as BookingPayload | null;

    // anti-spam: se compilano un campo invisibile, blocca
    if (body?.honeypot && String(body.honeypot).trim().length > 0) {
      return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
    }

    const nome = (body?.nome ?? "").toString().trim();
    const telefono = (body?.telefono ?? "").toString().trim();
    const tipo = (body?.tipo ?? "").toString().trim().toUpperCase() as
      | "ASPORTO"
      | "CONSEGNA"
      | "TAVOLO"
      | "";

    // ✅ normalizzazione
    const data = normalizeDate((body?.data ?? "").toString());
    const ora = normalizeTime((body?.ora ?? "").toString());

    const ordine = (body?.ordine ?? "").toString().trim();

    const indirizzo = (body?.indirizzo ?? "").toString().trim();
    const persone = (body?.persone ?? "").toString().trim();
    const pagamento = (body?.pagamento ?? "").toString().trim();
    const allergeni = (body?.allergeni ?? "").toString().trim();
    const note = (body?.note ?? "").toString().trim();

    const negozio = (body?.negozio ?? "Pala Pizza").toString().trim();
    const canale = (body?.canale ?? "APP").toString().trim().toUpperCase();

    // ⚠️ obbligatori
    if (!nome || !telefono || !tipo || !data || !ora || !ordine) {
      return NextResponse.json(
        {
          error:
            "Campi obbligatori mancanti (nome, telefono, tipo, data, ora, ordine/prenotazione).",
          received: { nome, telefono, tipo, data, ora, ordine },
        },
        { status: 400 }
      );
    }

    if (!["ASPORTO", "CONSEGNA", "TAVOLO"].includes(tipo)) {
      return NextResponse.json({ error: "Tipo non valido." }, { status: 400 });
    }
    if (!isValidDate(data)) {
      return NextResponse.json(
        { error: "Formato data non valido (YYYY-MM-DD o DD/MM/YYYY).", received: { data } },
        { status: 400 }
      );
    }
    if (!isValidTime(ora)) {
      return NextResponse.json(
        { error: "Formato ora non valido (HH:mm).", received: { ora } },
        { status: 400 }
      );
    }

    if (tipo === "CONSEGNA" && !indirizzo) {
      return NextResponse.json(
        { error: "Per la consegna serve l’indirizzo." },
        { status: 400 }
      );
    }
    if (tipo === "TAVOLO" && !persone) {
      return NextResponse.json(
        { error: "Per il tavolo serve il numero persone." },
        { status: 400 }
      );
    }

    // payload verso Apps Script
    const forward = {
      ts: new Date().toISOString(),
      negozio,
      nome,
      telefono,
      tipo,
      data,
      ora,
      ordine,
      indirizzo: tipo === "CONSEGNA" ? indirizzo : "",
      persone: tipo === "TAVOLO" ? persone : "",
      pagamento,
      allergeni,
      note,
      stato: "NUOVO",
      canale, // APP
    };

    const res = await fetch(BOOKING_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(forward),
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      return NextResponse.json(
        { error: `Errore pannello: ${res.status} ${res.statusText}`, details: text },
        { status: 502 }
      );
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // ok: può essere testo
    }

    return NextResponse.json({
      ok: true,
      message: "Ricevuto ✅ Il locale confermerà appena possibile.",
      response: parsed ?? text,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Errore server /api/bookings", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCookieName, verifySessionToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

async function requireAdmin() {
  const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";
  if (!ADMIN_SESSION_SECRET) {
    return { ok: false as const, res: jsonNoStore({ ok: false, error: "ADMIN_SESSION_SECRET mancante" }, { status: 500 }) };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName())?.value;

  if (!verifySessionToken(token, ADMIN_SESSION_SECRET)) {
    return { ok: false as const, res: jsonNoStore({ ok: false, error: "Non autorizzato" }, { status: 401 }) };
  }

  return { ok: true as const };
}

export async function GET() {
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || "";
  const GOOGLE_SCRIPT_SECRET = process.env.GOOGLE_SCRIPT_SECRET || "";

  if (!GOOGLE_SCRIPT_URL) {
    return jsonNoStore({ ok: false, error: "GOOGLE_SCRIPT_URL mancante" }, { status: 500 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const url =
    `${GOOGLE_SCRIPT_URL}?action=list&limit=300` +
    (GOOGLE_SCRIPT_SECRET ? `&secret=${encodeURIComponent(GOOGLE_SCRIPT_SECRET)}` : "");

  const r = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await r.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: false, error: "Risposta non JSON", raw: text };
  }

  if (!r.ok || data?.ok === false) {
    return jsonNoStore(
      { ok: false, error: data?.error || "Errore lista prenotazioni", detail: data },
      { status: 500 }
    );
  }

  return jsonNoStore({ ok: true, rows: data.rows || [], count: data.count || 0 });
}

/**
 * ✅ Aggiorna stato prenotazione (CONFERMATA / ANNULLATA / CONSEGNATA / NUOVA)
 * Body atteso:
 * {
 *   action: "updateStatus",
 *   stato: "CONFERMATA",
 *   timestampISO?: string,
 *   telefono?: string,
 *   dataISO?: string,
 *   ora?: string
 * }
 */
export async function POST(req: Request) {
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || "";
  const GOOGLE_SCRIPT_SECRET = process.env.GOOGLE_SCRIPT_SECRET || "";

  if (!GOOGLE_SCRIPT_URL) {
    return jsonNoStore({ ok: false, error: "GOOGLE_SCRIPT_URL mancante" }, { status: 500 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "");

  if (action !== "updateStatus") {
    return jsonNoStore({ ok: false, error: "Azione non valida" }, { status: 400 });
  }

  const stato = String(body?.stato || body?.status || body?.newStatus || "").toUpperCase().trim();
  const allowed = new Set(["NUOVA", "CONFERMATA", "CONSEGNATA", "ANNULLATA"]);
  if (!allowed.has(stato)) {
    return jsonNoStore({ ok: false, error: "Stato non valido" }, { status: 400 });
  }

  const timestampISO = String(body?.timestampISO || "").trim();
  const telefono = String(body?.telefono || "").trim();
  const dataISO = String(body?.dataISO || body?.data || "").trim(); // YYYY-MM-DD
  const ora = String(body?.ora || "").trim();

  // serve almeno un identificatore decente
  if (!timestampISO && !(telefono && dataISO && ora)) {
    return jsonNoStore(
      { ok: false, error: "Manca identificatore (timestampISO oppure telefono+dataISO+ora)" },
      { status: 400 }
    );
  }

  // ✅ 1) PROVA: POST JSON al Google Script (se gestisce doPost con JSON)
  try {
    const payload = {
      action: "updateStatus",
      stato,
      timestampISO,
      telefono,
      dataISO,
      ora,
      ...(GOOGLE_SCRIPT_SECRET ? { secret: GOOGLE_SCRIPT_SECRET } : {}),
    };

    const r1 = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    const t1 = await r1.text();
    let d1: any;
    try {
      d1 = JSON.parse(t1);
    } catch {
      d1 = { ok: false, error: "Risposta non JSON", raw: t1 };
    }

    if (r1.ok && d1?.ok !== false) {
      return jsonNoStore({ ok: true, result: d1 });
    }

    // se fallisce, facciamo fallback
  } catch {
    // fallback sotto
  }

  // ✅ 2) FALLBACK: GET querystring (molti Apps Script gestiscono doGet per update)
  const qs =
    `?action=updateStatus` +
    `&stato=${encodeURIComponent(stato)}` +
    (timestampISO ? `&timestampISO=${encodeURIComponent(timestampISO)}` : "") +
    (telefono ? `&telefono=${encodeURIComponent(telefono)}` : "") +
    (dataISO ? `&dataISO=${encodeURIComponent(dataISO)}` : "") +
    (ora ? `&ora=${encodeURIComponent(ora)}` : "") +
    (GOOGLE_SCRIPT_SECRET ? `&secret=${encodeURIComponent(GOOGLE_SCRIPT_SECRET)}` : "");

  const url2 = `${GOOGLE_SCRIPT_URL}${qs}`;

  const r2 = await fetch(url2, { method: "GET", cache: "no-store" });
  const t2 = await r2.text();

  let d2: any;
  try {
    d2 = JSON.parse(t2);
  } catch {
    d2 = { ok: false, error: "Risposta non JSON", raw: t2 };
  }

  if (!r2.ok || d2?.ok === false) {
    return jsonNoStore(
      { ok: false, error: d2?.error || "Errore aggiornamento stato", detail: d2 },
      { status: 500 }
    );
  }

  return jsonNoStore({ ok: true, result: d2 });
}
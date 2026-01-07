import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCookieName, verifySessionToken } from "@/lib/adminAuth";

export async function GET() {
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || "";
  const GOOGLE_SCRIPT_SECRET = process.env.GOOGLE_SCRIPT_SECRET || "";
  const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";

  if (!GOOGLE_SCRIPT_URL) {
    return NextResponse.json({ ok: false, error: "GOOGLE_SCRIPT_URL mancante" }, { status: 500 });
  }
  if (!ADMIN_SESSION_SECRET) {
    return NextResponse.json({ ok: false, error: "ADMIN_SESSION_SECRET mancante" }, { status: 500 });
  }

  // ✅ Auth via cookie (Next 16: cookies() è async)
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName())?.value;

  if (!verifySessionToken(token, ADMIN_SESSION_SECRET)) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

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
    return NextResponse.json(
      { ok: false, error: data?.error || "Errore lista prenotazioni", detail: data },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, rows: data.rows || [], count: data.count || 0 });
}

export const dynamic = "force-dynamic";
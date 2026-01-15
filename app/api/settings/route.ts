// app/api/settings/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  return (process.env[name] || "").trim();
}

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

async function callGoogleScript(body: any) {
  const url = env("GOOGLE_SCRIPT_URL");
  const secret = env("GOOGLE_SCRIPT_SECRET"); // chiamata server->server

  if (!url) throw new Error("GOOGLE_SCRIPT_URL mancante in .env.local");
  if (!secret) throw new Error("GOOGLE_SCRIPT_SECRET mancante in .env.local");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...body, secret }),
  });

  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function extractBookingsOpen(data: any): boolean | null {
  const v =
    data?.bookings_open ??
    data?.bookingsOpen ??
    data?.settings?.bookings_open ??
    data?.settings?.bookingsOpen;

  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v;

  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;

  return null;
}

// ✅ GET /api/settings -> legge bookings_open (pubblico)
export async function GET() {
  try {
    const { ok, status, data } = await callGoogleScript({ action: "getSettings" });

    if (!ok || !data?.ok) {
      return jsonNoStore(
        { ok: false, error: data?.error || "Errore settings." },
        { status: status || 500 }
      );
    }

    const bookings_open = extractBookingsOpen(data);

    // se per qualche motivo manca, NON bloccare: fallback TRUE
    return jsonNoStore(
      { ok: true, bookings_open: bookings_open ?? true, settings: data.settings },
      { status: 200 }
    );
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: e?.message || "Errore server." },
      { status: 500 }
    );
  }
}

// ✅ POST /api/settings (fallback) -> idem GET
export async function POST() {
  return GET();
}
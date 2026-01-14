// app/api/settings/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  return (process.env[name] || "").trim();
}

async function callGoogleScript(body: any) {
  const url = env("GOOGLE_SCRIPT_URL");
  const secret = env("GOOGLE_SCRIPT_SECRET"); // admin secret

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

// ✅ GET /api/settings  -> legge bookings_open
export async function GET() {
  try {
    const { ok, status, data } = await callGoogleScript({ action: "getSettings" });
    if (!ok || !data?.ok) {
      return NextResponse.json({ ok: false, error: data?.error || "Errore settings." }, { status: status || 500 });
    }
    return NextResponse.json({ ok: true, settings: data.settings }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Errore server." }, { status: 500 });
  }
}

// ✅ POST /api/settings (fallback) -> idem GET
export async function POST() {
  return GET();
}
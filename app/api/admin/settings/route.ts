// app/api/admin/settings/route.ts
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
  const secret = env("GOOGLE_SCRIPT_SECRET");

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

function readBoolLoose(body: any): { ok: true; value: boolean } | { ok: false; error: string } {
  const raw = body?.value ?? body?.open ?? body?.bookings_open ?? body?.bookingsOpen;

  if (raw === undefined) {
    return { ok: false, error: "Manca 'value' (o 'open' / 'bookings_open') nel body." };
  }

  if (raw === true || raw === false) return { ok: true, value: raw };
  if (raw === 1 || raw === "1") return { ok: true, value: true };
  if (raw === 0 || raw === "0") return { ok: true, value: false };

  const s = String(raw).trim().toLowerCase();
  if (["true", "yes", "y", "on"].includes(s)) return { ok: true, value: true };
  if (["false", "no", "n", "off"].includes(s)) return { ok: true, value: false };

  return { ok: true, value: !!raw };
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
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

// ✅ POST /api/admin/settings  -> set bookings_open true/false
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const parsed = readBoolLoose(body);
    if (!parsed.ok) return jsonNoStore({ ok: false, error: parsed.error }, { status: 400 });

    const { ok, status, data } = await callGoogleScript({
      action: "setBookingsOpen",
      value: parsed.value,
    });

    if (!ok || !data?.ok) {
      return jsonNoStore(
        { ok: false, error: data?.error || "Errore setBookingsOpen." },
        { status: status || 500 }
      );
    }

    const bookings_open = extractBookingsOpen(data) ?? parsed.value;

    return jsonNoStore(
      { ok: true, bookings_open, settings: data.settings },
      { status: 200 }
    );
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message || "Errore server." }, { status: 500 });
  }
}

// ✅ GET /api/admin/settings -> legge settings (no-cache)
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

    return jsonNoStore(
      { ok: true, bookings_open, settings: data.settings },
      { status: 200 }
    );
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message || "Errore server." }, { status: 500 });
  }
}
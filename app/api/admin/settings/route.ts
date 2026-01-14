// app/api/admin/settings/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  return (process.env[name] || "").trim();
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

  // accetta boolean, "true"/"false", 1/0, "1"/"0"
  if (raw === true || raw === false) return { ok: true, value: raw };
  if (raw === 1 || raw === "1") return { ok: true, value: true };
  if (raw === 0 || raw === "0") return { ok: true, value: false };

  const s = String(raw).trim().toLowerCase();
  if (["true", "yes", "y", "on"].includes(s)) return { ok: true, value: true };
  if (["false", "no", "n", "off"].includes(s)) return { ok: true, value: false };

  // fallback: boolean JS, ma almeno è esplicito
  return { ok: true, value: !!raw };
}

// ✅ POST /api/admin/settings  -> set bookings_open true/false
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const parsed = readBoolLoose(body);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const { ok, status, data } = await callGoogleScript({
      action: "setBookingsOpen",
      value: parsed.value,
    });

    if (!ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || "Errore setBookingsOpen." },
        { status: status || 500 }
      );
    }

    return NextResponse.json({ ok: true, settings: data.settings }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Errore server." }, { status: 500 });
  }
}

// (opzionale) GET admin settings
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
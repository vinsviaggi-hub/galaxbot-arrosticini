import { NextResponse } from "next/server";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
const GOOGLE_SCRIPT_SECRET = process.env.GOOGLE_SCRIPT_SECRET;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ ok: false, error: "Body JSON mancante." }, { status: 400 });
    }

    // anti-spam
    if (typeof body.honeypot === "string" && body.honeypot.trim().length > 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (!GOOGLE_SCRIPT_URL) {
      return NextResponse.json(
        { ok: false, error: "GOOGLE_SCRIPT_URL mancante in .env.local" },
        { status: 500 }
      );
    }

    // ✅ inietto il secret qui
    const payload = {
      ...body,
      ...(GOOGLE_SCRIPT_SECRET ? { secret: GOOGLE_SCRIPT_SECRET } : {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const r = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    }).finally(() => clearTimeout(timeout));

    const text = await r.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, raw: text };
    }

    // se Apps Script dice ok:false o la fetch non è ok
    if (!r.ok || data?.ok === false) {
      const status = data?.code === 401 ? 401 : 500;
      return NextResponse.json(
        { ok: false, error: data?.error || "Errore dal Google Script", detail: data },
        { status }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "Timeout: il Google Script non risponde."
        : err?.message || "Errore server";

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";